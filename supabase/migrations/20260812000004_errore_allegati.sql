-- ---------------------------------------------------------------------
-- Perché un allegato non è stato salvato deve restare scritto
-- ---------------------------------------------------------------------
-- Trovato dal vivo il 12/08/2026, alla prima mail vera: l'allegato — un
-- contratto di locazione — è stato scaricato (10 KB, la dimensione è
-- registrata) ma non salvato nell'archivio, e nella schermata compariva
-- come «mancante» senza altro.
--
-- Il difetto non è che il salvataggio sia fallito: succede, e la mail
-- resta comunque registrata (scelta voluta — meglio una mail senza
-- allegato che nessuna mail). Il difetto è che **il motivo non esisteva
-- da nessuna parte**: la funzione se lo teneva e rispondeva ok, quindi
-- l'unico modo di capire era tentare.
--
-- Regola generale che vale oltre questo caso: un errore che non blocca
-- niente va scritto lo stesso, accanto alla cosa che ha toccato. Un
-- guasto silenzioso costa più di un guasto rumoroso, perché si scopre
-- quando serve il documento — cioè tardi.
--
-- Idempotente (§7 punto 3), con verifica finale che solleva eccezione.

alter table posta_allegati
  add column if not exists errore text;

comment on column posta_allegati.errore is
  'Perche'' questo allegato non e'' stato salvato nell''archivio (vuoto se e'' andato bene). Un errore che non blocca niente va scritto lo stesso: altrimenti si scopre quando serve il documento, cioe'' tardi.';

do $verifica$
declare
  n integer;
begin
  select count(*) into n
    from information_schema.columns
   where table_name = 'posta_allegati' and column_name = 'errore';
  if n <> 1 then
    raise exception 'La colonna del motivo non e'' stata creata.';
  end if;

  -- Il servizio deve poterla scrivere, altrimenti resta vuota proprio
  -- quando serve.
  if not has_table_privilege('service_role', 'posta_allegati', 'insert') then
    raise exception 'Il servizio non puo'' registrare gli allegati.';
  end if;

  raise notice 'Allegati: da ora il motivo di un mancato salvataggio resta scritto.';
end
$verifica$;

insert into applied_migrations (version, name)
values ('20260812000004', 'errore_allegati')
on conflict (version) do nothing;

select file_name, storage_path is not null as salvato, errore
  from posta_allegati order by created_at desc limit 10;
