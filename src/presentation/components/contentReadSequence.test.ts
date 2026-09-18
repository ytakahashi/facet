import { describe, expect, it } from "vitest";
import { createContentReadSequence } from "./contentReadSequence.ts";

describe("createContentReadSequence", () => {
  it("keeps only the newest read current", () => {
    const sequence = createContentReadSequence();
    const first = sequence.begin();
    const second = sequence.begin();

    expect(sequence.isCurrent(first)).toBe(false);
    expect(sequence.isCurrent(second)).toBe(true);
  });

  it("invalidates the active read when its dialog session ends", () => {
    const sequence = createContentReadSequence();
    const closed = sequence.begin();

    sequence.invalidate();
    const reopened = sequence.begin();

    expect(sequence.isCurrent(closed)).toBe(false);
    expect(sequence.isCurrent(reopened)).toBe(true);
  });
});
