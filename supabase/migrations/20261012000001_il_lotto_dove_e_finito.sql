-- =====================================================================
-- IL LOTTO: DOVE E' FINITO (12/10/2026 — N6, Blocco 6 del mandato
-- cumulativo del 14/08, deciso da Alessio il 12/10: «si vai»)
-- =====================================================================
--
-- La pagina della tracciabilita' sapeva solo l'ARRIVO di una partita:
-- fornitore, numero di lotto, scadenza. Il mandato chiede l'altra meta':
-- dato un lotto, DOVE E' FINITO — quali giorni, quali piatti, quali conti.
-- E' cio' che serve in un controllo o in un richiamo del produttore.
--
-- 🔴 MISURATO PRIMA DI SCRIVERE: IL DATO NON ESISTEVA. Cinque funzioni
--    tolgono merce dai lotti (`record_stock_consumption`, `chiudi_partita`,
--    `scarica_magazzino_conto`, `registra_produzione`, `allinea_giacenza`)
--    e tutte fanno la stessa cosa: abbassano `quantity_remaining` lotto per
--    lotto (FEFO) e poi scrivono UN movimento per prodotto in
--    `stock_consumptions`. Il movimento sa il prodotto, non il lotto: quale
--    partita e' scesa per quale conto non era scritto da nessuna parte.
--
-- LA FORMA: `uscite_lotto`, una riga per ogni volta che un lotto scende,
--    scritta da un TRIGGER su `stock_lots` e non dalle cinque funzioni.
--    ⚠️ La ragione e' la regola del progetto, *l'automazione batte la
--    disciplina*: riscrivere cinque corpi vorrebbe dire che la sesta
--    funzione che scarichera' un lotto — fra sei mesi — dovra' ricordarsi
--    di annotare. Il trigger la vede da se'. E nessun corpo vivo viene
--    toccato: niente rischio di riscriverne uno da un file vecchio.
--
-- IL COLLEGAMENTO AL MOVIMENTO si fa per TRANSAZIONE + PRODOTTO, e la
--    regola che lo tiene giusto e' la COPERTURA: un'uscita si attacca a
--    un movimento della stessa transazione e dello stesso prodotto che
--    non e' ancora coperto per intero. Regge i due ordini che esistono:
--      · prima scende il lotto e poi nasce il movimento (quattro funzioni
--        su cinque): e' il movimento, nascendo, a prendersi le uscite
--        ancora libere;
--      · prima nasce il movimento e poi scende il lotto (`chiudi_partita`):
--        e' l'uscita, nascendo, a trovarsi il movimento non ancora coperto.
--    ⚠️ Dentro una transazione `txid_current()` e' lo stesso anche nei
--    blocchi annidati (i sotto-blocchi dello scarico di un conto): e' il
--    numero della transazione principale, misurato.
--
-- 🔴 IL LIMITE, DICHIARATO E NON NASCOSTO: le uscite si annotano da
--    quando questa migrazione esiste. Quello che e' uscito PRIMA non si
--    ricostruisce — nessuna tabella lo diceva — e la funzione lo restituisce
--    come una riga a se', «uscito prima che il gestionale annotasse dove»,
--    con la sua quantita' (ricevuto − rimasto − annotato). Un vuoto
--    dichiarato, mai una lista che sembra completa.
--
-- ⚠️ IL CAMBIO DI UNITA' NON E' UN'USCITA. `converti_numeri_dell_unita`
--    moltiplica ricevuto e rimasto nella stessa istruzione: se il trigger lo
--    leggesse come un calo, passando da grammi a chili ogni lotto
--    «perderebbe» il 99,9% verso nessuno. Il segno e' che cambia anche il
--    ricevuto, che nessun'altra scrittura tocca: allora le uscite di quel
--    lotto si convertono con lo stesso rapporto, e nessuna ne nasce.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Il movimento sa in quale transazione e' nato
-- ---------------------------------------------------------------------
-- ⚠️ La colonna nasce SENZA predefinito e lo riceve subito dopo: con un
--    predefinito nell'`add column`, tutte le righe vecchie si troverebbero
--    il numero della transazione di questa migrazione — una risposta data
--    al posto di chi non c'era (trappola del 14/08). Le vecchie restano
--    vuote, ed e' vero: allora non si annotava.
alter table stock_consumptions add column if not exists transazione bigint;
alter table stock_consumptions alter column transazione set default txid_current();

