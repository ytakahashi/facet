import { assertEquals, assertRejects } from "@std/assert";
import { renameFile } from "./renameFile.ts";

// Run against a real directory rather than a stub: every rule this function
// follows is a rule of the file system - what an inode means, what renaming a
// hard link does, which failures come back as NotFound - and a stub would
// answer with the assumptions being tested rather than with the truth.
async function withTempDir(
  run: (dir: string) => Promise<void>,
): Promise<void> {
  const dir = await Deno.makeTempDir({ prefix: "facet-rename-" });
  try {
    await run(dir);
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
}

async function fileNames(dir: string): Promise<string[]> {
  const names: string[] = [];
  for await (const entry of Deno.readDir(dir)) names.push(entry.name);
  return names.sort();
}

Deno.test("moves a file into a subdirectory, content and all", async () => {
  await withTempDir(async (dir) => {
    await Deno.writeTextFile(`${dir}/card.md`, "# Card\n");
    await Deno.mkdir(`${dir}/ideas`);

    const result = await renameFile(`${dir}/card.md`, `${dir}/ideas/card.md`);

    assertEquals(result, { renamed: true });
    assertEquals(await fileNames(dir), ["ideas"]);
    assertEquals(await Deno.readTextFile(`${dir}/ideas/card.md`), "# Card\n");
  });
});

Deno.test("renames a file when only its letter case changes", async () => {
  await withTempDir(async (dir) => {
    await Deno.writeTextFile(`${dir}/Card.md`, "# Card\n");

    const result = await renameFile(`${dir}/Card.md`, `${dir}/card.md`);

    // Holds on both kinds of volume: where the two names are the same entry
    // the rename is a no-op on disk, and where they are not the destination
    // was free. Either way one file is left, under the new name.
    assertEquals(result, { renamed: true });
    assertEquals(await fileNames(dir), ["card.md"]);
    assertEquals(await Deno.readTextFile(`${dir}/card.md`), "# Card\n");
  });
});

Deno.test("refuses a destination that is another hard link to the same file", async () => {
  await withTempDir(async (dir) => {
    await Deno.writeTextFile(`${dir}/card.md`, "# Card\n");
    await Deno.link(`${dir}/card.md`, `${dir}/linked.md`);

    const result = await renameFile(`${dir}/card.md`, `${dir}/linked.md`);

    // The rename would report success while leaving the file at both paths.
    assertEquals(result, { renamed: false, reason: "already-exists" });
    assertEquals(await fileNames(dir), ["card.md", "linked.md"]);
  });
});

Deno.test("refuses a destination that is another hard link to the same symlink", async () => {
  await withTempDir(async (dir) => {
    await Deno.writeTextFile(`${dir}/target.md`, "# Card\n");
    await Deno.symlink(`${dir}/target.md`, `${dir}/card.md`);
    // Hard-linking a symlink links the symlink itself, so both names share one
    // inode while realPath answers about the target for either of them.
    await Deno.link(`${dir}/card.md`, `${dir}/linked.md`);

    const result = await renameFile(`${dir}/card.md`, `${dir}/linked.md`);

    assertEquals(result, { renamed: false, reason: "already-exists" });
    assertEquals(await fileNames(dir), ["card.md", "linked.md", "target.md"]);
  });
});

Deno.test("renames a symlink that has no other hard link", async () => {
  await withTempDir(async (dir) => {
    await Deno.writeTextFile(`${dir}/target.md`, "# Card\n");
    await Deno.symlink(`${dir}/target.md`, `${dir}/card.md`);

    const result = await renameFile(`${dir}/card.md`, `${dir}/renamed.md`);

    assertEquals(result, { renamed: true });
    assertEquals(await fileNames(dir), ["renamed.md", "target.md"]);
    assertEquals(await Deno.readTextFile(`${dir}/renamed.md`), "# Card\n");
  });
});

Deno.test("refuses to overwrite another file", async () => {
  await withTempDir(async (dir) => {
    await Deno.writeTextFile(`${dir}/card.md`, "# Card\n");
    await Deno.writeTextFile(`${dir}/taken.md`, "# Taken\n");

    const result = await renameFile(`${dir}/card.md`, `${dir}/taken.md`);

    assertEquals(result, { renamed: false, reason: "already-exists" });
    assertEquals(await Deno.readTextFile(`${dir}/taken.md`), "# Taken\n");
    assertEquals(await Deno.readTextFile(`${dir}/card.md`), "# Card\n");
  });
});

Deno.test("refuses a destination occupied by a directory", async () => {
  await withTempDir(async (dir) => {
    await Deno.writeTextFile(`${dir}/card.md`, "# Card\n");
    await Deno.mkdir(`${dir}/ideas.md`);

    const result = await renameFile(`${dir}/card.md`, `${dir}/ideas.md`);

    assertEquals(result, { renamed: false, reason: "is-a-directory" });
    assertEquals(await Deno.readTextFile(`${dir}/card.md`), "# Card\n");
  });
});

Deno.test("refuses a destination occupied by a dangling symlink", async () => {
  await withTempDir(async (dir) => {
    await Deno.writeTextFile(`${dir}/card.md`, "# Card\n");
    await Deno.symlink(`${dir}/nowhere.md`, `${dir}/taken.md`);

    const result = await renameFile(`${dir}/card.md`, `${dir}/taken.md`);

    assertEquals(result, { renamed: false, reason: "already-exists" });
    assertEquals(await Deno.readTextFile(`${dir}/card.md`), "# Card\n");
  });
});

Deno.test("reports a source that is not there", async () => {
  await withTempDir(async (dir) => {
    const result = await renameFile(`${dir}/gone.md`, `${dir}/card.md`);

    assertEquals(result, { renamed: false, reason: "not-found" });
  });
});

Deno.test("fails rather than blaming the source when the destination directory is missing", async () => {
  await withTempDir(async (dir) => {
    await Deno.writeTextFile(`${dir}/card.md`, "# Card\n");

    // Reported as a failure, not as a missing card file: the Markdown is still
    // where the board says it is.
    await assertRejects(
      () => renameFile(`${dir}/card.md`, `${dir}/missing/card.md`),
      Deno.errors.NotFound,
    );
    assertEquals(await Deno.readTextFile(`${dir}/card.md`), "# Card\n");
  });
});
