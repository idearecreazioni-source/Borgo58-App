import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// L'import dal Drive, pezzo C1 (22/11/2026): prove sul TESTO della migrazione e delle funzioni online.
// Che le regole girino davvero lo prova la verifica interna della migrazione su Prova (annullata, zero residui).

const FILE = path.join("supabase", "migrations", "20261122000001_import_drive_c1.sql");
const migrazione = readFileSync(FILE, "utf8");
const letto = (p) => readFileSync(p, "utf8");
const assistente = letto("supabase/functions/assistente-archivio/index.ts");
const documentoLeggi = letto("supabase/functions/documento-leggi/index.ts");
const memoChat = letto("supabase/functions/memo-chat/index.ts");
const corridoio = letto("supabase/functions/operazioni-atomiche/index.ts");

function corpoFunzione(nome) {
  const r = migrazione.match(new RegExp(`create or replace function ${nome}\\([\\s\\S]*?as \\$funzione\\$([\\s\\S]*?)\\$funzione\\$;`, "i"));
  expect(r, `corpo SQL di ${nome} non trovato`).not.toBeNull();
  return r[1];
}

describe("l'import dal Drive (C1)", () => {
  it("registra la sua versione", () => {
    expect(migrazione).toMatch(/values \('20261122000001', 'import_drive_c1'\)/);
    expect(migrazione).toMatch(/on conflict \(version\) do nothing/);
  });

  it("ogni vincolo nuovo ha il suo commento in italiano", () => {
    const vincoli = [...migrazione.matchAll(/(?:add )?constraint ([a-z_0-9]+)\s+(?:check|foreign key)/g)].map((m) => m[1]);
    expect(vincoli.length).toBeGreaterThanOrEqual(8);
    for (const nome of vincoli) {
      expect(migrazione, `manca il comment on constraint di ${nome}`).toMatch(new RegExp(`comment on constraint ${nome} on `));
    }
    expect(migrazione).toContain("comment on constraint elenco_drive_importato_documento_id_fkey on elenco_drive");
  });

  it("i documenti hanno no_ai spento di partenza, e le altre tre colonne vuote", () => {
    expect(migrazione).toContain("add column if not exists no_ai boolean not null default false");
    expect(migrazione).toContain("add column if not exists sensibile text;");
    expect(migrazione).toContain("add column if not exists impronta_sha256 text;");
    expect(migrazione).toContain("add column if not exists lotto_import_id uuid;");
    // I doppioni non si vietano: l'indice dell'impronta non è unico.
    expect(migrazione).toMatch(/create index if not exists idx_documents_impronta on documents \(impronta_sha256\)/);
    expect(migrazione).not.toMatch(/create unique index[^;]*impronta/i);
  });

  it("le tre sezioni nuove entrano senza toccare le altre", () => {
    for (const codice of ["preventivi", "progetto_planimetrie", "assicurazioni"]) expect(migrazione).toContain(`'${codice}'`);
    expect(migrazione).toMatch(/on conflict \(codice\) do update/);
    expect(migrazione).not.toMatch(/delete from sezioni_archivio|update sezioni_archivio/i);
  });

  it("«Chiedi all'archivio» e la chat di MEMO escludono i documenti no_ai", () => {
    expect(corpoFunzione("documenti_per_domanda")).toMatch(/where not d\.no_ai/);
    const chat = corpoFunzione("memo_leggi_documenti");
    expect(chat).toMatch(/where not d\.no_ai\s+and \(p_cerca is null/);
    expect(chat).toContain("limit 150");
    expect(chat).toContain("if not is_titolare()");
  });

  it("le funzioni online chiudono la strada ai documenti no_ai (secondo lucchetto)", () => {
    expect(assistente).toMatch(/select\("id, title, testo, no_ai"\)/);
    expect(assistente).toMatch(/if \(riga\?\.no_ai === true\) continue;/);
    expect(documentoLeggi).toMatch(/select\("id, title, file_name, storage_path, testo, no_ai"\)/);
    // Il controllo sta PRIMA di ogni altra strada: né testo già in archivio, né lettura nuova, né dalla chat.
    const controllo = documentoLeggi.indexOf("doc.no_ai === true");
    expect(controllo).toBeGreaterThan(0);
    expect(controllo).toBeLessThan(documentoLeggi.indexOf("if (!doc.storage_path)"));
    expect(controllo).toBeLessThan(documentoLeggi.indexOf("doc.testo && doc.testo.length > 0 && !corpo.rileggi"));
  });

  it("i lotti non si cancellano, si leggono e si aprono soltanto dal titolare", () => {
    expect(migrazione).toMatch(/before delete on lotti_import/);
    expect(migrazione).toMatch(/revoke all on table lotti_import from authenticated;/);
    expect(migrazione).toMatch(/grant select, insert on table lotti_import to authenticated;/);
    expect(migrazione).not.toMatch(/grant [^;]*(update|delete|all)[^;]*lotti_import/i);
    // Un lotto lo apre chi lo firma: «creato da» deve essere chi è entrato.
    expect(migrazione).toMatch(/with check \(\(select is_titolare\(\)\) and annullato_il is null and annullato_da is null\s+and creato_da = \(select auth\.uid\(\)\)\)/);
  });

  it("un documento non entra in un lotto già annullato (trigger), e la funzione è chiusa a tutti", () => {
    const corpo = corpoFunzione("documenti_lotto_non_annullato");
    expect(corpo).toContain("l.annullato_il is not null");
    expect(corpo).toContain("old.lotto_import_id is not distinct from new.lotto_import_id");
    expect(migrazione).toMatch(/create trigger documenti_lotto_non_annullato before insert or update of lotto_import_id on documents\s+for each row when \(new\.lotto_import_id is not null\)/);
    expect(migrazione).toMatch(/revoke all on function documenti_lotto_non_annullato\(\) from public, anon, authenticated;/);
  });

  it("prima di togliere i file la pagina può sapere se l'annullamento è possibile (sola lettura)", () => {
    const corpo = corpoFunzione("import_lotto_puo_annullare");
    expect(migrazione).toMatch(/create or replace function import_lotto_puo_annullare\(p_lotto uuid\)\s+returns table \(puo boolean, motivo text\)\s+language plpgsql stable security definer set search_path = public/);
    expect(corpo.indexOf("if not is_titolare()")).toBeGreaterThanOrEqual(0);
    expect(corpo).toContain("annullato_il is not null");
    expect(corpo).toContain("spese_da_collocare");
    expect(corpo).not.toMatch(/\b(insert|update|delete)\b/i);
    expect(migrazione).toMatch(/grant execute on function import_lotto_puo_annullare\(uuid\) to authenticated;/);
  });

  it("le sezioni nuove spente (legacy) si riaccendono, quelle accese non si toccano", () => {
    expect(migrazione).toMatch(/on conflict \(codice\) do update\s+set attiva = true, etichetta = excluded\.etichetta, ordine = excluded\.ordine\s+where not sezioni_archivio\.attiva;/);
  });

  it("l'elenco del Drive ha il suo no_ai e l'indice sul documento importato", () => {
    expect(migrazione).toContain("alter table elenco_drive add column if not exists no_ai boolean not null default false;");
    expect(migrazione).toMatch(/create index if not exists idx_elenco_drive_importato on elenco_drive \(importato_documento_id\) where importato_documento_id is not null;/);
    expect(corpoFunzione("elenco_drive_cerca")).toMatch(/where not e\.no_ai/);
  });

  it("le proposte della Scheda non pescano i contratti no_ai: si ripara il corpo vivo, una riga per query", () => {
    expect(migrazione).toMatch(/pg_get_functiondef\('public\.scheda_proposte_calcola\(\)'::regprocedure\)/);
    expect(migrazione).toContain("and not d0.no_ai");
    expect(migrazione).toContain("d.expiry_date < v_oggi and not d.no_ai");
    expect(migrazione).toMatch(/if v_n1 <> 1 or v_n2 <> 1 then/);
    // La migrazione già su work (20261121000002) non si tocca.
    const vecchia = readFileSync(path.join("supabase", "migrations", "20261121000002_memo_propone_gli_aggiornamenti_della_scheda.sql"), "utf8");
    expect(vecchia).not.toContain("no_ai");
  });

  it("la verifica prova che anon non esegue nessuna funzione nuova", () => {
    expect(migrazione).toMatch(/has_function_privilege\('anon', v_fn, 'execute'\)/);
    for (const nome of ["import_lotto_puo_annullare(uuid)", "documenti_lotto_non_annullato()", "elenco_drive_cerca(text,integer)"]) {
      expect(migrazione).toContain(`'${nome}'`);
    }
  });

  it("senza parole valide la ricerca non restituisce niente, e «Chiedi all'archivio» dice se i documenti sono tutti riservati", () => {
    expect(corpoFunzione("elenco_drive_cerca")).toMatch(/if coalesce\(array_length\(v_parole, 1\), 0\) = 0 then return; end if;/);
    expect(assistente).toContain("Nessun documento che l'assistente possa leggere");
    expect(assistente.indexOf('from("documents").select("id", { count: "exact", head: true })')).toBeGreaterThan(0);
  });

  it("annullare un lotto: solo il titolare, una volta sola, e passa dal corridoio", () => {
    const corpo = corpoFunzione("import_lotto_annulla");
    expect(corpo.indexOf("if not is_titolare()")).toBeGreaterThanOrEqual(0);
    expect(corpo).toMatch(/for update/);
    expect(corpo).toContain("gia'' stato annullato");
    expect(corpo).toMatch(/update tasks set status = 'completato'/);
    expect(corpo).toMatch(/exception when foreign_key_violation/);
    expect(corpo).toMatch(/update lotti_import set annullato_il = now\(\), annullato_da = auth\.uid\(\)/);
    expect(corridoio).toContain('"import_lotto_annulla"');
    expect(migrazione).toMatch(/grant execute on function import_lotto_annulla\(uuid\) to authenticated;/);
  });

  it("l'elenco del Drive è solo del titolare e il link non entra due volte", () => {
    expect(migrazione).toMatch(/create policy elenco_drive_titolare on elenco_drive for all to authenticated\s+using \(\(select is_titolare\(\)\)\) with check \(\(select is_titolare\(\)\)\)/);
    expect(migrazione).toContain("create unique index if not exists elenco_drive_link_unico on elenco_drive (link)");
    expect(migrazione).toMatch(/revoke all on table elenco_drive from public, anon;/);
    // Nessun nome o link vero dentro il repo pubblico: gli esempi sono inventati (.invalid).
    expect(migrazione).not.toMatch(/drive\.google\.com|docs\.google\.com/);
    const indirizzi = migrazione.match(/https:\/\/[^'\s]+/g) ?? [];
    expect(indirizzi.every((u) => u.includes("example.invalid"))).toBe(true);
  });

  it("la ricerca nell'elenco guarda tutte le parole, senza accenti, entro un limite", () => {
    const corpo = corpoFunzione("elenco_drive_cerca");
    expect(corpo.indexOf("if not is_titolare()")).toBeGreaterThanOrEqual(0);
    expect(corpo).toContain("scheda_normalizza(p_testo)");
    expect(corpo).toMatch(/least\(greatest\(coalesce\(p_limite, 10\), 1\), 50\)/);
    expect(corpo).toMatch(/and not exists \(/);
    expect(corpo).toMatch(/limit 6/);
  });

  it("MEMO ha lo strumento per l'elenco del Drive, in sola lettura", () => {
    expect(memoChat).toMatch(/\["leggi_elenco_drive",/);
    expect(memoChat).toContain('"memo_leggi_elenco_drive"]');
    expect(memoChat).toContain('memo_leggi_elenco_drive: "elenco_drive"');
    expect(memoChat).toContain('elenco_drive: "L"');
    const chat = corpoFunzione("memo_leggi_elenco_drive");
    expect(chat).toContain("if not is_titolare()");
    expect(chat).toContain("elenco_drive_cerca(p_cerca, 30)");
    expect(migrazione).toMatch(/grant execute on function memo_leggi_elenco_drive\(text\) to authenticated;/);
  });

  it("il confronto notturno di MEMO non conta i documenti no_ai (niente allarmi finti)", () => {
    expect(migrazione).toContain("into v_pc, v_pt from documents d where not d.no_ai;");
    expect(migrazione).toMatch(/memo_confronta_con_le_pagine\(\)'::regprocedure/);
    // Si cambia una sola riga del corpo vivo, e se non è una sola ci si ferma.
    expect(migrazione).toMatch(/if v_n <> 1 then/);
  });

  it("la funzione del trigger dei lotti è chiusa a tutti (altrimenti anon la può eseguire)", () => {
    expect(migrazione).toMatch(/revoke all on function lotti_import_non_cancellabili\(\) from public, anon, authenticated;/);
  });

  it("la verifica interna è annullata e non lascia residui", () => {
    expect(migrazione).toContain("raise exception 'ZZ_ANNULLA'");
    expect(migrazione).toContain("pretendi_nessun_residuo(v_foto");
  });
});
