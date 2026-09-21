# Working on Facet

Facet is a local-first Markdown kanban desktop app for macOS built on
[Deno Desktop](https://docs.deno.com/runtime/desktop/).

`ARCHITECTURE.md` describes the structure most of this follows from; read it
first.

## Before finishing

Run `deno task lint`, `deno fmt`, `deno task test` and `deno task build`, then
report what actually happened rather than describing the change as complete.

- Run package scripts through `deno task`; do not invoke via node (e.g., `npm`).
- `deno task build` type-checks `src/` only.
- When `desktop/**` change, run `deno task desktop`. The regular build does not
  check `desktop/`, and `deno check` cannot see Deno Desktop's types.
- When a change affects Facet's externally observable behavior, board file
  format, Markdown card handling, path or link semantics, or concurrent-edit
  behavior, review `.agents/skills/manage-facet-board/` for consistency and
  update it when the documented behavior changed.

## Verifying in the app

- When the automated checks pass, list what should be verified by hand instead
  of driving the UI.
- When something misbehaves only in the real app, route information out to the
  host's terminal — a temporary binding that logs there works — and isolate the
  cause before changing code.
  - Offering a plausible fix to re-test costs more than one round of diagnosis.

## Adding a file-system capability

```text
desktop/fileSystem.ts → desktop/bindings.ts → desktop/main.ts
  → src/infrastructure/bindings.d.ts → fileSystemPort.ts
  → denoFileSystemAdapter.ts → usecase → store → component
```

- The binding reports a failure as data (`{ renamed: false, reason }`), the
  adapter raises a typed `FileSystemError`, the use case raises a
  `UseCaseError`, and `toUiError.ts` is where the wording for it is added.
- `HostBindings` and `bindings.d.ts` declare the same contract on either side of
  the process boundary and have to be kept in step by hand.

## Tests

- `src/**` runs under Vitest against fake ports and fake dependencies.
- `desktop/**` runs under `deno test` against a real temporary directory.
- `deno task test` runs both.

`deno test` cannot see Deno Desktop's types. That is why `bindings.ts` holds the
only reference to `Deno.MenuItem` and nothing under test imports it.

The split is about what the code needs to be true. The desktop-side rules are
facts about the file system rather than about this app, and a stubbed test would
only restate the assumption being questioned.

### Test conventions

- Follow the existing tests for shape and naming.
- Beyond that, one rule: test each thing once, at the layer that owns it
  - `kind` and operation at the port, `code` and `details` at the use case,
    user-facing wording only in `toUiError.test.ts`.

## Styling

Plain CSS with custom properties (`src/index.css`).

- No CSS frameworks or UI component libraries.
- Design system tokens and custom properties live in `src/index.css`, and
  component styles live in `src/presentation/App.css`.
- Never write raw colour values; reference `var(--color-*)` and the real ones
  are in `src/index.css`. It also says which accent carries which meaning.

## Dependencies

- `package.json` pins exact versions and the project deliberately carries very
  few dependencies; adding one is worth justifying.
