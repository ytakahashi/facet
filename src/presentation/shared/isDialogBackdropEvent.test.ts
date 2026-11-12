import { describe, expect, it } from "vite-plus/test";
import { isDialogBackdropEvent } from "./isDialogBackdropEvent.ts";

const dialog = {
  getBoundingClientRect: () => ({
    left: 100,
    right: 300,
    top: 50,
    bottom: 200,
  }),
};

describe("isDialogBackdropEvent", () => {
  it.each([
    [99, 100],
    [301, 100],
    [200, 49],
    [200, 201],
  ])("recognizes backdrop coordinates (%i, %i)", (clientX, clientY) => {
    expect(
      isDialogBackdropEvent({
        target: dialog,
        currentTarget: dialog,
        clientX,
        clientY,
      }),
    ).toBe(true);
  });

  it.each([
    [200, 100],
    [100, 100],
    [300, 100],
    [200, 50],
    [200, 200],
  ])("keeps the dialog interior and edges (%i, %i)", (clientX, clientY) => {
    expect(
      isDialogBackdropEvent({
        target: dialog,
        currentTarget: dialog,
        clientX,
        clientY,
      }),
    ).toBe(false);
  });

  it("ignores events from descendants even outside the dialog bounds", () => {
    expect(
      isDialogBackdropEvent({
        target: {},
        currentTarget: dialog,
        clientX: 99,
        clientY: 49,
      }),
    ).toBe(false);
  });
});
