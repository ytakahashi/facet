import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";
import { AppProvider } from "../context/appContext.ts";
import type { AppDependencies } from "../context/appContext.ts";
import {
  formatKeyCombo,
  shortcutGroups,
} from "../shared/shortcuts/shortcutCatalog.ts";
import { createShortcutHelpStore } from "../store/shortcutHelpStore.ts";
import { ShortcutHelpButton } from "./ShortcutHelpButton.tsx";
import { ShortcutHelpDialog } from "./ShortcutHelpDialog.tsx";

function renderHelp() {
  const dependencies = { shortcutHelp: createShortcutHelpStore() };
  return renderToStaticMarkup(
    <AppProvider value={dependencies as AppDependencies}>
      <ShortcutHelpButton />
      <ShortcutHelpDialog />
    </AppProvider>,
  );
}

// Mirrors the escaping renderToStaticMarkup applies to text content.
function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

describe("ShortcutHelpDialog", () => {
  // The list's content is owned by shortcutCatalog.test.ts; this only checks
  // that every group, entry, key and context reaches the markup.
  it("renders every group, entry, key and context in the catalog", () => {
    const output = renderHelp();
    for (const group of shortcutGroups) {
      expect(output).toContain(`<h3>${escapeHtml(group.title)}</h3>`);
      for (const entry of group.entries) {
        expect(output).toContain(`<dt>${escapeHtml(entry.description)}</dt>`);
        for (const combo of entry.combos) {
          for (const key of formatKeyCombo(combo)) {
            expect(output).toContain(`<kbd>${escapeHtml(key)}</kbd>`);
          }
          if (combo.context) {
            expect(output).toContain(`>${escapeHtml(combo.context)}</span>`);
          }
        }
      }
    }
  });

  it("renders named help controls and a dialog that starts closed", () => {
    const output = renderHelp();
    expect(output).toContain('aria-label="Keyboard shortcuts"');
    expect(output).toContain('title="Keyboard shortcuts (?)"');
    expect(output).toContain('aria-label="Close keyboard shortcuts"');
    expect(output).toContain('aria-labelledby="shortcut-help-title"');
    expect(output).toContain(
      '<h2 id="shortcut-help-title">Keyboard Shortcuts</h2>',
    );
    expect(output).not.toMatch(/<dialog[^>]*\sopen(?:[\s=>])/);
  });
});
