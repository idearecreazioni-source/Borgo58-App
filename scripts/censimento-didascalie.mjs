// Il censimento delle spiegazioni a schermo.
//
// ⚠️ SETACCIO, NON VERDETTO (lezione del 22/08): dice DOVE guardare, non
// cosa è vero. Un testo che finisce in questo elenco va aperto e letto
// prima di decidere che fine deve fare.
//
// ⚠️ E GUARDA ANCHE `components/`, non solo `pages/`: il difetto del
// 22/08 è che un censimento «per posti» tace su tutto ciò che vive FRA i
// posti — e le spiegazioni condivise sono esattamente lì.
import fs from "node:fs";
import path from "node:path";

const radici = ["src/pages", "src/components"];
const file = [];
const cammina = (d) => {
  for (const v of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, v.name);
    if (v.isDirectory()) cammina(p);
    else if (v.name.endsWith(".jsx")) file.push(p.split(path.sep).join("/"));
  }
};
radici.forEach(cammina);

// Una spiegazione è un testo statico dentro un elemento di sola lettura
// che contiene una FRASE — almeno tre parole. I titoli e le etichette non
// ci finiscono.
// ⚠️ Niente `{` NEMMENO IN MEZZO: con la sola esclusione iniziale il
// setaccio pescava 416 testi, e la gran parte erano dati interpolati —
// «{cost ? formatEUR(...) : "—"}». Un elenco per tre quarti di rumore non
// si cammina: si scorre, e ci si perde dentro la voce vera.
const RIGA = /<(p|span|div)\b([^>]*)>\s*\n?\s*([^<>{}]{25,})\s*\n?\s*<\/\1>/g;

let totale = 0;
const per = [];
for (const f of file) {
  const testo = fs.readFileSync(f, "utf8");
  const gia = testo.includes("Didascalia");
  const trovati = [];
  for (const m of testo.matchAll(RIGA)) {
    const attributi = m[2] || "";
    const frase = m[3].replace(/\s+/g, " ").trim();
    if (!/[a-zà-ù]{3}\s+\S+\s+\S+/.test(frase)) continue;
    if (/^[A-ZÀ-Ù\s·—-]+$/.test(frase)) continue;
    // ⚠️ Fuori gli STATI VUOTI: «Nessuna fattura da pagare» non spiega
    // niente — RISPONDE. Toglierlo lascerebbe una schermata muta, ed è la
    // regola del 19/08 letta al contrario: lì il gestionale non sapeva e
    // fingeva di sapere, qui sa e lo dice.
    if (/^(Nessun|Non ci sono|Niente|Ancora nessun)/i.test(frase)) continue;
    const riga = testo.slice(0, m.index).split("\n").length;
    // ⚠️ DOVE sta il testo cambia che fine deve fare, e il mandato non lo
    // distingue: una nota sotto un campo È dentro il gesto — che è
    // esattamente dove Alessio il 18/08 ha detto che una spiegazione deve
    // stare. Metterle tutte dietro un segno vorrebbe dire 182 punti
    // interrogativi sparsi, cioè peggiorare invece di alleggerire.
    const prima = testo.slice(Math.max(0, m.index - 700), m.index);
    const ultimoTag = [...prima.matchAll(/<(label|h1|h2|h3|section|form)\b/g)].pop();
    const dopo = testo.slice(m.index, m.index + 500);
    const dove = /<label\b/.test(ultimoTag?.[0] || "")
      ? "campo"
      : /<(input|select|textarea)\b/.test(dopo) && !/<h[123]\b/.test(dopo)
        ? "campo"
        : "sezione";
    trovati.push({
      riga,
      dove,
      frase: frase.slice(0, 92),
      avviso: /text-(red|amber|orange)|bg-(red|amber|orange)/.test(attributi),
    });
  }
  if (trovati.length) {
    per.push({ f, gia, trovati });
    totale += trovati.length;
  }
}

per.sort((a, b) => b.trovati.length - a.trovati.length);
for (const { f, gia, trovati } of per) {
  console.log(`\n${f}${gia ? "   [ha gia' didascalie]" : ""}  — ${trovati.length}`);
  for (const t of trovati) {
    console.log(
      `  ${String(t.riga).padStart(4)} ${t.dove === "campo" ? "·campo " : "SEZIONE"}${t.avviso ? "!" : " "} ${t.frase}`
    );
  }
}
const sezioni = per.flatMap((p) => p.trovati).filter((t) => t.dove === "sezione");
const avvisi = per.flatMap((p) => p.trovati).filter((t) => t.avviso);
console.log(`\n=== ${totale} testi in ${per.length} file su ${file.length} ===`);
console.log(`    di cui ${sezioni.length} sotto un titolo, ${totale - sezioni.length} sotto un campo`);
console.log(`    e ${avvisi.length} disegnati come avvertimento (rosso/ambra)`);
