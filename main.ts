import { serveDir } from "@std/http/file-server";

const win = new Deno.BrowserWindow({ title: "Facet" });

win.bind("readTextFile", (path: unknown) => Deno.readTextFile(path as string));

const distDir = new URL("./dist", import.meta.url).pathname;

Deno.serve((req) => serveDir(req, { fsRoot: distDir }));
