'use server'

import { revalidatePath } from 'next/cache'
import { asc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { eintrag, positionBaustein, stellungnahme } from '@/db/schema'
import { verlangeBenutzer } from '@/auth/sitzung'
import { gutachtenSchema } from '@/autoixpert/typen'
import { leseFalldaten, platzhalterWerte } from '@/autoixpert/felder'
import type { Extraktion } from '@/pruefbericht/schema'
import { pruefeVorExport, type Pruefergebnis } from '@/export/waechter'
import {
  alsKlartext,
  baueAbsaetze,
  dateiname,
  type Ergebnisart,
  type Kopfdaten,
} from '@/export/hausstil'
import { baueDocx } from '@/export/docx'
import { formulierePositionen } from './komposition'
import { ladeStellungnahme } from './abfragen'

export interface ExportErgebnis {
  fehler?: string
  hinweis?: string
}

/* ------------------------------------------------------------------ *
 * Ausformulieren
 * ------------------------------------------------------------------ */

/**
 * Formuliert alle Positionen aus, die Bausteine tragen.
 *
 * Der ausformulierte Text ersetzt den Baustein nicht: er wird als
 * `textFinal` des ersten Bausteins abgelegt, die übrigen Bausteine der
 * Position entfallen. Damit bleibt die Zuordnung zum Bibliothekseintrag
 * erhalten — sie trägt später die Wirkungsstatistik.
 */
export async function formuliereAus(stellungnahmeId: string): Promise<ExportErgebnis> {
  await verlangeBenutzer()

  const s = await ladeStellungnahme(stellungnahmeId)
  if (!s) return { fehler: 'Stellungnahme nicht gefunden.' }

  const werte = falldatenWerte(s.fall?.daten)

  const auftraege = s.positionen
    .filter((p) => p.behandlung !== 'nicht_bestreiten' && p.bausteine.length > 0)
    .map((p) => ({
      positionId: p.id,
      auftrag: {
        positionBezeichnung: p.bezeichnung,
        begruendungVersicherer: p.begruendungVersicherer,
        bausteine: p.bausteine.map((b) => ({
          text: b.textFinal ?? '',
          herkunft: b.typ === 'bibliothek' ? ('bibliothek' as const) : ('eigener_text' as const),
        })),
        platzhalterWerte: werte,
        betragGutachten: p.betragGutachten,
        betragGekuerzt: p.betragGekuerzt,
      },
    }))

  if (auftraege.length === 0) {
    return { fehler: 'Keine Position trägt bislang einen Baustein.' }
  }

  const ergebnisse = await formulierePositionen(auftraege)

  let gelungen = 0
  const gescheitert: string[] = []
  for (const e of ergebnisse) {
    if (!e.text) {
      gescheitert.push(e.fehler ?? 'unbekannt')
      continue
    }
    const p = s.positionen.find((x) => x.id === e.positionId)!
    const erster = p.bausteine[0]!
    await db
      .update(positionBaustein)
      .set({ textFinal: e.text })
      .where(eq(positionBaustein.id, erster.id))
    for (const weitere of p.bausteine.slice(1)) {
      await db.delete(positionBaustein).where(eq(positionBaustein.id, weitere.id))
    }
    gelungen++
  }

  revalidatePath(`/stellungnahmen/${stellungnahmeId}`)

  if (gescheitert.length > 0) {
    return {
      fehler: `${gelungen} Positionen ausformuliert, ${gescheitert.length} gescheitert: ${gescheitert[0]}`,
    }
  }
  return { hinweis: `${gelungen} Positionen ausformuliert.` }
}

/* ------------------------------------------------------------------ *
 * Prüfen und ausgeben
 * ------------------------------------------------------------------ */

function falldatenWerte(daten: unknown): Record<string, string> {
  const geprueft = gutachtenSchema.safeParse(daten)
  if (!geprueft.success) return {}
  return platzhalterWerte(leseFalldaten(geprueft.data))
}

/** Sammelt alle Zahlen, die im Fall belegt sind — Grundlage für R2. */
function belegteZahlen(
  s: Awaited<ReturnType<typeof ladeStellungnahme>>,
  werte: Record<string, string>,
): string[] {
  if (!s) return []
  const zahlen = new Set<string>()

  for (const wert of Object.values(werte)) {
    for (const t of wert.matchAll(/[\d.,]+/g)) zahlen.add(t[0])
  }
  for (const p of s.positionen) {
    for (const feld of [p.betragGutachten, p.betragGekuerzt, p.differenz]) {
      if (feld) zahlen.add(feld)
    }
  }
  const e = s.extraktion as Extraktion | null
  if (e?.summeGutachten != null) zahlen.add(String(e.summeGutachten))
  if (e?.summeGekuerzt != null) zahlen.add(String(e.summeGekuerzt))

  return [...zahlen]
}

export async function pruefeStellungnahme(stellungnahmeId: string): Promise<Pruefergebnis> {
  await verlangeBenutzer()

  const s = await ladeStellungnahme(stellungnahmeId)
  if (!s) return { befunde: [], gesperrt: false, zusammenfassung: { sperrt: 0, warnt: 0 } }

  const werte = falldatenWerte(s.fall?.daten)

  // Die internen Hinweise der zugrunde liegenden Einträge werden für die
  // Prüfung nachgeladen — im Exportmodell selbst kommen sie nicht vor (R4).
  const eintragsIds = s.positionen
    .flatMap((p) => p.bausteine.map((b) => b.eintragId))
    .filter((id): id is string => Boolean(id))

  const hinweise = new Map<string, string | null>()
  for (const id of new Set(eintragsIds)) {
    const zeilen = await db
      .select({ hinweise: eintrag.hinweise })
      .from(eintrag)
      .where(eq(eintrag.id, id))
      .limit(1)
    hinweise.set(id, zeilen[0]?.hinweise ?? null)
  }

  const bausteine = s.positionen
    .filter((p) => p.behandlung !== 'nicht_bestreiten')
    .flatMap((p, i) =>
      p.bausteine.map((b) => ({
        positionNummer: i + 1,
        positionBezeichnung: p.bezeichnung,
        text: b.textFinal ?? '',
        interneHinweise: b.eintragId ? (hinweise.get(b.eintragId) ?? null) : null,
      })),
    )

  return pruefeVorExport({
    bausteine,
    belegteZahlen: belegteZahlen(s, werte),
    gesamttext: bausteine.map((b) => b.text).join('\n\n'),
  })
}

export interface Ausgabe {
  fehler?: string
  klartext?: string
  docxBase64?: string
  docxName?: string
  txtName?: string
}

/**
 * Erzeugt beide Ausgabeformate.
 *
 * Sperrende Befunde verhindern die Ausgabe — das ist der Punkt der
 * Wächter. Warnungen erscheinen, halten aber nicht auf.
 */
export async function erzeugeAusgabe(stellungnahmeId: string): Promise<Ausgabe> {
  await verlangeBenutzer()

  const s = await ladeStellungnahme(stellungnahmeId)
  if (!s) return { fehler: 'Stellungnahme nicht gefunden.' }

  const pruefung = await pruefeStellungnahme(stellungnahmeId)
  if (pruefung.gesperrt) {
    return {
      fehler:
        `${pruefung.zusammenfassung.sperrt} Prüfung${pruefung.zusammenfassung.sperrt === 1 ? '' : 'en'} ` +
        'sperr' +
        (pruefung.zusammenfassung.sperrt === 1 ? 't' : 'en') +
        ' die Ausgabe. Bitte zuerst beheben.',
    }
  }

  const e = s.extraktion as Extraktion | null
  const bezeichnung = falldatenName(s.fall?.daten) ?? e?.aktenzeichen ?? null

  const kopf: Kopfdaten = {
    ort: 'Krefeld',
    datum: new Date(),
    empfaengerName: s.empfaengerName ?? '',
    empfaengerStrasse: s.empfaengerStrasse,
    empfaengerPlzOrt: s.empfaengerPlzOrt,
    betreff: s.betreff ?? 'Betreff: Stellungnahme',
    anrede: s.anrede ?? 'Sehr geehrte Damen und Herren,',
    einleitungDatum: s.einleitungDatum,
    einleitungMedium: s.einleitungMedium === 'mail' ? 'mail' : 'schreiben',
    pruefdienstleister: e?.pruefdienstleister ?? null,
    vorbemerkungEinfuegen: s.vorbemerkungEinfuegen,
  }

  const positionen = s.positionen
    .filter((p) => p.behandlung !== 'nicht_bestreiten' && p.bausteine.length > 0)
    .map((p, i) => ({
      nummer: i + 1,
      ueberschrift: p.bezeichnung,
      text: p.bausteine
        .map((b) => b.textFinal ?? '')
        .filter(Boolean)
        .join('\n\n'),
    }))

  if (positionen.length === 0) {
    return { fehler: 'Keine Position enthält Text — es gäbe nichts auszugeben.' }
  }

  const absaetze = baueAbsaetze({
    kopf,
    vorbemerkung: null,
    positionen,
    ergebnisart: (s.ergebnisAbsatz ? 'einzelfrage' : 'vollstaendig') as Ergebnisart,
    ergebnisAbsatz: s.ergebnisAbsatz,
  })

  try {
    const docx = await baueDocx({ kopf, absaetze })
    return {
      klartext: alsKlartext(absaetze),
      docxBase64: Buffer.from(docx).toString('base64'),
      docxName: dateiname(bezeichnung, kopf.datum, 'docx'),
      txtName: dateiname(bezeichnung, kopf.datum, 'txt'),
    }
  } catch (fehler) {
    return {
      fehler: fehler instanceof Error ? fehler.message : 'Die Ausgabe ist fehlgeschlagen.',
    }
  }
}

function falldatenName(daten: unknown): string | null {
  const geprueft = gutachtenSchema.safeParse(daten)
  if (!geprueft.success) return null
  return leseFalldaten(geprueft.data).anspruchsteller?.name ?? null
}

/* ------------------------------------------------------------------ *
 * F9 — eigenen Text in die Bibliothek übernehmen
 * ------------------------------------------------------------------ */

/**
 * Legt aus vorgemerkten eigenen Texten Bibliotheks-Entwürfe an.
 *
 * Die Versichererbegründung der Position wird als „Typische Begründung"
 * vorbelegt — genau das Feld, das später die Zuordnung trägt. Der Eintrag
 * entsteht als `entwurf`; freigeben darf nur ein Mensch (Konzept E5).
 */
export async function uebernehmeInBibliothek(stellungnahmeId: string): Promise<ExportErgebnis> {
  const benutzer = await verlangeBenutzer()

  const s = await ladeStellungnahme(stellungnahmeId)
  if (!s) return { fehler: 'Stellungnahme nicht gefunden.' }

  const vorgemerkt = s.positionen.flatMap((p) =>
    p.bausteine
      .filter((b) => b.inBibliothekUebernehmen && b.typ === 'eigener_text' && b.textFinal)
      .map((b) => ({ position: p, baustein: b })),
  )

  if (vorgemerkt.length === 0) {
    return { hinweis: 'Kein eigener Text ist für die Bibliothek vorgemerkt.' }
  }

  // Nächste freie Nummer im Auffangabschnitt.
  const vorhandene = await db
    .select({ nummer: eintrag.nummer })
    .from(eintrag)
    .where(eq(eintrag.bereich, 'kalkulation'))
    .orderBy(asc(eintrag.nummer))

  let naechste = 1
  for (const v of vorhandene) {
    const treffer = v.nummer.match(/^99\.(\d+)$/)
    if (treffer) naechste = Math.max(naechste, Number(treffer[1]) + 1)
  }

  let angelegt = 0
  for (const { position: p, baustein: b } of vorgemerkt) {
    await db.insert(eintrag).values({
      nummer: `99.${naechste++}`,
      titel: p.bezeichnung,
      bereich: 'kalkulation',
      abschnitt: '99. Aus Stellungnahmen übernommen',
      typischeBegruendung: p.begruendungVersicherer,
      gegenargument: b.textFinal,
      status: 'entwurf',
      herkunft: 'aus_stellungnahme',
      erstelltVon: benutzer.id,
      quelldatei: `Stellungnahme ${s.betreff ?? s.id}`,
    })
    await db
      .update(positionBaustein)
      .set({ inBibliothekUebernehmen: false })
      .where(eq(positionBaustein.id, b.id))
    angelegt++
  }

  revalidatePath('/bibliothek')
  revalidatePath(`/stellungnahmen/${stellungnahmeId}`)
  return {
    hinweis: `${angelegt} ${angelegt === 1 ? 'Eintrag' : 'Einträge'} als Entwurf angelegt — Freigabe in der Bibliothek.`,
  }
}

/** Merkt die Stellungnahme als versendet. */
export async function markiereVersendet(stellungnahmeId: string): Promise<ExportErgebnis> {
  await verlangeBenutzer()
  await db
    .update(stellungnahme)
    .set({ versendetAm: new Date() })
    .where(eq(stellungnahme.id, stellungnahmeId))
  revalidatePath('/stellungnahmen')
  return { hinweis: 'Als versendet vermerkt.' }
}

/** Kopfdaten der Stellungnahme ändern. */
export async function speichereKopf(
  stellungnahmeId: string,
  felder: {
    empfaengerName?: string
    empfaengerStrasse?: string
    empfaengerPlzOrt?: string
    betreff?: string
    anrede?: string
    einleitungDatum?: string
    einleitungMedium?: string
    ergebnisAbsatz?: string
  },
): Promise<ExportErgebnis> {
  await verlangeBenutzer()
  await db
    .update(stellungnahme)
    .set({
      empfaengerName: felder.empfaengerName?.trim() || null,
      empfaengerStrasse: felder.empfaengerStrasse?.trim() || null,
      empfaengerPlzOrt: felder.empfaengerPlzOrt?.trim() || null,
      betreff: felder.betreff?.trim() || null,
      anrede: felder.anrede?.trim() || null,
      einleitungDatum: felder.einleitungDatum?.trim() || null,
      einleitungMedium: felder.einleitungMedium?.trim() || null,
      ergebnisAbsatz: felder.ergebnisAbsatz?.trim() || null,
    })
    .where(eq(stellungnahme.id, stellungnahmeId))

  revalidatePath(`/stellungnahmen/${stellungnahmeId}`)
  return { hinweis: 'Gespeichert.' }
}

/** Positionen ohne Fall-Zuordnung brauchen keine Extraktion. */
export async function ladeFallId(stellungnahmeId: string): Promise<string | null> {
  await verlangeBenutzer()
  const zeilen = await db
    .select({ fallId: stellungnahme.fallId })
    .from(stellungnahme)
    .where(eq(stellungnahme.id, stellungnahmeId))
    .limit(1)
  return zeilen[0]?.fallId ?? null
}
