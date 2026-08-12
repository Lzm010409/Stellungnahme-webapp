'use server'

import { revalidatePath } from 'next/cache'
import { and, asc, eq, max } from 'drizzle-orm'
import { db } from '@/db'
import { eintrag, fall, position, positionBaustein, stellungnahme } from '@/db/schema'
import { verlangeBenutzer } from '@/auth/sitzung'
import { leseBericht } from '@/pruefbericht/einlesen'
import { extrahierePositionen } from '@/pruefbericht/extraktion'
import { pruefeSonderfaelle } from '@/pruefbericht/sonderfaelle'
import { differenz, type Extraktion } from '@/pruefbericht/schema'
import { gutachtenSchema } from '@/autoixpert/typen'
import { leseFalldaten, schlageEmpfaengerVor } from '@/autoixpert/felder'
import { kiVerfuegbar } from '@/ki/client'
import { ladeVerwendbareEintraege, sucheInBibliothek } from './abfragen'
import { findeVorschlaege } from './treffer'

export interface AktionsErgebnis {
  fehler?: string
  hinweis?: string
  stellungnahmeId?: string
}

/** Höchstgrösse für den Upload — gescannte Berichte werden schnell gross. */
const MAX_BYTES = 25 * 1024 * 1024

/**
 * Nimmt einen Prüfbericht entgegen und legt daraus eine Stellungnahme an.
 *
 * Ablauf: einlesen (je Seite Text oder Bild), Positionen auslesen,
 * Sonderfall-Prüfliste durchgehen, Positionen speichern. Die Auswahl der
 * Gegenargumente passiert danach in der Auswahlmaske — hier wird nichts
 * über die Argumentation entschieden.
 */
export async function werteBerichtAus(
  _zustand: AktionsErgebnis,
  formular: FormData,
): Promise<AktionsErgebnis> {
  const benutzer = await verlangeBenutzer()

  const datei = formular.get('pruefbericht')
  if (!(datei instanceof File) || datei.size === 0) {
    return { fehler: 'Bitte einen Prüfbericht als PDF auswählen.' }
  }
  if (datei.size > MAX_BYTES) {
    return { fehler: `Die Datei ist grösser als ${MAX_BYTES / 1024 / 1024} MB.` }
  }
  if (!kiVerfuegbar()) {
    return {
      fehler:
        'Die Auswertung braucht einen Zugang zum Sprachmodell. Bitte ANTHROPIC_API_KEY ' +
        'in den Umgebungsvariablen hinterlegen.',
    }
  }

  const fallId = String(formular.get('fallId') ?? '') || null

  let extraktion: Extraktion
  let seitenzahl: number
  try {
    const bericht = await leseBericht(Buffer.from(await datei.arrayBuffer()))
    seitenzahl = bericht.seitenzahl
    const ergebnis = await extrahierePositionen(bericht)
    extraktion = ergebnis.extraktion
  } catch (fehler) {
    console.error('Auswertung des Prüfberichts fehlgeschlagen:', fehler)
    return {
      fehler:
        fehler instanceof Error
          ? fehler.message
          : 'Der Prüfbericht konnte nicht ausgewertet werden.',
    }
  }

  // Fahrzeug aus dem Fall holen, damit sich der Grundlagenfehler B.7 prüfen lässt.
  let fahrzeugAusFall: string | null = null
  let empfaenger: ReturnType<typeof schlageEmpfaengerVor> | null = null
  if (fallId) {
    const zeilen = await db.select().from(fall).where(eq(fall.id, fallId)).limit(1)
    const geprueft = zeilen[0] ? gutachtenSchema.safeParse(zeilen[0]!.daten) : null
    if (geprueft?.success) {
      const d = leseFalldaten(geprueft.data)
      fahrzeugAusFall = [d.fahrzeug.hersteller, d.fahrzeug.modell, d.fahrzeug.kennzeichen]
        .filter(Boolean)
        .join(' ')
      empfaenger = schlageEmpfaengerVor(d)
    }
  }

  const befunde = pruefeSonderfaelle(extraktion, fahrzeugAusFall)

  // Nur Positionen aus Abschnitten, die zur Stellungnahme gehören.
  const unfallfremdeTypen = new Set(
    extraktion.abschnitte.filter((a) => !a.fuerStellungnahmeRelevant).map((a) => a.typ),
  )
  const relevante = extraktion.positionen.filter((p) => !unfallfremdeTypen.has(p.typ))

  const [angelegt] = await db
    .insert(stellungnahme)
    .values({
      fallId,
      modus: 'standard',
      extraktion,
      sonderfaelle: befunde,
      pruefberichtDateiname: datei.name,
      pruefberichtSeiten: seitenzahl,
      empfaengerName: empfaenger?.empfaenger?.name ?? null,
      empfaengerStrasse: empfaenger?.empfaenger?.strasse ?? null,
      empfaengerPlzOrt: empfaenger?.empfaenger?.plzOrt ?? null,
      betreff: empfaenger?.betreff ?? null,
      anrede: empfaenger?.anrede ?? 'Sehr geehrte Damen und Herren,',
      erstelltVon: benutzer.id,
    })
    .returning({ id: stellungnahme.id })

  const stellungnahmeId = angelegt!.id

  if (relevante.length > 0) {
    await db.insert(position).values(
      relevante.map((p, i) => ({
        stellungnahmeId,
        bezeichnung: p.bezeichnung,
        seite: p.seite,
        betragGutachten: p.betragGutachten?.toString() ?? null,
        betragGekuerzt: p.betragGekuerzt?.toString() ?? null,
        differenz: differenz(p)?.toString() ?? null,
        begruendungVersicherer: p.begruendungVersicherer,
        behandlung: 'offen' as const,
        reihenfolge: i,
      })),
    )
  }

  revalidatePath('/stellungnahmen')

  const uebersprungen = extraktion.positionen.length - relevante.length
  return {
    stellungnahmeId,
    hinweis:
      uebersprungen > 0
        ? `${relevante.length} Positionen übernommen, ${uebersprungen} aus unfallfremden Abschnitten ausgelassen.`
        : undefined,
  }
}

