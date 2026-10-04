// Dialogs keep WebKit's own context menu, so screens that show app menus skip
// events raised from inside one.
export function isInsideDialog(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest("dialog") !== null;
}
