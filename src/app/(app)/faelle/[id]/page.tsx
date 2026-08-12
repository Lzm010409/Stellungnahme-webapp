import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ladeFall } from '@/autoixpert/aktionen'
import { leseFalldaten, platzhalterWerte, schlageEmpfaengerVor, formatiereDatum } from '@/autoixpert/felder'
import { gutachtenSchema } from '@/autoixpert/typen'
import { Aktualisieren } from './aktualisieren'

const HERKUNFT: Record<string, string> = {
  anwalt: 'Rechtsanwalt aus dem Gutachten',
  versicherung: 'Versicherung aus dem Gutachten',
  werkstatt: 'Werkstatt aus dem Gutachten',
}

export default async function FallSeite({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const f = await ladeFall(id)
  if (!f) notFound()

  const geprueft = gutachtenSchema.safeParse(f.daten)
  if (!geprueft.success) {
    return (
      <>
        <p style={{ margin: '0 0 14px', fontSize: 13 }}>
          <Link href="/faelle">← Fälle</Link>
        </p>
        <div className="hinweis fehler">
          Die gespeicherten Falldaten lassen sich nicht lesen. Bitte den Fall neu laden.
        </div>
      </>
    )
  }

  const d = leseFalldaten(geprueft.data)
  const werte = platzhalterWerte(d)
  const vorschlag = schlageEmpfaengerVor(d)

  return (
    <>
      <p style={{ margin: '0 0 14px', fontSize: 13 }}>
        <Link href="/faelle">← Fälle</Link>
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
            {d.aktenzeichen ?? 'ohne Aktenzeichen'}
          </p>
          <h1>{d.anspruchsteller?.name ?? 'Fall ohne Anspruchsteller'}</h1>
          <p className="unterzeile">
            {[d.gutachtenTyp, d.zustand].filter(Boolean).join(' · ')}
            {f.abgerufenAm
              ? ` · abgerufen ${new Date(f.abgerufenAm).toLocaleString('de-DE')}`
              : ''}
          </p>
        </div>
        <Aktualisieren fallId={f.id} />
      </div>

      <div className="detail">
        <div>
          <div className="block">
            <div className="block-label">Fahrzeug</div>
            <div className="karte">
              <dl className="kv" style={{ gridTemplateColumns: 'minmax(140px,auto) 1fr' }}>
                <Zeile label="Hersteller / Modell" wert={[d.fahrzeug.hersteller, d.fahrzeug.modell].filter(Boolean).join(' ')} />
                <Zeile label="Kennzeichen" wert={d.fahrzeug.kennzeichen} />
                <Zeile label="Fahrgestellnummer" wert={d.fahrzeug.vin} />
                <Zeile label="Erstzulassung" wert={formatiereDatum(d.fahrzeug.erstzulassung)} />
                <Zeile
                  label="Laufleistung"
                  wert={
                    d.fahrzeug.laufleistung
                      ? `${d.fahrzeug.laufleistung.toLocaleString('de-DE')} ${d.fahrzeug.laufleistungEinheit}`
                      : null
                  }
                />
                <Zeile
                  label="Scheckheft"
                  wert={
                    d.fahrzeug.scheckheftGepflegt === null
                      ? null
                      : d.fahrzeug.scheckheftGepflegt
                        ? 'gepflegt'
                        : 'nicht gepflegt'
                  }
                />
                <Zeile label="Letzter Service" wert={formatiereDatum(d.fahrzeug.letzterService)} />
              </dl>
            </div>
          </div>

          {d.fahrzeug.vorschaedenRepariert || d.fahrzeug.vorschaedenUnrepariert ? (
            <div className="block">
              <div className="block-label">
                Vorschäden
                <span className="marke-pille m-warn">für Abgrenzung relevant</span>
              </div>
              <div className="karte fliesstext" style={{ fontSize: 14.5 }}>
                {d.fahrzeug.vorschaedenRepariert ? (
                  <p style={{ margin: '0 0 8px' }}>
                    <strong>Repariert:</strong> {d.fahrzeug.vorschaedenRepariert}
                  </p>
                ) : null}
                {d.fahrzeug.vorschaedenUnrepariert ? (
                  <p style={{ margin: 0 }}>
                    <strong>Unrepariert:</strong> {d.fahrzeug.vorschaedenUnrepariert}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="block">
            <div className="block-label">Unfall und Schaden</div>
            <div className="karte">
              <dl className="kv" style={{ gridTemplateColumns: 'minmax(140px,auto) 1fr' }}>
                <Zeile label="Unfalltag" wert={formatiereDatum(d.unfall.datum)} />
                <Zeile label="Ort" wert={d.unfall.ort} />
              </dl>
              {d.unfall.hergang ? (
                <p className="fliesstext" style={{ fontSize: 14.5, marginTop: 12, marginBottom: 0 }}>
                  {d.unfall.hergang}
                </p>
              ) : null}
              {d.fahrzeug.schadenbeschreibung ? (
                <p className="fliesstext" style={{ fontSize: 14.5, marginTop: 10, marginBottom: 0 }}>
                  {d.fahrzeug.schadenbeschreibung}
                </p>
              ) : null}
            </div>
          </div>

          <div className="block">
            <div className="block-label">Beteiligte</div>
            <div className="liste">
              <BeteiligtenZeile rolle="Anspruchsteller" b={d.anspruchsteller} />
              <BeteiligtenZeile rolle="Rechtsanwalt" b={d.anwalt} />
              <BeteiligtenZeile
                rolle="Versicherung"
                b={d.versicherung}
                zusatz={d.versicherung?.schadennummer ? `Schaden-Nr. ${d.versicherung.schadennummer}` : null}
              />
              <BeteiligtenZeile rolle="Werkstatt" b={d.werkstatt} />
              <BeteiligtenZeile
                rolle="Unfallgegner"
                b={d.unfallgegner}
                zusatz={d.unfallgegner?.kennzeichen}
              />
            </div>
          </div>
        </div>

        <aside className="seitenleiste">
          <div className="karte">
            <h2>Vorschlag für die Stellungnahme</h2>
            {vorschlag.empfaenger ? (
              <>
                <p className="unterzeile" style={{ marginTop: 0 }}>
                  {HERKUNFT[vorschlag.herkunft ?? ''] ?? 'aus dem Gutachten'}
                </p>
                <p style={{ margin: '0 0 4px', fontWeight: 600, fontSize: 14 }}>
                  {vorschlag.empfaenger.name}
                </p>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-mid)' }}>
                  {vorschlag.empfaenger.strasse}
                  {vorschlag.empfaenger.strasse ? <br /> : null}
                  {vorschlag.empfaenger.plzOrt}
                </p>
                {vorschlag.betreff ? (
                  <p style={{ margin: '12px 0 0', fontSize: 13 }}>
                    <span style={{ color: 'var(--ink-soft)' }}>Betreff: </span>
                    {vorschlag.betreff}
                  </p>
                ) : null}
              </>
            ) : (
              <p className="unterzeile" style={{ margin: 0 }}>
                Kein Empfänger im Gutachten hinterlegt — er wird beim Erstellen abgefragt.
              </p>
            )}
          </div>

          <div className="karte">
            <h2>Verfügbare Platzhalter</h2>
            <p className="unterzeile" style={{ marginTop: 0 }}>
              Werden beim Einfügen eines Bibliothekstexts automatisch gesetzt.
            </p>
            {Object.keys(werte).length === 0 ? (
              <p className="unterzeile" style={{ margin: 0 }}>Keine — die Falldaten sind zu dünn.</p>
            ) : (
              <dl className="kv">
                {Object.entries(werte).map(([schluessel, wert]) => (
                  <Fragmentierte key={schluessel} schluessel={schluessel} wert={wert} />
                ))}
              </dl>
            )}
          </div>

          <div className="karte">
            <h2>Herkunft</h2>
            <dl className="kv">
              <dt>autoiXpert-ID</dt>
              <dd style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{d.autoixpertId}</dd>
              {d.externeId ? (
                <>
                  <dt>Externe ID</dt>
                  <dd style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{d.externeId}</dd>
                </>
              ) : null}
              <dt>Auftragsdatum</dt>
              <dd>{formatiereDatum(d.auftragsdatum) ?? '—'}</dd>
              <dt>Fertigstellung</dt>
              <dd>{formatiereDatum(d.fertigstellung) ?? '—'}</dd>
            </dl>
          </div>

          <div className="hinweis warn">
            Kalkulationsbeträge liefert die autoiXpert-Schnittstelle noch nicht. Die
            Kürzungspositionen kommen deshalb aus dem Prüfbericht.
          </div>
        </aside>
      </div>
    </>
  )
}

function Zeile({ label, wert }: { label: string; wert: string | null | undefined }) {
  if (!wert) return null
  return (
    <>
      <dt>{label}</dt>
      <dd style={{ textAlign: 'left' }}>{wert}</dd>
    </>
  )
}

function Fragmentierte({ schluessel, wert }: { schluessel: string; wert: string }) {
  return (
    <>
      <dt>
        <code style={{ fontSize: 11 }}>[{schluessel}]</code>
      </dt>
      <dd style={{ textAlign: 'left', fontSize: 12.5 }}>{wert}</dd>
    </>
  )
}

function BeteiligtenZeile({
  rolle,
  b,
  zusatz,
}: {
  rolle: string
  b: { name: string; strasse: string | null; plzOrt: string | null } | null
  zusatz?: string | null
}) {
  return (
    <div className="zeile" style={{ gridTemplateColumns: '150px minmax(0,1fr)' }}>
      <span style={{ fontSize: 12.5, color: 'var(--ink-soft)', paddingTop: 2 }}>{rolle}</span>
      <span>
        {b ? (
          <>
            <span className="zeile-titel">{b.name || '—'}</span>
            <span className="zeile-meta">
              {b.strasse ? <span>{b.strasse}</span> : null}
              {b.plzOrt ? <span>{b.plzOrt}</span> : null}
              {zusatz ? <span>{zusatz}</span> : null}
            </span>
          </>
        ) : (
          <span style={{ color: 'var(--ink-soft)', fontSize: 13.5 }}>nicht hinterlegt</span>
        )}
      </span>
    </div>
  )
}
