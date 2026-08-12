'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  ausBibliothekNehmen,
  beschrifteBild,
  loescheBild,
  uebernehmeInBildbibliothek,
} from '@/bilder/aktionen'
import type { Bibliotheksbild } from '@/bilder/bibliothek'
import { Kreisel } from '@/app/teile/anzeigen'

/**
 * Eine Karte je Bild: sehen, beschriften, übernehmen, löschen.
 *
 * Die Beschriftung steht aufgeklappt unter dem Bild und nicht in einem
 * eigenen Fenster — sie ist der eigentliche Wert der Bibliothek, nicht
 * eine Nebensache, die man noch irgendwo pflegt.
 */
export function Bildkarte({ bild }: { bild: Bibliotheksbild }) {
  const router = useRouter()
  const [offen, setzeOffen] = useState(false)
  const [laeuft, starte] = useTransition()
  const [meldung, setzeMeldung] = useState<string | null>(null)
  const [werte, setzeWerte] = useState({
    titel: bild.titel ?? '',
    beschreibung: bild.beschreibung ?? '',
    themen: bild.themen.join(', '),
  })

  const fuehreAus = (arbeit: () => Promise<{ fehler?: string; hinweis?: string }>) =>
    starte(async () => {
      const e = await arbeit()
      setzeMeldung(e.fehler ?? e.hinweis ?? null)
      router.refresh()
    })

  return (
    <article className={`bildkarte ${bild.inBibliothek ? '' : 'offen-uebernahme'}`}>
      <button
        type="button"
        className="bildkarte-bild"
        onClick={() => setzeOffen((o) => !o)}
        aria-expanded={offen}
        title={offen ? 'Beschriftung schliessen' : 'Beschriften'}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/api/bilder/${bild.id}`} alt={bild.titel ?? bild.dateiname} loading="lazy" />
      </button>

      <div className="bildkarte-kopf">
        <span className="bildkarte-titel">{bild.titel || bild.dateiname}</span>
        <span className="treffer-zahl">
          {bild.breitePx}×{bild.hoehePx} · {Math.round(bild.bytes / 1024)} KB
        </span>
      </div>

      {bild.beschreibung && !offen ? (
        <p className="bildkarte-text">{bild.beschreibung}</p>
      ) : null}

      {bild.themen.length > 0 && !offen ? (
        <div className="bildkarte-themen">
          {bild.themen.map((t) => (
            <span key={t} className="marke-pille m-akzent">
              {t}
            </span>
          ))}
        </div>
      ) : null}

      {!bild.inBibliothek ? (
        <div className="bildkarte-fuss">
          <span className="unterzeile" style={{ margin: 0 }}>
            aus {bild.herkunft ?? 'einer Stellungnahme'}
          </span>
          <button
            type="button"
            className="haupt"
            disabled={laeuft}
            onClick={() => fuehreAus(() => uebernehmeInBildbibliothek(bild.id))}
          >
            {laeuft ? <Kreisel text="Übernehmen" /> : 'In die Bibliothek'}
          </button>
        </div>
      ) : null}

      {offen ? (
        <div className="bildkarte-formular">
          <div className="feld">
            <label htmlFor={`titel-${bild.id}`}>Titel</label>
            <input
              id={`titel-${bild.id}`}
              value={werte.titel}
              placeholder={bild.dateiname}
              onChange={(e) => setzeWerte((w) => ({ ...w, titel: e.target.value }))}
            />
          </div>
          <div className="feld">
            <label htmlFor={`besch-${bild.id}`}>Beschreibung</label>
            <textarea
              id={`besch-${bild.id}`}
              value={werte.beschreibung}
              placeholder="Was zeigt das Bild, und wofür taugt es als Beleg?"
              style={{ minHeight: 80 }}
              onChange={(e) => setzeWerte((w) => ({ ...w, beschreibung: e.target.value }))}
            />
          </div>
          <div className="feld">
            <label htmlFor={`themen-${bild.id}`}>Themen, durch Komma getrennt</label>
            <input
              id={`themen-${bild.id}`}
              value={werte.themen}
              placeholder="Beilackierung, DAT-Auszug, Verbringung"
              onChange={(e) => setzeWerte((w) => ({ ...w, themen: e.target.value }))}
            />
          </div>

          <div className="bildkarte-knoepfe">
            <button
              type="button"
              className="haupt"
              disabled={laeuft}
              onClick={() => fuehreAus(() => beschrifteBild(bild.id, werte))}
            >
              {laeuft ? <Kreisel text="Speichern" /> : 'Speichern'}
            </button>
            {bild.inBibliothek ? (
              <button
                type="button"
                disabled={laeuft}
                title="Bleibt erhalten, erscheint aber nicht mehr in der Suche"
                onClick={() => fuehreAus(() => ausBibliothekNehmen(bild.id))}
              >
                Aus der Bibliothek nehmen
              </button>
            ) : null}
            <button
              type="button"
              disabled={laeuft}
              onClick={() => {
                if (confirm('Dieses Bild endgültig löschen?')) {
                  fuehreAus(() => loescheBild(bild.id))
                }
              }}
            >
              Löschen
            </button>
          </div>

          {meldung ? (
            <div className={`hinweis ${meldung.match(/nicht löschen/) ? 'fehler' : ''}`} role="status">
              {meldung}
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  )
}

/** Bilder direkt in die Bibliothek hochladen. */
export function Bildaufnahme() {
  const router = useRouter()
  const [laeuft, setzeLaeuft] = useState(false)
  const [meldung, setzeMeldung] = useState<string | null>(null)
  const wahl = useRef<HTMLInputElement | null>(null)

  const lade = async (dateien: FileList) => {
    setzeLaeuft(true)
    setzeMeldung(null)
    try {
      const formular = new FormData()
      for (const d of Array.from(dateien)) formular.append('bild', d)

      const antwort = await fetch('/api/bilder', { method: 'POST', body: formular })
      const ergebnis = (await antwort.json()) as { angelegt?: string[]; fehler?: string }

      if (ergebnis.fehler) setzeMeldung(ergebnis.fehler)
      else setzeMeldung(`${ergebnis.angelegt?.length ?? 0} Bild(er) aufgenommen — jetzt beschriften.`)
      router.refresh()
    } catch {
      setzeMeldung('Die Verbindung ist abgerissen.')
    } finally {
      setzeLaeuft(false)
    }
  }

  return (
    <>
      <div className="werkzeugleiste">
        <input
          ref={wahl}
          type="file"
          accept="image/png,image/jpeg"
          multiple
          disabled={laeuft}
          aria-label="Bilder in die Bibliothek aufnehmen"
          style={{ flex: 1, minWidth: 240 }}
          onChange={(e) => {
            if (e.target.files?.length) void lade(e.target.files)
            e.target.value = ''
          }}
        />
        {laeuft ? <Kreisel text="lädt hoch …" /> : null}
        <span className="treffer-zahl">PNG und JPEG, bis 8 MB</span>
      </div>

      {meldung ? (
        <div className="hinweis" style={{ marginBottom: 16 }} role="status">
          {meldung}
        </div>
      ) : null}
    </>
  )
}
