import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { REF_PRODUZIONE, REF_PROVA } from "../../scripts/comune.mjs";

// =====================================================================
// NESSUN INDIRIZZO DEL CLOUD SCRITTO A MANO NEL DATABASE — 31/10/2026
// =====================================================================
// 🔴 PERCHÉ ESISTE. Fino al 29/08 dodici migrazioni scrivevano a mano
//    `https://<produzione>.supabase.co/functions/v1` dentro le funzioni che
//    bussano a una funzione online: fisso, o come ripiego se il Vault non
//    aveva `url_funzioni`. Su Prova e su una ricostruzione da zero (Casa)
//    quelle funzioni chiamavano il gestionale vero. La 20260917000001 e la
//    20260920000001 le hanno riscritte tutte: oggi l'indirizzo viene solo da
//    `url_funzioni_configurato()`, cioè dal Vault di QUEL database.
//
// ⚠️ LE VECCHIE MIGRAZIONI NON SI TOCCANO: raccontano cosa è successo quel
//    giorno, e sono già applicate (regola del 23/08). Si sorveglia invece
//    che:
//      1. nessuna migrazione NUOVA scriva un indirizzo del cloud a mano;
//      2. l'ULTIMA definizione di ogni funzione non ne contenga nessuno;
//      3. nessun lavoro pianificato lo porti nel suo comando.
//
// ⚠️ Prove sul TESTO, coi commenti tolti: un setaccio che cerca una forma
//    trova anche chi la nomina per spiegarla (27/08).

const CARTELLA = "supabase/migrations";
const FILE = readdirSync(CARTELLA)
  .filter((f) => f.endsWith(".sql"))
  .sort();
const senzaCommenti = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--[^\n]*/g, "");
const CODICE = new Map(FILE.map((f) => [f, senzaCommenti(readFileSync(`${CARTELLA}/${f}`, "utf8"))]));

// Qualunque progetto Supabase, non solo i due del locale: un terzo
// indirizzo scritto a mano sarebbe sbagliato allo stesso modo. Si cerca il
// nome del progetto, con o senza `https://` davanti.
const INDIRIZZO_CLOUD = /[a-z0-9]{20}\.supabase\.(co|in)\b/i;

// Le dodici del passato, congelate: la lista non cresce mai.
const STORICHE = [
  "20260801000002_telegram_trigger.sql",
  "20260802000002_task_reminders.sql",
  "20260809000006_blindatura_notifiche.sql",
  "20260810000005_allarmi.sql",
  "20260811000001_email_conferma_cliente.sql",
  "20260812000002_archivia_posta.sql",
  "20260812000008_ogni_lavoro_col_battito.sql",
  "20260813000001_un_rincaro_e_un_fatto_nuovo.sql",
  "20260813000003_un_avviso_si_legge_al_volo.sql",
  "20260820000007_il_foglio_del_preventivo.sql",
  "20260828000012_la_posta_dice_se_memo_sta_leggendo.sql",
  "20260829000003_un_tetto_solo_per_tutto_l_assistente.sql",
];

// Chi nomina un indirizzo per RICONOSCERLO e non per chiamarlo.
const RICONOSCITORI = {
  // Confronta `url_funzioni` con Prova per sapere dove si trova; non chiama niente.
  siamo_su_prova: "20260919000001_le_prove_automatiche_non_suonano.sql",
};

/** Il testo tra la parentesi aperta in `da` e la sua chiusa. */
function traParentesi(codice, da) {
  let livello = 0;
  for (let i = da; i < codice.length; i++) {
    if (codice[i] === "(") livello++;
    else if (codice[i] === ")" && --livello === 0) return codice.slice(da + 1, i);
  }
  return codice.slice(da + 1);
}

// Tipi di due parole: senza nome davanti, la prima parola è il tipo.
const TIPI_DI_DUE_PAROLE = /^(double|timestamp|time|character|bit)\b/i;

/**
 * La firma come la vede Postgres: i soli tipi. `p_dettagli jsonb default
 * null` e `p_dettagli jsonb DEFAULT NULL::jsonb` sono la stessa funzione.
 */
function firma(argomenti) {
  const pezzi = [];
  let livello = 0;
  let pezzo = "";
  for (const c of argomenti) {
    if (c === "(") livello++;
    if (c === ")") livello--;
    if (c === "," && livello === 0) {
      pezzi.push(pezzo);
      pezzo = "";
    } else pezzo += c;
  }
  pezzi.push(pezzo);
  return pezzi
    .map((a) => a.replace(/\s+(default\b|=)[\s\S]*$/i, "").replace(/^\s*(in|out|inout|variadic)\s+/i, "").trim().toLowerCase())
    .filter(Boolean)
    .map((a) => {
      const parole = a.split(/\s+/);
      return parole.length > 1 && !TIPI_DI_DUE_PAROLE.test(a) ? parole.slice(1).join(" ") : a;
    })
    .join(",");
}

const NOME = String.raw`(?:"?([a-z_][a-z0-9_]*)"?\.)?"?([a-z_][a-z0-9_]*)"?\s*\(`;

/**
 * Ogni `create [or replace] function` e ogni `drop function`, in ordine.
 * La chiave è schema, nome e tipi: due funzioni con lo stesso nome e
 * argomenti diversi sono due funzioni. Il corpo è tra le etichette `$…$`;
 * se non ce ne sono (corpo tra apici) è tutto il testo fino alla funzione
 * dopo: meglio un pezzo in più che uno in meno.
 */
