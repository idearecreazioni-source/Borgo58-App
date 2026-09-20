// =====================================================================
// UNA CONSEGNA SI FA UNA VOLTA SOLA — 17/09/2026
// =====================================================================
// 🔴 IL DIFETTO CHE QUESTO MODULO CHIUDE, rilevato dalla revisione. Il giro
//    dei promemoria non produceva piu' un falso «inviato», ma non impediva
//    un **secondo Telegram**:
//      · una risposta persa rende il tentativo ritentabile;
//      · il ritentativo arriva qui come una richiesta qualunque;
//      · e qui non c'era niente che permettesse di riconoscerla.
//    Cioe': il caso che il giro trattava bene — «non so se sia arrivato,
//    riprovo» — era esattamente il caso che produceva il doppione.
//
// 🔴 LA CHIAVE E' DELLA CONSEGNA, NON DEL TENTATIVO, ed e' il punto su cui
//    gira tutto. Se ogni tentativo avesse una chiave sua, il secondo arrivo
//    sarebbe indistinguibile da un avviso nuovo e il duplicato sarebbe
//    garantito. Con una chiave stabile fra i tentativi, il secondo arrivo si
//    riconosce e **risolve** l'incertezza invece di raddoppiarla.
//
// ⚠️ E CHI DEDUPLICA DEV'ESSERE CHI RICEVE. Il database puo' sapere di aver
//    accodato una richiesta; non puo' sapere se sia ARRIVATA. L'unico posto
//    da cui si vede la differenza e' questo.
//
// ⚠️ STA IN UN FILE A SE' PER POTERLO PROVARE. Dentro `index.ts` la
//    decisione nascerebbe intrecciata alla rete e a Telegram, e l'unico modo
//    di metterla alla prova sarebbe mandare messaggi veri — cioe' far
//    suonare il telefono di Alessio per collaudare un guardiano. Stessa
//    scelta di `ascolta-voce/adesso.ts`.

/** Com'e' finita la richiesta di prendere in carico una consegna. */
export type EsitoPresa =
  /** Nessuno l'aveva mai presa: tocca a noi mandarla. */
  | "manda"
  /** Qualcuno l'ha gia' mandata e confermata: non si manda di nuovo. */
  | "gia_consegnata"
  /** Presa poco fa da un altro giro, che non ha ancora finito. */
  | "in_corso"
  /** Presa e mai confermata, e ormai vecchia: non si sapra' mai com'e' finita. */
  | "ignota";

export type Risposta = { stato: number; corpo: Record<string, unknown> };

/** Che strada prende questa notifica. */
export type Strada = { dedup: true; chiave: string } | { dedup: false };

/**
 * 🔴 SI DEDUPLICA SOLO SE LA CHIAVE ARRIVA SCRITTA NEL PAYLOAD, e non si
 *    ricompone MAI da altri campi. Sembra una prudenza in meno ed e' il
 *    contrario: e' cio' che rende sicuro l'ordine del rilascio.
 *
 * ⚠️ IL PERICOLO CHE TOGLIE, e l'avevo messo io. La prima stesura, quando la
 *    chiave non c'era, se la ricostruiva dai campi dell'impegno e tentava di
 *    deduplicare lo stesso. Ma fra la pubblicazione di questa funzione e
 *    l'applicazione della migrazione c'e' una finestra in cui il database e'
 *    ancora quello vecchio: il registro delle consegne **non esiste**, la
 *    chiamata solleva, e in quella finestra **nessun promemoria partirebbe
 *    piu'**. Cioe' la ricomposizione rendeva pericoloso proprio l'ordine
 *    giusto.
 *
 * 🔴 L'ORDINE DEL RILASCIO, E PERCHE' E' QUESTO:
 *      1. PRIMA la funzione online. Il database vecchio non manda nessuna
 *         chiave, quindi questa funzione prende la strada diretta e si
 *         comporta **esattamente come prima**: pubblicarla da sola non
 *         cambia niente e non rompe niente.
 *      2. POI la migrazione. Da quel momento il database manda la chiave, e
 *         la deduplicazione entra in funzione da se'.
 *    ⚠️ AL CONTRARIO NON SI PUO': con la migrazione applicata e la funzione
 *    vecchia, il database manderebbe la chiave a qualcuno che non sa
 *    leggerla — nessuna deduplicazione, e il doppione tornerebbe possibile
 *    **in silenzio**, che e' il difetto da cui e' nato tutto questo.
 *
 * ⚠️ E LA STRADA DIRETTA SERVE SOLO ALLA FINESTRA DEL RILASCIO. Chiusa
 *    quella, un promemoria senza chiave non esiste piu': lo mandano soltanto
 *    le prenotazioni e gli allarmi, che nascono da un fatto che avviene una
 *    volta sola e che nessuno ritenta.
 */
export function stradaDellaConsegna(payload: Record<string, unknown> | null | undefined): Strada {
  const grezza = payload?.chiave_consegna;
  const chiave = typeof grezza === "string" ? grezza.trim() : "";
  return chiave ? { dedup: true, chiave } : { dedup: false };
}

