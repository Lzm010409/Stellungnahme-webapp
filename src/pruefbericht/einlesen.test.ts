import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { inhaltsZeichen, istTextseite, leseBericht, werkzeugeVorhanden } from './einlesen'

/**
 * Die echten Prüfberichte enthalten Namen, Adressen und Schadennummern und
 * gehören deshalb nicht ins Repository. Wer sie zur Hand hat, legt sie in
 * einen Ordner und setzt `PRUEFBERICHT_FIXTURES` darauf — dann laufen die
 * Kalibrierungstests mit. Ohne den Ordner bleiben sie übersprungen, ohne
 * dass die Testkette rot wird.
 */
const FIXTURES = process.env.PRUEFBERICHT_FIXTURES
const hatFixture = (name: string) => Boolean(FIXTURES && existsSync(join(FIXTURES, name)))

describe('inhaltsZeichen', () => {
  it('zählt ohne Leerraum', () => {
    expect(inhaltsZeichen('  a b\n c ')).toBe(3)
    expect(inhaltsZeichen('   \n\t ')).toBe(0)
  })
})

describe('istTextseite', () => {
  it('hält eine Seite mit Fliesstext für textführend', () => {
    expect(istTextseite('Sehr geehrte Damen und Herren, '.repeat(8))).toBe(true)
  })

  it('erkennt eine gescannte Seite trotz eingebettetem Wasserzeichen', () => {
    // Genau dieser Fall tritt im HUK-Bündel auf: die gescannten Seiten des
    // DEKRA-Berichts tragen nur die Schadennummer als Textebene.
    expect(istTextseite('2611634578678C')).toBe(false)
    expect(istTextseite('')).toBe(false)
    expect(istTextseite('   \n  \n ')).toBe(false)
  })
})

describe('Werkzeuge', () => {
  it('findet pdfinfo, pdftotext und pdftoppm', async () => {
    const { ok, fehlend } = await werkzeugeVorhanden()
    expect(fehlend, 'poppler-utils fehlt — im Container über das Dockerfile installiert').toEqual([])
    expect(ok).toBe(true)
  })
})

describe.skipIf(!hatFixture('huk.pdf'))('Bündel aus Anschreiben und Scan (HUK)', () => {
  it('entscheidet je Seite, nicht je Dokument', async () => {
    const pdf = readFileSync(join(FIXTURES!, 'huk.pdf'))
    const bericht = await leseBericht(pdf)

    expect(bericht.seitenzahl).toBe(6)
    // Anschreiben digital, Prüfbericht gescannt.
    expect(bericht.seiten[0]!.art).toBe('text')
    expect(bericht.seiten[1]!.art).toBe('text')
    expect(bericht.seiten[2]!.art).toBe('bild')
    expect(bericht.zusammenfassung).toEqual({ text: 2, bild: 4 })
  })

  it('liefert für Bildseiten ein auswertbares JPEG', async () => {
    const pdf = readFileSync(join(FIXTURES!, 'huk.pdf'))
    const bericht = await leseBericht(pdf, { nurSeiten: [3] })
    const seite = bericht.seiten[0]!
    expect(seite.art).toBe('bild')
    expect(seite.bildBase64!.length).toBeGreaterThan(10_000)
    // JPEG beginnt mit ffd8ff — nach Base64 also "/9j/".
    expect(seite.bildBase64!.startsWith('/9j/')).toBe(true)
  })
})

describe.skipIf(!hatFixture('lvm.pdf'))('Durchgehend gescanntes Dokument (LVM)', () => {
  it('rastert alle Seiten', async () => {
    const pdf = readFileSync(join(FIXTURES!, 'lvm.pdf'))
    const bericht = await leseBericht(pdf)
    expect(bericht.seitenzahl).toBe(8)
    expect(bericht.zusammenfassung.text).toBe(0)
    expect(bericht.zusammenfassung.bild).toBe(8)
  })
})

describe('Fehlerfälle', () => {
  it('meldet eine Datei, die kein PDF ist, verständlich', async () => {
    await expect(leseBericht(Buffer.from('kein pdf'))).rejects.toThrow(/nicht als PDF/)
  })
})
