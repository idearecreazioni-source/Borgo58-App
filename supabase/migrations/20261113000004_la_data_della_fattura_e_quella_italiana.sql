-- =====================================================================
-- LA DATA DELLA FATTURA È QUELLA ITALIANA (13/11/2026) — pezzo 2a di 5
-- =====================================================================
--
-- 🔴 Trovato dalla rete `funzioni_con_data_utc()` sui Controlli della #388:
--    `salva_bozza_fattura()` (20261113000003) metteva la data di oggi con
--    `current_date`, cioè l'orario di Greenwich: fra mezzanotte e l'una (le
--    due d'estate) una bozza senza data sarebbe nata con la data di IERI.
--    E il default della colonna `fatture_emesse.data` (20261113000002) aveva
--    lo stesso difetto.
--
-- LA CORREZIONE: `oggi_a_roma()` (20260819000006), la stessa che usa il
-- resto del gestionale. Il corpo di salva_bozza_fattura è ripreso da
-- 20261113000003 con quel solo cambio. La 20261113000003 non si riscrive:
-- è già applicata su Prova.
--
-- Idempotente. Si auto-registra. Verifica annullata, zero residui.

alter table fatture_emesse alter column data set default oggi_a_roma();

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
            coalesce(nullif(p_testata->>'data', '')::date, oggi_a_roma()),
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
--   (1) nessuna funzione delle fatture decide la data a Greenwich;
--   (2) una bozza senza data nasce con la data italiana di oggi;
--   (3) il default della colonna è la data italiana.
do $verifica$
declare
  v_foto     jsonb := foto_righe();
  v_titolare uuid;
  v_cli      uuid;
  v_f        uuid;
begin
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  if v_titolare is null then
    raise exception 'VERIFICA: serve un titolare.';
  end if;

  begin  -- <<< la sotto-transazione che verrà annullata
    perform set_config('request.jwt.claims', json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

    if exists (select 1 from funzioni_con_data_utc() f
                where f.nome in ('salva_bozza_fattura', 'emetti_fattura', 'totali_fattura',
                                 'fatture_emesse_guardia', 'fatture_emesse_righe_guardia')) then
      raise exception 'VERIFICA (1): una funzione delle fatture decide ancora la data a Greenwich.';
    end if;

    set local role authenticated;
    insert into clienti_fattura (denominazione, partita_iva, indirizzo, cap, comune, provincia)
    values ('ZZ Ditta della data srl', '01234567890', 'Via Prova 3', '84043', 'Agropoli', 'SA')
    returning id into v_cli;
    v_f := salva_bozza_fattura(null, jsonb_build_object('cliente_id', v_cli),
      jsonb_build_array(jsonb_build_object('descrizione', 'ZZ', 'prezzo_unitario', 10)));
    if not exists (select 1 from fatture_emesse where id = v_f and data = oggi_a_roma()) then
      raise exception 'VERIFICA (2): la bozza senza data non è nata con la data italiana di oggi.';
    end if;
    reset role;

    if (select pg_get_expr(d.adbin, d.adrelid) from pg_attrdef d
          join pg_attribute a on a.attrelid = d.adrelid and a.attnum = d.adnum
         where d.adrelid = 'public.fatture_emesse'::regclass and a.attname = 'data') not like '%oggi_a_roma()%' then
      raise exception 'VERIFICA (3): il default della data della fattura non è la data italiana.';
    end if;

    raise exception 'ZZ_ANNULLA';
  exception when others then
    if sqlerrm <> 'ZZ_ANNULLA' then raise; end if;
  end;

  reset role;
  perform set_config('request.jwt.claims', null, true);
  perform pretendi_nessun_residuo(v_foto, 'la verifica della data della fattura');

  raise notice 'Fatto: la bozza senza data nasce con la data italiana; nessuna funzione delle fatture decide la data a Greenwich; il default della colonna è oggi_a_roma(). Provato e annullato: zero residui.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20261113000004', 'la_data_della_fattura_e_quella_italiana')
on conflict (version) do nothing;
