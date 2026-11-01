// LA CHIAVE DI CLAUDE PER CASA — `npm run casa:chiave` (01/11/2026)
//
// MEMO su Casa usa la stessa AI del gestionale vero (decisione di Alessio
// del 01/11 sera), con una chiave di Claude creata da lui nello stesso
// account. La chiave la scrive LUI, qui:
//  1. prepara il file (C:\Casa\supabase\functions\.env) se manca;
//  2. apre una finestra (casa-chiave.ps1) dove la si incolla senza vederla;
//  3. controlla che il file abbia SOLO la chiave, con la forma giusta,
//     senza stamparla;
//  4. riaccende Casa: casa:accendi vede che la chiave e' piu' recente della
//     partenza del motore e riparte (`stop` senza --no-backup: i dati
//     restano), perche' il motore la legge solo quando parte.
//
// ⚠️ La chiave non passa mai dalla chat, non entra nel repository, non
//    finisce nelle copie di sicurezza ne' in un registro: di lei si dice
//    solo se c'e'.

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { fermati, titolo } from "./comune.mjs";
import { chiaveDiClaudePresente, pretendiCasa, preparaIlFileDellaChiave } from "./casa-comune.mjs";

titolo("La chiave di Claude per Casa");
pretendiCasa();
const file = preparaIlFileDellaChiave();
const finestra = fileURLToPath(new URL("./casa-chiave.ps1", import.meta.url));
console.log("   si apre una finestra: incolla la chiave e premi Invio");
// `start "" /wait`: una finestra sua, anche quando questo comando gira senza schermo.
spawnSync("cmd.exe", ["/c", "start", "", "/wait", "powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", finestra, "-Destinazione", file], {
  stdio: "ignore",
});

if (!chiaveDiClaudePresente()) {
  fermati(
    "La chiave non c'e' o non ha la forma giusta (comincia con «sk-ant-», una riga sola).",
    "Rilancia  npm run casa:chiave  e incollala di nuovo."
  );
}
console.log("   chiave presente (non la mostro)");

const accesa = spawnSync("npm", ["run", "-s", "casa:accendi"], { stdio: "inherit", shell: process.platform === "win32" });
if (accesa.status !== 0) fermati("La riaccensione di Casa non e' riuscita: lancia  npm run casa:accendi  e guarda cosa dice.");
console.log("\n   Fatto: MEMO su Casa ha la sua chiave.");
