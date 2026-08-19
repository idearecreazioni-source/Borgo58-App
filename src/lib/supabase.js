import { createClient } from "@supabase/supabase-js";
import { segnalaLetturaTagliata } from "./lettureTagliate";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// ---------------------------------------------------------------------
// IL PUNTO UNICO DA CUI PASSANO LE LETTURE — e dove una risposta tagliata
// si denuncia da sola.
// ---------------------------------------------------------------------
// 🔴 PERCHÉ ESISTE. Chiedendo un elenco senza dire quante righe si vogliono
// ne tornano al massimo mille (impostazione «Max rows» del progetto
// Supabase), **senza nessun errore**. Misurato il 19/08/2026: 1000 righe
// consegnate su 1930 esistenti. Chiedere esplicitamente più righe non
// serve, il tetto vince lo stesso.
//
// ⚠️ QUI, E NON IN OGNI SCHERMATA: la correzione punto per punto sarebbe
// «trovarli tutti», e il prossimo che scrive una lettura nuova ricomincia.
// Messo nel punto da cui passano tutte, **una lettura tagliata si accorge
// da sola** — che è la differenza fra un difetto da cercare e uno che si
// annuncia.
//
// ⚠️ COME SI SA CHE ERA TAGLIATA. Chiedendo `Prefer: count=exact` il
// database aggiunge alla risposta **quante righe c'erano davvero**
// (`Content-Range: 0-999/1930`). Se ne sono arrivate meno di quelle
// dichiarate, la lettura era tagliata. È l'unico modo: il conteggio delle
// righe ricevute, da solo, non distingue «erano tutte» da «erano mille».
//
// ⚠️ IL COSTO, DICHIARATO: il database conta le righe a ogni lettura di
// elenco. Su queste dimensioni non si misura; il giorno che una tabella
// diventasse grande **e** la si leggesse senza filtro, quel conteggio si
// sentirebbe — e sarebbe comunque il momento in cui serve saperlo.
//
// ⚠️ COSA NON COPRE, ed è dichiarato invece che scoperto:
//   · le **Edge Function** (`posta-leggi`, `assistente-archivio`,
//     `documento-leggi`, `operazioni-atomiche`), che leggono con una loro
//     chiave e non passano di qui;
//   · le **letture annidate** (`select("*, righe(*)")`), che possono essere
//     tagliate **nelle righe figlie** senza che il totale delle righe padre
//     lo mostri. È la forma più silenziosa, e nessuno l'ha ancora misurata.
const OGGETTO_SOLO = "pgrst.object";

function bersaglio(url) {
  const dopo = url.split("/rest/v1/")[1];
  if (!dopo) return "sconosciuto";
  const nudo = dopo.split("?")[0];
  return nudo.startsWith("rpc/") ? nudo.slice(4) : nudo;
}

async function fetchCheDenuncia(input, init) {
  const richiesta = new Request(input, init);
  const url = richiesta.url;

  // Si tocca SOLO una lettura di elenco: `GET` verso PostgREST, senza un
  // intervallo chiesto da chi chiama (chi scrive `.limit()` o `.range()` sa
  // già quante righe vuole) e senza la forma «una riga sola».
  //
  // 🔴 E L'INTERVALLO SI CERCA NELL'INDIRIZZO, non solo nelle intestazioni:
  // `.limit()` viaggia come parametro `limit=` nell'indirizzo, non come
  // intestazione `Range`. Guardando solo l'intestazione, **ogni lettura
  // limitata apposta veniva denunciata come tagliata** — un allarme falso
  // permanente, cioè un allarme che si impara a spegnere. Trovato dalla
  // prova, non rileggendo.
  const parametri = new URL(url).searchParams;
  const elenco =
    richiesta.method === "GET" &&
    url.includes("/rest/v1/") &&
    !richiesta.headers.get("Range") &&
    !parametri.has("limit") &&
    !parametri.has("offset") &&
    !(richiesta.headers.get("Accept") || "").includes(OGGETTO_SOLO);

  if (!elenco) return fetch(richiesta);

  const intestazioni = new Headers(richiesta.headers);
  const preferenze = intestazioni.get("Prefer");
  if (!/count=/.test(preferenze ?? "")) {
    intestazioni.set("Prefer", [preferenze, "count=exact"].filter(Boolean).join(","));
  }

  const risposta = await fetch(new Request(richiesta, { headers: intestazioni }));

  // `Content-Range` ha la forma `0-999/1930`, oppure `*/0` su un elenco
  // vuoto. Se il totale non è un numero non si conclude niente: **non
  // sapere non è sapere che andava bene**, ma nemmeno un allarme.
  const intervallo = risposta.headers.get("content-range");
  const m = /^(\d+)-(\d+)\/(\d+)$/.exec(intervallo ?? "");
  if (m) {
    const ricevute = Number(m[2]) - Number(m[1]) + 1;
    const totali = Number(m[3]);
    if (ricevute < totali) segnalaLetturaTagliata(bersaglio(url), ricevute, totali);
  }
  return risposta;
}

if (!supabaseUrl || !supabaseAnonKey) {
  // In sviluppo: se manca la configurazione, lo diciamo chiaramente in console.
  console.warn(
    "Configurazione Supabase mancante. Imposta VITE_SUPABASE_URL e " +
      "VITE_SUPABASE_ANON_KEY nel file .env.local (vedi .env.example)."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { fetch: fetchCheDenuncia },
});

// Il varco pubblico (/prenota) parla SEMPRE da anonimo, anche se in quel
// browser il gestionale è aperto e loggato.
//
// Perché serve un secondo collegamento (trovato dal vivo il 09/08/2026,
// Alessio non riusciva a inviare dal proprio form): il collegamento qui
// sopra allega la sessione di chi è dentro, e la funzione delle richieste
// pubbliche è concessa al solo ruolo anonimo. Risultato: chiunque avesse
// il gestionale aperto — il titolare, un tablet di sala che mostra il
// link a un cliente al telefono — riceveva un rifiuto secco.
//
// La cura giusta non è allargare il permesso (il varco pubblico deve
// restare l'unica porta del ruolo anonimo, §6 del CLAUDE.md) ma far sì
// che una pagina pubblica si comporti da pubblica per tutti. Senza
// sessione salvata: nessun token da allegare, nessuna eccezione.
export const supabasePubblico = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    storageKey: "borgo58-pubblico",
  },
});
