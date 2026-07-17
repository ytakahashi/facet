import type { DirEntry } from "../../domain/fileSystemPort.ts";

export function joinPath(directory: string, name: string): string {
  return directory.endsWith("/")
    ? `${directory}${name}`
    : `${directory}/${name}`;
}

export function parentWithinRoot(path: string, root: string): string {
  if (path === root) return root;
  const index = path.lastIndexOf("/");
  const parent = index <= 0 ? "/" : path.slice(0, index);
  if (root === "/") return parent;
  return parent === root || parent.startsWith(`${root}/`) ? parent : root;
}

export function sortDirectoryEntries(entries: DirEntry[]): DirEntry[] {
  return [...entries].sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) {
      return a.isDirectory ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });
}
