import { directoryOf, toRelativeCardPath } from "./boardPath.ts";

export type CardFileValidationErrorKind =
  | "title-required"
  | "file-name-required"
  | "invalid-file-name"
  | "not-markdown-file"
  | "outside-board-directory";

export class CardFileValidationError extends Error {
  readonly kind: CardFileValidationErrorKind;

  constructor(kind: CardFileValidationErrorKind) {
    super(kind);
    this.name = "CardFileValidationError";
    this.kind = kind;
  }
}

export function suggestMarkdownFileName(title: string): string {
  const base = title.trim()
    .replace(/[/:]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return `${base || "untitled"}.md`;
}

export function normalizeMarkdownFileName(input: string): string {
  const fileName = input.trim();
  if (!fileName) {
    throw new CardFileValidationError("file-name-required");
  }
  if (
    fileName === "." || fileName === ".." || fileName.includes("/") ||
    fileName.includes(":")
  ) {
    throw new CardFileValidationError("invalid-file-name");
  }
  if (fileName.includes("\0")) {
    throw new CardFileValidationError("invalid-file-name");
  }
  if (/\.md$/i.test(fileName)) {
    return `${fileName.slice(0, -3)}.md`;
  }
  return `${fileName}.md`;
}

export function initialMarkdown(title: string): string {
  const normalizedTitle = title.trim();
  if (!normalizedTitle) {
    throw new CardFileValidationError("title-required");
  }
  return `# ${normalizedTitle}\n\n`;
}

export interface NewMarkdownPath {
  absolutePath: string;
  relativePath: string;
  fileName: string;
}

export interface ExistingMarkdownPath {
  absolutePath: string;
  relativePath: string;
}

export function resolveExistingMarkdownPath(
  boardPath: string,
  absolutePath: string,
): ExistingMarkdownPath {
  const relative = toRelativeCardPath(directoryOf(boardPath), absolutePath);
  if (!relative.ok) {
    throw new CardFileValidationError("outside-board-directory");
  }
  if (!relative.path.toLowerCase().endsWith(".md")) {
    throw new CardFileValidationError("not-markdown-file");
  }
  return { absolutePath, relativePath: relative.path };
}

export function resolveNewMarkdownPath(
  boardPath: string,
  directory: string,
  inputFileName: string,
): NewMarkdownPath {
  const fileName = normalizeMarkdownFileName(inputFileName);
  const absolutePath = directory.endsWith("/")
    ? `${directory}${fileName}`
    : `${directory}/${fileName}`;
  const relative = toRelativeCardPath(directoryOf(boardPath), absolutePath);
  if (!relative.ok) {
    throw new CardFileValidationError("outside-board-directory");
  }
  return { absolutePath, relativePath: relative.path, fileName };
}
