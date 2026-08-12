import 'server-only'
import { and, asc, count, eq, ilike, or, sql, type SQL } from 'drizzle-orm'
import { db } from '@/db'
import {
  beleg,
  eintrag,
  eintragErgaenzung,
  eintragPlatzhalter,
  eintragVariante,
  eintragVorbedingung,
} from '@/db/schema'

/**
 * Qualifizierter Verweis auf die Zeile der äußeren Abfrage.
 *
 * In rohem SQL rendert Drizzle eine Spaltenreferenz wie `eintrag.id` als
 * unqualifiziertes `"id"`. In einer korrelierten Unterabfrage trifft das auf
 * die gleichnamige Spalte der Untertabelle: die Bedingung ist dann nie
 * erfüllt und liefert still 0, ohne dass ein Fehler entstünde. Deshalb wird
 * der Bezug hier ausdrücklich mit dem Tabellennamen qualifiziert.
 */
const EINTRAG_ID = sql`${sql.identifier('eintrag')}.${sql.identifier('id')}`

export type Bereich = 'kalkulation' | 'wertminderung' | 'wbw' | 'restwert' | 'sonderfall'
export type EintragStatus = 'entwurf' | 'pruefung' | 'freigegeben' | 'zurueckgezogen'

export interface Suchfilter {
  suche?: string
  bereich?: Bereich
  status?: EintragStatus
  abschnitt?: string
}

/**
 * Volltextsuche über die Bibliothek.
 *
 * Bewusst über `ILIKE` statt über einen Vektorindex: bei 68 Einträgen ist das
 * augenblicklich schnell, braucht keinen externen Einbettungsdienst und
 * liefert vorhersagbare Treffer. Die semantische Suche kommt dazu, wenn die
 * Bibliothek dafür groß genug ist — das Feld dafür ist im Schema angelegt.
 */
export async function sucheEintraege(filter: Suchfilter) {
  const bedingungen: SQL[] = []

  if (filter.bereich) bedingungen.push(eq(eintrag.bereich, filter.bereich))
  if (filter.status) bedingungen.push(eq(eintrag.status, filter.status))
  if (filter.abschnitt) bedingungen.push(eq(eintrag.abschnitt, filter.abschnitt))

  const suche = filter.suche?.trim()
  if (suche) {
    const muster = `%${suche}%`
    const treffer = or(
      ilike(eintrag.titel, muster),
      ilike(eintrag.nummer, muster),
      ilike(eintrag.gegenargument, muster),
      ilike(eintrag.typischeBegruendung, muster),
      ilike(eintrag.vorgehen, muster),
      ilike(eintrag.abschnitt, muster),
      // Auch Varianten durchsuchen — dort stecken die Bauteilbezeichnungen,
      // nach denen man am ehesten sucht.
      sql`exists (
        select 1 from ${eintragVariante} v
        where v.eintrag_id = ${EINTRAG_ID}
          and (v.bezeichnung ilike ${muster} or v.text ilike ${muster})
      )`,
    )
    if (treffer) bedingungen.push(treffer)
  }

  const wo = bedingungen.length > 0 ? and(...bedingungen) : undefined

  const zeilen = await db
    .select({
      id: eintrag.id,
      nummer: eintrag.nummer,
      titel: eintrag.titel,
      bereich: eintrag.bereich,
      abschnitt: eintrag.abschnitt,
      status: eintrag.status,
      typischeBegruendung: eintrag.typischeBegruendung,
      gegenargument: eintrag.gegenargument,
      vorgehen: eintrag.vorgehen,
      haeufigkeitText: eintrag.haeufigkeitText,
      platzhalterOffen: sql<number>`(
        select count(*) from ${eintragPlatzhalter} p where p.eintrag_id = ${EINTRAG_ID}
      )`.mapWith(Number),
      belegeUnverifiziert: sql<number>`(
        select count(*) from ${beleg} b
        where b.eintrag_id = ${EINTRAG_ID} and b.verifiziert_am is null
      )`.mapWith(Number),
      vorbedingungen: sql<number>`(
        select count(*) from ${eintragVorbedingung} v where v.eintrag_id = ${EINTRAG_ID}
      )`.mapWith(Number),
    })
    .from(eintrag)
    .where(wo)
    .orderBy(asc(eintrag.bereich), asc(sortierSchluessel()))

  return zeilen
}

/**
 * Sortiert Gliederungsnummern natürlich: „1.2" vor „1.10", „11.1" nach „2.1".
 * Ohne diese Umformung würde alphabetisch sortiert und die Bibliothek läge
 * in einer Reihenfolge, die niemand erwartet.
 */
function sortierSchluessel(): SQL {
  return sql`(
    select string_agg(lpad(teil, 4, '0'), '.' order by ordnung)
    from unnest(string_to_array(regexp_replace(${eintrag.nummer}, '^[A-Z]\\.', ''), '.'))
      with ordinality as t(teil, ordnung)
  )`
}

export async function ladeAbschnitte(bereich?: Bereich) {
  const zeilen = await db
    .select({ abschnitt: eintrag.abschnitt, anzahl: count() })
    .from(eintrag)
    .where(bereich ? eq(eintrag.bereich, bereich) : undefined)
    .groupBy(eintrag.abschnitt)
    .orderBy(asc(eintrag.abschnitt))
  return zeilen
}

export async function zaehleNachStatus() {
  const zeilen = await db
    .select({ status: eintrag.status, anzahl: count() })
    .from(eintrag)
    .groupBy(eintrag.status)
  return Object.fromEntries(zeilen.map((z) => [z.status, z.anzahl])) as Record<
    EintragStatus,
    number | undefined
  >
}

/** Lädt einen Eintrag mit allen Unterdatensätzen. */
export async function ladeEintrag(id: string) {
  const zeilen = await db.select().from(eintrag).where(eq(eintrag.id, id)).limit(1)
  const treffer = zeilen[0]
  if (!treffer) return null

  const [varianten, ergaenzungen, platzhalter, vorbedingungen, belege] = await Promise.all([
    db
      .select()
      .from(eintragVariante)
      .where(eq(eintragVariante.eintragId, id))
      .orderBy(asc(eintragVariante.reihenfolge)),
    db
      .select()
      .from(eintragErgaenzung)
      .where(eq(eintragErgaenzung.eintragId, id))
      .orderBy(asc(eintragErgaenzung.reihenfolge)),
    db
      .select()
      .from(eintragPlatzhalter)
      .where(eq(eintragPlatzhalter.eintragId, id))
      .orderBy(asc(eintragPlatzhalter.schluessel)),
    db.select().from(eintragVorbedingung).where(eq(eintragVorbedingung.eintragId, id)),
    db.select().from(beleg).where(eq(beleg.eintragId, id)),
  ])

  return { ...treffer, varianten, ergaenzungen, platzhalter, vorbedingungen, belege }
}

export type EintragMitDetails = NonNullable<Awaited<ReturnType<typeof ladeEintrag>>>
export type EintragListe = Awaited<ReturnType<typeof sucheEintraege>>
