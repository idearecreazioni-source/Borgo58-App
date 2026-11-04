-- =====================================================================
-- IL CONTROLLO REGOLARE DELLE STAMPANTI — 04/11/2026, chiesto da Alessio
-- al collaudo: «un controllo regolare che si accerti che tutte le
-- stampanti siano in funzione e mi avverta qualora non lo fossero».
-- =====================================================================
--
-- 🔴 IL PONTE CONTROLLA DA SOLO ogni due minuti, e ogni trenta secondi se
--    un apparecchio è in allarme. Solo domande di STATO (status ESC/POS,
--    `queryPrinterStatus` FPMate): niente carta, niente fiscale. Lo scrive
--    qui con `ponte_stato_apparecchi`, la quarta porta del ponte.
-- 🔴 «IN ALLARME» vuol dire: acceso nel gestionale e non risponde, carta
--    finita, coperchio aperto, un errore, oppure nessun controllo da più di
--    sei minuti (tre giri). Se il ponte è spento l'avviso è UNO, quello del
--    ponte: gli apparecchi non si possono controllare.
-- 🔴 L'AVVISO lo vede chi lavora nel locale, in cima al gestionale, con
--    frasi fisse e senza indirizzi (`allarmi_apparecchi`). Sparisce da solo.
-- ⚠️ FUORI: l'avviso sul telefono del titolare (Telegram c'è, ma solo per
--    le prenotazioni): un passo a parte.
-- ⚠️ In produzione oggi non c'è nessun apparecchio né ponte: nessun avviso.

-- ---------------------------------------------------------------------
-- 1. Da quando è guasto, e quando è stato controllato
-- ---------------------------------------------------------------------
alter table dispositivi add column if not exists ultimo_controllo_il timestamptz;
alter table dispositivi add column if not exists guasto_dal timestamptz;
comment on column dispositivi.ultimo_controllo_il is
  'L''ultima volta che il ponte ha chiesto all''apparecchio come sta (controllo regolare o lavoro).';
comment on column dispositivi.guasto_dal is
  'Da quando l''apparecchio non è pronto (non risponde, carta, coperchio, errore). Vuoto quando è a posto.';

-- Il «da quando» lo tiene il database, qualunque porta scriva lo stato.
create or replace function public.dispositivo_guasto_dal()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if new.ultimo_stato in ('non_risponde', 'carta_finita', 'coperchio_aperto', 'errore') then
    if old.ultimo_stato is distinct from new.ultimo_stato or old.guasto_dal is null then
      new.guasto_dal := coalesce(case when old.ultimo_stato in ('non_risponde', 'carta_finita', 'coperchio_aperto', 'errore')
                                      then old.guasto_dal end, now());
    end if;
  elsif new.ultimo_stato = 'pronto' then
    new.guasto_dal := null;
  end if;
  return new;
end $function$;

revoke all on function public.dispositivo_guasto_dal() from public, anon, authenticated;

drop trigger if exists dispositivo_guasto_dal on dispositivi;
create trigger dispositivo_guasto_dal
  before update of ultimo_stato on dispositivi
  for each row execute function dispositivo_guasto_dal();

-- ---------------------------------------------------------------------
-- 2. La quarta porta del ponte: com'è andato il controllo
-- ---------------------------------------------------------------------
-- ⚠️ Stessa forma delle altre porte: la chiave, il freno, il titolare.
create or replace function public.ponte_stato_apparecchi(p_chiave text, p_stati jsonb)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_chiave uuid := ponte_entra(p_chiave);
  v_s      jsonb;
  v_stato  text;
begin
  if not is_titolare() then
    raise exception 'La chiave del ponte appartiene a un accesso che non è il titolare.';
  end if;
  if jsonb_typeof(p_stati) <> 'array' or jsonb_array_length(p_stati) > 30 then
    raise exception 'Lo stato degli apparecchi è un elenco di al massimo 30.';
  end if;
  for v_s in select * from jsonb_array_elements(p_stati) loop
    v_stato := case when v_s->>'stato' in ('pronto', 'carta_finita', 'coperchio_aperto', 'non_risponde', 'errore')
                    then v_s->>'stato' else 'errore' end;
    update dispositivi
       set ultimo_stato = v_stato,
           ultimo_stato_testo = case when v_stato = 'pronto' then null else left(v_s->>'testo', 500) end,
           ultimo_controllo_il = now(),
           ultimo_contatto_il = case when v_stato = 'non_risponde' then ultimo_contatto_il else now() end
     where id = (v_s->>'id')::uuid and attivo;
  end loop;
