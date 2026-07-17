import { directoryOf, toRelativeCardPath } from "./boardPath.ts";

export class CardFileValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CardFileValidationError";
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
    throw new CardFileValidationError("File name is required.");
  }
  if (
    fileName === "." || fileName === ".." || fileName.includes("/") ||
    fileName.includes(":")
  ) {
    throw new CardFileValidationError("Enter a single valid file name.");
  }
  if (fileName.includes("\0")) {
    throw new CardFileValidationError(
      "File name contains an invalid character.",
    );
  }
  if (/\.md$/i.test(fileName)) {
    return `${fileName.slice(0, -3)}.md`;
  }
  return `${fileName}.md`;
}

export function initialMarkdown(title: string): string {
  const normalizedTitle = title.trim();
  if (!normalizedTitle) {
    throw new CardFileValidationError("Title is required.");
  }
  return `# ${normalizedTitle}\n\n`;
}

export interface NewMarkdownPath {
  absolutePath: string;
  relativePath: string;
  fileName: string;
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
    throw new CardFileValidationError(
      "Choose a directory inside the board directory.",
    );
  }
  return { absolutePath, relativePath: relative.path, fileName };
}
