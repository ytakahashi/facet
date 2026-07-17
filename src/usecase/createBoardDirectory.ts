import type { FileSystemPort } from "../domain/fileSystemPort.ts";

export interface CreateBoardDirectoryDeps {
  fileSystem: FileSystemPort;
}

export async function createBoardDirectory(
  parentDirectory: string,
  inputName: string,
  { fileSystem }: CreateBoardDirectoryDeps,
): Promise<string> {
  const name = inputName.trim();
  if (!name) {
    throw new Error("Directory name is required.");
  }
  if (
    name === "." || name === ".." || name.includes("/") ||
    name.includes(":") || name.includes("\0")
  ) {
    throw new Error("Enter a single valid directory name.");
  }

  const path = parentDirectory.endsWith("/")
    ? `${parentDirectory}${name}`
    : `${parentDirectory}/${name}`;
  if (await fileSystem.exists(path)) {
    throw new Error(`A file or directory already exists at ${path}`);
  }

  await fileSystem.mkdir(path);
  return path;
}
