import { describe, expect, it, vi } from "vite-plus/test";
import { closeModalOnEscape } from "./modalEscape.ts";

function keyDown(
  overrides: Partial<{
    key: string;
    defaultPrevented: boolean;
    isComposing: boolean;
    keyCode: number;
  }> = {},
) {
  return {
    key: "Escape",
    defaultPrevented: false,
    isComposing: false,
    keyCode: 27,
    preventDefault: vi.fn(),
    ...overrides,
  };
}

function modal(onCancel: (event: Event) => void = () => {}) {
  const dispatched: Event[] = [];
  return {
    dispatched,
    close: vi.fn(),
    dispatchEvent(event: Event) {
      dispatched.push(event);
      onCancel(event);
      return !event.defaultPrevented;
    },
  };
}

describe("closeModalOnEscape", () => {
  it("claims Escape and closes the modal after an unprevented cancel", () => {
    const event = keyDown();
    const dialog = modal();

    closeModalOnEscape(event, dialog);

    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(dialog.dispatched.map(({ type }) => type)).toEqual(["cancel"]);
    expect(dialog.dispatched[0].cancelable).toBe(true);
    expect(dialog.close).toHaveBeenCalledOnce();
  });

  it("leaves the modal open when its cancel handler prevents it", () => {
    const event = keyDown();
    const dialog = modal((cancel) => cancel.preventDefault());

    closeModalOnEscape(event, dialog);

    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(dialog.close).not.toHaveBeenCalled();
  });

  it.each([
    ["another key", keyDown({ key: "Enter" })],
    ["an Escape already prevented", keyDown({ defaultPrevented: true })],
    ["an IME composition", keyDown({ isComposing: true })],
    ["a key consumed by the IME", keyDown({ keyCode: 229 })],
  ])("ignores %s", (_, event) => {
    const dialog = modal();

    closeModalOnEscape(event, dialog);

    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(dialog.dispatched).toEqual([]);
  });

  it("leaves Escape unclaimed when no modal is open", () => {
    const event = keyDown();

    closeModalOnEscape(event, undefined);

    expect(event.preventDefault).not.toHaveBeenCalled();
  });
});
