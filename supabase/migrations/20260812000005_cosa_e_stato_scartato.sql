-- ---------------------------------------------------------------------
-- Se il sistema salta qualcosa, deve dirlo — e dirlo sul telefono
-- ---------------------------------------------------------------------
-- Chiesto da Alessio il 12/08/2026, subito dopo aver tolto il limite sul
-- numero di allegati: «non possiamo aggiungere un avviso che mi dice
-- quando il sistema blocca una mail?».
--
-- La domanda è quella giusta, ed è la stessa lezione dell'allegato non
-- salvato di un'ora prima: **uno scarto silenzioso è indistinguibile da
-- una cosa mai arrivata**. Nel caso della posta è peggio, perché ciò che
-- viene saltato è quasi sempre ciò che è troppo grande — e un documento
-- grande è di solito un documento che conta.
--
-- Dove il sistema può saltare qualcosa, e prima d'ora taceva:
--   · un allegato oltre la taglia che il servizio AI accetta;
--   · un formato che non si riesce ad aprire;
--   · un allegato che non si scarica dall'archivio;
--   · la lettura che fallisce del tutto (la mail resta «da leggere» per
--     sempre, e nell'elenco sembra solo in ritardo).
--
-- Da qui in avanti resta scritto sulla mail **e** arriva su Telegram, con
-- il freno che il canale ha già: un avviso per tipo all'ora, altrimenti
-- una giornata storta diventa venti messaggi e li si smette di leggere.
--
-- Idempotente (§7 punto 3), con verifica finale che solleva eccezione.

alter table posta_ricevuta
  add column if not exists lettura_note text;

comment on column posta_ricevuta.lettura_note is
  'Cosa la lettura ha dovuto saltare, e perche'' (vuoto se ha letto tutto). Uno scarto silenzioso e'' indistinguibile da una cosa mai arrivata: quello che viene saltato e'' quasi sempre cio'' che e'' troppo grande, cioe'' quasi sempre cio'' che conta.';

-- Il ruolo di servizio la scrive: la riempie la funzione di lettura, che
-- non ha un utente da impersonare.
grant update on posta_ricevuta to service_role;

do $verifica$
declare
  n integer;
begin
  select count(*) into n
    from information_schema.columns
   where table_name = 'posta_ricevuta' and column_name = 'lettura_note';
  if n <> 1 then
    raise exception 'La colonna delle note di lettura non e'' stata creata.';
  end if;

  if not has_table_privilege('service_role', 'posta_ricevuta', 'update') then
    raise exception 'La lettura non puo'' scrivere cosa ha saltato.';
  end if;

  -- Il canale degli avvisi deve esistere davvero, altrimenti l'avviso
  -- che stiamo aggiungendo non arriverebbe da nessuna parte.
  select count(*) into n from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public' and p.proname = 'segnala_allarme';
  if n < 1 then
    raise exception 'Manca il canale degli allarmi: l''avviso non arriverebbe.';
  end if;

  raise notice 'Posta: da ora cio'' che la lettura salta resta scritto e arriva sul telefono.';
end
$verifica$;

insert into applied_migrations (version, name)
values ('20260812000005', 'cosa_e_stato_scartato')
on conflict (version) do nothing;

select oggetto, stato, lettura_note
  from posta_ricevuta order by created_at desc limit 10;
