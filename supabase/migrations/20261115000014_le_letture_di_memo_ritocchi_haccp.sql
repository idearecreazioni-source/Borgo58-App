-- =====================================================================
-- LE LETTURE DI MEMO COME LE PAGINE: DUE RITOCCHI DELLA RILETTURA — 15/11/2026
-- =====================================================================
--
-- La 20261115000013 è già applicata e non si riscrive. La rilettura del
-- revisore ha chiesto, per HACCP:
--   · il «totale» è zero (la descrizione dello strumento dice che non ha
--     un totale, ma la funzione restituiva il conteggio);
--   · un ricevimento merci non conforme sta fra le righe che vengono per prime,
--     insieme alle temperature fuori soglia e alle non conformità aperte.
--
-- rete-portieri: 20261115000014 chiama memo_leggi_haccp — la verifica impersona il titolare prima della lettura.
--
-- Idempotente, con verifica finale annullata (zero residui).
-- =====================================================================

create or replace function memo_leggi_haccp(p_cerca text default null)
returns table (riga_id uuid, etichetta text, dati jsonb, conteggio integer, totale numeric)
language plpgsql stable security definer set search_path = public as $fn$
begin
  if not is_titolare() then raise exception 'La chat di MEMO e'' riservata al titolare.'; end if;
  return query
  with tutte as (
    select t.id, t.recorded_at as quando, t.equipment_name || ' · temperatura' as titolo,
           jsonb_build_object('registro', 'temperature', 'attrezzatura', t.equipment_name,
             'temperatura', t.recorded_temp_c, 'rilevata_il', t.recorded_at,
             'minimo', t.target_min_c, 'massimo', t.target_max_c,
             'conforme', t.is_compliant, 'nota', t.note, 'rimedio', t.corrective_action) as dettaglio
      from v_haccp_temperature_logs t
    union all
    select n.id, n.detected_at, 'Non conformita · ' || n.category,
           jsonb_build_object('registro', 'non conformita', 'categoria', n.category,
             'descrizione', n.description, 'rilevata_il', n.detected_at,
             'risolta', n.resolved, 'risolta_il', n.resolved_at,
             'rimedio', n.corrective_action, 'nota', n.note)
      from haccp_non_conformities n
    union all
    select g.id, g.received_at, 'Ricevimento merci · ' || g.product_description,
           jsonb_build_object('registro', 'ricevimento merci', 'prodotto', g.product_description,
             'ricevuto_il', g.received_at, 'temperatura', g.temperature_c,
             'imballo_integro', g.packaging_ok, 'conforme', g.conformity, 'nota', g.note)
      from haccp_goods_receiving g
    union all
    select l.id, l.completed_at, 'Pulizia · ' || t.name,
           jsonb_build_object('registro', 'pulizie', 'attivita', t.name, 'area', t.area,
             'frequenza', t.frequency, 'completata_il', l.completed_at, 'nota', l.note)
      from haccp_cleaning_logs l join haccp_cleaning_tasks t on t.id = l.task_id
    union all
    select p.id, p.performed_at, 'Disinfestazione · ' || p.type,
           jsonb_build_object('registro', 'disinfestazione', 'tipo', p.type,
             'eseguita_il', p.performed_at, 'eseguita_da', p.performed_by,
             'riscontro', p.findings, 'nota', p.note)
      from haccp_pest_control_logs p
  ), righe as (
    select * from tutte
     where p_cerca is null or titolo ilike '%' || p_cerca || '%' or (select string_agg(j.value, ' ') from jsonb_each_text(dettaglio) j) ilike '%' || p_cerca || '%'
  ) select id, titolo, dettaglio, count(*) over ()::integer, 0::numeric from righe
   order by case when dettaglio->>'registro' = 'non conformita' and coalesce(dettaglio->>'risolta', 'false') <> 'true' then 0
                 when dettaglio->>'registro' in ('temperature', 'ricevimento merci') and dettaglio->>'conforme' = 'false' then 1
                 else 2 end,
            quando desc, id limit 50;
end $fn$;

revoke all on function memo_leggi_haccp(text) from public, anon, authenticated;
grant execute on function memo_leggi_haccp(text) to authenticated;

do $verifica$
declare
  v_foto jsonb := foto_righe(); v_titolare uuid; v_n integer; v_tot numeric;
begin
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  if v_titolare is null then raise exception 'VERIFICA: serve un titolare.'; end if;
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);
    set local role authenticated;
    select count(*), coalesce(max(l.totale), 0) into v_n, v_tot from memo_leggi_haccp(null) l;
    if v_tot <> 0 then raise exception 'VERIFICA: HACCP ha ancora un totale (%).', v_tot; end if;
    reset role;
    if pg_get_functiondef('public.memo_leggi_haccp(text)'::regprocedure) not like '%ricevimento merci'') and dettaglio->>''conforme%' then
      raise exception 'VERIFICA: il ricevimento merci non conforme non e'' fra le righe prioritarie.';
    end if;
    raise exception 'ZZ_ANNULLA';
  exception when others then reset role; if sqlerrm <> 'ZZ_ANNULLA' then raise; end if; end;
  perform set_config('request.jwt.claims', null, true);
  perform pretendi_nessun_residuo(v_foto, 'la verifica dei ritocchi HACCP di MEMO');
  raise notice 'Fatto: HACCP senza totale e con il ricevimento merci non conforme fra le prime righe. Provato e annullato: zero residui.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20261115000014', 'le_letture_di_memo_ritocchi_haccp') on conflict (version) do nothing;
