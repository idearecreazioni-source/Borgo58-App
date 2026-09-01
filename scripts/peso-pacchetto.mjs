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
 * Il tetto, in kB compressi, del file piu' grande che il browser scarica
 * prima di poter mostrare qualcosa.
 *
 * MISURATO IL 01/09/2026 DA QUESTO COMANDO: 351,24 kB. Il tetto e' a 400 —
 * abbastanza largo
 * da non gridare per una libreria in piu', abbastanza stretto da accorgersi
 * di un modulo nuovo che entra nel pacchetto unico.
 */
const TETTO_KB_COMPRESSI = 400;

if (!existsSync(CARTELLA)) {
  console.error("Non trovo `dist/assets`: prima va compilato il gestionale (`npm run build`).");
  process.exit(1);
}

const pezzi = readdirSync(CARTELLA)
  .filter((f) => f.endsWith(".js") || f.endsWith(".css"))
  .map((f) => {
    const contenuto = readFileSync(path.join(CARTELLA, f));
    return {
      file: f,
      kb: statSync(path.join(CARTELLA, f)).size / 1024,
      kbCompressi: gzipSync(contenuto).length / 1024,
    };
  })
  .sort((a, b) => b.kbCompressi - a.kbCompressi);

const kb = (n) => n.toFixed(2).replace(".", ",");

console.log("Quanto scarica un browser che apre il gestionale:\n");
for (const p of pezzi) {
  console.log(`  ${p.file.padEnd(34)} ${kb(p.kb).padStart(10)} kB   compresso ${kb(p.kbCompressi).padStart(8)} kB`);
}
const totale = pezzi.reduce((s, p) => s + p.kbCompressi, 0);
console.log(`\n  ${"in tutto".padEnd(34)} ${" ".repeat(10)}       compresso ${kb(totale).padStart(8)} kB`);
console.log(`  pezzi: ${pezzi.length}`);

const grosso = pezzi.filter((p) => p.file.endsWith(".js"))[0];
if (!grosso) {
  console.error("\nNessun file di codice in `dist/assets`: la compilazione non ha prodotto niente.");
  process.exit(1);
}

console.log(
  `\nIl pezzo di codice piu' grande e' ${grosso.file}: ${kb(grosso.kbCompressi)} kB compressi (tetto ${TETTO_KB_COMPRESSI}).`
);

if (grosso.kbCompressi > TETTO_KB_COMPRESSI) {
  console.error(
    `\n::error::Il pacchetto ha superato il tetto dichiarato: ${kb(grosso.kbCompressi)} kB compressi contro ${TETTO_KB_COMPRESSI}.`
  );
  console.error("Chi apre /prenota dal telefono scarica questo file per intero.");
  console.error("O si toglie peso, o si alza il tetto DICHIARANDO perche' in scripts/peso-pacchetto.mjs.");
  process.exit(1);
}
