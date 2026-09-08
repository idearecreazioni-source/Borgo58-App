// =====================================================================
// UNA DOMANDA NON È UN COMANDO — MEMO consultivo
// (fase 1: 07/09 · fasi 2 e 3: 08/09/2026)
// =====================================================================
// Fino a oggi tutto quello che Alessio diceva a MEMO era una cosa da
// SEGNARE: ne usciva un appunto, e l'appunto aspettava un sì. Da adesso
// una frase può anche essere una DOMANDA — «ho la ricetta della
// carbonara?», «quanto olio ho?», «cosa devo fare oggi?» — e a una
// domanda non si risponde scrivendo: si risponde leggendo.
//
// 🔴 IL MODELLO CLASSIFICA, IL DATABASE RISPONDE. Qui esce solo *che cosa*
//    è stato chiesto e *di che cosa*: area, domanda, soggetto. Nessun
//    numero, nessuna quantità, nessuna data. Il numero lo legge il
//    gestionale col permesso di chi sta guardando, e la frase la compone
//    una regola pura.
//    ⚠️ Se il numero lo dicesse il modello sarebbe **inverificabile** —
//    plausibile e non controllabile, che in questo progetto è la forma di
//    errore più costosa. Così la risposta a schermo è la stessa che si
//    legge aprendo la schermata, e sotto c'è il collegamento per andarla
//    a guardare.
//
// 🔴 E IL COMANDO VINCE SEMPRE SULLA DOMANDA, per costruzione e non per
//    prompt. I due scambi non costano uguale:
//      · una domanda scambiata per comando produce un appunto che non
//        scrive niente finché nessuno lo approva — si butta in un tocco;
//      · un comando scambiato per domanda **si perde**: MEMO risponde
//        qualcosa e la cosa da segnare non esiste più da nessuna parte.
//    Quindi: se dalla frase è uscita anche una sola azione, quella frase è
//    un comando. La domanda si considera solo quando di azioni non ce n'è
//    nessuna.

export type Domanda = {
  area: string | null;
  chiede: string | null;
  soggetto: string | null;
  allergene: string | null;
};

/**
 * LE DOMANDE CHE IL GESTIONALE SA LEGGERE.
 *
 * ⚠️ L'elenco è **chiuso**, ed è l'opposto di quello che vale per i
 * comandi: là MEMO inventa liberamente un tipo perché l'appunto resta un
 * promemoria anche se il gestionale non lo sa eseguire. Qui no — una
 * domanda che il gestionale non sa leggere non produce un promemoria:
 * produrrebbe una **risposta inventata**, che è la cosa peggiore che possa
 * uscire da questa schermata.
 *
 * 🔴 QUANTE SONO E DI QUALI AREE PARLANO NON SI SCRIVONO A MANO da
 * nessuna parte: le istruzioni per il modello se li contano da qui. Fino
 * al 07/09 la frase diceva «sono NOVE» e l'elenco delle aree era una
 * scritta fissa — cioè due numeri destinati a diventare falsi il giorno in
 * cui questa mappa fosse cresciuta. È cresciuta il giorno dopo.
 */
