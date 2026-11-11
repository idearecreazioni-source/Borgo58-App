// =====================================================================
// LE SPESE DELLA BANCA SI PROPONGONO DA SOLE — 12/11/2026
// =====================================================================
// Alessio, l'11/11, davanti a sette righe di commissioni e canoni da
// scrivere una per una: *«non dovrebbe intervenire MEMO a precompilarmi i
// campi, come è già successo con l'abbinamento delle fatture?»*.
//
// 🔴 NON SERVE UN MODELLO CHE RAGIONA: la banca scrive già, su ogni riga,
//    il codice della «Causale ABI», che per le spese del conto è sempre lo
//    stesso. Una regola fissa è gratis, istantanea, e non sbaglia.
//
// ⚠️ SI PROPONE, NON SI SCRIVE: i campi arrivano compilati e il pulsante
//    resta suo. Le righe che la regola non riconosce restano a mano, come
//    prima: meglio niente proposta che una proposta sbagliata.
// ⚠️ La causale si cerca per NOME fra quelle attive: se un giorno «Spese
//    bancarie» si chiama in un altro modo, la proposta sparisce invece di
//    puntare a una causale che non c'è più.

/** Codici ABI delle spese del conto (uscite). */
const ABI_SPESE = new Map([
  ["16", "commissioni"],
  ["18", "canone del conto"],
  ["74", "bolli"],
]);
/** Codici ABI dei rimborsi della banca (entrate). */
const ABI_RIMBORSI = new Map([["68", "rimborso del canone"]]);

const PAROLE_DELLA_BANCA = /\b(comm|commission|canone|bolli|bollo|spese|imposta di bollo|rimborso)/i;

const CAUSALE_SPESE = "spese bancarie";
const CAUSALE_RIMBORSO = "rimborso spese banca";

const pulito = (s) => String(s ?? "").trim().toLowerCase();

/**
 * La proposta per una riga della banca, oppure null.
 * @param m       riga di movimenti_banca: {importo, causale_abi}
 * @param causali le causali attive (uscite ed entrate): [{id, label, kind}]
 * @returns {{causaleId, causale, tipoDocumento, perche}|null}
 */
export function propostaSpesaBanca(m, causali) {
  const importo = Number(m?.importo);
  if (!Number.isFinite(importo) || importo === 0) return null;
  const abi = String(m?.causale_abi ?? "").trim();
  const uscita = importo < 0;
  const cosa = uscita ? ABI_SPESE.get(abi) : ABI_RIMBORSI.get(abi);
  if (!cosa) return null;
  // ⚠️ Doppia prova: anche la descrizione deve parlare di spese della banca.
  //    Un codice ABI usato in un altro modo da un'altra banca non basta.
  if (!PAROLE_DELLA_BANCA.test(String(m?.descrizione ?? ""))) return null;
  const nome = uscita ? CAUSALE_SPESE : CAUSALE_RIMBORSO;
  const kind = uscita ? "uscita" : "entrata";
  const causale = (causali ?? []).find((c) => pulito(c.label) === nome && (!c.kind || c.kind === kind));
  if (!causale) return null;
  return {
    causaleId: causale.id,
    causale: causale.label,
    tipoDocumento: "estratto_conto",
    perche: `${cosa} della banca (causale ABI ${abi})`,
  };
}

/** Le righe da abbinare che hanno una proposta, con la proposta accanto. */
export function speseBancaDaRegistrare(movimenti, causali) {
  return (movimenti ?? [])
    .filter((m) => !m.cash_movement_id && !m.ignorato_il)
    .map((m) => ({ m, proposta: propostaSpesaBanca(m, causali) }))
    .filter((x) => x.proposta);
}
