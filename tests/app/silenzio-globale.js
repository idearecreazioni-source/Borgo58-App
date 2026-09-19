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

import { leggiChiaviDiProva } from "../../scripts/chiavi.mjs";

export const MINUTI = 60;
export const MOTIVO = "npm run test:app — prove automatiche";

export default async function setup() {
  // Il processo principale non riceve `test.env` della configurazione:
  // le chiavi si caricano qui, come fa la configurazione per le prove.
  Object.assign(process.env, leggiChiaviDiProva());
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
