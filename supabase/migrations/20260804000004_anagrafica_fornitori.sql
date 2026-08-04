-- =====================================================================
-- Borgo 58 · Migrazione 0029 — Anagrafica Fornitori vera (§3.11/§3.18)
-- =====================================================================
-- Chiude il caso 🟢 dell'audit §3.18. La causa non era un permesso troppo
-- aperto: `suppliers_display` esponeva allo staff MENO di quanto §3.11
-- descrive (solo id/nome/categoria) perché il modulo Anagrafica Fornitori
-- non era mai stato costruito come tale — `suppliers` era rimasta la
-- tabella minima del Ricettario (nome, contatti, categoria), senza P.IVA,
-- condizioni di pagamento, giorni di consegna né la distinzione fornitori
-- abituali/occasionali che il brief chiede.
--
-- Non un modulo pesante a sé (§3.11): stessa impostazione di Anagrafica
-- Clienti (§3.14, migrazione 20260802000009) — vive come sotto-pagina di
-- un modulo esistente (qui: Magazzino, staff-visible), non un nuovo
-- modulo numerato nella sidebar.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Campi mancanti di §3.11
-- ---------------------------------------------------------------------
alter table suppliers add column tax_code text;              -- P.IVA/codice fiscale
alter table suppliers add column contact_person text;        -- referente
alter table suppliers add column payment_terms text;         -- condizioni di pagamento concordate
alter table suppliers add column delivery_days text;         -- giorni di consegna abituali (testo libero, es. "Lun e Gio")
alter table suppliers add column is_occasional boolean not null default false;

comment on column suppliers.is_occasional is
  'Fornitore occasionale/leggero (§3.11): niente overhead di condizioni di pagamento/giorni di consegna — solo il minimo per la tracciabilità. Es. un acquisto di emergenza al supermercato.';

-- 'economato' mancava tra le categorie del brief (ortofrutta/carne/pesce/
-- latticini/secco/bevande/economato/altro). Solo ADD VALUE qui: un enum
-- appena aggiunto non è utilizzabile nella stessa transazione (vincolo
-- Postgres, già incontrato in 20260803000003) — nessun riferimento a
-- 'economato' più sotto in questo file.
alter type supplier_category add value if not exists 'economato';

-- ---------------------------------------------------------------------
-- 2. Vista staff — due livelli veri, non solo id/nome/categoria (§3.18)
-- ---------------------------------------------------------------------
-- CREATE OR REPLACE VIEW non permette di reinserire colonne in mezzo
-- (lezione già imparata, vedi commit f13b8c0): le nuove vanno in coda.
-- Contatti e giorni di consegna sono operativi (a chi telefono se manca
-- la consegna, quando aspettarla) — condizioni di pagamento e P.IVA sono
-- amministrativi, restano fuori per lo stesso principio di default-deny
-- di §3.5 ("tutto ciò che non è esplicitamente concesso resta riservato"),
-- anche se il brief non li nomina esplicitamente come sensibili.
create or replace view suppliers_display as
select id, name, category, contact_phone, contact_email, contact_person, delivery_days
from suppliers
where active;

comment on view suppliers_display is
  'Fornitori per lo staff (§3.18): identità + contatti operativi + giorni di consegna. Niente P.IVA, condizioni di pagamento, note interne — quelli restano su suppliers, titolare-only.';

-- Nessuna modifica alle policy di suppliers: la migrazione 20260801000001
-- la include già nel gruppo "money-relevant" titolare-only (entities,
-- suppliers, ingredients, price_history, ...) — le nuove colonne ereditano
-- automaticamente la stessa barriera.
