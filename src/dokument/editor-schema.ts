/**
 * Die Editor-Erweiterungen zum Dokumentbaum.
 *
 * Sie bilden genau die Struktur nach, die `typen.ts` beschreibt — und sonst
 * nichts. Der Editor kann deshalb nichts erzeugen, was die Ausgabe später
 * nicht versteht: keine Überschriftenebenen, keine Codeblöcke, keine
 * Zitatblöcke. Ein Brief hat Betreff, Anrede, Fliesstext, nummerierte
 * Abschnitte, Ergebnis und Signatur.
 *
 * Nur im Browser verwenden.
 */

import { Extension, Mark, Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import StarterKit from '@tiptap/starter-kit'
import { Placeholder } from '@tiptap/extensions'
import { SIGNATUR } from '@/export/hausstil'
import { BILD_BREITE_STANDARD, KNOTEN, MARKE_BIBLIOTHEK } from './typen'
import { BildAnsicht } from '@/app/(app)/stellungnahmen/[id]/bild-ansicht'

/**
 * Der Rahmen des Schreibens ist fest.
 *
 * `betreff anrede block+ signatur` heisst: Betreff und Anrede lassen sich
 * ändern, aber nicht löschen, und unter der Signatur kann nichts stehen.
 */
export const Dokument = Node.create({
  name: KNOTEN.dokument,
  topNode: true,
  content: 'betreff anrede block+ signatur',
})

export const Betreff = Node.create({
  name: KNOTEN.betreff,
  content: 'text*',
  marks: '',
  defining: true,
  parseHTML: () => [{ tag: 'p[data-betreff]' }],
  renderHTML: ({ HTMLAttributes }) => [
    'p',
    mergeAttributes(HTMLAttributes, { 'data-betreff': '', class: 'd-betreff' }),
    0,
  ],
})

export const Anrede = Node.create({
  name: KNOTEN.anrede,
  content: 'text*',
  marks: '',
  defining: true,
  parseHTML: () => [{ tag: 'p[data-anrede]' }],
  renderHTML: ({ HTMLAttributes }) => [
    'p',
    mergeAttributes(HTMLAttributes, { 'data-anrede': '', class: 'd-anrede' }),
    0,
  ],
})

export const PositionsUeberschrift = Node.create({
  name: KNOTEN.ueberschrift,
  content: 'text*',
  marks: '',
  defining: true,
  parseHTML: () => [{ tag: 'h3[data-ueberschrift]' }],
  renderHTML: ({ HTMLAttributes }) => [
    'h3',
    mergeAttributes(HTMLAttributes, { 'data-ueberschrift': '', class: 'd-ueberschrift' }),
    0,
  ],
})

/**
 * Ein nummerierter Abschnitt des Schreibens.
 *
 * Die Nummer steht ausdrücklich **nicht** im Text: sie wird über einen
 * CSS-Zähler aus der Reihenfolge gebildet. Wird eine Position nicht
 * bestritten und ihr Abschnitt entfernt, rückt die Nummerierung von selbst
 * nach — genau die Regel, die der Hausstil verlangt.
 *
 * `isolating` hält die Grenzen dicht: eine Rückschritt-Taste am
 * Abschnittsanfang zieht den Absatz nicht in den Abschnitt davor.
 */
export const PositionsAbschnitt = Node.create({
  name: KNOTEN.abschnitt,
  group: 'block',
  content: `${KNOTEN.ueberschrift} (paragraph|bulletList|orderedList|${KNOTEN.bild})+`,
  defining: true,
  isolating: true,

  addAttributes: () => ({
    positionId: {
      default: null,
      parseHTML: (el: HTMLElement) => el.getAttribute('data-position-id'),
      renderHTML: (attrs: Record<string, unknown>) =>
        attrs.positionId ? { 'data-position-id': attrs.positionId as string } : {},
    },
    bezeichnung: {
      default: '',
      parseHTML: (el: HTMLElement) => el.getAttribute('data-bezeichnung') ?? '',
      renderHTML: (attrs: Record<string, unknown>) =>
        attrs.bezeichnung ? { 'data-bezeichnung': attrs.bezeichnung as string } : {},
    },
    ausgelassen: {
      default: false,
      parseHTML: (el: HTMLElement) => el.hasAttribute('data-ausgelassen'),
      renderHTML: (attrs: Record<string, unknown>) =>
        attrs.ausgelassen ? { 'data-ausgelassen': '' } : {},
    },
  }),

  parseHTML: () => [{ tag: 'section[data-position-id]' }],
  renderHTML: ({ HTMLAttributes }) => [
    'section',
    mergeAttributes(HTMLAttributes, { class: 'd-abschnitt' }),
    0,
  ],
})

export const Ergebnis = Node.create({
  name: KNOTEN.ergebnis,
  content: 'inline*',
  group: 'block',
  defining: true,
  parseHTML: () => [{ tag: 'p[data-ergebnis]' }],
  renderHTML: ({ HTMLAttributes }) => [
    'p',
    mergeAttributes(HTMLAttributes, { 'data-ergebnis': '', class: 'd-ergebnis' }),
    0,
  ],
})

/**
 * Die Signatur steht im Editor, lässt sich aber nicht bearbeiten.
 *
 * Sichtbar, weil das Bild auf dem Schirm dem versandten Brief entsprechen
 * soll; gesperrt, weil der Hausstil sonst zwei Quellen hätte.
 */
export const Signatur = Node.create({
  name: KNOTEN.signatur,
  atom: true,
  selectable: false,
  draggable: false,
  parseHTML: () => [{ tag: 'div[data-signatur]' }],
  renderHTML: () => [
    'div',
    { 'data-signatur': '', class: 'd-signatur', contenteditable: 'false' },
    ...SIGNATUR.map((zeile) => ['p', {}, zeile || ' '] as const),
  ],
})

/**
 * Die Herkunftsmarke.
 *
 * `inclusive: false` sorgt dafür, dass frisch getippter Text am Rand eines
 * eingefügten Bausteins nicht fälschlich als Bibliothekstext gilt. Wer
 * mitten im Baustein umformuliert, behält die Marke — genau so soll es
 * sein: der Absatz stammt weiterhin aus diesem Eintrag.
 */
export const Bibliothekstext = Mark.create({
  name: MARKE_BIBLIOTHEK,
  inclusive: false,

  addAttributes: () => ({
    eintragId: {
      default: null,
      parseHTML: (el: HTMLElement) => el.getAttribute('data-eintrag-id'),
      renderHTML: (attrs: Record<string, unknown>) =>
        attrs.eintragId ? { 'data-eintrag-id': attrs.eintragId as string } : {},
    },
    nummer: {
      default: null,
      parseHTML: (el: HTMLElement) => el.getAttribute('data-nummer'),
      renderHTML: (attrs: Record<string, unknown>) =>
        attrs.nummer ? { 'data-nummer': attrs.nummer as string } : {},
    },
    titel: {
      default: null,
      parseHTML: (el: HTMLElement) => el.getAttribute('title'),
      renderHTML: (attrs: Record<string, unknown>) =>
        attrs.titel ? { title: `${attrs.nummer ? `${attrs.nummer} ` : ''}${attrs.titel}` } : {},
    },
    herkunft: {
      default: 'vorschlag',
      parseHTML: (el: HTMLElement) => el.getAttribute('data-herkunft') ?? 'vorschlag',
      renderHTML: (attrs: Record<string, unknown>) => ({
        'data-herkunft': (attrs.herkunft as string) ?? 'vorschlag',
      }),
    },
  }),

  parseHTML: () => [{ tag: 'span[data-eintrag-id]' }, { tag: 'span[data-herkunft]' }],
  renderHTML: ({ HTMLAttributes }) => [
    'span',
    mergeAttributes(HTMLAttributes, { class: 'd-quelle' }),
    0,
  ],
})

/**
 * Ein Bild im Schreiben.
 *
 * Der Inhalt des Knotens ist die **Beschriftung** — sie ist damit
 * gewöhnlicher Text des Dokuments und wird wie jeder andere bearbeitet,
 * geprüft und ausgegeben. Ein Feld daneben wäre bequemer zu bauen und
 * schlechter zu benutzen.
 *
 * `isolating` hält die Grenzen dicht: eine Rückschritt-Taste in der
 * Beschriftung zerlegt nicht den Absatz darüber.
 */
export const Bild = Node.create({
  name: KNOTEN.bild,
  group: 'block',
  content: 'inline*',
  draggable: true,
  isolating: true,

  addAttributes: () => ({
    bildId: {
      default: null,
      parseHTML: (el: HTMLElement) => el.getAttribute('data-bild-id'),
      renderHTML: (attrs: Record<string, unknown>) =>
        attrs.bildId ? { 'data-bild-id': attrs.bildId as string } : {},
    },
    breite: {
      default: BILD_BREITE_STANDARD,
      parseHTML: (el: HTMLElement) => Number(el.getAttribute('data-breite')) || BILD_BREITE_STANDARD,
      renderHTML: (attrs: Record<string, unknown>) => ({ 'data-breite': String(attrs.breite) }),
    },
    breitePx: {
      default: 1000,
      parseHTML: (el: HTMLElement) => Number(el.getAttribute('data-breite-px')) || 1000,
      renderHTML: (attrs: Record<string, unknown>) => ({ 'data-breite-px': String(attrs.breitePx) }),
    },
    hoehePx: {
      default: 750,
      parseHTML: (el: HTMLElement) => Number(el.getAttribute('data-hoehe-px')) || 750,
      renderHTML: (attrs: Record<string, unknown>) => ({ 'data-hoehe-px': String(attrs.hoehePx) }),
    },
    dateiname: {
      default: 'Bild',
      parseHTML: (el: HTMLElement) => el.getAttribute('data-dateiname') ?? 'Bild',
      renderHTML: (attrs: Record<string, unknown>) => ({
        'data-dateiname': String(attrs.dateiname ?? 'Bild'),
      }),
    },
  }),

  parseHTML: () => [{ tag: 'figure[data-bild-id]' }],
  renderHTML: ({ HTMLAttributes }) => [
    'figure',
    mergeAttributes(HTMLAttributes, { class: 'd-bild' }),
    ['figcaption', {}, 0],
  ],

  addNodeView() {
    return ReactNodeViewRenderer(BildAnsicht)
  },
})

/**
 * Markiert Abschnitte ohne Text.
 *
 * Die Nummerierung im Editor entsteht über einen CSS-Zähler, die im
 * ausgegebenen Schreiben über die Reihenfolge der Abschnitte mit Text.
 * Beide müssen dieselbe Zahl zeigen — sonst spricht die Anmerkung am Rand
 * von Position 3 und der Brief von Position 2. Diese Auszeichnung nimmt
 * leere Abschnitte aus der Zählung heraus.
 */
export const LeereAbschnitte = Extension.create({
  name: 'leereAbschnitte',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          decorations(state) {
            const auszeichnungen: Decoration[] = []
            state.doc.descendants((node, pos) => {
              if (node.type.name !== KNOTEN.abschnitt) return true
              let text = ''
              node.forEach((kind) => {
                if (kind.type.name !== KNOTEN.ueberschrift) text += kind.textContent
              })
              if (!text.trim()) {
                auszeichnungen.push(
                  Decoration.node(pos, pos + node.nodeSize, { class: 'abschnitt-leer' }),
                )
              }
              return false
            })
            return DecorationSet.create(state.doc, auszeichnungen)
          },
        },
      }),
    ]
  },
})

