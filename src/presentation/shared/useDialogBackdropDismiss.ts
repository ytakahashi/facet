import { useRef } from "react";
import { isDialogBackdropEvent } from "./isDialogBackdropEvent.ts";

export function useDialogBackdropDismiss(onClose: () => void) {
  const pointerStartedOnBackdrop = useRef(false);

  return {
    onPointerDown(event: React.PointerEvent<HTMLDialogElement>) {
      pointerStartedOnBackdrop.current = isDialogBackdropEvent(event);
    },
    onPointerCancel() {
      pointerStartedOnBackdrop.current = false;
    },
    onClick(event: React.MouseEvent<HTMLDialogElement>) {
      // Only a press that both starts and ends on the backdrop dismisses, so a
      // drag (e.g. a text selection) released outside the dialog keeps it open.
      const shouldClose =
        pointerStartedOnBackdrop.current && isDialogBackdropEvent(event);
      pointerStartedOnBackdrop.current = false;
      if (shouldClose) onClose();
    },
  };
}
