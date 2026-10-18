import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vite-plus/test";
import { ViewSwitcher } from "./ViewSwitcher.tsx";

describe("ViewSwitcher", () => {
  it("identifies the active view on its buttons", () => {
    const board = renderToStaticMarkup(
      <ViewSwitcher mode="board" onChange={vi.fn()} />,
    );
    const table = renderToStaticMarkup(
      <ViewSwitcher mode="table" onChange={vi.fn()} />,
    );

    const directory = renderToStaticMarkup(
      <ViewSwitcher mode="directory" onChange={vi.fn()} />,
    );
    expect(directory).toContain('aria-pressed="true">Files</button>');
    expect(directory).toContain('aria-pressed="false">Board</button>');
    expect(directory).toContain('aria-pressed="false">Table</button>');
    expect(table).toContain('aria-pressed="false">Files</button>');
    expect(board).toContain('aria-label="View"');
    expect(board).toContain('aria-pressed="true">Board</button>');
    expect(board).toContain('aria-pressed="false">Table</button>');
    expect(table).toContain('aria-pressed="false">Board</button>');
    expect(table).toContain('aria-pressed="true">Table</button>');
  });
});
