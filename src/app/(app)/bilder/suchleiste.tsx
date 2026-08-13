'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Suche und Themenfilter der Bildbibliothek.
 *
 * Gesucht wird über Titel, Beschreibung, Dateiname und Themen — wer
 * „Beilackierung" eingibt, soll das Bild finden, gleich wo das Wort steht.
 */
export function Suchleiste({
  begriff,
  thema,
  themen,
}: {
  begriff: string
  thema: string
  themen: { thema: string; anzahl: number }[]
}) {
  const router = useRouter()
  const [laeuft, starte] = useTransition()
  const [suche, setzeSuche] = useState(begriff)

  const ziel = (q: string, t: string) => {
    const p = new URLSearchParams()
    if (q) p.set('q', q)
    if (t) p.set('thema', t)
    const rest = p.toString()
    return rest ? `/bilder?${rest}` : '/bilder'
  }

  // Serverseitige Suche; ohne Verzögerung löste jeder Tastendruck eine
  // Anfrage aus. 250 ms fühlen sich noch unmittelbar an.
  useEffect(() => {
    if (suche === begriff) return
    const zeit = setTimeout(() => starte(() => router.replace(ziel(suche, thema))), 250)
    return () => clearTimeout(zeit)
  }, [suche, begriff, thema, router])

  return (
    <div className="werkzeugleiste">
      <input
        type="search"
        placeholder="Titel, Beschreibung, Thema …"
        value={suche}
        onChange={(e) => setzeSuche(e.target.value)}
        aria-label="Bildbibliothek durchsuchen"
      />

      <select
        value={thema}
        aria-label="Thema"
        onChange={(e) => starte(() => router.replace(ziel(suche, e.target.value)))}
      >
        <option value="">Alle Themen</option>
        {themen.map((t) => (
          <option key={t.thema} value={t.thema}>
            {t.thema} ({t.anzahl})
          </option>
        ))}
      </select>

      {begriff || thema ? (
        <button
          type="button"
          onClick={() => {
            // Erst das Feld leeren, dann die Adresse: sonst stellt die
            // Verzögerung oben die eben weggeräumte Suche sofort wieder her
            // — der Knopf machte sich selbst rückgängig.
            setzeSuche('')
            starte(() => router.replace('/bilder'))
          }}
        >
          Filter zurücksetzen
        </button>
      ) : null}

      {laeuft ? <span className="treffer-zahl">sucht …</span> : null}
    </div>
  )
}
