import { describe, expect, it } from "vitest";
import {
  documentiCollegabili,
  documentoCollegabile,
  senzaSocieta,
} from "../../src/lib/calcoli/documentiCollegabili";
import { CAMPI_AZIONE, azioneArchivia } from "../../src/lib/calcoli/posta";

// =====================================================================
// IL DOCUMENTO NATO DALLA POSTA E LA SUA SOCIETA' — 21/09/2026
// =====================================================================
// 🔴 IL DIFETTO, in una riga: `esegui_azione_posta` chiamava
//    `create_document` senza passare la societa', quindi **ogni** documento
//    nato da una mail ne restava privo; e nelle Fatture i documenti
//    collegabili sono quelli della **stessa societa' della fattura**. Un
//    valore assente non combacia mai: un DDT archiviato dalla posta non
//    compariva fra i collegabili per nessuna fattura.
//
// ⚠️ E NON DAVA NESSUN ERRORE. Dava un elenco vuoto e la frase «Nessun
//    documento libero di questa societa' nell'Archivio: il DDT va prima
//    archiviato li'» — cioe' mandava ad archiviare una cosa gia' archiviata.
//    E' la famiglia dell'assenza che si traveste da informazione.
//
// ⚠️ QUI SI PROVA LA REGOLA PURA. Che la societa' arrivi davvero fino al
//    documento lo prova la verifica dentro la migrazione
//    `20260921000001`, che gira nel database: da qui non si puo' vedere.

const SRLS = "11111111-1111-1111-1111-111111111111";
const AGRICOLA = "22222222-2222-2222-2222-222222222222";

const fattura = (entity_id = SRLS) => ({ id: "f1", entity_id });

// Un documento nato dalla posta: prima di oggi arrivava SEMPRE cosi',
// con la societa' vuota.
const dallaPosta = (extra = {}) => ({
  id: "d-posta",
  title: "DDT 4412 — Mililli",
  entity_id: null,
  supplier_invoice_id: null,
  ...extra,
});

// Un documento creato a mano dall'Archivio: la societa' e' un campo del
// modulo, facoltativo, e chi lo compila la sceglie.
const aMano = (extra = {}) => ({
  id: "d-mano",
  title: "Contratto di locazione",
  entity_id: SRLS,
  supplier_invoice_id: null,
  ...extra,
});

describe("🔴 documento dalla posta CON societa' nota", () => {
  it("si collega alla fattura della stessa societa'", () => {
    const d = dallaPosta({ entity_id: SRLS });
    expect(documentoCollegabile(d, fattura(SRLS))).toBe(true);
    expect(documentiCollegabili([d], fattura(SRLS)).map((x) => x.id)).toEqual(["d-posta"]);
  });

  it("⚠️ NON si collega alla fattura di un'altra societa'", () => {
    // La S.r.l.s. e l'azienda agricola sono due entita' fiscali distinte:
    // e' il vincolo portante del progetto, non una preferenza.
    const d = dallaPosta({ entity_id: AGRICOLA });
    expect(documentoCollegabile(d, fattura(SRLS))).toBe(false);
    expect(documentiCollegabili([d], fattura(SRLS))).toEqual([]);
  });

  it("non si collega se e' gia' collegato a un'altra fattura", () => {
    const d = dallaPosta({ entity_id: SRLS, supplier_invoice_id: "f-vecchia" });
    expect(documentoCollegabile(d, fattura(SRLS))).toBe(false);
  });
});