comment on column stock_consumptions.transazione is
  'La transazione in cui e'' nato il movimento: serve SOLO a collegarlo alle uscite dei lotti (`uscite_lotto`) scritte nella stessa transazione. Vuota sui movimenti scritti prima del 12/10/2026, quando le uscite non si annotavano.';

create index if not exists idx_stock_consumptions_transazione
  on stock_consumptions (transazione, ingredient_id) where transazione is not null;

-- ---------------------------------------------------------------------
-- 2. Le uscite dei lotti
-- ---------------------------------------------------------------------
create table if not exists uscite_lotto (
  id           uuid primary key default gen_random_uuid(),
  lotto_id     uuid not null,
  consumo_id   uuid,
  quantita     numeric(14,4) not null,
  transazione  bigint not null default txid_current(),
  -- `clock_timestamp()` e non `now()`: dentro una transazione `now()` e'
  -- un istante solo, e due uscite dello stesso scarico pareggerebbero.
  uscita_il    timestamptz not null default clock_timestamp(),
  constraint uscite_lotto_lotto_fkey
    foreign key (lotto_id) references stock_lots(id) on delete cascade,
  constraint uscite_lotto_consumo_fkey
    foreign key (consumo_id) references stock_consumptions(id) on delete set null,
  constraint uscita_quantita_positiva check (quantita > 0)
);

comment on table uscite_lotto is
  'Ogni volta che un lotto scende, quanto ne e'' uscito e per quale movimento. La scrive SOLO il trigger `trg_traccia_uscita_lotto` su `stock_lots`: nessuna funzione e nessuna schermata la scrive a mano. Serve a rispondere a «dove e'' finito questo lotto» (`dove_e_finito_il_lotto`). Esiste dal 12/10/2026: le uscite di prima non sono annotate, e la funzione lo dichiara.';
comment on column uscite_lotto.consumo_id is
  'Il movimento di magazzino a cui appartiene l''uscita. Vuoto quando nessun movimento la spiega: l''allineamento di una giacenza contata, o una quantita'' cosi'' piccola che il movimento non e'' stato scritto.';
comment on constraint uscita_quantita_positiva on uscite_lotto is
  'Un''uscita da un lotto e'' sempre una quantita'' maggiore di zero: se il lotto non e'' sceso, non c''e'' niente da annotare.';
comment on constraint uscite_lotto_lotto_fkey on uscite_lotto is
  'Ogni uscita appartiene a un lotto che esiste. Se il lotto viene tolto, le sue uscite se ne vanno con lui.';
comment on constraint uscite_lotto_consumo_fkey on uscite_lotto is
  'L''uscita nomina il movimento di magazzino che la spiega. Se quel movimento viene tolto, l''uscita resta e non lo nomina piu''.';

create index if not exists idx_uscite_lotto_lotto on uscite_lotto (lotto_id);
create index if not exists idx_uscite_lotto_consumo on uscite_lotto (consumo_id) where consumo_id is not null;
create index if not exists idx_uscite_lotto_libere on uscite_lotto (transazione) where consumo_id is null;

-- ⚠️ Titolare e basta, come `stock_consumptions` dal 13/08: dice per quali
--    conti e' uscita la merce. Lo staff arriva al «dove» solo dalla
--    funzione, che ha il suo portiere.
alter table uscite_lotto enable row level security;
drop policy if exists uscite_lotto_titolare on uscite_lotto;
create policy uscite_lotto_titolare on uscite_lotto
  for select to authenticated
  using ((select is_titolare()));

revoke all on uscite_lotto from public, anon, authenticated;
grant select on uscite_lotto to authenticated;

insert into perimetro_registro (tabella, dentro, ragione) values
  ('uscite_lotto', false,
   'Un riflesso: la scrive solo un trigger, a ogni calo di un lotto. Non si cancella dall''app, e se ne va soltanto col suo lotto. Fuori dal 12/10/2026.')
on conflict (tabella) do nothing;

