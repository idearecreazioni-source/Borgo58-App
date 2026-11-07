-- =====================================================================
-- IL PIANO DELL'INVESTIMENTO, PARTE 5 — LO SPESO VOCE PER VOCE (07/11/2026)
-- =====================================================================
--
-- 🔴 A CHE DOMANDA RISPONDE: *su quale voce sto sforando?* La parte 1
--    (20261107000001) ha messo il previsto e il posto per i collegamenti;
--    qui ci sono le due letture che mancavano:
--      · piano_speso_per_voce(): per ogni voce, lo SPESO (pagamenti
--        collegati) e l'IMPEGNATO (fatture collegate ancora da pagare);
--      · piano_spese_del_progetto(): ogni spesa segnata «investimento» di
--        Borgo 58 o della tasca, con quanto è già assegnato alle voci.
--        Quello che resta è la riga «da assegnare» della pagina.
--
-- 🔴 UNA FATTURA CONTA TRAMITE IL SUO PAGAMENTO, MAI DUE VOLTE. Collegata e
--    ancora da pagare, è impegnata. Pagata, non conta più come fattura: lo
--    speso arriva dal movimento o dall'anticipo che la paga, quando è
--    collegato. Se un pagamento collegato alla STESSA voce porta quella
--    fattura (supplier_invoice_id), l'impegnato della fattura scende di
--    quanto è già pagato, mai sotto zero (revisione ecc:database-reviewer
--    del 07/11: prima spariva tutto, anche con un pagamento parziale).
-- ⚠️ IL CASO STORTO SI CONTA PER ECCESSO, NON PER DIFETTO: fattura su una
--    voce e il suo pagamento su un'altra fanno impegnato sulla prima e speso
--    sulla seconda. Meglio un «a rischio» in più che uno sforamento nascosto.
-- ⚠️ UNA FATTURA PAGATA il cui pagamento non è collegato non conta né come
--    impegnato né come speso: il pagamento sta fra le «da assegnare». La
--    colonna `fatture_pagate_scollegate` lo dice alla pagina, voce per voce.
--
-- ⚠️ NESSUNA TABELLA E NESSUNA COLONNA NUOVA: solo due funzioni che
--    leggono. Il controllo «speso del piano + da assegnare = costo del
--    progetto» lo fa la pagina, contro costo_del_progetto(): sono due strade
--    diverse verso lo stesso numero, e se non tornano lo dice.
--
-- ⚠️ SOLO IL TITOLARE: security definer gira senza RLS, quindi il portiere
--    è dentro, e chi non deve vedere riceve un RIFIUTO, non un elenco vuoto
--    (regola del 13/08: un elenco vuoto si leggerebbe «niente speso»).

-- ---------------------------------------------------------------------
-- 1. LO SPESO E L'IMPEGNATO DI OGNI VOCE
-- ---------------------------------------------------------------------
create or replace function piano_speso_per_voce()
returns table (
  voce_id     uuid,
  speso       numeric,
  impegnato   numeric,
  collegate   integer,
  fatture_pagate_scollegate integer
)
language plpgsql
stable
security definer
set search_path = public
as $fn$
begin
  if not is_titolare() then
    raise exception 'Il piano dell''investimento è riservato al titolare.';
  end if;

  return query
  with pagamenti as (
    -- I pagamenti collegati: prima nota e anticipi, ancora segnati
    -- «investimento» (il trigger della parte 1 impedisce di togliere
    -- l'etichetta a una spesa collegata; il filtro qui è la seconda
    -- cintura, non la prima).
    select c.voce_id, c.importo_attribuito as importo, m.supplier_invoice_id as fattura
      from piano_collegamenti c
      join cash_movements m on m.id = c.cash_movement_id
     where m.e_investimento and m.direction = 'uscita'
    union all
    select c.voce_id, c.importo_attribuito, a.supplier_invoice_id
      from piano_collegamenti c
      join anticipazioni_socio a on a.id = c.anticipazione_id
     where a.e_investimento
  ),
  fatture as (
    -- Le fatture collegate ancora da pagare, meno quanto ne pagano già i
    -- pagamenti collegati alla stessa voce.
    select c.voce_id,
           greatest(c.importo_attribuito - coalesce((
             select sum(p.importo) from pagamenti p where p.fattura = i.id and p.voce_id = c.voce_id
           ), 0), 0) as importo
      from piano_collegamenti c
      join supplier_invoices i on i.id = c.supplier_invoice_id
     where i.status = 'da_pagare'
  ),
  scollegate as (
    -- Fatture collegate e già pagate, ma con il pagamento non collegato.
    select c.voce_id
      from piano_collegamenti c
      join supplier_invoices i on i.id = c.supplier_invoice_id
     where i.status = 'pagata'
       and not exists (select 1 from pagamenti p where p.fattura = i.id)
  )
  select v.id,
         coalesce((select sum(p.importo) from pagamenti p where p.voce_id = v.id), 0)::numeric,
         coalesce((select sum(f.importo) from fatture f where f.voce_id = v.id), 0)::numeric,
         (select count(*) from piano_collegamenti c where c.voce_id = v.id)::integer,
         (select count(*) from scollegate s where s.voce_id = v.id)::integer
    from piano_voci v
   order by v.gruppo, v.ordine, v.id;
