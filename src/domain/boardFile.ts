export const DEFAULT_BOARD_FILE_NAME = "facet.board.yaml";

export type BoardFileValidationErrorKind =
  | "name-required"
  | "file-name-required"
  | "invalid-file-name";

export class BoardFileValidationError extends Error {
  readonly kind: BoardFileValidationErrorKind;

  constructor(kind: BoardFileValidationErrorKind) {
    super(kind);
    this.name = "BoardFileValidationError";
    this.kind = kind;
  }
}

export function normalizeBoardName(input: string): string {
  const name = input.trim();
  if (!name) {
    throw new BoardFileValidationError("name-required");
  }
  return name;
}

export function normalizeBoardFileName(input: string): string {
  const fileName = input.trim();
  if (!fileName) {
    throw new BoardFileValidationError("file-name-required");
  }
  if (
    fileName === "." || fileName === ".." || fileName.includes("/") ||
    fileName.includes(":") || fileName.includes("\0")
  ) {
    throw new BoardFileValidationError("invalid-file-name");
  }
  // The extension is lowercased because board files are recognized by their
  // lowercase .yaml/.yml suffix when browsing; an uppercase extension would
  // produce a board this app cannot open again.
  if (/\.yaml$/i.test(fileName)) {
    return `${fileName.slice(0, -5)}.yaml`;
  }
  if (/\.yml$/i.test(fileName)) {
    return `${fileName.slice(0, -4)}.yml`;
  }
  return `${fileName}.yaml`;
}

export interface NewBoardPath {
  absolutePath: string;
  fileName: string;
}

export function resolveNewBoardPath(
  directory: string,
  inputFileName: string,
): NewBoardPath {
  const fileName = normalizeBoardFileName(inputFileName);
  const absolutePath = directory.endsWith("/")
    ? `${directory}${fileName}`
    : `${directory}/${fileName}`;
  return { absolutePath, fileName };
}
