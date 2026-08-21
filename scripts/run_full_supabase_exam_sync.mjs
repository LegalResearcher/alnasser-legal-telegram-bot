import { syncSupabaseExamLevel } from "../server/supabaseExamSync.ts";

const requestedLevels = process.argv.slice(2);
const levels = requestedLevels.length ? requestedLevels : ["l1", "l2", "l3", "l4"];
if (levels.some(levelKey => !["l1", "l2", "l3", "l4"].includes(levelKey))) throw new Error("المستويات المسموح بها: l1، l2، l3، l4.");

const results = [];
for (const levelKey of levels) {
  console.error(`بدء مزامنة ${levelKey} من Supabase`);
  results.push(await syncSupabaseExamLevel(levelKey));
}

console.log(JSON.stringify({ results }, null, 2));
process.exit(0);