end;
$fn$;

revoke all on function piano_speso_per_voce() from public, anon, authenticated;
grant execute on function piano_speso_per_voce() to authenticated;

-- ---------------------------------------------------------------------
-- 2. LE SPESE DEL PROGETTO, CON QUANTO È GIÀ ASSEGNATO
-- ---------------------------------------------------------------------
-- ⚠️ LEGGE righe_costo_del_progetto() E BASTA: le stesse righe della pagina
--    «Quanto è costato il progetto», senza l'orto. Nessuna copia.
-- ⚠️ L'ORDINE È DETERMINATO FINO ALL'ULTIMO CRITERIO (lezione del 16/08).
create or replace function piano_spese_del_progetto()
returns table (
  fonte       text,
  id          uuid,
  data        date,
  tipo        text,
  soggetto    text,
  causale     text,
  descrizione text,
  nota        text,
  fattura     text,
  importo     numeric,
  assegnato   numeric
)
language plpgsql
stable
security definer
set search_path = public
as $fn$
begin
  if not is_titolare() then
    raise exception 'Il piano dell''investimento è riservato al titolare.';
  end if;

  return query
  select r.fonte,
         r.id,
         r.data,
         r.tipo,
         r.soggetto,
         r.causale,
         r.descrizione,
         r.nota,
         r.fattura,
         r.importo,
         coalesce((
           select sum(c.importo_attribuito)
             from piano_collegamenti c
            where (r.fonte = 'prima_nota' and c.cash_movement_id = r.id)
               or (r.fonte = 'anticipazione' and c.anticipazione_id = r.id)
         ), 0)::numeric
    from righe_costo_del_progetto() r
   where r.tipo in ('srls', 'tasca')
   order by r.data desc, r.fonte, r.id;
end;
$fn$;

revoke all on function piano_spese_del_progetto() from public, anon, authenticated;
grant execute on function piano_spese_del_progetto() to authenticated;

-- ---------------------------------------------------------------------
-- 3. VERIFICA
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_foto     jsonb := foto_righe();
  v_titolare uuid;
  v_staff    uuid;
  v_srls     uuid;
  v_caus     uuid;
  v_forn     uuid;
  v_voce     uuid;
  v_voce2    uuid;
  v_mov      uuid;
  v_mov_fat  uuid;
  v_mov_parz uuid;
  v_fat      uuid;
  v_fat2     uuid;
  v_fat3     uuid;
  v_n        integer;
  v_speso    numeric;
  v_imp      numeric;
  v_ass      numeric;
  v_rifiuto  boolean;
