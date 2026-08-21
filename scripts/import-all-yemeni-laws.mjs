import { readFileSync } from "node:fs";
import mysql from "mysql2/promise";

const ROOT_FOLDER_ID = "all-yemeni-laws-root";
const ROOT_FOLDER_NAME = "جميع القوانين اليمنية";
const COLLECTION = "all_yemeni_laws";
const manifestPath = "/home/ubuntu/imports/yemeni-laws/yemeni-law-title-manifest.json";
const driveFileManifestPath = "/home/ubuntu/imports/yemeni-laws/drive-file-manifest.json";
const dryRun = process.env.DRY_RUN === "1";

function normalizeTitleText(text) {
  return text
    .normalize("NFKC")
    .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, "")
    .replace(/ـ/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function removeLeadingDuplicateWords(value) {
  const words = value.split(" ").filter(Boolean);
  for (let size = Math.min(6, Math.floor(words.length / 2)); size >= 1; size -= 1) {
    if (words.slice(0, size).join(" ") === words.slice(size, size * 2).join(" ")) {
      return words.slice(size).join(" ");
    }
  }
  return value;
}

const referenceTitleOverrides = {
  "Yemen_Constitution.pdf": "دستور الجمهورية اليمنية",
  "Yemeni_Laws2.pdf": "قانون الإجراءات الجزائية: قرار جمهوري بالقانون رقم 13 لسنة 1994",
  "Yemeni_Laws3.pdf": "قانون الإجراءات الجزائية العسكرية: قانون رقم 7 لسنة 1996",
  "Yemeni_Laws4.pdf": "قانون إجراءات اتهام ومحاكمة شاغلي وظائف السلطة التنفيذية العليا في الدولة: قانون رقم 6 لسنة 1995",
  "Yemeni_Laws5.pdf": "قانون الإثبات: قانون رقم 21 لسنة 1992 وتعديلاته",
  "Yemeni_Laws17.pdf": "اللائحة التنفيذية لقانون تنظيم حمل الأسلحة النارية والذخائر والاتجار بها: قرار جمهوري رقم 1 لسنة 1994",
  "Yemeni_Laws28.pdf": "قانون رعاية الأحداث: قرار جمهوري رقم 24 لسنة 1992 وتعديلاته",
  "Yemeni_Laws30.pdf": "قانون الجوازات: قانون رقم 7 لسنة 1993 وتعديلاته",
  "Yemeni_Laws31.pdf": "اللائحة التنفيذية لقانون الجوازات: قرار جمهوري رقم 2 لسنة 1994",
  "Yemeni_Laws32.pdf": "قانون الجنسية اليمنية: قانون رقم 6 لسنة 1990",
  "Yemeni_Laws33.pdf": "اللائحة التنفيذية لقانون الجنسية اليمنية: قرار جمهوري رقم 3 لسنة 1994",
  "Yemeni_Laws34.pdf": "قانون دخول وإقامة الأجانب: قرار جمهوري رقم 4 لسنة 1991",
  "Yemeni_Laws35.pdf": "اللائحة التنفيذية لقانون دخول وإقامة الأجانب: قرار جمهوري رقم 4 لسنة 1991",
  "Yemeni_Laws45.pdf": "قانون الأوزان والأبعاد الكلية لمركبات النقل: قرار جمهوري رقم 23 لسنة 1994",
};

function inferTitle(firstPageLines, firstPageText, filename) {
  const override = referenceTitleOverrides[filename];
  if (override) return override;
  const candidateLines = (Array.isArray(firstPageLines) && firstPageLines.length > 0 ? firstPageLines : [firstPageText])
    .map(normalizeTitleText)
    .map(line => line.replace(/\p{Script=Hebrew}/gu, "").replace(/[()]/g, " ").replace(/\s+/g, " ").trim())
    .filter(line => /\p{Script=Arabic}/u.test(line))
    .filter(line => !/(?:نشر\s+في\s+الجريدة|الجريدة\s+الرسمية|العدد\s*\(|مادة\s*\(|الباب\s+|الفصل\s+)/u.test(line))
    .filter(line => !/^[0-9٠-٩/\sم]+$/u.test(line));
  const uniqueLines = [...new Set(candidateLines)];
  const title = uniqueLines
    .map(line => ({
      line,
      score: (/(?:قانون|لائحة|دستور|قرار|اتفاق|معاهدة|نظام|تنظيم|محاكم|هيئة|سجل|رسوم|أحكام)/u.test(line) ? 100 : 0)
        + (line.length >= 4 && line.length <= 130 ? 20 : 0)
        - (line.length > 180 ? 100 : 0),
    }))
    .sort((left, right) => right.score - left.score || right.line.length - left.line.length)[0]?.line;
  if (title && title.length >= 3) return removeLeadingDuplicateWords(title).slice(0, 180);
  const fallbackNumber = filename.match(/(\d+)/)?.[1];
  return fallbackNumber ? `قانون يمني رقم ${fallbackNumber}` : "قانون يمني";
}

function categoryFor(title) {
  if (/أحوال|شخصية|شريعة|زكاة|أوقاف/u.test(title)) return "fiqh";
  if (/مدني|عقاري|إيجار|مؤجر|مستأجر/u.test(title)) return "civil";
  if (/تجاري|شرك|مصرف|ضريب|مالي/u.test(title)) return "commercial";
  if (/قضاء|محكم|مرافعات|إجراءات|شرطة|محاماة|رسوم قضائية/u.test(title)) return "procedure";
  return "general";
}

function documentTypeFor(title) {
  if (/لائحة/u.test(title)) return "regulation";
  if (/قرار\s+جمهوري|مرسوم/u.test(title)) return "decree";
  if (/قرار/u.test(title)) return "decision";
  if (/قانون|دستور/u.test(title)) return "law";
  return "other";
}

function issuingAuthorityFor(title) {
  if (/مجلس الوزراء/u.test(title)) return "مجلس الوزراء";
  if (/وزارة/u.test(title)) return "وزارة مختصة";
  if (/الجمهورية اليمنية|دستور/u.test(title)) return "الجمهورية اليمنية";
  return null;
}

function buildRecords() {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const driveFiles = JSON.parse(readFileSync(driveFileManifestPath, "utf8"));
  const driveFileIds = new Map(driveFiles.map(item => [item.filename, item.driveFileId]));
  if (!Array.isArray(manifest) || manifest.length !== 146) {
    throw new Error("فهرس القوانين غير مكتمل؛ أوقف الاستيراد لحماية القسم.");
  }
  const missingDriveFiles = manifest.map(item => item?.filename).filter(filename => !driveFileIds.has(filename));
  if (driveFileIds.size !== manifest.length || missingDriveFiles.length > 0) {
    throw new Error(`لم تتطابق معرّفات Google Drive مع جميع ملفات القوانين (المعرفات: ${driveFileIds.size}، المفقود: ${missingDriveFiles.join(", ") || "غير محدد"}).`);
  }

  const filenames = new Set();
  return manifest.map((item, index) => {
    if (!item?.filename || filenames.has(item.filename)) {
      throw new Error("اكتُشف اسم ملف مكرر أو غير صالح ضمن فهرس القوانين.");
    }
    filenames.add(item.filename);
    const title = inferTitle(item.firstPageLines, item.firstPageText ?? "", item.filename);
    const driveFileId = driveFileIds.get(item.filename);
    if (!driveFileId) throw new Error(`تعذر إيجاد معرّف Drive للملف ${item.filename}.`);
    const yearMatch = title.match(/[12][0-9]{3}/);
    return {
      sourceFilename: item.filename,
      category: categoryFor(title),
      collection: COLLECTION,
      sortOrder: index + 1,
      driveFileId,
      driveFolderId: ROOT_FOLDER_ID,
      folderSortOrder: index + 1,
      title,
      description: "مستورد من مكتبة أ. معين الناصر: جميع القوانين اليمنية.",
      url: `https://drive.google.com/file/d/${driveFileId}/view`,
      documentType: documentTypeFor(title),
      legislationYear: yearMatch ? Number(yearMatch[0]) : null,
      issuingAuthority: issuingAuthorityFor(title),
    };
  });
}

async function synchronizeIndex() {
  const files = buildRecords();
  const summary = {
    files: files.length,
    firstFile: files[0]?.title ?? null,
    lastFile: files.at(-1)?.title ?? null,
  };
  if (dryRun) {
    const report = process.env.TITLE_REPORT === "1"
      ? files.map(file => ({ driveFileId: file.driveFileId, title: file.title }))
      : files.slice(0, 5);
    console.log(JSON.stringify({ mode: "dry-run", ...summary, report }, null, 2));
    return;
  }
  if (!process.env.DATABASE_URL) throw new Error("قاعدة البيانات غير متاحة للفهرسة.");

  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  try {
    await connection.beginTransaction();
    await connection.execute(
      `INSERT INTO legal_folders (driveFolderId, parentDriveFolderId, collection, name, path, sortOrder)
       VALUES (?, NULL, ?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE parentDriveFolderId = NULL, collection = VALUES(collection), name = VALUES(name), path = VALUES(path), sortOrder = VALUES(sortOrder)`,
      [ROOT_FOLDER_ID, COLLECTION, ROOT_FOLDER_NAME, ROOT_FOLDER_NAME]
    );
    for (const file of files) {
      const legacyDriveFileId = `static:yemeni-laws:${file.sourceFilename}`;
      const [existingRows] = await connection.execute("SELECT id FROM legal_sources WHERE driveFileId IN (?, ?) LIMIT 1", [file.driveFileId, legacyDriveFileId]);
      if (existingRows.length > 0) {
        await connection.execute(
          `UPDATE legal_sources
           SET category = ?, collection = ?, sortOrder = ?, driveFileId = ?, driveFolderId = ?, folderSortOrder = ?, title = ?, description = ?, url = ?, documentType = ?, legislationYear = ?, issuingAuthority = ?
           WHERE id = ?`,
          [file.category, file.collection, file.sortOrder, file.driveFileId, file.driveFolderId, file.folderSortOrder, file.title, file.description, file.url, file.documentType, file.legislationYear, file.issuingAuthority, existingRows[0].id]
        );
      } else {
        await connection.execute(
          `INSERT INTO legal_sources (category, collection, sortOrder, driveFileId, driveFolderId, folderSortOrder, title, description, url, documentType, legislationYear, issuingAuthority)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [file.category, file.collection, file.sortOrder, file.driveFileId, file.driveFolderId, file.folderSortOrder, file.title, file.description, file.url, file.documentType, file.legislationYear, file.issuingAuthority]
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
  console.error(`فشل فهرسة جميع القوانين اليمنية: ${message}`);
  process.exitCode = 1;
});
