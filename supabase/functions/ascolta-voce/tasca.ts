// =====================================================================
// DI CHI ERANO I SOLDI — la tasca, l'anticipo, o non l'ha detto
// =====================================================================
// 🔴 SONO DUE COSE DIVERSE E SI SOMIGLIANO ABBASTANZA DA SCAMBIARSI, e lo
//    dice già il codice della schermata Cassa, dove i due pulsanti stanno
//    uno accanto all'altro:
//      · **La mia tasca** — contante di Alessio speso per il progetto.
//        Solo uscite, sempre «Indeducibile», fuori dalla proiezione
//        fiscale, e **non torna indietro**: non c'è niente da pareggiare
//        (decisione del 30/08, vincoli nel database).
//      · **Anticipo io, poi mi rimborso** — una spesa fatta **per conto
//        della società**, che la società gli pareggia (`anticipazioni_socio`).
//
// 🔴 QUALE DELLE DUE LO DECIDONO LE PAROLE, e quali parole lo ha deciso
//    Alessio il 07/09/2026, perché è una scelta sua e non si indovina:
//      1. «di tasca mia» vuol dire SEMPRE la tasca: uscita personale,
//         indeducibile, senza rimborso;
//      2. per l'altro caso userà parole esplicite — «ho anticipato», «da
//         rimborsare», «poi mi rimborso» — e quello va nelle anticipazioni;
//      3. se non nomina né l'una né l'altro, MEMO **non sceglie**: lascia un
//         appunto che non si può approvare e chiede quale dei due casi è;
//      4. se nella stessa frase ci sono tutt'e due, **prevale il rimborso**.
//
// ⚠️ IL PUNTO 4 È IL PIÙ IMPORTANTE, ed è il motivo per cui il rimborso si
//    guarda per primo: *non si registra mai come non rimborsabile una cosa
//    che lui ha detto di voler recuperare*. Sbagliando in quel verso, i
//    soldi non tornano e non se ne accorge nessuno — la riga è plausibile.
//
// ⚠️ SI GUARDA UN FATTO DICHIARATO — `dati.soldi`, dove il modello riporta
//    le parole di Alessio — e **soltanto quello**, quando c'è. Se non
//    dichiara niente si guarda il **dettato di Alessio**, come rete: senza,
//    una spesa personale resterebbe un movimento della cassa dell'osteria,
//    cioè il soggetto sbagliato in silenzio.
//
// 🔴 QUELLO CHE NON SI GUARDA MAI È IL RIASSUNTO DEL MODELLO, e il perché è
//    misurato (collaudo del 07/09/2026): a «ho pagato 30 euro di tasca mia
//    per il pane» il modello aveva dichiarato benissimo «di tasca mia», e
//    poi aveva scritto di suo *«Uscita di 30€ per il pane (anticipati di
//    tasca sua)»*. Leggendo anche quella riga, la parola «anticipati»
//    mandava la spesa fra le cose da farsi rimborsare — il contrario di
//    quello che lui aveva detto. *Un riassunto scritto da chi interpreta non
//    è una fonte: è già un'interpretazione.*

export type AzioneDettata = {
  tipo: string;
  destinazione?: string | null;
  sicuro?: boolean;
  motivo?: string | null;
  frase?: string;
  dati?: Record<string, unknown>;
};

/** Il tipo che scrive davvero nella tasca: esiste nel catalogo del database. */
export const TIPO_TASCA = "spesa_tasca";

/** Il movimento normale della cassa dell'osteria, come è sempre stato. */
export const TIPO_CASSA = "movimento_cassa";

/**
 * Le due strade che il gestionale NON percorre da sé.
 *
 * ⚠️ Non sono tipi del catalogo, quindi l'appunto **non si può approvare**:
 * è la stessa forma con cui si trattano le liste che non esistono, e la
 * differenza sta in cosa c'è scritto dentro.
 */
export const TIPO_DA_RIMBORSARE = "anticipazione_da_registrare";
export const TIPO_DI_CHI_SONO = "soldi_di_chi";

const rende = (t: string) =>
  t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// 🔴 IL RIMBORSO SI GUARDA PER PRIMO (regola 4). Sono le parole con cui
//    Alessio dice che quei soldi devono tornargli.
// 🔴 LE FORME NEGATE SI GUARDANO PER PRIME, altrimenti «senza rimborso» —
//    che vuol dire il CONTRARIO — inciamperebbe nella parola «rimborso» e
//    finirebbe fra le cose da farsi ridare. Era una contraddizione dentro
//    questi stessi elenchi: «senza rimborso» è scritta anche fra le parole
//    della tasca, e non ci sarebbe mai arrivata.
const NIENTE_RIMBORSO = [
  "senza rimborso",
  "nessun rimborso",
  "niente rimborso",
  "non mi rimborso",
  "non me li rimborso",
  "non chiedo rimborso",
];

