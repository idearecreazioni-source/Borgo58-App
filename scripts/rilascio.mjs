#!/usr/bin/env node
// =====================================================================
// LA FILIERA DI RILASCIO — 01/09/2026
// =====================================================================
//
// UNA SOLA, per l'anteprima e per la produzione: **GitHub compila → il
// pacchetto viene controllato → Wrangler carica.** La differenza fra i due
// e' un DATO (quale progetto Supabase deve nominare il pacchetto, su quale
// ramo di Cloudflare si scrive), non un percorso: due percorsi divergono, e
// a divergere per prima e' sempre la strada meno battuta.
//
// 🔴 PERCHE' NON LA FA PIU' CLOUDFLARE. Misurato il 01/09 leggendo l'API in
//    sola lettura: la versione `797262b8` risulta **in PRODUZIONE, riuscita**,
//    il 31/08 alle 23:11:12, con i controlli di quel commit **rossi**. Fra un
//    commit e borgo58.it non c'era nessun cancello.
//
// 🔴 E PERCHE' IL CONTROLLO GUARDA IL PACCHETTO E NON LE VARIABILI. Sempre il
//    01/09: l'ambiente `preview` di Cloudflare aveva l'indirizzo del progetto
//    di PROVA e la chiave della PRODUZIONE. Ciascuna meta' era giusta — ed e'
//    per questo che nessuno l'ha vista — ma la coppia rispondeva
//    `401 Invalid API key` a ogni richiesta. *Il difetto non stava in nessuno
//    dei due valori: stava nella loro coppia, e nessuno guardava la coppia.*
//
// ⚠️ LA CHIAVE `anon` NON E' UN SEGRETO APPLICATIVO: finisce nel pacchetto del
//    browser per costruzione, e a proteggere i dati e' la RLS. Sta fra i
//    Secrets di GitHub per comodita' operativa — per non vederla nei registri
//    e per cambiarla in un posto solo — e **nessuna sicurezza dipende dal
//    fatto che sia nascosta**. Questo comando non ne stampa mai il valore.
// =====================================================================

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { REF_PRODUZIONE, REF_PROVA } from "./comune.mjs";
import { funzioniIndietro, fraseFunzioniIndietro } from "./funzioni-indietro.mjs";
import {
  INDIRIZZI_PREDEFINITI,
  indirizziDiAccesso,
  problemaDegliIndirizzi,
} from "./indirizzi-accesso.mjs";

const API = "https://api.cloudflare.com/client/v4";

// ---------------------------------------------------------------------
// Gli ambienti. Quello che cambia fra i due sta tutto qui.
// ---------------------------------------------------------------------
export const AMBIENTI = {
  anteprima: { supabase: REF_PROVA, nome: "progetto di prova" },
  produzione: { supabase: REF_PRODUZIONE, nome: "gestionale vero" },
};

// L'unico ramo di anteprima che si puo' costruire PARTENDO dal ramo di
// produzione. E' la prova generale: si gira su `master` e si scrive altrove,
// ed e' l'unico caso in cui i due nomi hanno il diritto di essere diversi —
// quindi il nome permesso e' uno solo, ed e' scritto qui.
export const RAMO_PROVA_DI_RILASCIO = "prova-di-rilascio";

// 🔴 IL RAMO DA CUI NASCE BORGO58-PROVA — 18/09/2026. Prima era `master`:
//    Prova si costruiva dallo stesso ramo che va in produzione, e il
//    «collaudo» guardava esattamente cio' che era gia' stato deciso.
export const RAMO_DI_COLLAUDO = "slave";

// ⚠️ Vietati SEMPRE a un'anteprima, oltre al ramo che Cloudflare dichiara di
//    produzione: se un giorno il progetto venisse ricollegato a `main`, il
//    nome vecchio resterebbe pericoloso e questo elenco lo copre lo stesso.
export const RAMI_DI_PRODUZIONE = ["master", "main", "production", "prod"];

