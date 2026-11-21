import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// MEMO propone gli aggiornamenti della Scheda (pezzo B1, 21/11/2026): prove sul TESTO della migrazione.
// Che le regole girino davvero lo prova la verifica interna della migrazione su Prova (annullata, zero residui).

const FILE = path.join("supabase", "migrations", "20261121000002_memo_propone_gli_aggiornamenti_della_scheda.sql");
const migrazione = readFileSync(FILE, "utf8");

function corpoFunzione(nome) {
  const r = migrazione.match(new RegExp(`create or replace function ${nome}\\([\\s\\S]*?as \\$funzione\\$([\\s\\S]*?)\\$funzione\\$;`, "i"));
  expect(r, `corpo SQL di ${nome} non trovato`).not.toBeNull();
  return r[1];
}

describe("le proposte della Scheda (B1)", () => {
  it("registra la sua versione e usa gli stessi nomi in migrazione e file", () => {
    expect(FILE).toContain("20261121000002_memo_propone_gli_aggiornamenti_della_scheda.sql");
    expect(migrazione).toMatch(/values \('20261121000002', 'memo_propone_gli_aggiornamenti_della_scheda'\)/);
    expect(migrazione).toMatch(/on conflict \(version\) do nothing/);
    expect(migrazione).toContain("create table if not exists scheda_proposte");
  });

  it("ogni vincolo della tabella ha il suo commento in italiano", () => {
    const vincoli = [...migrazione.matchAll(/constraint (scheda_proposta_[a-z_]+) check/g)].map((m) => m[1]);
    expect(vincoli.length).toBeGreaterThanOrEqual(8);
    for (const nome of vincoli) {
      expect(migrazione, `manca il comment on constraint di ${nome}`).toMatch(new RegExp(`comment on constraint ${nome} on scheda_proposte is`));
    }
  });

  it("una sola proposta in attesa per voce, e le proposte non si cancellano", () => {
    expect(migrazione).toMatch(/create unique index if not exists scheda_proposta_una_in_attesa\s+on scheda_proposte \(chiave\) where stato = 'in_attesa'/);
    expect(migrazione).toMatch(/before delete on scheda_proposte/);
    expect(migrazione).toContain("Le proposte della Scheda non si cancellano");
  });

  it("l'app non scrive mai sulla tabella: solo lettura, e solo il titolare", () => {
    expect(migrazione).toMatch(/alter table scheda_proposte enable row level security/i);
    expect(migrazione).toMatch(/revoke all on table scheda_proposte from public, anon;/i);
    expect(migrazione).toMatch(/revoke all on table scheda_proposte from authenticated;/i);
    expect(migrazione).toMatch(/grant select on table scheda_proposte to authenticated;/i);
    expect(migrazione).not.toMatch(/grant (insert|update|delete|all)[^;]*scheda_proposte/i);
    expect(migrazione).toMatch(/create policy scheda_proposte_titolare_legge on scheda_proposte for select to authenticated\s+using \(\(select is_titolare\(\)\)\)/i);
  });

  it("solo genera e decidi sono aperte; il calcolo e gli aiuti sono chiusi a tutti", () => {
    expect(migrazione).toMatch(/grant execute on function scheda_proposte_genera\(\), scheda_proposta_decidi\(uuid, text, text, boolean\) to authenticated;/);
    const chiuse = migrazione.match(/revoke all on function scheda_proposte_non_cancellabili\(\)[\s\S]*?from public, anon, authenticated;/i)?.[0] ?? "";
    for (const nome of ["scheda_proposte_calcola()", "scheda_fonte_rango(text)", "scheda_normalizza(text)", "scheda_taglia_300(text)"]) {
      expect(chiuse, `${nome} non è chiusa`).toContain(nome);
    }
    expect(migrazione).not.toMatch(/grant execute on function scheda_proposte_calcola/i);
  });

  it("genera e decidi controllano il titolare come prima cosa", () => {
    for (const nome of ["scheda_proposte_genera", "scheda_proposta_decidi"]) {
      const corpo = corpoFunzione(nome);
      expect(corpo.indexOf("if not is_titolare()")).toBeGreaterThanOrEqual(0);
      expect(corpo.indexOf("if not is_titolare()")).toBeLessThan(corpo.indexOf("scheda_proposte_calcola()") >= 0 ? corpo.indexOf("scheda_proposte_calcola()") : Infinity);
    }
    expect(migrazione).toMatch(/security definer set search_path = public as \$funzione\$\s+begin\s+if not is_titolare\(\)/);
  });

  it("il testo proposto non pesca mai contatti, partita IVA, note o importi", () => {
    const corpo = corpoFunzione("scheda_proposte_calcola");
    for (const colonna of ["contact_phone", "contact_email", "contact_person", "tax_code", "\\.note\\b", "\\bamount\\b", "storage_path"]) {
      expect(corpo, `il calcolo legge ${colonna}`).not.toMatch(new RegExp(colonna));
    }
    expect(corpo).toContain("delivery_days");
    expect(corpo).toContain("payment_terms");
  });

  it("i conti del giorno e dei tempi usano il giorno di Roma e le soglie decise", () => {
    const corpo = corpoFunzione("scheda_proposte_calcola");
    expect(corpo).toContain("at time zone 'Europe/Rome'");
    expect(corpo).toMatch(/greatest\(0, 5 - count\(\*\)\)/);
    expect(corpo).toMatch(/interval '90 days'/);
    expect(corpo).toMatch(/v_oggi - 30/);
    expect(corpo).toMatch(/v_oggi - 60/);
    expect(corpo).toMatch(/interval '12 months'/);
    expect(corpo).toMatch(/interval '6 months'/);
    expect(corpo).toMatch(/v\.sezione <> 'decisioni'/);
  });

  it("prima di proporre scarta ciò che il database rifiuterebbe o che è delicato", () => {
    const corpo = corpoFunzione("scheda_proposte_calcola");
    expect(corpo).toContain("scheda_testo_personale(c.testo_dopo)");
    expect(corpo).toContain("scheda_testo_personale(c.chiave)");
    expect(corpo).toContain("scheda_parole_delicate(c.testo_dopo)");
  });

  it("il Sì passa dagli stessi portieri e una voce cambiata dopo la proposta non si sovrascrive", () => {
    const corpo = corpoFunzione("scheda_proposta_decidi");
    expect(corpo).toContain("pg_advisory_xact_lock(hashtext('scheda_voci'))");
    expect(corpo).toMatch(/for update/);
    expect(corpo).toContain("insert into scheda_voci");
    expect(corpo).toContain("'obsoleta'");
    expect(corpo).toContain("'gia_decisa'");
    // La proposta che abbassa la fonte non passa senza la spunta.
    expect(corpo).toMatch(/p\.abbassa_fonte and not coalesce\(p_conferma_fonte, false\)/);
    // Nessun delete e nessun auto-accetta: solo il titolare, con una decisione esplicita.
    expect(corpo).not.toMatch(/delete from/i);
  });

  it("la verifica interna è annullata, ripristina la sequenza e non lascia residui", () => {
    expect(migrazione).toContain("raise exception 'ZZ_ANNULLA'");
    expect(migrazione).toContain("setval('scheda_voci_numero_seq', v_seq_last, v_seq_called)");
    expect(migrazione).toContain("pretendi_nessun_residuo(v_foto");
  });
});
