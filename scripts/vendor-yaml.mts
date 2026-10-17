import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const packagePath = fileURLToPath(import.meta.resolve("yaml/package.json"));
const yamlDirectory = dirname(packagePath);
const { version } = JSON.parse(await readFile(packagePath, "utf8")) as {
  version: string;
};
const license = await readFile(join(yamlDirectory, "LICENSE"), "utf8");
const outputDirectory = await mkdtemp(join(tmpdir(), "facet-vendor-yaml-"));

try {
  // Use the ESM entry so the bundle needs neither require() nor node_modules.
  execFileSync(
    "vp",
    [
      "pack",
      join(yamlDirectory, "browser/index.js"),
      "--no-config",
      "--platform",
      "neutral",
      "--format",
      "esm",
      "--no-dts",
      "--out-dir",
      outputDirectory,
    ],
    { cwd: root, stdio: "inherit" },
  );
  const bundle = await readFile(join(outputDirectory, "index.js"), "utf8");
  const header = [
    "// Generated file. Do not edit.",
    `// yaml version: ${version}`,
    "// Regenerate: vp run vendor:yaml",
    "//",
    ...license
      .trimEnd()
      .split("\n")
      .map((line) => `// ${line}`.trimEnd()),
    "",
  ].join("\n");
  const vendorDirectory = new URL(
    ".agents/skills/manage-facet-board/scripts/vendor/",
    root,
  );
  await mkdir(vendorDirectory, { recursive: true });
  await writeFile(new URL("yaml.mjs", vendorDirectory), `${header}\n${bundle}`);
} finally {
  await rm(outputDirectory, { recursive: true, force: true });
}
