import { FinderError, type FinderPort } from "../domain/finderPort.ts";
import type { RevealInFinderResult } from "./bindings.d.ts";

export class DenoFinder implements FinderPort {
  async reveal(path: string): Promise<void> {
    let result: RevealInFinderResult;
    try {
      result = await bindings.revealInFinder(path);
    } catch (cause) {
      throw new FinderError("failed", { cause });
    }
    if (!result.revealed) throw new FinderError(result.reason);
  }
}
