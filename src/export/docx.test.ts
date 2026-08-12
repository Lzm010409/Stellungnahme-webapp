import { describe, expect, it } from 'vitest'
import { unzipSync } from 'fflate'
import { baueDocx, ersetzeTextknoten, maskiere, setzeFliesstext } from './docx'
import { alsKlartext, baueAbsaetze, dateiname, deutschesDatum, type Kopfdaten } from './hausstil'

const KOPF: Kopfdaten = {
  ort: 'Krefeld',
  datum: new Date(2026, 7, 12),
  empfaengerName: 'Kanzlei Schmitt & Partner',
  empfaengerStrasse: 'Rechtsweg 4',
  empfaengerPlzOrt: '47798 Krefeld',
  betreff: 'Betreff: Stellungnahme Abrechnung Meyer',
  anrede: 'Sehr geehrte Damen und Herren,',
  einleitungDatum: '05.08.2026',
  einleitungMedium: 'schreiben',
  pruefdienstleister: 'DEKRA',
  vorbemerkungEinfuegen: false,
}

const ABSAETZE = baueAbsaetze({
  kopf: KOPF,
  vorbemerkung: null,
  positionen: [
    {
      nummer: 1,
      ueberschrift: 'Halterung Stoßfänger',
      text: 'Diese Kunststoffhalterungen fixieren die Verkleidung formschlüssig.\n\nSie sind zu erneuern.',
    },
    { nummer: 2, ueberschrift: 'Lackierlohn', text: 'Der Satz des Referenzbetriebs ist nicht maßgeblich.' },
  ],
  ergebnisart: 'vollstaendig',
  ergebnisAbsatz: null,
})

describe('maskiere', () => {
  it('macht Sonderzeichen XML-sicher', () => {
    expect(maskiere('Schmitt & Partner <GmbH>')).toBe('Schmitt &amp; Partner &lt;GmbH&gt;')
  })
})

describe('ersetzeTextknoten', () => {
  const xml =
    '<w:p><w:r><w:t>Kfz Sachverständigenbüro Gollenstede, Am Germannshof 15, 47807 Krefeld</w:t></w:r></w:p>' +
    '<w:p><w:r><w:t>47807 Krefeld</w:t></w:r></w:p>'

  it('trifft die Empfänger-PLZ und lässt die Rücksendeangabe stehen', () => {
    // Genau dieser Fall ist im Hausstil als Fallstrick beschrieben: eine
    // Suche im rohen XML würde beide Zeilen verändern.
    const neu = ersetzeTextknoten(xml, '47807 Krefeld', '40213 Düsseldorf')
    expect(neu).toContain('Am Germannshof 15, 47807 Krefeld')
    expect(neu).toContain('<w:t>40213 Düsseldorf</w:t>')
  })

  it('ersetzt alle Vorkommen — Word legt Textfelder doppelt ab', () => {
    const doppelt = '<w:t>Krefeld, 23.04.2026</w:t><w:t>Krefeld, 23.04.2026</w:t>'
    const neu = ersetzeTextknoten(doppelt, 'Krefeld, 23.04.2026', 'Krefeld, 12.08.2026')
    expect(neu).not.toContain('23.04.2026')
    expect(neu.match(/12\.08\.2026/g)).toHaveLength(2)
  })

  it('verkraftet Dollarzeichen im Ersatztext', () => {
    const neu = ersetzeTextknoten('<w:t>alt</w:t>', 'alt', 'Betrag $50')
    expect(neu).toBe('<w:t>Betrag $50</w:t>')
  })
})

describe('setzeFliesstext', () => {
  const vorlage =
    '<w:body><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>[BETREFFZEILE]</w:t></w:r></w:p>' +
    '<w:p><w:r><w:t>[STELLUNGNAHME-TEXT: Anrede, Einleitungssatz, nummerierte Positionen, Ergebnis, Signatur]</w:t></w:r></w:p></w:body>'

  it('ersetzt den Platzhalterabsatz durch die Absatzfolge', () => {
    const neu = setzeFliesstext(vorlage, ABSAETZE)
    expect(neu).not.toContain('STELLUNGNAHME-TEXT')
    expect(neu).toContain('Sehr geehrte Damen und Herren,')
    expect(neu).toContain('1. Halterung Stoßfänger')
    expect(neu).toContain('Mit freundlichen Grüßen')
  })

  it('setzt Positionsüberschriften fett', () => {
    const neu = setzeFliesstext(vorlage, ABSAETZE)
    expect(neu).toMatch(/<w:rPr><w:b\/><\/w:rPr><w:t[^>]*>1\. Halterung Stoßfänger/)
  })

  it('schreibt den Betreff nicht doppelt', () => {
    const neu = setzeFliesstext(vorlage, ABSAETZE)
    // Der Betreff steht bereits als eigener Absatz in der Vorlage.
    expect(neu.match(/Stellungnahme Abrechnung Meyer/g) ?? []).toHaveLength(0)
  })

  it('meldet eine veränderte Vorlage verständlich', () => {
    expect(() => setzeFliesstext('<w:body></w:body>', ABSAETZE)).toThrow(/nicht gefunden/)
  })
})

