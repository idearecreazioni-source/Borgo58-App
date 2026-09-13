// =====================================================================
// L'AGENDA A VOCE — quello che il gestionale sa fare, e quello che no
// =====================================================================
// Alessio detta tre cose diverse sull'Agenda:
//   1. «Ricordami di chiamare Tiziana domani»            → CREA un impegno
//   2. «Segna come fatto il rinnovo della firma»          → CHIUDE un impegno
//   3. «Sposta a venerdì l'ordine delle verdure»          → SPOSTA un impegno
//
// 🔴 IL GESTIONALE OGGI SA FARE SOLO LA PRIMA, ed è una cosa misurata, non
//    una scelta: il catalogo delle azioni vocali ha `promemoria` («Annota
//    in Agenda») con il suo ramo che scrive, e non ha nessun tipo per
//    chiudere o spostare. Aggiungerlo vuol dire una riga nel catalogo **e**
//    un ramo dentro `fai_azione_dettata`, cioè una migrazione — e questo
//    lavoro non ne fa nessuna.
//
// 🔴 E IL DIFETTO CHE QUESTO MODULO CHIUDE È PROPRIO LÌ. Senza, «segna come
//    fatto il rinnovo della firma digitale» il modello lo capisce come la
//    cosa più vicina che conosce: un promemoria. Nasce quindi un impegno
//    NUOVO intitolato «Segna come fatto il rinnovo della firma digitale»,
//    approvabile, accanto a quello vero che resta aperto. Due righe che
//    dicono la stessa cosa, e nessun errore da nessuna parte.
//    ⚠️ È la stessa forma del difetto del 06/09 sulle due liste: una cosa
//    ricondotta alla più vicina che il gestionale sa fare.
//
// ⚠️ QUELLO CHE SI FA AL SUO POSTO, ed è la regola di SPEC-0013: se
//    l'intenzione si riconosce ma il gesto non esiste, l'appunto **nasce
//    lo stesso** e dichiara che la destinazione eseguibile manca. Non si
//    approva — il tipo non è nel catalogo, quindi non è eseguibile per
//    costruzione — e dice in italiano cosa fare in Agenda.

export type AzioneDettata = {
  tipo?: string;
  sicuro?: boolean;
  frase?: string;
  destinazione?: string;
  motivo?: string;
  dati?: Record<string, unknown>;
  [k: string]: unknown;
};

/** Il tipo che il gestionale sa eseguire: crea un impegno in Agenda. */
export const TIPO_PROMEMORIA = "promemoria";

// 🔴 QUESTI TRE NON SONO NEL CATALOGO, ED È IL MODO IN CUI NON SI APPROVANO.
//    Non è una dimenticanza da sanare: `siPuoApprovare()` guarda
//    `eseguibile`, che il database ricava dal catalogo. Un tipo che lì non
//    c'è nasce non approvabile **per costruzione**, senza nessun controllo
//    da ricordare. È lo stesso meccanismo con cui, il 07/09, un anticipo da
//    rimborsare non è potuto finire nella tasca.
//    ⚠️ E se un giorno uno di questi entrasse nel catalogo con il suo ramo,
//    diventerebbe approvabile da solo: è la strada per costruirlo, non un
//    ostacolo.
export const TIPO_FATTO = "agenda_da_segnare_fatto";
export const TIPO_SPOSTA = "agenda_da_spostare";
export const TIPO_QUALE = "agenda_quale_impegno";

