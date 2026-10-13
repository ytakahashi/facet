# Working on Facet

Facet is a local-first Markdown kanban desktop app for macOS built on
[Tauri](https://tauri.app/).

`ARCHITECTURE.md` describes the structure most of this follows from; read it
first.

## Before finishing

Run `deno task lint`, `deno fmt`, `deno task test` and `deno task build`, then
report what actually happened rather than describing the change as complete.

- Run package scripts through `deno task`; do not invoke via node (e.g., `npm`).
- `deno task build` type-checks `src/` only.
- When `src-tauri/**` change, run `deno task fmt:rust`, `deno task lint:rust`
  and `deno task test:rust`, then `deno task desktop`. `deno fmt` does not
  format Rust, and only `deno task desktop` builds the app with the real
  frontend.
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
src-tauri/src/<module>.rs → commands.rs → lib.rs
  → src/infrastructure/hostCommands.ts → fileSystemPort.ts
  → hostFileSystemAdapter.ts → usecase → store → component
```

- The command reports a failure as data (`{ renamed: false, reason }`), the
  adapter raises a typed `FileSystemError`, the use case raises a
  `UseCaseError`, and `toUiError.ts` is where the wording for it is added.
- The serde types in `src-tauri/src/` and the result types in `hostCommands.ts`
  declare the same contract on either side of the process boundary and have to
  be kept in step by hand. The Rust tests pin each JSON shape, and
  `hostCommands.test.ts` pins each command and argument name.
- A command only a plugin provides needs its permission in
  `src-tauri/capabilities/default.json`; the app's own commands do not.

## Tests

- `src/**` runs under Vitest against fake ports and fake dependencies.
- `src-tauri/**` runs under `cargo test` (`deno task test:rust`) against a real
  temporary directory, and only on macOS.
  - The `tauri` crate checks at compile time that `dist/` exists, so the Rust
    tasks create an empty one first; the tests never read it.
- `.agents/skills/manage-facet-board/scripts/` runs under `deno test`.
- `deno task test` runs Vitest and `deno test`.

The split is about what the code needs to be true. The host-side rules are facts
about the file system rather than about this app, and a stubbed test would only
restate the assumption being questioned.

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
- `src-tauri/Cargo.toml` pins its direct dependencies the same way (`=x.y.z`).
  `Cargo.lock` is committed and pins everything beneath them; the Rust tasks run
  with `--locked`, so a lockfile that no longer matches fails instead of being
  rewritten.
