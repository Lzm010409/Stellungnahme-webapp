'use client'

import { useState, useTransition } from 'react'
import {
  durchsucheBibliothek,
  entferneBaustein,
  fuegeBibliotheksbausteinEin,
  fuegeEigenenTextEin,
  merkeFuerBibliothek,
  setzeBehandlung,
} from '@/stellungnahme/aktionen'

/**
 * Die Auswahlmaske aus Konzept E6.
 *
 * Je Position stehen drei gleichrangige Wege dauerhaft offen — die
 * vorgeschlagenen Treffer, die Volltextsuche über die gesamte Bibliothek und
 * eigener Text. Die Vorschläge sind eine Abkürzung für den Normalfall, nie
 * eine Einschränkung. Mehrfachauswahl ist ausdrücklich vorgesehen: eine
 * Position kann aus mehreren Bausteinen bestehen.
 */

interface Baustein {
  id: string
  typ: string
  textFinal: string | null
  herkunft: string
  inBibliothekUebernehmen: boolean
}

interface PositionAnzeige {
  id: string
  bezeichnung: string
  betragGutachten: string | null
  betragGekuerzt: string | null
  differenz: string | null
  begruendungVersicherer: string | null
  behandlung: string
  seite: number | null
  bausteine: Baustein[]
}

interface Kandidat {
  eintragId: string
  nummer: string
  titel: string
  abschnitt: string
  status: string
  haeufigkeitText: string | null
  guete: string
  treffergruende: string[]
  passendeVarianten: { id: string; bezeichnung: string }[]
  hatText: boolean
  vorgehen: string | null
}

interface Vorschlag {
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

export function Auswahlmaske({
  positionen,
  vorschlaege,
}: {
  positionen: PositionAnzeige[]
  vorschlaege: Vorschlag[]
}) {
  return (
    <div>
      {positionen.map((p, i) => (
        <PositionKarte
          key={p.id}
          nummer={i + 1}
          position={p}
          vorschlag={vorschlaege.find((v) => v.positionId === p.id)}
        />
      ))}
    </div>
  )
}

function PositionKarte({
  nummer,
  position,
  vorschlag,
}: {
  nummer: number
  position: PositionAnzeige
  vorschlag?: Vorschlag
}) {
  const [laeuft, starte] = useTransition()
  const [meldung, setzeMeldung] = useState<string | null>(null)

  const fuehreAus = (arbeit: () => Promise<{ fehler?: string; hinweis?: string }>) =>
    starte(async () => {
      const e = await arbeit()
      setzeMeldung(e.fehler ?? e.hinweis ?? null)
    })

  const ausgelassen = position.behandlung === 'nicht_bestreiten'
  const erledigt = position.bausteine.length > 0

  return (
    <article
      className={`position ${erledigt ? 'erledigt' : ''} ${ausgelassen ? 'ausgelassen' : ''}`}
    >
      <header className="position-kopf">
        <span className="position-titel">
          {nummer}. {position.bezeichnung}
          {position.seite ? (
            <span className="treffer-zahl" style={{ marginLeft: 8 }}>
              S. {position.seite}
            </span>
          ) : null}
        </span>
        <span style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
          {position.betragGutachten && position.betragGekuerzt ? (
            <span className="treffer-zahl">
              {euro(position.betragGutachten)} → {euro(position.betragGekuerzt)}
            </span>
          ) : null}
          <span className="position-betrag">
            {position.differenz ? `−${euro(position.differenz)}` : 'ohne Betrag'}
          </span>
        </span>
      </header>

      {position.begruendungVersicherer ? (
        <div className="position-begruendung">„{position.begruendungVersicherer}"</div>
      ) : null}

      <div className="wege">
        {position.bausteine.length > 0 ? (
          <div className="weg">
            <div className="weg-kopf">
              Gewählt ({position.bausteine.length})
            </div>
            {position.bausteine.map((b) => (
              <BausteinKarte
                key={b.id}
                baustein={b}
                laeuft={laeuft}
                aufEntfernen={() => fuehreAus(() => entferneBaustein(b.id))}
                aufMerken={(wert) => fuehreAus(() => merkeFuerBibliothek(b.id, wert))}
              />
            ))}
          </div>
        ) : null}

        <div className="weg">
          <div className="weg-kopf">
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
              Die Bibliothek hat zu dieser Begründung nichts. Nimm die Suche oder schreib selbst.
            </p>
          ) : (
            vorschlag.kandidaten.map((k) => (
              <div key={k.eintragId} className="vorschlag">
                <span className="zeile-nummer">{k.nummer}</span>
                <span>
                  <div className="vorschlag-titel">{k.titel}</div>
                  <div className="vorschlag-meta">
                    {k.abschnitt}
                    {k.haeufigkeitText ? ` · ${k.haeufigkeitText}` : ''}
                    {k.treffergruende.length > 0
                      ? ` · trifft auf ${k.treffergruende.slice(0, 3).join(', ')}`
                      : ''}
                  </div>
                  {k.passendeVarianten.length > 0 ? (
                    <div className="vorschlag-meta" style={{ color: 'var(--accent)' }}>
                      passende Variante: {k.passendeVarianten.map((v) => v.bezeichnung).join(', ')}
                    </div>
                  ) : null}
                  {!k.hatText && k.vorgehen ? (
                    <div className="vorschlag-meta" style={{ color: 'var(--warn)' }}>
                      Kein fertiger Text — Vorgehen: {k.vorgehen.slice(0, 120)}…
                    </div>
                  ) : null}
                </span>
                <span style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                  <span className={`marke-pille b-${k.guete}`}>{GUETE_TEXT[k.guete]}</span>
                  {k.status !== 'freigegeben' ? (
                    <span className="marke-pille m-entwurf" title="Sperrt später den Export">
                      Entwurf
                    </span>
                  ) : null}
                  <button
                    type="button"
                    disabled={laeuft || !k.hatText}
                    style={{ padding: '3px 9px', fontSize: 12.5 }}
                    title={k.hatText ? undefined : 'Dieser Eintrag trägt keinen einsetzbaren Text.'}
                    onClick={() =>
                      fuehreAus(() =>
                        fuegeBibliotheksbausteinEin(position.id, k.eintragId, 'vorschlag'),
                      )
                    }
                  >
                    Übernehmen
                  </button>
                </span>
              </div>
            ))
          )}
        </div>

