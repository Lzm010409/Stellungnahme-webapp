'use client'

import { useState, useTransition } from 'react'
import { speichereKopf } from '@/stellungnahme/export-aktionen'

/**
 * Empfänger, Betreff, Anrede und Einleitung.
 *
 * Der Hausstil verlangt, diese Angaben aktiv zu erfragen, wenn sie nicht
 * aus dem Fall hervorgehen — sie stehen deshalb offen im Formular und
 * werden nicht stillschweigend geraten.
 */
export function Kopfbereich(props: {
  stellungnahmeId: string
  empfaengerName: string | null
  empfaengerStrasse: string | null
  empfaengerPlzOrt: string | null
  betreff: string | null
  anrede: string | null
  einleitungDatum: string | null
  einleitungMedium: string | null
  ergebnisAbsatz: string | null
}) {
  const [laeuft, starte] = useTransition()
  const [meldung, setzeMeldung] = useState<string | null>(null)
  const [werte, setzeWerte] = useState({
    empfaengerName: props.empfaengerName ?? '',
    empfaengerStrasse: props.empfaengerStrasse ?? '',
    empfaengerPlzOrt: props.empfaengerPlzOrt ?? '',
    betreff: props.betreff ?? '',
    anrede: props.anrede ?? 'Sehr geehrte Damen und Herren,',
    einleitungDatum: props.einleitungDatum ?? '',
    einleitungMedium: props.einleitungMedium ?? 'schreiben',
    ergebnisAbsatz: props.ergebnisAbsatz ?? '',
  })

  const setze = (feld: keyof typeof werte, wert: string) =>
    setzeWerte((w) => ({ ...w, [feld]: wert }))

  const fehlend = [
    !werte.empfaengerName && 'Empfänger',
    !werte.betreff && 'Betreff',
    !werte.einleitungDatum && 'Datum des Anschreibens',
  ].filter(Boolean)

  return (
    <section className="karte" style={{ marginTop: 24 }}>
      <h2>Anschreiben</h2>
      {fehlend.length > 0 ? (
        <div className="hinweis warn" style={{ marginBottom: 12 }}>
          Noch offen: {fehlend.join(', ')}. Der Hausstil verlangt, diese Angaben zu erfragen statt
          sie zu raten.
        </div>
      ) : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 }}>
        <div className="feld">
          <label htmlFor="empf">Empfänger</label>
          <input id="empf" value={werte.empfaengerName} onChange={(e) => setze('empfaengerName', e.target.value)} />
        </div>
        <div className="feld">
          <label htmlFor="str">Straße</label>
          <input id="str" value={werte.empfaengerStrasse} onChange={(e) => setze('empfaengerStrasse', e.target.value)} />
        </div>
        <div className="feld">
          <label htmlFor="plz">PLZ und Ort</label>
          <input id="plz" value={werte.empfaengerPlzOrt} onChange={(e) => setze('empfaengerPlzOrt', e.target.value)} />
        </div>
        <div className="feld">
          <label htmlFor="anr">Anrede</label>
          <input id="anr" value={werte.anrede} onChange={(e) => setze('anrede', e.target.value)} />
        </div>
        <div className="feld" style={{ gridColumn: '1 / -1' }}>
          <label htmlFor="betr">Betreffzeile</label>
          <input id="betr" value={werte.betreff} onChange={(e) => setze('betreff', e.target.value)} />
        </div>
        <div className="feld">
          <label htmlFor="dat">Datum des Anschreibens</label>
          <input id="dat" placeholder="TT.MM.JJJJ" value={werte.einleitungDatum} onChange={(e) => setze('einleitungDatum', e.target.value)} />
        </div>
        <div className="feld">
          <label htmlFor="med">Übermittlungsweg</label>
          <select id="med" value={werte.einleitungMedium} onChange={(e) => setze('einleitungMedium', e.target.value)}>
            <option value="schreiben">Schreiben</option>
            <option value="mail">Mail</option>
          </select>
        </div>
        <div className="feld" style={{ gridColumn: '1 / -1' }}>
          <label htmlFor="erg">Ergebnis-Absatz (leer lassen für den Standardtext)</label>
          <textarea id="erg" style={{ minHeight: 80 }} value={werte.ergebnisAbsatz} onChange={(e) => setze('ergebnisAbsatz', e.target.value)} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 12 }}>
        <button
          type="button"
          disabled={laeuft}
          onClick={() =>
            starte(async () => {
              const e = await speichereKopf(props.stellungnahmeId, werte)
              setzeMeldung(e.fehler ?? e.hinweis ?? null)
            })
          }
        >
          {laeuft ? 'Speichert …' : 'Speichern'}
        </button>
        {meldung ? <span className="unterzeile" style={{ margin: 0 }}>{meldung}</span> : null}
      </div>
    </section>
  )
}
