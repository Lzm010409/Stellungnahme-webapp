'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useTransition } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import { briefErweiterungen } from '@/dokument/editor-schema'
import {
  abschnittsReihenfolge,
  abschnittsText,
  aktiverAbschnitt,
  dokumentJson,
  ankerHoehe,
  ersetzeAbschnittsInhalt,
  ersteHerkunft,
  fuegeAbschnittEin,
  fuegeAnStelleEin,
  fuegeBlockEin,
  fuegeInAbschnittEin,
  setzeAusgelassen,
  springeInAbschnitt,
  zeigeFundstelle,
} from '@/dokument/editor-hilfen'
import {
  BILD_BREITE_STANDARD,
  absaetzeAusText,
  bildknoten,
  herkunftsmarke,
  type Herkunftsmarke,
} from '@/dokument/typen'
import { MIME_BAUSTEIN, leseZiehgut } from '@/dokument/ziehen'
import { Fortschritt, Kreisel, type Fortschrittsstand } from '@/app/teile/anzeigen'
import { leseEreignisse } from '@/app/teile/strom'
import type { Ausgabeereignis } from '@/stellungnahme/ausgabe'
import {
  formuliereAbschnitt,
  pruefeDokument,
  setzeBehandlung,
  speichereDokument,
  uebernehmeAbschnittInBibliothek,
} from '@/stellungnahme/editor-aktionen'
import { markiereVersendet } from '@/stellungnahme/export-aktionen'
import type { Pruefergebnis } from '@/export/waechter'
import type { Befund } from '@/export/waechter'
import { Blase, type PositionAnzeige, type Vorschlag } from './blase'

/**
 * Der Schreibtisch: links der Brief, rechts die Anmerkungen.
 *
 * Der Brief ist die Hauptbearbeitungsfläche — alles, was am Rand passiert,
 * schreibt nur hinein. Die Bausteine sind eine Auswahlmethode, kein zweiter
 * Ort, an dem das Schreiben entsteht.
 */

const SPEICHERRUHE = 900

type Speicherzustand = 'ruht' | 'geaendert' | 'speichert' | 'konflikt' | 'fehler'

interface FertigeAusgabe {
  klartext: string
  docxBase64: string
  docxName: string
  txtName: string
}

const ZUSTANDSTEXT: Record<Speicherzustand, string> = {
  ruht: 'gespeichert',
  geaendert: 'ungespeicherte Änderung',
  speichert: 'speichert …',
  konflikt: 'Konflikt',
  fehler: 'nicht gespeichert',
}

