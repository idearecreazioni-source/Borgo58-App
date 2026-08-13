-- =====================================================================
-- Lo scadenziario: quello che sta per scadere e nessuno guarderebbe
-- =====================================================================
-- Idea di Alessio del 13/08/2026, nata guardando la posta: l'assistente
-- proponeva un promemoria in Agenda per ogni scadenza di ogni riga di
-- fattura, e **lui l'ha rifiutato tutte le volte**. Il rifiuto ripetuto
-- era il dato: una lista di compiti non e' il posto dove si guardano le
-- scadenze della cella.
--
-- LA REGOLA E' SUA, E HA CORRETTO LA MIA. Avevo obiettato che una
-- partita nuova non fa sparire quella vecchia, quindi non doveva
-- zittire l'avviso. La sua risposta:
--
--   «Se sto comprando altre partite di un determinato prodotto vuol dire
--    che la partita precedente e' in esaurimento e che c'e' un riciclo
--    tale che non consente al prodotto di arrivare alla data di
--    scadenza. Il sistema ha senso solo per quei prodotti movimentati
--    poco e che potrebbero sfuggire a un controllo manuale.»
--
-- Ha ragione, e per un motivo che la mia versione non aveva: **la sua
-- regola non dipende dal fatto che qualcuno si ricordi di dire "finita"**.
-- La mia elencava ogni giorno tutto cio' che era entrato e non era stato
-- scaricato a mano — cioe' quasi tutto — e dopo tre giorni non l'avrebbe
-- letta piu' nessuno. Un avviso che si impara a saltare e' peggio di un
-- avviso che non c'e'.
--
-- Quindi si segnala una partita solo se:
--   1. ha una data di scadenza (i vegetali sfusi non ce l'hanno: fuori,
--      deciso da Alessio);
--   2. ce n'e' ancora (se il magazzino l'ha esaurita, tace da sola);
--   3. **non e' entrata dopo di lei un'altra partita dello stesso
--      prodotto che sia ancora in giacenza** — se il prodotto gira, si
--      vede a occhio e non serve un avviso;
--   4. mancano meno giorni del preavviso di quel prodotto.
--
-- ⚠️ IL PREZZO DI QUESTA REGOLA, detto una volta: se una partita vecchia
-- resta indietro mentre ne entrano di nuove, non verra' segnalata. E'
-- una scelta consapevole di Alessio per una cucina piccola, dove il
-- controllo a vista esiste davvero; non e' una svista.
--
-- ⚠️ IL PREAVVISO NON E' UN NUMERO SOLO. Due giorni su una ricotta sono
-- giusti, due giorni su una passata in dispensa sono inutili. Il sistema
-- ne **propone** uno alla nascita del prodotto (2 giorni per il frigo,
-- 14 per dispensa e freezer) e Alessio lo corregge dove serve. Chiederlo
-- a mano su ogni prodotto avrebbe prodotto uno scadenziario mezzo vuoto,
-- che e' peggio di nessuno scadenziario: sembra completo.
--
-- ⚠️ UN MESSAGGIO AL GIORNO, non uno per prodotto (Alessio: «alle 10»).
-- E' la stessa lezione del freno anti-tempesta di stanotte, applicata
-- prima di sbagliare invece che dopo.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Quanti giorni prima, per questo prodotto
-- ---------------------------------------------------------------------
alter table ingredients
  add column if not exists giorni_preavviso_scadenza integer;

comment on column ingredients.giorni_preavviso_scadenza is
  'Quanti giorni prima della scadenza avvisare. NULL = quello proposto dal sistema in base a conservazione e durata.';

create or replace function preavviso_giorni(
  p_esplicito     integer,
  p_durata_giorni integer,
  p_conservazione storage_type
)
returns integer
language sql
immutable
set search_path = public
as $funzione$
  select case
    when p_esplicito is not null and p_esplicito >= 0 then p_esplicito
    -- Quanto dura il prodotto e' il segnale migliore, quando c'e'.
    when p_durata_giorni is not null then (case when p_durata_giorni <= 7 then 2 else 14 end)
    -- Altrimenti lo dice dove si conserva.
    when p_conservazione in ('frigo_0_4', 'frigo_4_8') then 2
    else 14
  end;
$funzione$;

comment on function preavviso_giorni(integer, integer, storage_type) is
  'I giorni di preavviso di un prodotto: quello scelto da Alessio, altrimenti 2 per il fresco e 14 per il resto. Proporre e'' l''unico modo perche'' il campo sia pieno su duecento prodotti.';

revoke all on function preavviso_giorni(integer, integer, storage_type) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. Una partita si chiude, e si sa come
-- ---------------------------------------------------------------------
alter table stock_lots
  add column if not exists chiusa_il       timestamptz,
  add column if not exists chiusura        text,
  add column if not exists motivo_chiusura text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'stock_lots_chiusura_valida') then
    alter table stock_lots add constraint stock_lots_chiusura_valida
      check (chiusura is null or chiusura in ('finita', 'buttata'));
  end if;
