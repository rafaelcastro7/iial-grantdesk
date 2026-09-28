import { createClient } from "@supabase/supabase-js";
import { embedCatalog } from "../src/server/embed";
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
console.log(JSON.stringify(await embedCatalog(supabase as any, { limit: 500 })));
