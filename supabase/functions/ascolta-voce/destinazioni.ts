// =====================================================================
// IN QUALE DELLE DUE LISTE VA QUESTA COSA
// =====================================================================
// 🔴 IL GESTIONALE HA DUE LISTE, e non si somigliano:
//    · la **Lista della spesa** nasce dalle soglie del magazzino e finisce
//      in un ordine a un fornitore;
//    · la **Spesa spicciola** è quello che Alessio compra di persona al
//      supermercato: non tocca giacenze, non ordina, non scrive costi.
//    Esistono separate nel gestionale dal 23/08/2026. Quello che mancava
//    era che MEMO sapesse distinguerle: è SPEC-0012.
//
// 🔴 COME ERA PRIMA, e perché è stato fatto così (06/09/2026). Alessio
//    dettava *«segna il pesce spada nella spesa spicciola»* e MEMO
//    proponeva **«Aggiungi alla spesa»** — la lista sbagliata — con
//    l'appunto **eseguibile**, quindi con «Approva» sotto. Un tocco per
//    sbaglio, ed è successo, scriveva nella lista dei fornitori.
//    La cura di quel giorno fu rendere l'appunto NON eseguibile e dirlo.
//    Adesso quella lista esiste per la voce, e l'appunto si può approvare.
//
// ⚠️ LA DESTINAZIONE SI LEGGE DA UN FATTO DICHIARATO, non dalle parole del
//    dettato: `dati.lista`, che il modello riempie col nome della lista
//    quando ne è stata nominata una. Cercare «spicciola» dentro la frase
//    sarebbe un elenco che invecchia al primo sinonimo — e soprattutto
//    sarebbe una seconda interpretazione, dopo quella del modello.
//
// ⚠️ E QUI, NON SOLO NEL PROMPT: il prompt va corretto e lo è, ma **un
//    modello non è una garanzia**. Questa regola è deterministica e si
//    prova senza chiamare nessuno.
//
// 🔴 SE LA LISTA NON È STATA DETTA, NON SE NE SCEGLIE UNA. È il criterio
//    di SPEC-0012: *«se la destinazione manca o è ambigua, MEMO la chiede
//    o la dichiara non capita; non usa automaticamente la Lista della
//    spesa»*. Prima di oggi il silenzio valeva «lista della spesa»: con
//    una lista sola era una scorciatoia innocua, con due è una scelta
//    fatta al posto suo — e la scelta sbagliata si vede solo dopo, quando
//    la roba è nella lista che va al fornitore.

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

// I modi di dire «quella normale»: chi li usa sta dicendo la lista che il
// gestionale ha sempre avuto, quella dei fornitori.
//
// ⚠️ SONO ELENCHI DI PAROLE ITALIANE, e in questo progetto è una forma che
//    invecchia. Reggono perché sbagliano nel verso INNOCUO: un modo di dire
//    che manca non manda la roba nell'altra lista — la lascia in un appunto
//    che non si può approvare e che dice perché. Il verso pericoloso — una
//    lista scambiata per l'altra — non dipende da queste righe, perché
//    ciascuna delle due è riconosciuta dalle sue.
const SOLITE = new Set([
  "spesa",
  "la spesa",
  "lista spesa",
  "la lista spesa",
  "lista della spesa",
  "la lista della spesa",
]);

// I modi di dire della spesa che si fa di persona al supermercato.
const SPICCIOLE = new Set([
  "spicciola",
  "la spicciola",
  "spesa spicciola",
  "la spesa spicciola",
  "lista spicciola",
  "lista della spesa spicciola",
  "la lista della spesa spicciola",
]);

/** Il tipo d'azione della Spesa spicciola: esiste nel catalogo del database. */
export const TIPO_SPICCIOLA = "spesa_spicciola";

/** Il tipo della Lista della spesa, quella che finisce in un ordine. */
export const TIPO_LISTA = "lista_spesa";

/**
 * QUANDO LA LISTA NON È STATA DETTA.
 *
 * 🔴 Non è un tipo del catalogo, quindi l'appunto **non si può approvare**:
 * è la stessa forma con cui si trattano le liste che non esistono. La
 * differenza è cosa c'è scritto dentro — qui manca un'informazione che
 * Alessio ha, non una funzione che il gestionale non ha.
 */
export const TIPO_LISTA_NON_DETTA = "lista_non_detta";

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
 * IL NOME DELLA LISTA CHE È STATA DETTA, così come l'ha detto lui.
 *
 * Vuoto se non ne ha nominata nessuna. ⚠️ Qui NON si giudica quale delle
 * due sia: questa funzione riporta un fatto, la scelta la fa `versoLaLista`.
 */
