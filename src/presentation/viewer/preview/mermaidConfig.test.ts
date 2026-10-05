import { describe, expect, it } from "vitest";
import { mermaidConfig, type MermaidPalette } from "./mermaidConfig.ts";

const palette: MermaidPalette = {
  text: "#111111",
  textStrong: "#222222",
  border: "#333333",
  surface: "#444444",
  surfaceRaised: "#555555",
  fontFamily: "system-ui",
};

describe("mermaidConfig", () => {
  it("keeps the strict security level", () => {
    expect(mermaidConfig(palette, false).securityLevel).toBe("strict");
  });

  it("throws on a failed render instead of drawing Mermaid's error graphic", () => {
    expect(mermaidConfig(palette, false).suppressErrorRendering).toBe(true);
  });

  it("draws with the palette on the base theme", () => {
    const config = mermaidConfig(palette, false);

    expect(config.theme).toBe("base");
    expect(config.themeVariables).toMatchObject({
      background: "#555555",
      primaryColor: "#444444",
      primaryTextColor: "#222222",
      lineColor: "#111111",
      fontFamily: "system-ui",
    });
  });

  it("passes the colour scheme through", () => {
    expect(mermaidConfig(palette, true).themeVariables).toMatchObject({
      darkMode: true,
    });
  });
});