end
$$;

comment on column stock_lots.chiusura is
  'Come e'' finita questa partita: «finita» (usata) o «buttata». NULL se e'' stata solo consumata poco a poco.';

-- ---------------------------------------------------------------------
-- 3. La decisione: cosa va segnalato, e cosa tace e perche'
-- ---------------------------------------------------------------------
-- Una funzione sola per la schermata e per il messaggio delle 10:00. Se
-- fossero due, un giorno direbbero due cose diverse — stesso principio
-- di `orderTotals()` e di `posti_liberi()`.
--
-- Restituisce ANCHE le partite mute, con scritto perche' lo sono: la
-- domanda «come mai non me l'ha detto?» deve avere una risposta in
-- schermata, non richiedere me.
create or replace function partite_in_scadenza()
returns table (
  lotto_id        uuid,
  ingrediente     text,
  ingrediente_id  uuid,
  quantita        numeric,
  unita           text,
  scadenza        date,
  giorni_mancanti integer,
  preavviso       integer,
  lotto_fornitore text,
  da_segnalare    boolean,
  perche_muta     text
)
language sql
stable
security definer
set search_path = public
as $funzione$
  with oggi as (select (now() at time zone 'Europe/Rome')::date as g),
  aperte as (
    select l.id, l.ingredient_id, l.quantity_remaining, l.expiry_date,
           l.received_at, l.supplier_batch_number,
           i.name, i.unit::text as unita,
           preavviso_giorni(i.giorni_preavviso_scadenza, i.shelf_life_days, i.storage_type) as preavviso
      from stock_lots l
      join ingredients i on i.id = l.ingredient_id
     where l.quantity_remaining > 0
       and l.expiry_date is not null
       and l.chiusa_il is null
  )
  select a.id, a.name, a.ingredient_id, a.quantity_remaining, a.unita,
         a.expiry_date,
         (a.expiry_date - o.g)::integer,
         a.preavviso,
         a.supplier_batch_number,
         (a.expiry_date - o.g) <= a.preavviso and not exists (
           select 1 from aperte n
            where n.ingredient_id = a.ingredient_id
              and n.id <> a.id
              and n.received_at > a.received_at
         ),
         case
           when exists (
             select 1 from aperte n
              where n.ingredient_id = a.ingredient_id
                and n.id <> a.id
                and n.received_at > a.received_at
           ) then 'ne e'' entrata una partita piu'' recente, ancora in giacenza'
           when (a.expiry_date - o.g) > a.preavviso
             then 'mancano piu'' di ' || a.preavviso || ' giorni'
           else null
         end
    from aperte a cross join oggi o
   order by a.expiry_date, a.name;
$funzione$;

comment on function partite_in_scadenza() is
  'Le partite aperte con una scadenza: quali vanno segnalate e, per le altre, perche'' tacciono. Una sola regola per la schermata e per il messaggio delle 10:00.';

