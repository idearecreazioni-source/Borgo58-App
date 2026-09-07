// =====================================================================
// LE RISPOSTE DI MEMO — fase 1, sola lettura (07/09/2026)
// =====================================================================
// 🔴 IL MODELLO CAPISCE LA DOMANDA, IL DATABASE DÀ LA RISPOSTA, E QUESTA
//    REGOLA COMPONE LA FRASE. Nessun numero passa mai dal modello: quello
//    che arriva da lui è soltanto *che cosa* è stato chiesto e *di che
//    cosa*. Tutto quello che si legge a schermo esce da qui, dai dati che
//    il gestionale ha appena letto **col permesso di chi sta guardando**.
//    ⚠️ È la differenza fra una risposta controllabile e una plausibile:
//    quello che MEMO dice è la stessa cosa che si legge aprendo la
//    schermata, e sotto c'è il collegamento per andarla a guardare.
//
// 🔴 LE RISPOSTE SONO CINQUE, non due, e la distinzione è tutto il valore
//    di questo modulo:
//      · "risposta"     → l'ho letto, ed ecco cosa dice;
//      · "non_lo_so"    → **non sono riuscito a leggere**. Mai un numero,
//                         mai uno zero, mai un elenco vuoto;
//      · "chiarimento"  → ho capito la domanda ma manca il soggetto;
//      · "scegli"       → ho trovato più candidati e NON ne scelgo uno;
//      · "non_so_farlo" → era una domanda, ma non è fra quelle che so.
//    ⚠️ «Non lo so» e «non ce n'è» erano lo stesso `[]` fino al 20/08, ed è
//    la famiglia di difetti che questo progetto insegue da allora. Qui la
//    lettura fallita arriva marcata (`NON_LETTO`) e non può travestirsi da
//    risposta.
//
// ⚠️ E QUESTO MODULO NON PARLA COL DATABASE. Riceve i dati già letti, così
//    tutte e nove le domande — e i casi storti, che sono quelli che
//    contano — si provano senza rete e senza aprire una schermata.

import {
  ALLERGENS,
  formatDate,
  labelFor,
  qtaConUnita,
  recipeStatusLabel,
} from "../constants";
import { nonLetto } from "./letture";

// ---------------------------------------------------------------------
// DOVE SI VA A GUARDARE
// ---------------------------------------------------------------------
// ⚠️ Ogni risposta porta un collegamento, comprese quelle che dicono «non
// lo so»: un rifiuto senza gesto d'uscita è un vicolo cieco, e qui il
// gesto d'uscita è andarselo a leggere da sé.
export const DOVE = {
  ricettario: { a: "/ricettario/ricette", apri: "Apri il Ricettario" },
  carta: { a: "/ricettario/ricette", apri: "Apri il Ricettario" },
  magazzino: { a: "/magazzino", apri: "Apri il Magazzino" },
  scadenze: { a: "/magazzino/scadenze", apri: "Apri lo scadenziario" },
  agenda: { a: "/agenda", apri: "Apri l'Agenda" },
};

/**
 * LE NOVE DOMANDE, con come si leggono a schermo.
 *
 * ⚠️ I nomi (`chiede`) sono gli stessi che la funzione online dichiara al
 * modello: là vive l'elenco per chi capisce, qui quello per chi mostra.
 * Una prova li confronta, perché due elenchi separati divergono al primo
 * ritocco.
 */
export const DOMANDE_CHE_SO = {
  ricetta_esiste: {
    area: "ricettario",
    dove: "ricettario",
    esempio: "Ho la ricetta della carbonara?",
    titolo: "Ho la ricetta di «{x}»?",
    senzaSoggetto: "Ho questa ricetta?",
    chiarimento: "Di quale piatto?",
  },
  allergeni: {
    area: "ricettario",
    dove: "ricettario",
    esempio: "Quali allergeni ha la carbonara?",
    titolo: "Gli allergeni di «{x}»",
    senzaSoggetto: "Gli allergeni di questo piatto",
    chiarimento: "Di quale piatto?",
  },
  piatti_in_carta: {
    area: "ricettario",
    dove: "carta",
    esempio: "Quali piatti ho in carta?",
    titolo: "Quali piatti ho in carta?",
  },
  quanto_ho: {
    area: "magazzino",
    dove: "magazzino",
    esempio: "Quanto olio ho?",
    titolo: "Quanto «{x}» ho?",
    senzaSoggetto: "Quanto ne ho?",
    chiarimento: "Di che cosa?",
  },
  cosa_manca: {
    area: "magazzino",
    dove: "magazzino",
    esempio: "Cosa mi manca?",
    titolo: "Cosa mi manca?",
  },
  cosa_scade: {
    area: "magazzino",
    dove: "scadenze",
    esempio: "Cosa scade?",
    titolo: "Cosa scade?",
  },
  agenda_oggi: {
    area: "agenda",
    dove: "agenda",
    esempio: "Cosa devo fare oggi?",
    titolo: "Cosa devo fare oggi?",
  },
  agenda_in_ritardo: {
    area: "agenda",
    dove: "agenda",
    esempio: "Cosa sono in ritardo?",
    titolo: "Cosa sono in ritardo?",
  },
  // 🔴 «QUANDO SCADE X» NON E' UNA DOMANDA DELLA SOLA AGENDA — 07/09/2026,
  //    dal collaudo a mano: «quando scade l'astice?» cercava un *impegno*
  //    chiamato astice e non lo trovava. Le cose che scadono in un'osteria
  //    stanno in due posti diversi, e la parola e' la stessa.
  quando_scade: {
    area: "magazzino",
    dove: "scadenze",
    esempio: "Quando scade l'astice?",
    titolo: "Quando scade «{x}»?",
    senzaSoggetto: "Quando scade?",
    chiarimento: "Quale prodotto o quale impegno?",
  },
};

