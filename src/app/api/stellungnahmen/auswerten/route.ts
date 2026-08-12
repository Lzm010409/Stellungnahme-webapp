import { verlangeBenutzer } from '@/auth/sitzung'
import { MAX_BYTES, werteBerichtAus } from '@/stellungnahme/auswertung'
import { alsStrom } from '@/app/api/strom'

/**
 * Prüfbericht auswerten, mit laufender Rückmeldung.
 *
 * Eine Server-Aktion kann nur einmal antworten; dieser Weg meldet jeden
 * Schritt, während er passiert. Deshalb ein Endpunkt und keine Aktion —
 * es ist der einzige Unterschied.
 */
export async function POST(anfrage: Request): Promise<Response> {
  const benutzer = await verlangeBenutzer()

  const formular = await anfrage.formData()
  const datei = formular.get('pruefbericht')

  if (!(datei instanceof File) || datei.size === 0) {
    return Response.json({ fehler: 'Bitte einen Prüfbericht als PDF auswählen.' }, { status: 400 })
  }
  if (datei.size > MAX_BYTES) {
    return Response.json(
      { fehler: `Die Datei ist grösser als ${MAX_BYTES / 1024 / 1024} MB.` },
      { status: 413 },
    )
  }

  const fallId = String(formular.get('fallId') ?? '') || null
  const pdf = Buffer.from(await datei.arrayBuffer())

  return alsStrom(
    werteBerichtAus({ pdf, dateiname: datei.name, fallId, benutzerId: benutzer.id }),
  )
}
