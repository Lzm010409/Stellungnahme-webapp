import 'server-only'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { unzipSync, zipSync } from 'fflate'
import type { Absatz, Kopfdaten } from './hausstil'
import { deutschesDatum } from './hausstil'

/**
 * Erzeugt das Word-Dokument aus der Geschäftspapier-Vorlage des Büros.
 *
 * Die Vorlage wird gefüllt, nicht nachgebaut: Kopf- und Fußzeile, Logo,
 * Schriften und Ränder sind dort gestaltet und sollen es bleiben.
 *
 * Der Hausstil beschreibt zwei Fallstricke beim Ersetzen. Beide entfallen
 * durch das hier gewählte Vorgehen:
 *
 * 1. Word legt jedes Textfeld doppelt ab (`mc:Choice` für neuere Versionen,
 *    `mc:Fallback` für ältere). Datum und Adresszeilen kommen deshalb je
 *    zweimal vor — hier werden grundsätzlich ALLE Vorkommen ersetzt.
 * 2. Die Rücksendeangabe endet auf dieselbe Zeichenfolge wie die
 *    Empfänger-PLZ („47807 Krefeld"). Eine Suche im rohen XML träfe beide.
 *    Ersetzt wird deshalb der **vollständige Inhalt einzelner Textknoten**
 *    per Gleichheit — und `47807 Krefeld` ist als ganzer Knoteninhalt etwas
 *    anderes als `Kfz Sachverständigenbüro Gollenstede, …, 47807 Krefeld`.
 */

export const VORLAGE_PFAD = join(
  'skills',
  'stellungnahme-erstellen',
  'assets',
  'briefkopf-vorlage.docx',
)

/** Platzhalterwerte, wie sie in der Vorlage stehen. */
const VORLAGE = {
  datum: 'Krefeld, 23.04.2026',
  ruecksendeangabe: 'Kfz Sachverständigenbüro Gollenstede, Am Germannshof 15, 47807 Krefeld',
  name: 'Max Mustermann ',
  strasse: 'Musterstraße 123',
  plzOrt: '47807 Krefeld',
  land: 'Deutschland',
  betreff: '[BETREFFZEILE]',
  text: '[STELLUNGNAHME-TEXT: Anrede, Einleitungssatz, nummerierte Positionen, Ergebnis, Signatur]',
} as const

export class DocxFehler extends Error {
  constructor(nachricht: string) {
    super(nachricht)
    this.name = 'DocxFehler'
  }
}

/** Maskiert Text für die Verwendung in XML. */
export function maskiere(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Ersetzt den vollständigen Inhalt aller Textknoten mit genau diesem Wert.
 *
 * Gleichheit statt Teilzeichenkette — das ist der Kern der Sicherheit
 * gegenüber der mehrdeutigen Ortszeile.
 */
export function ersetzeTextknoten(xml: string, alt: string, neu: string): string {
  const muster = new RegExp(`(<w:t(?:\\s[^>]*)?>)${escapeRegExp(maskiere(alt))}(</w:t>)`, 'g')
  return xml.replace(muster, `$1${maskiere(neu).replace(/\$/g, '$$$$')}$2`)
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Baut einen Word-Absatz. */
function absatzXml(a: Absatz): string {
  if (a.art === 'leer') return '<w:p/>'

  const fett = a.art === 'ueberschrift' || a.art === 'betreff'
  const eigenschaften = fett ? '<w:rPr><w:b/></w:rPr>' : ''
  // xml:space bewahrt führende und folgende Leerzeichen.
  return `<w:p><w:r>${eigenschaften}<w:t xml:space="preserve">${maskiere(a.text)}</w:t></w:r></w:p>`
}

/**
 * Sucht den Beginn des Absatzes, der eine bestimmte Stelle enthält.
 *
 * Eine einfache Rückwärtssuche nach `<w:p` träfe auch `<w:pPr` — deshalb
 * wird ausdrücklich auf `<w:p>` oder `<w:p ` geprüft.
 */
function findeAbsatzBeginn(xml: string, stelle: number): number {
  let gefunden = -1
  const muster = /<w:p(?=[\s>/])/g
  let treffer: RegExpExecArray | null
  while ((treffer = muster.exec(xml)) !== null) {
    if (treffer.index >= stelle) break
    gefunden = treffer.index
  }
  return gefunden
}

/**
 * Ersetzt den Absatz, der den Textplatzhalter enthält, durch die
 * Absatzfolge der Stellungnahme.
 */
export function setzeFliesstext(xml: string, absaetze: Absatz[]): string {
  const stelle = xml.indexOf(maskiere(VORLAGE.text))
  if (stelle === -1) {
    throw new DocxFehler(
      'Der Textplatzhalter wurde in der Vorlage nicht gefunden. Wurde die Vorlage verändert?',
    )
  }

  const absatzStart = findeAbsatzBeginn(xml, stelle)
  const absatzEnde = xml.indexOf('</w:p>', stelle) + '</w:p>'.length
  if (absatzStart === -1 || absatzEnde <= absatzStart) {
    throw new DocxFehler('Der Absatz um den Textplatzhalter liess sich nicht bestimmen.')
  }

  // Der Betreff steht bereits als eigener Absatz in der Vorlage; er wird
  // dort ersetzt und darf hier nicht ein zweites Mal erscheinen.
  const ohneBetreff = absaetze.filter((a) => a.art !== 'betreff')
  const neuerInhalt = ohneBetreff.map(absatzXml).join('')

  return xml.slice(0, absatzStart) + neuerInhalt + xml.slice(absatzEnde)
}

export interface DocxEingabe {
  kopf: Kopfdaten
  absaetze: Absatz[]
  /** Abweichender Vorlagenpfad, vor allem für Tests. */
  vorlagePfad?: string
}

export async function baueDocx(eingabe: DocxEingabe): Promise<Uint8Array> {
  const pfad = eingabe.vorlagePfad ?? join(process.cwd(), VORLAGE_PFAD)

  let roh: Buffer
  try {
    roh = await readFile(pfad)
  } catch {
    throw new DocxFehler(
      `Die Geschäftspapier-Vorlage wurde nicht gefunden (${pfad}). ` +
        'Sie liegt im Repository unter skills/stellungnahme-erstellen/assets/.',
    )
  }

  const dateien = unzipSync(new Uint8Array(roh))
  const dokument = dateien['word/document.xml']
  if (!dokument) throw new DocxFehler('Die Vorlage enthält kein word/document.xml.')

  let xml = new TextDecoder().decode(dokument)

  const { kopf } = eingabe
  xml = ersetzeTextknoten(xml, VORLAGE.datum, `${kopf.ort}, ${deutschesDatum(kopf.datum)}`)
  xml = ersetzeTextknoten(xml, VORLAGE.name, kopf.empfaengerName)
  xml = ersetzeTextknoten(xml, VORLAGE.strasse, kopf.empfaengerStrasse ?? '')
  xml = ersetzeTextknoten(xml, VORLAGE.plzOrt, kopf.empfaengerPlzOrt ?? '')
  xml = ersetzeTextknoten(xml, VORLAGE.betreff, kopf.betreff)
  xml = setzeFliesstext(xml, eingabe.absaetze)

  dateien['word/document.xml'] = new TextEncoder().encode(xml)
  return zipSync(dateien, { level: 6 })
}
