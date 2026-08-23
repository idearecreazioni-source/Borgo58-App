-- =====================================================================
-- IL CLIENTE PAGANTE STA SUL TAVOLO, NON SULLA PRENOTAZIONE
-- 23/08/2026 — blocco 5 del mandato del collaudo
-- =====================================================================
-- Regola di Alessio, e la parte che conta e' il verso: **il tavolo si
-- associa al CLIENTE PAGANTE, che sia quello della prenotazione o no**.
-- Se prenota Tizio e paga Caio, il tavolo va a Caio e la prenotazione
-- resta quello che e'.
--
-- ⚠️ QUINDI NON E' UN RIFLESSO (16/08). Un riflesso e' una colonna che
-- direbbe **esattamente** la stessa cosa di un'altra, e allora si toglie e
-- la scrive un trigger. Qui le due cose sono diverse per costruzione: chi
-- ha prenotato e chi paga sono due domande con due risposte, e il gestionale
-- deve poterle tenere separate. Il cliente della prenotazione e' soltanto il
-- valore di **partenza**.
--
-- ⚠️ E LE 348 RIGHE GIA' SCRITTE RESTANO VUOTE, non riempite dalla
-- prenotazione. Sarebbe una risposta data da chi scrive la migrazione al
-- posto di chi era in sala (lezione del 14/08): plausibile non vuol dire
-- vero, e un conto di giugno non ha nessuno che possa smentirla. Vuoto qui
-- vuol dire «non l'ha detto nessuno».
--
-- ---------------------------------------------------------------------
-- 🔴 LA TRAPPOLA CHE QUESTA CHIAVE ESTERNA APRE, chiusa qui dentro
-- ---------------------------------------------------------------------
-- `pulisci_richieste_scadute()` gira alle 4:30 e cancella i clienti
-- rimasti senza storia. Guardava `reservations` e `discounts_gifts`;
-- con `orders.customer_id` in `on delete restrict`, il primo cliente
-- che ha pagato un conto **avrebbe fatto fallire il lavoro INTERO**,
-- portandosi via anche le cancellazioni legittime — e per sei mesi non
-- l'avrebbe visto nessuno.
--
-- ⚠️ E' la stessa forma del 18/08, quando il legame conto-prenotazione
-- fece nascere lo stesso rischio. La regola generale, scritta perche'
-- tornera': **ogni chiave esterna nuova verso una tabella che qualcuno
-- ripulisce e' un potenziale blocco di quella pulizia** — e i lavori
-- periodici di questo gestionale sono sei.
--
-- ⚠️ `restrict` e non `set null`: un cliente non si cancella lasciando
-- dietro di se' un conto che dichiara di essere stato pagato da nessuno
-- (regola del 16/08 — il difetto stava nello schema).
--
-- ---------------------------------------------------------------------
-- I CORPI DELLE DUE FUNZIONI SONO PRESI VIVI DAL DATABASE
-- ---------------------------------------------------------------------
-- Non riscritti a memoria e non ricopiati dal file che le ha create: e' la
-- trappola in cui questo progetto e' caduto quattro volte, l'ultima
-- perdendo un portiere. Dalle 20260823000020 in poi c'e' anche una rete
-- che se ne accorge da sola (`scripts/guardie.mjs`), e questa migrazione
-- e' la prima che ci passa sotto.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. La colonna
-- ---------------------------------------------------------------------
alter table orders
  add column if not exists customer_id uuid references customers(id) on delete restrict;

comment on column orders.customer_id is
  'Chi PAGA questo conto (23/08/2026). Nasce dal cliente della prenotazione quando ce n''e'' una, ma non e'' un riflesso: cambiarlo qui non tocca la prenotazione. Vuoto vuol dire che nessuno l''ha detto.';

