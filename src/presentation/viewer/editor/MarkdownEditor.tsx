import { useLayoutEffect, useMemo, useRef, useState } from "react";
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
import {
  applyIndentation,
  type IndentDirection,
  resolveIndentation,
} from "./editorIndentation.ts";
import { resolveEditorShortcut } from "../../shared/shortcuts/editorShortcut.ts";
import { InsertCardLinkDialog } from "./InsertCardLinkDialog.tsx";
import type { FindPresentation, FindText } from "../find/findPresentation.ts";
import { EditorFindBackdrop } from "./EditorFindBackdrop.tsx";
import { useEditorFind } from "./useEditorFind.ts";
import { EditorLineNumbers } from "./EditorLineNumbers.tsx";
import { useEditorScrollSync } from "./useEditorScrollSync.ts";
import { EditorLineMirror } from "./EditorLineMirror.tsx";
import { useEditorLineLayout } from "./useEditorLineLayout.ts";

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  board: Board;
  fromPath: string;
  // Called again whenever its identity changes, so pass a stable callback to
  // run it once per mount.
  onMount?: (editor: HTMLTextAreaElement) => void;
  readOnly?: boolean;
  find?: FindPresentation;
  onFindTextChange?: (source: FindText) => void;
}

export function MarkdownEditor({
  value,
  onChange,
  board,
  fromPath,
  onMount,
  readOnly = false,
  find,
  onFindTextChange,
}: MarkdownEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const gutterContentRef = useRef<HTMLDivElement>(null);
  const syncScroll = useEditorScrollSync(
    textareaRef,
    backdropRef,
    gutterContentRef,
  );
  const { text } = useEditorFind(
    value,
    textareaRef,
    backdropRef,
    textRef,
    find,
    onFindTextChange,
    syncScroll,
  );
  const lines = useMemo(() => text.split("\n"), [text]);
  // Measure at the common parent: a child's layout effect can run before
  // the later textarea sibling has attached its ref on the initial mount.
  const { mirrorRef, layout } = useEditorLineLayout(
    lines,
    textareaRef,
    syncScroll,
  );
  const insertionTargetRef = useRef<LinkInsertionTarget | undefined>(undefined);
  const pendingSelectionRef = useRef<
    { start: number; end: number } | undefined
  >(undefined);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useLayoutEffect(() => {
    if (textareaRef.current) onMount?.(textareaRef.current);
  }, [onMount]);

  useLayoutEffect(() => {
    const selection = pendingSelectionRef.current;
    const textarea = textareaRef.current;
    if (selection === undefined || !textarea) return;

    // The fallback updates a controlled value through React. Restore the
    // caret only after that value reaches the DOM, or the old value can clamp
    // the requested position before the inserted text exists.
    pendingSelectionRef.current = undefined;
    textarea.focus();
    textarea.setSelectionRange(selection.start, selection.end);
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
    pendingSelectionRef.current = { start: result.caret, end: result.caret };
    onChange(result.value);
  }

  function indent(textarea: HTMLTextAreaElement, direction: IndentDirection) {
    const edit = resolveIndentation(
      textarea.value,
      textarea.selectionStart,
      textarea.selectionEnd,
      direction,
    );
    if (!edit) return;

    textarea.setSelectionRange(edit.start, edit.end);
    // Go through the native editing commands, as card link insertion does,
    // so the change joins the WebView's undo ring. WebKit does not reliably
    // treat inserting an empty string as deleting the selection.
    const applied =
      edit.text === ""
        ? document.execCommand("delete")
        : document.execCommand("insertText", false, edit.text);
    if (applied) {
      textarea.setSelectionRange(edit.selectionStart, edit.selectionEnd);
      return;
    }

    pendingSelectionRef.current = {
      start: edit.selectionStart,
      end: edit.selectionEnd,
    };
    onChange(applyIndentation(textarea.value, edit));
  }

  return (
    <>
      <div className="markdown-editor-frame">
        <EditorLineNumbers
          lineCount={lines.length}
          layout={layout}
          contentRef={gutterContentRef}
        />
        <div className="markdown-editor-viewport">
          <EditorLineMirror lines={lines} mirrorRef={mirrorRef} />
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
              const shortcut = resolveEditorShortcut(event.nativeEvent);
              if (!shortcut) return;
              if (shortcut === "indent" || shortcut === "outdent") {
                // A read-only editor leaves Tab to move focus, since there is
                // nothing to indent.
                if (readOnly) return;
                event.preventDefault();
                indent(event.currentTarget, shortcut);
                return;
              }
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
          />
        </div>
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
