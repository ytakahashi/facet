import { useEffect, useRef, useState } from "react";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import {
  draggable,
  dropTargetForElements,
} from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import type { Edge } from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";
import {
  attachClosestEdge,
  extractClosestEdge,
} from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";
import type { Column as ColumnModel } from "../../domain/board.ts";
import {
  areColumnCardsHidden,
  type CardFilterCriteria,
  filterColumnCards,
} from "../../domain/cardFilter.ts";
import type { Card as CardModel } from "../../domain/card.ts";
import type { LabelDisplay } from "./labelDisplay.ts";
import type { CardListDropData, ColumnDragData } from "./dragData.ts";
import { Card } from "./Card.tsx";
import { ColumnHeader } from "./ColumnHeader.tsx";

interface ColumnProps {
  column: ColumnModel;
  criteria: CardFilterCriteria;
  index: number;
  labelDisplay: LabelDisplay;
  onAddCard: (columnId: string) => void;
  onDeleteCard: (card: CardModel) => void;
  onRepairCard: (card: CardModel) => void;
  onRename: (columnId: string, name: string) => void;
  onRemove: (columnId: string) => void;
}

export function Column(
  {
    column,
    criteria,
    index,
    labelDisplay,
    onAddCard,
    onDeleteCard,
    onRepairCard,
    onRename,
    onRemove,
  }: ColumnProps,
) {
  const cardsRef = useRef<HTMLDivElement>(null);
  const columnRef = useRef<HTMLDivElement>(null);
  const dragHandleRef = useRef<HTMLSpanElement>(null);
  const [isDraggedOver, setIsDraggedOver] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [closestEdge, setClosestEdge] = useState<Edge | null>(null);
  const visibleCards = filterColumnCards(column, criteria);
  const areCardsHidden = areColumnCardsHidden(column, criteria);
  const cardCount = column.cards.length;
  const cardsClassName = [
    "column__cards",
    areCardsHidden ? "column__cards--hidden" : "",
    isDraggedOver ? "column__cards--dragged-over" : "",
  ].filter(Boolean).join(" ");
  const className = [
    "column",
    isDragging ? "column--dragging" : "",
    closestEdge === "left" ? "column--drop-before" : "",
    closestEdge === "right" ? "column--drop-after" : "",
  ].filter(Boolean).join(" ");

  useEffect(() => {
    const element = cardsRef.current;
    if (!element) return;

    const data: CardListDropData = { type: "card-list", columnId: column.id };

    return dropTargetForElements({
      element,
      canDrop: ({ source }) => source.data.type === "card",
      getData: () => data,
      getIsSticky: () => true,
      onDragEnter: () => setIsDraggedOver(true),
      onDragLeave: () => setIsDraggedOver(false),
      onDrop: () => setIsDraggedOver(false),
    });
  }, [column.id]);

  useEffect(() => {
    const element = columnRef.current;
    const dragHandle = dragHandleRef.current;
    if (!element || !dragHandle) return;

    const data: ColumnDragData = {
      type: "column",
      columnId: column.id,
      index,
    };

    return combine(
      // The whole column is dragged, but only the handle starts the drag, so
      // the preview shows what is being moved without swallowing the pointer
      // interactions inside the column.
      draggable({
        element,
        dragHandle,
        getInitialData: () => data,
        onDragStart: () => setIsDragging(true),
        onDrop: () => setIsDragging(false),
      }),
      dropTargetForElements({
        element,
        // A column being dragged is not a destination for itself: excluding it
        // keeps a meaningless indicator off the dragged column and leaves the
        // drop with no target to resolve.
        canDrop: ({ source }) =>
          source.data.type === "column" && source.data.columnId !== column.id,
        getData: ({ input }) =>
          attachClosestEdge(data, {
            element,
            input,
            allowedEdges: ["left", "right"],
          }),
        getIsSticky: () => true,
        onDragEnter: (args) =>
          setClosestEdge(extractClosestEdge(args.self.data)),
        onDrag: (args) => setClosestEdge(extractClosestEdge(args.self.data)),
        onDragLeave: () => setClosestEdge(null),
        onDrop: () => setClosestEdge(null),
      }),
    );
  }, [column.id, index]);

  return (
    <div ref={columnRef} className={className}>
      <ColumnHeader
        column={column}
        dragHandleRef={dragHandleRef}
        onAddCard={onAddCard}
        onRename={onRename}
        onRemove={onRemove}
      />
      <div ref={cardsRef} className={cardsClassName}>
        {visibleCards.map(({ card, index }) => (
          <Card
            card={card}
            columnId={column.id}
            index={index}
            key={card.path}
            labelDisplay={labelDisplay}
            onDelete={onDeleteCard}
            onRepair={onRepairCard}
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
