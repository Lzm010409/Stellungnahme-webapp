import { redirect } from 'next/navigation'
import Link from 'next/link'
import { aktuellerBenutzer } from '@/auth/sitzung'
import { meldeAb } from '@/auth/aktionen'

const ROLLENNAMEN: Record<string, string> = {
  ersteller: 'Ersteller',
  freigeber: 'Freigeber',
  admin: 'Administration',
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const benutzer = await aktuellerBenutzer()
  if (!benutzer) redirect('/anmelden')

  return (
    <>
      <header className="kopf">
        <div className="kopf-innen">
          <Link href="/bibliothek" className="marke">
            Werkbank
          </Link>
          <nav className="kopf-nav">
            <Link href="/stellungnahmen">Stellungnahmen</Link>
            <Link href="/faelle">Fälle</Link>
            <Link href="/bibliothek">Argumentbibliothek</Link>
          </nav>
          <div className="kopf-benutzer">
            <span>
              {benutzer.name} · {ROLLENNAMEN[benutzer.rolle] ?? benutzer.rolle}
            </span>
            <form action={meldeAb}>
              <button type="submit" style={{ padding: '4px 10px', fontSize: 13 }}>
                Abmelden
              </button>
            </form>
          </div>
        </div>
      </header>
      <main>{children}</main>
    </>
  )
}
