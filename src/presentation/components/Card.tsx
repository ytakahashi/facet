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
import { isCardFileBroken } from "../../domain/card.ts";
import { orderCardLabels } from "../../domain/label.ts";
import { useMarkdownViewer } from "../context/appContext.ts";
import type { CardDragData } from "./dragData.ts";
import type { LabelDisplay } from "./labelDisplay.ts";
import { missingHint } from "./cardFileStateHint.ts";

interface CardProps {
  card: CardModel;
  columnId: string;
  index: number;
  labelDisplay: LabelDisplay;
  onDelete: (card: CardModel) => void;
  onRepair: (card: CardModel) => void;
}

export function Card(
  { card, columnId, index, labelDisplay, onDelete, onRepair }: CardProps,
) {
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
        canDrop: ({ source }) => source.data.type === "card",
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

  const isBroken = isCardFileBroken(card);

  const classNames = ["card"];
  if (isBroken) classNames.push("card--missing");
  if (isSelected) classNames.push("card--selected");
  if (isDragging) classNames.push("card--dragging");
  if (closestEdge === "top") classNames.push("card--drop-before");
  if (closestEdge === "bottom") classNames.push("card--drop-after");

  return (
    <div
      ref={ref}
      className={classNames.join(" ")}
      // A broken card has nothing to show in the viewer, so its click goes to
      // the repair dialog instead of a load error the user cannot act on.
      onClick={() => isBroken ? onRepair(card) : void selectCard(card)}
    >
      {
        /* Revealed on hover/focus-within (see App.css) rather than shown on
          every card, which would put a row of × down each column. It stays in
          the DOM either way, so it is still reachable by keyboard. Starting a
          drag from it just drags the card, which is harmless. */
      }
      <button
        type="button"
        className="card__delete"
        aria-label={`Delete ${card.displayTitle}`}
        title="Delete card"
        onClick={(event) => {
          // The card itself opens the Markdown on click.
          event.stopPropagation();
          onDelete(card);
        }}
      >
        ×
      </button>
      {
        /* Not a button: the badge only states what the board observed when it
          loaded this card, so it carries no action of its own. */
      }
      {isBroken && (
        <span className="card__missing" title={missingHint(card.fileState)}>
          Missing
        </span>
      )}
      {card.priority && (
        <span className={`card__priority card__priority--${card.priority}`}>
          {card.priority}
        </span>
      )}
      <p className="card__title">{card.displayTitle}</p>
      {card.labels.length > 0 && (
        <div className="card__labels">
          {orderCardLabels(card.labels, labelDisplay.positions).map((label) => (
            <span
              className={`card__label card__label--${
                labelDisplay.colors.get(label) ?? "neutral"
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
