-- =====================================================================
-- Le comande: una riga inviata non sparisce, una mai inviata non si paga
-- =====================================================================
-- Blocco 4 del mandato di correzione (16/08/2026). Due difetti opposti
-- sulla stessa tabella.
--
-- 4.1 — UNA RIGA GIA' MANDATA IN CUCINA SI CANCELLAVA SENZA TRACCIA.
-- `sendDraftItems` aveva la sua rete (`is sent_at null`, messa nell'audit
-- dell'08/08 quando si scopri' che spediva le righe del collega);
-- `removeDraftItem` e `updateDraftItemQuantity` no. Quindi da qualsiasi
-- tablet si poteva cancellare o cambiare una riga **gia' uscita dalla
-- stampante della cucina**, e **anche a conto chiuso**. Le policy di
-- `order_items` sono aperte a tutto lo staff — giustamente, e' la sala —
-- e la tabella era fuori dal registro delle cancellazioni. In sala con due
-- tablet e' una gara che si perde in silenzio: il piatto e' in cottura, la
-- riga non esiste piu', e il conto non lo dice.
--
-- ⚠️ La cura NON e' vietare di correggersi: e' **separare cancellare da
-- stornare**. Una riga inviata si annulla (`voided_at` + motivo), e lo
-- storno resta visibile. Quello che sparisce senza lasciare niente e'
-- l'unica cosa vietata.
--
-- 4.2 — LE BOZZE MAI INVIATE ENTRAVANO NEL CONTO E SCARICAVANO IL
-- MAGAZZINO. Deciso da Alessio che va cambiato. Una riga scritta e mai
-- mandata in cucina non e' un piatto servito: non si addebita e non toglie
-- niente dalla cella. ⚠️ **E chi chiude deve VEDERLO dichiarato**, non
-- scoprirlo dal totale: una riga che sparisce dal conto senza una frase e'
-- indistinguibile da un piatto dimenticato.
--
-- ⚠️ CIO' CHE QUESTA MIGRAZIONE CAMBIA NEL PASSATO — guardato col
-- connettore PRIMA di scriverla, non supposto (e stavolta davvero, dopo
-- l'errore dichiarato nel riepilogo del Blocco 3):
--   · 3 conti in tutto: 2 annullati **senza nessuna riga**, 1 chiuso
--     («Divano 3», 15/08) con **1 riga sola, gia' inviata**, valore 5,00.
--   · Righe mai inviate su conti chiusi: **ZERO**.
-- Quindi nessun totale gia' scritto cambia. Se ce ne fosse stato uno, la
-- cura giusta non sarebbe stata questa: un conto chiuso e' una fotografia,
-- e cambiargli il totale mesi dopo e' il difetto che questo progetto
-- chiama «un numero che cambia da solo nella notte».
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Il registro delle cancellazioni copre anche le comande
-- ---------------------------------------------------------------------
-- ⚠️ Da sola non basta e non e' la cura: una riga inviata **non deve**
-- potersi cancellare, e il registro serve per il caso che resta — una
-- riga in bozza tolta per sbaglio, e le cancellazioni che avvengono per
-- cascata quando sparisce un conto.
do $$
begin
  if to_regclass('public.order_items') is null then
    raise exception 'order_items non esiste: elenco da correggere.';
  end if;
  drop trigger if exists trg_log_delete on order_items;
  create trigger trg_log_delete before delete on order_items
    for each row execute function log_deleted_record();
end $$;

-- ---------------------------------------------------------------------
-- 2. Il vincolo: cosa si puo' toccare, e quando
-- ---------------------------------------------------------------------
create or replace function vieta_modifica_riga_servita()
returns trigger
language plpgsql
security definer
set search_path = public
as $trigger$
declare
  v_stato   order_status;
  v_riga    order_items%rowtype;
  v_nome    text;
begin
  v_riga := case when tg_op = 'DELETE' then old else new end;

  -- ⚠️ SE IL CONTO STESSO STA SPARENDO, le sue righe se ne vanno con lui.
  -- In una cancellazione a cascata la riga del conto e' gia' via, quindi
  -- questa `select` non trova niente. Senza questo ramo un conto con
  -- anche una sola riga inviata non sarebbe piu' cancellabile da nessuno,
  -- per sempre — e la prima a restarne prigioniera sarebbe la pulizia dei
  -- dati di collaudo che Alessio deve fare prima della prima fattura
  -- vera. La regola che si difende e' «un conto non dice una cosa e le
  -- sue righe un'altra»: qui il conto non dice piu' niente.
  -- Il registro delle cancellazioni conserva comunque ogni riga.
  select status into v_stato from orders where id = v_riga.order_id;
  if not found then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  v_nome := coalesce(
    (select r.name from recipes r where r.id = old.recipe_id),
    nullif(trim(old.free_text_name), ''),
    'questa riga');

  -- ⚠️ IL CONTO CHIUSO VIENE PRIMA DI TUTTO. Un conto chiuso e' una
  -- fotografia: cambiarne una riga vuol dire cambiare un totale su cui
  -- qualcuno ha gia' incassato, e domani un incasso su cui il registratore
  -- telematico si confrontera'.
  if v_stato is distinct from 'aperto' then
    if tg_op = 'DELETE' then
      raise exception
        'Questo conto e'' gia'' chiuso: «%» non si puo'' togliere. Il totale su cui hai incassato non deve cambiare dopo.', v_nome;
    end if;
    if new.quantity is distinct from old.quantity
       or new.unit_price is distinct from old.unit_price
       or new.recipe_id is distinct from old.recipe_id
       or new.free_text_name is distinct from old.free_text_name
       or new.voided_at is distinct from old.voided_at
       or new.sent_at is distinct from old.sent_at then
      raise exception
        'Questo conto e'' gia'' chiuso: «%» non si puo'' piu'' cambiare.', v_nome;
    end if;
    -- Restano ammessi la nota e «ticket stampato»: non spostano un euro.
    return new;
  end if;

  -- Conto aperto, riga MAI INVIATA: si fa tutto. E' la bozza che si sta
  -- ancora componendo.
  if old.sent_at is null then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  -- Conto aperto, riga GIA' INVIATA.
  if tg_op = 'DELETE' then
    raise exception
      '«%» e'' gia'' andata in cucina: non si cancella, si storna — cosi'' resta scritto che era stata ordinata e poi tolta.', v_nome;
  end if;

  if new.quantity is distinct from old.quantity
     or new.unit_price is distinct from old.unit_price
     or new.recipe_id is distinct from old.recipe_id
     or new.free_text_name is distinct from old.free_text_name
     or new.destination is distinct from old.destination
     or new.order_id is distinct from old.order_id then
    raise exception
      '«%» e'' gia'' andata in cucina: per cambiarla si storna questa e se ne aggiunge una nuova, altrimenti il ticket di carta e il conto dicono due cose diverse.', v_nome;
  end if;

  -- ⚠️ E l'ora di invio non si riscrive: e' il momento in cui il ticket e'
  -- uscito dalla stampante, non un campo di lavoro.
  if new.sent_at is distinct from old.sent_at then
    raise exception 'L''ora di invio in cucina di «%» non si cambia.', v_nome;
  end if;

  -- Ammessi: lo storno (`voided_at` + motivo), «ticket stampato»
  -- (`prepared_at`) e la nota — che resta modificabile dopo l'invio per
  -- scelta dichiarata (la riga e' la fonte del ticket ristampato).
  return new;
end;
$trigger$;

comment on function vieta_modifica_riga_servita is
  'Una riga di comanda gia'' mandata in cucina non si cancella e non si cambia nei numeri: si STORNA, e lo storno si vede (16/08/2026, Blocco 4). Su un conto chiuso non si tocca piu'' niente che sposti un euro. Restano ammessi la nota e «ticket stampato». Prima si poteva cancellare da qualsiasi tablet, senza traccia, anche a conto chiuso.';

revoke all on function vieta_modifica_riga_servita() from public, anon, authenticated;

drop trigger if exists trg_riga_servita on order_items;
create trigger trg_riga_servita
  before update or delete on order_items
  for each row execute function vieta_modifica_riga_servita();

-- ---------------------------------------------------------------------
-- 3. Il conto non addebita ciò che non è mai uscito dalla comanda
-- ---------------------------------------------------------------------
-- ⚠️ DROP e non `create or replace`: Postgres rifiuta di cambiare le
-- colonne restituite da una funzione esistente. Due conseguenze da
-- guardare, e sono state guardate:
--   1. **I sette chiamanti sono tutti `plpgsql`**, quindi nessuno tiene
--      una dipendenza rigida che farebbe fallire il drop. Sei la usano in
--      `lateral` prendendo `t.totale` per nome (le colonne in piu' non li
--      toccano); `close_order_as_discount_gift` fa `select * into v_conto`
--      su una variabile dichiarata `record`, che regge due colonne in
--      piu'. Verificato leggendo il corpo delle funzioni, non sulla parola.
--   2. **Dopo un drop i permessi tornano aperti al mondo** (lezione del
--      13/08): si richiudono a mano subito sotto, e la verifica lo
--      controlla invece di darlo per fatto.
drop function if exists totale_conto(uuid);

create or replace function totale_conto(p_order_id uuid)
returns table (
  righe          numeric,
  coperti        integer,
  prezzo_coperto numeric,
  totale         numeric,
  righe_mai_inviate integer,
  valore_mai_inviate numeric
)
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_order  orders%rowtype;
  v_righe  numeric;
  v_prezzo numeric;
  v_n      integer;
  v_val    numeric;
begin
  if auth.uid() is null then
    raise exception 'Operazione consentita solo a un utente autenticato';
  end if;

  select * into v_order from orders where id = p_order_id;
  if v_order.id is null then
    raise exception 'Conto non trovato';
  end if;

  v_prezzo := coalesce(
    v_order.coperto_unit_price,
    (select coperto_price from service_settings where id = 1),
    0
  );

  -- ⚠️ `sent_at is not null`: una riga scritta e mai mandata in cucina non
  -- e' un piatto servito. Deciso da Alessio (Blocco 4.2 del mandato).
  select coalesce(sum(quantity * unit_price), 0) into v_righe
    from order_items
   where order_id = p_order_id and voided_at is null and sent_at is not null;

  -- ⚠️ E il buco si DICHIARA insieme al numero, non si lascia dedurre:
  -- una riga che sparisce dal conto senza una frase e' indistinguibile da
  -- un piatto dimenticato. Stessa forma dell'avvertenza di calcola_imposte().
  select count(*), coalesce(sum(quantity * unit_price), 0) into v_n, v_val
    from order_items
   where order_id = p_order_id and voided_at is null and sent_at is null;

  return query select
    v_righe,
    coalesce(v_order.coperti, 0),
    v_prezzo,
    v_righe + coalesce(v_order.coperti, 0) * v_prezzo,
    v_n,
    v_val;
end;
$function$;

comment on function totale_conto is
  'L''unico calcolo del totale di un conto lato database. Dal 16/08/2026 conta le sole righe MANDATE IN CUCINA (Blocco 4.2, decisione di Alessio) e dichiara insieme al totale quante righe sono rimaste in bozza e quanto valgono: un buco che non si dichiara si legge come un piatto dimenticato.';

revoke all on function totale_conto(uuid) from public, anon, authenticated;
grant execute on function totale_conto(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 4. E il magazzino non scarica ciò che nessuno ha cucinato
-- ---------------------------------------------------------------------
create or replace function fabbisogno_conto(p_order_id uuid)
returns table (order_item_id uuid, ingredient_id uuid, quantita numeric)
language sql
stable
security definer
set search_path = public
as $funzione$
  with recursive righe as (
    select oi.id, oi.recipe_id, oi.quantity::numeric as porzioni
      from order_items oi
     where oi.order_id = p_order_id
       and oi.voided_at is null
       -- ⚠️ Mai inviata = mai cucinata: dalla cella non e' uscito niente.
       and oi.sent_at is not null
       and oi.recipe_id is not null
  ),
  espansione as (
    select r.id as order_item_id,
           ri.ingredient_id,
           ri.component_recipe_id,
           r.porzioni * ri.quantity / nullif(rec.portions_yield, 0) as multiplier,
           ri.waste_percentage,
           ri.is_optional,
           1 as depth
      from righe r
      join recipes rec on rec.id = r.recipe_id
      join recipe_ingredients ri on ri.recipe_id = r.recipe_id

    union all

    select e.order_item_id,
           ri2.ingredient_id,
           ri2.component_recipe_id,
           e.multiplier * ri2.quantity / nullif(comp.yield_quantity, 0),
           ri2.waste_percentage,
           (e.is_optional or ri2.is_optional),
           e.depth + 1
      from espansione e
      join recipes comp on comp.id = e.component_recipe_id
      join recipe_ingredients ri2 on ri2.recipe_id = e.component_recipe_id
     where e.component_recipe_id is not null
       and e.depth < 10
       -- L'interruttore del 14/08: una preparazione CHE HA LOTTI non si
       -- esplode piu', si consuma. Senza, servire un piatto scaricherebbe
       -- due volte le stesse verdure.
       and not exists (
         select 1 from ingredients i
          join stock_lots sl on sl.ingredient_id = i.id
         where i.preparazione_id = e.component_recipe_id
           and sl.quantity_remaining > 0
       )
  )
  select e.order_item_id,
         e.ingredient_id,
         sum(e.multiplier * (1 + coalesce(e.waste_percentage, i.waste_percentage_default, 0) / 100.0))
    from espansione e
    join ingredients i on i.id = e.ingredient_id
   where e.ingredient_id is not null
     and not e.is_optional
   group by e.order_item_id, e.ingredient_id;
$funzione$;

comment on function fabbisogno_conto is
  'Cosa togliere dalla cella per i piatti di un conto. Dal 16/08/2026 guarda le sole righe MANDATE IN CUCINA: una bozza mai inviata non e'' stata cucinata, quindi dalla cella non e'' uscito niente (Blocco 4.2).';

revoke all on function fabbisogno_conto(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 5. Verifica sul campo (§5 punti 1-3)
-- ---------------------------------------------------------------------
-- ⚠️ Nessun gestore d'eccezione sul blocco esterno; perimetro fatto solo
-- di roba creata qui — conto, tavolo e righe compresi.
do $verifica$
declare
  v_titolare uuid; v_staff uuid;
  v_tav uuid; v_conto uuid;
  r_inviata uuid; r_bozza uuid;
  v_tot numeric; v_mai integer; v_val numeric;
  respinto boolean;
  n integer;
begin
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  if v_titolare is null then
    raise exception 'Nessun titolare in user_roles: impossibile verificare.';
  end if;
  select user_id into v_staff from user_roles where role = 'staff' limit 1;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

  insert into dining_tables (label, tipo, larghezza_cm, profondita_cm, x, y)
  values ('__PB4__', 'tavolo', 90, 90, 4700, 4700) returning id into v_tav;

  insert into orders (table_label, status, coperti, coperto_unit_price)
  values ('__Prova B4__', 'aperto', 2, 5.00) returning id into v_conto;

  -- Una riga inviata da 10,00 e una bozza da 7,00.
  insert into order_items (order_id, free_text_name, destination, quantity, unit_price, sent_at)
  values (v_conto, '__PB4 inviata__', 'cucina', 1, 10.00, now()) returning id into r_inviata;
  insert into order_items (order_id, free_text_name, destination, quantity, unit_price)
  values (v_conto, '__PB4 bozza__', 'cucina', 1, 7.00) returning id into r_bozza;

  -- 5a. IL TOTALE conta solo l'inviata, e DICHIARA la bozza.
  select totale, righe_mai_inviate, valore_mai_inviate
    into v_tot, v_mai, v_val
    from totale_conto(v_conto);
  if v_tot <> 20.00 then
    raise exception 'Totale % invece di 20,00 (10 inviata + 2 coperti x 5): la bozza e'' entrata nel conto.', v_tot;
  end if;
  if v_mai <> 1 or v_val <> 7.00 then
    raise exception 'Il conto non dichiara la bozza: % righe per % euro.', v_mai, v_val;
  end if;

  -- 5b. LA BOZZA si cancella e si cambia: e' lavoro in corso.
  update order_items set quantity = 3 where id = r_bozza;
  delete from order_items where id = r_bozza;
  if exists (select 1 from order_items where id = r_bozza) then
    raise exception 'Una riga mai inviata non si e'' lasciata cancellare.';
  end if;

  -- 5c. LA RIGA INVIATA non si cancella e non si cambia nei numeri.
  respinto := false;
  begin
    delete from order_items where id = r_inviata;
  exception when sqlstate 'P0001' then respinto := true;
  end;
  if not respinto then
    raise exception 'Una riga gia'' mandata in cucina si e'' lasciata CANCELLARE.';
  end if;

  respinto := false;
  begin
    update order_items set quantity = 5 where id = r_inviata;
  exception when sqlstate 'P0001' then respinto := true;
  end;
  if not respinto then
    raise exception 'La quantita'' di una riga gia'' inviata si e'' lasciata cambiare.';
  end if;

  respinto := false;
  begin
    update order_items set sent_at = now() - interval '1 hour' where id = r_inviata;
  exception when sqlstate 'P0001' then respinto := true;
  end;
  if not respinto then
    raise exception 'L''ora di invio in cucina si e'' lasciata riscrivere.';
  end if;

  -- 5d. Ma LO STORNO si fa, la nota si cambia e il ticket si segna
  -- stampato: la cura non deve impedire di correggersi.
  update order_items set note = 'senza glutine' where id = r_inviata;
  update order_items set prepared_at = now() where id = r_inviata;
  update order_items set voided_at = now(), void_reason = '__prova storno__' where id = r_inviata;
  if (select voided_at from order_items where id = r_inviata) is null then
    raise exception 'Lo storno di una riga inviata e'' stato impedito: la cura ha vietato anche il rimedio.';
  end if;

  -- E il conto stornato torna ai soli coperti: lo storno si vede.
  select totale into v_tot from totale_conto(v_conto);
  if v_tot <> 10.00 then
    raise exception 'Dopo lo storno il totale e'' % invece di 10,00 (i soli coperti).', v_tot;
  end if;

  -- 5e. A CONTO CHIUSO non si tocca piu' niente che sposti un euro.
  update order_items set voided_at = null, void_reason = null where id = r_inviata;
  update orders set status = 'chiuso', closed_at = now() where id = v_conto;

  respinto := false;
  begin
    update order_items set voided_at = now() where id = r_inviata;
  exception when sqlstate 'P0001' then respinto := true;
  end;
  if not respinto then
    raise exception 'Su un conto chiuso si e'' potuto stornare una riga: il totale incassato cambierebbe dopo.';
  end if;

  respinto := false;
  begin
    delete from order_items where id = r_inviata;
  exception when sqlstate 'P0001' then respinto := true;
  end;
  if not respinto then
    raise exception 'Su un conto chiuso si e'' potuta cancellare una riga.';
  end if;

  -- La nota resta ammessa anche a conto chiuso: non sposta un euro.
  update order_items set note = 'nota dopo la chiusura' where id = r_inviata;
  update orders set status = 'aperto', closed_at = null where id = v_conto;

  -- 5e-bis. Dopo il drop, `totale_conto` non deve essere rimasta aperta
  -- al mondo: la lezione dell'11/08 e del 13/08, controllata e non
  -- dichiarata.
  if has_function_privilege('anon', 'totale_conto(uuid)', 'execute') then
    raise exception 'Dopo il drop, totale_conto e'' eseguibile con la sola chiave pubblica.';
  end if;
  if not has_function_privilege('authenticated', 'totale_conto(uuid)', 'execute') then
    raise exception 'totale_conto non e'' piu'' eseguibile dal gestionale: il corridoio la chiama col token dell''utente.';
  end if;

  -- 5f. E la cancellazione di una bozza LASCIA TRACCIA nel registro.
  select count(*) into n from deleted_records
   where table_name = 'order_items' and record_id = r_bozza::text;
  if n <> 1 then
    raise exception 'La riga in bozza cancellata non e'' finita nel registro delle cancellazioni (% righe).', n;
  end if;

  -- 5g. IL CONTO INTERO si puo' ancora cancellare, e le sue righe se ne
  -- vanno con lui. ⚠️ Senza questo, un conto con anche una sola riga
  -- inviata sarebbe prigioniero per sempre — e il primo a scoprirlo
  -- sarebbe Alessio, il giorno in cui deve ripulire i dati di collaudo.
  -- La verifica ci passa attraverso invece di aggirare il trigger
  -- spegnendolo: una scappatoia nel trigger sarebbe anche la strada per
  -- aggirarlo davvero.
  --
  -- PULIZIA.
  delete from orders where id = v_conto;
  if exists (select 1 from order_items where order_id = v_conto) then
    raise exception 'Cancellando il conto le sue righe sono rimaste.';
  end if;
  select count(*) into n from deleted_records
   where table_name = 'order_items' and record_id = r_inviata::text;
  if n <> 1 then
    raise exception 'La riga inviata sparita col conto non e'' finita nel registro (% righe).', n;
  end if;
  delete from dining_tables where id = v_tav;
  delete from deleted_records where table_name = 'order_items'
     and record->>'order_id' = v_conto::text;

  select count(*) into n from orders where table_label = '__Prova B4__';
  if n <> 0 then raise exception 'La verifica ha lasciato % conti.', n; end if;
  select count(*) into n from dining_tables where label = '__PB4__';
  if n <> 0 then raise exception 'La verifica ha lasciato % sagome.', n; end if;
  select count(*) into n from deleted_records where table_name = 'order_items'
     and record->>'order_id' = v_conto::text;
  if n <> 0 then raise exception 'La verifica ha lasciato % lapidi nel registro.', n; end if;

  -- ⚠️ E il controllo che vale piu' degli altri: nessun conto VERO deve
  -- aver cambiato totale. Se ce ne fosse uno chiuso con righe mai
  -- inviate, questa migrazione gliel'avrebbe appena abbassato.
  select count(*) into n
    from order_items oi join orders o on o.id = oi.order_id
   where o.status <> 'aperto' and oi.sent_at is null and oi.voided_at is null;
  if n <> 0 then
    raise exception 'Ci sono % righe mai inviate su conti gia'' chiusi: il loro totale e'' appena cambiato, e va deciso cosa farne PRIMA di applicare.', n;
  end if;

  perform set_config('request.jwt.claims', null, true);
  raise notice 'Blocco 4: una riga inviata si storna e non sparisce, una mai inviata non si paga e si dichiara.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260816000008', 'le_comande')
on conflict (version) do nothing;

select
  (select count(*) from pg_trigger where tgname = 'trg_riga_servita' and not tgisinternal)     as vincolo_righe,
  (select count(*) from pg_trigger where tgname = 'trg_log_delete'
     and tgrelid = 'order_items'::regclass and not tgisinternal)                               as registro_comande,
  (select count(*) from pg_trigger where tgname = 'trg_log_delete' and not tgisinternal)       as tabelle_tracciate,
  (select count(*) from order_items oi join orders o on o.id = oi.order_id
    where o.status <> 'aperto' and oi.sent_at is null and oi.voided_at is null)                as bozze_su_conti_chiusi;
