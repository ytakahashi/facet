import { afterEach, describe, expect, it, vi } from "vitest";
import * as hostCommands from "./hostCommands.ts";
import { HostFileSystemAdapter } from "./hostFileSystemAdapter.ts";

vi.mock("./hostCommands.ts");

afterEach(() => {
  vi.resetAllMocks();
});

// Each test supplies the commands it exercises; the rest stay bare mocks.
function stubHostCommands(commands: Partial<typeof hostCommands>): void {
  for (const [name, command] of Object.entries(commands)) {
    vi.mocked(hostCommands[name as keyof typeof hostCommands])
      .mockImplementation(command as never);
  }
}

describe("HostFileSystemAdapter", () => {
  it("maps an exclusive-create collision to a typed file-system error", async () => {
    stubHostCommands({
      createTextFile: vi.fn().mockResolvedValue({
        created: false,
        reason: "already-exists",
      }),
    });
    const fileSystem = new HostFileSystemAdapter();

    const act = () => fileSystem.createTextFile("/board/card.md", "# Card\n");

    await expect(act).rejects.toMatchObject({
      name: "FileSystemError",
      kind: "already-exists",
      operation: "create-file",
      path: "/board/card.md",
    });
  });

  it("maps a missing file reported by the remove command to a typed file-system error", async () => {
    stubHostCommands({
      removeFile: vi.fn().mockResolvedValue({
        removed: false,
        reason: "not-found",
      }),
    });
    const fileSystem = new HostFileSystemAdapter();

    const act = () => fileSystem.removeFile("/board/card.md");

    await expect(act).rejects.toMatchObject({
      name: "FileSystemError",
      kind: "not-found",
      operation: "remove-file",
      path: "/board/card.md",
    });
  });

  it("maps a directory reported by the remove command to a typed file-system error", async () => {
    stubHostCommands({
      removeFile: vi.fn().mockResolvedValue({
        removed: false,
        reason: "is-a-directory",
      }),
    });
    const fileSystem = new HostFileSystemAdapter();

    const act = () => fileSystem.removeFile("/board/notes.md");

    await expect(act).rejects.toMatchObject({
      name: "FileSystemError",
      kind: "is-a-directory",
      operation: "remove-file",
      path: "/board/notes.md",
    });
  });

  it("wraps a failing remove command with operation context", async () => {
    const cause = new Error("Permission denied");
    stubHostCommands({
      removeFile: vi.fn().mockRejectedValue(cause),
    });
    const fileSystem = new HostFileSystemAdapter();

    const act = () => fileSystem.removeFile("/board/card.md");

    await expect(act).rejects.toMatchObject({
      name: "FileSystemError",
      kind: "operation-failed",
      operation: "remove-file",
      path: "/board/card.md",
      cause,
    });
  });

  it("resolves when the rename command reports the file was moved", async () => {
    const renameFile = vi.fn().mockResolvedValue({ renamed: true });
    stubHostCommands({ renameFile });
    const fileSystem = new HostFileSystemAdapter();

    await expect(
      fileSystem.renameFile("/board/card.md", "/board/ideas/card.md"),
    ).resolves.toBeUndefined();
    expect(renameFile).toHaveBeenCalledWith(
      "/board/card.md",
      "/board/ideas/card.md",
    );
  });

  it("reports an occupied rename destination against the destination path", async () => {
    stubHostCommands({
      renameFile: vi.fn().mockResolvedValue({
        renamed: false,
        reason: "already-exists",
      }),
    });
    const fileSystem = new HostFileSystemAdapter();

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
    stubHostCommands({
      renameFile: vi.fn().mockResolvedValue({
        renamed: false,
        reason: "is-a-directory",
      }),
    });
    const fileSystem = new HostFileSystemAdapter();

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
    stubHostCommands({
      renameFile: vi.fn().mockResolvedValue({
        renamed: false,
        reason: "not-found",
      }),
    });
    const fileSystem = new HostFileSystemAdapter();

    const act = () =>
      fileSystem.renameFile("/board/card.md", "/board/ideas/card.md");

    await expect(act).rejects.toMatchObject({
      name: "FileSystemError",
      kind: "not-found",
      operation: "rename-file",
      path: "/board/card.md",
    });
  });

  it("wraps a failing rename command with operation context", async () => {
    const cause = new Error("Permission denied");
    stubHostCommands({
      renameFile: vi.fn().mockRejectedValue(cause),
    });
    const fileSystem = new HostFileSystemAdapter();

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

  it("returns the content reported by the read command", async () => {
    stubHostCommands({
      readTextFile: vi.fn().mockResolvedValue({
        read: true,
        content: "# Card\n",
        revision: "revision-1",
      }),
    });
    const fileSystem = new HostFileSystemAdapter();

    await expect(fileSystem.readTextFile("/board/card.md")).resolves.toBe(
      "# Card\n",
    );
  });

  it("returns content and revision reported by the read command", async () => {
    stubHostCommands({
      readTextFile: vi.fn().mockResolvedValue({
        read: true,
        content: "# Card\n",
        revision: "revision-1",
      }),
    });
    const fileSystem = new HostFileSystemAdapter();

    await expect(
      fileSystem.readTextFileWithRevision("/board/card.md"),
    ).resolves.toEqual({ content: "# Card\n", revision: "revision-1" });
  });

  it("maps a missing file reported by the read command to a typed file-system error", async () => {
    stubHostCommands({
      readTextFile: vi.fn().mockResolvedValue({
        read: false,
        reason: "not-found",
      }),
    });
    const fileSystem = new HostFileSystemAdapter();

    const act = () => fileSystem.readTextFile("/board/card.md");

    await expect(act).rejects.toMatchObject({
      name: "FileSystemError",
      kind: "not-found",
      operation: "read-file",
      path: "/board/card.md",
    });
  });

  it("wraps raw command failures with operation context", async () => {
    const cause = new Error("Permission denied");
    stubHostCommands({
      readTextFile: vi.fn().mockRejectedValue(cause),
    });
    const fileSystem = new HostFileSystemAdapter();

    const act = () => fileSystem.readTextFile("/board/card.md");

    await expect(act).rejects.toMatchObject({
      name: "FileSystemError",
      kind: "operation-failed",
      operation: "read-file",
      path: "/board/card.md",
      cause,
    });
  });

  it("passes the expected revision to the write command and returns the next one", async () => {
    const writeTextFile = vi.fn().mockResolvedValue({
      written: true,
      revision: "revision-2",
    });
    stubHostCommands({ writeTextFile });
    const fileSystem = new HostFileSystemAdapter();

    await expect(
      fileSystem.writeTextFile("/board/card.md", "# Card\n", "revision-1"),
    ).resolves.toBe("revision-2");
    expect(writeTextFile).toHaveBeenCalledWith(
      "/board/card.md",
      "# Card\n",
      "revision-1",
    );
  });

  it("omits the optional command argument when no revision is expected", async () => {
    const writeTextFile = vi.fn().mockResolvedValue({
      written: true,
      revision: "revision-1",
    });
    stubHostCommands({ writeTextFile });
    const fileSystem = new HostFileSystemAdapter();

    await fileSystem.writeTextFile("/board/card.md", "# Card\n");

    expect(writeTextFile).toHaveBeenCalledWith(
      "/board/card.md",
      "# Card\n",
    );
  });

  it.each(["revision-mismatch", "not-found"] as const)(
    "maps a %s write result to a typed file-system error",
    async (reason) => {
      stubHostCommands({
        writeTextFile: vi.fn().mockResolvedValue({ written: false, reason }),
      });
      const fileSystem = new HostFileSystemAdapter();

      const act = () =>
        fileSystem.writeTextFile(
          "/board/card.md",
          "# Card\n",
          "revision-1",
        );

      await expect(act).rejects.toMatchObject({
        name: "FileSystemError",
        kind: reason,
        operation: "write-file",
        path: "/board/card.md",
      });
    },
  );

  it("wraps a failing write command with operation context", async () => {
    const cause = new Error("Permission denied");
    stubHostCommands({
      writeTextFile: vi.fn().mockRejectedValue(cause),
    });
    const fileSystem = new HostFileSystemAdapter();

    const act = () => fileSystem.writeTextFile("/board/card.md", "# Card\n");

    await expect(act).rejects.toMatchObject({
      name: "FileSystemError",
      kind: "operation-failed",
      operation: "write-file",
      path: "/board/card.md",
      cause,
    });
  });
});
