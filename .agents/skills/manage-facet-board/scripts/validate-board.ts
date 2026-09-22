#!/usr/bin/env -S deno run --allow-read --allow-env

// Keep this pin aligned with package.json. The explicit version keeps the
// validator portable when the skill is invoked outside the Facet repository.
import { parse, YAMLParseError } from "npm:yaml@2.9.0";

const PRIORITIES = new Set(["low", "medium", "high"]);
const LABEL_COLORS = new Set([
  "ruby",
  "amber",
  "emerald",
  "sapphire",
  "lapis",
  "morion",
  "citrine",
  "sphene",
  "aquamarine",
  "amethyst",
  "morganite",
  "selenite",
]);

export interface ValidationResult {
  errors: string[];
  warnings: string[];
}

export type InspectCardPath = (
  path: string,
) => Promise<"file" | "missing" | "unreadable" | "directory">;

export async function validateBoard(
  value: unknown,
  inspectCardPath: InspectCardPath,
): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!isRecord(value)) {
    return { errors: ["board must be a YAML mapping"], warnings };
  }

  checkKeys(value, ["version", "name", "labels", "columns"], "board", errors);
  if (value.version !== 1) {
    errors.push("board.version must be 1");
  }
  checkNonEmptyString(value.name, "board.name", errors);

  const labelNames = new Set<string>();
  if (value.labels === undefined) {
    warnings.push(
      "board.labels is absent; Facet reads it as empty but writes it explicitly",
    );
  } else if (!Array.isArray(value.labels)) {
    errors.push("board.labels must be an array");
  } else {
    value.labels.forEach((label, index) => {
      const location = `board.labels[${index}]`;
      if (!isRecord(label)) {
        errors.push(`${location} must be a mapping`);
        return;
      }
      checkKeys(label, ["name", "color"], location, errors);
      if (checkNonEmptyString(label.name, `${location}.name`, errors)) {
        if (labelNames.has(label.name)) {
          errors.push(
            `${location}.name duplicates label ${JSON.stringify(label.name)}`,
          );
        }
        labelNames.add(label.name);
      }
      if (typeof label.color !== "string" || !LABEL_COLORS.has(label.color)) {
        errors.push(`${location}.color is not a supported label color`);
      }
    });
  }

  if (!Array.isArray(value.columns)) {
    errors.push("board.columns must be an array");
    return { errors, warnings };
  }

  const columnIds = new Set<string>();
  const cardPaths = new Set<string>();
  for (let columnIndex = 0; columnIndex < value.columns.length; columnIndex++) {
    const column = value.columns[columnIndex];
    const location = `board.columns[${columnIndex}]`;
    if (!isRecord(column)) {
      errors.push(`${location} must be a mapping`);
      continue;
    }

    checkKeys(column, ["id", "name", "cards"], location, errors);
    if (checkNonEmptyString(column.id, `${location}.id`, errors)) {
      if (columnIds.has(column.id)) {
        errors.push(
          `${location}.id duplicates column ${JSON.stringify(column.id)}`,
        );
      }
      columnIds.add(column.id);
    }
    checkNonEmptyString(column.name, `${location}.name`, errors);

    if (column.cards === undefined) {
      warnings.push(
        `${location}.cards is absent; Facet reads it as empty but writes it explicitly`,
      );
      continue;
    }
    if (!Array.isArray(column.cards)) {
      errors.push(`${location}.cards must be an array`);
      continue;
    }

    for (let cardIndex = 0; cardIndex < column.cards.length; cardIndex++) {
      const card = column.cards[cardIndex];
      const cardLocation = `${location}.cards[${cardIndex}]`;
      if (!isRecord(card)) {
        errors.push(`${cardLocation} must be a mapping`);
        continue;
      }
      checkKeys(
        card,
        ["path", "title", "priority", "labels"],
        cardLocation,
        errors,
      );

      const normalizedPath = validateCardPath(card.path, cardLocation, errors);
      if (normalizedPath !== undefined) {
        const identity = normalizedPath.normalize("NFC").toLowerCase();
        if (cardPaths.has(identity)) {
          errors.push(
            `${cardLocation}.path duplicates another Card after path normalization`,
          );
        } else {
          cardPaths.add(identity);
        }

        const state = await inspectCardPath(normalizedPath);
        if (state !== "file") {
          warnings.push(`${cardLocation}.path is ${state}: ${normalizedPath}`);
        }
      }

      if (card.title !== undefined) {
        checkNonEmptyString(card.title, `${cardLocation}.title`, errors);
      }
      if (
        card.priority !== undefined &&
        (typeof card.priority !== "string" || !PRIORITIES.has(card.priority))
      ) {
        errors.push(`${cardLocation}.priority must be low, medium, or high`);
      }

      if (card.labels === undefined) continue;
      if (!Array.isArray(card.labels)) {
        errors.push(`${cardLocation}.labels must be an array`);
        continue;
      }
      const cardLabels = new Set<string>();
      card.labels.forEach((label, labelIndex) => {
        const labelLocation = `${cardLocation}.labels[${labelIndex}]`;
        if (typeof label !== "string" || label.trim() === "") {
          errors.push(`${labelLocation} must be a non-empty string`);
          return;
        }
        if (!labelNames.has(label)) {
          errors.push(
            `${labelLocation} references undefined label ${
              JSON.stringify(label)
            }`,
          );
        }
        if (cardLabels.has(label)) {
          errors.push(
            `${labelLocation} duplicates label ${JSON.stringify(label)}`,
          );
        }
        cardLabels.add(label);
      });
    }
  }

  return { errors, warnings };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function checkKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  location: string,
  errors: string[],
): void {
  const allowedKeys = new Set(allowed);
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) {
      errors.push(
        `${location}.${key} is not supported and would be lost on save`,
      );
    }
  }
}

