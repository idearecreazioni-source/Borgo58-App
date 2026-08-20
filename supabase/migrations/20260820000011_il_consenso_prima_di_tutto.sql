-- =====================================================================
-- IL CONSENSO, PRIMA DI TUTTO — la posta dei clienti
-- 20/08/2026 · blocchi 1-4 del mandato della posta dei clienti
-- =====================================================================
-- 🔴 LA DISTINZIONE CHE REGGE TUTTO, ed è di Alessio: scrivere a chi ha
-- prenotato per confermargli il tavolo **non ha bisogno di niente**; mandare
-- il menu del mese a duecento persone **sì**.
--
-- ⚠️ E le due strade NON devono poter essere confuse in una sola funzione
-- «manda mail», altrimenti prima o poi una comunicazione commerciale esce
-- dalla porta di servizio. Sono due funzioni con due nomi diversi, e quella
-- commerciale **pretende il consenso — non lo controlla la schermata, lo
-- controlla il database**.
--
-- ⚠️ VA PER PRIMO perché è la cosa che non si può aggiungere dopo: un modulo
-- che manda mail e poi impara il consenso **ha già mandato mail senza**.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1 · IL CONSENSO SULLA SCHEDA DEL CLIENTE
-- ---------------------------------------------------------------------
-- ⚠️ DUE DATE, NON UNA SPUNTA. «Ha acconsentito» e «si è cancellato» sono due
-- fatti diversi, ognuno col suo quando: un booleano che si spegne
-- cancellerebbe la prova che il consenso c'era stato — e *un consenso che
-- esiste solo nella memoria di Alessio non è dimostrabile*, che è l'unica
-- cosa che conta se un domani viene contestato.
--
-- ⚠️ E il consenso si può RIDARE dopo essersi cancellati: per questo la
-- regola confronta le due date invece di guardare solo se la revoca esiste.
alter table customers
  add column if not exists consenso_commerciale_il timestamptz,
  add column if not exists consenso_revocato_il    timestamptz,
  add column if not exists consenso_come           text;

comment on column customers.consenso_commerciale_il is
  'Quando questo cliente ha detto che gli si può scrivere per cose non legate a una sua prenotazione. VUOTO = non l''ha mai detto, e vuoto NON è «no»: è «non gliel''ho mai chiesto».';
comment on column customers.consenso_revocato_il is
  'Quando ha chiesto di non ricevere più niente. Non cancella il consenso di prima: lo supera. Serve a poter dimostrare che la richiesta è stata applicata, e quando.';
comment on column customers.consenso_come is
  'Come l''ha dato: a voce al telefono, di persona, per iscritto. Testo libero perché la realtà di un''osteria non sta in un elenco chiuso.';


-- 🔴 LA REGOLA IN UN POSTO SOLO, E QUEL POSTO È LO SCHEMA.
--
-- Una colonna CALCOLATA dal database, non un riflesso scritto da qualcuno:
-- Postgres la ricava dalle due date a ogni scrittura, e nessuno può
-- contraddirla. PostgREST la espone, quindi **la schermata legge la risposta
-- invece di rifarsi il conto** — che era il difetto vero: la prima versione
-- ricalcolava le due date in JavaScript, cioè un secondo posto dove viveva la
-- stessa regola.
--
-- ⚠️ E il confronto fra le due date, invece di «esiste una revoca», serve
-- perché **il consenso si può ridare** dopo essersi cancellati.
alter table customers
  add column if not exists puo_ricevere_commerciali boolean
  generated always as (
    consenso_commerciale_il is not null
    and (consenso_revocato_il is null
         or consenso_revocato_il < consenso_commerciale_il)
  ) stored;

comment on column customers.puo_ricevere_commerciali is
  'Calcolata dal database dalle due date del consenso: nessuno la scrive, quindi non può contraddirle. È l''unica risposta a «gli si può scrivere?».';

