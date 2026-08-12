'use client'

import { useState, useTransition } from 'react'
import { durchsucheBibliothek } from '@/stellungnahme/aktionen'
import { setzeWerteEin } from '@/dokument/platzhalter'
import type { Herkunftsmarke } from '@/dokument/typen'
import type { Befund } from '@/export/waechter'

/**
 * Eine Anmerkung am Rand des Briefes.
 *
 * Die Blase ist kein zweiter Editor: was hier bearbeitet wird, ist der
 * Vorschlag, bevor er im Brief landet. Sobald er drin ist, wird er dort
 * weiterbearbeitet — der Brief bleibt die Hauptfläche.
 */

export interface PositionAnzeige {
  id: string
  bezeichnung: string
  betragGutachten: string | null
  betragGekuerzt: string | null
  differenz: string | null
  begruendungVersicherer: string | null
  behandlung: string
  seite: number | null
}

export interface Kandidat {
  eintragId: string
  nummer: string
  titel: string
  abschnitt: string
  status: string
  haeufigkeitText: string | null
  guete: string
  treffergruende: string[]
  passendeVarianten: { id: string; bezeichnung: string; text: string }[]
  text: string | null
  vorgehen: string | null
}

export interface Vorschlag {
  positionId: string
  besteGuete: string
  kandidaten: Kandidat[]
}

const GUETE_TEXT: Record<string, string> = {
  direkt: 'Direkter Treffer',
  teilweise: 'Teiltreffer',
  kein: 'Kein Treffer',
}

function euro(wert: string | null): string {
  if (wert === null) return '—'
  const zahl = Number(wert)
  if (Number.isNaN(zahl)) return '—'
  return zahl.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
}

