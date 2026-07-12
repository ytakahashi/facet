import type { Card } from "./card.ts";

export interface Column {
  id: string;
  name: string;
  cards: Card[];
}

export interface Board {
  version: number;
  name: string;
  columns: Column[];
}
