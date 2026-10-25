// =====================================================================
// conversa.ts — MEMO ricorda gli ultimi minuti e, se non ha capito, CHIEDE
// =====================================================================
// 🔴 DUE COSE, e nessuna delle due scrive niente da sola.
//
//    1. LA MEMORIA BREVE. Fino al 25/10/2026 ogni frase arrivava al modello
//       come se fosse la prima: «aggiungine anche due chili» non aveva un
//       «ne» a cui riferirsi, e «no, sabato» non aveva niente da correggere.
//       Ora il gestionale consegna gli scambi degli ultimi dieci minuti
//       (`voce_scambi_recenti()`, che li legge dal registro delle dettature
//       di CHI STA PARLANDO): la frase e cosa MEMO ne aveva capito.
//       ⚠️ Non e' una conversazione salvata da qualche parte: e' il registro
//       che esisteva gia', riletto. Niente di nuovo da cancellare per la
//       privacy, niente che sopravviva alla dettatura che lo contiene.
//
//    2. IL CHIARIMENTO. Davanti a una frase ambigua il modello poteva solo
//       indovinare o arrendersi in un «non ho capito». Adesso puo' fare UNA
//       domanda, e la risposta di Alessio arriva alla frase dopo — con la
//       memoria qui sopra, che e' cio' che la rende leggibile.
//       ⚠️ Una domanda sola, corta, e solo quando senza la risposta non si
//       puo' proporre niente di utile: chi ha le mani occupate non sta a
//       un interrogatorio. Se si puo' proporre, si propone (gli appunti si
//       correggono comunque prima di diventare veri).
//
// ⚠️ LE AZIONI GIA' CAPITE NON SI RIFANNO. Gli scambi precedenti hanno gia'
//    prodotto i loro appunti: se il modello li ripetesse a ogni frase, tre
//    frasi in fila farebbero nascere tre volte la stessa spesa. Lo dice il
//    prompt, e lo dice con la ragione accanto.

/** Uno scambio come lo consegna `voce_scambi_recenti()`. */
export type Scambio = {
  quando?: string;
  detto?: string;
  capito?: string;
  in_attesa?: { id?: string; frase?: string }[];
};

/** Quanti scambi al massimo entrano nel messaggio: lo stesso tetto del database. */
export const SCAMBI_MASSIMI = 6;

