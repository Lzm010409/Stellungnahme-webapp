import { verlangeBenutzer } from '@/auth/sitzung'
import { erzeugeAusgabe } from '@/stellungnahme/ausgabe'
import { alsStrom } from '@/app/api/strom'

/**
 * Word- und Klartextfassung erzeugen, mit laufender Rückmeldung.
 *
 * Der Rumpf trägt die Fassung, die gerade im Editor steht — geprüft und
 * ausgegeben wird, was auf dem Schirm zu sehen ist, nicht der zuletzt
 * gespeicherte Stand.
 */
export async function POST(
  anfrage: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  await verlangeBenutzer()
  const { id } = await params

  let fassung: unknown = undefined
  try {
    const rumpf = (await anfrage.json()) as { dokument?: unknown }
    fassung = rumpf?.dokument
  } catch {
    // Ohne Rumpf wird die gespeicherte Fassung genommen.
  }

  return alsStrom(erzeugeAusgabe(id, fassung))
}
