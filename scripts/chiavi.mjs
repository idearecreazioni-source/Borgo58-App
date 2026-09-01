// LE CHIAVI DEL PROGETTO DI PROVA — una regola sola, tre lettori (01/09/2026)
//
// 🔴 PERCHE' ESISTE, e il caso e' MISURATO, non temuto.
//
// Il 31/08 alle 23:11 il giro dei controlli su `master` (commit 797262b) e'
// diventato rosso con **67 file falliti e 146 prove saltate**. Dieci minuti
// prima, sullo STESSO identico contenuto (commit 31b66e7, il giro della
// proposta delle 22:55), le stesse prove erano passate **459 su 459**.
// Il codice non era cambiato: erano cambiate le chiavi.
//
// Nel registro del giro rosso si legge, riga per riga, cosa e' arrivato:
//     VITE_SUPABASE_URL: ***          <- c'era, ma non era un indirizzo
//     TEST_TITOLARE_EMAIL:            <- VUOTA
//     TEST_STAFF_EMAIL:               <- VUOTA
//
// 🔴 E IL CONTROLLO CHE DOVEVA PRENDERLO GUARDAVA UNA CASELLA SOLA.
//    Il passo «Le chiavi ci sono?» chiedeva **una** cosa — che
//    `PROVA_SUPABASE_URL` non fosse vuota — e quella c'era. Quindi ha
//    detto di si', e le prove sono partite: sei minuti di lavoro per
//    finire con settantanove messaggi diversi, di cui nessuno diceva la
//    cosa vera («mancano due segreti e il terzo non e' un indirizzo»).
//
// ⚠️ IL DIFETTO NON E' CHE IL GIRO SIA ROSSO: e' che il rosso NON NOMINA
//    LA CAUSA. Chi lo legge cerca il guasto nel codice — che e' sano — e
//    ci mette un'ora per arrivare a due caselle vuote in un pannello.
//    E' la famiglia gia' scritta in CLAUDE.md §8: *un rifiuto che ha piu'
//    di una causa le elenca, o manda a cercare nella prima che viene in
//    mente.*
//
// ⚠️ E LA REGOLA STA QUI, NON IN TRE POSTI. Prima le condizioni erano
//    sparse: la forma dell'indirizzo dentro `vitest.config.js`, il
//    rifiuto del progetto vero dentro `tests/app/aiuto.js`, la presenza
//    dentro il file della pipeline. Tre posti che dicono pezzi della
//    stessa cosa e possono divergere — e infatti divergevano: nessuno
//    dei tre guardava le quattro credenziali degli utenti.

import { existsSync, readFileSync } from "node:fs";

import { REF_PRODUZIONE, REF_PROVA } from "./comune.mjs";

export { REF_PRODUZIONE, REF_PROVA };

/**
 * L'indirizzo dell'API del progetto di prova — RICAVATO, non configurato.
 *
 * 🔴 NON E' UN SEGRETO E NON DEVE ESSERLO (01/09/2026). Il riferimento del
 *    progetto di prova sta in chiaro in `scripts/comune.mjs` (`REF_PROVA`),
 *    in CLAUDE.md e in una dozzina di riepiloghi: chiuderlo dentro un
 *    segreto non nasconde niente, e in cambio crea una casella che
 *    **nessuno puo' rileggere per controllarla**. E' cosi' che il 31/08 ci
 *    e' finita dentro la riga sbagliata: un valore che non si puo' guardare
 *    non si puo' nemmeno correggere a vista.
 *
 * ⚠️ E cosi' il bersaglio delle prove non PUO' essere la produzione: prima
 *    era un controllo che lo verificava, adesso e' la forma del valore.
 *    *Un vincolo batte un controllo*, ed e' la regola di questo progetto.
 */
export const INDIRIZZO_PROVA = `https://${REF_PROVA}.supabase.co`;

/**
 * Le sei caselle che servono per far girare le prove contro il database.
 *
 * `env` e' il nome che la casella ha quando arriva come variabile
 * d'ambiente (la pipeline, e cio' che vitest passa alle prove); `file` e'
 * il nome che ha dentro `.env` sul computer di Alessio, dove `VITE_*`
 * vuol dire il LOCALE VERO e il progetto di prova si chiama `PROVA_*`.
 */