function checkNonEmptyString(
  value: unknown,
  location: string,
  errors: string[],
): value is string {
  if (typeof value !== "string" || value.trim() === "") {
    errors.push(`${location} must be a non-empty string`);
    return false;
  }
  return true;
}

function validateCardPath(
  value: unknown,
  location: string,
  errors: string[],
): string | undefined {
  if (typeof value !== "string" || value === "") {
    errors.push(`${location}.path must be a non-empty string`);
    return undefined;
  }
  if (value.startsWith("/")) {
    errors.push(`${location}.path must be relative to the board root`);
    return undefined;
  }

  const segments: string[] = [];
  for (const segment of value.split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") {
      if (segments.length === 0) {
        errors.push(`${location}.path escapes the board root`);
        return undefined;
      }
      segments.pop();
    } else {
      segments.push(segment);
    }
  }

  const normalized = segments.join("/");
  if (normalized === "" || !normalized.toLowerCase().endsWith(".md")) {
    errors.push(`${location}.path must name a Markdown file`);
    return undefined;
  }
  return normalized;
}

function directoryOf(path: string): string {
  const index = path.lastIndexOf("/");
  return index === -1 ? "." : path.slice(0, index) || "/";
}

function joinPath(directory: string, path: string): string {
  if (directory === "/") return `/${path}`;
  return `${directory}/${path}`;
}

async function inspectCardFile(path: string): Promise<
  "file" | "missing" | "unreadable" | "directory"
> {
  try {
    const info = await Deno.stat(path);
    return info.isDirectory ? "directory" : "file";
  } catch (error) {
    return error instanceof Deno.errors.NotFound ? "missing" : "unreadable";
  }
}

async function main(): Promise<void> {
  if (Deno.args.length !== 1) {
    console.error("Usage: validate-board.ts <board-path>");
    Deno.exitCode = 2;
    return;
  }

  const boardPath = Deno.args[0];
  let source: string;
  try {
    source = await Deno.readTextFile(boardPath);
  } catch (error) {
    console.error(
      `[error] cannot read board: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    Deno.exitCode = 1;
    return;
  }

  let value: unknown;
  try {
    value = parse(source);
  } catch (error) {
    // Only syntax failures are safe to classify as invalid input. Permission
    // and runtime failures must retain their real type so an agent does not
    // respond by rewriting a valid board.
    if (!(error instanceof YAMLParseError)) throw error;
    console.error(
      `[error] invalid YAML: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    Deno.exitCode = 1;
    return;
  }

  const boardDirectory = directoryOf(boardPath);
  const result = await validateBoard(
    value,
    (path) => inspectCardFile(joinPath(boardDirectory, path)),
  );
  for (const warning of result.warnings) console.warn(`[warning] ${warning}`);
  for (const error of result.errors) console.error(`[error] ${error}`);

  if (result.errors.length > 0) {
    Deno.exitCode = 1;
    return;
  }
  console.log(
    `Valid Facet board${
      result.warnings.length === 0
        ? ""
        : ` with ${result.warnings.length} warning(s)`
    }: ${boardPath}`,
  );
}

if (import.meta.main) await main();