/** Schlüssel des Plugins, das den hervorgehobenen Abschnitt hält. */
export const SCHLUESSEL_AKTIV = new PluginKey<string | null>('aktiverAbschnitt')

/**
 * Hebt den Abschnitt hervor, zu dem die offene Anmerkung gehört.
 *
 * Die Hervorhebung ist eine Auszeichnung und keine Klasse, die von aussen
 * an das Element geschrieben wird. Der Unterschied ist kein Schönheits-
 * fehler: ProseMirror beobachtet seinen eigenen Baum. Wer dort von Hand ein
 * Attribut setzt, sieht seinen Abschnitt neu gezeichnet — und mit ihm alle
 * Bilder darin, samt laufender Bewegung am Ziehgriff. Als Auszeichnung
 * weiss ProseMirror Bescheid und tauscht nur die Klasse aus.
 */
export const AktiverAbschnitt = Extension.create({
  name: 'aktiverAbschnitt',

  addProseMirrorPlugins() {
    return [
      new Plugin<string | null>({
        key: SCHLUESSEL_AKTIV,
        state: {
          init: () => null,
          apply(tr, alt) {
            const neu = tr.getMeta(SCHLUESSEL_AKTIV) as string | null | undefined
            return neu === undefined ? alt : neu
          },
        },
        props: {
          decorations(state) {
            const id = SCHLUESSEL_AKTIV.getState(state)
            if (!id) return null
            const auszeichnungen: Decoration[] = []
            state.doc.descendants((node, pos) => {
              if (node.type.name !== KNOTEN.abschnitt) return true
              if (node.attrs.positionId === id) {
                auszeichnungen.push(Decoration.node(pos, pos + node.nodeSize, { class: 'aktiv' }))
              }
              return false
            })
            return DecorationSet.create(state.doc, auszeichnungen)
          },
        },
      }),
    ]
  },
})

