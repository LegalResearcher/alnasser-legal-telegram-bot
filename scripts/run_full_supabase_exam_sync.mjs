import { syncSupabaseExamLevel } from "../server/supabaseExamSync.ts";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const requestedLevels = args.filter(argument => argument !== "--dry-run");
const supportedLevels = ["l1", "l2", "l3", "l4", "secondary-literary", "secondary-scientific"];
const levels = requestedLevels.length ? requestedLevels : supportedLevels;
if (levels.some(levelKey => !supportedLevels.includes(levelKey))) {
  throw new Error(`المستويات المسموح بها: ${supportedLevels.join("، ")}.`);
}

const results = [];
const subjectResults = [];
for (const levelKey of levels) {
  console.error(`${dryRun ? "فحص" : "بدء استيراد"} ${levelKey} ${dryRun ? "من Supabase دون كتابة" : "من Supabase"}`);
  results.push(await syncSupabaseExamLevel(levelKey, {
    dryRun,
    onSubjectComplete: result => subjectResults.push(result),
  }));
}

console.log(JSON.stringify({ mode: dryRun ? "dry-run" : "import", results, subjectResults }, null, 2));
process.exit(0);
