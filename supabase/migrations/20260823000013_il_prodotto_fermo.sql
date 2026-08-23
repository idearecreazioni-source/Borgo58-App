-- =====================================================================
-- L'AVVISO SUL PRODOTTO FERMO
-- 23/08/2026
-- =====================================================================
-- Blocco 3 del mandato del 23/08. Disegno di Alessio.
--
-- ---------------------------------------------------------------------
-- L'IDEA: guarda i MOVIMENTI, non la data
-- ---------------------------------------------------------------------
-- Lo scadenziario del 13/08 guarda la **scadenza**: dice cosa sta per
-- scadere. Questo guarda un'altra cosa — **da quanto una partita non
-- viene toccata**. Se un prodotto con una durata dichiarata resta fermo
-- oltre quel termine, il gestionale lo dice.
--
-- ⚠️ Sono due domande diverse e servono tutte e due: una mozzarella con
-- scadenza fra tre giorni la vede il primo; un barattolo aperto un mese
-- fa, con scadenza fra un anno, lo vede solo il secondo.
--
-- ---------------------------------------------------------------------
-- LE SEI RISPOSTE, e ognuna manda il prodotto per una strada diversa
-- ---------------------------------------------------------------------
--   * **consumato**    -> chiude il ciclo (come «finita»);
--   * **buttato**      -> chiude il ciclo e finisce nel registro HACCP
--                         come «buttata», non come «finita»;
--   * **abbattuto**    -> l'orologio riparte, e LA NUOVA SCADENZA LA METTE
--                         ALESSIO A MANO — la tabella delle durate
--                         arrivera' dalla biologa, e allora il gestionale
--                         la proporra' da se';
--   * **trasformato**  -> il prodotto non muore: vive nella preparazione
--                         che lo include e ne prende la scadenza;
--   * **ancora qui**   -> «ricordamelo fra N giorni»;
--   * **reso**         -> chiude il ciclo come «buttato» nella meccanica,
--                         ma NON e' uno spreco e nei conti va altrove.
--
-- 🔴 LA REGOLA CHE NON SI SBAGLIA, parole di Alessio: *«rispondere
-- trasformato NON scala quell'ingrediente dal magazzino, perche' verra'
-- scalato alla registrazione della preparazione che lo include,
-- altrimenti rischiamo di scalare due volte»*.
--
-- ⚠️ Quindi «trasformato» **registra una dichiarazione, non un
-- movimento**: la giacenza NON si tocca, il lotto NON si chiude, e
-- cambia solo (a) fino a quando quella parte non deve piu' far gridare
-- l'avviso, e (b) **in cosa e' finita** — senza, la catena si spezza li'.
--
-- ⚠️ E l'avviso e' L'ECCEZIONE, NON LA REGOLA: quando la preparazione
-- viene registrata normalmente il gestionale scala da solo e l'avviso non
-- compare nemmeno. Questa risposta serve **solo** alla trasformazione
-- fatta e non scritta.
--
-- ---------------------------------------------------------------------
-- PERCHE' IL «RICORDAMELO FRA…» NON E' UN DI PIU'
-- ---------------------------------------------------------------------
-- Condizione posta dal validatore, e regge da sola: se il prodotto e'
-- ancora buono, senza quella risposta **l'unica via d'uscita e' mentire**
-- — dire «consumato» o «buttato» per far tacere l'avviso. E *un avviso a
-- cui devi mentire smette di funzionare in una settimana*: prima si
-- risponde a caso, poi non lo si guarda piu'.
--
-- ---------------------------------------------------------------------
-- ⚠️ OGGI E' QUASI MUTO, ed e' stato misurato
-- ---------------------------------------------------------------------
-- Prodotti con una durata dichiarata: **0 su 127** sul progetto di prova.
--
-- 🔴 E IL NUMERO E' CAMBIATO SOTTO: il referto di stamattina ne contava
-- **4**, e adesso sono **zero** — misurato, non ricordato. Lo scenario e'
-- stato rigenerato alle 10:02 e i campi compilati dall'assistente
-- (`campi_da_confermare`) sono **vuoti su tutti e 127**. *Una fotografia
-- di stamattina descrive un database che stasera non c'e' piu'.*
--
-- ⚠️ Si costruisce lo stesso, ed e' scritto nel mandato: le durate
-- arriveranno dall'assistente. Un avviso costruito dopo che i dati ci
-- sono e' un avviso che per un po' non c'e' stato.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Il vocabolario si allarga: il reso non e' uno spreco
-- ---------------------------------------------------------------------
-- ⚠️ In DUE posti, ed e' la lezione del 16/08 (il vitto del personale):
-- il vincolo sulla tabella vale anche per chi scrive dal browser, quello
-- dentro la funzione da' il messaggio leggibile. Aprirne uno solo fa
-- fallire il primo reso con un errore incomprensibile.
alter table stock_consumptions drop constraint if exists stock_consumptions_reason_check;
alter table stock_consumptions add constraint stock_consumptions_reason_check
  check (reason in ('consumo', 'spreco', 'rettifica', 'vitto_personale', 'reso_fornitore'));

