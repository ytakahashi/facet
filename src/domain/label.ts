export type Label = string;

// A 12-stop hue wheel (30° apart), each stop named after a gemstone to fit
// the app's Ametrine theme. `amethyst`/`citrine` reuse theme gem names but
// are independent tokens (--color-label-*) from the core values.
export type LabelColor =
  | "ruby"
  | "amber"
  | "citrine"
  | "peridot"
  | "emerald"
  | "jade"
  | "turquoise"
  | "aquamarine"
  | "sapphire"
  | "lapis"
  | "amethyst"
  | "morganite";

export interface LabelDefinition {
  name: Label;
  color: LabelColor;
}