export function nomeDellaLista(azione: AzioneDettata): string | null {
  const grezzo = azione?.dati?.lista;
  if (typeof grezzo !== "string") return null;
  const nome = grezzo.trim();
  return nome === "" ? null : nome;
}

/**
 * Il nome di una lista **diversa dalle due che il gestionale ha**.
 *
 * ⚠️ Resta esportata con questo nome perché è la domanda che si fa il
 * chiamante quando vuole sapere se c'è una lista che non sappiamo servire.
 */
export function listaNominata(azione: AzioneDettata): string | null {
  const nome = nomeDellaLista(azione);
  if (nome === null) return null;
  const piano = senzaAccenti(nome);
  if (SOLITE.has(piano) || SPICCIOLE.has(piano)) return null;
  return nome;
}

/** Dove porta quello che è stato detto: una delle due, un'altra, o niente. */
export type Verso = "spesa" | "spicciola" | "altra" | "non_detta";

/**
 * IN QUALE LISTA VA, letto dal nome dichiarato.
 *
 * ⚠️ «non_detta» non è un difetto del modello: è che Alessio non l'ha
 * detto. Le due cose si curano in modi diversi — la prima si aggiusta nel
 * prompt, la seconda chiedendoglielo.
 */
export function versoLaLista(azione: AzioneDettata): Verso {
  const nome = nomeDellaLista(azione);
  if (nome === null) return "non_detta";
  const piano = senzaAccenti(nome);
  if (SOLITE.has(piano)) return "spesa";
  if (SPICCIOLE.has(piano)) return "spicciola";
  return "altra";
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
 * LA DESTINAZIONE DI UNA RIGA DI LISTA, decisa dal nome dichiarato.
 *
 * Quattro esiti, e nessuno di loro sceglie in silenzio:
 *  · **la spesa** → resta `lista_spesa`, come sempre;
 *  · **la spicciola** → diventa `spesa_spicciola`, che il gestionale sa
 *    scrivere dal 07/09/2026 (SPEC-0012);
 *  · **un'altra** → appunto non approvabile, col nome che ha usato;
 *  · **non detta** → appunto non approvabile che glielo CHIEDE.
 *
 * ⚠️ VALE NEI DUE VERSI, ed è la parte che protegge di più: se il modello
 * proponesse `spesa_spicciola` per una frase che nomina la lista della
 * spesa, il nome dichiarato vince lo stesso. Il modello propone, il nome
 * detto decide.
 */
export function destinazioneDellaLista(azione: AzioneDettata): AzioneDettata {
  if (azione?.tipo !== TIPO_LISTA && azione?.tipo !== TIPO_SPICCIOLA) return azione;

  switch (versoLaLista(azione)) {
    case "spesa":
      return { ...azione, tipo: TIPO_LISTA, destinazione: "Aggiungi alla lista della spesa" };

    case "spicciola":
      return { ...azione, tipo: TIPO_SPICCIOLA, destinazione: "Aggiungi alla spesa spicciola" };

    case "altra": {
      const nome = nomeDellaLista(azione) as string;
      return {
        ...azione,
        tipo: tipoLibero(nome),
        destinazione: `Aggiungi a «${nome}»`,
        // 🔴 NON è «non ero sicuro»: MEMO ha capito. È il gestionale che non
        //    ha quella lista. Le due cose si curano in modi diversi, e dirle
        //    uguale manderebbe a cercare un errore di ascolto che non c'è.
        sicuro: true,
        motivo:
          `Hai detto «${nome}», che non è nessuna delle due liste che ho: ` +
          `la lista della spesa e la spesa spicciola. L'appunto resta qui.`,
      };
    }

    // 🔴 IL SILENZIO NON VALE PIÙ «LISTA DELLA SPESA» — SPEC-0012.
    //    Con una lista sola era una scorciatoia innocua; con due è una
    //    scelta fatta al posto suo, e quella sbagliata si scopre quando la
    //    roba è già nella lista che va al fornitore.
    default:
      return {
        ...azione,
        tipo: TIPO_LISTA_NON_DETTA,
        destinazione: "Quale delle due liste?",
        sicuro: true,
        motivo:
          "Non hai detto in quale lista: dimmelo e la scrivo — «alla lista " +
          "della spesa» oppure «alla spesa spicciola».",
      };
  }
}

/**
 * ⚠️ IL NOME VECCHIO, tenuto perché chi chiama non deve cambiare due volte.
 * Fino al 07/09/2026 questa regola sapeva dire una cosa sola: «questa lista
 * non esiste». Adesso ne sa dire quattro.
 */
export const senzaListeCheNonEsistono = destinazioneDellaLista;

/** La stessa regola su tutta la filza. */
export function correggiDestinazioni(azioni: AzioneDettata[]): AzioneDettata[] {
  return (azioni ?? []).map(destinazioneDellaLista);
}
