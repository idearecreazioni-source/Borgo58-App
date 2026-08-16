-- =====================================================================
-- Le scritture che devono passare dal corridoio
-- =====================================================================
-- Blocco 3 del mandato di correzione (16/08/2026).
--
-- 3.1 — «HA DISDETTO» ERANO DUE SCRITTURE SEPARATE DAL BROWSER.
-- In `PiantaGiornata.jsx`: prima si portava la prenotazione ad
-- «annullata», poi si liberavano i tavoli. Forma vietata dal Contratto B4,
-- e il modo in cui fallisce e' quello brutto: **al fallimento a metà
-- restano righe orfane invisibili**. Una prenotazione annullata che tiene
-- ancora i suoi tavoli non si vede da nessuna parte — l'elenco della
-- giornata mostra le prenotazioni attive, e quei tavoli risultano
-- occupati da qualcuno che non verra' piu'. Al telefono, la sera, si dice
-- «non c'e' posto» per un tavolo libero.
--
-- ⚠️ E LA PORTA ERA PIU' DI UNA. Guardando per correggere e' emerso che
-- lo stesso gesto esiste anche in `ReservationForm.jsx`, dove
-- «confermata → annullata» e «richiesta → rifiutata» facevano un `update`
-- diretto **senza liberare niente**: li' i tavoli restavano attaccati
-- sempre, non solo in caso di guasto. Una funzione sola serve tutte e due
-- le porte, altrimenti si cura la porta che il mandato nomina e resta
-- aperta quella che non nomina.
--
-- ⚠️ NON e' un `delete` piu' un `update` messi in una funzione per forma:
-- il legame fra i due fatti e' che **una prenotazione che non ci sara'
-- non deve tenere niente**. Chi scrivera' domani un terzo posto da cui si
-- annulla una prenotazione trova la funzione, non due istruzioni da
-- ricopiare nell'ordine giusto.
--
-- 3.2 — IL CENSIMENTO. Il mandato chiede l'elenco a mano di ogni funzione
-- che scrive su piu' di una tabella e viene chiamata direttamente dal
-- browser, e avverte che l'estrazione automatica non e' affidabile perche'
-- i blocchi di verifica dentro le migrazioni la inquinano. Il censimento
-- sta nel riepilogo di consegna; qui c'e' quello che ne resta nel codice:
-- **niente da cambiare nel database**. Le quattro funzioni trovate
-- (`merge_customers`, `close_shopping_list_item`,
-- `record_stock_consumption`, `update_ingredient_price`) sono gia'
-- atomiche dentro — cambia solo la strada da cui il browser le chiama.
--
-- ⚠️ E QUELLA STRADA NON E' IMPONIBILE DAL DATABASE, quindi si dichiara
-- invece di fingere: il corridoio chiama le funzioni **col token
-- dell'utente vero**, cioe' col permesso `authenticated` identico a
-- quello che avrebbe il browser. Togliere il permesso al browser lo
-- toglierebbe anche al corridoio. La rete e' quindi una **prova
-- automatica** che si costruisce l'elenco interrogando il database e
-- diventa rossa da sola se una funzione multi-tabella ricompare in una
-- chiamata diretta (`tests/app/scritture-dal-corridoio.test.js`). E' la
-- stessa scelta del 13/08 sull'elenco delle funzioni aperte ad `anon`:
-- dove il vincolo non e' esprimibile, il controllo vive in una prova che
-- grida da sola, non nella memoria di chi scrive.
--
-- ⚠️ Stato di partenza VERO, letto col connettore: 2 prenotazioni di
-- prova in produzione (le sue del 14/08), una sola con un tavolo
-- assegnato. Nessuna e' annullata, quindi non esiste oggi nessuna riga
-- orfana da sanare — verificato, non supposto.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Annullare una prenotazione e liberare i suoi tavoli: una cosa sola
-- ---------------------------------------------------------------------
create or replace function annulla_prenotazione(
  p_reservation_id uuid,
  p_stato          text default 'annullata'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $funzione$
declare
  v_res     reservations%rowtype;
  v_liberati integer;
begin
  -- Annullare e' lavoro di sala, non solo del titolare: stesso criterio
  -- di `assegna_prenotazione`, il controllo e' che ci sia un utente vero.
  if auth.uid() is null then
    raise exception 'Operazione consentita solo a un utente autenticato';
  end if;

  if p_stato not in ('annullata', 'rifiutata') then
    raise exception 'Stato non ammesso per una prenotazione che si chiude: %', p_stato;
  end if;

  select * into v_res from reservations where id = p_reservation_id for update;
  if not found then
    raise exception 'Prenotazione non trovata';
  end if;

  if v_res.status::text = p_stato then
    raise exception 'Questa prenotazione risulta gia'' %.', p_stato;
  end if;

  update reservations set status = p_stato::reservation_status
   where id = p_reservation_id;

  delete from prenotazione_tavoli where reservation_id = p_reservation_id;
  get diagnostics v_liberati = row_count;

  return jsonb_build_object(
    'stato', p_stato,
    'tavoli_liberati', v_liberati
  );
end;
$funzione$;

comment on function annulla_prenotazione is
  'Porta una prenotazione ad «annullata» o «rifiutata» E libera i suoi tavoli, in una transazione (16/08/2026, Blocco 3). Prima erano due scritture separate dal browser in una porta, e nell''altra i tavoli non venivano liberati affatto: una prenotazione che non ci sara'' teneva occupati tavoli veri, e la cosa non si vedeva da nessuna schermata.';

revoke all on function annulla_prenotazione(uuid, text) from public, anon, authenticated;
grant execute on function annulla_prenotazione(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- 2. L'elenco che la prova automatica interroga
-- ---------------------------------------------------------------------
-- ⚠️ Vive nel database e non nel file della prova, per la ragione per cui
-- il mandato diffida del censimento automatico: un elenco scritto a mano
-- in un file di prova invecchia in silenzio, e chi aggiunge una funzione
-- multi-tabella non ha nessun motivo per ricordarsene. Cosi' invece la
-- domanda si rifa' da sola a ogni esecuzione.
--
-- Il filtro `pg_class` e' la parte che rende l'estrazione affidabile dove
-- il mandato l'aveva trovata inaffidabile: si contano solo i nomi che
-- sono davvero TABELLE di `public`, quindi `update ... loop`, i cursori e
-- il testo dei commenti non entrano nel conto.
create or replace function funzioni_multi_tabella()
returns table (
  nome     text,
  tabelle  integer,
  quali    text
)
language sql
stable
security definer
set search_path = public
as $funzione$
  with scritture as (
    select p.proname::text as nome, m[2] as tabella
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public',
    lateral regexp_matches(
      pg_get_functiondef(p.oid),
      '(insert into|update|delete from)\s+(?:public\.)?([a-z_0-9]+)', 'gi') m
    where p.provolatile = 'v'
      and exists (
        select 1 from pg_class c
        join pg_namespace nn on nn.oid = c.relnamespace
        where nn.nspname = 'public' and c.relkind in ('r', 'p') and c.relname = m[2]
      )
  )
  select nome, count(distinct tabella)::integer, string_agg(distinct tabella, ', ')
    from scritture
   group by nome
  having count(distinct tabella) > 1
   order by nome;
$funzione$;

comment on function funzioni_multi_tabella() is
  'Ogni funzione che SCRIVE su piu'' di una tabella (16/08/2026, Blocco 3). Nessuna di queste puo'' essere chiamata direttamente dal browser: devono passare dal corridoio (Contratto B4). La regola non e'' imponibile con un permesso — il corridoio usa il token dell''utente, quindi ha gli stessi diritti del browser — ed e'' per questo che la sorveglia una prova automatica che si costruisce l''elenco da qui.';

revoke all on function funzioni_multi_tabella() from public, anon, authenticated;
grant execute on function funzioni_multi_tabella() to authenticated;

-- ---------------------------------------------------------------------
-- 3. Verifica sul campo (§5 punti 1-3)
-- ---------------------------------------------------------------------
-- ⚠️ Nessun gestore d'eccezione sul blocco esterno (lezione del 15/08), e
-- perimetro fatto solo di roba creata qui (lezione del 16/08).
--
-- ⚠️ Il trigger delle notifiche su `reservations` va SPENTO: una
-- prenotazione finta con `source = 'form_pubblico'` farebbe suonare il
-- telefono di Alessio come un cliente vero (trappola dell'11/08). Qui la
-- prenotazione nasce `interno`, ma il trigger si spegne lo stesso e si
-- verifica di averlo riacceso: lasciarlo spento significa richieste dei
-- clienti che non arrivano piu', in silenzio.
do $verifica$
declare
  v_titolare uuid;
  v_tav1 uuid; v_tav2 uuid;
  v_res uuid;
  v_esito jsonb;
  v_stato text;
  n integer;
  respinto boolean;
  v_trigger text;
begin
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  if v_titolare is null then
    raise exception 'Nessun titolare in user_roles: impossibile verificare.';
  end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

  select tgname into v_trigger from pg_trigger
   where tgrelid = 'reservations'::regclass and not tgisinternal
     and pg_get_triggerdef(oid) ilike '%notif%' limit 1;
  if v_trigger is not null then
    execute format('alter table reservations disable trigger %I', v_trigger);
  end if;

  -- Due sagome della prova, non due vere: una prenotazione di prova su un
  -- tavolo vero lascerebbe la sala di stasera con un tavolo occupato da
  -- nessuno se qualcosa andasse storto a meta'.
  insert into dining_tables (label, tipo, larghezza_cm, profondita_cm, x, y)
  -- ⚠️ In fondo alla pianta, non fuori: il vincolo pretende coordinate fra
  -- 0 e 5000, e una prova che le forza sarebbe una prova che chiede alla
  -- sala di essere diversa da com'e'.
  values ('__PB3-1__', 'tavolo', 90, 90, 4800, 4800) returning id into v_tav1;
  insert into dining_tables (label, tipo, larghezza_cm, profondita_cm, x, y)
  values ('__PB3-2__', 'tavolo', 90, 90, 4800, 4600) returning id into v_tav2;

  insert into reservations (customer_name, reservation_date, reservation_time, party_size, status, source)
  values ('__Prova B3__', current_date + 30, '20:00', 4, 'confermata', 'interno')
  returning id into v_res;

  -- Tre parametri e non quattro: `rischio_accettato` e' stato RIMOSSO il
  -- 14/08 insieme al resto della capienza calcolata.
  perform assegna_prenotazione(v_res, array[v_tav1, v_tav2], true);
  select count(*) into n from prenotazione_tavoli where reservation_id = v_res;
  if n <> 2 then
    raise exception 'La prenotazione di prova non ha 2 tavoli ma %.', n;
  end if;

  -- 3a. «Ha disdetto»: lo stato cambia E i tavoli si liberano, insieme.
  v_esito := annulla_prenotazione(v_res);
  select status::text into v_stato from reservations where id = v_res;
  if v_stato <> 'annullata' then
    raise exception 'Dopo l''annullamento lo stato e'' «%».', v_stato;
  end if;
  select count(*) into n from prenotazione_tavoli where reservation_id = v_res;
  if n <> 0 then
    raise exception 'La prenotazione annullata tiene ancora % tavoli.', n;
  end if;
  if (v_esito->>'tavoli_liberati')::integer <> 2 then
    raise exception 'L''esito dichiara % tavoli liberati invece di 2.', v_esito->>'tavoli_liberati';
  end if;

  -- 3b. Annullare due volte e' un rifiuto, non un secondo annullamento a
  -- vuoto: chi preme due volte deve sapere che la prima e' gia' passata.
  respinto := false;
  begin
    perform annulla_prenotazione(v_res);
  exception when sqlstate 'P0001' then
    respinto := true;
  end;
  if not respinto then
    raise exception 'Annullare una prenotazione gia'' annullata non e'' stato respinto.';
  end if;

  -- 3c. Uno stato che non chiude niente non passa di qui.
  respinto := false;
  begin
    perform annulla_prenotazione(v_res, 'confermata');
  exception when sqlstate 'P0001' then
    respinto := true;
  end;
  if not respinto then
    raise exception 'annulla_prenotazione ha accettato uno stato che non chiude la prenotazione.';
  end if;

  -- 3d. E il censimento vede se stesso: le funzioni che il corridoio deve
  -- servire ci sono tutte, e quelle a tabella sola no.
  if not exists (select 1 from funzioni_multi_tabella() where nome = 'annulla_prenotazione') then
    raise exception 'Il censimento non vede annulla_prenotazione fra le multi-tabella.';
  end if;
  if exists (select 1 from funzioni_multi_tabella() where nome = 'register_stock_delivery') then
    raise exception 'Il censimento conta come multi-tabella una funzione che scrive una tabella sola.';
  end if;
  select count(*) into n from funzioni_multi_tabella()
   where nome in ('merge_customers', 'close_shopping_list_item',
                  'record_stock_consumption', 'update_ingredient_price');
  if n <> 4 then
    raise exception 'Il censimento trova % delle 4 funzioni nominate dal mandato.', n;
  end if;

  -- PULIZIA. `reservations` non e' fra le tabelle sorvegliate da
  -- deleted_records, quindi non restano lapidi.
  delete from prenotazione_tavoli where reservation_id = v_res;
  delete from reservations where id = v_res;
  delete from dining_tables where id in (v_tav1, v_tav2);

  if v_trigger is not null then
    execute format('alter table reservations enable trigger %I', v_trigger);
    -- ⚠️ Riacceso E VERIFICATO: un trigger di notifica lasciato spento non
    -- da' nessun errore, semplicemente le richieste dei clienti non
    -- arrivano piu' a nessuno.
    if not exists (
      select 1 from pg_trigger
       where tgrelid = 'reservations'::regclass and tgname = v_trigger and tgenabled <> 'D'
    ) then
      raise exception 'Il trigger delle notifiche e'' rimasto SPENTO su reservations.';
    end if;
  end if;

  select count(*) into n from reservations where customer_name = '__Prova B3__';
  if n <> 0 then raise exception 'La verifica ha lasciato % prenotazioni.', n; end if;
  select count(*) into n from dining_tables where label like '\_\_PB3-%';
  if n <> 0 then raise exception 'La verifica ha lasciato % sagome.', n; end if;

  perform set_config('request.jwt.claims', null, true);
  raise notice 'Blocco 3: una prenotazione che non ci sara'' non tiene piu'' niente, e il censimento si rifa'' da solo.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260816000007', 'le_scritture_dal_corridoio')
on conflict (version) do nothing;

select
  (select count(*) from funzioni_multi_tabella())                                    as funzioni_multi_tabella,
  (select count(*) from reservations where status = 'annullata')                     as prenotazioni_annullate,
  (select count(*) from prenotazione_tavoli pt join reservations r on r.id = pt.reservation_id
    where r.status in ('annullata', 'rifiutata'))                                    as tavoli_tenuti_da_chi_non_viene;
