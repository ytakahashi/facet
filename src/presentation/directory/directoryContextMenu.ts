import { resolveCardPath } from "../../domain/boardPath.ts";
import type { CardTreeDirectory } from "../../domain/cardDirectoryTree.ts";
import type { ContextMenuEntry } from "../context/appContext.ts";

export function buildDirectoryContextMenu(
  directory: Pick<CardTreeDirectory, "path">,
  boardDirectory: string,
  actions: { copyText: (text: string) => void; reveal: (path: string) => void },
): ContextMenuEntry[] {
  const resolved = resolveCardPath(boardDirectory, directory.path);
  // Directory nodes only represent paths validated by the tree builder.
  if (!resolved.ok)
    throw new Error("Directory path must resolve inside the board");
  return [
    {
      kind: "item",
      label: "Copy Path",
      enabled: true,
      onSelect: () => actions.copyText(directory.path),
    },
    {
      kind: "item",
      label: "Copy Absolute Path",
      enabled: true,
      onSelect: () => actions.copyText(resolved.absolutePath),
    },
    { kind: "separator" },
    {
      kind: "item",
      label: "Reveal in Finder",
      enabled: true,
      onSelect: () => actions.reveal(resolved.absolutePath),
    },
  ];
}
