import { syncSupabaseContractTemplates } from "../server/supabaseContractSync.ts";

const result = await syncSupabaseContractTemplates();
console.log(JSON.stringify(result));
process.exit(0);
