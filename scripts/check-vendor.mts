import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const { dependencies } = JSON.parse(
  await readFile(new URL("package.json", root), "utf8"),
) as { dependencies: { yaml: string } };
const bundle = await readFile(
  new URL(".agents/skills/manage-facet-board/scripts/vendor/yaml.mjs", root),
  "utf8",
);
const version = /^\/\/ yaml version: (\S+)$/m.exec(bundle)?.[1];

if (version !== dependencies.yaml) {
  console.error(
    `Vendored yaml version ${version ?? "(missing)"} does not match package.json (${dependencies.yaml}). Run vp run vendor:yaml.`,
  );
  process.exitCode = 1;
} else {
  console.log(`Vendored yaml version matches package.json: ${version}`);
}