export const CHIAVI_DI_PROVA = [
  {
    env: "VITE_SUPABASE_URL",
    file: "PROVA_SUPABASE_URL",
    cosa: "l'indirizzo del progetto di prova",
    // Ricavato dal repository: vedi INDIRIZZO_PROVA qui sopra.
    dalRepository: INDIRIZZO_PROVA,
  },
  { env: "VITE_SUPABASE_ANON_KEY", file: "PROVA_SUPABASE_ANON_KEY", cosa: "la chiave pubblica del progetto di prova" },
  {
    env: "TEST_TITOLARE_EMAIL",
    file: "TEST_TITOLARE_EMAIL",
    cosa: "la posta dell'utente di prova titolare",
    // 🔴 Anche questa NON e' un segreto: sta in chiaro in `.env.example`
    //    dal giorno in cui quel file esiste. Tenerla in un segreto di GitHub
    //    ha un solo effetto — che nessuno possa rileggerla — ed e' il motivo
    //    per cui il 31/08 e' rimasta vuota senza che nessuno se ne accorgesse.
    dalRepository: "test-titolare@borgo58.app",
  },
  { env: "TEST_TITOLARE_PASSWORD", file: "TEST_TITOLARE_PASSWORD", cosa: "il PIN dell'utente di prova titolare" },
  {
    env: "TEST_STAFF_EMAIL",
    file: "TEST_STAFF_EMAIL",
    cosa: "la posta dell'utente di prova di sala",
    dalRepository: "test-staff@borgo58.app",
  },
  { env: "TEST_STAFF_PASSWORD", file: "TEST_STAFF_PASSWORD", cosa: "il PIN dell'utente di prova di sala" },
];

/**
 * Le sole tre caselle che sono davvero un segreto, e le uniche che devono
 * vivere nei Secrets di GitHub.
 *
 * ⚠️ Una chiave e due PIN. Tutto il resto e' gia' leggibile nel repository,
 *    e metterlo in un segreto non lo protegge: lo rende soltanto
 *    incontrollabile.
 */
export const SEGRETI_VERI = CHIAVI_DI_PROVA.filter((c) => !c.dalRepository).map((c) => c.file);

/**
 * Cosa non va nell'indirizzo, in italiano — oppure niente.
 *
 * 🔴 NON RIPETE MAI IL VALORE, ed e' una decisione e non una dimenticanza:
 *    il valore che il 31/08 e' finito in quella casella era una stringa di
 *    collegamento **con dentro una password in chiaro**. Un messaggio
 *    d'errore che la ristampa la porta nel registro della pipeline, nel
 *    terminale e nella prima segnalazione che qualcuno incolla in chat.
 *    Si dice cosa c'e' che non va e in quale casella; il valore ce l'ha
 *    gia' davanti chi deve correggerlo.
 *
 * ⚠️ Le due condizioni non sono la stessa cosa e non vanno unite:
 *   - **non e' un indirizzo**: quasi sempre e' stato incollato il
 *     riferimento del progetto (venti lettere a caso) al posto
 *     dell'indirizzo. E' il difetto del 31/08.
 *   - **e' il locale vero**: qui non si sbaglia una casella, si punta il
 *     bersaglio sbagliato. Le prove SCRIVONO, quindi questo non e' un
 *     fastidio: e' la riga che protegge i dati veri.
 */
export function problemaDellIndirizzo(url) {
  if (!url) return null;
  if (/^postgres(ql)?:\/\//i.test(url)) {
    // 🔴 IL CASO VERO, e vale la pena nominarlo invece di dire solo «non e'
    //    un indirizzo»: dentro `.env` ci sono DUE cose che descrivono lo
    //    stesso progetto di prova — l'indirizzo dell'API
    //    (`PROVA_SUPABASE_URL`, https) e la stringa di collegamento diretto
    //    al database (`DB_URL_PROVA`, postgresql). Da fuori si somigliano:
    //    cominciano tutte e due col riferimento del progetto. E' la seconda
    //    che il 31/08 e' finita nel segreto della prima.
    return "e' la stringa di collegamento al database (postgresql://), non l'indirizzo dell'API. In `.env` sono due caselle diverse: qui ci va quella https di `PROVA_SUPABASE_URL`, non `DB_URL_PROVA`.";
  }
  if (!/^https:\/\//i.test(url)) {
    return "non comincia per https:// — non e' un indirizzo. Qui ci va l'indirizzo del progetto Borgo58-Prova (Settings -> Data API), non il suo riferimento.";
  }
  if (url.includes(REF_PRODUZIONE)) {
    return "e' il progetto del LOCALE VERO. Le prove scrivono: qui ci va il progetto di prova (docs/AMBIENTE_PROVA.md).";
  }
  return null;
}

/**
 * Tutto cio' che impedisce alle prove di girare, detto in una volta sola.
 *
 * ⚠️ RESTITUISCE L'ELENCO INTERO, non il primo problema. Un rifiuto per
 * volta fa scoprire la seconda casella vuota dopo aver riempito la prima,
 * e alla terza si smette di leggere — e' la regola dei rifiuti che
 * nominano tutte le righe (CLAUDE.md §6).
 *
 * @param {Record<string,string|undefined>} valori le caselle lette
 * @param {"env"|"file"} da con quali nomi chiamarle nel messaggio
 * @returns {string[]} vuoto se e' tutto a posto
 */
