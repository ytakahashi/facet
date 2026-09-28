import { useEffect, useRef } from "react";
import type { Ref } from "react";

interface DragOrigin {
  pointerX: number;
  paneWidth: number;
  availableWidth: number;
}

interface PaneResizerProps {
  // Width of the pane to the right of this handle.
  width: number;
  handleRef: Ref<HTMLDivElement>;
  availableWidth: number;
  clamp: (width: number, availableWidth: number) => number;
  step: number;
  label: string;
  onResize: (width: number) => void;
  onReset: () => void;
}

const RESIZING_CLASS = "is-pane-resizing";

// A drag handle sitting between two flex panes. It widens the pane on its
// right, so dragging left grows that pane. Nothing here knows what the pane
// contains: the bounds arrive as clamp().
export function PaneResizer(
  { width, handleRef, availableWidth, clamp, step, label, onResize, onReset }:
    PaneResizerProps,
) {
  const drag = useRef<DragOrigin | undefined>(undefined);

  // The resize cursor and the selection lock have to hold while the pointer
  // is outside this element, which is most of a drag, so they go on <body>.
  // Also cleared on unmount: the viewer can be closed from elsewhere
  // mid-drag, and then no pointer event ever arrives to end it.
  useEffect(() => () => {
    document.body.classList.remove(RESIZING_CLASS);
  }, []);

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    // Keeps the drag from starting a text selection or moving focus.
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    // Taken once: the available space does not change during a drag, and
    // re-reading it per move would follow a pane width this drag is changing.
    drag.current = {
      pointerX: event.clientX,
      paneWidth: width,
      availableWidth,
    };
    document.body.classList.add(RESIZING_CLASS);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const origin = drag.current;
    if (!origin) return;
    const moved = origin.pointerX - event.clientX;
    onResize(clamp(origin.paneWidth + moved, origin.availableWidth));
  }

  // Fires on pointerup and pointercancel alike, since both release the
  // capture, so one handler covers every way a drag can end.
  function handleLostPointerCapture() {
    drag.current = undefined;
    document.body.classList.remove(RESIZING_CLASS);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const direction = event.key === "ArrowLeft"
      ? 1
      : event.key === "ArrowRight"
      ? -1
      : 0;
    if (direction === 0) return;
    event.preventDefault();
    onResize(clamp(width + direction * step, availableWidth));
  }

  // clamp() answers with the bound itself for a width that cannot be reached,
  // which is where the separator's advertised range comes from.
  const minimumWidth = clamp(Number.NEGATIVE_INFINITY, availableWidth);
  const maximumWidth = clamp(Number.POSITIVE_INFINITY, availableWidth);
  const currentWidth = clamp(width, availableWidth);

  return (
    <div
      ref={handleRef}
      className="pane-resizer"
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuemin={minimumWidth}
      aria-valuemax={maximumWidth}
      aria-valuenow={currentWidth}
      aria-valuetext={`${currentWidth} pixels`}
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onLostPointerCapture={handleLostPointerCapture}
      onDoubleClick={onReset}
      onKeyDown={handleKeyDown}
    />
  );
}
