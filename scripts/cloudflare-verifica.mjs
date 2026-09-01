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
//    E una quinta, che e' l'unica che scrive:
//
//      5. la chiave sa PUBBLICARE?  → `--anteprima <ramo> --conferma`
//
// ⚠️ LA QUINTA PUBBLICA UN'ANTEPRIMA, MAI LA PRODUZIONE, ed e' voluto: il
//    permesso di scrittura non si deduce leggendo — l'unico modo di sapere
//    se una chiave puo' pubblicare e' farle pubblicare qualcosa. Si sceglie
//    la cosa che non fa danno. Il ramo di produzione e' rifiutato dal
//    comando stesso, non dalla buona volonta' di chi lo lancia.
//
// ⚠️ NON STAMPA MAI LA CHIAVE, ne' un pezzo, ne' una sua impronta. Le
//    risposte sono si'/no con il motivo in italiano.
// =====================================================================

import { readFileSync } from "node:fs";

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

export function accountDalRepository(file = ".env.example") {
  const riga = readFileSync(file, "utf8").match(/^CLOUDFLARE_ACCOUNT_ID=(.*)$/m);
  return riga ? riga[1].trim() : "";
}

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
// ⚠️ IL RAMO DI PRODUZIONE E' RIFIUTATO QUI DENTRO, non nel workflow: una
//    regola scritta nel file che esegue vale anche per chi lancia il
//    comando a mano dal proprio computer, ed e' li' che si sbaglia.
// ---------------------------------------------------------------------
export const RAMO_DI_PRODUZIONE = "master";

export function problemaDelRamo(ramo) {
  if (!ramo) return "Serve il nome del ramo su cui costruire l'anteprima.";
  if (ramo === RAMO_DI_PRODUZIONE)
    return (
      `«${RAMO_DI_PRODUZIONE}» e' il ramo di produzione: una costruzione li' ` +
      "sopra e' il sito vero, non un'anteprima. Questo comando non lo fa. " +
      "Per la produzione si passa dai controlli verdi (docs/CLOUDFLARE.md, " +
      "sezione 9)."
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
// La quinta: la sola che scrive. Chiede a Cloudflare di costruire il ramo.
//
// ⚠️ COSTRUISCE CLOUDFLARE, NON GITHUB, ed e' la scelta che regge tutto il
//    piano: il pacchetto del sito ha bisogno dell'indirizzo e della chiave
//    pubblica del gestionale, che oggi vivono **solo** nelle variabili del
//    progetto Cloudflare. Facendo costruire a GitHub bisognerebbe portarle
//    anche li' — cioe' aggiungere un posto dove vivono, che e' il problema
//    che questo mese abbiamo passato a togliere. Cosi' GitHub dice
//    «costruisci» e le variabili non si muovono da dove sono.
// ---------------------------------------------------------------------
export async function pubblicaAnteprima({ token, account, progetto, ramo, chiediFn = chiedi }) {
  const guaio = problemaDelRamo(ramo);
  if (guaio) return { ok: false, dettaglio: guaio };
  return costruisci({ token, account, progetto, ramo, chiediFn });
}

// ⚠️ SENZA GUARDIA, e per questo NON e' esportata come comando: e' il pezzo
//    che sa parlare con Cloudflare, e la regola su quale ramo si possa
//    toccare vive in chi la chiama. Il comando delle anteprime rifiuta
//    `master`; quello della produzione lo pretende, e ci arriva solo da un
//    giro in cui i due lavori dei controlli sono gia' verdi.
export async function costruisci({ token, account, progetto, ramo, chiediFn = chiedi }) {
  const corpo = new FormData();
  corpo.append("branch", ramo);
  const r = await chiediFn(`/accounts/${account}/pages/projects/${progetto}/deployments`, token, {
    method: "POST",
    body: corpo,
  });
  if (r.corpo?.success !== true) return { ok: false, dettaglio: motivo(r) };
  const d = r.corpo.result;
  return {
    ok: true,
    dettaglio: `anteprima ${d?.short_id ?? d?.id} sul ramo «${d?.deployment_trigger?.metadata?.branch ?? ramo}» · ${d?.url ?? "indirizzo non dichiarato"}`,
    ambiente: d?.environment,
  };
}

// ---------------------------------------------------------------------
// Il comando
// ---------------------------------------------------------------------
async function principale() {
  const argomenti = process.argv.slice(2);
  const valore = (nome) => {
    const i = argomenti.indexOf(nome);
    return i >= 0 ? argomenti[i + 1] : null;
  };

  const token = process.env.CLOUDFLARE_API_TOKEN ?? "";
  const account = process.env.CLOUDFLARE_ACCOUNT_ID || accountDalRepository();
  const progetto = process.env.CLOUDFLARE_PROJECT || "borgo58-app";

  console.log("Cosa puo' davvero la chiave di Cloudflare\n");
  const esiti = await verifica({ token, account, progetto });
  for (const e of esiti) console.log(`  ${e.ok ? "OK  " : "NO  "}${e.domanda}\n      ${e.dettaglio}`);

  const cadute = esiti.filter((e) => !e.ok).length;
  console.log(
    `\n  ${esiti.length - cadute} su ${esiti.length}. ` +
      (cadute ? "Finche' una di queste e' NO, il resto non si prova.\n" : "Nessuna scrittura provata: il permesso di pubblicare NON e' dimostrato da queste.\n"),
  );

  const ramo = valore("--anteprima");
  if (!ramo) {
    if (cadute) process.exit(1);
    console.log("  Per provare anche la scrittura, senza toccare il sito vero:");
    console.log("    node scripts/cloudflare-verifica.mjs --anteprima <ramo> --conferma\n");
    return;
  }
  if (cadute) {
    console.error("Le letture non passano: non si prova a scrivere.");
    process.exit(1);
  }
  if (!argomenti.includes("--conferma")) {
    console.log(`  Costruirebbe un'anteprima del ramo «${ramo}». Con --conferma la costruisce davvero.\n`);
    return;
  }

  const esito = await pubblicaAnteprima({ token, account, progetto, ramo });
  console.log(`  ${esito.ok ? "OK  " : "NO  "}La chiave sa pubblicare?\n      ${esito.dettaglio}`);
  if (esito.ok && esito.ambiente && esito.ambiente !== "preview") {
    console.error(`\n🔴 Cloudflare dichiara ambiente «${esito.ambiente}», atteso «preview». Guarda il pannello.`);
    process.exit(1);
  }
  if (!esito.ok) process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) await principale();
