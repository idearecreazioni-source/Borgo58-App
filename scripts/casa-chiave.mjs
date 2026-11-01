// LA CHIAVE DI CLAUDE PER CASA — `npm run casa:chiave` (01/11/2026)
//
// MEMO su Casa usa la stessa AI del gestionale vero (decisione di Alessio
// del 01/11 sera), con una chiave di Claude creata da lui nello stesso
// account. La chiave la scrive LUI, qui:
//  1. prepara il file (C:\Casa\supabase\functions\.env) se manca;
//  2. lo apre nel Blocco note: si incolla la chiave dopo l'uguale, si salva
//     e si chiude;
//  3. controlla che la chiave abbia la forma giusta, senza stamparla;
//  4. riavvia Casa (`stop` senza --no-backup: i dati restano), perche' il
//     motore delle funzioni legge il file solo quando parte, e la verifica.
//
// ⚠️ La chiave non passa mai dalla chat, non entra nel repository e non
//    finisce in nessun registro: di lei si dice solo se c'e'.

import { spawnSync } from "node:child_process";
import { fermati, titolo } from "./comune.mjs";
import { CARTELLA, VERSIONE_CLI, chiaveDiClaudePresente, pretendiCasa, preparaIlFileDellaChiave } from "./casa-comune.mjs";

titolo("La chiave di Claude per Casa");
pretendiCasa();
const file = preparaIlFileDellaChiave();
console.log(`   apro ${file} nel Blocco note:`);
console.log("   incolla la chiave dopo «ANTHROPIC_API_KEY=», salva e chiudi il Blocco note.");
spawnSync("notepad.exe", [file], { stdio: "ignore" });

if (!chiaveDiClaudePresente()) {
  fermati(
    "La chiave non c'e' o non ha la forma giusta (comincia con «sk-ant-»).",
    "Rilancia  npm run casa:chiave  e incollala dopo l'uguale, su una riga sola."
  );
}
console.log("   chiave presente (non la mostro)");

titolo("Riavvio Casa perche' le funzioni la leggano (un minuto circa, i dati restano)");
const fermata = spawnSync("npx", ["--yes", "--prefer-offline", `supabase@${VERSIONE_CLI}`, "stop"], {
  cwd: CARTELLA,
  encoding: "utf8",
  shell: process.platform === "win32",
});
if (fermata.status !== 0) fermati("Casa non si e' fermata:", (fermata.stderr || "").trim().split("\n").slice(-3).join("\n  "));
const accesa = spawnSync("npm", ["run", "-s", "casa:accendi"], { stdio: "inherit", shell: process.platform === "win32" });
if (accesa.status !== 0) fermati("La riaccensione di Casa non e' riuscita: lancia  npm run casa:accendi  e guarda cosa dice.");
console.log("\n   Fatto: MEMO su Casa ha la sua chiave.");
