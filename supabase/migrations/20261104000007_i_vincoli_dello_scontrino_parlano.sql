-- =====================================================================
-- I DUE VINCOLI NUOVI DELLO SCONTRINO DICONO COSA VOGLIONO — 05/11/2026.
-- =====================================================================
--
-- La rete `vincoli-che-parlano` chiede che ogni vincolo abbia la sua frase
-- in italiano: è quella che arriva a chi scrive un dato sbagliato. Due delle
-- migrazioni del 04/11 (20261104000002 e 20261104000003) ne avevano
-- lasciati due senza. Solo commenti: niente cambia nei dati.

comment on constraint lavori_stampa_scontrino_id_fkey on lavori_stampa is
  'Un annullo dice quale scontrino annulla, e quello scontrino esiste: finché ha un annullo, non si può cancellare.';

comment on constraint lavoro_matricola_ben_scritta on lavori_stampa is
  'La matricola salvata con uno scontrino è di undici lettere maiuscole o cifre, e ce l''ha solo uno scontrino.';

do $verifica$
begin
  if obj_description((select oid from pg_constraint where conname = 'lavori_stampa_scontrino_id_fkey'), 'pg_constraint') is null
     or obj_description((select oid from pg_constraint where conname = 'lavoro_matricola_ben_scritta'), 'pg_constraint') is null then
    raise exception 'VERIFICA: uno dei due vincoli è ancora senza la sua frase.';
  end if;
  raise notice 'Fatto: i due vincoli nuovi dello scontrino hanno la loro frase in italiano.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20261104000007', 'i_vincoli_dello_scontrino_parlano')
on conflict (version) do nothing;
