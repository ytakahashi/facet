import type { FileSystemPort } from "../domain/fileSystemPort.ts";
import { UseCaseError } from "./useCaseError.ts";

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
    throw new UseCaseError("directory.name-required");
  }
  if (
    name === "." || name === ".." || name.includes("/") ||
    name.includes(":") || name.includes("\0")
  ) {
    throw new UseCaseError("directory.invalid-name");
  }

  const path = parentDirectory.endsWith("/")
    ? `${parentDirectory}${name}`
    : `${parentDirectory}/${name}`;

  let exists: boolean;
  try {
    exists = await fileSystem.exists(path);
  } catch (cause) {
    throw new UseCaseError("directory.create-failed", { path }, { cause });
  }
  if (exists) {
    throw new UseCaseError("directory.already-exists", { path });
  }

  try {
    await fileSystem.mkdir(path);
  } catch (cause) {
    throw new UseCaseError("directory.create-failed", { path }, { cause });
  }
  return path;
}
