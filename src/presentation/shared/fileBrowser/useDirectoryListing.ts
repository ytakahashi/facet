import { useCallback } from "react";
import { useDirectoryBrowsing } from "../../context/appContext.ts";
import { toUiError } from "../../errors/toUiError.ts";
import { useAsyncRead } from "../useAsyncRead.ts";

export function useDirectoryListing(path: string) {
  const { listDirectory } = useDirectoryBrowsing();
  const read = useCallback(() => listDirectory(path), [listDirectory, path]);
  const result = useAsyncRead(read);
  return {
    entries: result.status === "ready" ? result.value : [],
    error: result.status === "error" ? toUiError(result.error) : undefined,
    isLoading: result.status === "reading",
  };
}
