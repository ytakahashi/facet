import { FinderError, type FinderPort } from "../domain/finderPort.ts";
import * as hostCommands from "./hostCommands.ts";
import type { RevealInFinderResult } from "./hostCommands.ts";

export class HostFinder implements FinderPort {
  async reveal(path: string): Promise<void> {
    let result: RevealInFinderResult;
    try {
      result = await hostCommands.revealInFinder(path);
    } catch (cause) {
      throw new FinderError("failed", { cause });
    }
    if (!result.revealed) throw new FinderError(result.reason);
  }
}
