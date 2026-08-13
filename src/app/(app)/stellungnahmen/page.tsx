import Link from 'next/link'
import { ladeStellungnahmen } from '@/stellungnahme/abfragen'
import { ladeFaelle } from '@/autoixpert/aktionen'
import { kiVerfuegbar } from '@/ki/client'
import { werkzeugeVorhanden } from '@/pruefbericht/einlesen'
import { gutachtenSchema } from '@/autoixpert/typen'
import { leseFalldaten } from '@/autoixpert/felder'
import { BerichtFormular } from './bericht-formular'
import { Loeschknopf } from './loeschknopf'

export default async function StellungnahmenSeite() {
  const [liste, faelle, werkzeuge] = await Promise.all([
    ladeStellungnahmen(),
    ladeFaelle(),
    werkzeugeVorhanden(),
  ])

  const fallAuswahl = faelle.map((f) => {
    const geprueft = gutachtenSchema.safeParse(f.daten)
    const d = geprueft.success ? leseFalldaten(geprueft.data) : null
    return {
      id: f.id,
      bezeichnung: [f.aktenzeichen, d?.anspruchsteller?.name, d?.fahrzeug.kennzeichen]
        .filter(Boolean)
        .join(' · '),
    }
  })

  return (
    <>
      <div className="seiten-kopf">
        <div>
          <h1>Stellungnahmen</h1>
          <p className="unterzeile">
            {liste.length === 0
              ? 'Noch keine Stellungnahme begonnen'
              : `${liste.length} ${liste.length === 1 ? 'Stellungnahme' : 'Stellungnahmen'}`}
          </p>
        </div>
      </div>

      {!werkzeuge.ok ? (
        <div className="hinweis fehler" style={{ marginBottom: 18 }}>
          Zum Einlesen der Prüfberichte fehlen auf diesem Server: {werkzeuge.fehlend.join(', ')}.
          Sie kommen aus dem Paket <code>poppler-utils</code>.
        </div>
      ) : null}

      {!kiVerfuegbar() ? (
        <div className="hinweis warn" style={{ marginBottom: 18 }}>
          Die Auswertung der Prüfberichte braucht einen Zugang zum Sprachmodell. Hinterlege
          <code style={{ margin: '0 4px' }}>ANTHROPIC_API_KEY</code>
          in den Umgebungsvariablen.
        </div>
      ) : null}

      <BerichtFormular faelle={fallAuswahl} aktiv={kiVerfuegbar() && werkzeuge.ok} />

      {liste.length === 0 ? (
        <div className="leer">
          <p style={{ margin: 0 }}>
            Lade einen Prüfbericht hoch — die Kürzungspositionen werden daraus ausgelesen.
          </p>
        </div>
      ) : (
        <div className="liste">
          {liste.map((s) => (
            /* Der Löschknopf steht neben der Zeile, nicht in ihr: ein Knopf
               innerhalb eines Verweises ist weder gültiges HTML noch mit der
               Tastatur sauber zu bedienen. */
            <div key={s.id} className="zeile-huelle">
              <Link href={`/stellungnahmen/${s.id}`} className="zeile">
                <span className="zeile-nummer">{s.fallAktenzeichen ?? '—'}</span>
                <span>
                  <span className="zeile-titel">{s.betreff ?? 'Ohne Betreff'}</span>
                  <span className="zeile-meta">
                    <span>
                      {s.positionen} {s.positionen === 1 ? 'Position' : 'Positionen'}
                    </span>
                    {s.pruefberichtDateiname ? <span>{s.pruefberichtDateiname}</span> : null}
                    <span>{new Date(s.erstelltAm).toLocaleDateString('de-DE')}</span>
                  </span>
                </span>
                <span className="zeile-rechts">
                  <span className={`marke-pille ${s.versendetAm ? 'm-freigegeben' : 'm-entwurf'}`}>
                    {s.versendetAm ? 'versendet' : 'in Arbeit'}
                  </span>
                </span>
              </Link>
              {!s.versendetAm ? (
                <Loeschknopf stellungnahmeId={s.id} betreff={s.betreff ?? 'Ohne Betreff'} />
              ) : null}
            </div>
          ))}
        </div>
      )}
    </>
  )
}
