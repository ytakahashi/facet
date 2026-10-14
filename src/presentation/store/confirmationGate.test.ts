import { describe, expect, it, vi } from "vite-plus/test";
import { createConfirmationGate } from "./confirmationGate.ts";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("createConfirmationGate", () => {
  it("passes the answer through", async () => {
    const gate = createConfirmationGate();

    await expect(gate.ask(() => Promise.resolve(true))).resolves.toBe(true);
    await expect(gate.ask(() => Promise.resolve(false))).resolves.toBe(false);
  });

  it("declines without asking while another question is open", async () => {
    const gate = createConfirmationGate();
    const answer = deferred<boolean>();
    const second = vi.fn(() => Promise.resolve(true));

    const first = gate.ask(() => answer.promise);
    await expect(gate.ask(second)).resolves.toBe(false);
    answer.resolve(true);

    await expect(first).resolves.toBe(true);
    expect(second).not.toHaveBeenCalled();
  });

  it("asks again once the open question is answered", async () => {
    const gate = createConfirmationGate();
    await gate.ask(() => Promise.resolve(false));

    await expect(gate.ask(() => Promise.resolve(true))).resolves.toBe(true);
  });

  it("asks again after a question that failed", async () => {
    const gate = createConfirmationGate();
    await expect(
      gate.ask(() => Promise.reject(new Error("no dialog"))),
    ).rejects.toThrow("no dialog");

    await expect(gate.ask(() => Promise.resolve(true))).resolves.toBe(true);
  });
});
