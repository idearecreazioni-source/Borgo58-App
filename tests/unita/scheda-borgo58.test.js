import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ORFANE_PIANIFICATE } from "../app/orfane";

const FILE = path.join("supabase", "migrations", "20261120000002_la_scheda_di_borgo58.sql");
const migrazione = readFileSync(FILE, "utf8");

function estraiPatternSQL(nome) {
  const risultato = migrazione.match(new RegExp(`${nome} text := '([^']+)'`, "i"));
  expect(risultato, `pattern SQL ${nome} non trovato`).not.toBeNull();
  return risultato[1];
}

function regexPostgresInJavaScript(pattern) {
  // In PostgreSQL \m e \M distinguono inizio e fine parola. JavaScript ha
  // solo \b: per questi identificativi ASCII delimitati è l'equivalente utile.
  return new RegExp(pattern.replaceAll("\\m", "\\b").replaceAll("\\M", "\\b"), "i");
}

function corpoFunzioneSQL(nome) {
  const risultato = migrazione.match(new RegExp(`create or replace function ${nome}\\(\\)[\\s\\S]*?as \\$funzione\\$([\\s\\S]*?)\\$funzione\\$;`, "i"));
  expect(risultato, `corpo SQL di ${nome} non trovato`).not.toBeNull();
  return risultato[1];
}

function passaLuhn(numero) {
  const cifre = numero.replaceAll(/[^0-9]/g, "");
  let somma = 0;
  for (let indice = cifre.length - 1, posizione = 1; indice >= 0; indice -= 1, posizione += 1) {
    let cifra = Number(cifre[indice]);
    if (posizione % 2 === 0) cifra = cifra > 4 ? cifra * 2 - 9 : cifra * 2;
    somma += cifra;
  }
  return somma % 10 === 0;
}

function testoPersonale(testo) {
  const iban = regexPostgresInJavaScript(estraiPatternSQL("v_iban_pattern"));
  const codiceFiscale = regexPostgresInJavaScript(estraiPatternSQL("v_cf_pattern"));
  const carta = regexPostgresInJavaScript(estraiPatternSQL("v_carta_pattern"));
  const carte = [...testo.matchAll(new RegExp(carta.source, "gi"))];
  return iban.test(testo) || codiceFiscale.test(testo) || carte.some(([numero]) => passaLuhn(numero));
}