export function Schreibtisch({
  stellungnahmeId,
  dokument,
  stand: anfangsStand,
  positionen,
  vorschlaege,
  werte,
  kiAktiv,
  versendet,
}: {
  stellungnahmeId: string
  dokument: unknown
  stand: number
  positionen: PositionAnzeige[]
  vorschlaege: Vorschlag[]
  werte: Record<string, string>
  kiAktiv: boolean
  versendet: boolean
}) {
  const [zustand, setzeZustand] = useState<Speicherzustand>('ruht')
  const [aktiv, setzeAktiv] = useState<string | null>(null)
  const [takt, setzeTakt] = useState(0)
  const [befunde, setzeBefunde] = useState<Befund[]>([])
  const [pruefung, setzePruefung] = useState<Pruefergebnis | null>(null)
  const [ausgabe, setzeAusgabe] = useState<FertigeAusgabe | null>(null)
  const [ausgabestand, setzeAusgabestand] = useState<Fortschrittsstand | null>(null)
  const [meldung, setzeMeldung] = useState<string | null>(null)
  const [bildLaeuft, setzeBildLaeuft] = useState(0)
  const [laeuft, starte] = useTransition()

  const standRef = useRef(anfangsStand)
  const uhr = useRef<ReturnType<typeof setTimeout> | null>(null)
  const briefRef = useRef<HTMLDivElement | null>(null)
  const randRef = useRef<HTMLDivElement | null>(null)
  const blasenRef = useRef(new Map<string, HTMLDivElement | null>())
  const dateiwahl = useRef<HTMLInputElement | null>(null)

  const editorRef = useRef<ReturnType<typeof useEditor> | null>(null)

  // Die Editor-Einstellungen entstehen einmal; das Ablegen der Bilder
  // braucht aber den jeweils aktuellen Stand. Deshalb der Umweg über eine
  // Verweiszelle statt der Funktion selbst.
  const bilderRef = useRef<
    (dateien: FileList | File[], koordinaten?: { left: number; top: number }) => void
  >(() => {})

  const editor = useEditor({
    extensions: briefErweiterungen(),
    content: dokument as never,
    immediatelyRender: false,
    editorProps: {
      attributes: { class: 'brief-flaeche', spellcheck: 'true' },

      /**
       * Ein fallen gelassener Baustein landet hinter dem Absatz, über dem
       * losgelassen wurde — und nur innerhalb eines Positionsabschnitts.
       * Der Rückgabewert `true` hält ProseMirror davon ab, zusätzlich noch
       * den mitgereichten Klartext einzusetzen.
       */
      handleDrop: (_sicht, ereignis) => {
        const uebergabe = (ereignis as DragEvent).dataTransfer

        // Bilddateien zuerst: sie dürfen überall hin, auch ausserhalb der
        // Positionsabschnitte.
        const bilddateien = Array.from(uebergabe?.files ?? []).filter((d) =>
          d.type.startsWith('image/'),
        )
        if (bilddateien.length > 0) {
          ereignis.preventDefault()
          bilderRef.current(bilddateien, {
            left: (ereignis as DragEvent).clientX,
            top: (ereignis as DragEvent).clientY,
          })
          return true
        }

        const daten = uebergabe?.getData(MIME_BAUSTEIN)
        if (!daten) return false
        ereignis.preventDefault()

        const gut = leseZiehgut(daten)
        const griff = editorRef.current
        if (!gut || !griff) return true

        const treffer = fuegeAnStelleEin(
          griff,
          { left: (ereignis as DragEvent).clientX, top: (ereignis as DragEvent).clientY },
          absaetzeAusText(gut.text, [herkunftsmarke(gut.marke)]) as never,
        )
        if (!treffer) {
          setzeMeldung(
            'Ein Baustein gehört in einen Positionsabschnitt — nicht in Betreff, Ergebnis oder Signatur.',
          )
        }
        return true
      },

      /**
       * Eingefügte Bilder aus der Zwischenablage.
       *
       * Der Regelfall: ein Ausschnitt aus dem Kalkulationsprogramm liegt in
       * der Zwischenablage und soll an die Stelle, an der die Schreibmarke
       * steht. Dafür soll niemand erst eine Datei speichern müssen.
       */
      handlePaste: (_sicht, ereignis) => {
        const dateien = Array.from(ereignis.clipboardData?.files ?? []).filter((d) =>
          d.type.startsWith('image/'),
        )
        if (dateien.length === 0) return false
        ereignis.preventDefault()
        bilderRef.current(dateien)
        return true
      },
    },
    onUpdate: () => {
      setzeTakt((t) => t + 1)
      setzeZustand('geaendert')
      planeSpeichern()
    },
    onSelectionUpdate: ({ editor }) => setzeAktiv(aktiverAbschnitt(editor)),
  })

  editorRef.current = editor

  /* ---------------- Speichern ---------------- */

  const speichereJetzt = useCallback(async () => {
    if (!editor) return
    setzeZustand('speichert')
    const fassung = dokumentJson(editor)
    const e = await speichereDokument(stellungnahmeId, fassung, standRef.current)

    if ('stand' in e) {
      standRef.current = e.stand
      setzeZustand('ruht')
      // Die Prüfung läuft mit jedem gespeicherten Stand — die Wächter sind
      // damit Anmerkungen im Text und nicht erst eine Hürde vor dem Export.
      const ergebnis = await pruefeDokument(stellungnahmeId, fassung)
      setzeBefunde(ergebnis.befunde)
      setzePruefung(ergebnis)
      return
    }

    setzeZustand('konflikt' in e ? 'konflikt' : 'fehler')
    setzeMeldung(e.fehler)
  }, [editor, stellungnahmeId])

  const planeSpeichern = useCallback(() => {
    if (uhr.current) clearTimeout(uhr.current)
    uhr.current = setTimeout(() => void speichereJetzt(), SPEICHERRUHE)
  }, [speichereJetzt])

  // Beim Verlassen der Seite warnen, solange etwas aussteht.
  useEffect(() => {
    const warnen = (e: BeforeUnloadEvent) => {
      if (zustand === 'geaendert' || zustand === 'speichert') e.preventDefault()
    }
    window.addEventListener('beforeunload', warnen)
    return () => window.removeEventListener('beforeunload', warnen)
  }, [zustand])

  useEffect(() => () => void (uhr.current && clearTimeout(uhr.current)), [])

  /* ---------------- Randspalte ausrichten ---------------- */

  /**
   * Rückt jede Blase auf die Höhe ihres Abschnitts.
   *
   * Nacheinander, mit einer Untergrenze: die zweite Blase startet nie über
   * dem Ende der ersten. Ohne diesen Durchlauf lägen die Blasen kurzer
   * Abschnitte übereinander.
   */
  useLayoutEffect(() => {
    const brief = briefRef.current
    if (!brief) return

    let untergrenze = 0
    for (const p of positionen) {
      const el = blasenRef.current.get(p.id)
      if (!el) continue
      el.style.marginTop = '0px'
      const anker = ankerHoehe(brief, p.id)
      const ist = el.offsetTop
      const ziel = Math.max(anker ?? untergrenze, untergrenze)
      if (ziel > ist) el.style.marginTop = `${ziel - ist}px`
      untergrenze = el.offsetTop + el.offsetHeight + 10
    }
  })

  // Ein Umbruch im Brief verschiebt alle Anker — neu ausrichten.
  useEffect(() => {
    const brief = briefRef.current
    if (!brief || typeof ResizeObserver === 'undefined') return
    const beobachter = new ResizeObserver(() => setzeTakt((t) => t + 1))
    beobachter.observe(brief)
    return () => beobachter.disconnect()
  }, [])

  /* ---------------- Bilder ---------------- */

  /**
   * Lädt eine Bilddatei hoch und setzt sie an die gewünschte Stelle.
   *
   * Die Bytes gehen sofort auf den Server; im Dokument steht danach nur die
   * Kennung. Ein Bild als Datenstrom im Baum würde jede der Speicherungen im
   * Sekundentakt um Megabytes aufblähen.
   */
  const legeBildAb = useCallback(
    async (datei: File, koordinaten?: { left: number; top: number }) => {
      const griff = editorRef.current
      if (!griff) return

      setzeBildLaeuft((n) => n + 1)
      try {
        const formular = new FormData()
        formular.append('bild', datei)
        const antwort = await fetch(`/api/stellungnahmen/${stellungnahmeId}/bilder`, {
          method: 'POST',
          body: formular,
        })
        const ergebnis = (await antwort.json()) as {
          id?: string
          dateiname?: string
          breitePx?: number
          hoehePx?: number
          fehler?: string
        }

        if (!antwort.ok || !ergebnis.id) {
          setzeMeldung(ergebnis.fehler ?? 'Das Bild liess sich nicht hochladen.')
          return
        }

        fuegeBlockEin(
          griff,
          bildknoten({
            bildId: ergebnis.id,
            breite: BILD_BREITE_STANDARD,
            breitePx: ergebnis.breitePx ?? 1000,
            hoehePx: ergebnis.hoehePx ?? 750,
            dateiname: ergebnis.dateiname ?? datei.name,
          }),
          koordinaten,
        )
      } catch {
        setzeMeldung('Das Bild liess sich nicht hochladen — die Verbindung ist abgerissen.')
      } finally {
        setzeBildLaeuft((n) => n - 1)
      }
    },
    [stellungnahmeId],
  )

  const legeBilderAb = useCallback(
    (dateien: FileList | File[], koordinaten?: { left: number; top: number }) => {
      for (const datei of Array.from(dateien)) {
        if (!datei.type.startsWith('image/')) continue
        void legeBildAb(datei, koordinaten)
      }
    },
    [legeBildAb],
  )

  bilderRef.current = legeBilderAb

  /* ---------------- Griffe am Brief ---------------- */

  const einfuegen = (positionId: string, text: string, marke: Herkunftsmarke) => {
    if (!editor || !text.trim()) return
    fuegeInAbschnittEin(
      editor,
      positionId,
      absaetzeAusText(text, [herkunftsmarke(marke)]) as never,
    )
  }

  const ausformulieren = (positionId: string) =>
    starte(async () => {
      if (!editor) return
      const text = abschnittsText(editor, positionId)
      const e = await formuliereAbschnitt(stellungnahmeId, positionId, text)
      if (e.fehler || !e.text) {
        setzeMeldung(e.fehler ?? 'Das Ausformulieren hat nichts geliefert.')
        return
      }
      const herkunft = ersteHerkunft(editor, positionId)
      ersetzeAbschnittsInhalt(
        editor,
        positionId,
        absaetzeAusText(e.text, [
          herkunftsmarke({
            eintragId: herkunft?.eintragId ?? null,
            nummer: herkunft?.nummer ?? null,
            titel: herkunft?.titel ?? null,
            herkunft: 'formuliert',
          }),
        ]) as never,
      )
      setzeMeldung('Abschnitt ausformuliert. Rückgängig mit Strg+Z.')
    })

  const herausnehmen = (positionId: string) =>
    starte(async () => {
      if (!editor) return
      setzeAusgelassen(editor, positionId, true)
      await setzeBehandlung(positionId, 'nicht_bestreiten')
    })

  const aufnehmen = (positionId: string, bezeichnung: string) =>
    starte(async () => {
      if (!editor) return
      // Der Abschnitt steht in aller Regel noch da und wird nur wieder
      // aufgenommen. Nur wenn er wirklich fehlt — etwa in einem alten
      // Dokument — entsteht er neu, an seiner Stelle in der Reihenfolge.
      if (!setzeAusgelassen(editor, positionId, false)) {
        fuegeAbschnittEin(
          editor,
          positionId,
          bezeichnung,
          positionen.map((p) => p.id),
        )
      }
      await setzeBehandlung(positionId, 'bestritten')
    })

  const inBibliothek = (positionId: string) =>
    starte(async () => {
      if (!editor) return
      const e = await uebernehmeAbschnittInBibliothek(
        stellungnahmeId,
        positionId,
        dokumentJson(editor),
      )
      setzeMeldung(e.fehler ?? e.hinweis ?? null)
    })

  const springeZu = (b: Befund) => {
    if (!editor || !b.fundstelle) return
    if (!zeigeFundstelle(editor, b.positionId, b.fundstelle)) {
      setzeMeldung('Diese Stelle steht so nicht mehr im Brief.')
    }
  }

  /* ---------------- Ausgabe ---------------- */

  /**
   * Erzeugt Word- und Klartextfassung und meldet dabei jeden Schritt.
   *
   * Geprüft und ausgegeben wird die Fassung, die gerade im Editor steht —
   * nicht der zuletzt gespeicherte Stand.
   */
  const erzeugeDokument = async () => {
    if (!editor) return

    setzeAusgabe(null)
    setzeMeldung(null)
    const verlauf: string[] = []
    setzeAusgabestand({ anteil: 0.03, text: 'Das Schreiben wird übergeben …', verlauf })

    let antwort: Response
    try {
      antwort = await fetch(`/api/stellungnahmen/${stellungnahmeId}/ausgabe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dokument: dokumentJson(editor) }),
      })
    } catch {
      setzeAusgabestand(null)
      setzeMeldung('Die Verbindung ist abgerissen.')
      return
    }

    for await (const ereignis of leseEreignisse<Ausgabeereignis>(antwort)) {
      if (ereignis.art === 'fortschritt') {
        verlauf.push(ereignis.text)
        setzeAusgabestand({ anteil: ereignis.anteil, text: ereignis.text, verlauf: verlauf.slice(-3) })
        continue
      }

      if (ereignis.art === 'fehler') {
        setzeAusgabestand(null)
        setzeMeldung(ereignis.fehler)
        if (ereignis.befunde) {
          setzeBefunde(ereignis.befunde)
          setzePruefung({
            befunde: ereignis.befunde,
            gesperrt: true,
            zusammenfassung: {
              sperrt: ereignis.befunde.filter((b) => b.schwere === 'sperrt').length,
              warnt: ereignis.befunde.filter((b) => b.schwere !== 'sperrt').length,
            },
          })
        }
        return
      }

      setzeAusgabestand(null)
      setzeAusgabe({
        klartext: ereignis.klartext,
        docxBase64: ereignis.docxBase64,
        docxName: ereignis.docxName,
        txtName: ereignis.txtName,
      })
      setzeBefunde(ereignis.befunde)
      return
    }

    setzeAusgabestand(null)
    setzeMeldung('Der Vorgang ist unterwegs abgebrochen.')
  }

  const lade = (name: string, inhalt: BlobPart, typ: string) => {
    const url = URL.createObjectURL(new Blob([inhalt], { type: typ }))
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.click()
    URL.revokeObjectURL(url)
  }

  const ladeDocx = () => {
    if (!ausgabe?.docxBase64 || !ausgabe.docxName) return
    const roh = atob(ausgabe.docxBase64)
    const bytes = new Uint8Array(roh.length)
    for (let i = 0; i < roh.length; i++) bytes[i] = roh.charCodeAt(i)
    lade(
      ausgabe.docxName,
      bytes,
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    )
  }

  /* ---------------- Anzeige ---------------- */

  const reihenfolge = editor ? abschnittsReihenfolge(editor) : []
  void takt // die Anzeige hängt am Takt: jede Änderung im Brief rechnet neu
  const nummerJePosition = new Map<string, number>()
  let laufend = 0
  for (const a of reihenfolge) {
    if (a.hatText && !a.ausgelassen) nummerJePosition.set(a.positionId, ++laufend)
  }
  const imBrief = new Set(reihenfolge.filter((a) => !a.ausgelassen).map((a) => a.positionId))
  const mitText = new Set(
    reihenfolge.filter((a) => a.hatText && !a.ausgelassen).map((a) => a.positionId),
  )

  const befundeJePosition = new Map<string, Befund[]>()
  for (const b of befunde) {
    const schluessel = b.positionId ?? '—'
    befundeJePosition.set(schluessel, [...(befundeJePosition.get(schluessel) ?? []), b])
  }

  return (
    <div className="werkbank">
      <div className="werkbank-leiste">
        <div className="werkzeuge">
          <button
            type="button"
            title="Fett"
            className={editor?.isActive('bold') ? 'an' : ''}
            onClick={() => editor?.chain().focus().toggleBold().run()}
          >
            <strong>F</strong>
          </button>
          <button
            type="button"
            title="Kursiv"
            className={editor?.isActive('italic') ? 'an' : ''}
            onClick={() => editor?.chain().focus().toggleItalic().run()}
          >
            <em>K</em>
          </button>
          <button
            type="button"
            title="Aufzählung"
            className={editor?.isActive('bulletList') ? 'an' : ''}
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
          >
            ▪ Liste
          </button>
          <button
            type="button"
            title="Bild an der Schreibmarke einfügen — geht auch mit Einfügen aus der Zwischenablage oder durch Ziehen"
            onClick={() => dateiwahl.current?.click()}
          >
            {bildLaeuft > 0 ? <Kreisel text="Bild …" /> : '▣ Bild'}
          </button>
          <input
            ref={dateiwahl}
            type="file"
            accept="image/png,image/jpeg"
            multiple
            hidden
            onChange={(e) => {
              if (e.target.files) legeBilderAb(e.target.files)
              e.target.value = ''
            }}
          />

          <button type="button" title="Rückgängig" onClick={() => editor?.chain().focus().undo().run()}>
            ↶
          </button>
          <button
            type="button"
            title="Wiederherstellen"
            onClick={() => editor?.chain().focus().redo().run()}
          >
            ↷
          </button>
          <span className={`speicherstand ${zustand}`}>
            {zustand === 'speichert' ? <Kreisel text={ZUSTANDSTEXT[zustand]} /> : ZUSTANDSTEXT[zustand]}
          </span>
        </div>

        <div className="werkzeuge">
          {pruefung ? (
            <span className="pruefstand">
              {pruefung.zusammenfassung.sperrt > 0 ? (
                <span className="marke-pille m-zurueckgezogen">
                  {pruefung.zusammenfassung.sperrt} sperrend
                </span>
              ) : null}
              {pruefung.zusammenfassung.warnt > 0 ? (
                <span className="marke-pille m-warn">
                  {pruefung.zusammenfassung.warnt} zu prüfen
                </span>
              ) : null}
              {pruefung.befunde.length === 0 ? (
                <span className="marke-pille m-freigegeben">nichts zu beanstanden</span>
              ) : null}
            </span>
          ) : null}

          <button
            type="button"
            className="haupt"
            disabled={!editor || ausgabestand !== null}
            onClick={() => void erzeugeDokument()}
          >
            {ausgabestand ? <Kreisel text="Dokument erzeugen" /> : 'Dokument erzeugen'}
          </button>

          {!versendet ? (
            <button
              type="button"
              disabled={laeuft}
              onClick={() =>
                starte(async () => {
                  const e = await markiereVersendet(stellungnahmeId)
                  setzeMeldung(e.hinweis ?? null)
                })
              }
            >
              {laeuft ? <Kreisel text="Versendet" /> : 'Versendet'}
            </button>
          ) : null}
        </div>
      </div>

      {meldung ? (
        <div
          className={`hinweis ${meldung.match(/sperr|gescheitert|nicht |Konflikt/i) ? 'fehler' : ''}`}
          role="status"
          style={{ marginBottom: 12 }}
        >
          {meldung}
          {zustand === 'konflikt' ? (
            <>
              {' '}
              <button type="button" onClick={() => window.location.reload()}>
                Neu laden
              </button>
            </>
          ) : null}
        </div>
      ) : null}

      {ausgabestand ? (
        <div style={{ marginBottom: 14 }}>
          <Fortschritt stand={ausgabestand} />
        </div>
      ) : null}

      {ausgabe?.klartext ? (
        <div className="ausgabe-leiste">
          <span>Fertiges Dokument:</span>
          <button type="button" className="haupt" onClick={ladeDocx}>
            {ausgabe.docxName}
          </button>
          <button
            type="button"
            onClick={() => lade(ausgabe.txtName!, ausgabe.klartext!, 'text/plain;charset=utf-8')}
          >
            {ausgabe.txtName}
          </button>
        </div>
      ) : null}

      <div className="werkbank-raster">
        <div className="brief" ref={briefRef}>
          <EditorContent editor={editor} />
        </div>

        <aside className="rand" ref={randRef}>
          {positionen.map((p) => (
            <div
              key={p.id}
              ref={(el) => {
                blasenRef.current.set(p.id, el)
              }}
            >
              <Blase
                position={p}
                vorschlag={vorschlaege.find((v) => v.positionId === p.id)}
                befunde={befundeJePosition.get(p.id) ?? []}
                nummer={nummerJePosition.get(p.id) ?? null}
                imBrief={imBrief.has(p.id)}
                hatText={mitText.has(p.id)}
                aktiv={aktiv === p.id}
                werte={werte}
                kiAktiv={kiAktiv}
                laeuft={laeuft}
                aufAktivieren={() => {
                  setzeAktiv(p.id)
                  if (editor && imBrief.has(p.id)) springeInAbschnitt(editor, p.id)
                }}
                aufEinfuegen={(text, marke) => einfuegen(p.id, text, marke)}
                aufAusformulieren={() => ausformulieren(p.id)}
                aufHerausnehmen={() => herausnehmen(p.id)}
                aufAufnehmen={() => aufnehmen(p.id, p.bezeichnung)}
                aufFundstelle={springeZu}
                aufInBibliothek={() => inBibliothek(p.id)}
              />
            </div>
          ))}

          {(befundeJePosition.get('—') ?? []).length > 0 ? (
            <div className="blase auf">
              <div className="blase-kopf">
                <span className="blase-titel">Zum ganzen Schreiben</span>
              </div>
              <div className="blase-befunde">
                {(befundeJePosition.get('—') ?? []).map((b, i) => (
                  <div key={i} className={`befund ${b.schwere}`}>
                    <span className="marke-pille m-akzent">{b.kennung}</span>
                    <span>
                      <strong>{b.titel}</strong>
                      <br />
                      {b.text}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  )
}
