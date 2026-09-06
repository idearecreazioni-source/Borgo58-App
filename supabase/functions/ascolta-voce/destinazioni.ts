// =====================================================================
// QUANDO IL NOME DI UNA LISTA NON È UNA LISTA CHE ESISTE
// =====================================================================
// 🔴 IL DIFETTO, dal vivo il 06/09/2026. Alessio detta *«segna il pesce
//    spada nella spesa spicciola»*, e MEMO propone **«Aggiungi alla
//    spesa»** — cioè la lista della spesa, che è un'altra cosa. La spesa
//    spicciola è la Tasca (SPEC-0005, SPEC-0009); le liste distinte sono
//    SPEC-0012, e **non è implementata**.
//
// ⚠️ NON ERA UN ERRORE DI ASCOLTO: MEMO aveva capito benissimo, e l'aveva
//    pure scritto — nei dati c'era `note: "spesa spicciola"`. Il difetto è
//    che l'ha **ricondotto** alla cosa più vicina che il gestionale sa
//    fare, che è precisamente ciò che SPEC-0013 vieta.
//
// 🔴 E LA CONSEGUENZA ERA LA PEGGIORE POSSIBILE: l'appunto risultava
//    **eseguibile**, quindi mostrava «Approva». Un tocco per sbaglio — ed è
//    successo — avrebbe scritto il pesce spada nella lista della spesa
//    normale. Senza nessun errore, e con l'aria di aver fatto la cosa
//    giusta.
//
// ⚠️ PERCHÉ QUI E NON SOLO NEL PROMPT. Il prompt si corregge, e va
//    corretto — ma un modello non è una garanzia: la volta dopo può
//    ricondurre lo stesso. Questa regola è **deterministica**: se il
//    modello dichiara che è stata nominata una lista precisa, il gestionale
//    sa di non averla e non offre di scriverci dentro.
//
// ⚠️ E NON SI INDOVINA DALLE PAROLE DEL DETTATO. Cercare «spicciola» nel
//    testo sarebbe un elenco che invecchia al primo sinonimo. Si guarda un
//    **fatto dichiarato**: `dati.lista`, che il modello riempie col nome
//    della lista quando ne è stata nominata una.

export type AzioneDettata = {
  tipo: string;
  destinazione?: string | null;
  sicuro?: boolean;
  motivo?: string | null;
  frase?: string;
  alternative?: { destinazione: string; perche: string }[] | null;
  dati?: Record<string, unknown>;
};

// 🔴 IL PREFISSO NON PUÒ COLLIDERE COL NOME DI UN GESTO VERO, e il perché è
//    misurato: la prima stesura faceva `lista_` + il nome, quindi
//    `dati.lista = "spesa"` produceva **`lista_spesa`** — cioè esattamente
//    il tipo eseguibile che questa regola esiste per evitare. L'appunto
//    tornava approvabile, e la cura diventava il difetto.
//    ⚠️ L'ha trovato la revisione del diff, non una prova: nessuna delle
//    prove scritte quel giorno passava per la parola «spesa».
export const PREFISSO_LISTA_NOMINATA = "lista_nominata_";

// I modi di dire «quella normale»: chi li usa NON sta nominando una lista a
// parte, sta dicendo la lista che il gestionale ha già.
//
// ⚠️ È UN ELENCO DI PAROLE ITALIANE, e in questo progetto è una forma che
//    invecchia. Regge perché sbaglia nel verso INNOCUO: un modo di dire che
//    manca lascia l'appunto non eseguibile, cioè come se questa riga non ci
//    fosse. Il verso pericoloso — una lista a parte che diventa quella vera
//    — non dipende da questo elenco.
const SOLITE = new Set([
  "spesa",
  "la spesa",
  "lista spesa",
  "la lista spesa",
  "lista della spesa",
  "la lista della spesa",
]);

/** Minuscolo, senza accenti, con gli spazi normalizzati. */
function senzaAccenti(testo: string): string {
  return testo
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[\s]+/g, " ")
    .trim();
}

/**
 * Il nome della lista nominata, se ne è stata nominata una **a parte**.
 *
 * ⚠️ «la lista della spesa» non conta: è quella che il gestionale ha già, e
 * trattarla come separata bloccherebbe il gesto più frequente — il difetto
 * allo specchio, trovato dalla revisione.
 */
export function listaNominata(azione: AzioneDettata): string | null {
  const grezzo = azione?.dati?.lista;
  if (typeof grezzo !== "string") return null;
  const nome = grezzo.trim();
  if (nome === "") return null;
  if (SOLITE.has(senzaAccenti(nome))) return null;
  return nome;
}

/** Da un nome in italiano a un tipo che il gestionale non conosce. */
export function tipoLibero(nome: string): string {
  const pulito = senzaAccenti(nome)
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return PREFISSO_LISTA_NOMINATA + (pulito || "senza_nome");
}

/**
 * Se è stata nominata una lista precisa, la destinazione smette di essere
 * la lista della spesa e diventa un appunto **non eseguibile**.
 *
 * ⚠️ VALE FINCHÉ SPEC-0012 NON È IMPLEMENTATA, ed è la riga da togliere quel
 * giorno: quando le liste distinte esisteranno davvero, `lista_spesa` con un
 * nome dentro sarà una cosa che il gestionale sa fare.
 *
 * ⚠️ Quello che è stato capito NON si perde: il nome resta nei dati e nella
 * destinazione leggibile. *Un appunto che non si può eseguire è comunque un
 * promemoria; uno che ha perso il nome della lista non è niente.*
 *
 * 🔴 IL LIMITE, DICHIARATO: questa regola scatta solo se il modello ha
 * riempito `dati.lista`. Se davanti a una formulazione diversa lo lasciasse
 * vuoto, la destinazione resterebbe la lista della spesa — cioè il difetto di
 * partenza. Il prompt glielo chiede esplicitamente, ma **un prompt non è una
 * garanzia**: qui si copre il caso in cui il modello dichiara, non quello in
 * cui tace.
 */
export function senzaListeCheNonEsistono(azione: AzioneDettata): AzioneDettata {
  if (azione?.tipo !== "lista_spesa") return azione;
  const nome = listaNominata(azione);
  if (nome === null) return azione;

  return {
    ...azione,
    tipo: tipoLibero(nome),
    destinazione: `Aggiungi a «${nome}»`,
    // 🔴 NON è «non ero sicuro»: MEMO ha capito. È il gestionale che non ha
    //    quella lista. Le due cose si curano in modi diversi, e dirle uguale
    //    manderebbe a cercare un errore di ascolto che non c'è.
    sicuro: true,
    motivo:
      `Hai detto «${nome}», che è una lista a parte: il gestionale ne ha ancora ` +
      `una sola, quindi non ci posso scrivere dentro. L'appunto resta qui.`,
  };
}

/** La stessa regola su tutta la filza. */
export function correggiDestinazioni(azioni: AzioneDettata[]): AzioneDettata[] {
  return (azioni ?? []).map(senzaListeCheNonEsistono);
}
