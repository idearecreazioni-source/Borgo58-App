-- =====================================================================
-- UNA RIGA SOLA PER PRODOTTO NELLA LISTA DELLA SPESA
-- 23/08/2026
-- =====================================================================
-- Blocco 3 del mandato accodato del 23/08.
--
-- ---------------------------------------------------------------------
-- IL SINTOMO, e la causa MISURATA (non dedotta)
-- ---------------------------------------------------------------------
-- In `/magazzino/lista-spesa` e in `/magazzino/ordini` comparivano due
-- volte gli stessi prodotti — Agnello, Arancia tarocco, Bietola da coste —
-- con quantita' identica e stessa data.
--
-- **Prima ipotesi, smentita**: un join che moltiplica. Misurato:
-- `v_stock_levels` ha 129 righe e 129 ingredienti distinti, quindi non
-- duplica niente, e i `left join` di `lista_spesa()` sono tutti su chiavi
-- uniche.
--
-- 🔴 **LA CAUSA VERA: le righe sono DUE davvero, e sono nate a 160
-- MICROSECONDI DI DISTANZA.**
--
--   Agnello         | da_comprare | 14:45:18.516942
--   Agnello         | da_comprare | 14:45:18.517102
--   Arancia tarocco | da_comprare | 14:45:18.516942
--   Arancia tarocco | ordinata    | 14:45:18.517102
--
-- E' una **corsa**: `add_below_threshold_items()` e' partita due volte
-- quasi insieme. Si difendeva con un `not exists`, ma **due transazioni
-- concorrenti non si vedono a vicenda** — entrambe leggono «non c'e'
-- nessuna riga», entrambe inseriscono.
--
-- ⚠️ DA DOVE partono le due chiamate: la lista lancia il controllo del
-- sotto-soglia **all'apertura della pagina** (decisione del 13/08: «una
-- lista che dice la verita' solo a chi sa che va aggiornata non e' una
-- lista»), e `StrictMode` di React esegue gli effetti **due volte** in
-- sviluppo. ⚠️ **Ma non e' un problema del solo sviluppo**: due tablet
-- aperti insieme, o un doppio tocco, fanno esattamente la stessa cosa in
-- servizio.
--
-- ---------------------------------------------------------------------
-- LA CURA: un vincolo, non un filtro nella schermata
-- ---------------------------------------------------------------------
-- Deduplicare in lettura avrebbe **nascosto il sintomo** lasciando i
-- doppioni nei dati — e il mandato lo vieta esplicitamente. La regola del
-- progetto e' un'altra: *gli invarianti sono vincoli del database, non
-- controlli nella schermata*, e *si previene invece di segnalare* — la
-- stessa forma con cui il 13/08 e' stato reso impossibile il doppio
-- pagamento di una fattura, e con cui vive «un tavolo, un conto aperto».
--
-- ⚠️ **SOLO LE RIGHE AUTOMATICHE.** Se Alessio scrive due volte lo stesso
-- prodotto a mano, e' una sua scelta legittima e nessuno gliela vieta: il
-- vincolo vale su `source = 'soglia_minima'`, cioe' su cio' che mette il
-- gestionale.
--
-- ⚠️ E il perimetro e' «non ancora acquistata», lo stesso del `not exists`
-- che gia' c'era: una riga chiusa e' storia, e due acquisti dello stesso
-- prodotto in giorni diversi sono due fatti veri.
--
-- ---------------------------------------------------------------------
-- LA SANATORIA, e quale riga sopravvive
-- ---------------------------------------------------------------------
-- Si tiene quella con lo **stato piu' avanzato** e, a parita', la piu'
-- vecchia. ⚠️ Non e' un dettaglio: una riga `ordinata` rappresenta un
-- ordine **gia' mandato a un fornitore**, e cancellarla perderebbe un
-- fatto avvenuto nel mondo. Fra due `da_comprare` identiche non c'e'
-- niente da perdere.
--
-- ⚠️ La sanatoria DICHIARA quante righe ha tolto (regola del 16/08): uno
-- zero non e' un errore — vuol dire «su questo database non ce n'erano» —
-- ma va detto, perche' e' il silenzio ad aver ingannato quattro volte.
-- =====================================================================

