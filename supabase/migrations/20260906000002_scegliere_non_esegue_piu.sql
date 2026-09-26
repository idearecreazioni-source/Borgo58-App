-- =====================================================================
-- SPEC-0013 — scegliere fra i candidati NON esegue piu'
-- =====================================================================
-- 🔴 ROVESCIAMENTO DICHIARATO. Il 27/08 era stato deciso il contrario, con
--    questa ragione scritta dentro la funzione: *«chi ha appena detto QUALE
--    ha gia' detto anche SI': un secondo pulsante sarebbe il difetto di
--    prima con un passaggio in piu'»*. Era giusta, e in quel mondo lo era
--    davvero: si sceglieva **davanti alla riga che stava per essere
--    scritta**, quindi scegliere era l'ultimo gesto rimasto.
--
--    SPEC-0013 sposta il sì da un'altra parte. Adesso il sì e' l'approvazione
--    dell'**appunto**, che puo' contenere altre righe: scegliere quale
--    prodotto intendeva e' diventato *riempire un campo*, non *dire di sì*.
--    Lasciarlo eseguire vorrebbe dire che una delle tre porte scrive ancora
--    senza approvazione — e sarebbe la porta piu' facile da premere, perche'
--    somiglia a una risposta e non a un comando.
--
-- ⚠️ LA RAGIONE DEL 27/08 NON E' STATA SMENTITA, E' STATA SODDISFATTA
--    ALTROVE: non compare nessun «secondo pulsante». Chi sceglie non deve
--    poi confermare quella riga — deve approvare l'appunto, che e' un gesto
--    che avrebbe fatto comunque per le altre righe che ci sono dentro.
--
-- ⚠️ E IL CONTROLLO CHE CONTA RESTA INTERO: si accetta solo una delle scelte
--    che il gestionale aveva proposto. Senza, la scelta arriverebbe dal
--    browser e si potrebbe abbinare la temperatura di un frigo a un altro
--    dal di fuori. Quel pezzo non si tocca.

-- rete-guardie: scegli_per_azione_dettata — SPEC-0013: scegliere riempie il campo e basta, quindi perde la chiamata all'esecutore
create or replace function scegli_per_azione_dettata(p_id uuid, p_scelta uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_a     azioni_dettate%rowtype;
  v_campo text;
  v_dati  jsonb;
  v_ris   jsonb;
  v_manca text;
begin
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' scegliere.';
  end if;

  select * into v_a from azioni_dettate where id = p_id for update;
  if not found then
    raise exception 'Questa cosa da confermare non c''e'' piu''.';
  end if;
  if v_a.stato not in ('in_attesa', 'fallita') then
    raise exception 'Su questa non c''e'' piu'' niente da scegliere: e'' «%».', v_a.stato;
  end if;

  -- ⚠️ Si accetta SOLO una delle scelte che il gestionale ha offerto. Senza
  --    questo controllo, la scelta arriverebbe dal browser e si potrebbe
  --    scrivere un identificativo qualunque — cioe' abbinare la temperatura
  --    di un frigo a un altro, dal di fuori.
  if not exists (
    select 1 from jsonb_array_elements(azione_scelte(v_a.tipo, v_a.dati)) s
     where (s.value->>'id')::uuid = p_scelta
  ) then
    raise exception 'Questa non e'' una delle cose che ti avevo proposto: ridimmi tu qual e''.';
  end if;

  v_campo := case
    when v_a.tipo in ('giacenza', 'merce_buttata', 'carico_merce') then 'ingredient_id'
    when v_a.tipo = 'temperatura' then 'equipment_id'
    when v_a.tipo = 'pulizia'     then 'task_id'
  end;
  if v_campo is null then
    raise exception 'Su questa cosa non c''e'' niente da scegliere.';
  end if;

  v_dati := (v_a.dati - 'candidati') || jsonb_build_object(v_campo, p_scelta);

  -- Si ritraduce subito: cosi' la scelta si vede sull'appunto invece di
  -- scoprirsi al momento di approvare.
  v_ris   := voce_risolvi_dati(v_a.tipo, v_dati);
  v_dati  := v_ris->'dati';
  v_manca := nullif(v_ris->>'manca', '');

  update azioni_dettate
     set dati   = v_dati,
         sicuro = (v_manca is null),
         motivo = v_manca,
         errore = null,
         stato  = 'in_attesa'
   where id = p_id;

  -- 🔴 NON SI ESEGUE. Il sì e' l'approvazione dell'appunto, e arriva dopo.
  return jsonb_build_object('frase', v_a.frase, 'manca', v_manca, 'dati', v_dati);
end $function$;

do $verifica$
declare
  v_tit    uuid;
  v_det    uuid;
  v_id     uuid;
  v_app    uuid;
  v_ris    jsonb;
  v_lapidi bigint;
  v_lapidi2 bigint;
begin
  select count(*) into v_lapidi from deleted_records;

  -- (1) La funzione non nomina piu' l'esecutore.
  if (select pg_get_functiondef(p.oid) from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = 'scegli_per_azione_dettata')
     like '%esegui_azione_dettata%' then
    raise exception 'VERIFICA: scegliere esegue ancora.';
  end if;

  -- (2) E il controllo sulle scelte offerte e' ancora li'.
  if (select pg_get_functiondef(p.oid) from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = 'scegli_per_azione_dettata')
     not like '%azione_scelte%' then
    raise exception 'VERIFICA: il controllo sulle scelte offerte e'' sparito.';
  end if;

  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  if v_tit is null then
    raise exception 'VERIFICA: non c''e'' nessun titolare con cui provare.';
  end if;
  perform set_config('request.jwt.claims', json_build_object('sub', v_tit)::text, true);

  -- (3) Una scelta inventata viene rifiutata, e la riga resta in attesa.
  v_ris := scrivi_dettatura(
    v_tit, 'prova migrazione: quanto olio', 'app',
    jsonb_build_array(jsonb_build_object(
      'tipo', 'giacenza', 'sicuro', false, 'frase', 'giacenza di prova',
      'dati', jsonb_build_object('nome_sentito', 'zzz prova inesistente', 'quanto_ce', 3))),
    'capita', null, 0, 0, null);
  v_det := (v_ris->>'dettatura_id')::uuid;
  select a.id, a.appunto_id into v_id, v_app from azioni_dettate a where a.dettatura_id = v_det;

  begin
    perform scegli_per_azione_dettata(v_id, gen_random_uuid());
    raise exception 'VERIFICA: ha accettato una scelta che non aveva proposto.';
  exception when others then
    if sqlerrm like 'VERIFICA:%' then raise; end if;
  end;

  if (select stato from azioni_dettate where id = v_id) is distinct from 'in_attesa' then
    raise exception 'VERIFICA: la riga non e'' piu'' in attesa dopo una scelta rifiutata.';
  end if;

  delete from azioni_dettate where id = v_id;
  delete from appunti_vocali where id = v_app;
  delete from dettature where id = v_det;

  select count(*) into v_lapidi2 from deleted_records;
  if v_lapidi2 <> v_lapidi then
    raise exception 'VERIFICA: la pulizia ha lasciato % tracce nel registro.', v_lapidi2 - v_lapidi;
  end if;

  raise notice 'VERIFICA superata: scegliere riempie il campo e non scrive niente.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260906000002', 'scegliere non esegue piu') on conflict (version) do nothing;