function eventi() {
  const tutti = [];
  const crea = new RegExp(String.raw`create\s+(?:or\s+replace\s+)?function\s+${NOME}`, "gi");
  const togli = new RegExp(String.raw`drop\s+function\s+(?:if\s+exists\s+)?${NOME}`, "gi");
  for (const [file, codice] of CODICE) {
    const create = [...codice.matchAll(crea)];
    const qui = [];
    create.forEach((m, i) => {
      const aperta = m.index + m[0].length - 1;
      const fino = i + 1 < create.length ? create[i + 1].index : codice.length;
      const tratto = codice.slice(aperta, fino);
      const etichetta = /\bas\s+(\$[a-z0-9_]*\$)/i.exec(tratto);
      const inizio = etichetta ? etichetta.index + etichetta[0].length : 0;
      const fine = etichetta ? tratto.indexOf(etichetta[1], inizio) : -1;
      qui.push({
        pos: m.index,
        tipo: "crea",
        chiave: `${(m[1] ?? "public").toLowerCase()}.${m[2].toLowerCase()}(${firma(traParentesi(codice, aperta))})`,
        nome: m[2].toLowerCase(),
        file,
        corpo: tratto.slice(inizio, fine < 0 ? undefined : fine),
      });
    });
    for (const m of codice.matchAll(togli)) {
      const aperta = m.index + m[0].length - 1;
      qui.push({
        pos: m.index,
        tipo: "togli",
        chiave: `${(m[1] ?? "public").toLowerCase()}.${m[2].toLowerCase()}(${firma(traParentesi(codice, aperta))})`,
        file,
      });
    }
    tutti.push(...qui.sort((a, b) => a.pos - b.pos));
  }
  return tutti;
}

const definizioni = () => eventi().filter((e) => e.tipo === "crea");

/** Le funzioni vive alla fine di tutte le migrazioni, con la loro ultima definizione. */
function vive() {
  const ultima = new Map();
  for (const e of eventi()) {
    if (e.tipo === "crea") ultima.set(e.chiave, e);
    else ultima.delete(e.chiave);
  }
  return ultima;
}

/** L'istruzione che comincia in `da`, fino al `;` fuori da apici e da `$…$`. */
function istruzione(codice, da) {
  for (let i = da; i < codice.length; i++) {
    const c = codice[i];
    if (c === ";") return codice.slice(da, i);
    if (c === "'") {
      i = codice.indexOf("'", i + 1);
      if (i < 0) break;
    } else if (c === "$") {
      const tag = /^\$[a-z0-9_]*\$/i.exec(codice.slice(i));
      if (tag) {
        i = codice.indexOf(tag[0], i + tag[0].length);
        if (i < 0) break;
        i += tag[0].length - 1;
      }
    }
  }
  return codice.slice(da);
}

describe("nessun indirizzo del cloud scritto a mano nelle migrazioni", () => {
  it("il setaccio vede davvero le dodici storiche (se ne vedesse zero, non proverebbe niente)", () => {
    const conIndirizzo = FILE.filter((f) => INDIRIZZO_CLOUD.test(CODICE.get(f)));
    for (const f of STORICHE) expect(conIndirizzo).toContain(f);
  });

  it("🔴 nessuna migrazione nuova lo scrive: solo le dodici del passato e, dei riconoscitori, il solo corpo dichiarato", () => {
    const tutte = definizioni();
    const nuove = FILE.filter((f) => {
      if (STORICHE.includes(f)) return false;
      let codice = CODICE.get(f);
      // Del riconoscitore si toglie SOLO il suo corpo: il resto del file conta.
      for (const d of tutte) if (d.file === f && RICONOSCITORI[d.nome] === f) codice = codice.replace(d.corpo, "");
      return INDIRIZZO_CLOUD.test(codice);
    });
    expect(nuove, "Usa url_funzioni_configurato() invece di scrivere l'indirizzo").toEqual([]);
  });

  it("🔴 l'ultima definizione di ogni funzione viva non ne contiene nessuno", () => {
    expect(definizioni().some((d) => INDIRIZZO_CLOUD.test(d.corpo))).toBe(true);
    const ancoraVive = [...vive().values()]
      .filter((d) => !(d.nome in RICONOSCITORI))
      .filter((d) => INDIRIZZO_CLOUD.test(d.corpo))
      .map((d) => `${d.chiave} (${d.file})`);
    expect(ancoraVive).toEqual([]);
  });

  it("i riconoscitori nominano solo Prova, e non chiamano niente", () => {
    const perNome = new Map([...vive().values()].map((d) => [d.nome, d]));
    for (const nome of Object.keys(RICONOSCITORI)) {
      const corpo = perNome.get(nome)?.corpo ?? "";
      expect(corpo, `${nome} non trovato`).not.toBe("");
      expect(corpo).toContain(`https://${REF_PROVA}.supabase.co`);
      expect(corpo).not.toContain(REF_PRODUZIONE);
      expect(corpo).not.toMatch(/net\.http_(post|get)/i);
    }
  });

  it("🔴 nessun lavoro pianificato porta un indirizzo del cloud nel suo comando", () => {
    const lavori = [];
    for (const [file, codice] of CODICE) {
      for (const m of codice.matchAll(/cron\.(schedule|alter_job)\s*\(/gi)) {
        if (INDIRIZZO_CLOUD.test(istruzione(codice, m.index))) lavori.push(file);
      }
    }
    expect(lavori).toEqual([]);
  });
});
