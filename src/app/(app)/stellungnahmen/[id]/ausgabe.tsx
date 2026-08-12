'use client'

import { useState, useTransition } from 'react'
import {
  erzeugeAusgabe,
  formuliereAus,
  markiereVersendet,
  pruefeStellungnahme,
  uebernehmeInBibliothek,
  type Ausgabe,
} from '@/stellungnahme/export-aktionen'
import type { Pruefergebnis } from '@/export/waechter'

/**
 * Ausformulieren, prüfen und ausgeben.
 *
 * Die vier Wächter laufen vor jeder Ausgabe. Sperrende Befunde verhindern
 * sie; Warnungen erscheinen, halten aber nicht auf — der Sachverständige
 * entscheidet, nicht die Anwendung.
 */
export function Ausgabebereich({
  stellungnahmeId,
  hatBausteine,
  kiAktiv,
  vorgemerkt,
  versendet,
}: {
  stellungnahmeId: string
  hatBausteine: boolean
  kiAktiv: boolean
  vorgemerkt: number
  versendet: boolean
}) {
  const [laeuft, starte] = useTransition()
  const [pruefung, setzePruefung] = useState<Pruefergebnis | null>(null)
  const [ausgabe, setzeAusgabe] = useState<Ausgabe | null>(null)
  const [meldung, setzeMeldung] = useState<string | null>(null)

  const lade = (name: string, inhalt: BlobPart, typ: string) => {
    const url = URL.createObjectURL(new Blob([inhalt], { type: typ }))
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.click()
    URL.revokeObjectURL(url)
  }

  const ladeDocx = () => {
    if (!ausgabe?.docxBase64 || !ausgabe.docxName) return
    const roh = atob(ausgabe.docxBase64)
    const bytes = new Uint8Array(roh.length)
    for (let i = 0; i < roh.length; i++) bytes[i] = roh.charCodeAt(i)
    lade(
      ausgabe.docxName,
      bytes,
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    )
  }

  return (
    <section className="karte" style={{ marginTop: 24 }}>
      <h2>Ausformulieren und ausgeben</h2>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        <button
          type="button"
          disabled={laeuft || !hatBausteine || !kiAktiv}
          title={
            !hatBausteine
              ? 'Erst Bausteine an den Positionen wählen.'
              : !kiAktiv
                ? 'Dafür fehlt der Zugang zum Sprachmodell.'
                : undefined
          }
          onClick={() =>
            starte(async () => {
              const e = await formuliereAus(stellungnahmeId)
              setzeMeldung(e.fehler ?? e.hinweis ?? null)
              setzeAusgabe(null)
            })
          }
        >
          {laeuft ? 'Läuft …' : 'Positionen ausformulieren'}
        </button>

        <button
          type="button"
          disabled={laeuft || !hatBausteine}
          onClick={() =>
            starte(async () => {
              setzePruefung(await pruefeStellungnahme(stellungnahmeId))
              setzeMeldung(null)
            })
          }
        >
          Prüfen
        </button>

        <button
          type="button"
          className="haupt"
          disabled={laeuft || !hatBausteine}
          onClick={() =>
            starte(async () => {
              const e = await erzeugeAusgabe(stellungnahmeId)
              setzeAusgabe(e)
              setzeMeldung(e.fehler ?? null)
              if (!e.fehler) setzePruefung(await pruefeStellungnahme(stellungnahmeId))
            })
          }
        >
          Dokument erzeugen
        </button>

        {vorgemerkt > 0 ? (
          <button
            type="button"
            disabled={laeuft}
            onClick={() =>
              starte(async () => {
                const e = await uebernehmeInBibliothek(stellungnahmeId)
                setzeMeldung(e.fehler ?? e.hinweis ?? null)
              })
            }
          >
            {vorgemerkt} in die Bibliothek übernehmen
          </button>
        ) : null}

        {!versendet ? (
          <button
            type="button"
            disabled={laeuft}
            onClick={() =>
              starte(async () => {
                const e = await markiereVersendet(stellungnahmeId)
                setzeMeldung(e.hinweis ?? null)
              })
            }
          >
            Als versendet vermerken
          </button>
        ) : null}
      </div>

      {meldung ? (
        <div
          className={`hinweis ${meldung.match(/sperr|gescheitert|nicht/i) ? 'fehler' : ''}`}
          role="status"
        >
          {meldung}
        </div>
      ) : null}

      {pruefung ? (
        <div style={{ marginTop: 14 }}>
          <div className="weg-kopf">
            Prüfung
            {pruefung.befunde.length === 0 ? (
              <span className="marke-pille m-freigegeben">nichts zu beanstanden</span>
            ) : (
              <>
                {pruefung.zusammenfassung.sperrt > 0 ? (
                  <span className="marke-pille m-zurueckgezogen">
                    {pruefung.zusammenfassung.sperrt} sperrend
                  </span>
                ) : null}
                {pruefung.zusammenfassung.warnt > 0 ? (
                  <span className="marke-pille m-warn">
                    {pruefung.zusammenfassung.warnt} zu prüfen
                  </span>
                ) : null}
              </>
            )}
          </div>

          {pruefung.befunde.map((b, i) => (
            <div
              key={i}
              className={`sonderfall ${b.schwere === 'sperrt' ? 'wichtig' : ''}`}
              style={{ marginBottom: 8 }}
            >
              <div className="sonderfall-titel">
                <span className="marke-pille m-akzent">{b.kennung}</span>
                {b.titel}
                <span className="treffer-zahl" style={{ marginLeft: 'auto' }}>
                  {b.stelle}
                </span>
              </div>
              <div className="sonderfall-text">{b.text}</div>
            </div>
          ))}
        </div>
      ) : null}

      {ausgabe?.klartext ? (
        <div style={{ marginTop: 16 }}>
          <div className="weg-kopf">
            Fertiges Dokument
            <button
              type="button"
              className="haupt"
              style={{ padding: '3px 10px', fontSize: 12.5 }}
              onClick={ladeDocx}
            >
              {ausgabe.docxName}
            </button>
            <button
              type="button"
              style={{ padding: '3px 10px', fontSize: 12.5 }}
              onClick={() => lade(ausgabe.txtName!, ausgabe.klartext!, 'text/plain;charset=utf-8')}
            >
              {ausgabe.txtName}
            </button>
          </div>
          <pre
            style={{
              fontFamily: 'var(--serif)',
              fontSize: 14,
              lineHeight: 1.65,
              whiteSpace: 'pre-wrap',
              background: 'var(--ground)',
              border: '1px solid var(--line)',
              borderRadius: 'var(--radius)',
              padding: '16px 18px',
              maxHeight: 460,
              overflowY: 'auto',
            }}
          >
            {ausgabe.klartext}
          </pre>
        </div>
      ) : null}
    </section>
  )
}