describe("🔴 documento dalla posta SENZA societa'", () => {
  it("non risulta collegabile per errore", () => {
    const d = dallaPosta();
    expect(documentoCollegabile(d, fattura(SRLS))).toBe(false);
    expect(documentiCollegabili([d], fattura(SRLS))).toEqual([]);
  });

  it("⚠️ e non lo diventa nemmeno se arriva come `undefined` invece che come vuoto", () => {
    // Le due forme arrivano da query diverse. Senza la normalizzazione,
    // `undefined === null` sarebbe falso e il comportamento cambierebbe a
    // seconda di come il documento e' stato letto.
    const d = dallaPosta({ entity_id: undefined });
    expect(documentoCollegabile(d, fattura(SRLS))).toBe(false);
  });

  it("🔴 due documenti senza societa' non si collegano fra loro tramite il vuoto", () => {
    // Il caso che fa male: se anche la fattura non avesse societa', `null ===
    // null` sarebbe VERO in JavaScript e il documento risulterebbe
    // collegabile. Oggi `supplier_invoices.entity_id` e' obbligatoria, quindi
    // non capita — ma la regola non deve appoggiarsi a quel vincolo.
    expect(documentoCollegabile(dallaPosta(), { id: "f0", entity_id: null })).toBe(false);
  });

  it("si contano, perche' l'elenco vuoto possa dire la verita'", () => {
    const righe = [dallaPosta(), dallaPosta({ id: "d2" }), aMano()];
    expect(senzaSocieta(righe)).toBe(2);
    // Uno gia' collegato non e' «libero»: non si conta fra quelli da sistemare.
    expect(senzaSocieta([dallaPosta({ supplier_invoice_id: "f9" })])).toBe(0);
  });
});

describe("⚠️ nessuna regressione per i documenti creati a mano", () => {
  it("quello della stessa societa' si collega come prima", () => {
    expect(documentoCollegabile(aMano(), fattura(SRLS))).toBe(true);
  });

  it("quello di un'altra societa' resta fuori come prima", () => {
    expect(documentoCollegabile(aMano({ entity_id: AGRICOLA }), fattura(SRLS))).toBe(false);
  });

  it("quello a cui la societa' non e' stata data resta fuori come prima", () => {
    // Nell'Archivio a mano la societa' e' facoltativa: lasciandola vuota si
    // ottiene lo stesso documento «muto» che produceva la posta. Il
    // comportamento non cambia — cambia solo che adesso la posta puo' NON
    // produrlo.
    expect(documentoCollegabile(aMano({ entity_id: null }), fattura(SRLS))).toBe(false);
  });

  it("l'ordine e la selezione dell'elenco non cambiano", () => {
    const righe = [
      aMano({ id: "a", entity_id: SRLS }),
      dallaPosta({ id: "b", entity_id: AGRICOLA }),
      aMano({ id: "c", entity_id: SRLS, supplier_invoice_id: "f7" }),
      dallaPosta({ id: "d", entity_id: SRLS }),
      dallaPosta({ id: "e" }),
    ];
    expect(documentiCollegabili(righe, fattura(SRLS)).map((x) => x.id)).toEqual(["a", "d"]);
  });

  it("un elenco non letto non diventa un elenco vuoto per sbaglio", () => {
    // `leggi()` puo' restituire un segno di «non letto» invece di un array:
    // meglio nessun collegabile che un errore, ma senza fingere zero altrove.
    expect(documentiCollegabili(null, fattura(SRLS))).toEqual([]);
    expect(senzaSocieta(undefined)).toBe(0);
  });
});

describe("🔴 la Posta puo' dire la societa': senza il campo, la correzione non avrebbe una porta", () => {
  it("le due azioni che archiviano hanno il campo «societa»", () => {
    expect(CAMPI_AZIONE.archivia_documento).toContain("societa");
    expect(CAMPI_AZIONE.archivia_testo).toContain("societa");
  });

  it("⚠️ le altre azioni NON ce l'hanno: un promemoria non intesta niente", () => {
    for (const tipo of ["promemoria", "promemoria_multipli", "da_fare_a_mano", "nessuna"]) {
      expect(CAMPI_AZIONE[tipo] ?? []).not.toContain("societa");
    }
  });

  it("il campo sta dopo la sezione e prima della controparte, dove si compila", () => {
    const campi = CAMPI_AZIONE.archivia_documento;
    expect(campi.indexOf("societa")).toBeGreaterThan(campi.indexOf("tipo"));
    expect(campi.indexOf("societa")).toBeLessThan(campi.indexOf("controparte"));
  });

  it("`azioneArchivia` riconosce le due, e nessun'altra", () => {
    expect(azioneArchivia("archivia_documento")).toBe(true);
    expect(azioneArchivia("archivia_testo")).toBe(true);
    for (const tipo of ["promemoria", "carico_magazzino", "nessuna", undefined]) {
      expect(azioneArchivia(tipo)).toBe(false);
    }
  });
});
