import { createClient } from "@supabase/supabase-js";
import { conFraseTradotta, fraseDelRifiuto, vincoloNelCorpo } from "./calcoli/vincoli";
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
//   · 🔴 le **Edge Function** (`posta-leggi`, `assistente-archivio`,
//     `documento-leggi`, `operazioni-atomiche`), che leggono con una loro
//     chiave e non passano di qui. Dal 20/08 ci nasce dentro anche del
//     lavoro **nuovo** — `duplica_ricetta` — e la zona d'ombra smette di
//     essere solo un'eredità.
//
//     ⚠️ Come per le letture annidate, la cosa utile non è «non può
//     succedere» ma **da cosa dipende**. Oggi non morde perché le letture
//     che quelle funzioni fanno sono **piccole per costruzione**: una
//     selezione non ha mille bocconcini, una mail non ha mille allegati,
//     una copia legge le righe di UNA ricetta. La risposta cambia il giorno
//     in cui una funzione online legge **una tabella che cresce nel tempo**
//     — l'archivio documenti intero, lo storico dei prezzi, un registro —
//     e quel giorno tornerebbe più corta **senza dirlo a nessuno**, perché
//     lì dentro questo confronto non c'è.
//
//     ⚠️ Quindi la domanda da farsi scrivendo una funzione online nuova è
//     la stessa delle letture annidate: **questa lettura può tornare più
//     corta senza dirlo?** Se sì, o si chiede `count=exact` e si confronta
//     lì dentro, o si dichiara il taglio a chi legge il risultato.
//   · 🔴 le **letture annidate** (`select("*, righe(*)")`), MISURATE la notte
//     del 19/08: **questo confronto non le vede**. `Content-Range` porta un
//     totale solo — quello delle righe PADRE — quindi un conto che arriva con
//     mille righe su milleduecento passa di qui senza che niente lo dica.
//     ⚠️ E il tetto è **per riga padre, non per interrogazione**: misurato,
//     nella stessa richiesta un conto ha ricevuto 1000 righe e un altro le
//     sue 5. Delle sette letture annidate dell'app, oggi nessuna può
//     arrivarci.
//
//     🔴 MA QUEL «NON PUÒ SUCCEDERE» NON È UNA PROPRIETÀ DEL PROGRAMMA — è
//     una proprietà del LOCALE, e va letta sapendo cosa la farebbe cadere.
//     Nessun vincolo impedisce a un conto di avere mille righe: lo impedisce
//     un'osteria da 34 coperti. La risposta cambia il giorno in cui una
//     lettura annidata **nuova** pesca da una tabella che cresce nel tempo —
//     lo storico prezzi di un ingrediente, le voci di un registro HACCP, le
//     fatture di un fornitore. Quel giorno il difetto è **già lì e muto**, e
//     nessuno lo scoprirà da un errore: questo confronto non lo vede.
//
//     ⚠️ Quindi la domanda da farsi scrivendo una lettura annidata nuova non
//     è «capiterà mai mille righe?» ma «**questa tabella figlia cresce col
//     tempo sotto un solo padre?**». Se la risposta è sì, il tetto è già
//     armato. Per le righe figlie il trucco del conteggio non esiste: si può
//     solo sospettare da una lista di **esattamente** mille elementi e
//     chiedere conferma al database — non costruito (19/08, decisione di
//     Alessio: una protezione per un caso irraggiungibile è un avviso che
//     non scatta mai, e un avviso che non scatta mai nessuno sa
//     interpretarlo il giorno che scatta).
const OGGETTO_SOLO = "pgrst.object";

function bersaglio(url) {
  const dopo = url.split("/rest/v1/")[1];
  if (!dopo) return "sconosciuto";
  const nudo = dopo.split("?")[0];
  return nudo.startsWith("rpc/") ? nudo.slice(4) : nudo;
}

