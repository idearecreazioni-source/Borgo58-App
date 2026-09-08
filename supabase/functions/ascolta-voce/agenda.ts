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
  // ⚠️ «Fatto» si guarda per primo: «sposta a venerdì quello che ho già
  //    fatto» non esiste come frase, mentre «segna come fatto» contiene
  //    parole che nessun elenco di spostamento tocca. L'ordine è la difesa.
  if (PAROLE_FATTO.some((p) => t.includes(p))) return "fatto";
  if (PAROLE_SPOSTA.some((p) => t === p || t.startsWith(`${p} `) || t.includes(` ${p} `))) {
    return "sposta";
  }
  return "altro";
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
  const eDiAgenda =
    azione?.tipo === TIPO_PROMEMORIA ||
    azione?.tipo === TIPO_FATTO ||
    azione?.tipo === TIPO_SPOSTA;
  if (!eDiAgenda) return azione;

  // Il gesto lo decide il modello quando lo dichiara, e il dettato quando
  // il modello non ci arriva.
  const dichiarato =
    azione.tipo === TIPO_FATTO ? "fatto" : azione.tipo === TIPO_SPOSTA ? "sposta" : null;
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

/** Su tutta la filza, e senza toccare quello che non è Agenda. */
export function correggiAgenda(azioni: AzioneDettata[], dettato = ""): AzioneDettata[] {
  return (azioni ?? []).map((a) => destinazioneAgenda(a, dettato));
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
- "promemoria": una cosa NUOVA da ricordare. «Ricordami di chiamare Tiziana domani», «aggiungi il rinnovo della firma digitale per venerdi'». dati: { "titolo": "...", "descrizione": "..."|null, "data": "AAAA-MM-GG"|null }
- "${TIPO_FATTO}": un impegno che GIA' ESISTE e che e' stato fatto. «Segna come fatto il rinnovo della firma digitale», «l'ho fatto», «spunta l'ordine delle verdure». dati: { "impegno": "il nome dell'impegno come l'ha detto lui" }
- "${TIPO_SPOSTA}": un impegno che GIA' ESISTE e va spostato a un altro giorno. «Sposta a venerdi' l'ordine delle verdure», «rimanda a lunedi' la chiamata al commercialista». dati: { "impegno": "il nome come l'ha detto lui", "data_nuova": "AAAA-MM-GG" }

⚠️ NON RICONDURRE LE ULTIME DUE A UN PROMEMORIA. «Segna come fatto il rinnovo della firma» non e' una cosa nuova da ricordare: e' una cosa gia' scritta che si chiude. Trattandola da promemoria nascerebbe un impegno NUOVO chiamato «segna come fatto il rinnovo della firma», accanto a quello vero che resta aperto — due righe per la stessa cosa, e nessun errore da nessuna parte.
⚠️ IN "impegno" VA IL NOME NUDO, senza il verbo: da «segna come fatto il rinnovo della firma digitale» esce "rinnovo della firma digitale", non "segna come fatto il rinnovo…".
⚠️ SE NON HA DETTO A QUANDO SPOSTARE, lascia "data_nuova" a null: il gestionale glielo chiedera'. Non mettere una data che non ha detto.`;
}
