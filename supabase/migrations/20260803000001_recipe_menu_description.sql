-- =====================================================================
-- Borgo 58 · Migrazione 0022 — Descrizione da menu sulle ricette
-- =====================================================================
-- Il menu cartaceo (§4 mod. 13) mostra una descrizione sotto ogni piatto
-- (es. "Fusilloni al ragù di polpo e polvere di prezzemolo"). È testo
-- pensato per il cliente, diverso dalle note interne della ricetta.
-- =====================================================================

alter table recipes add column menu_description text;
comment on column recipes.menu_description is
  'Descrizione del piatto per il menu cartaceo (rivolta al cliente), distinta dalle note interne.';
