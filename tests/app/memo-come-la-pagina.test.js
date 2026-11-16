import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { supabase } from "../../src/lib/supabase";
import { clientAutenticato, credenziali, marchio, primaEntita, righeMie } from "./aiuto";
import { leggiPiano } from "../../src/lib/api/pianoInvestimento";
import { totaliDelPiano } from "../../src/lib/calcoli/pianoInvestimento";
import { listSupplierInvoices } from "../../src/lib/api/supplierInvoices";

// =====================================================================
// «MEMO = PAGINA» — 15/11/2026
// =====================================================================
// 🔴 PERCHÉ ESISTE. Il 15/11 la chat ha detto 69 voci e 98.586,80 € per il
//    piano, mentre la pagina diceva 63 e 77.620,80 €: le voci madri erano
//    contate insieme alle sottovoci. Nessuna prova confrontava il numero di
//    MEMO con quello della pagina, e su Prova non c'erano sottovoci.
//
// ⚠️ LA REGOLA DELLA PAGINA SI PRENDE DAL CODICE DELLA PAGINA, non si
//    riscrive qui: `totaliDelPiano` e `leggiPiano` sono quelle vere. Una
//    copia resterebbe verde anche il giorno che la pagina cambia.
//
// ⚠️ SI CONFRONTA IL RISULTATO (conteggio e totale restituiti dalla
//    funzione di lettura), non il testo del file.
//
// Le altre letture (cassa, banca, magazzino, prenotazioni, HACCP, agenda,
// costo piatti, documenti, fatture clienti) si aggiungono qui una alla volta,
// ognuna col suo caso difficile (RICHIESTA_operativa_protezioni_MEMO_15-11.md).

const MARCA = marchio("PROVA-memo-pagina");
const titolare = await clientAutenticato(credenziali().titolare);
const mie = righeMie(titolare);
let entrato = false;

beforeAll(async () => {
  const { error } = await supabase.auth.signInWithPassword(credenziali().titolare);
  if (error) throw new Error(`Non riesco a entrare come titolare: ${error.message}`);
  entrato = true;
});

afterAll(async () => {
  await mie.pulisci();
  if (entrato) await supabase.auth.signOut({ scope: "local" });
});

async function leggiMemo(nome, cerca = null) {
  const { data, error } = await titolare.rpc(nome, { p_cerca: cerca });
  if (error) throw new Error(`${nome}: ${error.message}`);
  return data ?? [];
}

