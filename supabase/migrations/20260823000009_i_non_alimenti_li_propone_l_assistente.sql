-- =====================================================================
-- I NON ALIMENTI LI PROPONE L'ASSISTENTE
-- 23/08/2026
-- =====================================================================
-- Coda del blocco 4. Il mandato: *«i non alimenti nascono con la spunta "è
-- un alimento" accesa: detergente, sgrassatore, carta forno, sacchetti
-- sottovuoto finiscono nelle schede incomplete e ci restano per sempre.
-- Falli nascere spenti quando il nome lo dice, o proponilo.»*
--
-- ⚠️ **NON lo indovina il gestionale da una lista di parole.** Sarebbe una
-- regola scritta da noi sulle sue cose, e il giorno che comprasse un
-- prodotto con un nome inatteso finirebbe dalla parte sbagliata **in
-- silenzio** — la stessa ragione per cui le causali dei costi fissi le
-- spunta lui. Lo propone l'assistente, che il nome ce l'ha davanti.
--
-- 🔴 E QUESTA MIGRAZIONE ESISTE PERCHE' LA PROVA DAL VIVO L'HA CHIESTA. Il
-- prompt dell'assistente ora produce il campo `alimentare` — provato: sui
-- tre prodotti mandati, il detergente e' tornato `false` — ma
-- `applica_scheda_prodotto` **non lo scriveva da nessuna parte**. Un campo
-- che il modello produce e nessuno usa e' esattamente il difetto che questo
-- blocco corregge altrove: l'informazione esiste per un istante e viene
-- buttata via.
--
-- ⚠️ SI APPLICA SOLO IN UNA DIREZIONE: quando il modello dice **false**.
-- Marcare «alimento» un prodotto non fa niente (e' gia' il predefinito);
-- marcarlo «non alimento» lo toglie dal Ricettario, ed e' un cambiamento
-- che si vede. Nell'altro verso un errore del modello sarebbe silenzioso.
--
-- ⚠️ E FINISCE FRA I CAMPI DA CONFERMARE, come gli altri: resta scritto che
-- l'ha deciso una macchina finche' Alessio non lo guarda.
-- =====================================================================

do $riscrivi$
declare
  v_def text;
  v_ancora text;
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'applica_scheda_prodotto';
  if v_def is null then
    raise exception 'applica_scheda_prodotto non esiste.';
  end if;

  if position('''alimentare''' in v_def) > 0 then
    raise notice 'Gia'' fatto.';
    return;
  end if;

  -- Il punto d'aggancio: subito dopo il blocco delle fonti, scritto oggi.
  v_ancora := $x$  -- Da dove viene cio' che la macchina ha proposto. Non cambia il valore:
  -- dichiara su cosa si regge.$x$;
  if position(v_ancora in v_def) = 0 then
    -- ⚠️ Non si riscrive alla cieca una funzione che non si e' riconosciuta.
    raise exception 'applica_scheda_prodotto non ha la forma che mi aspettavo: mi fermo.';
  end if;

  v_def := replace(v_def, v_ancora,
    $x$  -- 🔴 «NON E' UN ALIMENTO» (23/08/2026). Solo in questa direzione:
  -- marcarlo alimento non farebbe niente, marcarlo non-alimento lo toglie
  -- dal Ricettario — e quello si vede. E si scrive solo se nessuno ha gia'
  -- deciso il contrario a mano.
  if (p_campi->>'alimentare') = 'false' and v_ing.alimentare
     and not ('alimentare' = any (coalesce(v_ing.campi_da_confermare, '{}'::text[]))) then
    update ingredients set alimentare = false where id = p_ingredient_id;
    v_scritti := v_scritti || 'alimentare'::text;
  end if;

  -- Da dove viene cio' che la macchina ha proposto. Non cambia il valore:
  -- dichiara su cosa si regge.$x$);
  execute v_def;
  raise notice 'applica_scheda_prodotto: l''assistente puo'' proporre «non e'' un alimento».';
end $riscrivi$;


-- ---------------------------------------------------------------------
-- Verifica
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_ente     uuid;
  v_tit      uuid;
  v_pulito   uuid;
  v_alimento uuid;
  v_lapidi   integer;
  v_lapidi_2 integer;
  v_campi    text[];
begin
  select count(*) into v_lapidi from deleted_records;
  select id into v_ente from entities order by created_at limit 1;
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  if v_tit is null then raise exception 'Nessun titolare: impossibile verificare.'; end if;

  insert into ingredients (name, unit, category, entity_id, alimentare)
  values ('ZZ sgrassatore', 'l', 'altro', v_ente, true) returning id into v_pulito;
  insert into ingredients (name, unit, category, entity_id, alimentare)
  values ('ZZ pomodoro', 'kg', 'verdura', v_ente, true) returning id into v_alimento;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);

  -- 1. Il modello dice «non e' un alimento»: la spunta si toglie, e resta
  --    scritto che l'ha detto lui.
  perform applica_scheda_prodotto(v_pulito, jsonb_build_object('alimentare', false));
  if (select alimentare from ingredients where id = v_pulito) then
    raise exception 'La proposta «non e'' un alimento» non e'' stata applicata.';
  end if;
  -- ⚠️ L'elenco si legge in una variabile PRIMA del confronto: scritto
  -- come sottointerrogazione, `= any (select …)` confronta con le RIGHE, e
  -- Postgres prova a leggere 'alimentare' come se fosse un array.
  select coalesce(campi_da_confermare, '{}'::text[]) into v_campi
    from ingredients where id = v_pulito;
  if not ('alimentare' = any (v_campi)) then
    raise exception 'Non risulta che a decidere sia stata la macchina (%).', v_campi;
  end if;

  -- 2. ⚠️ IL VERSO OPPOSTO NON DEVE FARE NIENTE, ed e' il controllo che
  --    conta: se il modello sbagliasse e dicesse «e' un alimento» su un
  --    detersivo gia' marcato, rimetterlo dentro sarebbe silenzioso.
  perform applica_scheda_prodotto(v_pulito, jsonb_build_object('alimentare', true));
  if (select alimentare from ingredients where id = v_pulito) then
    raise exception 'Il modello ha potuto rimettere «e'' un alimento» su un prodotto gia'' escluso.';
  end if;

  -- 3. E su un alimento vero non cambia niente.
  perform applica_scheda_prodotto(v_alimento, jsonb_build_object('alimentare', true));
  if not (select alimentare from ingredients where id = v_alimento) then
    raise exception 'Un alimento vero e'' stato marcato come non alimento.';
  end if;

  perform set_config('request.jwt.claims', null, true);

  delete from ingredients where id in (v_pulito, v_alimento);
  select count(*) into v_lapidi_2 from deleted_records;
  if v_lapidi_2 <> v_lapidi then
    raise exception 'La verifica ha lasciato % lapidi.', v_lapidi_2 - v_lapidi;
  end if;

  raise notice 'Verifica passata: l''assistente puo'' togliere la spunta, non rimetterla, e resta scritto che e'' stato lui.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260823000009', 'i_non_alimenti_li_propone_l_assistente') on conflict (version) do nothing;
