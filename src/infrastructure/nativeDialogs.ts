// Confirmation and alert dialogs, shown natively through Tauri's dialog
// plugin. The WebView cannot show them itself: wry implements neither
// window.confirm() nor window.alert() on macOS, so confirm() answers false at
// once without showing anything.
import { confirm, message } from "@tauri-apps/plugin-dialog";

// Resolves false rather than rejecting when the dialog cannot be shown: a
// question that never reached the user has not given permission to discard or
// overwrite anything.
export async function confirmAction(text: string): Promise<boolean> {
  try {
    return await confirm(text, { kind: "warning" });
  } catch (error) {
    console.warn("Failed to show a confirmation dialog:", error);
    return false;
  }
}

// Fire-and-forget: every caller reports a failure that has already happened,
// and has nothing to wait for.
export function showError(text: string): void {
  message(text, { kind: "error" }).catch((error) => {
    console.warn("Failed to show an error dialog:", error);
  });
}
