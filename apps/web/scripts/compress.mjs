import { createRequire } from "node:module";
import { createWriteStream } from "node:fs";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { ZipArchive } = require("archiver");

const root = resolve(import.meta.dirname, "..");
const outputDir = resolve(root, ".output");
const outPath = resolve(root, "compressed", "grafana-recap-web.zip");

const output = createWriteStream(outPath);
const archive = new ZipArchive({ zlib: { level: 9 } });

output.on("close", () => {
  const sizeMB = (archive.pointer() / 1024 / 1024).toFixed(2);
  console.log(`Created ${outPath} (${sizeMB} MB)`);
});

archive.on("error", (err) => {
  console.error("Archive error:", err);
  process.exit(1);
});

archive.pipe(output);
archive.directory(outputDir, "output");
await archive.finalize();
