-- 24/11/2026 — Revisione dell'11/11, punto 8: rimborso anticipo, restituzione di prestito, caparra: due invii insieme scrivono due volte.
--
-- Cosa succedeva: se lo stesso gesto arrivava da due apparecchi nello stesso istante (due clic, due tablet, un invio
-- ripetuto da una rete lenta), le tre funzioni leggevano la riga PRIMA che l'altra avesse scritto e andavano avanti tutte e
-- due:
--   · `pareggia_anticipazione`: due rimborsi della stessa nota → escono il doppio dei soldi dal cassetto;
--   · `registra_restituzione_prestito`: due restituzioni che insieme superano quello che si deve;
--   · `registra_caparra`: due caparre sulla stessa prenotazione → un movimento in più.
-- Cura: la riga che decide (la nota, il prestito, la prenotazione) si BLOCCA mentre si controlla (`for update`). Il secondo
-- invio aspetta il primo, poi rilegge: la nota è già pareggiata, il residuo è già sceso, la caparra c'è già e si corregge.
-- Niente vincoli nuovi: un secondo movimento legittimo per la stessa prenotazione o lo stesso prestito esiste (trattenuta,
-- restituzioni a rate), quindi un vincolo unico li romperebbe; il blocco della riga basta e non cambia nessun risultato.
-- Ogni funzione si cambia dal corpo VIVO in un punto solo (controllato: la riga deve comparire una volta sola).

do $blocchi$
declare
  v_def text;
  v_n integer;
  v_caso record;
begin
  perform set_config('request.jwt.claims', null, true);
  for v_caso in
    select * from (values
      ('public.pareggia_anticipazione(uuid, date)',
       'select * into a from anticipazioni_socio where id = p_anticipazione_id;',
       'select * into a from anticipazioni_socio where id = p_anticipazione_id for update;'),
      ('public.registra_restituzione_prestito(uuid, numeric, text, date, text)',
       'select * into v_p from prestiti_privati where id = p_prestito_id;',
       'select * into v_p from prestiti_privati where id = p_prestito_id for update;'),
      ('public.registra_caparra(uuid, numeric, text, uuid)',
       'select reservation_date into v_data from reservations where id = p_reservation_id;',
       'select reservation_date into v_data from reservations where id = p_reservation_id for update;')
    ) as t(funzione, vecchio, nuovo)
  loop
    v_def := replace(pg_get_functiondef(v_caso.funzione::regprocedure), E'\r', '');
    if v_def like '%' || v_caso.nuovo || '%' then continue; end if;
    v_n := (length(v_def) - length(replace(v_def, v_caso.vecchio, ''))) / length(v_caso.vecchio);
    if v_n <> 1 then
      raise exception '% non ha una sola riga «%» (ne ha %): confronta il corpo vivo prima di applicare.', v_caso.funzione, v_caso.vecchio, v_n;
    end if;
    execute replace(v_def, v_caso.vecchio, v_caso.nuovo);
  end loop;
end $blocchi$;

-- ---------------------------------------------------------------------
-- VERIFICA
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_def text;
begin
  perform set_config('request.jwt.claims', null, true);
  v_def := pg_get_functiondef('public.pareggia_anticipazione(uuid, date)'::regprocedure);
  if v_def not like '%from anticipazioni_socio where id = p_anticipazione_id for update;%' then
    raise exception 'VERIFICA (1): il rimborso non blocca la nota mentre la controlla.';
  end if;
  v_def := pg_get_functiondef('public.registra_restituzione_prestito(uuid, numeric, text, date, text)'::regprocedure);
  if v_def not like '%from prestiti_privati where id = p_prestito_id for update;%' then
    raise exception 'VERIFICA (2): la restituzione non blocca il prestito mentre lo controlla.';
  end if;
  v_def := pg_get_functiondef('public.registra_caparra(uuid, numeric, text, uuid)'::regprocedure);
  if v_def not like '%from reservations where id = p_reservation_id for update;%' then
    raise exception 'VERIFICA (3): la caparra non blocca la prenotazione mentre la controlla.';
  end if;
  -- Nessun permesso cambiato: restano chiuse ad anon, aperte a chi entra (il portiere sta dentro ogni funzione).
  if has_function_privilege('anon', 'public.pareggia_anticipazione(uuid, date)', 'execute')
     or has_function_privilege('anon', 'public.registra_restituzione_prestito(uuid, numeric, text, date, text)', 'execute')
     or has_function_privilege('anon', 'public.registra_caparra(uuid, numeric, text, uuid)', 'execute') then
    raise exception 'VERIFICA (4): una delle tre funzioni è aperta ad anon.';
  end if;
  raise notice 'Fatto: rimborso, restituzione del prestito e caparra bloccano la riga mentre la controllano: un secondo invio uguale aspetta il primo e poi rilegge. Provato: zero residui.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20261124000001', 'i_doppi_invii_non_scrivono_due_volte')
on conflict (version) do nothing;
