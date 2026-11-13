-- =====================================================================
-- LA BOZZA DELLA FATTURA SI SALVA INTERA (13/11/2026) — pezzo 2a di 5
-- =====================================================================
--
-- Piano approvato da Alessio il 13/11 (PIANO_fatture_emesse_13-11.md):
-- la pagina «Fatture ai clienti». Qui la parte del database:
--
--   1. I PREZZI IVA INCLUSA. Al ristorante il prezzo del conto è già con
--      l'IVA: 25 € a piatto sono 25 € pagati. La fattura deve tornare a
--      quel totale, quindi l'IVA si SCORPORA invece di aggiungerla.
--      `fatture_emesse.prezzi_ivati` (vero di partenza) dice quale delle
--      due: per ogni aliquota, lordo = somma delle righe; imponibile =
--      round(lordo × 100 / (100 + aliquota), 2); imposta = lordo −
--      imponibile. Così imponibile + imposta = lordo, al centesimo.
--      Con prezzi_ivati falso resta il calcolo di 20261113000002.
--   2. `totali_fattura()`: il conto in un posto solo, usato da
--      emetti_fattura (e dal pezzo 2b per il riepilogo del file).
--   3. `emetti_fattura()` ripresa da 20261113000002 con un solo cambio: i
--      totali vengono da totali_fattura(). Tutto il resto identico.
--   4. `salva_bozza_fattura()`: testata e righe insieme, tutto o niente.
--      Due tabelle → passa dal corridoio (operazioni-atomiche), come vuole
--      la rete delle scritture multi-tabella. Le righe si sostituiscono
--      tutte. Una fattura scartata dallo SDI si corregge da qui (cliente,
--      causale, pagamento, righe); data, numero e «IVA inclusa» no.
--
-- ⚠️ Il pulsante «Emetti» NON compare ancora nella pagina: senza la
--    spedizione (pezzo 3) una fattura numerata resterebbe ferma «da
--    inviare», e il numero sarebbe consumato. Si accende col pezzo 3.
--
-- Revisione (ecc:code-reviewer, 13/11): «IVA inclusa» bloccata dopo
-- l'uscita; i campi della testata controllati prima di convertirli, con
-- una frase in italiano; la S.r.l.s. mancante detta in italiano.
--
-- Idempotente. Si auto-registra. Verifica annullata, zero residui.

alter table fatture_emesse add column if not exists prezzi_ivati boolean not null default true;

comment on column fatture_emesse.prezzi_ivati is
  'Vero (di partenza): i prezzi delle righe comprendono già l''IVA, come al ristorante, e l''IVA si scorpora per aliquota. Falso: i prezzi sono senza IVA e l''IVA si aggiunge (13/11/2026).';

-- ---------------------------------------------------------------------
-- 1. I TOTALI, IN UN POSTO SOLO
-- ---------------------------------------------------------------------
create or replace function totali_fattura(p_fattura uuid)
returns table (aliquota_iva numeric, imponibile numeric, imposta numeric)
language sql
stable
security invoker
set search_path to 'public', 'pg_temp'
as $fn$
  with f as (
    select prezzi_ivati from fatture_emesse where id = p_fattura
  ), g as (
    select r.aliquota_iva, sum(round(r.quantita * r.prezzo_unitario, 2)) as somma
      from fatture_emesse_righe r
     where r.fattura_id = p_fattura
     group by r.aliquota_iva
  )
  select g.aliquota_iva,
         case when f.prezzi_ivati
              then round(g.somma * 100 / (100 + g.aliquota_iva), 2)
              else g.somma end,
         case when f.prezzi_ivati
              then g.somma - round(g.somma * 100 / (100 + g.aliquota_iva), 2)
              else round(g.somma * g.aliquota_iva / 100, 2) end
    from g cross join f
   order by g.aliquota_iva desc;
$fn$;

comment on function totali_fattura(uuid) is
  'Il riepilogo per aliquota di una fattura ai clienti: imponibile e imposta. Prezzi IVA inclusa: l''IVA si scorpora dal totale di ogni aliquota, altrimenti si aggiunge (13/11/2026).';

