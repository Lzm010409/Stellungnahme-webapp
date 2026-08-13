'use client'

import { BubbleMenu } from '@tiptap/react/menus'
import type { Editor } from '@tiptap/react'
import { NodeSelection } from '@tiptap/pm/state'
import { KNOTEN } from '@/dokument/typen'

/**
 * Die Schnellauswahl über der Markierung.
 *
 * Wie in Word: was man markiert hat, will man meistens sofort auszeichnen,
 * und der Weg zur Leiste am Kopf ist dafür zu weit. Es steht hier nur, was
 * ein Geschäftsbrief kennt — dieselben Mittel wie in der Werkzeugleiste,
 * nicht mehr. Ein Menü, das mehr anbietet als die Word-Ausgabe versteht,
 * führt in die Irre.
 *
 * Nicht überall: In Betreff, Anrede und Überschrift lässt das Schema keine
 * Auszeichnung zu, und ein gewähltes Bild ist keine Textstelle. Dort bleibt
 * die Leiste weg, statt Knöpfe zu zeigen, die nichts bewirken.
 */
const OHNE_AUSZEICHNUNG = new Set<string>([KNOTEN.betreff, KNOTEN.anrede, KNOTEN.ueberschrift])

export function Schnellauswahl({ editor }: { editor: Editor | null }) {
  if (!editor) return null

  return (
    <BubbleMenu
      editor={editor}
      options={{ placement: 'top', offset: 8 }}
      className="schnellauswahl"
      shouldShow={({ editor: e, state, from, to }) => {
        if (!e.isEditable || from === to) return false
        if (state.selection instanceof NodeSelection) return false
        if (OHNE_AUSZEICHNUNG.has(state.selection.$from.parent.type.name)) return false
        return state.doc.textBetween(from, to, ' ', ' ').trim().length > 0
      }}
    >
      <button
        type="button"
        title="Fett"
        className={editor.isActive('bold') ? 'an' : ''}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <strong>F</strong>
      </button>
      <button
        type="button"
        title="Kursiv"
        className={editor.isActive('italic') ? 'an' : ''}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <em>K</em>
      </button>
      <span className="schnellauswahl-strich" aria-hidden="true" />
      <button
        type="button"
        title="Aufzählung"
        className={editor.isActive('bulletList') ? 'an' : ''}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        ▪
      </button>
      <button
        type="button"
        title="Nummerierte Liste"
        className={editor.isActive('orderedList') ? 'an' : ''}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        1.
      </button>
      <span className="schnellauswahl-strich" aria-hidden="true" />
      {/* Nur Fett und Kursiv werden gelöst, nicht alle Marken: die
          Herkunftsmarke der Bausteine hängt am selben Text und ist die Spur
          zum Bibliothekseintrag. Sie hier beiläufig mit wegzuwischen hiesse,
          die Wirkungsstatistik still zu leeren. */}
      <button
        type="button"
        title="Fett und Kursiv entfernen"
        onClick={() => editor.chain().focus().unsetBold().unsetItalic().run()}
      >
        ✕
      </button>
    </BubbleMenu>
  )
}
