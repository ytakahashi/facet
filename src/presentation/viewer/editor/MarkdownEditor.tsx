import { useLayoutEffect, useRef, useState } from "react";
import type { Board } from "../../../domain/board.ts";
import {
  cardLinkMarkdown,
  isLinkableCardPath,
} from "../../../domain/cardLink.ts";
import type { Card } from "../../../domain/card.ts";
import {
  applyLinkInsertion,
  type LinkInsertionTarget,
  resolveLinkInsertionTarget,
} from "./cardLinkInsertion.ts";
import { resolveEditorShortcut } from "./editorShortcut.ts";
import { InsertCardLinkDialog } from "./InsertCardLinkDialog.tsx";
import type { FindPresentation, FindText } from "../find/findPresentation.ts";
import { EditorFindBackdrop } from "./EditorFindBackdrop.tsx";
import { useEditorFind } from "./useEditorFind.ts";

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  board: Board;
  fromPath: string;
  // Read on mount only, as the native attribute is.
  autoFocus?: boolean;
  readOnly?: boolean;
  find?: FindPresentation;
  onFindTextChange?: (source: FindText) => void;
}

export function MarkdownEditor(
  {
    value,
    onChange,
    board,
    fromPath,
    autoFocus = false,
    readOnly = false,
    find,
    onFindTextChange,
  }: MarkdownEditorProps,
) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const { text, syncScroll } = useEditorFind(
    value,
    textareaRef,
    backdropRef,
    textRef,
    find,
    onFindTextChange,
  );
  const insertionTargetRef = useRef<LinkInsertionTarget | undefined>(
    undefined,
  );
  const pendingCaretRef = useRef<number | undefined>(undefined);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useLayoutEffect(() => {
    const caret = pendingCaretRef.current;
    const textarea = textareaRef.current;
    if (caret === undefined || !textarea) return;

    // The fallback updates a controlled value through React. Restore the
    // caret only after that value reaches the DOM, or the old value can clamp
    // the requested position before the inserted text exists.
    pendingCaretRef.current = undefined;
    textarea.focus();
    textarea.setSelectionRange(caret, caret);
  }, [value]);

  function insertCardLink(card: Card) {
    setIsDialogOpen(false);
    if (readOnly) return;
    const textarea = textareaRef.current;
    const target = insertionTargetRef.current;
    if (!textarea || !target) return;

    const markdown = cardLinkMarkdown(fromPath, card, target.linkText);
    textarea.focus();
    // A modal takes focus and makes the textarea's live selection unreliable,
    // so restore the range captured when Command-K opened the palette.
    textarea.setSelectionRange(target.start, target.end);
    // insertText participates in WebView's native undo ring. There is no
    // non-deprecated textarea API that preserves that editing history.
    if (document.execCommand("insertText", false, markdown)) return;

    const result = applyLinkInsertion(value, target, markdown);
    pendingCaretRef.current = result.caret;
    onChange(result.value);
  }

  return (
    <>
      <div className="markdown-editor-frame">
        <EditorFindBackdrop
          text={text}
          backdropRef={backdropRef}
          textRef={textRef}
        />
        <textarea
          ref={textareaRef}
          className="markdown-editor"
          data-markdown-editor
          value={value}
          readOnly={readOnly}
          onChange={(event) => onChange(event.target.value)}
          onScroll={syncScroll}
          onKeyDown={(event) => {
            if (!resolveEditorShortcut(event.nativeEvent)) return;
            // Claim the app shortcut once recognised, even when this card's
            // path cannot produce a link and the palette therefore stays shut.
            event.preventDefault();
            if (readOnly || !isLinkableCardPath(fromPath)) return;
            insertionTargetRef.current = resolveLinkInsertionTarget(
              value,
              event.currentTarget.selectionStart,
              event.currentTarget.selectionEnd,
            );
            setIsDialogOpen(true);
          }}
          spellCheck={false}
          autoFocus={autoFocus}
        />
      </div>
      <InsertCardLinkDialog
        board={board}
        fromPath={fromPath}
        open={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onSelect={insertCardLink}
      />
    </>
  );
}
