#!/usr/bin/env node
// =====================================================================
// LA PULIZIA DELLE COSTRUZIONI SU CLOUDFLARE — 31/08/2026
// =====================================================================
//
// PERCHE' ESISTE, misurato prima di scriverlo.
// Cloudflare ricostruisce il sito a ogni push e **conserva tutto per
// sempre**: non ha nessuna impostazione di conservazione, e dal pannello si
// cancella una riga alla volta. Finche' il lavoro andava tutto su `master`
// non si vedeva; dal 31/08 ogni ramo ha le sue costruzioni, e senza una
// pulizia l'elenco cresce senza fine.
//
// 🔴 E NON E' SOLO DISORDINE: ogni costruzione di un ramo ha un **indirizzo
//    pubblico** suo, che resta vivo anche dopo che il ramo e' stato
//    cancellato su GitHub. I due sistemi non si parlano: buttare via la
//    storia su GitHub non tocca i siti gia' costruiti da quella storia.
//
// ⚠️ SOLA LETTURA DI SUO, come `npm run migra`. Senza `--conferma` dice cosa
//    farebbe e non tocca niente. La regola di casa e' che un comando che
//    cancella non lo fa perche' e' stato lanciato: lo fa perche' qualcuno
//    l'ha confermato dopo aver visto i numeri.
//
// ⚠️ NON CANCELLA MAI IL SITO VIVO. La costruzione che in questo momento
//    serve `borgo58.it` viene chiesta a Cloudflare (`canonical_deployment`)
//    ed e' esclusa prima di qualunque conto — non «di solito e' la prima»,
//    che e' un'ipotesi sull'ordinamento e non una garanzia.
//
// Le tre cose che sa fare:
//   npm run cloudflare                      cosa c'e', e cosa toglierebbe
//   npm run cloudflare -- --conferma        tiene le ultime N di produzione
//   npm run cloudflare -- --ramo <nome>     le costruzioni di quel ramo
//   npm run cloudflare -- --orfani          i rami che su GitHub non ci sono piu'
//
// Le chiavi vivono in `.env.cloudflare` (git-ignored, modello in
// `.env.cloudflare.example`) oppure nelle variabili d'ambiente — che e' come
// arrivano quando gira su GitHub.

import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

// 🔴 QUANTE VERSIONI DI PRODUZIONE SI TENGONO — deciso da Alessio il
//    31/08/2026. Non e' un numero tecnico: le versioni vecchie sono anche il
//    modo di **tornare indietro** se una pubblicazione va male, quindi
//    abbassarlo accorcia la via di ritorno. Dieci passi indietro, per come si
//    lavora qui, sono molti.
export const PRODUZIONI_DA_TENERE = 10;

// =====================================================================
// LA PARTE CHE DECIDE — pura, cosi' si prova senza chiamare nessuno
// =====================================================================

/** Il ramo da cui e' nata una costruzione, o "" se Cloudflare non lo dice. */
export function ramoDi(costruzione) {
  return costruzione?.deployment_trigger?.metadata?.branch ?? "";
}

/**
 * Quali costruzioni di PRODUZIONE si tolgono.
 *
 * ⚠️ `vivo` non e' un'opinione: e' l'identificativo che Cloudflare dichiara
 * come sito attualmente servito. Escluso sempre, anche se per qualche motivo
 * non fosse il piu' recente — e quel caso esiste davvero, dopo un ritorno
 * indietro a una versione precedente.
 */
export function produzioniDaTogliere(costruzioni, { tieni = PRODUZIONI_DA_TENERE, vivo = null } = {}) {
  const produzione = costruzioni
    .filter((c) => c.environment === "production")
    .sort((a, b) => new Date(b.created_on) - new Date(a.created_on));

  const tenute = new Set(produzione.slice(0, tieni).map((c) => c.id));
  if (vivo) tenute.add(vivo);

  return produzione.filter((c) => !tenute.has(c.id));
}

/**
 * Le costruzioni di anteprima di UN ramo preciso.
 *
 * ⚠️ Solo `preview`: se qualcuno passasse `master`, le costruzioni di
 * produzione non devono finire qui dentro per sbaglio. La produzione si
 * governa con la conservazione, non con il nome del ramo.
 */
