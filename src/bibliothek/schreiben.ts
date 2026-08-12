import { eq, and } from 'drizzle-orm'
import type { db as DbTyp } from '@/db'
import {
  beleg,
  eintrag,
  eintragErgaenzung,
  eintragPlatzhalter,
  eintragVariante,
  eintragVorbedingung,
} from '@/db/schema'
import type { GeparsterEintrag } from './parser'

export interface SchreibErgebnis {
  neu: number
  ersetzt: number
}

/**
 * Schreibt geparste Einträge in die Datenbank.
 *
 * Ein Eintrag wird über (Bereich, Nummer) identifiziert. Existiert er schon,
 * werden er und seine Unterdatensätze ersetzt — die Migration ist damit
 * wiederholbar, ohne Dubletten zu erzeugen. Ein bereits freigegebener Eintrag
 * behält seinen Status nicht: er fällt zurück auf `entwurf`, weil sich sein
 * Text geändert hat und die Freigabe sich auf den alten Stand bezog.
 */
export async function schreibeEintraege(
  db: typeof DbTyp,
  eintraege: GeparsterEintrag[],
): Promise<SchreibErgebnis> {
  let neu = 0
  let ersetzt = 0

  for (const e of eintraege) {
    await db.transaction(async (tx) => {
      const vorhanden = await tx
        .select({ id: eintrag.id })
        .from(eintrag)
        .where(and(eq(eintrag.bereich, e.bereich), eq(eintrag.nummer, e.nummer)))
        .limit(1)

      const bestehendeId = vorhanden[0]?.id
      if (bestehendeId) {
        // Unterdatensätze hängen per ON DELETE CASCADE am Eintrag.
        await tx.delete(eintrag).where(eq(eintrag.id, bestehendeId))
        ersetzt++
      } else {
        neu++
      }

      const [angelegt] = await tx
        .insert(eintrag)
        .values({
          nummer: e.nummer,
          titel: e.titel,
          bereich: e.bereich,
          abschnitt: e.abschnitt,
          typischeBegruendung: e.typischeBegruendung,
          gegenargument: e.gegenargument || null,
          vorgehen: e.vorgehen,
          hinweise: e.hinweise,
          haeufigkeitText: e.haeufigkeitText,
          status: 'entwurf',
          herkunft: 'migration',
          quelldatei: e.quelldatei,
        })
        .returning({ id: eintrag.id })

      const eintragId = angelegt!.id

      if (e.varianten.length > 0) {
        await tx.insert(eintragVariante).values(
          e.varianten.map((v, i) => ({
            eintragId,
            bezeichnung: v.bezeichnung || `Variante ${i + 1}`,
            text: v.text,
            reihenfolge: i,
          })),
        )
      }

      if (e.ergaenzungen.length > 0) {
        await tx.insert(eintragErgaenzung).values(
          e.ergaenzungen.map((x, i) => ({
            eintragId,
            titel: x.titel,
            text: x.text,
            reihenfolge: i,
          })),
        )
      }

      if (e.platzhalter.length > 0) {
        await tx.insert(eintragPlatzhalter).values(
          e.platzhalter.map((p) => ({
            eintragId,
            schluessel: p.schluessel,
            art: p.art,
            quelle: 'manuell' as const,
            pflicht: true,
          })),
        )
      }

      if (e.vorbedingungsKandidaten.length > 0) {
        await tx.insert(eintragVorbedingung).values(
          e.vorbedingungsKandidaten.map((text) => ({
            eintragId,
            text,
            mussBestaetigtWerden: true,
          })),
        )
      }

      if (e.belege.length > 0) {
        await tx.insert(beleg).values(
          e.belege.map((b) => ({
            eintragId,
            typ: 'urteil' as const,
            gericht: b.gericht,
            aktenzeichen: b.aktenzeichen,
            // verifiziertAm bleibt leer — der Export ist bis zur Bestätigung
            // gesperrt (Konzept R1).
          })),
        )
      }
    })
  }

  return { neu, ersetzt }
}
