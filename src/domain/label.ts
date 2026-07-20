export type Label = string;

// 12 gemstones split into two lightness/saturation tiers, each named after a
// gemstone to fit the app's Ametrine theme. A single hue-only wheel (all 12
// at one shared lightness/saturation) left dark mode reading as one uniform
// pastel band regardless of hue - green/cyan/blue hues in particular
// compress together at a fixed lightness - so "deep" and "pale" get their
// own lightness/saturation formula in index.css, not just a hue position.
// `amethyst`/`citrine` reuse theme gem names but are independent tokens
// (--color-label-*) from the core --color-accent/--color-accent-warm
// values. `morion` (dark neutral) and `selenite` (pale neutral) stand in for
// black/white: a literal black or white would disappear into the
// respective theme's own near-black/near-white background, so both carry a
// faint hue tint and index.css picks a lightness for each theme where the
// tint doesn't vanish.
export type LabelColor =
  // Deep tier
  | "ruby"
  | "amber"
  | "emerald"
  | "sapphire"
  | "lapis"
  | "morion"
  // Pale tier
  | "citrine"
  | "sphene"
  | "aquamarine"
  | "amethyst"
  | "morganite"
  | "selenite";

export interface LabelDefinition {
  name: Label;
  color: LabelColor;
}