        <Bibliothekssuche positionId={position.id} laeuft={laeuft} aufEinfuegen={fuehreAus} />

        <EigenerText positionId={position.id} laeuft={laeuft} aufEinfuegen={fuehreAus} />

        <div className="weg">
          <div className="weg-kopf">Behandlung</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              disabled={laeuft}
              style={{ padding: '4px 10px', fontSize: 13 }}
              onClick={() =>
                fuehreAus(() =>
                  setzeBehandlung(position.id, ausgelassen ? 'offen' : 'nicht_bestreiten'),
                )
              }
            >
              {ausgelassen ? 'Doch bestreiten' : 'Nicht bestreiten'}
            </button>
            {ausgelassen ? (
              <span className="unterzeile" style={{ margin: 0, alignSelf: 'center' }}>
                Diese Position erscheint nicht im Schreiben.
              </span>
            ) : null}
          </div>
        </div>

        {meldung ? (
          <div className="hinweis" style={{ marginTop: 10 }} role="status">
            {meldung}
          </div>
        ) : null}
      </div>
    </article>
  )
}

function BausteinKarte({
  baustein,
  laeuft,
  aufEntfernen,
  aufMerken,
}: {
  baustein: Baustein
  laeuft: boolean
  aufEntfernen: () => void
  aufMerken: (wert: boolean) => void
}) {
  const [offen, setzeOffen] = useState(false)

  return (
    <div className="baustein">
      <div className="baustein-kopf">
        <span className="marke-pille m-akzent">
          {baustein.typ === 'bibliothek' ? 'aus der Bibliothek' : 'eigener Text'}
          {baustein.herkunft === 'bibliothekssuche' ? ' · gesucht' : ''}
        </span>
        <span style={{ display: 'flex', gap: 6 }}>
          <button
            type="button"
            style={{ padding: '2px 8px', fontSize: 12 }}
            onClick={() => setzeOffen((o) => !o)}
          >
            {offen ? 'Einklappen' : 'Ganz zeigen'}
          </button>
          <button
            type="button"
            disabled={laeuft}
            style={{ padding: '2px 8px', fontSize: 12 }}
            onClick={aufEntfernen}
          >
            Entfernen
          </button>
        </span>
      </div>

      <div className={`baustein-text ${offen ? 'offen' : ''}`}>
        {baustein.textFinal ?? '(kein Text)'}
      </div>

      {baustein.typ === 'eigener_text' ? (
        <label
          style={{
            display: 'flex',
            gap: 7,
            alignItems: 'center',
            marginTop: 8,
            fontSize: 12.5,
            fontWeight: 500,
          }}
        >
          <input
            type="checkbox"
            checked={baustein.inBibliothekUebernehmen}
            disabled={laeuft}
            onChange={(e) => aufMerken(e.target.checked)}
            style={{ width: 'auto' }}
          />
          Beim Export als Bibliothekseintrag vorschlagen
        </label>
      ) : null}
    </div>
  )
}

