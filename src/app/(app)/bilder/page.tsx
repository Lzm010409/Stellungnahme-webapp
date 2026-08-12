import { alleThemen, nochNichtUebernommen, sucheBilder } from '@/bilder/bibliothek'
import { Bildkarte, Bildaufnahme } from './bildkarte'
import { Suchleiste } from './suchleiste'

/**
 * Die Bildbibliothek.
 *
 * Derselbe Gedanke wie bei den Argumenten: was einmal aufbereitet wurde,
 * bekommt Titel, Beschreibung und Themen — und ist beim nächsten Fall
 * wieder da. Der übliche Weg dorthin führt nicht über Vorratshaltung,
 * sondern über die Arbeit: unten stehen die Bilder aus Schreiben, die noch
 * nicht übernommen sind.
 */
export default async function BilderSeite({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; thema?: string }>
}) {
  const { q = '', thema = '' } = await searchParams

  const [bilder, themen, offene] = await Promise.all([
    sucheBilder(q, thema),
    alleThemen(),
    nochNichtUebernommen(),
  ])

  return (
    <>
      <div className="seiten-kopf">
        <div>
          <h1>Bildbibliothek</h1>
          <p className="unterzeile">
            {bilder.length} {bilder.length === 1 ? 'Bild' : 'Bilder'}
            {q || thema ? ' gefunden' : ' in der Bibliothek'}
            {offene.length > 0 ? ` · ${offene.length} aus Schreiben noch nicht übernommen` : ''}
          </p>
        </div>
      </div>

      <Bildaufnahme />

      <Suchleiste begriff={q} thema={thema} themen={themen} />

      {bilder.length === 0 ? (
        <div className="leer">
          <p style={{ margin: 0 }}>
            {q || thema
              ? 'Kein Bild passt zu dieser Suche.'
              : 'Noch kein Bild in der Bibliothek. Lade eines hoch oder übernimm eines aus einem Schreiben.'}
          </p>
        </div>
      ) : (
        <div className="bildgitter">
          {bilder.map((b) => (
            <Bildkarte key={b.id} bild={b} />
          ))}
        </div>
      )}

      {offene.length > 0 ? (
        <section style={{ marginTop: 32 }}>
          <h2>Aus Schreiben — noch nicht übernommen</h2>
          <p className="unterzeile" style={{ margin: '0 0 14px' }}>
            Diese Bilder wurden in einer Stellungnahme hochgeladen. Was sich wiederverwenden
            lässt, gehört in die Bibliothek — mit Beschreibung findet es sich beim nächsten Fall
            von selbst wieder.
          </p>
          <div className="bildgitter">
            {offene.map((b) => (
              <Bildkarte key={b.id} bild={b} />
            ))}
          </div>
        </section>
      ) : null}
    </>
  )
}
