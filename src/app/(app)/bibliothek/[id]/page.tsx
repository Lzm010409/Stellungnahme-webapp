import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ladeEintrag } from '@/bibliothek/abfragen'
import { aktuellerBenutzer } from '@/auth/sitzung'
import { StatusPille } from '../status-pille'
import { Freigabeleiste } from './freigabeleiste'
import { BelegPruefung } from './beleg-pruefung'

const BEREICHSNAMEN: Record<string, string> = {
  kalkulation: 'Kalkulation',
  wertminderung: 'Wertminderung',
  wbw: 'Wiederbeschaffungswert',
  restwert: 'Restwert',
  sonderfall: 'Sonderfälle',
}

export default async function EintragSeite({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [e, benutzer] = await Promise.all([ladeEintrag(id), aktuellerBenutzer()])
  if (!e) notFound()

  const darfFreigeben = benutzer?.rolle === 'freigeber' || benutzer?.rolle === 'admin'
  const werte = e.platzhalter.filter((p) => p.art === 'wert')
  const regie = e.platzhalter.filter((p) => p.art === 'regieanweisung')
  const unbestaetigt = e.belege.filter((b) => !b.verifiziertAm)

  return (
    <>
      <p style={{ margin: '0 0 14px', fontSize: 13 }}>
        <Link href="/bibliothek">← Argumentbibliothek</Link>
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
            {e.nummer}
          </p>
          <h1>{e.titel}</h1>
          <p className="unterzeile">
            {BEREICHSNAMEN[e.bereich] ?? e.bereich} · {e.abschnitt}
          </p>
        </div>
        <StatusPille status={e.status} />
      </div>

      <div className="detail">
        <div>
          {e.typischeBegruendung ? (
            <div className="block">
              <div className="block-label">Typische Begründung des Prüfdienstleisters</div>
              <div className="karte fliesstext" style={{ fontStyle: 'italic' }}>
                {e.typischeBegruendung}
              </div>
            </div>
          ) : null}

          {e.gegenargument ? (
            <div className="block">
              <div className="block-label">Gegenargument</div>
              <div className="zitat fliesstext">{e.gegenargument}</div>
            </div>
          ) : null}

          {e.vorgehen ? (
            <div className="block">
              <div className="block-label">
                Vorgehen
                <span className="marke-pille m-akzent">kein fertiger Text</span>
              </div>
              <div className="karte fliesstext">{e.vorgehen}</div>
            </div>
          ) : null}

          {e.varianten.length > 0 ? (
            <div className="block">
              <div className="block-label">Varianten ({e.varianten.length})</div>
              <div className="liste">
                {e.varianten.map((v) => (
                  <div key={v.id} className="zeile" style={{ gridTemplateColumns: 'minmax(0,1fr)' }}>
                    <div>
                      <div className="zeile-titel">{v.bezeichnung}</div>
                      <div className="fliesstext" style={{ fontSize: 14, marginTop: 4 }}>
                        {v.text}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {e.ergaenzungen.length > 0 ? (
            <div className="block">
              <div className="block-label">Ergänzungen ({e.ergaenzungen.length})</div>
              <div className="liste">
                {e.ergaenzungen.map((x) => (
                  <div key={x.id} className="zeile" style={{ gridTemplateColumns: 'minmax(0,1fr)' }}>
                    <div>
                      <div className="zeile-titel">{x.titel}</div>
                      <div className="fliesstext" style={{ fontSize: 14, marginTop: 4 }}>
                        {x.text}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {e.hinweise ? (
            <div className="block">
              <div className="block-label">
                Interne Hinweise
                <span className="marke-pille m-warn">nie im Schreiben</span>
              </div>
              <div className="intern fliesstext">{e.hinweise}</div>
            </div>
          ) : null}
        </div>

        <aside className="seitenleiste">
          <Freigabeleiste
            id={e.id}
            status={e.status}
            darfFreigeben={darfFreigeben}
            offeneBelege={unbestaetigt.length}
          />

          <div className="karte">
            <h2>Einzusetzende Werte</h2>
            {werte.length === 0 ? (
              <p className="unterzeile" style={{ margin: 0 }}>
                Keine — der Text ist ohne Anpassung verwendbar.
              </p>
            ) : (
              <div className="marker-liste">
                {werte.map((p) => (
                  <code key={p.id}>[{p.schluessel}]</code>
                ))}
              </div>
            )}
          </div>

          {regie.length > 0 ? (
            <div className="karte">
              <h2>Arbeitsaufträge</h2>
              <p className="unterzeile" style={{ marginTop: 0 }}>
                Müssen erledigt oder entfernt werden — sie dürfen nicht im Schreiben stehen bleiben.
              </p>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5 }}>
                {regie.map((p) => (
                  <li key={p.id} style={{ marginBottom: 6 }}>
                    {p.schluessel}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {e.vorbedingungen.length > 0 ? (
            <div className="karte">
              <h2>Vorbedingungen prüfen</h2>
              <p className="unterzeile" style={{ marginTop: 0 }}>
                Aus dem Text erkannt. Nicht als erfüllt unterstellen.
              </p>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5 }}>
                {e.vorbedingungen.map((v) => (
                  <li key={v.id} style={{ marginBottom: 6 }}>
                    {v.text}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <BelegPruefung eintragId={e.id} belege={e.belege} />

          <div className="karte">
            <h2>Herkunft</h2>
            <dl className="kv">
              <dt>Quelle</dt>
              <dd>{e.quelldatei ?? '—'}</dd>
              <dt>Angelegt</dt>
              <dd>{e.herkunft === 'migration' ? 'Migration' : e.herkunft}</dd>
              <dt>Fassung</dt>
              <dd>{e.version}</dd>
              {e.haeufigkeitText ? (
                <>
                  <dt>Häufigkeit</dt>
                  <dd style={{ textAlign: 'left' }}>{e.haeufigkeitText}</dd>
                </>
              ) : null}
            </dl>
          </div>
        </aside>
      </div>
    </>
  )
}
