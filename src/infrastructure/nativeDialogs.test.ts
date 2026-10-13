import { confirm, message } from "@tauri-apps/plugin-dialog";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { confirmAction, showError } from "./nativeDialogs.ts";

vi.mock("@tauri-apps/plugin-dialog");

afterEach(() => {
  vi.resetAllMocks();
  vi.restoreAllMocks();
});

describe("confirmAction", () => {
  it("answers with the user's choice", async () => {
    vi.mocked(confirm).mockResolvedValue(true);

    await expect(confirmAction("Discard?")).resolves.toBe(true);
    expect(confirm).toHaveBeenCalledWith("Discard?", { kind: "warning" });
  });

  it("answers no when the dialog cannot be shown", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.mocked(confirm).mockRejectedValue(new Error("no dialog"));

    await expect(confirmAction("Discard?")).resolves.toBe(false);
  });
});

describe("showError", () => {
  it("shows the text as an error", () => {
    vi.mocked(message).mockResolvedValue("Ok");

    showError("Cannot save");

    expect(message).toHaveBeenCalledWith("Cannot save", { kind: "error" });
  });

  it("does not let a failed dialog escape", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.mocked(message).mockRejectedValue(new Error("no dialog"));

    showError("Cannot save");

    await vi.waitFor(() => expect(warn).toHaveBeenCalled());
  });
});
