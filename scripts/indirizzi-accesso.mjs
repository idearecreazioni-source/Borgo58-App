// =====================================================================
// GLI INDIRIZZI DI ACCESSO ESCONO DAL CODICE — 02/09/2026
// =====================================================================
// Proposta approvata da Alessio, realizzata in due proposte separate.
// Questa e' la PRIMA: il modulo e le sue prove. **Non e' ancora agganciato
// a niente** — ne' a `vite.config.js`, ne' alla schermata di accesso.
//
// ---------------------------------------------------------------------
// IL FATTO CHE LO GIUSTIFICA, misurato
// ---------------------------------------------------------------------
// Il 01/09 Alessio ha aperto l'anteprima costruita da GitHub e **non e'
// potuto entrare**: `src/context/AuthContext.jsx` ha due indirizzi scritti
// dentro, la schermata prova **solo quei due**, e l'indirizzo non si digita.
// Un utente diverso esisterebbe su Supabase e la schermata non lo
// chiamerebbe mai.
//
// Dal 01/09 gli ambienti sono **due** — l'anteprima collegata al progetto di
// prova e `borgo58.it` — e **lo stesso pacchetto** serve tutti e due.
//
// ---------------------------------------------------------------------
// 🔴 IL CONFINE: QUESTO MODULO E' SOLO-NODE, E NON ENTRA NEL BROWSER
// ---------------------------------------------------------------------
// Lo importeranno **`vite.config.js`** e gli script di rilascio. Nient'altro.
//
// 🔴 `src/context/AuthContext.jsx` NON lo importa, ne' oggi ne' mai. Se lo
// facesse, `node:fs` finirebbe nel grafo del pacchetto del browser: nel
// migliore dei casi la compilazione fallisce, nel peggiore entra un
// riempitivo che gonfia il pacchetto e non serve a niente.
//
// ⚠️ E il confine e' una PROPRIETA' SORVEGLIATA, non una buona intenzione:
// `tests/unita/indirizzi-accesso.test.js` legge `AuthContext.jsx` e pretende
// che non nomini questo file. Diventa rossa il giorno che qualcuno lo importa
// «solo per riusare una funzione» — che e' esattamente come succederebbe.
//
// ⚠️ PERCHE' IL BROWSER NON HA BISOGNO DI NIENTE DI NODE, misurato il 02/09
// e non dedotto: `encodeURIComponent` e `decodeURIComponent` esistono
// **identiche** in Node e nel browser. Su dieci casi — riservati, spazio,
// accento, doppia codifica — l'andata e ritorno e' tornato **identico** tutte
// le volte, e **nessuno** ha prodotto una virgola nel codificato.
// Una stesura precedente usava `Buffer` e base64url: con la percentuale la
// codifica e la decodifica sono **la stessa funzione** dalle due parti, e il
// confine diventa piu' netto invece che piu' fragile.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// ---------------------------------------------------------------------
// I PREDEFINITI — sono gli indirizzi di oggi, e restano il comportamento
// della produzione finche' nessuno imposta niente.
// ---------------------------------------------------------------------
export const INDIRIZZI_PREDEFINITI = {
  titolare: "alessio@borgo58.app",
  staff: "staff@borgo58.app",
};

// ⚠️ ALLOWLIST CONSERVATIVA, e la strettezza e' voluta: niente barra
// verticale, due punti, virgola, virgolette, spazi, barre rovesce. E'
// **piu' stretta della RFC** e rifiuta qualche indirizzo teoricamente legale
// che nessun sistema vero usa. Il prezzo e' un rifiuto **visibile a tempo di
// costruzione**; il prezzo opposto sarebbe un marcatore spezzato che non
// vede nessuno.
const FORMA = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

/**
 * Gli indirizzi con cui si entra, decisi dall'ambiente o predefiniti.
 * Si ferma con un'eccezione se un valore e' storto: la costruzione fallisce
 * e il pacchetto rotto non nasce. A runtime vorrebbe dire scoprirlo davanti
 * alla schermata di accesso, cioe' **chiusi fuori**.
 */
