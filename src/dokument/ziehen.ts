/**
 * Was beim Ziehen eines Bausteins mitwandert.
 *
 * Eigener Datentyp statt `text/plain`: nur so kommt die Herkunft mit. Der
 * reine Text wird zusätzlich mitgegeben, damit ein Baustein auch ausserhalb
 * der Anwendung irgendwo landen kann — dort ohne Herkunft, aber immerhin.
 */

import type { Herkunftsmarke } from './typen'

export const MIME_BAUSTEIN = 'application/x-werkbank-baustein'

export interface Ziehgut {
  text: string
  marke: Herkunftsmarke
}

export function leseZiehgut(daten: string): Ziehgut | null {
  try {
    const roh = JSON.parse(daten) as Partial<Ziehgut>
    if (typeof roh.text !== 'string' || !roh.text.trim()) return null
    const m = roh.marke
    return {
      text: roh.text,
      marke: {
        eintragId: typeof m?.eintragId === 'string' ? m.eintragId : null,
        nummer: typeof m?.nummer === 'string' ? m.nummer : null,
        titel: typeof m?.titel === 'string' ? m.titel : null,
        herkunft:
          m?.herkunft === 'bibliothekssuche' || m?.herkunft === 'formuliert' || m?.herkunft === 'eigener_text'
            ? m.herkunft
            : 'vorschlag',
      },
    }
  } catch {
    return null
  }
}
