import { create } from "zustand";
import type { DirEntry } from "../../domain/fileSystemPort.ts";
import type { DirectorySnapshots } from "../../domain/cardDirectoryTree.ts";
import {
  canonicalCardPath,
  directoryOf,
  resolveCardPath,
  toRelativeCardPath,
} from "../../domain/boardPath.ts";
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
  invalidateFiles: (absolutePaths: readonly string[]) => void;
}

export function createDirectoryStore(
  listDirectory: (path: string) => Promise<DirEntry[]>,
) {
  let generation = 0;
  let running = 0;
  const versions = new Map<string, number>();
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
        const version = versions.get(key);
        running++;
        set({ scans: new Map(get().scans).set(key, { status: "loading" }) });
        void (async () => {
          try {
            const entries = await listDirectory(absolutePath);
            if (request !== generation || versions.get(key) !== version) return;
            set({
              snapshots: new Map(get().snapshots).set(key, entries),
              scans: new Map(get().scans).set(key, { status: "scanned" }),
            });
          } catch (error) {
            if (request !== generation || versions.get(key) !== version) return;
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
        versions.clear();
        root = boardDirectory;
        targets = new Map();
        set({ snapshots: new Map(), scans: new Map() });
      },
      stop: () => {
        generation++;
        versions.clear();
        root = undefined;
        targets = new Map();
        // The next mount renders before its effect begins a new generation.
        set({ snapshots: new Map(), scans: new Map() });
      },
      setTargets: (next) => {
        targets = next;
        pump();
      },
      invalidateFiles: (absolutePaths) => {
        if (root === undefined) return;
        const keys = new Set<string>();
        for (const path of absolutePaths) {
          const relative = toRelativeCardPath(root, path);
          if (relative.ok)
            keys.add(canonicalCardPath(directoryOf(relative.path)));
        }
        if (keys.size === 0) return;
        const scans = new Map(get().scans);
        for (const key of keys) {
          // A pre-operation read must not repopulate an invalidated listing.
          versions.set(key, (versions.get(key) ?? 0) + 1);
          // Keep the old listing on screen until a fresh read replaces it, so
          // the directory's unregistered branches do not blink out meanwhile.
          scans.delete(key);
        }
        set({ scans });
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
