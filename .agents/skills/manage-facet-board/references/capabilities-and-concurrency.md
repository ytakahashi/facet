# Capabilities and concurrency

This reference covers application behavior that affects tools editing the same
files as Facet. It is not a complete UI manual.

## Board and Card navigation

- One Board is open in a window at a time. Opening another replaces it.
- Title search opens with Command-P.
- Markdown content search opens with Command-Shift-F. It reads a fresh snapshot
  of the files referenced by the current Board and shows matching lines.
- A followed Card link, Board selection, or search selection is recorded in a
  bounded viewing history. Command-[ returns to the previous Card.
- Command-K in the editor inserts a relative link to another Card on the current
  Board.
- Command-S saves a changed Markdown draft while the Card is open.

## External changes

Facet does not watch Board or Markdown files. An external edit is therefore not
shown automatically in an already open Board or editor.

Facet records the SHA-256 hash of the file's bytes as its content revision when
it reads a Board or Markdown file. A later conditional save compares that
revision with the current file. Writing the same bytes again does not cause a
conflict, and an external edit that is reverted byte-for-byte before the save is
not distinguishable from no change. If the revisions differ, Facet stops normal
saving and offers these explicit choices:

- Reload the external version and discard the state held by Facet.
- Overwrite with the state held by Facet.

If a Markdown file disappeared, the editor similarly requires an explicit
recreate action. The underlying compare and write are performed in one host call
but are not an atomic file-system transaction, so tools should still avoid
simultaneous writes when practical.

When a tool edits files while Facet is open, tell the user which files changed
and that Facet may need to reload them.

## File operations

- Removing a Card from a Board and deleting its Markdown file are separate
  operations.
- Markdown deletion is permanent; Facet does not move the file to Trash.
- Rename and move operations refuse to replace an existing destination.
- A Card whose file was moved or removed outside Facet remains on the Board and
  can be retargeted or recreated through the recovery UI.
