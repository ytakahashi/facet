const IME_PROCESS_KEY_CODE = 229;

export function isImeProcessing(
  event: Pick<KeyboardEvent, "isComposing" | "keyCode">,
): boolean {
  // WebKit can report the key that ends an IME composition with isComposing
  // already false; keyCode 229 still marks it as consumed by the IME.
  return event.isComposing || event.keyCode === IME_PROCESS_KEY_CODE;
}
