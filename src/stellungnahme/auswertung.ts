import 'server-only'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { fall, position, stellungnahme } from '@/db/schema'
import { leseBericht } from '@/pruefbericht/einlesen'
import { extrahierePositionen } from '@/pruefbericht/extraktion'
import { pruefeSonderfaelle } from '@/pruefbericht/sonderfaelle'
import { differenz, type Extraktion } from '@/pruefbericht/schema'
import { gutachtenSchema } from '@/autoixpert/typen'
import { leseFalldaten, schlageEmpfaengerVor } from '@/autoixpert/felder'
import { kiVerfuegbar } from '@/ki/client'

/**
 * Die Auswertung eines Prüfberichts, Schritt für Schritt.
 *
 * Der Vorgang dauert je nach Bericht zwischen wenigen Sekunden und über
 * einer Minute — gescannte Seiten müssen gerastert und vom Modell gelesen
 * werden. Deshalb ist er als Ereignisstrom gebaut und nicht als ein Aufruf,
 * der irgendwann zurückkommt: die Oberfläche zeigt, woran gerade gearbeitet
 * wird, statt einen Balken zu bewegen, der nichts weiss.
 */

export interface Fortschrittsmeldung {
  art: 'fortschritt'
  schritt: 'einlesen' | 'auslesen' | 'pruefliste' | 'speichern'
  text: string
  /** 0 bis 1. */
  anteil: number
}

export interface Abschlussmeldung {
  art: 'fertig'
  stellungnahmeId: string
  hinweis?: string
}

export interface Fehlermeldung {
  art: 'fehler'
  fehler: string
}

export type Auswertungsereignis = Fortschrittsmeldung | Abschlussmeldung | Fehlermeldung

/** Höchstgrösse für den Upload — gescannte Berichte werden schnell gross. */
export const MAX_BYTES = 25 * 1024 * 1024

/**
 * Die Anteile sind gemessen, nicht geraten: das Einlesen macht bei einem
 * gescannten Bericht den Löwenanteil aus, das Auslesen durch das Modell den
 * Rest. Prüfliste und Speichern sind Millisekunden — sie bekommen trotzdem
 * einen sichtbaren Schritt, damit am Ende nicht 90 % stehen bleiben.
 */
const ABSCHNITT = { einlesen: [0.04, 0.55], auslesen: [0.55, 0.9], pruefliste: 0.94, speichern: 0.98 }

/**
 * Eine Schleuse zwischen Rückruf und Ausgabe.
 *
 * Wer meldet, schiebt hinein und läuft weiter; wer ausgibt, wartet auf das
 * Nächste. Ohne sie müsste der Generator den ganzen Vorgang abwarten, bevor
 * er die erste Seitenmeldung ausgeben könnte — und der Balken stünde
 * minutenlang bei vier Prozent.
 */
class Schleuse<T> {
  private puffer: T[] = []
  private wecker: (() => void) | null = null
  private geschlossen = false

  schiebe(wert: T): void {
    this.puffer.push(wert)
    this.wecke()
  }

  schliesse(): void {
    this.geschlossen = true
    this.wecke()
  }

  private wecke(): void {
    const w = this.wecker
    this.wecker = null
    w?.()
  }

  async *[Symbol.asyncIterator](): AsyncGenerator<T> {
    for (;;) {
      while (this.puffer.length > 0) yield this.puffer.shift()!
      if (this.geschlossen) return
      await new Promise<void>((loese) => {
        this.wecker = loese
      })
    }
  }
}

