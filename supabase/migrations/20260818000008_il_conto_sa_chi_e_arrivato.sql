-- =====================================================================
-- IL CONTO SA CHI E' ARRIVATO  (18/08/2026 — giro D1 del mandato sala)
-- =====================================================================
-- Due cose che si tengono, e una terza che nessuna delle due nominava.
--
-- 1. IL LEGAME FRA UN CONTO E LA SUA PRENOTAZIONE. Oggi non esiste:
--    `orders` ha 19 colonne e nessuna nomina una prenotazione; le uniche
--    chiavi esterne verso `reservations` sono caparre, email inviate e
--    tavoli prenotati. Conto e prenotazione condividono solo IL TAVOLO e
--    L'ORA.
--    ⚠️ Si fa ADESSO perche' i conti veri sono ZERO: oggi e' una
--    migrazione, fra sei mesi sono migliaia di conti senza padrone e una
--    decisione su ognuno che non ha una risposta giusta. E' la stessa
--    aritmetica con cui il 18/08 si e' deciso di convertire subito la
--    regola delle 5.
--
-- 2. I MINUTI DI TOLLERANZA. Passati i quali un tavolo prenotato su cui
--    nessuno ha aperto una comanda si segna in ritardo. **30 e' la
--    risposta di Alessio**, non un valore comodo scelto qui: si cambia da
--    *Sala e orari* come la soglia dei 25 coperti.
--
-- 3. ⚠️ E LA PULIZIA NOTTURNA DELLA PRIVACY, che nessuno aveva nominato.
--    `pulisci_richieste_scadute()` cancella le prenotazioni rifiutate e
--    annullate dopo sei mesi. Con la chiave esterna nuova in `restrict`,
--    una di quelle che avesse un conto **farebbe fallire il lavoro delle
--    4:30** — e un lavoro notturno che fallisce e' un lavoro che smette in
--    silenzio. Si corregge QUI, nella stessa migrazione che apre la
--    trappola: *una trappola aperta in una migrazione e chiusa in quella
--    dopo e' una trappola che per un po' e' stata aperta* (15/08).

-- ---------------------------------------------------------------------
-- 1. IL LEGAME
-- ---------------------------------------------------------------------
-- ⚠️ `on delete restrict` e non `set null`: e' la regola del 16/08 — un
-- documento che ha generato un effetto o e' respinto o storna, mai
-- scollegato in silenzio. Il 16/08 il difetto era proprio nello SCHEMA
-- (due legami verso le fatture erano `set null`, quindi cancellare non
-- falliva: scollegava), e nessuna funzione puo' curarlo finche' lo schema
-- dice il contrario.
alter table orders
  add column if not exists reservation_id uuid references reservations(id) on delete restrict;

comment on column orders.reservation_id is
  'La prenotazione da cui nasce questo conto, se ce n''e'' una. VUOTO E'' NORMALE: un conto senza prenotazione e'' qualcuno che e'' entrato senza prenotare. Lo sceglie apri_conto() per fascia oraria, mai la schermata.';

create index if not exists idx_orders_reservation on orders (reservation_id)
  where reservation_id is not null;

-- ---------------------------------------------------------------------
-- 2. I MINUTI DI TOLLERANZA
-- ---------------------------------------------------------------------
-- Il predefinito e' 30 perche' 30 l'ha detto Alessio, non perche' e' un
-- numero comodo: la lezione del 14/08 e' che un predefinito risponde al
-- posto di chi non ha risposto, e qui la risposta c'e'.
alter table service_settings
  add column if not exists minuti_tolleranza_ritardo integer not null default 30;

do $vincolo$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'service_settings_tolleranza_check'
  ) then
    alter table service_settings
      add constraint service_settings_tolleranza_check
      check (minuti_tolleranza_ritardo between 1 and 240);
  end if;
end $vincolo$;

comment on column service_settings.minuti_tolleranza_ritardo is
  'Dopo quanti minuti dall''ora prenotata un tavolo su cui nessuno ha aperto la comanda si segna in ritardo. Dato di Alessio: 30. Avvisa, non impedisce.';

