import type { LabelColor } from "../../domain/label.ts";

// Fixed 12-stop gemstone hue wheel order (see domain/label.ts), rendered as
// a 6x2 grid via CSS grid-template-columns so this array stays the single
// source of truth for both the swatch order and the color values.
const LABEL_COLORS: LabelColor[] = [
  "ruby",
  "amber",
  "citrine",
  "peridot",
  "emerald",
  "jade",
  "turquoise",
  "aquamarine",
  "sapphire",
  "lapis",
  "amethyst",
  "morganite",
];

interface LabelColorSwatchGridProps {
  value: LabelColor;
  onChange: (color: LabelColor) => void;
}

// Display-only picker shared by the label create form and each registry
// entry's edit row. Selection commits immediately (no local form state):
// the current value always comes from the caller.
export function LabelColorSwatchGrid(
  { value, onChange }: LabelColorSwatchGridProps,
) {
  return (
    <div
      className="label-color-swatch-grid"
      role="group"
      aria-label="Label color"
    >
      {LABEL_COLORS.map((color) => {
        const name = color[0].toUpperCase() + color.slice(1);
        return (
          <button
            key={color}
            type="button"
            className={`label-color-swatch label-color-swatch--${color}${
              color === value ? " is-selected" : ""
            }`}
            title={name}
            aria-label={name}
            aria-pressed={color === value}
            onClick={() => onChange(color)}
          />
        );
      })}
    </div>
  );
}