describe("piano dell'investimento: MEMO = pagina", () => {
  it("conta le voci senza sottovoci, come la pagina, con una madre, una sottovoce archiviata e più di 50 voci", async () => {
    // Una madre con due sottovoci vive e una archiviata.
    const { data: madre, error: eM } = await titolare
      .from("piano_voci")
      .insert({ gruppo: "D", ordine: 9000, descrizione: `${MARCA} madre`, importo_ivato: 1, aliquota_iva: 22, stato: "stimato" })
      .select("id")
      .single();
    expect(eM, "non sono riuscito a creare la madre").toBeNull();
    mie.segna("piano_voci", madre.id);
    for (const [i, importo, archiviata] of [[1, 10, false], [2, 20, false], [3, 5, true]]) {
      const { data: figlia, error } = await titolare
        .from("piano_voci")
        .insert({ gruppo: "D", ordine: 9000 + i, descrizione: `${MARCA} figlia ${i}`, importo_ivato: importo, aliquota_iva: 22, stato: "stimato", madre_id: madre.id })
        .select("id")
        .single();
      expect(error, "non sono riuscito a creare la sottovoce").toBeNull();
      mie.segna("piano_voci", figlia.id);
      if (archiviata) {
        const { error: eA } = await titolare.from("piano_voci").update({ archiviata_il: new Date().toISOString() }).eq("id", figlia.id);
        expect(eA).toBeNull();
      }
    }
    // Più di 50 voci: il conteggio deve dire la verità oltre il taglio.
    const molte = Array.from({ length: 160 }, (_, i) => ({
      gruppo: "D", ordine: 9100 + i, descrizione: `${MARCA} voce ${i}`, importo_ivato: 1, aliquota_iva: 22, stato: "stimato",
    }));
    const { data: inserite, error: eMolte } = await titolare.from("piano_voci").insert(molte).select("id");
    expect(eMolte, "non sono riuscito a creare le 55 voci").toBeNull();
    for (const v of inserite) mie.segna("piano_voci", v.id);

    // La pagina: il suo codice.
    const { voci } = await leggiPiano();
    const pagina = totaliDelPiano(voci).totale;

    // MEMO: la sua lettura, senza ricerca.
    const righe = await leggiMemo("memo_leggi_piano");
    expect(righe.length).toBeGreaterThan(0);
    expect(righe.length).toBeLessThanOrEqual(150);
    expect(righe[0].conteggio).toBe(pagina.voci);
    expect(Number(righe[0].totale)).toBeCloseTo(pagina.previsto, 2);
    expect(righe[0].conteggio).toBeGreaterThan(150); // il conteggio dice la verita' oltre il taglio

    // La madre non compare fra le righe; le sue sottovoci vive sì, la archiviata no.
    const cercate = await leggiMemo("memo_leggi_piano", MARCA);
    const nomi = cercate.map((r) => r.etichetta);
    expect(nomi.some((n) => n.startsWith(`${MARCA} madre`))).toBe(false);
    expect(cercate[0].conteggio).toBe(2 + 160);
    expect(Number(cercate[0].totale)).toBeCloseTo(10 + 20 + 160, 2);
  }, 120000);
});

describe("fatture fornitori: MEMO = pagina", () => {
  it("il da pagare è solo delle non pagate e vale per società, come la pagina", async () => {
    const entita = await primaEntita(titolare);
    const { data: fornitore, error: eF } = await titolare
      .from("suppliers")
      .insert({ entity_id: entita, name: `${MARCA} fornitore` })
      .select("id")
      .single();
    expect(eF, "non sono riuscito a creare il fornitore").toBeNull();
    mie.segna("suppliers", fornitore.id);
    const oggi = new Date().toISOString().slice(0, 10);
    const crea = async (numero, importo, extra = {}) => {
      const { data, error } = await titolare
        .from("supplier_invoices")
        .insert({ entity_id: entita, supplier_id: fornitore.id, invoice_number: `${MARCA}-${numero}`, invoice_date: oggi, due_date: oggi, amount: importo, ...extra })
        .select("id")
        .single();
      expect(error, `non sono riuscito a creare la fattura ${numero}`).toBeNull();
      return mie.segna("supplier_invoices", data.id);
    };
    await crea("1", 100);
    await crea("2", 40);
    await crea("3", 50, { status: "pagata", paid_at: new Date().toISOString() });

    // La pagina: le fatture da pagare di quel fornitore, con la sua stessa funzione, somma di `da_pagare`.
    const daPagare = await listSupplierInvoices({ status: "da_pagare", supplierId: fornitore.id });
    const attesoPagina = daPagare.reduce((s, i) => s + Number(i.da_pagare ?? i.amount), 0);

    const righe = await leggiMemo("memo_leggi_fatture_fornitori", `${MARCA} fornitore`);
    expect(righe.length).toBe(3);
    expect(Number(righe[0].totale)).toBeCloseTo(attesoPagina, 2);
    expect(Number(righe[0].totale)).toBeCloseTo(140, 2); // la pagata (50) non c'è
    expect(righe[0].conteggio).toBe(3); // il conteggio è di tutte, pagata compresa
    // Le non pagate vengono prima, e dicono la società.
    expect(righe.slice(0, 2).every((r) => r.dati.stato === "da_pagare")).toBe(true);
    expect(righe[2].dati.stato).toBe("pagata");
    expect(Number(righe[2].dati.da_pagare)).toBe(0);
    expect(righe[0].dati.societa).toBeTruthy();
  }, 120000);
});