export function problemiDelleChiavi(valori, da = "env") {
  const problemi = [];
  for (const chiave of CHIAVI_DI_PROVA) {
    const nome = chiave[da];
    const valore = (valori[chiave.env] ?? valori[chiave.file] ?? "").trim();
    if (!valore) {
      problemi.push(`${nome} e' vuota — manca ${chiave.cosa}.`);
      continue;
    }
    if (chiave.env === "VITE_SUPABASE_URL") {
      const guaio = problemaDellIndirizzo(valore);
      if (guaio) problemi.push(`${nome} ${guaio}`);
    }
  }
  return problemi;
}


/**
 * Le sei caselle, lette da dove ci sono — un lettore solo (01/09/2026).
 *
 * ⚠️ LA PRECEDENZA E' DICHIARATA E PROVATA: **l'ambiente vince sul file**.
 *    E' la stessa regola scritta in `.env.example` («quello che passa il
 *    comando vince su quello che c'e' scritto qui»), ed e' cio' che permette
 *    a `npm run dev:prova` di puntare altrove senza toccare `.env`. Prima
 *    valeva il contrario dentro vitest, e da nessuna parte era scritto quale
 *    delle due cose fosse vera.
 *
 * ⚠️ SUL COMPUTER DI ALESSIO le due caselle del progetto di prova si
 *    chiamano `PROVA_*`, perche' li' dentro `VITE_*` vuol dire il LOCALE
 *    VERO — e' la riga che finisce nel sito pubblicato. Qui vengono
 *    ribattezzate `VITE_*` per la durata delle prove: e' l'unico posto dove
 *    quella traduzione avviene.
 *
 * ⚠️ SU GITHUB `.env` non esiste e questa funzione legge solo l'ambiente.
 *    E' il motivo per cui il controllo del 31/08 non poteva funzionare: la
 *    validazione viveva nel ramo che legge il file, cioe' proprio quello che
 *    nella pipeline non viene mai percorso.
 */
export function leggiChiaviDiProva(ambiente = process.env, file = ".env") {
  const daFile = righeDelFile(file);
  const valori = {};
  for (const chiave of CHIAVI_DI_PROVA) {
    const scelto = valoreScelto(chiave, ambiente, daFile);
    if (scelto) valori[chiave.env] = scelto;
  }
  return valori;
}

function righeDelFile(file) {
  const daFile = {};
  if (existsSync(file)) {
    for (const riga of readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = riga.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) daFile[m[1]] = m[2].trim();
    }
  }
  return daFile;
}

function valoreScelto(chiave, ambiente, daFile) {
  const fornito = ((ambiente[chiave.env] ?? "").trim() || (daFile[chiave.file] ?? "").trim()) || "";
  if (!chiave.dalRepository) return fornito;
  // 🔴 SULL'INDIRIZZO il valore fornito vale solo se e' un indirizzo. Se
  //    qualcuno ha incollato la riga sbagliata — la stringa di collegamento
  //    al database, che e' quello che e' successo il 31/08 — non si tira a
  //    indovinare **e non si blocca il lavoro per una cosa che il
  //    repository sa gia'**: si usa il valore ricavato, e lo si dice.
  //    ⚠️ Un indirizzo https fornito vince sempre, anche se punta altrove:
  //    e' cosi' che si puo' ancora puntare le prove a un terzo progetto, ed
  //    e' anche il caso in cui il rifiuto sulla produzione deve scattare.
  if (chiave.env === "VITE_SUPABASE_URL") {
    return /^https:\/\//i.test(fornito) ? fornito : chiave.dalRepository;
  }
  return fornito || chiave.dalRepository;
}

/**
 * Le caselle in cui c'e' scritto qualcosa che non si puo' usare, e per cui
 * si e' preso il valore del repository. **Non bloccano niente**: si dicono.
 *
 * ⚠️ Perche' dirle invece di tacere: una configurazione sbagliata che
 *    smette di fare danno resta comunque una configurazione sbagliata, e il
 *    giorno che qualcuno toglie il valore ricavato tornerebbe a mordere.
 */
export function righeIgnorate(ambiente = process.env, file = ".env") {
  const daFile = righeDelFile(file);
  const note = [];
  for (const chiave of CHIAVI_DI_PROVA) {
    if (!chiave.dalRepository) continue;
    const fornito = ((ambiente[chiave.env] ?? "").trim() || (daFile[chiave.file] ?? "").trim()) || "";
    if (!fornito) continue;
    if (valoreScelto(chiave, ambiente, daFile) !== fornito) {
      const perche = /^postgres(ql)?:\/\//i.test(fornito)
        ? "contiene la stringa di collegamento al database (`DB_URL_PROVA`) invece dell'indirizzo dell'API"
        : "non contiene un indirizzo `https://`";
      note.push(
        `${chiave.file} ${perche}: e' stata ignorata, e si usa l'indirizzo ricavato dal repository. Va comunque messa a posto.`
      );
    }
  }
  return note;
}
