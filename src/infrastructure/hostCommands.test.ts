import { invoke } from "@tauri-apps/api/core";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import * as hostCommands from "./hostCommands.ts";

vi.mock("@tauri-apps/api/core");

afterEach(() => {
  vi.resetAllMocks();
});

// A misspelled command or argument name only surfaces at runtime, as an
// invoke rejection, so each call is pinned to the name and parameters of its
// command in src-tauri/src/commands.rs.
describe("hostCommands", () => {
  it.each([
    [
      "read_text_file",
      () => hostCommands.readTextFile("/a.md"),
      {
        path: "/a.md",
      },
    ],
    [
      "write_text_file",
      () => hostCommands.writeTextFile("/a.md", "# A", "rev"),
      { path: "/a.md", content: "# A", expectedRevision: "rev" },
    ],
    [
      "create_text_file",
      () => hostCommands.createTextFile("/a.md", "# A"),
      { path: "/a.md", content: "# A" },
    ],
    [
      "remove_file",
      () => hostCommands.removeFile("/a.md"),
      {
        path: "/a.md",
      },
    ],
    [
      "rename_file",
      () => hostCommands.renameFile("/a.md", "/b.md"),
      { fromPath: "/a.md", toPath: "/b.md" },
    ],
    ["read_dir", () => hostCommands.readDir("/board"), { path: "/board" }],
    ["exists", () => hostCommands.exists("/a.md"), { path: "/a.md" }],
    ["mkdir", () => hostCommands.mkdir("/board"), { path: "/board" }],
    [
      "reveal_in_finder",
      () => hostCommands.revealInFinder("/a.md"),
      {
        path: "/a.md",
      },
    ],
  ])("calls %s with its arguments", async (command, call, args) => {
    await call();

    expect(invoke).toHaveBeenCalledWith(command, args);
  });

  it("calls home_directory without arguments", async () => {
    await hostCommands.homeDirectory();

    expect(invoke).toHaveBeenCalledWith("home_directory");
  });

  it("sends an omitted revision as null", async () => {
    await hostCommands.writeTextFile("/a.md", "# A");

    expect(invoke).toHaveBeenCalledWith("write_text_file", {
      path: "/a.md",
      content: "# A",
      expectedRevision: null,
    });
  });
});
