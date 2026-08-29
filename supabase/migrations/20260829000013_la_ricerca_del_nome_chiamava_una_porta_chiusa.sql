-- =====================================================================
-- LA RICERCA DEL NOME CHIAMAVA UNA PORTA CHIUSA
-- 29/08/2026 — coda del Blocco 2 (punto 2c) del mandato del 29/08 (sera)
-- =====================================================================
-- 🔴 DIFETTO MIO, TROVATO GUARDANDO LA SCHERMATA e non rileggendo il
-- codice, e non poteva essere trovato in nessun altro modo.
--
-- `ingrediente_con_questo_nome` (nata poche ore fa con la
-- `20260829000012`) è `security invoker`: gira coi permessi di chi la
-- chiama. Dentro chiama `nome_ingrediente_chiave`, che dal **13/08/2026**
-- è chiusa a tutti — `revoke all … from public, anon, authenticated` —
-- perché quel giorno l'elenco delle funzioni raggiungibili dall'esterno
-- era cresciuto in silenzio e si decise di richiuderlo.
--
-- Risultato: dal browser, col token di un utente vero,
--
--     42501 — permission denied for function nome_ingrediente_chiave
--
-- ⚠️ **DA `psql` FUNZIONAVA BENISSIMO**, ed è il punto: `psql` gira come
-- `postgres`, che i permessi ce li ha tutti. La verifica dentro la
-- migrazione era **verde**, e continuerebbe a esserlo. È la lezione del
-- 16/08 in una forma nuova: *ogni difetto che vive nei permessi si prova
-- solo dal client, col token di un utente vero* — e stavolta a trovarlo è
-- stato aprire la scheda e scriverci dentro un nome.
--
-- ---------------------------------------------------------------------
-- QUALE DELLE TRE CURE, e perché non le altre due
-- ---------------------------------------------------------------------
-- La regola del 27/08 dice che davanti a una funzione che non passa serve
-- chiedersi **CHI la chiama**, e che le cure sono tre:
--
--   (a) *nessun utente la chiama* → si chiude la porta. Non è il caso:
--       la chiama la scheda del prodotto.
--   (b) *solo il titolare* → `security definer` con un portiere che
--       RIFIUTA. **È questo il caso.**
--   (c) *identità diverse, una è un servizio* → si toglie
--       `security definer` e decide la RLS. Non è il caso: qui la RLS di
--       `ingredients` è titolare-only, e lo staff non apre quella scheda.
--
-- ⚠️ **E NON si riapre `nome_ingrediente_chiave` a `authenticated`.**
-- Sarebbe la strada più corta e rovescerebbe una decisione del 13/08
-- senza che nessuno l'abbia chiesto: quell'elenco si è chiuso apposta, e
-- una prova automatica lo sorveglia dal quel giorno.
--
-- ⚠️ **E il portiere RIFIUTA, non filtra**: un filtro nella `where`
-- risponderebbe «nessun omonimo» a chi non deve vedere, cioè una
-- rassicurazione falsa proprio dove serve un avvertimento. È il difetto
-- trovato il 27/08 su `caparre_trattenute`.
--
-- ⚠️ **NON RISCRIVO LA `20260829000012`**: è già applicata sul progetto di
-- prova, e una migrazione applicata non si riscrive mai (regola di
-- Alessio, 23/08). Il file racconta cosa è successo quel giorno; questo
-- racconta cosa è successo due ore dopo.
-- =====================================================================

