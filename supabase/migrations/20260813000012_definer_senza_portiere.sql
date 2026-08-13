-- =====================================================================
-- Una funzione che scavalca la RLS deve avere un portiere suo
-- =====================================================================
-- Rilievo del validatore sulla consegna `5da7b24`, ed è giusto:
--
--   `quadratura_pagamenti()` è `security definer` e concessa ad
--   `authenticated` senza `is_titolare()` interno — quindi scavalca la
--   RLS su `supplier_invoices` e `cash_movements`, e **lo staff può
--   leggere importi delle fatture, nomi dei fornitori e uscite di cassa**.
--
-- `security definer` serve a far girare la funzione coi permessi del
-- proprietario, cioè **senza RLS**. È esattamente il motivo per cui una
-- funzione così deve rimettere il controllo dentro di sé: la barriera che
-- ha appena scavalcato non torna da sola. `pay_supplier_invoice` lo fa
-- (prima riga del corpo); queste no.
--
-- ⚠️ NON È UN CASO ISOLATO, ED È LA PARTE CHE CONTA. Guardando tutte le
-- `security definer` scritte oggi, **sei** avevano la stessa forma. È lo
-- stesso metodo dell'audit dell'08/08: i guasti che emergono dopo anni
-- sono lo stesso errore ripetuto in venti punti, quindi si corregge la
-- classe e non il caso segnalato.
--
-- | funzione | cosa faceva vedere allo staff | esito |
-- |---|---|---|
-- | `quadratura_pagamenti` | importi fatture, fornitori, uscite | portiere |
-- | `costo_ingredienti_conto` | il food cost di ogni piatto | chiusa a tutti |
-- | `prodotti_da_compilare` | l'anagrafica ingredienti | portiere |
-- | `applica_scheda_prodotto` | poteva **riscrivere** le schede | portiere |
-- | `funzioni_aperte_ad_anon` | l'elenco dei varchi del sistema | portiere |
-- | `partite_in_scadenza` | nomi e scadenze — **voluto** | resta |
--
-- **`costo_ingredienti_conto` si chiude a tutti**, non le si mette un
-- portiere: nessuno la chiama dal browser: la usa
-- `close_order_as_discount_gift`, che è `security definer` e gira come
-- proprietario. Una porta che non serve a nessuno si mura, non si
-- sorveglia.
--
-- **`partite_in_scadenza` e `chiudi_partita` restano aperte allo staff, ed
-- è una decisione, non una dimenticanza**: lo scadenziario serve in
-- cucina, e chi butta una partita scaduta è chi la trova. Non espongono
-- nessun prezzo — nomi, quantità e date, che è quello che `stock_lots_display`
-- già mostra allo staff.
--
-- ⚠️ E PERCHÉ SI SOLLEVA UN ERRORE INVECE DI RESTITUIRE UN ELENCO VUOTO.
-- Filtrare con `where is_titolare()` sarebbe bastato a non far uscire i
-- dati, ma allo staff la schermata direbbe «non c'è niente che non
-- torna» — una rassicurazione falsa. Meglio un rifiuto esplicito: chi non
-- deve vedere una cosa deve sapere che non la sta vedendo.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. La quadratura: solo il titolare
-- ---------------------------------------------------------------------
create or replace function quadratura_pagamenti(p_dal date default null, p_al date default null)
returns table (
  genere      text,
  quando      date,
  importo     numeric,
  descrizione text,
  perche      text
)
language plpgsql
stable
security definer
set search_path = public
as $funzione$
begin
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' vedere la quadratura dei pagamenti';
  end if;

  return query
  -- 1. Risulta pagata, ma dal cassetto o dal conto non e' uscito niente.
  select 'fattura_senza_movimento'::text,
         v_inv.paid_at::date,
         v_inv.amount,
         'Fattura ' || coalesce(v_inv.invoice_number, '(senza numero)')
           || coalesce(' — ' || s.name, ''),
         'Risulta pagata, ma in prima nota non c''e'' nessuna uscita collegata.'
    from supplier_invoices v_inv
    left join suppliers s on s.id = v_inv.supplier_id
   where v_inv.status = 'pagata'
     and not exists (select 1 from cash_movements m where m.supplier_invoice_id = v_inv.id)
     and (p_dal is null or v_inv.paid_at::date >= p_dal)
     and (p_al  is null or v_inv.paid_at::date <= p_al)

  union all

  -- 2. E' uscito denaro con la causale «fattura», ma non e' agganciato a
  --    nessuna: o e' una fattura non registrata, o e' il doppione di un
  --    pagamento gia' scritto.
  select 'movimento_senza_fattura'::text,
         m.movement_date,
         m.amount,
         coalesce(nullif(m.business_purpose, ''), 'Uscita senza descrizione'),
         'Uscita con documento «fattura» che non risulta collegata a nessuna fattura registrata.'
    from cash_movements m
   where m.direction = 'uscita'
     and m.tipo_documento = 'fattura'
     and m.supplier_invoice_id is null
     and (p_dal is null or m.movement_date >= p_dal)
     and (p_al  is null or m.movement_date <= p_al)

  order by 2 desc nulls last;
