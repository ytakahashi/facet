import { describe, expect, it, vi } from "vite-plus/test";
import { startAsyncRead } from "./asyncRead.ts";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe("startAsyncRead", () => {
  it("publishes a successful snapshot", async () => {
    const pending = deferred<string[]>();
    const publish = vi.fn();
    startAsyncRead(() => pending.promise, publish);

    expect(publish).not.toHaveBeenCalled();
    pending.resolve(["card.md"]);
    await pending.promise;
    await Promise.resolve();

    expect(publish).toHaveBeenCalledExactlyOnceWith({
      status: "ready",
      value: ["card.md"],
    });
  });

  it("publishes a rejected read as an error", async () => {
    const error = new Error("The directory could not be read");
    const publish = vi.fn();
    startAsyncRead(() => Promise.reject(error), publish);
    await Promise.resolve();
    await Promise.resolve();

    expect(publish).toHaveBeenCalledExactlyOnceWith({ status: "error", error });
  });

  it("reports synchronous read failures asynchronously", async () => {
    const error = new Error("The reader could not start");
    const publish = vi.fn();
    startAsyncRead(() => {
      throw error;
    }, publish);

    expect(publish).not.toHaveBeenCalled();
    await Promise.resolve();
    expect(publish).toHaveBeenCalledExactlyOnceWith({ status: "error", error });
  });

  it("ignores an older success after a newer read finishes", async () => {
    const first = deferred<string[]>();
    const second = deferred<string[]>();
    const publish = vi.fn();
    const cancelFirst = startAsyncRead(() => first.promise, publish);
    cancelFirst();
    startAsyncRead(() => second.promise, publish);

    second.resolve(["new.md"]);
    await second.promise;
    await Promise.resolve();
    first.resolve(["old.md"]);
    await first.promise;
    await Promise.resolve();

    expect(publish).toHaveBeenCalledExactlyOnceWith({
      status: "ready",
      value: ["new.md"],
    });
  });

  it("ignores a failure from a request whose session ended", async () => {
    const pending = deferred<string>();
    const publish = vi.fn();
    const cancel = startAsyncRead(() => pending.promise, publish);
    cancel();
    pending.reject(new Error("A closed dialog's read failed"));
    await Promise.resolve();
    await Promise.resolve();

    expect(publish).not.toHaveBeenCalled();
  });

  it("ignores a success after unmounting without a replacement read", async () => {
    const pending = deferred<string>();
    const publish = vi.fn();
    const cancel = startAsyncRead(() => pending.promise, publish);
    pending.resolve("late");
    cancel();
    await pending.promise;
    await Promise.resolve();

    expect(publish).not.toHaveBeenCalled();
  });

  it("can restart the same reader after cleanup", async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    const read = vi
      .fn()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const publish = vi.fn();
    const cancel = startAsyncRead(read, publish);
    cancel();
    startAsyncRead(read, publish);

    first.resolve("closed");
    second.resolve("reopened");
    await Promise.all([first.promise, second.promise]);

    expect(read).toHaveBeenCalledTimes(2);
    expect(publish).toHaveBeenCalledExactlyOnceWith({
      status: "ready",
      value: "reopened",
    });
  });
});
