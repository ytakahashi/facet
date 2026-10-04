import type { ContextMenuEntry } from "../context/appContext.ts";

export interface BoardContextMenuActions {
  copyText: (text: string) => void;
  reveal: (path: string) => void;
  refresh: () => void;
}

export function buildBoardContextMenu(
  boardPath: string,
  canRefresh: boolean,
  actions: BoardContextMenuActions,
): ContextMenuEntry[] {
  return [
    {
      kind: "item",
      label: "Reload Board",
      enabled: canRefresh,
      onSelect: actions.refresh,
    },
    { kind: "separator" },
    {
      kind: "item",
      label: "Copy Board File Path",
      enabled: true,
      onSelect: () => actions.copyText(boardPath),
    },
    {
      kind: "item",
      label: "Reveal in Finder",
      enabled: true,
      onSelect: () => actions.reveal(boardPath),
    },
  ];
}
