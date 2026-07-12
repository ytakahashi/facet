import type { Column as ColumnModel } from "../../domain/board.ts";
import { Card } from "./Card.tsx";

export function Column({ column }: { column: ColumnModel }) {
  return (
    <div className="column">
      <h2 className="column__name">{column.name}</h2>
      <div className="column__cards">
        {column.cards.map((card) => <Card card={card} key={card.path} />)}
      </div>
    </div>
  );
}