do $sanatoria$
declare
  v_tolte int;
begin
  with ordinate as (
    select id,
           row_number() over (
             partition by ingredient_id
             order by case status
                        when 'ordinata' then 0
                        when 'da_comprare' then 1
                        else 2
                      end,
                      created_at
           ) as posto
      from shopping_list_items
     where source = 'soglia_minima'
       and status <> 'acquistato'
       and ingredient_id is not null
  )
  delete from shopping_list_items s
   using ordinate o
   where s.id = o.id and o.posto > 1;

  get diagnostics v_tolte = row_count;
  raise notice 'Doppioni automatici tolti dalla lista della spesa: %', v_tolte;
end $sanatoria$;

-- ---------------------------------------------------------------------
-- Il vincolo: due righe automatiche aperte per lo stesso prodotto non
-- possono piu' esistere, nemmeno scritte nello stesso millesimo di secondo.
-- ---------------------------------------------------------------------
create unique index if not exists uniq_lista_spesa_soglia_aperta
  on shopping_list_items (ingredient_id)
  where source = 'soglia_minima' and status <> 'acquistato';

comment on index uniq_lista_spesa_soglia_aperta is
  'Un prodotto ha UNA sola riga automatica aperta nella lista della spesa (23/08/2026). ⚠️ Esiste perché il controllo del sotto-soglia parte all''apertura della pagina e due chiamate concorrenti non si vedono a vicenda: il `not exists` nella funzione le lasciava passare entrambe, e nascevano due righe a 160 microsecondi di distanza. Le righe scritte a mano non sono toccate: se Alessio ne scrive due è una sua scelta.';

-- ---------------------------------------------------------------------
-- E la funzione non deve piu' rompersi quando il vincolo la ferma
-- ---------------------------------------------------------------------
-- 🔴 Il corpo e' preso VIVO dal database, non dal file che l'ha creata.
--
-- ⚠️ `on conflict do nothing` e non un errore: la seconda chiamata di una
-- corsa **non ha sbagliato niente** — ha solo perso. Farle dare un errore
-- vorrebbe dire mostrare ad Alessio un guasto che non esiste, all'apertura
-- di una schermata che lui non ha nemmeno toccato.
--
-- ⚠️ E il `not exists` RESTA: senza, ogni apertura proverebbe a inserire
-- tutti i sotto-soglia e li farebbe scartare uno per uno dal vincolo — il
-- conteggio restituito direbbe zero e la schermata non saprebbe piu'
-- distinguere «non c'era niente da aggiungere» da «ci ho provato e non e'
-- entrato niente».
create or replace function add_below_threshold_items()
returns integer
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_count integer;
begin
  insert into shopping_list_items (ingredient_id, quantity_needed, unit, source, supplier_id)
  select
    v.ingredient_id,
    greatest(v.stock_minimum_threshold - v.current_quantity, 0),
    v.unit,
    'soglia_minima',
    -- Il fornitore abituale, quello scritto sulla scheda del prodotto.
    -- Senza, la riga nasce muta: la lista la mostra e nessun ordine la
    -- puo' raccogliere.
    i.supplier_id
  from v_stock_levels v
  join ingredients i on i.id = v.ingredient_id
  where v.below_threshold
    and not exists (
      select 1 from shopping_list_items sli
      where sli.ingredient_id = v.ingredient_id and sli.status <> 'acquistato'
    )
  on conflict do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$function$;

revoke all on function add_below_threshold_items() from public, anon, authenticated;
grant execute on function add_below_threshold_items() to authenticated;

