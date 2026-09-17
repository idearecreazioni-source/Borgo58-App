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

/**
 * La chiave di una consegna di promemoria.
 *
 * 🔴 DUE INGREDIENTI E NON UNO: l'impegno **e** il momento in cui va dato
 *    l'avviso. Col solo impegno, spostando l'avviso a un'altra data il
 *    secondo avviso — che e' legittimo e diverso — verrebbe scambiato per un
 *    doppione del primo e non partirebbe mai.
 * ⚠️ E' una funzione PURA di due valori che il database possiede gia': non
 *    si genera a caso, altrimenti non sarebbe stabile fra i tentativi — che
 *    e' l'unica proprieta' che conta.
 */
export function chiaveDiConsegna(task: Record<string, unknown> | null | undefined): string | null {
  const id = typeof task?.id === "string" ? task.id.trim() : "";
  const quando = typeof task?.remind_at === "string" ? task.remind_at.trim() : "";
  if (!id || !quando) return null;
  // L'istante si normalizza: `2026-09-20T15:00:00+00:00` e
  // `2026-09-20T15:00:00Z` sono lo stesso momento, e due scritture diverse
  // dello stesso momento darebbero due chiavi — cioe' due Telegram.
  const t = Date.parse(quando);
  const normale = Number.isNaN(t) ? quando : new Date(t).toISOString();
  return `promemoria:${id}:${normale}`;
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
    await opz.rilascia(opz.chiave);
    return { stato: 502, corpo: { ok: false, error: "Invio Telegram fallito", detail: dettaglio } };
  }

  await opz.conferma(opz.chiave);
  return { stato: 200, corpo: { ok: true } };
}
