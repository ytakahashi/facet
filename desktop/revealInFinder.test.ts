import { assertEquals } from "@std/assert";
import { revealInFinder } from "./revealInFinder.ts";

async function withTempDir(
  run: (directory: string) => Promise<void>,
): Promise<void> {
  const directory = await Deno.makeTempDir({ prefix: "facet-finder-" });
  try {
    await run(directory);
  } finally {
    await Deno.remove(directory, { recursive: true });
  }
}

Deno.test("reveals an existing file with open -R", async () => {
  await withTempDir(async (directory) => {
    const path = `${directory}/card.md`;
    await Deno.writeTextFile(path, "# Card\n");
    const calls: string[][] = [];

    const result = await revealInFinder(path, (args) => {
      calls.push(args);
      return Promise.resolve(true);
    });

    assertEquals(result, { revealed: true });
    assertEquals(calls, [["-R", path]]);
  });
});

Deno.test("opens the parent when the file is gone", async () => {
  await withTempDir(async (directory) => {
    const calls: string[][] = [];

    const result = await revealInFinder(`${directory}/missing.md`, (args) => {
      calls.push(args);
      return Promise.resolve(true);
    });

    assertEquals(result, { revealed: true });
    assertEquals(calls, [[directory]]);
  });
});

Deno.test("uses the root directory as the parent of a root-level file", async () => {
  const path = `/facet-missing-${crypto.randomUUID()}.md`;
  const calls: string[][] = [];

  const result = await revealInFinder(path, (args) => {
    calls.push(args);
    return Promise.resolve(true);
  });

  assertEquals(result, { revealed: true });
  assertEquals(calls, [["/"]]);
});

Deno.test("does not start Finder when neither file nor parent exists", async () => {
  await withTempDir(async (directory) => {
    const calls: string[][] = [];

    const result = await revealInFinder(
      `${directory}/missing/card.md`,
      (args) => {
        calls.push(args);
        return Promise.resolve(true);
      },
    );

    assertEquals(result, { revealed: false, reason: "not-found" });
    assertEquals(calls, []);
  });
});

Deno.test("reports an open failure without exposing a process error", async () => {
  await withTempDir(async (directory) => {
    const path = `${directory}/card.md`;
    await Deno.writeTextFile(path, "# Card\n");

    assertEquals(
      await revealInFinder(path, () => Promise.resolve(false)),
      { revealed: false, reason: "failed" },
    );
    assertEquals(
      await revealInFinder(
        path,
        () => Promise.reject(new Error("open failed")),
      ),
      { revealed: false, reason: "failed" },
    );
  });
});
