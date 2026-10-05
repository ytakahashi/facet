import type { MermaidConfig } from "mermaid";

// The resolved values of the design tokens a diagram is drawn with. Mermaid
// derives shades from these with its own colour maths, so it needs real colour
// values rather than `var(--color-*)` references.
export interface MermaidPalette {
  text: string;
  textStrong: string;
  border: string;
  surface: string;
  surfaceRaised: string;
  fontFamily: string;
}

export function mermaidConfig(
  palette: MermaidPalette,
  darkMode: boolean,
): MermaidConfig {
  return {
    startOnLoad: false,
    // Strict sanitises labels and disables click callbacks. Mermaid refuses to
    // let an `%%{init}%%` directive in the card loosen this.
    securityLevel: "strict",
    // A failed render throws instead of leaving Mermaid's error graphic in the
    // document; the preview shows its own fallback.
    suppressErrorRendering: true,
    theme: "base",
    fontFamily: palette.fontFamily,
    themeVariables: {
      darkMode,
      fontFamily: palette.fontFamily,
      fontSize: "14px",
      background: palette.surfaceRaised,
      primaryColor: palette.surface,
      primaryTextColor: palette.textStrong,
      primaryBorderColor: palette.text,
      secondaryColor: palette.surfaceRaised,
      tertiaryColor: palette.surface,
      lineColor: palette.text,
      textColor: palette.text,
      clusterBkg: palette.surfaceRaised,
      clusterBorder: palette.border,
      noteBkgColor: palette.surface,
      noteTextColor: palette.textStrong,
      noteBorderColor: palette.border,
    },
  };
}