alter table stock_lots drop constraint if exists stock_lots_chiusura_valida;
alter table stock_lots add constraint stock_lots_chiusura_valida
  check (chiusura is null or chiusura in ('finita', 'buttata', 'reso_fornitore'));

comment on constraint stock_consumptions_reason_check on stock_consumptions is
  'Perché la merce è uscita. ⚠️ «reso_fornitore» (23/08/2026) esce dal magazzino come uno spreco ma NON è uno spreco: la merce torna da chi l''ha venduta, e contarla fra gli sprechi farebbe cercare un problema in cucina che non esiste.';

-- ---------------------------------------------------------------------
-- 2. Il rinvio: «ancora qui, ricordamelo fra…»
-- ---------------------------------------------------------------------
alter table stock_lots
  add column if not exists ricordamelo_il date,
  add column if not exists rinviata_il    timestamptz,
  add column if not exists rinviata_da    uuid;

comment on column stock_lots.ricordamelo_il is
  'Fino a quando questa partita non deve comparire fra quelle ferme (23/08/2026). ⚠️ Vuota vuol dire «nessun rinvio», non «rinviata a oggi»: è un terzo stato, non un valore comodo.';

-- ---------------------------------------------------------------------
-- 3. L'abbattimento: l'orologio riparte, e la data la mette Alessio
-- ---------------------------------------------------------------------
alter table stock_lots
  add column if not exists abbattuta_il timestamptz;

comment on column stock_lots.abbattuta_il is
  'Quando questa partita è stata abbattuta (23/08/2026). ⚠️ Fa ripartire l''orologio del «prodotto fermo»: da quel momento in poi la partita conta come toccata. La nuova scadenza la scrive Alessio a mano — la tabella delle durate dopo abbattimento arriverà dalla biologa che segue l''HACCP, e finché non c''è il gestionale non la inventa.';

-- ---------------------------------------------------------------------
-- 4. La trasformazione dichiarata: dove e' finita la merce
-- ---------------------------------------------------------------------
-- ⚠️ E' UNA DICHIARAZIONE, NON UN MOVIMENTO. La giacenza non si tocca —
-- la scalera' la registrazione della preparazione. Qui si scrive solo
-- **quanto** e **in cosa**, che e' l'anello di rintracciabilità che
-- altrimenti si spezza.
create table if not exists trasformazioni_dichiarate (
  id             uuid primary key default gen_random_uuid(),
  lotto_id       uuid not null references stock_lots(id) on delete cascade,
  quantita       numeric(12,4) not null check (quantita > 0),
  -- In COSA è finita. Una delle due, mai tutte e due, mai nessuna: o è
  -- una ricetta del ricettario, o è una cosa che Alessio descrive a
  -- parole perché quella ricetta non esiste ancora.
  ricetta_id     uuid references recipes(id) on delete set null,
  descrizione    text,
  -- La scadenza della preparazione che la contiene: è quella che conta
  -- da adesso in poi per questa parte di merce.
  scade_il       date,
  dichiarata_il  timestamptz not null default now(),
  dichiarata_da  uuid,
  note           text,
  constraint trasformazione_dice_in_cosa
    check (ricetta_id is not null or coalesce(btrim(descrizione), '') <> '')
);

comment on table trasformazioni_dichiarate is
  'Una parte di una partita è stata trasformata, e nessuno l''ha ancora registrata come produzione (23/08/2026). 🔴 NON scala il magazzino: lo scaricherà la registrazione della preparazione, e scalare qui vorrebbe dire scalare due volte. Serve a due cose: far tacere l''avviso del prodotto fermo per quella parte, e conservare IN COSA è finita — senza, la catena di rintracciabilità si spezza lì.';

