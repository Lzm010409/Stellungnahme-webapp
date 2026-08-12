/**
 * Führt einen echten Browser durch den Schreibtisch.
 *
 *   pnpm exec tsx scripts/rundgang-brief.ts [basisUrl] [zielordner]
 *
 * Geprüft wird der Weg, den der Sachverständige tatsächlich geht: Brief
 * öffnen, eine Anmerkung am Rand aufklappen, einen Baustein bearbeiten und
 * einfügen, im Brief weiterschreiben, speichern lassen.
 */
import { mkdirSync } from 'node:fs'
import { chromium, type Page } from 'playwright'

const BASIS = process.argv[2] ?? 'http://localhost:3000'
const ZIEL = process.argv[3] ?? '/tmp/rundgang-brief'
const EMAIL = process.env.RUNDGANG_EMAIL ?? 'lgollenstede@gollenstede-sachverstand.de'
const PASSWORT = process.env.RUNDGANG_PASSWORT ?? 'TestNurLokal!2026'

async function anmelden(seite: Page) {
  await seite.goto(`${BASIS}/anmelden`, { waitUntil: 'networkidle' })
  await seite.fill('#email', EMAIL)
  await seite.fill('#passwort', PASSWORT)
  await Promise.all([
    seite.waitForURL('**/bibliothek', { timeout: 20000 }),
    seite.locator('form button[type=submit]').click(),
  ])
}

async function main() {
  mkdirSync(ZIEL, { recursive: true })

  const browser = await chromium.launch({
    executablePath:
      process.env.CHROMIUM_PFAD ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  })
  const kontext = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    locale: 'de-DE',
  })
  const seite = await kontext.newPage()

  const fehler: string[] = []
  seite.on('console', (m) => {
    if (m.type() === 'error') fehler.push(m.text())
  })
  seite.on('pageerror', (f) => fehler.push(String(f)))

  const schritt = async (name: string) => {
    await seite.screenshot({ path: `${ZIEL}/${name}.png`, fullPage: true })
    console.log(`  ${name.padEnd(24)} ${seite.url()}`)
  }

  await anmelden(seite)
  await seite.goto(`${BASIS}/stellungnahmen`, { waitUntil: 'networkidle' })
  await seite.locator('.zeile').first().click()
  await seite.waitForSelector('.brief-flaeche', { timeout: 20000 })
  await seite.waitForTimeout(600)
  await schritt('1-schreibtisch')

  const abschnitte = await seite.locator('.d-abschnitt').count()
  const blasen = await seite.locator('.blase').count()
  console.log(`  Abschnitte im Brief: ${abschnitte}, Anmerkungen am Rand: ${blasen}`)

  // Erste Anmerkung aufklappen.
  await seite.locator('.blase.zu').first().click()
  await seite.waitForTimeout(400)
  await schritt('2-anmerkung-offen')

  // Einen Vorschlag öffnen und bearbeiten.
  const vorschlag = seite.locator('.blase.auf .blase-vorschlag-kopf').first()
  if (await vorschlag.count()) {
    await vorschlag.click()
    await seite.waitForTimeout(300)
    const feld = seite.locator('.blase-entwurf textarea').first()
    await feld.click()
    await feld.press('End')
    await feld.type(' Ergänzung aus dem Rundgang.')
    await schritt('3-baustein-bearbeitet')

    await seite.locator('.blase-entwurf button.haupt').first().click()
    await seite.waitForTimeout(1600)
    await schritt('4-eingefuegt')

    const quellen = await seite.locator('.brief-flaeche .d-quelle').count()
    console.log(`  Markierte Textstellen im Brief: ${quellen}`)
  } else {
    console.log('  Zu dieser Position gibt es keinen Vorschlag — übersprungen.')
  }

  // Im Brief selbst weiterschreiben.
  const ersterAbsatz = seite.locator('.brief-flaeche .d-abschnitt p').first()
  if (await ersterAbsatz.count()) {
    await ersterAbsatz.click()
    await seite.keyboard.press('End')
    await seite.keyboard.type(' Im Brief selbst weitergeschrieben.')
    await seite.waitForTimeout(1800)
  }

  const stand = await seite.locator('.speicherstand').innerText()
  console.log(`  Speicherstand nach dem Tippen: ${stand}`)
  await schritt('5-im-brief-geschrieben')

  // Eine Position herausnehmen und wieder aufnehmen — die Nummerierung muss
  // nachrücken und der Abschnitt an seine Stelle zurückkehren.
  const ueberschriften = () =>
    seite.locator('.brief-flaeche .d-ueberschrift').allInnerTexts()

  const vorher = await ueberschriften()
  await seite.locator('.blase.auf button:has-text("Nicht bestreiten")').click()
  await seite.waitForTimeout(1400)
  const ohne = await ueberschriften()
  console.log(`  Abschnitte vorher ${vorher.length}, nach dem Herausnehmen ${ohne.length}`)

  await seite.locator('.blase.zu, .blase.auf').first().click()
  await seite.locator('.blase.auf button:has-text("Doch bestreiten")').click()
  await seite.waitForTimeout(1400)
  const wieder = await ueberschriften()
  console.log(`  Nach dem Wiederaufnehmen ${wieder.length}`)
  console.log(`  Reihenfolge gleich wie zuvor: ${JSON.stringify(wieder) === JSON.stringify(vorher)}`)
  await schritt('6-wieder-aufgenommen')

  // Prüfen und ausgeben.
  await seite.locator('button:has-text("Dokument erzeugen")').click()
  await seite.waitForTimeout(2500)
  await schritt('7-ausgabe')

  await kontext.close()

  const dunkel = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    locale: 'de-DE',
    colorScheme: 'dark',
  })
  const seite2 = await dunkel.newPage()
  await anmelden(seite2)
  await seite2.goto(`${BASIS}/stellungnahmen`, { waitUntil: 'networkidle' })
  await seite2.locator('.zeile').first().click()
  await seite2.waitForSelector('.brief-flaeche', { timeout: 20000 })
  await seite2.waitForTimeout(600)
  await seite2.screenshot({ path: `${ZIEL}/8-schreibtisch-dunkel.png`, fullPage: true })
  console.log(`  8-schreibtisch-dunkel    ${seite2.url()}`)

  await browser.close()

  if (fehler.length > 0) {
    console.log(`\n  Konsolenfehler (${fehler.length}):`)
    for (const f of fehler.slice(0, 10)) console.log(`    ${f}`)
    process.exit(1)
  }
  console.log('\n  Keine Konsolenfehler.')
}

main().catch((f) => {
  console.error(f)
  process.exit(1)
})
