import { afterEach, describe, expect, it, vi } from "vitest";
import { DenoFileSystemAdapter } from "./denoFileSystemAdapter.ts";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("DenoFileSystemAdapter", () => {
  it("maps an exclusive-create collision to a typed file-system error", async () => {
    vi.stubGlobal("bindings", {
      createTextFile: vi.fn().mockResolvedValue({
        created: false,
        reason: "already-exists",
      }),
    });
    const fileSystem = new DenoFileSystemAdapter();

    const act = () => fileSystem.createTextFile("/board/card.md", "# Card\n");

    await expect(act).rejects.toMatchObject({
      name: "FileSystemError",
      kind: "already-exists",
      operation: "create-file",
      path: "/board/card.md",
    });
  });

  it("wraps raw binding failures with operation context", async () => {
    const cause = new Error("Permission denied");
    vi.stubGlobal("bindings", {
      readTextFile: vi.fn().mockRejectedValue(cause),
    });
    const fileSystem = new DenoFileSystemAdapter();

    const act = () => fileSystem.readTextFile("/board/card.md");

    await expect(act).rejects.toMatchObject({
      name: "FileSystemError",
      kind: "operation-failed",
      operation: "read-file",
      path: "/board/card.md",
      cause,
    });
  });
});
