// Le spese «Da collocare» — le regole che la schermata mostra (11/10/2026, C12).
//
// ⚠️ Qui si DICE, nel database si FA RISPETTARE: cosa serve a ogni
//    destinazione è controllato da `colloca_spesa`, e la stessa lista vive
//    qui solo per spegnere il pulsante con la ragione scritta accanto,
//    invece di farlo premere per farlo rifiutare.

/** Le destinazioni, nell'ordine in cui si mostrano. */
export const DESTINAZIONI = [
  { value: "prima_nota", label: "Prima nota", spiega: "un'uscita della cassa o della banca dell'osteria" },
  { value: "tasca", label: "La mia tasca", spiega: "soldi tuoi spesi per il progetto, che non tornano" },
  { value: "anticipo", label: "Anticipo da rimborsare", spiega: "pagata da te per conto della società, che poi ti rimborsa" },
  { value: "archivio", label: "Archivio documenti", spiega: "solo da conservare: niente conti" },
  { value: "ignora", label: "Ignora", spiega: "un doppione o una cosa sbagliata: non va da nessuna parte" },
];

export const etichettaDestinazione = (v) => DESTINAZIONI.find((d) => d.value === v)?.label ?? v;

const numero = (v) => {
  if (v === null || v === undefined || String(v).trim() === "") return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
};

/**
 * Che cosa manca perché la spesa entri in quella destinazione.
 * Restituisce le frasi, TUTTE insieme (regola del 16/08): dirne una per
 * volta fa scoprire la seconda dopo aver rimediato alla prima.
 */
export function cosaMancaPer(dove, campi = {}) {
  const manca = [];
  if (!dove) return ["scegli dove va"];
  if (dove === "ignora") return manca;
  const importo = numero(campi.importo);
  if (dove !== "archivio") {
    if (importo === null) manca.push("l'importo");
    else if (Number.isNaN(importo) || importo <= 0) manca.push("un importo valido");
  } else if (Number.isNaN(importo) || (importo !== null && importo <= 0)) {
    manca.push("un importo valido, oppure lascialo vuoto");
  }
  if (dove === "prima_nota" && campi.mezzo === "banca" && !campi.conto_id) manca.push("il conto della banca");
  if (dove === "anticipo" && !campi.tag_id) manca.push("il motivo dell'anticipo");
  if (dove === "archivio") {
    if (!campi.sezione) manca.push("la sezione dell'Archivio");
    if (!campi.data) manca.push("la data");
  }
  return manca;
}

const testoONiente = (v) => (typeof v === "string" && v.trim() !== "" ? v.trim() : null);

/** I campi che partono verso il database: solo quelli della destinazione. */
export function campiPer(dove, campi = {}) {
  const base = {
    importo: campi.importo === "" || campi.importo == null ? null : String(campi.importo).replace(",", "."),
    data: campi.data || null,
    // ⚠️ Un campo vuoto parte come «niente», non come testo vuoto.
    descrizione: testoONiente(campi.descrizione),
    controparte: testoONiente(campi.controparte),
  };
  if (dove === "prima_nota") {
    return {
      ...base,
      causale_id: campi.causale_id || null,
      mezzo: campi.mezzo || "cassa",
      conto_id: campi.mezzo === "banca" ? campi.conto_id || null : null,
      documento: campi.documento || null,
    };
  }
  if (dove === "anticipo") return { ...base, tag_id: campi.tag_id || null, fondi: campi.fondi || "contanti" };
  if (dove === "archivio") return { ...base, sezione: campi.sezione || null, titolo: campi.titolo || null };
  return base;
}

/** I campi di partenza, da ciò che MEMO ha capito. */
export function campiIniziali(spesa) {
  return {
    importo: spesa.importo == null ? "" : String(spesa.importo).replace(".", ","),
    data: spesa.data ?? "",
    descrizione: spesa.descrizione ?? "",
    controparte: spesa.controparte ?? "",
    causale_id: spesa.causale_id ?? "",
    mezzo: spesa.mezzo_proposto ?? "cassa",
    conto_id: "",
    documento: spesa.documento_proposto ?? (spesa.foto_path ? "scontrino" : "non_documentato"),
    tag_id: "",
    fondi: "contanti",
    sezione: "",
    titolo: "",
  };
}

/** Da una lettura di MEMO foto ai campi dell'appunto. */
export function appuntoDaLettura(lettura) {
  const s = lettura?.acquisto ?? {};
  const importo = Number(s.importo);
  const dubbi = [
    lettura?.sicuro === false ? "MEMO non era sicuro di cosa stesse guardando" : null,
    typeof s.dubbi === "string" && s.dubbi.trim() ? s.dubbi.trim() : null,
  ].filter(Boolean);
  const data = typeof s.data === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s.data) ? s.data : null;
  return {
    importo: Number.isFinite(importo) && importo > 0 ? importo : null,
    data,
    controparte: s.esercente ?? null,
    descrizione: s.cosa ?? lettura?.cosa_vedo ?? null,
    documento: ["scontrino", "fattura", "non_documentato"].includes(s.documento) ? s.documento : null,
    testo_originale: lettura?.cosa_vedo ?? null,
    incertezza: dubbi.length ? dubbi.join("; ") : null,
  };
}

/**
 * Il deposito dei file risponde così quando un file con quel nome c'è già.
 * Con la chiave della foto nel nome (20261011000004) vuol dire «il giro di
 * prima l'aveva caricata»: è la stessa foto, e si va avanti.
 */
export function giaCaricata(error) {
  const stato = String(error?.statusCode ?? error?.status ?? "");
  return stato === "409" || /already exists|duplicate/i.test(String(error?.message ?? ""));
}

/**
 * La frase per chi prova a rimuovere dalla prima nota un movimento nato da
 * «Da collocare». Il database lo rifiuta (la spesa punta al movimento,
 * `on delete restrict`): senza questa frase arrivava il testo di Postgres,
 * e in cima alla pagina, fuori vista.
 *
 * @returns {?string} la frase italiana, o null se l'errore è un'altra cosa
 */
export function fraseMovimentoDaCollocare(errore) {
  const t = String(errore?.message ?? errore ?? "");
  const eQuesto =
    /spese_da_collocare/i.test(t) &&
    (/foreign key|fkey|restrict|23503/i.test(t) || String(errore?.code ?? "") === "23503");
  if (!eQuesto) return null;
  return "Questo movimento viene da «Da collocare», quindi non si toglie da qui. Vai in «Da collocare» e usa «Annulla la collocazione»: il movimento sparisce da solo e la spesa torna da collocare.";
}
