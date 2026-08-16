-- Le piccolezze del mandato di correzione, la parte che vive nel database.
--
-- Due cose, senza niente in comune se non il posto dove stanno.
--
-- 1. UNDICI POLICY SCRITTE PER IL RUOLO SBAGLIATO.
--
-- Il mandato ne nominava cinque; guardando col connettore sono undici.
-- Tutte dicono la stessa cosa — `using (is_titolare())` — ma sono
-- intestate al ruolo `public` invece che ad `authenticated` come tutte le
-- altre policy del progetto.
--
-- ⚠️ NON e' un buco, ed e' giusto dirlo prima: `public` comprende `anon`,
-- ma dentro la policy c'e' `is_titolare()`, che per un anonimo e' falso.
-- Nessuno ha mai potuto leggere niente. E' incoerenza, non fuga.
--
-- Allora perche' toccarle. Perche' una regola che vale «quasi sempre» non
-- si puo' controllare: finche' undici policy sono intestate a `public`,
-- nessuno puo' scrivere la prova «nessuna policy di questo schema e'
-- aperta al ruolo pubblico» — e la prova e' l'unica cosa che accorgerebbe
-- della dodicesima, quella scritta male davvero. Si sistema l'eccezione
-- per poter affermare la regola.
--
-- ⚠️ Perche' TUTTE e undici e non le cinque del mandato: un elenco scritto
-- a mano invecchia in silenzio (lezione del 16/08 sul guardiano che era
-- una fotografia). Qui il guardiano e' una proprieta' dello schema —
-- ZERO policy intestate a `public` — che resta vera domani.
--
-- 2. LA RESA DI UNA PREPARAZIONE NON PUO' ESSERE ZERO.
--
-- Il vincolo esistente pretendeva che ci fosse (`is not null`), non che
-- fosse un numero utile. Con resa zero, il costo di quella preparazione
-- si calcola dividendo per zero: il calcolo non fallisce, restituisce un
-- BUCO — e il costo della preparazione sparisce da ogni ricetta che la
-- usa, senza nessun errore, perche' non e' quella la ricetta che si stava
-- modificando. La schermata ora lo impedisce (commit di oggi), ma il
-- posto dove questa regola deve vivere e' qui: chi scrive dritto in
-- tabella non passa dalla schermata.

-- =====================================================================
-- 1. Le policy, riscritte per `authenticated`
-- =====================================================================
--
-- Si ricreano una per una nominandole: `alter policy ... to authenticated`
-- non esiste per cambiare il ruolo in modo idempotente su ogni versione,
-- e un drop+create dichiarato e' piu' leggibile di un giro dinamico che
-- indovina la forma di ognuna. Le undici sono identiche in tutto tranne
-- il comando: dieci `for all`, una `for select`.
do $$
declare
  t text;
begin
  foreach t in array array[
    'anomalie_scarico', 'anticipazioni_socio', 'conteggi_cassa',
    'impostazioni_tesoreria', 'ordini_fornitore', 'ordini_fornitore_righe',
    'produzioni', 'regole_deducibilita', 'scadenze_previste', 'tag_anticipazioni'
  ]
  loop
    execute format('drop policy if exists %I on %I', t || '_titolare', t);
    execute format(
      'create policy %I on %I for all to authenticated
         using ((select is_titolare())) with check ((select is_titolare()))',
      t || '_titolare', t);
  end loop;
end $$;

-- L'unica in sola lettura: gli scarichi si scrivono solo dalle funzioni
-- del corridoio, che girano come proprietarie. Ricrearla `for all`
-- aprirebbe una porta che oggi non c'e'.
drop policy if exists stock_consumptions_titolare_select on stock_consumptions;
create policy stock_consumptions_titolare_select on stock_consumptions
  for select to authenticated using ((select is_titolare()));

-- =====================================================================
-- 2. La resa di una preparazione: presente E maggiore di zero
-- =====================================================================
--
-- ⚠️ Prima di stringere si guarda chi violerebbe. Non si sana d'ufficio:
-- una resa sbagliata la sa solo chi ha fatto quella preparazione, e un
-- numero inventato dalla migrazione sarebbe un costo falso conservato per
-- sempre. Se ce ne fossero, la migrazione si ferma e li nomina.
do $sanatoria$
declare
  quante int;
  elenco text;
begin
  select count(*), string_agg(name, ', ')
    into quante, elenco
    from recipes
   where recipe_type = 'preparazione' and coalesce(yield_quantity, 0) <= 0;

  -- Ogni sanatoria dichiara quante righe ha toccato, anche quando sono
  -- zero (regola del 16/08): e' il silenzio ad aver ingannato, non il
  -- numero.
  raise notice 'Preparazioni con resa nulla o zero da correggere a mano: % (%).',
    quante, coalesce(elenco, 'nessuna');

  if quante > 0 then
    raise exception
      'Ci sono % preparazioni con resa mancante o zero (%): il loro costo e'' gia'' un buco in tutte le ricette che le usano. Vanno corrette dal Ricettario prima di applicare questa migrazione — nessun numero puo'' essere indovinato da qui.',
      quante, elenco;
  end if;
