'use server'

import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { stellungnahme } from '@/db/schema'
import { verlangeBenutzer } from '@/auth/sitzung'
import { gutachtenSchema } from '@/autoixpert/typen'
import { leseFalldaten } from '@/autoixpert/felder'
import type { Extraktion } from '@/pruefbericht/schema'
import { alsKlartext, dateiname, type Kopfdaten } from '@/export/hausstil'
import { baueDocx } from '@/export/docx'
import { leseDokument } from '@/dokument/dienst'
import { dokumentNachAbsaetzen, leseStruktur } from '@/dokument/nach-absaetzen'
import { istDokument, type Elementknoten } from '@/dokument/typen'
import { pruefeDokument } from './editor-aktionen'
import { ladeStellungnahme } from './abfragen'

export interface ExportErgebnis {
  fehler?: string
  hinweis?: string
}

export interface Ausgabe {
  fehler?: string
  klartext?: string
  docxBase64?: string
  docxName?: string
  txtName?: string
}

function falldatenName(daten: unknown): string | null {
  const geprueft = gutachtenSchema.safeParse(daten)
  if (!geprueft.success) return null
  return leseFalldaten(geprueft.data).anspruchsteller?.name ?? null
}

/**
 * Erzeugt beide Ausgabeformate aus dem Schreiben.
 *
 * Quelle ist der Dokumentbaum — entweder die Fassung, die gerade im Editor
 * steht, oder die zuletzt gespeicherte. Sperrende Befunde verhindern die
 * Ausgabe; Warnungen erscheinen, halten aber nicht auf.
 */
export async function erzeugeAusgabe(
  stellungnahmeId: string,
  fassung?: unknown,
): Promise<Ausgabe> {
  await verlangeBenutzer()

  const s = await ladeStellungnahme(stellungnahmeId)
  if (!s) return { fehler: 'Stellungnahme nicht gefunden.' }

  const dokument: Elementknoten | null = istDokument(fassung)
    ? fassung
    : await leseDokument(stellungnahmeId)
  if (!dokument) return { fehler: 'Zu dieser Stellungnahme gibt es noch kein Schreiben.' }

  const pruefung = await pruefeDokument(stellungnahmeId, dokument)
  if (pruefung.gesperrt) {
    return {
      fehler:
        `${pruefung.zusammenfassung.sperrt} Prüfung${pruefung.zusammenfassung.sperrt === 1 ? '' : 'en'} ` +
        'sperr' +
        (pruefung.zusammenfassung.sperrt === 1 ? 't' : 'en') +
        ' die Ausgabe. Bitte zuerst beheben.',
    }
  }

  const struktur = leseStruktur(dokument)
  if (struktur.abschnitte.length === 0) {
    return { fehler: 'Kein Abschnitt trägt Text — es gäbe nichts auszugeben.' }
  }

  const e = s.extraktion as Extraktion | null
  const bezeichnung = falldatenName(s.fall?.daten) ?? e?.aktenzeichen ?? null

  const kopf: Kopfdaten = {
    ort: 'Krefeld',
    datum: new Date(),
    empfaengerName: s.empfaengerName ?? '',
    empfaengerStrasse: s.empfaengerStrasse,
    empfaengerPlzOrt: s.empfaengerPlzOrt,
    betreff: struktur.betreff || (s.betreff ?? 'Betreff: Stellungnahme'),
    anrede: struktur.anrede || (s.anrede ?? 'Sehr geehrte Damen und Herren,'),
    einleitungDatum: s.einleitungDatum,
    einleitungMedium: s.einleitungMedium === 'mail' ? 'mail' : 'schreiben',
    pruefdienstleister: e?.pruefdienstleister ?? null,
    vorbemerkungEinfuegen: s.vorbemerkungEinfuegen,
  }

  const absaetze = dokumentNachAbsaetzen(dokument)

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
