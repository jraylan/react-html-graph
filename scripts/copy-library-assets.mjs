import { cp, mkdir, readdir } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(currentDir, "..");
const sourceDir = resolve(projectRoot, "src");
const outputDir = resolve(projectRoot, "dist");
const assetExtensions = new Set([".css", ".svg"]);

async function copyAssetsRecursively(fromDir, toDir) {
    const entries = await readdir(fromDir, { withFileTypes: true });

    for (const entry of entries) {
        const sourcePath = resolve(fromDir, entry.name);
        const targetPath = resolve(toDir, entry.name);

        if (entry.isDirectory()) {
            await copyAssetsRecursively(sourcePath, targetPath);
            continue;
        }

        if (!assetExtensions.has(extname(entry.name))) {
            continue;
        }

        await mkdir(dirname(targetPath), { recursive: true });
        await cp(sourcePath, targetPath, { force: true });
    }
}

await copyAssetsRecursively(sourceDir, outputDir);