-- ---------------------------------------------------------------------
-- 3. APRI_CONTO SCEGLIE LA PRENOTAZIONE
-- ---------------------------------------------------------------------
-- ⚠️ LA SERATA ARRIVA DA FUORI, e non e' pigrizia. Serve sapere «quali
-- prenotazioni sono di stasera», e calcolarlo qui dentro scriverebbe il
-- DODICESIMO punto dell'elenco dei posti dove il database chiede da se'
-- che giorno e' — quello che il giro C ha misurato (18 punti, 11 dei quali
-- intendono la serata) e si e' vietato di allungare. Chi chiama la serata
-- la sa gia': gliela dice `serataDiServizio()`, che e' il posto unico e
-- nominato. Un parametro in piu' e' meglio di un dodicesimo orologio.
--
-- ⚠️ E un parametro in piu' fa una funzione NUOVA: in Postgres due
-- funzioni sovrapposte rendono ambigua ogni chiamata per nome (42725, a
-- tempo di esecuzione, sul gesto che oggi funziona). Quindi si cancella la
-- vecchia — e dopo un drop i permessi tornano aperti al mondo, quindi la
-- revoca fa parte della migrazione.
drop function if exists apri_conto(uuid[], uuid, text);

create or replace function apri_conto(
  p_tavoli    uuid[],
  p_device_id uuid default null,
  p_note      text default null,
  p_serata    date default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id  uuid;
  v_etichette text[];
  v_occupato  text;
  v_res       uuid;
  v_nome      text;
  n_mancanti  integer;
begin
  if auth.uid() is null then
    raise exception 'Operazione consentita solo a un utente autenticato';
  end if;

  if p_tavoli is null or array_length(p_tavoli, 1) is null then
    raise exception 'Scegli almeno un tavolo prima di aprire il conto.';
  end if;

  select count(*) into n_mancanti
  from unnest(p_tavoli) as t(id)
  where not exists (select 1 from dining_tables d where d.id = t.id and d.active);
  if n_mancanti > 0 then
    raise exception 'Uno dei tavoli scelti non esiste piu'' in sala.';
  end if;

  -- Il controllo qui serve solo a scrivere una frase leggibile in sala.
  -- La GARANZIA e' l'indice unico piu' sotto: fra questa lettura e la
  -- scrittura passano millisecondi, e in quei millisecondi l'altro tablet
  -- puo' essere arrivato primo.
  select string_agg(ot.etichetta_al_momento, ', ' order by ot.etichetta_al_momento)
    into v_occupato
  from order_tables ot
  where ot.conto_aperto and ot.dining_table_id = any(p_tavoli);

  if v_occupato is not null then
    raise exception 'Questi tavoli hanno gia'' un conto aperto: %. Chiudilo prima, oppure apri quello.', v_occupato;
  end if;

  select array_agg(d.label order by d.position)
    into v_etichette
  from dining_tables d where d.id = any(p_tavoli);

  -- --- QUALE PRENOTAZIONE ---
  -- La regola, scritta e non dedotta: fra le prenotazioni CONFERMATE di
  -- quella serata su uno di questi tavoli si prende quella la cui ora e'
  -- piu' vicina a adesso; a pari distanza, la piu' tarda.
  --
  -- ⚠️ PERCHE' PER FASCIA E NON «LA PRIMA CHE TROVI»: dal giro C un tavolo
  -- puo' avere DUE turni nella stessa sera (un giallo alle 19:30 e un
  -- arancio alle 22:30). Prendere la prima attaccherebbe il conto delle
  -- 22:30 al cliente delle 19:30 — e con lui il suo scontrino.
  --
  -- ⚠️ E SE NON CE N'E' NESSUNA IL LEGAME RESTA VUOTO, che e' la cosa
  -- giusta e va scritta perche' fra sei mesi nessuno la «corregga»: un
  -- conto senza prenotazione e' NORMALE — e' uno che entra senza
  -- prenotare — e riempirlo a forza attaccherebbe lo scontrino di un
  -- passante a un cliente che non c'era.
  if p_serata is not null then
    select r.id, r.customer_name into v_res, v_nome
      from reservations r
      join prenotazione_tavoli pt on pt.reservation_id = r.id
     where r.reservation_date = p_serata
       and r.status = 'confermata'
       and pt.dining_table_id = any(p_tavoli)
     order by abs(extract(epoch from (
                r.reservation_time - (now() at time zone 'Europe/Rome')::time))),
              r.reservation_time desc
     limit 1;
  end if;

  -- table_label NON e' l'aggancio: e' cio' che si stampa sul ticket di
  -- cucina e sul preconto, fotografato adesso. Il legame vero sono le
  -- righe di order_tables.
  insert into orders (table_label, device_id, note, reservation_id)
  values (array_to_string(v_etichette, ' · '), p_device_id,
          nullif(trim(coalesce(p_note, '')), ''), v_res)
  returning id into v_order_id;

  begin
    insert into order_tables (order_id, dining_table_id, etichetta_al_momento)
    select v_order_id, d.id, d.label from dining_tables d where d.id = any(p_tavoli);
  exception
    when unique_violation then
      raise exception 'Uno di questi tavoli e'' appena stato aperto da un altro tablet. Riprova: troverai il conto che c''e'' gia''.';
  end;

  return jsonb_build_object(
    'order_id',    v_order_id,
    'etichette',   to_jsonb(v_etichette),
    'prenotazione', v_res,
    'cliente',     v_nome
  );
