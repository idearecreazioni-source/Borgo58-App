// LE BOZZE DI RICETTA — cosa manca prima che una bozza diventi ricetta.
//
// Ricettario Fase 1A (06/10/2026). Una bozza è una ricetta NON ancora vera:
// vive in tabelle sue (`bozze_ricetta` e le sue righe), e il Ricettario cambia
// solo con la conferma esplicita del titolare, che passa dal corridoio
// (`promuovi_bozza_ricetta`, regola B4).
//
// 🔴 UN BUCO RESTA UN BUCO. Una quantità che non c'è è VUOTA, non zero; un'unità
//    che il gestionale non conosce resta scritta com'era; un ingrediente non
//    collegato all'anagrafica non viene creato da solo. Questo modulo li
//    ELENCA, e non ne riempie nessuno.
//
// ⚠️ LA STESSA DEFINIZIONE VIVE IN DUE POSTI, CON DUE RUOLI DIVERSI: qui la
//    si MOSTRA prima della conferma, nella funzione del database
//    (migrazione 20261006000001) la si FA RISPETTARE. Le frasi sono le stesse
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
  if (vuoto(bozza?.porzioni)) buchi.push("mancano le porzioni");
  const segnalazioni = bozza?.buchi_dichiarati ?? [];
  if (segnalazioni.length > 0)
    buchi.push(`segnalazioni ancora aperte: ${segnalazioni.join("; ")}`);
  if (ingredienti.length === 0) buchi.push("nessun ingrediente");

  for (const r of ingredienti) {
    if (vuoto(r.ingredient_id))
      buchi.push(`«${r.nome}»: non collegato a un ingrediente dell'anagrafica`);
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
