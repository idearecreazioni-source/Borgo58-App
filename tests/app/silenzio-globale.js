// UN GIRO DI PROVE SUL DATABASE NON SUONA IL TELEFONO (19/09/2026).
//
// Prima di tutte le prove si apre un silenzio a tempo sulle notifiche
// Telegram di Borgo58-Prova; alla fine si chiude, e solo il proprio (due
// giri sovrapposti non si riaccendono il telefono a vicenda). Il perche' e
// le regole stanno nella migrazione 20260919000001.
//
// ⚠️ SE NON SI RIESCE A ZITTIRE, LE PROVE PARTONO LO STESSO, MA LO DICONO:
//    le prove riguardano il gestionale, non il telefono. Il caso normale
//    finche' la migrazione non e' applicata su Prova.
// ⚠️ Un giro che muore a meta' non chiude il silenzio: scade da se' dopo
//    `MINUTI`, che sta sopra il tetto dei 40 minuti di `npm run test:app`.

import { existsSync } from "node:fs";

import { INDIRIZZO_PROVA, leggiChiaviDiProva } from "../../scripts/chiavi.mjs";

export const MINUTI = 60;
export const MOTIVO = "npm run test:app — prove automatiche";

/**
 * Le chiavi del progetto di prova, con la stessa precedenza che ha la
 * configurazione — e non quella che si otterrebbe qui.
 *
 * 🔴 PERCHE' NON BASTA CHIAMARE `leggiChiaviDiProva()` (19/09/2026, misurato).
 *    La configurazione la chiama quando l'ambiente e' ancora pulito; QUI no:
 *    prima di arrivare a questo passo, Vitest ha gia' caricato `.env` dentro
 *    `process.env`, e in quel file le caselle `VITE_*` sono quelle del LOCALE
 *    VERO (le usa il gestionale di tutti i giorni). Siccome l'ambiente ha la
 *    precedenza sul file, il silenzio si apriva verso il progetto sbagliato —
 *    e si e' fermato da se' con «l'indirizzo e' il progetto del LOCALE VERO»,
 *    lasciando partire un messaggio «TEST PROVA» che doveva restare zitto.
 *
 * ⚠️ Quando il file c'e', le due caselle `VITE_*` dell'ambiente si IGNORANO,
 *    cosi' vincono `PROVA_SUPABASE_URL` e `PROVA_SUPABASE_ANON_KEY` del file.
 *    Su GitHub il file non esiste e l'ambiente resta l'unica fonte, come
 *    prima. ⚠️ Le due caselle si tolgono INSIEME: indirizzo di un progetto e
 *    chiave di un altro danno «Invalid API key», che somiglia a un guasto.
 */
function chiaviDelProgettoDiProva() {
  const ambiente = { ...process.env };
  if (existsSync(".env")) {
    delete ambiente.VITE_SUPABASE_URL;
    delete ambiente.VITE_SUPABASE_ANON_KEY;
  }
  return leggiChiaviDiProva(ambiente);
}

export default async function setup() {
  // Il processo principale non riceve `test.env` della configurazione:
  // le chiavi si caricano qui, come fa la configurazione per le prove.
  const chiavi = chiaviDelProgettoDiProva();
  // ⚠️ E si controlla PRIMA di collegarsi: un silenzio aperto sul database
  //    sbagliato non zittisce niente e scrive dove non deve.
  if (chiavi.VITE_SUPABASE_URL !== INDIRIZZO_PROVA) {
    console.warn(
      "⚠️  NON ho potuto zittire le notifiche: l'indirizzo che risulta non è quello " +
        "del progetto di prova. Questo giro puo' mandare messaggi «TEST PROVA» veri."
    );
    return () => {};
  }
  Object.assign(process.env, chiavi);
  const { clientAutenticato, credenziali } = await import("./aiuto.js");

  let client = null;
  let id = null;
  try {
    client = await clientAutenticato(credenziali().titolare);
    const { data, error } = await client.rpc("apri_silenzio_notifiche", {
      p_minuti: MINUTI,
      p_motivo: MOTIVO,
    });
    if (error) throw new Error(error.message);
    id = data;
    console.log("Notifiche Telegram di Prova zittite per questo giro di prove.");
  } catch (e) {
    console.warn(
      "⚠️  NON ho potuto zittire le notifiche Telegram di Prova: questo giro puo' " +
        `mandare messaggi «TEST PROVA» veri. Motivo: ${e instanceof Error ? e.message : "sconosciuto"}`
    );
  }

  return async () => {
    if (client && id) {
      const { error } = await client.rpc("chiudi_silenzio_notifiche", { p_id: id });
      if (error) {
        console.warn(`⚠️  Il silenzio non si e' chiuso (scadra' da se' fra ${MINUTI} minuti): ${error.message}`);
      }
    }
    await client?.auth.signOut({ scope: "local" });
  };
}
