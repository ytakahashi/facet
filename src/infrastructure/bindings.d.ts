export interface Bindings {
  readTextFile(path: string): Promise<string>;
}

declare global {
  const bindings: Bindings;
}
