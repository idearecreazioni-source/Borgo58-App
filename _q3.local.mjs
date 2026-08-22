import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
const env = Object.fromEntries(fs.readFileSync(".env.test","utf8").split(/\r?\n/).filter(r=>r.includes("=")&&!r.trim().startsWith("#")).map(r=>[r.slice(0,r.indexOf("=")).trim(), r.slice(r.indexOf("=")+1).trim()]));
if (new URL(env.VITE_SUPABASE_URL).hostname.split(".")[0] === "oudjuqbqszisdtwzbxdo") throw new Error("PRODUZIONE");
const c = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await c.auth.signInWithPassword({ email: env.TEST_TITOLARE_EMAIL, password: env.TEST_TITOLARE_PASSWORD });
const { data: o } = await c.from("orders").select("id,table_label,status").eq("status","aperto");
for (const x of (o ?? [])) {
  const { data: it } = await c.from("order_items").select("id,turno,sent_at,prepared_at,station,quantity,free_text_name,recipe:recipes(name)").eq("order_id", x.id).order("turno");
  console.log(`${x.table_label} → ${it?.length ?? 0} righe`);
  for (const r of (it ?? [])) console.log(`   turno ${r.turno} | ${r.recipe?.name ?? r.free_text_name} | staz=${r.station} | inviata=${r.sent_at ? "SI" : "no"} | stampata=${r.prepared_at ? "SI" : "no"}`);
}
