#!/usr/bin/env node
// =====================================================================
// COSA PUO' DAVVERO LA CHIAVE DI CLOUDFLARE — 01/09/2026
// =====================================================================
//
// 🔴 PERCHE' ESISTE. Sul giro dei controlli la chiave di Cloudflare compare
//    nel registro come `***`. **Quel mascheramento non e' una prova di
//    niente**: dice che GitHub ha nascosto qualcosa che somiglia a un
//    segreto, non che la chiave sia valida, non che abbia i permessi giusti,
//    non che sia la stessa che c'e' sul computer di Alessio. E' *presenza
//    apparente nel giro*, e basta.
//
//    Questo comando toglie la deduzione e mette una misura al suo posto, in
//    quattro domande separate — separate perche' possono avere risposte
//    diverse, e un «non funziona» che non dice QUALE delle quattro e' caduta
//    manda a cercare nel posto sbagliato:
//
//      1. il numero dell'account ha la forma giusta?   (nessuna rete)
//      2. la chiave e' valida e attiva?                 (sola lettura)
//      3. la chiave vede l'account?                     (sola lettura)
//      4. la chiave vede il progetto del sito?          (sola lettura)
//
// 🔴 E NON NE ESISTE UNA QUINTA. Fino al 01/09 questo comando sapeva anche
//    PUBBLICARE un'anteprima, chiedendo a Cloudflare di costruire dal
//    repository. E' stato tolto: era **la stessa macchina dell'anteprima
//    automatica**, solo innescata da noi — quindi non provava il percorso che
//    conta, e teneva in piedi una seconda strada per pubblicare proprio
//    mentre il disegno nuovo ne toglieva una.
//    La filiera e' una sola: `scripts/rilascio.mjs`, dove GitHub compila e
//    Wrangler carica. Qui si LEGGE.
// ⚠️ Conseguenza da tenere presente: **il permesso di scrivere non e'
//    dimostrato da niente di quello che sta in questo file**, e il comando lo
//    dice a voce alta invece di lasciarlo intendere.
//
// ⚠️ NON STAMPA MAI LA CHIAVE, ne' un pezzo, ne' una sua impronta. Le
//    risposte sono si'/no con il motivo in italiano.
// =====================================================================

const API = "https://api.cloudflare.com/client/v4";

// ---------------------------------------------------------------------
// Il numero dell'account NON E' UN SEGRETO, e va detto perche' la
// conseguenza e' pratica: sta gia' in chiaro in `.env.example` e in
// `docs/CLOUDFLARE.md`, si legge nell'indirizzo del pannello, e Cloudflare
// lo scrive da se' nei commenti alle proposte di modifica. Tenerlo fra i
// segreti di GitHub non lo protegge da niente e in cambio fa una cosa
// dannosa: **se il segreto non c'e', la variabile arriva vuota e il lavoro
// si spegne in silenzio** — che e' esattamente quello che il registro del
// 01/09 ha fatto vedere. Quindi ha un valore predefinito che viene dal
// repository, e i segreti restano per le sole cose che sono segrete.
// ---------------------------------------------------------------------
export const FORMA_ACCOUNT = /^[0-9a-f]{32}$/;

// 🔴 NESSUN RIPIEGO SU `.env.example`, e la funzione che lo leggeva e' stata
//    TOLTA invece di lasciata inutilizzata. Un valore preso da un file di
//    esempio e' configurazione che nessuno ha scelto: sembra funzionare
//    finche' qualcuno cambia account, e allora il ripiego serve il numero
//    vecchio senza che nessun errore lo dica. Il numero vive in UN posto solo
//    — la Variable di GitHub, o `.env` sul computer.

export function problemaDellAccount(valore) {
  if (!valore) return "Manca il numero dell'account Cloudflare.";
  if (!FORMA_ACCOUNT.test(valore))
    return (
      "Il numero dell'account non ha la forma giusta: sono 32 caratteri fra " +
      "0-9 e a-f minuscole. Si legge nell'indirizzo del pannello, subito dopo " +
      "dash.cloudflare.com/ — vedi docs/CLOUDFLARE.md, sezione 5."
    );
  return null;
}

