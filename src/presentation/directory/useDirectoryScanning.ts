import { useEffect } from "react";
import { useBoardSession } from "../context/appContext.ts";
import { startDirectoryScanning } from "../store/directoryScanning.ts";

export function useDirectoryScanning(): void {
  const session = useBoardSession();
  useEffect(() => startDirectoryScanning(session), [session]);
}
