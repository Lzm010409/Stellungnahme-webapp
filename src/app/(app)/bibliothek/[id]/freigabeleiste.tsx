'use client'

import { useState, useTransition } from 'react'
import { gebeFrei, setzeStatus, type AktionsErgebnis } from '@/bibliothek/aktionen'

interface Eigenschaften {
  id: string
  status: string
  darfFreigeben: boolean
  offeneBelege: number
}

export function Freigabeleiste({ id, status, darfFreigeben, offeneBelege }: Eigenschaften) {
  const [laeuft, starte] = useTransition()
  const [rueckmeldung, setzeRueckmeldung] = useState<AktionsErgebnis | null>(null)

  const fuehreAus = (arbeit: () => Promise<AktionsErgebnis>) => {
    starte(async () => setzeRueckmeldung(await arbeit()))
  }

  const gesperrt = offeneBelege > 0

  return (
    <div className="karte">
      <h2>Freigabe</h2>

      {status === 'freigegeben' ? (
        <p className="unterzeile" style={{ marginTop: 0 }}>
          Dieser Eintrag ist freigegeben und darf in Stellungnahmen verwendet werden.
        </p>
      ) : (
        <p className="unterzeile" style={{ marginTop: 0 }}>
          Nur freigegebene Einträge lassen sich in eine Stellungnahme übernehmen.
        </p>
      )}

      {gesperrt ? (
        <div className="hinweis warn" style={{ marginBottom: 12 }}>
          {offeneBelege} Fundstelle{offeneBelege === 1 ? '' : 'n'} noch nicht bestätigt. Die
          Freigabe bleibt bis dahin gesperrt.
        </div>
      ) : null}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {status !== 'freigegeben' ? (
          <button
            type="button"
            className="haupt"
            disabled={laeuft || !darfFreigeben || gesperrt}
            onClick={() => fuehreAus(() => gebeFrei(id))}
            title={
              !darfFreigeben
                ? 'Dafür fehlt die Rolle „Freigeber".'
                : gesperrt
                  ? 'Erst die Fundstellen bestätigen.'
                  : undefined
            }
          >
            Freigeben
          </button>
        ) : (
          <button
            type="button"
            disabled={laeuft}
            onClick={() => fuehreAus(() => setzeStatus(id, 'entwurf'))}
          >
            Freigabe zurücknehmen
          </button>
        )}

        {status === 'entwurf' ? (
          <button
            type="button"
            disabled={laeuft}
            onClick={() => fuehreAus(() => setzeStatus(id, 'pruefung'))}
          >
            Zur Prüfung
          </button>
        ) : null}

        {status !== 'zurueckgezogen' ? (
          <button
            type="button"
            disabled={laeuft}
            onClick={() => fuehreAus(() => setzeStatus(id, 'zurueckgezogen'))}
          >
            Zurückziehen
          </button>
        ) : null}
      </div>

      {!darfFreigeben && status !== 'freigegeben' ? (
        <p className="unterzeile" style={{ marginBottom: 0 }}>
          Freigeben darf nur, wer die Rolle „Freigeber" hat.
        </p>
      ) : null}

      {rueckmeldung?.fehler ? (
        <div className="hinweis fehler" style={{ marginTop: 12 }} role="alert">
          {rueckmeldung.fehler}
        </div>
      ) : null}
      {rueckmeldung?.erfolg ? (
        <div className="hinweis" style={{ marginTop: 12 }} role="status">
          {rueckmeldung.erfolg}
        </div>
      ) : null}
    </div>
  )
}