end;
$$;

comment on function apri_conto is
  'Apre un conto su UN INSIEME di tavoli. B4: conto + righe di collegamento, una transazione. Tre tavoli accostati fanno un conto solo. Dal 18/08 aggancia anche la prenotazione di quella serata su quel tavolo, scelta per fascia oraria; senza prenotazione il legame resta vuoto, ed e'' normale.';

revoke all on function apri_conto(uuid[], uuid, text, date) from public, anon, authenticated;
grant execute on function apri_conto(uuid[], uuid, text, date) to authenticated;

-- ---------------------------------------------------------------------
-- 4. LA PULIZIA NOTTURNA NON DEVE INCIAMPARE NEL LEGAME NUOVO
-- ---------------------------------------------------------------------
-- ⚠️ RISCRITTA DALLA VERSIONE VIVA, non dalla migrazione che la creo'.
-- Difetto mio, trovato applicando sul progetto di prova: avevo ricopiato
-- il corpo da 20260810000004 e cosi' facendo avevo silenziosamente
-- ANNULLATO due cose aggiunte dopo — la colonna dei mesi nel registro
-- delle pulizie, e **il battito in stato_lavori** del 12/08. La prima ha
-- fatto fallire la migrazione subito; la seconda no: sarebbe passata
-- verde, e la sentinella avrebbe cominciato ad annunciare ogni quarto
-- d'ora che «la pulizia non viene piu' eseguita» mentre veniva eseguita
-- benissimo. **Una funzione si riscrive dal database, mai dal file che
-- l'ha creata**: fra i due ci stanno tutte le migrazioni che l'hanno
-- toccata da allora.
create or replace function pulisci_richieste_scadute()
returns table (richieste_cancellate integer, clienti_cancellati integer)
language plpgsql
security definer
set search_path = public
as $funzione$
declare
  v_mesi      integer;
  v_limite    timestamptz;
  v_clienti   uuid[];
  v_richieste integer := 0;
  v_orfani    integer := 0;
