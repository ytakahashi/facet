import { describe, expect, it, vi } from "vite-plus/test";
import { buildDirectoryContextMenu } from "./directoryContextMenu.ts";

describe("buildDirectoryContextMenu", () => {
  it("offers relative and absolute paths and Finder using the displayed spelling", () => {
    const copyText = vi.fn();
    const reveal = vi.fn();
    const entries = buildDirectoryContextMenu(
      {
        kind: "directory",
        key: "docs/design",
        name: "Design",
        path: "Docs/Design",
        children: [],
      },
      "/board/",
      { copyText, reveal },
    );
    expect(
      entries.map((entry) =>
        entry.kind === "item" ? entry.label : entry.kind,
      ),
    ).toEqual([
      "Copy Path",
      "Copy Absolute Path",
      "separator",
      "Reveal in Finder",
    ]);
    for (const entry of entries) {
      if (entry.kind === "item") {
        expect(entry.enabled).toBe(true);
        entry.onSelect();
      }
    }
    expect(copyText.mock.calls).toEqual([
      ["Docs/Design"],
      ["/board/Docs/Design"],
    ]);
    expect(reveal).toHaveBeenCalledExactlyOnceWith("/board/Docs/Design");
  });
});