// ---------------------------------------------------------------------
// I NOMI, COME LI DICE LUI
// ---------------------------------------------------------------------
// ⚠️ Senza accenti e senza maiuscole: chi detta dice «ragù» e in magazzino
// può esserci scritto «Ragu». Un confronto letterale risponderebbe «non
// ce l'ho» su una cosa che c'è — cioè la bugia peggiore fra quelle che
// questa schermata può dire.
export function normalizza(testo) {
  return String(testo ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * QUANDO UNA SCELTA È GIÀ STATA FATTA, I CANDIDATI SONO UNO SOLO.
 *
 * 🔴 SI SCEGLIE PER IDENTIFICATIVO, MAI PER SOMIGLIANZA DEL NOME, e la
 * differenza non è di forma. Davanti a «Olio» e «Olio di semi», chi ha
 * detto «olio» ha nominato esattamente il primo — e prenderlo per buono
 * sarebbe **scegliere al posto suo**: se intendeva il secondo, la risposta
 * è sbagliata e ha l'aria di essere giusta. Quindi il nome non restringe
 * niente: restringe solo il tocco su un candidato, che porta con sé
 * l'identificativo di quello che è stato toccato.
 *
 * ⚠️ Un identificativo che non trova niente (una riga sparita nel
 * frattempo) NON svuota la risposta: si torna a chiedere quale, che è
 * l'unica cosa onesta.
 */
export function fraICandidati(elenco, scelto, campoId) {
  const righe = elenco ?? [];
  if (!scelto) return righe;
  const uno = righe.filter((r) => r?.[campoId] === scelto);
  return uno.length === 1 ? uno : righe;
}

/** Il nome contiene quello che è stato chiesto? */
export function combacia(nome, cercato) {
  const c = normalizza(cercato);
  if (c === "") return false;
  return normalizza(nome).includes(c);
}

/**
 * IL NOME COMINCIA CON QUELLO CHE È STATO CHIESTO?
 *
 * 🔴 IL DIFETTO CHE CHIUDE, dal collaudo a mano del 07/09/2026: alla
 * domanda «quanto olio ho?» MEMO proponeva i due oli veri **e** «Pomodoro
 * secco di Pachino sott'olio». Quel prodotto la parola «olio» ce l'ha
 * davvero nel nome — ma non è un olio: è un pomodoro.
 *
 * ⚠️ IL CRITERIO NON È UN ELENCO DI PAROLE DA IGNORARE, che invecchierebbe
 * al primo prodotto nuovo. È una proprietà dell'italiano: **il nome della
 * cosa sta in testa**. «Olio extravergine» e «Olio di semi» sono oli;
 * «Pomodoro secco di Pachino sott'olio» è un pomodoro, e lo dice la prima
 * parola. Quello che viene dopo qualifica, non definisce.
 */
export function nominaLaCosa(nome, cercato) {
  const c = normalizza(cercato);
  if (c === "") return false;
  const n = normalizza(nome);
  return n === c || n.startsWith(`${c} `);
}

/**
 * LA FRASE NOMINA L'AGENDA?
 *
 * 🔴 SERVE PERCHE' «SCADERE» VUOL DIRE DUE COSE, e in un'osteria tutte e
 * due sono vere: scade una partita in cella e scade un adempimento. Il
 * gestionale guarda **prima il magazzino** — «quando scade l'astice» parla
 * di un astice — e passa all'Agenda solo se non trova niente, oppure se la
 * frase l'ha nominata.
 *
 * ⚠️ SI GUARDA LA FRASE DETTA, NON QUELLO CHE DICE IL MODELLO: cosi' la
 * precedenza non dipende da come il modello ha classificato quel giorno.
 * E' la stessa scelta di sembraUnaDomanda() nella funzione online.
 *
 * ⚠️ E SBAGLIARE NON FA PERDERE LA RISPOSTA: la precedenza decide solo
 * DOVE si guarda per primo. Se nel posto scelto non c'e' niente, si guarda
 * comunque nell'altro — quindi un riconoscimento mancato costa un ordine
 * diverso, mai un «non lo trovo» su una cosa che c'e'.
 */
const PAROLE_DELL_AGENDA = ["impegno", "impegni", "attivita", "agenda", "adempimento", "adempimenti", "promemoria"];

export function nominaLAgenda(testo) {
  const t = normalizza(testo);
  if (t === "") return false;
  return PAROLE_DELL_AGENDA.some((p) => t === p || t.includes(` ${p} `) || t.startsWith(`${p} `) || t.endsWith(` ${p}`));
}

// ---------------------------------------------------------------------
// LE PAROLE DEL TEMPO
// ---------------------------------------------------------------------
// ⚠️ «Fra -3 giorni» non lo dice nessuno. E il verso conta: in ritardo e in
// arrivo sono due frasi diverse, non lo stesso numero col segno.
export function quandoInParole(giorni) {
  if (giorni == null) return null;
  const n = Number(giorni);
  if (!Number.isFinite(n)) return null;
  if (n === 0) return "oggi";
  if (n === 1) return "domani";
  if (n === -1) return "ieri";
  if (n > 1) return `fra ${n} giorni`;
  return `${-n} giorni fa`;
}

const scadeInParole = (giorni) => {
  const n = Number(giorni);
  if (!Number.isFinite(n)) return "senza scadenza";
  if (n < 0) return `scaduta da ${-n} ${-n === 1 ? "giorno" : "giorni"}`;
  if (n === 0) return "scade oggi";
  if (n === 1) return "scade domani";
  return `scade fra ${n} giorni`;
};

// ---------------------------------------------------------------------
// LE CINQUE FORME DI RISPOSTA
// ---------------------------------------------------------------------
const dove = (chiave) => DOVE[chiave] ?? DOVE.ricettario;

/**
 * QUANTE RIGHE STANNO IN UNA RISPOSTA PARLATA.
 *
 * 🔴 MISURATO SUL PROGETTO DI PROVA, col modello vero: «cosa scade?» ha
 * risposto con **sessantotto righe**. Non è una risposta — è lo
 * scadenziario ricopiato in un riquadro, su un telefono tenuto in una mano
 * sola. *Un elenco che dice tutto non dice niente*, ed è la stessa lezione
 * dello scadenziario del 13/08.
 *
 * ⚠️ IL TAGLIO SI DICHIARA, SEMPRE, e il conteggio nella frase resta quello
 * VERO: «68 partite sono in scadenza» + le prime sei + «e altre 62: le
 * trovi tutte lì». Un elenco tagliato in silenzio è precisamente la
 * famiglia di difetti che questo progetto insegue dal 19/08 — *una risposta
 * più corta che ha l'aria di essere intera*.
 */
export const RIGHE_MOSTRATE = 6;

const risposta = (chiave, frase, righe = [], extra = {}) => {
  const tutte = righe ?? [];
  return {
    stato: "risposta",
    frase,
    righe: tutte.slice(0, RIGHE_MOSTRATE),
    troppe: Math.max(0, tutte.length - RIGHE_MOSTRATE),
    limite: null,
    candidati: [],
    ...dove(chiave),
    ...extra,
  };
};

/**
 * NON LO SO — e si dice PERCHÉ.
 *
 * ⚠️ «Non sono riuscito a leggere» non è «non c'è»: la seconda è una
 * risposta, la prima è l'ammissione che una risposta non c'è. Confonderle
 * è il difetto che `letture.js` esiste per chiudere, e qui sarebbe
 * peggiore che altrove — a schermo comparirebbe un numero.
 */
const nonLoSo = (chiave, cosa) => ({
  stato: "non_lo_so",
  troppe: 0,
  frase: `Non lo so: non sono riuscito a leggere ${cosa}. Non ti do un numero che non ho letto.`,
  righe: [],
  limite: null,
  candidati: [],
  ...dove(chiave),
});

const chiarimento = (chiave, frase) => ({
  stato: "chiarimento",
  troppe: 0,
  frase,
  righe: [],
  limite: null,
  candidati: [],
  ...dove(chiave),
});

/**
 * PIÙ CANDIDATI: SI CHIEDE QUALE, NON SI SCEGLIE.
 *
 * ⚠️ Vale solo dove la risposta CAMBIA a seconda del candidato — quanto ne
 * ho, quali allergeni ha. Dove invece si può rispondere per tutti («ho la
 * ricetta di…», «quando scade…»), elencarli tutti *è* la risposta, e
 * fermarsi a chiedere sarebbe un passaggio in più per niente.
 */
const scegli = (chiave, frase, candidati, extra = {}) => {
  // ⚠️ ANCHE I CANDIDATI SONO UN ELENCO, e su un magazzino vero «quanto
  //    pomodoro ho?» può trovarne quindici: quindici pulsanti su un telefono
  //    tenuto in una mano non sono una domanda, sono un muro. Si taglia come
  //    gli altri elenchi, **dichiarandolo**, e la frase continua a dire il
  //    numero vero.
  const tutti = candidati ?? [];
  return {
    stato: "scegli",
    frase,
    righe: [],
    troppe: Math.max(0, tutti.length - RIGHE_MOSTRATE),
    limite: null,
    candidati: tutti.slice(0, RIGHE_MOSTRATE),
    ...dove(chiave),
    ...extra,
  };
};

/**
 * ERA UNA DOMANDA, MA NON È FRA LE NOVE.
 *
 * ⚠️ L'ELENCO DELLE NOVE NON SI TAGLIA, ed è l'unica risposta che fa
 * eccezione: le altre elencano **dati** — e lì sei righe bastano, il resto
 * si va a guardare nella sua schermata. Queste non sono dati: sono *cosa
 * MEMO sa fare*, e mostrarne sei su nove significherebbe nascondere tre
 * cose che il gestionale sa rispondere, senza nessun posto dove andarle a
 * leggere. Il taglio ha senso quando esiste un «tutte» da qualche parte.
 *
 * ⚠️ E LA VIA D'USCITA C'È QUANDO IL MODELLO HA CAPITO L'AREA: «quanto mi
 * costa la carbonara» è una domanda di Ricettario che MEMO non sa fare, e
 * lì mandare al Ricettario è utile. Se l'area non è stata capita non si
 * inventa una destinazione — un collegamento messo per riempire il posto
 * manderebbe a cercare in una schermata scelta a caso.
 */
const nonSoFarlo = (area) => ({
  stato: "non_so_farlo",
  frase:
    "Questa domanda non la so ancora fare. Per ora so rispondere a queste, e a nient'altro:",
  righe: Object.entries(DOMANDE_CHE_SO).map(([chiede, d]) => ({
    chiave: chiede,
    testo: d.esempio,
  })),
  troppe: 0,
  limite: null,
  candidati: [],
  ...(DOVE[area] ?? { a: null, apri: null }),
});

// =====================================================================
// RICETTARIO
// =====================================================================

const nomeRicetta = (r) => r?.name ?? "senza nome";

const statoDellaRicetta = (r) =>
  recipeStatusLabel(r?.pronta_per_carta, r?.in_carta, r?.ritirata_il)?.label ?? "in sviluppo";

const rigaRicetta = (r) => ({
  chiave: r.id,
  testo: `${nomeRicetta(r)} — ${statoDellaRicetta(r)}`,
  a: `/ricettario/ricette/${r.id}`,
});

function ricettaEsiste(soggetto, ricette) {
  if (nonLetto(ricette)) return nonLoSo("ricettario", "il Ricettario");
  if (!soggetto) return chiarimento("ricettario", DOMANDE_CHE_SO.ricetta_esiste.chiarimento);

  const trovate = ricette ?? [];
  // 🔴 «NON L'HO TROVATA» SI DICE SOLO DOPO AVER CERCATO DAVVERO, ed è la
  //    ragione per cui la lettura fallita non arriva mai fin qui.
  if (trovate.length === 0) {
    return risposta(
      "ricettario",
      `No: non ho nessuna ricetta che si chiami «${soggetto}».`,
    );
  }
  if (trovate.length === 1) {
    const r = trovate[0];
    return risposta("ricettario", `Sì: «${nomeRicetta(r)}» — ${statoDellaRicetta(r)}.`, [], {
      a: `/ricettario/ricette/${r.id}`,
      apri: "Apri la ricetta",
    });
  }
  return risposta(
    "ricettario",
    `Sì: ne ho ${trovate.length} che contengono «${soggetto}».`,
    trovate.map(rigaRicetta),
  );
}

const nomeAllergene = (a) => labelFor(ALLERGENS, a);

function allergeniDi(soggetto, allergeneChiesto, ricette, allergeni, scelto) {
  if (nonLetto(ricette)) return nonLoSo("ricettario", "il Ricettario");
  if (!soggetto) return chiarimento("ricettario", DOMANDE_CHE_SO.allergeni.chiarimento);

  const trovate = fraICandidati(ricette, scelto, "id");
  if (trovate.length === 0) {
    return risposta(
      "ricettario",
      `Non ho nessuna ricetta che si chiami «${soggetto}»: degli allergeni non ti so dire niente.`,
    );
  }
  if (trovate.length > 1) {
    return scegli(
      "ricettario",
      `Ne ho ${trovate.length} che contengono «${soggetto}»: di quale?`,
      trovate.map((r) => ({ chiave: r.id, testo: nomeRicetta(r), soggetto: nomeRicetta(r) })),
    );
  }

  const r = trovate[0];
  if (nonLetto(allergeni) || !allergeni) {
    return nonLoSo("ricettario", `gli allergeni di «${nomeRicetta(r)}»`);
  }

  const dentro = allergeni.allergens ?? [];
  const tracce = allergeni.tracce ?? [];
  const daVerificare = allergeni.daVerificare === true;
  const scoperti = allergeni.ingredienti ?? [];
  const apri = { a: `/ricettario/ricette/${r.id}`, apri: "Apri la ricetta" };

  // ⚠️ IL LIMITE VA DETTO ANCHE QUANDO LA RISPOSTA C'È: un elenco allergeni
  //    di un piatto i cui ingredienti nessuno ha guardato non è un elenco
  //    completo, ed è la lezione del 13/08 — un elenco vuoto si legge «non
  //    contiene allergeni», e su un'allergia quella lettura è un problema
  //    di salute prima che di software.
  const limite = daVerificare
    ? `Attenzione: di ${scoperti.length === 1 ? "un ingrediente" : `${scoperti.length} ingredienti`} gli allergeni non li ha guardati nessuno${
        scoperti.length ? ` (${scoperti.join(", ")})` : ""
      }. L'elenco può essere incompleto.`
    : null;

  if (allergeneChiesto) {
    const cercato = normalizza(allergeneChiesto);
    const combaciaAllergene = (a) =>
      normalizza(a) === cercato || normalizza(nomeAllergene(a)) === cercato;
    const nome = nomeAllergene(
      dentro.find(combaciaAllergene) ?? tracce.find(combaciaAllergene) ?? allergeneChiesto,
    );

    if (dentro.some(combaciaAllergene)) {
      return risposta("ricettario", `Sì: «${nomeRicetta(r)}» contiene ${nome}.`, [], {
        ...apri,
        limite,
      });
    }
    if (tracce.some(combaciaAllergene)) {
      return risposta(
        "ricettario",
        `«${nomeRicetta(r)}» non contiene ${nome}, ma può contenerne tracce.`,
        [],
        { ...apri, limite },
      );
    }
    // 🔴 QUI IL «NO» NON SI PUÒ DARE, e questa è la riga più importante del
    //    modulo. Se di qualche ingrediente nessuno ha guardato gli
    //    allergeni, «non contiene sedano» è una promessa che nessuno può
    //    mantenere — e chi la legge la gira a un cliente.
    if (daVerificare) {
      return {
        ...nonLoSo("ricettario", `tutti gli ingredienti di «${nomeRicetta(r)}»`),
        frase: `Non te lo so dire: di ${
          scoperti.length === 1 ? "un ingrediente" : `${scoperti.length} ingredienti`
        } gli allergeni non li ha guardati nessuno${
          scoperti.length ? ` (${scoperti.join(", ")})` : ""
        }, quindi «non contiene ${nome}» non te lo posso garantire.`,
        ...apri,
      };
    }
    return risposta("ricettario", `No: «${nomeRicetta(r)}» non contiene ${nome}.`, [], apri);
  }

  if (dentro.length === 0 && !daVerificare) {
    return risposta("ricettario", `«${nomeRicetta(r)}» non contiene nessun allergene.`, [], apri);
  }
  return risposta(
    "ricettario",
    dentro.length === 0
      ? `Di «${nomeRicetta(r)}» non risulta nessun allergene, ma l'elenco non è completo.`
      : `«${nomeRicetta(r)}» contiene: ${dentro.map(nomeAllergene).join(", ")}.`,
    tracce.length
      ? [{ chiave: "tracce", testo: `Può contenere tracce di: ${tracce.map(nomeAllergene).join(", ")}` }]
      : [],
    { ...apri, limite },
  );
}

function piattiInCarta(ricette) {
  if (nonLetto(ricette)) return nonLoSo("carta", "il Ricettario");
  const inCarta = ricette ?? [];
  if (inCarta.length === 0) {
    return risposta("carta", "Non c'è nessun piatto in carta.");
  }
  return risposta(
    "carta",
    inCarta.length === 1 ? "In carta c'è un piatto solo:" : `In carta ci sono ${inCarta.length} piatti:`,
    inCarta.map((r) => ({
      chiave: r.id,
      testo: nomeRicetta(r),
      a: `/ricettario/ricette/${r.id}`,
    })),
  );
}

// =====================================================================
// MAGAZZINO
// =====================================================================

const quantoNeHo = (g) => qtaConUnita(g.current_quantity, g.unit);

function quantoHo(soggetto, giacenze, scelto) {
  if (nonLetto(giacenze)) return nonLoSo("magazzino", "il Magazzino");
  if (!soggetto) return chiarimento("magazzino", DOMANDE_CHE_SO.quanto_ho.chiarimento);

  const combacianti = (giacenze ?? []).filter((g) => combacia(g.ingredient_name, soggetto));

  // 🔴 CHI NOMINA LA COSA VIENE PRIMA DI CHI LA CONTIENE — 07/09/2026, dal
  //    collaudo a mano di Alessio. Fra i candidati per «olio» compariva
  //    «Pomodoro secco di Pachino sott'olio»: una parola dentro il nome
  //    trattata come se definisse il prodotto.
  // ⚠️ E LA RICERCA DENTRO IL NOME NON SI TOGLIE, si mette dopo: senza,
  //    chiedere «pachino» o «extravergine» — cioè con una parola che in
  //    testa non c'è — non troverebbe più niente, e un prodotto
  //    diventerebbe irraggiungibile. Si guarda in testa; **solo se in testa
  //    non c'è nessuno** si torna a guardare dentro.
  const intestati = combacianti.filter((g) => nominaLaCosa(g.ingredient_name, soggetto));
  const candidati = intestati.length > 0 ? intestati : combacianti;

  // ⚠️ E QUELLO CHE SI LASCIA FUORI SI DICHIARA. Una scrematura silenziosa è
  //    la stessa famiglia dell'elenco tagliato senza dirlo: chi guarda non
  //    ha modo di sapere che il gestionale ha scelto per lui.
  const fuori = combacianti.filter((g) => !candidati.includes(g));
  const scremati = fuori.length
    ? `Ho lasciato fuori ${fuori.length === 1 ? "un prodotto che ha" : `${fuori.length} prodotti che hanno`} «${soggetto}» nel nome senza esserlo (per esempio «${fuori[0].ingredient_name}»).`
    : null;

  const trovati = fraICandidati(candidati, scelto, "ingredient_id");

  // 🔴 «NON CE L'HO» NON È «ZERO». Uno zero si legge «l'ho finito», e non è
  //    la stessa cosa di «questa roba in magazzino non esiste proprio».
  if (trovati.length === 0) {
    return risposta("magazzino", `«${soggetto}» non ce l'ho in magazzino: non lo trovo fra i prodotti.`);
  }
  if (trovati.length > 1) {
    return scegli(
      "magazzino",
      `Ne ho ${trovati.length} che si chiamano così: di quale?`,
      trovati.map((g) => ({
        chiave: g.ingredient_id,
        testo: g.ingredient_name,
        soggetto: g.ingredient_name,
      })),
      { limite: scremati },
    );
  }

  const g = trovati[0];

  // 🔴 UN PRODOTTO FUORI MAGAZZINO NON HA UN NUMERO DA DIRE, e questa non è
  //    una rifinitura: il Magazzino, al posto della giacenza, scrive
  //    **«fuori magazzino»** — perché quel numero è quello dell'ultimo
  //    carico e non scenderà mai. Dirlo con una cifra sarebbe *informazione
  //    di assenza spacciata per misura*, e uno zero si legge «l'ho finito».
  //    ⚠️ L'ha trovato la revisione del diff: la prima stesura rispondeva
  //    «Ghiaccio secco: 0 kg» e ci metteva sotto un'avvertenza. Ma
  //    **un'avvertenza accanto non sana il numero**, e soprattutto la
  //    risposta di MEMO non sarebbe più stata la stessa cosa che si legge
  //    aprendo la schermata — cioè la promessa su cui poggia tutta la fase 1.
  if (g.tenuto_in_magazzino === false) {
    return risposta(
      "magazzino",
      `«${g.ingredient_name}» ce l'hai, ma non lo tieni in magazzino: la giacenza non la seguo.`,
      [],
      {
        limite:
          "Di questi prodotti il gestionale non conta quello che entra e quello che esce: si comprano quando servono.",
      },
    );
  }

  const righe = [];
  if (g.below_threshold) {
    righe.push({
      chiave: "soglia",
      testo: `È sotto la scorta minima (${qtaConUnita(g.stock_minimum_threshold, g.unit)}).`,
    });
  }
  if (g.nearest_expiry) {
    righe.push({ chiave: "scadenza", testo: `La prima partita scade il ${formatDate(g.nearest_expiry)}.` });
  }

  return risposta("magazzino", `${g.ingredient_name}: ${quantoNeHo(g)}.`, righe, {
    limite: scremati,
  });
}

function cosaManca(giacenze) {
  if (nonLetto(giacenze)) return nonLoSo("magazzino", "il Magazzino");
  const tutte = giacenze ?? [];
  // 🔴 STESSO CRITERIO DELLA SCHERMATA, riga per riga: un prodotto fuori
  //    magazzino **non è mai «sotto soglia»** — la sua giacenza non scende,
  //    quindi il confronto non vuol dire niente, e in lista della spesa non
  //    ci entra comunque. Contarlo qui farebbe dire a MEMO che manca una
  //    cosa che il Magazzino non segnala: due parti dello stesso gestionale
  //    che raccontano cose diverse dello stesso fatto.
  const sotto = tutte.filter(
    (g) => g.below_threshold === true && g.tenuto_in_magazzino !== false,
  );

  // ⚠️ IL LIMITE È LA META' DELLA RISPOSTA. Sotto la scorta minima ci va
  //    solo chi una scorta minima ce l'ha: senza dirlo, un «non manca
  //    niente» sembrerebbe una fotografia del magazzino intero mentre è la
  //    fotografia dei soli prodotti che qualcuno ha impostato.
  const senzaSoglia = tutte.filter(
    (g) => g.stock_minimum_threshold == null && g.tenuto_in_magazzino !== false,
  ).length;
  const limite = senzaSoglia
    ? `${senzaSoglia === 1 ? "Un prodotto non ha" : `${senzaSoglia} prodotti non hanno`} una scorta minima: ${senzaSoglia === 1 ? "quello" : "quelli"} qui non ${senzaSoglia === 1 ? "può" : "possono"} comparire.`
    : null;

  if (sotto.length === 0) {
    return risposta("magazzino", "Non manca niente: nessun prodotto è sotto la scorta minima.", [], {
      limite,
    });
  }
  return risposta(
    "magazzino",
    sotto.length === 1 ? "Manca una cosa:" : `Mancano ${sotto.length} cose:`,
    sotto.map((g) => ({
      chiave: g.ingredient_id,
      testo: `${g.ingredient_name}: ne hai ${quantoNeHo(g)}, la scorta minima è ${qtaConUnita(g.stock_minimum_threshold, g.unit)}`,
    })),
    { limite },
  );
}

function cosaScade(partite) {
  if (nonLetto(partite)) return nonLoSo("scadenze", "lo scadenziario");
  const tutte = partite ?? [];
  const segnalate = tutte.filter((p) => p.da_segnalare === true);

  // ⚠️ Lo scadenziario tace su certe partite APPOSTA (ne è entrata una più
  //    recente, non c'è scadenza, il preavviso è lontano) e dice perché.
  //    Quel silenzio si dichiara: «non scade niente» senza il numero delle
  //    mute è più corto del vero.
  const mute = tutte.length - segnalate.length;
  const limite = mute
    ? `${mute === 1 ? "Un'altra partita non è segnalata" : `Altre ${mute} partite non sono segnalate`}: il motivo è scritto nello scadenziario.`
    : null;

  if (segnalate.length === 0) {
    return risposta("scadenze", "Non scade niente: nessuna partita è da segnalare.", [], { limite });
  }
  return risposta(
    "scadenze",
    segnalate.length === 1 ? "Una partita è in scadenza:" : `${segnalate.length} partite sono in scadenza:`,
    segnalate.map((p) => ({
      chiave: p.lotto_id,
      testo: `${p.ingrediente}: ${qtaConUnita(p.quantita, p.unita)}, ${scadeInParole(p.giorni_mancanti)}${
        p.scadenza ? ` (${formatDate(p.scadenza)})` : ""
      }`,
    })),
    { limite },
  );
}

// =====================================================================
// AGENDA
// =====================================================================

const rigaImpegno = (t) => ({
  chiave: t.id,
  testo: `${t.title}${t.due_date ? ` — ${formatDate(t.due_date)}` : ""}`,
  a: `/agenda/${t.id}`,
});

function agendaOggi(impegni) {
  if (nonLetto(impegni)) return nonLoSo("agenda", "l'Agenda");
  const tutti = impegni ?? [];
  const oggi = tutti.filter((t) => Number(t.giorni_alla_scadenza) === 0);
  const inRitardo = tutti.filter((t) => t.corsia === "in_ritardo").length;

  // ⚠️ Il ritardo si dice ANCHE quando oggi non c'è niente: «per oggi non
  //    hai niente» con quattordici scadute dietro è vero e fuorviante.
  const limite = inRitardo
    ? `${inRitardo === 1 ? "C'è però un impegno in ritardo" : `Ci sono però ${inRitardo} impegni in ritardo`}.`
    : null;

  if (oggi.length === 0) {
    return risposta("agenda", "Per oggi non hai niente segnato.", [], { limite });
  }
  return risposta(
    "agenda",
    oggi.length === 1 ? "Oggi hai una cosa:" : `Oggi hai ${oggi.length} cose:`,
    oggi.map(rigaImpegno),
    { limite },
  );
}

function agendaInRitardo(impegni) {
  if (nonLetto(impegni)) return nonLoSo("agenda", "l'Agenda");
  const tardi = (impegni ?? []).filter((t) => t.corsia === "in_ritardo");
  if (tardi.length === 0) {
    return risposta("agenda", "Non sei in ritardo su niente.");
  }
  return risposta(
    "agenda",
    tardi.length === 1 ? "Sei in ritardo su una cosa:" : `Sei in ritardo su ${tardi.length} cose:`,
    tardi.map((t) => ({
      ...rigaImpegno(t),
      testo: `${t.title} — scadeva ${quandoInParole(t.giorni_alla_scadenza) ?? "prima"}`,
    })),
  );
}

/**
 * QUANDO SCADE UNA PARTITA IN MAGAZZINO.
 *
 * ⚠️ La domanda e' «quando», quindi la risposta e' una DATA — e le partite
 * sono piu' d'una: si dicono tutte, con quanto ce n'e'. Il confronto con
 * oggi si fa su due date scritte allo stesso modo (AAAA-MM-GG), quindi e'
 * un confronto di testo e non tocca nessun orologio.
 */
function scadenzaDelProdotto(nome, partite, oggi) {
  const conScadenza = partite.filter((p) => p.scadenza);
  const senza = partite.length - conScadenza.length;
  const limite = senza
    ? `${senza === 1 ? "Una partita non ha" : `${senza} partite non hanno`} una scadenza scritta.`
    : null;

  if (conScadenza.length === 0) {
    return risposta(
      "scadenze",
      `Di «${nome}» non c'è nessuna partita con una scadenza scritta.`,
      [],
      { limite },
    );
  }

  const ordinate = [...conScadenza].sort((a, b) => String(a.scadenza).localeCompare(String(b.scadenza)));
  const prima = ordinate[0];
  const scaduta = oggi && String(prima.scadenza) < String(oggi);

  return risposta(
    "scadenze",
    ordinate.length === 1
      ? `${nome}: scade il ${formatDate(prima.scadenza)}${scaduta ? " — è già scaduta" : ""}.`
      : `${nome}: la prima delle ${ordinate.length} partite scade il ${formatDate(prima.scadenza)}${scaduta ? " — è già scaduta" : ""}.`,
    ordinate.map((p) => ({
      chiave: p.lotto_id,
      testo: `${qtaConUnita(p.giacenza, p.unita)} — ${formatDate(p.scadenza)}${
        oggi && String(p.scadenza) < String(oggi) ? " (scaduta)" : ""
      }`,
    })),
    { limite },
  );
}

/**
 * QUANDO SCADE — e la cosa che scade puo' stare in due posti.
 *
 * 🔴 IL DIFETTO CHE CHIUDE, dal collaudo a mano del 07/09/2026: «quando
 * scade l'astice?» cercava un IMPEGNO chiamato astice, e rispondeva che non
 * lo trovava. L'astice sta in cella.
 *
 * ⚠️ IL MAGAZZINO VIENE PRIMA, l'Agenda dopo — a meno che la frase non
 * nomini l'Agenda. E chi non trova niente nel posto scelto **guarda
 * comunque nell'altro**: la precedenza decide l'ordine, non l'esito.
 */
function quandoScade(soggetto, letture) {
  const impegni = letture.impegni;
  const partite = letture.partite;
  const oggi = letture.oggi ?? null;
  const primaLAgenda = letture.agendaEsplicita === true;

  // ⚠️ Se ne'e' letta nessuna delle due, non si sa e basta.
  if (nonLetto(impegni) && nonLetto(partite)) return nonLoSo("scadenze", "il Magazzino e l'Agenda");
  if (!soggetto) return chiarimento("scadenze", DOMANDE_CHE_SO.quando_scade.chiarimento);

  const inMagazzino = nonLetto(partite) ? [] : (partite ?? []);
  const combacianti = inMagazzino.filter((p) => combacia(p.prodotto, soggetto));
  const intestate = combacianti.filter((p) => nominaLaCosa(p.prodotto, soggetto));
  const dellaCosa = intestate.length > 0 ? intestate : combacianti;
  const nomeProdotto = dellaCosa[0]?.prodotto ?? null;

  const inAgenda = nonLetto(impegni) ? [] : (impegni ?? []).filter((t) => combacia(t.title, soggetto));

  // ⚠️ Quando la cosa sta in tutt'e due i posti non si sceglie in silenzio:
  //    si risponde dove dice la precedenza e si DICHIARA l'altra.
  const anche = (dove, quanti) =>
    quanti > 0
      ? `C'è anche ${quanti === 1 ? "una cosa" : `${quanti} cose`} che si chiama così ${dove}.`
      : null;

  if (primaLAgenda && inAgenda.length > 0) {
    return daAgenda(soggetto, inAgenda, anche("in magazzino", dellaCosa.length));
  }
  if (!primaLAgenda && dellaCosa.length > 0) {
    const r = scadenzaDelProdotto(nomeProdotto, dellaCosa, oggi);
    return { ...r, limite: [r.limite, anche("in Agenda", inAgenda.length)].filter(Boolean).join(" ") || null };
  }
  if (inAgenda.length > 0) return daAgenda(soggetto, inAgenda, null);
  if (dellaCosa.length > 0) return scadenzaDelProdotto(nomeProdotto, dellaCosa, oggi);

  // 🔴 «NON LO TROVO» SI PUÒ DIRE SOLO SE SI È GUARDATO IN TUTT'E DUE I
  //    POSTI. Se una delle due letture è caduta, «non c'è» sarebbe la
  //    bugia peggiore: è la regola del 19/08 — assenza di informazione e
  //    informazione di assenza sono due cose diverse.
  if (nonLetto(partite)) return nonLoSo("scadenze", "il Magazzino");
  if (nonLetto(impegni)) return nonLoSo("agenda", "l'Agenda");

  // ⚠️ E quando le ha guardate tutte e due lo DICE: senza, «non lo trovo»
  //    non fa capire dove è stato cercato.
  return risposta(
    "scadenze",
    `Non trovo niente che si chiami «${soggetto}»: né fra le cose in magazzino, né fra gli impegni da fare.`,
    [],
    { limite: "Degli impegni guardo solo quelli ancora da fare, e del magazzino solo le partite ancora in casa." },
  );
}

function daAgenda(soggetto, trovati, anche) {
  // ⚠️ L'Agenda a corsie porta i soli impegni APERTI: uno già fatto non
  //    compare, e va detto — altrimenti «non lo trovo» si legge «non esiste».
  const limite = [
    "Guardo solo gli impegni ancora da fare: quelli già fatti non li vedo.",
    anche,
  ]
    .filter(Boolean)
    .join(" ");

  if (trovati.length === 1) {
    const t = trovati[0];
    if (!t.due_date) {
      return risposta("agenda", `«${t.title}» non ha una scadenza: è fra le cose da fare quando capita.`, [], {
        a: `/agenda/${t.id}`,
        apri: "Apri l'impegno",
        limite,
      });
    }
    return risposta(
      "agenda",
      `«${t.title}» scade il ${formatDate(t.due_date)} — ${quandoInParole(t.giorni_alla_scadenza)}.`,
      [],
      { a: `/agenda/${t.id}`, apri: "Apri l'impegno", limite },
    );
  }
  return risposta(
    "agenda",
    `Ne ho ${trovati.length} che contengono «${soggetto}»:`,
    trovati.map((t) => ({
      ...rigaImpegno(t),
      testo: t.due_date
        ? `${t.title} — ${formatDate(t.due_date)} (${quandoInParole(t.giorni_alla_scadenza)})`
        : `${t.title} — senza scadenza`,
    })),
    { limite },
  );
}

// =====================================================================
// L'UNICA PORTA
// =====================================================================

/**
 * La risposta scritta, composta dai dati già letti.
 *
 * @param domanda  `{ chiede, soggetto, allergene }` — quello che il modello
 *                 ha capito, niente di più.
 * @param letture  i dati già letti dal gestionale, ognuno eventualmente
 *                 marcato `NON_LETTO`.
 */
export function componiRisposta(domanda, letture = {}) {
  const chiede = domanda?.chiede ?? null;
  const soggetto = domanda?.soggetto?.trim() || null;
  // ⚠️ Quale dei candidati è stato toccato: arriva dal gesto, non dal nome.
  const scelto = domanda?.scelto ?? null;
  if (!chiede || !DOMANDE_CHE_SO[chiede]) return nonSoFarlo(domanda?.area ?? null);

  switch (chiede) {
    case "ricetta_esiste":
      return ricettaEsiste(soggetto, letture.ricette);
    case "allergeni":
      return allergeniDi(
        soggetto,
        domanda?.allergene ?? null,
        letture.ricette,
        letture.allergeni,
        scelto,
      );
    case "piatti_in_carta":
      return piattiInCarta(letture.ricette);
    case "quanto_ho":
      return quantoHo(soggetto, letture.giacenze, scelto);
    case "cosa_manca":
      return cosaManca(letture.giacenze);
    case "cosa_scade":
      return cosaScade(letture.partite);
    case "agenda_oggi":
      return agendaOggi(letture.impegni);
    case "agenda_in_ritardo":
      return agendaInRitardo(letture.impegni);
    case "quando_scade":
      return quandoScade(soggetto, letture);
    default:
      return nonSoFarlo(domanda?.area ?? null);
  }
}

/**
 * Il titolo del riquadro: la domanda, com'è stata capita.
 *
 * 🔴 NON È L'ESEMPIO COL SOGGETTO APPICCICATO, e la prima stesura lo era:
 * col modello vero, «ho la ricetta della caponata?» diventava a schermo
 * *«Ho la ricetta della carbonara — «caponata»»*. Cioè il titolo nominava
 * un piatto che nessuno aveva detto. ⚠️ L'ha visto un occhio guardando il
 * collaudo, non una prova: nessuna asserzione guardava quella stringa.
 */
export function titoloDellaDomanda(domanda) {
  const nota = DOMANDE_CHE_SO[domanda?.chiede];
  if (!nota) return "Mi hai fatto una domanda";
  const soggetto = domanda?.soggetto?.trim();
  if (!soggetto) return nota.senzaSoggetto ?? nota.titolo;
  return nota.titolo.replace("{x}", soggetto);
}