-- ---------------------------------------------------------------------
-- 3. Il trigger sul lotto
-- ---------------------------------------------------------------------
-- ⚠️ SENZA `update of quantity_remaining`: il filtro `OF` guarda le
--    colonne nominate dall'istruzione, non quelle cambiate (trappola del
--    27/08). La condizione sta dentro, su `old` e `new`.
create or replace function traccia_uscita_lotto()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_uscita   uuid;
  v_consumo  uuid;
begin
  -- Il cambio di unita': cambiano ricevuto E rimasto insieme. Le uscite
  -- di questo lotto parlano la sua unita', quindi la seguono.
  if new.quantity_received is distinct from old.quantity_received then
    if old.quantity_received > 0 and new.quantity_received > 0 then
      update uscite_lotto
         set quantita = round(quantita * new.quantity_received / old.quantity_received, 4)
       where lotto_id = new.id;
    end if;
    return new;
  end if;

  if new.quantity_remaining >= old.quantity_remaining then
    return new;
  end if;

  insert into uscite_lotto (lotto_id, quantita)
  values (new.id, old.quantity_remaining - new.quantity_remaining)
  returning id into v_uscita;

  -- Il movimento c'e' gia' (l'ordine di `chiudi_partita`)? Si cerca uno
  -- della stessa transazione e dello stesso prodotto NON ANCORA COPERTO.
  -- ⚠️ La tolleranza e' il decimo di grammo con cui i movimenti si
  --    arrotondano (`round(…, 4)`): senza, un movimento arrotondato per
  --    difetto risulterebbe sempre scoperto di un niente.
  select c.id into v_consumo
    from stock_consumptions c
   where c.transazione = txid_current()
     and c.ingredient_id = new.ingredient_id
     and c.quantity - coalesce((select sum(u.quantita) from uscite_lotto u
                                 where u.consumo_id = c.id), 0) > 0.0001
   order by c.created_at desc, c.id
   limit 1;

  if v_consumo is not null then
    update uscite_lotto set consumo_id = v_consumo where id = v_uscita;
  end if;
  return new;
end $fn$;

revoke all on function traccia_uscita_lotto() from public, anon, authenticated;

drop trigger if exists trg_traccia_uscita_lotto on stock_lots;
create trigger trg_traccia_uscita_lotto
  after update on stock_lots
  for each row execute function traccia_uscita_lotto();

-- ---------------------------------------------------------------------
-- 4. Il trigger sul movimento
-- ---------------------------------------------------------------------
-- Il movimento, nascendo, si prende le uscite ancora libere della sua
-- transazione e del suo prodotto: sono quelle che lo hanno appena fatto.
create or replace function collega_uscite_al_movimento()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if new.transazione is null then
    return new;
  end if;
  update uscite_lotto u
     set consumo_id = new.id
    from stock_lots l
   where l.id = u.lotto_id
     and l.ingredient_id = new.ingredient_id
     and u.transazione = new.transazione
     and u.consumo_id is null;
  return new;
end $fn$;

revoke all on function collega_uscite_al_movimento() from public, anon, authenticated;

drop trigger if exists trg_collega_uscite_al_movimento on stock_consumptions;
create trigger trg_collega_uscite_al_movimento
  after insert on stock_consumptions
  for each row execute function collega_uscite_al_movimento();

-- ---------------------------------------------------------------------
-- 5. La domanda: dove e' finito questo lotto?
-- ---------------------------------------------------------------------
-- Una riga per destinazione, in ordine di tempo. Quando la destinazione e'
-- una PRODUZIONE, si segue il lotto nato da quella produzione (un ragu'
-- eredita le partite delle sue materie prime: senza, la catena si
-- interromperebbe al primo semilavorato), con `livello` che dice quanti
-- passaggi ci sono stati.
--
-- ⚠️ I PIATTI SI LEGGONO DA `fabbisogno_conto`, cioe' dalla stessa regola
--    che ha deciso cosa scaricare — sostituzioni e finger compresi. Il
--    limite: la ricetta e' quella di OGGI. Se nel frattempo e' cambiata e
--    il piatto non contiene piu' quel prodotto, la riga del conto resta ma
--    i piatti restano vuoti, e la schermata lo dice.
create or replace function dove_e_finito_il_lotto(p_lotto_id uuid)
returns table (
  livello            integer,
  lotto_id           uuid,
  prodotto           text,
  unita              text,
  tipo               text,
  quantita           numeric,
  quando             timestamptz,
  serata             date,
  descrizione        text,
  piatti             text,
  order_id           uuid,
  produzione_id      uuid,
  lotto_prodotto_id  uuid
)
language plpgsql
stable
security definer
set search_path = public
as $fn$
#variable_conflict use_column
declare
  v_coda     uuid[] := array[p_lotto_id];
  v_livelli  integer[] := array[0];
  v_visti    uuid[] := '{}';
  v_lotto    uuid;
  v_liv      integer;
  v_lot      record;
  v_r        record;
  v_annotato numeric;
  v_piatti   text;
