import { spawnSync } from "node:child_process";
import { cp, mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vite-plus/test";
import { validateBoard } from "./validate-board.mts";

const validBoard = {
  version: 1,
  name: "Development",
  labels: [{ name: "search", color: "sapphire" }],
  columns: [
    {
      id: "doing",
      name: "Doing",
      cards: [
        {
          path: "notes/improve-search.md",
          labels: ["search"],
        },
      ],
    },
  ],
};

test("accepts the board shape Facet writes", async () => {
  const result = await validateBoard(validBoard, () => Promise.resolve("file"));

  expect(result).toEqual({ errors: [], warnings: [] });
});

test("reports schema and relationship errors", async () => {
  const result = await validateBoard(
    {
      ...validBoard,
      custom: "lost on save",
      columns: [
        {
          id: "doing",
          name: "Doing",
          cards: [
            {
              path: "notes/../task.md",
              priority: "high",
              labels: ["undefined", "undefined"],
            },
            { path: "TASK.md", labels: [] },
          ],
        },
      ],
    },
    () => Promise.resolve("file"),
  );

  expect(result.warnings).toEqual([]);
  expect(result.errors).toEqual([
    "board.custom is not supported and would be lost on save",
    "board.columns[0].cards[0].priority is not supported and would be lost on save",
    'board.columns[0].cards[0].labels[0] references undefined label "undefined"',
    'board.columns[0].cards[0].labels[1] references undefined label "undefined"',
    'board.columns[0].cards[0].labels[1] duplicates label "undefined"',
    "board.columns[0].cards[1].path duplicates another Card after path normalization",
  ]);
});

test("keeps a missing Card recoverable by reporting a warning", async () => {
  const result = await validateBoard(validBoard, () =>
    Promise.resolve("missing"),
  );

  expect(result).toEqual({
    errors: [],
    warnings: [
      "board.columns[0].cards[0].path is missing: notes/improve-search.md",
    ],
  });
});

test("Node validates a board with the skill copied outside the repository", async () => {
  await withBoardFiles(async (directory, boardPath, validatorPath) => {
    const output = runValidator(directory, validatorPath, [boardPath]);

    expect(output.status, output.stderr).toBe(0);
    expect(output.stderr).toBe("");
    expect(output.stdout).toBe(`Valid Facet board: ${boardPath}\n`);
  });
});

test("reports a YAML syntax failure as invalid YAML", async () => {
  await withBoardFiles(async (directory, boardPath, validatorPath) => {
    await writeFile(boardPath, "columns: [\n");
    const output = runValidator(directory, validatorPath, [boardPath]);

    expect(output.status).toBe(1);
    expect(output.stderr).toContain("[error] invalid YAML:");
  });
});

test("reports missing cards as warnings through the Node CLI", async () => {
  await withBoardFiles(async (directory, boardPath, validatorPath) => {
    await rm(join(directory, "boards/card.md"));
    const output = runValidator(directory, validatorPath, [boardPath]);

    expect(output.status).toBe(0);
    expect(output.stderr).toContain(
      "[warning] board.columns[0].cards[0].path is missing: card.md",
    );
    expect(output.stdout).toContain("Valid Facet board with 1 warning(s)");
  });
});

test("reports a directory card as a warning through the Node CLI", async () => {
  await withBoardFiles(async (directory, boardPath, validatorPath) => {
    await rm(join(directory, "boards/card.md"));
    await mkdir(join(directory, "boards/card.md"));
    const output = runValidator(directory, validatorPath, [boardPath]);

    expect(output.status).toBe(0);
    expect(output.stderr).toContain(
      "[warning] board.columns[0].cards[0].path is directory: card.md",
    );
  });
});

test("reports a missing board without classifying it as invalid YAML", async () => {
  await withBoardFiles(async (directory, boardPath, validatorPath) => {
    await rm(boardPath);
    const output = runValidator(directory, validatorPath, [boardPath]);

    expect(output.status).toBe(1);
    expect(output.stderr).toContain("[error] cannot read board:");
    expect(output.stderr).not.toContain("invalid YAML");
  });
});

test("reports schema errors with a failing exit code through the Node CLI", async () => {
  await withBoardFiles(async (directory, boardPath, validatorPath) => {
    await writeFile(
      boardPath,
      "version: 2\nname: Test\nlabels: []\ncolumns: []\n",
    );
    const output = runValidator(directory, validatorPath, [boardPath]);

    expect(output.status).toBe(1);
    expect(output.stderr).toContain("[error] board.version must be 1");
    expect(output.stdout).toBe("");
  });
});

test.each([{ args: [] }, { args: ["one.yaml", "two.yaml"] }])(
  "rejects an invalid number of CLI arguments: $args",
  ({ args }) => {
    const output = spawnSync(
      process.execPath,
      [
        fileURLToPath(new URL("./validate-board.mts", import.meta.url)),
        ...args,
      ],
      { encoding: "utf8" },
    );

    expect(output.error).toBeUndefined();
    expect(output.status).toBe(2);
    expect(output.stderr).toBe("Usage: validate-board.mts <board-path>\n");
  },
);

async function withBoardFiles(
  run: (
    directory: string,
    boardPath: string,
    validatorPath: string,
  ) => Promise<void>,
): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), "facet-validator-"));
  try {
    // A CommonJS parent and no node_modules exercise the distributed skill contract.
    await writeFile(join(directory, "package.json"), '{"type":"commonjs"}');
    const scriptsDirectory = join(directory, "skill/scripts");
    await cp(new URL("./", import.meta.url), scriptsDirectory, {
      recursive: true,
      filter: (source) => !source.endsWith(".test.ts"),
    });
    await mkdir(join(directory, "boards"));
    const boardPath = join(directory, "boards/test.board.yaml");
    await writeFile(join(directory, "boards/card.md"), "# Card\n");
    await writeFile(
      boardPath,
      [
        "version: 1",
        "name: Test",
        "labels: []",
        "columns:",
        "  - id: todo",
        "    name: Todo",
        "    cards:",
        "      - path: card.md",
        "        labels: []",
        "",
      ].join("\n"),
    );
    await run(
      directory,
      boardPath,
      join(scriptsDirectory, "validate-board.mts"),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

function runValidator(
  directory: string,
  validatorPath: string,
  args: string[],
) {
  const output = spawnSync(process.execPath, [validatorPath, ...args], {
    cwd: directory,
    encoding: "utf8",
  });
  expect(output.error).toBeUndefined();
  return output;
}
