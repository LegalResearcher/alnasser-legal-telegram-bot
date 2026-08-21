import { execFileSync } from "node:child_process";
import { readdirSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

const inputDirectory = "/home/ubuntu/imports/yemeni-laws/extracted";
const outputFile = "/home/ubuntu/imports/yemeni-laws/yemeni-law-title-manifest.json";

const files = readdirSync(inputDirectory, { recursive: true })
  .map(file => join(inputDirectory, file))
  .filter(file => file.toLowerCase().endsWith(".pdf"))
  .sort((left, right) => left.localeCompare(right, "en", { numeric: true, sensitivity: "base" }));

const records = files.map((file, index) => {
  let firstPageText = "";
  try {
    firstPageText = execFileSync("pdftotext", ["-f", "1", "-l", "1", "-layout", file, "-"], {
      encoding: "utf8",
      maxBuffer: 1024 * 1024,
    });
  } catch {
    firstPageText = "";
  }
  const firstPageLines = firstPageText
    .split(/\r?\n/)
    .map(line => line.replace(/[\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, 24);
  const normalized = firstPageLines.join(" ").slice(0, 1200);
  return {
    sortOrder: index + 1,
    filename: basename(file),
    absolutePath: file,
    firstPageLines,
    firstPageText: normalized,
  };
});

writeFileSync(outputFile, JSON.stringify(records, null, 2), "utf8");
console.log(JSON.stringify({ total: records.length, outputFile }, null, 2));
