import { useEffect, useState } from "react";
import type { LabelColor } from "../../domain/label.ts";
import { toUiError } from "../errors/toUiError.ts";
import { LabelColorSwatchGrid } from "./LabelColorSwatchGrid.tsx";

export function LabelCreateForm(
  { onCreateLabel, open }: {
    onCreateLabel: (name: string, color: LabelColor) => void;
    open: boolean;
  },
) {
  const [name, setName] = useState("");
  const [color, setColor] = useState<LabelColor>("ruby");
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!open) return;
    setName("");
    setColor("ruby");
    setError(undefined);
  }, [open]);

  return (
    <form
      className="label-create-form"
      onSubmit={(event) => {
        event.preventDefault();
        const trimmed = name.trim();
        if (!trimmed) return;
        try {
          onCreateLabel(trimmed, color);
          setName("");
          setColor("ruby");
          setError(undefined);
        } catch (cause) {
          setError(toUiError(cause).message);
        }
      }}
    >
      <input
        type="text"
        value={name}
        placeholder="New label"
        aria-label="New label name"
        onChange={(event) => {
          setName(event.target.value);
          setError(undefined);
        }}
      />
      <LabelColorSwatchGrid value={color} onChange={setColor} />
      {error && <p className="label-create-form__error" role="alert">{error}
      </p>}
      <button type="submit" disabled={name.trim() === ""}>Add</button>
    </form>
  );
}