begin
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  select user_id into v_staff from user_roles where role = 'staff' limit 1;
  select id into v_srls from entities where entity_type = 'srls' limit 1;
  select id into v_caus from cash_causali where kind = 'uscita' and active and not di_sistema order by created_at limit 1;
  if v_titolare is null or v_staff is null or v_srls is null or v_caus is null then
    raise exception 'VERIFICA: servono un titolare, uno staff, Borgo 58 e una causale d''uscita.';
  end if;

  begin
    insert into suppliers (entity_id, name) values (v_srls, 'ZZ fornitore piano') returning id into v_forn;
    -- Due fatture da pagare: una resta impegnata, l'altra la paga un
    -- movimento collegato (e allora non è più impegnata).
    insert into supplier_invoices (entity_id, supplier_id, invoice_number, invoice_date, amount)
    values (v_srls, v_forn, 'ZZ-1', current_date, 300.00) returning id into v_fat;
    insert into supplier_invoices (entity_id, supplier_id, invoice_number, invoice_date, amount)
    values (v_srls, v_forn, 'ZZ-2', current_date, 80.00) returning id into v_fat2;
    insert into cash_movements (entity_id, direction, amount, movement_date, causale_id, mezzo, business_purpose, e_investimento)
    values (v_srls, 'uscita', 100.00, current_date, v_caus, 'cassa', 'ZZ verifica speso - investimento', true)
    returning id into v_mov;
    insert into cash_movements (entity_id, direction, amount, movement_date, causale_id, mezzo, business_purpose, e_investimento, supplier_invoice_id)
    values (v_srls, 'uscita', 80.00, current_date, v_caus, 'cassa', 'ZZ verifica speso - paga la fattura', true, v_fat2)
    returning id into v_mov_fat;
    -- Un pagamento parziale della fattura da 300 €, e una fattura già pagata.
    insert into cash_movements (entity_id, direction, amount, movement_date, causale_id, mezzo, business_purpose, e_investimento, supplier_invoice_id)
    values (v_srls, 'uscita', 50.00, current_date, v_caus, 'cassa', 'ZZ verifica speso - acconto della fattura', true, v_fat)
    returning id into v_mov_parz;
    insert into supplier_invoices (entity_id, supplier_id, invoice_number, invoice_date, amount, status, paid_at)
    values (v_srls, v_forn, 'ZZ-3', current_date, 40.00, 'pagata', now()) returning id into v_fat3;

    perform set_config('request.jwt.claims', json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);
    set local role authenticated;

    insert into piano_voci (gruppo, descrizione, importo_ivato) values ('A', 'ZZ forno della verifica', 500.00) returning id into v_voce;
    insert into piano_voci (gruppo, descrizione, importo_ivato) values ('A', 'ZZ banco della verifica', 50.00) returning id into v_voce2;

    -- 100 € pagati: 60 sul forno, 40 sul banco. La fattura da 300 € sul
    -- forno, impegnata. La fattura da 80 € sul banco, ma il suo pagamento
    -- è collegato anch'esso: conta una volta sola, come speso.
    insert into piano_collegamenti (voce_id, cash_movement_id, importo_attribuito) values (v_voce, v_mov, 60.00), (v_voce2, v_mov, 40.00);
    insert into piano_collegamenti (voce_id, supplier_invoice_id, importo_attribuito) values (v_voce, v_fat, 300.00), (v_voce2, v_fat2, 80.00);
    insert into piano_collegamenti (voce_id, cash_movement_id, importo_attribuito) values (v_voce2, v_mov_fat, 80.00);

    -- (1) Speso e impegnato del forno.
    select speso, impegnato into v_speso, v_imp from piano_speso_per_voce() where voce_id = v_voce;
    if v_speso <> 60.00 or v_imp <> 300.00 then
      raise exception 'VERIFICA (1): il forno doveva avere 60 € spesi e 300 € impegnati, ha % e %.', v_speso, v_imp;
    end if;
    -- (2) Il banco: 40 + 80 spesi, e la fattura pagata non è impegnata.
    select speso, impegnato into v_speso, v_imp from piano_speso_per_voce() where voce_id = v_voce2;
    if v_speso <> 120.00 or v_imp <> 0 then
      raise exception 'VERIFICA (2): il banco doveva avere 120 € spesi e niente impegnato, ha % e %.', v_speso, v_imp;
    end if;
    -- (3) La spesa da 100 € è assegnata tutta; quella da 80 € pure.
    select assegnato into v_ass from piano_spese_del_progetto() where id = v_mov;
    if v_ass is distinct from 100.00 then
      raise exception 'VERIFICA (3): la spesa da 100 € doveva risultare assegnata per 100 €, risulta %.', v_ass;
    end if;
    select assegnato into v_ass from piano_spese_del_progetto() where id = v_mov_fat;
    if v_ass is distinct from 80.00 then
      raise exception 'VERIFICA (3b): la spesa da 80 € doveva risultare assegnata per 80 €, risulta %.', v_ass;
    end if;

    -- (3c) Un pagamento parziale della fattura da 300 € (50 €, collegato al
    --      forno): l'impegnato scende a 250, lo speso sale a 110.
    insert into piano_collegamenti (voce_id, cash_movement_id, importo_attribuito) values (v_voce, v_mov_parz, 50.00);
    select speso, impegnato into v_speso, v_imp from piano_speso_per_voce() where voce_id = v_voce;
    if v_speso <> 110.00 or v_imp <> 250.00 then
      raise exception 'VERIFICA (3c): col pagamento parziale il forno doveva avere 110 € spesi e 250 € impegnati, ha % e %.', v_speso, v_imp;
    end if;

    -- (3d) Una fattura già pagata, col pagamento non collegato: non conta,
    --      e la voce lo dice.
    insert into piano_collegamenti (voce_id, supplier_invoice_id, importo_attribuito) values (v_voce, v_fat3, 40.00);
    select impegnato, fatture_pagate_scollegate into v_imp, v_n from piano_speso_per_voce() where voce_id = v_voce;
    if v_imp <> 250.00 or v_n <> 1 then
      raise exception 'VERIFICA (3d): la fattura pagata e scollegata doveva lasciare 250 € impegnati e farsi contare, ha % e %.', v_imp, v_n;
    end if;
    -- (4) Tolto un collegamento, torna da assegnare.
    delete from piano_collegamenti where voce_id = v_voce2 and cash_movement_id = v_mov;
    select assegnato into v_ass from piano_spese_del_progetto() where id = v_mov;
    if v_ass is distinct from 60.00 then
      raise exception 'VERIFICA (4): tolto il collegamento da 40 €, la spesa doveva avere 60 € assegnati, ne ha %.', v_ass;
    end if;

    -- (5) Lo staff riceve un rifiuto, non un elenco vuoto.
    perform set_config('request.jwt.claims', json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
    v_rifiuto := false;
    begin
      perform * from piano_speso_per_voce();
    exception when raise_exception then v_rifiuto := sqlerrm like '%riservato al titolare%';
    end;
    if not v_rifiuto then raise exception 'VERIFICA (5a): lo staff ha letto lo speso del piano.'; end if;
    v_rifiuto := false;
    begin
      perform * from piano_spese_del_progetto();
    exception when raise_exception then v_rifiuto := sqlerrm like '%riservato al titolare%';
    end;
    if not v_rifiuto then raise exception 'VERIFICA (5b): lo staff ha letto le spese del progetto.'; end if;
    reset role;
    perform set_config('request.jwt.claims', null, true);

    -- (6) anon non può nemmeno chiamarle.
    if has_function_privilege('anon', 'piano_speso_per_voce()', 'execute')
       or has_function_privilege('anon', 'piano_spese_del_progetto()', 'execute') then
      raise exception 'VERIFICA (6): anon può chiamare le letture del piano.';
    end if;

    raise exception 'ZZ_ANNULLA';
  exception when others then
    if sqlerrm <> 'ZZ_ANNULLA' then raise; end if;
  end;

  reset role;
  perform set_config('request.jwt.claims', null, true);
  perform pretendi_nessun_residuo(v_foto, 'la verifica dello speso del piano');

  raise notice 'Fatto: lo speso e l''impegnato di ogni voce, e le spese del progetto con quanto è assegnato; una fattura pagata da un pagamento collegato conta una volta sola; lo staff riceve un rifiuto e anon non le chiama. Provato e annullato: zero residui.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20261107000002', 'il_piano_speso_e_collegamenti')
on conflict (version) do nothing;