comment on column trasformazioni_dichiarate.quantita is
  'Quanta ne è stata trasformata, nell''unità del prodotto. ⚠️ Può essere una parte: il resto della partita continua a essere sorvegliato come prima.';

alter table trasformazioni_dichiarate enable row level security;

drop policy if exists trasformazioni_staff on trasformazioni_dichiarate;
-- Chi trasforma è in cucina, quindi la scrive lo staff. Correggerla e
-- toglierla restano del titolare: è la stessa forma delle tabelle
-- condivise (Agenda, Magazzino, HACCP).
create policy trasformazioni_staff on trasformazioni_dichiarate
  for select to authenticated using (true);
drop policy if exists trasformazioni_staff_insert on trasformazioni_dichiarate;
create policy trasformazioni_staff_insert on trasformazioni_dichiarate
  for insert to authenticated with check (true);
drop policy if exists trasformazioni_titolare_update on trasformazioni_dichiarate;
create policy trasformazioni_titolare_update on trasformazioni_dichiarate
  for update to authenticated using ((select is_titolare()));
drop policy if exists trasformazioni_titolare_delete on trasformazioni_dichiarate;
create policy trasformazioni_titolare_delete on trasformazioni_dichiarate
  for delete to authenticated using ((select is_titolare()));

create index if not exists idx_trasformazioni_lotto on trasformazioni_dichiarate (lotto_id);

-- ---------------------------------------------------------------------
-- 5. L'elenco: quali partite sono ferme
-- ---------------------------------------------------------------------
-- ⚠️ «Toccata» vuol dire **l'ultimo movimento**, non il ricevimento: una
-- partita aperta ieri e usata oggi non è ferma, anche se è entrata un
-- mese fa. Se non è mai stata toccata, l'orologio parte dal ricevimento.
--
-- ⚠️ E la quantità trasformata NON conta: quella parte è già stata
-- dichiarata, e continuare a gridarci sopra è il modo in cui un avviso
-- si spegne da solo nella testa di chi lo legge.
create or replace function partite_ferme()
returns table (
  lotto_id       uuid,
  ingrediente_id uuid,
  prodotto       text,
  unita          text,
  giacenza       numeric,
  trasformata    numeric,
  da_guardare    numeric,
  durata_giorni  int,
  ultima_mossa   date,
  ferma_da       int,
  scadenza       date,
  ricordamelo_il date,
  perche         text
)
language plpgsql
stable
security definer
set search_path = public
as $funzione$
begin
  -- ⚠️ Il portiere: le giacenze non portano prezzi, ma questa funzione
  -- è la porta di un elenco operativo e la regola del progetto è che ogni
  -- security definer dica chi può bussare. Qui bussa anche la cucina.
  if auth.uid() is null then
    raise exception 'Operazione consentita solo a un utente autenticato';
  end if;

  return query
  with mosse as (
    select c.ingredient_id, max(c.created_at)::date as ultima
      from stock_consumptions c
     group by c.ingredient_id
  ),
  trasf as (
    select t.lotto_id, sum(t.quantita) as quanta
      from trasformazioni_dichiarate t
     group by t.lotto_id
  ),
  base as (
    select l.id, l.ingredient_id, i.name, i.unit::text as u,
           l.quantity_remaining as giac,
           coalesce(tr.quanta, 0) as trasf,
           i.shelf_life_days as durata,
           -- L'orologio riparte da un abbattimento, se c'è stato.
           greatest(
             coalesce(m.ultima, l.received_at::date),
             coalesce(l.abbattuta_il::date, l.received_at::date)
           ) as ultima_mossa,
           l.expiry_date, l.ricordamelo_il
      from stock_lots l
      join ingredients i on i.id = l.ingredient_id
      left join mosse m on m.ingredient_id = l.ingredient_id
      left join trasf tr on tr.lotto_id = l.id
     where l.quantity_remaining > 0
       and l.chiusa_il is null
       and i.shelf_life_days is not null
       and i.tenuto_in_magazzino
  )
  select b.id, b.ingredient_id, b.name, b.u,
         b.giac, b.trasf,
         greatest(b.giac - b.trasf, 0),
         b.durata,
         b.ultima_mossa,
         (current_date - b.ultima_mossa)::int,
         b.expiry_date,
         b.ricordamelo_il,
         format('Ferma da %s giorni, e questo prodotto dura %s giorni.',
                (current_date - b.ultima_mossa)::int, b.durata)
    from base b
   where (current_date - b.ultima_mossa) > b.durata
     -- ⚠️ Il rinvio vale finché non scade: dopo, la partita torna in
     -- elenco da sola. Un rinvio senza fine sarebbe una cancellazione
     -- travestita.
     and (b.ricordamelo_il is null or b.ricordamelo_il <= current_date)
     -- ⚠️ E una partita trasformata PER INTERO non compare: non c'è più
     -- niente da decidere su di lei.
     and b.giac > b.trasf
   order by (current_date - b.ultima_mossa) desc;