revoke all on function partite_in_scadenza() from public, anon, authenticated;
grant execute on function partite_in_scadenza() to authenticated;

-- ---------------------------------------------------------------------
-- 4. Chiudere una partita: «finita» o «buttata»
-- ---------------------------------------------------------------------
-- Il registro delle non conformita' non prevedeva questo caso: le sue
-- categorie erano temperatura, ricevimento, pulizia, disinfestazione,
-- altro. Un prodotto eliminato perche' scaduto finirebbe in «altro», ed
-- e' esattamente il tipo di riga che poi nessuno ritrova quando serve.
alter table haccp_non_conformities drop constraint if exists haccp_non_conformities_category_check;
alter table haccp_non_conformities add constraint haccp_non_conformities_category_check
  check (category in ('temperatura', 'ricevimento', 'pulizia', 'disinfestazione', 'scadenza', 'altro'));

-- Categoria B4: tre tabelle in una transazione sola. «Buttata» scrive da
-- se' la riga nel registro delle non conformita' — un'ispezione la
-- guarda, e ricordarsene dopo non funziona mai.
create or replace function chiudi_partita(
  p_lotto_id uuid,
  p_come     text,
  p_note     text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $funzione$
declare
  v_lotto record;
  v_nome  text;
  v_unita text;
  v_nc    uuid;
begin
  if p_come is null or p_come not in ('finita', 'buttata') then
    raise exception 'Si puo'' solo chiudere una partita come «finita» o «buttata»';
  end if;

  select * into v_lotto from stock_lots where id = p_lotto_id for update;
  if not found then
    raise exception 'Questa partita non esiste piu''';
  end if;
  if v_lotto.quantity_remaining <= 0 or v_lotto.chiusa_il is not null then
    raise exception 'Questa partita e'' gia'' chiusa';
  end if;

  select name, unit::text into v_nome, v_unita from ingredients where id = v_lotto.ingredient_id;

  -- Il residuo esce dal magazzino come un movimento vero, non sparendo:
  -- una giacenza che cala senza lasciare traccia e' una giacenza di cui
  -- non ci si fida piu'.
  insert into stock_consumptions (ingredient_id, quantity, reason, note)
  values (
    v_lotto.ingredient_id,
    v_lotto.quantity_remaining,
    case when p_come = 'finita' then 'consumo' else 'spreco' end,
    nullif(concat_ws(' — ',
      case when p_come = 'finita' then 'Partita finita' else 'Partita buttata' end,
      nullif(p_note, ''),
      nullif(v_lotto.supplier_batch_number, '')), '')
  );

  if p_come = 'buttata' then
    insert into haccp_non_conformities (category, description, detected_at, corrective_action, resolved, resolved_at, note)
    values (
      'scadenza',
      'Prodotto eliminato: ' || coalesce(v_nome, 'sconosciuto')
        || ' — ' || trim(to_char(v_lotto.quantity_remaining, 'FM9999990.00')) || ' ' || coalesce(v_unita, '')
        || coalesce(' — scadenza ' || to_char(v_lotto.expiry_date, 'DD/MM/YYYY'), '')
        || coalesce(' — lotto ' || nullif(v_lotto.supplier_batch_number, ''), ''),
      now(),
      'Prodotto rimosso dalla giacenza ed eliminato',
      true,
      now(),
      nullif(p_note, '')
    )
    returning id into v_nc;
  end if;

  update stock_lots
     set quantity_remaining = 0,
         chiusa_il          = now(),
         chiusura           = p_come,
         motivo_chiusura    = nullif(p_note, '')
   where id = p_lotto_id;

  return jsonb_build_object(
    'lotto_id', p_lotto_id,
    'come', p_come,
    'quantita_uscita', v_lotto.quantity_remaining,
    'non_conformita_id', v_nc);
end
$funzione$;

comment on function chiudi_partita(uuid, text, text) is
  'Chiude una partita di magazzino come «finita» o «buttata», in una transazione sola: il residuo esce come movimento e, se buttata, nasce la riga nel registro delle non conformita''.';

revoke all on function chiudi_partita(uuid, text, text) from public, anon, authenticated;
grant execute on function chiudi_partita(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- 5. Il messaggio delle 10:00 — costruito qui, spedito altrove
-- ---------------------------------------------------------------------
-- Decisione separata dall'invio, come per il freno e per l'email di
-- conferma: cosi' la verifica in fondo puo' leggere il messaggio senza
-- farlo arrivare sul telefono di Alessio.
create or replace function messaggio_scadenze()
returns text
language plpgsql
stable
set search_path = public
as $funzione$
declare
  v_oggi     date := (now() at time zone 'Europe/Rome')::date;
  v_r        record;
  v_scadute  integer := 0;
  v_arrivo   integer := 0;
  v_mostrate integer := 0;
  v_testo    text := '';
  v_totale   integer;
begin
  select count(*) filter (where giorni_mancanti < 0),
         count(*) filter (where giorni_mancanti >= 0)
    into v_scadute, v_arrivo
    from partite_in_scadenza() where da_segnalare;

  v_totale := v_scadute + v_arrivo;
  if v_totale = 0 then
    return null;  -- Niente da dire: non si manda niente. Un messaggio
                  -- «oggi nulla» ogni mattina si impara a saltare.
  end if;

  -- Prima le scadute, che sono quelle da togliere adesso.
  for v_r in
    select * from partite_in_scadenza() where da_segnalare
     order by giorni_mancanti, ingrediente
  loop
    exit when v_mostrate >= 5;
    v_testo := v_testo || '· ' || v_r.ingrediente
      || ' — ' || trim(to_char(v_r.quantita, 'FM9999990.00')) || ' ' || coalesce(v_r.unita, '')
      || ' — ' || case
           when v_r.giorni_mancanti < 0 then 'SCADUTO il ' || to_char(v_r.scadenza, 'DD/MM')
           when v_r.giorni_mancanti = 0 then 'scade OGGI'
           when v_r.giorni_mancanti = 1 then 'scade domani'
           else 'scade fra ' || v_r.giorni_mancanti || ' giorni (' || to_char(v_r.scadenza, 'DD/MM') || ')'
         end
      || coalesce(' — lotto ' || nullif(v_r.lotto_fornitore, ''), '')
      || E'\n';
    v_mostrate := v_mostrate + 1;
  end loop;

  if v_totale > v_mostrate then
    v_testo := v_testo || '· e altri ' || (v_totale - v_mostrate) || E'\n';
  end if;

  return 'In magazzino, al ' || to_char(v_oggi, 'DD/MM/YYYY') || ': '
      || case when v_scadute > 0 then v_scadute || ' gia'' scaduti' else '' end
      || case when v_scadute > 0 and v_arrivo > 0 then ', ' else '' end
      || case when v_arrivo > 0 then v_arrivo || ' in scadenza' else '' end
      || E'.\n\n' || v_testo;
end
$funzione$;

comment on function messaggio_scadenze() is
  'Il testo del messaggio delle 10:00, o NULL se non c''e'' niente da dire. Non spedisce: si puo'' provare senza far suonare nessun telefono.';

revoke all on function messaggio_scadenze() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 6. Il lavoro delle 10:00
-- ---------------------------------------------------------------------
create or replace function avvisa_scadenze()
returns jsonb
language plpgsql
security definer
set search_path = public
as $funzione$
declare
  v_ora   integer := extract(hour from (now() at time zone 'Europe/Rome'))::integer;
  v_oggi  date    := (now() at time zone 'Europe/Rome')::date;
  v_testo text;
begin
  -- pg_cron ragiona in UTC e l'Italia cambia ora due volte l'anno: il
  -- lavoro e' programmato alle 8 E alle 9 UTC, e passa solo quella delle
  -- due che cade davvero alle 10 di mattina qui. Senza questo, mezzo
  -- anno il messaggio arriverebbe alle 11.
  if v_ora <> 10 then
    return jsonb_build_object('saltato', true, 'ora_locale', v_ora);
  end if;

  v_testo := messaggio_scadenze();

  if v_testo is not null then
    perform segnala_allarme(
      'scadenze_' || v_oggi::text,
      v_testo,
      jsonb_build_object('giorno', v_oggi),
      'scadenze');
  end if;

  -- Il battito si scrive anche quando non c'era niente da dire: una
  -- giornata senza scadenze non e' un guasto, e la sentinella non deve
  -- confonderla con un lavoro fermo.
  insert into stato_lavori (nome, ultimo_successo)
  values ('scadenze', now())
  on conflict (nome) do update set ultimo_successo = now();

  return jsonb_build_object('inviato', v_testo is not null, 'giorno', v_oggi);
end
$funzione$;

comment on function avvisa_scadenze() is
  'Il messaggio delle 10:00 sulle scadenze. Programmato alle 8 e alle 9 UTC, passa solo quello che cade alle 10 locali (ora legale).';

revoke all on function avvisa_scadenze() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 7. Programmazione, e la sentinella che la sorveglia
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from cron.job where jobname = 'avviso-scadenze') then
    perform cron.schedule('avviso-scadenze', '0 8,9 * * *', $cron$select avvisa_scadenze();$cron$);
  end if;
end
$$;

-- Un lavoro pianificato che nessuno sorveglia e' un lavoro che si ferma
-- in silenzio: il censimento della sentinella lo pretende in tabella.
insert into lavori_sorvegliati (nome_lavoro, nome_cron, tolleranza_minuti, cosa_smette)
values ('scadenze', 'avviso-scadenze', 1560,
        'Il messaggio del mattino sulle scadenze non parte piu'': prodotti scaduti restano in cella senza che nessuno lo dica.')
on conflict (nome_lavoro) do update
  set nome_cron = excluded.nome_cron,
      tolleranza_minuti = excluded.tolleranza_minuti,
      cosa_smette = excluded.cosa_smette;

insert into stato_lavori (nome, ultimo_successo)
values ('scadenze', now())
on conflict (nome) do nothing;

-- ---------------------------------------------------------------------
-- 8. Verifica (§7 punti 1-3) — e non parte nemmeno un messaggio
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_ente  uuid;
  v_forn  uuid;
  v_ing   uuid;
  v_ing2  uuid;
  v_vecchia uuid;
  v_nuova   uuid;
  v_r     record;
  v_testo text;
  n       integer;
begin
  select id into v_ente from entities order by created_at limit 1;
  if v_ente is null then raise exception 'Nessuna entita''.'; end if;

  -- 1. Il preavviso proposto.
  if preavviso_giorni(null, null, 'frigo_0_4') <> 2 then
    raise exception 'Il fresco non prende 2 giorni di preavviso.';
  end if;
  if preavviso_giorni(null, null, 'dispensa') <> 14 then
    raise exception 'La dispensa non prende 14 giorni di preavviso.';
  end if;
  if preavviso_giorni(null, 3, 'dispensa') <> 2 then
    raise exception 'Un prodotto che dura 3 giorni deve avvisare a 2, ovunque si conservi.';
  end if;
  if preavviso_giorni(30, 3, 'frigo_0_4') <> 30 then
    raise exception 'La scelta di Alessio non prevale su quella proposta.';
  end if;
  if preavviso_giorni(0, null, 'dispensa') <> 0 then
    raise exception 'Zero giorni di preavviso deve restare zero, non diventare il valore proposto.';
  end if;

  insert into suppliers (entity_id, name, category)
  values (v_ente, 'PROVA SCAD fornitore', 'ortofrutta') returning id into v_forn;
  insert into ingredients (entity_id, name, category, unit, storage_type)
  values (v_ente, 'PROVA SCAD ricotta', 'latticini', 'kg', 'frigo_0_4') returning id into v_ing;
  insert into ingredients (entity_id, name, category, unit, storage_type)
  values (v_ente, 'PROVA SCAD semola', 'farine_cereali', 'kg', 'dispensa') returning id into v_ing2;

  -- 2. Una partita che scade fra un giorno: si segnala.
  insert into stock_lots (ingredient_id, supplier_id, quantity_received, quantity_remaining,
                          expiry_date, received_at, supplier_batch_number)
  values (v_ing, v_forn, 4, 4, ((now() at time zone 'Europe/Rome')::date + 1), now() - interval '2 days', 'PROVA-A')
  returning id into v_vecchia;

  select * into v_r from partite_in_scadenza() where lotto_id = v_vecchia;
  if not v_r.da_segnalare then
    raise exception 'Una ricotta che scade domani non viene segnalata (motivo: %).', v_r.perche_muta;
  end if;

  -- 3. LA REGOLA DI ALESSIO: entra una partita nuova, la vecchia tace.
  insert into stock_lots (ingredient_id, supplier_id, quantity_received, quantity_remaining,
                          expiry_date, received_at)
  values (v_ing, v_forn, 6, 6, ((now() at time zone 'Europe/Rome')::date + 20), now())
  returning id into v_nuova;

  select * into v_r from partite_in_scadenza() where lotto_id = v_vecchia;
  if v_r.da_segnalare then
    raise exception 'Con una partita piu'' recente in giacenza, la vecchia deve tacere.';
  end if;
  if v_r.perche_muta not like '%piu'' recente%' then
    raise exception 'La schermata non spiega perche'' tace: «%».', v_r.perche_muta;
  end if;

  -- 4. ...ma se la partita nuova e' finita, la vecchia torna a parlare:
  --    il prodotto non gira piu', ed e' proprio il caso che serve.
  update stock_lots set quantity_remaining = 0 where id = v_nuova;
  select * into v_r from partite_in_scadenza() where lotto_id = v_vecchia;
  if not v_r.da_segnalare then
    raise exception 'Esaurita la partita nuova, la vecchia deve tornare a segnalarsi.';
  end if;
  update stock_lots set quantity_remaining = 6 where id = v_nuova;

  -- 5. Una partita lontana dalla scadenza compare, ma muta e col motivo.
  select * into v_r from partite_in_scadenza() where lotto_id = v_nuova;
  if v_r.da_segnalare then
    raise exception 'Una partita che scade fra 20 giorni non deve essere segnalata.';
  end if;
  if v_r.perche_muta not like '%mancano piu%' then
    raise exception 'Manca il motivo del silenzio per una scadenza lontana: «%».', v_r.perche_muta;
  end if;

  -- 6. Senza data di scadenza non esiste per lo scadenziario (i vegetali).
  insert into stock_lots (ingredient_id, supplier_id, quantity_received, quantity_remaining, received_at)
  values (v_ing2, v_forn, 25, 25, now());
  select count(*) into n from partite_in_scadenza() p
    join stock_lots l on l.id = p.lotto_id
   where l.ingredient_id = v_ing2;
  if n <> 0 then
    raise exception 'Una partita senza scadenza e'' finita nello scadenziario.';
  end if;

  -- 7. Il messaggio si legge, e nomina il prodotto.
  --    Si esaurisce la partita nuova, altrimenti — giustamente — la
  --    vecchia resta muta e non ci sarebbe niente da scrivere.
  update stock_lots set quantity_remaining = 0 where id = v_nuova;
  v_testo := messaggio_scadenze();
  if v_testo is null or v_testo not like '%PROVA SCAD ricotta%' then
    raise exception 'Il messaggio non contiene la partita da segnalare: «%».', coalesce(v_testo, 'NULL');
  end if;
  if v_testo not like '%scade domani%' then
    raise exception 'Il messaggio non dice quando scade: «%».', v_testo;
  end if;
  update stock_lots set quantity_remaining = 6 where id = v_nuova;

  -- 8. «Buttata»: il residuo esce e nasce la riga nel registro HACCP.
  select count(*) into n from haccp_non_conformities where category = 'scadenza';
  perform chiudi_partita(v_vecchia, 'buttata', 'prova');
  select quantity_remaining, chiusura into v_r from stock_lots where id = v_vecchia;
  if v_r.quantity_remaining <> 0 or v_r.chiusura is distinct from 'buttata' then
    raise exception 'La partita buttata non risulta chiusa.';
  end if;
  select count(*) into n from haccp_non_conformities
   where category = 'scadenza' and description like '%PROVA SCAD ricotta%';
  if n <> 1 then
    raise exception 'Buttare una partita non ha lasciato la riga nel registro HACCP (trovate %).', n;
  end if;
  select count(*) into n from stock_consumptions
   where ingredient_id = v_ing and reason = 'spreco';
  if n <> 1 then
    raise exception 'Il residuo buttato non e'' uscito dal magazzino come movimento.';
  end if;

  -- 9. Una partita gia' chiusa non si richiude.
  begin
    perform chiudi_partita(v_vecchia, 'buttata', null);
    raise exception 'Una partita gia'' chiusa e'' stata chiusa due volte.';
  exception when sqlstate 'P0001' then
    if sqlerrm not like '%gia%chiusa%' then
      raise exception 'Rifiuto inatteso: %', sqlerrm;
    end if;
  end;

  -- 10. «Finita» non sporca il registro delle non conformita': usare un
  --     prodotto non e' un evento HACCP, e un registro pieno di righe
  --     normali e' un registro che l'ispettore smette di leggere.
  perform chiudi_partita(v_nuova, 'finita', null);
  select count(*) into n from haccp_non_conformities
   where category = 'scadenza' and description like '%PROVA SCAD%';
  if n <> 1 then
    raise exception 'Chiudere una partita come «finita» ha scritto nel registro HACCP.';
  end if;

  -- 11. Il lavoro e' programmato e sorvegliato, nei due versi.
  select count(*) into n from cron.job where jobname = 'avviso-scadenze';
  if n <> 1 then raise exception 'Il lavoro delle scadenze non risulta programmato.'; end if;
  select count(*) into n from lavori_sorvegliati where nome_cron = 'avviso-scadenze';
  if n <> 1 then raise exception 'Il lavoro delle scadenze non e'' sorvegliato dalla sentinella.'; end if;

  -- 12. Fuori dalle 10 locali non fa niente e non manda niente.
  if extract(hour from (now() at time zone 'Europe/Rome'))::integer <> 10 then
    if coalesce((avvisa_scadenze()->>'saltato')::boolean, false) is not true then
      raise exception 'Il lavoro ha agito fuori dall''orario stabilito.';
    end if;
  end if;

  -- 13. Pulizia (regola del 12/08).
  delete from haccp_non_conformities where description like '%PROVA SCAD%';
  delete from stock_consumptions where ingredient_id in (v_ing, v_ing2);
  delete from stock_lots where ingredient_id in (v_ing, v_ing2);
  delete from price_history where ingredient_id in (v_ing, v_ing2);
  delete from ingredients where id in (v_ing, v_ing2);
  delete from suppliers where id = v_forn;

  select count(*) into n from ingredients where name like 'PROVA SCAD%';
  if n <> 0 then raise exception 'La prova ha lasciato % ingredienti.', n; end if;
  select count(*) into n from haccp_non_conformities where description like '%PROVA SCAD%';
  if n <> 0 then raise exception 'La prova ha lasciato % righe nel registro HACCP.', n; end if;

  raise notice 'Scadenziario: si segnala solo cio'' che sta fermo, un messaggio al giorno alle 10.';
end
$verifica$;

insert into applied_migrations (version, name)
values ('20260813000004', 'scadenziario')
on conflict (version) do nothing;

select count(*) filter (where da_segnalare) as da_segnalare_oggi,
       count(*)                            as partite_con_scadenza
  from partite_in_scadenza();
