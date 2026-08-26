-- ============================================================================
-- LA CAPARRA ENTRA IN CASSA — 26/08/2026
-- ============================================================================
--
-- 🔴 IL DIFETTO, misurato il 26/08 e non dedotto: il campo «Caparra €» della
--    scheda prenotazione scriveva un numero in `reservation_deposits` e
--    finiva li'. Zero trigger sulla tabella, zero funzioni del database che
--    la nominano — contro le 18 che nominano `cash_movements` e le 18 che
--    nominano `reservations`, quindi lo zero non era dello strumento.
--    **Nessun movimento di cassa nasceva. Mai.** Sul progetto di prova: 3
--    caparre su 3 senza movimento, 245,00 euro che il cassetto non ha mai
--    visto. Sul gestionale vero: zero caparre, quindi oggi non morde — e
--    avrebbe morso al primo evento vero.
--
-- ⚠️ DECISIONE DI ALESSIO DEL 26/08: la caparra entra in cassa **nel momento
--    in cui la ricevi**, non alla serata. Il cliente ha versato denaro
--    davvero: il cassetto lo sa subito.
--
-- ----------------------------------------------------------------------------
-- IL LEGAME NELLE DUE DIREZIONI, e perche' va COSTRUITO
-- ----------------------------------------------------------------------------
-- `reservation_deposits` ha tre sole colonne — `reservation_id`, `amount`,
-- `created_at` — e **nessun identificativo proprio**: la sua chiave primaria
-- E' la prenotazione. Quindi:
--   · dal movimento alla prenotazione → `cash_movements.reservation_id`;
--   · dalla caparra al movimento      → `reservation_deposits.movimento_id`.
-- E' la stessa forma di `prestiti_privati.movimento_id`, che regge dal 22/08.
--
-- 🔴 E IL VERSO DELLA PRIVACY E' IL PUNTO DELICATO. La pulizia notturna
--    cancella le prenotazioni rifiutate o annullate dopo sei mesi, e
--    `reservation_deposits` le sparisce dietro a cascata. Prima di oggi
--    spariva **il denaro**. Da oggi no: il movimento di cassa non e' figlio
--    di nessuna prenotazione, quindi resta.
--
-- ⚠️ Ma «resta» non basta: un movimento rimasto senza riferimento sarebbe un
--    incasso che nessuno sa spiegare — il problema spostato, non risolto. Per
--    questo la chiave esterna e' `on delete set null` **e accanto c'e'
--    `caparra_evento_il`, la data dell'evento FOTOGRAFATA**. Non e' un dato
--    personale (nessun nome, nessun telefono), quindi sopravvive alla pulizia
--    senza riaprire la porta che la privacy chiude, e la riga in prima nota
--    continua a dire «caparra per un evento del …» invece di tacere.
--
-- ⚠️ E lo stato di «gia' usata» andra' messo sul MOVIMENTO, non sulla
--    caparra: la caparra puo' sparire con la prenotazione, il movimento no.
--
-- ----------------------------------------------------------------------------
-- IL BONIFICO: SCRITTO ADESSO, SPENTO FINCHE' NON C'E' UN CONTO
-- ----------------------------------------------------------------------------
-- `registra_caparra` accetta `p_mezzo`. Con 'banca' servono due cose, e sono
-- **due lucchetti indipendenti**:
--   1. il vincolo `movimento_di_banca_ha_un_conto` gia' nel database, che
--      rifiuta un movimento di banca senza `conto_id`;
--   2. la funzione, che se non trova nessun conto corrente si ferma **con una
--      frase che dice perche'**, invece di lasciare parlare il vincolo.
--
-- ⚠️ NON E' UN INTERRUTTORE DA RICORDARSI DI GIRARE: la funzione guarda
--    `conti_bancari`. Oggi sono zero e il bonifico e' spento; il giorno che
--    Alessio registra il suo conto **si accende da solo**, e nessuno deve
--    riaprire questo cantiere. E finche' il conto e' uno lo mette il
--    gestionale da se' — decisione sua del 25/08, gia' in vigore sui
--    movimenti di banca.
--
-- ----------------------------------------------------------------------------
-- TOGLIERE UNA CAPARRA STORNA, E LO DICE
-- ----------------------------------------------------------------------------
-- Regola del 16/08: un documento che ha generato un effetto o e' respinto o
-- storna l'effetto nella stessa transazione — non esiste il terzo caso.
-- Qui l'effetto e' **un movimento di cassa**, quindi togliere la caparra
-- toglie anche il movimento, e la funzione restituisce di quanto scende il
-- saldo. La frase si compone PRIMA di cancellare: dopo, la cascata se l'e'
-- portata via.
--
-- ----------------------------------------------------------------------------
-- COSA ABBIAMO ROVESCIATO
-- ----------------------------------------------------------------------------
-- Niente di deciso. Il campo «Caparra €» non era una scelta di lasciare i
-- soldi fuori dalla cassa: era meta' lavoro, e nessuna consegna l'ha mai
-- dichiarata come scelta. ⚠️ Cambia pero' una cosa che valeva di fatto:
-- `setReservationDeposit` scriveva **dritta dal browser**, e adesso passa dal
-- corridoio — perche' da oggi tocca due tabelle (regola B4 del Contratto).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Le due colonne del legame
-- ----------------------------------------------------------------------------
alter table cash_movements
  add column if not exists reservation_id uuid references reservations(id) on delete set null;
