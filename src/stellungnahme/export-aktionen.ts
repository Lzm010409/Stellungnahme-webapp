'use server'

import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { stellungnahme } from '@/db/schema'
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
