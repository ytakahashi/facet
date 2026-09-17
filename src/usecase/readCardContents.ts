import type { Card } from "../domain/card.ts";
import type { FileSystemPort } from "../domain/fileSystemPort.ts";

const MAX_CONCURRENT_READS = 8;

export type CardContentReadResult =
  | { path: string; read: true; content: string }
  | { path: string; read: false };

export interface ReadCardContentsDeps {
  fileSystem: FileSystemPort;
}

export async function readCardContents(
  cards: readonly Card[],
  { fileSystem }: ReadCardContentsDeps,
): Promise<CardContentReadResult[]> {
  const results = new Array<CardContentReadResult>(cards.length);
  let nextIndex = 0;

  // Keep the number of host binding calls bounded: a board may contain
  // hundreds of cards, and submitting one call per card at once only moves
  // the queue across the process boundary.
  async function readNext(): Promise<void> {
    while (nextIndex < cards.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await readCardContent(cards[index], fileSystem);
    }
  }

  const workerCount = Math.min(MAX_CONCURRENT_READS, cards.length);
  await Promise.all(Array.from({ length: workerCount }, () => readNext()));
  return results;
}

async function readCardContent(
  card: Card,
  fileSystem: FileSystemPort,
): Promise<CardContentReadResult> {
  if (!card.absolutePath) return { path: card.path, read: false };

  try {
    const content = await fileSystem.readTextFile(card.absolutePath);
    return { path: card.path, read: true, content };
  } catch {
    return { path: card.path, read: false };
  }
}
