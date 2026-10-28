// QUANTO PESA IL GESTIONALE — `npm run peso` (01/09/2026)
//
// 🔴 PERCHE' ESISTE, misurato prima di scriverlo. La compilazione del
//    01/09/2026 produce **un solo file** di codice: 1.488,89 kB, che
//    compressi ne fanno 351,24 misurati da questo comando (Vite ne annuncia
//    1.524,62 e 361,74 — conta i kB come mille byte invece che 1024 e
//    comprime piu' forte; sono lo stesso file misurato con due metri, e
//    questo comando dichiara il proprio). Un solo file perche' `src/App.jsx`
//    porta dentro tutte le
//    schermate con 91 `import` scritti in cima: il pacchetto non puo' che
//    essere uno.
//
// ⚠️ CHI LO PAGA NON E' CHI CREDI. Il tablet di sala lo scarica una volta
//    e se lo tiene; **chi apre `/prenota` dal telefono, in mezzo alla
//    strada, scarica tutto il gestionale** — il magazzino, la prima nota,
//    la proiezione fiscale, l'assistente — per compilare quattro caselle.
//    E' l'unica pagina di questo progetto che vede un cliente vero.
//
// ⚠️ QUESTO COMANDO NON SISTEMA NIENTE: misura, e si ferma se il numero
//    peggiora oltre il tetto dichiarato. E' la differenza fra un debito
//    che si conosce e uno che cresce in silenzio — la compilazione un
//    avviso lo dava gia', ma un avviso che non ferma niente e' arredamento.
//
// COME SI ALZA IL TETTO: si alza **dichiarando perche'**, in questo file,
// insieme al numero nuovo e alla data. Un tetto alzato in silenzio non e'
// piu' un tetto.

import { gzipSync } from "node:zlib";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const CARTELLA = path.join(process.cwd(), "dist", "assets");

/**
 * I tetti, in kB compressi, di quello che il browser scarica prima di
 * poter mostrare qualcosa. ⚠️ Dall'11/10/2026 sono DUE, perche' le strade
 * sono due (decisione di Alessio): le pagine pubbliche partono da sole
 * (`src/Pubblico.jsx`) e il gestionale si scarica solo per chi lo apre.
 *
 * STORIA DEL TETTO, che si alza solo dichiarando perche':
 *   · 01/09/2026 — 400 sul file unico, misurato 351,24.
 *   · 11/10/2026 — 410 per poche ore: 396,20 → 400,61 con le spese «Da
 *     collocare» (+4,41 kB, una schermata e due moduli).
 *   · 11/10/2026 — DIVISO IN DUE, ed e' la cura che il commento in cima
 *     chiedeva. ⚠️ Da qui il conto COMPRENDE IL FOGLIO DI STILE (11,61 kB),
 *     che prima restava fuori: e' parte di cio' che si scarica prima di
 *     vedere qualcosa. Misurato da questo comando subito dopo la divisione:
 *     la strada di `/prenota` scarica 145,75 kB; quella del gestionale
 *     414,48 — contro 412,22 di prima (400,61 di codice + 11,61 di stile),
 *     cioe' +2,26 kB di impalcatura della divisione. I tetti lasciano un
 *     margine di ~15 kB: stretti abbastanza da accorgersi di un modulo
 *     nuovo, larghi abbastanza da non gridare per una riga.
 *   · 25/10/2026 — gestionale 430 → 440: misurato da questo comando,
 *     428,87 su slave e 431,02 col quaderno dei difetti (+2,15 kB: il
 *     pulsante «Segnala» presente in ogni schermata, piu' la pagina
 *     /segnalazioni). Il pulsante sta nel Layout, quindi non si puo'
 *     caricare dopo. La strada pubblica non cambia (tetto 160 invariato).
 *   · 28/10/2026 — gestionale 440 → 450: misurato da questo comando,
 *     439,99 su slave dopo i promemoria per luogo (#258), 439,31 con la
 *     pagina «Quando arrivo…» caricata a parte (#260), 440,17 con le
 *     correzioni della notte del 28/10 (+0,86 kB: errori che ora si dicono
 *     invece di tacere, conferme prima di cancellare, l'avviso «non riesco
 *     a verificare il tuo accesso»). Provato a caricare a parte anche le due
 *     pagine da stampa (manuale HACCP, scadenze): 440,01, perche' i pezzi
 *     condivisi restano nel conto — non vale la complicazione. La strada
 *     pubblica non cambia (tetto 160 invariato).
 */