function Bibliothekssuche({
  positionId,
  laeuft,
  aufEinfuegen,
}: {
  positionId: string
  laeuft: boolean
  aufEinfuegen: (arbeit: () => Promise<{ fehler?: string; hinweis?: string }>) => void
}) {
  const [begriff, setzeBegriff] = useState('')
  const [treffer, setzeTreffer] = useState<
    { id: string; nummer: string; titel: string; abschnitt: string; gegenargument: string | null }[]
  >([])
  const [sucht, starteSuche] = useTransition()

  const suche = (wert: string) => {
    setzeBegriff(wert)
    if (wert.trim().length < 3) {
      setzeTreffer([])
      return
    }
    starteSuche(async () => setzeTreffer(await durchsucheBibliothek(wert)))
  }

  return (
    <div className="weg">
      <div className="weg-kopf">
        Gesamte Bibliothek durchsuchen
        <span className="marke-pille m-entwurf">quer zu Bereich und Abschnitt</span>
      </div>
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
      {treffer.length > 0 ? (
        <div style={{ marginTop: 8 }}>
          {treffer.slice(0, 8).map((t) => (
            <div key={t.id} className="vorschlag">
              <span className="zeile-nummer">{t.nummer}</span>
              <span>
                <div className="vorschlag-titel">{t.titel}</div>
                <div className="vorschlag-meta">{t.abschnitt}</div>
              </span>
              <button
                type="button"
                disabled={laeuft || !t.gegenargument}
                style={{ padding: '3px 9px', fontSize: 12.5 }}
                onClick={() =>
                  aufEinfuegen(() =>
                    fuegeBibliotheksbausteinEin(positionId, t.id, 'bibliothekssuche'),
                  )
                }
              >
                Übernehmen
              </button>
            </div>
          ))}
          {treffer.length > 8 ? (
            <p className="unterzeile" style={{ margin: '4px 0 0' }}>
              {treffer.length - 8} weitere — Suche verfeinern.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function EigenerText({
  positionId,
  laeuft,
  aufEinfuegen,
}: {
  positionId: string
  laeuft: boolean
  aufEinfuegen: (arbeit: () => Promise<{ fehler?: string; hinweis?: string }>) => void
}) {
  const [text, setzeText] = useState('')
  const [offen, setzeOffen] = useState(false)

  if (!offen) {
    return (
      <div className="weg">
        <div className="weg-kopf">Eigener Text</div>
        <button
          type="button"
          style={{ padding: '4px 11px', fontSize: 13 }}
          onClick={() => setzeOffen(true)}
        >
          Selbst formulieren
        </button>
      </div>
    )
  }

  return (
    <div className="weg">
      <div className="weg-kopf">Eigener Text</div>
      <textarea
        value={text}
        onChange={(e) => setzeText(e.target.value)}
        placeholder="Eigene Argumentation zu dieser Position …"
        style={{ minHeight: 110 }}
      />
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button
          type="button"
          className="haupt"
          disabled={laeuft || !text.trim()}
          style={{ padding: '4px 11px', fontSize: 13 }}
          onClick={() =>
            aufEinfuegen(async () => {
              const e = await fuegeEigenenTextEin(positionId, text)
              if (!e.fehler) {
                setzeText('')
                setzeOffen(false)
              }
              return e
            })
          }
        >
          Übernehmen
        </button>
        <button
          type="button"
          style={{ padding: '4px 11px', fontSize: 13 }}
          onClick={() => setzeOffen(false)}
        >
          Abbrechen
        </button>
      </div>
    </div>
  )
}
