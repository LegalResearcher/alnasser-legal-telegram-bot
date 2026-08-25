import type { LegalFolder, LegalSource } from "../drizzle/schema";
import { ILLUSTRATED_LEGAL_FORMS_ROOT_FOLDER_ID } from "./db";

const ILLUSTRATED_SOURCE_DEFINITIONS = [
  ["1PV9925vCUqQMn3h4mCpwLIKwoUHD6FZr", "إشعارات واعلانات.pdf"],
  ["1f1kZPOMKX6YHYRgKOlzOebGZOq3W4E5F", "إقرارات.pdf"],
  ["1RCXV8qFSDHqIg80w1h1mu5op7gm83tUN", "استئناف.pdf"],
  ["1nkRs51TiYQ6rPEd1MbXX63N_cN6UbLSH", "استشكالات.pdf"],
  ["1gk4JCrg2umakgx_81HsB0AbWYZFTuUoS", "التزامات.pdf"],
  ["1oE5czmSuMJuRChwgXutU4T096b7DK_Rs", "العليا.pdf"],
  ["1kJHO_axBjV07Ld1rgvleicrTmJLgXAKE", "تظلم من أوامر وقرارات تنفيذية.pdf"],
  ["1g0jkml8HNT-rqkcJG-6kU7FjEREFmde0", "تظلمات.pdf"],
  ["1GHwmBjXhnMmDmRP6_S6FxDPvnRAqPmr5", "تكليف بالوفاء.pdf"],
  ["1u5Q0GwGPgl-FjX576OEjWpqDHv9v8dqr", "توكيلات وتفويضات وتنازل.pdf"],
  ["1oyvzm5Zce6_zC7-YO-7L4lkPppaj_dm9", "دعاوى.pdf"],
  ["162qu-dE3mzEHL5mIyZkDLaSoiXeeUCMs", "دفوع.pdf"],
  ["1I5t3o4-r4krhNOSngPUu10NzybyQiu-z", "شكاوى.pdf"],
  ["118_3JdTr2sv-LVV5D9Bo0AMeCHW6g1ta", "ضمانات.pdf"],
  ["1g2ewZ5EHCtrxQSrRMKoSDgx_H92kCVpQ", "طلبات.pdf"],
  ["18C3ly9HqzyxYkWKeONw0cBxBkolwHk6T", "عقود.pdf"],
  ["1iHZmP3p7Htj-tKvUA4jFwWXlkjWTOeN-", "كيفية.pdf"],
] as const;

export const illustratedLegalFormsRootFolder: LegalFolder = {
  id: 0,
  driveFolderId: ILLUSTRATED_LEGAL_FORMS_ROOT_FOLDER_ID,
  parentDriveFolderId: null,
  collection: "illustrated_legal_forms",
  name: "نماذج مصورة وفق القوانين اليمنية",
  path: "نماذج مصورة وفق القوانين اليمنية",
  sortOrder: 70,
  createdAt: new Date(0),
  updatedAt: new Date(0),
};

export const illustratedLegalFormSources: readonly LegalSource[] = ILLUSTRATED_SOURCE_DEFINITIONS.map(([driveFileId, title], index) => ({
  id: 900001 + index,
  category: "procedure",
  collection: "illustrated_legal_forms",
  sortOrder: index + 1,
  driveFileId,
  driveFolderId: ILLUSTRATED_LEGAL_FORMS_ROOT_FOLDER_ID,
  folderSortOrder: index + 1,
  title,
  description: `مستورد من مكتبة أ. معين الناصر: نماذج مصورة وفق القوانين اليمنية / ${title}`,
  url: `https://drive.google.com/uc?export=download&id=${encodeURIComponent(driveFileId)}`,
  documentType: "other",
  legislationYear: null,
  issuingAuthority: null,
  isFeatured: false,
  createdAt: new Date(0),
  updatedAt: new Date(0),
}));

export function getIllustratedLegalFormsFolderContents(folderId: string, page: number) {
  if (folderId !== ILLUSTRATED_LEGAL_FORMS_ROOT_FOLDER_ID) return { folder: undefined, folders: [], sources: [], totalSources: 0 };
  const safePage = Math.max(1, Math.trunc(page) || 1);
  const start = (safePage - 1) * 7;
  return {
    folder: illustratedLegalFormsRootFolder,
    folders: [],
    sources: illustratedLegalFormSources.slice(start, start + 7),
    totalSources: illustratedLegalFormSources.length,
  };
}

export function getIllustratedLegalFormSource(sourceId: number): LegalSource | undefined {
  return illustratedLegalFormSources.find(source => source.id === sourceId);
}