// ---------------------------------------------------------------------
// LA COERENZA — tre cose devono dire la stessa storia: che ambiente ho
// dichiarato, da quale riferimento di GitHub sto girando, e su quale ramo di
// Cloudflare sto per scrivere.
//
// ⚠️ FALLISCE CHIUSO. Ogni dato che manca e' un rifiuto, mai un «vada avanti,
//    tanto probabilmente va bene»: qui il caso peggiore e' scrivere sul sito
//    vero credendo di fare una prova.
// ---------------------------------------------------------------------
export function problemaDiCoerenza({ ambiente, tipoRef, ramoGitHub, ramoCloudflare, ramoDiProduzione }) {
  if (ambiente !== "anteprima" && ambiente !== "produzione")
    return `Ambiente «${ambiente ?? ""}» sconosciuto: gli ambienti sono «anteprima» e «produzione».`;
  if (tipoRef !== "branch")
    return `Questo e' un riferimento di tipo «${tipoRef || "?"}», non un ramo: non si pubblica.`;
  if (!ramoGitHub) return "Non so da quale ramo di GitHub sto girando.";
  // 🔴 Se Cloudflare non lo dichiara non si tira a indovinare: senza quel nome
  //    non si puo' dire se il bersaglio e' la produzione o no.
  if (!ramoDiProduzione)
    return "Cloudflare non ha dichiarato il proprio ramo di produzione: non posso decidere, e non pubblico.";
  if (!ramoCloudflare) return "Non so su quale ramo di Cloudflare scriverei.";

  const vietati = new Set([...RAMI_DI_PRODUZIONE, ramoDiProduzione].map((r) => r.toLowerCase()));
  const cf = ramoCloudflare.toLowerCase();
  const gh = ramoGitHub.toLowerCase();
  const produzione = ramoDiProduzione.toLowerCase();

  if (ambiente === "produzione") {
    if (gh !== produzione)
      return `Giro su «${ramoGitHub}», ma il ramo di produzione di Cloudflare e' «${ramoDiProduzione}».`;
    if (cf !== produzione)
      return `Scriverei su «${ramoCloudflare}», ma la produzione e' «${ramoDiProduzione}».`;
    return null;
  }

  if (vietati.has(cf)) return `«${ramoCloudflare}» e' un ramo di produzione: un'anteprima non ci scrive mai.`;
  if (gh === produzione)
    return cf === RAMO_PROVA_DI_RILASCIO
      ? null
      : `Dal ramo di produzione l'unica anteprima permessa e' «${RAMO_PROVA_DI_RILASCIO}», non «${ramoCloudflare}».`;
  // 🔴 DA `slave` L'UNICA ANTEPRIMA PERMESSA E' BORGO58-PROVA, e non il
  //    ramo omonimo. E' la stessa regola che vale dal ramo di produzione,
  //    applicata al ramo che adesso ALIMENTA il collaudo: l'indirizzo di
  //    Prova non deve spostarsi solo perche' cambia chi lo costruisce.
  if (gh === RAMO_DI_COLLAUDO)
    return cf === RAMO_PROVA_DI_RILASCIO
      ? null
      : `Da «${RAMO_DI_COLLAUDO}» l'unica anteprima permessa e' «${RAMO_PROVA_DI_RILASCIO}», non «${ramoCloudflare}».`;
  if (cf !== gh)
    return `Giro su «${ramoGitHub}» e scriverei su «${ramoCloudflare}»: l'anteprima di un ramo si costruisce su quel ramo.`;
  return null;
}

