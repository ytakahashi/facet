# Capabilities and concurrency

This reference covers application behavior that affects tools editing the same
files as Facet. It is not a complete UI manual.

## External changes

Facet does not watch Board or Markdown files. An external edit is therefore not
shown automatically in an already open Board or editor.

Markdown content search reads a fresh snapshot of the files referenced by the
current Board. This does not refresh the Markdown already open in the editor.

The Files view lists unregistered Markdown files and directories alongside Board
Cards. It reads only expanded directories, hides unregistered entries while a
Card filter is active, and does not watch the file system. Reopening Files,
returning to its tab, or successfully refreshing or reloading the Board rereads
the directory listings. These listings do not update a Card's file state.
Unregistered Markdown files can be added to a chosen Column from their context
menu, without previewing or editing them first. Successful file creation,
deletion, and moves in the same Board tab invalidate the affected parent
listings; a move invalidates both its source and destination parents. Other tabs
still need a refresh or another visit to Files.

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

Editing the same Markdown file from two open Boards in Facet can also produce a
revision conflict. In-flight write protection for move and delete applies only
within one Board tab, so a write in another tab may recreate a moved or deleted
file.

When a tool edits files while Facet is open, tell the user which files changed
and that Facet may need to reload them.

## File operations

- Removing a Card from a Board and deleting its Markdown file are separate
  operations.
- Markdown deletion is permanent; Facet does not move the file to Trash.
- Rename and move operations refuse to replace an existing destination.
- A Card whose file was moved or removed outside Facet remains on the Board and
  can be retargeted or recreated through the recovery UI.
