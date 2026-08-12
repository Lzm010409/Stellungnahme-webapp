import { verlangeBenutzer } from '@/auth/sitzung'
import { ladeBild } from '@/bilder/ablage'

/**
 * Liefert ein Bild aus.
 *
 * Nur angemeldet: in den Bildern stecken Kennzeichen, Schadennummern und
 * Kalkulationsauszüge. Zwischengespeichert wird trotzdem lange — ein Bild
 * ändert sich nie, es wird nur ersetzt, und das unter neuer Kennung.
 */
export async function GET(
  _anfrage: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  await verlangeBenutzer()
  const { id } = await params

  const gefunden = await ladeBild(id)
  if (!gefunden) return new Response('Nicht gefunden', { status: 404 })

  return new Response(gefunden.daten as unknown as BodyInit, {
    headers: {
      'Content-Type': gefunden.mimetyp,
      'Content-Length': String(gefunden.daten.byteLength),
      'Cache-Control': 'private, max-age=31536000, immutable',
      'Content-Disposition': `inline; filename="${encodeURIComponent(gefunden.dateiname)}"`,
    },
  })
}
