import { rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = dirname(fileURLToPath(import.meta.url));
const distDir = resolve(currentDir, "..", "dist");

await rm(distDir, { recursive: true, force: true });
