import Link from 'next/link'
import {
  ladeAbschnitte,
  sucheEintraege,
  zaehleNachStatus,
  type Bereich,
  type EintragStatus,
} from '@/bibliothek/abfragen'
import { StatusPille } from '@/app/(app)/bibliothek/status-pille'
import { Suchleiste } from './suchleiste'

const BEREICHSNAMEN: Record<Bereich, string> = {
  kalkulation: 'Kalkulation',
  wertminderung: 'Wertminderung',
  wbw: 'Wiederbeschaffungswert',
  restwert: 'Restwert',
  sonderfall: 'Sonderfälle',
}

function istBereich(w: string | undefined): w is Bereich {
  return !!w && w in BEREICHSNAMEN
}

function istStatus(w: string | undefined): w is EintragStatus {
  return !!w && ['entwurf', 'pruefung', 'freigegeben', 'zurueckgezogen'].includes(w)
}

/** Kürzt einen Text auf ganze Wörter. */
function auszug(text: string | null, laenge = 190): string {
  if (!text) return ''
  const sauber = text.replace(/\s+/g, ' ').trim()
  if (sauber.length <= laenge) return sauber
  return sauber.slice(0, sauber.lastIndexOf(' ', laenge)) + ' …'
}

export default async function BibliothekSeite({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; bereich?: string; status?: string; abschnitt?: string }>
}) {
  const p = await searchParams
  const filter = {
    suche: p.q,
    bereich: istBereich(p.bereich) ? p.bereich : undefined,
    status: istStatus(p.status) ? p.status : undefined,
    abschnitt: p.abschnitt,
  }

  const [eintraege, abschnitte, nachStatus] = await Promise.all([
    sucheEintraege(filter),
    ladeAbschnitte(filter.bereich),
    zaehleNachStatus(),
  ])

  const offen = nachStatus.entwurf ?? 0

  return (
    <>
      <div className="seiten-kopf">
        <div>
          <h1>Argumentbibliothek</h1>
          <p className="unterzeile">
            {offen > 0
              ? `${offen} Einträge warten auf Freigabe`
              : 'Alle Einträge sind gesichtet'}
          </p>
        </div>
      </div>

      <Suchleiste
        abschnitte={abschnitte}
        bereichsnamen={BEREICHSNAMEN}
        trefferzahl={eintraege.length}
      />

      {eintraege.length === 0 ? (
        <div className="leer">
          <p style={{ margin: 0 }}>Kein Eintrag passt zu dieser Suche.</p>
        </div>
      ) : (
        <div className="liste">
          {eintraege.map((e) => {
            const text = e.gegenargument ?? e.vorgehen
            return (
              <Link key={e.id} href={`/bibliothek/${e.id}`} className="zeile">
                <span className="zeile-nummer">{e.nummer}</span>
                <span>
                  <span className="zeile-titel">{e.titel}</span>
                  <span className="zeile-meta">
                    <span>{BEREICHSNAMEN[e.bereich]}</span>
                    <span>{e.abschnitt}</span>
                    {e.haeufigkeitText ? <span>· {e.haeufigkeitText}</span> : null}
                  </span>
                  {text ? <span className="zeile-auszug">{auszug(text)}</span> : null}
                </span>
                <span className="zeile-rechts">
                  <StatusPille status={e.status} />
                  <span className="marker-liste">
                    {!e.gegenargument && e.vorgehen ? (
                      <span className="marke-pille m-akzent" title="Handlungsanweisung statt fertigem Text">
                        Vorgehen
                      </span>
                    ) : null}
                    {e.platzhalterOffen > 0 ? (
                      <span
                        className="marke-pille m-entwurf"
                        title="Einzusetzende Werte und Arbeitsaufträge"
                      >
                        {e.platzhalterOffen} Platzh.
                      </span>
                    ) : null}
                    {e.vorbedingungen > 0 ? (
                      <span className="marke-pille m-warn" title="Vorbedingungen prüfen">
                        ⚠ {e.vorbedingungen}
                      </span>
                    ) : null}
                    {e.belegeUnverifiziert > 0 ? (
                      <span
                        className="marke-pille m-warn"
                        title="Fundstellen noch nicht bestätigt — sperrt den Export"
                      >
                        {e.belegeUnverifiziert} Beleg
                      </span>
                    ) : null}
                  </span>
                </span>
              </Link>
            )
          })}
        </div>
      )}
    </>
  )
}
