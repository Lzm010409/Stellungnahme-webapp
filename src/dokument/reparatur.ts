/**
 * Reparaturen am Dokumentbaum.
 *
 * Der Rahmen eines Schreibens gehört nicht dem Text, sondern dem Fall: zu
 * jeder Kürzungsposition des Prüfberichts gehört ein Abschnitt, auch ein
 * leerer. Wer eine Position nicht bestreiten will, lässt ihren Abschnitt
 * aus — er verschwindet aber nicht, sonst verlöre die Anmerkung am Rand
 * ihren Anker und die Herkunftsspur ihren Fall.
 *
 * Ältere Schreiben können Abschnitte verloren haben: vor dieser Fassung
 * konnte ein Ausschneiden über das ganze Dokument sie mitnehmen. Diese
 * Datei legt sie beim Öffnen wieder an — an der Stelle, an der sie nach
 * der Reihenfolge der Positionen hingehören.
 *
 * Reines JSON, keine Editor-Abhängigkeit: läuft auf dem Server wie im
 * Browser und lässt sich ohne Browser prüfen.
 */

import { KNOTEN, abschnitt, istText, text, type Elementknoten, type Knoten } from './typen'
import { ERGEBNIS_ABSAETZE } from '@/export/hausstil'

export interface Positionsangabe {
  id: string
  bezeichnung: string
  behandlung?: string | null
}

export interface Reparatur {
  dokument: Elementknoten
  /**
   * Was neu angelegt wurde: die Kennungen fehlender Abschnitte, und
   * `ergebnis`, falls der Schlusssatz gefehlt hat.
   */
  ergaenzt: string[]
}

/** Die Positionskennungen der Abschnitte in der Reihenfolge des Schreibens. */
function abschnittsKennungen(inhalt: Knoten[]): string[] {
  const gefunden: string[] = []
  for (const k of inhalt) {
    if (istText(k) || k.type !== KNOTEN.abschnitt) continue
    const id = k.attrs?.positionId
    if (typeof id === 'string' && id) gefunden.push(id)
  }
  return gefunden
}

/**
 * Ergänzt die Abschnitte, die zu den Positionen fehlen.
 *
 * Die Stelle ergibt sich aus der Reihenfolge der Positionen: hinter den
 * letzten Vorgänger, der noch dasteht, sonst vor den ersten Nachfolger,
 * sonst vor das Ergebnis. So bleibt die Nummerierung die des Prüfberichts
 * und nicht die des Zufalls.
 */
export function ergaenzeFehlendeAbschnitte(
  dokument: Elementknoten,
  positionen: Positionsangabe[],
): Reparatur {
  const inhalt = [...(dokument.content ?? [])]
  const vorhanden = new Set(abschnittsKennungen(inhalt))
  const fehlend = positionen.filter((p) => !vorhanden.has(p.id))

  /**
   * Der Ergebnisabsatz gehört zum Rahmen wie die Abschnitte.
   *
   * Das Schema lässt ihn als gewöhnlichen Block zu — ein Rundumschnitt
   * nimmt ihn also mit, und das Schreiben endet danach ohne den Schlusssatz
   * des Hausstils. Wieder angelegt wird er mit dem Satz, mit dem er
   * entstanden wäre.
   */
  const ohneErgebnis = !inhalt.some((k) => !istText(k) && k.type === KNOTEN.ergebnis)
  if (fehlend.length === 0 && !ohneErgebnis) return { dokument, ergaenzt: [] }

  if (ohneErgebnis) {
    const vorDerSignatur = inhalt.findIndex((k) => !istText(k) && k.type === KNOTEN.signatur)
    inhalt.splice(vorDerSignatur >= 0 ? vorDerSignatur : inhalt.length, 0, {
      type: KNOTEN.ergebnis,
      content: [text(ERGEBNIS_ABSAETZE.vollstaendig)],
    })
  }

  const reihenfolge = positionen.map((p) => p.id)

  for (const p of fehlend) {
    const neu = abschnitt(
      {
        positionId: p.id,
        bezeichnung: p.bezeichnung,
        ausgelassen: p.behandlung === 'nicht_bestreiten',
      },
      p.bezeichnung,
    )
    inhalt.splice(einfuegestelle(inhalt, reihenfolge, p.id), 0, neu)
  }

  return {
    dokument: { ...dokument, content: inhalt },
    ergaenzt: [...fehlend.map((p) => p.id), ...(ohneErgebnis ? ['ergebnis'] : [])],
  }
}

/** Der Index im Inhalt, an dem der Abschnitt zu dieser Position steht. */
function einfuegestelle(inhalt: Knoten[], reihenfolge: string[], id: string): number {
  const rang = reihenfolge.indexOf(id)
  const stelleVon = (kennung: string): number =>
    inhalt.findIndex(
      (k) => !istText(k) && k.type === KNOTEN.abschnitt && k.attrs?.positionId === kennung,
    )

  for (let i = rang - 1; i >= 0; i--) {
    const stelle = stelleVon(reihenfolge[i]!)
    if (stelle >= 0) return stelle + 1
  }
  for (let i = rang + 1; i < reihenfolge.length; i++) {
    const stelle = stelleVon(reihenfolge[i]!)
    if (stelle >= 0) return stelle
  }

  const schluss = inhalt.findIndex(
    (k) => !istText(k) && (k.type === KNOTEN.ergebnis || k.type === KNOTEN.signatur),
  )
  return schluss >= 0 ? schluss : inhalt.length
}
