-- ============================================================================
-- LO STATO DI UNA CAPARRA, IN UNA DOMANDA SOLA — 27/08/2026
-- ============================================================================
--
-- La schermata della prenotazione deve poter chiedere: *questa caparra a che
-- punto e'?* — c'e', e' stata scalata su un conto, o e' stata tenuta perche'
-- il cliente non e' venuto.
--
-- ⚠️ PERCHE' UNA FUNZIONE E NON UNA LETTURA DIRETTA. Il fatto vive su
--    `cash_movements`, e riconoscere «la caparra» fra i movimenti vuol dire
--    sapere qual e' la causale giusta. Scritto nel browser, quel filtro
--    diventa **una seconda definizione di che cos'e' una caparra**: il giorno
--    che qualcuno rinomina la causale, la schermata smette di trovarla e non
--    da' nessun errore — dice «nessuna caparra» con calma.
--
-- ⚠️ E la caparra e' un dato commerciale (§3.5): il portiere sta dentro,
--    perche' `security definer` scavalca la RLS.
-- ============================================================================

create or replace function stato_caparra(p_reservation_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_mov cash_movements%rowtype;
begin
  if not (select is_titolare()) then
    raise exception 'La caparra e'' un dato del titolare.';
  end if;

  select * into v_mov from cash_movements
   where reservation_id = p_reservation_id
     and causale_id = (select id from cash_causali where label = 'Caparra ricevuta')
   order by created_at limit 1;

  -- ⚠️ «Non c'e' nessuna caparra» e «non sono riuscito a leggere» sono due
  --    cose diverse: qui si risponde alla prima, e la seconda risale come
  --    errore invece di travestirsi da elenco vuoto.
  if v_mov.id is null then
    return jsonb_build_object('c_e', false);
  end if;

  return jsonb_build_object(
    'c_e',            true,
    'movimento_id',   v_mov.id,
    'importo',        v_mov.amount,
    'mezzo',          v_mov.mezzo,
    'serata',         v_mov.caparra_evento_il,
    'usata_su_conto', v_mov.caparra_usata_su_conto,
    'tenuta_il',      v_mov.caparra_trattenuta_il,
    'tenuta_perche',  v_mov.caparra_trattenuta_perche);
end $$;

comment on function stato_caparra(uuid) is
  'A che punto e'' la caparra di questa prenotazione: c''e'', e'' stata scalata su un conto, o e'' stata tenuta perche'' il cliente non si e'' presentato. In un posto solo, perche'' riconoscere una caparra fra i movimenti e'' una definizione e non un filtro.';

revoke all on function stato_caparra(uuid) from public, anon, authenticated;
grant execute on function stato_caparra(uuid) to authenticated;

-- ============================================================================
-- VERIFICA
-- ============================================================================
do $verifica$
declare
  v_foto  jsonb;
  v_tit   uuid;
  v_ent   uuid;
  v_res   uuid;
  v_r     jsonb;
  v_movs  text[] := '{}';
  v_resid text[] := '{}';
  v_s0    numeric;
begin
  v_foto := foto_righe();
  select id into v_ent from entities where entity_type = 'srls' limit 1;
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', v_tit)::text, true);
  select coalesce(balance, 0) into v_s0 from v_cash_balance where entity_id = v_ent;

  insert into reservations (customer_name, reservation_date, reservation_time, party_size, status, source)
  values ('VERIFICA stato caparra', oggi_a_roma(), '20:30', 2, 'confermata', 'interno')
  returning id into v_res;
  v_resid := v_resid || v_res::text;

  -- (1) SENZA CAPARRA dice che non c'e', e non si rompe.
  if (stato_caparra(v_res)->>'c_e')::boolean then
    raise exception 'Dice che c''e'' una caparra dove non ne e'' mai stata presa nessuna.';
  end if;

  -- (2) CON LA CAPARRA dice l'importo e la serata.
  v_r := registra_caparra(v_res, 35);
  v_movs := v_movs || (v_r->>'movimento_id');
  if (stato_caparra(v_res)->>'importo')::numeric <> 35 then
    raise exception 'Lo stato della caparra non dice l''importo giusto.';
  end if;
  if (stato_caparra(v_res)->>'serata')::date is distinct from oggi_a_roma() then
    raise exception 'Lo stato della caparra non dice di che serata era.';
  end if;
  if nullif(stato_caparra(v_res)->>'tenuta_il', '') is not null then
    raise exception 'Una caparra appena presa risulta gia'' tenuta.';
  end if;

  -- (3) TENUTA: lo stato cambia, e lo dice.
  perform trattieni_caparra(v_res, 'VERIFICA stato');
  if (stato_caparra(v_res)->>'tenuta_il')::date is distinct from serata_di_servizio() then
    raise exception 'La caparra tenuta non risulta tenuta nello stato.';
  end if;

  -- (4) ANNULLATA: torna disponibile, e anche questo si vede.
  perform annulla_trattenuta_caparra(v_res);
  if nullif(stato_caparra(v_res)->>'tenuta_il', '') is not null then
    raise exception 'La trattenuta annullata risulta ancora nello stato.';
  end if;

  -- Pulizia — per identificativo, in un elenco.
  delete from reservation_deposits where reservation_id::text = any(v_resid);
  delete from cash_movements where id::text = any(v_movs);
  delete from reservations where id::text = any(v_resid);
  delete from deleted_records where record_id = any(v_movs) or record_id = any(v_resid);

  if (select coalesce(balance, 0) from v_cash_balance where entity_id = v_ent) <> v_s0 then
    raise exception 'Il saldo di cassa non e'' tornato a quello di partenza.';
  end if;

  perform set_config('request.jwt.claims', null, true);
  perform pretendi_nessun_residuo(v_foto, 'la verifica dello stato della caparra');
  raise notice 'verifica: lo stato della caparra dice i quattro casi, saldo tornato a %', euro(v_s0);
end $verifica$;

insert into applied_migrations (version, name)
values ('20260827000004', 'lo_stato_della_caparra')
on conflict (version) do nothing;
