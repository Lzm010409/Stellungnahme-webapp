/**
 * Platzhalter in eckigen Klammern.
 *
 * Beim Einfügen eines Bausteins werden die Werte gesetzt, die der Fall
 * hergibt. Was ohne Wert bleibt, bleibt **stehen** — ein offener Platzhalter
 * sperrt später den Export (R1), ein stillschweigend gelöschter fällt
 * niemandem auf. Das ist der ganze Punkt der Übung.
 */

export interface Platzhalterstand {
  text: string
  /** Platzhalter, die kein Wert füllen konnte. */
  offen: string[]
  gesetzt: number
}

export function setzeWerteEin(
  text: string,
  werte: Record<string, string>,
): Platzhalterstand {
  const offen = new Set<string>()
  let gesetzt = 0

  const gefuellt = text.replace(/\[([^\][]+)\]/g, (ganz, inhalt: string) => {
    const schluessel = inhalt.trim()
    const wert = werte[schluessel] ?? findeUnabhaengigVonGrossschreibung(werte, schluessel)
    if (wert) {
      gesetzt++
      return wert
    }
    offen.add(schluessel)
    return ganz
  })

  return { text: gefuellt, offen: [...offen], gesetzt }
}

function findeUnabhaengigVonGrossschreibung(
  werte: Record<string, string>,
  schluessel: string,
): string | undefined {
  const klein = schluessel.toLowerCase()
  for (const [k, v] of Object.entries(werte)) {
    if (k.toLowerCase() === klein) return v
  }
  return undefined
}