// ---------------------------------------------------------------------
// IL COMMIT COLLAUDATO — 17/09/2026, corretto il 18/09/2026
// ---------------------------------------------------------------------
// 🔴 PERCHE' NON BASTA `needs:`. Due lavori dello stesso giro girano sullo
//    stesso commit per costruzione, quindi il legame c'e' gia'. Ma e' un
//    legame che nessuno puo' LEGGERE: vive nella forma del file, e si
//    scioglie con una riga sola — `if: always()` sulla produzione, e quel
//    lavoro parte anche quando Prova e' fallita o e' stata saltata,
//    **restando verde**. Un cancello che cade in silenzio e' la forma
//    peggiore, ed e' la stessa famiglia del guasto del 01/09.
//
// 🔴 IL DIFETTO CHE HA FATTO CORREGGERE LA VERSIONE DEL 17/09. Si chiedeva a
//    GitHub un rilascio su Prova con l'IDENTICO commit che gira in produzione.
//    Ma la filiera e' `slave -> master` con una proposta, e GitHub crea un
//    commit di FUSIONE nuovo, che su Prova non e' mai uscito: quel cancello
//    era impossibile da soddisfare per la strada lecita, cioe' chiuso per
//    sempre. La scorciatoia — togliere il controllo — l'avrebbe aperto per
//    sempre. Serve una terza cosa: dimostrare che il CONTENUTO e' lo stesso.
//
// ⚠️ COSA SI DIMOSTRA ADESSO. Un commit e' pubblicabile se esiste un commit
//    «collaudato» (lui stesso, oppure il secondo genitore di una fusione nella
//    sua storia diretta) tale che:
//      1. il registro dei rilasci di GitHub ha un rilascio RIUSCITO
//         sull'ambiente `anteprima`, per QUEL commit, dal ramo `slave`;
//      2. fra il commit collaudato e quello che sta per uscire non cambia
//         nessun file, tranne un elenco ESPLICITO e corto di file di
//         infrastruttura (PERCORSI_DI_INFRASTRUTTURA). Non conta il messaggio
//         della fusione ne' il nome della proposta: contano gli alberi.
//    Qualunque dato mancante, vuoto, malformato o ambiguo e' un rifiuto.
//
// 🔴 E UN VALORE VUOTO E' UN RIFIUTO, NON UN PASSAGGIO — ed e' il caso che
//    conta davvero. Quando un lavoro viene saltato GitHub non lascia un
//    errore: lascia una **stringa vuota**. Leggerla come «non ho niente da
//    confrontare, vado avanti» vorrebbe dire aprire il cancello proprio nel
//    caso in cui Prova non e' mai girata. Si fallisce chiusi, come ovunque
//    in questo file.
//
// ⚠️ IL LIMITE DELL'ELENCO DI INFRASTRUTTURA. Sono i file che LEGGONO il
//    rilascio, non quelli che finiscono nel sito: il workflow, questo script,
//    la sua prova e la guida. Nessun file dell'applicazione, del database, del
//    pacchetto (`package.json`, `package-lock.json`) o di configurazione della
//    compilazione ne fa parte. Aggiungerne uno e' una decisione, e la prova
//    dell'elenco in `tests/unita/cancello-pubblicazione.test.js` la rende
//    visibile.
export const AMBIENTE_GITHUB_DI_PROVA = "anteprima";

// Quanti commit della storia diretta si guardano per trovare un collaudato, e
// quindi quanta storia deve portare il `checkout` (vedi il workflow).
export const ANTENATI_DA_GUARDARE = 20;

export const PERCORSI_DI_INFRASTRUTTURA = Object.freeze([
  ".github/workflows/controlli.yml",
  "scripts/rilascio.mjs",
  "tests/unita/cancello-pubblicazione.test.js",
  "docs/CLOUDFLARE.md",
]);

const FORMA_SHA = /^[0-9a-f]{40}$/;
const RAMI_DEL_COLLAUDO = new Set([RAMO_DI_COLLAUDO, `refs/heads/${RAMO_DI_COLLAUDO}`]);
const corto = (sha) => sha.slice(0, 7);

/**
 * Da `git rev-list --first-parent --parents -n N <commit>` ai commit da
 * verificare: il commit stesso, e il secondo genitore di ogni fusione a due
 * genitori nella sua storia diretta. Le fusioni con altri numeri di genitori
 * non sono «una fusione da slave» e non generano candidati.
 */
