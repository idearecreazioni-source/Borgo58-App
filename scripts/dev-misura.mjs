// Server usa-e-getta per MISURARE le schermate, puntato al progetto di PROVA.
// ⚠️ Non tocca il tunnel del telefono: `npm run dev:prova` lo fa, e il 28/08
//    un server aperto solo per misurare si e' portato via l'indirizzo di
//    Alessio lasciandogli una pagina bianca per un giorno.
// ⚠️ Porta 5188: la 5173 e' quella di Alessio e la 5199 e' quella che gia'
//    una volta ha creato il guaio.
import { leggiConfigurazione, obbligatorio, esegui, fermati, REF_PRODUZIONE } from "./comune.mjs";

const cfg = leggiConfigurazione(".env.test");
const url = obbligatorio(cfg, "VITE_SUPABASE_URL", "E l indirizzo del progetto Borgo58-Prova.");
const chiave = obbligatorio(cfg, "VITE_SUPABASE_ANON_KEY", "E la chiave anon del progetto di prova.");
if (url.includes(REF_PRODUZIONE)) fermati("FERMO: punta al gestionale VERO.");

console.log(`Misura: http://localhost:5188 — progetto di PROVA`);
const r = esegui("npx", ["vite", "--port", "5188", "--strictPort"], {
  shell: true,
  env: { VITE_SUPABASE_URL: url, VITE_SUPABASE_ANON_KEY: chiave },
});
process.exit(r.ok ? 0 : 1);
