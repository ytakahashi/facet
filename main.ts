const win = new Deno.BrowserWindow({ title: "Facet" });

win.bind("readTextFile", (path: unknown) => Deno.readTextFile(path as string));

win.bind(
  "writeTextFile",
  async (path: unknown, content: unknown) => {
    await Deno.writeTextFile(path as string, content as string);
    return null;
  },
);

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

const distDir = new URL("./dist", import.meta.url).pathname;

// Loaded lazily (not as a static top-level import) to work around a Deno
// Desktop bug where a jsr:/remote import that's actually used breaks
// win.bind() bindings registered in the same module
// (https://github.com/denoland/deno/issues/35647).
Deno.serve(async (req) => {
  const { serveDir } = await import("@std/http/file-server");
  return serveDir(req, { fsRoot: distDir });
});
