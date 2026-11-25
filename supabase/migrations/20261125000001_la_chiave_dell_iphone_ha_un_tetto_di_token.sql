-- 25/11/2026 — Revisione dell'11/11, punto 17 (scelta B della chat madre): la chiave dell'iPhone ha un tetto sui token.
--
-- Il rischio: chi trova la chiave dell'iPhone (aperta ad `anon`) può scrivere dettature con numeri di token inventati
-- (o enormi) e falsare la spesa AI, e può farne 60 all'ora con numeri grandi a piacere. La barriera di Casa (decisione
-- dell'1/11) non si tocca e non nascono chiavi nuove: si mettono LIMITI VERI dentro il database.
--   1. Per ogni dettatura entrata dalla chiave, i token si riportano in un intervallo sensato:
--      domanda 0–40.000, risposta 0–4.000, token della cache 0–200.000.
--   2. `voce_limite_dettature` (l'unico posto dei limiti, chiamato da entrambe le porte) guarda anche il TOTALE dei
--      token dell'ultima ora per quella chiave: oltre 500.000 si ferma, come per le 60 dettature.
-- Limite noto, accettato: con la chiave si può ancora leggere il catalogo col piano. Se perdi il telefono, revoca la
-- chiave in un tocco dal gestionale.

create or replace function voce_limite_dettature(p_utente uuid)
returns table(superato boolean, quante integer, tetto integer, frase text)
language plpgsql
stable security definer
set search_path to 'public'
as $funzione$
declare
  -- 🔴 LE SOGLIE. Un posto solo, e si cambiano qui.
  v_tetto       constant integer := 60;
  v_tetto_token constant bigint  := 500000;
  v_n           integer;
  v_token       bigint;
begin
  select count(*), coalesce(sum(coalesce(d.token_domanda, 0) + coalesce(d.token_risposta, 0)), 0)
    into v_n, v_token
    from dettature d
   where d.creato_da = p_utente
     and d.provenienza = 'scorciatoia'
     and d.creato_il > now() - interval '1 hour';

  return query select
    (v_n >= v_tetto or v_token >= v_tetto_token),
    v_n,
    v_tetto,
    case when v_token >= v_tetto_token
      then 'Questa strada ha gia'' usato ' || v_tetto_token ||
           ' token nell''ultima ora: mi fermo. Se non sei stato tu, togli la chiave dal gestionale.'
      else 'Sono gia'' arrivate ' || v_tetto ||
           ' dettature nell''ultima ora da questa strada: mi fermo. Se non sei stato tu, togli la chiave dal gestionale.'
    end;
end $funzione$;

revoke all on function voce_limite_dettature(uuid) from public, anon, authenticated;

-- I token entrati dalla chiave si riportano nell'intervallo. Si cambia il corpo VIVO in due punti (ognuno deve comparire
-- una volta sola).
do $limiti$
declare
  v_def text;
  v_n   integer;
  v_a_v constant text := 'p_modello, p_token_domanda, p_token_risposta, p_messaggio),';
  v_a_n constant text := 'p_modello, least(greatest(coalesce(p_token_domanda, 0), 0), 40000), least(greatest(coalesce(p_token_risposta, 0), 0), 4000), p_messaggio),';
  v_b_v constant text := 'p_modello, p_token_cache_scritti, p_token_cache_letti),';
  v_b_n constant text := 'p_modello, least(greatest(coalesce(p_token_cache_scritti, 0), 0), 200000), least(greatest(coalesce(p_token_cache_letti, 0), 0), 200000)),';
begin
  perform set_config('request.jwt.claims', null, true);
  v_def := replace(pg_get_functiondef('public.registra_dettatura_da_chiave(text, text, jsonb, text, text, integer, integer, text, integer, integer)'::regprocedure), E'\r', '');
  if v_def like '%least(greatest(coalesce(p_token_domanda, 0), 0), 40000)%' then return; end if;
  v_n := (length(v_def) - length(replace(v_def, v_a_v, ''))) / length(v_a_v);
  if v_n <> 1 then raise exception 'registra_dettatura_da_chiave: la riga dei token domanda/risposta compare % volte (deve essere 1).', v_n; end if;
  v_n := (length(v_def) - length(replace(v_def, v_b_v, ''))) / length(v_b_v);
  if v_n <> 1 then raise exception 'registra_dettatura_da_chiave: la riga dei token della cache compare % volte (deve essere 1).', v_n; end if;
  execute replace(replace(v_def, v_a_v, v_a_n), v_b_v, v_b_n);
end $limiti$;

-- ---------------------------------------------------------------------
-- VERIFICA (blocco annullato, zero residui)
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_tit uuid;
  v_r   record;
  v_i   integer;
  v_def text;
begin
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  if v_tit is null then raise exception 'VERIFICA: nessun titolare.'; end if;

  v_def := pg_get_functiondef('public.registra_dettatura_da_chiave(text, text, jsonb, text, text, integer, integer, text, integer, integer)'::regprocedure);
  if v_def not like '%40000)%' or v_def not like '%4000)%' or v_def not like '%200000)%' then
    raise exception 'VERIFICA (1): i limiti sui token non sono nel corpo della funzione.';
  end if;

  begin
    for v_i in 1..13 loop
      insert into dettature (testo, provenienza, esito, modello, token_domanda, token_risposta, costo_euro, messaggio, creato_da)
      values ('ZZ verifica token', 'scorciatoia', 'capita', null, 40000, 4000, 0, null, v_tit);
    end loop;
    select * into v_r from voce_limite_dettature(v_tit);
    if v_r.quante < 60 and not v_r.superato then
      raise exception 'VERIFICA (2): 13 dettature da 44.000 token non fermano la chiave.';
    end if;
    if v_r.quante < 60 and v_r.frase not like '%token%' then
      raise exception 'VERIFICA (3): la frase non dice che è il tetto dei token.';
    end if;
    raise exception 'ZZ_ANNULLA';
  exception when others then
    if sqlerrm <> 'ZZ_ANNULLA' then raise; end if;
  end;

  if exists (select 1 from dettature where testo = 'ZZ verifica token') then
    raise exception 'VERIFICA (4): resta un residuo della verifica.';
  end if;
  raise notice 'Fatto: la chiave dell''iPhone ha un tetto di 500.000 token all''ora e ogni dettatura porta i token in un intervallo sensato. Provato e annullato: zero residui.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20261125000001', 'la_chiave_dell_iphone_ha_un_tetto_di_token')
on conflict (version) do nothing;