export async function* werteBerichtAus(auftrag: {
  pdf: Buffer
  dateiname: string
  fallId: string | null
  benutzerId: string
}): AsyncGenerator<Auswertungsereignis> {
  if (auftrag.pdf.byteLength > MAX_BYTES) {
    yield { art: 'fehler', fehler: `Die Datei ist grösser als ${MAX_BYTES / 1024 / 1024} MB.` }
    return
  }
  if (!kiVerfuegbar()) {
    yield {
      art: 'fehler',
      fehler:
        'Die Auswertung braucht einen Zugang zum Sprachmodell. Bitte ANTHROPIC_API_KEY ' +
        'in den Umgebungsvariablen hinterlegen.',
    }
    return
  }

  yield {
    art: 'fortschritt',
    schritt: 'einlesen',
    text: 'Prüfbericht wird geöffnet …',
    anteil: ABSCHNITT.einlesen[0]!,
  }

  // Die Seitenmeldungen kommen aus einem Rückruf, ausgegeben werden muss
  // aber hier. Die Schleuse verbindet beides, ohne das Einlesen abzuwarten —
  // sonst erschienen alle Seitenmeldungen erst, wenn sie nichts mehr nützen.
  const schleuse = new Schleuse<Fortschrittsmeldung>()

  let einlesefehler: unknown = null
  const lauf = leseBericht(auftrag.pdf, {
    melde: ({ seite, von, art }) => {
      const [von0, bis0] = ABSCHNITT.einlesen as [number, number]
      schleuse.schiebe({
        art: 'fortschritt',
        schritt: 'einlesen',
        text: `Seite ${seite} von ${von} gelesen (${art === 'bild' ? 'gescannt' : 'Text'})`,
        anteil: von0 + ((bis0 - von0) * seite) / von,
      })
    },
  })
    .catch((f: unknown) => {
      einlesefehler = f
      return null
    })
    .finally(() => schleuse.schliesse())

  for await (const meldung of schleuse) yield meldung

  const bericht = await lauf
  if (!bericht) {
    yield {
      art: 'fehler',
      fehler:
        einlesefehler instanceof Error
          ? einlesefehler.message
          : 'Der Prüfbericht liess sich nicht einlesen.',
    }
    return
  }

  const gescannt = bericht.zusammenfassung.bild
  yield {
    art: 'fortschritt',
    schritt: 'auslesen',
    text:
      `Kürzungspositionen werden ausgelesen — ${bericht.seitenzahl} Seiten` +
      (gescannt > 0 ? `, davon ${gescannt} gescannt` : '') +
      ' …',
    anteil: ABSCHNITT.auslesen[0]!,
  }

  let extraktion: Extraktion
  try {
    extraktion = (await extrahierePositionen(bericht)).extraktion
  } catch (fehler) {
    console.error('Auswertung des Prüfberichts fehlgeschlagen:', fehler)
    yield {
      art: 'fehler',
      fehler:
        fehler instanceof Error ? fehler.message : 'Der Prüfbericht konnte nicht ausgewertet werden.',
    }
    return
  }

  yield {
    art: 'fortschritt',
    schritt: 'pruefliste',
    text: `${extraktion.positionen.length} Positionen gefunden — Prüfliste B.1 bis B.8 läuft …`,
    anteil: ABSCHNITT.pruefliste,
  }

  // Fahrzeug aus dem Fall holen, damit sich der Grundlagenfehler B.7 prüfen lässt.
  let fahrzeugAusFall: string | null = null
  let empfaenger: ReturnType<typeof schlageEmpfaengerVor> | null = null
  if (auftrag.fallId) {
    const zeilen = await db.select().from(fall).where(eq(fall.id, auftrag.fallId)).limit(1)
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

  yield {
    art: 'fortschritt',
    schritt: 'speichern',
    text: 'Stellungnahme wird angelegt …',
    anteil: ABSCHNITT.speichern,
  }

  // Nur Positionen aus Abschnitten, die zur Stellungnahme gehören.
  const unfallfremdeTypen = new Set(
    extraktion.abschnitte.filter((a) => !a.fuerStellungnahmeRelevant).map((a) => a.typ),
  )
  const relevante = extraktion.positionen.filter((p) => !unfallfremdeTypen.has(p.typ))

  const [angelegt] = await db
    .insert(stellungnahme)
    .values({
      fallId: auftrag.fallId,
      modus: 'standard',
      extraktion,
      sonderfaelle: befunde,
      pruefberichtDateiname: auftrag.dateiname,
      pruefberichtSeiten: bericht.seitenzahl,
      empfaengerName: empfaenger?.empfaenger?.name ?? null,
      empfaengerStrasse: empfaenger?.empfaenger?.strasse ?? null,
      empfaengerPlzOrt: empfaenger?.empfaenger?.plzOrt ?? null,
      betreff: empfaenger?.betreff ?? null,
      anrede: empfaenger?.anrede ?? 'Sehr geehrte Damen und Herren,',
      erstelltVon: auftrag.benutzerId,
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

  const uebersprungen = extraktion.positionen.length - relevante.length
  yield {
    art: 'fertig',
    stellungnahmeId,
    hinweis:
      uebersprungen > 0
        ? `${relevante.length} Positionen übernommen, ${uebersprungen} aus unfallfremden Abschnitten ausgelassen.`
        : undefined,
  }
}
