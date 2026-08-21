import { execFileSync } from "node:child_process";
import mysql from "mysql2/promise";

const ROOT_FOLDER_ID = process.env.ROOT_FOLDER_ID ?? "13jDFI3IkNoK1kAyifU1KODZ0_j6DGpoq";
const ROOT_FOLDER_NAME = process.env.ROOT_FOLDER_NAME ?? "قواعد قضائية";
const COLLECTION = process.env.COLLECTION ?? "judicial";
const FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";
const dryRun = process.env.DRY_RUN === "1";

function runDriveList(folderId) {
  const params = JSON.stringify({
    q: `'${folderId}' in parents and trashed = false`,
    orderBy: "name_natural",
    pageSize: 1000,
    fields: "files(id,name,mimeType,parents,webViewLink),nextPageToken",
  });
  const output = execFileSync("gws", ["drive", "files", "list", "--params", params, "--format", "json"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const start = output.indexOf("{");
  if (start < 0) throw new Error(`تعذر قراءة استجابة Google Drive للمجلد ${folderId}`);
  return JSON.parse(output.slice(start));
}

function categoryFor(path) {
  const text = path.toLowerCase();
  if (text.includes("فقه") || text.includes("شخصية")) return "fiqh";
  if (text.includes("مدني")) return "civil";
  if (text.includes("تجاري")) return "commercial";
  if (text.includes("إجراء") || text.includes("تفتيش") || text.includes("تعاميم") || text.includes("نماذج") || text.includes("صيغ")) {
    return "procedure";
  }
  return "general";
}

function publicFileLink(file) {
  return file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`;
}

function legislationMetadata(title) {
  if (COLLECTION !== "legislation" && COLLECTION !== "yemeni_laws") {
    return { documentType: "other", legislationYear: null, issuingAuthority: null };
  }
  const yearMatch = title.match(/[12][0-9]{3}/);
  const documentType = title.includes("معاهدة") ? "treaty"
    : title.includes("اتفاق") || title.includes("تعاون") ? "agreement"
      : title.includes("لائحة") ? "regulation"
        : title.includes("قرار") ? "decision"
          : title.includes("مرسوم") || title.includes("قرار جمهوري") ? "decree"
            : title.includes("قانون") ? "law"
              : "other";
  const issuingAuthority = title.includes("مجلس الوزراء") ? "مجلس الوزراء"
    : title.includes("وزارة") ? "وزارة مختصة"
      : title.includes("الجمهورية اليمنية") ? "الجمهورية اليمنية"
        : null;
  return { documentType, legislationYear: yearMatch ? Number(yearMatch[0]) : null, issuingAuthority };
}

function crawlFolder(folderId, parentDriveFolderId, name, ancestry, sortOrder, folders, files) {
  folders.push({
    driveFolderId: folderId,
    parentDriveFolderId,
    collection: COLLECTION,
    name,
    path: ancestry.join(" / "),
    sortOrder,
  });
  const response = runDriveList(folderId);
  const items = response.files ?? [];
  const childFolders = items.filter(item => item.mimeType === FOLDER_MIME_TYPE);
  const childFiles = items.filter(item => item.mimeType !== FOLDER_MIME_TYPE);

  childFolders.forEach((folder, index) => {
    crawlFolder(folder.id, folderId, folder.name, [...ancestry, folder.name], index + 1, folders, files);
  });
  childFiles.forEach((file, index) => {
    const path = [...ancestry, file.name].join(" / ");
    files.push({
      driveFileId: file.id,
      driveFolderId: folderId,
      folderSortOrder: index + 1,
      collection: COLLECTION,
      title: file.name,
      url: publicFileLink(file),
      category: categoryFor(path),
      description: `مستورد من مكتبة أ. معين الناصر: ${ancestry.join(" / ")}.`,
      ...legislationMetadata(file.name),
    });
  });
}

async function synchronizeIndex() {
  const folders = [];
  const files = [];
  crawlFolder(ROOT_FOLDER_ID, null, ROOT_FOLDER_NAME, [ROOT_FOLDER_NAME], 1, folders, files);
  const uniqueFiles = [...new Map(files.map(file => [file.driveFileId, file])).values()];
  if (uniqueFiles.length !== files.length) {
    throw new Error("اكتُشفت معرفات ملفات مكررة ضمن الشجرة؛ أوقف الاستيراد لحماية الفهرس.");
  }
  const summary = {
    folders: folders.length,
    files: uniqueFiles.length,
    firstFolder: folders[0]?.name ?? null,
    firstFile: uniqueFiles[0]?.title ?? null,
    lastFile: uniqueFiles.at(-1)?.title ?? null,
  };
  if (dryRun) {
    console.log(JSON.stringify({ mode: "dry-run", ...summary }, null, 2));
    return;
  }
  if (!process.env.DATABASE_URL) throw new Error("قاعدة البيانات غير متاحة للفهرسة.");

  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  try {
    await connection.beginTransaction();
    for (const folder of folders) {
      await connection.execute(
        `INSERT INTO legal_folders (driveFolderId, parentDriveFolderId, collection, name, path, sortOrder)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE parentDriveFolderId = VALUES(parentDriveFolderId), collection = VALUES(collection), name = VALUES(name), path = VALUES(path), sortOrder = VALUES(sortOrder)`,
        [folder.driveFolderId, folder.parentDriveFolderId, folder.collection, folder.name, folder.path, folder.sortOrder]
      );
    }
    for (let index = 0; index < uniqueFiles.length; index += 1) {
      const file = uniqueFiles[index];
      const [existingRows] = await connection.execute("SELECT id FROM legal_sources WHERE driveFileId = ? LIMIT 1", [file.driveFileId]);
      if (existingRows.length > 0) {
        await connection.execute(
          `UPDATE legal_sources
           SET category = ?, collection = ?, sortOrder = ?, driveFolderId = ?, folderSortOrder = ?, title = ?, description = ?, url = ?, documentType = ?, legislationYear = ?, issuingAuthority = ?
           WHERE driveFileId = ?`,
          [file.category, file.collection, index + 1, file.driveFolderId, file.folderSortOrder, file.title, file.description, file.url, file.documentType, file.legislationYear, file.issuingAuthority, file.driveFileId]
        );
      } else {
        await connection.execute(
          `INSERT INTO legal_sources (category, collection, sortOrder, driveFileId, driveFolderId, folderSortOrder, title, description, url, documentType, legislationYear, issuingAuthority)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [file.category, file.collection, index + 1, file.driveFileId, file.driveFolderId, file.folderSortOrder, file.title, file.description, file.url, file.documentType, file.legislationYear, file.issuingAuthority]
        );
      }
    }
    await connection.commit();
    console.log(JSON.stringify({ mode: "sync-index", ...summary }, null, 2));
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.end();
  }
}

synchronizeIndex().catch(error => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`فشل فهرسة ملفات Google Drive: ${message}`);
  process.exitCode = 1;
});
