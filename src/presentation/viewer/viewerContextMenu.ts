import type { Board } from "../../domain/board.ts";
import type { Card } from "../../domain/card.ts";
import type { ContextMenuEntry } from "../context/appContext.ts";
import {
  buildCardContextMenu,
  type CardContextMenuActions,
} from "../shared/cardContextMenu.ts";

export interface ViewerContextMenuActions extends CardContextMenuActions {
  refresh: () => void;
}

export function buildViewerContextMenu(
  card: Card,
  board: Board,
  canRefresh: boolean,
  actions: ViewerContextMenuActions,
): ContextMenuEntry[] {
  return [
    {
      kind: "item",
      label: "Reload Markdown",
      enabled: canRefresh,
      onSelect: actions.refresh,
    },
    { kind: "separator" },
    ...buildCardContextMenu(card, board, actions),
  ];
}