export const DOMANDE: Record<string, { area: string; soggetto: boolean }> = {
  // Ricettario
  ricetta_esiste: { area: "ricettario", soggetto: true },
  allergeni: { area: "ricettario", soggetto: true },
  piatti_in_carta: { area: "ricettario", soggetto: false },
  // Magazzino
  quanto_ho: { area: "magazzino", soggetto: true },
  cosa_manca: { area: "magazzino", soggetto: false },
  cosa_scade: { area: "magazzino", soggetto: false },
  // Agenda
  agenda_oggi: { area: "agenda", soggetto: false },
  agenda_in_ritardo: { area: "agenda", soggetto: false },
  // 🔴 «QUANDO SCADE X» NON STA SOTTO L'AGENDA — 07/09/2026, dal collaudo a
  //    mano: in un'osteria scadono le partite in cella e gli adempimenti, e
  //    la parola e' la stessa. Dove guardare lo decide il gestionale
  //    guardando la frase, non il modello.
  quando_scade: { area: "magazzino", soggetto: true },

  // --- fase 2 (08/09/2026) ---
  // Cassa — in sola lettura, e col portiere del database davanti: chi non
  // è titolare riceve un rifiuto, non un numero.
  saldo_cassa: { area: "cassa", soggetto: false },
  ultimi_movimenti: { area: "cassa", soggetto: false },
  // Le due liste della spesa restano due (SPEC-0012).
  cosa_comprare: { area: "magazzino", soggetto: false },
  cosa_spicciola: { area: "magazzino", soggetto: false },
  preparazioni_da_fare: { area: "magazzino", soggetto: false },
  agenda_prossime: { area: "agenda", soggetto: false },
  ingredienti_ricetta: { area: "ricettario", soggetto: true },
  // HACCP: si legge il registro, non ci si scrive. Una temperatura si
  // detta già da un'altra parte, e un fuori range non si chiude a voce.
  pulizie_oggi: { area: "haccp", soggetto: false },
  temperature_oggi: { area: "haccp", soggetto: false },
  // --- fase 3: quello che deve uscire (08/09/2026) ---
  // In sola lettura, e col portiere del database davanti: chi non è
  // titolare riceve un rifiuto, non un numero più piccolo.
  fatture_da_pagare: { area: "fornitori", soggetto: false },
  ordini_in_corso: { area: "fornitori", soggetto: false },
  crediti_fornitore: { area: "fornitori", soggetto: false },
  scadenze_previste: { area: "cassa", soggetto: false },
};

const testo = (v: unknown): string | null => {
  if (typeof v !== "string") return null;
  const pulito = v.trim();
  return pulito === "" ? null : pulito;
};

/**
 * Che cosa ha chiesto, secondo il modello — ripulito.
 *
 * ⚠️ UNA DOMANDA FUORI DALLE NOVE NON DIVENTA UNA DELLE NOVE. `chiede`
 * resta vuoto, e il gestionale dirà che quella cosa non la sa ancora fare
 * elencando quelle che sa. Ricondurla alla più vicina è esattamente il
 * difetto del 06/09 — la spesa spicciola diventata lista della spesa —
 * spostato dai comandi alle domande.
 */
export function leggiDomanda(letto: Record<string, unknown> | null | undefined): Domanda | null {
  const d = letto?.domanda as Record<string, unknown> | undefined;
  if (!d || typeof d !== "object" || Array.isArray(d)) return null;

  const chiesto = testo(d.chiede);
  const nota = chiesto ? DOMANDE[chiesto] : undefined;

  return {
    chiede: nota ? chiesto : null,
    area: nota ? nota.area : testo(d.area),
    soggetto: testo(d.soggetto),
    allergene: testo(d.allergene),
  };
}

/**
 * Domanda o comando? Una sola risposta, decisa qui e non nel prompt.
 *
 * ⚠️ Il caso «né azioni né domanda» torna come comando con la filza vuota:
 * chi chiama ha già la regola che ci mette dentro la nota con quello che è
 * stato detto, e una frase non si perde mai.
 */
export function comeRispondere(
  letto: Record<string, unknown> | null | undefined,
): { tipo: "azioni"; azioni: Record<string, unknown>[] } | { tipo: "domanda"; domanda: Domanda } {
  const azioni = Array.isArray(letto?.azioni) ? (letto!.azioni as Record<string, unknown>[]) : [];
  if (azioni.length > 0) return { tipo: "azioni", azioni };

  const domanda = leggiDomanda(letto);
  if (domanda) return { tipo: "domanda", domanda };

  return { tipo: "azioni", azioni: [] };
}