export function candidatiDelCollaudo(righe, sha) {
  if (!FORMA_SHA.test(sha ?? "")) return { errore: "Non so su quale commit sto girando: non pubblico." };
  const linee = String(righe ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (linee.length === 0) return { errore: "La storia del commit non si legge: non pubblico." };

  const candidati = [{ sha, come: "questo stesso commit" }];
  for (const [i, linea] of linee.entries()) {
    const pezzi = linea.split(/\s+/);
    if (!pezzi.every((p) => FORMA_SHA.test(p)))
      return { errore: "La storia del commit ha una riga che non si capisce: non pubblico." };
    if (i === 0 && pezzi[0] !== sha)
      return { errore: "La storia letta non parte dal commit su cui sto girando: non pubblico." };
    if (pezzi.length === 3 && !candidati.some((c) => c.sha === pezzi[2]))
      candidati.push({ sha: pezzi[2], come: `secondo genitore della fusione ${corto(pezzi[0])}` });
  }
  return { candidati };
}

/** Le differenze fra due alberi: solo file di infrastruttura, altrimenti rifiuto. */
export function problemaDelleDifferenze(percorsi) {
  if (!Array.isArray(percorsi)) return "L'elenco delle differenze non si legge: non pubblico.";
  const fuori = percorsi.filter((p) => typeof p !== "string" || !PERCORSI_DI_INFRASTRUTTURA.includes(p));
  if (fuori.length === 0) return null;
  const nomi = fuori.slice(0, 5).map((p) => (typeof p === "string" ? p : "?"));
  return (
    `il contenuto e' diverso da quello collaudato in ${fuori.length} file che non sono di infrastruttura ` +
    `(${nomi.join(", ")}${fuori.length > 5 ? ", …" : ""})`
  );
}

/**
 * Il registro dei rilasci, letto per UN commit: c'e' un rilascio sull'ambiente
 * di Prova, dal ramo di collaudo, per quel commit esatto, riuscito e mai
 * fallito? `rilasci` e' `[{ sha, ref, environment, stati: ["success", …] }]`.
 * Un elemento che non ha la forma attesa non conta, non viene indovinato.
 */
export function problemaDelRilascioDiProva(rilasci, sha) {
  if (!Array.isArray(rilasci)) return "la risposta del registro dei rilasci non e' valida";
  const dellaProva = rilasci.filter(
    (r) =>
      r &&
      typeof r === "object" &&
      r.sha === sha &&
      r.environment === AMBIENTE_GITHUB_DI_PROVA &&
      RAMI_DEL_COLLAUDO.has(r.ref),
  );
  if (dellaProva.length === 0)
    return `nessun rilascio su «${AMBIENTE_GITHUB_DI_PROVA}» dal ramo «${RAMO_DI_COLLAUDO}» per questo commit`;
  const riuscito = dellaProva.some(
    (r) =>
      Array.isArray(r.stati) &&
      r.stati.includes("success") &&
      !r.stati.some((s) => s === "failure" || s === "error"),
  );
  return riuscito ? null : "nessun rilascio riuscito: manca lo stato «success», o c'e' un fallimento";
}

/**
 * Il cancello. `eseguiGit(args)` restituisce l'uscita di git o solleva;
 * `chiediRilasci(sha)` restituisce i rilasci di quel commit o solleva.
 * Ritorna `null` se si puo' procedere, altrimenti la frase del rifiuto.
 */
export async function problemaDelCollaudo({ sha, eseguiGit, chiediRilasci }) {
  if (!FORMA_SHA.test(sha ?? "")) return "Non so su quale commit sto girando: non pubblico.";

  let righe;
  try {
    righe = eseguiGit(["rev-list", "--first-parent", "--parents", `-n${ANTENATI_DA_GUARDARE}`, sha]);
  } catch {
    return "Non riesco a leggere la storia del commit: non pubblico.";
  }
  const { candidati, errore } = candidatiDelCollaudo(righe, sha);
  if (errore) return errore;

  const motivi = [];
  for (const candidato of candidati) {
    const nome = `${corto(candidato.sha)} (${candidato.come})`;

    if (candidato.sha !== sha) {
      let uscita;
      try {
        uscita = eseguiGit(["diff", "--name-only", "-z", "--no-renames", candidato.sha, sha]);
      } catch {
        motivi.push(`${nome}: non riesco a confrontare i contenuti`);
        continue;
      }
      // 🔴 Un'uscita che non e' un testo NON e' «nessuna differenza»: e' un
      //    confronto che non e' avvenuto.
      if (typeof uscita !== "string") {
        motivi.push(`${nome}: il confronto dei contenuti non ha dato un risultato leggibile`);
        continue;
      }
      const guaioDifferenze = problemaDelleDifferenze(uscita.split("\0").filter(Boolean));
      if (guaioDifferenze) {
        motivi.push(`${nome}: ${guaioDifferenze}`);
        continue;
      }
    }

    let rilasci;
    try {
      rilasci = await chiediRilasci(candidato.sha);
    } catch (e) {
      motivi.push(`${nome}: non riesco a leggere il registro dei rilasci (${e?.message ?? "errore"})`);
      continue;
    }
    const guaioRilascio = problemaDelRilascioDiProva(rilasci, candidato.sha);
    if (guaioRilascio) {
      motivi.push(`${nome}: ${guaioRilascio}`);
      continue;
    }
    return null;
  }

  return (
    `Nessun commit collaudato su Borgo58-Prova corrisponde a «${corto(sha)}»: o Prova non e' girata, ` +
    `o il contenuto non e' quello collaudato. In produzione ci si arriva DOPO Prova, quindi qui ci si ferma.\n` +
    motivi.map((m) => `  - ${m}`).join("\n")
  );
}

/** Il registro dei rilasci di GitHub, in sola lettura, per un commit. */
export async function rilasciDiProvaDaGitHub({ repo, sha, token, fetchFn = fetch }) {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo ?? "")) throw new Error("repository non riconosciuto");
  if (!FORMA_SHA.test(sha ?? "")) throw new Error("commit non valido");
  if (!token) throw new Error("manca il permesso di leggere il registro");

  const chiedi = async (percorso) => {
    const r = await fetchFn(`https://api.github.com/repos/${repo}/${percorso}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
    if (!r.ok) throw new Error(`il registro ha risposto ${r.status}`);
    const j = await r.json().catch(() => null);
    if (!Array.isArray(j)) throw new Error("risposta non valida");
    if (j.length >= 100) throw new Error("troppi elementi per leggerli tutti");
    return j;
  };

  const elenco = await chiedi(`deployments?environment=${AMBIENTE_GITHUB_DI_PROVA}&sha=${sha}&per_page=100`);
  const rilasci = [];
  for (const d of elenco) {
    if (!d || typeof d !== "object" || !Number.isInteger(d.id)) throw new Error("un rilascio non ha un id leggibile");
    const stati = await chiedi(`deployments/${d.id}/statuses?per_page=100`);
    rilasci.push({ sha: d.sha, ref: d.ref, environment: d.environment, stati: stati.map((s) => s?.state) });
  }
  return rilasci;
}

// ---------------------------------------------------------------------
// IL PACCHETTO — si guarda il RISULTATO, non le intenzioni. Le variabili
// dicono cosa volevamo passare; il pacchetto e' quello che il browser usera'.
//
// ⚠️ OTTO PORTE, TUTTE SBARRATE: nessun ramo qui sotto restituisce «va bene»
//    per mancanza di prove.
// ---------------------------------------------------------------------
export function claimDellaChiave(jwt) {
  try {
    return JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString());
  } catch {
    return null;
  }
}

export function problemaDelPacchetto(cartella, refAtteso, leggi = leggiIlCompilato) {
  const testo = leggi(cartella);
  if (testo === null) return `In «${cartella}» non c'e' niente di compilato: non c'e' nulla da controllare.`;

  const indirizzi = [...new Set([...testo.matchAll(/https:\/\/([a-z0-9]+)\.supabase\.co/g)].map((m) => m[1]))];
  if (indirizzi.length === 0) return "Il pacchetto non nomina NESSUN progetto Supabase: o la compilazione non ha ricevuto l'indirizzo, o non e' il pacchetto giusto.";
  if (indirizzi.length > 1) return `Il pacchetto ne nomina ${indirizzi.length}: ${indirizzi.join(", ")}. Non si pubblica.`;
  if (indirizzi[0] !== refAtteso) return `Il pacchetto punta a «${indirizzi[0]}», atteso «${refAtteso}».`;

  const jwt = testo.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/)?.[0];
  if (!jwt) return "Nel pacchetto non c'e' nessuna chiave: non e' verificabile, quindi non si pubblica.";
  const c = claimDellaChiave(jwt);
  if (!c) return "La chiave che c'e' nel pacchetto non e' decodificabile.";
  if (!c.ref) return "La chiave non dichiara a quale progetto appartiene.";
  if (c.ref !== indirizzi[0])
    return `Coppia disallineata: indirizzo «${indirizzi[0]}», chiave «${c.ref}». Ogni richiesta risponderebbe 401.`;
  // 🔴 L'ottava, ed e' il caso in cui pubblicare sarebbe peggio di qualunque
  //    401: una chiave di servizio dentro il pacchetto del browser scavalca la
  //    RLS per chiunque apra la pagina.
  if (c.role !== "anon") return `La chiave nel pacchetto ha ruolo «${c.role}», non «anon». NON si pubblica.`;
  return null;
}

// ---------------------------------------------------------------------
// LA NONA: GLI INDIRIZZI DI ACCESSO — 02/09/2026
// ---------------------------------------------------------------------
// 🔴 IL RISCHIO CHE CHIUDE, ed e' l'unico serio di tutto il lavoro sugli
//    indirizzi configurabili: se qualcuno impostasse `VITE_EMAIL_TITOLARE` o
//    `VITE_EMAIL_STAFF` sull'ambiente **produzione** con indirizzi che sul
//    gestionale vero non esistono, **Alessio non entrerebbe piu' in
//    borgo58.it** — e se ne accorgerebbe davanti alla schermata di accesso,
//    cioe' chiuso fuori.
//
// ⚠️ LA DIFESA STA QUI E NON IN UN PASSO DEL WORKFLOW, e la ragione e' la
//    stessa che regge tutto questo file: **la filiera e' una sola**. Messa
//    qui, vale per tutte e tre le strade che pubblicano (l'anteprima del
//    ramo, la prova generale, la produzione) senza che nessuno si ricordi di
//    aggiungerla alla quarta.
//
// ⚠️ E SI FERMA **PRIMA DI WRANGLER**: il sito resta com'era. Un controllo
//    che scattasse dopo il caricamento direbbe soltanto che il danno c'e'.

/**
 * Quali indirizzi ci si aspetta di trovare nel pacchetto, per ambiente.
 *
 * 🔴 IN PRODUZIONE SONO SEMPRE I PREDEFINITI. Non «quelli configurati»: e'
 *    esattamente la configurazione dell'ambiente produzione la cosa di cui
 *    diffidare. Chiedere all'ambiente cosa aspettarsi renderebbe il controllo
 *    d'accordo con qualunque cosa trovi — cioe' un controllo che approva
 *    sempre.
 *
 * ⚠️ In anteprima sono quelli **configurati**, ed e' giusto: l'anteprima
 *    esiste per entrarci con utenti che non sono quelli del locale vero. La
 *    compilazione e' avvenuta nello stesso lavoro, quindi l'ambiente del
 *    processo e' lo stesso che ha costruito il pacchetto.
 */
export function indirizziAttesi(ambiente, env = process.env) {
  return ambiente === "produzione" ? INDIRIZZI_PREDEFINITI : indirizziDiAccesso(env);
}

/**
 * Il guaio da dire, gia' scritto per chi lo legge dentro un giro di GitHub.
 * ⚠️ Un rifiuto che non dice **cosa fare** manda a cercare: in produzione la
 *    cura e' sempre la stessa — svuotare quelle due caselle.
 */
export function problemaDegliIndirizziDiAccesso(cartella, ambiente, env = process.env, leggi) {
  const guaio = problemaDegliIndirizzi(cartella, indirizziAttesi(ambiente, env), leggi);
  if (!guaio) return null;
  if (ambiente !== "produzione") return guaio;
  return (
    `${guaio}\n` +
    "In produzione gli indirizzi di accesso devono restare quelli predefiniti.\n" +
    "Se sull'ambiente «produzione» sono state impostate VITE_EMAIL_TITOLARE o\n" +
    "VITE_EMAIL_STAFF, vanno tolte: con indirizzi che sul gestionale vero non\n" +
    "esistono, nessuno riuscirebbe piu' a entrare in borgo58.it."
  );
}

function leggiIlCompilato(cartella) {
  const assets = join(cartella, "assets");
  if (!existsSync(assets)) return null;
  const js = readdirSync(assets).filter((f) => f.endsWith(".js"));
  if (!js.length) return null;
  return js.map((f) => readFileSync(join(assets, f), "utf8")).join("\n");
}

// ---------------------------------------------------------------------
// Cloudflare, in sola lettura: quale ramo chiama produzione.
// ---------------------------------------------------------------------
export async function ramoDiProduzioneDaCloudflare({ token, account, progetto, fetchFn = fetch }) {
  const r = await fetchFn(`${API}/accounts/${account}/pages/projects/${progetto}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const j = await r.json().catch(() => null);
  if (j?.success !== true) return { errore: j?.errors?.map((e) => `${e.code}: ${e.message}`).join(" · ") || `risposta ${r.status}` };
  return { ramo: j.result?.source?.config?.production_branch ?? j.result?.production_branch ?? "" };
}

// ---------------------------------------------------------------------
// Il comando
// ---------------------------------------------------------------------
const argomenti = process.argv.slice(2);
const valore = (nome) => {
  const i = argomenti.indexOf(nome);
  return i >= 0 ? argomenti[i + 1] : null;
};

function ferma(messaggio) {
  console.error(`::error::${messaggio}`);
  process.exit(1);
}

async function principale() {
  const ambiente = valore("--ambiente");
  if (!AMBIENTI[ambiente]) ferma(`Ambiente «${ambiente ?? ""}» sconosciuto: «anteprima» o «produzione».`);

  const token = process.env.CLOUDFLARE_API_TOKEN ?? "";
  // ⚠️ NESSUN RIPIEGO su file del repository: il numero dell'account e'
  //    configurazione operativa e vive in UN posto solo — la Variable di
  //    GitHub, o `.env` sul computer. Un valore preso da un file di esempio
  //    e' configurazione che nessuno ha scelto.
  const account = process.env.CLOUDFLARE_ACCOUNT_ID ?? "";
  const progetto = process.env.CLOUDFLARE_PROJECT ?? "";

  // ⚠️ NON CHIEDE NIENTE A CLOUDFLARE e non ha bisogno di `npm ci`: legge la
  //    storia di git e il registro dei rilasci di GitHub, in sola lettura. Sta
  //    qui, e non in una riga di shell dentro il workflow, per la ragione di
  //    sempre — la filiera e' UNA, e una regola scritta in un passo di
  //    workflow non si puo' provare al contrario. Le prove stanno in
  //    `tests/unita/cancello-pubblicazione.test.js`.
  if (argomenti.includes("--collaudato-su-prova")) {
    if (ambiente !== "produzione") ferma("Il controllo del collaudo esiste solo per la produzione.");
    const eseguiGit = (args) => {
      const r = spawnSync("git", args, { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
      if (r.status !== 0) throw new Error(`git ${args[0]} non e' riuscito`);
      return r.stdout;
    };
    const guaio = await problemaDelCollaudo({
      sha: (process.env.GITHUB_SHA ?? "").trim(),
      eseguiGit,
      chiediRilasci: (sha) =>
        rilasciDiProvaDaGitHub({
          repo: process.env.GITHUB_REPOSITORY ?? "",
          sha,
          token: process.env.GH_TOKEN ?? "",
        }),
    });
    if (guaio) ferma(guaio);
    console.log("Il contenuto di questo commit e' stato collaudato su Borgo58-Prova: si prosegue.");
    return;
  }

  const cartella = valore("--controlla-pacchetto");
  if (cartella) {
    const guaio = problemaDelPacchetto(cartella, AMBIENTI[ambiente].supabase);
    if (guaio) ferma(guaio);
    const guaioIndirizzi = problemaDegliIndirizziDiAccesso(cartella, ambiente);
    if (guaioIndirizzi) ferma(guaioIndirizzi);
    const attesi = indirizziAttesi(ambiente);
    console.log(`Il pacchetto parla col ${AMBIENTI[ambiente].nome}, e la coppia indirizzo/chiave torna.`);
    console.log(`Si entra con «${attesi.titolare}» e «${attesi.staff}».`);
    return;
  }

  if (!token) ferma("CLOUDFLARE_API_TOKEN non e' arrivato.");
  if (!/^[0-9a-f]{32}$/.test(account))
    ferma("CLOUDFLARE_ACCOUNT_ID manca o non ha la forma giusta (32 caratteri fra 0-9 e a-f minuscole).");
  if (!progetto) ferma("CLOUDFLARE_PROJECT non e' arrivato.");

  const daCloudflare = await ramoDiProduzioneDaCloudflare({ token, account, progetto });
  if (daCloudflare.errore) ferma(`Cloudflare non risponde sul progetto «${progetto}»: ${daCloudflare.errore}`);

  const ramoCloudflare =
    ambiente === "produzione" ? daCloudflare.ramo : (process.env.RAMO_ANTEPRIMA ?? "").trim();

  const guaio = problemaDiCoerenza({
    ambiente,
    tipoRef: process.env.GITHUB_REF_TYPE ?? "",
    ramoGitHub: process.env.GITHUB_REF_NAME ?? "",
    ramoCloudflare,
    ramoDiProduzione: daCloudflare.ramo,
  });
  if (guaio) ferma(guaio);

  console.log(
    `Ambiente «${ambiente}» · giro sul ramo «${process.env.GITHUB_REF_NAME}» · ` +
      `scriverei su «${ramoCloudflare}» · Cloudflare chiama produzione «${daCloudflare.ramo}». Torna.`,
  );

  if (!argomenti.includes("--conferma")) return;

  // ⚠️ Il pacchetto si ricontrolla QUI, subito prima di caricare: fra il
  //    controllo di prima e adesso c'e' stata una compilazione.
  const guaioPacchetto = problemaDelPacchetto("dist", AMBIENTI[ambiente].supabase);
  if (guaioPacchetto) ferma(guaioPacchetto);

  // ⚠️ E gli indirizzi si ricontrollano QUI per la stessa ragione del
  //    pacchetto: fra il controllo di prima e adesso c'e' stata una
  //    compilazione. Questo e' l'ultimo momento in cui fermarsi costa
  //    ancora zero — dopo, il sito e' gia' cambiato.
  const guaioIndirizzi = problemaDegliIndirizziDiAccesso("dist", ambiente);
  if (guaioIndirizzi) ferma(guaioIndirizzi);

  // 🔴 E LE FUNZIONI ONLINE SONO AL PASSO? — 06/09/2026, da un guasto vero.
  //    Il sito puo' contenere un gesto che la funzione online non conosce:
  //    e' successo con «Approva» degli appunti vocali, e chi ha premuto ha
  //    visto «Lo sto scrivendo…» e poi niente. Il perche' e il limite di
  //    questo controllo stanno in scripts/funzioni-indietro.mjs.
  // ⚠️ `npx` su Windows e' un `.cmd`: senza `shell` non parte affatto.
  const chiesto = spawnSync(
    "npx",
    ["supabase", "functions", "list", "--project-ref", AMBIENTI[ambiente].supabase, "--output", "json"],
    { encoding: "utf8", shell: true },
  );
  let installate = null;
  try {
    const letto = JSON.parse(chiesto.stdout || "null");
    installate = Array.isArray(letto) ? letto : letto?.functions ?? null;
  } catch {
    installate = null;
  }

  if (Array.isArray(installate)) {
    const guaio = fraseFunzioniIndietro(funzioniIndietro(installate));
    if (guaio) ferma(guaio);
    console.log("Le funzioni online sono al passo col sito che sta per uscire.");
  } else if ((chiesto.stdout || "").trim() !== "") {
    // 🔴 HA RISPOSTO, E LA RISPOSTA NON SI CAPISCE: qui si FERMA. Dal
    //    06/09/2026, su rilievo della revisione — il cancello era
    //    fail-open, cioè lasciava passare proprio il caso che deve
    //    bloccare. *Un guardiano che davanti a una risposta storta dice
    //    «vai» non è un guardiano.*
    ferma(
      "FERMO: ho chiesto quali funzioni online sono installate e la risposta " +
      "non si capisce. Non pubblico senza sapere se il sito e' piu' avanti " +
      "delle funzioni: e' il guasto del 06/09. Riprova, oppure installa a " +
      "mano le funzioni e rilancia.",
    );
  } else {
    // ⚠️ NON HA POTUTO NEMMENO CHIEDERE — nessun accesso a Supabase da qui.
    //    È la strada normale nei controlli di GitHub, e per questo NON
    //    ferma: bloccherebbe ogni pubblicazione. Ma non tace, perché
    //    questa pubblicazione esce **senza** quel controllo, e chi legge
    //    deve saperlo invece di crederlo fatto.
    console.log("⚠️  NON ho potuto controllare che le funzioni online siano al passo col sito:");
    console.log("    da qui non c'e' un accesso a Supabase. Se questa pubblicazione porta");
    console.log("    un gesto nuovo, la funzione online va installata a mano.");
    console.log("    Il perche' e il limite: scripts/funzioni-indietro.mjs");
  }

  // ⚠️ Wrangler viene da `node_modules`, bloccato dal lockfile: la filiera di
  //    rilascio non dipende da quale versione e' uscita quel giorno.
  const wrangler = join("node_modules", ".bin", "wrangler");
  if (!existsSync(wrangler)) ferma("Wrangler non e' installato: `npm ci` non l'ha portato dentro.");
  const esito = spawnSync(
    wrangler,
    ["pages", "deploy", "dist", `--project-name=${progetto}`, `--branch=${ramoCloudflare}`],
    { stdio: "inherit", env: process.env },
  );
  if (esito.status !== 0) ferma(`Wrangler si e' fermato con codice ${esito.status}. Il sito resta com'era.`);
}

// 🔴 `pathToFileURL` E NON `file://` + IL PERCORSO — corretto il 02/09/2026,
//    misurando. Su Windows `process.argv[1]` e' `C:\…\rilascio.mjs` con le
//    barre rovesce, mentre `import.meta.url` e' `file:///C:/…/rilascio.mjs`:
//    il confronto **non torna mai**, quindi da qui lo script usciva con
//    codice **0 senza aver controllato niente**.
//
// ⚠️ Su Linux funzionava, ed e' per questo che nessuno se n'era accorto: in
//    CI il controllo del pacchetto gira davvero. Ma chi lo lanciasse dal
//    computer di Alessio per guardare un pacchetto prima di pubblicare
//    otterrebbe **silenzio e codice zero** — cioe' la faccia esatta di «va
//    tutto bene». *Un guardiano che approva senza aver guardato*, nel file
//    che di guardiani ne contiene nove.
//
// 🔴 E `process.argv[1]` VA GUARDATO PRIMA: quando questo modulo viene
//    **importato** — da una prova, o da `node -e` — quel valore puo' non
//    esistere, e `pathToFileURL(undefined)` **solleva un'eccezione**. La
//    prima stesura di questa correzione non lo guardava: importare il modulo
//    moriva prima ancora di leggerne una funzione.
//    ⚠️ Trovato importandolo davvero, non rileggendolo — e la forma vecchia
//    quel guaio non ce l'aveva, perche' concatenare `undefined` a una stringa
//    non fa esplodere niente. *Una correzione puo' aprire un buco che il
//    difetto che cura non aveva.*
const lanciatoDaRigaDiComando =
  Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;

if (lanciatoDaRigaDiComando) await principale();
