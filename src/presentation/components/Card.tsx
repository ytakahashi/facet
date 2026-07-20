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
import type { Card as CardModel } from "../../domain/card.ts";
import type { LabelColor } from "../../domain/label.ts";
import { useMarkdownViewer } from "../context/appContext.ts";
import type { CardDragData } from "./dragData.ts";

interface CardProps {
  card: CardModel;
  columnId: string;
  index: number;
  labelColors: Map<string, LabelColor>;
}

export function Card({ card, columnId, index, labelColors }: CardProps) {
  const isSelected = useMarkdownViewer((state) =>
    state.selectedPath === card.path
  );
  const selectCard = useMarkdownViewer((state) => state.selectCard);

  const ref = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [closestEdge, setClosestEdge] = useState<Edge | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const data: CardDragData = { type: "card", columnId, index };

    return combine(
      draggable({
        element,
        getInitialData: () => data,
        onDragStart: () => setIsDragging(true),
        onDrop: () => setIsDragging(false),
      }),
      dropTargetForElements({
        element,
        getData: ({ input }) =>
          attachClosestEdge(data, {
            element,
            input,
            allowedEdges: ["top", "bottom"],
          }),
        getIsSticky: () => true,
        onDragEnter: (args) =>
          setClosestEdge(extractClosestEdge(args.self.data)),
        onDrag: (args) => setClosestEdge(extractClosestEdge(args.self.data)),
        onDragLeave: () => setClosestEdge(null),
        onDrop: () => setClosestEdge(null),
      }),
    );
  }, [columnId, index]);

  const classNames = ["card"];
  if (isSelected) classNames.push("card--selected");
  if (isDragging) classNames.push("card--dragging");
  if (closestEdge === "top") classNames.push("card--drop-before");
  if (closestEdge === "bottom") classNames.push("card--drop-after");

  return (
    <div
      ref={ref}
      className={classNames.join(" ")}
      onClick={() => void selectCard(card)}
    >
      {card.priority && (
        <span className={`card__priority card__priority--${card.priority}`}>
          {card.priority}
        </span>
      )}
      <p className="card__title">{card.displayTitle}</p>
      {card.labels.length > 0 && (
        <div className="card__labels">
          {card.labels.map((label) => (
            <span
              className={`card__label card__label--${
                labelColors.get(label) ?? "neutral"
              }`}
              key={label}
            >
              {label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