describe('baueDocx gegen die echte Vorlage', () => {
  it('erzeugt ein gültiges Word-Dokument mit allen Angaben', async () => {
    const daten = await baueDocx({ kopf: KOPF, absaetze: ABSAETZE })

    // ZIP-Signatur.
    expect(daten[0]).toBe(0x50)
    expect(daten[1]).toBe(0x4b)

    const dateien = unzipSync(daten)
    expect(Object.keys(dateien)).toContain('word/document.xml')
    // Kopf- und Fusszeile samt Logo bleiben erhalten.
    expect(Object.keys(dateien)).toContain('word/header1.xml')
    expect(Object.keys(dateien).some((d) => d.startsWith('word/media/'))).toBe(true)

    const xml = new TextDecoder().decode(dateien['word/document.xml']!)

    expect(xml).toContain('Krefeld, 12.08.2026')
    expect(xml).toContain('Kanzlei Schmitt &amp; Partner')
    expect(xml).toContain('Rechtsweg 4')
    expect(xml).toContain('47798 Krefeld')
    expect(xml).toContain('Betreff: Stellungnahme Abrechnung Meyer')
    expect(xml).toContain('1. Halterung Stoßfänger')
    expect(xml).toContain('Sachverständigenbüro Gollenstede')

    // Kein Platzhalter darf stehen bleiben.
    expect(xml).not.toContain('[BETREFFZEILE]')
    expect(xml).not.toContain('STELLUNGNAHME-TEXT')
    expect(xml).not.toContain('Max Mustermann')
    expect(xml).not.toContain('Musterstraße 123')
  })

  it('behält die Rücksendeangabe des Büros unverändert', async () => {
    const daten = await baueDocx({ kopf: KOPF, absaetze: ABSAETZE })
    const xml = new TextDecoder().decode(unzipSync(daten)['word/document.xml']!)
    expect(xml).toContain('Kfz Sachverständigenbüro Gollenstede, Am Germannshof 15, 47807 Krefeld')
  })

  it('meldet eine fehlende Vorlage verständlich', async () => {
    await expect(
      baueDocx({ kopf: KOPF, absaetze: ABSAETZE, vorlagePfad: '/gibt/es/nicht.docx' }),
    ).rejects.toThrow(/nicht gefunden/)
  })
})

describe('Hausstil', () => {
  it('formatiert das Datum deutsch', () => {
    expect(deutschesDatum(new Date(2026, 7, 5))).toBe('05.08.2026')
  })

  it('nennt den Prüfdienstleister in der Einleitung', () => {
    const text = alsKlartext(ABSAETZE)
    expect(text).toMatch(/Kürzungsbericht des Dienstleisters DEKRA/)
  })

  it('setzt die Positionen in der Reihenfolge des Prüfberichts', () => {
    const text = alsKlartext(ABSAETZE)
    expect(text.indexOf('1. Halterung')).toBeLessThan(text.indexOf('2. Lackierlohn'))
  })

  it('schliesst mit Ergebnis-Absatz und Signatur', () => {
    const text = alsKlartext(ABSAETZE)
    expect(text).toMatch(/vollumfänglich zu erstatten/)
    expect(text.trimEnd().endsWith('Sachverständigenbüro Gollenstede')).toBe(true)
  })

  it('folgt der Dateinamenkonvention', () => {
    expect(dateiname('Anna Marie Meyer', new Date(2026, 7, 12), 'docx')).toBe(
      'Stellungnahme_Anna-Marie-Meyer_2026-08-12.docx',
    )
    expect(dateiname(null, new Date(2026, 0, 3), 'txt')).toBe(
      'Stellungnahme_Unbekannt_2026-01-03.txt',
    )
  })
})

describe('Absatztrennung', () => {
  it('trennt mehrere Absätze einer Position durch eine Leerzeile', () => {
    const text = alsKlartext(ABSAETZE)
    // Position 1 besteht aus zwei Absätzen; sie dürfen nicht zusammenlaufen.
    expect(text).toMatch(/formschlüssig\.\n\nSie sind zu erneuern\./)
  })
})
