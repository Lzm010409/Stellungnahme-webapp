/**
 * Erzeugt beim Container-Bau eine Startbefüllung der Argumentbibliothek.
 *
 *   pnpm exec tsx scripts/bibliothek-seed-erzeugen.ts [ziel.json]
 *
 * Der Parser läuft dabei einmalig gegen die Referenzdateien; zur Laufzeit
 * liest der Startvorgang nur noch das Ergebnis. So braucht das
 * Laufzeit-Abbild weder TypeScript-Werkzeuge noch den Parser selbst.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { erstelleAbgleichbericht, formatiereBericht, leseAlleEintraege } from '../src/bibliothek/migration'

const ZIEL = process.argv[2] ?? 'seed/bibliothek.json'

const eintraege = leseAlleEintraege()
const bericht = erstelleAbgleichbericht(eintraege)

mkdirSync(dirname(ZIEL), { recursive: true })
writeFileSync(ZIEL, JSON.stringify({ erzeugtAus: 'skills/', eintraege }, null, 0), 'utf8')

console.log(formatiereBericht(bericht))
console.log(`  Startbefüllung geschrieben: ${ZIEL} (${eintraege.length} Einträge)\n`)