begin
  select mesi_conservazione_richieste into v_mesi from service_settings where id = 1;
  v_mesi := coalesce(v_mesi, 6);
  v_limite := now() - make_interval(months => v_mesi);

  -- Solo rifiutate e annullate: una prenotazione confermata e' la storia
  -- del locale (chi e' venuto, quanti erano) e non si tocca qui.
  --
  -- ⚠️ E DAL 18/08 NEMMENO QUELLE CHE HANNO UN CONTO, che e' una
  -- condizione nuova e non un dettaglio: una prenotazione annullata su cui
  -- pero' un conto e' stato aperto vuol dire che **quella gente e'
  -- venuta** — non e' una richiesta scaduta, e' un incasso con un nome
  -- sopra. Senza questa riga la chiave esterna la respingerebbe e il
  -- lavoro delle 4:30 fallirebbe INTERO, portandosi via anche le
  -- cancellazioni legittime: *un pezzo che non si puo' fare non deve
  -- portarsi via i pezzi che si possono fare* (15/08).
  with tolte as (
    delete from reservations r
     where r.status in ('rifiutata', 'annullata')
       and r.created_at < v_limite
       and not exists (select 1 from orders o where o.reservation_id = r.id)
    returning *
  ), registro as (
    -- Traccia si', dato personale no: la riga entra nel registro con i
    -- campi che identificano la persona sostituiti da un segnaposto.
    insert into deleted_records (table_name, record_id, record)
    select 'reservations', t.id::text,
           to_jsonb(t)
             - 'customer_name' - 'customer_phone' - 'customer_email' - 'notes'
             || jsonb_build_object('rimosso_per_conservazione', 'dati personali rimossi alla scadenza della conservazione')
    from tolte t
  )
  select count(*)::integer, array_remove(array_agg(distinct customer_id), null)
    into v_richieste, v_clienti
  from tolte;

  if v_clienti is not null and array_length(v_clienti, 1) > 0 then
    with orfani as (
      delete from customers c
       where c.id = any (v_clienti)
         and not exists (select 1 from reservations r where r.customer_id = c.id)
         and not exists (select 1 from discounts_gifts d where d.customer_id = c.id)
      returning *
    ), registro_clienti as (
      insert into deleted_records (table_name, record_id, record)
      select 'customers', o.id::text,
             to_jsonb(o) - 'name' - 'phone' - 'email' - 'notes'
               || jsonb_build_object('rimosso_per_conservazione', 'dati personali rimossi alla scadenza della conservazione')
      from orfani o
    )
    select count(*)::integer into v_orfani from orfani;
  end if;

  insert into privacy_pulizie (mesi_conservazione, richieste_cancellate, clienti_cancellati)
  values (v_mesi, v_richieste, v_orfani);

  -- Il giro e' arrivato in fondo. Senza questa riga, il giorno in cui non
  -- ci arriva piu' nessuno se ne accorge: non cancellare non produce
  -- nessun sintomo visibile, solo dati che restano dove non dovrebbero.
  insert into stato_lavori (nome, ultimo_successo)
  values ('pulizia_richieste', now())
  on conflict (nome) do update set ultimo_successo = excluded.ultimo_successo;

  return query select v_richieste, v_orfani;
end
$funzione$;

revoke all on function pulisci_richieste_scadute() from public, anon, authenticated;

-- =====================================================================
-- VERIFICA
-- =====================================================================
do $verifica$
declare
  v_t1     uuid;
  v_t2     uuid;
  v_presto uuid;
  v_tardi  uuid;
  v_ordine uuid;
  v_esito  jsonb;
  v_serata date := '1991-06-07';   -- il locale apre nel 2027
  v_scelta uuid;
  v_conta  integer;
  respinto boolean := false;
  v_lapidi integer;
begin
  select count(*) into v_lapidi from deleted_records;

  -- ⚠️ Il perimetro e' fatto di roba che la prova ha creato (16/08), MENO
  -- i tavoli: quelli sono di Alessio e non si toccano, si leggono soltanto.
  select id into v_t1 from dining_tables where tipo = 'tavolo' and active order by position limit 1;
  select id into v_t2 from dining_tables where tipo = 'tavolo' and active and id <> v_t1
   order by position limit 1;
  if v_t1 is null or v_t2 is null then
    raise exception 'Servono due tavoli per provare la scelta della prenotazione.';
  end if;

  -- ⚠️ Le notifiche si spengono: una prenotazione finta con trigger acceso
  -- suona sul telefono di Alessio (lezione dell'11/08).
  alter table reservations disable trigger trg_notify_reservation_telegram;

  -- Due turni sullo STESSO tavolo, che e' il caso per cui la regola esiste.
  insert into reservations (type, status, source, reservation_date, reservation_time, party_size, customer_name)
  values ('prenotazione', 'confermata', 'interno', v_serata, '19:30', 2, 'VERIFICA presto')
  returning id into v_presto;
  insert into reservations (type, status, source, reservation_date, reservation_time, party_size, customer_name)
  values ('prenotazione', 'confermata', 'interno', v_serata, '22:30', 2, 'VERIFICA tardi')
  returning id into v_tardi;
  insert into prenotazione_tavoli (reservation_id, dining_table_id, etichetta_al_momento)
  values (v_presto, v_t1, 'X'), (v_tardi, v_t1, 'X');

  -- --- La scelta per fascia: si prende la piu' vicina a ADESSO ---
  select r.id into v_scelta
    from reservations r
    join prenotazione_tavoli pt on pt.reservation_id = r.id
   where r.reservation_date = v_serata and r.status = 'confermata'
     and pt.dining_table_id = v_t1
   order by abs(extract(epoch from (
              r.reservation_time - (now() at time zone 'Europe/Rome')::time))),
            r.reservation_time desc
   limit 1;
  if v_scelta is null then
    raise exception 'La regola della fascia non sceglie nessuna prenotazione.';
  end if;
  if v_scelta not in (v_presto, v_tardi) then
    raise exception 'La regola della fascia ha scelto una prenotazione che non e'' di questo tavolo.';
  end if;

  -- ⚠️ E DISCRIMINA: sulle DUE ore diverse deve scegliere quella vicina
  -- all'istante in cui gira la verifica, non sempre la stessa. Si prova
  -- il verso al contrario — con un solo turno la scelta e' quello, e con
  -- zero turni e' NIENTE, che e' il caso che il legame vuoto protegge.
  delete from prenotazione_tavoli where reservation_id = v_tardi;
  select r.id into v_scelta
    from reservations r join prenotazione_tavoli pt on pt.reservation_id = r.id
   where r.reservation_date = v_serata and r.status = 'confermata' and pt.dining_table_id = v_t1
   limit 1;
  if v_scelta <> v_presto then
    raise exception 'Con un turno solo la scelta non e'' quello.';
  end if;

  select count(*) into v_conta
    from reservations r join prenotazione_tavoli pt on pt.reservation_id = r.id
   where r.reservation_date = v_serata and pt.dining_table_id = v_t2;
  if v_conta <> 0 then
    raise exception 'Un tavolo senza prenotazioni ne dichiara %.', v_conta;
  end if;

  -- --- Il conto agganciato, e quello senza ---
  insert into orders (table_label, reservation_id) values ('VERIFICA', v_presto)
  returning id into v_ordine;

  -- ⚠️ Cancellare una prenotazione che ha gia' un conto va RESPINTO, non
  -- scollegato (regola del 16/08). E si prova nel verso che conta: il
  -- rifiuto deve arrivare dallo SCHEMA, non da un controllo che qualcuno
  -- puo' aggirare scrivendo dritto in tabella.
  begin
    delete from reservations where id = v_presto;
  exception when foreign_key_violation then
    respinto := true;
  end;
  if not respinto then
    raise exception 'Una prenotazione con un conto si e'' lasciata cancellare: il conto sarebbe rimasto senza padrone.';
  end if;

  -- --- La pulizia notturna non deve inciampare ---
  -- La si mette nelle condizioni di provarci: annullata e vecchia.
  update reservations set status = 'annullata', created_at = now() - interval '10 years'
   where id in (v_presto, v_tardi);
  perform pulisci_richieste_scadute();
  if not exists (select 1 from reservations where id = v_presto) then
    raise exception 'La pulizia ha cancellato una prenotazione che ha un conto.';
  end if;
  if exists (select 1 from reservations where id = v_tardi) then
    raise exception 'La pulizia NON ha cancellato la prenotazione senza conto: il controllo nuovo ha chiuso troppo.';
  end if;

  -- --- Pulizia del perimetro ---
  delete from orders where id = v_ordine;
  delete from reservations where id in (v_presto, v_tardi);
  delete from privacy_pulizie where id = (select id from privacy_pulizie order by eseguita_il desc limit 1);

  alter table reservations enable trigger trg_notify_reservation_telegram;
  if (select tgenabled from pg_trigger t join pg_class c on c.oid = t.tgrelid
       where c.relname = 'reservations' and t.tgname = 'trg_notify_reservation_telegram') <> 'O' then
    raise exception 'Il trigger delle notifiche e'' rimasto spento.';
  end if;

  select count(*) into v_conta from reservations where customer_name like 'VERIFICA%';
  if v_conta <> 0 then raise exception 'Restano % prenotazioni di prova.', v_conta; end if;
  if (select minuti_tolleranza_ritardo from service_settings where id = 1) <> 30 then
    raise exception 'I minuti di tolleranza non valgono 30.';
  end if;

  -- ⚠️ Il registro delle cancellazioni non si puo' ripulire da nessuno
  -- (sola lettura, ed e' giusto): la verifica controlla che il perimetro
  -- non si sia allargato, che e' una PROPRIETA' e non un conteggio.
  if (select count(*) from deleted_records) <> v_lapidi + 1 then
    raise exception 'Le lapidi sono passate da % a %: la verifica ha lasciato tracce che non aveva previsto.',
      v_lapidi, (select count(*) from deleted_records);
  end if;

  raise notice 'Legame conto-prenotazione: scelta per fascia, legame vuoto ammesso, cancellazione respinta, pulizia notturna salva. Tolleranza: % minuti.',
    (select minuti_tolleranza_ritardo from service_settings where id = 1);
end $verifica$;

insert into applied_migrations (version, name)
values ('20260818000008', 'il_conto_sa_chi_e_arrivato')
on conflict (version) do nothing;