revoke all on function totali_fattura(uuid) from public, anon;
grant execute on function totali_fattura(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 2. EMETTERE — ripresa da 20261113000002, totali da totali_fattura()
-- ---------------------------------------------------------------------
create or replace function emetti_fattura(p_fattura uuid)
returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $fn$
declare
  v_f          fatture_emesse%rowtype;
  v_e          entities%rowtype;
  v_numero     integer;
  v_ultima     date;
  v_imponibile numeric(12,2);
  v_imposta    numeric(12,2);
  v_righe      integer;
begin
  if not is_titolare() then
    raise exception 'Solo il titolare emette le fatture.' using errcode = '42501';
  end if;

  select * into v_f from fatture_emesse where id = p_fattura for update;
  if not found then
    raise exception 'Questa fattura non esiste.' using errcode = 'P0002';
  end if;
  if v_f.stato <> 'bozza' then
    raise exception 'La fattura % è già uscita.', v_f.numero using errcode = 'P0001';
  end if;

  select * into v_e from entities where id = v_f.entity_id;
  if v_e.entity_type <> 'srls' then
    raise exception 'Le fatture ai clienti le emette solo la S.r.l.s.' using errcode = 'P0001';
  end if;
  if nullif(btrim(v_e.legal_name), '') is null or nullif(btrim(v_e.vat_number), '') is null
     or nullif(btrim(v_e.sede_indirizzo), '') is null or v_e.sede_cap is null
     or nullif(btrim(v_e.sede_comune), '') is null or v_e.sede_provincia is null then
    raise exception 'Mancano dei dati della società (ragione sociale, partita IVA o sede): completali prima di emettere.'
      using errcode = 'P0001';
  end if;

  select count(*) into v_righe from fatture_emesse_righe where fattura_id = p_fattura;
  if v_righe = 0 then
    raise exception 'La fattura non ha righe.' using errcode = 'P0001';
  end if;
  -- ⚠️ L'UNICO CAMBIO rispetto a 20261113000002: i totali per aliquota
  --    vengono da totali_fattura(), che sa scorporare l'IVA.
  select coalesce(sum(t.imponibile), 0), coalesce(sum(t.imposta), 0)
    into v_imponibile, v_imposta
    from totali_fattura(p_fattura) t;
  if v_imponibile + v_imposta <= 0 then
    raise exception 'Il totale della fattura deve essere più di zero.' using errcode = 'P0001';
  end if;

  -- Un lucchetto per società e anno: due «Emetti» insieme non prendono lo
  -- stesso numero, e il secondo vede la data del primo.
  perform pg_advisory_xact_lock(hashtext('fatture_emesse:' || v_f.entity_id::text || ':' || v_f.anno::text));

  select max(numero), max(data) into v_numero, v_ultima
    from fatture_emesse
   where entity_id = v_f.entity_id and anno = v_f.anno and numero is not null;
  if v_ultima is not null and v_f.data < v_ultima then
    raise exception 'La data della fattura (%) è prima dell''ultima fattura già uscita (%): i numeri devono seguire le date.',
      to_char(v_f.data, 'DD/MM/YYYY'), to_char(v_ultima, 'DD/MM/YYYY')
      using errcode = 'P0001';
  end if;
  v_numero := coalesce(v_numero, 0) + 1;

  update fatture_emesse
     set numero = v_numero,
         stato = 'da_inviare',
         imponibile = v_imponibile,
         imposta = v_imposta,
         totale = v_imponibile + v_imposta,
         emessa_il = now()
   where id = p_fattura;

  return v_numero;
end;
$fn$;

comment on function emetti_fattura(uuid) is
  'Fa uscire una fattura dalla bozza: le dà il numero (progressivo per società e anno, sotto lucchetto), controlla che la data non sia prima dell''ultima fattura numerata e congela i totali calcolati da totali_fattura (13/11/2026). Solo il titolare.';

revoke all on function emetti_fattura(uuid) from public, anon;
grant execute on function emetti_fattura(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 3. SALVARE LA BOZZA, TESTATA E RIGHE INSIEME
-- ---------------------------------------------------------------------
create or replace function salva_bozza_fattura(p_fattura_id uuid, p_testata jsonb, p_righe jsonb)
returns uuid
language plpgsql
security invoker
set search_path to 'public', 'pg_temp'
as $fn$
declare
  v_id     uuid := p_fattura_id;
  v_stato  text;
  v_numero integer;
  v_srls   uuid;
  v_uuid   constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
begin
  if not is_titolare() then
    raise exception 'Le fatture ai clienti sono riservate al titolare.' using errcode = '42501';
  end if;
  if p_testata is null or jsonb_typeof(p_testata) <> 'object' then
    raise exception 'Mancano i dati della fattura.' using errcode = 'P0001';
  end if;
  if nullif(p_testata->>'cliente_id', '') is null then
    raise exception 'Scegli il cliente della fattura.' using errcode = 'P0001';
  end if;
  -- I campi della testata si controllano prima di convertirli: un errore
  -- di conversione parlerebbe inglese (revisione del 13/11).
  if (p_testata->>'cliente_id') !~* v_uuid
     or (nullif(p_testata->>'order_id', '') is not null and (p_testata->>'order_id') !~* v_uuid)
     or (nullif(p_testata->>'preventivo_id', '') is not null and (p_testata->>'preventivo_id') !~* v_uuid) then
    raise exception 'Il cliente scelto non si riconosce: rileggi la pagina e sceglilo di nuovo.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from clienti_fattura where id = (p_testata->>'cliente_id')::uuid) then
    raise exception 'Il cliente scelto non si riconosce: rileggi la pagina e sceglilo di nuovo.' using errcode = 'P0001';
  end if;
  if nullif(p_testata->>'data', '') is not null and (p_testata->>'data') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    raise exception 'La data della fattura non si legge: sceglila dal calendario.' using errcode = 'P0001';
  end if;
  if p_testata ? 'prezzi_ivati' and jsonb_typeof(p_testata->'prezzi_ivati') not in ('boolean', 'null') then
    raise exception '«IVA inclusa» è un sì o un no.' using errcode = 'P0001';
  end if;
  if p_righe is null or jsonb_typeof(p_righe) <> 'array' or jsonb_array_length(p_righe) = 0 then
    raise exception 'La fattura vuole almeno una riga.' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_righe) e
     where jsonb_typeof(e) <> 'object'
        or nullif(btrim(e->>'descrizione'), '') is null
        or jsonb_typeof(e->'prezzo_unitario') is distinct from 'number'
        or (e ? 'quantita' and jsonb_typeof(e->'quantita') is distinct from 'number')
        or (e ? 'aliquota_iva' and jsonb_typeof(e->'aliquota_iva') is distinct from 'number')
  ) then
    raise exception 'Ogni riga vuole cosa si fattura e il prezzo (e la quantità, se c''è, in cifre).' using errcode = 'P0001';
  end if;

  if v_id is null then
    select id into v_srls from entities where entity_type = 'srls' limit 1;
    if v_srls is null then
      raise exception 'Manca la S.r.l.s. fra i soggetti: senza, non si fanno fatture.' using errcode = 'P0001';
    end if;
    insert into fatture_emesse (entity_id, cliente_id, data, modalita_pagamento, causale,
                                prezzi_ivati, order_id, preventivo_id)
    values (v_srls,
            (p_testata->>'cliente_id')::uuid,
            coalesce(nullif(p_testata->>'data', '')::date, current_date),
            coalesce(nullif(p_testata->>'modalita_pagamento', ''), 'MP05'),
            nullif(btrim(p_testata->>'causale'), ''),
            coalesce((p_testata->>'prezzi_ivati')::boolean, true),
            nullif(p_testata->>'order_id', '')::uuid,
            nullif(p_testata->>'preventivo_id', '')::uuid)
    returning id into v_id;
  else
    select stato, numero into v_stato, v_numero from fatture_emesse where id = v_id for update;
    if v_stato is null then
      raise exception 'Questa fattura non c''è più: rileggi la pagina.' using errcode = 'P0002';
    end if;
    if v_stato not in ('bozza', 'scartata') then
      raise exception 'La fattura % è già uscita: si cambia solo in bozza o dopo uno scarto dello SDI.', v_numero
        using errcode = 'P0001';
    end if;
    update fatture_emesse
       set cliente_id = (p_testata->>'cliente_id')::uuid,
           -- La data di una fattura numerata non cambia (guardia): si
           -- riscrive uguale.
           data = case when v_numero is null
                       then coalesce(nullif(p_testata->>'data', '')::date, data)
                       else data end,
           modalita_pagamento = coalesce(nullif(p_testata->>'modalita_pagamento', ''), modalita_pagamento),
           causale = nullif(btrim(p_testata->>'causale'), ''),
           -- Dopo l'uscita «IVA inclusa» non cambia: cambierebbe il totale
           -- di una fattura già numerata (revisione del 13/11).
           prezzi_ivati = case when v_numero is null
                               then coalesce((p_testata->>'prezzi_ivati')::boolean, prezzi_ivati)
                               else prezzi_ivati end
     where id = v_id;
    delete from fatture_emesse_righe where fattura_id = v_id;
  end if;

  insert into fatture_emesse_righe (fattura_id, posizione, descrizione, quantita, prezzo_unitario, aliquota_iva, natura)
  select v_id,
         r.ord::integer,
         btrim(r.e->>'descrizione'),
         coalesce((r.e->>'quantita')::numeric, 1),
         (r.e->>'prezzo_unitario')::numeric,
         coalesce((r.e->>'aliquota_iva')::numeric, 10),
         nullif(r.e->>'natura', '')
    from jsonb_array_elements(p_righe) with ordinality as r(e, ord);

  return v_id;
