-- =====================================================================
-- LE SPESE DELLA BANCA HANNO IL LORO DOCUMENTO — 25/10/2026
-- =====================================================================
--
-- Decisione di Alessio (25/10, «non possiamo aggiungere spese bancarie?»),
-- dopo la prova sul primo estratto Credem: una commissione di bonifico da
-- 1,00 € non aveva un tipo di documento giusto. Fattura, scontrino,
-- autofattura e raccoglitore occasionale non lo sono; «non documentato»
-- la toglierebbe dalle spese deducibili (§6: «senza documento» viene prima
-- di ogni regola) quando il documento c'è, ed è l'estratto conto.
--
-- ⚠️ È un TIPO DI DOCUMENTO, non una causale. La causale («Spese
-- bancarie» o come la vuole chiamare) è un dato di Alessio, da Cassa →
-- Causali: il gestionale non ne crea.
--
-- ⚠️ L'`alter type` sta su una riga sua, FUORI dal blocco di verifica:
-- dentro lo stesso blocco il valore nuovo non sarebbe ancora usabile
-- (CLAUDE.md §6, misurato il 19/08).
-- =====================================================================

alter type cash_document_type add value if not exists 'estratto_conto';

do $verifica$
begin
  if not exists (
    select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
     where t.typname = 'cash_document_type' and e.enumlabel = 'estratto_conto') then
    raise exception 'VERIFICA: «estratto_conto» non e'' fra i tipi di documento.';
  end if;
  -- E si usa davvero: il cast riesce (il valore e' gia' committato da psql).
  perform 'estratto_conto'::cash_document_type;
  raise notice 'Fatto: le spese della banca si registrano col loro documento, l''estratto conto.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20261025000001', 'le_spese_della_banca_hanno_il_loro_documento')
on conflict (version) do nothing;
