import {
  type Board,
  type CardLocation,
  findCardLocation,
} from "../../domain/board.ts";
import {
  type CardFilterCriteria,
  filterColumnCards,
} from "../../domain/cardFilter.ts";
import { describeCardPosition } from "./cardMoveAnnouncement.ts";

export interface CardMenuMove {
  cardPath: string;
  sourceColumnId: string;
  fallbackCardPath: string | undefined;
  message: string;
}

export function describeCardMenuMove(
  board: Board,
  cardPath: string,
  from: CardLocation,
  criteria: CardFilterCriteria,
): CardMenuMove | undefined {
  const to = findCardLocation(board, cardPath);
  if (!to) return undefined;
  const card = board.columns.find((column) => column.id === to.columnId)?.cards[
    to.index
  ];
  const message = describeCardPosition(board, to);
  if (!card || !message) return undefined;
  const source = board.columns.find((column) => column.id === from.columnId);
  const visible = source ? filterColumnCards(source, criteria) : [];
  // After removal the following card occupies the old slot. If no visible
  // card follows that slot, use the last visible card before it.
  const fallback =
    visible.find(({ index }) => index >= from.index) ?? visible.at(-1);

  return {
    cardPath: card.path,
    sourceColumnId: from.columnId,
    fallbackCardPath: fallback?.card.path,
    message,
  };
}