// 🔴 «DA CHIARIRE» — 11/09/2026, decisione di Alessio sul mandato «MEMO
//    affidabile». Nasce quando in una frase MISTA — cose nuove da segnare e
//    uno spostamento o una chiusura — non si riesce a dire con certezza quale
//    parte va con quale. Le sue parole: *«gli elementi ambigui devono restare
//    appunti non approvabili e spiegare il motivo. Non deve mai accadere che
//    un impegno esistente venga spostato al posto di un nuovo appuntamento.»*
// ⚠️ NON È NEL CATALOGO, apposta, ed è lo stesso meccanismo dei tre qui
//    sopra: un tipo che lì non c'è nasce non approvabile per costruzione.
//    E NON È `agenda_quale_impegno`: quello, quando porta un gesto, il
//    database lo ritraduce cercando in Agenda — e se trovasse un impegno
//    solo lo renderebbe approvabile. Qui non si deve cercare niente.
export const TIPO_CHIARIRE = "agenda_da_chiarire";

// 🔴 IL COLLEGAMENTO ALL'AGENDA NON VIAGGIA PIU' QUI — 09/09/2026, fase 2.
//    Fino a ieri questo modulo si portava dietro l'indirizzo dentro i dati
//    dell'appunto, perche' `azione_percorso` — che e' il posto dove quella
//    cosa vive dal 27/08 — per un tipo fuori catalogo rispondeva
//    giustamente niente, e aggiungercelo voleva dire una migrazione che
//    quel lavoro non poteva fare.
//    ⚠️ Adesso la migrazione c'e', e tutt'e tre le destinazioni dell'Agenda
//    hanno la loro riga nel database. Il ripiego si toglie invece di
//    restare: due posti che dicono dove si va sono due posti che un giorno
//    diranno cose diverse — ed e' esattamente la ragione per cui quella
//    regola era stata scritta.

const testo = (v: unknown): string | null => {
  if (typeof v !== "string") return null;
  const p = v.trim();
  return p === "" ? null : p;
};