/** Una riga ancora in attesa, col numero con cui il modello la nomina. */
export type RigaInAttesa = { numero: number; id: string; frase: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function scambiBuoni(scambi: Scambio[] | null | undefined): Scambio[] {
  return (Array.isArray(scambi) ? scambi : [])
    .filter((s) => String(s?.detto ?? "").trim() !== "")
    .slice(-SCAMBI_MASSIMI);
}

/**
 * Le righe ancora in attesa degli scambi recenti, NUMERATE da 1.
 *
 * 🔴 PERCHE' UN NUMERO E NON L'IDENTIFICATIVO (25/10/2026, misurato sulla
 *    prova): dopo «aggiungi il latte» e «mettine due litri» restavano in
 *    attesa DUE appunti, «latte» e «latte, 2 l», e Alessio avrebbe dovuto
 *    buttare il primo a mano. Il modello deve poter dire «questa prende il
 *    posto di quella»: un numero corto lo ripete senza sbagliare, un uuid
 *    da 36 caratteri no — e un uuid storpiato annullerebbe un'altra riga.
 * ⚠️ Lo stesso elenco serve a scrivere il messaggio e a ritradurre la
 *    risposta, quindi i due non possono numerare in modo diverso.
 */
export function righeInAttesa(scambi: Scambio[] | null | undefined): RigaInAttesa[] {
  const righe: RigaInAttesa[] = [];
  for (const s of scambiBuoni(scambi)) {
    for (const r of Array.isArray(s.in_attesa) ? s.in_attesa : []) {
      const id = String(r?.id ?? "");
      if (!UUID.test(id)) continue;
      righe.push({ numero: righe.length + 1, id, frase: String(r?.frase ?? "").trim() || "(senza frase)" });
    }
  }
  return righe;
}

/**
 * I numeri che il modello ha messo in "sostituisce", ritradotti negli
 * identificativi veri. Un numero che non esiste si lascia cadere: meglio
 * un doppione da buttare a mano che una riga giusta annullata.
 */
export function idDaSostituire(numeri: unknown, righe: RigaInAttesa[]): string[] {
  if (!Array.isArray(numeri)) return [];
  const ids = new Set<string>();
  for (const n of numeri) {
    const riga = righe.find((r) => r.numero === Number(n));
    if (riga) ids.add(riga.id);
  }
  return [...ids];
}

export function istruzioniConversa(): string {
  return `
🔴 LE COSE DETTE POCO FA — e quello che avevi capito
Prima della frase di adesso puoi trovare le frasi che Alessio ti ha detto negli ultimi minuti, ognuna con quello che avevi capito tu. Servono a capire la frase di adesso come la capirebbe una persona che c'era: «aggiungine anche due chili», «no, sabato», «quello di prima», «anche al bar» si riferiscono a quelle.
⚠️ QUELLE COSE SONO GIA' STATE SEGNATE. Non rimetterle fra le azioni: ogni azione che restituisci diventa un appunto nuovo, e ripeterle farebbe nascere due volte la stessa cosa. Restituisci SOLO quello che chiede la frase di adesso.
⚠️ Se la frase di adesso CORREGGE o COMPLETA una cosa di prima («no, erano tre chili», «non sabato, domenica», «mettine due litri»), restituisci l'azione INTERA e giusta, e se quella cosa di prima compare fra le righe ancora in attesa — quelle con un numero fra parentesi quadre, [1], [2] — aggiungi all'azione "sostituisce": [quel numero]. Il gestionale toglie la riga vecchia, che altrimenti resterebbe accanto a quella nuova come un doppione. Metti "sostituisce" SOLO quando la nuova prende davvero il posto della vecchia: se e' una cosa in piu' («aggiungi anche il pane»), niente "sostituisce".
⚠️ Se la frase di adesso non c'entra niente con quelle di prima, ignorale.

QUANDO NON PUOI PROPORRE NIENTE, CHIEDI — UNA COSA SOLA
Se senza un'informazione non riesci a proporre niente di utile, invece delle azioni rispondi:
{ "azioni": [], "chiedo": "la domanda, corta, rivolta a lui" }
⚠️ Una domanda sola, che si risponde con poche parole («Quanti chili?», «Per quale giorno?», «Al bar o in cucina?»). Lui ha le mani occupate: niente elenchi di domande, niente spiegazioni.
⚠️ Chiedi SOLO quando non c'e' niente da proporre. Se puoi proporre qualcosa con "sicuro": false e un motivo, fallo: un appunto da correggere costa meno di un giro di domande. E non chiedere mai una cosa che il gestionale sa calcolare da se' (la data di oggi, l'ora, la serata).
⚠️ Se l'ultima cosa che avevi fatto era una domanda e la frase di adesso e' la risposta, mettile insieme e proponi l'azione intera.`;
}

/**
 * I messaggi da mandare al modello: gli scambi recenti come turni
 * alternati, poi la frase di adesso.
 *
 * ⚠️ L'ULTIMO TURNO E' SEMPRE DI ALESSIO, e i turni si alternano: e' la
 *    forma che l'API pretende. Uno scambio senza frase si salta — un turno
 *    vuoto verrebbe respinto e la frase di adesso si perderebbe con lui.
 * ⚠️ Quello che MEMO aveva capito torna come SUO turno, in parole, e non
 *    come il JSON di allora: il JSON contiene numeri di catalogo che
 *    potrebbero essere cambiati, e il modello lo rileggerebbe come una
 *    filza da ripetere.
 */
export function messaggiConMemoria(
  scambi: Scambio[] | null | undefined,
  adesso: string,
  testo: string,
): { role: "user" | "assistant"; content: string }[] {
  const buoni = scambiBuoni(scambi);
  let numero = 0;

  const messaggi: { role: "user" | "assistant"; content: string }[] = [];
  buoni.forEach((s, i) => {
    const ora = s.quando ? ` (alle ${s.quando})` : "";
    const apertura = i === 0 ? "Poco fa" : "Poi";
    messaggi.push({
      role: "user",
      content: `${apertura}${ora} Alessio ha detto:\n\n${String(s.detto).trim()}`,
    });
    // ⚠️ Stessa numerazione di `righeInAttesa()`: stesso filtro, stesso ordine.
    const attesa = (Array.isArray(s.in_attesa) ? s.in_attesa : [])
      .filter((r) => UUID.test(String(r?.id ?? "")))
      .map((r) => `[${++numero}] ${String(r?.frase ?? "").trim() || "(senza frase)"}`);
    const coda = attesa.length > 0 ? `\nAncora in attesa di conferma: ${attesa.join("; ")}` : "";
    messaggi.push({
      role: "assistant",
      content: `Avevo capito, ed e' gia' segnato: ${String(s.capito ?? "").trim() || "niente."}${coda}`,
    });
  });

  const intro = buoni.length > 0 ? `${adesso} Adesso Alessio dice:` : `${adesso} Alessio ha detto:`;
  messaggi.push({ role: "user", content: `${intro}\n\n${testo}` });
  return messaggi;
}

/**
 * La domanda di chiarimento, se il modello ne ha fatta una.
 *
 * ⚠️ VALE SOLO SENZA AZIONI. Se ci sono azioni E una domanda, le azioni
 *    vincono e la domanda si lascia cadere: gli appunti arrivano comunque
 *    a lui, che li corregge, mentre una domanda che oscura delle azioni
 *    farebbe sparire quello che il modello aveva capito.
 * ⚠️ E si accorcia: una domanda lunga detta ad alta voce non la ascolta
 *    nessuno fino in fondo.
 */
export function leggiChiarimento(letto: Record<string, unknown> | null | undefined): string | null {
  const azioni = Array.isArray(letto?.azioni) ? (letto!.azioni as unknown[]) : [];
  if (azioni.length > 0) return null;
  const chiedo = typeof letto?.chiedo === "string" ? letto.chiedo.trim() : "";
  if (!chiedo) return null;
  return chiedo.length > 200 ? `${chiedo.slice(0, 197)}…` : chiedo;
}

/** I token di cache dalla risposta dell'API: zero se il campo manca. */
export function tokenCache(usage: Record<string, unknown> | null | undefined): {
  scritti: number;
  letti: number;
} {
  const n = (x: unknown) => (typeof x === "number" && Number.isFinite(x) && x > 0 ? x : 0);
  return {
    scritti: n(usage?.cache_creation_input_tokens),
    letti: n(usage?.cache_read_input_tokens),
  };
}
