interface DialogPointerEvent {
  target: unknown;
  currentTarget: {
    getBoundingClientRect(): Pick<DOMRect, "left" | "right" | "top" | "bottom">;
  };
  clientX: number;
  clientY: number;
}

export function isDialogBackdropEvent(event: DialogPointerEvent): boolean {
  if (event.target !== event.currentTarget) return false;
  // Native backdrop events target the dialog too; its border and padding
  // must remain part of the dialog rather than count as backdrop clicks.
  const rect = event.currentTarget.getBoundingClientRect();
  return (
    event.clientX < rect.left ||
    event.clientX > rect.right ||
    event.clientY < rect.top ||
    event.clientY > rect.bottom
  );
}