/** Ermittelt die Vorschläge für alle Positionen einer Stellungnahme. */
export async function holeVorschlaege(stellungnahmeId: string) {
  await verlangeBenutzer()

  const [positionen, bibliothek] = await Promise.all([
    db
      .select()
      .from(position)
      .where(eq(position.stellungnahmeId, stellungnahmeId))
      .orderBy(asc(position.reihenfolge)),
    ladeVerwendbareEintraege(),
  ])

  return positionen.map((p) => ({
    positionId: p.id,
    ...findeVorschlaege(
      {
        bezeichnung: p.bezeichnung,
        begruendungVersicherer: p.begruendungVersicherer ?? '',
        typ: 'kalkulation',
      },
      bibliothek,
    ),
  }))
}

/** Der zweite Weg aus E6: Volltextsuche über die gesamte Bibliothek. */
export async function durchsucheBibliothek(begriff: string) {
  await verlangeBenutzer()
  return sucheInBibliothek(begriff)
}

/** Nächste freie Position in der Bausteinreihenfolge. */
async function naechsteReihenfolge(positionId: string): Promise<number> {
  const zeilen = await db
    .select({ hoechste: max(positionBaustein.reihenfolge) })
    .from(positionBaustein)
    .where(eq(positionBaustein.positionId, positionId))
  return (zeilen[0]?.hoechste ?? -1) + 1
}

/** Hängt einen Bibliothekseintrag als Baustein an eine Position. */
export async function fuegeBibliotheksbausteinEin(
  positionId: string,
  eintragId: string,
  herkunft: 'vorschlag' | 'bibliothekssuche',
): Promise<AktionsErgebnis> {
  await verlangeBenutzer()

  const zeilen = await db.select().from(eintrag).where(eq(eintrag.id, eintragId)).limit(1)
  const quelle = zeilen[0]
  if (!quelle) return { fehler: 'Eintrag nicht gefunden.' }

  const naechste = await naechsteReihenfolge(positionId)

  await db.insert(positionBaustein).values({
    positionId,
    typ: 'bibliothek',
    eintragId,
    textFinal: quelle.gegenargument,
    herkunft,
    reihenfolge: naechste,
  })

  await db
    .update(position)
    .set({ behandlung: 'bestritten' })
    .where(and(eq(position.id, positionId), eq(position.behandlung, 'offen')))

  revalidatePath('/stellungnahmen')
  return { hinweis: `Eintrag ${quelle.nummer} eingefügt.` }
}

/** Der dritte Weg aus E6: eigener Text. */
export async function fuegeEigenenTextEin(
  positionId: string,
  text: string,
): Promise<AktionsErgebnis> {
  await verlangeBenutzer()
  const inhalt = text.trim()
  if (!inhalt) return { fehler: 'Bitte einen Text eingeben.' }

  const naechste = await naechsteReihenfolge(positionId)

  await db.insert(positionBaustein).values({
    positionId,
    typ: 'eigener_text',
    textFinal: inhalt,
    herkunft: 'eigener_text',
    reihenfolge: naechste,
  })

  await db
    .update(position)
    .set({ behandlung: 'bestritten' })
    .where(and(eq(position.id, positionId), eq(position.behandlung, 'offen')))

  revalidatePath('/stellungnahmen')
  return { hinweis: 'Eigener Text eingefügt.' }
}

export async function entferneBaustein(bausteinId: string): Promise<AktionsErgebnis> {
  await verlangeBenutzer()
  await db.delete(positionBaustein).where(eq(positionBaustein.id, bausteinId))
  revalidatePath('/stellungnahmen')
  return { hinweis: 'Baustein entfernt.' }
}

/** Ordnet die Bausteine einer Position neu — das Ergebnis des Ziehens. */
export async function ordneBausteine(
  positionId: string,
  reihenfolge: string[],
): Promise<AktionsErgebnis> {
  await verlangeBenutzer()
  for (const [i, id] of reihenfolge.entries()) {
    await db
      .update(positionBaustein)
      .set({ reihenfolge: i })
      .where(and(eq(positionBaustein.id, id), eq(positionBaustein.positionId, positionId)))
  }
  revalidatePath('/stellungnahmen')
  return {}
}

export async function setzeBehandlung(
  positionId: string,
  behandlung: 'offen' | 'bestritten' | 'anerkannt' | 'nicht_bestreiten',
): Promise<AktionsErgebnis> {
  await verlangeBenutzer()
  await db.update(position).set({ behandlung }).where(eq(position.id, positionId))
  revalidatePath('/stellungnahmen')
  return {}
}

/** Merkt vor, dass ein eigener Text in die Bibliothek übernommen werden soll (F9). */
export async function merkeFuerBibliothek(
  bausteinId: string,
  uebernehmen: boolean,
): Promise<AktionsErgebnis> {
  await verlangeBenutzer()
  await db
    .update(positionBaustein)
    .set({ inBibliothekUebernehmen: uebernehmen })
    .where(eq(positionBaustein.id, bausteinId))
  revalidatePath('/stellungnahmen')
  return {}
}
