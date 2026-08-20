-- =====================================================================
-- L'EVENTO ACCETTATO — blocco 4 del mandato dei preventivi
-- 20/08/2026
-- =====================================================================
-- E' ALESSIO A DIRE «ACCETTATO»: un evento si conferma con una caparra, una
-- telefonata, un messaggio, e il momento in cui diventa certo lo decide lui.
-- Da li' il gestionale crea il resto, prenotazione compresa.
--
-- 🔴 «SALA PIENA» LA DECIDE LA CAPIENZA, NON L'EVENTO. Se l'evento riempie
-- la sala, la spunta di quel giorno si accende da sola; se quella sera ci sta
-- insieme alle prenotazioni gia' prese, e' conciliabile e la spunta non si
-- accende. ⚠️ Una regola sola, nessun caso speciale: si guarda **quante
-- persone sono attese contro quanti posti ha la sala**, e l'evento e' una
-- prenotazione come le altre nel momento in cui quel conto si fa.
--
-- ⚠️ E LA SPUNTA MESSA A MANO DA ALESSIO NON SI TOCCA MAI. Per questo
-- `giornate_sold_out` impara **da dove viene**: vuota vuol dire «l'ha decisa
-- lui», e all'annullamento di un evento resta accesa. Senza quella colonna,
-- annullare un evento spegnerebbe una decisione sua — in silenzio.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1 · IL PREVENTIVO SA QUALE EVENTO HA GENERATO
-- ---------------------------------------------------------------------
-- ⚠️ `on delete restrict`, mai `set null`: il difetto del 16/08 era nello
-- schema prima che nelle funzioni — un documento che ha generato un effetto
-- non si scollega in silenzio.
alter table preventivi
  add column if not exists reservation_id uuid references reservations(id) on delete restrict,
  add column if not exists accettato_il   timestamptz,
  add column if not exists accettato_da   uuid;

comment on column preventivi.reservation_id is
  'La prenotazione nata dall''accettazione. Piu'' versioni dello stesso ceppo puntano alla STESSA prenotazione: l''evento e'' uno solo, le versioni sono la sua storia.';
comment on column preventivi.accettato_il is
  'Quando Alessio ha detto «accettato». Vuoto = non ancora accettato. Se e'' piu'' tardi di `valido_fino_al`, quel preventivo era scaduto quando e'' stato accettato — e non serve una seconda colonna per dirlo.';
comment on column preventivi.accettato_da is
  'L''accesso che ha accettato. Oggi si entra per ruolo e non per persona; l''identificativo si conserva lo stesso, cosi'' il giorno degli accessi personali la storia vecchia diventa leggibile all''indietro.';


-- ---------------------------------------------------------------------
-- 2 · LA SPUNTA SA DA DOVE VIENE
-- ---------------------------------------------------------------------
alter table giornate_sold_out
  add column if not exists preventivo_id uuid references preventivi(id) on delete restrict;

comment on column giornate_sold_out.preventivo_id is
  'Il preventivo che ha acceso questa spunta. VUOTA vuol dire che l''ha messa Alessio a mano: in quel caso nessun annullamento la spegne.';


-- ---------------------------------------------------------------------
-- 3 · QUANTI POSTI HA LA SALA, E QUANTI NE SONO GIA' PROMESSI
-- ---------------------------------------------------------------------
-- La regola vive QUI e in nessun altro posto: l'accettazione, l'annullamento
-- e la schermata leggono lo stesso conto.
--
-- ⚠️ «Non lo so» non e' «zero». Se la sala non si e' potuta leggere — nessuna
-- sagoma attiva, una pianta che non risponde — la capienza torna VUOTA e
-- `piena` torna vuota con lei. Rispondere «no» sarebbe informazione di
-- assenza spacciata per assenza di informazione (regola del 19/08), e il
-- prezzo sarebbe una sala che nessuno blocca perche' nessuno sapeva contarla.
--
-- ⚠️ Contano solo le prenotazioni CONFERMATE: dal 14/08 una richiesta in
-- attesa non occupa piu' niente, e il tavolo lo da' Alessio dalla pianta.
create or replace function capienza_della_sala(p_data date)
returns table (capienza integer, prenotati integer, piena boolean)
language sql
stable
security definer
set search_path = public
as $$
  with posti as (
    select sum(c.coperti)::integer as tot, count(*) as gruppi
      from coperti_del_giorno(p_data) c
  ),
  attesi as (
    select coalesce(sum(r.party_size), 0)::integer as tot
      from reservations r
     where r.reservation_date = p_data
       and r.status = 'confermata'
  )
  select case when posti.gruppi = 0 then null else posti.tot end,
         attesi.tot,
         case when posti.gruppi = 0 then null else attesi.tot >= posti.tot end
    from posti, attesi;
