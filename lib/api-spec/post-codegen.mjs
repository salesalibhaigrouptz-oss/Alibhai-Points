import { readFile, writeFile } from "node:fs/promises";

const indexPath = new URL("../api-zod/src/index.ts", import.meta.url);
const source = await readFile(indexPath, "utf8");
const lines = source
  .split("\n")
  .filter((line) => line.trim() !== "export * from './generated/types';");

if (!lines.some((line) => line.includes("GeneratedTypes"))) {
  lines.push('export * as GeneratedTypes from "./generated/types";');
}

await writeFile(indexPath, lines.join("\n"));
