'use client'

import { useTransition } from 'react'
import { bestaetigeBeleg, verwerfeBeleg } from '@/bibliothek/aktionen'

interface Beleg {
  id: string
  gericht: string | null
  aktenzeichen: string | null
  verifiziertAm: Date | null
}

/**
 * Prüfmaske für Fundstellen.
 *
 * Die Suchlinks sind der Punkt: eine Fundstelle zu bestätigen soll Sekunden
 * dauern, nicht Minuten — sonst bleibt die Prüfung liegen und der Export
 * bleibt gesperrt.
 */
export function BelegPruefung({ eintragId, belege }: { eintragId: string; belege: Beleg[] }) {
  const [laeuft, starte] = useTransition()

  if (belege.length === 0) return null

  return (
    <div className="karte">
      <h2>Fundstellen ({belege.length})</h2>
      <p className="unterzeile" style={{ marginTop: 0 }}>
        Aus dem Text erkannt und noch nicht bestätigt. Unbestätigte Fundstellen sperren die
        Freigabe.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {belege.map((b) => {
          const bezeichnung = [b.gericht, b.aktenzeichen].filter(Boolean).join(' ')
          const suche = `https://www.google.com/search?q=${encodeURIComponent(bezeichnung)}`
          const dejure = `https://dejure.org/dienste/lexsuche?Suchbegriff=${encodeURIComponent(bezeichnung)}`

          return (
            <div
              key={b.id}
              style={{
                borderTop: '1px solid var(--line-soft)',
                paddingTop: 10,
                fontSize: 13.5,
              }}
            >
              <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                <strong>{b.gericht}</strong>
                {b.aktenzeichen ? (
                  <code style={{ fontSize: 12 }}>{b.aktenzeichen}</code>
                ) : (
                  <span className="marke-pille m-entwurf">ohne Aktenzeichen</span>
                )}
                {b.verifiziertAm ? <span className="marke-pille m-freigegeben">bestätigt</span> : null}
              </div>

              {!b.verifiziertAm ? (
                <>
                  <div style={{ margin: '7px 0', display: 'flex', gap: 12, fontSize: 12.5 }}>
                    <a href={dejure} target="_blank" rel="noreferrer noopener">
                      dejure
                    </a>
                    <a href={suche} target="_blank" rel="noreferrer noopener">
                      Websuche
                    </a>
                  </div>
                  <div style={{ display: 'flex', gap: 7 }}>
                    <button
                      type="button"
                      className="freigabe"
                      disabled={laeuft}
                      style={{ padding: '4px 10px', fontSize: 12.5 }}
                      onClick={() => starte(async () => void (await bestaetigeBeleg(b.id, eintragId)))}
                    >
                      Bestätigen
                    </button>
                    <button
                      type="button"
                      className="gefahr"
                      disabled={laeuft}
                      style={{ padding: '4px 10px', fontSize: 12.5 }}
                      onClick={() => starte(async () => void (await verwerfeBeleg(b.id, eintragId)))}
                    >
                      Entfernen
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
