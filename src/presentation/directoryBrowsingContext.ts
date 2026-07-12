import { createContext, useContext } from "react";
import type { DirEntry } from "../domain/fileSystemPort.ts";

// Same reasoning as boardStoreContext.ts: components depend on this shape,
// not on FileSystemPort or its concrete adapter.
export interface DirectoryBrowsing {
  listDirectory(path: string): Promise<DirEntry[]>;
  homeDirectory(): Promise<string>;
}

const DirectoryBrowsingContext = createContext<DirectoryBrowsing | null>(
  null,
);

export const DirectoryBrowsingProvider = DirectoryBrowsingContext.Provider;

export function useDirectoryBrowsing(): DirectoryBrowsing {
  const value = useContext(DirectoryBrowsingContext);
  if (!value) {
    throw new Error(
      "useDirectoryBrowsing must be used within a DirectoryBrowsingProvider",
    );
  }
  return value;
}
