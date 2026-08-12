import { verlangeBenutzer } from '@/auth/sitzung'
import { speichereBild } from '@/bilder/ablage'
import { Bildfehler } from '@/bilder/lesen'

/**
 * Nimmt ein Bild direkt in die Bildbibliothek auf.
 *
 * Ohne Bezug zu einer Stellungnahme: hier landet, was von vornherein zum
 * Wiederverwenden gedacht ist — die Skizze zur Verbringung, das
 * Vergleichsfoto zweier Lackierbereiche.
 */
export async function POST(anfrage: Request): Promise<Response> {
  const benutzer = await verlangeBenutzer()

  const formular = await anfrage.formData()
  const dateien = formular.getAll('bild').filter((d): d is File => d instanceof File && d.size > 0)

  if (dateien.length === 0) {
    return Response.json({ fehler: 'Keine Bilddatei erhalten.' }, { status: 400 })
  }

  const angelegt: string[] = []
  try {
    for (const datei of dateien) {
      const gespeichert = await speichereBild({
        stellungnahmeId: null,
        dateiname: datei.name,
        daten: new Uint8Array(await datei.arrayBuffer()),
        benutzerId: benutzer.id,
        inBibliothek: true,
      })
      angelegt.push(gespeichert.id)
    }
  } catch (fehler) {
    if (fehler instanceof Bildfehler) {
      return Response.json({ fehler: fehler.message, angelegt }, { status: 415 })
    }
    console.error('Bild konnte nicht gespeichert werden:', fehler)
    return Response.json({ fehler: 'Das Bild liess sich nicht speichern.' }, { status: 500 })
  }

  return Response.json({ angelegt })
}