begin
  -- ⚠️ Il portiere RIFIUTA, non filtra: un elenco vuoto si leggerebbe
  --    «questo lotto non e' andato da nessuna parte» (regola del 13/08).
  if not (select is_titolare()) then
    raise exception 'Dove e'' finito un lotto lo vede solo il titolare: dice per quali conti e'' uscita la merce.';
  end if;
  if not exists (select 1 from stock_lots where id = p_lotto_id) then
    raise exception 'Questo lotto non esiste piu''.';
  end if;

  while coalesce(array_length(v_coda, 1), 0) > 0 loop
    v_lotto := v_coda[1];
    v_liv   := v_livelli[1];
    v_coda    := v_coda[2:];
    v_livelli := v_livelli[2:];
    -- Un lotto si segue una volta sola, e la catena ha un fondo: dieci
    -- passaggi di semilavorati sono gia' piu' di qualunque cucina vera.
    continue when v_lotto = any(v_visti) or v_liv > 10;
    v_visti := v_visti || v_lotto;

    select l.id, l.quantity_received, l.quantity_remaining, l.received_at,
           i.name as nome, i.unit::text as unita
      into v_lot
      from stock_lots l join ingredients i on i.id = l.ingredient_id
     where l.id = v_lotto;
    continue when v_lot.id is null;

    for v_r in
      select u.consumo_id,
             sum(u.quantita) as quantita,
             min(coalesce(c.created_at, u.uscita_il)) as quando,
             c.reason, c.note, c.order_id, c.produzione_id
        from uscite_lotto u
        left join stock_consumptions c on c.id = u.consumo_id
       where u.lotto_id = v_lotto
       group by u.consumo_id, u.transazione, c.reason, c.note, c.order_id, c.produzione_id
       order by min(coalesce(c.created_at, u.uscita_il))
    loop
      livello := v_liv;
      lotto_id := v_lotto;
      prodotto := v_lot.nome;
      unita := v_lot.unita;
      quantita := v_r.quantita;
      quando := v_r.quando;
      order_id := v_r.order_id;
      produzione_id := v_r.produzione_id;
      lotto_prodotto_id := null;
      piatti := null;
      serata := null;

      if v_r.order_id is not null then
        tipo := 'conto';
        select 'Conto ' || o.table_label, serata_di_servizio(coalesce(o.closed_at, v_r.quando))
          into descrizione, serata
          from orders o where o.id = v_r.order_id;
        begin
          select string_agg(distinct coalesce(r.name, oi.free_text_name), ', ')
            into v_piatti
            from fabbisogno_conto(v_r.order_id) f
            join order_items oi on oi.id = f.order_item_id
            left join recipes r on r.id = oi.recipe_id
            join stock_lots sl on sl.id = v_lotto
           where f.ingredient_id = sl.ingredient_id;
        exception when others then
          v_piatti := null;
        end;
        piatti := v_piatti;
      elsif v_r.produzione_id is not null then
        tipo := 'produzione';
        select 'Produzione di ' || r.name, p.lotto_id
          into descrizione, lotto_prodotto_id
          from produzioni p join recipes r on r.id = p.recipe_id
         where p.id = v_r.produzione_id;
        serata := (v_r.quando at time zone 'Europe/Rome')::date;
        if lotto_prodotto_id is not null then
          v_coda    := v_coda || lotto_prodotto_id;
          v_livelli := v_livelli || (v_liv + 1);
        end if;
      elsif v_r.consumo_id is not null then
        tipo := case v_r.reason
                  when 'spreco' then 'spreco'
                  when 'reso_fornitore' then 'reso'
                  when 'vitto_personale' then 'vitto'
                  when 'rettifica' then 'rettifica'
                  else 'consumo'
                end;
        descrizione := coalesce(nullif(v_r.note, ''), case tipo
                  when 'spreco' then 'Buttato'
                  when 'reso' then 'Reso al fornitore'
                  when 'vitto' then 'Pasti del personale'
                  when 'rettifica' then 'Rettifica'
                  else 'Uscito dal magazzino' end);
        serata := (v_r.quando at time zone 'Europe/Rome')::date;
      else
        tipo := 'senza_movimento';
        descrizione := 'Sceso senza un movimento che lo spieghi: l''allineamento di una giacenza contata, o una quantita'' troppo piccola per essere scritta.';
        serata := (v_r.quando at time zone 'Europe/Rome')::date;
      end if;
      return next;
    end loop;

    -- Quello che e' uscito prima che si annotasse: ricevuto − rimasto − annotato.
    select coalesce(sum(u.quantita), 0) into v_annotato
      from uscite_lotto u where u.lotto_id = v_lotto;
    if v_lot.quantity_received - v_lot.quantity_remaining - v_annotato > 0.0001 then
      livello := v_liv;
      lotto_id := v_lotto;
      prodotto := v_lot.nome;
      unita := v_lot.unita;
      tipo := 'non_annotato';
      quantita := round(v_lot.quantity_received - v_lot.quantity_remaining - v_annotato, 4);
      quando := null;
      serata := null;
      descrizione := 'Uscito prima del 12/10/2026, quando il gestionale non annotava ancora dove andava la merce.';
      piatti := null;
      order_id := null;
      produzione_id := null;
      lotto_prodotto_id := null;
      return next;
    end if;
  end loop;
