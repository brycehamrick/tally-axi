import { readdir, readFile } from "node:fs/promises";

async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map((entry) => entry.isDirectory() ? files(`${directory}/${entry.name}`) : [`${directory}/${entry.name}`]))).flat();
}
let failed = false;
for (const file of (await files("src")).filter((name) => name.endsWith(".ts"))) {
  const lines = (await readFile(file, "utf8")).split("\n");
  lines.forEach((line, index) => {
    if (/\s+$/.test(line)) { console.error(`${file}:${index + 1}: trailing whitespace`); failed = true; }
    if (line.length > 400) { console.error(`${file}:${index + 1}: line exceeds 400 characters`); failed = true; }
  });
}
if (failed) process.exitCode = 1;