$$;

-- ⚠️ Nessun `grant`: la chiamano solo l'accettazione e il trigger, che sono
-- `security definer` e girano coi permessi del proprietario. Concederla allo
-- staff allungherebbe di una riga l'elenco delle funzioni senza portiere per
-- una cosa che nessuna schermata chiede.
revoke all on function capienza_della_sala(date) from public, anon, authenticated;


-- ---------------------------------------------------------------------
-- 4 · LE TRATTATIVE APERTE DI UN GIORNO
-- ---------------------------------------------------------------------
-- Un preventivo non ancora accettato NON blocca niente. Ma se si sta per
-- prendere una prenotazione per quel giorno, il gestionale lo dice e lascia
-- decidere.
--
-- ⚠️ La prende anche chi e' in sala, perche' e' li' che si rischia di
-- promettere un tavolo per una sera che Alessio sta trattando. Quindi la
-- funzione e' aperta a tutto lo staff — e per questo restituisce **il minimo
-- che serve a decidere**: quante persone, in che stato. Nessun prezzo,
-- nessun costo. Il nome del cliente esce solo per il titolare: e' un dato
-- suo, e in sala non serve a decidere niente.
create or replace function trattative_del_giorno(p_data date)
returns table (id uuid, persone integer, stato text, cliente text, valido_fino_al date)
language sql
stable
security definer
set search_path = public
as $$
  select p.id,
         p.persone,
         p.stato,
         case when is_titolare() then p.cliente_nome else null end,
         p.valido_fino_al
    from preventivi p
   where p.data_evento = p_data
     and p.stato in ('bozza', 'inviato')
   order by p.created_at;
$$;

revoke all on function trattative_del_giorno(date) from public, anon, authenticated;
grant execute on function trattative_del_giorno(date) to authenticated;


