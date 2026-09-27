export interface FinderPort {
  // Selects an existing path in Finder, or opens its parent if it is gone.
  reveal(path: string): Promise<void>;
}

export class FinderError extends Error {
  readonly operation = "reveal";
  readonly kind: "not-found" | "failed";

  constructor(
    kind: "not-found" | "failed",
    options?: ErrorOptions,
  ) {
    super(`finder:reveal:${kind}`, options);
    this.name = "FinderError";
    this.kind = kind;
  }
}
