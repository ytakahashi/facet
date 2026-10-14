export type AsyncReadResult<T> =
  | { status: "ready"; value: T }
  | { status: "error"; error: unknown };

// Cleanup invalidates both success and failure, including a read that settles
// after its component unmounts or a newer request starts.
export function startAsyncRead<T>(
  read: () => Promise<T>,
  publish: (result: AsyncReadResult<T>) => void,
): () => void {
  let active = true;
  async function run(): Promise<AsyncReadResult<T>> {
    try {
      return { status: "ready", value: await read() };
    } catch (error) {
      return { status: "error", error };
    }
  }
  void run().then((result) => {
    if (active) publish(result);
  });
  return () => {
    active = false;
  };
}
