// LE BOZZE DI RICETTA — cosa manca prima che una bozza diventi ricetta.
//
// Ricettario Fase 1A (06/10/2026). Una bozza è una ricetta NON ancora vera:
// vive in tabelle sue (`bozze_ricetta` e le sue righe), e il Ricettario cambia
// solo con la conferma esplicita del titolare, che passa dal corridoio
// (`promuovi_bozza_ricetta`, regola B4).
//
// 🔴 UN BUCO RESTA UN BUCO. Una quantità che non c'è è VUOTA, non zero; un'unità
//    che il gestionale non conosce resta scritta com'era; un prodotto del
//    magazzino non viene mai creato da solo. Questo modulo li ELENCA, e non
//    ne riempie nessuno.
//
// ⚠️ LA STESSA DEFINIZIONE VIVE IN DUE POSTI, CON DUE RUOLI DIVERSI: qui la
//    si MOSTRA prima della conferma, nella funzione del database
//    (migrazione 20261025000050, l'ultima che la riscrive) la si FA RISPETTARE. Le frasi sono le stesse
//    apposta, e la prova `tests/unita/bozze-ricetta.test.js` controlla che
//    ogni frase di questo file compaia anche nel corpo della funzione: se
//    una delle due imparasse un buco nuovo e l'altra no, diventa rossa.
//
// ⚠️ Un limite dichiarato: l'unità «compresa» qui si confronta con le unità
//    PROPONIBILI per gli alimenti (`useUnita`), il database con tutte quelle
//    che conosce. Se un giorno divergessero, la schermata segnalerebbe un buco
//    che il database accetterebbe — mai il contrario.

export const ORIGINI_BOZZA = [
  { value: "manuale", label: "Scritta a mano" },
  { value: "link", label: "Da un link" },
  { value: "screenshot", label: "Da uno screenshot" },
  { value: "testo", label: "Da un testo" },
  { value: "voce", label: "Dalla voce" },
];

// Che cosa diventerà la bozza. Gli stessi valori di `recipe_type`: la rete
// dei vocabolari li tiene d'accordo (src/lib/calcoli/vocabolari.js).
export const TIPI_BOZZA = [
  { value: "piatto_finito", label: "Piatto" },
  { value: "preparazione", label: "Preparazione" },
  { value: "finger", label: "Finger" },
];

export const STATI_BOZZA = [
  { value: "in_revisione", label: "Da rivedere" },
  { value: "ispirazione", label: "Ispirazione" },
  { value: "scartata", label: "Scartata" },
];

/** «Diventata ricetta» non è uno stato scrivibile: lo dice la promozione. */
export function statoLeggibile(bozza) {
  if (bozza?.promossa_il) return "Diventata ricetta";
  return STATI_BOZZA.find((s) => s.value === bozza?.stato)?.label ?? bozza?.stato ?? "";
}

const vuoto = (v) => v === null || v === undefined || String(v).trim() === "";

/**
 * I buchi di una bozza, TUTTI, nell'ordine in cui li dice il database.
 *
 * @param bozza       la riga di `bozze_ricetta`
 * @param ingredienti le righe di `bozze_ricetta_ingredienti`, in ordine
 * @param passaggi    le righe di `bozze_ricetta_passaggi`, in ordine
 * @param unitaNote   i codici delle unità che il gestionale conosce
 * @returns un elenco di frasi; vuoto vuol dire «può diventare ricetta»
 */
export function buchiDellaBozza(bozza, ingredienti = [], passaggi = [], unitaNote = []) {
  const buchi = [];
  if (vuoto(bozza?.categoria)) buchi.push("manca la categoria");
  else if (bozza.categoria === "finger_food")
    buchi.push("i finger si creano dal Ricettario: questa bozza non puo' diventarne uno");
  // 25/10/2026 (migrazione 20261025000050): una preparazione o un finger
  //    non si conta a porzioni ma a RESA — quanto ne viene da una dose. Il
  //    database lo pretende già sulle ricette (`componente_richiede_resa`).
  const tipo = bozza?.tipo ?? "piatto_finito";
  if (tipo === "piatto_finito") {
    if (vuoto(bozza?.porzioni)) buchi.push("mancano le porzioni");
  } else if (vuoto(bozza?.resa_quantita) || vuoto(bozza?.resa_unita)) {
    buchi.push(
      `manca la resa (quanto ne viene da una dose di questa ${tipo === "finger" ? "ricetta di finger" : "preparazione"})`
    );
  }
  const segnalazioni = bozza?.buchi_dichiarati ?? [];
  if (segnalazioni.length > 0)
    buchi.push(`segnalazioni ancora aperte: ${segnalazioni.join("; ")}`);
  if (ingredienti.length === 0) buchi.push("nessun ingrediente");

  for (const r of ingredienti) {
    // 🔴 25/10/2026: un ingrediente NON collegato non è più un buco — entra
    //    nella ricetta fra quelli «da collegare» (migrazione 20261025000020).
    //    Quantità e unità si pretendono solo sulle righe collegate, le sole
    //    che entrano nel costo.
    if (vuoto(r.ingredient_id)) continue;
    if (vuoto(r.quantita)) buchi.push(`«${r.nome}»: quantita' mancante`);
    if (vuoto(r.unita)) buchi.push(`«${r.nome}»: unita' mancante`);
    else if (!unitaNote.includes(r.unita))
      buchi.push(`«${r.nome}»: unita' non compresa («${r.unita}»)`);
  }

  passaggi.forEach((p, i) => {
    if (vuoto(p.fase)) buchi.push(`passaggio ${i + 1}: manca la fase`);
    if (vuoto(p.descrizione)) buchi.push(`passaggio ${i + 1}: manca la descrizione`);
  });

  return buchi;
}

/**
 * Un numero scritto in un campo, o VUOTO. Mai zero al posto di «non lo so».
 * ⚠️ «0» non è una quantità: il database la rifiuterebbe, e qui torna vuota
 *    invece di passare per un numero.
 */
export function quantitaDalCampo(testo) {
  if (vuoto(testo)) return null;
  const n = Number(String(testo).replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * L'identificativo di UN gesto di conferma. Lo stesso gesto ripetuto (il
 * doppio tocco) porta lo stesso identificativo e riceve la stessa ricetta;
 * un gesto nuovo su una bozza già promossa viene rifiutato.
 */
//
// ⚠️ NON `crypto.randomUUID()` da solo: nel browser esiste solo su un
//    indirizzo cifrato, e il gestionale si apre anche da `http://` sulla rete
//    del locale (§4). `getRandomValues` c'è dappertutto, e da lì si compone un
//    identificativo della stessa forma.
export function nuovoGesto(cripto = globalThis.crypto) {
  if (typeof cripto?.randomUUID === "function") return cripto.randomUUID();
  const b = cripto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40; // versione 4
  b[8] = (b[8] & 0x3f) | 0x80; // variante
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