-- Ogni chiave esterna su una tabella che cresce vuole il suo indice
-- (audit dell'08/08): senza, la pulizia notturna dei clienti fa una
-- scansione di tutti i conti per ogni cliente da cancellare.
create index if not exists idx_orders_customer on orders (customer_id)
  where customer_id is not null;

-- ---------------------------------------------------------------------
-- 2. Chi apre il conto eredita il cliente della prenotazione
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apri_conto(p_tavoli uuid[], p_device_id uuid DEFAULT NULL::uuid, p_note text DEFAULT NULL::text, p_serata date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_order_id  uuid;
  v_etichette text[];
  v_occupato  text;
  v_res       uuid;
  v_nome      text;
  -- ⚠️ NON e' un riflesso della prenotazione (23/08): e' il valore di
  -- PARTENZA del pagante. Se prenota Tizio e paga Caio, il conto passa a
  -- Caio e la prenotazione resta quello che era.
  v_cliente   uuid;
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
    select r.id, r.customer_name, r.customer_id into v_res, v_nome, v_cliente
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
  insert into orders (table_label, device_id, note, reservation_id, customer_id)
  values (array_to_string(v_etichette, ' · '), p_device_id,
          nullif(trim(coalesce(p_note, '')), ''), v_res, v_cliente)
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
    'cliente',     v_nome,
    'customer_id', v_cliente
  );
end;
$function$;

-- ---------------------------------------------------------------------
-- 3. E la pulizia notturna non deve inciampare nella chiave nuova
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pulisci_richieste_scadute()
 RETURNS TABLE(richieste_cancellate integer, clienti_cancellati integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
         -- 🔴 LA RIGA NUOVA DEL 23/08, e senza di lei questo lavoro
         -- FALLISCE INTERO la prima notte in cui un cliente ha pagato un
         -- conto: `orders.customer_id` e' `on delete restrict`, la
         -- cancellazione viene respinta, e si porta via anche le
         -- cancellazioni legittime. E' la stessa trappola del 18/08, e
         -- vale come regola: **ogni chiave esterna nuova verso una tabella
         -- che qualcuno ripulisce e' un potenziale blocco di quella
         -- pulizia**.
         and not exists (select 1 from orders o where o.customer_id = c.id)
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
$function$;

-- ---------------------------------------------------------------------
-- 4. Assegnare (o registrare) il cliente pagante di un conto
-- ---------------------------------------------------------------------
-- ⚠️ UNA FUNZIONE SOLA PER TRE GESTI, ed e' il motivo per cui passa dal
-- corridoio: registrare un cliente nuovo E attaccarlo al conto tocca DUE
-- tabelle, e a meta' resterebbe una scheda cliente che non serve a niente
-- o un conto che dichiara un cliente inesistente.
--
-- ⚠️ SE IL NUMERO E' GIA' IN ANAGRAFICA SI RIUSA QUELLA SCHEDA, non se ne
-- crea una seconda. Non e' una comodita': i doppioni in anagrafica sono
-- il motivo per cui esiste `merge_customers`, e il telefono e' gia' la
-- chiave con cui il gestionale collega le prenotazioni ai clienti
-- (`normalize_phone`). Creare un secondo «Rossi» perche' l'ha scritto un
-- altro cameriere e' un difetto che si paga mesi dopo.
--
-- ⚠️ E IL NOME NON SI SOVRASCRIVE MAI su una scheda che ce l'ha gia': chi
-- e' in sala scrive di fretta, e «Rossi» digitato stasera non deve
-- cancellare «Famiglia Rossi — allergia ai crostacei» scritto a giugno.
-- Si riempie solo se era vuoto.
--
-- ⚠️ Con tutti e tre i parametri vuoti STACCA il cliente, e serve: e' la
-- via d'uscita di chi ha sbagliato tavolo. Un gesto che si puo' solo fare
-- e mai disfare e' un vicolo cieco.
create or replace function assegna_cliente_conto(
  p_order_id    uuid,
  p_customer_id uuid default null,
  p_nome        text default null,
  p_telefono    text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $funzione$
declare
  v_stato    text;
  v_cliente  uuid;
  v_tel      text;
  v_nome     text;
  v_creato   boolean := false;
begin
  -- Il portiere: e' un gesto di sala, quindi basta un utente vero — ma
  -- «un utente vero» va chiesto, perche' `security definer` gira senza
  -- RLS e la chiave anon e' pubblica.
  if auth.uid() is null then
    raise exception 'Operazione consentita solo a un utente autenticato';
  end if;

  select status into v_stato from orders where id = p_order_id;
  if v_stato is null then
    raise exception 'Questo conto non esiste piu''.';
  end if;
  -- ⚠️ Su un conto chiuso non si cambia il pagante: quel conto ha gia'
  -- prodotto uno scontrino, e cambiarne l'intestazione dopo vorrebbe dire
  -- riscrivere un fatto avvenuto.
  if v_stato <> 'aperto' then
    raise exception 'Questo conto e'' gia'' chiuso: il cliente non si cambia piu''.';
  end if;

  v_nome := nullif(trim(coalesce(p_nome, '')), '');
  v_tel  := normalize_phone(p_telefono);

  if p_customer_id is not null then
    v_cliente := p_customer_id;
    if not exists (select 1 from customers c where c.id = v_cliente) then
      raise exception 'Questo cliente non esiste piu''.';
    end if;
  elsif v_nome is not null or v_tel is not null then
    -- Prima si cerca: il numero e' l'identita', il nome no (di «Rossi» ce
    -- ne sono tanti).
    -- ⚠️ UNA SOLA ISTRUZIONE, e non e' eleganza: il telefono di un
    -- cliente e' UNICO in anagrafica, quindi fra una lettura che non trova
    -- niente e la scrittura che segue ci stanno i millisecondi in cui
    -- l'altro tablet arriva primo — e il secondo cameriere vedrebbe un
    -- errore di database mentre sta solo scrivendo un nome. E' la stessa forma dei doppioni
    -- della lista della spesa, nati a 160 microsecondi di distanza.
    --
    -- ⚠️ Il nome si tiene solo se ne mancava uno: e' la regola «riempio
    -- cio' che manca, non sovrascrivo cio' che c'e'». E il conto alla
    -- fine sa dire se la scheda l'ha creata adesso o l'ha trovata.
    if v_tel is not null then
      insert into customers (name, phone) values (v_nome, v_tel)
      on conflict (phone) do update set name = coalesce(customers.name, excluded.name)
      returning id, (xmax = 0) into v_cliente, v_creato;
    else
      -- Senza numero non c'e' identita' da riconoscere: e' una scheda
      -- nuova, e due «Rossi» senza telefono restano due schede diverse.
      insert into customers (name, phone) values (v_nome, null)
      returning id into v_cliente;
      v_creato := true;
    end if;
  end if;

  update orders set customer_id = v_cliente where id = p_order_id;

  return jsonb_build_object(
    'order_id',    p_order_id,
    'customer_id', v_cliente,
    'creato',      v_creato,
    'nome',        (select c.name from customers c where c.id = v_cliente),
    'telefono',    (select c.phone from customers c where c.id = v_cliente)
  );
end;
$funzione$;

revoke all on function assegna_cliente_conto(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function assegna_cliente_conto(uuid, uuid, text, text) to authenticated;

-- =====================================================================
-- VERIFICA
-- =====================================================================
do $verifica$
declare
  v_tit     uuid;
  v_tavolo  uuid;
  v_res     uuid;
  v_cli     uuid;
  v_cli2    uuid;
  v_ordine  uuid;
  v_r       jsonb;
  v_n       integer;
  v_lapidi  integer;
  v_lapidi2 integer;
  v_passato boolean;
  v_nome_verifica text;
  v_serata  date := (now() at time zone 'Europe/Rome')::date;
begin
  select count(*) into v_lapidi from deleted_records;
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  if v_tit is null then raise exception 'Nessun titolare: impossibile verificare.'; end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);

  -- ===== 0. La colonna c'e', ed e' vuota su tutto cio' che esisteva.
  select count(*) into v_n from orders where customer_id is not null;
  raise notice 'Conti con un cliente pagante prima di oggi: %', v_n;

  -- Un tavolo che non e' in uso adesso.
  select d.id into v_tavolo from dining_tables d
   where d.tipo = 'tavolo'
     and not exists (select 1 from order_tables ot where ot.dining_table_id = d.id and ot.conto_aperto)
   limit 1;
  if v_tavolo is null then
    raise exception 'Nessun tavolo libero: la verifica non puo'' girare.';
  end if;

  -- ===== 1. IL CLIENTE DELLA PRENOTAZIONE DIVENTA IL PAGANTE.
  insert into customers (name, phone) values ('ZZ prova pagante', '+399990000001')
  returning id into v_cli;
  insert into reservations (type, status, source, reservation_date, reservation_time,
                            party_size, customer_name, customer_phone, customer_id)
  values ('prenotazione', 'confermata', 'interno', v_serata, '20:00', 2,
          'ZZ prova pagante', '+399990000001', v_cli)
  returning id into v_res;
  insert into prenotazione_tavoli (reservation_id, dining_table_id, etichetta_al_momento)
  select v_res, v_tavolo, d.label from dining_tables d where d.id = v_tavolo;

  v_r := apri_conto(array[v_tavolo], null, 'ZZ verifica pagante', v_serata);
  v_ordine := (v_r->>'order_id')::uuid;

  if (v_r->>'customer_id') is distinct from v_cli::text then
    raise exception 'Aprendo il conto il cliente della prenotazione non e'' diventato il pagante: % invece di %',
      coalesce(v_r->>'customer_id', '(vuoto)'), v_cli;
  end if;

  -- ===== 2. E SI PUO' CAMBIARE SENZA TOCCARE LA PRENOTAZIONE — che e'
  -- =====    tutta la regola di Alessio: prenota Tizio, paga Caio.
  insert into customers (name, phone) values ('ZZ prova paga un altro', '+399990000002')
  returning id into v_cli2;
  v_r := assegna_cliente_conto(v_ordine, v_cli2);

  select customer_id into v_cli from orders where id = v_ordine;
  if v_cli is distinct from v_cli2 then
    raise exception 'Il pagante non e'' cambiato.';
  end if;
  select customer_id into v_cli from reservations where id = v_res;
  if v_cli is null or v_cli = v_cli2 then
    raise exception 'Cambiare il pagante ha toccato la prenotazione: non deve.';
  end if;

  -- ===== 3. UN NUMERO GIA' IN ANAGRAFICA NON CREA UN DOPPIONE.
  v_r := assegna_cliente_conto(v_ordine, null, 'ZZ scritto di fretta', '+39 999 0000 002');
  if (v_r->>'creato')::boolean then
    raise exception 'Ha creato una scheda nuova per un numero che c''era gia''.';
  end if;
  if (v_r->>'customer_id')::uuid <> v_cli2 then
    raise exception 'Non ha riconosciuto il cliente dal numero.';
  end if;
  -- ⚠️ E il nome NON e' stato sovrascritto.
  select name into v_nome_verifica from customers where id = v_cli2;
  if v_nome_verifica <> 'ZZ prova paga un altro' then
    raise exception 'Il nome scritto di fretta ha sovrascritto quello che c''era: %', v_nome_verifica;
  end if;

  -- ===== 4. UN CLIENTE NUOVO NASCE QUANDO IL NUMERO NON SI CONOSCE.
  v_r := assegna_cliente_conto(v_ordine, null, 'ZZ mai visto', '+399990000003');
  if not (v_r->>'creato')::boolean then
    raise exception 'Non ha creato la scheda di un cliente sconosciuto.';
  end if;

  -- ===== 5. E SI PUO' STACCARE: un gesto senza via d'uscita e' un vicolo cieco.
  v_r := assegna_cliente_conto(v_ordine);
  select customer_id into v_cli from orders where id = v_ordine;
  if v_cli is not null then
    raise exception 'Il cliente non si stacca.';
  end if;

  -- ===== 6. 🔴 LA PULIZIA DELLA PRIVACY NON DEVE INCIAMPARE. Si rimette
  -- =====    il pagante e si prova a cancellare quel cliente: deve essere
  -- =====    RESPINTO dalla chiave esterna, che e' precisamente il caso in
  -- =====    cui il lavoro delle 4:30 sarebbe fallito intero.
  perform assegna_cliente_conto(v_ordine, v_cli2);
  begin
    delete from customers where id = v_cli2;
    v_passato := true;
  exception when foreign_key_violation then
    v_passato := false;
  end;
  if v_passato then
    raise exception 'Un cliente con un conto sopra si e'' lasciato cancellare.';
  end if;

  -- ===== 7. E la funzione della pulizia adesso lo sa: il suo corpo vivo
  -- =====    nomina i conti fra le storie che tengono in vita un cliente.
  if position('from orders o where o.customer_id' in
      (select pg_get_functiondef(p.oid) from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = 'pulisci_richieste_scadute')) = 0 then
    raise exception 'La pulizia notturna non guarda i conti: la prima notte con un cliente pagante fallirebbe intera.';
  end if;

  -- ===== 8. Su un conto chiuso il pagante non si cambia piu'.
  update orders set status = 'chiuso', closed_at = now() where id = v_ordine;
  begin
    perform assegna_cliente_conto(v_ordine, v_cli2);
    v_passato := true;
  exception when others then
    v_passato := false;
  end;
  if v_passato then
    raise exception 'Si e'' potuto cambiare il pagante di un conto gia'' chiuso.';
  end if;

  -- ===== pulizia
  update orders set customer_id = null where id = v_ordine;
  delete from order_tables where order_id = v_ordine;
  delete from orders where id = v_ordine;
  delete from prenotazione_tavoli where reservation_id = v_res;
  delete from reservations where id = v_res;
  delete from customers where name like 'ZZ prova%' or name = 'ZZ mai visto';

  select count(*) into v_lapidi2 from deleted_records;
  if v_lapidi2 <> v_lapidi then
    raise exception 'La verifica ha lasciato % lapidi nel registro.', v_lapidi2 - v_lapidi;
  end if;

  perform set_config('request.jwt.claims', null, true);
  raise notice 'Verifica passata: il pagante nasce dalla prenotazione, si cambia senza toccarla, non fa doppioni e non blocca la pulizia notturna.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260823000020', 'il_cliente_del_tavolo') on conflict (version) do nothing;
