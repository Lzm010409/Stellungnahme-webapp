'use server'

import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { bild } from '@/db/schema'
import { verlangeBenutzer } from '@/auth/sitzung'
import { sucheBilder, wirdVerwendet, type Bibliotheksbild } from './bibliothek'
import { leseThemen } from './themen'

export interface BildErgebnis {
  fehler?: string
  hinweis?: string
}

/** Titel, Beschreibung und Themen ändern. */
export async function beschrifteBild(
  bildId: string,
  daten: { titel: string; beschreibung: string; themen: string },
): Promise<BildErgebnis> {
  await verlangeBenutzer()

  await db
    .update(bild)
    .set({
      titel: daten.titel.trim() || null,
      beschreibung: daten.beschreibung.trim() || null,
      themen: leseThemen(daten.themen),
    })
    .where(eq(bild.id, bildId))

  revalidatePath('/bilder')
  return { hinweis: 'Gespeichert.' }
}

/**
 * Nimmt ein Bild aus einem Schreiben in die Bibliothek auf.
 *
 * Das Bild bleibt dieselbe Zeile — es wird nicht kopiert. Ein
 * Bibliotheksbild, das in mehreren Schreiben steht, soll überall dieselbe
 * Beschreibung tragen.
 */
export async function uebernehmeInBildbibliothek(bildId: string): Promise<BildErgebnis> {
  await verlangeBenutzer()

  await db.update(bild).set({ inBibliothek: true }).where(eq(bild.id, bildId))

  revalidatePath('/bilder')
  return { hinweis: 'In die Bildbibliothek übernommen — jetzt noch beschriften.' }
}

/** Nimmt ein Bild wieder aus der Bibliothek, ohne es zu löschen. */
export async function ausBibliothekNehmen(bildId: string): Promise<BildErgebnis> {
  await verlangeBenutzer()
  await db.update(bild).set({ inBibliothek: false }).where(eq(bild.id, bildId))
  revalidatePath('/bilder')
  return { hinweis: 'Aus der Bibliothek genommen. Das Bild selbst bleibt erhalten.' }
}

/**
 * Löscht ein Bild — aber nicht, solange es in einem Schreiben steht.
 *
 * Die Lücke fiele sonst erst beim Erzeugen des Word-Dokuments auf, und
 * dann steht dort nur noch der Marker.
 */
export async function loescheBild(bildId: string): Promise<BildErgebnis> {
  await verlangeBenutzer()

  const anzahl = await wirdVerwendet(bildId)
  if (anzahl > 0) {
    return {
      fehler:
        `Dieses Bild steht in ${anzahl} ${anzahl === 1 ? 'Schreiben' : 'Schreiben'} — ` +
        'es lässt sich nicht löschen. Nimm es dort zuerst heraus.',
    }
  }

  await db.delete(bild).where(eq(bild.id, bildId))
  revalidatePath('/bilder')
  return { hinweis: 'Bild gelöscht.' }
}

/** Suche für die Randspalte im Brief. */
export async function durchsucheBildbibliothek(begriff: string): Promise<Bibliotheksbild[]> {
  await verlangeBenutzer()
  return sucheBilder(begriff, '', 12)
}
