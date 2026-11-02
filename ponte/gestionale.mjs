// COME IL PONTE PARLA COL GESTIONALE — 28/10/2026.
//
// Tre chiamate e nient'altro, le tre porte aperte dalla migrazione
// 20261028000005: `ponte_battito`, `ponte_prendi_lavori`,
// `ponte_esito_lavoro`. Si entra con la chiave pubblica del progetto
// (quella che ha anche il sito) più la chiave del ponte. Il ponte non ha
// l'accesso di Alessio, e non ne ha bisogno.
//
// ⚠️ LA CHIAVE DEL PONTE NON FINISCE MAI NEI MESSAGGI: un errore che la
//    ripetesse la scriverebbe nel registro del mini-PC.

const ATTESA_MS = 15000;

export function gestionale({ indirizzo, chiavePubblica, chiavePonte }) {
  if (!indirizzo || !chiavePubblica || !chiavePonte) {
    throw new Error("Mancano l'indirizzo del gestionale, la chiave pubblica o la chiave del ponte nella configurazione.");
  }
  const base = indirizzo.replace(/\/+$/, "");

  async function chiama(funzione, argomenti) {
    const ferma = new AbortController();
    const orologio = setTimeout(() => ferma.abort(), ATTESA_MS);
    try {
      const r = await fetch(`${base}/rest/v1/rpc/${funzione}`, {
        method: "POST",
        headers: {
          apikey: chiavePubblica,
          Authorization: `Bearer ${chiavePubblica}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ p_chiave: chiavePonte, ...argomenti }),
        signal: ferma.signal,
        redirect: "error",
      });
      const testo = await r.text();
      let dati = null;
      try {
        dati = testo ? JSON.parse(testo) : null;
      } catch {
        // Una pagina d'errore del server (502 di una rete che cade) non è
        // JSON: conta il codice, non il testo.
        if (r.ok) throw new Error(`Il gestionale ha risposto qualcosa che non capisco a ${funzione}.`);
      }
      if (!r.ok) {
        const messaggio = String(dati?.message ?? `risposta ${r.status}`).replaceAll(chiavePonte, "«chiave»");
        const errore = new Error(`Il gestionale ha risposto di no a ${funzione}: ${messaggio}`);
        errore.status = r.status;
        throw errore;
      }
      return dati;
    } catch (e) {
      if (e.name === "AbortError") throw new Error(`Il gestionale non ha risposto in tempo a ${funzione}.`);
      throw e;
    } finally {
      clearTimeout(orologio);
    }
  }

  return {
    battito: (versione, host) => chiama("ponte_battito", { p_versione: versione, p_host: host }),
    prendiLavori: (limite = 5) => chiama("ponte_prendi_lavori", { p_limite: limite }),
    esito: (id, e) =>
      chiama("ponte_esito_lavoro", {
        p_id: id,
        p_stato: e.stato,
        p_errore_codice: e.errore_codice,
        p_errore_testo: e.errore_testo,
        p_stato_dispositivo: e.stato_dispositivo,
        p_esito: e.esito,
      }),
  };
}
