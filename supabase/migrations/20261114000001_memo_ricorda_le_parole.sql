-- =====================================================================
-- MEMO RICORDA LE PAROLE DETTE DOPO «CORREGGI»
-- 14/11/2026
-- =====================================================================
--
-- Prima di applicare: confrontare il corpo di `correggi_elemento_appunto`
-- qui sotto con quello vivo nel database. È ripreso dall'ultima definizione
-- nel repository (`20261112000001_memo_si_corregge`) e cambia solo ciò che
-- serve a ricordare le parole dette e il fatto della correzione.
-- =====================================================================

alter table azioni_dettate
  add column if not exists corretta_il timestamptz,
  add column if not exists parole_dette text;

comment on column azioni_dettate.corretta_il is
  'Quando il titolare ha corretto questa riga di un appunto. Distingue una correzione dal dubbio iniziale di MEMO.';
comment on column azioni_dettate.parole_dette is
  'Le parole della dettatura che hanno prodotto questa azione: il pezzo quando MEMO era sicuro, altrimenti tutta la dettatura. Servono alla firma dopo «Correggi».';

-- `registra_dettatura` mantiene la sua firma: riceve già il JSON delle
-- azioni. Si riprende il corpo vivo di chi lo scrive davvero e si aggiunge
-- solo il campo nuovo. I controlli sotto rifiutano un corpo cambiato invece
-- di riscriverne in silenzio una versione vecchia.
do $scrivi_parole$
declare
  v_def text := replace(pg_get_functiondef('public.scrivi_dettatura(uuid,text,text,jsonb,text,text,integer,integer,text)'::regprocedure), E'\r', '');
  v_ancora text;
  v_quante integer;
begin
  v_ancora := 'v_motivo := nullif(btrim(coalesce(v_azione->>''motivo'', '''')), '''');';
  v_quante := (length(v_def) - length(replace(v_def, v_ancora, ''))) / length(v_ancora);
  if v_quante <> 1 then
    raise exception 'scrivi_dettatura nel database non legge «motivo» una volta sola (%): confronta il corpo vivo prima di applicare.', v_quante;
  end if;
  if position('v_parole_dette' in v_def) > 0 then
    raise exception 'scrivi_dettatura nel database nomina già parole_dette: la migrazione è stata applicata o il corpo è cambiato.';
  end if;
  if position('v_motivo    text;' in v_def) = 0 then
    raise exception 'scrivi_dettatura nel database non ha la dichiarazione attesa di v_motivo: confronta il corpo vivo prima di applicare.';
  end if;

  v_def := replace(v_def, 'v_motivo    text;', 'v_motivo    text;' || E'\n  v_parole_dette text;');
  v_def := replace(v_def, v_ancora, v_ancora || E'\n    v_parole_dette := nullif(btrim(coalesce(v_azione->>''parole_dette'', '''')), '''');');

  v_ancora := 'frase, motivo, stato, alternative, destinazione_libera';
  v_quante := (length(v_def) - length(replace(v_def, v_ancora, ''))) / length(v_ancora);
  if v_quante <> 2 then
    raise exception 'scrivi_dettatura nel database ha % inserimenti attesi nelle azioni, non due: confronta il corpo vivo prima di applicare.', v_quante;
  end if;
  v_def := replace(v_def, v_ancora, 'frase, parole_dette, motivo, stato, alternative, destinazione_libera');

  v_ancora := 'v_frase, v_motivo, ''in_attesa''';
  v_quante := (length(v_def) - length(replace(v_def, v_ancora, ''))) / length(v_ancora);
  if v_quante <> 2 then
    raise exception 'scrivi_dettatura nel database ha % valori attesi delle azioni, non due: confronta il corpo vivo prima di applicare.', v_quante;
  end if;
  v_def := replace(v_def, v_ancora, 'v_frase, v_parole_dette, v_motivo, ''in_attesa''');
  execute v_def;
end $scrivi_parole$;

-- La lettura che alimenta il riscontro subito dopo la dettatura cambia forma:
-- per aggiungere una colonna Postgres pretende di ricrearla e di rimettere i
-- suoi permessi espliciti.
drop function if exists azioni_della_dettatura(uuid);