end $function$;

revoke all on function public.ponte_stato_apparecchi(text, jsonb) from public, anon, authenticated;
grant execute on function public.ponte_stato_apparecchi(text, jsonb) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. Gli allarmi, per chi lavora nel locale
-- ---------------------------------------------------------------------
create or replace function public.allarmi_apparecchi()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_installato boolean;
  v_acceso     boolean;
  v_ultimo     timestamptz;
begin
  if auth.uid() is null or not exists (select 1 from user_roles where user_id = auth.uid()) then
    raise exception 'Operazione consentita solo a chi lavora nel locale.';
  end if;
  select count(*) > 0, max(ultimo_battito) into v_installato, v_ultimo
    from chiavi_ponte where revocata_il is null;
  v_acceso := coalesce(v_ultimo > now() - interval '90 seconds', false);

  -- Senza apparecchi accesi non c'è niente da controllare.
  if not exists (select 1 from dispositivi where attivo) or not v_installato then
    return jsonb_build_object('ponte_acceso', v_acceso, 'allarmi', '[]'::jsonb);
  end if;

  if not v_acceso then
    return jsonb_build_object('ponte_acceso', false, 'allarmi', jsonb_build_array(jsonb_build_object(
      'chi', 'ponte', 'stato', 'spento',
      'frase', 'Il ponte è spento o senza rete'
               || coalesce(' dalle ' || to_char(v_ultimo at time zone 'Europe/Rome', 'HH24:MI'), '')
               || ': stampanti e registratore non ricevono niente e non si controllano.')));
  end if;

  return jsonb_build_object('ponte_acceso', true, 'allarmi', coalesce((
    select jsonb_agg(jsonb_build_object(
             'chi', d.id, 'stato', x.stato,
             'frase', case when d.tipo = 'registratore_fiscale' then 'Il registratore'
                           when d.reparto = 'bar' then 'La stampante del bar'
                           else 'La stampante della cucina' end
                      || case x.stato
                           when 'non_risponde' then ' non risponde'
                           when 'carta_finita' then ' ha la carta finita'
                           when 'coperchio_aperto' then ' ha il coperchio aperto'
                           when 'errore' then ' segnala un errore'
                           else ' non si controlla' end
                      || coalesce(' dalle ' || to_char(x.dal at time zone 'Europe/Rome', 'HH24:MI'), '')
                      || '.')
             order by d.nome)
      from dispositivi d
      cross join lateral (
        select case when d.ultimo_stato in ('non_risponde', 'carta_finita', 'coperchio_aperto', 'errore') then d.ultimo_stato
                    when d.ultimo_controllo_il is null or d.ultimo_controllo_il < now() - interval '6 minutes' then 'senza_controllo'
               end as stato,
               case when d.ultimo_stato in ('non_risponde', 'carta_finita', 'coperchio_aperto', 'errore') then d.guasto_dal
                    else d.ultimo_controllo_il end as dal
      ) x
     where d.attivo and x.stato is not null), '[]'::jsonb));
end $function$;

revoke all on function public.allarmi_apparecchi() from public, anon, authenticated;
grant execute on function public.allarmi_apparecchi() to authenticated;

-- ---------------------------------------------------------------------
-- 4. Verifica
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_foto     jsonb := foto_righe();
  v_titolare uuid;
  v_staff    uuid;
  v_disp     uuid;
  v_k        jsonb;
  v_r        jsonb;
