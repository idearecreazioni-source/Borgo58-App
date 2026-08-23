-- =====================================================================
-- IL REGISTRO DELLE CANCELLAZIONI RIPARTE DA ZERO
-- 23/08/2026 — reperto del validatore, decisione di Alessio
-- =====================================================================
-- 🔴 IL REPERTO. Negli appunti era annotato che in produzione ci fossero
-- **29** tracce; ce ne sono **43**. Il numero era giusto quando fu scritto
-- e nessuno l'ha piu' riletto — la stessa forma con cui, in questo
-- progetto, sono gia' invecchiati l'elenco dei dati di collaudo (tre volte
-- in sei giorni) e il conteggio delle funzioni senza portiere.
--
-- ⚠️ E LA CURA NON E' AGGIORNARE IL NUMERO. Un conteggio scritto a mano
-- torna sbagliato al primo gesto: quello che serve e' che la domanda si
-- faccia al database. `npm run collaudo:stato` lo fa gia'.
--
-- ---------------------------------------------------------------------
-- LA DECISIONE DI ALESSIO: si svuota tutto, non si separa niente
-- ---------------------------------------------------------------------
-- *«Non c'e' bisogno di distinguere le tracce di prova da quelle vere,
-- perche' il locale apre a marzo 2027 e in produzione non esiste una sola
-- riga vera: va svuotato tutto prima che entri il primo dato vero.»*
--
-- ⚠️ E' UNA DECISIONE CHE HA UNA FINESTRA, ed e' adesso. Oggi ogni riga di
-- quel registro e' la lapide di un dato di collaudo; dal primo dato vero in
-- poi separare le une dalle altre diventa un lavoro di archeologia, e il
-- registro e' **esibibile** — cioe' un posto dove non si va a frugare.
--
-- ---------------------------------------------------------------------
-- COSA TOGLIE, misurato in produzione il 23/08
-- ---------------------------------------------------------------------
--   cash_movements    13     documents         10     order_items        6
--   discounts_gifts    4     supplier_invoices  3     employees          2
--   employee_leaves    2     reservations       1     payslips           1
--   order_payments     1                                    ── 43 in tutto
--
-- Fra il 13 e il 22 agosto: 22 da un utente vero (i collaudi di Alessio),
-- 21 da migrazioni e lavori pianificati.
--
-- ---------------------------------------------------------------------
-- IL PERIMETRO E' UNA DATA, ed e' voluto
-- ---------------------------------------------------------------------
-- ⚠️ NON «svuota la tabella»: toglie solo cio' che esisteva quando questa
-- migrazione e' stata scritta. Le due ragioni:
--   · rieseguirla non deve portarsi via le tracce nate DOPO — che dal
--     primo dato vero in poi sono la storia del locale;
--   · la stessa migrazione passa prima dal progetto di prova, dove le
--     tracce sono centinaia e tutte di collaudo: il taglio a data le
--     prende, e lascia stare quello che nascera' li' domani.
--
-- ⚠️ E' l'unico caso in cui un numero fisso e' onesto: non descrive «com'e'
-- fatto il mondo» ma «fin dove arrivava quando ho guardato».
--
-- ---------------------------------------------------------------------
-- ⚠️ QUESTA MIGRAZIONE ASPETTA IL VIA LIBERA DI ALESSIO
-- ---------------------------------------------------------------------
-- *«NON svuotarlo adesso: aspetta che io abbia il backup fuori dal
-- computer e ti dia il via libera.»* Per tenerla indietro lasciando
-- passare le altre:  npm run migra -- --salta 20260823000022 --conferma
-- =====================================================================

-- Fin dove arrivava il registro quando questa migrazione e' stata scritta.
-- Tutto cio' che e' nato dopo non si tocca.
do $svuota$
declare
  v_limite constant timestamptz := timestamptz '2026-08-24 00:00:00+02';
  v_prima  integer;
  v_tolte  integer;
  v_dopo   integer;
begin
  select count(*) into v_prima from deleted_records;

  delete from deleted_records where deleted_at < v_limite;
  get diagnostics v_tolte = row_count;

  select count(*) into v_dopo from deleted_records;

  -- ⚠️ Si DICHIARA quante righe ha tolto (regola del 16/08): uno zero non
  -- e' un errore — vuol dire «gia' fatto», o «su questo database non ce
  -- n'erano» — ma va detto, perche' e' il silenzio ad aver ingannato.
  raise notice 'Registro delle cancellazioni: c''erano % tracce, ne ho tolte %, ne restano %.',
    v_prima, v_tolte, v_dopo;
end $svuota$;

-- ---------------------------------------------------------------------
-- VERIFICA
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_vecchie integer;
  v_tit     uuid;
  v_ente    uuid;
  v_ing     uuid;
  v_dopo    integer;
  v_prima   integer;
begin
  -- 1. Non e' rimasta nessuna traccia di prima della soglia.
  select count(*) into v_vecchie
    from deleted_records where deleted_at < timestamptz '2026-08-24 00:00:00+02';
  if v_vecchie <> 0 then
    raise exception 'Sono rimaste % tracce vecchie nel registro.', v_vecchie;
  end if;

  -- 2. 🔴 E IL REGISTRO CONTINUA A REGISTRARE. E' il controllo che conta:
  --    svuotare una tabella e spegnerla per sbaglio si somigliano molto, e
  --    un registro che non scrive piu' non lo direbbe nessuno finche' non
  --    serve. Si cancella una riga vera di una tabella tracciata e si
  --    pretende che la traccia nasca.
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  select id into v_ente from entities order by created_at limit 1;
  if v_tit is null or v_ente is null then
    raise exception 'Manca un titolare o una societa'': non posso verificare.';
  end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);

  select count(*) into v_prima from deleted_records;

  insert into ingredients (entity_id, name, category, unit, current_price)
  values (v_ente, 'ZZ prova registro', 'altro', 'kg', 1)
  returning id into v_ing;
  -- ⚠️ `ingredients` NON e' fra le tabelle tracciate: la prova si fa su una
  -- che lo e' davvero, altrimenti passerebbe verde senza provare niente.
  insert into cash_movements (entity_id, direction, amount, movement_date, business_purpose)
  values (v_ente, 'uscita', 1.00, (now() at time zone 'Europe/Rome')::date, 'ZZ prova registro');

  delete from cash_movements where business_purpose = 'ZZ prova registro';

  select count(*) into v_dopo from deleted_records;
  if v_dopo <> v_prima + 1 then
    raise exception 'Il registro non ha scritto la traccia: % invece di %.', v_dopo, v_prima + 1;
  end if;

  -- pulizia: si tolgono le righe di cui si conosce l'identificativo, e la
  -- traccia che questa verifica stessa ha appena prodotto.
  delete from deleted_records
   where table_name = 'cash_movements' and record->>'business_purpose' = 'ZZ prova registro';
  delete from ingredients where id = v_ing;

  select count(*) into v_dopo from deleted_records;
  if v_dopo <> v_prima then
    raise exception 'La verifica ha lasciato % tracce dietro di se''.', v_dopo - v_prima;
  end if;

  perform set_config('request.jwt.claims', null, true);
  raise notice 'Verifica passata: il registro e'' vuoto di cio'' che era di prova, e continua a registrare.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260823000022', 'il_registro_riparte_da_zero') on conflict (version) do nothing;
