// I QUESITI DA PORTARE A UN CONSULENTE — `npm run quesiti`
//
// Genera, dal raccoglitore unico, un foglio per persona con lo spazio per
// scrivere le risposte a mano.
//
// ⚠️ SI GENERA, NON SI SCRIVE A MANO. Un secondo file con dentro le stesse
//    domande diverge dal primo alla prima aggiunta, e a restare indietro
//    sarebbe proprio quello che finisce in mano al consulente. Qui la
//    fonte e' una sola: `docs/quesiti/QUESITI_CONSULENTI.md`.
//
// ⚠️ E LE MISURE DELLA STAMPA SONO IN PUNTI, NON IN CENTIMETRI VERI
//    (regola del 25/08): sul foglio 96 punti fanno un pollice, quindi un
//    valore in punti e' un millimetro vero e uguale per tutti. Un foglio
//    che esce di taglie diverse a seconda del dispositivo da cui si preme
//    stampa e' un difetto che questo progetto ha gia' pagato.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { titolo } from "./comune.mjs";

const SORGENTE = path.join("docs", "quesiti", "QUESITI_CONSULENTI.md");
const CARTELLA = path.join("docs", "quesiti", "da_portare");

const testo = readFileSync(SORGENTE, "utf8");
const righe = testo.split(/\r?\n/);

// Le persone sono le intestazioni di primo livello del raccoglitore: si
// leggono da li' invece di essere elencate qui, cosi' una persona nuova
// compare da sola.
const persone = [];
let corrente = null;
let quesito = null;

for (const riga of righe) {
  const capo = riga.match(/^# (.+)$/);
  if (capo && !/raccoglitore unico/i.test(capo[1])) {
    corrente = { nome: capo[1].trim(), quesiti: [] };
    persone.push(corrente);
    quesito = null;
    continue;
  }
  if (!corrente) continue;

  const testa = riga.match(/^## (.+)$/);
  if (testa) {
    quesito = { titolo: testa[1].trim(), corpo: [] };
    corrente.quesiti.push(quesito);
    continue;
  }
  if (quesito) quesito.corpo.push(riga);
}

// ⚠️ Il markdown si converte con quel poco che serve — grassetto, corsivo,
//    elenchi — e NIENTE di piu': una libreria per sei documenti costerebbe
//    piu' di scriverli, ed e' la stessa scelta gia' fatta per i PDF finti.
function inHtml(righeCorpo) {
  const fuori = [];
  let inElenco = false;
  for (const r of righeCorpo) {
    const t = r.trim();
    if (t === "---") continue;
    if (t === "") {
      if (inElenco) {
        fuori.push("</ul>");
        inElenco = false;
      }
      continue;
    }
    const scappa = (s) =>
      s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/`(.+?)`/g, "<code>$1</code>");

    const punto = t.match(/^[-*]\s+(.*)$/);
    if (punto) {
      if (!inElenco) {
        fuori.push("<ul>");
        inElenco = true;
      }
      fuori.push(`<li>${scappa(punto[1])}</li>`);
      continue;
    }
    if (inElenco) {
      fuori.push("</ul>");
      inElenco = false;
    }
    fuori.push(`<p>${scappa(t)}</p>`);
  }
  if (inElenco) fuori.push("</ul>");
  return fuori.join("\n");
}

const STILE = `
<style>
  /* ⚠️ Tutte le misure in PUNTI: sul foglio 96 punti fanno un pollice,
     quindi la taglia non dipende da dove si e' premuto stampa. */
  body { font-family: Georgia, 'Times New Roman', serif; color: #1a1a1a;
         max-width: 700px; margin: 0 auto; padding: 24px; font-size: 12.5px; line-height: 1.5; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  h2 { font-size: 15px; margin: 26px 0 6px; page-break-after: avoid; }
  .intro { font-size: 12px; color: #444; border-bottom: 1px solid #bbb; padding-bottom: 12px; }
  .quesito { page-break-inside: avoid; margin-bottom: 6px; }
  p { margin: 5px 0; }
  ul { margin: 5px 0 5px 18px; padding: 0; }
  code { font-family: Consolas, monospace; font-size: 11.5px; background: #f2f2f2; padding: 0 3px; }
  /* Lo spazio per scrivere la risposta a mano: righe vere, non un vuoto. */
  .risposta { margin: 8px 0 20px; }
  .risposta .etichetta { font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: #666; }
  .riga { border-bottom: 1px solid #999; height: 22px; }
  @media print {
    body { padding: 0; max-width: none; }
    .nonstampare { display: none; }
  }
</style>`;

mkdirSync(CARTELLA, { recursive: true });
titolo("I fogli da portare ai consulenti");

const fatti = [];
for (const p of persone) {
  if (p.quesiti.length === 0) continue;
  const nomeFile =
    p.nome
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") + ".html";

  const corpo = p.quesiti
    .map(
      (q) => `
<div class="quesito">
  <h2>${q.titolo.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</h2>
  ${inHtml(q.corpo)}
</div>
<div class="risposta">
  <div class="etichetta">Risposta</div>
  <div class="riga"></div><div class="riga"></div><div class="riga"></div><div class="riga"></div>
</div>`
    )
    .join("\n");

  const html = `<!doctype html>
<html lang="it"><head><meta charset="utf-8">
<title>Quesiti — ${p.nome}</title>${STILE}</head>
<body>
<h1>${p.nome}</h1>
<p class="intro">Domande di Borgo 58 — Osteria Contemporanea, Piazza Armerina (EN).
Sotto ogni domanda c'e' lo spazio per scrivere la risposta.
Il documento completo, con tutte le domande per tutti i consulenti, resta nel gestionale.</p>
${corpo}
<p class="nonstampare" style="margin-top:28px;color:#666;font-size:11px">
Per stamparlo: Ctrl+P, poi «Salva come PDF» oppure la stampante.</p>
</body></html>`;

  writeFileSync(path.join(CARTELLA, nomeFile), html, "utf8");
  fatti.push(`  · ${p.nome} — ${p.quesiti.length} domande → ${path.join(CARTELLA, nomeFile)}`);
}

console.log(fatti.join("\n"));
console.log(`\n  Si aprono con un doppio click e si stampano dal browser.`);
