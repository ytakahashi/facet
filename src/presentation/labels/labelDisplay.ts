import type { LabelColor, LabelDefinition } from "../../domain/label.ts";

export interface LabelDisplay {
  colors: ReadonlyMap<string, LabelColor>;
  positions: ReadonlyMap<string, number>;
}

// Built once per registry change by whoever renders card labels, rather than
// each card re-scanning the registry for every label it carries.
export function buildLabelDisplay(
  labels: readonly LabelDefinition[],
): LabelDisplay {
  return {
    colors: new Map(labels.map((label) => [label.name, label.color])),
    positions: new Map(labels.map((label, index) => [label.name, index])),
  };
}