begin
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  select user_id into v_staff from user_roles where role = 'staff' limit 1;
  if v_titolare is null or v_staff is null then
    raise exception 'VERIFICA: servono un titolare e uno staff in user_roles.';
  end if;
  if has_function_privilege('anon', 'allarmi_apparecchi()', 'execute') then
    raise exception 'VERIFICA: anon può leggere gli allarmi degli apparecchi.';
  end if;

  begin
    update dispositivi set attivo = false where attivo;
    update chiavi_ponte set revocata_il = now() where revocata_il is null;
    insert into dispositivi (nome, tipo, protocollo, indirizzo, porta, reparto)
    values ('ZZ cucina del controllo', 'stampante_comande', 'simulatore', '127.0.0.1', 19197, 'cucina')
    returning id into v_disp;
    perform set_config('request.jwt.claims', json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);
    v_k := crea_chiave_ponte('ZZ ponte del controllo');
    perform set_config('request.jwt.claims', null, true);
    perform ponte_battito(v_k->>'chiave', 'verifica', 'verifica');

    -- (1) Carta finita: l'allarme compare, con l'ora, per lo staff.
    perform ponte_stato_apparecchi(v_k->>'chiave', jsonb_build_array(jsonb_build_object(
      'id', v_disp, 'stato', 'carta_finita', 'testo', 'carta finita su 127.0.0.1')));
    if (select guasto_dal from dispositivi where id = v_disp) is null then
      raise exception 'VERIFICA (1a): il guasto non ha la sua ora.';
    end if;
    perform set_config('request.jwt.claims', json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
    set local role authenticated;
    v_r := allarmi_apparecchi();
    if jsonb_array_length(v_r->'allarmi') <> 1
       or v_r->'allarmi'->0->>'frase' not like 'La stampante della cucina ha la carta finita dalle %' then
      raise exception 'VERIFICA (1b): l''allarme della carta finita non è quello giusto: %.', v_r;
    end if;
    if v_r::text ~ '\d+\.\d+\.\d+\.\d+' then
      raise exception 'VERIFICA (1c): l''allarme mostra un indirizzo allo staff.';
    end if;
    reset role;
    perform set_config('request.jwt.claims', null, true);

    -- (2) Poi spenta: resta in allarme, e l'ora resta quella del primo guasto.
    v_r := to_jsonb((select guasto_dal from dispositivi where id = v_disp));
    perform ponte_stato_apparecchi(v_k->>'chiave', jsonb_build_array(jsonb_build_object('id', v_disp, 'stato', 'non_risponde')));
    if to_jsonb((select guasto_dal from dispositivi where id = v_disp)) <> v_r then
      raise exception 'VERIFICA (2): l''ora del guasto è cambiata da carta finita a spenta.';
    end if;

    -- (3) Riaccesa: l'allarme sparisce da solo.
    perform ponte_stato_apparecchi(v_k->>'chiave', jsonb_build_array(jsonb_build_object('id', v_disp, 'stato', 'pronto')));
    perform set_config('request.jwt.claims', json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
    if jsonb_array_length(allarmi_apparecchi()->'allarmi') <> 0 then
      raise exception 'VERIFICA (3): l''allarme non è sparito con la stampante a posto.';
    end if;
    perform set_config('request.jwt.claims', null, true);

    -- (4) Nessun controllo da sette minuti: allarme «non si controlla».
    update dispositivi set ultimo_controllo_il = now() - interval '7 minutes' where id = v_disp;
    perform set_config('request.jwt.claims', json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
    if allarmi_apparecchi()->'allarmi'->0->>'frase' not like '%non si controlla dalle%' then
      raise exception 'VERIFICA (4): un apparecchio mai controllato da sette minuti non è in allarme.';
    end if;

    -- (5) Ponte spento: un avviso solo, quello del ponte.
    update chiavi_ponte set ultimo_battito = now() - interval '5 minutes' where revocata_il is null;
    v_r := allarmi_apparecchi();
    if (v_r->>'ponte_acceso')::boolean or jsonb_array_length(v_r->'allarmi') <> 1 or v_r->'allarmi'->0->>'chi' <> 'ponte' then
      raise exception 'VERIFICA (5): col ponte spento l''avviso non è uno solo, del ponte: %.', v_r;
    end if;
    perform set_config('request.jwt.claims', null, true);

    raise exception 'ZZ_ANNULLA';
  exception when others then
    if sqlerrm <> 'ZZ_ANNULLA' then raise; end if;
  end;

  reset role;
  perform set_config('request.jwt.claims', null, true);
  perform pretendi_nessun_residuo(v_foto, 'la verifica del controllo delle stampanti');

  raise notice 'Fatto: carta finita e spenta fanno comparire l''allarme con l''ora del primo guasto, riaccesa lo fa sparire; senza controllo da sei minuti è in allarme; col ponte spento l''avviso è uno solo; niente indirizzi allo staff. Provato e annullato: zero residui.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20261104000005', 'il_controllo_delle_stampanti')
on conflict (version) do nothing;
