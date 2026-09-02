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
  if (cf !== gh)
    return `Giro su «${ramoGitHub}» e scriverei su «${ramoCloudflare}»: l'anteprima di un ramo si costruisce su quel ramo.`;
  return null;
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