/**
 * Alle Erweiterungen des Brief-Editors.
 *
 * Aus dem Starterpaket bleibt nur, was in einem Geschäftsbrief vorkommt.
 * Überschriften, Codeblöcke und Zitatblöcke sind abgeschaltet — nicht aus
 * Strenge, sondern weil die Word-Ausgabe sie nicht kennt und ein Editor,
 * der mehr anbietet als die Ausgabe kann, in die Irre führt.
 */
export function briefErweiterungen() {
  return [
    StarterKit.configure({
      document: false,
      heading: false,
      codeBlock: false,
      code: false,
      blockquote: false,
      horizontalRule: false,
      strike: false,
      link: false,
      trailingNode: false,
    }),
    Dokument,
    Betreff,
    Anrede,
    PositionsUeberschrift,
    PositionsAbschnitt,
    Ergebnis,
    Signatur,
    Bild,
    Bibliothekstext,
    LeereAbschnitte,
    AktiverAbschnitt,
    Placeholder.configure({
      includeChildren: true,
      placeholder: ({ node }: { node: { type: { name: string } } }) => {
        if (node.type.name === KNOTEN.ueberschrift) return 'Überschrift der Position'
        if (node.type.name === KNOTEN.betreff) return 'Betreff'
        if (node.type.name === KNOTEN.anrede) return 'Anrede'
        if (node.type.name === KNOTEN.bild) return 'Beschriftung (freiwillig)'
        return 'Text — oder rechts einen Baustein wählen'
      },
    }),
  ]
}
