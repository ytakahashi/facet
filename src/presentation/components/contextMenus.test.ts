import { describe, expect, it, vi } from "vitest";
import type { ContextMenuEntry } from "../context/appContext.ts";
import { buildColumnContextMenu } from "./contextMenus.ts";

function select(entries: ContextMenuEntry[], label: string): void {
  const entry = entries.find((candidate) =>
    candidate.kind === "item" && candidate.label === label
  );
  if (entry?.kind !== "item") throw new Error(`no item labelled ${label}`);
  entry.onSelect();
}

describe("buildColumnContextMenu", () => {
  it("offers adding a card and renaming the column, both enabled", () => {
    const entries = buildColumnContextMenu({
      addCard: vi.fn(),
      rename: vi.fn(),
    });

    expect(entries.map((entry) => entry.kind === "item" && entry.enabled))
      .toEqual([true, true]);
  });

  it("routes each item to its action", () => {
    const addCard = vi.fn();
    const rename = vi.fn();
    const entries = buildColumnContextMenu({ addCard, rename });

    select(entries, "Add Card…");
    expect(addCard).toHaveBeenCalledTimes(1);
    expect(rename).not.toHaveBeenCalled();

    select(entries, "Rename Column");
    expect(rename).toHaveBeenCalledTimes(1);
  });
});
