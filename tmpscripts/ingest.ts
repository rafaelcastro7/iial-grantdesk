import { SOURCES } from "../src/server/sources";
import { runSource } from "../src/server/ingest";

const only = process.argv[2];
for (const source of SOURCES) {
  if (only && source.key !== only) continue;
  try {
    const r = await runSource(source, { limit: 200 });
    console.log("OK", source.key, JSON.stringify(r));
  } catch (e) {
    console.log("FAIL", source.key, String(e).slice(0, 300));
  }
}
