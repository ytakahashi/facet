import { useEffect, useRef, useState } from "react";
import { dropTargetForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import type { Column as ColumnModel } from "../../domain/board.ts";
import {
  areColumnCardsHidden,
  type CardFilterCriteria,
  filterColumnCards,
} from "../../domain/cardFilter.ts";
import type { LabelColor } from "../../domain/label.ts";
import type { ColumnDropData } from "./dragData.ts";
import { Card } from "./Card.tsx";
import { ColumnHeader } from "./ColumnHeader.tsx";

interface ColumnProps {
  column: ColumnModel;
  criteria: CardFilterCriteria;
  labelColors: Map<string, LabelColor>;
  onAddCard: (columnId: string) => void;
  onRename: (columnId: string, name: string) => void;
  onRemove: (columnId: string) => void;
}

export function Column(
  { column, criteria, labelColors, onAddCard, onRename, onRemove }: ColumnProps,
) {
  const ref = useRef<HTMLDivElement>(null);
  const [isDraggedOver, setIsDraggedOver] = useState(false);
  const visibleCards = filterColumnCards(column, criteria);
  const areCardsHidden = areColumnCardsHidden(column, criteria);
  const cardCount = column.cards.length;
  const cardsClassName = [
    "column__cards",
    areCardsHidden ? "column__cards--hidden" : "",
    isDraggedOver ? "column__cards--dragged-over" : "",
  ].filter(Boolean).join(" ");

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const data: ColumnDropData = { type: "column", columnId: column.id };

    return dropTargetForElements({
      element,
      getData: () => data,
      getIsSticky: () => true,
      onDragEnter: () => setIsDraggedOver(true),
      onDragLeave: () => setIsDraggedOver(false),
      onDrop: () => setIsDraggedOver(false),
    });
  }, [column.id]);

  return (
    <div className="column">
      <ColumnHeader
        column={column}
        onAddCard={onAddCard}
        onRename={onRename}
        onRemove={onRemove}
      />
      <div ref={ref} className={cardsClassName}>
        {visibleCards.map(({ card, index }) => (
          <Card
            card={card}
            columnId={column.id}
            index={index}
            key={card.path}
            labelColors={labelColors}
          />
        ))}
        {
          /* A card dropped into a hidden column vanishes on the spot, so the
            note carries the count: watching it grow is the only feedback
            that the drop landed. Cards can still only disappear here through
            an active filter, which is why neither branch re-checks that. */
        }
        {areCardsHidden
          ? cardCount > 0 && (
            <p className="column__hidden-note">
              {cardCount === 1 ? "1 card hidden" : `${cardCount} cards hidden`}
            </p>
          )
          : visibleCards.length === 0 && cardCount > 0 && (
            <p className="column__empty-filter-note">
              No cards match the filter
            </p>
          )}
      </div>
    </div>
  );
}
