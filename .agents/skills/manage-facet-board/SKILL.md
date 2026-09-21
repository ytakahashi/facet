---
name: manage-facet-board
description: Read, create, validate, and safely update Facet YAML boards and their Markdown cards. Use when a task involves Facet board files, card paths, columns, labels, priorities, or links between Facet cards. Do not use for developing the Facet application itself.
---

# Manage Facet boards

Operate Facet-backed directories through their YAML boards and Markdown files
while preserving Facet's file contracts and the repository's local ownership
rules.

## Before changing files

1. Read the `AGENTS.md` files that apply to the target directory.
2. Locate the target board and treat its containing directory as the board root.
3. Determine which board and Markdown files the repository permits the agent to
   modify. Do not infer ownership from a filename alone.

Repository instructions decide whether an otherwise valid operation is
authorized. This skill describes Facet's contracts, not a knowledge base's
ownership, archive, metadata, or deletion policy.

## Read the relevant contract

- Before reading or changing a board, read
  [references/board-format.md](references/board-format.md).
- Before creating, renaming, moving, or linking Markdown cards, read
  [references/markdown-cards.md](references/markdown-cards.md).
- When application capabilities, external changes, or conflict handling affect
  the task, read
  [references/capabilities-and-concurrency.md](references/capabilities-and-concurrency.md).

Read only the references needed for the current task.

## Workflow

1. Read the complete current board before changing it.
2. Preserve column and card order unless the requested operation changes it.
3. Use only fields and values supported by the board format.
4. Keep every card path relative to the board root and keep label references in
   step with the board's label registry.
5. Make the smallest change allowed by the repository's ownership rules.
6. After changing a board, run the included validator:

   ```sh
   deno run --allow-read --allow-env <skill-directory>/scripts/validate-board.ts <board-path>
   ```

7. Report changed files, validator errors or warnings, and any behavior that
   should be verified in Facet.

Do not use Facet's ability to delete, move, or overwrite a file as authorization
to perform that action outside the app.
