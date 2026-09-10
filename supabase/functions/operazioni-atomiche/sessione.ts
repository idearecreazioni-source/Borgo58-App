// =====================================================================
// COSA DIRE QUANDO LA VERIFICA DELL'UTENTE NON RIESCE — 10/09/2026
// =====================================================================
// 🔴 IL FATTO, misurato. Il 10/09 alle 13:50 UTC una prova sul progetto di
//    prova ha ricevuto dal corridoio «Sessione non valida: rifare
//    l'accesso». La sessione dello staff era VALIDA: esiste ancora oggi, il
//    suo token di rinnovo non è revocato, e in tutta la giornata non c'è
//    nessun logout né nessuna revoca nel registro degli accessi. La chiamata
//    è durata 5,2 secondi, contro 0,3-0,9 delle altre 300 misurate.
//
//    Il corridoio trasformava QUALUNQUE errore della verifica in «sessione
//    non valida», compreso un servizio di accesso che non risponde. Chi
//    lavora in sala avrebbe letto «rifai l'accesso» per un guasto passeggero
//    — e rifare l'accesso non avrebbe curato niente.
//
// ⚠️ LA REGOLA, e sta qui perché si prova senza rete:
//    · il servizio di accesso ha RESPINTO il gettone (400/401/403/404, o
//      manca la sessione) → 401, «Sessione non valida: rifare l'accesso»;
//    · il servizio NON HA RISPOSTO in modo utile (rete, 408, 429, 5xx,
//      errore sconosciuto) → 503, e la frase dice che non si è verificato
//      niente e non si è scritto niente.
//
// ⚠️ NON È UN RITENTATIVO e non allenta niente: una sessione davvero
//    scaduta o chiusa continua a essere respinta come prima. Cambia solo
//    che il gestionale non dà la colpa alla sessione quando non lo sa.
// =====================================================================

export type Esito = { stato: number; codice: string; messaggio: string };

export const SESSIONE_NON_VALIDA: Esito = {
  stato: 401,
  codice: "auth",
  messaggio: "Sessione non valida: rifare l'accesso",
};

export const ACCESSO_NON_RAGGIUNGIBILE: Esito = {
  stato: 503,
  codice: "auth_non_raggiungibile",
  messaggio:
    "Non sono riuscito a verificare l'accesso: il servizio non ha risposto. " +
    "NON è stato scritto niente. Riprova tra un momento.",
};

// Gli errori che vogliono dire «questo gettone non vale», per nome.
const RESPINTI_PER_NOME = new Set([
  "AuthSessionMissingError",
  "AuthInvalidJwtError",
  "AuthInvalidTokenResponseError",
]);

type ErroreAccesso = { name?: string; status?: number } | null | undefined;

/**
 * `null` se la verifica è riuscita; altrimenti cosa rispondere.
 *
 * @param errore l'errore restituito da `auth.getUser()`, se c'è
 * @param utente l'utente restituito, se c'è
 */
export function esitoVerificaUtente(errore: ErroreAccesso, utente: unknown): Esito | null {
  if (!errore) return utente ? null : SESSIONE_NON_VALIDA;
  if (errore.name && RESPINTI_PER_NOME.has(errore.name)) return SESSIONE_NON_VALIDA;
  const stato = typeof errore.status === "number" ? errore.status : 0;
  if (stato === 400 || stato === 401 || stato === 403 || stato === 404) return SESSIONE_NON_VALIDA;
  return ACCESSO_NON_RAGGIUNGIBILE;
}
