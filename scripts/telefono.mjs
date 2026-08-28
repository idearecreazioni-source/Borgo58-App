// ---------------------------------------------------------------------
// `npm run telefono` — l'indirizzo con cui Alessio apre il gestionale dal
// telefono: c'e'? risponde? e a quale gestionale porta?
// ---------------------------------------------------------------------
//
// 🔴 IL DIFETTO CHE CHIUDE, misurato il 28/08/2026.
//    Il 27/08 il telefono ha smesso di aprire il gestionale: schermo
//    BIANCO dall'icona. Non era Tailscale spento — il tunnel era vivo e
//    configurato. Puntava alla porta **5199**, che e' quella che
//    `npm run dev:collaudo` apre per MISURARE le schermate. Quel server
//    era stato chiuso, e il tunnel e' rimasto puntato nel vuoto.
//
// 🔴 LA CAUSA NON E' TAILSCALE: E' CHI GLI CAMBIA IL BERSAGLIO.
//    `dev-prova.mjs` ripunta il tunnel alla porta del proprio avvio — ed
//    e' giusto, altrimenti l'indirizzo cifrato aprirebbe un gestionale
//    diverso da quello che si e' appena acceso. Ma cosi' **un server
//    usa-e-getta si prende l'indirizzo del telefono di Alessio**, e
//    quando muore nessuno lo rimette a posto.
//    ⚠️ Il danno non e' il tunnel rotto: e' che **un tunnel che punta nel
//       vuoto e uno che lavora si vedono uguali** — «https», il lucchetto,
//       e una pagina bianca. Non c'e' nessun errore da leggere.
//
// LA REGOLA CHE NE ESCE, ed e' quella che questo file rende automatica:
//   · non c'e' nessuna pubblicazione        -> la si crea su questa porta;
//   · punta gia' a questa porta             -> a posto, non si tocca;
//   · punta a un'altra porta CHE RISPONDE   -> NON si ruba. Si dice.
//   · punta a un'altra porta MUTA           -> si riprende, e si dice.
// ⚠️ Il terzo caso e' il cuore: un server aperto per misurare non ha
//    nessun titolo a portarsi via l'indirizzo con cui Alessio lavora.
//    Il quarto e' la riparazione: il prossimo avvio vero rimette a posto
//    cio' che un usa-e-getta ha lasciato rotto.
//
// ⚠️ PERCHE' L'INDIRIZZO CIFRATO E' OBBLIGATORIO e non una comodita':
//    senza, **il microfono non parte**. I browser danno il microfono solo
//    alle pagine protette, e `localhost` e' l'unica eccezione — cioe'
//    funziona dal computer e non dal telefono. Misurato da Alessio con le
//    sue mani il 27/08: stesso iPhone, stesso Safari, `http://…:5173`
//    muto e `https://….ts.net` che detta.

import { createConnection } from "node:net";
import { pathToFileURL } from "node:url";
import { esegui, titolo, REF_PRODUZIONE, REF_PROVA } from "./comune.mjs";

const TS =
  process.platform === "win32" ? "C:/Program Files/Tailscale/tailscale.exe" : "tailscale";

/** Qualcuno ascolta su questa porta? Una connessione vera, non un elenco. */
export function portaViva(porta, millisecondi = 1200) {
  return new Promise((risolvi) => {
    const presa = createConnection({ host: "127.0.0.1", port: Number(porta) });
    const chiudi = (esito) => {
      presa.destroy();
      risolvi(esito);
    };
    presa.setTimeout(millisecondi);
    presa.once("connect", () => chiudi(true));
    presa.once("timeout", () => chiudi(false));
    presa.once("error", () => chiudi(false));
  });
}

/** Cosa dice Tailscale adesso: il nome pubblicato e la porta verso cui va. */
export function statoTunnel() {
  const stato = esegui(TS, ["serve", "status", "--json"], { silenzioso: true });
  if (!stato.ok) return { disponibile: false };

  let letto;
  try {
    letto = JSON.parse(stato.uscita);
  } catch {
    return { disponibile: false };
  }

  const nome = Object.keys(letto?.Web ?? {})[0];
  if (!nome) return { disponibile: true, pubblicato: false };

  const verso = letto.Web[nome]?.Handlers?.["/"]?.Proxy ?? "";
  const porta = (verso.match(/:(\d+)\s*$/) || [])[1] || null;
  return {
    disponibile: true,
    pubblicato: true,
    indirizzo: `https://${nome.replace(/:443$/, "")}`,
    porta,
  };
}

