import { readFile, readdir } from "node:fs/promises";

const roots = [".github", "scripts", "src", "test"];
const standalone = [
  ".env.example",
  ".gitignore",
  "CONTRIBUTING.md",
  "README.md",
  "SECURITY.md",
  "axi.json",
  "integration.json",
  "package.json",
  "tsconfig.json",
];

async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((entry) =>
        entry.isDirectory()
          ? files(`${directory}/${entry.name}`)
          : [`${directory}/${entry.name}`],
      ),
    )
  ).flat();
}

let failed = false;
const paths = [...standalone, ...(await Promise.all(roots.map(files))).flat()];
for (const path of paths) {
  const contents = await readFile(path, "utf8");
  if (!contents.endsWith("\n")) {
    console.error(`${path}: missing final newline`);
    failed = true;
  }
  contents.split("\n").forEach((line, index) => {
    if (/[ \t]+$/.test(line)) {
      console.error(`${path}:${index + 1}: trailing whitespace`);
      failed = true;
    }
  });
}

if (failed) process.exitCode = 1;
