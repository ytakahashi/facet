import type { Mermaid } from "mermaid";
import { mermaidConfig, type MermaidPalette } from "./mermaidConfig.ts";
import { prepareMermaidSvg } from "./prepareMermaidSvg.ts";

// Mermaid is several times the size of the rest of the preview, so it is only
// fetched once a card actually contains a diagram.
let mermaidModule: Promise<Mermaid> | undefined;

function loadMermaid(): Promise<Mermaid> {
  mermaidModule ??= import("mermaid").then(
    (module) => module.default,
    (error: unknown) => {
      // Let a later diagram retry rather than keep a failed chunk load.
      mermaidModule = undefined;
      throw error;
    },
  );
  return mermaidModule;
}

// Mermaid's configuration is global and `initialize` is not queued with
// `render`, so each configure-then-render pair runs to completion before the
// next one starts. Otherwise a diagram could be drawn in another's theme.
let queue: Promise<unknown> = Promise.resolve();
let nextId = 0;

export function renderMermaidDiagram(
  source: string,
  darkMode: boolean,
): Promise<string> {
  const result = queue.then(async () => {
    const mermaid = await loadMermaid();
    mermaid.initialize(mermaidConfig(readPalette(), darkMode));
    const { svg } = await mermaid.render(`mermaid-diagram-${nextId++}`, source);
    return prepareMermaidSvg(svg);
  });
  queue = result.catch(() => {});
  return result;
}

function readPalette(): MermaidPalette {
  const style = getComputedStyle(document.documentElement);
  const token = (name: string) => style.getPropertyValue(name).trim();
  return {
    text: token("--color-text"),
    textStrong: token("--color-text-strong"),
    border: token("--color-border"),
    surface: token("--color-surface"),
    surfaceRaised: token("--color-surface-raised"),
    fontFamily: token("--sans"),
  };
}
