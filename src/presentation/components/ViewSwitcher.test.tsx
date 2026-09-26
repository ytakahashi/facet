import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ViewSwitcher } from "./ViewSwitcher.tsx";

describe("ViewSwitcher", () => {
  it("identifies the active view on its buttons", () => {
    const board = renderToStaticMarkup(
      <ViewSwitcher mode="board" onChange={vi.fn()} />,
    );
    const table = renderToStaticMarkup(
      <ViewSwitcher mode="table" onChange={vi.fn()} />,
    );

    expect(board).toContain('aria-label="View"');
    expect(board).toContain('aria-pressed="true">Board</button>');
    expect(board).toContain('aria-pressed="false">Table</button>');
    expect(table).toContain('aria-pressed="false">Board</button>');
    expect(table).toContain('aria-pressed="true">Table</button>');
  });
});
