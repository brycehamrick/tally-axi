import { chmod, copyFile, writeFile } from "node:fs/promises";
import { tools } from "../dist/tools.js";

await chmod(new URL("../dist/index.js", import.meta.url), 0o755);
await copyFile(new URL("../axi.json", import.meta.url), new URL("../dist/axi.json", import.meta.url));
await writeFile(new URL("../dist/tools.json", import.meta.url), `${JSON.stringify(tools, null, 2)}\n`);
