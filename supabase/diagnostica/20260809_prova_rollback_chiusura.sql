-- =====================================================================
-- PROVA DI ANNULLAMENTO A META' — chiusura conto sconto/omaggio
-- =====================================================================
-- Richiesta dal Piano correzioni di Cowork (Attività 1): non basta vedere
-- che il caso normale funziona — bisogna FORZARE un fallimento a metà
-- operazione e verificare che non resti scritto niente.
--
-- Cosa fa: crea un conto di prova, tenta di chiuderlo come sconto usando
-- una causale INESISTENTE (violazione di chiave esterna: la seconda
-- scrittura dentro la funzione fallisce di proposito), poi controlla che
-- il fallimento abbia annullato TUTTO — conto ancora aperto, nessuna riga
-- nel registro sconti/omaggi. Alla fine ripulisce il conto di prova.
--
-- Scrive solo dati di prova e li cancella: al termine il database è
-- identico a prima. Se qualcosa non torna, si ferma con un errore chiaro.

do $prova$
declare
  v_utente        uuid;
  v_order         uuid;
  v_causale_finta uuid := gen_random_uuid();  -- non esiste in cash_causali
  v_respinta      boolean := false;
  v_stato         order_status;
  v_dg            integer;
begin
  select user_id into v_utente from user_roles order by created_at limit 1;
  if v_utente is null then
    raise exception 'Nessun utente in user_roles: impossibile eseguire la prova.';
  end if;

  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_utente, 'role', 'authenticated')::text,
    true
  );

  -- Conto di prova: 2 coperti + una riga da 10,00
  insert into orders (table_label, coperti) values ('__prova_rollback__', 2)
  returning id into v_order;

  insert into order_items (order_id, free_text_name, destination, quantity, unit_price, sent_at)
  values (v_order, 'Riga di prova', 'bar', 1, 10.00, now());

  -- Tentativo di chiusura con causale inesistente: la funzione scrive
  -- prima nel registro sconti/omaggi (che fallisce sulla causale), quindi
  -- se l'atomicità funziona NON deve restare nulla di nulla.
  begin
    perform close_order_as_discount_gift(
      v_order, false, 5.00, null, v_causale_finta, null, null, null, 'prova rollback'
    );
  exception
    when others then v_respinta := true;
  end;

  select status into v_stato from orders where id = v_order;
  select count(*) into v_dg from discounts_gifts where note = 'prova rollback';

  if not v_respinta then
    raise exception 'ERRORE: la chiusura con causale inesistente NON è stata respinta.';
  end if;
  if v_stato <> 'aperto' then
    raise exception 'ERRORE: il conto risulta "%" — il fallimento ha lasciato effetti a metà.', v_stato;
  end if;
  if v_dg > 0 then
    raise exception 'ERRORE: trovata una riga sconto/omaggio scritta da un''operazione fallita.';
  end if;

  -- Pulizia del conto di prova
  delete from order_items where order_id = v_order;
  delete from orders where id = v_order;

  raise notice 'VERIFICATO: fallimento a metà -> nessuna scrittura rimasta. Conto ancora aperto prima della pulizia, registro sconti/omaggi intatto, prova ripulita.';
end $prova$;

-- Riepilogo: tutte e due le colonne devono essere 0.
select
  (select count(*) from orders where table_label = '__prova_rollback__')      as conti_prova_rimasti,
  (select count(*) from discounts_gifts where note = 'prova rollback')        as righe_prova_rimaste;