alter table cash_movements
  add column if not exists caparra_evento_il date;

comment on column cash_movements.reservation_id is
  'La prenotazione per cui e'' stata ricevuta questa caparra. `on delete set null` APPOSTA: la pulizia notturna della privacy cancella le prenotazioni rifiutate dopo sei mesi, e il denaro non deve sparire con loro. Vuoto su tutti i movimenti che non sono caparre.';
comment on column cash_movements.caparra_evento_il is
  'La data dell''evento, FOTOGRAFATA quando la caparra entra. Sopravvive alla pulizia della privacy — non e'' un dato personale — cosi'' un movimento rimasto senza prenotazione continua a dire di che evento era, invece di essere un incasso che nessuno sa spiegare.';

create index if not exists idx_cash_movements_reservation on cash_movements (reservation_id)
  where reservation_id is not null;

alter table reservation_deposits
  add column if not exists movimento_id uuid references cash_movements(id) on delete restrict;

comment on column reservation_deposits.movimento_id is
  'Il movimento di cassa nato con questa caparra. `restrict` APPOSTA: nemmeno l''effetto sparisce lasciando il documento a dichiarare qualcosa che non e'' avvenuto (regola del 16/08/2026). Stessa forma di `prestiti_privati.movimento_id`.';

-- ----------------------------------------------------------------------------
-- 2. La causale, che non esisteva
-- ----------------------------------------------------------------------------
-- ⚠️ Misurato prima: fra le 17 causali non ce n'era NESSUNA che nominasse una
--    caparra. Non era «scritta con la causale sbagliata»: non c'era dove
--    scriverla. Nasce `di_sistema`, come le altre quattro del gestionale: non
--    si spegne e non si marca «costo fisso».
insert into cash_causali (label, kind, active, di_sistema)
select 'Caparra ricevuta', 'entrata', true, true
 where not exists (select 1 from cash_causali where label = 'Caparra ricevuta');