// ---------------------------------------------------------------------
// Le quattro letture. Ognuna torna { ok, dettaglio } e NESSUNA si ferma
// alla prima che va male: chi legge vuole sapere quante ne cadono e quali,
// non la prima. *Un rifiuto che ne nomina una sola fa scoprire la seconda
// dopo aver risolto la prima.*
// ---------------------------------------------------------------------
async function chiedi(percorso, token, opzioni = {}) {
  const r = await fetch(`${API}${percorso}`, {
    ...opzioni,
    headers: { Authorization: `Bearer ${token}`, ...(opzioni.headers ?? {}) },
  });
  let corpo = null;
  try {
    corpo = await r.json();
  } catch {
    corpo = null;
  }
  return { stato: r.status, corpo };
}

const motivo = (risposta) =>
  risposta.corpo?.errors?.map((e) => `${e.code}: ${e.message}`).join(" · ") ||
  `risposta ${risposta.stato}`;

export async function verifica({ token, account, progetto, chiediFn = chiedi }) {
  const esiti = [];

  const guaio = problemaDellAccount(account);
  esiti.push({
    domanda: "Il numero dell'account ha la forma giusta?",
    ok: !guaio,
    dettaglio: guaio ?? "32 caratteri esadecimali minuscoli.",
  });

  if (!token) {
    esiti.push({
      domanda: "La chiave e' valida e attiva?",
      ok: false,
      dettaglio: "CLOUDFLARE_API_TOKEN non e' arrivato: non c'e' niente da chiedere.",
    });
    return esiti;
  }

  // ⚠️ L'INDIRIZZO GIUSTO E' QUELLO DELL'ACCOUNT, non `/user/tokens/verify`.
  //    Provato il 01/09: a una chiave legata a un account, quello dell'utente
  //    risponde «Invalid API Token» — che si legge «la chiave non vale» ed e'
  //    falso. *Un rifiuto che descrive male la causa manda a cambiare la cosa
  //    sbagliata.*
  const v = await chiediFn(`/accounts/${account}/tokens/verify`, token);
  esiti.push({
    domanda: "La chiave e' valida e attiva?",
    ok: v.corpo?.success === true && v.corpo?.result?.status === "active",
    dettaglio:
      v.corpo?.success === true
        ? `stato dichiarato da Cloudflare: ${v.corpo?.result?.status}`
        : motivo(v),
  });

  // 🔴 QUI LA PRIMA VERSIONE DI QUESTO COMANDO SBAGLIAVA, e vale la pena
  //    lasciarlo scritto perche' e' un falso allarme di quelli che si
  //    imparano a spegnere. Chiedeva `/accounts/{id}`, cioe' la scheda
  //    dell'account: misurato il 01/09, una chiave con **il solo permesso
  //    Pages** — che e' quella giusta, quella che questo progetto pretende —
  //    risponde `9109: Unauthorized to access requested resource`. Il comando
  //    diceva «la chiave non vede l'account» **proprio quando la chiave e'
  //    fatta bene.** Ora chiede l'elenco dei progetti Pages dell'account: e'
  //    la stessa domanda («questa chiave e' legata a questo account?») fatta
  //    dentro il perimetro che la chiave ha davvero.
  const a = await chiediFn(`/accounts/${account}/pages/projects`, token);
  esiti.push({
    domanda: "La chiave e' legata a questo account?",
    ok: a.corpo?.success === true,
    dettaglio:
      a.corpo?.success === true
        ? `vede ${a.corpo.result?.length ?? 0} progetti Pages su questo account`
        : motivo(a),
  });

  const p = await chiediFn(`/accounts/${account}/pages/projects/${progetto}`, token);
  // ⚠️ I DUE INTERRUTTORI STANNO IN `source.config`, non in cima alla
  //    risposta: cercandoli in cima si legge «non dichiarato» su un progetto
  //    che invece li ha, e quello e' un «non lo so» travestito da dato.
  const dati = p.corpo?.result;
  const conf = dati?.source?.config ?? {};
  esiti.push({
    domanda: `La chiave vede il progetto «${progetto}»?`,
    ok: p.corpo?.success === true,
    dettaglio:
      p.corpo?.success === true
        ? `ramo di produzione «${conf.production_branch ?? dati?.production_branch}» · ` +
          `pubblicazione automatica della produzione: ` +
          `${conf.production_deployments_enabled === false ? "SPENTA" : "ACCESA"} · ` +
          `anteprime: ${conf.preview_deployment_setting ?? "non dichiarato"}`
        : motivo(p),
  });

  return esiti;
}

