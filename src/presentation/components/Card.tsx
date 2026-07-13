import type { Card as CardModel } from "../../domain/card.ts";

export function Card({ card }: { card: CardModel }) {
  return (
    <div className="card">
      {card.priority && (
        <span className={`card__priority card__priority--${card.priority}`}>
          {card.priority}
        </span>
      )}
      <p className="card__title">{card.displayTitle}</p>
      {card.labels.length > 0 && (
        <div className="card__labels">
          {card.labels.map((label) => (
            <span className="card__label" key={label}>
              {label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