-- ---------------------------------------------------------------------
-- 5 · ACCETTARE
-- ---------------------------------------------------------------------
-- ⚠️ UNA VERSIONE NUOVA NON CREA UN SECONDO EVENTO. Se un antenato di questo
-- preventivo era gia' stato accettato, la sua prenotazione si **riusa** e si
-- aggiorna. Due prenotazioni per la stessa cena sarebbero due volte le stesse
-- persone in sala, e nessuna delle due sembrerebbe sbagliata.
--
-- ⚠️ SENZA L'ORA NON SI ACCETTA. `reservations.reservation_time` non ammette
-- vuoti, e inventare un orario metterebbe l'evento in sala a un'ora che
-- nessuno ha detto. Si rifiuta dicendo cosa scrivere prima.
--
-- ⚠️ UN PREVENTIVO SCADUTO SI ACCETTA LO STESSO, E LO DICE (decisione di
-- Alessio, 20/08). La scadenza serve a poter rinegoziare, non a impedire:
-- l'avvertenza torna insieme al risultato, cosi' non puo' separarsi dal
-- numero che qualifica.
create or replace function accetta_preventivo(p_preventivo_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_p          preventivi%rowtype;
  v_res        uuid;
  v_capienza   integer;
  v_prenotati  integer;
  v_piena      boolean;
  v_spunta     boolean := false;
  v_avvertenze text[] := '{}';
begin
  if not is_titolare() then
    raise exception 'I preventivi sono riservati al titolare.';
  end if;

  select * into v_p from preventivi where id = p_preventivo_id;
  if not found then
    raise exception 'Questo preventivo non esiste piu''.';
  end if;
  if v_p.stato = 'accettato' then
    raise exception 'Questo preventivo e'' gia'' accettato. Per cambiare qualcosa se ne fa una versione nuova.';
  end if;
  if v_p.stato in ('rifiutato', 'annullato') then
    raise exception 'Questo preventivo risulta %: fanne una versione nuova prima di accettarlo.', v_p.stato;
  end if;
  if v_p.ora_evento is null then
    raise exception 'Scrivi l''ora dell''evento prima di accettarlo: in sala serve a sapere quando arrivano.';
  end if;

  -- La prenotazione di un antenato accettato, se c'e'.
  with recursive catena as (
    select id, versione_di, reservation_id from preventivi where id = p_preventivo_id
    union all
    select p.id, p.versione_di, p.reservation_id
      from preventivi p join catena c on p.id = c.versione_di
  )
  select c.reservation_id into v_res
    from catena c where c.reservation_id is not null limit 1;

  if v_res is null then
    insert into reservations (type, status, source, reservation_date, reservation_time,
                              party_size, customer_name, customer_phone, customer_email,
                              customer_id)
    values ('evento', 'confermata', 'interno', v_p.data_evento, v_p.ora_evento,
            v_p.persone, v_p.cliente_nome, v_p.cliente_telefono, v_p.cliente_email,
            v_p.customer_id)
    returning id into v_res;
  else
    update reservations
       set reservation_date = v_p.data_evento,
           reservation_time = v_p.ora_evento,
           party_size       = v_p.persone,
           customer_name    = v_p.cliente_nome,
           customer_phone   = v_p.cliente_telefono,
           customer_email   = v_p.cliente_email,
           status           = 'confermata'
     where id = v_res;
    v_avvertenze := array_append(v_avvertenze,
      'Questa versione aggiorna l''evento gia'' in calendario: non ne nasce un secondo.');
  end if;

  update preventivi
     set stato          = 'accettato',
         reservation_id = v_res,
         accettato_il   = now(),
         accettato_da   = auth.uid()
   where id = p_preventivo_id;

  -- ⚠️ Il conto si fa DOPO aver messo l'evento in calendario: cosi' l'evento
  -- e' una prenotazione come le altre e non c'e' nessun caso speciale.
  select c.capienza, c.prenotati, c.piena
    into v_capienza, v_prenotati, v_piena
    from capienza_della_sala(v_p.data_evento) c;

  if v_piena is null then
    v_avvertenze := array_append(v_avvertenze,
      'Non sono riuscito a contare i posti di quella sera: la spunta «sala piena» non l''ho toccata. Guardala tu.');
  elsif v_piena then
    insert into giornate_sold_out (data, preventivo_id)
    values (v_p.data_evento, p_preventivo_id)
    on conflict (data) do nothing;
    v_spunta := true;
  end if;

  if v_p.valido_fino_al is not null and v_p.valido_fino_al < oggi_a_roma() then
    v_avvertenze := array_append(v_avvertenze,
      format('Questo preventivo era scaduto il %s: il prezzo che hai promesso e'' quello di allora.',
                to_char(v_p.valido_fino_al, 'DD/MM/YYYY')));
  end if;

  return jsonb_build_object(
    'reservation_id', v_res,
    'sala_piena',     v_spunta,
    'capienza',       v_capienza,
    'prenotati',      v_prenotati,
    'avvertenze',     to_jsonb(v_avvertenze)
  );
end;
$$;

revoke all on function accetta_preventivo(uuid) from public, anon, authenticated;
grant execute on function accetta_preventivo(uuid) to authenticated;


-- ---------------------------------------------------------------------
-- 6 · L'EVENTO ANNULLATO SPEGNE LA SPUNTA, E LO DICE
-- ---------------------------------------------------------------------
-- ⚠️ Servono TUTTE E DUE le cose: una sala che resta bloccata per errore
-- costa una serata intera, una che si sblocca in silenzio fa scoprire il buco
-- troppo tardi.
--
-- ⚠️ E' un TRIGGER, non un pezzo di `annulla_prenotazione`: una prenotazione
-- si annulla anche con una modifica dalla sua scheda, e una regola che vive
-- in una sola delle due porte non e' una regola.
--
-- ⚠️ `security definer` per NECESSITA': cancellare da `giornate_sold_out` e'
-- riservato al titolare, e ad annullare puo' essere la sala. Senza, la spunta
-- resterebbe accesa proprio nel caso in cui il gestionale la deve togliere.

-- ⚠️ IL TESTO DELL'AVVISO SI COMPONE A PARTE, e non e' un vezzo: `segnala_allarme`
-- **spedisce**, quindi provare l'avviso dentro una migrazione farebbe suonare
-- il telefono di Alessio per un evento finto (§8, gia' successo l'11/08). Con
-- la composizione separata la verifica puo' controllare **cosa direbbe**
-- l'avviso senza mandarlo — stessa scelta dell'email di conferma e della
-- sentinella.
create or replace function testo_evento_annullato(p_reservation_id uuid, p_sala_liberata boolean)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select format('Evento annullato: %s, %s persone il %s.%s',
                r.customer_name, r.party_size,
                to_char(r.reservation_date, 'DD/MM/YYYY'),
                case when p_sala_liberata then ' La sala di quella sera e'' tornata libera.'
                     else '' end)
    from reservations r where r.id = p_reservation_id;
$$;

-- ⚠️ Nessun `grant`: la chiama il trigger, e la verifica gira come proprietaria.
revoke all on function testo_evento_annullato(uuid, boolean) from public, anon, authenticated;

create or replace function evento_annullato_libera_la_sala()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prev   uuid;
  v_tolte  integer := 0;
begin
  if new.status not in ('annullata', 'rifiutata') or old.status = new.status then
    return new;
  end if;

  select id into v_prev
    from preventivi
   where reservation_id = new.id and stato = 'accettato'
   order by accettato_il desc nulls last
   limit 1;
  if v_prev is null then
    return new;
  end if;

  -- ⚠️ Si spegne SOLO la spunta che ha acceso questo preventivo. Quella messa
  -- a mano da Alessio ha `preventivo_id` vuoto e resta dov'e'.
  delete from giornate_sold_out
   where preventivo_id in (select id from preventivi where reservation_id = new.id);
  get diagnostics v_tolte = row_count;

  update preventivi set stato = 'annullato'
   where reservation_id = new.id and stato = 'accettato';

  -- ⚠️ Il tipo dell'avviso porta dentro l'evento, altrimenti il freno
  -- anti-tempesta (uno per tipo all'ora) zittirebbe il secondo evento
  -- annullato nella stessa ora. E' la lezione del 13/08 sui rincari: un
  -- freno va tarato su cio' che l'avviso identifica.
  perform segnala_allarme(
    'evento_annullato_' || new.id::text,
    testo_evento_annullato(new.id, v_tolte > 0),
    jsonb_build_object('reservation_id', new.id,
                       'preventivo_id', v_prev,
                       'sala_liberata', v_tolte > 0),
    'evento'
  );

  return new;
end;
$$;

-- ⚠️ ANCHE UNA FUNZIONE TRIGGER NASCE ESEGUIBILE DA CHIUNQUE ABBIA LA CHIAVE
-- PUBBLICA (§8, 15/08). Fuori da un trigger si rifiuterebbe di girare, ma
-- l'elenco di chi può bussare da fuori non deve crescere in silenzio — ed è
-- la prova automatica del 13/08 ad averlo trovato, che è il lavoro per cui
-- esiste.
revoke all on function evento_annullato_libera_la_sala() from public, anon, authenticated;

drop trigger if exists trg_evento_annullato on reservations;
create trigger trg_evento_annullato
  after update on reservations
  for each row execute function evento_annullato_libera_la_sala();


-- ---------------------------------------------------------------------
-- 7 · UN PREVENTIVO CHE HA GENERATO UN EVENTO NON SI CANCELLA E BASTA
-- ---------------------------------------------------------------------
-- Regola del 16/08: o la cancellazione e' respinta con un messaggio che dice
-- cosa la impedisce e cosa fare prima, oppure storna anche l'effetto. Qui si
-- respinge: dietro un evento accettato c'e' una caparra e un prezzo promesso,
-- e «ho sbagliato a scrivere il preventivo» e «l'evento non si fa» sono due
-- decisioni diverse.
create or replace function vieta_cancellazione_preventivo_accettato()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.reservation_id is not null then
    raise exception
      'Questo preventivo ha un evento in calendario. Annulla prima l''evento: la sala di quella sera si libera da sola.';
  end if;
  if exists (select 1 from giornate_sold_out where preventivo_id = old.id) then
    raise exception
      'Questo preventivo tiene bloccata la sala del %. Togli prima la spunta «sala piena».',
      to_char(old.data_evento, 'DD/MM/YYYY');
  end if;
  return old;
end;
$$;

revoke all on function vieta_cancellazione_preventivo_accettato() from public, anon, authenticated;

drop trigger if exists trg_preventivo_accettato_non_si_cancella on preventivi;
create trigger trg_preventivo_accettato_non_si_cancella
  before delete on preventivi
  for each row execute function vieta_cancellazione_preventivo_accettato();


-- ---------------------------------------------------------------------
-- VERIFICA
-- ---------------------------------------------------------------------
-- ⚠️ NESSUN AVVISO PARTE DA QUI. `segnala_allarme` spedisce su Telegram, e
-- una verifica che annulla un evento finto farebbe suonare il telefono di
-- Alessio (§8, gia' successo l'11/08). Si usa il freno anti-tempesta del
-- sistema stesso — un avviso per tipo all'ora — mettendo davanti un allarme
-- di quel tipo: la regola viene percorsa per intero, il messaggio non parte.
-- Cosa *direbbe* l'avviso si controlla a parte, su `testo_evento_annullato`.
--
-- ⚠️ E i preventivi finti nascono SENZA email: un cambio di stato verso
-- «confermata» fa partire l'email al cliente, e un indirizzo finto non deve
-- ricevere niente.
do $verifica$
declare
  v_tit    uuid;
  v_ente   uuid;
  v_cap    integer;
  v_res    uuid;
  v_res2   uuid;
  v_pA     uuid;
  v_pB     uuid;
  v_pB2    uuid;
  v_pC     uuid;
  v_pE     uuid;
  v_pS     uuid;
  v_esito  jsonb;
  v_testo  text;
  v_corpo  text;
  v_n      integer;
  v_lap_p  integer;
  v_lap_d  integer;
  v_ok     boolean;
  d_a      date := date '1995-12-01';
  d_b      date := date '1995-12-02';
  d_c      date := date '1995-12-03';
  d_e      date := date '1995-12-04';
begin
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  if v_tit is null then raise exception 'Nessun titolare: impossibile verificare.'; end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);
  select count(*) into v_lap_p from deleted_records;
  select id into v_ente from entities order by created_at limit 1;

  -- La capienza si CHIEDE, non si scrive: un numero copiato qui dentro
  -- sarebbe una fotografia della sala di oggi travestita da regola.
  select c.capienza into v_cap from capienza_della_sala(d_a) c;
  if v_cap is null then
    raise exception 'La sala non si e'' potuta contare: questa verifica non puo'' distinguere niente.';
  end if;
  -- ⚠️ I numeri delle prove sono scelti perche' DISTINGUANO, e sotto una certa
  -- capienza non ci riescono piu': meglio fermarsi che passare senza misurare.
  if v_cap < 20 then
    raise exception 'La sala tiene solo % coperti: i tre casi di questa verifica si sovrappongono.', v_cap;
  end if;

  -- =================================================================
  -- 1 · UN EVENTO CHE RIEMPIE LA SALA ACCENDE LA SPUNTA
  -- =================================================================
  v_pA := salva_preventivo(null,
    jsonb_build_object('entity_id', v_ente, 'cliente_nome', '__VERIFICA__ evento pieno',
                       'data_evento', d_a, 'ora_evento', '20:00', 'persone', v_cap),
    '[]'::jsonb);
  v_esito := accetta_preventivo(v_pA);
  v_res := (v_esito->>'reservation_id')::uuid;

  if (v_esito->>'sala_piena')::boolean is not true then
    raise exception 'Un evento da % persone su % posti non ha acceso la spunta.', v_cap, v_cap;
  end if;
  if not exists (select 1 from giornate_sold_out where data = d_a and preventivo_id = v_pA) then
    raise exception 'La spunta «sala piena» del % non risulta accesa da questo preventivo.', d_a;
  end if;
  if (select stato from preventivi where id = v_pA) <> 'accettato' then
    raise exception 'Il preventivo accettato non risulta accettato.';
  end if;
  if (select count(*) from reservations
       where id = v_res and type = 'evento' and status = 'confermata'
         and reservation_date = d_a and party_size = v_cap) <> 1 then
    raise exception 'L''evento non e'' nato in calendario come doveva.';
  end if;
  if (select accettato_il from preventivi where id = v_pA) is null then
    raise exception 'Non risulta quando e'' stato accettato.';
  end if;

  -- =================================================================
  -- 2 · UN EVENTO CHE CI STA INSIEME ALLE PRENOTAZIONI GIA' PRESE
  --     NON ACCENDE NIENTE.
  --     🔴 E' LA PROVA CHE DISTINGUE LA REGOLA DALLA SCORCIATOIA
  --     «e' un evento, quindi blocca».
  -- =================================================================
  insert into reservations (type, status, source, reservation_date, reservation_time,
                            party_size, customer_name)
  values ('prenotazione', 'confermata', 'interno', d_b, '20:00', 4, '__VERIFICA__ tavolo 4');

  v_pB := salva_preventivo(null,
    jsonb_build_object('entity_id', v_ente, 'cliente_nome', '__VERIFICA__ evento piccolo',
                       'data_evento', d_b, 'ora_evento', '20:30', 'persone', v_cap - 20),
    '[]'::jsonb);
  v_esito := accetta_preventivo(v_pB);

  if (v_esito->>'sala_piena')::boolean is not false then
    raise exception 'Un evento da % persone con 4 gia'' prenotate su % posti ha acceso la spunta.',
      v_cap - 20, v_cap;
  end if;
  if exists (select 1 from giornate_sold_out where data = d_b) then
    raise exception 'La sala del % risulta bloccata da un evento conciliabile.', d_b;
  end if;

  -- =================================================================
  -- 3 · L'EVENTO DA SOLO NON RIEMPIE, MA CON LE PRENOTAZIONI SI'.
  --     🔴 E' LA PROVA CHE DISTINGUE «guardo la sala» da «guardo solo
  --     l'evento»: da solo sarebbe sotto la capienza.
  -- =================================================================
  insert into reservations (type, status, source, reservation_date, reservation_time,
                            party_size, customer_name)
  values ('prenotazione', 'confermata', 'interno', d_c, '20:00', 8, '__VERIFICA__ tavolo 8');

  v_pC := salva_preventivo(null,
    jsonb_build_object('entity_id', v_ente, 'cliente_nome', '__VERIFICA__ evento quasi',
                       'data_evento', d_c, 'ora_evento', '20:30', 'persone', v_cap - 4),
    '[]'::jsonb);
  v_esito := accetta_preventivo(v_pC);

  if (v_esito->>'sala_piena')::boolean is not true then
    raise exception
      'Un evento da % persone con 8 gia'' prenotate su % posti non ha acceso la spunta: le prenotazioni gia'' prese non vengono contate.',
      v_cap - 4, v_cap;
  end if;

  -- =================================================================
  -- 4 · ANNULLATO L'EVENTO: LA SPUNTA SI SPEGNE **E** L'AVVISO PARTE
  -- =================================================================
  -- Il freno, messo prima: la regola gira intera, il telefono resta zitto.
  insert into allarmi (tipo, messaggio, notificato)
  values ('evento_annullato_' || v_res::text,
          '__VERIFICA__ silenzia l''avviso di questa prova', true);

  update reservations set status = 'annullata' where id = v_res;

  if exists (select 1 from giornate_sold_out where data = d_a) then
    raise exception 'Annullato l''evento, la sala del % e'' rimasta bloccata.', d_a;
  end if;
  if (select stato from preventivi where id = v_pA) <> 'annullato' then
    raise exception 'Annullato l''evento, il preventivo risulta ancora accettato.';
  end if;

  -- Cosa direbbe l'avviso: il nome, quante persone, quando, e che la sala
  -- e' tornata libera. ⚠️ Provato sul testo e non sull'invio, perche' l'invio
  -- suonerebbe davvero.
  v_testo := testo_evento_annullato(v_res, true);
  if v_testo not like '%__VERIFICA__ evento pieno%'
     or v_testo not like '%01/12/1995%'
     or v_testo not like '%tornata libera%' then
    raise exception 'L''avviso dell''annullamento direbbe: %', v_testo;
  end if;
  if testo_evento_annullato(v_res, false) like '%tornata libera%' then
    raise exception 'L''avviso dice che la sala si e'' liberata anche quando non e'' successo.';
  end if;

  -- 🔴 E che il trigger LO SPEDISCA davvero si controlla nel suo corpo: si
  -- puo' scrivere un testo giusto e non mandarlo mai, e la migrazione
  -- passerebbe verde. E' il controllo che vale piu' degli altri (13/08).
  select pg_get_functiondef('evento_annullato_libera_la_sala()'::regprocedure) into v_corpo;
  if v_corpo not like '%segnala_allarme%' or v_corpo not like '%testo_evento_annullato%' then
    raise exception 'Il trigger dell''annullamento non spedisce nessun avviso.';
  end if;

  -- =================================================================
  -- 5 · LA SPUNTA MESSA A MANO DA ALESSIO NON SI TOCCA MAI
  -- =================================================================
  insert into giornate_sold_out (data) values (d_e);

  v_pE := salva_preventivo(null,
    jsonb_build_object('entity_id', v_ente, 'cliente_nome', '__VERIFICA__ evento su sold out',
                       'data_evento', d_e, 'ora_evento', '20:00', 'persone', v_cap),
    '[]'::jsonb);
  v_esito := accetta_preventivo(v_pE);
  v_res2 := (v_esito->>'reservation_id')::uuid;

  if (select preventivo_id from giornate_sold_out where data = d_e) is not null then
    raise exception 'L''accettazione si e'' presa una spunta che aveva messo Alessio.';
  end if;

  insert into allarmi (tipo, messaggio, notificato)
  values ('evento_annullato_' || v_res2::text,
          '__VERIFICA__ silenzia l''avviso di questa prova', true);
  update reservations set status = 'annullata' where id = v_res2;

  if not exists (select 1 from giornate_sold_out where data = d_e) then
    raise exception 'Annullando l''evento e'' sparita la spunta che aveva messo Alessio a mano.';
  end if;

  -- =================================================================
  -- 6 · UNA VERSIONE NUOVA NON CREA UN SECONDO EVENTO
  --     ⚠️ E questa e' la prova che diventa rossa se si toglie il
  --     collegamento fra la versione nuova e la vecchia: senza
  --     `versione_di` nascerebbe una seconda prenotazione per la stessa
  --     cena, e nessuna delle due sembrerebbe sbagliata.
  -- =================================================================
  select count(*) into v_n from reservations where reservation_date = d_b and type = 'evento';
  v_pB2 := nuova_versione_preventivo(v_pB);
  perform salva_preventivo(v_pB2,
    jsonb_build_object('entity_id', v_ente, 'cliente_nome', '__VERIFICA__ evento piccolo',
                       'data_evento', d_b, 'ora_evento', '20:30', 'persone', v_cap - 18),
    '[]'::jsonb);
  v_esito := accetta_preventivo(v_pB2);

  if (v_esito->>'reservation_id')::uuid
     is distinct from (select reservation_id from preventivi where id = v_pB) then
    raise exception 'La versione nuova ha creato un secondo evento invece di aggiornare il primo.';
  end if;
  if (select count(*) from reservations where reservation_date = d_b and type = 'evento') <> v_n then
    raise exception 'Dopo la versione nuova gli eventi del % sono diventati %.',
      d_b, (select count(*) from reservations where reservation_date = d_b and type = 'evento');
  end if;
  if (select party_size from reservations where id = (select reservation_id from preventivi where id = v_pB2))
     <> v_cap - 18 then
    raise exception 'La versione nuova non ha aggiornato quante persone vengono.';
  end if;

  -- =================================================================
  -- 7 · UN PREVENTIVO SCADUTO SI ACCETTA, E LO DICE
  --     (decisione di Alessio, 20/08)
  -- =================================================================
  v_pS := salva_preventivo(null,
    jsonb_build_object('entity_id', v_ente, 'cliente_nome', '__VERIFICA__ evento scaduto',
                       'data_evento', d_b, 'ora_evento', '21:00', 'persone', 2,
                       'valido_fino_al', to_char(oggi_a_roma() - 3, 'YYYY-MM-DD')),
    '[]'::jsonb);
  v_esito := accetta_preventivo(v_pS);
  if not (v_esito->>'avvertenze') like '%scaduto%' then
    raise exception 'Un preventivo scaduto e'' stato accettato senza dirlo: %', v_esito->>'avvertenze';
  end if;

  -- =================================================================
  -- 8 · SENZA L'ORA NON SI ACCETTA — e il rifiuto dice cosa fare
  -- =================================================================
  v_ok := false;
  begin
    perform accetta_preventivo(salva_preventivo(null,
      jsonb_build_object('entity_id', v_ente, 'cliente_nome', '__VERIFICA__ senza ora',
                         'data_evento', d_b, 'persone', 2),
      '[]'::jsonb));
  exception when others then
    v_ok := true;
    if sqlerrm not like '%ora dell%' then
      raise exception 'Il rifiuto non dice che manca l''ora: %', sqlerrm;
    end if;
  end;
  if not v_ok then raise exception 'Un evento senza ora e'' stato accettato.'; end if;

  -- =================================================================
  -- 9 · UN PREVENTIVO CON UN EVENTO IN CALENDARIO NON SI CANCELLA
  -- =================================================================
  v_ok := false;
  begin
    delete from preventivi where id = v_pC;
  exception when others then
    v_ok := true;
    if sqlerrm not like '%Annulla prima l%' then
      raise exception 'Il rifiuto della cancellazione non dice cosa fare prima: %', sqlerrm;
    end if;
  end;
  if not v_ok then
    raise exception 'Un preventivo con un evento in calendario e'' stato cancellato.';
  end if;

  -- =================================================================
  -- 10 · LE TRATTATIVE APERTE SI VEDONO, QUELLE CHIUSE NO
  -- =================================================================
  perform salva_preventivo(null,
    jsonb_build_object('entity_id', v_ente, 'cliente_nome', '__VERIFICA__ trattativa',
                       'data_evento', d_e, 'ora_evento', '20:00', 'persone', 12,
                       'stato', 'inviato'),
    '[]'::jsonb);
  select count(*) into v_n from trattative_del_giorno(d_e);
  if v_n <> 1 then
    raise exception 'Le trattative aperte del % risultano % invece di 1.', d_e, v_n;
  end if;
  if (select persone from trattative_del_giorno(d_e)) <> 12 then
    raise exception 'La trattativa non dice per quante persone.';
  end if;
  -- Un preventivo accettato NON e' piu' una trattativa: comparirebbe come un
  -- dubbio su una serata gia' decisa.
  if exists (select 1 from trattative_del_giorno(d_c)) then
    raise exception 'Un evento gia'' accettato compare ancora fra le trattative aperte.';
  end if;

  -- =========== PULIZIA ===========
  -- ⚠️ Si scollega PRIMA e si cancella DOPO — non si spegne nessun trigger:
  -- e' lo stesso ordine con cui gli storni legittimi passano dai rifiuti.
  delete from giornate_sold_out
   where preventivo_id in (select id from preventivi where cliente_nome like '__VERIFICA__%');
  delete from giornate_sold_out where data in (d_a, d_b, d_c, d_e);
  update preventivi set reservation_id = null where cliente_nome like '__VERIFICA__%';
  delete from preventivo_fogli
    where preventivo_id in (select id from preventivi where cliente_nome like '__VERIFICA__%');
  delete from preventivo_righe
    where preventivo_id in (select id from preventivi where cliente_nome like '__VERIFICA__%');
  delete from preventivi where versione_di is not null and cliente_nome like '__VERIFICA__%';
  delete from preventivi where cliente_nome like '__VERIFICA__%';
  delete from reservations where customer_name like '__VERIFICA__%';
  delete from allarmi where messaggio like '__VERIFICA__%';

  if exists (select 1 from preventivi where cliente_nome like '__VERIFICA__%')
     or exists (select 1 from reservations where customer_name like '__VERIFICA__%')
     or exists (select 1 from giornate_sold_out where data in (d_a, d_b, d_c, d_e)) then
    raise exception 'La verifica ha lasciato delle righe finte.';
  end if;
  select count(*) into v_lap_d from deleted_records;
  if v_lap_d <> v_lap_p then
    raise exception 'La verifica ha lasciato % lapidi nel registro delle cancellazioni.',
      v_lap_d - v_lap_p;
  end if;

  perform set_config('request.jwt.claims', null, true);
  raise notice 'Un evento che riempie la sala la blocca, uno conciliabile no; annullato, la sala torna libera e l''avviso parte.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260820000009', 'l_evento_accettato')
on conflict (version) do nothing;
