import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { leggiCsvCredem, movimentiCsvDaCaricare } from "../../src/lib/calcoli/csvBanca";

// REVISIONE DELL'11/11/2026, punto 30 (CSV Credem): se la banca cambia descrizione o note di un movimento già
// scaricato, l'impronta cambia. La seconda difesa sta nel database (migrazione 20261125000006) e riconosce i
// bonifici dal «rif. banca». Qui, su un file INVENTATO con la stessa forma del vero (nomi e cifre di fantasia),
// si prova che i campi della chiave restano uguali anche quando la descrizione cambia.

const TESTA = "Data contabile;Data valuta;Descrizione;Causale Abi;Causale Int;Importo;Note";
const riga = (c, v, d, abi, int, imp, note = "") => `${c};${v};"${d}";${abi};${int};${imp};${note}`;
const csv = (note = "", accorcia = false) => {
  const d1 = "BONIFICO A VOSTRO FAVORE rif. banca: 900111222 ordinante: Esempio Uno Srl causale: fattura 12";
  const d2 = "BONIFICO A VOSTRO FAVORE rif. banca: 900111222 ordinante: Esempio Due Spa causale: fattura 34";
  const d3 = "COMMISSIONE SU BONIFICO";
  return [
    TESTA,
    riga("01/10/2026", "01/10/2026", accorcia ? d1.slice(0, 60) : d1, "48", "OC", "1.500,00", note),
    riga("01/10/2026", "01/10/2026", accorcia ? d2.slice(0, 60) : d2, "48", "OC", "47,00", note),
    riga("01/10/2026", "03/10/2026", d3, "16", "CO", "-1,00", note),
    "",
  ].join("\r\n");
};
const daCaricare = (testo) => movimentiCsvDaCaricare(leggiCsvCredem(testo).movimenti);
const chiave = (m) => [m.data_contabile, m.data_valuta, m.importo, m.causale_abi, m.riferimento_banca].join("|");

describe("CSV Credem: i campi della chiave dei bonifici non dipendono dalla descrizione", () => {
  const base = daCaricare(csv());

  it("legge il rif. banca dei bonifici e non quello delle commissioni", () => {
    expect(base.map((m) => m.riferimento_banca)).toEqual(["900111222", "900111222", null]);
  });

  it("due bonifici dello stesso giorno con lo stesso rif. banca ma importo diverso hanno chiavi diverse", () => {
    expect(chiave(base[0])).not.toBe(chiave(base[1]));
  });

  it("con una nota in più l'impronta cambia (il problema) ma la chiave dei bonifici resta uguale (la difesa)", () => {
    const conNota = daCaricare(csv("nota aggiunta dalla banca"));
    expect(conNota.map((m) => m.impronta)).not.toEqual(base.map((m) => m.impronta));
    expect(conNota.slice(0, 2).map(chiave)).toEqual(base.slice(0, 2).map(chiave));
  });

  it("con la descrizione accorciata la chiave dei bonifici resta uguale", () => {
    const corta = daCaricare(csv("", true));
    expect(corta.slice(0, 2).map(chiave)).toEqual(base.slice(0, 2).map(chiave));
  });
});

describe("migrazione 20261125000006: la seconda difesa", () => {
  const m = readFileSync(
    new URL("../../supabase/migrations/20261125000006_un_movimento_gia_caricato_non_rientra_se_cambia_la_descrizione.sql", import.meta.url),
    "utf8",
  );

  it("conta invece di cancellare, e l'importo fa parte della chiave", () => {
    expect(m).toContain("f.rn <= (select count(*) from movimenti_banca e");
    expect(m).toContain("- f.gia_riconosciute");
    expect(m).toContain("round(e.importo, 2) = f.imp");
    expect(m).toContain("e.riferimento_banca = f.rif");
    expect(m).toContain("VERIFICA (3b)");
  });

  it("non tocca i dati esistenti e non cambia i permessi", () => {
    expect(m).not.toMatch(/\bupdate\s+movimenti_banca\b|\bdelete\s+from\s+movimenti_banca\b/i);
    expect(m).not.toMatch(/\bgrant\b|\brevoke\b/i);
    expect(m).toContain("on conflict (conto_id, impronta) do nothing");
  });

  it("la verifica prova il caso dei due bonifici e si annulla da sola", () => {
    expect(m).toContain("VERIFICA (1)");
    expect(m).toContain("raise exception 'ZZ_ANNULLA'");
    expect(m).toMatch(/values \('20261125000006', 'un_movimento_gia_caricato_non_rientra_se_cambia_la_descrizione'\)/);
  });
});
