// Text fields keep WebKit's own menu: it carries copy/paste and spelling,
// which the app's menus do not replace.
export function isTextEditingTarget(target: EventTarget | null): boolean {
  return target instanceof Element &&
    target.closest("input, textarea, [contenteditable]") !== null;
}
