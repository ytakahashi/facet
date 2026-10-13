import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import * as hostCommands from "./hostCommands.ts";
import { HostFinder } from "./hostFinder.ts";

vi.mock("./hostCommands.ts");

// Each test supplies the commands it exercises; the rest stay bare mocks.
function stubHostCommands(commands: Partial<typeof hostCommands>): void {
  for (const [name, command] of Object.entries(commands)) {
    vi.mocked(hostCommands[name as keyof typeof hostCommands])
      .mockImplementation(command as never);
  }
}

describe("HostFinder", () => {
  afterEach(() => vi.resetAllMocks());

  it("passes the path through the command", async () => {
    const revealInFinder = vi.fn().mockResolvedValue({ revealed: true });
    stubHostCommands({ revealInFinder });

    await new HostFinder().reveal("/board/card.md");

    expect(revealInFinder).toHaveBeenCalledWith("/board/card.md");
  });

  it("maps a not-found result to a typed error", async () => {
    stubHostCommands({
      revealInFinder: vi.fn().mockResolvedValue({
        revealed: false,
        reason: "not-found",
      }),
    });

    await expect(new HostFinder().reveal("/board/card.md")).rejects
      .toMatchObject({ kind: "not-found", operation: "reveal" });
  });

  it("maps a rejected command to a failed reveal", async () => {
    const cause = new Error("command unavailable");
    stubHostCommands({
      revealInFinder: vi.fn().mockRejectedValue(cause),
    });

    await expect(new HostFinder().reveal("/board/card.md")).rejects
      .toMatchObject({ kind: "failed", cause });
  });
});
