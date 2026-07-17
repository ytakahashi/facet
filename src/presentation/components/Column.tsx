import { useEffect, useRef, useState } from "react";
import { dropTargetForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import type { Column as ColumnModel } from "../../domain/board.ts";
import type { ColumnDropData } from "./dragData.ts";
import { Card } from "./Card.tsx";

interface ColumnProps {
  column: ColumnModel;
  onAddCard: (columnId: string) => void;
}

export function Column({ column, onAddCard }: ColumnProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [isDraggedOver, setIsDraggedOver] = useState(false);

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
      <div className="column__header">
        <h2 className="column__name" title={column.name}>{column.name}</h2>
        <button type="button" onClick={() => onAddCard(column.id)}>
          + Add card
        </button>
      </div>
      <div
        ref={ref}
        className={`column__cards${
          isDraggedOver ? " column__cards--dragged-over" : ""
        }`}
      >
        {column.cards.map((card, index) => (
          <Card
            card={card}
            columnId={column.id}
            index={index}
            key={card.path}
          />
        ))}
      </div>
    </div>
  );
}
