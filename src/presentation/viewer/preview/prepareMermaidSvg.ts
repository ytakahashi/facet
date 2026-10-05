import { stripNavigation } from "./stripNavigation.ts";

export function viewBoxSize(
  viewBox: string | null,
): { width: number; height: number } | undefined {
  if (!viewBox?.trim()) return undefined;
  const values = viewBox.trim().split(/[\s,]+/).map(Number);
  if (values.length !== 4 || !values.every(Number.isFinite)) return undefined;
  const [, , width, height] = values;
  if (width <= 0 || height <= 0) return undefined;
  return { width, height };
}

export function prepareMermaidSvg(markup: string): string {
  // Template content is inert and uses the same HTML parser as the preview's
  // innerHTML, so navigation is stripped from exactly the DOM we will display.
  const template = document.createElement("template");
  template.innerHTML = markup;
  stripNavigation(template.content);

  const svg = template.content.querySelector("svg");
  const size = viewBoxSize(svg?.getAttribute("viewBox") ?? null);
  if (svg && size) {
    // Mermaid's width="100%" shrinks wide diagrams to the pane. Use viewBox
    // units as CSS pixels across diagram types, including their padding, and
    // leave nested SVGs alone so icons keep their own coordinate systems.
    svg.setAttribute("width", String(size.width));
    svg.setAttribute("height", String(size.height));
    svg.style.setProperty("width", `${size.width}px`);
    svg.style.setProperty("height", `${size.height}px`);
    svg.style.setProperty("max-width", "none");
    svg.style.setProperty("max-height", "none");
  }

  return template.innerHTML;
}
