-- =====================================================================
-- SPEC-0013 — ogni elemento dell'appunto porta le sue scelte
-- =====================================================================
-- ⚠️ PERCHE' UNA MIGRAZIONE A SE' E NON UNA RIGA IN PIU' NELLA `…001`: quella
--    e' gia' applicata, e in questo progetto *una migrazione applicata non si
--    riscrive mai* (23/08) — il file racconta cosa e' successo quel giorno, e
--    correggerlo lo rende una bugia per chi ricostruira' da zero fra un anno.
--    Vale anche quando la correzione e' corta e il file non e' ancora andato
--    in produzione.
--
-- 🔴 IL DIFETTO CHE CHIUDE, ed e' una perdita che nessun errore avrebbe
--    segnalato: dal 27/08 quando MEMO trova due candidati plausibili — due
--    oli, due tonni — il gestionale li propone e Alessio tocca quello giusto.
--    L'elenco degli appunti non portava `scelte`, quindi quel gesto sarebbe
--    semplicemente **sparito dalla schermata**, restando vivo nel database e
--    raggiungibile da nessuno. *Una funzione irraggiungibile e' peggio di una
--    tolta: nessuno sa che c'era.*
--
-- ⚠️ E `percorso` viaggia con loro per la stessa ragione: e' la via d'uscita a
--    mano decisa il 27/08 — «se ti dico segna trenta euro pagati al fornitore,
--    mi aspetto un collegamento che mi porti dove si segnano le spese». Un
--    rifiuto senza gesto d'uscita e' un vicolo cieco.

create or replace function appunti_da_approvare()
returns table (id uuid, destinazione text, titolo text, eseguibile boolean,
               quanti integer, incerto boolean, aperto_da_ore integer,
               aperto_da_giorni integer, creato_il timestamptz, elementi jsonb)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
begin
  if not is_titolare() then
    raise exception 'Gli appunti dettati sono riservati al titolare.';
  end if;

  return query
  select p.id, p.destinazione, p.titolo, p.eseguibile,
         count(a.id)::integer,
         bool_or(not a.sicuro),
         (extract(epoch from (now() - p.creato_il)) / 3600)::integer,
         (((now() at time zone 'Europe/Rome')::date) - ((p.creato_il at time zone 'Europe/Rome')::date))::integer,
         p.creato_il,
         -- ⚠️ Ogni elemento porta i DATI CONCRETI che verrebbero scritti,
         --    non una sintesi: e' la richiesta esplicita di SPEC-0013, e
         --    senza di essa «approva» sarebbe una firma in bianco.
         coalesce(jsonb_agg(jsonb_build_object(
           'id', a.id, 'frase', a.frase, 'dati', a.dati, 'sicuro', a.sicuro,
           'motivo', a.motivo, 'alternative', coalesce(a.alternative, '[]'::jsonb),
           'stato', a.stato, 'errore', a.errore, 'detto', d.testo,
           'domanda',  azione_domanda(a.tipo, a.dati, a.stato),
           'scelte',   coalesce(azione_scelte(a.tipo, a.dati), '[]'::jsonb),
           'percorso', azione_percorso(a.tipo)
         ) order by a.creato_il, a.progressivo), '[]'::jsonb)
    from appunti_vocali p
    join azioni_dettate a on a.appunto_id = p.id and a.stato in ('in_attesa', 'fallita')
    join dettature d on d.id = a.dettatura_id
   where p.stato = 'aperto'
   group by p.id
   order by p.creato_il;
end $function$;

revoke all on function appunti_da_approvare() from public, anon, authenticated;
grant execute on function appunti_da_approvare() to authenticated;

do $verifica$
declare
  v_tit    uuid;
  v_det    uuid;
  v_id     uuid;
  v_app    uuid;
  v_ris    jsonb;
  v_el     jsonb;
  v_lapidi bigint;
  v_lapidi2 bigint;
begin
  select count(*) into v_lapidi from deleted_records;

  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  if v_tit is null then
    raise exception 'VERIFICA: non c''e'' nessun titolare con cui provare.';
  end if;
  perform set_config('request.jwt.claims', json_build_object('sub', v_tit)::text, true);

  v_ris := scrivi_dettatura(
    v_tit, 'prova migrazione: scelte nell''elenco', 'app',
    jsonb_build_array(jsonb_build_object(
      'tipo', 'giacenza', 'sicuro', false, 'frase', 'giacenza di prova',
      'dati', jsonb_build_object('nome_sentito', 'zzz prova inesistente', 'quanto_ce', 3))),
    'capita', null, 0, 0, null);
  v_det := (v_ris->>'dettatura_id')::uuid;
  select a.id, a.appunto_id into v_id, v_app from azioni_dettate a where a.dettatura_id = v_det;

  select elementi->0 into v_el from appunti_da_approvare() where id = v_app;
  if v_el is null then
    raise exception 'VERIFICA: l''appunto non compare nell''elenco.';
  end if;

  -- Le tre chiavi ci sono. ⚠️ Si controlla la PRESENZA, non il contenuto:
  -- su un nome inventato le scelte sono legittimamente vuote, e pretenderle
  -- piene proverebbe il catalogo invece della forma della risposta.
  if not (v_el ? 'scelte') then
    raise exception 'VERIFICA: gli elementi non portano le scelte.';
  end if;
  if not (v_el ? 'percorso') then
    raise exception 'VERIFICA: gli elementi non portano la via d''uscita a mano.';
  end if;
  if not (v_el ? 'domanda') then
    raise exception 'VERIFICA: gli elementi non portano la domanda.';
  end if;
  if jsonb_typeof(v_el->'scelte') <> 'array' then
    raise exception 'VERIFICA: le scelte non sono un elenco: sono «%».', jsonb_typeof(v_el->'scelte');
  end if;

  delete from azioni_dettate where id = v_id;
  delete from appunti_vocali where id = v_app;
  delete from dettature where id = v_det;

  select count(*) into v_lapidi2 from deleted_records;
  if v_lapidi2 <> v_lapidi then
    raise exception 'VERIFICA: la pulizia ha lasciato % tracce nel registro.', v_lapidi2 - v_lapidi;
  end if;

  raise notice 'VERIFICA superata: ogni elemento porta scelte, percorso e domanda.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260906000003', 'ogni elemento porta le sue scelte') on conflict (version) do nothing;
