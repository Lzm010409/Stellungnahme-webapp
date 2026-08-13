import { describe, expect, it } from 'vitest'
import { ergaenzeFehlendeAbschnitte } from './reparatur'
import { KNOTEN, abschnitt, absatz, text, type Elementknoten } from './typen'

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
