import { type Board, findCardLocation } from "../../domain/board.ts";

interface CardBoardPositionProps {
  board: Board;
  cardPath: string;
}

export function CardBoardPosition(
  { board, cardPath }: CardBoardPositionProps,
) {
  // Position follows the board's stored order, including cards hidden by a
  // filter or shown elsewhere in a different table sort order.
  const location = findCardLocation(board, cardPath);
  const column = board.columns.find((candidate) =>
    candidate.id === location?.columnId
  );
  if (!location || !column) return null;

  const position = location.index + 1;
  const total = column.cards.length;

  return (
    <p className="markdown-viewer__position">
      <span className="markdown-viewer__position-label">Column:</span>
      <span className="markdown-viewer__position-column" title={column.name}>
        {column.name}
      </span>
      <span className="markdown-viewer__position-count">
        · {position} of {total}
      </span>
    </p>
  );
}
