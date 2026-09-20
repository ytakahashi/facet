import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Board } from "../../domain/board.ts";
import type { Card } from "../../domain/card.ts";
import { InsertCardLinkDialog } from "./InsertCardLinkDialog.tsx";

function makeCard(overrides: Partial<Card>): Card {
  return {
    path: "card.md",
    fileState: "available",
    labels: [],
    displayTitle: "Card",
    ...overrides,
  };
}

function render(board: Board, fromPath = "current.md"): string {
  return renderToStaticMarkup(
    <InsertCardLinkDialog
      board={board}
      fromPath={fromPath}
      open
      onClose={() => {}}
      onSelect={() => {}}
    />,
  );
}

describe("InsertCardLinkDialog", () => {
  it("shows linkable cards with their board context", () => {
    const output = render({
      version: 1,
      name: "Board",
      labels: [],
      columns: [{
        id: "doing",
        name: "Doing",
        cards: [
          makeCard({ path: "current.md", displayTitle: "Current" }),
          makeCard({ path: "notes/target.md", displayTitle: "Target" }),
          makeCard({
            path: "missing.md",
            displayTitle: "Missing target",
            fileState: "missing",
          }),
          makeCard({
            path: "../outside.md",
            displayTitle: "Outside",
            fileState: "unresolvable",
          }),
          makeCard({
            path: "notes/reference.txt",
            displayTitle: "Non-Markdown",
            fileState: "available",
          }),
        ],
      }],
    });

    expect(output).toContain("Target");
    expect(output).toContain("notes/target.md");
    expect(output).toContain("Doing");
    expect(output).toContain("Missing target");
    expect(output).toContain("Missing</span>");
    expect(output).not.toContain("Current");
    expect(output).not.toContain("Outside");
    expect(output).not.toContain("Non-Markdown");
    expect(output).not.toContain("Hidden by filters");
    expect(output).toContain('id="insert-card-link-results"');
  });

  it("shows an empty state when there are no other linkable cards", () => {
    const output = render({
      version: 1,
      name: "Board",
      labels: [],
      columns: [{
        id: "column",
        name: "Column",
        cards: [makeCard({ path: "current.md" })],
      }],
    });

    expect(output).toContain("No cards to link");
    expect(output).not.toContain('role="listbox"');
  });
});