-- ⚠️ La funzione LEGGE la colonna, non rifà il conto: serve solo perche' le
-- altre funzioni SQL possano chiamarla per nome.
-- ⚠️ E NON è concessa a nessuno: la chiamano solo funzioni `security definer`
-- che girano coi permessi del proprietario, e le schermate leggono la colonna.
create or replace function consenso_valido(p_customer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select c.puo_ricevere_commerciali from customers c where c.id = p_customer_id;
$fn$;

revoke all on function consenso_valido(uuid) from public, anon, authenticated;


-- ⚠️ LA CANCELLAZIONE DEVE TOGLIERE DAVVERO, non solo registrare la
-- richiesta: *una cancellazione registrata e non applicata è peggio di
-- nessuna, perché c'è la prova scritta che l'aveva chiesto*. Qui è la stessa
-- colonna che il calcolo legge, quindi non esiste il caso «registrata e non
-- applicata» — non è disciplina, è che non c'è una seconda strada.
create or replace function revoca_consenso(p_customer_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare v_nome text;
begin
  if not is_titolare() then
    raise exception 'I consensi dei clienti sono riservati al titolare.';
  end if;
  update customers set consenso_revocato_il = now()
   where id = p_customer_id
  returning coalesce(name, phone) into v_nome;
  if v_nome is null then
    raise exception 'Questo cliente non esiste più.';
  end if;
  return jsonb_build_object(
    'cliente', v_nome,
    'frase', format('%s non riceverà più comunicazioni. Le conferme delle sue prenotazioni continuano ad arrivargli.', v_nome)
  );
end;
$fn$;

revoke all on function revoca_consenso(uuid) from public, anon, authenticated;
grant execute on function revoca_consenso(uuid) to authenticated;


create or replace function registra_consenso(p_customer_id uuid, p_come text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare v_nome text;
begin
  if not is_titolare() then
    raise exception 'I consensi dei clienti sono riservati al titolare.';
  end if;
  if coalesce(btrim(p_come), '') = '' then
    -- ⚠️ Si pretende COME l'ha dato, e non è burocrazia: fra un anno «c'è la
    -- spunta» non risponde a nessuna contestazione, «me l'ha detto al
    -- telefono il 3 marzo» sì.
    raise exception 'Scrivi come te l''ha dato: al telefono, di persona, per iscritto.';
  end if;
  update customers
     set consenso_commerciale_il = now(),
         consenso_come = btrim(p_come),
         -- La revoca precedente NON si cancella: resta la storia, e la regola
         -- confronta le due date.
         consenso_revocato_il = consenso_revocato_il
   where id = p_customer_id
  returning coalesce(name, phone) into v_nome;
  if v_nome is null then
    raise exception 'Questo cliente non esiste più.';
  end if;
  return jsonb_build_object('cliente', v_nome);
end;
$fn$;

revoke all on function registra_consenso(uuid, text) from public, anon, authenticated;
grant execute on function registra_consenso(uuid, text) to authenticated;


-- ---------------------------------------------------------------------
-- 2 · IL REGISTRO DEGLI INVII SI ALLARGA
-- ---------------------------------------------------------------------
-- Fino a oggi ogni riga era legata a una PRENOTAZIONE. Una comunicazione
-- commerciale non ne ha una — è la differenza fra le due strade.
--
-- ⚠️ In produzione la tabella è VUOTA (misurato: 0 righe), quindi allargarla
-- non risponde al posto di nessuno. Se avesse avuto righe, il vincolo
-- «almeno uno dei due» avrebbe dovuto arrivare dopo una sanatoria.
alter table email_inviate
  add column if not exists customer_id uuid references customers(id) on delete set null,
  add column if not exists oggetto     text;

alter table email_inviate alter column reservation_id drop not null;

-- ⚠️ UN VOCABOLARIO CHIUSO SI ALLARGA NEL VINCOLO, non si aggira: `tipo`
-- ammetteva solo 'conferma'. È la trappola del 17/08 — un vocabolario vive in
-- più posti e la rete `vocabolari_chiusi()` lo sorveglia — quindi il valore
-- nuovo entra QUI, dove il database decide, e non solo dove qualcuno lo
-- scrive.
alter table email_inviate drop constraint if exists email_inviate_tipo_check;
alter table email_inviate add constraint email_inviate_tipo_check
  check (tipo in ('conferma', 'commerciale'));

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'email_ha_un_destinatario') then
    alter table email_inviate add constraint email_ha_un_destinatario
      check (reservation_id is not null or customer_id is not null);
  end if;
end $$;

comment on column email_inviate.customer_id is
  'Il cliente a cui è andata, quando l''invio non nasce da una prenotazione. Una riga ha sempre almeno uno fra questo e `reservation_id`.';


-- ---------------------------------------------------------------------
-- 3 · 🔴 LA PORTA COMMERCIALE, CHE PRETENDE IL CONSENSO
-- ---------------------------------------------------------------------
-- ⚠️ NON è `invia_email_conferma` con un parametro in più, ed è il punto di
-- tutto il blocco: due funzioni con due nomi diversi, perché *una sola
-- funzione «manda mail» prima o poi lascia uscire una comunicazione
-- commerciale dalla porta di servizio*.
--
-- ⚠️ E il rifiuto sta QUI, nel database, non nella schermata: una schermata
-- che filtra è una schermata che qualcuno può scavalcare.
--
-- ⚠️ Restituisce CHI riceverà e CHI no, con la ragione. Un elenco di
-- destinatari senza gli esclusi si legge «sono tutti», e chi manda non
-- saprebbe di aver lasciato fuori metà rubrica.
create or replace function destinatari_commerciali()
returns table (
  customer_id uuid,
  nome        text,
  email       text,
  telefono    text,
  puo_ricevere boolean,
  perche_no   text
)
language plpgsql
stable
security definer
set search_path = public
as $fn$
begin
  if not is_titolare() then
    raise exception 'La rubrica dei clienti è riservata al titolare.';
  end if;
  return query
    select c.id,
           coalesce(c.name, c.phone),
           c.email,
           c.phone,
           consenso_valido(c.id) and c.email is not null and c.active,
           case
             when not c.active then 'scheda disattivata'
             when c.consenso_commerciale_il is null then 'non gli è mai stato chiesto'
             when not consenso_valido(c.id) then 'si è cancellato'
             when c.email is null then 'non ha lasciato una mail'
             else null
           end
      from customers c
     order by (consenso_valido(c.id) and c.email is not null and c.active) desc,
              coalesce(c.name, c.phone);
end;
$fn$;

revoke all on function destinatari_commerciali() from public, anon, authenticated;
grant execute on function destinatari_commerciali() to authenticated;


create or replace function registra_invio_commerciale(
  p_customer_id uuid,
  p_oggetto     text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_email text;
  v_nome  text;
begin
  if not is_titolare() then
    raise exception 'Le comunicazioni ai clienti sono riservate al titolare.';
  end if;

  select email, coalesce(name, phone) into v_email, v_nome
    from customers where id = p_customer_id;
  if v_nome is null then
    raise exception 'Questo cliente non esiste più.';
  end if;

  -- 🔴 IL RIFIUTO CHE REGGE IL MANDATO. Senza consenso non esce niente, e la
  -- frase dice cosa manca — non «operazione non consentita».
  if not consenso_valido(p_customer_id) then
    raise exception
      '% non ha dato il consenso a ricevere comunicazioni (o si è cancellato). Chiediglielo e segnalo sulla sua scheda.',
      v_nome;
  end if;
  if v_email is null then
    raise exception 'Di % non hai una mail.', v_nome;
  end if;

  insert into email_inviate (customer_id, tipo, oggetto)
  values (p_customer_id, 'commerciale', p_oggetto);

  return jsonb_build_object('cliente', v_nome, 'email', v_email);
end;
$fn$;

revoke all on function registra_invio_commerciale(uuid, text) from public, anon, authenticated;
grant execute on function registra_invio_commerciale(uuid, text) to authenticated;


-- ---------------------------------------------------------------------
-- 4 · LA STORIA SULLA SCHEDA DEL CLIENTE
-- ---------------------------------------------------------------------
-- Cosa gli è stato mandato e cosa ha scritto lui, in ordine di tempo.
--
-- ⚠️ Le mail ricevute si riconoscono dal MITTENTE confrontato con la mail
-- sulla sua scheda, e non si fotografa nessun collegamento: un cliente può
-- cambiare indirizzo, e una colonna scritta una volta racconterebbe una
-- storia che smette di essere vera. Il prezzo è dichiarato — cambiando mail,
-- la storia vecchia non si vede più — ed è preferibile a una storia falsa.
create or replace function storia_cliente(p_customer_id uuid)
returns table (
  quando  timestamptz,
  verso   text,
  cosa    text,
  dettaglio text
)
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare v_email text;
begin
  if not is_titolare() then
    raise exception 'La storia di un cliente è riservata al titolare.';
  end if;
  select email into v_email from customers where id = p_customer_id;

  return query
    select e.inviata_il, 'uscita'::text, e.tipo,
           coalesce(e.oggetto, 'Conferma di prenotazione')
      from email_inviate e
     where e.customer_id = p_customer_id
        or e.reservation_id in (select r.id from reservations r where r.customer_id = p_customer_id)
    union all
    select p.ricevuta_il, 'entrata'::text, 'mail'::text, coalesce(p.oggetto, '(senza oggetto)')
      from posta_ricevuta p
     -- 🔴 UGUAGLIANZA, NON «CONTIENE», e questo l'ho trovato rileggendo il
     -- lavoro appena scritto. Con `like '%mail%'` la storia di `rossi@x.it`
     -- avrebbe mostrato anche le mail di `mario.rossi@x.it`: **la
     -- corrispondenza di un cliente dentro la scheda di un altro**, e nessuna
     -- schermata l'avrebbe segnalato — le righe sembrano legittime.
     -- ⚠️ Il mittente può arrivare come `Nome <mail@dominio>` o come sola
     -- mail: si estrae quello che sta fra le parentesi angolari se ci sono, e
     -- si confronta per uguale.
     where v_email is not null
       and lower(coalesce(substring(p.mittente from '<([^>]+)>'), p.mittente))
           = lower(btrim(v_email))
    union all
    select (r.reservation_date + r.reservation_time) at time zone 'Europe/Rome',
           'prenotazione'::text, r.status::text,
           format('%s persone', r.party_size)
      from reservations r
     where r.customer_id = p_customer_id
     order by 1 desc;
end;
$fn$;

revoke all on function storia_cliente(uuid) from public, anon, authenticated;
grant execute on function storia_cliente(uuid) to authenticated;


-- ---------------------------------------------------------------------
-- 5 · L'ELENCO DEI NUMERI PER LA LISTA BROADCAST
-- ---------------------------------------------------------------------
-- 🔴 IL GESTIONALE NON MANDA LISTE WHATSAPP, misurato prima di prometterlo:
-- WhatsApp normale non consente invii automatici a una lista, e l'account
-- business ufficiale Alessio ha deciso di non prenderlo. Quello che può fare
-- è preparare **l'elenco dei numeri** — che è la parte noiosa del lavoro a
-- mano.
--
-- 🔴 E IL LIMITE DELLA RUBRICA ESCE INSIEME ALL'ELENCO, non in un documento:
-- un messaggio broadcast **non arriva a chi non ha il numero di Alessio
-- salvato in rubrica**, e nessuno lo segnala — risulta «mandato» e non è mai
-- arrivato. È la forma esatta di *«una risposta più corta che ha l'aria di
-- essere intera»*, e il gestionale **non può saperlo**: non ha accesso alla
-- rubrica del telefono. Quindi lo dice.
create or replace function numeri_per_broadcast()
returns table (numeri text, quanti integer, avvertenza text)
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_numeri text[];
  v_n      integer;
begin
  if not is_titolare() then
    raise exception 'La rubrica dei clienti è riservata al titolare.';
  end if;

  select array_agg(c.phone order by coalesce(c.name, c.phone)) into v_numeri
    from customers c
   where c.active and c.phone is not null and consenso_valido(c.id);
  v_n := coalesce(array_length(v_numeri, 1), 0);

  return query select
    array_to_string(coalesce(v_numeri, '{}'), E'\n'),
    v_n,
    case
      when v_n = 0 then
        'Nessun cliente ha dato il consenso: non c''è nessun numero da copiare.'
      when v_n > 256 then
        format('Sono %s numeri, e una lista broadcast di WhatsApp ne tiene 256: vanno divisi in più liste. E il messaggio arriva SOLO a chi ha il tuo numero salvato in rubrica — agli altri non arriva, e WhatsApp non te lo dice.', v_n)
      else
        format('%s numeri. ⚠️ Il messaggio arriva SOLO a chi ha il tuo numero salvato in rubrica: agli altri non arriva, e WhatsApp non te lo segnala. Una lista ne tiene al massimo 256.', v_n)
    end;
end;
$fn$;

revoke all on function numeri_per_broadcast() from public, anon, authenticated;
grant execute on function numeri_per_broadcast() to authenticated;


-- ---------------------------------------------------------------------
-- VERIFICA
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_tit   uuid;
  v_c1    uuid;
  v_c2    uuid;
  v_c3    uuid;
  v_r     jsonb;
  v_n     integer;
  v_ok    boolean;
  v_lap_p integer;
  v_lap_d integer;
begin
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  if v_tit is null then raise exception 'Nessun titolare: impossibile verificare.'; end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);
  select count(*) into v_lap_p from deleted_records;

  -- 🔴 TRE CLIENTI, NON UNO, e il numero è scelto perché DISTINGUA: con un
  -- cliente solo «tutti» e «solo quelli col consenso» sono lo stesso insieme,
  -- e nessuna di queste prove misurerebbe niente.
  -- ⚠️ I telefoni devono essere numerici (un vincolo della tabella), quindi
  -- il marcatore sta nel NOME. E i numeri cominciano per 000, che non è un
  -- prefisso di nessun paese: la lezione del 17/08 dice di scegliere un
  -- marcatore che non possa acquistare significato il giorno che qualcuno
  -- interroga quella colonna.
  insert into customers (phone, name, email)
  values ('0000000001', '__VERIFICA__ col consenso', 'a@esempio.it') returning id into v_c1;
  insert into customers (phone, name, email)
  values ('0000000002', '__VERIFICA__ senza consenso', 'b@esempio.it') returning id into v_c2;
  insert into customers (phone, name, email)
  values ('0000000003', '__VERIFICA__ cancellato', 'c@esempio.it') returning id into v_c3;

  -- 1 · IL CONSENSO NASCE VUOTO, e vuoto NON è «no»: è «non gliel'ho chiesto».
  if consenso_valido(v_c1) then
    raise exception 'Un cliente appena creato risulta già consenziente.';
  end if;

  perform registra_consenso(v_c1, 'al telefono');
  if not consenso_valido(v_c1) then
    raise exception 'Il consenso registrato non risulta valido.';
  end if;
  -- ⚠️ E la colonna calcolata dice la STESSA cosa: e' quella che legge la
  -- schermata, e se le due divergessero il difetto sarebbe invisibile.
  if not (select puo_ricevere_commerciali from customers where id = v_c1) then
    raise exception 'La colonna calcolata non concorda con la regola.';
  end if;

  -- 2 · SI PRETENDE *COME* L'HA DATO.
  v_ok := false;
  begin
    perform registra_consenso(v_c2, '   ');
  exception when others then v_ok := true;
  end;
  if not v_ok then raise exception 'Un consenso è stato registrato senza dire come.'; end if;

  -- 3 · CHI SI CANCELLA ESCE DAVVERO.
  perform registra_consenso(v_c3, 'di persona');
  if not consenso_valido(v_c3) then raise exception 'Il terzo consenso non è valido.'; end if;
  perform revoca_consenso(v_c3);
  if consenso_valido(v_c3) then
    raise exception 'Chi si è cancellato risulta ancora consenziente.';
  end if;
  -- ⚠️ E la revoca NON cancella la prova che il consenso c'era stato.
  if (select consenso_commerciale_il from customers where id = v_c3) is null then
    raise exception 'La revoca ha cancellato la prova che il consenso c''era stato.';
  end if;

  -- 4 · 🔴 LA PORTA COMMERCIALE RIFIUTA CHI NON HA IL CONSENSO.
  v_ok := false;
  begin
    perform registra_invio_commerciale(v_c2, 'Il menu del mese');
  exception when others then
    v_ok := true;
    if sqlerrm not like '%consenso%' then
      raise exception 'Il rifiuto non parla di consenso: %', sqlerrm;
    end if;
  end;
  if not v_ok then
    raise exception 'Una comunicazione commerciale è uscita verso chi non ha dato il consenso.';
  end if;

  -- ...e verso chi si è cancellato.
  v_ok := false;
  begin
    perform registra_invio_commerciale(v_c3, 'Il menu del mese');
  exception when others then v_ok := true;
  end;
  if not v_ok then
    raise exception 'Una comunicazione commerciale è uscita verso chi si era cancellato.';
  end if;

  -- ...e passa verso chi il consenso ce l'ha.
  v_r := registra_invio_commerciale(v_c1, 'Il menu del mese');
  if v_r->>'email' <> 'a@esempio.it' then
    raise exception 'La comunicazione non è andata al cliente giusto.';
  end if;

  -- 5 · L'ELENCO DEI DESTINATARI DICE ANCHE CHI RESTA FUORI, E PERCHÉ.
  --     ⚠️ Un elenco senza gli esclusi si legge «sono tutti».
  select count(*) into v_n from destinatari_commerciali()
   where nome like '__VERIFICA__%' and puo_ricevere;
  if v_n <> 1 then
    raise exception 'I destinatari validi risultano % invece di 1.', v_n;
  end if;
  select count(*) into v_n from destinatari_commerciali()
   where nome like '__VERIFICA__%' and not puo_ricevere and perche_no is not null;
  if v_n <> 2 then
    raise exception 'Gli esclusi con la ragione risultano % invece di 2.', v_n;
  end if;

  -- 6 · L'ELENCO DEI NUMERI PORTA IL LIMITE DELLA RUBRICA.
  --     ⚠️ Il gestionale non può sapere chi ha il numero di Alessio in
  --     rubrica: deve dirlo, non stimarlo.
  if (select avvertenza from numeri_per_broadcast()) not like '%rubrica%' then
    raise exception 'L''elenco dei numeri non avverte del limite della rubrica.';
  end if;
  if (select numeri from numeri_per_broadcast()) not like '%0000000001%' then
    raise exception 'Il cliente col consenso non compare fra i numeri.';
  end if;
  if (select numeri from numeri_per_broadcast()) like '%0000000002%' then
    raise exception 'Un cliente senza consenso compare fra i numeri della lista.';
  end if;

  -- 7 · LA STORIA DEL CLIENTE VEDE QUELLO CHE GLI È STATO MANDATO.
  select count(*) into v_n from storia_cliente(v_c1) where verso = 'uscita';
  if v_n <> 1 then
    raise exception 'La storia del cliente riporta % invii invece di 1.', v_n;
  end if;

  -- 8 · 🔴 E NON VEDE LA CORRISPONDENZA DI UN ALTRO CLIENTE.
  --     Il cliente 1 ha 'a@esempio.it'; questa mail arriva da 'xa@esempio.it',
  --     che CONTIENE il suo indirizzo. Con un confronto «contiene» sarebbe
  --     comparsa nella sua storia — la posta di uno dentro la scheda di un
  --     altro, e nessuna schermata l'avrebbe segnalato.
  insert into posta_ricevuta (messaggio_id, casella, mittente, oggetto, stato)
  values ('__VERIFICA__msg', 'info@borgo58.it', 'Tale <xa@esempio.it>',
          '__VERIFICA__ non è sua', 'archiviata');
  select count(*) into v_n from storia_cliente(v_c1) where verso = 'entrata';
  if v_n <> 0 then
    raise exception
      'La storia del cliente mostra % mail che non sono sue: il mittente è confrontato con «contiene» invece che per uguale.', v_n;
  end if;
  delete from posta_ricevuta where messaggio_id = '__VERIFICA__msg';

  -- =========== PULIZIA ===========
  delete from email_inviate where customer_id in (v_c1, v_c2, v_c3);
  delete from customers where name like '__VERIFICA__%';

  if exists (select 1 from customers where name like '__VERIFICA__%') then
    raise exception 'La verifica ha lasciato dei clienti finti.';
  end if;
  select count(*) into v_lap_d from deleted_records;
  if v_lap_d <> v_lap_p then
    raise exception 'La verifica ha lasciato % lapidi nel registro.', v_lap_d - v_lap_p;
  end if;

  perform set_config('request.jwt.claims', null, true);
  raise notice 'Il consenso si registra e si revoca, e la porta commerciale rifiuta chi non ce l''ha.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260820000011', 'il_consenso_prima_di_tutto')
on conflict (version) do nothing;