end;
$fn$;

comment on function salva_bozza_fattura(uuid, jsonb, jsonb) is
  'Salva una bozza di fattura ai clienti con tutte le sue righe, tutto o niente (13/11/2026). Senza id ne crea una nuova per la S.r.l.s., con l''id la riscrive se è in bozza o scartata dallo SDI. Passa dal corridoio operazioni-atomiche.';

revoke all on function salva_bozza_fattura(uuid, jsonb, jsonb) from public, anon;
grant execute on function salva_bozza_fattura(uuid, jsonb, jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- VERIFICA — dentro una sotto-transazione che si annulla
-- ---------------------------------------------------------------------
--   (1) una bozza nuova si salva con le sue righe, IVA inclusa di partenza;
--   (2) lo scorporo: 4 × 25 € + 1 × 122 € IVA inclusa (10% e 22%) fanno
--       222,00 € totali, imponibile 190,91, imposta 31,09;
--   (3) riscrivere la bozza sostituisce le righe (non le aggiunge);
--   (4) senza IVA inclusa i conti sono quelli di prima (232,00);
--   (5) emetti_fattura congela i totali scorporati;
--   (6) una fattura uscita non si riscrive da qui; una scartata sì, senza
--       cambiare data né «IVA inclusa»;
--   (7) senza righe, senza cliente, con un cliente storpiato o una riga
--       senza prezzo: rifiutata in italiano, e niente resta scritto;
--   (8) lo staff non salva.
do $verifica$
declare
  v_foto     jsonb := foto_righe();
  v_titolare uuid;
  v_staff    uuid;
  v_srls     uuid;
  v_cli      uuid;
  v_f        uuid;
  v_n        integer;
  v_ok       boolean;
  v_imp      numeric;
  v_iva      numeric;
begin
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  select user_id into v_staff from user_roles where role <> 'titolare' limit 1;
  select id into v_srls from entities where entity_type = 'srls' limit 1;
  if v_titolare is null or v_srls is null then
    raise exception 'VERIFICA: servono un titolare e Borgo 58.';
  end if;

  begin  -- <<< la sotto-transazione che verrà annullata
    update entities set vat_number = '01343950869', legal_name = 'Borgo 58 S.r.l.s.',
           sede_indirizzo = 'Via Prova 58', sede_cap = '84043', sede_comune = 'Agropoli', sede_provincia = 'SA'
     where id = v_srls;

    perform set_config('request.jwt.claims', json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);
    set local role authenticated;

    insert into clienti_fattura (denominazione, partita_iva, indirizzo, cap, comune, provincia)
    values ('ZZ Ditta della bozza srl', '01234567890', 'Via Prova 2', '84043', 'Agropoli', 'SA')
    returning id into v_cli;

    -- (1) e (2)
    v_f := salva_bozza_fattura(null,
      jsonb_build_object('cliente_id', v_cli, 'data', '2099-03-10'),
      jsonb_build_array(
        jsonb_build_object('descrizione', 'ZZ Cena', 'quantita', 4, 'prezzo_unitario', 25),
        jsonb_build_object('descrizione', 'ZZ Servizio', 'prezzo_unitario', 122, 'aliquota_iva', 22)));
    select count(*) into v_n from fatture_emesse_righe where fattura_id = v_f;
    if v_n <> 2 or not exists (select 1 from fatture_emesse where id = v_f and stato = 'bozza'
         and prezzi_ivati and entity_id = v_srls and data = date '2099-03-10') then
      raise exception 'VERIFICA (1): la bozza nuova non si è salvata con le sue due righe e i prezzi IVA inclusa.';
    end if;
    select sum(imponibile), sum(imposta) into v_imp, v_iva from totali_fattura(v_f);
    -- 100 al 10%: 90,91 + 9,09; 122 al 22%: 100,00 + 22,00.
    if v_imp <> 190.91 or v_iva <> 31.09 then
      raise exception 'VERIFICA (2): lo scorporo dice % + %, invece di 190,91 + 31,09.', v_imp, v_iva;
    end if;

    -- (3) Riscrivere sostituisce.
    perform salva_bozza_fattura(v_f,
      jsonb_build_object('cliente_id', v_cli, 'data', '2099-03-10', 'prezzi_ivati', false, 'causale', 'ZZ causale'),
      jsonb_build_array(
        jsonb_build_object('descrizione', 'ZZ Cena', 'quantita', 4, 'prezzo_unitario', 25),
        jsonb_build_object('descrizione', 'ZZ Servizio', 'prezzo_unitario', 100, 'aliquota_iva', 22)));
    select count(*) into v_n from fatture_emesse_righe where fattura_id = v_f;
    if v_n <> 2 then
      raise exception 'VERIFICA (3): riscrivere la bozza ha lasciato % righe invece di 2.', v_n;
    end if;

    -- (4) Senza IVA inclusa: come in 20261113000002.
    select sum(imponibile), sum(imposta) into v_imp, v_iva from totali_fattura(v_f);
    if v_imp <> 200 or v_iva <> 32 then
      raise exception 'VERIFICA (4): senza IVA inclusa i conti dicono % + %, invece di 200 + 32.', v_imp, v_iva;
    end if;

    -- (5) Emettere congela i totali scorporati.
    perform salva_bozza_fattura(v_f,
      jsonb_build_object('cliente_id', v_cli, 'prezzi_ivati', true),
      jsonb_build_array(
        jsonb_build_object('descrizione', 'ZZ Cena', 'quantita', 4, 'prezzo_unitario', 25),
        jsonb_build_object('descrizione', 'ZZ Servizio', 'prezzo_unitario', 122, 'aliquota_iva', 22)));
    perform emetti_fattura(v_f);
    if not exists (select 1 from fatture_emesse where id = v_f and stato = 'da_inviare'
         and imponibile = 190.91 and imposta = 31.09 and totale = 222.00) then
      raise exception 'VERIFICA (5): emetti_fattura non ha congelato 190,91 + 31,09 = 222,00.';
    end if;

    -- (6) Uscita: non si riscrive. Scartata: sì, ma data e «IVA inclusa» restano.
    v_ok := false;
    begin
      perform salva_bozza_fattura(v_f, jsonb_build_object('cliente_id', v_cli),
        jsonb_build_array(jsonb_build_object('descrizione', 'ZZ', 'prezzo_unitario', 1)));
    exception when others then v_ok := sqlerrm like '%già uscita%'; end;
    if not v_ok then raise exception 'VERIFICA (6): una fattura uscita si è riscritta.'; end if;
    reset role;
    update fatture_emesse set stato = 'scartata' where id = v_f;
    set local role authenticated;
    perform salva_bozza_fattura(v_f,
      jsonb_build_object('cliente_id', v_cli, 'data', '2099-12-31', 'causale', 'ZZ corretta', 'prezzi_ivati', false),
      jsonb_build_array(jsonb_build_object('descrizione', 'ZZ Cena corretta', 'quantita', 4, 'prezzo_unitario', 25)));
    if not exists (select 1 from fatture_emesse where id = v_f and data = date '2099-03-10'
                    and causale = 'ZZ corretta' and prezzi_ivati)
       or (select count(*) from fatture_emesse_righe where fattura_id = v_f) <> 1 then
      raise exception 'VERIFICA (6): la fattura scartata non si è corretta, o ha cambiato data o «IVA inclusa».';
    end if;

    -- (7) I rifiuti, senza lasciare niente.
    select count(*) into v_n from fatture_emesse;
    v_ok := false;
    begin perform salva_bozza_fattura(null, jsonb_build_object('cliente_id', v_cli), '[]'::jsonb);
    exception when others then v_ok := sqlerrm like '%almeno una riga%'; end;
    if not v_ok then raise exception 'VERIFICA (7): una bozza senza righe è passata.'; end if;
    v_ok := false;
    begin perform salva_bozza_fattura(null, '{}'::jsonb,
            jsonb_build_array(jsonb_build_object('descrizione', 'ZZ', 'prezzo_unitario', 1)));
    exception when others then v_ok := sqlerrm like 'Scegli il cliente%'; end;
    if not v_ok then raise exception 'VERIFICA (7): una bozza senza cliente è passata.'; end if;
    v_ok := false;
    begin perform salva_bozza_fattura(null, jsonb_build_object('cliente_id', 'non-un-id'),
            jsonb_build_array(jsonb_build_object('descrizione', 'ZZ', 'prezzo_unitario', 1)));
    exception when others then v_ok := sqlerrm like 'Il cliente scelto non si riconosce%'; end;
    if not v_ok then raise exception 'VERIFICA (7): un cliente storpiato non ha avuto la sua frase.'; end if;
    v_ok := false;
    begin perform salva_bozza_fattura(null, jsonb_build_object('cliente_id', v_cli),
            jsonb_build_array(jsonb_build_object('descrizione', 'ZZ')));
    exception when others then v_ok := sqlerrm like 'Ogni riga vuole%'; end;
    if not v_ok then raise exception 'VERIFICA (7): una riga senza prezzo è passata.'; end if;
    v_ok := false;
    begin perform salva_bozza_fattura(null, jsonb_build_object('cliente_id', v_cli),
            jsonb_build_array(jsonb_build_object('descrizione', 'ZZ', 'prezzo_unitario', 1, 'aliquota_iva', 0)));
    exception when others then v_ok := true; end;
    if not v_ok then raise exception 'VERIFICA (7): una riga a IVA 0 senza natura è passata.'; end if;
    if (select count(*) from fatture_emesse) <> v_n then
      raise exception 'VERIFICA (7): un rifiuto ha lasciato una fattura a metà.';
    end if;

    -- (8) Lo staff non salva.
    if v_staff is not null then
      reset role;
      perform set_config('request.jwt.claims', json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
      set local role authenticated;
      v_ok := false;
      begin perform salva_bozza_fattura(null, jsonb_build_object('cliente_id', v_cli),
              jsonb_build_array(jsonb_build_object('descrizione', 'ZZ', 'prezzo_unitario', 1)));
      exception when others then v_ok := sqlstate = '42501'; end;
      if not v_ok then raise exception 'VERIFICA (8): lo staff ha salvato una bozza.'; end if;
    end if;

    raise exception 'ZZ_ANNULLA';
  exception when others then
    if sqlerrm <> 'ZZ_ANNULLA' then raise; end if;
  end;

  reset role;
  perform set_config('request.jwt.claims', null, true);
  perform pretendi_nessun_residuo(v_foto, 'la verifica della bozza della fattura');

  raise notice 'Fatto: la bozza si salva intera; IVA inclusa scorporata per aliquota (100 al 10%% + 122 al 22%% = 190,91 + 31,09 = 222,00); riscrivere sostituisce le righe; emettere congela gli stessi totali; uscita non si riscrive, scartata sì senza cambiare data né IVA inclusa; i rifiuti parlano italiano e non lasciano niente; lo staff non salva. Provato e annullato: zero residui.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20261113000003', 'la_bozza_della_fattura_si_salva_intera')
on conflict (version) do nothing;