// ---------------------------------------------------------------------
// FOTOGRAFA e CONFRONTA — servono al gesto sul pannello.
//
// ⚠️ «Verifica che la produzione non sia stata toccata» e' una frase; il
//    confronto fra due fotografie e' una misura. E guarda anche le due
//    pubblicazioni vive: se cambiasse quella canonica, la produzione SAREBBE
//    stata toccata anche con tutti gli interruttori uguali.
// ---------------------------------------------------------------------
export function daConfrontare(risultato) {
  return {
    source: risultato?.source,
    production_branch: risultato?.production_branch,
    latest_deployment: {
      id: risultato?.latest_deployment?.id,
      environment: risultato?.latest_deployment?.environment,
      created_on: risultato?.latest_deployment?.created_on,
    },
    canonical_deployment: {
      id: risultato?.canonical_deployment?.id,
      environment: risultato?.canonical_deployment?.environment,
      created_on: risultato?.canonical_deployment?.created_on,
    },
  };
}

export function piatto(oggetto, prefisso = "") {
  return Object.entries(oggetto ?? {}).flatMap(([k, v]) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? piatto(v, `${prefisso}${k}.`)
      : [[`${prefisso}${k}`, JSON.stringify(v)]],
  );
}

export function differenze(prima, dopo) {
  const a = new Map(piatto(prima));
  const b = new Map(piatto(dopo));
  const campi = [...new Set([...a.keys(), ...b.keys()])].sort();
  return {
    confrontati: campi.length,
    cambiati: campi.filter((c) => a.get(c) !== b.get(c)).map((c) => ({ campo: c, prima: a.get(c), dopo: b.get(c) })),
  };
}

async function principale() {
  const argomenti = process.argv.slice(2);
  const valore = (nome) => {
    const i = argomenti.indexOf(nome);
    return i >= 0 ? argomenti[i + 1] : null;
  };

  const token = process.env.CLOUDFLARE_API_TOKEN ?? "";
  const account = process.env.CLOUDFLARE_ACCOUNT_ID ?? "";
  const progetto = process.env.CLOUDFLARE_PROJECT || "borgo58-app";

  // ⚠️ Prima delle quattro letture: fotografare e confrontare NON hanno
  //    bisogno che le letture passino — servono proprio a documentare uno
  //    stato, anche quando qualcosa non torna.
  const fotografa = valore("--fotografa");
  const confronta = valore("--confronta");
  if (fotografa || confronta) {
    const { readFileSync, writeFileSync } = await import("node:fs");
    const r = await chiedi(`/accounts/${account}/pages/projects/${progetto}`, token);
    if (r.corpo?.success !== true) {
      console.error(`Cloudflare non risponde sul progetto «${progetto}»: ${motivo(r)}`);
      process.exit(1);
    }
    const adesso = daConfrontare(r.corpo.result);
    if (fotografa) {
      writeFileSync(fotografa, JSON.stringify({ quando: new Date().toISOString(), ...adesso }, null, 2));
      console.log(`Fotografia scritta in ${fotografa}.`);
      return;
    }
    const prima = JSON.parse(readFileSync(confronta, "utf8"));
    delete prima.quando;
    const d = differenze(prima, adesso);
    for (const c of d.cambiati) console.log(`CAMBIATO  ${c.campo}: ${c.prima} → ${c.dopo}`);
    console.log(`\ncampi confrontati: ${d.confrontati} · cambiati: ${d.cambiati.length}`);
    return;
  }

  console.log("Cosa puo' davvero la chiave di Cloudflare\n");
  const esiti = await verifica({ token, account, progetto });
  for (const e of esiti) console.log(`  ${e.ok ? "OK  " : "NO  "}${e.domanda}\n      ${e.dettaglio}`);

  const cadute = esiti.filter((e) => !e.ok).length;
  console.log(
    `\n  ${esiti.length - cadute} su ${esiti.length}. ` +
      (cadute
        ? "Finche' una di queste e' NO, non si pubblica niente.\n"
        : "⚠️ Nessuna scrittura provata: il permesso di PUBBLICARE non e' dimostrato da queste.\n"),
  );

  if (cadute) process.exit(1);
  console.log("  Questo comando LEGGE e basta. Per pubblicare c'e' una filiera");
  console.log("  sola, e passa da GitHub: docs/CLOUDFLARE.md, sezione 9.\n");
}

if (import.meta.url === `file://${process.argv[1]}`) await principale();