end $sanatoria$;

alter table recipes drop constraint if exists preparazione_requires_yield;
alter table recipes add constraint preparazione_requires_yield check (
  recipe_type <> 'preparazione'
  or (yield_quantity is not null and yield_quantity > 0 and yield_unit is not null)
);

comment on column recipes.yield_quantity is
  'Quanto ne esce da una dose di questa preparazione. Obbligatoria e MAGGIORE DI ZERO: e'' il divisore del costo, e con zero il costo della preparazione diventa un buco che sparisce da ogni ricetta che la usa, senza nessun errore.';

-- =====================================================================
-- VERIFICA
-- =====================================================================
do $verifica$
declare
  n int;
  elenco text;
  ok boolean;
begin
  -- 1. La proprieta' che questa migrazione rende affermabile: nessuna
  --    policy di public e' intestata al ruolo pubblico.
  select count(*), string_agg(tablename || '.' || policyname, ', ')
    into n, elenco
    from pg_policies
   where schemaname = 'public' and 'public' = any(roles);
  if n <> 0 then
    raise exception 'Ci sono ancora % policy intestate al ruolo pubblico: %.', n, elenco;
  end if;

  -- 2. E le undici sono ancora li', non sparite: un drop senza create
  --    passerebbe il controllo qui sopra e lascerebbe la tabella aperta a
  --    chiunque sia autenticato (nessuna policy = nessun permesso, ma su
  --    una tabella con force rls la differenza si vede solo provando).
  select count(*) into n
    from pg_policies
   where schemaname = 'public'
     and tablename in (
       'anomalie_scarico', 'anticipazioni_socio', 'conteggi_cassa',
       'impostazioni_tesoreria', 'ordini_fornitore', 'ordini_fornitore_righe',
       'produzioni', 'regole_deducibilita', 'scadenze_previste',
       'tag_anticipazioni', 'stock_consumptions')
     and roles::text = '{authenticated}'
     and qual like '%is_titolare%';
  if n <> 11 then
    raise exception 'Le policy riscritte per authenticated sono %, non 11.', n;
  end if;

  -- 3. La sola in lettura e' rimasta in lettura.
  select cmd = 'SELECT' into ok
    from pg_policies
   where schemaname = 'public' and policyname = 'stock_consumptions_titolare_select';
  if not coalesce(ok, false) then
    raise exception 'stock_consumptions_titolare_select non e'' piu'' una policy di sola lettura.';
  end if;

  -- 4. Il vincolo sulla resa rifiuta davvero lo zero. Si prova, non si
  --    legge: un vincolo scritto e non esercitato e' una promessa.
  begin
    insert into recipes (name, category, recipe_type, portions_yield, yield_quantity, yield_unit)
    values ('__VERIFICA__ resa zero', 'primo', 'preparazione', 1, 0, 'kg');
    raise exception 'Il vincolo ha lasciato passare una preparazione con resa zero.';
  exception
    when check_violation then null;
  end;

  -- 5. …e continua a rifiutare la resa mancante, che era la regola vecchia.
  begin
    insert into recipes (name, category, recipe_type, portions_yield, yield_quantity, yield_unit)
    values ('__VERIFICA__ resa assente', 'primo', 'preparazione', 1, null, 'kg');
    raise exception 'Il vincolo ha lasciato passare una preparazione senza resa.';
  exception
    when check_violation then null;
  end;

  -- 6. E una resa vera passa: un vincolo che rifiuta tutto non e' un
  --    vincolo, e' un guasto.
  insert into recipes (name, category, recipe_type, portions_yield, yield_quantity, yield_unit)
  values ('__VERIFICA__ resa buona', 'primo', 'preparazione', 1, 2.5, 'kg');
  delete from recipes where name = '__VERIFICA__ resa buona';

  -- 7. Niente residui: la verifica non lascia ricette di prova in giro.
  select count(*) into n from recipes where name like '__VERIFICA__%';
  if n <> 0 then
    raise exception 'La verifica ha lasciato % ricette di prova.', n;
  end if;

  raise notice 'Policy intestate al ruolo pubblico: 0. Resa di una preparazione: obbligatoria e maggiore di zero.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260816000015', 'le_policy_e_la_resa')
on conflict (version) do nothing;

select
  (select count(*) from pg_policies where schemaname = 'public' and 'public' = any(roles)) as policy_al_ruolo_pubblico,
  (select count(*) from pg_policies where schemaname = 'public')                            as policy_in_tutto,
  (select count(*) from recipes where recipe_type = 'preparazione')                         as preparazioni;
