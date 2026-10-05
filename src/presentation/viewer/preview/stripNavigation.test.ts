import { describe, expect, it } from "vitest";
import { isNavigationAttribute } from "./stripNavigation.ts";

describe("isNavigationAttribute", () => {
  it.each(["a", "area"])("treats href on %s as navigation", (elementName) => {
    // HTML href and SVG xlink:href both have the local name href.
    expect(isNavigationAttribute(elementName, "href")).toBe(true);
  });

  it.each(["use", "image", "textPath", "linearGradient", "radialGradient"])(
    "does not treat href used by %s for rendering as navigation",
    (elementName) => {
      expect(isNavigationAttribute(elementName, "href")).toBe(false);
    },
  );

  it.each([
    ["form", "action"],
    ["button", "formaction"],
    ["input", "formaction"],
  ])(
    "treats the submission target on %s as navigation",
    (elementName, attributeName) => {
      expect(isNavigationAttribute(elementName, attributeName)).toBe(true);
    },
  );

  it.each(["id", "class", "style", "marker-end", "viewBox"])(
    "does not treat the %s attribute as navigation",
    (attributeName) => {
      expect(isNavigationAttribute("a", attributeName)).toBe(false);
    },
  );
});
