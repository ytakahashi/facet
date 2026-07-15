import type { AppConfig } from "./appConfig.ts";

export interface ConfigRepository {
  load(): Promise<AppConfig>;
  save(config: AppConfig): Promise<void>;
}