/**
 * Manda una cosa sola una volta sola.
 *
 * 🔴 LA PROPRIETA' CHE QUESTO CODICE DEVE AVERE, e si legge qui dentro:
 *    `manda()` viene chiamata **soltanto** sul ramo `"manda"`, cioe' soltanto
 *    quando la presa in carico e' riuscita — e la presa in carico riesce una
 *    volta sola per chiave, perche' e' una scrittura con chiave primaria.
 *    Ogni altro arrivo con la stessa chiave non manda niente.
 *
 * ⚠️ E SI TORNA A «manda» DA UNA STRADA SOLA: `rilascia()`, che si chiama
 *    **solo** quando Telegram ha risposto di NO — cioe' quando e' certo che
 *    non abbia ricevuto niente.
 *
 * 🔴 IL CASO CHE SEMBRA UGUALE E NON LO E': se `manda()` SOLLEVA — la rete
 *    cade a meta', il programma muore — non si sa se Telegram abbia ricevuto.
 *    Li' **non si rilascia**: la presa resta, diventera' «ignota», e quella
 *    consegna non partira' mai piu'. *Si preferisce un avviso mancante e
 *    dichiarato a un avviso doppio e silenzioso.*
 */
export async function consegnaUnaVoltaSola(opz: {
  chiave: string;
  prendi: (chiave: string) => Promise<EsitoPresa>;
  conferma: (chiave: string) => Promise<void>;
  rilascia: (chiave: string) => Promise<void>;
  manda: () => Promise<{ riuscito: boolean; dettaglio?: string }>;
}): Promise<Risposta> {
  const presa = await opz.prendi(opz.chiave);

  if (presa === "gia_consegnata") {
    // ⚠️ Si risponde «va bene» ED E' GIUSTO: l'avviso c'e' gia'. Chi ha
    //    riprovato voleva sapere se fosse arrivato, e la risposta e' si'.
    //    `gia_consegnato` lo dice, cosi' chi legge i registri distingue una
    //    consegna da un riconoscimento.
    return { stato: 200, corpo: { ok: true, gia_consegnato: true } };
  }

  if (presa === "in_corso") {
    // Un altro giro la sta mandando adesso. Non si manda niente e non si
    // dichiara niente: si riproverà, e allora si sapra'.
    return { stato: 409, corpo: { ok: false, esito: "in_corso" } };
  }

  if (presa === "ignota") {
    // 🔴 IL COMPROMESSO, DETTO PER QUELLO CHE E': qualcuno l'ha presa e non
    //    ha mai confermato. Puo' essere arrivata o no, e non c'e' modo di
    //    saperlo. Si sceglie di **non mandare piu'**: un duplicato e'
    //    silenzioso e indistinguibile da un avviso vero, un avviso mancante
    //    resta scritto e fa scattare un allarme.
    return { stato: 409, corpo: { ok: false, esito: "ignoto" } };
  }

  let riuscito = false;
  let dettaglio: string | undefined;
  try {
    const r = await opz.manda();
    riuscito = r.riuscito;
    dettaglio = r.dettaglio;
  } catch (e) {
    // Non si rilascia: vedi sopra. L'esito e' ignoto, non fallito.
    return {
      stato: 502,
      corpo: { ok: false, esito: "ignoto", error: "Invio interrotto a metà", detail: String(e) },
    };
  }

  if (!riuscito) {
    // Telegram ha risposto di no: e' CERTO che non abbia ricevuto niente,
    // quindi la chiave torna libera e il prossimo tentativo mandera'.
    // ⚠️ E se nemmeno il rilascio riesce, l'esito resta «non mandato»: e'
    //    vero, ed e' la cosa che chi manda deve sapere. La chiave restera'
    //    presa e diventera' «ignota» da se'.
    try {
      await opz.rilascia(opz.chiave);
    } catch {
      /* il rifiuto di Telegram resta il fatto principale */
    }
    return { stato: 502, corpo: { ok: false, error: "Invio Telegram fallito", detail: dettaglio } };
  }

  // 🔴 DA QUI IN POI IL MESSAGGIO E' GIA' SU TELEGRAM, E NIENTE PUO' PIU'
  //    RENDERLO «NON ARRIVATO» — 20/09/2026, difetto misurato su Prova.
  //    Il 20/09 alle 15:20 un promemoria e' stato consegnato, la conferma e'
  //    stata scritta, e la funzione ha risposto lo stesso **500**: l'errore
  //    nasceva DOPO l'invio, mentre si leggeva la risposta della conferma.
  //    Chi manda l'ha letto come «non arrivato», ha fatto scattare un allarme
  //    falso alle 15:25 e ha riprovato alle 15:30.
  // ⚠️ Quindi un guaio nella conferma NON diventa un fallimento: si risponde
  //    che il messaggio e' partito, e si dichiara che la conferma non si e'
  //    potuta scrivere. Cosi' chi manda smette di riprovare — il messaggio
  //    c'e' — e chi legge sa che la memoria di questa consegna e' monca.
  try {
    await opz.conferma(opz.chiave);
  } catch (e) {
    return {
      stato: 200,
      corpo: { ok: true, conferma_non_scritta: true, detail: String(e) },
    };
  }
  return { stato: 200, corpo: { ok: true } };
}
