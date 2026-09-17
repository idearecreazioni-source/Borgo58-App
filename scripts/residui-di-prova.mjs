// =====================================================================
// I RESIDUI DELLE PROVE SUL PROGETTO DI PROVA — 18/09/2026
// =====================================================================
//
// PERCHE' ESISTE. Le prove contro il database si riconoscono le righe da un
// nome e le ripuliscono da se'. Ma quando un giro viene UCCISO a meta' — dal
// limite di tempo, da una coda, da un annullamento — la pulizia non parte, e
// la riga resta. Il giro dopo la trova e si ferma:
//
//     «c'e' piu' di un "ZZZ-PROVA-voce" in magazzino: una corsa precedente
//      ha lasciato un residuo da togliere»
//
// 🔴 QUEL MESSAGGIO E' GIUSTO E VA LASCIATO COM'E': la prova dichiara il
//    residuo invece di aggirarlo scegliendone uno a caso. Aggirarlo
//    vorrebbe dire non accorgersi mai di una perdita vera. Quello che
//    mancava era il CONTRARIO: un modo di TOGLIERLO, invece di andare a
//    mano sul pannello.
//
// ⚠️ SI RIFIUTA DI PARTIRE SE NON E' IL PROGETTO DI PROVA. E' l'unica
//    difesa che conta: un programma che cancella righe non deve poter
//    sbagliare database. Il confronto e' sul riferimento del progetto, che
//    sta in chiaro in `scripts/comune.mjs`.
//
// ⚠️ E CANCELLA SOLO NOMI DICHIARATI QUI SOTTO, mai «tutto quello che
//    sembra di prova»: un elenco chiuso si legge, un'euristica no.

import { createClient } from "@supabase/supabase-js";
import { leggiChiaviDiProva } from "./chiavi.mjs";
import { REF_PROVA, REF_PRODUZIONE } from "./comune.mjs";

/**
 * I residui conosciuti. Ogni voce dice la tabella, la colonna e — in modo
 * esplicito — se cerca un nome ESATTO (`valore`) o un INIZIO (`prefisso`).
 *
 * ⚠️ Il prefisso si dichiara come campo, non si scrive dentro il valore con
 *    un `%`: un jolly nascosto in una stringa e' la strada per cancellare
 *    piu' di quanto si voleva, e non si vede leggendo.
 */
export const RESIDUI_NOTI = [
  { tabella: "ingredients", colonna: "name", valore: "ZZZ-PROVA-voce" },
  // ⚠️ Le righe figlie se ne vanno da se': chi riferisce `dettature` lo fa
  //    con `on delete cascade`.
  { tabella: "dettature", colonna: "testo", prefisso: "PROVA-voce" },
];

const conferma = process.argv.includes("--conferma");

function ferma(...righe) {
  for (const r of righe) console.error(r);
  process.exit(1);
}

/**
 * Questo indirizzo e' il progetto di prova?
 *
 * 🔴 Non basta «non e' la produzione»: un terzo progetto sconosciuto sarebbe
 *    altrettanto sbagliato. Si pretende il riferimento ATTESO.
 */
export function problemaDelBersaglio(url) {
  const u = String(url || "").trim();
  if (!u) return "Non so a quale progetto mi collegherei: manca l'indirizzo.";
  if (u.includes(REF_PRODUZIONE))
    return "Questo e' il gestionale VERO. Non tocco niente, e non e' un errore da correggere con un'opzione.";
  if (!u.includes(REF_PROVA))
    return "Questo non e' il progetto di prova conosciuto: non cancello righe su un database che non riconosco.";
  return null;
}

async function principale() {
  const valori = leggiChiaviDiProva();
  const url = valori.VITE_SUPABASE_URL;
  const anon = valori.VITE_SUPABASE_ANON_KEY;
  const email = valori.TEST_TITOLARE_EMAIL;
  const password = valori.TEST_TITOLARE_PASSWORD;

  const problema = problemaDelBersaglio(url);
  if (problema) ferma(problema);
  for (const [nome, v] of Object.entries({ VITE_SUPABASE_ANON_KEY: anon, TEST_TITOLARE_EMAIL: email, TEST_TITOLARE_PASSWORD: password })) {
    if (!v) ferma(`Manca ${nome}: non posso entrare.`);
  }

  const client = createClient(url, anon, { auth: { persistSession: false } });
  const { error: errEntrata } = await client.auth.signInWithPassword({ email, password });
  if (errEntrata) ferma(`Non riesco a entrare come titolare: ${errEntrata.message}`);

  let totale = 0;
  for (const r of RESIDUI_NOTI) {
    const cerca = () =>
      r.prefisso
        ? client.from(r.tabella).select("id").like(r.colonna, `${r.prefisso}%`)
        : client.from(r.tabella).select("id").eq(r.colonna, r.valore);
    const { data, error } = await cerca();
    if (error) ferma(`Non riesco a leggere ${r.tabella}: ${error.message}`);
    const come = r.prefisso ? `inizia per «${r.prefisso}»` : `= «${r.valore}»`;
    console.log(`  ${r.tabella}.${r.colonna} ${come}: ${data.length} riga/e`);
    totale += data.length;
    if (data.length === 0) continue;
    if (!conferma) continue;
    const { error: errCanc } = r.prefisso
      ? await client.from(r.tabella).delete().like(r.colonna, `${r.prefisso}%`)
      : await client.from(r.tabella).delete().eq(r.colonna, r.valore);
    if (errCanc) ferma(`Non riesco a togliere da ${r.tabella}: ${errCanc.message}`);
    console.log(`    tolte ${data.length}`);
  }

  if (totale === 0) {
    console.log("Nessun residuo: il progetto di prova e' pulito.");
  } else if (!conferma) {
    console.log(`\nTrovati ${totale} residui. Per toglierli: --conferma`);
    process.exit(2);
  } else {
    // ⚠️ SI RIGUARDA, invece di credere a cio' che si e' appena fatto.
    let rimasti = 0;
    for (const r of RESIDUI_NOTI) {
      const { data } = r.prefisso
        ? await client.from(r.tabella).select("id").like(r.colonna, `${r.prefisso}%`)
        : await client.from(r.tabella).select("id").eq(r.colonna, r.valore);
      rimasti += data?.length ?? 0;
    }
    console.log(`\nDopo la pulizia restano ${rimasti} residui.`);
    if (rimasti > 0) ferma("La pulizia non ha tolto tutto.");
  }
  await client.auth.signOut();
}

if (process.argv[1] && process.argv[1].endsWith("residui-di-prova.mjs")) {
  principale().catch((e) => ferma(String(e)));
}
