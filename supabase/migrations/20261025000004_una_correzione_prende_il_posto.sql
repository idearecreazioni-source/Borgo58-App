-- =====================================================================
-- 20261025000004 — una correzione detta a voce PRENDE IL POSTO di quella di prima
-- =====================================================================
-- 🔴 IL DIFETTO, misurato sul progetto di prova il 25/10/2026 con la
--    migrazione precedente appena applicata: «aggiungi il latte alla lista
--    della spesa» e poi «mettine due litri» lasciavano nello stesso appunto
--    DUE righe in attesa — «latte» e «latte, 2 l». MEMO aveva capito
--    benissimo che la seconda frase completava la prima, ma non aveva modo
--    di dirlo: approvando l'appunto per intero, il latte sarebbe entrato in
--    lista due volte. Nessun errore da nessuna parte.
--
-- La cura: la memoria breve consegna anche QUALI righe sono ancora in
-- attesa (col loro identificativo), il modello dice quale riga la frase di
-- adesso sostituisce, e la registrazione la annulla NELLA STESSA
-- TRANSAZIONE in cui scrive quella nuova.
--
-- ⚠️ TRE LIMITI, tutti scritti nella funzione e non nel prompt, perché un
--    identificativo sbagliato del modello non deve poter toccare niente:
--      · solo righe ancora `in_attesa` (una cosa già scritta non si annulla
--        da qui: si annulla dalla sua schermata, che sa cosa stornare);
--      · solo righe dette DALLA STESSA PERSONA che sta parlando adesso;
--      · solo righe degli ultimi quindici minuti (la memoria ne mostra dieci:
--        cinque di margine per chi ci mette un po' a rispondere).
-- ⚠️ E se un appunto resta senza nessuna riga viva, si chiude come
--    «scartato»: un appunto vuoto in elenco si legge «c'è ancora qualcosa
--    da guardare», e non c'è.

-- ---------------------------------------------------------------------
-- 1. La memoria breve dice anche quali righe sono ancora in attesa
-- ---------------------------------------------------------------------
-- Stessa funzione della migrazione precedente, con in più `in_attesa`.
create or replace function voce_scambi_recenti()
returns jsonb
language sql
stable
security invoker
set search_path = public
as $fn$
  select coalesce(jsonb_agg(x order by t), '[]'::jsonb)
    from (
      select d.creato_il as t,
             jsonb_build_object(
               'quando', to_char(d.creato_il at time zone 'Europe/Rome', 'HH24:MI'),
               'detto',  d.testo,
               'capito', coalesce(
                 (select string_agg(a.frase, ' · ' order by a.progressivo)
                    from azioni_dettate a where a.dettatura_id = d.id),
                 d.messaggio,
                 'Non ho segnato niente.'),
               -- 25/10/2026: le righe che si possono ancora sostituire.
               'in_attesa', coalesce(
                 (select jsonb_agg(jsonb_build_object('id', a.id, 'frase', a.frase)
                                   order by a.progressivo)
                    from azioni_dettate a
                   where a.dettatura_id = d.id and a.stato = 'in_attesa'),
                 '[]'::jsonb)) as x
        from dettature d
       where d.creato_da = auth.uid()
         and d.creato_il > now() - interval '10 minutes'
         and d.esito <> 'tetto'
       order by d.creato_il desc
       limit 6
    ) s
$fn$;

revoke all on function voce_scambi_recenti() from public, anon, authenticated;
grant execute on function voce_scambi_recenti() to authenticated;

-- ---------------------------------------------------------------------
-- 2. La sostituzione, scritta in un posto solo per le due porte
-- ---------------------------------------------------------------------
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
  v_appunti uuid[];
  v_n       integer := 0;
begin
  if v_det is null then
    return p_esito;
  end if;

  -- ⚠️ Gli identificativi arrivano dal modello: quelli che non sono un uuid
  --    si lasciano cadere invece di far fallire la frase intera.
  select array_agg(distinct s::uuid) into v_ids
    from jsonb_array_elements(coalesce(p_azioni, '[]'::jsonb)) e,
         jsonb_array_elements_text(case when jsonb_typeof(e->'sostituisce') = 'array'
                                        then e->'sostituisce' else '[]'::jsonb end) s
   where s ~ '^[0-9a-fA-F-]{36}$';

  if v_ids is null then
    return p_esito || jsonb_build_object('sostituite', 0);
  end if;

  select creato_da into v_chi from dettature where id = v_det;

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
  'Annulla le righe ancora in attesa che la frase appena registrata dichiara di sostituire (solo della stessa persona, solo degli ultimi 15 minuti). La chiamano solo le due porte di registrazione.';

revoke all on function voce_sostituisci_azioni(jsonb, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. Le due porte la chiamano. Corpi della migrazione precedente,
--    cambia solo il `return`.
-- ---------------------------------------------------------------------
create or replace function registra_dettatura(
  p_testo               text,
  p_azioni              jsonb   default '[]'::jsonb,
  p_esito               text    default 'capita',
  p_modello             text    default null,
  p_token_domanda       integer default 0,
  p_token_risposta      integer default 0,
  p_messaggio           text    default null,
  p_token_cache_scritti integer default 0,
  p_token_cache_letti   integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' usare i comandi vocali.';
  end if;
  return voce_sostituisci_azioni(
    aggiungi_cache_dettatura(
      scrivi_dettatura(auth.uid(), p_testo, 'app', p_azioni, p_esito,
                       p_modello, p_token_domanda, p_token_risposta, p_messaggio),
      p_modello, p_token_cache_scritti, p_token_cache_letti),
    p_azioni);
end $function$;

revoke all on function registra_dettatura(text, jsonb, text, text, integer, integer, text, integer, integer)
  from public, anon, authenticated;
grant execute on function registra_dettatura(text, jsonb, text, text, integer, integer, text, integer, integer)
  to authenticated;

create or replace function registra_dettatura_da_chiave(
  p_chiave              text,
  p_testo               text,
  p_azioni              jsonb   default '[]'::jsonb,
  p_esito               text    default 'capita',
  p_modello             text    default null,
  p_token_domanda       integer default 0,
  p_token_risposta      integer default 0,
  p_messaggio           text    default null,
  p_token_cache_scritti integer default 0,
  p_token_cache_letti   integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_riga chiavi_voce%rowtype;
  v_lim  record;
begin
  select * into v_riga from chiavi_voce
   where impronta = encode(extensions.digest(p_chiave, 'sha256'), 'hex') and revocata_il is null;
  if not found then
    -- ⚠️ Stessa identica frase dell'altra porta: due rifiuti diversi
    --    direbbero a chi prova che una delle due chiavi esiste.
    raise exception 'Questa chiave non vale.';
  end if;

  -- 🔴 IL FRENO CHE MANCAVA. Prima di scrivere, non dopo.
  select * into v_lim from voce_limite_dettature(v_riga.utente_id);
  if v_lim.superato then
    raise exception '%', v_lim.frase;
  end if;

  -- 🔴 LA TRACCIA CHE MANCAVA. Una dettatura entrata senza lasciare segno
  --    sulla chiave e' una dettatura che nessuno puo' contare quando il
  --    numero cresce e Alessio non ha parlato.
  update chiavi_voce
     set ultimo_uso = now(),
         usi        = usi + 1,
         scritture  = coalesce(scritture, 0) + 1
   where id = v_riga.id;

  -- 🔴 Da qui in poi si e' lui, per questa transazione soltanto: e' cio'
  --    che permette alle funzioni sottostanti di fare i loro controlli sul
  --    ruolo vero invece che su un anonimo.
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_riga.utente_id, 'role', 'authenticated')::text, true);

  if not is_titolare() then
    raise exception 'La chiave appartiene a un accesso che non e'' il titolare.';
  end if;

  return voce_sostituisci_azioni(
    aggiungi_cache_dettatura(
      scrivi_dettatura(v_riga.utente_id, p_testo, 'scorciatoia', p_azioni, p_esito,
                       p_modello, p_token_domanda, p_token_risposta, p_messaggio),
      p_modello, p_token_cache_scritti, p_token_cache_letti),
    p_azioni);
end $function$;

revoke all on function registra_dettatura_da_chiave(text, text, jsonb, text, text, integer, integer, text, integer, integer)
  from public, anon, authenticated;
grant execute on function registra_dettatura_da_chiave(text, text, jsonb, text, text, integer, integer, text, integer, integer)
  to anon, authenticated;

-- ---------------------------------------------------------------------
-- 4. La verifica
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_foto     jsonb := foto_righe();
  v_titolare uuid;
  v_a        jsonb;
  v_b        jsonb;
  v_c        jsonb;
  v_az_a     uuid;
  v_az_c     uuid;
  v_scambi   jsonb;
  v_stato    text;
  v_app      uuid;
  v_az       jsonb := jsonb_build_array(jsonb_build_object(
                'tipo', 'lista_spesa', 'sicuro', true, 'frase', 'ZZ verifica: latte',
                'dati', jsonb_build_object('nome_libero', 'ZZ latte di verifica',
                                           'lista', 'lista della spesa')));
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

    -- (1) Una frase con una riga in attesa: la memoria la consegna col suo
    --     identificativo.
    v_a := registra_dettatura('ZZ verifica: aggiungi il latte', v_az, 'capita');
    select id into v_az_a from azioni_dettate where dettatura_id = (v_a->>'dettatura_id')::uuid;
    if v_az_a is null then
      raise exception 'VERIFICA (1): la riga di prova non e'' nata.';
    end if;
    v_scambi := voce_scambi_recenti();
    if not exists (select 1 from jsonb_array_elements(v_scambi) e,
                                 jsonb_array_elements(e->'in_attesa') r
                    where r->>'id' = v_az_a::text) then
      raise exception 'VERIFICA (1): la memoria non consegna la riga in attesa: %.', v_scambi;
    end if;

    -- (2) La frase dopo la sostituisce: quella vecchia e' annullata, quella
    --     nuova resta in attesa, e la risposta lo conta.
    v_b := registra_dettatura('ZZ verifica: mettine due litri',
             jsonb_build_array((v_az->0) || jsonb_build_object(
               'frase', 'ZZ verifica: latte, 2 l', 'sostituisce', jsonb_build_array(v_az_a, 'non-un-uuid'))),
             'capita');
    select stato into v_stato from azioni_dettate where id = v_az_a;
    if v_stato is distinct from 'annullata' or (v_b->>'sostituite')::int is distinct from 1 then
      raise exception 'VERIFICA (2): la riga vecchia e'' % e le sostituite sono %.', v_stato, v_b->>'sostituite';
    end if;
    if not exists (select 1 from azioni_dettate
                    where dettatura_id = (v_b->>'dettatura_id')::uuid and stato = 'in_attesa') then
      raise exception 'VERIFICA (2): la riga nuova non e'' in attesa.';
    end if;

    -- (3) Un appunto rimasto senza righe vive non resta aperto.
    select appunto_id into v_app from azioni_dettate where id = v_az_a;
    if v_app is not null
       and (select stato from appunti_vocali where id = v_app) = 'aperto'
       and not exists (select 1 from azioni_dettate
                        where appunto_id = v_app and stato in ('in_attesa', 'fallita')) then
      raise exception 'VERIFICA (3): un appunto senza righe vive e'' rimasto aperto.';
    end if;

    -- (4) Una riga di un'ora fa NON si sostituisce, anche se il modello la nomina.
    v_c := registra_dettatura('ZZ verifica: aggiungi il pane', v_az, 'capita');
    select id into v_az_c from azioni_dettate where dettatura_id = (v_c->>'dettatura_id')::uuid;
    update dettature set creato_il = now() - interval '1 hour' where id = (v_c->>'dettatura_id')::uuid;
    v_b := registra_dettatura('ZZ verifica: no, il pane integrale',
             jsonb_build_array((v_az->0) || jsonb_build_object('sostituisce', jsonb_build_array(v_az_c))),
             'capita');
    select stato into v_stato from azioni_dettate where id = v_az_c;
    if v_stato is distinct from 'in_attesa' or (v_b->>'sostituite')::int is distinct from 0 then
      raise exception 'VERIFICA (4): una riga di un''ora fa e'' diventata %.', v_stato;
    end if;

    -- (5) Senza «sostituisce» non si tocca niente.
    v_b := registra_dettatura('ZZ verifica: e le uova', v_az, 'capita');
    if (v_b->>'sostituite')::int is distinct from 0 then
      raise exception 'VERIFICA (5): senza sostituzioni ne risultano %.', v_b->>'sostituite';
    end if;

    raise exception 'ZZ_ANNULLA';
  exception when others then
    if sqlerrm <> 'ZZ_ANNULLA' then raise; end if;
  end;

  perform set_config('request.jwt.claims', null, true);
  perform pretendi_nessun_residuo(v_foto, 'la verifica delle correzioni dette a voce');

  raise notice 'Fatto: una correzione detta a voce prende il posto della riga di prima, solo se recente, in attesa e della stessa persona. Provato e annullato: zero residui.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20261025000004', 'una_correzione_prende_il_posto')
on conflict (version) do nothing;