export function indirizziDiAccesso(env = {}) {
  // ⚠️ IL DOPPIO PUNTO INTERROGATIVO DA SOLO SAREBBE SBAGLIATO: la stringa
  //    vuota non e' nullish, quindi una variabile impostata per sbaglio a
  //    vuoto produrrebbe un accesso con l'indirizzo vuoto — che fallisce
  //    sempre, **senza che nessun errore dica perche'**. Vuoto e
  //    a-soli-spazi valgono «non impostato».
  const scelto = (valore, predefinito, nome) => {
    const t = (valore ?? "").trim();
    if (t === "") return predefinito;
    if (!FORMA.test(t)) {
      throw new Error(
        `${nome}: «${t}» non e' un indirizzo accettabile. Correggilo o togli la variabile.`,
      );
    }
    return t;
  };

  const titolare = scelto(
    env.VITE_EMAIL_TITOLARE,
    INDIRIZZI_PREDEFINITI.titolare,
    "VITE_EMAIL_TITOLARE",
  );
  const staff = scelto(
    env.VITE_EMAIL_STAFF,
    INDIRIZZI_PREDEFINITI.staff,
    "VITE_EMAIL_STAFF",
  );

  // 🔴 UGUALI = IL RUOLO DIVENTA INDECIDIBILE: la schermata prova il primo,
  //    riesce, e chi entra come sala si ritrova **titolare**. Non da' nessun
  //    errore: da' i permessi sbagliati.
  if (titolare === staff) {
    throw new Error(
      "I due indirizzi non possono coincidere: il PIN non distinguerebbe piu' i ruoli.",
    );
  }

  return { titolare, staff };
}

// ---------------------------------------------------------------------
// IL MARCATORE — cio' che finisce nel pacchetto e si puo' ritrovare
// ---------------------------------------------------------------------
export const MARCA_INDIRIZZI = "borgo58-indirizzi-accesso-v1";

/**
 * ⚠️ LA VIRGOLA E' SEMPRE CODIFICATA DENTRO I VALORI (misurato): nessun
 * indirizzo puo' produrre un separatore, **qualunque cosa la validazione
 * lasci passare**.
 *
 * Sono due difese indipendenti e servono entrambe, perche' rispondono a
 * domande diverse: la validazione impedisce **il dato cattivo**, la codifica
 * impedisce che **un dato qualunque rompa la struttura**. La prima da sola
 * legherebbe la tenuta del marcatore a una regexp che qualcuno domani
 * potrebbe allargare per far entrare un indirizzo legittimo — e la
 * romperebbe senza accorgersene.
 */
export const marcatore = ({ titolare, staff }) =>
  `${MARCA_INDIRIZZI},${encodeURIComponent(titolare)},${encodeURIComponent(staff)}`;

// I caratteri che `encodeURIComponent` lascia intatti, **misurati** uno per
// uno il 02/09 (non ricopiati da una tabella), piu' il segno di percentuale,
// che introduce ogni sequenza codificata.
const CORPO = "[A-Za-z0-9._%~!*'()-]+";

// ---------------------------------------------------------------------
// IL CONTROLLO DEL PACCHETTO
// ---------------------------------------------------------------------
// ⚠️ Legge il disco, quindi vive **qui** e non potra' mai stare dal lato del
// browser. E' l'altra meta' della ragione per cui questo modulo e' solo-Node.

function leggiIlCompilato(cartella) {
  let file;
  try {
    file = readdirSync(join(cartella, "assets"));
  } catch {
    return null; // non c'e' niente di compilato
  }
  const js = file.filter((nome) => nome.endsWith(".js"));
  if (js.length === 0) return null;
  return js
    .map((nome) => readFileSync(join(cartella, "assets", nome), "utf8"))
    .join("\n");
}

/**
 * Dice cosa **non va** nel pacchetto compilato, oppure `null` se va tutto
 * bene.
 *
 * ⚠️ CONFRONTA VALORI ESATTI, NON FORME. Una stesura precedente cercava
 * il dominio dentro il pacchetto: un indirizzo su un dominio diverso sarebbe
 * stato **invisibile al controllo**, che avrebbe approvato senza aver
 * guardato niente.
 */
export function problemaDegliIndirizzi(cartella, attesi, leggi = leggiIlCompilato) {
  const testo = leggi(cartella);
  if (testo === null) {
    return "Non c'e' niente di compilato: non c'e' nulla da controllare.";
  }

  const trovati = [
    ...new Set(
      [
        ...testo.matchAll(
          new RegExp(`${MARCA_INDIRIZZI},(${CORPO}),(${CORPO})`, "g"),
        ),
      ].map((m) => `${m[1]},${m[2]}`),
    ),
  ];

  if (trovati.length === 0) {
    return (
      "Nel pacchetto non c'e' il marcatore degli indirizzi di accesso: o non e' " +
      "stato compilato da questa configurazione, o qualcuno ha tolto il define."
    );
  }
  if (trovati.length > 1) {
    return `Nel pacchetto ci sono ${trovati.length} marcatori diversi: non si sa quale valga.`;
  }

  const [t, s] = trovati[0].split(",").map(decodeURIComponent);
  if (t !== attesi.titolare) {
    return `Titolare nel pacchetto «${t}», atteso «${attesi.titolare}».`;
  }
  if (s !== attesi.staff) {
    return `Staff nel pacchetto «${s}», atteso «${attesi.staff}».`;
  }
  return null;
}
