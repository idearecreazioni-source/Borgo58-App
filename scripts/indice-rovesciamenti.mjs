// L'INDICE DEI ROVESCIAMENTI SI GENERA, NON SI TIENE A MANO — 27/08/2026.
//
// 🔴 IL DIFETTO CHE CHIUDE, misurato: le sezioni raccontate erano **57** e
//    l'indice ne elencava **19**. Trentotto rovesciamenti avevano il loro
//    racconto per esteso e non comparivano nella tabella — e quella tabella
//    esiste per rispondere a una domanda sola: *«questa decisione l'abbiamo
//    già rovesciata prima?»*. Un indice monco a quella domanda dà una
//    risposta tranquilla e sbagliata.
//
// ⚠️ E il file lo diceva già di sé: c'era una nota che denunciava il buco,
//    coi numeri scritti a mano — «48 sezioni, 18 nell'indice». Erano veri
//    quando sono stati scritti, e sono invecchiati insieme al problema.
//    *Un numero in un commento è una frase destinata a diventare falsa*: la
//    cura non è aggiornarlo, è farlo dire al gestionale.
//
// ⚠️ I NUMERI DOPPI E I BUCHI NON SI RINUMERANO — decisione di Alessio del
//    27/08. Il 18, il 48 e il 49 sono usati due volte; il 51 e il 52 non
//    esistono. Rinumerare romperebbe ogni citazione fatta finora nei
//    riepiloghi, che sono committati e non si riscrivono. Si distinguono
//    con la DATA, che è l'informazione che già li separa.

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export const FILE = path.join("docs", "decisioni_rovesciate.md");
const INIZIO = "<!-- indice generato: non scrivere a mano -->";
const FINE = "<!-- fine indice generato -->";

/**
 * Le sezioni raccontate, lette dal file.
 *
 * ⚠️ Le intestazioni hanno DUE forme, ed è il motivo per cui la data si
 * cerca dovunque nella riga invece che in una posizione fissa:
 *   `## 50 · 25/08/2026 — «la taglia di un documento…»`
 *   `## 48 · Gli allergeni tornano ad avere un secondo posto — 25/08/2026`
 * Pretenderne una sola perderebbe in silenzio le altre — che è esattamente
 * il difetto che questo file chiude.
 */
export function rovesciamenti(testo) {
  const righe = testo.split(/\r?\n/);
  const trovati = [];
  for (let k = 0; k < righe.length; k++) {
    const riga = righe[k];
    const m = /^##\s+(\d+)\s*·\s*(.+)$/.exec(riga.trim());
    if (!m) continue;
    const numero = Number(m[1]);
    const resto = m[2];
    // ⚠️ Se il titolo non porta la data, si CERCA NEL CORPO della sezione
    //    invece di lasciare un trattino: tre sezioni sono scritte così, e la
    //    data è l'unica cosa che distingue i numeri usati due volte. Si legge
    //    dal file, non si inventa — e se nel corpo non c'è resta vuota.
    let data = /(\d{2}\/\d{2}\/\d{4})/.exec(resto)?.[1] ?? null;
    for (let h = k + 1; !data && h < righe.length; h++) {
      if (/^##\s+\d+\s*·/.test(righe[h].trim())) break;
      data = /(\d{2}\/\d{2}\/\d{4})/.exec(righe[h])?.[1] ?? null;
    }
    // Il titolo è quello che resta togliendo la data e i trattini di giunzione.
    const titolo = resto
      .replace(/(\d{2}\/\d{2}\/\d{4})/, "")
      .replace(/^[\s—–-]+|[\s—–-]+$/g, "")
      .replace(/^«|»$/g, "")
      .trim();
    trovati.push({ numero, data, titolo });
  }
  return trovati;
}

/** L'ancora di una sezione dentro lo stesso file, come la fa GitHub. */
export function ancora(riga) {
  return (
    "#" +
    riga
      .toLowerCase()
      .replace(/[«»'"·—–,.:()]/g, "")
      .replace(/\//g, "")
      .trim()
      .replace(/\s+/g, "-")
  );
}

export function tabella(voci) {
  const righe = [
    "| # | data | decisione rovesciata |",
    "|---|---|---|",
    ...voci.map((v) => `| ${v.numero} | ${v.data ?? "—"} | ${v.titolo} |`),
  ];
  const doppi = [...new Set(voci.map((v) => v.numero))].filter(
    (n) => voci.filter((v) => v.numero === n).length > 1
  );
  const nota = [
    "",
    `⚠️ **Righe: ${voci.length}.** Generato da \`npm run indice\` leggendo le sezioni`,
    "di questo file: non si scrive a mano, e non può più restare indietro.",
  ];
  if (doppi.length > 0) {
    nota.push(
      "",
      `⚠️ **Numeri usati più di una volta: ${doppi.join(", ")}.** NON si rinumerano`,
      "(decisione di Alessio, 27/08/2026): ogni riepilogo già scritto cita quei",
      "numeri, e rinumerare romperebbe le citazioni. **Si distinguono con la data.**",
      "Lo stesso vale per i numeri che mancano: sono buchi, non errori da chiudere."
    );
  }
  return [...righe, ...nota].join("\n");
}

export function generaIndice(testo) {
  const i = testo.indexOf(INIZIO);
  const j = testo.indexOf(FINE);
  if (i === -1 || j === -1) {
    // ⚠️ SI FERMA, non prosegue: un comando che non trova il suo punto di
    //    riferimento e va avanti lo stesso è come è sparita mezza coda il
    //    19/08 (vedi la nota in cima a CODA_E_DECISIONI.md).
    throw new Error(
      `In ${FILE} mancano i segni «${INIZIO}» e «${FINE}»: non so dove mettere l'indice, e non tiro a indovinare.`
    );
  }
  const voci = rovesciamenti(testo);
  return testo.slice(0, i + INIZIO.length) + "\n" + tabella(voci) + "\n" + testo.slice(j);
}

if (process.argv[1]?.endsWith("indice-rovesciamenti.mjs")) {
  const testo = readFileSync(FILE, "utf8");
  const nuovo = generaIndice(testo);
  const voci = rovesciamenti(testo);
  if (process.argv.includes("--verifica")) {
    if (nuovo !== testo) {
      console.error("");
      console.error(`  L'indice di ${FILE} è indietro rispetto alle sezioni.`);
      console.error("  Rigeneralo:  npm run indice");
      console.error("");
      process.exit(1);
    }
    console.log(`  L'indice è allineato: ${voci.length} rovesciamenti.`);
  } else {
    writeFileSync(FILE, nuovo, "utf8");
    console.log(`  Indice rigenerato: ${voci.length} rovesciamenti.`);
  }
}
