-- «In carta» smette di essere una casella e diventa un riflesso.
--
-- LA DECISIONE E' DI ALESSIO (16/08/2026), e la motivazione e' sua:
-- due posti che dicono la stessa cosa e possono contraddirsi sono la
-- regola 6 del mandato di correzione. Finora `recipes.in_carta` era una
-- casella che si accendeva a mano, e il menu vero e' un'altra cosa
-- (`menu_items` di un menu attivo): un piatto poteva risultare «in carta»
-- e non essere in nessun menu, o stare nel menu con la casella spenta.
-- Nessuno dei due sbagliava, e nessuno dei due lo diceva.
--
-- La strada scartata era «lasciarli distinti e mostrare quando non vanno
-- d'accordo»: costruirebbe un controllo per sorvegliare una contraddizione
-- che cosi' non puo' esistere.
--
-- E' la terza volta che il progetto fa questa scelta, e le altre due sono
-- il precedente: `orders.payment_method` e' un riflesso delle quote di
-- pagamento, `order_tables.conto_aperto` e' un riflesso dello stato del
-- conto. Come quelle, **la scrive solo un trigger, mai l'applicazione**.
--
-- ⚠️ IL VINCOLO CHE ANDAVA SPOSTATO A MONTE — visto disegnando, non dopo.
-- Esiste `recipe_in_carta_requires_pronta`: «in carta» richiede «pronta
-- per carta». Con `in_carta` diventato un riflesso, quel vincolo
-- scatterebbe DENTRO il trigger, nel momento in cui qualcuno aggiunge a un
-- menu attivo un piatto non ancora pronto: un errore di vincolo
-- incomprensibile, sollevato lontano dal gesto che l'ha causato.
-- Il controllo si sposta quindi dove nasce il problema: **si rifiuta di
-- mettere in un menu attivo un piatto non pronto**, con un messaggio che
-- dice quale piatto e cosa fare. Il vincolo resta al suo posto come rete,
-- ma da qui in avanti nessuno dovrebbe piu' arrivarci.
-- E' la stessa forma della quadratura delle quote di pagamento.

-- =====================================================================
-- 1. L'unico posto dove si decide se un piatto e' in carta
-- =====================================================================
--
-- ⚠️ `security definer` NON e' un'abitudine copiata: `menus` e
-- `menu_items` sono titolare-only. Senza, un cuoco che modifica una
-- ricetta farebbe girare il calcolo coi PROPRI permessi, non vedrebbe
-- nessun menu, e il riflesso si spegnerebbe — mettendo fuori carta un
-- piatto che in carta c'e', in silenzio.
create or replace function e_in_carta(p_recipe_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from menu_items mi
      join menus m on m.id = mi.menu_id
     where mi.recipe_id = p_recipe_id
       and m.is_active
  );
$$;

comment on function e_in_carta(uuid) is
  'Un piatto e'' in carta se sta in almeno un menu attivo. E'' l''UNICA definizione: recipes.in_carta e'' un riflesso di questa funzione, scritto da trigger e mai dall''applicazione (decisione di Alessio del 16/08/2026).';

revoke all on function e_in_carta(uuid) from public, anon, authenticated;

