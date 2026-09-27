import { FinderError, type FinderPort } from "../domain/finderPort.ts";
import { UseCaseError } from "./useCaseError.ts";

export async function revealInFinder(
  path: string,
  { finder }: { finder: FinderPort },
): Promise<void> {
  try {
    await finder.reveal(path);
  } catch (cause) {
    throw new UseCaseError(
      cause instanceof FinderError && cause.kind === "not-found"
        ? "finder.not-found"
        : "finder.reveal-failed",
      { path },
      { cause },
    );
  }
}
