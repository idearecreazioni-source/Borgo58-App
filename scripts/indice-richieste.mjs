// IL CONTEGGIO DELLE RICHIESTE SI GENERA, NON SI TIENE A MANO — 30/08/2026.
//
// 🔴 IL DIFETTO CHE CHIUDE, misurato da Alessio la mattina del 30/08: le
//    righe-richiesta erano **51** e i tre gruppi del conteggio in cima ne
//    contavano **50**. La riga che sfuggiva era **T1**, perché portava
//    «fatta a metà» — uno stato che non è fra i quattro previsti.
//    ⚠️ **Una richiesta in uno stato inventato è invisibile al conteggio**, e
//    l'invisibilità è esattamente il difetto per cui questo file è nato: una
//    richiesta che nessuno vede è una richiesta persa.
//
// ⚠️ E il difetto era più largo della riga trovata. Contando gli stati veri
//    il 30/08 ne sono usciti **otto** dove ne erano dichiarati quattro:
//    «fatta a metà», «fatta per la parte che serve», «in attesa (aspetta
//    lui)», «in attesa (aspetta Gianna)», «in attesa (rimandata da lui)», più
//    una riga che nella colonna dello stato aveva una **data**. Nessuno di
//    quegli stati è sbagliato — dicono il vero — ma stavano **dentro** la
//    casella dello stato invece che accanto.
//
// 🔴 LA CURA NON È RINOMINARLI: è che il conteggio lo faccia il gestionale.
//    È la stessa forma di `indice-rovesciamenti.mjs`, e la ragione è la
//    stessa: *un numero scritto a mano è una frase destinata a diventare
//    falsa*. Qui, in più, c'è una prova che diventa rossa da sola
//    (`tests/unita/indice-richieste.test.js`), così chi aggiunge una riga e
//    dimentica `npm run richieste` se ne accorge prima del commit.
//
// ⚠️ **OGNI RIGA FINISCE IN UN GRUPPO, PER COSTRUZIONE.** Lo stato è la
//    parte prima del primo «·» e dev'essere uno dei quattro: se non lo è, il
//    conteggio **non prova a indovinare** — si ferma e nomina la riga. Un
//    conteggio che assorbe uno stato sconosciuto in «altro» rifarebbe il
//    difetto con un nome diverso.

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export const FILE = path.join("docs", "RICHIESTE.md");

// I quattro stati, e sono chiusi. Chi ne vuole un quinto lo aggiunge qui:
// è un posto solo, ed è lo stesso posto che il file dichiara ai lettori.
export const STATI = ["in attesa", "in corso", "fatta", "scartata da Alessio"];

// La seconda faccia, chiesta da Alessio il 30/08: una richiesta aperta può
// essere pescabile adesso oppure aspettare qualcun altro.
// ⚠️ Serve perché delle 19 aperte del 30/08 **almeno sette** aspettavano
//    Gianna, la banca o un abbonamento — e stavano in cima all'elenco proprio
//    perché erano le più vecchie. Chi apriva il file per «prendere la più
//    vecchia» trovava quelle.
export const QUANDO = ["si può fare adesso", "aspetta", "—"];

const INIZIO = "<!-- CONTEGGIO: generato da `npm run richieste`, non si scrive a mano -->";
const FINE = "<!-- FINE CONTEGGIO -->";

/**
 * Le righe-richiesta del file: `| S1 | … | … | … | … | stato |`.
 * ⚠️ Si riconosce dall'identificativo in prima cella (una lettera e un
 *    numero), non dalla posizione: le tabelle sono dieci e crescono.
 */
export function richieste(testo) {
  const fuori = [];
  for (const riga of testo.split("\n")) {
    const m = riga.match(/^\|\s*([A-Z]+\d+)\s*\|/);
    if (!m) continue;
    const celle = riga.split("|").slice(1, -1).map((c) => c.trim());
    const stato = (celle[celle.length - 1] || "").replace(/\*\*/g, "").split("·")[0].trim();
    const quando = (celle[celle.length - 2] || "").replace(/\*\*/g, "").trim();
    fuori.push({ id: m[1], stato, quando, riga });
  }
  return fuori;
}

