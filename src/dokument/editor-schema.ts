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
import { Plugin } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import StarterKit from '@tiptap/starter-kit'
import { Placeholder } from '@tiptap/extensions'
import { SIGNATUR } from '@/export/hausstil'
import { KNOTEN, MARKE_BIBLIOTHEK } from './typen'

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
  content: `${KNOTEN.ueberschrift} (paragraph|bulletList|orderedList)+`,
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
    Bibliothekstext,
    LeereAbschnitte,
    Placeholder.configure({
      includeChildren: true,
      placeholder: ({ node }: { node: { type: { name: string } } }) => {
        if (node.type.name === KNOTEN.ueberschrift) return 'Überschrift der Position'
        if (node.type.name === KNOTEN.betreff) return 'Betreff'
        if (node.type.name === KNOTEN.anrede) return 'Anrede'
        return 'Text — oder rechts einen Baustein wählen'
      },
    }),
  ]
}