/**
 * Punta il tunnel a `porta`, ma solo quando ne ha il diritto.
 * Restituisce { indirizzo, esito } dove esito e' una delle quattro
 * situazioni descritte in cima al file — cosi' chi chiama puo' DIRLO
 * invece di far succedere le cose in silenzio.
 */
export async function assicuraTunnel(porta) {
  const s = statoTunnel();
  if (!s.disponibile) return { indirizzo: null, esito: "tailscale-assente" };

  if (!s.pubblicato) {
    const fatto = esegui(TS, ["serve", "--bg", String(porta)], { silenzioso: true });
    if (!fatto.ok) return { indirizzo: null, esito: "tailscale-assente" };
    const dopo = statoTunnel();
    return { indirizzo: dopo.indirizzo ?? null, esito: "creato" };
  }

  if (String(s.porta) === String(porta)) {
    return { indirizzo: s.indirizzo, esito: "gia-giusto" };
  }

  // Punta altrove. Prima di prendergli il posto si guarda se quel posto
  // e' occupato da qualcuno che sta lavorando.
  const altroVivo = s.porta ? await portaViva(s.porta) : false;
  if (altroVivo) {
    return { indirizzo: s.indirizzo, esito: "occupato-da-vivo", portaAltrui: s.porta };
  }

  esegui(TS, ["serve", "--bg", String(porta)], { silenzioso: true });
  const dopo = statoTunnel();
  return { indirizzo: dopo.indirizzo ?? s.indirizzo, esito: "ripreso", portaMorta: s.porta };
}

/** Quale gestionale c'e' dietro una porta: il vero, quello di prova, o boh. */
async function qualeGestionale(porta) {
  try {
    const r = await fetch(`http://127.0.0.1:${porta}/src/lib/supabase.js`, {
      signal: AbortSignal.timeout(4000),
    });
    if (!r.ok) return null;
    const testo = await r.text();
    // ⚠️ Si cerca l'INDIRIZZO iniettato, non il riferimento scritto nel
    //    sorgente: `src/lib/ambiente.js` nomina tutt'e due i progetti come
    //    costanti, quindi cercare il nome nel file risponderebbe sempre di
    //    si' a tutt'e due. Misurato il 28/08, dopo esserci cascato.
    const url = (testo.match(/https:\/\/([a-z0-9]+)\.supabase\.co/) || [])[1];
    if (!url) return null;
    if (url === REF_PRODUZIONE) return "il LOCALE VERO";
    if (url === REF_PROVA) return "il database di prova";
    return `un progetto che non conosco (${url})`;
  } catch {
    return null;
  }
}

// --- Quando si lancia da solo: si guarda e si racconta ----------------
// ⚠️ Su Windows il percorso di questo progetto ha uno spazio dentro
//    ("Claude code"): confrontare le due stringhe a mano non combacia mai,
//    perche' l'una lo scrive %20 e l'altra no. Si converte, invece di
//    indovinare la forma — e senza, questo comando non stampava NIENTE e
//    sembrava che il guardiano fosse a posto.
//    ⚠️ E `process.argv[1]` puo' non esserci affatto (chi importa questo
//       file da `node -e`): senza la guardia, importarlo faceva morire chi
//       lo importava — trovato importandolo, non rileggendolo.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  titolo("L'indirizzo del telefono");

  const s = statoTunnel();
  if (!s.disponibile) {
    console.log("  Tailscale non risponde su questo computer.");
    console.log("  Dal telefono il gestionale non si apre, e il microfono non parte.");
    process.exit(1);
  }
  if (!s.pubblicato) {
    console.log("  Nessun indirizzo pubblicato.");
    console.log("  Si crea da solo al prossimo `npm run dev:prova`.");
    process.exit(1);
  }

  console.log(`  indirizzo: ${s.indirizzo}`);
  console.log(`  porta:     ${s.porta}`);

  const viva = await portaViva(s.porta);
  console.log("");
  if (!viva) {
    console.log("  🔴 NON RISPONDE NESSUNO su quella porta.");
    console.log("     Dal telefono si vede una PAGINA BIANCA, senza nessun errore.");
    console.log("     Si ripara da solo lanciando `npm run dev:prova`.");
    process.exit(1);
  }

  const chi = await qualeGestionale(s.porta);
  console.log("  ✅ Risponde.");
  if (chi) console.log(`  Dietro c'e': ${chi}.`);
  else console.log("  Non sono riuscito a dire quale gestionale c'e' dietro.");
  console.log("");
  console.log("  Il microfono dal telefono funziona solo su questo indirizzo,");
  console.log("  mai sul numero con le cifre e i punti.");
}