describe("la Scheda di Borgo 58 (S1)", () => {
  it("ha solo le otto sezioni scelte e non apre quelle personali", () => {
    const sezioni = ["titolare", "societa", "locale", "concept", "fornitori", "consulenti", "decisioni", "come_rispondere"];
    for (const sezione of sezioni) expect(migrazione).toContain(`'${sezione}'`);
    expect(migrazione).toMatch(/scheda_voce_sezione_nota[\s\S]*niente famiglia, salute, debiti o prestiti/i);
  });

  it("chiude i permessi e lascia allo storico soltanto la lettura del titolare", () => {
    expect(migrazione).toMatch(/alter table scheda_voci enable row level security/i);
    expect(migrazione).toMatch(/alter table scheda_storico enable row level security/i);
    expect(migrazione).toMatch(/revoke all on table scheda_voci, scheda_storico from authenticated/i);
    expect(migrazione).toMatch(/grant select, insert, update on table scheda_voci to authenticated/i);
    expect(migrazione).toMatch(/grant select on table scheda_storico to authenticated/i);
    expect(migrazione).toMatch(/has_table_privilege\('authenticated', 'scheda_storico', 'insert'\)/i);
    expect(migrazione).toMatch(/has_table_privilege\('authenticated', 'scheda_storico', 'update'\)/i);
    expect(migrazione).toMatch(/has_table_privilege\('authenticated', 'scheda_storico', 'delete'\)/i);
    expect(migrazione).toMatch(/has_table_privilege\('authenticated', 'scheda_storico', 'truncate'\)/i);
    expect(migrazione).toMatch(/revoke all on sequence scheda_voci_numero_seq from authenticated/i);
    expect(migrazione).toMatch(/has_sequence_privilege\('authenticated', 'scheda_voci_numero_seq', 'update'\) <> false/i);
  });

  it("protegge la privacy anche nella chiave senza scambiare dati d'impresa per carte", () => {
    expect(migrazione).toMatch(/security definer[\s\S]*set search_path = public[\s\S]*as \$funzione\$[\s\S]*foreach v_campo/i);
    expect(migrazione).toContain("array[new.chiave, new.testo, new.fonte_dettaglio]");
    expect(migrazione).toContain("v_iban_pattern");
    expect(migrazione).toContain("\\m[A-Za-z]{2}[0-9]{2}");
    expect(migrazione).toContain("[0-9LMNPQRSTUV]");
    expect(migrazione).toContain("scheda_numero_carta_valido");
    expect(migrazione).toContain("fornitore:ortofrutta-2026-consegne-settimanali");
    expect(migrazione).toContain("Solo il titolare può modificare la Scheda");
  });

  it("lascia passare l'UPDATE del solo documento prima di controllare il titolare", () => {
    const campiPerTrigger = {
      scheda_controlla_privacy: ["chiave", "testo", "fonte_dettaglio", "sezione", "attiva"],
      scheda_controlla_limiti: ["chiave", "testo", "fonte", "fonte_dettaglio", "valida_dal", "verificata_il", "sezione", "attiva"],
    };
    for (const [nome, campi] of Object.entries(campiPerTrigger)) {
      const corpo = corpoFunzioneSQL(nome);
      const uscitaAnticipata = corpo.indexOf("if tg_op = 'UPDATE'");
      const controlloTitolare = corpo.indexOf("if not is_titolare()");
      expect(uscitaAnticipata).toBeGreaterThanOrEqual(0);
      expect(controlloTitolare).toBeGreaterThan(uscitaAnticipata);
      const uscita = corpo.slice(uscitaAnticipata, controlloTitolare);
      for (const campo of campi) {
        expect(uscita).toContain(`old.${campo} is not distinct from new.${campo}`);
      }
      expect(uscita).toMatch(/return new;/i);
    }
    expect(migrazione).toMatch(/update scheda_voci set documento_id = null where id = v_voce/i);
  });

  it("esegue le regex SQL della privacy su testi continui, delimitati e ripetuti", () => {
    const ammessi = [
      "P.IVA 12345678901 Rossi Srl",
      "Consegna il martedì alle 10 con furgone refrigerato",
      "Via Roma 12 Bologna centro storico",
      "fornitore:ortofrutta-2026-consegne-settimanali",
      "Tel 333 1234567",
      "Preventivo del 03/11/2026: importo 1.250,00 euro",
      "l".repeat(300),
      "ab ".repeat(100),
    ];
    const rifiutati = [
      "IBAN finto IT60X0542811101000000123456",
      "IBAN finto IT60 X054 2811 1010 0000 0012 3456",
      "IBAN finto IT60-X054-2811-1010-0000-0012-3456",
      "IBAN finto IT60.X054.2811.1010.0000.0012.3456",
      "Codice finto RSS-MRA-85T-10A-562S",
      "Carta finta 4000 0000 0000 0002",
      "Carta finta 4000-0000-0000-0002",
    ];

    for (const testo of ammessi) expect(testoPersonale(testo), testo).toBe(false);
    for (const testo of rifiutati) expect(testoPersonale(testo), testo).toBe(true);
  });

  it("registra lo storico dal trigger, con autore affidabile e campi rilevanti", () => {
    expect(migrazione).toMatch(/pg_trigger_depth\(\) < 2/i);
    expect(migrazione).toMatch(/coalesce\(auth\.uid\(\)::text, 'sistema'\)/i);
    for (const campo of ["attiva_prima", "attiva_dopo", "chiave_prima", "chiave_dopo", "sezione_prima", "sezione_dopo"]) {
      expect(migrazione).toContain(campo);
    }
    expect(migrazione).toContain("Il proprietario è un ruolo con privilegi");
    expect(migrazione).toMatch(/get diagnostics v_toccate = row_count/i);
  });

  it("compone la voce in scrittura e frena il testo MEMO e le 60 voci separatamente", () => {
    expect(migrazione).toContain("where (p_includi).id is not null and (p_includi).attiva");
    expect(migrazione).toContain("pg_advisory_xact_lock(hashtext('scheda_voci'))");
    expect(migrazione).toContain("Il testo composto per MEMO supera il limite di 10.000 caratteri");
    expect(migrazione).toContain("La Scheda ha già 60 voci attive");
    expect(migrazione).toContain("generate_series(1, 20)");
    expect(migrazione).toContain("limite:spenta-zz");
    expect(migrazione).toContain("repeat('ab ', 100)");
    expect(migrazione).toMatch(/reset role;\s*loop[\s\S]*?from scheda_voci_numero_seq[\s\S]*?scheda_compone_testo\(null, v_record\)[\s\S]*?end loop;\s*set local role authenticated;/i);
  });

  it("conserva numero e versione stabili e ripristina la sequenza della verifica", () => {
    expect(migrazione).toMatch(/numero integer generated always as identity/i);
    expect(migrazione).toMatch(/constraint scheda_voci_numero_unico unique \(numero\)/i);
    expect(migrazione).toMatch(/'versione', coalesce\(to_char\(v_aggiornata/i);
    expect(migrazione).toMatch(/order by v\.ordine, v\.numero/i);
    expect(migrazione).toContain("select last_value, is_called into v_seq_last, v_seq_called");
    expect(migrazione).toContain("setval('scheda_voci_numero_seq', v_seq_last, v_seq_called)");
    expect(migrazione).toContain("la prima voce non riceve il numero [S1]");
    expect(migrazione).toContain("scheda_voci contiene già righe; la verifica monouso viene saltata");
  });

  it("blocca i tre campi stabili della voce", () => {
    expect(migrazione).toMatch(/new\.id is distinct from old\.id[\s\S]*new\.numero is distinct from old\.numero[\s\S]*new\.creata_il is distinct from old\.creata_il/i);
  });

  it("dichiara le due funzioni chiamabili ma senza schermata della S1-S3", () => {
    for (const nome of ["scheda_per_memo", "scheda_parole_delicate"]) {
      expect(ORFANE_PIANIFICATE[nome]).toMatchObject({ versione: "20261120000002" });
      expect(ORFANE_PIANIFICATE[nome].perche).toContain("Scheda di Borgo 58, S1-S3");
    }
  });

  it("registra la sua versione e usa gli stessi nomi in migrazione, rete e file", () => {
    expect(FILE).toContain("20261120000002_la_scheda_di_borgo58.sql");
    expect(migrazione).toMatch(/values \('20261120000002', 'la_scheda_di_borgo58'\)/);
    expect(migrazione).toContain("create table if not exists scheda_voci");
    expect(migrazione).toContain("create table if not exists scheda_storico");
  });
});