/** Minuscolo, senza accenti, coi segni ridotti a spazi. */
function nudo(t: string): string {
  return String(t ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// ---------------------------------------------------------------------
// LE PAROLE CHE DISTINGUONO LE TRE COSE
// ---------------------------------------------------------------------
// ⚠️ È UN ELENCO DI PAROLE, la forma che questo progetto diffida — e regge
//    per la stessa ragione dell'elenco delle aperture di domanda: **sbaglia
//    in un verso solo**. Una frase che l'elenco non riconosce resta quello
//    che il modello aveva capito (di solito un promemoria): rumore, si
//    butta in un tocco. Il verso pericoloso — un impegno nuovo scambiato
//    per una chiusura — non può capitare, perché queste parole in una
//    frase che crea qualcosa non ci sono.
//
// ⚠️ E LA RETE NON SOSTITUISCE IL MODELLO, lo corregge: al modello si
//    chiede comunque di distinguere (vedi `istruzioniAgenda()`), e queste
//    parole servono per quando non ci riesce. Due strade per lo stesso
//    fatto, e quella deterministica ha l'ultima parola.
const PAROLE_FATTO = [
  "segna come fatto",
  "segna fatto",
  "segnalo come fatto",
  "segnala come fatto",
  // 🔴 LE DUE FORME AL FEMMINILE — 13/09/2026, dal collaudo su Borgo58-Prova:
  //    «segna come fatta l'IVA» e «segnala come fatta l'IVA» restavano «da
  //    chiarire» perché qui c'era solo il maschile, e con un nome femminile
  //    (l'IVA, l'assemblea) è la frase che viene da sé. ⚠️ Solo queste due:
  //    «segnalo come fatta» non concorda, e «segna fatta» nessuno l'ha
  //    chiesta — l'elenco cresce con le frasi vere, non per simmetria.
  "segna come fatta",
  "segnala come fatta",
  "l ho fatto",
  "l ho fatta",
  "e fatto",
  "e fatta",
  "ho gia fatto",
  "spunta",
  "chiudi l impegno",
  "togli dall agenda",
  "togli dalla lista delle cose da fare",
];

const PAROLE_SPOSTA = [
  "sposta",
  "spostalo",
  "spostala",
  "rimanda",
  "rimandalo",
  "rimandala",
  "rimandiamo",
  "posticipa",
  "rinvia",
  "rimettilo",
  "cambia la data",
];

/**
 * Che cosa vuole fare, guardando la frase DETTA.
 *
 * ⚠️ SI GUARDA IL DETTATO, non il riassunto del modello — 07/09/2026, dalla
 * spesa della tasca: il modello aveva dichiarato benissimo il fatto e poi
 * aveva scritto di suo un riassunto che diceva un'altra cosa, e la regola
 * leggeva quello. *Un riassunto scritto da chi interpreta non è una fonte:
 * è già un'interpretazione.*
 */
export function cosaVuoleFare(dettato: string): "fatto" | "sposta" | "altro" {
  const t = nudo(dettato);
  if (t === "") return "altro";
  // 🔴 LE PAROLE SI CERCANO INTERE — 11/09/2026. Fino a oggi quelle della
  //    chiusura si cercavano DENTRO le altre: «ordinare le spuntature di
  //    maiale» conteneva «spunta», e l'impegno nuovo diventava «da segnare
  //    fatto». Quelle dello spostamento avevano già il confine di parola.
  const intera = (p: string) => ` ${t} `.includes(` ${p} `);
  // ⚠️ «Fatto» si guarda per primo: «sposta a venerdì quello che ho già
  //    fatto» non esiste come frase, mentre «segna come fatto» contiene
  //    parole che nessun elenco di spostamento tocca. L'ordine è la difesa.
  if (PAROLE_FATTO.some(intera)) return "fatto";
  if (PAROLE_SPOSTA.some(intera)) return "sposta";
  return "altro";
}

/** Il gesto che il modello ha dichiarato col tipo, se ne ha dichiarato uno. */
function gestoDichiarato(azione: AzioneDettata): "fatto" | "sposta" | null {
  if (azione?.tipo === TIPO_FATTO) return "fatto";
  if (azione?.tipo === TIPO_SPOSTA) return "sposta";
  return null;
}

const eDiAgenda = (azione: AzioneDettata) =>
  azione?.tipo === TIPO_PROMEMORIA || azione?.tipo === TIPO_FATTO || azione?.tipo === TIPO_SPOSTA;

// ---------------------------------------------------------------------
// OGNI COSA DETTA COL SUO PEZZO DI FRASE — 11/09/2026, variante (a)
// ---------------------------------------------------------------------
// 🔴 IL DIFETTO CHE QUESTA PARTE CHIUDE, misurato dal vivo: la rete
//    guardava la frase INTERA per ogni azione. «Ricordami il dentista
//    lunedì, la riunione martedì… e sposta a venerdì l'ordine delle
//    verdure» faceva diventare TUTTI gli appuntamenti nuovi «da spostare»;
//    e se in Agenda c'era già un impegno con quel nome, approvando si
//    spostava QUELLO e il nuovo non nasceva.
//
// ⚠️ LA REGOLA DEL 07/09 RESTA INTERA: si guardano le parole DETTE, non un
//    riassunto del modello. Al modello si chiede solo DOVE tagliare, e il
//    taglio vale se e soltanto se è una copia esatta di un pezzo della
//    frase detta — altrimenti è già un'interpretazione, e non si usa.

/**
 * Un pezzo di frase da cui si può decidere, oppure `null`.
 *
 * Vale solo se è davvero stato detto: le sue parole, intere e di seguito,
 * stanno nella frase detta — e una volta sola, perché un pezzo che compare
 * due volte non dice quale delle due è la sua.
 */
function pezzoDetto(azione: AzioneDettata, dettato: string): { testo: string; da: number; a: number } | null {
  const p = nudo(typeof azione?.pezzo === "string" ? azione.pezzo : "");
  if (p === "") return null;
  const tutta = ` ${nudo(dettato)} `;
  const cercato = ` ${p} `;
  const da = tutta.indexOf(cercato);
  if (da < 0 || tutta.lastIndexOf(cercato) !== da) return null;
  return { testo: p, da, a: da + cercato.length - 1 };
}

/**
 * I pezzi di TUTTA la filza, se la separazione è certa; altrimenti `null`.
 *
 * 🔴 CERTA VUOL DIRE TRE COSE INSIEME, e basta che ne manchi una:
 *    1. ogni cosa detta ha il suo pezzo, ed è stato detto davvero;
 *    2. i pezzi non si sovrappongono — due cose non possono dividersi le
 *       stesse parole, o non si sa di chi siano;
 *    3. con più cose, nessun pezzo è la frase intera: quello non è un
 *       taglio, è la frase di prima.
 * ⚠️ Si guardano TUTTE le azioni, non solo quelle dell'Agenda: «sposta i
 *    pomodori in cella e ricordami il dentista» è una frase mista anche se
 *    lo spostamento non riguarda l'Agenda, e la parola «sposta» deve poter
 *    essere attribuita a qualcuno prima di decidere del dentista.
 */
export function pezziSeparati(azioni: AzioneDettata[], dettato: string): string[] | null {
  const lista = azioni ?? [];
  if (lista.length === 0) return null;
  const intera = nudo(dettato);
  const pezzi = lista.map((a) => pezzoDetto(a, dettato));
  if (pezzi.some((p) => p === null)) return null;
  const certi = pezzi as { testo: string; da: number; a: number }[];
  if (lista.length > 1 && certi.some((p) => p.testo === intera)) return null;
  const ordinati = [...certi].sort((x, y) => x.da - y.da);
  for (let i = 1; i < ordinati.length; i++) {
    if (ordinati[i].da < ordinati[i - 1].a) return null;
  }
  return certi.map((p) => p.testo);
}

const MOTIVO_DA_CHIARIRE =
  "In questa frase c'erano insieme cose nuove da segnare e un impegno da spostare o da chiudere, " +
  "e non sono riuscito a capire con certezza quale parte va con quale. Per non rischiare di " +
  "spostare o chiudere un impegno che c'è già al posto di segnarne uno nuovo, questo non si può " +
  "approvare: ridillo con una frase per ogni cosa, oppure fallo a mano in Agenda.";

// 🔴 IL SECONDO MOTIVO — trovato dalla revisione del diff, 11/09/2026. Il
//    modello può dichiarare «da spostare» una frase che di spostare non
//    parla affatto: «ricordami il dentista lunedì» capito come lo
//    spostamento di un impegno «dentista». Con un impegno omonimo in Agenda
//    il database lo troverebbe e lo renderebbe approvabile — cioè
//    esattamente la cosa che non deve succedere mai.
const MOTIVO_GESTO_NON_DETTO =
  "Ho capito che vuoi spostare o chiudere un impegno che c'è già, ma nelle parole che hai " +
  "detto per questa cosa non c'è né uno spostamento né una chiusura: potrebbe essere un " +
  "appuntamento nuovo. Per non toccare un impegno che c'è già al posto di segnarne uno nuovo, " +
  "questo non si può approvare: ridillo dicendo «sposta» o «segna fatto», oppure fallo a mano " +
  "in Agenda.";

/** L'appunto che resta fermo e dice perché. Tiene tutto quello che si era capito. */
function daChiarire(azione: AzioneDettata, motivo = MOTIVO_DA_CHIARIRE): AzioneDettata {
  const titolo = titoloSentito(azione);
  return {
    ...azione,
    tipo: TIPO_CHIARIRE,
    sicuro: true,
    destinazione: "Da chiarire in Agenda",
    dati: { ...soloIlNecessario(azione), ...(titolo ? { titolo } : {}) },
    motivo,
  };
}

/** Il titolo dell'impegno, come l'ha detto lui. */
export function titoloSentito(azione: AzioneDettata): string | null {
  const d = azione?.dati ?? {};
  return (
    testo(d.impegno as string) ??
    testo(d.titolo as string) ??
    testo(d.nome as string) ??
    null
  );
}

/** La data nuova, quando è stata capita. */
export function dataNuova(azione: AzioneDettata): string | null {
  const d = azione?.dati ?? {};
  const v = testo(d.data_nuova as string) ?? testo(d.data as string);
  // ⚠️ Una data che non ha la forma di una data non è una data: meglio
  //    «non l'ho capita» che una stringa messa in un campo data.
  return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}

/**
 * QUELLO CHE MANCA PER POTER PROPORRE QUALCOSA.
 *
 * ⚠️ SI NOMINANO TUTTE LE COSE CHE MANCANO, non la prima: dirne una per
 * volta fa scoprire la seconda dopo aver rimediato alla prima, e alla terza
 * si smette di leggere.
 */
export function cosaManca(azione: AzioneDettata, gesto: "fatto" | "sposta"): string[] {
  const manca: string[] = [];
  if (!titoloSentito(azione)) manca.push("quale impegno");
  // 🔴 LA DATA SERVE SOLO A SPOSTARE, e va chiesta: spostare senza sapere a
  //    quando non vuol dire niente, e inventarla — «a domani», «alla
  //    prossima settimana» — sarebbe decidere al posto suo su una scadenza.
  if (gesto === "sposta" && !dataNuova(azione)) manca.push("a quando");
  return manca;
}

const ELENCO = (pezzi: string[]) =>
  pezzi.length === 1 ? pezzi[0] : `${pezzi.slice(0, -1).join(", ")} e ${pezzi.slice(-1)[0]}`;

/**
 * I dati senza i doppioni del nome dell'impegno.
 *
 * ⚠️ IL MODELLO LO CHIAMA IN TRE MODI (`impegno`, `titolo`, `nome`) e
 * l'appunto li mostrerebbe TUTTI, uno sotto l'altro, con lo stesso valore.
 * Chi legge prima di firmare vedrebbe «impegno: X · titolo: X» e si
 * chiederebbe quali sono le due cose. Il nome resta uno solo — `titolo`,
 * che e' quello che la schermata usa gia' per intestare l'elemento.
 */
function soloIlNecessario(azione: AzioneDettata): Record<string, unknown> {
  const { impegno: _i, titolo: _t, nome: _n, ...resto } = (azione?.dati ?? {}) as Record<
    string,
    unknown
  >;
  return resto;
}

/**
 * DOVE VA A FINIRE UNA FRASE SULL'AGENDA.
 *
 * Tre esiti, e uno solo si può approvare:
 *   · `promemoria`  → crea un impegno. Il gestionale lo sa fare.
 *   · `agenda_da_segnare_fatto` / `agenda_da_spostare` → l'intenzione è
 *     chiara, il gesto non esiste ancora: l'appunto resta e dice cosa fare.
 *   · `agenda_quale_impegno` → manca qualcosa, e non si inventa.
 */
export function destinazioneAgenda(azione: AzioneDettata, dettato = ""): AzioneDettata {
  // ⚠️ Si tocca solo ciò che parla di Agenda: una temperatura o una spesa
  //    non devono cambiare comportamento per colpa di questo modulo.
  if (!eDiAgenda(azione)) return azione;

  // Il gesto lo decide il modello quando lo dichiara, e il dettato quando
  // il modello non ci arriva.
  // ⚠️ `dettato` qui sono le parole che riguardano QUESTA azione: la frase
  //    intera quando è stata detta per lei sola, il suo pezzo quando nella
  //    stessa frase c'erano altre cose. A sceglierle è `correggiAgenda`.
  const dichiarato = gestoDichiarato(azione);
  const gesto = dichiarato ?? cosaVuoleFare(dettato);

  if (gesto === "altro") return azione;

  const manca = cosaManca(azione, gesto as "fatto" | "sposta");
  if (manca.length > 0) {
    return {
      ...azione,
      tipo: TIPO_QUALE,
      sicuro: true,
      destinazione: "Quale impegno?",
      dati: soloIlNecessario(azione),
      motivo:
        `Ho capito che vuoi ${gesto === "fatto" ? "chiudere" : "spostare"} un impegno, ` +
        `ma non ho capito ${ELENCO(manca)}. Ridimmelo nominando l'impegno come si chiama ` +
        `in Agenda${gesto === "sposta" ? " e il giorno nuovo" : ""}, oppure aprilo in Agenda e fallo lì.`,
    };
  }

  const titolo = titoloSentito(azione);
  if (gesto === "fatto") {
    return {
      ...azione,
      tipo: TIPO_FATTO,
      sicuro: true,
      destinazione: "Da segnare fatto in Agenda",
      dati: { ...soloIlNecessario(azione), titolo, gesto: "segna fatto" },
      // ⚠️ NESSUN MOTIVO SCRITTO QUI, dalla fase 2. Fin quando il gesto non
      //    esisteva, questo modulo era l'unico che sapesse dirlo. Adesso
      //    chi sa com'e' andata e' il DATABASE — ha guardato in Agenda e
      //    sa se l'impegno e' uno, nessuno o tanti — e il motivo lo scrive
      //    lui. Lasciarne uno qui vorrebbe dire coprire quello vero con una
      //    frase scritta prima di aver guardato.
    };
  }

  const quando = dataNuova(azione);
  return {
    ...azione,
    tipo: TIPO_SPOSTA,
    sicuro: true,
    destinazione: "Da spostare in Agenda",
    dati: { ...soloIlNecessario(azione), titolo, data_nuova: quando, gesto: "sposta" },
    // ⚠️ Come sopra: il motivo lo scrive il database, che ha guardato.
  };
}

/**
 * Su tutta la filza, e senza toccare quello che non è Agenda.
 *
 * 🔴 LA REGOLA, per intero (11/09/2026):
 *    · se nella frase non c'è nessuna parola di spostamento o di chiusura,
 *      non c'è niente da decidere: ogni azione resta quella che il modello
 *      ha dichiarato — è il caso di tre appuntamenti nuovi detti insieme;
 *    · se la frase è di una cosa sola, le parole sono la frase intera
 *      (o il suo pezzo, se il modello l'ha tagliato bene) — come prima;
 *    · se le cose sono più d'una e la separazione è CERTA
 *      (`pezziSeparati`), ogni azione si decide sulle SUE parole;
 *    · altrimenti ogni azione dell'Agenda resta DA CHIARIRE: non
 *      approvabile, e dice perché.
 * 🔴 E UNO SPOSTAMENTO O UNA CHIUSURA SI APPROVANO SOLO SE LE PAROLE DI
 *    QUELLA COSA LI DICONO — in qualunque frase, mista o no (revisione del
 *    diff, 11/09/2026). Se il modello li dichiara e le parole no, resta da
 *    chiarire: è la forma esatta in cui un appuntamento nuovo diventerebbe
 *    lo spostamento di un impegno che c'è già. ⚠️ Il prezzo, dichiarato: un
 *    verbo che l'elenco non conosce («anticipa a giovedì la riunione») non
 *    basta più da solo — si ridice con «sposta», o si fa a mano.
 */
export function correggiAgenda(azioni: AzioneDettata[], dettato = ""): AzioneDettata[] {
  const lista = azioni ?? [];
  const misto = cosaVuoleFare(dettato) !== "altro";
  const pezzi = lista.length > 1 ? pezziSeparati(lista, dettato) : null;
  return lista.map((a, i) => {
    // ⚠️ «Quale impegno?» non è un tipo che il modello deve dare: se lo dà,
    //    il database lo ritradurrebbe cercando in Agenda. Resta fermo.
    if (a?.tipo === TIPO_QUALE) return daChiarire(a, MOTIVO_GESTO_NON_DETTO);
    if (!eDiAgenda(a)) return a;

    // Le parole di QUESTA cosa: la frase intera se è stata detta per lei
    // sola, altrimenti il suo pezzo — se la separazione è certa.
    let parole: string | null = null;
    if (lista.length === 1) parole = pezzoDetto(a, dettato)?.testo ?? dettato;
    else if (pezzi) parole = pezzi[i];

    const dichiarato = gestoDichiarato(a);
    if (dichiarato) {
      if (parole === null) {
        return daChiarire(a, misto ? MOTIVO_DA_CHIARIRE : MOTIVO_GESTO_NON_DETTO);
      }
      if (cosaVuoleFare(parole) !== dichiarato) {
        return daChiarire(a, misto ? MOTIVO_DA_CHIARIRE : MOTIVO_GESTO_NON_DETTO);
      }
      return destinazioneAgenda(a, parole);
    }

    // Un promemoria: senza parole di spostamento o chiusura nella frase non
    // c'è niente da decidere — è il caso dei tre appuntamenti detti insieme.
    if (!misto) return destinazioneAgenda(a, dettato);
    if (parole === null) return daChiarire(a);
    return destinazioneAgenda(a, parole);
  });
}

/**
 * Il pezzo di istruzioni che insegna al modello a distinguere le tre cose.
 *
 * ⚠️ SI CHIEDE COMUNQUE AL MODELLO di distinguerle, anche se poi c'è la
 * rete deterministica: la rete conosce le parole di oggi, il modello capisce
 * anche quelle che non ho pensato. Le due strade insieme coprono più di
 * ciascuna da sola, e a decidere è sempre quella deterministica.
 */
export function istruzioniAgenda(): string {
  return `
🔴 SULL'AGENDA CI SONO TRE COSE DIVERSE, E VANNO TENUTE DISTINTE.
- "promemoria": una cosa NUOVA da ricordare. «Ricordami di chiamare Tiziana domani», «aggiungi il rinnovo della firma digitale per venerdi'». dati: { "titolo": "...", "descrizione": "..."|null, "data": "AAAA-MM-GG"|null, "ora": "HH:MM"|null }
- "${TIPO_FATTO}": un impegno che GIA' ESISTE e che e' stato fatto. «Segna come fatto il rinnovo della firma digitale», «l'ho fatto», «spunta l'ordine delle verdure». dati: { "impegno": "il nome dell'impegno come l'ha detto lui" }
- "${TIPO_SPOSTA}": un impegno che GIA' ESISTE e va spostato a un altro giorno. «Sposta a venerdi' l'ordine delle verdure», «rimanda a lunedi' la chiamata al commercialista». dati: { "impegno": "il nome come l'ha detto lui", "data_nuova": "AAAA-MM-GG" }

⚠️ NON RICONDURRE LE ULTIME DUE A UN PROMEMORIA. «Segna come fatto il rinnovo della firma» non e' una cosa nuova da ricordare: e' una cosa gia' scritta che si chiude. Trattandola da promemoria nascerebbe un impegno NUOVO chiamato «segna come fatto il rinnovo della firma», accanto a quello vero che resta aperto — due righe per la stessa cosa, e nessun errore da nessuna parte.
⚠️ IN "impegno" VA IL NOME NUDO, senza il verbo: da «segna come fatto il rinnovo della firma digitale» esce "rinnovo della firma digitale", non "segna come fatto il rinnovo…".
⚠️ SE NON HA DETTO A QUANDO SPOSTARE, lascia "data_nuova" a null: il gestionale glielo chiedera'. Non mettere una data che non ha detto.
🔴 IN UNA FRASE CON PIU' COSE, IL "pezzo" DI OGNUNA E' QUELLO CHE DECIDE: se dice «ricordami il dentista lunedi' e sposta a venerdi' l'ordine delle verdure», il pezzo del dentista e' «ricordami il dentista lunedi'» e quello delle verdure «sposta a venerdi' l'ordine delle verdure». Se non sai dividerla con certezza, lascia "pezzo" a null: il gestionale non rendera' approvabile niente di dubbio.`;
}
