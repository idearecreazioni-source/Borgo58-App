-- =====================================================================
-- 20261025000005 — lo stesso prodotto non si segna due volte in lista
-- =====================================================================
-- 🔴 MISURATO SULLA PROVA (25/10/2026), due giri delle stesse tre frasi:
--    «aggiungi il latte alla lista della spesa», «mettine due litri»,
--    «aggiungi anche il pane». In un giro il modello ha messo
--    "sostituisce" e il latte di prima si e' annullato; nell'altro NO, e in
--    attesa sono rimasti «latte» e «latte, 2 l». La stessa frase, due
--    risposte: affidare il doppione al solo modello vuol dire averlo una
--    volta su due.
--
-- ⚠️ LA REGOLA DETERMINISTICA, accanto a quella del modello (che resta):
--    una riga nuova di LISTA DELLA SPESA o di SPESA SPICCIOLA prende il
--    posto delle righe ancora in attesa che dicono lo stesso prodotto
--    nella stessa lista. Lo stesso prodotto due volte nella stessa lista
--    non e' mai quello che Alessio vuole: o e' una correzione («mettine
--    due litri»), o e' una ripetizione. In tutti e due i casi resta
--    l'ultima, che e' quella detta con piu' informazioni.
--    · solo righe `in_attesa` (una cosa gia' scritta non si tocca);
--    · solo della stessa persona e degli ultimi 15 minuti, come nella 004;
--    · «stesso prodotto» = stesso tipo, stesso nome detto (`nome_libero`,
--      minuscolo e senza spazi ai bordi) e stessa lista nominata. Due
--      oli diversi hanno due nomi diversi e restano due righe.
--    ⚠️ Non si estende agli altri tipi: due pagamenti da trenta euro nella
--    stessa sera possono essere due pagamenti veri.
--
-- Corpo della 004 (da questo ramo, non applicata in produzione), con in
-- piu' il secondo modo di trovare le righe da sostituire.

create or replace function voce_sostituisci_azioni(p_esito jsonb, p_azioni jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_det     uuid := nullif(p_esito->>'dettatura_id', '')::uuid;
  v_chi     uuid;
  v_ids     uuid[];
  v_uguali  uuid[];
  v_appunti uuid[];
  v_n       integer := 0;
begin
  if v_det is null then
    return p_esito;
  end if;

  -- (a) quelle che il modello ha nominato. ⚠️ Gli identificativi arrivano
  --     dal modello: quelli che non sono un uuid si lasciano cadere.
  select array_agg(distinct s::uuid) into v_ids
    from jsonb_array_elements(coalesce(p_azioni, '[]'::jsonb)) e,
         jsonb_array_elements_text(case when jsonb_typeof(e->'sostituisce') = 'array'
                                        then e->'sostituisce' else '[]'::jsonb end) s
   where s ~ '^[0-9a-fA-F-]{36}$';

  select creato_da into v_chi from dettature where id = v_det;

  -- (b) lo stesso prodotto nella stessa lista, letto dalle righe appena
  --     scritte e non da `p_azioni`: e' la forma che il database ha
  --     conservato, la stessa con cui si confrontano le righe vecchie.
  select array_agg(distinct v.id) into v_uguali
    from azioni_dettate n
    join azioni_dettate v
      on v.tipo = n.tipo
     and v.stato = 'in_attesa'
     and v.dettatura_id <> v_det
     and lower(btrim(v.dati->>'nome_libero')) = lower(btrim(n.dati->>'nome_libero'))
     and lower(btrim(coalesce(v.dati->>'lista', ''))) = lower(btrim(coalesce(n.dati->>'lista', '')))
   where n.dettatura_id = v_det
     and n.stato = 'in_attesa'
     and n.tipo in ('lista_spesa', 'spesa_spicciola')
     and nullif(btrim(n.dati->>'nome_libero'), '') is not null;

  v_ids := array(select distinct x from unnest(coalesce(v_ids, '{}') || coalesce(v_uguali, '{}')) x);

  if cardinality(v_ids) = 0 then
    return p_esito || jsonb_build_object('sostituite', 0);
  end if;

  with tolte as (
    update azioni_dettate a
       set stato  = 'annullata',
           motivo = 'Sostituita da quello che hai detto subito dopo.'
      from dettature d
     where a.dettatura_id = d.id
       and a.id = any(v_ids)
       and a.stato = 'in_attesa'
       and a.dettatura_id <> v_det
       and d.creato_da = v_chi
       and d.creato_il > now() - interval '15 minutes'
    returning a.appunto_id
  )
  select count(*), array_agg(distinct appunto_id) into v_n, v_appunti from tolte;

  -- Un appunto rimasto senza righe vive si chiude.
  if v_appunti is not null then
    update appunti_vocali p
       set stato = 'scartato', chiuso_il = now(), chiuso_da = v_chi
     where p.id = any(v_appunti)
       and p.stato = 'aperto'
       and not exists (select 1 from azioni_dettate a
                        where a.appunto_id = p.id and a.stato in ('in_attesa', 'fallita'));
  end if;

  return p_esito || jsonb_build_object('sostituite', coalesce(v_n, 0));
end $function$;

comment on function voce_sostituisci_azioni(jsonb, jsonb) is
  'Annulla le righe ancora in attesa che la frase appena registrata sostituisce: quelle che il modello nomina, e quelle di lista della spesa o spesa spicciola che dicono lo stesso prodotto nella stessa lista. Solo della stessa persona, solo degli ultimi 15 minuti. La chiamano solo le due porte di registrazione.';

revoke all on function voce_sostituisci_azioni(jsonb, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- La verifica
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_foto     jsonb := foto_righe();
  v_titolare uuid;
  v_a        jsonb;
  v_b        jsonb;
  v_az_a     uuid;
  v_az_p     uuid;
  v_stato    text;
  v_latte    jsonb := jsonb_build_object(
                'tipo', 'lista_spesa', 'sicuro', true, 'frase', 'ZZ verifica: latte',
                'dati', jsonb_build_object('nome_libero', 'ZZ Latte di verifica',
                                           'lista', 'lista della spesa'));
  v_pane     jsonb := jsonb_build_object(
                'tipo', 'lista_spesa', 'sicuro', true, 'frase', 'ZZ verifica: pane',
                'dati', jsonb_build_object('nome_libero', 'ZZ pane di verifica',
                                           'lista', 'lista della spesa'));
begin
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  if v_titolare is null then
    raise exception 'VERIFICA: serve un titolare per questa verifica.';
  end if;

  if has_function_privilege('authenticated', 'voce_sostituisci_azioni(jsonb, jsonb)', 'execute')
     or has_function_privilege('anon', 'voce_sostituisci_azioni(jsonb, jsonb)', 'execute') then
    raise exception 'VERIFICA: la sostituzione delle righe e'' chiamabile da fuori.';
  end if;

  begin
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

    v_a := registra_dettatura('ZZ verifica: aggiungi il latte e il pane',
             jsonb_build_array(v_latte, v_pane), 'capita');
    select id into v_az_a from azioni_dettate
     where dettatura_id = (v_a->>'dettatura_id')::uuid and dati->>'nome_libero' = 'ZZ Latte di verifica';
    select id into v_az_p from azioni_dettate
     where dettatura_id = (v_a->>'dettatura_id')::uuid and dati->>'nome_libero' = 'ZZ pane di verifica';
    if v_az_a is null or v_az_p is null then
      raise exception 'VERIFICA: le righe di prova non sono nate.';
    end if;

    -- (1) Lo stesso prodotto, SENZA che il modello dica "sostituisce", e
    --     scritto con maiuscole e spazi diversi: la riga vecchia se ne va,
    --     il pane (un altro prodotto) resta.
    v_b := registra_dettatura('ZZ verifica: mettine due litri',
             jsonb_build_array(v_latte || jsonb_build_object(
               'frase', 'ZZ verifica: latte, 2 l',
               'dati', jsonb_build_object('nome_libero', '  zz latte di VERIFICA ',
                                          'lista', 'Lista della spesa', 'quantita', 2, 'unita', 'l'))),
             'capita');
    select stato into v_stato from azioni_dettate where id = v_az_a;
    if v_stato is distinct from 'annullata' or (v_b->>'sostituite')::int is distinct from 1 then
      raise exception 'VERIFICA (1): il latte di prima e'' % e le sostituite sono %.', v_stato, v_b->>'sostituite';
    end if;
    select stato into v_stato from azioni_dettate where id = v_az_p;
    if v_stato is distinct from 'in_attesa' then
      raise exception 'VERIFICA (1): il pane, un altro prodotto, e'' diventato %.', v_stato;
    end if;

    -- (2) Lo stesso nome in un'ALTRA lista non si tocca.
    v_b := registra_dettatura('ZZ verifica: pane anche nella spicciola',
             jsonb_build_array(v_pane || jsonb_build_object('dati',
               jsonb_build_object('nome_libero', 'ZZ pane di verifica', 'lista', 'spesa spicciola'))),
             'capita');
    select stato into v_stato from azioni_dettate where id = v_az_p;
    if v_stato is distinct from 'in_attesa' or (v_b->>'sostituite')::int is distinct from 0 then
      raise exception 'VERIFICA (2): un''altra lista ha toccato il pane (% , sostituite %).', v_stato, v_b->>'sostituite';
    end if;

    -- (3) Una riga di un'ora fa NON si sostituisce nemmeno per nome.
    update dettature set creato_il = now() - interval '1 hour' where id = (v_a->>'dettatura_id')::uuid;
    v_b := registra_dettatura('ZZ verifica: ancora il pane', jsonb_build_array(v_pane), 'capita');
    select stato into v_stato from azioni_dettate where id = v_az_p;
    if v_stato is distinct from 'in_attesa' or (v_b->>'sostituite')::int is distinct from 0 then
      raise exception 'VERIFICA (3): una riga di un''ora fa e'' diventata % (sostituite %).', v_stato, v_b->>'sostituite';
    end if;

    raise exception 'ZZ_ANNULLA';
  exception when others then
    if sqlerrm <> 'ZZ_ANNULLA' then raise; end if;
  end;

  perform set_config('request.jwt.claims', null, true);
  perform pretendi_nessun_residuo(v_foto, 'la verifica dello stesso prodotto detto due volte');

  raise notice 'Fatto: lo stesso prodotto detto di nuovo nella stessa lista prende il posto della riga di prima, anche se il modello non lo dice. Provato e annullato: zero residui.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20261025000005', 'lo_stesso_prodotto_non_si_segna_due_volte')
on conflict (version) do nothing;
