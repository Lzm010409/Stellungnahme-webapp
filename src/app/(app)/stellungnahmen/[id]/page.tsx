import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ladeStellungnahme } from '@/stellungnahme/abfragen'
import { holeVorschlaege } from '@/stellungnahme/aktionen'
import type { Sonderfallbefund } from '@/pruefbericht/sonderfaelle'
import type { Extraktion } from '@/pruefbericht/schema'
import { gutachtenSchema } from '@/autoixpert/typen'
import { leseFalldaten, platzhalterWerte } from '@/autoixpert/felder'
import { stelleDokumentBereit } from '@/dokument/dienst'
import { kiVerfuegbar } from '@/ki/client'
import { Schreibtisch } from './schreiben'
import { Kopfbereich } from './kopf'

function euro(wert: string | number | null | undefined): string {
  if (wert === null || wert === undefined) return '—'
  const zahl = typeof wert === 'string' ? Number(wert) : wert
  if (Number.isNaN(zahl)) return '—'
  return zahl.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
}

function falldatenWerte(daten: unknown): Record<string, string> {
  const geprueft = gutachtenSchema.safeParse(daten)
  if (!geprueft.success) return {}
  return platzhalterWerte(leseFalldaten(geprueft.data))
}

export default async function StellungnahmeSeite({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const s = await ladeStellungnahme(id)
  if (!s) notFound()

  const [vorschlaege, brief] = await Promise.all([holeVorschlaege(id), stelleDokumentBereit(s)])

  const befunde = (s.sonderfaelle ?? []) as Sonderfallbefund[]
  const extraktion = s.extraktion as Extraktion | null
  const summe = s.positionen.reduce((acc, p) => acc + Number(p.differenz ?? 0), 0)

  return (
    <>
      <p style={{ margin: '0 0 14px', fontSize: 13 }}>
        <Link href="/stellungnahmen">← Stellungnahmen</Link>
      </p>

      <div className="seiten-kopf">
        <div>
          <p
            style={{
              fontFamily: 'var(--mono)',
              fontSize: 12,
              color: 'var(--accent)',
              margin: '0 0 4px',
              fontWeight: 600,
            }}
          >
            {s.fall?.aktenzeichen ?? extraktion?.aktenzeichen ?? 'ohne Aktenzeichen'}
          </p>
          <h1>{s.betreff ?? 'Stellungnahme'}</h1>
          <p className="unterzeile">
            {[
              extraktion?.pruefdienstleister ? `Prüfbericht ${extraktion.pruefdienstleister}` : null,
              extraktion?.versicherer,
              s.pruefberichtSeiten ? `${s.pruefberichtSeiten} Seiten` : null,
              `Gesamtkürzung ${euro(summe)}`,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
      </div>

      {befunde.length > 0 ? (
        <details className="klappe">
          <summary>
            Prüfliste
            <span className="marke-pille m-warn">{befunde.length}</span>
          </summary>
          {befunde.map((b) => (
            <div key={b.kennung} className={`sonderfall ${b.dringlichkeit}`}>
              <div className="sonderfall-titel">
                <span className="marke-pille m-akzent">{b.kennung}</span>
                {b.titel}
              </div>
              <div className="sonderfall-text">{b.befund}</div>
              <div className="sonderfall-handlung">{b.handlung}</div>
            </div>
          ))}
        </details>
      ) : null}

      {extraktion?.unklarheiten && extraktion.unklarheiten.length > 0 ? (
        <details className="klappe">
          <summary>
            Beim Auslesen unklar geblieben
            <span className="marke-pille m-warn">{extraktion.unklarheiten.length}</span>
          </summary>
          <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
            {extraktion.unklarheiten.map((u, i) => (
              <li key={i}>{u}</li>
            ))}
          </ul>
        </details>
      ) : null}

      <Kopfbereich
        stellungnahmeId={s.id}
        empfaengerName={s.empfaengerName}
        empfaengerStrasse={s.empfaengerStrasse}
        empfaengerPlzOrt={s.empfaengerPlzOrt}
        einleitungDatum={s.einleitungDatum}
        einleitungMedium={s.einleitungMedium}
      />

      {s.positionen.length === 0 ? (
        <div className="leer">
          <p style={{ margin: 0 }}>
            Aus diesem Bericht wurde keine Position übernommen, die in eine Stellungnahme gehört.
          </p>
        </div>
      ) : null}

      <Schreibtisch
        stellungnahmeId={s.id}
        dokument={brief.dokument}
        stand={brief.stand}
        kiAktiv={kiVerfuegbar()}
        versendet={Boolean(s.versendetAm)}
        werte={falldatenWerte(s.fall?.daten)}
        positionen={s.positionen.map((p) => ({
          id: p.id,
          bezeichnung: p.bezeichnung,
          betragGutachten: p.betragGutachten,
          betragGekuerzt: p.betragGekuerzt,
          differenz: p.differenz,
          begruendungVersicherer: p.begruendungVersicherer,
          behandlung: p.behandlung,
          seite: p.seite,
        }))}
        vorschlaege={vorschlaege.map((v) => ({
          positionId: v.positionId,
          besteGuete: v.besteGuete,
          kandidaten: v.kandidaten.map((k) => ({
            eintragId: k.eintrag.id,
            nummer: k.eintrag.nummer,
            titel: k.eintrag.titel,
            abschnitt: k.eintrag.abschnitt,
            status: k.eintrag.status,
            haeufigkeitText: k.eintrag.haeufigkeitText,
            guete: k.guete,
            treffergruende: k.treffergruende,
            // Der Text der passenden Variante kommt mit — die Blase soll ihn
            // zeigen und bearbeiten lassen, ohne dafür nachzuladen.
            passendeVarianten: k.passendeVarianten.map((pv) => ({
              id: pv.id,
              bezeichnung: pv.bezeichnung,
              text: k.eintrag.varianten.find((x) => x.id === pv.id)?.text ?? '',
            })),
            text: k.eintrag.gegenargument,
            vorgehen: k.eintrag.vorgehen,
          })),
        }))}
      />
    </>
  )
}