describe("cassa: MEMO = pagina", () => {
  it("conteggio e totale valgono per soggetto: Borgo 58 e la tasca non si mescolano", async () => {
    const { data: soggetti } = await titolare.from("entities").select("id, entity_type").in("entity_type", ["srls", "tasca"]);
    const srls = soggetti.find((e) => e.entity_type === "srls")?.id;
    const tasca = soggetti.find((e) => e.entity_type === "tasca")?.id;
    expect(srls && tasca, "servono Borgo 58 e la tasca").toBeTruthy();
    const oggi = new Date().toISOString().slice(0, 10);
    const movimento = async (entity_id, direction, amount, nota) => {
      const { data, error } = await titolare
        .from("cash_movements")
        .insert({ entity_id, direction, amount, movement_date: oggi, mezzo: "cassa", business_purpose: `${MARCA} ${nota}` })
        .select("id")
        .single();
      expect(error, `non sono riuscito a creare il movimento ${nota}`).toBeNull();
      return mie.segna("cash_movements", data.id);
    };
    await movimento(srls, "entrata", 100, "srls entrata");
    await movimento(srls, "uscita", 30, "srls uscita");
    await movimento(tasca, "uscita", 20, "tasca uscita");

    const righe = await leggiMemo("memo_leggi_cassa", `${MARCA} `);
    expect(righe.length).toBe(3);
    const perSoggetto = new Map();
    for (const r of righe) perSoggetto.set(r.dati.soggetto, { conteggio: r.conteggio, totale: Number(r.totale) });
    expect(perSoggetto.size).toBe(2);
    expect(perSoggetto.get("Borgo 58")).toEqual({ conteggio: 2, totale: 70 });
    expect(perSoggetto.get("La tasca di Alessio")).toEqual({ conteggio: 1, totale: -20 });
  }, 120000);
});

// La banca si carica solo da file (`carica_movimenti_banca`) e le sue righe non si cancellano dal client:
// il suo caso (un ignorato, un abbinato, un da abbinare) sta nella verifica transazionale della migrazione.

describe("HACCP: MEMO = pagina", () => {
  it("una non conformità aperta e vecchia viene prima di più di 50 temperature recenti", async () => {
    const { data: attrezzatura, error: eA } = await titolare
      .from("haccp_equipment")
      .insert({ name: `${MARCA} frigo` })
      .select("id")
      .single();
    expect(eA, "non sono riuscito a creare l'attrezzatura").toBeNull();
    mie.segna("haccp_equipment", attrezzatura.id);
    const { data: nc, error: eNc } = await titolare
      .from("haccp_non_conformities")
      .insert({ category: "temperatura", description: `${MARCA} non conformita aperta`, detected_at: "2020-01-01T10:00:00Z" })
      .select("id")
      .single();
    expect(eNc, "non sono riuscito a creare la non conformità").toBeNull();
    mie.segna("haccp_non_conformities", nc.id);
    const temperature = Array.from({ length: 55 }, () => ({ equipment_id: attrezzatura.id, recorded_temp_c: 3 }));
    const { data: inserite, error: eT } = await titolare.from("haccp_temperature_logs").insert(temperature).select("id");
    expect(eT, "non sono riuscito a creare le temperature").toBeNull();
    for (const t of inserite) mie.segna("haccp_temperature_logs", t.id);

    const righe = await leggiMemo("memo_leggi_haccp", MARCA);
    expect(righe[0].conteggio).toBeGreaterThanOrEqual(56);
    expect(righe[0].dati.registro).toBe("non conformita"); // la vecchia aperta viene prima delle recenti
    expect(righe[0].dati.risolta).toBe(false);
    expect(Number(righe[0].totale)).toBe(0); // un conteggio non è un totale
  }, 120000);
});
