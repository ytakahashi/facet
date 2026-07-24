import { useEffect, useRef, useState } from "react";
import { dropTargetForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import type { Column as ColumnModel } from "../../domain/board.ts";
import {
  type CardFilterCriteria,
  filterCardsPreservingIndex,
  isCardFilterActive,
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
  const visibleCards = filterCardsPreservingIndex(column.cards, criteria);

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
      <div
        ref={ref}
        className={`column__cards${
          isDraggedOver ? " column__cards--dragged-over" : ""
        }`}
      >
        {visibleCards.map(({ card, index }) => (
          <Card
            card={card}
            columnId={column.id}
            index={index}
            key={card.path}
            labelColors={labelColors}
          />
        ))}
        {visibleCards.length === 0 && column.cards.length > 0 &&
          isCardFilterActive(criteria) && (
          <p className="column__empty-filter-note">
            No cards match the filter
          </p>
        )}
      </div>
    </div>
  );
}