-- =====================================================================
-- VERIFICA
-- =====================================================================
do $verifica$
declare
  v_tit    uuid;
  v_ente   uuid;
  v_ing    uuid;
  v_righe  int;
  v_prod   int;
  v_n      int;
  v_lapidi int;
  v_lapidi2 int;
  v_passato boolean;
begin
  select count(*) into v_lapidi from deleted_records;
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  select id into v_ente from entities order by created_at limit 1;
  if v_tit is null then raise exception 'Nessun titolare: impossibile verificare.'; end if;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);

  -- ===== 1. 🔴 LA PROPRIETA': tante righe quanti prodotti. E' esattamente
  -- =====    il controllo che il mandato chiede — «il numero di righe deve
  -- =====    corrispondere ai prodotti realmente sotto soglia».
  select count(*), count(distinct l.ingredient_id) into v_righe, v_prod
    from lista_spesa() l where l.ingredient_id is not null;

  if v_righe <> v_prod then
    raise exception 'La lista mostra % righe per % prodotti: ci sono ancora doppioni.',
      v_righe, v_prod;
  end if;

  perform set_config('request.jwt.claims', null, true);

  -- ===== 2. E il vincolo REGGE davvero, provato sul posto: due righe
  -- =====    automatiche aperte per lo stesso prodotto vengono respinte.
  insert into ingredients (entity_id, name, category, unit, current_price)
  values (v_ente, 'ZZ prova doppione lista', 'altro', 'kg', 1)
  returning id into v_ing;

  insert into shopping_list_items (ingredient_id, quantity_needed, unit, source)
  values (v_ing, 5, 'kg', 'soglia_minima');

  begin
    insert into shopping_list_items (ingredient_id, quantity_needed, unit, source)
    values (v_ing, 5, 'kg', 'soglia_minima');
    v_passato := true;
  exception when unique_violation then
    v_passato := false;
  end;

  if v_passato then
    raise exception 'Il vincolo non impedisce due righe automatiche aperte per lo stesso prodotto.';
  end if;

  -- ===== 3. ⚠️ MA LE RIGHE A MANO SI POSSONO RIPETERE: se Alessio scrive
  -- =====    due volte lo stesso prodotto e' una sua scelta, e un vincolo
  -- =====    che gliela vieta e' una regola scritta sulle sue cose.
  insert into shopping_list_items (ingredient_id, quantity_needed, unit, source)
  values (v_ing, 2, 'kg', 'manuale');
  insert into shopping_list_items (ingredient_id, quantity_needed, unit, source)
  values (v_ing, 3, 'kg', 'manuale');

  select count(*) into v_n from shopping_list_items
   where ingredient_id = v_ing and source = 'manuale';
  if v_n <> 2 then
    raise exception 'Il vincolo ha impedito due righe scritte a mano: % invece di 2.', v_n;
  end if;

  -- ===== 4. E una riga gia' ACQUISTATA non blocca quella nuova: due
  -- =====    acquisti dello stesso prodotto in giorni diversi sono due
  -- =====    fatti veri.
  update shopping_list_items set status = 'acquistato'
   where ingredient_id = v_ing and source = 'soglia_minima';

  insert into shopping_list_items (ingredient_id, quantity_needed, unit, source)
  values (v_ing, 7, 'kg', 'soglia_minima');

  select count(*) into v_n from shopping_list_items
   where ingredient_id = v_ing and source = 'soglia_minima';
  if v_n <> 2 then
    raise exception 'Una riga gia'' acquistata impedisce di riaggiungere il prodotto.';
  end if;

  -- ===== pulizia
  delete from shopping_list_items where ingredient_id = v_ing;
  delete from ingredients where id = v_ing;

  select count(*) into v_lapidi2 from deleted_records;
  if v_lapidi2 <> v_lapidi then
    raise exception 'La verifica ha lasciato % lapidi nel registro.', v_lapidi2 - v_lapidi;
  end if;

  raise notice 'Verifica passata: una riga per prodotto, e le righe scritte a mano restano libere.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260823000018', 'una_riga_sola_per_prodotto') on conflict (version) do nothing;
