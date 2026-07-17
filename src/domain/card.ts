import type { Label } from "./label.ts";
import type { Priority } from "./priority.ts";

export interface Card {
  path: string;
  absolutePath?: string;
  titleOverride?: string;
  priority?: Priority;
  labels: Label[];
  displayTitle: string;
}

export function resolveCardTitle(
  titleOverride: string | undefined,
  markdownText: string | undefined,
  path: string,
): string {
  if (titleOverride) {
    return titleOverride;
  }

  const heading = markdownText ? findFirstH1(markdownText) : undefined;
  if (heading) {
    return heading;
  }

  return filenameOf(path);
}

export function createCardReference(
  path: string,
  absolutePath: string,
  markdownText: string,
): Card {
  return {
    path,
    absolutePath,
    labels: [],
    displayTitle: resolveCardTitle(undefined, markdownText, path),
  };
}

function findFirstH1(markdown: string): string | undefined {
  for (const line of markdown.split("\n")) {
    const match = /^#\s+(.+)$/.exec(line.trim());
    if (match) {
      return match[1].trim();
    }
  }
  return undefined;
}

function filenameOf(path: string): string {
  const base = path.split("/").pop() ?? path;
  return base.replace(/\.md$/, "");
}