-- I nomi dei menu attivi in cui compare un piatto: servono ai messaggi di
-- rifiuto. Un rifiuto che non dice DOVE sta il problema costringe a
-- cercarlo a mano.
create or replace function menu_attivi_con(p_recipe_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select string_agg(distinct m.name, ', ')
    from menu_items mi
    join menus m on m.id = mi.menu_id
   where mi.recipe_id = p_recipe_id and m.is_active;
$$;

revoke all on function menu_attivi_con(uuid) from public, anon, authenticated;

-- =====================================================================
-- 2. SANATORIA: allineare le caselle di oggi al riflesso
-- =====================================================================
do $sanatoria$
declare
  cambiate int;
  elenco   text;
begin
  select count(*), string_agg(name || ' (' || in_carta || ' → ' || e_in_carta(id) || ')', ', ')
    into cambiate, elenco
    from recipes
   where in_carta is distinct from e_in_carta(id);

  update recipes set in_carta = e_in_carta(id)
   where in_carta is distinct from e_in_carta(id);

  -- Ogni sanatoria dichiara quante righe ha toccato, zero compreso
  -- (regola del 16/08): e' il silenzio ad aver ingannato quattro volte.
  raise notice 'Caselle «in carta» allineate al menu: % (%).', cambiate, coalesce(elenco, 'nessuna');
end $sanatoria$;

-- =====================================================================
-- 3. Il riflesso: scritto dal trigger, non dall'applicazione
-- =====================================================================
--
-- Sulla ricetta il valore si RICALCOLA a ogni scrittura invece di essere
-- rifiutato quando arriva sbagliato. La differenza e' voluta: rifiutare
-- vorrebbe dire un errore in faccia a chi ha premuto un pulsante che non
-- esiste piu', mentre qui non c'e' niente da spiegare — la casella dice
-- quello che dice il menu, sempre.
create or replace function riflette_in_carta_sulla_ricetta()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.in_carta := e_in_carta(new.id);

  -- ⚠️ Il controllo spostato a monte, secondo verso: togliere «pronta per
  -- carta» a un piatto che e' in un menu attivo. Senza questo messaggio
  -- fallirebbe il vincolo, che parla di colonne e non di menu.
  if new.in_carta and not new.pronta_per_carta then
    raise exception
      'Non posso togliere «pronta per carta» a «%»: e'' in carta nel menu %. Toglilo prima dal menu.',
      new.name, coalesce(menu_attivi_con(new.id), '(attivo)');
  end if;

  return new;
end $$;

revoke all on function riflette_in_carta_sulla_ricetta() from public, anon, authenticated;

drop trigger if exists trg_recipes_in_carta on recipes;
create trigger trg_recipes_in_carta
  before insert or update on recipes
  for each row execute function riflette_in_carta_sulla_ricetta();

-- Quando cambia il menu, il riflesso si aggiorna sulle ricette toccate.
-- ⚠️ Si scrive solo se il valore cambia davvero: un `update` inutile
-- farebbe avanzare `updated_at` della ricetta per ragioni di menu, e la
-- domanda «quando ho toccato questa ricetta» avrebbe una risposta falsa.
create or replace function ricalcola_in_carta(p_recipe_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_recipe_id is null then return; end if;
  update recipes r
     set in_carta = e_in_carta(r.id)
   where r.id = p_recipe_id
     and r.in_carta is distinct from e_in_carta(r.id);
end $$;

revoke all on function ricalcola_in_carta(uuid) from public, anon, authenticated;

create or replace function riflette_in_carta_dal_menu()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  if tg_table_name = 'menu_items' then
    if tg_op in ('UPDATE', 'DELETE') then perform ricalcola_in_carta(old.recipe_id); end if;
    if tg_op in ('INSERT', 'UPDATE') then perform ricalcola_in_carta(new.recipe_id); end if;
  else
    -- Un menu acceso o spento muove tutti i piatti che contiene.
    for r in select distinct recipe_id from menu_items where menu_id = coalesce(new.id, old.id)
    loop
      perform ricalcola_in_carta(r.recipe_id);
    end loop;
  end if;
  return null;
end $$;

revoke all on function riflette_in_carta_dal_menu() from public, anon, authenticated;

drop trigger if exists trg_menu_items_in_carta on menu_items;
create trigger trg_menu_items_in_carta
  after insert or update or delete on menu_items
  for each row execute function riflette_in_carta_dal_menu();

drop trigger if exists trg_menus_in_carta on menus;
create trigger trg_menus_in_carta
  after update of is_active on menus
  for each row execute function riflette_in_carta_dal_menu();

-- =====================================================================
-- 4. Il rifiuto, dove nasce il problema
-- =====================================================================
--
-- Un piatto non ancora pronto si puo' mettere in un menu che NON e'
-- attivo: e' cosi' che si costruisce la carta della stagione prossima
-- mentre si sta ancora provando. Il rifiuto scatta quando quel menu
-- diventa la carta vera.
create or replace function vieta_non_pronta_in_menu_attivo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  attivo  boolean;
  pronta  boolean;
  nome    text;
begin
  select m.is_active into attivo from menus m where m.id = new.menu_id;
  if not coalesce(attivo, false) then return new; end if;

  select r.pronta_per_carta, r.name into pronta, nome from recipes r where r.id = new.recipe_id;
  if not coalesce(pronta, false) then
    raise exception
      'Non posso mettere «%» in un menu attivo: non e'' ancora segnata «pronta per carta». Segnala pronta dal Ricettario, oppure mettila in un menu non attivo finche'' la stai provando.',
      coalesce(nome, '(senza nome)');
  end if;
  return new;
end $$;

revoke all on function vieta_non_pronta_in_menu_attivo() from public, anon, authenticated;

drop trigger if exists trg_menu_items_solo_pronte on menu_items;
create trigger trg_menu_items_solo_pronte
  before insert or update on menu_items
  for each row execute function vieta_non_pronta_in_menu_attivo();

-- E l'altra porta dello stesso problema: accendere un menu che dentro ha
-- piatti non pronti. Li nomina tutti — dirne uno per volta farebbe
-- scoprire il secondo solo dopo aver risolto il primo.
create or replace function vieta_menu_attivo_con_non_pronte()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  elenco text;
begin
  if new.is_active and not coalesce(old.is_active, false) then
    select string_agg(r.name, ', ' order by r.name) into elenco
      from menu_items mi join recipes r on r.id = mi.recipe_id
     where mi.menu_id = new.id and not r.pronta_per_carta;
    if elenco is not null then
      raise exception
        'Non posso rendere attivo «%»: contiene piatti non ancora pronti per la carta (%). Segnali pronti dal Ricettario, o toglili dal menu.',
        new.name, elenco;
    end if;
  end if;
  return new;
end $$;

revoke all on function vieta_menu_attivo_con_non_pronte() from public, anon, authenticated;

drop trigger if exists trg_menus_solo_pronte on menus;
create trigger trg_menus_solo_pronte
  before update of is_active on menus
  for each row execute function vieta_menu_attivo_con_non_pronte();

comment on column recipes.in_carta is
  'RIFLESSO, non una scelta: vale vero quando il piatto sta in almeno un menu attivo. Lo scrive solo il trigger trg_recipes_in_carta, mai l''applicazione — dal 16/08/2026, decisione di Alessio. Due posti che dicono la stessa cosa e possono contraddirsi sono un difetto, non una comodita''.';

-- =====================================================================
-- VERIFICA
-- =====================================================================
--
-- Tutta la roba di prova nasce qui e muore qui: il perimetro di una prova
-- e' fatto di roba che la prova ha creato (lezione del 16/08).
do $verifica$
declare
  menu_spento uuid;
  menu_acceso uuid;
  pronta      uuid;
  acerba      uuid;
  v           boolean;
  n           int;
  passata     boolean;
begin
  -- ⚠️ Trovato applicando, non leggendo: esiste `uniq_single_active_menu`,
  -- cioe' **il menu attivo e' uno solo**. La verifica ha bisogno di
  -- accendere e spegnere menu suoi, e non puo' farlo se c'e' gia' la carta
  -- vera accesa. Le due strade scartate: spegnere la carta vera e
  -- rimetterla (scriverebbe righe finte nello storico di stato di ogni
  -- piatto, e quello storico e' un registro), oppure saltare i controlli
  -- che servono l'attivazione (cioe' quasi tutti: sarebbe la quinta
  -- ricomparsa della trappola «la verifica salta proprio quando i dati ci
  -- sono»). Quindi si dichiara la condizione e ci si ferma.
  select count(*) into n from menus where is_active;
  if n > 0 then
    raise exception
      'C''e'' gia'' un menu attivo: questa migrazione va applicata prima che esista la carta vera, perche'' la sua verifica ha bisogno di accendere e spegnere un menu suo e il menu attivo puo'' essere uno solo.';
  end if;

  insert into recipes (name, category, recipe_type, portions_yield, pronta_per_carta)
  values ('__VERIFICA__ pronta', 'primo', 'piatto_finito', 4, true) returning id into pronta;
  insert into recipes (name, category, recipe_type, portions_yield, pronta_per_carta)
  values ('__VERIFICA__ acerba', 'primo', 'piatto_finito', 4, false) returning id into acerba;

  insert into menus (name, is_active) values ('__VERIFICA__ menu spento', false) returning id into menu_spento;
  insert into menus (name, is_active) values ('__VERIFICA__ menu acceso', true) returning id into menu_acceso;

  -- 1. Una ricetta nuova non e' in carta: non sta in nessun menu.
  select in_carta into v from recipes where id = pronta;
  if v then raise exception 'Una ricetta appena creata risulta gia'' in carta.'; end if;

  -- 2. Metterla in un menu ATTIVO la accende da sola.
  insert into menu_items (menu_id, recipe_id, category, selling_price)
  values (menu_acceso, pronta, 'primo', 14.00);
  select in_carta into v from recipes where id = pronta;
  if not v then raise exception 'Il piatto e'' nel menu attivo e la casella «in carta» non si e'' accesa.'; end if;

  -- 3. Toglierla la spegne.
  delete from menu_items where menu_id = menu_acceso and recipe_id = pronta;
  select in_carta into v from recipes where id = pronta;
  if v then raise exception 'Il piatto e'' stato tolto dal menu e risulta ancora in carta.'; end if;

  -- 4. In un menu SPENTO non conta: e' la carta della prossima stagione.
  insert into menu_items (menu_id, recipe_id, category, selling_price)
  values (menu_spento, pronta, 'primo', 14.00);
  select in_carta into v from recipes where id = pronta;
  if v then raise exception 'Un menu non attivo ha acceso la casella «in carta».'; end if;

  -- 5. Accendere quel menu accende il riflesso su tutti i suoi piatti.
  --    (Il menu attivo e' uno solo: prima si spegne l'altro.)
  update menus set is_active = false where id = menu_acceso;
  update menus set is_active = true where id = menu_spento;
  select in_carta into v from recipes where id = pronta;
  if not v then raise exception 'Accendendo il menu, il piatto non e'' passato in carta.'; end if;
  update menus set is_active = false where id = menu_spento;
  select in_carta into v from recipes where id = pronta;
  if v then raise exception 'Spegnendo il menu, il piatto e'' rimasto in carta.'; end if;
  update menus set is_active = true where id = menu_acceso;

  -- 6. La casella NON si accende a mano: la scrittura viene ricalcolata,
  --    non ubbidita.
  update recipes set in_carta = true where id = pronta;
  select in_carta into v from recipes where id = pronta;
  if v then raise exception 'La casella «in carta» si e'' lasciata accendere a mano.'; end if;

  -- 7. Il rifiuto a monte: un piatto non pronto in un menu attivo.
  --
  -- ⚠️ Il «e' passata» si segna in una variabile e si controlla FUORI dal
  -- blocco: sollevando l'errore dentro, il gestore lo catturerebbe da se'
  -- (sarebbe anche lui P0001) e la prova passerebbe qualunque cosa
  -- succeda. E' la trappola del 15/08, in piccolo.
  passata := false;
  begin
    insert into menu_items (menu_id, recipe_id, category, selling_price)
    values (menu_acceso, acerba, 'primo', 9.00);
    passata := true;
  exception
    when sqlstate 'P0001' then
      if sqlerrm not like 'Non posso mettere%' then raise; end if;
  end;
  if passata then raise exception 'Un piatto non pronto e'' entrato in un menu attivo.'; end if;

  -- 8. …e in un menu spento invece ci entra: e' cosi' che si prova.
  insert into menu_items (menu_id, recipe_id, category, selling_price)
  values (menu_spento, acerba, 'primo', 9.00);

  -- 9. Accendere quel menu ora e' rifiutato, e dice quale piatto.
  --    Si spegne prima l'altro, altrimenti a rifiutare sarebbe il vincolo
  --    del menu unico e la prova direbbe verde per la ragione sbagliata.
  update menus set is_active = false where id = menu_acceso;
  passata := false;
  begin
    update menus set is_active = true where id = menu_spento;
    passata := true;
  exception
    when sqlstate 'P0001' then
      if sqlerrm not like 'Non posso rendere attivo%' then raise; end if;
  end;
  if passata then raise exception 'Un menu con dentro un piatto non pronto e'' diventato attivo.'; end if;

  -- 10. L'altro verso: togliere «pronta» a un piatto che e' in carta.
  update menus set is_active = true where id = menu_acceso;
  insert into menu_items (menu_id, recipe_id, category, selling_price)
  values (menu_acceso, pronta, 'primo', 14.00);
  passata := false;
  begin
    update recipes set pronta_per_carta = false where id = pronta;
    passata := true;
  exception
    when sqlstate 'P0001' then
      if sqlerrm not like 'Non posso togliere%' then raise; end if;
  end;
  if passata then raise exception 'Si e'' tolta «pronta per carta» a un piatto in carta.'; end if;

  -- 11. Pulizia, e controllo che non resti niente.
  delete from menu_items where menu_id in (menu_spento, menu_acceso);
  delete from menus where id in (menu_spento, menu_acceso);
  delete from recipe_status_history where recipe_id in (pronta, acerba);
  delete from recipes where id in (pronta, acerba);

  select count(*) into n from recipes where name like '__VERIFICA__%';
  if n <> 0 then raise exception 'Restano % ricette di prova.', n; end if;
  select count(*) into n from menus where name like '__VERIFICA__%';
  if n <> 0 then raise exception 'Restano % menu di prova.', n; end if;

  -- 12. E nessuna delle funzioni nuove e' raggiungibile da fuori.
  select count(*) into n
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public'
     and p.proname in ('e_in_carta', 'menu_attivi_con', 'ricalcola_in_carta',
                       'riflette_in_carta_sulla_ricetta', 'riflette_in_carta_dal_menu',
                       'vieta_non_pronta_in_menu_attivo', 'vieta_menu_attivo_con_non_pronte')
     and (has_function_privilege('anon', p.oid, 'execute')
          or has_function_privilege('authenticated', p.oid, 'execute'));
  if n <> 0 then
    raise exception '% funzioni nuove sono rimaste eseguibili dal gestionale o dalla chiave pubblica.', n;
  end if;

  raise notice '«In carta» e'' un riflesso del menu attivo, e i rifiuti stanno dove nasce il problema.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260816000016', 'in_carta_e_un_riflesso')
on conflict (version) do nothing;

select
  (select count(*) from recipes)                                 as ricette,
  (select count(*) from recipes where in_carta)                  as in_carta,
  (select count(*) from menus where is_active)                   as menu_attivi,
  (select count(*) from recipes where in_carta <> e_in_carta(id)) as caselle_che_mentono;
