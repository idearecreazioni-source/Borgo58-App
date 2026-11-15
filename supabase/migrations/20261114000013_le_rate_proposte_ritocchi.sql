-- =====================================================================
-- LE RATE PROPOSTE: DUE RITOCCHI DALLA REVISIONE — 14/11/2026
-- =====================================================================
--
-- La 20261114000010 è già applicata e non si riscrive. La revisione del
-- database ha trovato due difetti:
--   1. con un previsto che lascia pochi centesimi da distribuire, una rata
--      poteva uscire a zero o negativa, e al sì la tabella (importo > 0)
--      rifiutava tutto: ora la proposta dice in italiano che non si può.
--   2. la seconda azione (le rate) nasceva anche quando la prima aveva un
--      «manca»: ora nasce solo se alla prima non manca niente.
--
-- Le due funzioni si riprendono dal corpo VIVO e si cambia una sola ancora
-- ciascuna, controllata (deve comparire una volta sola).
--
-- Idempotente, con verifica finale annullata (zero residui).
-- =====================================================================

do $ritocco1$
declare
  v_def text := replace(pg_get_functiondef('public.piano_rate_da_ricalcolare(uuid,numeric)'::regprocedure), E'\r', '');
  v_ancora text := E'  return jsonb_build_object(''possibile'', true, ''rate'', v_rate);';
begin
  if v_def like '%meno di un centesimo%' then return; end if;
  if (length(v_def) - length(replace(v_def, v_ancora, ''))) / length(v_ancora) <> 1 then
    raise exception 'piano_rate_da_ricalcolare non ha il ritorno atteso: confronta il corpo vivo prima di applicare.';
  end if;
  execute replace(v_def, v_ancora,
    E'  if exists (select 1 from jsonb_array_elements(v_rate) e where (e->>''dopo'')::numeric <= 0) then\n'
    || E'    return jsonb_build_object(''possibile'', false,\n'
    || E'      ''motivo'', ''Il nuovo previsto lascia meno di un centesimo a una delle rate: non posso ricalcolarle.'');\n'
    || E'  end if;\n' || v_ancora);
end $ritocco1$;
revoke all on function piano_rate_da_ricalcolare(uuid, numeric) from public, anon, authenticated;

do $ritocco2$
declare
  v_def text := replace(pg_get_functiondef('public.scrivi_dettatura(uuid,text,text,jsonb,text,text,integer,integer,text)'::regprocedure), E'\r', '');
  v_ancora text := E'if v_tipo = ''piano_voce_aggiorna'' and v_dati ? ''rate_ricalcolate'' then';
begin
  if v_def like '%rate_ricalcolate'' then%' and v_def like '%v_manca is null and v_dati ? ''rate_ricalcolate''%' then return; end if;
  if (length(v_def) - length(replace(v_def, v_ancora, ''))) / length(v_ancora) <> 1 then
    raise exception 'scrivi_dettatura non ha la condizione attesa delle rate: confronta il corpo vivo prima di applicare.';
  end if;
  execute replace(v_def, v_ancora,
    E'if v_tipo = ''piano_voce_aggiorna'' and v_manca is null and v_dati ? ''rate_ricalcolate'' then');
end $ritocco2$;

do $verifica$
declare
  v_foto jsonb := foto_righe();
  v_titolare uuid;
  v_voce uuid;
  v_r jsonb;
begin
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  if v_titolare is null then raise exception 'VERIFICA: serve un titolare.'; end if;
  if has_function_privilege('authenticated', 'piano_rate_da_ricalcolare(uuid, numeric)', 'execute') then
    raise exception 'VERIFICA: il calcolo delle rate è aperto a chi non deve.';
  end if;
  if pg_get_functiondef('public.scrivi_dettatura(uuid,text,text,jsonb,text,text,integer,integer,text)'::regprocedure)
       not like '%v_manca is null and v_dati ? ''rate_ricalcolate''%' then
    raise exception 'VERIFICA: la seconda azione non guarda più il «manca».';
  end if;

  begin
    perform set_config('request.jwt.claims', json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);
    insert into piano_voci (gruppo, ordine, descrizione, importo_ivato, aliquota_iva, stato)
    values ('D', 994, 'ZZ voce rate minime', 9000, 22, 'stimato') returning id into v_voce;
    insert into piano_rate (voce_id, mese_rel, importo) values (v_voce, 0, 3000), (v_voce, 1, 3000), (v_voce, 2, 3000);

    v_r := piano_rate_da_ricalcolare(v_voce, 0.02);
    if coalesce((v_r->>'possibile')::boolean, true) or v_r->>'motivo' not like '%meno di un centesimo%' then
      raise exception 'VERIFICA (1): pochi centesimi non fermano la proposta (%).', v_r;
    end if;
    v_r := piano_rate_da_ricalcolare(v_voce, 9800);
    if not coalesce((v_r->>'possibile')::boolean, false)
       or (select sum((e->>'dopo')::numeric) from jsonb_array_elements(v_r->'rate') e) <> 9800 then
      raise exception 'VERIFICA (2): un previsto normale non si ricalcola più (%).', v_r;
    end if;
    raise exception 'ZZ_ANNULLA';
  exception when others then
    if sqlerrm <> 'ZZ_ANNULLA' then raise; end if;
  end;

  perform set_config('request.jwt.claims', null, true);
  perform pretendi_nessun_residuo(v_foto, 'la verifica dei ritocchi alle rate proposte');
  raise notice 'Fatto: rate a zero fermate con una frase chiara, seconda azione solo se alla prima non manca niente. Provato e annullato: zero residui.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20261114000013', 'le_rate_proposte_ritocchi')
on conflict (version) do nothing;