const RIMBORSO = [
  "anticipato",
  "anticipo",
  "anticipati",
  "rimborso",
  "rimborsare",
  "rimborsato",
  "rimborsa",
  "rimborsi",
  "rimborsera",
  "me li ridate",
  "me li ridai",
  "da recuperare",
];

// Le parole della tasca: dicono di chi erano i soldi **e** che non tornano.
const TASCA = [
  "di tasca mia",
  "dalla tasca mia",
  "dalla mia tasca",
  "della mia tasca",
  "tasca mia",
  "mia tasca",
  "con la mia tasca",
  "senza rimborso",
  "spesa personale",
];

// ⚠️ QUESTE DICONO SOLO CHI HA PAGATO, NON SE TORNANO. «Con soldi miei» in
//    italiano non distingue i due casi — ed è precisamente il caso in cui
//    Alessio ha deciso che MEMO **chiede** invece di scegliere.
const SOLDI_PROPRI = [
  "soldi miei",
  "soldi mei",
  "con i miei soldi",
  "di mio",
  "li ho pagati io",
  "l ho pagato io",
  "li ho messi io",
  "ho messo io",
  "pagato io di persona",
];

const contiene = (testo: string, parole: string[]) =>
  parole.some((p) => testo.includes(rende(p)));

/** Che cosa ha detto sui soldi: le quattro risposte possibili. */
export type DiChi = "rimborso" | "tasca" | "propri_non_detto" | "non_ne_ha_parlato";

/**
 * DI CHI ERANO I SOLDI, letto da quello che ha detto.
 *
 * ⚠️ L'ORDINE È LA REGOLA 4: il rimborso vince, sempre. Se dice «l'ho
 * comprato di tasca mia, poi mi rimborso», quello che conta è che vuole
 * riavere i soldi.
 */
function leggi(testo: string): DiChi {
  const t = rende(testo);
  if (t === "") return "non_ne_ha_parlato";
  // 🔴 PRIMA LE NEGAZIONI: «senza rimborso» dice che quei soldi NON
  //    tornano, cioè esattamente la tasca.
  if (contiene(t, NIENTE_RIMBORSO)) return "tasca";
  // 🔴 POI IL RIMBORSO (regola 4): vince su «di tasca mia».
  if (contiene(t, RIMBORSO)) return "rimborso";
  if (contiene(t, TASCA)) return "tasca";
  if (contiene(t, SOLDI_PROPRI)) return "propri_non_detto";
  return "non_ne_ha_parlato";
}

/**
 * DI CHI ERANO I SOLDI, letto da quello che ha detto **lui**.
 *
 * 🔴 IL FATTO DICHIARATO DECIDE DA SOLO, e il perché è misurato (collaudo
 * del 07/09/2026). Alla frase «ho pagato 30 euro di tasca mia per il pane»
 * il modello aveva dichiarato benissimo `soldi: "di tasca mia"` — e poi
 * aveva scritto di suo il riassunto *«Uscita di 30€ per il pane (anticipati
 * di tasca sua)»*. Guardando anche quel riassunto, la parola «anticipati»
 * mandava la spesa fra le cose da farsi rimborsare: **il contrario di
 * quello che Alessio aveva detto**.
 *
 * ⚠️ QUINDI: se il modello dichiara, si guarda SOLO la sua dichiarazione.
 * Il dettato serve come rete per quando non dichiara niente — ed è il
 * dettato di Alessio, non la prosa del modello. *Un riassunto scritto da
 * chi interpreta non è una fonte: è già un'interpretazione.*
 *
 * ⚠️ L'ORDINE INTERNO È LA REGOLA 4: negazioni, poi rimborso, poi tasca.
 */
export function diChiSono(azione: AzioneDettata, dettato = ""): DiChi {
  const dichiarato = typeof azione?.dati?.soldi === "string" ? azione.dati.soldi.trim() : "";
  if (dichiarato !== "") return leggi(dichiarato);
  return leggi(typeof dettato === "string" ? dettato : "");
}

/** Che cosa manca perché una spesa della tasca si possa scrivere. */
export function cosaManca(azione: AzioneDettata): string[] {
  const dati = azione?.dati ?? {};
  const manca: string[] = [];

  const importo = Number(dati.importo);
  if (!Number.isFinite(importo) || importo <= 0) manca.push("quanto hai speso");

  const descrizione = typeof dati.descrizione === "string" ? dati.descrizione.trim() : "";
  if (descrizione === "") manca.push("per che cosa");

  return manca;
}

