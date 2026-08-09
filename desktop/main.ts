import { serveDir } from "@std/http/file-server";
import { bindAll, type HostBindings } from "./bindings.ts";
import {
  createTextFile,
  exists,
  homeDirectory,
  mkdir,
  readDir,
  readTextFile,
  removeFile,
  writeTextFile,
} from "./fileSystem.ts";
import { renameFile } from "./renameFile.ts";
import { createMenuClickQueue } from "./menuClickQueue.ts";

const win = new Deno.BrowserWindow<HostBindings>({ title: "Facet" });

const menuClicks = createMenuClickQueue();
win.addEventListener("menuclick", (e) => menuClicks.push(e.detail.id));

const handlers: HostBindings = {
  readTextFile,
  writeTextFile,
  createTextFile,
  removeFile,
  renameFile,
  readDir,
  homeDirectory,
  exists,
  mkdir,
  // Pass-through: the menu structure (labels, ids, nesting) is built entirely
  // on the frontend side, so this side stays free of any knowledge about menu
  // contents.
  setApplicationMenu: async (menu) => win.setApplicationMenu(menu),
  nextMenuClick: () => menuClicks.next(),
};

bindAll(win, handlers);

// Relative to this file, which sits one level below the project root the
// build writes dist/ into. Resolved against import.meta.url rather than the
// working directory so it holds both when run from source and from inside a
// compiled binary, where the same layout is reproduced in the virtual file
// system.
const distDir = new URL("../dist", import.meta.url).pathname;

Deno.serve((req) => serveDir(req, { fsRoot: distDir }));
