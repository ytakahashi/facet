import { assertEquals } from "@std/assert";
import { validateBoard } from "./validate-board.ts";

const decoder = new TextDecoder();
const validatorUrl = new URL("./validate-board.ts", import.meta.url).href;

const validBoard = {
  version: 1,
  name: "Development",
  labels: [{ name: "search", color: "sapphire" }],
  columns: [{
    id: "doing",
    name: "Doing",
    cards: [{
      path: "notes/improve-search.md",
      priority: "high",
      labels: ["search"],
    }],
  }],
};

Deno.test("accepts the board shape Facet writes", async () => {
  const result = await validateBoard(validBoard, () => Promise.resolve("file"));

  assertEquals(result, { errors: [], warnings: [] });
});

Deno.test("reports schema and relationship errors", async () => {
  const result = await validateBoard({
    ...validBoard,
    custom: "lost on save",
    columns: [{
      id: "doing",
      name: "Doing",
      cards: [
        {
          path: "notes/../task.md",
          priority: "urgent",
          labels: ["undefined", "undefined"],
        },
        { path: "TASK.md", labels: [] },
      ],
    }],
  }, () => Promise.resolve("file"));

  assertEquals(result.warnings, []);
  assertEquals(result.errors, [
    "board.custom is not supported and would be lost on save",
    "board.columns[0].cards[0].priority must be low, medium, or high",
    'board.columns[0].cards[0].labels[0] references undefined label "undefined"',
    'board.columns[0].cards[0].labels[1] references undefined label "undefined"',
    'board.columns[0].cards[0].labels[1] duplicates label "undefined"',
    "board.columns[0].cards[1].path duplicates another Card after path normalization",
  ]);
});

Deno.test("keeps a missing Card recoverable by reporting a warning", async () => {
  const result = await validateBoard(
    validBoard,
    () => Promise.resolve("missing"),
  );

  assertEquals(result, {
    errors: [],
    warnings: [
      "board.columns[0].cards[0].path is missing: notes/improve-search.md",
    ],
  });
});

Deno.test("the documented CLI permissions validate a board", async () => {
  await withBoardFiles(async (boardPath) => {
    const output = await runValidator(boardPath, [
      "--allow-read",
      "--allow-env",
    ]);

    assertEquals(output.code, 0, decoder.decode(output.stderr));
    assertEquals(decoder.decode(output.stderr), "");
    assertEquals(
      decoder.decode(output.stdout),
      `Valid Facet board: ${boardPath}\n`,
    );
  });
});

Deno.test("does not report a missing runtime permission as invalid YAML", async () => {
  await withBoardFiles(async (boardPath) => {
    const output = await runValidator(boardPath, ["--allow-read"]);
    const stderr = decoder.decode(output.stderr);

    assertEquals(output.code, 1);
    assertEquals(stderr.includes("NotCapable"), true);
    assertEquals(stderr.includes("invalid YAML"), false);
  });
});

Deno.test("reports a YAML syntax failure as invalid YAML", async () => {
  await withBoardFiles(async (boardPath) => {
    await Deno.writeTextFile(boardPath, "columns: [\n");
    const output = await runValidator(boardPath, [
      "--allow-read",
      "--allow-env",
    ]);
    const stderr = decoder.decode(output.stderr);

    assertEquals(output.code, 1);
    assertEquals(stderr.includes("[error] invalid YAML:"), true);
  });
});

async function withBoardFiles(
  run: (boardPath: string) => Promise<void>,
): Promise<void> {
  const directory = await Deno.makeTempDir();
  const boardPath = `${directory}/test.board.yaml`;
  try {
    await Deno.writeTextFile(`${directory}/card.md`, "# Card\n");
    await Deno.writeTextFile(
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
    await run(boardPath);
  } finally {
    await Deno.remove(directory, { recursive: true });
  }
}

function runValidator(
  boardPath: string,
  permissions: string[],
): Promise<Deno.CommandOutput> {
  return new Deno.Command(Deno.execPath(), {
    args: ["run", ...permissions, validatorUrl, boardPath],
    stdout: "piped",
    stderr: "piped",
  }).output();
}