// =====================================================================
// UN RIFIUTO SI LEGGE IN ITALIANO
// =====================================================================
// 🔴 Le reti sui numeri assurdi (24/08/2026) fermano il dato — che è il
// punto — ma la frase che arriva a chi sta lavorando è quella di Postgres:
// «violates check constraint "scenario_frazioni_sono_frazioni"». Misurato
// dal browser chiamando l'operazione vera, non dedotto.
//
// ⚠️ UNA REGOLA SOLA, deciso da Alessio: la traduzione sta **qui**, nel
// punto unico da cui passa ogni richiesta del gestionale — letture,
// scritture dirette e funzioni online insieme — e non in ogni schermata
// che mostra un errore. *«Due regole per lo stesso limite significa che un
// giorno una cambia e l'altra no, ed è esattamente così che nascono le
// frasi diventate false.»*
//
// ⚠️ LA SPIEGAZIONE SI CHIEDE AL DATABASE, e non è una copia in più: sono
// i `comment on constraint` che ogni vincolo di questo progetto ha già,
// scritti accanto alla regola che spiegano. Copiarli qui vorrebbe dire
// tenerli allineati a mano — cioè il difetto che si sta chiudendo.
//
// ⚠️ E SI CHIEDE SOLO QUANDO SERVE. Il caso è raro (un rifiuto), quindi
// una richiesta in più non pesa; e non può essere ricorsiva, perché
// leggere una spiegazione non viola nessun vincolo. Se quella richiesta
// fallisce, si tiene il messaggio originale: **mai peggiorare un errore
// cercando di spiegarlo**.
const spiegazioni = new Map();

async function spiegazioneDelVincolo(nome, autorizzazione) {
  if (spiegazioni.has(nome)) return spiegazioni.get(nome);
  try {
    const r = await fetch(`${supabaseUrl}/rest/v1/rpc/spiega_vincolo`, {
      method: "POST",
      headers: {
        apikey: supabaseAnonKey,
        // 🔴 IL TOKEN DI CHI HA APPENA RICEVUTO IL RIFIUTO, non la chiave
        // pubblica. Trovato provando, non rileggendo: con la chiave
        // pubblica la spiegazione tornava vuota e a schermo restava la
        // frase generica — cioe' il portiere messo a questa funzione la
        // rendeva muta proprio nel momento in cui serviva.
        Authorization: autorizzazione || `Bearer ${supabaseAnonKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_nome: nome }),
    });
    const testo = r.ok ? await r.json() : null;
    const frase = typeof testo === "string" && testo.trim() ? testo : null;
    spiegazioni.set(nome, frase);
    return frase;
  } catch {
    return null;
  }
}

// Riscrive il corpo di una risposta di rifiuto mettendoci la frase
// italiana, **dovunque il messaggio si trovi**.
//
// 🔴 E LE FORME SONO DUE, misurate il 24/08 e non dedotte: PostgREST
// risponde `{ code, message, … }`, il corridoio risponde
// `{ errore: { codice, messaggio } }`. Guardando solo `message`, metà
// dei rifiuti sarebbe rimasta in inglese — e sarebbe la metà che riguarda
// le scritture che toccano più tabelle, cioè quelle importanti.
async function conFraseItaliana(risposta, autorizzazione) {
  let corpo;
  try {
    corpo = await risposta.clone().json();
  } catch {
    return risposta;
  }
  const nome = vincoloNelCorpo(corpo);
  if (!nome) return risposta;

  const frase = await spiegazioneDelVincolo(nome, autorizzazione);
  const tradotto = conFraseTradotta(corpo, nome, fraseDelRifiuto(frase, nome));
  const nuovoCorpo = JSON.stringify({
    ...tradotto,
    // 🔴 L'originale non si butta: chi deve indagare deve ancora poterlo
    // leggere, e una traduzione che cancella la fonte è una traduzione di
    // cui non ci si può fidare.
    vincolo: nome,
  });
  return new Response(nuovoCorpo, {
    status: risposta.status,
    statusText: risposta.statusText,
    headers: risposta.headers,
  });
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

  // ⚠️ Tutto quello che non è una lettura di elenco — cioè ogni
  // scrittura, ogni RPC e ogni chiamata alle funzioni online — passa
  // comunque da qui, ed è per questo che la traduzione vive in questo
  // punto e non altrove.
  if (!elenco) {
    const risposta = await fetch(richiesta);
    return risposta.ok ? risposta : conFraseItaliana(risposta, richiesta.headers.get("Authorization"));
  }

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
  return risposta.ok ? risposta : conFraseItaliana(risposta, richiesta.headers.get("Authorization"));
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
