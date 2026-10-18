import { create } from "zustand";
import type { DirEntry } from "../../domain/fileSystemPort.ts";
import type { DirectorySnapshots } from "../../domain/cardDirectoryTree.ts";
import { resolveCardPath } from "../../domain/boardPath.ts";
import { toUiError } from "../errors/toUiError.ts";

export type DirectoryScan =
  | { status: "loading" }
  | { status: "scanned" }
  | { status: "failed"; message: string };

export interface DirectoryState {
  snapshots: DirectorySnapshots;
  // An absent key is unscanned, including targets waiting for a host slot.
  scans: ReadonlyMap<string, DirectoryScan>;
  begin: (boardDirectory: string) => void;
  stop: () => void;
  setTargets: (targets: ReadonlyMap<string, string>) => void;
  retry: (key: string) => void;
}

export function createDirectoryStore(
  listDirectory: (path: string) => Promise<DirEntry[]>,
) {
  let generation = 0;
  let running = 0;
  let root: string | undefined;
  let targets: ReadonlyMap<string, string> = new Map();
  return create<DirectoryState>((set, get) => {
    function pump() {
      if (root === undefined) return;
      for (const [key, path] of targets) {
        if (running >= 4) break;
        if (get().scans.has(key)) continue;
        const resolved = resolveCardPath(root, path);
        // Targets come from resolved tree paths; never throw inside a subscriber.
        if (!resolved.ok) continue;
        // resolveCardPath turns the root of "/" into "", so name the root directly.
        const absolutePath = path === "" ? root : resolved.absolutePath;
        const request = generation;
        running++;
        set({ scans: new Map(get().scans).set(key, { status: "loading" }) });
        void (async () => {
          try {
            const entries = await listDirectory(absolutePath);
            if (request !== generation) return;
            set({
              snapshots: new Map(get().snapshots).set(key, entries),
              scans: new Map(get().scans).set(key, { status: "scanned" }),
            });
          } catch (error) {
            if (request !== generation) return;
            set({
              scans: new Map(get().scans).set(key, {
                status: "failed",
                message: toUiError(error).message,
              }),
            });
          } finally {
            // Old requests still occupy host slots until they actually finish.
            running--;
            pump();
          }
        })();
      }
    }
    return {
      snapshots: new Map(),
      scans: new Map(),
      begin: (boardDirectory) => {
        generation++;
        root = boardDirectory;
        targets = new Map();
        set({ snapshots: new Map(), scans: new Map() });
      },
      stop: () => {
        generation++;
        root = undefined;
        targets = new Map();
        // The next mount renders before its effect begins a new generation.
        set({ snapshots: new Map(), scans: new Map() });
      },
      setTargets: (next) => {
        targets = next;
        pump();
      },
      retry: (key) => {
        if (!targets.has(key) || get().scans.get(key)?.status !== "failed")
          return;
        const scans = new Map(get().scans);
        scans.delete(key);
        set({ scans });
        pump();
      },
    };
  });
}
