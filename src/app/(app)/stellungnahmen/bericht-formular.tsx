'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Fortschritt, type Fortschrittsstand } from '@/app/teile/anzeigen'
import { leseEreignisse } from '@/app/teile/strom'
import type { Auswertungsereignis } from '@/stellungnahme/auswertung'

/**
 * Prüfbericht hochladen und auswerten lassen.
 *
 * Der Vorgang meldet, woran er gerade arbeitet: Seite für Seite beim
 * Einlesen, dann Auslesen, Prüfliste, Anlegen. Bei einem gescannten Bericht
 * dauert das über eine Minute — ohne diese Meldungen sähe es aus, als sei
 * die Seite stehen geblieben.
 */
export function BerichtFormular({
  faelle,
  aktiv,
}: {
  faelle: { id: string; bezeichnung: string }[]
  aktiv: boolean
}) {
  const router = useRouter()
  const [stand, setzeStand] = useState<Fortschrittsstand | null>(null)
  const [meldung, setzeMeldung] = useState<{ text: string; fehler: boolean } | null>(null)
  const formularRef = useRef<HTMLFormElement>(null)

  const laeuft = stand !== null && !stand.fehler

  const werteAus = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formular = new FormData(e.currentTarget)

    setzeMeldung(null)
    const verlauf: string[] = []
    setzeStand({ anteil: 0.02, text: 'Datei wird übertragen …', verlauf })

    let antwort: Response
    try {
      antwort = await fetch('/api/stellungnahmen/auswerten', { method: 'POST', body: formular })
    } catch {
      setzeStand(null)
      setzeMeldung({ text: 'Die Verbindung ist abgerissen.', fehler: true })
      return
    }

    if (!antwort.ok && antwort.headers.get('content-type')?.includes('json')) {
      const { fehler } = (await antwort.json()) as { fehler?: string }
      setzeStand(null)
      setzeMeldung({ text: fehler ?? 'Die Auswertung ist gescheitert.', fehler: true })
      return
    }

    for await (const ereignis of leseEreignisse<Auswertungsereignis>(antwort)) {
      if (ereignis.art === 'fortschritt') {
        verlauf.push(ereignis.text)
        setzeStand({
          anteil: ereignis.anteil,
          text: ereignis.text,
          // Nur die jüngsten Meldungen — die Liste soll den Blick nicht
          // vom Balken wegziehen.
          verlauf: verlauf.slice(-4),
        })
        continue
      }

      if (ereignis.art === 'fehler') {
        setzeStand(null)
        setzeMeldung({ text: ereignis.fehler, fehler: true })
        return
      }

      setzeStand({ anteil: 1, text: 'Fertig — die Stellungnahme wird geöffnet …', verlauf: [] })
      if (ereignis.hinweis) setzeMeldung({ text: ereignis.hinweis, fehler: false })
      formularRef.current?.reset()
      router.push(`/stellungnahmen/${ereignis.stellungnahmeId}`)
      return
    }

    // Der Strom endete ohne Abschluss — das ist ein Abbruch, kein Erfolg.
    setzeStand(null)
    setzeMeldung({ text: 'Der Vorgang ist unterwegs abgebrochen.', fehler: true })
  }

  return (
    <>
      <form ref={formularRef} onSubmit={werteAus} className="werkzeugleiste" style={{ marginBottom: 12 }}>
        <input
          type="file"
          name="pruefbericht"
          accept="application/pdf,.pdf"
          required
          disabled={!aktiv || laeuft}
          aria-label="Prüfbericht als PDF"
          style={{ flex: 1, minWidth: 240, fontSize: 13.5 }}
        />
        <select name="fallId" disabled={!aktiv || laeuft} aria-label="Fall zuordnen">
          <option value="">Ohne Fallzuordnung</option>
          {faelle.map((f) => (
            <option key={f.id} value={f.id}>
              {f.bezeichnung}
            </option>
          ))}
        </select>
        <button type="submit" className="haupt" disabled={!aktiv || laeuft}>
          {laeuft ? 'Wird ausgewertet …' : 'Prüfbericht auswerten'}
        </button>
        <span className="treffer-zahl">Gescannte Seiten werden mitgelesen</span>
      </form>

      {stand ? (
        <div style={{ marginBottom: 18 }}>
          <Fortschritt stand={stand} />
        </div>
      ) : null}

      {meldung ? (
        <div
          className={`hinweis ${meldung.fehler ? 'fehler' : ''}`}
          style={{ marginBottom: 18 }}
          role={meldung.fehler ? 'alert' : 'status'}
        >
          {meldung.text}
        </div>
      ) : null}
    </>
  )
}
