import type { LabelDefinition } from "../../domain/label.ts";
import {
  canonicalSearchQuery,
  canonicalSearchText,
} from "../../domain/searchText.ts";

export function filterLabels(
  labels: readonly LabelDefinition[],
  query: string,
): LabelDefinition[] {
  const normalizedQuery = canonicalSearchQuery(query);
  return labels.filter((label) =>
    canonicalSearchText(label.name).includes(normalizedQuery),
  );
}
