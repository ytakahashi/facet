import type { TextRange } from "../../../domain/textMatch.ts";

export interface FindText {
  text: string;
  // Preview reports the viewport start; Edit reports its live caret position.
  getAnchorOffset: () => number;
  getSelectedQuery?: () => string | undefined;
  restoreSelection?: (range: TextRange | undefined) => void;
}

export interface FindPresentation {
  source: FindText | undefined;
  ranges: readonly TextRange[];
  activeIndex: number | undefined;
  revealToken: number;
}