/**
 * Le righe il cui stato non è fra i quattro. Non è un elenco di scarto: è la
 * ragione per cui il conteggio si rifiuta di partire.
 */
export function fuoriVocabolario(voci) {
  return voci.filter((v) => !STATI.includes(v.stato));
}

export function quandoFuoriVocabolario(voci) {
  return voci.filter((v) => !QUANDO.includes(v.quando));
}

export function conteggio(voci) {
  const per = Object.fromEntries(STATI.map((s) => [s, 0]));
  for (const v of voci) per[v.stato] += 1;
  const aperte = voci.filter((v) => v.stato === "in attesa" || v.stato === "in corso");
  return {
    totale: voci.length,
    per,
    aperte: aperte.length,
    adesso: aperte.filter((v) => v.quando === "si può fare adesso").length,
    aspettano: aperte.filter((v) => v.quando === "aspetta").length,
  };
}

export function blocco(voci) {
  const c = conteggio(voci);
  const somma = STATI.reduce((n, s) => n + c.per[s], 0);
  return [
    INIZIO,
    "",
    `**${c.totale} richieste in tutto**, e ognuna sta in uno dei quattro stati:`,
    `**${c.per["in attesa"]} in attesa** · **${c.per["in corso"]} in corso** · ` +
      `**${c.per["fatta"]} fatte** · **${c.per["scartata da Alessio"]} scartate da lui**.`,
    `La somma fa **${somma}**, cioè il numero delle righe: se non tornasse, questo`,
    "conteggio non verrebbe nemmeno generato.",
    "",
    `Delle **${c.aperte}** ancora aperte, **${c.adesso}** si possono fare adesso e`,
    `**${c.aspettano}** aspettano qualcun altro (un consulente, la banca, un`,
    "abbonamento, o un blocco che vuole una sessione sua).",
    "",
    FINE,
  ].join("\n");
}

export function generaConteggio(testo) {
  const voci = richieste(testo);
  const rotte = fuoriVocabolario(voci);
  if (rotte.length) {
    throw new Error(
      "Queste richieste hanno uno stato che non è fra i quattro previsti " +
        `(${STATI.join(" · ")}), quindi nessun gruppo le conterebbe:\n  ` +
        rotte.map((v) => `${v.id} → «${v.stato}»`).join("\n  ")
    );
  }
  const senzaQuando = quandoFuoriVocabolario(voci);
  if (senzaQuando.length) {
    throw new Error(
      `Queste richieste non dicono se si possono fare adesso (${QUANDO.join(" · ")}):\n  ` +
        senzaQuando.map((v) => `${v.id} → «${v.quando}»`).join("\n  ")
    );
  }
  const i = testo.indexOf(INIZIO);
  const j = testo.indexOf(FINE);
  if (i < 0 || j < 0) {
    throw new Error(
      `In ${FILE} manca il blocco del conteggio. Deve stare fra «${INIZIO}» e «${FINE}».`
    );
  }
  return testo.slice(0, i) + blocco(voci) + testo.slice(j + FINE.length);
}

// ---------------------------------------------------------------------
// IL COMANDO — stessa forma di `npm run indice`, cosi' i due si leggono
// insieme e nessuno deve ricordarsi due modi di fare la stessa cosa.
// ---------------------------------------------------------------------
if (process.argv[1]?.endsWith("indice-richieste.mjs")) {
  const testo = readFileSync(FILE, "utf8");
  const nuovo = generaConteggio(testo);
  const c = conteggio(richieste(nuovo));
  if (process.argv.includes("--verifica")) {
    if (nuovo !== testo) {
      console.error("");
      console.error(`  Il conteggio di ${FILE} non torna col numero di righe.`);
      console.error("  Rigeneralo:  npm run richieste");
      console.error("");
      process.exit(1);
    }
    console.log(`  Il conteggio e' allineato: ${c.totale} richieste, ${c.aperte} aperte.`);
  } else {
    writeFileSync(FILE, nuovo, "utf8");
    console.log(`  Conteggio rigenerato: ${c.totale} richieste, ${c.aperte} aperte ` +
      `(${c.adesso} si possono fare adesso, ${c.aspettano} aspettano).`);
  }
}