end $fn$;

comment on function dove_e_finito_il_lotto(uuid) is
  'Dato un lotto, dove e'' finita la sua merce: conti (con la serata e i piatti), produzioni (seguendo il lotto nato, livello per livello), sprechi, resi, pasti del personale. Quello uscito prima del 12/10/2026 compare come una riga «non_annotato» con la sua quantita''. Solo il titolare: chiunque altro riceve un rifiuto, non un elenco vuoto.';

revoke all on function dove_e_finito_il_lotto(uuid) from public, anon, authenticated;
grant execute on function dove_e_finito_il_lotto(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 6. VERIFICA — si prova con le funzioni VERE e si annulla
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_foto     jsonb := foto_righe();
  v_titolare uuid;
  v_staff    uuid;
  v_ent      uuid;
  v_ing      uuid;
  v_ing2     uuid;
  v_a        uuid;
  v_b        uuid;
  v_c        uuid;
  v_e        uuid;
  v_ric      uuid;
  v_prep     uuid;
  v_conto    uuid;
  v_prod     uuid;
  v_nato     uuid;
  v_n        integer;
  v_q        numeric;
  v_t        text;
  v_respinto boolean;
begin
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  select user_id into v_staff from user_roles where role = 'staff' limit 1;
  select id into v_ent from entities where entity_type = 'srls';
  if v_titolare is null or v_staff is null or v_ent is null then
    raise exception 'VERIFICA: servono un titolare, uno staff e la societa''.';
  end if;
  if has_function_privilege('anon', 'dove_e_finito_il_lotto(uuid)', 'execute') then
    raise exception 'VERIFICA: dove_e_finito_il_lotto e'' aperta ad anon.';
  end if;
  if has_function_privilege('authenticated', 'traccia_uscita_lotto()', 'execute')
     or has_function_privilege('authenticated', 'collega_uscite_al_movimento()', 'execute') then
    raise exception 'VERIFICA: una funzione di trigger e'' eseguibile dal browser.';
  end if;

  begin  -- <<< la sotto-transazione che verra' annullata
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

    -- L'esempio si costruisce: prodotti e lotti miei.
    insert into ingredients (name, category, unit, current_price, entity_id, alimentare, tenuto_in_magazzino)
    values ('ZZ verifica lotti - farina', 'farine_cereali', 'kg', 2, v_ent, true, true)
    returning id into v_ing;
    insert into ingredients (name, category, unit, current_price, entity_id, alimentare, tenuto_in_magazzino)
    values ('ZZ verifica lotti - zucchero', 'farine_cereali', 'kg', 2, v_ent, true, true)
    returning id into v_ing2;

    -- A scade prima di B: FEFO prende A per primo.
    insert into stock_lots (ingredient_id, quantity_received, quantity_remaining, unit_cost, expiry_date)
    values (v_ing, 2, 2, 1, current_date + 5) returning id into v_a;
    insert into stock_lots (ingredient_id, quantity_received, quantity_remaining, unit_cost, expiry_date)
    values (v_ing, 10, 10, 1, current_date + 50) returning id into v_b;

    -- (1) PRIMA SCENDE IL LOTTO, POI NASCE IL MOVIMENTO. 3 kg buttati:
    --     2 da A e 1 da B, tutti e due attaccati allo stesso movimento.
    --     ⚠️ I numeri sono scelti perche' le risposte sbagliate si vedano:
    --        con 1 kg solo (un lotto) non si vedrebbe la divisione.
    perform record_stock_consumption(v_ing, 3, 'spreco', 'ZZ verifica');
    select count(*), sum(quantita) into v_n, v_q
      from uscite_lotto u join stock_consumptions c on c.id = u.consumo_id
     where u.lotto_id in (v_a, v_b) and c.reason = 'spreco';
    if v_n is distinct from 2 or v_q is distinct from 3.0000 then
      raise exception 'VERIFICA (1): uscite collegate % per % kg, attese 2 per 3.', v_n, v_q;
    end if;
    if (select quantita from uscite_lotto where lotto_id = v_a) is distinct from 2.0000 then
      raise exception 'VERIFICA (1): il lotto A doveva dare 2 kg.';
    end if;

    -- (2) PRIMA NASCE IL MOVIMENTO, POI SCENDE IL LOTTO (`chiudi_partita`).
    --     ⚠️ E il movimento di prima, gia' coperto, NON deve prenderla:
    --        e' della stessa transazione e dello stesso prodotto, quindi
    --        e' esattamente il caso che la regola della copertura separa.
    perform chiudi_partita(v_b, 'reso_fornitore', 'ZZ verifica');
    select c.reason into v_t
      from uscite_lotto u join stock_consumptions c on c.id = u.consumo_id
     where u.lotto_id = v_b and u.quantita = 9;
    if v_t is distinct from 'reso_fornitore' then
      raise exception 'VERIFICA (2): i 9 kg resi sono attaccati a «%» invece che al reso.', coalesce(v_t, '(niente)');
    end if;

    -- (3) UN CONTO. 3 porzioni da 0,1 kg dal lotto C.
    insert into stock_lots (ingredient_id, quantity_received, quantity_remaining, unit_cost, expiry_date)
    values (v_ing2, 5, 5, 1, current_date + 5) returning id into v_c;
    insert into recipes (name, category, recipe_type, portions_yield)
    values ('ZZ verifica lotti - torta', 'dolce', 'piatto_finito', 10)
    returning id into v_ric;
    insert into recipe_ingredients (recipe_id, ingredient_id, quantity, unit)
    values (v_ric, v_ing2, 1, 'kg');
    insert into orders (entity_id, table_label, status)
    values (v_ent, 'ZZ verifica lotti', 'aperto') returning id into v_conto;
    insert into order_items (order_id, recipe_id, destination, quantity, unit_price, sent_at)
    values (v_conto, v_ric, 'cucina', 3, 6.00, now());
    perform scarica_magazzino_conto(v_conto);

    select tipo, quantita into v_t, v_q
      from dove_e_finito_il_lotto(v_c) where tipo = 'conto';
    if v_t is null or v_q is distinct from 0.3000 then
      raise exception 'VERIFICA (3): il conto non risulta, o con % kg invece di 0,3.', v_q;
    end if;
    if not exists (select 1 from dove_e_finito_il_lotto(v_c)
                    where tipo = 'conto' and piatti like '%ZZ verifica lotti - torta%') then
      raise exception 'VERIFICA (3): il piatto del conto non e'' nominato.';
    end if;

    -- (4) LA CATENA: una preparazione fatta con lo zucchero di C, e il suo
    --     lotto che poi esce. Dal lotto C si deve arrivare fin li'.
    insert into recipes (name, category, recipe_type, portions_yield, yield_quantity, yield_unit)
    values ('ZZ verifica lotti - crema', 'dolce', 'preparazione', 1, 1, 'kg')
    returning id into v_prep;
    insert into recipe_ingredients (recipe_id, ingredient_id, quantity, unit)
    values (v_prep, v_ing2, 1, 'kg');
    v_prod := (registra_produzione(v_prep, 1, 1, null, 'ZZ verifica') ->> 'produzione_id')::uuid;
    select lotto_id into v_nato from produzioni where id = v_prod;
    perform record_stock_consumption((select ingredient_id from stock_lots where id = v_nato), 0.4, 'consumo', 'ZZ verifica');

    if not exists (select 1 from dove_e_finito_il_lotto(v_c)
                    where tipo = 'produzione' and livello = 0 and lotto_prodotto_id = v_nato) then
      raise exception 'VERIFICA (4): la produzione non risulta fra le destinazioni del lotto C.';
    end if;
    if not exists (select 1 from dove_e_finito_il_lotto(v_c)
                    where livello = 1 and lotto_id = v_nato and tipo = 'consumo' and quantita = 0.4000) then
      raise exception 'VERIFICA (4): la catena si ferma al semilavorato.';
    end if;

    -- (5) IL CAMBIO DI UNITA' NON E' UN'USCITA: kg -> g sul lotto A.
    select count(*) into v_n from uscite_lotto;
    update stock_lots set quantity_received = quantity_received * 1000,
                          quantity_remaining = quantity_remaining * 1000
     where id = v_a;
    if (select count(*) from uscite_lotto) <> v_n then
      raise exception 'VERIFICA (5): il cambio di unita'' ha fatto nascere un''uscita.';
    end if;
    if (select quantita from uscite_lotto where lotto_id = v_a) is distinct from 2000.0000 then
      raise exception 'VERIFICA (5): le uscite non hanno seguito l''unita'' del lotto.';
    end if;

    -- (6) IL VUOTO DICHIARATO: un lotto sceso prima che si annotasse.
    --     Lo si costruisce gia' sceso, senza passare dal calo.
    insert into stock_lots (ingredient_id, quantity_received, quantity_remaining, unit_cost)
    values (v_ing2, 7, 4, 1) returning id into v_e;
    select quantita into v_q from dove_e_finito_il_lotto(v_e) where tipo = 'non_annotato';
    if v_q is distinct from 3.0000 then
      raise exception 'VERIFICA (6): il non annotato e'' % invece di 3.', coalesce(v_q::text, '(niente)');
    end if;
    -- …e dove tutto e' annotato, la riga non compare.
    if exists (select 1 from dove_e_finito_il_lotto(v_b) where tipo = 'non_annotato') then
      raise exception 'VERIFICA (6): un lotto tutto annotato dichiara un vuoto che non c''e''.';
    end if;

    -- (7) IL PORTIERE RIFIUTA lo staff.
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
    v_respinto := false;
    begin
      perform * from dove_e_finito_il_lotto(v_c);
    exception when others then v_respinto := sqlerrm like '%solo il titolare%';
    end;
    if not v_respinto then
      raise exception 'VERIFICA (7): lo staff ha letto dove e'' finito un lotto.';
    end if;

    raise exception 'ZZ_ANNULLA';  -- <<< qui la sotto-transazione rientra
  exception when others then
    if sqlerrm <> 'ZZ_ANNULLA' then raise; end if;
  end;

  perform set_config('request.jwt.claims', null, true);
  perform pretendi_nessun_residuo(v_foto, 'la verifica di dove e'' finito il lotto');

  raise notice 'Fatto: un lotto sa dove e'' finito — conti coi piatti, resi, sprechi, la catena delle produzioni; il cambio di unita'' non e'' un''uscita; il prima e'' dichiarato; lo staff e'' respinto. Provato e annullato: zero residui.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20261012000001', 'il_lotto_dove_e_finito')
on conflict (version) do nothing;
