/**
 * Dokumentbaum → Absatzfolge.
 *
 * Die Absatzfolge ist das gemeinsame Zwischenformat beider Ausgaben. Sie
 * bleibt unverändert — Word- und Klartextausgabe merken vom Umbau auf den
 * Brief-Editor nichts, weil sich nur ändert, woher die Absätze kommen.
 */

import { SIGNATUR, type Absatz } from '@/export/hausstil'
import {
  KNOTEN,
  abschnittsInhalt,
  istAusgelassen,
  istText,
  kinder,
  knotenText,
  ueberschriftText,
  type Elementknoten,
  type Knoten,
} from './typen'

/** Ein Abschnitt, wie er im ausgegebenen Schreiben erscheint. */
export interface AusgabeAbschnitt {
  positionId: string | null
  nummer: number
  ueberschrift: string
  text: string
}

export interface Ausgabestruktur {
  betreff: string
  anrede: string
  /** Alles zwischen Anrede und erstem Abschnitt: Einleitung, Vorbemerkung. */
  einleitung: string[]
  abschnitte: AusgabeAbschnitt[]
  ergebnis: string
}

function listenAbsaetze(knoten: Elementknoten): string[] {
  const nummeriert = knoten.type === 'orderedList'
  return kinder(knoten).map((eintrag, i) => {
    const zeichen = nummeriert ? `${i + 1}. ` : '– '
    return zeichen + knotenText(eintrag).replace(/\s*\n+\s*/g, ' ').trim()
  })
}

/** Zieht die Textabsätze eines Blocks heraus, Listen eingeschlossen. */
function textAbsaetze(knoten: Knoten[]): string[] {
  const absaetze: string[] = []
  for (const k of knoten) {
    if (istText(k)) {
      const t = k.text.trim()
      if (t) absaetze.push(t)
      continue
    }
    if (k.type === 'bulletList' || k.type === 'orderedList') {
      absaetze.push(...listenAbsaetze(k))
      continue
    }
    const t = knotenText(k).trim()
    if (t) absaetze.push(t)
  }
  return absaetze
}

/**
 * Liest den Dokumentbaum in seine Bestandteile.
 *
 * Die Nummerierung entsteht hier und nur hier: sie ergibt sich aus der
 * Reihenfolge der Abschnitte, die tatsächlich Text tragen. Ein Abschnitt
 * ohne Text bekommt keine Nummer und erscheint nicht — sonst stünde im
 * versandten Schreiben eine leere Überschrift.
 */
export function leseStruktur(dokument: Elementknoten): Ausgabestruktur {
  const struktur: Ausgabestruktur = {
    betreff: '',
    anrede: '',
    einleitung: [],
    abschnitte: [],
    ergebnis: '',
  }

  let vorDemErstenAbschnitt = true

  for (const block of kinder(dokument)) {
    if (istText(block)) continue

    switch (block.type) {
      case KNOTEN.betreff:
        struktur.betreff = knotenText(block).trim()
        break

      case KNOTEN.anrede:
        struktur.anrede = knotenText(block).trim()
        break

      case KNOTEN.abschnitt: {
        vorDemErstenAbschnitt = false
        // Nicht bestrittene Positionen bleiben im Dokument stehen, gehören
        // aber nicht in das Schreiben — und zählen deshalb auch nicht mit.
        if (istAusgelassen(block)) break
        const text = textAbsaetze(abschnittsInhalt(block)).join('\n\n')
        if (!text) break
        const attrs = block.attrs ?? {}
        struktur.abschnitte.push({
          positionId: typeof attrs.positionId === 'string' ? attrs.positionId : null,
          nummer: struktur.abschnitte.length + 1,
          ueberschrift: ueberschriftText(block).trim(),
          text,
        })
        break
      }

      case KNOTEN.ergebnis:
        struktur.ergebnis = knotenText(block).trim()
        break

      case KNOTEN.signatur:
        break

      default:
        if (vorDemErstenAbschnitt) struktur.einleitung.push(...textAbsaetze([block]))
        break
    }
  }

  return struktur
}

/** Setzt die Absatzfolge aus dem Dokumentbaum zusammen. */
export function dokumentNachAbsaetzen(dokument: Elementknoten): Absatz[] {
  const s = leseStruktur(dokument)
  const absaetze: Absatz[] = []
  const fuegeEin = (art: Absatz['art'], text: string) => absaetze.push({ art, text })

  fuegeEin('betreff', s.betreff)
  fuegeEin('leer', '')
  fuegeEin('anrede', s.anrede)
  fuegeEin('leer', '')

  for (const e of s.einleitung) {
    fuegeEin('fliesstext', e)
    fuegeEin('leer', '')
  }

  for (const a of s.abschnitte) {
    fuegeEin('ueberschrift', `${a.nummer}. ${a.ueberschrift}`)
    fuegeEin('leer', '')
    for (const [i, teil] of a.text.split(/\n{2,}/).entries()) {
      if (i > 0) fuegeEin('leer', '')
      fuegeEin('fliesstext', teil.trim())
    }
    fuegeEin('leer', '')
  }

  if (s.ergebnis) {
    fuegeEin('fliesstext', s.ergebnis)
    fuegeEin('leer', '')
  }

  for (const zeile of SIGNATUR) {
    fuegeEin(zeile ? 'signatur' : 'leer', zeile)
  }

  return absaetze
}
