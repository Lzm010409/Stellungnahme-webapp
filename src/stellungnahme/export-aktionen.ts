'use server'

import { revalidatePath } from 'next/cache'
import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { bild, stellungnahme } from '@/db/schema'
import { verlangeBenutzer } from '@/auth/sitzung'

/**
 * Die kurzen Wege rund um die Ausgabe.
 *
 * Das Erzeugen der Dokumente selbst läuft nicht mehr hier, sondern als
 * Ereignisstrom über `/api/stellungnahmen/[id]/ausgabe` — eine Aktion kann
 * nur einmal antworten, und der Vorgang soll melden, woran er arbeitet.
 */
export interface ExportErgebnis {
  fehler?: string
  hinweis?: string
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
    einleitungDatum?: string
    einleitungMedium?: string
  },
): Promise<ExportErgebnis> {
  await verlangeBenutzer()
  await db
    .update(stellungnahme)
    .set({
      empfaengerName: felder.empfaengerName?.trim() || null,
      empfaengerStrasse: felder.empfaengerStrasse?.trim() || null,
      empfaengerPlzOrt: felder.empfaengerPlzOrt?.trim() || null,
      einleitungDatum: felder.einleitungDatum?.trim() || null,
      einleitungMedium: felder.einleitungMedium?.trim() || null,
    })
    .where(eq(stellungnahme.id, stellungnahmeId))

  revalidatePath(`/stellungnahmen/${stellungnahmeId}`)
  return { hinweis: 'Gespeichert.' }
}

/**
 * Löscht eine Stellungnahme mit allem, was nur zu ihr gehört.
 *
 * Positionen, ihre Bausteine und die zugeordneten Bilder gehen mit — dafür
 * sorgt die Datenbank selbst. Zwei Dinge tut diese Aktion vorher von Hand:
 *
 * Bilder, die in der **Bildbibliothek** stehen, werden von der Stellungnahme
 * gelöst statt gelöscht. Sie gehören dort nicht mehr diesem einen Fall,
 * sondern dem Büro; ein aufbereiteter Kalkulationsauszug soll nicht
 * verschwinden, weil das Schreiben von damals weggeräumt wird.
 *
 * Und ein **versendetes** Schreiben lässt sich nicht löschen. Was aus dem
 * Haus ist, bleibt nachvollziehbar; wer es doch loswerden will, muss den
 * Versandvermerk vorher zurücknehmen.
 */
export async function loescheStellungnahme(stellungnahmeId: string): Promise<ExportErgebnis> {
  await verlangeBenutzer()

  const [vorhanden] = await db
    .select({ versendetAm: stellungnahme.versendetAm, betreff: stellungnahme.betreff })
    .from(stellungnahme)
    .where(eq(stellungnahme.id, stellungnahmeId))
    .limit(1)

  if (!vorhanden) return { fehler: 'Diese Stellungnahme gibt es nicht mehr.' }
  if (vorhanden.versendetAm) {
    return {
      fehler:
        'Dieses Schreiben ist als versendet vermerkt und lässt sich nicht löschen. ' +
        'Nimm den Vermerk zurück, wenn es wirklich weg soll.',
    }
  }

  await db
    .update(bild)
    .set({ stellungnahmeId: null })
    .where(and(eq(bild.stellungnahmeId, stellungnahmeId), eq(bild.inBibliothek, true)))

  await db.delete(stellungnahme).where(eq(stellungnahme.id, stellungnahmeId))

  revalidatePath('/stellungnahmen')
  revalidatePath('/bilder')
  return { hinweis: 'Stellungnahme gelöscht.' }
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