export function Blase({
  position,
  vorschlag,
  befunde,
  nummer,
  imBrief,
  hatText,
  aktiv,
  werte,
  kiAktiv,
  laeuft,
  aufAktivieren,
  aufEinfuegen,
  aufAusformulieren,
  aufHerausnehmen,
  aufAufnehmen,
  aufFundstelle,
  aufInBibliothek,
}: {
  position: PositionAnzeige
  vorschlag?: Vorschlag
  befunde: Befund[]
  nummer: number | null
  imBrief: boolean
  hatText: boolean
  aktiv: boolean
  werte: Record<string, string>
  kiAktiv: boolean
  laeuft: boolean
  aufAktivieren: () => void
  aufEinfuegen: (text: string, marke: Herkunftsmarke) => void
  aufAusformulieren: () => void
  aufHerausnehmen: () => void
  aufAufnehmen: () => void
  aufFundstelle: (befund: Befund) => void
  aufInBibliothek: () => void
}) {
  const [offenerKandidat, setzeOffenenKandidaten] = useState<string | null>(null)
  const [entwurf, setzeEntwurf] = useState('')
  const [eigenerText, setzeEigenenText] = useState('')
  const [begriff, setzeBegriff] = useState('')
  const [treffer, setzeTreffer] = useState<
    { id: string; nummer: string; titel: string; abschnitt: string; gegenargument: string | null }[]
  >([])
  const [sucht, starteSuche] = useTransition()

  const sperrend = befunde.filter((b) => b.schwere === 'sperrt').length
  const warnend = befunde.length - sperrend

  const oeffneKandidaten = (kennung: string, text: string) => {
    setzeOffenenKandidaten(kennung)
    setzeEntwurf(setzeWerteEin(text, werte).text)
  }

  const stand = entwurf ? setzeWerteEin(entwurf, werte) : null
  const offenePlatzhalter = stand?.offen ?? []

  const suche = (wert: string) => {
    setzeBegriff(wert)
    if (wert.trim().length < 3) {
      setzeTreffer([])
      return
    }
    starteSuche(async () => setzeTreffer(await durchsucheBibliothek(wert)))
  }

  if (!aktiv) {
    return (
      <button type="button" className={`blase zu ${imBrief ? '' : 'draussen'}`} onClick={aufAktivieren}>
        <span className="blase-nummer">{nummer ?? '—'}</span>
        <span className="blase-titel">{position.bezeichnung}</span>
        <span className="blase-marken">
          {sperrend > 0 ? <span className="marke-pille m-zurueckgezogen">{sperrend}</span> : null}
          {warnend > 0 ? <span className="marke-pille m-warn">{warnend}</span> : null}
          {!imBrief ? (
            <span className="marke-pille m-entwurf">nicht im Schreiben</span>
          ) : hatText ? (
            <span className="marke-pille m-freigegeben">Text</span>
          ) : vorschlag && vorschlag.besteGuete !== 'kein' ? (
            <span className={`marke-pille b-${vorschlag.besteGuete}`}>
              {vorschlag.kandidaten.length}
            </span>
          ) : (
            <span className="marke-pille m-entwurf">leer</span>
          )}
        </span>
      </button>
    )
  }

  return (
    <div className={`blase auf ${imBrief ? '' : 'draussen'}`}>
      <div className="blase-kopf">
        <span className="blase-nummer">{nummer ?? '—'}</span>
        <span className="blase-titel">{position.bezeichnung}</span>
        <span className="blase-betrag">
          {position.differenz ? `−${euro(position.differenz)}` : ''}
        </span>
      </div>

      {position.begruendungVersicherer ? (
        <div className="blase-zitat">„{position.begruendungVersicherer}"</div>
      ) : null}

      {befunde.length > 0 ? (
        <div className="blase-befunde">
          {befunde.map((b, i) => (
            <button
              key={i}
              type="button"
              className={`befund ${b.schwere}`}
              onClick={() => aufFundstelle(b)}
              title={b.fundstelle ? 'Stelle im Brief anspringen' : undefined}
            >
              <span className="marke-pille m-akzent">{b.kennung}</span>
              <span>
                <strong>{b.titel}</strong>
                <br />
                {b.text}
              </span>
            </button>
          ))}
        </div>
      ) : null}

      {!imBrief ? (
        <div className="blase-abschnitt">
          <p className="unterzeile" style={{ margin: '0 0 8px' }}>
            Diese Position erscheint nicht im Schreiben.
          </p>
          <button type="button" disabled={laeuft} onClick={aufAufnehmen}>
            Doch bestreiten
          </button>
        </div>
      ) : (
        <>
          <div className="blase-abschnitt">
            <div className="blase-label">
              Vorschläge
              {vorschlag && vorschlag.besteGuete !== 'kein' ? (
                <span className={`marke-pille b-${vorschlag.besteGuete}`}>
                  {GUETE_TEXT[vorschlag.besteGuete]}
                </span>
              ) : (
                <span className="marke-pille m-entwurf">nichts gefunden</span>
              )}
            </div>

            {!vorschlag || vorschlag.kandidaten.length === 0 ? (
              <p className="unterzeile" style={{ margin: 0 }}>
                Die Bibliothek hat zu dieser Begründung nichts. Nimm die Suche oder schreib
                selbst — direkt im Brief.
              </p>
            ) : (
              vorschlag.kandidaten.map((k) => (
                <div key={k.eintragId} className="blase-vorschlag">
                  <button
                    type="button"
                    className="blase-vorschlag-kopf"
                    onClick={() =>
                      offenerKandidat === k.eintragId
                        ? setzeOffenenKandidaten(null)
                        : oeffneKandidaten(k.eintragId, k.text ?? '')
                    }
                  >
                    <span className="zeile-nummer">{k.nummer}</span>
                    <span>
                      <div className="vorschlag-titel">{k.titel}</div>
                      <div className="vorschlag-meta">
                        <span className={`marke-pille b-${k.guete}`}>{GUETE_TEXT[k.guete]}</span>
                        {k.treffergruende.length > 0
                          ? ` trifft auf ${k.treffergruende.slice(0, 3).join(', ')}`
                          : ` ${k.abschnitt}`}
                      </div>
                    </span>
                  </button>

                  {offenerKandidat === k.eintragId ? (
                    <div className="blase-entwurf">
                      {k.status !== 'freigegeben' ? (
                        <p className="hinweis warn" style={{ margin: '0 0 8px' }}>
                          Dieser Eintrag ist noch nicht freigegeben.
                        </p>
                      ) : null}
                      {!k.text && k.vorgehen ? (
                        <p className="hinweis" style={{ margin: '0 0 8px' }}>
                          Kein fertiger Text. Vorgehen: {k.vorgehen}
                        </p>
                      ) : null}

                      <textarea
                        value={entwurf}
                        onChange={(e) => setzeEntwurf(e.target.value)}
                        style={{ minHeight: 150 }}
                        aria-label="Text vor dem Einfügen bearbeiten"
                      />

                      {offenePlatzhalter.length > 0 ? (
                        <p className="hinweis warn" style={{ margin: '8px 0 0' }}>
                          Noch offen: {offenePlatzhalter.map((o) => `[${o}]`).join(', ')} — der
                          Export bleibt gesperrt, solange sie stehen.
                        </p>
                      ) : null}

                      {k.passendeVarianten.length > 0 ? (
                        <div style={{ marginTop: 8 }}>
                          <div className="blase-label">Varianten</div>
                          {k.passendeVarianten.map((v) => (
                            <button
                              key={v.id}
                              type="button"
                              className="blase-variante"
                              onClick={() => setzeEntwurf(setzeWerteEin(v.text, werte).text)}
                            >
                              {v.bezeichnung}
                            </button>
                          ))}
                        </div>
                      ) : null}

                      <div className="blase-knoepfe">
                        <button
                          type="button"
                          className="haupt"
                          disabled={!entwurf.trim()}
                          onClick={() => {
                            aufEinfuegen(entwurf, {
                              eintragId: k.eintragId,
                              nummer: k.nummer,
                              titel: k.titel,
                              herkunft: 'vorschlag',
                            })
                            setzeOffenenKandidaten(null)
                          }}
                        >
                          In den Brief einfügen
                        </button>
                        <button type="button" onClick={() => setzeOffenenKandidaten(null)}>
                          Schliessen
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </div>

          <div className="blase-abschnitt">
            <div className="blase-label">Gesamte Bibliothek</div>
            <input
              type="search"
              value={begriff}
              placeholder="Bauteil, Stichwort, Textstelle …"
              aria-label="Bibliothek durchsuchen"
              onChange={(e) => suche(e.target.value)}
            />
            {sucht ? (
              <p className="unterzeile" style={{ margin: '6px 0 0' }}>
                sucht …
              </p>
            ) : null}
            {treffer.slice(0, 6).map((t) => (
              <div key={t.id} className="blase-vorschlag">
                <button
                  type="button"
                  className="blase-vorschlag-kopf"
                  disabled={!t.gegenargument}
                  onClick={() =>
                    offenerKandidat === t.id
                      ? setzeOffenenKandidaten(null)
                      : oeffneKandidaten(t.id, t.gegenargument ?? '')
                  }
                >
                  <span className="zeile-nummer">{t.nummer}</span>
                  <span>
                    <div className="vorschlag-titel">{t.titel}</div>
                    <div className="vorschlag-meta">{t.abschnitt}</div>
                  </span>
                </button>
                {offenerKandidat === t.id ? (
                  <div className="blase-entwurf">
                    <textarea
                      value={entwurf}
                      onChange={(e) => setzeEntwurf(e.target.value)}
                      style={{ minHeight: 150 }}
                      aria-label="Text vor dem Einfügen bearbeiten"
                    />
                    <div className="blase-knoepfe">
                      <button
                        type="button"
                        className="haupt"
                        disabled={!entwurf.trim()}
                        onClick={() => {
                          aufEinfuegen(entwurf, {
                            eintragId: t.id,
                            nummer: t.nummer,
                            titel: t.titel,
                            herkunft: 'bibliothekssuche',
                          })
                          setzeOffenenKandidaten(null)
                        }}
                      >
                        In den Brief einfügen
                      </button>
                      <button type="button" onClick={() => setzeOffenenKandidaten(null)}>
                        Schliessen
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          <div className="blase-abschnitt">
            <div className="blase-label">Eigener Text</div>
            <textarea
              value={eigenerText}
              onChange={(e) => setzeEigenenText(e.target.value)}
              placeholder="Eigene Argumentation — oder gleich im Brief schreiben."
              style={{ minHeight: 90 }}
            />
            <div className="blase-knoepfe">
              <button
                type="button"
                disabled={!eigenerText.trim()}
                onClick={() => {
                  aufEinfuegen(eigenerText, {
                    eintragId: null,
                    nummer: null,
                    titel: null,
                    herkunft: 'eigener_text',
                  })
                  setzeEigenenText('')
                }}
              >
                In den Brief einfügen
              </button>
            </div>
          </div>

          <div className="blase-fuss">
            <button
              type="button"
              disabled={laeuft || !kiAktiv || !hatText}
              title={
                !kiAktiv
                  ? 'Dafür fehlt der Zugang zum Sprachmodell.'
                  : !hatText
                    ? 'Erst Text in den Abschnitt bringen.'
                    : 'Den Abschnitt im Hausstil zusammenziehen'
              }
              onClick={aufAusformulieren}
            >
              Ausformulieren
            </button>
            <button type="button" disabled={laeuft} onClick={aufHerausnehmen}>
              Nicht bestreiten
            </button>
            {hatText ? (
              <button
                type="button"
                disabled={laeuft}
                title="Aus diesem selbst geschriebenen Abschnitt einen Bibliotheks-Entwurf machen"
                onClick={aufInBibliothek}
              >
                In die Bibliothek
              </button>
            ) : null}
          </div>
        </>
      )}
    </div>
  )
}