end
$funzione$;

revoke all on function quadratura_pagamenti(date, date) from public, anon, authenticated;
grant execute on function quadratura_pagamenti(date, date) to authenticated;

-- ---------------------------------------------------------------------
-- 2. Il costo di un conto: non serve a nessun browser
-- ---------------------------------------------------------------------
revoke all on function costo_ingredienti_conto(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. L'anagrafica dei prodotti da compilare: solo il titolare
-- ---------------------------------------------------------------------
create or replace function prodotti_da_compilare()
returns table (
  id       uuid,
  nome     text,
  unita    text,
  categoria text,
  alimentare boolean,
  mancano  text[]
)
language plpgsql
stable
security definer
set search_path = public
as $funzione$
begin
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' vedere l''anagrafica dei prodotti';
  end if;

  return query
  select i.id, i.name, i.unit::text, i.category::text, i.alimentare,
         array_remove(array[
           case when i.storage_type is null            then 'conservazione'   end,
           case when i.shelf_life_days is null         then 'durata'          end,
           case when i.haccp_receiving_temp is null    then 'temperatura'     end,
           case when coalesce(array_length(i.seasonality, 1), 0) = 0
                                                       then 'stagionalita'    end,
           -- Lo scarto manca solo se NESSUNO ha ancora compilato la
           -- scheda: uno zero scritto dall'assistente e' una risposta.
           case when coalesce(i.waste_percentage_default, 0) = 0
                     and i.campi_compilati_il is null  then 'scarto'          end,
           case when i.origine_allergeni is null       then 'allergeni'       end
         ], null)
    from ingredients i
   where i.active
     and (i.storage_type is null
          or i.shelf_life_days is null
          or i.haccp_receiving_temp is null
          or coalesce(array_length(i.seasonality, 1), 0) = 0
          or (coalesce(i.waste_percentage_default, 0) = 0 and i.campi_compilati_il is null)
          or i.origine_allergeni is null)
   order by i.name;
end
$funzione$;

revoke all on function prodotti_da_compilare() from public, anon, authenticated;
grant execute on function prodotti_da_compilare() to authenticated;

-- ---------------------------------------------------------------------
-- 4. Scrivere una scheda: solo il titolare
-- ---------------------------------------------------------------------
-- Questa e' peggio delle altre tre: non faceva LEGGERE, faceva SCRIVERE.
-- Uno staff poteva riscrivere allergeni, conservazione e scarto di
-- qualunque prodotto — cioe' dati che finiscono sul menu e nel costo dei
-- piatti.
create or replace function applica_scheda_prodotto(
  p_ingredient_id uuid,
  p_campi         jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $funzione$
declare
  v_ing        ingredients%rowtype;
  v_allergeni  allergen[] := '{}';
  v_mesi       month_code[] := '{}';
  v_scartati   text[] := '{}';
  v_x          text;
  v_scritti    text[] := '{}';
begin
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' compilare la scheda di un prodotto';
  end if;

  select * into v_ing from ingredients where id = p_ingredient_id for update;
  if not found then
    raise exception 'Questo prodotto non esiste piu''';
  end if;

  -- Gli allergeni si scrivono solo se nessuno li ha ancora guardati:
  -- una stima non sovrascrive mai un'etichetta letta ne' una conferma.
  if v_ing.origine_allergeni is null and p_campi ? 'allergeni' then
    for v_x in select jsonb_array_elements_text(p_campi->'allergeni')
    loop
      begin
        v_allergeni := v_allergeni || v_x::allergen;
      exception when others then
        v_scartati := v_scartati || v_x;
      end;
    end loop;
    update ingredients
       set allergens = v_allergeni,
           origine_allergeni = 'stimati'
     where id = p_ingredient_id;
    v_scritti := v_scritti || 'allergeni'::text;
  end if;

  if coalesce(array_length(v_ing.seasonality, 1), 0) = 0 and p_campi ? 'stagionalita' then
    for v_x in select jsonb_array_elements_text(p_campi->'stagionalita')
    loop
      begin
        v_mesi := v_mesi || v_x::month_code;
      exception when others then
        v_scartati := v_scartati || v_x;
      end;
    end loop;
    if array_length(v_mesi, 1) > 0 then
      update ingredients set seasonality = v_mesi where id = p_ingredient_id;
      v_scritti := v_scritti || 'stagionalita'::text;
    end if;
  end if;

  if v_ing.storage_type is null and nullif(p_campi->>'conservazione', '') is not null then
    begin
      update ingredients
         set storage_type = (p_campi->>'conservazione')::storage_type
       where id = p_ingredient_id;
      v_scritti := v_scritti || 'conservazione'::text;
    exception when others then
      v_scartati := v_scartati || (p_campi->>'conservazione');
    end;
  end if;

  if v_ing.shelf_life_days is null and (p_campi->>'durata_giorni') is not null then
    update ingredients
       set shelf_life_days = greatest(1, (p_campi->>'durata_giorni')::integer)
     where id = p_ingredient_id;
    v_scritti := v_scritti || 'durata'::text;
  end if;

  if v_ing.haccp_receiving_temp is null and nullif(p_campi->>'temperatura', '') is not null then
    update ingredients
       set haccp_receiving_temp = p_campi->>'temperatura'
     where id = p_ingredient_id;
    v_scritti := v_scritti || 'temperatura'::text;
  end if;

  -- Lo scarto: zero e' il valore di partenza e vuol dire «non lo so»,
  -- non «non si scarta niente». Sopra il 95% e' quasi certamente un
  -- errore del modello, e sfalserebbe il costo di ogni piatto.
  if coalesce(v_ing.waste_percentage_default, 0) = 0
     and (p_campi->>'scarto_percento') is not null then
    if (p_campi->>'scarto_percento')::numeric between 0 and 95 then
      update ingredients
         set waste_percentage_default = (p_campi->>'scarto_percento')::numeric
       where id = p_ingredient_id;
      v_scritti := v_scritti || 'scarto'::text;
    else
      v_scartati := v_scartati || ('scarto ' || (p_campi->>'scarto_percento'));
    end if;
  end if;

  update ingredients set campi_compilati_il = now() where id = p_ingredient_id;

  return jsonb_build_object(
    'id', p_ingredient_id,
    'scritti', to_jsonb(v_scritti),
    'scartati', to_jsonb(v_scartati));
end
$funzione$;

revoke all on function applica_scheda_prodotto(uuid, jsonb) from public, anon, authenticated;
grant execute on function applica_scheda_prodotto(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- 5. L'elenco dei varchi: solo il titolare
-- ---------------------------------------------------------------------
create or replace function funzioni_aperte_ad_anon()
returns table (nome text)
language plpgsql
stable
security definer
set search_path = public
as $funzione$
begin
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' vedere l''elenco delle funzioni aperte';
  end if;

  return query
  select distinct p.proname::text
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and has_function_privilege('anon', p.oid, 'execute')
   order by 1;
end
$funzione$;

revoke all on function funzioni_aperte_ad_anon() from public, anon, authenticated;
grant execute on function funzioni_aperte_ad_anon() to authenticated;

-- ---------------------------------------------------------------------
-- 6. E due che il rilievo non nominava, trovate cercando la classe
-- ---------------------------------------------------------------------
-- Contando quante `security definer` senza portiere restassero, sono
-- saltate fuori `varianti_ingrediente` e `variazione_prezzo`: **espongono
-- i prezzi d'acquisto**, cioè esattamente il dato che la prova automatica
-- dei permessi dichiara che lo staff non deve vedere («lo staff NON vede
-- gli ingredienti: lì vivono i prezzi d'acquisto»). Erano nate il 12/08,
-- prima del rilievo di oggi, e nessuno le aveva guardate.
--
-- `variazione_prezzo` la chiama anche `esegui_azione_posta` dall'interno:
-- il controllo passa lo stesso, perché quella verifica già che il
-- chiamante sia il titolare e le claim del JWT non cambiano entrando in
-- una funzione.
create or replace function varianti_ingrediente(p_ingredient_id uuid)
returns table (
  articolo_id uuid, descrizione text, fornitore text, fornitore_id uuid,
  unita_fattura text, fattore numeric, prezzo numeric,
  ultima_volta timestamptz, acquisti integer, stesso_di uuid
)
language plpgsql
stable
security definer
set search_path = public
as $funzione$
begin
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' vedere i prezzi d''acquisto';
  end if;

  return query
  select a.id,
         a.descrizione,
         s.name,
         a.supplier_id,
         a.unita_fattura,
         a.fattore,
         ultimo.price,
         ultimo.recorded_at,
         coalesce(conta.n, 0)::integer,
         a.stesso_di
    from articoli_fornitore a
    left join suppliers s on s.id = a.supplier_id
    left join lateral (
      select ph.price, ph.recorded_at
        from price_history ph
       where ph.articolo_id = a.id
       order by ph.recorded_at desc
       limit 1
    ) ultimo on true
    left join lateral (
      select count(*) as n from price_history ph where ph.articolo_id = a.id
    ) conta on true
   where a.ingredient_id = p_ingredient_id
     and not a.ignora
   -- Dalla piu' conveniente: e' la domanda che si fa guardando questa
   -- tabella. Chi non ha ancora un prezzo sta in fondo, non in cima.
   order by ultimo.price asc nulls last, a.descrizione;
end
$funzione$;

revoke all on function varianti_ingrediente(uuid) from public, anon, authenticated;
grant execute on function varianti_ingrediente(uuid) to authenticated;

create or replace function variazione_prezzo(p_articolo_id uuid, p_prezzo numeric)
returns table (
  prezzo_precedente numeric, quando timestamptz, variazione numeric,
  prezzo_primo numeric, quando_primo timestamptz, variazione_totale numeric,
  da_segnalare boolean
)
language plpgsql
stable
security definer
set search_path = public
as $funzione$
declare
  v_capo   uuid;
  v_ingr   uuid;
  v_prec   numeric;
  v_quando timestamptz;
  v_primo  numeric;
  v_qprimo timestamptz;
  v_soglia numeric;
  v_avvisa boolean;
begin
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' vedere i prezzi d''acquisto';
  end if;

  if p_articolo_id is null or p_prezzo is null or p_prezzo <= 0 then
    return;
  end if;

  -- Il gruppo di confronto: la versione stessa, piu' le diciture che
  -- Alessio ha dichiarato essere lo stesso identico prodotto. Finche' non
  -- collega niente, il gruppo e' una versione sola.
  select coalesce(a.stesso_di, a.id), a.ingredient_id into v_capo, v_ingr
    from articoli_fornitore a where a.id = p_articolo_id;
  if v_capo is null then
    return;
  end if;

  select ph.price, ph.recorded_at into v_prec, v_quando
    from price_history ph
    join articoli_fornitore a on a.id = ph.articolo_id
   where coalesce(a.stesso_di, a.id) = v_capo
   order by ph.recorded_at desc
   limit 1;

  if v_prec is null or v_prec <= 0 then
    return;   -- prima volta che si compra questa versione
  end if;

  -- Il piu' VECCHIO, non il minimo: il minimo darebbe la variazione piu'
  -- spettacolare invece di quella vera.
  select ph.price, ph.recorded_at into v_primo, v_qprimo
    from price_history ph
    join articoli_fornitore a on a.id = ph.articolo_id
   where coalesce(a.stesso_di, a.id) = v_capo
   order by ph.recorded_at asc
   limit 1;

  select coalesce(s.soglia_rincaro_percento, 0) into v_soglia
    from service_settings s where s.id = 1;
  v_soglia := coalesce(v_soglia, 0);

  select i.avvisa_rincari into v_avvisa from ingredients i where i.id = v_ingr;

  return query select
    v_prec,
    v_quando,
    round((p_prezzo - v_prec) / v_prec * 100, 1),
    v_primo,
    v_qprimo,
    case when v_primo > 0 then round((p_prezzo - v_primo) / v_primo * 100, 1) end,
    coalesce(v_avvisa, true)
      and p_prezzo > v_prec * (1 + v_soglia / 100);
end
$funzione$;

revoke all on function variazione_prezzo(uuid, numeric) from public, anon, authenticated;
grant execute on function variazione_prezzo(uuid, numeric) to authenticated;

-- ---------------------------------------------------------------------
-- 7. Verifica — impersonando lo STAFF, che è il punto del rilievo
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_titolare uuid;
  v_staff    uuid;
  respinto   boolean;
  n          integer;
begin
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  select user_id into v_staff    from user_roles where role = 'staff'    limit 1;
  if v_titolare is null then raise exception 'Nessun titolare in user_roles.'; end if;
  if v_staff is null then
    raise exception 'Nessuno staff in user_roles: questa verifica non ha senso senza qualcuno da respingere.';
  end if;

  -- LO STAFF viene respinto da tutte e quattro.
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);

  respinto := false;
  begin perform quadratura_pagamenti();
  exception when sqlstate 'P0001' then respinto := true; end;
  if not respinto then raise exception 'Lo staff ha potuto leggere la quadratura dei pagamenti.'; end if;

  respinto := false;
  begin perform prodotti_da_compilare();
  exception when sqlstate 'P0001' then respinto := true; end;
  if not respinto then raise exception 'Lo staff ha potuto leggere l''anagrafica dei prodotti.'; end if;

  respinto := false;
  begin perform funzioni_aperte_ad_anon();
  exception when sqlstate 'P0001' then respinto := true; end;
  if not respinto then raise exception 'Lo staff ha potuto leggere l''elenco dei varchi.'; end if;

  respinto := false;
  begin
    perform applica_scheda_prodotto(
      (select id from ingredients limit 1), '{"durata_giorni": 1}'::jsonb);
  exception when sqlstate 'P0001' then respinto := true;
           when others then respinto := true;  -- nessun ingrediente: va bene lo stesso
  end;
  if not respinto then raise exception 'Lo staff ha potuto riscrivere la scheda di un prodotto.'; end if;

  -- E i prezzi d'acquisto, che sono il dato che la prova dei permessi
  -- dichiara vietato allo staff.
  respinto := false;
  begin perform varianti_ingrediente(gen_random_uuid());
  exception when sqlstate 'P0001' then respinto := true; end;
  if not respinto then raise exception 'Lo staff ha potuto vedere le versioni e i prezzi di un ingrediente.'; end if;

  respinto := false;
  begin perform variazione_prezzo(gen_random_uuid(), 10);
  exception when sqlstate 'P0001' then respinto := true; end;
  if not respinto then raise exception 'Lo staff ha potuto interrogare la variazione di un prezzo.'; end if;

  -- IL TITOLARE passa: il rimedio non ha chiuso la porta a chi deve entrare.
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

  perform quadratura_pagamenti();
  perform prodotti_da_compilare();
  select count(*) into n from funzioni_aperte_ad_anon();
  if n <> 12 then
    raise exception 'Le funzioni aperte da fuori sono %, attese 12.', n;
  end if;

  -- E il costo di un conto non lo puo' chiamare piu' nessuno dal browser.
  if has_function_privilege('authenticated', 'public.costo_ingredienti_conto(uuid)', 'execute') then
    raise exception 'costo_ingredienti_conto e'' ancora eseguibile da un utente qualunque.';
  end if;

  -- ...ma la chiusura di un conto continua a funzionare, perche' la usa
  -- dall'interno una funzione che gira come proprietario.
  select count(*) into n from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public' and p.proname = 'close_order_as_discount_gift'
     and pg_get_functiondef(p.oid) like '%costo_ingredienti_conto%';
  if n <> 1 then
    raise exception 'La chiusura conto non chiama piu'' il calcolo del costo.';
  end if;

  raise notice 'Ogni security definer ha il suo portiere: lo staff respinto su quattro funzioni, il titolare passa.';
end
$verifica$;

insert into applied_migrations (version, name)
values ('20260813000012', 'definer_senza_portiere')
on conflict (version) do nothing;

select count(*) as definer_senza_controllo
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.prosecdef
   and has_function_privilege('authenticated', p.oid, 'execute')
   and pg_get_functiondef(p.oid) not like '%is_titolare%'
   and pg_get_functiondef(p.oid) not like '%auth.uid()%';