export function anteprimeDelRamo(costruzioni, ramo) {
  if (!ramo) return [];
  return costruzioni.filter((c) => c.environment === "preview" && ramoDi(c) === ramo);
}

/**
 * Le anteprime di rami che su GitHub non esistono piu'.
 *
 * ⚠️ Serve perche' **chiudere il rubinetto non svuota il secchio**: il lavoro
 * automatico che pulisce quando un ramo viene cancellato vale da quando
 * esiste, e non sa niente di quello che c'era prima.
 *
 * ⚠️ Una costruzione di cui Cloudflare non sa dire il ramo NON viene toccata:
 * «non so da dove viene» non e' «viene da un ramo morto». Nel dubbio resta.
 */
export function anteprimeOrfane(costruzioni, ramiVivi) {
  const vivi = new Set(ramiVivi);
  return costruzioni.filter((c) => {
    if (c.environment !== "preview") return false;
    const ramo = ramoDi(c);
    return ramo !== "" && !vivi.has(ramo);
  });
}

/** Una riga leggibile per l'elenco a schermo. */
export function descrivi(c) {
  const quando = String(c.created_on ?? "").replace("T", " ").slice(0, 16);
  const ramo = ramoDi(c) || "ramo sconosciuto";
  return `${String(c.id).slice(0, 8)}  ${quando}  ${c.environment.padEnd(10)}  ${ramo}`;
}

// =====================================================================
// LA PARTE CHE PARLA CON CLOUDFLARE
// =====================================================================

const API = "https://api.cloudflare.com/client/v4";

function fermati(...righe) {
  console.error("");
  for (const r of righe) console.error(`  ${r}`);
  console.error("");
  process.exit(1);
}

/**
 * Le chiavi: prima le variabili d'ambiente (e' cosi' che arrivano su
 * GitHub), poi il file locale. Mai nel repository, in nessuno dei due casi.
 */
