'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { loescheStellungnahme } from '@/stellungnahme/export-aktionen'
import { Kreisel } from '@/app/teile/anzeigen'

/**
 * Wirft eine Stellungnahme weg.
 *
 * Mit Rückfrage, und die Rückfrage nennt den Betreff: „Löschen?" allein
 * beantwortet niemand richtig, wenn zehn Zeilen untereinander stehen. Was
 * die Aktion ablehnt — ein versendetes Schreiben —, steht danach als
 * Meldung da und nicht als stilles Nichts.
 */
export function Loeschknopf({
  stellungnahmeId,
  betreff,
  danach,
  beschriftung,
}: {
  stellungnahmeId: string
  betreff: string
  /** Wohin danach: zurück zur Liste oder einfach neu laden. */
  danach?: string
  beschriftung?: string
}) {
  const router = useRouter()
  const [laeuft, starte] = useTransition()
  const [fehler, setzeFehler] = useState<string | null>(null)

  return (
    <>
      <button
        type="button"
        className="loeschknopf gefahr"
        disabled={laeuft}
        title={`„${betreff}" löschen`}
        aria-label={`„${betreff}" löschen`}
        onClick={() => {
          if (!confirm(`„${betreff}" endgültig löschen? Der Brief und alle Positionen gehen mit.`)) {
            return
          }
          starte(async () => {
            const e = await loescheStellungnahme(stellungnahmeId)
            if (e.fehler) {
              setzeFehler(e.fehler)
              return
            }
            if (danach) router.push(danach)
            router.refresh()
          })
        }}
      >
        {laeuft ? <Kreisel text="Löschen" /> : (beschriftung ?? '🗑')}
      </button>
      {fehler ? (
        <span className="hinweis fehler" role="status">
          {fehler}
        </span>
      ) : null}
    </>
  )
}