create function azioni_della_dettatura(p_id uuid)
returns table (
  id uuid, progressivo integer, tipo text, titolo text, natura text, dati jsonb,
  sicuro boolean, frase text, motivo text, stato text, errore text,
  quando timestamptz, domanda text, scelte jsonb, percorso text, corretta_il timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $function$
begin
  if not is_titolare() then
    raise exception 'Le cose dettate sono riservate al titolare.';
  end if;

  return query
  select a.id, a.progressivo, a.tipo,
         (select d.titolo from destinazione_vocale(a.tipo, a.destinazione_libera) d),
         coalesce(t.natura, 'libera'),
         a.dati, a.sicuro, a.frase, a.motivo, a.stato, a.errore, a.creato_il,
         azione_domanda(a.tipo, a.dati, a.stato),
         azione_scelte(a.tipo, a.dati),
         azione_percorso(a.tipo),
         a.corretta_il
    from azioni_dettate a
    left join tipi_azione_vocale t on t.tipo = a.tipo
   where a.dettatura_id = p_id
   order by a.progressivo;
end $function$;

comment on function azioni_della_dettatura(uuid) is
  'Quello che il gestionale ha capito da UNA dettatura, per il riscontro che compare subito dopo aver parlato. Una destinazione che il gestionale non sa ancora eseguire compare lo stesso; dal 14/11/2026 porta anche se il titolare l''ha corretta.';
revoke all on function azioni_della_dettatura(uuid) from public, anon, authenticated;
grant execute on function azioni_della_dettatura(uuid) to authenticated;

-- L'elenco degli appunti ha già gli elementi in JSON: aggiungere la chiave
-- non cambia la firma che il browser legge.
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
         coalesce(jsonb_agg(jsonb_build_object(
           'id', a.id, 'frase', a.frase, 'dati', a.dati, 'sicuro', a.sicuro,
           'motivo', a.motivo, 'alternative', coalesce(a.alternative, '[]'::jsonb),
           'stato', a.stato, 'errore', a.errore, 'detto', d.testo,
           'domanda',  azione_domanda(a.tipo, a.dati, a.stato),
           'scelte',   coalesce(azione_scelte(a.tipo, a.dati), '[]'::jsonb),
           'percorso', azione_percorso(a.tipo),
           'corretta_il', a.corretta_il
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

create or replace function correggi_elemento_appunto(p_id uuid, p_dati jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_a azioni_dettate%rowtype; v_ris jsonb; v_dati jsonb; v_manca text; v_ese boolean;
  v_parole text;
begin
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' correggere quello che ha dettato.';
  end if;

  select * into v_a from azioni_dettate where id = p_id for update;
  if not found then
    raise exception 'Questa riga non c''e'' piu''.';
  end if;
  if v_a.stato not in ('in_attesa', 'fallita') then
    raise exception 'Questa riga non e'' piu'' da approvare: e'' «%».', v_a.stato;
  end if;

  select d.eseguibile into v_ese from destinazione_vocale(v_a.tipo, v_a.destinazione_libera) d;
  select coalesce(nullif(v_a.parole_dette, ''), d.testo) into v_parole
    from dettature d where d.id = v_a.dettatura_id;

  v_dati  := coalesce(p_dati, '{}'::jsonb);
  v_manca := null;
  if v_ese then
    v_ris   := voce_risolvi_dati(v_a.tipo, v_dati);
    v_dati  := v_ris->'dati';
    v_manca := nullif(v_ris->>'manca', '');
  end if;

  update azioni_dettate
     set dati        = v_dati,
         sicuro      = (v_manca is null),
         motivo      = v_manca,
         errore      = null,
         stato       = 'in_attesa',
         corretta_il = coalesce(v_a.corretta_il, now()),
         frase       = case
                         when v_a.corretta_il is not null or v_a.frase like 'Corretto a mano.%' then v_a.frase
                         else 'Corretto a mano. Avevi detto: «' || left(coalesce(v_parole, v_a.frase), 300) || '»'
                       end
   where id = p_id;

  return jsonb_build_object('manca', v_manca, 'dati', v_dati);
end $function$;

revoke all on function correggi_elemento_appunto(uuid, jsonb) from public, anon, authenticated;
grant execute on function correggi_elemento_appunto(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- VERIFICA — dentro una sotto-transazione che si annulla
-- ---------------------------------------------------------------------------
do $verifica$
declare
  v_foto jsonb := foto_righe();
  v_titolare uuid;
  v_ris jsonb;
  v_dett uuid;
  v_az uuid;
  v_frase text;
  v_corretta timestamptz;
  v_letta timestamptz;
begin
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  if v_titolare is null then
    raise exception 'VERIFICA: serve un titolare.';
  end if;
  if has_function_privilege('anon', 'correggi_elemento_appunto(uuid,jsonb)', 'execute')
     or not has_function_privilege('authenticated', 'correggi_elemento_appunto(uuid,jsonb)', 'execute') then
    raise exception 'VERIFICA: la porta per correggere non è come deve.';
  end if;
  if has_function_privilege('anon', 'azioni_della_dettatura(uuid)', 'execute')
     or not has_function_privilege('authenticated', 'azioni_della_dettatura(uuid)', 'execute') then
    raise exception 'VERIFICA: la lettura del riscontro non ha il suo portiere.';
  end if;

  begin
    perform set_config('request.jwt.claims', json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);
    v_ris := registra_dettatura(
      'ZZ dettatura intera da non mostrare',
      jsonb_build_array(jsonb_build_object(
        'tipo', 'promemoria', 'sicuro', true,
        'frase', 'Promemoria: chiama qualcuno',
        'parole_dette', 'chiama il fabbro domani',
        'dati', jsonb_build_object('titolo', 'ZZ chiama il fabbro'))),
      'capita', null, 0, 0, null);
    v_dett := (v_ris->>'dettatura_id')::uuid;
    select id into v_az from azioni_dettate where dettatura_id = v_dett;

    -- 1. Correggere segna chi l'ha fatto e ricorda le parole, non il riassunto.
    perform correggi_elemento_appunto(v_az, jsonb_build_object('titolo', 'ZZ chiama l''idraulico'));
    select frase, corretta_il into v_frase, v_corretta from azioni_dettate where id = v_az;
    if v_corretta is null then
      raise exception 'VERIFICA (1): corretta_il è vuota dopo la correzione.';
    end if;
    if v_frase <> 'Corretto a mano. Avevi detto: «chiama il fabbro domani»' then
      raise exception 'VERIFICA (1): la frase non ricorda le parole dette: «%».', v_frase;
    end if;
    select corretta_il into v_letta from azioni_della_dettatura(v_dett) where id = v_az;
    if v_letta is null then
      raise exception 'VERIFICA (1): il riscontro non porta corretta_il.';
    end if;
    if not coalesce((select elementi->0 ? 'corretta_il' from appunti_da_approvare()
                     where id = (select appunto_id from azioni_dettate where id = v_az)), false) then
      raise exception 'VERIFICA (1): l''elenco degli appunti non porta corretta_il.';
    end if;

    -- 2. Una seconda correzione non raddoppia la frase.
    perform correggi_elemento_appunto(v_az, jsonb_build_object('titolo', 'ZZ chiama il vetraio'));
    select frase into v_frase from azioni_dettate where id = v_az;
    if v_frase <> 'Corretto a mano. Avevi detto: «chiama il fabbro domani»' then
      raise exception 'VERIFICA (2): la seconda correzione ha raddoppiato o cambiato la frase: «%».', v_frase;
    end if;

    raise exception 'ZZ_ANNULLA';
  exception when others then
    if sqlerrm <> 'ZZ_ANNULLA' then raise; end if;
  end;

  perform set_config('request.jwt.claims', null, true);
  perform pretendi_nessun_residuo(v_foto, 'la verifica di «Correggi» che ricorda le parole');
  raise notice 'Fatto: MEMO conserva le parole dette, una correzione è riconoscibile e la seconda non raddoppia la firma. Provato e annullato: zero residui.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20261114000001', 'memo_ricorda_le_parole')
on conflict (version) do nothing;
