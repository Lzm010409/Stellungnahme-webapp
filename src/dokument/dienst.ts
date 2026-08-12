import 'server-only'
import { and, eq, inArray, isNull, sql } from 'drizzle-orm'
import { db } from '@/db'
import { eintrag, stellungnahme } from '@/db/schema'
import type { Extraktion } from '@/pruefbericht/schema'
import type { GeladeneStellungnahme } from '@/stellungnahme/abfragen'
import { erzeugeDokument, type DokumentBaustein } from './erzeugen'
import { istDokument, type Elementknoten } from './typen'

/**
 * Beschafft das Dokument einer Stellungnahme — und legt es an, wenn es
 * noch keines gibt.
 *
 * Stellungnahmen aus der Zeit der Auswahlmaske tragen kein Dokument. Beim
 * ersten Öffnen entsteht es aus ihren Bausteinen: dieselbe Erzeugung wie
 * bei einer neuen Stellungnahme, nur mit vorhandenem Inhalt. Ein eigenes
 * Migrationsskript gibt es deshalb nicht — und keine Stellungnahme, die
 * zwischen zwei Welten hängt.
 */
export async function stelleDokumentBereit(
  s: GeladeneStellungnahme,
): Promise<{ dokument: Elementknoten; stand: number }> {
  if (istDokument(s.dokument)) {
    return { dokument: s.dokument, stand: s.dokumentStand }
  }

  const dokument = await baueAusBausteinen(s)

  // Nur schreiben, wenn tatsächlich noch nichts dasteht: zwei gleichzeitig
  // geöffnete Fenster dürfen sich nicht gegenseitig überschreiben.
  const geschrieben = await db
    .update(stellungnahme)
    .set({ dokument, dokumentStand: 1, dokumentGeaendertAm: new Date() })
    .where(and(eq(stellungnahme.id, s.id), isNull(stellungnahme.dokument)))
    .returning({ id: stellungnahme.id })

  if (geschrieben.length > 0) return { dokument, stand: 1 }

  const [aktuell] = await db
    .select({ dokument: stellungnahme.dokument, stand: stellungnahme.dokumentStand })
    .from(stellungnahme)
    .where(eq(stellungnahme.id, s.id))
    .limit(1)

  return istDokument(aktuell?.dokument)
    ? { dokument: aktuell.dokument, stand: aktuell.stand }
    : { dokument, stand: 1 }
}

async function baueAusBausteinen(s: GeladeneStellungnahme): Promise<Elementknoten> {
  const eintragsIds = [
    ...new Set(
      s.positionen
        .flatMap((p) => p.bausteine.map((b) => b.eintragId))
        .filter((id): id is string => Boolean(id)),
    ),
  ]

  const beschriftung = new Map<string, { nummer: string; titel: string }>()
  if (eintragsIds.length > 0) {
    const zeilen = await db
      .select({ id: eintrag.id, nummer: eintrag.nummer, titel: eintrag.titel })
      .from(eintrag)
      .where(inArray(eintrag.id, eintragsIds))
    for (const z of zeilen) beschriftung.set(z.id, { nummer: z.nummer, titel: z.titel })
  }

  const extraktion = s.extraktion as Extraktion | null

  return erzeugeDokument({
    betreff: s.betreff,
    anrede: s.anrede,
    kopf: {
      einleitungDatum: s.einleitungDatum,
      einleitungMedium: s.einleitungMedium === 'mail' ? 'mail' : 'schreiben',
      pruefdienstleister: extraktion?.pruefdienstleister ?? null,
    },
    positionen: s.positionen.map((p) => ({
      id: p.id,
      bezeichnung: p.bezeichnung,
      behandlung: p.behandlung,
      bausteine: p.bausteine.map(
        (b): DokumentBaustein => ({
          text: b.textFinal,
          eintragId: b.eintragId,
          nummer: b.eintragId ? (beschriftung.get(b.eintragId)?.nummer ?? null) : null,
          titel: b.eintragId ? (beschriftung.get(b.eintragId)?.titel ?? null) : null,
          herkunft: b.herkunft,
        }),
      ),
    })),
    ergebnisAbsatz: s.ergebnisAbsatz,
  })
}

/**
 * Schreibt eine neue Fassung.
 *
 * Der mitgelieferte Stand muss der sein, auf dem der Editor aufsetzt.
 * Passt er nicht, hat jemand anderes zwischenzeitlich gespeichert — dann
 * wird nicht geschrieben, sondern gemeldet. Stilles Überschreiben wäre der
 * schlechteste aller Ausgänge.
 */
export async function schreibeDokument(
  stellungnahmeId: string,
  dokument: Elementknoten,
  stand: number,
): Promise<{ stand: number } | { konflikt: number }> {
  const geschrieben = await db
    .update(stellungnahme)
    .set({
      dokument,
      dokumentStand: sql`${stellungnahme.dokumentStand} + 1`,
      dokumentGeaendertAm: new Date(),
    })
    .where(and(eq(stellungnahme.id, stellungnahmeId), eq(stellungnahme.dokumentStand, stand)))
    .returning({ stand: stellungnahme.dokumentStand })

  if (geschrieben.length > 0) return { stand: geschrieben[0]!.stand }

  const [aktuell] = await db
    .select({ stand: stellungnahme.dokumentStand })
    .from(stellungnahme)
    .where(eq(stellungnahme.id, stellungnahmeId))
    .limit(1)

  return { konflikt: aktuell?.stand ?? 0 }
}

/** Liest das gespeicherte Dokument, ohne eines anzulegen. */
export async function leseDokument(stellungnahmeId: string): Promise<Elementknoten | null> {
  const [zeile] = await db
    .select({ dokument: stellungnahme.dokument })
    .from(stellungnahme)
    .where(eq(stellungnahme.id, stellungnahmeId))
    .limit(1)
  return istDokument(zeile?.dokument) ? zeile.dokument : null
}
