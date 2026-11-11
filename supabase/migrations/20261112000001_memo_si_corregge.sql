-- =====================================================================
-- MEMO SI CORREGGE: «CORREGGI» SUGLI APPUNTI
-- 12/11/2026
-- =====================================================================
--
-- Alessio, 11/11, dalla prova di MEMO sul piano: se MEMO capisce male un
-- pezzo (il gruppo, l'importo, la voce), oggi l'unica strada è buttare
-- l'appunto e ridire tutta la frase. Arriva il tasto «Correggi».
--
-- La porta c'era già dal 06/09 (`correggi_elemento_appunto`, 20260906000001):
-- cambia i dati, li ritraduce subito e lascia l'appunto aperto. Mancava una
-- cosa, e la si aggiunge qui:
--
-- 🔴 LA FRASE RESTAVA QUELLA VECCHIA. Il titolo dell'elemento è la frase
--    capita da MEMO («Aggiungi la voce Forno nel gruppo B»): dopo aver
--    corretto il gruppo in C, la scheda avrebbe detto B sopra e C sotto.
--    Una firma con due versioni della stessa cosa è peggio di una sola.
--    Ora la frase diventa «Corretto a mano. Avevi detto: «…»»: si vede che
--    vale quello che è scritto sotto, e si vede cosa si era detto.
--    ⚠️ Una seconda correzione non aggiunge un secondo «Corretto a mano».
--
-- Il resto del corpo è identico a quello del 06/09.
-- Idempotente, con verifica finale annullata (zero residui).
-- =====================================================================

create or replace function correggi_elemento_appunto(p_id uuid, p_dati jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_a azioni_dettate%rowtype; v_ris jsonb; v_dati jsonb; v_manca text; v_ese boolean;
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

  v_dati  := coalesce(p_dati, '{}'::jsonb);
  v_manca := null;
  if v_ese then
    v_ris   := voce_risolvi_dati(v_a.tipo, v_dati);
    v_dati  := v_ris->'dati';
    v_manca := nullif(v_ris->>'manca', '');
  end if;

  update azioni_dettate
     set dati   = v_dati,
         sicuro = (v_manca is null),
         motivo = v_manca,
         errore = null,
         stato  = 'in_attesa',
         -- 12/11/2026: la frase dice che vale quello scritto sotto.
         frase  = case
                    when frase like 'Corretto a mano.%' then frase
                    else 'Corretto a mano. Avevi detto: «' || left(frase, 300) || '»'
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
  v_foto     jsonb := foto_righe();
  v_titolare uuid;
  v_dett     uuid;
  v_az       uuid;
  v_frase    text;
  v_dati     jsonb;
  v_stato    text;
begin
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  if v_titolare is null then
    raise exception 'VERIFICA: serve un titolare.';
  end if;
  if has_function_privilege('anon', 'correggi_elemento_appunto(uuid,jsonb)', 'execute')
     or not has_function_privilege('authenticated', 'correggi_elemento_appunto(uuid,jsonb)', 'execute') then
    raise exception 'VERIFICA: la porta per correggere non è come deve.';
  end if;

  begin  -- <<< la sotto-transazione che verrà annullata
    perform set_config('request.jwt.claims', json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

    insert into dettature (testo, provenienza, esito)
    values ('ZZ verifica correggi', 'app', 'capita')
    returning id into v_dett;
    insert into azioni_dettate (dettatura_id, progressivo, tipo, dati, sicuro, frase, stato)
    values (v_dett, 1, 'promemoria', jsonb_build_object('testo', 'ZZ chiama il fabbro'), true,
            'Ricordami di chiamare il fabbro', 'in_attesa')
    returning id into v_az;

    -- 1. Si corregge: dati nuovi, frase che lo dice, riga ancora da approvare.
    perform correggi_elemento_appunto(v_az, jsonb_build_object('testo', 'ZZ chiama l''idraulico'));
    select frase, dati, stato into v_frase, v_dati, v_stato from azioni_dettate where id = v_az;
    if v_frase <> 'Corretto a mano. Avevi detto: «Ricordami di chiamare il fabbro»' then
      raise exception 'VERIFICA (1): la frase dopo la correzione è «%».', v_frase;
    end if;
    if v_dati->>'testo' <> 'ZZ chiama l''idraulico' or v_stato <> 'in_attesa' then
      raise exception 'VERIFICA (1): dati o stato sbagliati dopo la correzione (%, %).', v_dati, v_stato;
    end if;

    -- 2. Una seconda correzione non raddoppia «Corretto a mano».
    perform correggi_elemento_appunto(v_az, jsonb_build_object('testo', 'ZZ chiama il vetraio'));
    select frase into v_frase from azioni_dettate where id = v_az;
    if v_frase <> 'Corretto a mano. Avevi detto: «Ricordami di chiamare il fabbro»' then
      raise exception 'VERIFICA (2): la seconda correzione ha cambiato la frase in «%».', v_frase;
    end if;

    perform set_config('request.jwt.claims', null, true);
    raise exception 'ZZ_ANNULLA';
  exception when others then
    if sqlerrm <> 'ZZ_ANNULLA' then raise; end if;
  end;

  perform set_config('request.jwt.claims', null, true);
  perform pretendi_nessun_residuo(v_foto, 'la verifica di «Correggi» sugli appunti');

  raise notice 'Fatto: correggendo un elemento di un appunto, la frase dice «Corretto a mano» e ricorda cosa si era detto. Provato e annullato: zero residui.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20261112000001', 'memo_si_corregge')
on conflict (version) do nothing;
