-- ============================================================================
-- LE CATEGORIE LE DECIDE LA RLS — 27/08/2026
-- ============================================================================
--
-- ✅ QUARTA VOLTA IN UN GIORNO che `tests/app/permessi.test.js` diventa rossa
--    da sola, e stavolta su **`categorie_proponibili`**, nata un'ora prima
--    con la `20260827000026`. L'avevo scritta `security definer` per abitudine.
--
-- ----------------------------------------------------------------------------
-- NON LE SERVE, ED È IL PUNTO
-- ----------------------------------------------------------------------------
-- `categorie_ingrediente` ha già la **lettura aperta a tutto lo staff**: sono
-- etichette per riempire un menu, e non dicono niente di economico — la stessa
-- ragione per cui `cash_causali` è leggibile da chi chiude un conto in sala.
--
-- Quindi `security definer` qui non aggiunge una barriera: aggiunge una
-- **seconda serratura da tenere allineata alla prima**. Fatta `security
-- invoker`, la funzione non decide niente: decide la RLS della tabella, che è
-- l'unico posto dove quella regola vive. È la scelta già fatta il 12/08 per
-- `documenti_per_domanda`, e la ragione scritta allora vale identica.
--
-- ⚠️ E NON È UN'ESENZIONE DICHIARATA NELLA RETE: si potevano prendere due
--    strade — dichiararla fra le eccezioni della prova, o togliere il motivo
--    per cui compare. La seconda è migliore perché **fa sparire il caso**
--    invece di spiegarlo: un elenco di eccezioni cresce, un caso che non
--    esiste no.
--
-- ----------------------------------------------------------------------------
-- E UNA TERZA RETE HA CHIESTO DI DICHIARARLO
-- ----------------------------------------------------------------------------
-- `npm run prova:migra` si è **rifiutato di applicare** questa migrazione:
-- ha visto che riscrive una funzione perdendo per strada il suo
-- `security definer`, ed è precisamente il difetto del 18/08 — riscrivere
-- una funzione annullando in silenzio ciò che era stato aggiunto dopo.
-- Qui si toglie APPOSTA, quindi si dichiara. *Una rete che si può zittire
-- solo scrivendo perché è una rete che funziona.*
--
-- rete-guardie: categorie_proponibili — il portiere si toglie apposta: la lettura la decide la RLS di `categorie_ingrediente`, che ha già il select aperto allo staff, e una seconda serratura andrebbe tenuta allineata alla prima
-- ============================================================================

create or replace function categorie_proponibili()
returns table(codice text, nome text, ordine integer)
language sql
stable
-- ⚠️ `security invoker` (il predefinito, scritto per essere letto): la
--    lettura la decide la RLS di `categorie_ingrediente`, non questa
--    funzione. Vedi l'intestazione.
set search_path to 'public'
as $$
  select c.codice, c.nome, c.ordine
    from categorie_ingrediente c
   where c.attiva
   order by c.ordine, c.nome;
$$;

revoke all on function categorie_proponibili() from public, anon, authenticated;
grant execute on function categorie_proponibili() to authenticated;

comment on function categorie_proponibili() is
  'Le categorie da mettere in un elenco: solo le ACCESE, nell''ordine di '
  'Alessio. Le spente restano legali per gli ingredienti che le portano, ma '
  'non si propongono piu''. ⚠️ `security invoker`: chi puo'' leggerle lo decide '
  'la RLS della tabella, che e'' l''unico posto dove quella regola vive. '
  'Metterci un portiere qui sarebbe una seconda serratura da tenere '
  'allineata alla prima.';

-- ============================================================================
-- VERIFICA
-- ============================================================================
do $verifica$
declare
  v_foto   jsonb;
  v_tit    uuid;
  v_staff  uuid;
  v_n      integer;
  v_elenco text[];
begin
  v_foto := foto_righe();

  select user_id into v_tit   from user_roles where role = 'titolare' limit 1;
  select user_id into v_staff from user_roles where role <> 'titolare' limit 1;
  if v_tit is null then
    raise exception 'Verifica impossibile: nessun titolare configurato';
  end if;

  -- 1. Non scavalca piu' la RLS
  select count(*) into v_n
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'categorie_proponibili' and p.prosecdef;
  if v_n <> 0 then
    raise exception 'La funzione delle categorie scavalca ancora la RLS';
  end if;

  -- 2. La rete non ha piu' niente da dire
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);
  select coalesce(array_agg(nome), '{}') into v_elenco
    from funzioni_senza_portiere() where nome = 'categorie_proponibili';
  if array_length(v_elenco, 1) is not null then
    raise exception 'La rete dei permessi la segnala ancora';
  end if;

  -- 3. 🔴 E LO STAFF LE VEDE ANCORA, che e' il controllo che conta: togliere
  --    `security definer` e' anche il modo piu' facile di far sparire un
  --    elenco sotto le mani di chi e' in cucina, e sarebbe un menu vuoto —
  --    cioe' «non ci sono categorie», che e' falso.
  if v_staff is not null then
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
    select count(*) into v_n from categorie_proponibili();
    if v_n < 15 then
      raise exception 'Lo staff vede solo % categorie: l''elenco si e'' svuotato', v_n;
    end if;
  end if;

  perform set_config('request.jwt.claims', null, true);
  perform pretendi_nessun_residuo(v_foto, 'le categorie le decide la RLS');

  raise notice 'Le categorie le decide la RLS: la funzione non scavalca piu'' niente, la rete tace, e lo staff continua a vederle tutte.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260827000029', 'le_categorie_le_decide_la_rls') on conflict (version) do nothing;
