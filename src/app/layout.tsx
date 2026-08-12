import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Kürzungsabwehr-Werkbank',
  description:
    'Stellungnahmen gegen Kürzungsschreiben und Prüfberichte von Kfz-Versicherern.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  )
}
