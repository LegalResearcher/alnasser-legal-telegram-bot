import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const sourceDirectory = "/home/ubuntu/webdev-static-assets/yemeni-laws";
const outputPath = "/home/ubuntu/imports/yemeni-laws/drive-file-manifest.json";
const parentFolderId = process.argv[2];

if (!parentFolderId) {
  throw new Error("يلزم تمرير معرّف مجلد Google Drive المستهدف.");
}

const existing = existsSync(outputPath)
  ? JSON.parse(readFileSync(outputPath, "utf8"))
  : [];
const uploaded = new Map(existing.map(item => [item.filename, item]));
const files = readdirSync(sourceDirectory)
  .filter(filename => filename.toLowerCase().endsWith(".pdf"))
  .sort((left, right) => left.localeCompare(right, "en", { numeric: true, sensitivity: "base" }));

for (const filename of files) {
  if (uploaded.has(filename)) continue;
  const result = execFileSync(
    "gws",
    [
      "drive", "files", "create",
      "--upload", filename,
      "--upload-content-type", "application/pdf",
      "--json", JSON.stringify({ name: filename, parents: [parentFolderId] }),
    ],
    { cwd: sourceDirectory, encoding: "utf8", maxBuffer: 1024 * 1024 }
  );
  const created = JSON.parse(result);
  if (!created?.id) throw new Error(`تعذر حفظ معرّف ملف ${filename}.`);
  uploaded.set(filename, { filename, driveFileId: created.id });
  writeFileSync(outputPath, JSON.stringify([...uploaded.values()], null, 2), "utf8");
  console.log(JSON.stringify({ uploaded: uploaded.size, filename }, null, 2));
}

console.log(JSON.stringify({ complete: uploaded.size, outputPath }, null, 2));
