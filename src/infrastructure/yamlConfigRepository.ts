import { parse, stringify } from "yaml";
import type { AppConfig } from "../domain/appConfig.ts";
import { emptyAppConfig } from "../domain/appConfig.ts";
import { directoryOf } from "../domain/boardPath.ts";
import type { ConfigRepository } from "../domain/configRepository.ts";
import type { FileSystemPort } from "../domain/fileSystemPort.ts";

interface RawAppConfig {
  version: number;
  recentBoards?: string[];
}

export class YamlConfigRepository implements ConfigRepository {
  private readonly fileSystem: FileSystemPort;

  constructor(fileSystem: FileSystemPort) {
    this.fileSystem = fileSystem;
  }

  async load(): Promise<AppConfig> {
    const path = await this.configPath();
    if (!(await this.fileSystem.exists(path))) {
      return emptyAppConfig();
    }

    try {
      const yamlText = await this.fileSystem.readTextFile(path);
      const raw = parse(yamlText) as RawAppConfig | null;
      if (!raw || !Array.isArray(raw.recentBoards)) {
        return emptyAppConfig();
      }
      return { version: 1, recentBoards: raw.recentBoards };
    } catch {
      return emptyAppConfig();
    }
  }

  async save(config: AppConfig): Promise<void> {
    const path = await this.configPath();
    await this.fileSystem.mkdir(directoryOf(path));
    await this.fileSystem.writeTextFile(path, stringify(config));
  }

  private async configPath(): Promise<string> {
    const home = await this.fileSystem.homeDirectory();
    return `${home}/Library/Application Support/Facet/config.yaml`;
  }
}