/** Minuscolo, senza accenti, con i segni ridotti a spazi. */
function nudo(testo: string): string {
  return String(testo ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * LE APERTURE CHE IN ITALIANO NON APRONO MAI UN COMANDO.
 *
 * ⚠️ È UN ELENCO DI PAROLE, cioè la forma che questo progetto diffida —
 * e regge solo perché **sbaglia in un verso solo**, ed è quello innocuo:
 *   · una domanda che l'elenco non riconosce diventa un appunto, come
 *     prima di questa riga: rumore, si butta in un tocco;
 *   · un comando riconosciuto per domanda si perderebbe — e per questo
 *     dentro non c'è niente che possa aprire un imperativo.
 * ⚠️ «Ho …» NON c'è, ed è la mancanza voluta: *«ho la ricetta della
 * carbonara»* è una domanda, ma *«ho pagato trenta euro al fornitore»* è
 * un comando, e le due cominciano identiche. Chi chiede «ho la ricetta…»
 * senza punto interrogativo si ritrova un appunto da buttare: è il prezzo,
 * ed è dalla parte giusta.
 */
const APERTURE_DI_DOMANDA = [
  "quanto",
  "quanta",
  "quanti",
  "quante",
  "quale",
  "quali",
  "quando",
  "cosa",
  "che cosa",
  "c e",
  "ci sono",
  "ce n e",
];

/**
 * Questa frase sembra una domanda?
 *
 * ⚠️ Serve **solo** quando l'assistente non ha risposto: se ha risposto,
 * chi decide è lui e questa regola non viene nemmeno chiamata.
 */
export function sembraUnaDomanda(testo: string): boolean {
  const grezzo = String(testo ?? "").trim();
  if (grezzo === "") return false;
  // Il punto interrogativo vale da solo, qualunque sia l'apertura: chi
  // detta «Ho la ricetta della carbonara?» col punto ha già dichiarato.
  if (grezzo.endsWith("?")) return true;
  const t = nudo(grezzo);
  return APERTURE_DI_DOMANDA.some((a) => t === a || t.startsWith(`${a} `));
}

/**
 * 🔴 QUANDO L'ASSISTENTE NON RISPONDE, UNA DOMANDA NON DIVENTA UN APPUNTO.
 *
 * Il caso vero, 07/09/2026: il credito dell'account AI è finito, la
 * chiamata è stata rifiutata prima di partire, e da *«Quanto olio ho?»* è
 * nato un appunto **«Da riguardare»** da approvare o buttare.
 *
 * 🔴 E LA RAGIONE PER CUI LE DUE COSE SI TRATTANO DIVERSAMENTE NON È IL
 *    FASTIDIO: è che **un comando contiene un fatto che esiste solo nella
 *    testa di chi ha parlato** — quanti chili sono arrivati, quanto ha
 *    pagato — e perderlo perde quel fatto. Una domanda no: rifarla costa
 *    il tempo di ridirla. Quindi davanti a un assistente muto si conserva
 *    il comando e si lascia cadere la domanda, e mai il contrario.
 *
 * ⚠️ E LA FRASE NON SPARISCE COMUNQUE: la dettatura si registra col suo
 *    testo, quindi resta nel registro. Quello che non nasce è **l'appunto**,
 *    cioè la cosa che chiede un sì o un no su niente.
 */
export function quandoLAssistenteTace(
  testo: string,
  perche: string,
): { azioni: Record<string, unknown>[]; messaggio: string } {
  if (sembraUnaDomanda(testo)) {
    return {
      azioni: [],
      messaggio: `${perche} Era una domanda, quindi non ho segnato niente: ridimmela quando vuoi.`,
    };
  }
  return {
    azioni: [
      {
        tipo: "nota_non_capita",
        sicuro: false,
        frase: `Da riguardare: «${testo.slice(0, 120)}»`,
        motivo: perche,
        dati: { sentito: testo },
      },
    ],
    messaggio: `${perche} Quello che hai detto è stato messo da parte: lo trovi nelle cose da guardare.`,
  };
}

/**
 * PERCHÉ NON HA RISPOSTO, IN ITALIANO.
 *
 * ⚠️ I rifiuti dell'assistente arrivano in inglese, e alcuni di questi non
 * sono un guasto del gestionale: sono i soldi. Senza riconoscerli, chi
 * legge «l'assistente non ha risposto» cerca il difetto nel programma —
 * ed è successo il 07/09, e di nuovo l'08/09. *Ogni rifiuto che ha più di
 * una causa le elenca in ordine di frequenza.*
 *
 * 🔴 I MODI DI RESTARE SENZA SOLDI SONO DUE, E NON SI DICONO UGUALE
 *    (08/09/2026, misurato sulle tre domande fatte col telefono):
 *      · il **credito è finito** → si ricarica, e MEMO riparte subito;
 *      · il **tetto di spesa dell'account è stato raggiunto** → non si
 *        ricarica niente: o si alza il tetto, o si aspetta il mese nuovo.
 *    Dirle con la stessa frase manda a fare la cosa sbagliata: chi legge
 *    «ricarica» va a ricaricare un account che ha già i soldi dentro.
 *
 * 🔴 E IL TETTO DEL GESTIONALE NON C'ENTRA, ed è la parte che inganna di
 *    più: `spesa_ai_del_mese` conta quello che ha speso **questo
 *    database**, e l'08/09 sul progetto di prova diceva 2,10 € su 10 —
 *    «sotto il tetto». Il tetto raggiunto era quello dell'**account**, che
 *    è uno solo per tutti e due i database e per tutte le funzioni che
 *    chiamano il modello. I due numeri rispondono a due domande diverse, e
 *    chi guarda il primo conclude che il blocco è un guasto.
 */
export function causaInItaliano(messaggio: string): string {
  const testo = String(messaggio ?? "");
  const m = testo.toLowerCase();

  // ⚠️ Il tetto si guarda PRIMA del credito: il messaggio del tetto non
  //    contiene «credit balance», ma se domani lo contenesse la frase
  //    sbagliata vincerebbe. L'ordine è la difesa.
  if (m.includes("usage limit") || m.includes("usage limits")) {
    // ⚠️ LA DATA C'È DENTRO IL RIFIUTO, e si dice: «aspetta» senza dire
    //    fino a quando è un vicolo cieco. Se non c'è, non ci si inventa un
    //    mese — si dice che non lo si sa.
    const quando = testo.match(/regain access on (\d{4})-(\d{2})-(\d{2})/i);
    const fino = quando ? ` fino al ${quando[3]}/${quando[2]}/${quando[1]}` : "";
    return `Il tetto di spesa dell'account AI è stato raggiunto: MEMO non capisce niente${fino}. Non è il credito e non è il tetto del gestionale — è il limite mensile messo sull'account, e vale per tutti e due i database insieme.`;
  }
  if (m.includes("credit balance") || m.includes("insufficient_quota")) {
    return "Il credito dell'account AI è finito: va ricaricato, e finché non lo è MEMO non capisce niente.";
  }
  if (m.includes("rate limit") || m.includes("429")) {
    return "L'assistente è occupato in questo momento.";
  }
  if (m.includes("overloaded") || m.includes("529")) {
    return "L'assistente è sovraccarico in questo momento.";
  }
  return "L'assistente non ha risposto.";
}

/**
 * Il pezzo di istruzioni che insegna a distinguere una domanda.
 *
 * ⚠️ Sta QUI e non dentro il prompt grande perché l'elenco delle nove
 * domande vive in un posto solo: se domani se ne aggiunge una, la si
 * aggiunge a `DOMANDE` e la frase per il modello cresce da sé. Due elenchi
 * — uno per il codice e uno per il modello — divergono al primo ritocco, ed
 * è la trappola che questo progetto ha già pagato tre volte.
 */
const NUMERI = [
  "ZERO", "UNA", "DUE", "TRE", "QUATTRO", "CINQUE", "SEI", "SETTE", "OTTO",
  "NOVE", "DIECI", "UNDICI", "DODICI", "TREDICI", "QUATTORDICI", "QUINDICI",
  "SEDICI", "DICIASSETTE", "DICIOTTO", "DICIANNOVE", "VENTI",
];

/** Il numero in lettere, e la cifra quando le lettere non ci sono. */
export function inLettere(n: number): string {
  return NUMERI[n] ?? String(n);
}

export function istruzioniDomande(): string {
  const perArea: Record<string, string[]> = {};
  for (const [chiede, nota] of Object.entries(DOMANDE)) {
    (perArea[nota.area] ??= []).push(
      nota.soggetto ? `"${chiede}" (vuole un soggetto)` : `"${chiede}"`,
    );
  }
  const righe = Object.entries(perArea).map(([area, elenco]) => `- ${area}: ${elenco.join(", ")}`);
  // 🔴 IL NUMERO E LE AREE SI CONTANO, NON SI SCRIVONO: erano due frasi
  //    fisse dentro il testo qui sotto, ed erano diventate false nel giro
  //    di un giorno. Il modello riceve sempre l'elenco vero.
  const quante = inLettere(Object.keys(DOMANDE).length);
  const aree = Object.keys(perArea).map((a) => `"${a}"`).join("|");

  return `
🔴 PRIMA DI TUTTO: TI STA DICENDO UNA COSA DA SEGNARE, O TI STA FACENDO UNA DOMANDA?
Se ti sta CHIEDENDO qualcosa che il gestionale sa gia' — «ho la ricetta della carbonara?», «quanto olio ho?», «cosa devo fare oggi?», «quanti soldi ci sono in cassa?», «cosa devo comprare?», «cosa devo pulire oggi?», «quali fatture devo pagare?», «cosa ho ordinato?» — allora non c'e' niente da segnare. Rispondi COSI', con "azioni" VUOTO:

{ "azioni": [], "domanda": { "area": ${aree}, "chiede": "<una di quelle qui sotto>", "soggetto": "il nome di cui parla, come l'ha detto"|null, "allergene": "<solo se ha nominato un allergene preciso>"|null } }

Le domande che il gestionale sa leggere sono ${quante}, e sono queste:
${righe.join("\n")}

⚠️ NON RISPONDERE TU ALLA DOMANDA. Non scrivere quantita', date, elenchi di piatti o allergeni: quelli li legge il gestionale dai dati veri e li mostra lui. Tu di' soltanto CHE COSA ha chiesto e DI CHE COSA. Un numero scritto da te sarebbe indistinguibile da un numero letto, e nessuno potrebbe controllarlo.
⚠️ "soggetto" va riempito con le parole sue, senza numeri di catalogo: «olio», «carbonara», «F24». Se ha fatto una domanda che ne vuole uno e non l'ha detto, lascialo null — il gestionale glielo chiedera'.
⚠️ SU "quando_scade" IL SOGGETTO E' IL NOME NUDO DELLA COSA: da «quando scade l'astice?» esce "astice", da «quando scade l'impegno dell'F24?» esce "F24" — le parole «impegno», «attivita'» e «agenda» NON entrano nel soggetto. Quella cosa puo' essere una partita in cella o un adempimento, e a decidere dove guardare e' il gestionale: tu non devi sceglierlo.
⚠️ SE E' UNA DOMANDA MA NON E' NESSUNA DELLE NOVE (per esempio «quanto mi costa la carbonara?», «quanto ho incassato ieri?»), mettila lo stesso come domanda con "chiede": null: il gestionale gli dira' che quella cosa non la sa ancora fare, ed e' molto meglio di una risposta inventata o di un appunto che non c'entra.
⚠️ NEL DUBBIO E' UN COMANDO. Se la frase potrebbe essere tutt'e due le cose («segna che di olio ne ho due chili» e' un comando, non una domanda), trattala da comando: un appunto in piu' si butta in un tocco, mentre una cosa da segnare presa per domanda si perde e lui crede di averla detta.`;
}
