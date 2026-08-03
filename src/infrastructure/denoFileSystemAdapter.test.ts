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

  it("maps a missing file reported by the remove binding to a typed file-system error", async () => {
    vi.stubGlobal("bindings", {
      removeFile: vi.fn().mockResolvedValue({
        removed: false,
        reason: "not-found",
      }),
    });
    const fileSystem = new DenoFileSystemAdapter();

    const act = () => fileSystem.removeFile("/board/card.md");

    await expect(act).rejects.toMatchObject({
      name: "FileSystemError",
      kind: "not-found",
      operation: "remove-file",
      path: "/board/card.md",
    });
  });

  it("maps a directory reported by the remove binding to a typed file-system error", async () => {
    vi.stubGlobal("bindings", {
      removeFile: vi.fn().mockResolvedValue({
        removed: false,
        reason: "is-a-directory",
      }),
    });
    const fileSystem = new DenoFileSystemAdapter();

    const act = () => fileSystem.removeFile("/board/notes.md");

    await expect(act).rejects.toMatchObject({
      name: "FileSystemError",
      kind: "is-a-directory",
      operation: "remove-file",
      path: "/board/notes.md",
    });
  });

  it("wraps a failing remove binding with operation context", async () => {
    const cause = new Error("Permission denied");
    vi.stubGlobal("bindings", {
      removeFile: vi.fn().mockRejectedValue(cause),
    });
    const fileSystem = new DenoFileSystemAdapter();

    const act = () => fileSystem.removeFile("/board/card.md");

    await expect(act).rejects.toMatchObject({
      name: "FileSystemError",
      kind: "operation-failed",
      operation: "remove-file",
      path: "/board/card.md",
      cause,
    });
  });

  it("resolves when the rename binding reports the file was moved", async () => {
    const renameFile = vi.fn().mockResolvedValue({ renamed: true });
    vi.stubGlobal("bindings", { renameFile });
    const fileSystem = new DenoFileSystemAdapter();

    await expect(
      fileSystem.renameFile("/board/card.md", "/board/ideas/card.md"),
    ).resolves.toBeUndefined();
    expect(renameFile).toHaveBeenCalledWith(
      "/board/card.md",
      "/board/ideas/card.md",
    );
  });

  it("reports an occupied rename destination against the destination path", async () => {
    vi.stubGlobal("bindings", {
      renameFile: vi.fn().mockResolvedValue({
        renamed: false,
        reason: "already-exists",
      }),
    });
    const fileSystem = new DenoFileSystemAdapter();

    const act = () =>
      fileSystem.renameFile("/board/card.md", "/board/ideas/card.md");

    await expect(act).rejects.toMatchObject({
      name: "FileSystemError",
      kind: "already-exists",
      operation: "rename-file",
      path: "/board/ideas/card.md",
    });
  });

  it("reports a directory at the rename destination against the destination path", async () => {
    vi.stubGlobal("bindings", {
      renameFile: vi.fn().mockResolvedValue({
        renamed: false,
        reason: "is-a-directory",
      }),
    });
    const fileSystem = new DenoFileSystemAdapter();

    const act = () =>
      fileSystem.renameFile("/board/card.md", "/board/ideas.md");

    await expect(act).rejects.toMatchObject({
      name: "FileSystemError",
      kind: "is-a-directory",
      operation: "rename-file",
      path: "/board/ideas.md",
    });
  });

  it("reports a missing rename source against the source path", async () => {
    vi.stubGlobal("bindings", {
      renameFile: vi.fn().mockResolvedValue({
        renamed: false,
        reason: "not-found",
      }),
    });
    const fileSystem = new DenoFileSystemAdapter();

    const act = () =>
      fileSystem.renameFile("/board/card.md", "/board/ideas/card.md");

    await expect(act).rejects.toMatchObject({
      name: "FileSystemError",
      kind: "not-found",
      operation: "rename-file",
      path: "/board/card.md",
    });
  });

  it("wraps a failing rename binding with operation context", async () => {
    const cause = new Error("Permission denied");
    vi.stubGlobal("bindings", {
      renameFile: vi.fn().mockRejectedValue(cause),
    });
    const fileSystem = new DenoFileSystemAdapter();

    const act = () =>
      fileSystem.renameFile("/board/card.md", "/board/ideas/card.md");

    await expect(act).rejects.toMatchObject({
      name: "FileSystemError",
      kind: "operation-failed",
      operation: "rename-file",
      path: "/board/card.md",
      cause,
    });
  });

  it("returns the content reported by the read binding", async () => {
    vi.stubGlobal("bindings", {
      readTextFile: vi.fn().mockResolvedValue({
        read: true,
        content: "# Card\n",
      }),
    });
    const fileSystem = new DenoFileSystemAdapter();

    await expect(fileSystem.readTextFile("/board/card.md")).resolves.toBe(
      "# Card\n",
    );
  });

  it("maps a missing file reported by the read binding to a typed file-system error", async () => {
    vi.stubGlobal("bindings", {
      readTextFile: vi.fn().mockResolvedValue({
        read: false,
        reason: "not-found",
      }),
    });
    const fileSystem = new DenoFileSystemAdapter();

    const act = () => fileSystem.readTextFile("/board/card.md");

    await expect(act).rejects.toMatchObject({
      name: "FileSystemError",
      kind: "not-found",
      operation: "read-file",
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