create or replace function ingrediente_con_questo_nome(p_nome text)
returns table (id uuid, name text, alimentare boolean)
language plpgsql
stable
security definer
set search_path = public
as $corpo$
begin
  -- IL PORTIERE RIFIUTA. Gli ingredienti sono titolare-only (lì vivono i
  -- prezzi d'acquisto), e questa risposta dice quali nomi esistono: chi
  -- non può vedere l'elenco non deve poterlo sondare un nome per volta.
  if not (select is_titolare()) then
    raise exception 'Solo il titolare puo'' cercare fra gli ingredienti.';
  end if;

  return query
    select i.id, i.name, i.alimentare
      from ingredients i
     where i.preparazione_id is null
       and nome_ingrediente_chiave(i.name) = nome_ingrediente_chiave(p_nome)
     order by i.name
     limit 5;
end;
$corpo$;

comment on function ingrediente_con_questo_nome(text) is
  'Esiste gia'' un ingrediente generico con questo nome? Serve alla scheda per dirlo PRIMA di salvare, invece di far nascere un doppione in silenzio. security definer col portiere: l''aiuto che normalizza il nome e'' chiuso dal 13/08, e chi non e'' il titolare riceve un rifiuto invece di un elenco vuoto.';

revoke all on function ingrediente_con_questo_nome(text) from public, anon, authenticated;
grant execute on function ingrediente_con_questo_nome(text) to authenticated;

-- =====================================================================
-- VERIFICA
-- =====================================================================
do $verifica$
declare
  v_foto   jsonb := foto_righe();
  v_ent    uuid;
  v_id     uuid;
  v_miei   uuid[] := array[]::uuid[];
  v_quanti integer;
  v_utente uuid;
  v_rifiuta boolean;
begin
  -- (0) LA SOSTITUZIONE HA ATTECCHITO? Si guarda il corpo vivo.
  if pg_get_functiondef('ingrediente_con_questo_nome(text)'::regprocedure)
       not like '%is_titolare%' then
    raise exception 'ingrediente_con_questo_nome non ha il portiere.';
  end if;
  if not (select p.prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname = 'ingrediente_con_questo_nome') then
    raise exception 'ingrediente_con_questo_nome non e'' security definer: dal browser risponderebbe ancora 42501.';
  end if;

  select id into v_ent from entities order by created_at limit 1;
  if v_ent is null then
    raise exception 'Non c''e'' nessuna societa'': la verifica non ha un perimetro suo.';
  end if;

  insert into ingredients (entity_id, name, category, unit, alimentare)
  values (v_ent, 'VERIFICA-29AGO nome doppio', 'altro', 'kg', true)
  returning id into v_id;
  v_miei := v_miei || v_id;

  -- (1) DA TITOLARE si trova, e si trova anche scritto diverso.
  select ur.user_id into v_utente from user_roles ur where ur.role = 'titolare' limit 1;
  if v_utente is null then
    raise exception 'Non c''e'' nessun titolare: la verifica non puo'' impersonare nessuno.';
  end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_utente, 'role', 'authenticated')::text, true);

  select count(*) into v_quanti from ingrediente_con_questo_nome('  VERIFICA-29AGO   NOME DOPPIO ');
  if v_quanti <> 1 then
    raise exception 'Da titolare il nome gia'' preso non si trova (trovati %).', v_quanti;
  end if;

  -- (2) 🔴 DA STAFF SI RIFIUTA, e NON risponde un elenco vuoto: una
  --     schermata vuota e' una rassicurazione falsa.
  select ur.user_id into v_utente from user_roles ur where ur.role <> 'titolare' limit 1;
  if v_utente is null then
    raise exception 'Non c''e'' nessuno staff: il portiere non si puo'' mettere alla prova.';
  end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_utente, 'role', 'authenticated')::text, true);

  v_rifiuta := false;
  begin
    perform * from ingrediente_con_questo_nome('VERIFICA-29AGO nome doppio');
  exception when sqlstate 'P0001' then
    v_rifiuta := true;
  end;
  if not v_rifiuta then
    raise exception 'Lo staff puo'' sondare i nomi degli ingredienti.';
  end if;

  perform set_config('request.jwt.claims', null, true);
  delete from ingredients where id = any(v_miei);

  perform pretendi_nessun_residuo(v_foto, 'la verifica del portiere sulla ricerca dei nomi');
  raise notice 'La ricerca del nome risponde al titolare e rifiuta gli altri.';
end
$verifica$;

insert into applied_migrations (version, name)
values ('20260829000013', 'la_ricerca_del_nome_chiamava_una_porta_chiusa') on conflict (version) do nothing;
