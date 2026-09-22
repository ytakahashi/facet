# Facet board format

A Facet board is a YAML file. Its containing directory is the board root, and
every Card path is interpreted relative to that directory.

## Schema

Facet currently creates schema version `1` boards in this form:

```yaml
version: 1
name: Development
labels:
  - name: search
    color: sapphire
columns:
  - id: doing
    name: Doing
    cards:
      - path: improve-search.md
        title: Improve search
        priority: high
        labels:
          - search
```

The supported fields are:

- Board: `version`, `name`, `labels`, `columns`
- Label definition: `name`, `color`
- Column: `id`, `name`, `cards`
- Card: `path`, and the optional `title`, `priority`, and `labels`

`labels` on a Board and `cards` on a Column may be absent in older or
hand-written files; Facet reads either as an empty array. Facet-created and
Facet-saved files contain both arrays explicitly. When generating a board,
include them even when they are empty.

Facet reserializes a Board from its domain model when it saves. It does not
preserve unknown fields, YAML comments, aliases, or custom formatting. Do not
put information outside the supported fields in a board file.

## Values and identities

- `version` is `1`.
- Board names, Column names, Column IDs, and Label names are non-empty strings.
- Column IDs are unique within a Board. Facet generates UUIDs, but consumers
  address Columns by value and only require uniqueness.
- Label names are unique within a Board and are the identity used by Cards.
- A Card may reference only labels present in the Board's `labels` registry.
- A Card must not list the same label more than once.
- `priority`, when present, is `low`, `medium`, or `high`.
- `color` is one of `ruby`, `amber`, `emerald`, `sapphire`, `lapis`, `morion`,
  `citrine`, `sphene`, `aquamarine`, `amethyst`, `morganite`, or `selenite`.

Card order within a Column and Column order within the Board are user-visible.
Preserve both unless the operation intentionally changes them.

## Card paths

- Store a path relative to the board root; never store an absolute path.
- The normalized path must not escape the board root through `..` segments.
- The path must name a Markdown file with a case-insensitive `.md` suffix.
- A path is a Card's identity across the whole Board, not only within one
  Column.
- For identity comparison, Facet normalizes `.` and `..` segments, folds letter
  case, and normalizes Unicode to NFC. Paths that differ only by those forms
  cannot appear as separate Cards.

Facet can load a Card whose file is missing or unreadable so the user can repair
it. Treat that state separately from an invalid path or duplicate Card.

## Validation

After changing a board, run:

```sh
deno run --allow-read --allow-env <skill-directory>/scripts/validate-board.ts <board-path>
```

Schema and relationship violations are errors. Missing or unreadable Markdown
files are warnings because Facet has a recovery flow for them.
