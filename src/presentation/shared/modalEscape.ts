import { useEffect } from "react";
import { isImeProcessing } from "./isImeProcessing.ts";

type EscapeKeyEvent = Pick<
  KeyboardEvent,
  "key" | "defaultPrevented" | "isComposing" | "keyCode" | "preventDefault"
>;

type ModalDialog = Pick<HTMLDialogElement, "dispatchEvent" | "close">;

// WKWebView hands a keydown the page did not preventDefault() back to AppKit,
// which leaves native full screen on Escape. A modal dialog's built-in Escape
// handling closes it without claiming the keydown, so it would take the window
// out of full screen as well. This claims the keydown and makes the same close
// request in its place: `cancel` first, so each dialog's onCancel still
// decides, then close() unless the cancel was prevented.
export function closeModalOnEscape(
  event: EscapeKeyEvent,
  topModal: ModalDialog | undefined,
): void {
  // A prevented keydown already belongs to something inside the dialog, such
  // as a field cancelling its own edit.
  if (event.key !== "Escape" || event.defaultPrevented) return;
  if (isImeProcessing(event) || !topModal) return;
  event.preventDefault();
  if (topModal.dispatchEvent(new Event("cancel", { cancelable: true }))) {
    topModal.close();
  }
}

function findTopModal(): HTMLDialogElement | undefined {
  // Focus stays inside the topmost modal, so the dialog holding it is the one
  // Escape addresses. Without a focused element, fall back to the last modal
  // in document order.
  const focused = document.activeElement?.closest("dialog");
  if (focused?.matches(":modal")) return focused;
  const modals = document.querySelectorAll<HTMLDialogElement>("dialog:modal");
  return modals.item(modals.length - 1) ?? undefined;
}

export function useModalEscape(): void {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      closeModalOnEscape(event, findTopModal());
    }
    // On window in the bubble phase so that it runs after every element and
    // document listener: those that act on Escape prevent it first, and those
    // that check for an open dialog (MarkdownViewer) still find it open.
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
}
