import { mkdir, writeFile } from "node:fs/promises";
import { listTelegramContractTemplates } from "../server/db.ts";
import { createTelegramContractDocument } from "../server/telegramContractDocument.ts";

const outputDirectory = "/home/ubuntu/generated-contract-template-files";
const pageSize = 12;
const firstPage = await listTelegramContractTemplates(1, pageSize);
if (firstPage.total === 0) throw new Error("تعذر قراءة نماذج العقود من قاعدة البوت.");
const templates = [...firstPage.templates];
for (let page = 2; templates.length < firstPage.total; page += 1) {
  const nextPage = await listTelegramContractTemplates(page, pageSize);
  if (!nextPage.templates.length) break;
  templates.push(...nextPage.templates);
}
if (templates.length !== firstPage.total) throw new Error("تعذر قراءة جميع نماذج العقود من قاعدة البوت.");

await mkdir(outputDirectory, { recursive: true });
const manifest = [];
for (const template of templates) {
  const document = await createTelegramContractDocument(template);
  const prefix = String(template.sortOrder || template.id).padStart(3, "0");
  const filePath = `${outputDirectory}/${prefix} - ${document.filename}`;
  await writeFile(filePath, document.data);
  manifest.push({ id: template.id, sourceDocumentId: template.sourceDocumentId, fileName: document.filename, filePath });
}
await writeFile(`${outputDirectory}/manifest.json`, JSON.stringify(manifest, null, 2), "utf8");
console.log(JSON.stringify({ templates: manifest.length, outputDirectory }));
process.exit(0);