const TETTI_KB_COMPRESSI = {
  // Quello che scarica un cliente per strada. E' il numero che conta di piu'.
  pubblico: 160,
  // Quello che scarica chi apre il gestionale.
  gestionale: 450,
};

const MANIFESTO = path.join(process.cwd(), "dist", ".vite", "manifest.json");

if (!existsSync(CARTELLA) || !existsSync(MANIFESTO)) {
  console.error(
    "Non trovo `dist/assets` o l'elenco dei pezzi (`dist/.vite/manifest.json`): prima va compilato il gestionale (`npm run build`)."
  );
  process.exit(1);
}

const misura = (file) => {
  const contenuto = readFileSync(path.join(process.cwd(), "dist", file));
  return {
    file: path.basename(file),
    kb: statSync(path.join(process.cwd(), "dist", file)).size / 1024,
    kbCompressi: gzipSync(contenuto).length / 1024,
  };
};

const kb = (n) => n.toFixed(2).replace(".", ",");

const pezzi = readdirSync(CARTELLA)
  .filter((f) => f.endsWith(".js") || f.endsWith(".css"))
  .map((f) => misura(path.join("assets", f)))
  .sort((a, b) => b.kbCompressi - a.kbCompressi);

console.log("I pezzi del gestionale:\n");
for (const p of pezzi) {
  console.log(`  ${p.file.padEnd(40)} ${kb(p.kb).padStart(10)} kB   compresso ${kb(p.kbCompressi).padStart(8)} kB`);
}

// ---------------------------------------------------------------------
// Le due strade, lette dall'elenco che scrive la compilazione
// ---------------------------------------------------------------------
const manifesto = JSON.parse(readFileSync(MANIFESTO, "utf8"));
const ingresso = Object.entries(manifesto).find(([, v]) => v.isEntry);
if (!ingresso) {
  console.error("\nL'elenco dei pezzi non ha un ingresso: la compilazione e' strana, mi fermo.");
  process.exit(1);
}

// Tutto quello che un pezzo si porta dietro prima di partire: i suoi file,
// i suoi fogli di stile e, a cascata, i pezzi che importa.
function chiusura(chiavi) {
  const visti = new Set();
  const file = new Set();
  const visita = (k) => {
    if (visti.has(k) || !manifesto[k]) return;
    visti.add(k);
    file.add(manifesto[k].file);
    for (const c of manifesto[k].css ?? []) file.add(c);
    for (const i of manifesto[k].imports ?? []) visita(i);
  };
  chiavi.forEach(visita);
  return [...file];
}

const strade = {
  pubblico: chiusura([ingresso[0], "src/Pubblico.jsx"]),
  gestionale: chiusura([ingresso[0], "src/App.jsx"]),
};

let sforato = false;
for (const [nome, file] of Object.entries(strade)) {
  // ⚠️ Una strada che non trova il suo pezzo e' un guasto, non uno zero:
  //    uno zero passerebbe qualunque tetto.
  const radice = nome === "pubblico" ? "src/Pubblico.jsx" : "src/App.jsx";
  if (!manifesto[radice]) {
    console.error(`\n::error::Nell'elenco dei pezzi non c'e' ${radice}: non so cosa scarica la strada «${nome}».`);
    process.exit(1);
  }
  const totale = file.map(misura).reduce((s, p) => s + p.kbCompressi, 0);
  const tetto = TETTI_KB_COMPRESSI[nome];
  console.log(
    `\nChi apre ${nome === "pubblico" ? "/prenota" : "il gestionale"} scarica ${file.length} file: ${kb(totale)} kB compressi (tetto ${tetto}).`
  );
  if (totale > tetto) {
    sforato = true;
    console.error(
      `::error::La strada «${nome}» ha superato il tetto dichiarato: ${kb(totale)} kB compressi contro ${tetto}.`
    );
  }
}

if (sforato) {
  console.error("O si toglie peso, o si alza il tetto DICHIARANDO perche' in scripts/peso-pacchetto.mjs.");
  process.exit(1);
}
