import type { Card as CardModel } from "../../domain/card.ts";

export function Card({ card }: { card: CardModel }) {
  const hasMeta = card.priority !== undefined || card.labels.length > 0;

  return (
    <div className="card">
      <p className="card__title">{card.displayTitle}</p>
      {hasMeta && (
        <div className="card__meta">
          {card.priority && (
            <span className={`card__priority card__priority--${card.priority}`}>
              {card.priority}
            </span>
          )}
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
