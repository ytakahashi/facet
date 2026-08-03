import { renameFile } from "./renameFile.ts";

const win = new Deno.BrowserWindow({ title: "Facet" });

// Deno.errors instances do not survive the binding boundary, so a missing file
// is classified here and reported as data, the same way createTextFile reports
// already-exists. Callers that repair a card's path need "nothing is there"
// told apart from "there but unreadable".
win.bind("readTextFile", async (path: unknown) => {
  try {
    return { read: true, content: await Deno.readTextFile(path as string) };
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return { read: false, reason: "not-found" } as const;
    }
    throw error;
  }
});

// Deno Desktop binding handlers must resolve to a serializable value.
// Void operations therefore return null explicitly.
win.bind(
  "writeTextFile",
  async (path: unknown, content: unknown) => {
    await Deno.writeTextFile(path as string, content as string);
    return null;
  },
);

// Exclusive through createNew rather than an exists() check followed by a
// write: creating a card's Markdown must never land on a file that is already
// there, and only the open(2) flag decides that without leaving a gap for one
// to appear in. An existing file is reported as data, the way removeFile
// reports a missing one.
// The write loops because a single write() may be partial, which would
// otherwise leave a truncated file behind a "created" result.
win.bind(
  "createTextFile",
  async (path: unknown, content: unknown) => {
    try {
      const file = await Deno.open(path as string, {
        write: true,
        createNew: true,
      });
      try {
        const bytes = new TextEncoder().encode(content as string);
        let offset = 0;
        while (offset < bytes.length) {
          const written = await file.write(bytes.subarray(offset));
          if (written === 0) {
            throw new Error(`Failed to write the complete file: ${path}`);
          }
          offset += written;
        }
      } finally {
        file.close();
      }
      return { created: true } as const;
    } catch (error) {
      if (error instanceof Deno.errors.AlreadyExists) {
        return { created: false, reason: "already-exists" } as const;
      }
      throw error;
    }
  },
);

// Deno.errors instances do not survive the binding boundary, so a missing file
// is classified here and reported as data, the same way createTextFile reports
// already-exists.
// Deno.remove without `recursive` still removes an *empty* directory, and a
// board.yaml can name one (a hand-written path, or a directory literally named
// "foo.md"), so directories are rejected explicitly rather than left to the
// missing `recursive` flag. lstat, not stat, so the check describes the path
// itself; a symlink to a Markdown file stays removable.
win.bind("removeFile", async (path: unknown) => {
  try {
    const info = await Deno.lstat(path as string);
    if (info.isDirectory) {
      return { removed: false, reason: "is-a-directory" } as const;
    }
    await Deno.remove(path as string);
    return { removed: true } as const;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return { removed: false, reason: "not-found" } as const;
    }
    throw error;
  }
});

// Kept in its own module so it can be exercised against a real file system:
// the reasons it is careful (case-insensitive volumes, hard links, the two
// meanings of NotFound) are all facts about the file system rather than about
// this application, and a stubbed test would only restate the assumptions.
win.bind(
  "renameFile",
  (from: unknown, to: unknown) => renameFile(from as string, to as string),
);

win.bind("readDir", async (path: unknown) => {
  const entries = [];
  for await (const entry of Deno.readDir(path as string)) {
    entries.push({ name: entry.name, isDirectory: entry.isDirectory });
  }
  return entries;
});

win.bind("homeDirectory", async () => Deno.env.get("HOME") ?? "/");

win.bind("exists", async (path: unknown) => {
  try {
    await Deno.stat(path as string);
    return true;
  } catch {
    return false;
  }
});

win.bind("mkdir", async (path: unknown) => {
  await Deno.mkdir(path as string, { recursive: true });
  return null;
});

// Pass-through: the menu structure (labels, ids, nesting) is built entirely
// on the frontend side, so this side stays free of any knowledge about menu
// contents.
win.bind("setApplicationMenu", async (menu: unknown) => {
  win.setApplicationMenu(menu as Deno.MenuItem[]);
  return null;
});

// There is no Deno -> webview push API, so menu clicks are delivered to the
// frontend via long-polling: the frontend awaits nextMenuClick() and this
// resolves it (or queues the click id) whenever "menuclick" fires.
const pendingMenuClicks: string[] = [];
let menuClickWaiter: ((id: string) => void) | null = null;

win.addEventListener("menuclick", (e) => {
  if (menuClickWaiter) {
    menuClickWaiter(e.detail.id);
    menuClickWaiter = null;
  } else {
    pendingMenuClicks.push(e.detail.id);
  }
});

win.bind("nextMenuClick", () => {
  const queued = pendingMenuClicks.shift();
  if (queued !== undefined) {
    return Promise.resolve(queued);
  }
  return new Promise<string>((resolve) => {
    menuClickWaiter = resolve;
  });
});

// Relative to this file, which sits one level below the project root the
// build writes dist/ into. Resolved against import.meta.url rather than the
// working directory so it holds both when run from source and from inside a
// compiled binary, where the same layout is reproduced in the virtual file
// system.
const distDir = new URL("../dist", import.meta.url).pathname;

// Loaded lazily (not as a static top-level import) to work around a Deno
// Desktop bug where a jsr:/remote import that's actually used breaks
// win.bind() bindings registered in the same module
// (https://github.com/denoland/deno/issues/35647).
Deno.serve(async (req) => {
  const { serveDir } = await import("@std/http/file-server");
  return serveDir(req, { fsRoot: distDir });
});
