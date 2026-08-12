'use client'

import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useFormStatus } from 'react-dom'
import { werteBerichtAus, type AktionsErgebnis } from '@/stellungnahme/aktionen'

function Absenden({ aktiv }: { aktiv: boolean }) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" className="haupt" disabled={pending || !aktiv}>
      {pending ? 'Wird ausgewertet …' : 'Prüfbericht auswerten'}
    </button>
  )
}

export function BerichtFormular({
  faelle,
  aktiv,
}: {
  faelle: { id: string; bezeichnung: string }[]
  aktiv: boolean
}) {
  const router = useRouter()
  const [zustand, aktion] = useActionState<AktionsErgebnis, FormData>(werteBerichtAus, {})

  useEffect(() => {
    if (zustand.stellungnahmeId) router.push(`/stellungnahmen/${zustand.stellungnahmeId}`)
  }, [zustand.stellungnahmeId, router])

  return (
    <>
      <form action={aktion} className="werkzeugleiste" style={{ marginBottom: 12 }}>
        <input
          type="file"
          name="pruefbericht"
          accept="application/pdf,.pdf"
          required
          disabled={!aktiv}
          aria-label="Prüfbericht als PDF"
          style={{ flex: 1, minWidth: 240, fontSize: 13.5 }}
        />
        <select name="fallId" disabled={!aktiv} aria-label="Fall zuordnen">
          <option value="">Ohne Fallzuordnung</option>
          {faelle.map((f) => (
            <option key={f.id} value={f.id}>
              {f.bezeichnung}
            </option>
          ))}
        </select>
        <Absenden aktiv={aktiv} />
        <span className="treffer-zahl">Gescannte Seiten werden mitgelesen</span>
      </form>

      {zustand.fehler ? (
        <div className="hinweis fehler" style={{ marginBottom: 18 }} role="alert">
          {zustand.fehler}
        </div>
      ) : null}
      {zustand.hinweis ? (
        <div className="hinweis" style={{ marginBottom: 18 }} role="status">
          {zustand.hinweis}
        </div>
      ) : null}
    </>
  )
}
