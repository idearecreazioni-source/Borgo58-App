import { TESTO_MASSIMO, dataItaliana, etichettaFonte, etichettaSezione } from "./scheda";

// =====================================================================
// LE PROPOSTE DI MEMO PER LA SCHEDA — le regole pure della pagina (21/11/2026, pezzo B1)
// =====================================================================
// MEMO propone, il titolare decide: Sì, Non farlo, Correggi. Le proposte le
// calcola il database con regole fisse (fornitore nuovo, contratto nuovo, voce
// da riconfermare, voce da spegnere) e non costano niente.
//
// ⚠️ UNA PROPOSTA NON SCRIVE NIENTE DA SOLA. Qui si decide solo COME si
//    raccontano e quali gesti si offrono; la scrittura vera e i limiti
//    (60 voci, 10.000 caratteri, privacy) li fa il database.
// ⚠️ UNA PROPOSTA DI «AGGIUNGERE» NON HA ANCORA UN NUMERO [S#]: il numero
//    nasce quando la voce viene scritta. Non se ne mostra mai uno.
// ⚠️ UNA PROPOSTA NON ABBASSA LA FONTE IN SILENZIO: se la fonte scende, la
//    pagina lo dice e chiede una spunta prima del Sì.

const TIPI = {
  aggiungi: { etichetta: "Aggiungere alla Scheda", correggibile: true },
  modifica: { etichetta: "Aggiornare una voce", correggibile: true },
  spegni: { etichetta: "Spegnere una voce", correggibile: false },
  riconferma: { etichetta: "Riconfermare una voce", correggibile: false },
};

export const etichettaTipoProposta = (tipo) => TIPI[tipo]?.etichetta ?? "Proposta";

/** Correggi ha senso solo quando la proposta porta un testo nuovo. */
export const puoCorreggere = (proposta) => Boolean(TIPI[proposta?.tipo]?.correggibile);

/** Le più recenti in alto; a parità, in ordine di chiave: l'elenco non si rimescola da una lettura all'altra. */
export function ordinaProposte(proposte) {
  return [...(proposte ?? [])].sort(
    (a, b) => String(b.creata_il ?? "").localeCompare(String(a.creata_il ?? "")) || String(a.chiave).localeCompare(String(b.chiave))
  );
}

/** «Prima → Dopo» in parole, solo dove serve. */
export function dettaglioProposta(proposta) {
  const { tipo, testo_prima: prima, testo_dopo: dopo } = proposta ?? {};
  if (tipo === "aggiungi") return { prima: null, dopo, etichettaDopo: `Nuova voce in «${etichettaSezione(proposta.sezione)}»` };
  if (tipo === "modifica") return { prima, dopo, etichettaDopo: "Diventerebbe" };
  if (tipo === "spegni") return { prima, dopo: null, etichettaDopo: null };
  return { prima, dopo: null, etichettaDopo: null };
}

/** La frase che dice cosa cambia per la fonte, o null se non cambia o sale. */
export function avvisoFonte(proposta) {
  if (!proposta?.abbassa_fonte) return null;
  return `Attenzione: questa proposta abbassa la fonte da «${etichettaFonte(proposta.fonte_prima)}» a «${etichettaFonte(proposta.fonte_dopo)}».`;
}

/** Se la proposta alza la fonte (per esempio «Riferito» → «Confermato da te») lo si dice. */
export function frasePerLaFonte(proposta) {
  if (!proposta?.fonte_dopo) return null;
  if (proposta.fonte_prima && proposta.fonte_prima !== proposta.fonte_dopo && !proposta.abbassa_fonte) {
    return `La fonte diventa «${etichettaFonte(proposta.fonte_dopo)}».`;
  }
  if (!proposta.fonte_prima) return `Fonte: «${etichettaFonte(proposta.fonte_dopo)}».`;
  return null;
}

export const scadenzaProposta = (proposta) => (proposta?.scade_il ? `Si può decidere fino al ${dataItaliana(proposta.scade_il)}.` : null);

/** Il testo corretto a mano: il tetto è lo stesso del database. */
export const testoCorrettoValido = (testo) => {
  const pulito = String(testo ?? "").trim();
  return pulito.length > 0 && pulito.length <= TESTO_MASSIMO;
};

/** Una risposta di «decidi» che non è un Sì andato a buon fine, in parole semplici (null = tutto bene). */
export function messaggioDellaDecisione(risposta) {
  switch (risposta?.esito) {
    case "accettata":
    case "rifiutata":
      return null;
    case "obsoleta":
      return "La voce è cambiata nel frattempo: la proposta non vale più.";
    case "gia_decisa":
      return "Questa proposta era già stata decisa.";
    case "scaduta":
      return "Questa proposta è scaduta: MEMO la riproporrà se serve.";
    default:
      return "Non so com'è andata: ricarica la pagina e controlla.";
  }
}

/** Cosa dire quando non ci sono proposte; se alcune sono state tenute da parte per privacy, quante. */
export function fraseNessunaProposta(saltatePrivacy = 0) {
  const base = "MEMO non ha proposte oggi. Controlla i fornitori nuovi, i contratti nuovi e le voci da riconfermare.";
  const n = Number(saltatePrivacy) || 0;
  if (!n) return base;
  return n === 1
    ? `${base} Una possibile proposta è stata tenuta da parte perché conteneva dati personali, contatti o parole delicate.`
    : `${base} ${n} possibili proposte sono state tenute da parte perché contenevano dati personali, contatti o parole delicate.`;
}

// Le risposte di «decidi» che CHIUDONO la proposta (la tolgono dall'elenco). Ogni altra risposta (sconosciuta,
// vuota, di una versione futura) lascia la proposta dov'è e la pagina rilegge: il database è la fonte vera.
const ESITI_CHE_CHIUDONO = new Set(["accettata", "rifiutata", "obsoleta", "gia_decisa", "scaduta"]);
export const esitoChiudeLaProposta = (risposta) => ESITI_CHE_CHIUDONO.has(risposta?.esito);