-- ----------------------------------------------------------------------------
-- 3. Registrare una caparra
-- ----------------------------------------------------------------------------
create or replace function registra_caparra(
  p_reservation_id uuid,
  p_importo        numeric,
  p_mezzo          text default 'cassa',
  p_conto_id       uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $funzione$
declare
  v_ent      uuid;
  v_data     date;
  v_caus     uuid;
  v_conto    uuid := p_conto_id;
  v_quanti   integer;
  v_mov      uuid;
  v_prima    numeric;
begin
  -- La caparra e' un dato commerciale (§3.5): la scheda la mostra al solo
  -- titolare, e il portiere sta qui perche' `security definer` scavalca la RLS.
  if not (select is_titolare()) then
    raise exception 'Le caparre le registra il titolare.';
  end if;

  if p_importo is null or p_importo <= 0 then
    raise exception 'Una caparra di zero euro non e'' una caparra: o c''e'' un importo, o non si registra.';
  end if;

  select reservation_date into v_data from reservations where id = p_reservation_id;
  if v_data is null then
    raise exception 'Questa prenotazione non esiste (o e'' stata cancellata): la caparra non si puo'' agganciare a niente.';
  end if;

  if p_mezzo not in ('cassa', 'banca') then
    raise exception 'Una caparra si riceve in contanti o in banca, non in «%».', p_mezzo;
  end if;

  -- ⚠️ IL BONIFICO E' SPENTO FINCHE' NON C'E' UN CONTO, e si accende da se'.
  if p_mezzo = 'banca' then
    select count(*) into v_quanti from conti_bancari;
    if v_quanti = 0 then
      raise exception 'La caparra per bonifico non si puo'' ancora registrare: non c''e'' nessun conto corrente nel gestionale. Registrane uno da Cassa → Conti correnti, poi torna qui.';
    end if;
    if v_conto is null then
      if v_quanti = 1 then
        select id into v_conto from conti_bancari;   -- finche' il conto e' uno lo mette il gestionale (25/08)
      else
        raise exception 'Ci sono % conti correnti: dimmi su quale e'' arrivata la caparra.', v_quanti;
      end if;
    end if;
  else
    v_conto := null;   -- un movimento in contanti non ha un conto
  end if;

  select id into v_ent from entities where entity_type = 'srls' limit 1;
  select id into v_caus from cash_causali where label = 'Caparra ricevuta';

  select d.movimento_id, d.amount into v_mov, v_prima
    from reservation_deposits d where d.reservation_id = p_reservation_id;

  if v_mov is not null then
    -- Correggere l'importo di una caparra gia' presa e' un gesto legittimo:
    -- si sposta il numero in TUTTI E DUE i posti, mai in uno solo.
    update cash_movements
       set amount = p_importo, mezzo = p_mezzo, conto_id = v_conto,
           caparra_evento_il = v_data, reservation_id = p_reservation_id
     where id = v_mov;
    update reservation_deposits set amount = p_importo where reservation_id = p_reservation_id;
    return jsonb_build_object(
      'movimento_id', v_mov, 'corretta', true,
      'messaggio', 'Caparra corretta da ' || euro(v_prima) || ' a ' || euro(p_importo) ||
                   ': anche il movimento in cassa e'' stato aggiornato.');
  end if;

  insert into cash_movements (entity_id, direction, amount, movement_date, causale_id,
                              mezzo, conto_id, note, reservation_id, caparra_evento_il)
  values (v_ent, 'entrata', p_importo, serata_di_servizio(), v_caus,
          p_mezzo, v_conto, 'Caparra per l''evento del ' || to_char(v_data, 'DD/MM/YYYY'),
          p_reservation_id, v_data)
  returning id into v_mov;

  insert into reservation_deposits (reservation_id, amount, movimento_id)
  values (p_reservation_id, p_importo, v_mov)
  on conflict (reservation_id) do update
    set amount = excluded.amount, movimento_id = excluded.movimento_id;

  return jsonb_build_object(
    'movimento_id', v_mov, 'corretta', false,
    'messaggio', 'Caparra di ' || euro(p_importo) || ' registrata: e'' entrata ' ||
                 case when p_mezzo = 'banca' then 'in banca' else 'in cassa' end ||
                 ' con la causale «Caparra ricevuta».');
end;
$funzione$;

comment on function registra_caparra(uuid, numeric, text, uuid) is
  'Registra una caparra E il movimento di cassa che ne nasce, in una transazione sola. Decisione di Alessio del 26/08/2026: la caparra entra in cassa nel momento in cui la ricevi. Il bonifico si accende da se'' il giorno che esiste un conto corrente.';

revoke all on function registra_caparra(uuid, numeric, text, uuid) from public, anon, authenticated;
grant execute on function registra_caparra(uuid, numeric, text, uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 4. Togliere una caparra: storna, e lo dice
-- ----------------------------------------------------------------------------
create or replace function togli_caparra(p_reservation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $funzione$
declare
  v_mov  uuid;
  v_imp  numeric;
  v_dove text;
begin
  if not (select is_titolare()) then
    raise exception 'Le caparre le toglie il titolare.';
  end if;

  select d.movimento_id, d.amount into v_mov, v_imp
    from reservation_deposits d where d.reservation_id = p_reservation_id;

  if not found then
    return jsonb_build_object('tolta', false, 'messaggio', 'Su questa prenotazione non c''era nessuna caparra.');
  end if;

  -- ⚠️ La frase si compone PRIMA di cancellare: dopo, la riga non c'e' piu'
  --    e il numero da dire non si saprebbe da dove prenderlo.
  select case when m.mezzo = 'banca' then 'dalla banca' else 'dalla cassa' end
    into v_dove from cash_movements m where m.id = v_mov;

  delete from reservation_deposits where reservation_id = p_reservation_id;
  if v_mov is not null then
    delete from cash_movements where id = v_mov;
  end if;

  return jsonb_build_object(
    'tolta', true, 'importo', v_imp,
    'messaggio', case
      when v_mov is null then 'Caparra di ' || euro(v_imp) || ' tolta. Non aveva nessun movimento di cassa da stornare.'
      else 'Caparra di ' || euro(v_imp) || ' tolta, e con lei il movimento: ' ||
           coalesce(v_dove, 'dalla cassa') || ' escono ' || euro(v_imp) || '.'
    end);
end;
$funzione$;

comment on function togli_caparra(uuid) is
  'Toglie una caparra E storna il movimento di cassa che ne era nato, nella stessa transazione (regola del 16/08/2026). Dice di quanto scende il saldo: un effetto stornato che nessuno annuncia e'' indistinguibile da un numero che cambia da solo.';

revoke all on function togli_caparra(uuid) from public, anon, authenticated;
grant execute on function togli_caparra(uuid) to authenticated;

-- ============================================================================
-- VERIFICA
-- ============================================================================
-- 🔴 SI GIUDICA DAI FALLIMENTI, e i casi sono quelli chiesti dal mandato:
--    la caparra registrata deve produrre il movimento con la SUA causale;
--    una da zero euro deve essere RESPINTA; cancellata la prenotazione, si
--    guarda cosa resta in cassa e cosa resta nel registro delle
--    cancellazioni — perche' «il denaro resta» e' precisamente cio' che non
--    si da' per fatto.
do $verifica$
declare
  v_foto  jsonb;
  v_ent   uuid;
  v_res   uuid;
  v_mov   uuid;
  v_r     jsonb;
  v_cas0  integer;
  v_cas1  integer;
  v_lap0  integer;
  v_lap1  integer;
  v_dep   integer;
  v_lab   text;
  v_data  date;
  v_resid uuid;
  -- ⚠️ OGNI movimento creato qui, per nome. Una variabile riusata non e' un
  --    promemoria: e' l'ultimo valore che ci e' passato dentro.
  v_movs  text[] := '{}';
begin
  v_foto := foto_righe();
  select id into v_ent from entities where entity_type = 'srls' limit 1;

  -- Impersona il titolare: le due funzioni hanno un portiere, e una
  -- migrazione gira come proprietaria — `auth.uid()` sarebbe vuoto.
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select user_id from user_roles where role = 'titolare' limit 1))::text, true);

  select count(*) into v_cas0 from cash_movements;
  select count(*) into v_lap0 from deleted_records;

  -- ---- roba propria ------------------------------------------------------
  insert into reservations (customer_name, reservation_date, reservation_time, party_size, status, source)
  values ('VERIFICA caparra 26/08', current_date + 30, '20:30', 8, 'confermata', 'interno')
  returning id into v_res;

  -- ---- (a) una caparra a zero euro e' RESPINTA ---------------------------
  begin
    perform registra_caparra(v_res, 0);
    raise exception 'Una caparra da zero euro e'' stata accettata, e non doveva.';
  exception when others then
    if sqlerrm not like '%non e%una caparra%' then raise; end if;
  end;

  -- ---- (b) IL BONIFICO, e le due facce dello stesso interruttore ---------
  -- ⚠️ Quale delle due si prova DIPENDE DAL DATABASE, ed e' voluto: sul
  --    gestionale vero i conti correnti sono zero e si prova che il bonifico
  --    e' SPENTO; sul progetto di prova un conto c'e', e si prova che si
  --    ACCENDE DA SE' e sceglie il conto senza chiederlo. Un interruttore che
  --    dipende dallo stato non si puo' provare in un solo posto — e fra i due
  --    database tutt'e due i versi vengono esercitati davvero.
  if (select count(*) from conti_bancari) = 0 then
    begin
      perform registra_caparra(v_res, 80, 'banca');
      raise exception 'Una caparra per bonifico e'' passata senza nessun conto corrente.';
    exception when others then
      if sqlerrm not like '%nessun conto corrente%' then raise; end if;
    end;
    raise notice 'bonifico SPENTO: zero conti correnti, la caparra in banca e'' stata respinta con la sua frase';
  else
    v_r := registra_caparra(v_res, 80, 'banca');
    v_mov := (v_r ->> 'movimento_id')::uuid;
    v_movs := v_movs || v_mov::text;
    if (select conto_id from cash_movements where id = v_mov) is null then
      raise exception 'Caparra in banca registrata senza conto: il vincolo del database avrebbe dovuto respingerla.';
    end if;
    raise notice 'bonifico ACCESO: % conti correnti, il gestionale ha scelto il conto da se''',
      (select count(*) from conti_bancari);
    perform togli_caparra(v_res);
    v_mov := null;
  end if;

  -- ---- (c) la caparra vera: nasce il movimento con la sua causale -------
  v_r := registra_caparra(v_res, 80);
  v_mov := (v_r ->> 'movimento_id')::uuid;
  v_movs := v_movs || v_mov::text;

  select c.label, m.caparra_evento_il into v_lab, v_data
    from cash_movements m join cash_causali c on c.id = m.causale_id where m.id = v_mov;
  if v_lab is distinct from 'Caparra ricevuta' then
    raise exception 'Il movimento della caparra ha la causale «%» invece di «Caparra ricevuta».', coalesce(v_lab, '(nessuna)');
  end if;
  if v_data is distinct from (current_date + 30) then
    raise exception 'La data dell''evento non e'' stata fotografata sul movimento.';
  end if;

  select count(*) into v_cas1 from cash_movements;
  if v_cas1 <> v_cas0 + 1 then
    raise exception 'Registrata una caparra e i movimenti sono passati da % a %.', v_cas0, v_cas1;
  end if;

  -- il legame regge nelle DUE direzioni
  if (select movimento_id from reservation_deposits where reservation_id = v_res) is distinct from v_mov then
    raise exception 'Dalla caparra non si risale al movimento.';
  end if;
  if (select reservation_id from cash_movements where id = v_mov) is distinct from v_res then
    raise exception 'Dal movimento non si risale alla prenotazione.';
  end if;
  raise notice 'caparra registrata: movimenti % -> %, causale «%», evento del %', v_cas0, v_cas1, v_lab, v_data;

  -- ---- (d) correggere l'importo sposta TUTTI E DUE i numeri --------------
  v_r := registra_caparra(v_res, 95);
  if (v_r ->> 'corretta')::boolean is not true then
    raise exception 'La seconda registrazione ha creato una caparra nuova invece di correggere quella che c''era.';
  end if;
  if (select amount from cash_movements where id = v_mov) <> 95 then
    raise exception 'Corretta la caparra, il movimento di cassa e'' rimasto al vecchio importo.';
  end if;
  if (select count(*) from cash_movements) <> v_cas0 + 1 then
    raise exception 'Correggere una caparra ha creato un secondo movimento.';
  end if;

  -- ---- (e) CANCELLATA LA PRENOTAZIONE: il denaro RESTA -------------------
  --      E' il punto che il mandato dice di verificare e non dare per fatto.
  delete from reservations where id = v_res;

  select count(*) into v_dep from reservation_deposits where reservation_id = v_res;
  if v_dep <> 0 then
    raise exception 'Cancellata la prenotazione, la caparra e'' rimasta appesa.';
  end if;

  if not exists (select 1 from cash_movements where id = v_mov) then
    raise exception 'IL DENARO E'' SPARITO con la prenotazione: il movimento di cassa non c''e'' piu''.';
  end if;
  if (select reservation_id from cash_movements where id = v_mov) is not null then
    raise exception 'La prenotazione non esiste piu'' e il movimento la nomina ancora.';
  end if;
  if (select caparra_evento_il from cash_movements where id = v_mov) is distinct from (current_date + 30) then
    raise exception 'Persa la prenotazione, il movimento non sa piu'' di che evento era.';
  end if;

  select count(*) into v_lap1 from deleted_records;
  raise notice 'cancellata la prenotazione: il movimento RESTA (% euro), il riferimento si svuota, la data dell''evento resta. Lapidi % -> %',
    (select amount from cash_movements where id = v_mov), v_lap0, v_lap1;

  -- ---- pulizia: solo cio' che questa verifica ha creato -------------------
  -- ⚠️ `cash_movements` E' UNA TABELLA TRACCIATA: ogni movimento che questa
  --    verifica cancella lascia la sua lapide — compreso quello stornato da
  --    `togli_caparra` nel ramo del bonifico, che alla prima stesura mi era
  --    sfuggito. A prenderlo e' stato il guardiano dei residui, non una
  --    rilettura. Si tolgono TUTTI, per identificativo, dall'elenco.
  delete from cash_movements where id::text = any(v_movs);
  delete from deleted_records where record_id = any(v_movs);

  perform set_config('request.jwt.claims', null, true);
  perform pretendi_nessun_residuo(v_foto, 'la verifica della caparra in cassa');
  raise notice 'verifica: nessun residuo, lapidi tornate a %', (select count(*) from deleted_records);
end $verifica$;

insert into applied_migrations (version, name)
values ('20260826000017', 'la_caparra_entra_in_cassa')
on conflict (version) do nothing;
