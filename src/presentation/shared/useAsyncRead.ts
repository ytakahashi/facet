import { useEffect, useState } from "react";
import { type AsyncReadResult, startAsyncRead } from "./asyncRead.ts";

// A stable read callback identifies a request; undefined suspends reading.
// Reset during render so old results cannot appear under new request inputs,
// including when the same callback is enabled again after being suspended.
export function useAsyncRead<T>(read: (() => Promise<T>) | undefined) {
  const [snapshot, setSnapshot] = useState<{
    read: typeof read;
    result?: AsyncReadResult<T>;
  }>({ read });
  if (snapshot.read !== read) setSnapshot({ read });

  useEffect(() => {
    if (!read) return;
    return startAsyncRead(read, (result) => setSnapshot({ read, result }));
  }, [read]);

  if (!read) return { status: "idle" } as const;
  return snapshot.read === read && snapshot.result
    ? snapshot.result
    : ({ status: "reading" } as const);
}
