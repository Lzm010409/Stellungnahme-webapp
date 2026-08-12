import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ladeStellungnahme } from '@/stellungnahme/abfragen'
import { holeVorschlaege } from '@/stellungnahme/aktionen'
import type { Sonderfallbefund } from '@/pruefbericht/sonderfaelle'
import type { Extraktion } from '@/pruefbericht/schema'
import { Auswahlmaske } from './auswahlmaske'

function euro(wert: string | number | null | undefined): string {
  if (wert === null || wert === undefined) return '—'
  const zahl = typeof wert === 'string' ? Number(wert) : wert
  if (Number.isNaN(zahl)) return '—'
  return zahl.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
}

export default async function StellungnahmeSeite({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const s = await ladeStellungnahme(id)
  if (!s) notFound()

  const vorschlaege = await holeVorschlaege(id)
  const befunde = (s.sonderfaelle ?? []) as Sonderfallbefund[]
  const extraktion = s.extraktion as Extraktion | null

  const summe = s.positionen.reduce((acc, p) => acc + Number(p.differenz ?? 0), 0)
  const bearbeitet = s.positionen.filter((p) => p.behandlung !== 'offen').length

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
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
      </div>

      <div className="bilanz">
        <div>
          <div className="bilanz-label">Gesamtkürzung</div>
          <div className="bilanz-wert" style={{ color: 'var(--crit)' }}>
            {euro(summe)}
          </div>
        </div>
        <div>
          <div className="bilanz-label">Positionen</div>
          <div className="bilanz-wert">
            {bearbeitet} / {s.positionen.length}
          </div>
        </div>
        {extraktion?.summeGutachten !== null && extraktion?.summeGutachten !== undefined ? (
          <div>
            <div className="bilanz-label">Gutachten</div>
            <div className="bilanz-wert">{euro(extraktion.summeGutachten)}</div>
          </div>
        ) : null}
        {extraktion?.summeGekuerzt !== null && extraktion?.summeGekuerzt !== undefined ? (
          <div>
            <div className="bilanz-label">Nach Prüfung</div>
            <div className="bilanz-wert">{euro(extraktion.summeGekuerzt)}</div>
          </div>
        ) : null}
      </div>

      {befunde.length > 0 ? (
        <section style={{ marginBottom: 22 }}>
          <h2>Prüfliste</h2>
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
        </section>
      ) : null}

      {extraktion?.unklarheiten && extraktion.unklarheiten.length > 0 ? (
        <div className="hinweis warn" style={{ marginBottom: 22 }}>
          <strong>Beim Auslesen unklar geblieben:</strong>
          <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
            {extraktion.unklarheiten.map((u, i) => (
              <li key={i}>{u}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <h2>Positionen</h2>
      <p className="unterzeile" style={{ margin: '0 0 14px' }}>
        Die Vorschläge sind eine Abkürzung. Die gesamte Bibliothek und ein eigener Text stehen
        bei jeder Position offen — auch bei einem direkten Treffer.
      </p>

      {s.positionen.length === 0 ? (
        <div className="leer">
          <p style={{ margin: 0 }}>
            Aus diesem Bericht wurde keine Position übernommen, die in eine Stellungnahme gehört.
          </p>
        </div>
      ) : (
        <Auswahlmaske
          positionen={s.positionen.map((p) => ({
            id: p.id,
            bezeichnung: p.bezeichnung,
            betragGutachten: p.betragGutachten,
            betragGekuerzt: p.betragGekuerzt,
            differenz: p.differenz,
            begruendungVersicherer: p.begruendungVersicherer,
            behandlung: p.behandlung,
            seite: p.seite,
            bausteine: p.bausteine.map((b) => ({
              id: b.id,
              typ: b.typ,
              textFinal: b.textFinal,
              herkunft: b.herkunft,
              inBibliothekUebernehmen: b.inBibliothekUebernehmen,
            })),
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
              passendeVarianten: k.passendeVarianten,
              hatText: Boolean(k.eintrag.gegenargument),
              vorgehen: k.eintrag.vorgehen,
            })),
          }))}
        />
      )}
    </>
  )
}
