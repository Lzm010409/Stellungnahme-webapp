import { describe, expect, it } from 'vitest'
import { ergaenzeFehlendeAbschnitte, wandlePlatzhalterInKnoten } from './reparatur'
import { KNOTEN, abschnitt, absatz, knotenText, text, type Elementknoten } from './typen'

const POSITIONEN = [
  { id: 'p1', bezeichnung: 'Stundenverrechnungssätze' },
  { id: 'p2', bezeichnung: 'Lackierlohn' },
  { id: 'p3', bezeichnung: 'Ersatzteilaufschlag' },
]

function brief(abschnitte: Elementknoten[]): Elementknoten {
  return {
    type: KNOTEN.dokument,
    content: [
      { type: KNOTEN.betreff, content: [text('Betreff')] },
      { type: KNOTEN.anrede, content: [text('Sehr geehrte Damen und Herren,')] },
      absatz('Einleitung'),
      ...abschnitte,
      { type: KNOTEN.ergebnis, content: [text('Ergebnis')] },
      { type: KNOTEN.signatur },
    ],
  }
}

function kennungen(dokument: Elementknoten): string[] {
  return (dokument.content ?? [])
    .filter((k) => 'type' in k && k.type === KNOTEN.abschnitt)
    .map((k) => String((k as Elementknoten).attrs?.positionId))
}

describe('ergaenzeFehlendeAbschnitte', () => {
  it('lässt ein vollständiges Schreiben unberührt', () => {
    const vorher = brief(POSITIONEN.map((p) => abschnitt({ positionId: p.id, bezeichnung: p.bezeichnung }, p.bezeichnung)))
    const nachher = ergaenzeFehlendeAbschnitte(vorher, POSITIONEN)

    expect(nachher.ergaenzt).toEqual([])
    expect(nachher.dokument).toBe(vorher)
  })

  it('legt einen verlorenen Abschnitt an seiner Stelle wieder an', () => {
    const vorher = brief([
      abschnitt({ positionId: 'p1', bezeichnung: 'Stundenverrechnungssätze' }, 'Stundenverrechnungssätze'),
      abschnitt({ positionId: 'p3', bezeichnung: 'Ersatzteilaufschlag' }, 'Ersatzteilaufschlag'),
    ])

    const nachher = ergaenzeFehlendeAbschnitte(vorher, POSITIONEN)

    expect(nachher.ergaenzt).toEqual(['p2'])
    expect(kennungen(nachher.dokument)).toEqual(['p1', 'p2', 'p3'])
  })

  it('stellt nach einem Rundumschnitt alle Abschnitte in der Reihenfolge des Berichts her', () => {
    const nachher = ergaenzeFehlendeAbschnitte(brief([]), POSITIONEN)

    expect(nachher.ergaenzt).toEqual(['p1', 'p2', 'p3'])
    expect(kennungen(nachher.dokument)).toEqual(['p1', 'p2', 'p3'])

    // Vor dem Ergebnis, nicht dahinter: die Signatur bleibt das Ende.
    const arten = (nachher.dokument.content ?? []).map((k) => ('type' in k ? k.type : 'text'))
    expect(arten.at(-1)).toBe(KNOTEN.signatur)
    expect(arten.at(-2)).toBe(KNOTEN.ergebnis)
    expect(arten.at(-3)).toBe(KNOTEN.abschnitt)
  })

  it('legt einen nicht bestrittenen Abschnitt ausgelassen an', () => {
    const nachher = ergaenzeFehlendeAbschnitte(brief([]), [
      { id: 'p1', bezeichnung: 'Lackierlohn', behandlung: 'nicht_bestreiten' },
    ])

    const neu = (nachher.dokument.content ?? []).find(
      (k) => 'type' in k && k.type === KNOTEN.abschnitt,
    ) as Elementknoten

    expect(neu.attrs?.ausgelassen).toBe(true)
    expect(neu.attrs?.bezeichnung).toBe('Lackierlohn')
  })

  it('trägt die Bezeichnung als Überschrift ein und einen leeren Absatz darunter', () => {
    const nachher = ergaenzeFehlendeAbschnitte(brief([]), [{ id: 'p1', bezeichnung: 'Lackierlohn' }])

    const neu = (nachher.dokument.content ?? []).find(
      (k) => 'type' in k && k.type === KNOTEN.abschnitt,
    ) as Elementknoten

    expect(neu.content?.[0]).toMatchObject({ type: KNOTEN.ueberschrift })
    expect(neu.content?.[1]).toMatchObject({ type: KNOTEN.absatz })
  })
})

