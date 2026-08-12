'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Erscheinungsschalter } from './erscheinung'

/**
 * Die Kopfleiste über dem Inhalt.
 *
 * Sie trägt den Schalter für das Menü, den Namen des Bereichs und den
 * Umschalter für das Erscheinungsbild. Auf schmalen Schirmen ist das Menü
 * standardmässig eingeklappt und wird von hier aus geöffnet.
 */

const BEREICHE: { pfad: string; name: string }[] = [
  { pfad: '/stellungnahmen', name: 'Stellungnahmen' },
  { pfad: '/faelle', name: 'Fälle' },
  { pfad: '/bibliothek', name: 'Argumentbibliothek' },
]

const SPEICHERSCHLUESSEL = 'werkbank-menue'

export function Kopfleiste() {
  const pfad = usePathname()
  const [offen, setzeOffen] = useState(true)

  // Der gespeicherte Stand wird erst nach dem ersten Zeichnen angewandt —
  // der Server weiss nichts vom Browser, und ein Sprung ist besser als eine
  // Meldung über nicht übereinstimmende Ausgaben.
  useEffect(() => {
    const gespeichert = localStorage.getItem(SPEICHERSCHLUESSEL)
    if (gespeichert === 'zu') {
      setzeOffen(false)
      document.body.classList.add('menue-zu')
    }
  }, [])

  const wechsle = () => {
    const neu = !offen
    setzeOffen(neu)
    localStorage.setItem(SPEICHERSCHLUESSEL, neu ? 'auf' : 'zu')
    document.body.classList.toggle('menue-zu', !neu)
    // Auf schmalen Schirmen liegt das Menü über dem Inhalt, dort zählt die
    // umgekehrte Auszeichnung.
    document.body.classList.toggle('menue-auf', neu)
  }

  const bereich = BEREICHE.find((b) => pfad.startsWith(b.pfad))?.name ?? 'Werkbank'

  return (
    <header className="topbar">
      <button
        type="button"
        className="menue-schalter"
        onClick={wechsle}
        aria-label={offen ? 'Menü einklappen' : 'Menü ausklappen'}
        aria-expanded={offen}
      >
        <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
          <path
            d="M3 5h14M3 10h14M3 15h14"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            fill="none"
          />
        </svg>
      </button>

      <span className="topbar-titel">{bereich}</span>

      <Erscheinungsschalter />
    </header>
  )
}
