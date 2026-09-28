export interface ContentReadSequence {
  begin(): number;
  isCurrent(generation: number): boolean;
  invalidate(): void;
}

// Keeps async reads from writing into a newer dialog session. It carries no
// React state so the ordering rule can be tested without a DOM environment.
export function createContentReadSequence(): ContentReadSequence {
  let currentGeneration = 0;

  return {
    begin() {
      currentGeneration += 1;
      return currentGeneration;
    },
    isCurrent(generation) {
      return generation === currentGeneration;
    },
    invalidate() {
      currentGeneration += 1;
    },
  };
}
