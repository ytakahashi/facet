import { describe, expect, it } from "vite-plus/test";
import type { LabelDefinition } from "../../domain/label.ts";
import { filterLabels } from "./filterLabels.ts";

const labels: LabelDefinition[] = [
  { name: "Bug report", color: "ruby" },
  { name: "Docs", color: "sapphire" },
  { name: "Debug", color: "amber" },
  { name: "Cafe\u0301", color: "emerald" },
  { name: "日本語", color: "amethyst" },
];

describe("filterLabels", () => {
  it("matches part of a name without case or surrounding query whitespace", () => {
    expect(filterLabels(labels, "  bUG  ")).toEqual([labels[0], labels[2]]);
  });

  it("matches canonically equivalent Unicode and Japanese text", () => {
    expect(filterLabels(labels, "CAFÉ")).toEqual([labels[3]]);
    expect(filterLabels(labels, "本語")).toEqual([labels[4]]);
  });

  it("shows all labels in registry order for an empty or blank query", () => {
    expect(filterLabels(labels, "")).toEqual(labels);
    expect(filterLabels(labels, "  ")).toEqual(labels);
  });

  it("returns no matches for an unknown name or an empty registry", () => {
    expect(filterLabels(labels, "missing")).toEqual([]);
    expect(filterLabels([], "bug")).toEqual([]);
  });
});