/**
 * 🔴 IL VERSO NON SI DISCUTE: dalla tasca escono soldi e basta.
 *
 * Un'entrata sarebbe denaro che il progetto restituisce ad Alessio — cioè un
 * pareggio, la cosa che la tasca per definizione non fa. Il database la
 * rifiuta già; qui si evita di **proporre** un gesto che verrebbe rifiutato,
 * e si dice perché.
 */
export function versoStorto(azione: AzioneDettata): boolean {
  const verso = azione?.dati?.verso;
  return typeof verso === "string" && rende(verso) !== "" && rende(verso) !== "uscita";
}

/**
 * DOVE VA QUESTA SPESA, e nessuna delle strade sceglie in silenzio.
 *
 * Cinque esiti:
 *  · **rimborso** → appunto non approvabile che manda alle anticipazioni;
 *  · **tasca completa** → `spesa_tasca`, che il gestionale sa scrivere;
 *  · **tasca a metà** (manca l'importo o il per che cosa) → appunto non
 *    approvabile che dice **che cosa** manca;
 *  · **verso storto** → appunto non approvabile che dice perché;
 *  · **soldi suoi ma non ha detto quale dei due** → appunto che chiede.
 * Se dei soldi non ha parlato, non è affare di questa regola: resta il
 * movimento di cassa dell'osteria, esattamente come prima.
 */
export function destinazioneDellaSpesa(azione: AzioneDettata, dettato = ""): AzioneDettata {
  if (azione?.tipo !== TIPO_CASSA && azione?.tipo !== TIPO_TASCA) return azione;

  switch (diChiSono(azione, dettato)) {
    // 🔴 REGOLA 4: il rimborso vince su tutto.
    case "rimborso":
      return {
        ...azione,
        tipo: TIPO_DA_RIMBORSARE,
        destinazione: "Anticipo io, poi mi rimborso",
        sicuro: true,
        motivo:
          "Hai detto che questi soldi devono tornarti: allora non è la tua " +
          "tasca, è un anticipo che la società ti pareggia. Si registra in " +
          "Cassa → «Anticipo io, poi mi rimborso», e da lì lo chiudi quando " +
          "ti sei rimborsato.",
      };

    case "propri_non_detto":
      return {
        ...azione,
        tipo: TIPO_DI_CHI_SONO,
        destinazione: "Questi soldi tornano indietro?",
        sicuro: true,
        motivo:
          "Hai detto che li hai messi tu, ma non se te li riprendi. Sono due " +
          "cose diverse: se non tornano indietro dillo con «di tasca mia», se " +
          "invece te li rimborsi dillo con «ho anticipato» o «poi mi rimborso».",
      };

    case "tasca": {
      if (versoStorto(azione)) {
        return {
          ...azione,
          tipo: TIPO_DI_CHI_SONO,
          destinazione: "Dalla tasca escono soldi e basta",
          sicuro: true,
          motivo:
            "Nella tua tasca entrano soldi solo se il progetto te li " +
            "restituisce, e quello è un pareggio: la tasca non lo fa. Se ti " +
            "sei ripreso dei soldi, quello è un anticipo — Cassa → «Anticipo " +
            "io, poi mi rimborso».",
        };
      }

      const manca = cosaManca(azione);
      if (manca.length > 0) {
        return {
          ...azione,
          tipo: TIPO_DI_CHI_SONO,
          destinazione: "Manca qualcosa per scriverla",
          sicuro: true,
          // ⚠️ Si nominano TUTTE le cose che mancano, non la prima: dirne una
          //    per volta fa scoprire la seconda dopo aver rimediato alla
          //    prima, e alla terza si smette di leggere.
          motivo:
            `Della spesa dalla tua tasca mi manca ${manca.join(" e ")}. ` +
            "Ridillo per intero — per esempio «ho comprato il detersivo di " +
            "tasca mia, dodici euro» — e la scrivo.",
        };
      }

      return {
        ...azione,
        tipo: TIPO_TASCA,
        destinazione: "Spesa dalla mia tasca",
        sicuro: true,
      };
    }

    default:
      return azione;
  }
}

/** La stessa regola su tutta la filza. */
export function correggiSpese(azioni: AzioneDettata[], dettato = ""): AzioneDettata[] {
  return (azioni ?? []).map((a) => destinazioneDellaSpesa(a, dettato));
}