describe('Der Ergebnisabsatz', () => {
  it('kommt zurück, wenn er dem Schreiben abhandengekommen ist', () => {
    const ohne: Elementknoten = {
      type: KNOTEN.dokument,
      content: [
        { type: KNOTEN.betreff, content: [text('Betreff')] },
        { type: KNOTEN.anrede, content: [text('Sehr geehrte Damen und Herren,')] },
        abschnitt({ positionId: 'p1', bezeichnung: 'Lackierlohn' }, 'Lackierlohn'),
        { type: KNOTEN.signatur },
      ],
    }

    const nachher = ergaenzeFehlendeAbschnitte(ohne, [{ id: 'p1', bezeichnung: 'Lackierlohn' }])

    expect(nachher.ergaenzt).toEqual(['ergebnis'])
    const arten = (nachher.dokument.content ?? []).map((k) => ('type' in k ? k.type : 'text'))
    expect(arten.at(-1)).toBe(KNOTEN.signatur)
    expect(arten.at(-2)).toBe(KNOTEN.ergebnis)
  })

  it('bleibt unangetastet, wenn er dasteht', () => {
    const mit = brief([abschnitt({ positionId: 'p1', bezeichnung: 'Lackierlohn' }, 'Lackierlohn')])
    expect(ergaenzeFehlendeAbschnitte(mit, [{ id: 'p1', bezeichnung: 'Lackierlohn' }]).ergaenzt).toEqual([])
  })
})

describe('wandlePlatzhalterInKnoten', () => {
  const absatz = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] })

  it('macht aus einem Klammerausdruck einen Knoten', () => {
    const { dokument, gewandelt } = wandlePlatzhalterInKnoten({
      type: 'doc',
      content: [absatz('Am Fahrzeug [Kennzeichen] ist es so.')],
    })
    expect(gewandelt).toBe(1)
    const inhalt = (dokument.content![0] as Elementknoten).content!
    expect(inhalt.map((k) => k.type)).toEqual(['text', 'platzhalter', 'text'])
    expect((inhalt[1] as Elementknoten).attrs).toEqual({ schluessel: 'Kennzeichen', art: 'wert' })
  })

  it('erkennt eine Regieanweisung als solche', () => {
    const { dokument } = wandlePlatzhalterInKnoten({
      type: 'doc',
      content: [absatz('[Mit Screenshots aus dem Kalkulationsprogramm belegen.]')],
    })
    const knoten = (dokument.content![0] as Elementknoten).content![0] as Elementknoten
    expect(knoten.attrs?.art).toBe('regieanweisung')
  })

  /*
    Betreff und Anrede führen im Schema `content: 'text*'`. Ein Knoten darin
    wäre ungültig — der Editor würde ihn beim Laden stillschweigend
    wegwerfen und mit ihm den Text drumherum.
  */
  it('lässt Betreff und Anrede unangetastet', () => {
    const { dokument, gewandelt } = wandlePlatzhalterInKnoten({
      type: 'doc',
      content: [
        { type: 'betreff', content: [{ type: 'text', text: 'Schaden [Kennzeichen]' }] },
        { type: 'anrede', content: [{ type: 'text', text: 'Sehr geehrte [Anrede],' }] },
      ],
    })
    expect(gewandelt).toBe(0)
    expect(JSON.stringify(dokument)).toContain('Schaden [Kennzeichen]')
  })

  it('rührt einen Text ohne Klammern nicht an', () => {
    const vorher = { type: 'doc', content: [absatz('Nur Text.')] }
    const { gewandelt } = wandlePlatzhalterInKnoten(vorher)
    expect(gewandelt).toBe(0)
  })

  it('lässt Markdown-Verweise stehen', () => {
    const { gewandelt } = wandlePlatzhalterInKnoten({
      type: 'doc',
      content: [absatz('siehe [BGH VI ZR 1/20](https://example.invalid)')],
    })
    expect(gewandelt).toBe(0)
  })

  /*
    Der eigentliche Zweck der Übung: nach aussen darf sich nichts ändern.
    Wächter R1 sperrt den Export über die eckigen Klammern — fände er sie
    nicht mehr, ginge eine offene Angabe in die Word-Datei.
  */
  it('ändert nichts am ausgegebenen Text', () => {
    const vorher: Elementknoten = {
      type: 'doc',
      content: [absatz('Am Fahrzeug [Kennzeichen] ist die Lackierung von [Bauteil] nötig.')],
    }
    const { dokument } = wandlePlatzhalterInKnoten(vorher)
    expect(knotenText(dokument.content![0]!)).toBe(
      'Am Fahrzeug [Kennzeichen] ist die Lackierung von [Bauteil] nötig.',
    )
  })
})
