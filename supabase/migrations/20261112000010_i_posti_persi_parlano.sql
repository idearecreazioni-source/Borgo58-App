-- =====================================================================
-- IL VINCOLO DEI POSTI PERSI PER GIUNZIONE DICE COSA VUOLE — 12/11/2026.
-- =====================================================================
--
-- La rete `vincoli-che-parlano` chiede che ogni vincolo abbia la sua frase
-- in italiano: è quella che arriva a chi scrive un dato sbagliato. La
-- 20261112000009 (i piccoli accostati fanno quattro) ha aggiunto il controllo
-- su `formati_tavolo.posti_persi_per_giunzione` senza la frase, e su Prova era
-- già applicata: una migrazione applicata non si riscrive, quindi la frase
-- arriva qui. Solo un commento: niente cambia nei dati.

comment on constraint formati_tavolo_posti_persi_per_giunzione_check on formati_tavolo is
  'I posti che un tavolo perde per ogni tavolo accostato vanno da 0 a 10: 0 per i piccoli, che accostati non perdono sedie.';

do $verifica$
begin
  if obj_description(
       (select oid from pg_constraint
         where conname = 'formati_tavolo_posti_persi_per_giunzione_check'
           and conrelid = 'public.formati_tavolo'::regclass),
       'pg_constraint') is null then
    raise exception 'VERIFICA: il vincolo dei posti persi per giunzione è ancora senza la sua frase.';
  end if;
  raise notice 'Fatto: il vincolo dei posti persi per giunzione ha la sua frase in italiano.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20261112000010', 'i_posti_persi_parlano')
on conflict (version) do nothing;