end $funzione$;

comment on function partite_ferme() is
  'Le partite che non vengono toccate da più della loro durata dichiarata (23/08/2026). ⚠️ Guarda i MOVIMENTI, non la scadenza: è la domanda che lo scadenziario del 13/08 non fa. Una partita senza durata dichiarata non compare mai — il gestionale non la inventa.';

revoke all on function partite_ferme() from public, anon, authenticated;
grant execute on function partite_ferme() to authenticated;

-- ---------------------------------------------------------------------
-- 6. Le risposte che non chiudono il ciclo
-- ---------------------------------------------------------------------

-- «Ancora qui, ricordamelo fra N giorni»
create or replace function rimanda_partita(p_lotto_id uuid, p_giorni int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $funzione$
declare
  v_lotto record;
  v_fino  date;
begin
  if auth.uid() is null then
    raise exception 'Operazione consentita solo a un utente autenticato';
  end if;
  if p_giorni is null or p_giorni < 1 then
    raise exception 'Di quanti giorni si rimanda? Serve almeno un giorno.';
  end if;

  select * into v_lotto from stock_lots where id = p_lotto_id for update;
  if not found then
    raise exception 'Questa partita non esiste più';
  end if;
  if v_lotto.chiusa_il is not null then
    raise exception 'Questa partita è già chiusa: non c''è niente da rimandare.';
  end if;

  v_fino := current_date + p_giorni;

  update stock_lots
     set ricordamelo_il = v_fino,
         rinviata_il    = now(),
         rinviata_da    = auth.uid()
   where id = p_lotto_id;

  return jsonb_build_object('lotto_id', p_lotto_id, 'ricordamelo_il', v_fino,
    'frase', format('Rimandata: torna in elenco il %s.', to_char(v_fino, 'DD/MM/YYYY')));
end $funzione$;

comment on function rimanda_partita(uuid, int) is
  'Ancora qui, ricordamelo fra N giorni (23/08/2026). ⚠️ Esiste perché senza, l''unica via d''uscita per un prodotto ancora buono è mentire — e un avviso a cui devi mentire smette di funzionare in una settimana.';

revoke all on function rimanda_partita(uuid, int) from public, anon, authenticated;
grant execute on function rimanda_partita(uuid, int) to authenticated;

-- «Abbattuto»: l'orologio riparte, la scadenza la scrive Alessio
create or replace function abbatti_partita(p_lotto_id uuid, p_nuova_scadenza date, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $funzione$
declare
  v_lotto record;
begin
  if auth.uid() is null then
    raise exception 'Operazione consentita solo a un utente autenticato';
  end if;

  select * into v_lotto from stock_lots where id = p_lotto_id for update;
  if not found then
    raise exception 'Questa partita non esiste più';
  end if;
  if v_lotto.chiusa_il is not null then
    raise exception 'Questa partita è già chiusa: non si può abbattere.';
  end if;

  -- 🔴 LA SCADENZA NUOVA E' OBBLIGATORIA, e non è una formalità: dopo un
  -- abbattimento la merce ha una durata che dipende dal prodotto e dal
  -- metodo, e quella tabella non ce l'ha nessuno qui dentro. Lasciarla
  -- vuota vorrebbe dire far ripartire l'orologio senza sapere fino a
  -- quando — cioè spegnere l'avviso, non rimandarlo.
  if p_nuova_scadenza is null then
    raise exception 'Serve la nuova scadenza: dopo un abbattimento la durata la decidi tu. (Quando la biologa darà la tabella delle durate, il gestionale la proporrà da sé.)';
  end if;
  if p_nuova_scadenza <= current_date then
    raise exception 'La nuova scadenza deve essere nel futuro: hai scritto %.',
      to_char(p_nuova_scadenza, 'DD/MM/YYYY');
  end if;

  update stock_lots
     set abbattuta_il   = now(),
         expiry_date    = p_nuova_scadenza,
         -- ⚠️ Il rinvio si azzera: l'orologio riparte davvero, e un
         -- «ricordamelo fra…» rimasto acceso lo terrebbe zitto due volte.
         ricordamelo_il = null,
         note = nullif(concat_ws(' — ', nullif(v_lotto.note, ''),
                  'Abbattuta il ' || to_char(now(), 'DD/MM/YYYY'),
                  nullif(p_note, '')), '')
   where id = p_lotto_id;

  return jsonb_build_object('lotto_id', p_lotto_id, 'scade_il', p_nuova_scadenza,
    'frase', format('Abbattuta. Nuova scadenza: %s.', to_char(p_nuova_scadenza, 'DD/MM/YYYY')));
end $funzione$;

comment on function abbatti_partita(uuid, date, text) is
  'L''orologio del prodotto fermo riparte, con una scadenza nuova scritta a mano (23/08/2026). ⚠️ La scadenza è obbligatoria: senza, si spegnerebbe l''avviso invece di rimandarlo.';

revoke all on function abbatti_partita(uuid, date, text) from public, anon, authenticated;
grant execute on function abbatti_partita(uuid, date, text) to authenticated;

-- «Trasformato»: NON scala, dice in cosa è finito
create or replace function dichiara_trasformazione(
  p_lotto_id    uuid,
  p_quantita    numeric,
  p_ricetta_id  uuid default null,
  p_descrizione text default null,
  p_scade_il    date default null,
  p_note        text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $funzione$
declare
  v_lotto   record;
  v_gia     numeric;
  v_nome    text;
  v_unita   text;
  v_in_cosa text;
begin
  if auth.uid() is null then
    raise exception 'Operazione consentita solo a un utente autenticato';
  end if;

  select * into v_lotto from stock_lots where id = p_lotto_id for update;
  if not found then
    raise exception 'Questa partita non esiste più';
  end if;
  if v_lotto.chiusa_il is not null then
    raise exception 'Questa partita è già chiusa.';
  end if;

  select i.name, i.unit::text into v_nome, v_unita
    from ingredients i where i.id = v_lotto.ingredient_id;

  if p_quantita is null or p_quantita <= 0 then
    raise exception 'Quanta ne è stata trasformata? Serve una quantità.';
  end if;

  -- ⚠️ Non si può dichiarare trasformata più merce di quanta ce n'è:
  -- il totale delle dichiarazioni non supera la giacenza.
  select coalesce(sum(t.quantita), 0) into v_gia
    from trasformazioni_dichiarate t where t.lotto_id = p_lotto_id;

  if v_gia + p_quantita > v_lotto.quantity_remaining then
    raise exception
      'Di questa partita ci sono % % e ne risultano già trasformati %. Non se ne possono dichiarare altri %.',
      trim(to_char(v_lotto.quantity_remaining, 'FM999999990.0999')), coalesce(v_unita, ''),
      trim(to_char(v_gia, 'FM999999990.0999')),
      trim(to_char(p_quantita, 'FM999999990.0999'));
  end if;

  if p_ricetta_id is null and coalesce(btrim(p_descrizione), '') = '' then
    raise exception 'In cosa è finito? Scegli una preparazione o scrivilo: senza, la rintracciabilità si ferma qui.';
  end if;

  insert into trasformazioni_dichiarate
    (lotto_id, quantita, ricetta_id, descrizione, scade_il, dichiarata_da, note)
  values
    (p_lotto_id, p_quantita, p_ricetta_id, nullif(btrim(p_descrizione), ''),
     p_scade_il, auth.uid(), nullif(p_note, ''));

  select coalesce(r.name, nullif(btrim(p_descrizione), '')) into v_in_cosa
    from (select 1) x left join recipes r on r.id = p_ricetta_id;

  -- 🔴 LA GIACENZA NON SI TOCCA, ed è la regola di Alessio: la scalerà la
  -- registrazione della preparazione. Scalare anche qui vorrebbe dire
  -- scalare due volte, e nessuno dei due scarichi sembrerebbe sbagliato.
  return jsonb_build_object(
    'lotto_id', p_lotto_id,
    'quantita', p_quantita,
    'in_cosa', v_in_cosa,
    'giacenza_invariata', v_lotto.quantity_remaining,
    'frase', format(
      '%s %s di %s risultano finiti in «%s». La giacenza non cambia: scenderà quando registri la preparazione.',
      trim(to_char(p_quantita, 'FM999999990.0999')), coalesce(v_unita, ''),
      coalesce(v_nome, 'questo prodotto'), coalesce(v_in_cosa, 'una preparazione')));
end $funzione$;

comment on function dichiara_trasformazione(uuid, numeric, uuid, text, date, text) is
  'Una parte della partita è finita in una preparazione, e nessuno l''ha ancora registrata (23/08/2026). 🔴 NON scala il magazzino — lo farà la registrazione della produzione, e scalare qui sarebbe scalare due volte.';

revoke all on function dichiara_trasformazione(uuid, numeric, uuid, text, date, text) from public, anon, authenticated;
grant execute on function dichiara_trasformazione(uuid, numeric, uuid, text, date, text) to authenticated;

-- ---------------------------------------------------------------------
-- 7. Il reso al fornitore: chiude il ciclo, ma non è uno spreco
-- ---------------------------------------------------------------------
-- ⚠️ Si estende `chiudi_partita` invece di scriverne una accanto: la
-- chiusura di una partita deve restare **un solo posto**, o fra sei mesi
-- ci saranno due modi di chiudere che si comportano diversamente.
--
-- 🔴 IL CORPO E' STATO PRESO VIVO DAL DATABASE (`npm run funzione:viva`),
-- non dal file che l'ha creata: fra i due ci stanno tutte le migrazioni
-- che l'hanno toccata, ed è la trappola in cui questo progetto è già
-- caduto tre volte.
create or replace function chiudi_partita(p_lotto_id uuid, p_come text, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_lotto record;
  v_nome  text;
  v_unita text;
  v_nc    uuid;
begin
  if p_come is null or p_come not in ('finita', 'buttata', 'reso_fornitore') then
    raise exception 'Si puo'' solo chiudere una partita come «finita», «buttata» o «resa al fornitore»';
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
    case p_come
      when 'finita' then 'consumo'
      when 'reso_fornitore' then 'reso_fornitore'
      else 'spreco'
    end,
    nullif(concat_ws(' — ',
      case p_come
        when 'finita' then 'Partita finita'
        when 'reso_fornitore' then 'Partita resa al fornitore'
        else 'Partita buttata'
      end,
      nullif(p_note, ''),
      nullif(v_lotto.supplier_batch_number, '')), '')
  );

  -- ⚠️ SOLO «buttata» apre una non conformità. Un reso non è un problema
  -- di igiene: la merce torna da chi l'ha venduta, e scriverlo nel
  -- registro HACCP riempirebbe di righe normali un documento che
  -- l'ispettore legge — che è il modo in cui un registro smette di essere
  -- letto (stessa ragione per cui «finita» non ci scrive).
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
    'non_conformita_id', v_nc,
    'frase', case p_come
      when 'finita' then 'Partita chiusa: finita.'
      when 'reso_fornitore' then 'Partita chiusa: resa al fornitore. Non è contata fra gli sprechi.'
      else 'Partita chiusa: buttata. È stata aperta una non conformità nel registro HACCP.'
    end
  );
end $function$;

revoke all on function chiudi_partita(uuid, text, text) from public, anon, authenticated;
grant execute on function chiudi_partita(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- 8. Lo spreco non conta i resi
-- ---------------------------------------------------------------------
-- ⚠️ Quando una tabella smette di contenere una cosa sola, chi la legge
-- va corretto NELLA STESSA migrazione (lezione del 15/08). `reason` ora
-- ha un valore in più, e chi somma gli sprechi lo prenderebbe dentro.
create or replace function sprechi_e_resi(p_dal date default null, p_al date default null)
returns table (motivo text, quante bigint, valore numeric)
language sql
stable
security definer
set search_path = public
as $$
  select c.reason::text,
         count(*),
         coalesce(sum(c.costo), 0)
    from stock_consumptions c
   where (p_dal is null or c.created_at::date >= p_dal)
     and (p_al  is null or c.created_at::date <= p_al)
     and c.reason in ('spreco', 'reso_fornitore')
   group by c.reason
   order by c.reason;
$$;

comment on function sprechi_e_resi(date, date) is
  'Sprechi e resi al fornitore, tenuti SEPARATI (23/08/2026). ⚠️ Sommarli direbbe che si butta più di quanto si butta: un reso è merce che torna indietro, non merce persa.';

revoke all on function sprechi_e_resi(date, date) from public, anon, authenticated;
grant execute on function sprechi_e_resi(date, date) to authenticated;

-- =====================================================================
-- VERIFICA
-- =====================================================================
do $verifica$
declare
  v_ente    uuid;
  v_tit     uuid;
  v_ing     uuid;
  v_lotto   uuid;
  v_n       int;
  v_q       numeric;
  v_r       jsonb;
  v_motivo  text;
  v_passato boolean;
  v_lapidi  int;
  v_lapidi2 int;
begin
  select count(*) into v_lapidi from deleted_records;
  select id into v_ente from entities order by created_at limit 1;
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  if v_tit is null then raise exception 'Nessun titolare: impossibile verificare.'; end if;

  -- ⚠️ Un prodotto TUTTO NOSTRO: il perimetro di una prova è fatto di roba
  -- che la prova ha creato (lezione del 16/08, quando FEFO pescò dal lotto
  -- sbagliato e la giacenza vera restò corta di 2).
  insert into ingredients (entity_id, name, category, unit, current_price,
                           shelf_life_days, tenuto_in_magazzino)
  values (v_ente, 'ZZ prova fermo', 'secco_dispensa', 'kg', 5.0000, 10, true)
  returning id into v_ing;

  -- Una partita ricevuta 40 giorni fa e mai toccata: ferma da 40, dura 10.
  insert into stock_lots (ingredient_id, quantity_received, quantity_remaining,
                          unit_cost, received_at)
  values (v_ing, 10.0000, 10.0000, 5.0000, now() - interval '40 days')
  returning id into v_lotto;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);

  -- ===== 1. La partita compare, e la frase dice perché.
  select count(*) into v_n from partite_ferme() p where p.lotto_id = v_lotto;
  if v_n <> 1 then
    raise exception 'Una partita ferma da 40 giorni con durata 10 non compare.';
  end if;

  select p.ferma_da into v_n from partite_ferme() p where p.lotto_id = v_lotto;
  if v_n <> 40 then
    raise exception 'I giorni di fermo sono % invece di 40.', v_n;
  end if;

  -- ===== 2. 🔴 IL RINVIO: «ancora qui, ricordamelo fra 7 giorni».
  v_r := rimanda_partita(v_lotto, 7);
  select count(*) into v_n from partite_ferme() p where p.lotto_id = v_lotto;
  if v_n <> 0 then
    raise exception 'Una partita rimandata compare ancora fra quelle ferme.';
  end if;

  -- ⚠️ E il rinvio ha una FINE: scaduto, la partita torna da sola.
  update stock_lots set ricordamelo_il = current_date - 1 where id = v_lotto;
  select count(*) into v_n from partite_ferme() p where p.lotto_id = v_lotto;
  if v_n <> 1 then
    raise exception 'Un rinvio scaduto non fa tornare la partita in elenco: sarebbe una cancellazione travestita.';
  end if;
  update stock_lots set ricordamelo_il = null where id = v_lotto;

  -- ===== 3. 🔴 IL TRASFORMATO NON SCALA — la regola di Alessio.
  select quantity_remaining into v_q from stock_lots where id = v_lotto;
  v_r := dichiara_trasformazione(v_lotto, 4.0000, null, 'Salsa di prova',
                                 current_date + 5, null);

  if (select quantity_remaining from stock_lots where id = v_lotto) <> v_q then
    raise exception 'Dichiarare una trasformazione ha scalato il magazzino: si scalerebbe due volte.';
  end if;
  if exists (select 1 from stock_consumptions c
              where c.ingredient_id = v_ing and c.note like '%Salsa di prova%') then
    raise exception 'Dichiarare una trasformazione ha scritto uno scarico.';
  end if;

  -- ⚠️ E la parte NON trasformata resta sorvegliata: 10 meno 4 fa 6.
  select p.da_guardare into v_q from partite_ferme() p where p.lotto_id = v_lotto;
  if v_q <> 6 then
    raise exception 'La parte ancora da guardare è % invece di 6.', v_q;
  end if;

  -- ⚠️ Non si può dichiarare più merce di quanta ce n'è.
  v_passato := false;
  begin
    perform dichiara_trasformazione(v_lotto, 7.0000, null, 'Troppa', null, null);
    v_passato := true;
  exception when others then
    v_motivo := sqlerrm;
  end;
  if v_passato then
    raise exception 'Si è potuto dichiarare trasformata più merce di quanta ce ne sia.';
  end if;
  if v_motivo not like '%già trasformati%' then
    raise exception 'Il rifiuto non dice quanto risulta già trasformato: %', v_motivo;
  end if;

  -- ⚠️ E deve dire IN COSA: senza, la catena si spezza lì.
  v_passato := false;
  begin
    perform dichiara_trasformazione(v_lotto, 1.0000, null, null, null, null);
    v_passato := true;
  exception when others then
    v_motivo := sqlerrm;
  end;
  if v_passato then
    raise exception 'Si è potuta dichiarare una trasformazione senza dire in cosa è finita.';
  end if;

  -- Trasformata TUTTA: sparisce dall'elenco.
  perform dichiara_trasformazione(v_lotto, 6.0000, null, 'Il resto', null, null);
  select count(*) into v_n from partite_ferme() p where p.lotto_id = v_lotto;
  if v_n <> 0 then
    raise exception 'Una partita trasformata per intero compare ancora fra quelle ferme.';
  end if;
  delete from trasformazioni_dichiarate where lotto_id = v_lotto;

  -- ===== 4. L'ABBATTIMENTO fa ripartire l'orologio.
  v_passato := false;
  begin
    perform abbatti_partita(v_lotto, null, null);
    v_passato := true;
  exception when others then
    v_motivo := sqlerrm;
  end;
  if v_passato then
    raise exception 'Si è potuto abbattere senza dire fino a quando: spegnerebbe l''avviso invece di rimandarlo.';
  end if;
  if v_motivo not like '%la durata la decidi tu%' then
    raise exception 'Il rifiuto dell''abbattimento non spiega perché serve la data: %', v_motivo;
  end if;

  v_r := abbatti_partita(v_lotto, current_date + 30, 'prova');
  select count(*) into v_n from partite_ferme() p where p.lotto_id = v_lotto;
  if v_n <> 0 then
    raise exception 'Dopo un abbattimento la partita risulta ancora ferma: l''orologio non è ripartito.';
  end if;
  if (select expiry_date from stock_lots where id = v_lotto) <> current_date + 30 then
    raise exception 'L''abbattimento non ha scritto la nuova scadenza.';
  end if;

  -- ===== 5. 🔴 IL RESO chiude il ciclo, ma NON è uno spreco.
  v_r := chiudi_partita(v_lotto, 'reso_fornitore', 'prova reso');

  if (select chiusura from stock_lots where id = v_lotto) <> 'reso_fornitore' then
    raise exception 'Il reso non ha chiuso la partita.';
  end if;
  if (select quantity_remaining from stock_lots where id = v_lotto) <> 0 then
    raise exception 'Il reso non ha svuotato la partita.';
  end if;

  select count(*) into v_n from stock_consumptions c
   where c.ingredient_id = v_ing and c.reason = 'spreco';
  if v_n > 0 then
    raise exception 'Il reso è stato contato fra gli sprechi.';
  end if;

  select count(*) into v_n from stock_consumptions c
   where c.ingredient_id = v_ing and c.reason = 'reso_fornitore';
  if v_n <> 1 then
    raise exception 'Il reso non ha lasciato il suo movimento di magazzino.';
  end if;

  -- ⚠️ E NON apre una non conformità: un reso non è un problema d'igiene.
  if exists (select 1 from haccp_non_conformities n
              where n.description like '%ZZ prova fermo%') then
    raise exception 'Un reso al fornitore ha aperto una non conformità nel registro HACCP.';
  end if;

  -- ⚠️ E i due numeri restano separati.
  if exists (select 1 from sprechi_e_resi() s where s.motivo = 'spreco'
              and s.quante = (select count(*) from stock_consumptions
                               where reason in ('spreco','reso_fornitore'))) then
    raise exception 'Sprechi e resi risultano sommati insieme.';
  end if;

  perform set_config('request.jwt.claims', null, true);

  -- ===== pulizia
  delete from trasformazioni_dichiarate where lotto_id = v_lotto;
  delete from stock_consumptions where ingredient_id = v_ing;
  delete from stock_lots where id = v_lotto;
  delete from ingredients where id = v_ing;

  select count(*) into v_lapidi2 from deleted_records;
  if v_lapidi2 <> v_lapidi then
    raise exception 'La verifica ha lasciato % lapidi nel registro.', v_lapidi2 - v_lapidi;
  end if;

  raise notice 'Verifica passata: le sei risposte fanno sei cose diverse, e il trasformato non scala.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260823000013', 'il_prodotto_fermo') on conflict (version) do nothing;
