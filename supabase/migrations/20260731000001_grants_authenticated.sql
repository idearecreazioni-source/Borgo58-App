-- =====================================================================
-- Borgo 58 · Migrazione 0002 — Permessi Data API per il ruolo authenticated
-- =====================================================================
-- Ieri il progetto è stato creato con "esposizione automatica nuove tabelle"
-- DISATTIVATA (scelta di sicurezza consigliata). Di conseguenza le tabelle
-- non sono raggiungibili via Data API finché non concediamo i permessi.
--
-- Modello: applicazione monoutente. Concediamo l'accesso al ruolo
-- `authenticated` (l'utente loggato via Supabase Auth). La Row Level Security
-- già attiva (migrazione 0001) continua a filtrare le righe.
-- Il ruolo `anon` (non loggato) NON riceve accesso ai dati: potrà solo
-- autenticarsi. Vedi §3.3 del brief.
-- =====================================================================

grant usage on schema public to authenticated;

-- Tabelle e viste esistenti
grant select, insert, update, delete on all tables in schema public to authenticated;

-- Oggetti futuri creati nello schema public (evita di ripetere i grant ad ogni migrazione)
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