export function configurazione(file = ".env.cloudflare") {
  const da = { ...process.env };
  if (existsSync(file)) {
    for (const riga of readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = riga.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (m && !da[m[1]]) da[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  }
  const token = da.CLOUDFLARE_API_TOKEN;
  const account = da.CLOUDFLARE_ACCOUNT_ID;
  const progetto = da.CLOUDFLARE_PROJECT || "borgo58-app";

  // ⚠️ Si ferma dicendolo, invece di non fare niente in silenzio: un comando
  //    di pulizia che non trova le chiavi e finisce «tutto a posto» e' la
  //    stessa bugia del controllo che passa verde senza aver provato niente.
  if (!token || !account) {
    fermati(
      "Mancano le chiavi di Cloudflare.",
      "Servono CLOUDFLARE_API_TOKEN e CLOUDFLARE_ACCOUNT_ID,",
      "nel file .env.cloudflare oppure come variabili d'ambiente.",
      "Come si creano: docs/CLOUDFLARE.md, sezione 5."
    );
  }
  return { token, account, progetto };
}

async function chiedi(cfg, percorso, opzioni = {}) {
  const r = await fetch(`${API}/accounts/${cfg.account}/pages/projects/${cfg.progetto}${percorso}`, {
    ...opzioni,
    headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "application/json" },
  });
  const corpo = await r.json().catch(() => ({}));
  if (!r.ok || corpo.success === false) {
    const detta = (corpo.errors ?? []).map((e) => `${e.code}: ${e.message}`).join(" · ");
    fermati(
      `Cloudflare ha risposto ${r.status} su ${percorso}.`,
      detta || "Nessun dettaglio nella risposta.",
      r.status === 403 || r.status === 401
        ? "La chiave non ha il permesso «Cloudflare Pages: Edit», o e' scaduta."
        : ""
    );
  }
  return corpo.result;
}

/**
 * Tutte le costruzioni, seguendo le pagine.
 *
 * 🔴 SI SEGUONO LE PAGINE, e non e' un dettaglio: l'API ne restituisce **25
 *    per volta**. Prendendo solo la prima pagina, la pulizia direbbe «ce ne
 *    sono 25» qualunque sia la verita' — cioe' la famiglia della *risposta
 *    piu' corta che ha l'aria di essere intera* (regola del 19/08).
 */
async function tutteLeCostruzioni(cfg) {
  const fuori = [];
  for (let pagina = 1; pagina <= 100; pagina++) {
    const lotto = await chiedi(cfg, `/deployments?page=${pagina}&per_page=25`);
    if (!Array.isArray(lotto) || lotto.length === 0) break;
    fuori.push(...lotto);
    if (lotto.length < 25) break;
  }
  return fuori;
}

/** L'identificativo della costruzione che in questo momento SERVE borgo58.it. */
async function costruzioneViva(cfg) {
  const progetto = await chiedi(cfg, "");
  return progetto?.canonical_deployment?.id ?? progetto?.latest_deployment?.id ?? null;
}

/** I rami che esistono davvero su GitHub, chiesti a git invece che ricordati. */
export function ramiVivi() {
  const r = spawnSync("git", ["ls-remote", "--heads", "origin"], { encoding: "utf8" });
  if (r.status !== 0) {
    fermati("Non riesco a chiedere a GitHub quali rami esistono.", r.stderr?.trim() || "");
  }
  return r.stdout
    .split("\n")
    .map((riga) => riga.split("refs/heads/")[1])
    .filter(Boolean)
    .map((s) => s.trim());
}

// =====================================================================
// IL GIRO
// =====================================================================

const argomenti = process.argv.slice(2);
const conferma = argomenti.includes("--conferma");
const orfani = argomenti.includes("--orfani");
const ramo = (() => {
  const i = argomenti.indexOf("--ramo");
  return i >= 0 ? argomenti[i + 1] : null;
})();

async function principale() {
  const cfg = configurazione();
  const vivo = await costruzioneViva(cfg);
  const costruzioni = await tutteLeCostruzioni(cfg);

  const produzione = costruzioni.filter((c) => c.environment === "production");
  const anteprime = costruzioni.filter((c) => c.environment === "preview");

  console.log("");
  console.log(`── Cloudflare · progetto ${cfg.progetto}`);
  console.log("");
  console.log(`  costruzioni in tutto     ${costruzioni.length}`);
  console.log(`  di produzione            ${produzione.length}`);
  console.log(`  anteprime dei rami       ${anteprime.length}`);
  console.log(`  quella che serve il sito ${vivo ? String(vivo).slice(0, 8) : "non dichiarata"}`);

  let daTogliere;
  let perche;

  if (ramo) {
    daTogliere = anteprimeDelRamo(costruzioni, ramo);
    perche = `anteprime del ramo «${ramo}»`;
  } else if (orfani) {
    const vivi = ramiVivi();
    daTogliere = anteprimeOrfane(costruzioni, vivi);
    perche = `anteprime di rami che su GitHub non esistono piu' (rami vivi: ${vivi.length})`;
  } else {
    daTogliere = produzioniDaTogliere(costruzioni, { tieni: PRODUZIONI_DA_TENERE, vivo });
    perche = `versioni di produzione oltre le ultime ${PRODUZIONI_DA_TENERE}`;
  }

  console.log("");
  console.log(`── Da togliere: ${perche}`);
  console.log("");
  if (daTogliere.length === 0) {
    console.log("  Niente da togliere.");
    console.log("");
    return;
  }
  for (const c of daTogliere) console.log(`  ${descrivi(c)}`);

  if (!conferma) {
    console.log("");
    console.log(`  ${daTogliere.length} da togliere. NON HO TOCCATO NIENTE.`);
    console.log(`  Per farlo davvero, rilancia lo stesso comando con --conferma`);
    console.log("");
    return;
  }

  console.log("");
  let tolte = 0;
  for (const c of daTogliere) {
    // ⚠️ Cintura in piu': il sito vivo non passa di qui nemmeno per errore.
    if (vivo && c.id === vivo) {
      console.log(`  SALTATA ${String(c.id).slice(0, 8)} — e' la versione che serve il sito`);
      continue;
    }
    await chiedi(cfg, `/deployments/${c.id}?force=true`, { method: "DELETE" });
    tolte++;
    console.log(`  tolta ${descrivi(c)}`);
  }
  console.log("");
  console.log(`  Tolte ${tolte} su ${daTogliere.length}.`);
  console.log("");
}

// Gira solo se lanciato come comando: le prove lo importano per le funzioni
// pure, e importarlo non deve chiamare nessuno.
if (process.argv[1] && process.argv[1].endsWith("cloudflare.mjs")) {
  principale().catch((e) => fermati("Errore inatteso.", e?.message ?? String(e)));
}
