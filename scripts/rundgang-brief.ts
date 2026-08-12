/**
 * Führt einen echten Browser durch den Schreibtisch.
 *
 *   pnpm exec tsx scripts/rundgang-brief.ts [basisUrl] [zielordner]
 *
 * Geprüft wird der Weg, den der Sachverständige tatsächlich geht: Brief
 * öffnen, eine Anmerkung am Rand aufklappen, einen Baustein bearbeiten und
 * einfügen, im Brief weiterschreiben, speichern lassen.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { chromium, type Page } from 'playwright'

/**
 * Ein winziges, gültiges PDF mit zwei Textseiten.
 *
 * Genug, damit der Weg „hochladen → einlesen → auswerten" wirklich
 * beschritten wird und der Fortschritt Seite für Seite meldet.
 */
function baueMiniPdf(): string {
  const seite = (nummer: number, inhalt: number) =>
    `${nummer} 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] ` +
    `/Resources << /Font << /F1 9 0 R >> >> /Contents ${inhalt} 0 R >>endobj\n`

  const text = (nummer: number, was: string) => {
    const zeilen = Array.from(
      { length: 6 },
      (_, i) => `BT /F1 12 Tf 72 ${760 - i * 20} Td (${was} Zeile ${i + 1}) Tj ET`,
    )
    const strom = zeilen.join('\n') + '\n'
    return `${nummer} 0 obj<< /Length ${strom.length} >>stream\n${strom}endstream\nendobj\n`
  }

  return (
    '%PDF-1.4\n' +
    '1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n' +
    '2 0 obj<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>endobj\n' +
    seite(3, 5) +
    seite(4, 6) +
    text(5, 'Kuerzungsbericht Musterseite eins mit Fliesstext') +
    text(6, 'Kuerzungsbericht Musterseite zwei mit Fliesstext') +
    '9 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\n' +
    'trailer<< /Root 1 0 R /Size 10 >>\n%%EOF\n'
  )
}

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

  // Auswertung anstossen und den Fortschritt beobachten. Ohne Zugang zum
  // Sprachmodell ist der Knopf gesperrt — dann bleibt dieser Schritt aus.
  const auswerten = seite.locator('button:has-text("Prüfbericht auswerten")')
  if (await auswerten.isEnabled()) {
    const pdfPfad = join(ZIEL, 'mini.pdf')
    writeFileSync(pdfPfad, baueMiniPdf(), 'latin1')
    await seite.setInputFiles('input[type=file]', pdfPfad)
    const wartetAufAuswertung = seite
      .waitForSelector('[role=progressbar]', { timeout: 8000 })
      .catch(() => null)
    await auswerten.click()
    if (await wartetAufAuswertung) {
      console.log(`  Auswertung meldet: ${await seite.locator('.fortschritt-text').innerText()}`)
      await schritt('0-auswertung')
      // Etwas später steht der Verlauf der gelesenen Seiten im Balken.
      await seite.waitForTimeout(900)
      if (await seite.locator('[role=progressbar]').count()) {
        console.log(`  Weiter: ${await seite.locator('.fortschritt-text').innerText()}`)
        console.log(
          `  Verlauf: ${(await seite.locator('.fortschritt-verlauf li').allInnerTexts()).join(' | ')}`,
        )
        await schritt('0b-auswertung-verlauf')
      }
    } else {
      console.log('  Kein Fortschrittsbalken bei der Auswertung erschienen.')
    }
    await seite.waitForTimeout(3000)
    const ausgang = await seite.locator('.hinweis').first().innerText().catch(() => '—')
    console.log(`  Ausgang der Auswertung: ${ausgang.slice(0, 90)}`)
  } else {
    console.log('  Auswertung gesperrt (kein Zugang zum Sprachmodell) — Schritt ausgelassen.')
  }

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

  // Einen Baustein in den Brief ziehen.
  const vorher_gezogen = await seite.locator('.brief-flaeche .d-quelle').count()
  const griff = seite.locator('.blase.auf .blase-vorschlag-kopf.ziehbar').first()
  const ziel = seite.locator('.brief-flaeche .d-abschnitt').first().locator('p').first()
  if ((await griff.count()) && (await ziel.count())) {
    await griff.dragTo(ziel)
    await seite.waitForTimeout(1600)
    const nachher = await seite.locator('.brief-flaeche .d-quelle').count()
    console.log(`  Markierte Stellen vor dem Ziehen ${vorher_gezogen}, danach ${nachher}`)
    await schritt('6-gezogen')
  }

  // Erscheinungsbild umschalten.
  await seite.locator('.erscheinung').click()
  await seite.waitForTimeout(200)
  const nachEinmal = await seite.evaluate(() => document.documentElement.dataset.theme ?? 'system')
  await seite.locator('.erscheinung').click()
  await seite.waitForTimeout(200)
  const nachZweimal = await seite.evaluate(() => document.documentElement.dataset.theme ?? 'system')
  console.log(`  Erscheinungsbild: ${nachEinmal} → ${nachZweimal}`)
  await schritt('7-erscheinung')
  await seite.locator('.erscheinung').click()

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
  await schritt('8-wieder-aufgenommen')

  // Prüfen und ausgeben.
  // Der Balken kann bei einem kleinen Schreiben schnell wieder weg sein —
  // deshalb wird auf ihn gewartet, bevor der Knopf gedrückt wird.
  const wartetAufBalken = seite
    .waitForSelector('[role=progressbar]', { timeout: 8000 })
    .catch(() => null)
  await seite.locator('button:has-text("Dokument erzeugen")').click()
  const balken = await wartetAufBalken
  console.log(`  Fortschrittsbalken beim Erzeugen erschienen: ${Boolean(balken)}`)
  if (balken) {
    console.log(`  Erste Meldung: ${await seite.locator('.fortschritt-text').innerText()}`)
    await schritt('9-fortschritt')
  }
  await seite.waitForSelector('.ausgabe-leiste', { timeout: 30000 })
  await schritt('9b-ausgabe')

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
  await seite2.screenshot({ path: `${ZIEL}/10-schreibtisch-dunkel.png`, fullPage: true })
  console.log(`  10-schreibtisch-dunkel   ${seite2.url()}`)

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
