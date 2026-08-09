import { assertEquals, assertRejects } from "@std/assert";
import {
  createTextFile,
  exists,
  mkdir,
  readDir,
  readTextFile,
  removeFile,
  writeTextFile,
} from "./fileSystem.ts";

// Run against a real directory rather than a stub, for the reason
// renameFile.test.ts gives: what these functions guard against - an empty
// directory that removes like a file, a symlink that answers differently to
// stat and lstat, a write that lands short - are rules of the file system, and
// a stub would answer with the assumptions being tested.
async function withTempDir(
  run: (dir: string) => Promise<void>,
): Promise<void> {
  const dir = await Deno.makeTempDir({ prefix: "facet-fs-" });
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

Deno.test("readTextFile reads a file's content", async () => {
  await withTempDir(async (dir) => {
    await Deno.writeTextFile(`${dir}/card.md`, "# Card\n");

    assertEquals(await readTextFile(`${dir}/card.md`), {
      read: true,
      content: "# Card\n",
    });
  });
});

Deno.test("readTextFile reports a file that is not there", async () => {
  await withTempDir(async (dir) => {
    assertEquals(await readTextFile(`${dir}/gone.md`), {
      read: false,
      reason: "not-found",
    });
  });
});

Deno.test("readTextFile fails rather than reporting an unreadable path", async () => {
  await withTempDir(async (dir) => {
    await Deno.mkdir(`${dir}/ideas.md`);

    // Only "nothing is there" is data. Anything else is a failure, so a caller
    // repairing a card's path never mistakes a path it could not read for one
    // whose file is gone.
    await assertRejects(() => readTextFile(`${dir}/ideas.md`));
  });
});

Deno.test("writeTextFile replaces the whole of an existing file", async () => {
  await withTempDir(async (dir) => {
    await Deno.writeTextFile(`${dir}/card.md`, "# A much longer card\n");

    await writeTextFile(`${dir}/card.md`, "# Card\n");

    assertEquals(await Deno.readTextFile(`${dir}/card.md`), "# Card\n");
  });
});

Deno.test("createTextFile creates a file with its content", async () => {
  await withTempDir(async (dir) => {
    assertEquals(await createTextFile(`${dir}/card.md`, "# Card\n"), {
      created: true,
    });
    assertEquals(await Deno.readTextFile(`${dir}/card.md`), "# Card\n");
  });
});

Deno.test("createTextFile writes content larger than a single write", async () => {
  await withTempDir(async (dir) => {
    // Long enough that the write can be split, which is what the loop inside
    // createTextFile exists for: a partial write must never be reported as a
    // created file.
    const content = "# Card\n\n" + "body\n".repeat(400_000);

    assertEquals(await createTextFile(`${dir}/card.md`, content), {
      created: true,
    });
    assertEquals(await Deno.readTextFile(`${dir}/card.md`), content);
  });
});

Deno.test("createTextFile refuses a file that is already there", async () => {
  await withTempDir(async (dir) => {
    await Deno.writeTextFile(`${dir}/card.md`, "# Taken\n");

    assertEquals(await createTextFile(`${dir}/card.md`, "# Card\n"), {
      created: false,
      reason: "already-exists",
    });
    assertEquals(await Deno.readTextFile(`${dir}/card.md`), "# Taken\n");
  });
});

Deno.test("createTextFile refuses a directory in the way", async () => {
  await withTempDir(async (dir) => {
    await Deno.mkdir(`${dir}/ideas.md`);

    assertEquals(await createTextFile(`${dir}/ideas.md`, "# Card\n"), {
      created: false,
      reason: "already-exists",
    });
  });
});

Deno.test("removeFile removes a file", async () => {
  await withTempDir(async (dir) => {
    await Deno.writeTextFile(`${dir}/card.md`, "# Card\n");

    assertEquals(await removeFile(`${dir}/card.md`), { removed: true });
    assertEquals(await fileNames(dir), []);
  });
});

Deno.test("removeFile refuses an empty directory", async () => {
  await withTempDir(async (dir) => {
    await Deno.mkdir(`${dir}/ideas.md`);

    // Deno.remove without `recursive` takes an empty directory happily, so
    // this is the check standing between a hand-written board.yaml path and a
    // directory silently disappearing.
    assertEquals(await removeFile(`${dir}/ideas.md`), {
      removed: false,
      reason: "is-a-directory",
    });
    assertEquals(await fileNames(dir), ["ideas.md"]);
  });
});

Deno.test("removeFile reports a file that is not there", async () => {
  await withTempDir(async (dir) => {
    assertEquals(await removeFile(`${dir}/gone.md`), {
      removed: false,
      reason: "not-found",
    });
  });
});

Deno.test("removeFile removes a symlink and leaves its target", async () => {
  await withTempDir(async (dir) => {
    await Deno.writeTextFile(`${dir}/target.md`, "# Card\n");
    await Deno.symlink(`${dir}/target.md`, `${dir}/card.md`);

    // lstat describes the link itself, so the link is a file and goes; had the
    // check used stat, a symlink to a directory would have been removable too.
    assertEquals(await removeFile(`${dir}/card.md`), { removed: true });
    assertEquals(await fileNames(dir), ["target.md"]);
  });
});

Deno.test("removeFile refuses a symlink that points at a directory", async () => {
  await withTempDir(async (dir) => {
    await Deno.mkdir(`${dir}/ideas`);
    await Deno.symlink(`${dir}/ideas`, `${dir}/link.md`);

    // The link is not a directory, so it is removed; the directory it pointed
    // at stays. Only the one directory entry goes.
    assertEquals(await removeFile(`${dir}/link.md`), { removed: true });
    assertEquals(await fileNames(dir), ["ideas"]);
  });
});

Deno.test("readDir tells files and directories apart", async () => {
  await withTempDir(async (dir) => {
    await Deno.writeTextFile(`${dir}/card.md`, "# Card\n");
    await Deno.mkdir(`${dir}/ideas`);

    const entries = await readDir(dir);

    assertEquals(entries.sort((a, b) => a.name.localeCompare(b.name)), [
      { name: "card.md", isDirectory: false },
      { name: "ideas", isDirectory: true },
    ]);
  });
});

Deno.test("readDir answers with nothing for an empty directory", async () => {
  await withTempDir(async (dir) => {
    assertEquals(await readDir(dir), []);
  });
});

Deno.test("exists answers for files, directories and what is not there", async () => {
  await withTempDir(async (dir) => {
    await Deno.writeTextFile(`${dir}/card.md`, "# Card\n");
    await Deno.mkdir(`${dir}/ideas`);

    assertEquals(await exists(`${dir}/card.md`), true);
    assertEquals(await exists(`${dir}/ideas`), true);
    assertEquals(await exists(`${dir}/gone.md`), false);
  });
});

Deno.test("exists follows a symlink to whatever it points at", async () => {
  await withTempDir(async (dir) => {
    await Deno.writeTextFile(`${dir}/target.md`, "# Card\n");
    await Deno.symlink(`${dir}/target.md`, `${dir}/card.md`);
    await Deno.symlink(`${dir}/nowhere.md`, `${dir}/dangling.md`);

    // stat, not lstat: a dangling link is a card whose file is gone, which is
    // exactly what the caller wants to hear about.
    assertEquals(await exists(`${dir}/card.md`), true);
    assertEquals(await exists(`${dir}/dangling.md`), false);
  });
});

Deno.test("mkdir creates missing parent directories", async () => {
  await withTempDir(async (dir) => {
    await mkdir(`${dir}/boards/personal`);

    assertEquals((await Deno.stat(`${dir}/boards/personal`)).isDirectory, true);
  });
});

Deno.test("mkdir accepts a directory that is already there", async () => {
  await withTempDir(async (dir) => {
    await Deno.mkdir(`${dir}/boards`);
    await Deno.writeTextFile(`${dir}/boards/board.yaml`, "columns: []\n");

    await mkdir(`${dir}/boards`);

    // Nothing inside is disturbed: the config directory is created this way on
    // every launch, long after it first held anything.
    assertEquals(await fileNames(`${dir}/boards`), ["board.yaml"]);
  });
});
