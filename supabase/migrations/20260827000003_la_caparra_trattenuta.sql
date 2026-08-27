-- ============================================================================
-- LA CAPARRA TRATTENUTA — 27/08/2026
-- ============================================================================
--
-- L'ultimo pezzo del giro della caparra: **il cliente non si presenta e
-- Alessio tiene i soldi**. Gli altri tre casi ci sono gia' — scalata dal
-- conto, restituita per la parte che avanza, restituita per intero su un
-- conto omaggiato.
--
-- ----------------------------------------------------------------------------
-- 🔴 QUI NON ESCE E NON ENTRA UN EURO, e questa e' la ragione del disegno
-- ----------------------------------------------------------------------------
-- I soldi sono gia' in cassa da quando la caparra e' stata presa. Trattenerla
-- **non e' un movimento**: e' un cambio di natura. Da acconto su una cena che
-- ci sara' a **incasso per una cena che non c'e' stata**.
--
-- ⚠️ E proprio perche' non e' un movimento, senza una colonna che lo dica
--    quel denaro resterebbe in prima nota sotto «Caparra ricevuta» — cioe'
--    indistinguibile da una caparra che aspetta ancora il suo conto. Il
--    difetto non sarebbe un numero sbagliato: sarebbe **un incasso di natura
--    diversa mescolato agli altri**, che e' la stessa forma per cui le mance
--    hanno dovuto avere il loro posto.
--
-- ----------------------------------------------------------------------------
-- CHE COSA DEVE SOPRAVVIVERE ALLA PULIZIA DELLA PRIVACY
-- ----------------------------------------------------------------------------
-- Dopo sei mesi la prenotazione se ne va e `reservation_id` diventa vuoto
-- (`on delete set null`, scritto apposta il 26/08). Quello che resta deve
-- continuare a dire **di che serata era**, e non deve contenere nessun nome:
--   · `caparra_evento_il`      — la data, gia' fotografata quando entra;
--   · `caparra_trattenuta_il`  — il giorno in cui si e' deciso di tenerla;
--   · `caparra_trattenuta_perche` — la ragione **in parole di Alessio**.
--
-- 🔴 E LA RAGIONE E' L'UNICO CAMPO DOVE UN NOME PUO' FINIRCI DENTRO, perche'
--    e' testo libero. La funzione che le elenca **non la restituisce**: chi
--    guarda l'elenco vede la serata e l'importo, non chi non e' venuto. Il
--    testo resta nella riga per chi apre la prima nota, dove i nomi dei
--    clienti gia' compaiono e la cancellazione a sei mesi non li tocca.
--    ⚠️ Non e' una svista che si vuole permettere: e' il caso in cui il
--       gestionale non puo' impedire a una persona di scrivere un nome, e
--       allora si sceglie **dove quel nome non viene ripetuto**.
--
-- ----------------------------------------------------------------------------
-- UNA CAPARRA HA UNA SOLA FINE, E IL DATABASE LO IMPONE
-- ----------------------------------------------------------------------------
-- O e' stata usata su un conto, o e' stata trattenuta. Mai tutte e due: sono
-- **la stessa somma contata due volte**, una nel conto del cliente e una fra
-- gli incassi per mancata presentazione. Il vincolo sta sulla colonna e non
-- nella funzione, perche' quella tabella si scrive anche da altrove.
--
-- ⚠️ E OGNI DECISIONE HA LA SUA VIA DI RITORNO: il cliente che non si e'
--    presentato puo' telefonare il giorno dopo. `annulla_trattenuta_caparra`
--    rimette la caparra dov'era, disponibile per un conto.
--
-- ----------------------------------------------------------------------------
-- QUELLO CHE QUESTA MIGRAZIONE NON DECIDE
-- ----------------------------------------------------------------------------
-- ⚠️ **Come si tratta fiscalmente una caparra trattenuta** non lo decide il
--    gestionale: e' un quesito per la commercialista, ed e' in
--    `docs/quesiti/`. Qui si registra il fatto e lo si tiene ritrovabile;
--    l'etichetta fiscale la mettera' lei.
-- ============================================================================

alter table cash_movements
  add column if not exists caparra_trattenuta_il date,
  add column if not exists caparra_trattenuta_perche text;

comment on column cash_movements.caparra_trattenuta_il is
  'Il giorno in cui si e'' deciso di TENERE questa caparra perche'' il cliente non si e'' presentato. Non genera nessun movimento: i soldi erano gia'' in cassa. Serve a distinguere un incasso per una cena che non c''e'' stata da una caparra che aspetta ancora il suo conto.';

comment on column cash_movements.caparra_trattenuta_perche is
  'La ragione, in parole di Alessio. ⚠️ E'' l''unico campo di questo giro dove un nome puo'' finire scritto a mano: `caparre_trattenute()` NON lo restituisce, cosi'' l''elenco che si guarda per i conti non ripete chi non e'' venuto.';

do $vincolo$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'cash_movements'::regclass and conname = 'caparra_una_fine_sola'
  ) then
    alter table cash_movements
      add constraint caparra_una_fine_sola
      check (caparra_usata_su_conto is null or caparra_trattenuta_il is null);
  end if;
end $vincolo$;

comment on constraint caparra_una_fine_sola on cash_movements is
  'Una caparra o finisce su un conto o viene trattenuta, mai tutte e due: sarebbe la stessa somma contata due volte, una nel conto del cliente e una fra gli incassi per mancata presentazione.';

-- ----------------------------------------------------------------------------
-- Tenerla
-- ----------------------------------------------------------------------------

create or replace function trattieni_caparra(p_reservation_id uuid, p_perche text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mov cash_movements%rowtype;
begin
  -- Il portiere sta qui perche' `security definer` scavalca la RLS, e una
  -- caparra e' un dato commerciale (§3.5).
  if not (select is_titolare()) then
    raise exception 'Le caparre le decide il titolare.';
  end if;

  select * into v_mov from cash_movements
   where reservation_id = p_reservation_id
     and causale_id = (select id from cash_causali where label = 'Caparra ricevuta')
   order by created_at limit 1
   for update;

  if v_mov.id is null then
    raise exception 'Su questa prenotazione non c''e'' nessuna caparra da tenere.';
  end if;
  if v_mov.caparra_usata_su_conto is not null then
    -- ⚠️ Il rifiuto dice cosa fare prima, non solo che non si puo'.
    raise exception 'Questa caparra di % e'' gia'' stata scalata su un conto: il cliente e'' venuto. Se il conto e'' sbagliato, annullalo prima.',
      euro(v_mov.amount);
  end if;
  if v_mov.caparra_trattenuta_il is not null then
    raise exception 'Questa caparra di % era gia'' stata tenuta il %.',
      euro(v_mov.amount), to_char(v_mov.caparra_trattenuta_il, 'DD/MM/YYYY');
  end if;

  update cash_movements
     set caparra_trattenuta_il = serata_di_servizio(),
         caparra_trattenuta_perche = nullif(btrim(coalesce(p_perche, '')), '')
   where id = v_mov.id;

  return jsonb_build_object(
    'movimento_id', v_mov.id,
    'importo',      v_mov.amount,
    'serata',       v_mov.caparra_evento_il,
    'messaggio',
      'Caparra di ' || euro(v_mov.amount) || ' tenuta: il cliente non si e'' presentato. ' ||
      'I soldi erano gia'' in cassa e ci restano — non esce niente. ' ||
      'La trovi fra le caparre tenute, separata dagli incassi del servizio.');
end $$;

comment on function trattieni_caparra(uuid, text) is
  'Il cliente non si presenta e la caparra si tiene. NON genera nessun movimento: i soldi erano gia'' in cassa quando la caparra e'' stata presa. Si annulla con `annulla_trattenuta_caparra`.';

revoke all on function trattieni_caparra(uuid, text) from public, anon, authenticated;
grant execute on function trattieni_caparra(uuid, text) to authenticated;

-- ----------------------------------------------------------------------------
-- La via di ritorno — il cliente che telefona il giorno dopo
-- ----------------------------------------------------------------------------

create or replace function annulla_trattenuta_caparra(p_reservation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mov cash_movements%rowtype;
begin
  if not (select is_titolare()) then
    raise exception 'Le caparre le decide il titolare.';
  end if;

  select * into v_mov from cash_movements
   where reservation_id = p_reservation_id
     and causale_id = (select id from cash_causali where label = 'Caparra ricevuta')
   order by created_at limit 1
   for update;

  if v_mov.id is null then
    raise exception 'Su questa prenotazione non c''e'' nessuna caparra.';
  end if;
  if v_mov.caparra_trattenuta_il is null then
    raise exception 'Questa caparra non era stata tenuta: non c''e'' niente da annullare.';
  end if;

  update cash_movements
     set caparra_trattenuta_il = null, caparra_trattenuta_perche = null
   where id = v_mov.id;

  return jsonb_build_object(
    'movimento_id', v_mov.id,
    'importo',      v_mov.amount,
    'messaggio',
      'La caparra di ' || euro(v_mov.amount) ||
      ' torna disponibile: si puo'' scalare su un conto o restituire.');
end $$;

revoke all on function annulla_trattenuta_caparra(uuid) from public, anon, authenticated;
grant execute on function annulla_trattenuta_caparra(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- L'elenco — separato dagli incassi del servizio, e senza nomi
-- ----------------------------------------------------------------------------
-- ⚠️ Restituisce la SERATA e l'importo, mai la ragione scritta a mano e mai
--    la prenotazione: e' l'elenco che si guarda per i conti, e li' chi non e'
--    venuto non c'entra niente.

create or replace function caparre_trattenute(p_dal date default null, p_al date default null)
returns table (
  movimento_id uuid,
  importo      numeric,
  serata       date,
  tenuta_il    date,
  mezzo        text
)
language sql
stable
security definer
set search_path = public
as $$
  select m.id, m.amount, m.caparra_evento_il, m.caparra_trattenuta_il, m.mezzo
    from cash_movements m
   where m.caparra_trattenuta_il is not null
     and (p_dal is null or m.caparra_trattenuta_il >= p_dal)
     and (p_al  is null or m.caparra_trattenuta_il <= p_al)
     and (select is_titolare())
   order by m.caparra_trattenuta_il desc, m.amount desc;
$$;

comment on function caparre_trattenute(date, date) is
  'Le caparre tenute perche'' il cliente non si e'' presentato, separate dagli incassi del servizio. ⚠️ Senza nomi e senza la ragione scritta a mano: sopravvivono alla pulizia della privacy e continuano a dire DI CHE SERATA erano.';

revoke all on function caparre_trattenute(date, date) from public, anon, authenticated;
grant execute on function caparre_trattenute(date, date) to authenticated;

-- ============================================================================
-- VERIFICA
-- ============================================================================
do $verifica$
declare
  v_foto  jsonb;
  v_tit   uuid;
  v_ent   uuid;
  v_res   uuid;
  v_res2  uuid;
  v_r     jsonb;
  v_movs  text[] := '{}';
  v_resid text[] := '{}';
  v_s0    numeric;
  v_n     integer;
begin
  v_foto := foto_righe();
  select id into v_ent from entities where entity_type = 'srls' limit 1;
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', v_tit)::text, true);
  select coalesce(balance, 0) into v_s0 from v_cash_balance where entity_id = v_ent;

  -- (1) TENERLA NON SPOSTA UN EURO — e' il punto di tutto il disegno.
  insert into reservations (customer_name, reservation_date, reservation_time, party_size, status, source)
  values ('VERIFICA trattenuta', oggi_a_roma(), '20:30', 4, 'confermata', 'interno')
  returning id into v_res;
  v_resid := v_resid || v_res::text;
  v_r := registra_caparra(v_res, 40);
  v_movs := v_movs || (v_r->>'movimento_id');

  if (select coalesce(balance, 0) from v_cash_balance where entity_id = v_ent) <> v_s0 + 40 then
    raise exception 'La caparra ricevuta non e'' entrata in cassa.';
  end if;

  v_r := trattieni_caparra(v_res, 'Non si e'' presentato, VERIFICA');
  if (select coalesce(balance, 0) from v_cash_balance where entity_id = v_ent) <> v_s0 + 40 then
    raise exception 'Tenere la caparra ha mosso la cassa: non deve muovere niente, i soldi erano gia'' dentro.';
  end if;

  -- (2) COMPARE NELL'ELENCO, e l'elenco NON porta nomi ne' ragioni.
  select count(*) into v_n from caparre_trattenute() where movimento_id::text = v_movs[1];
  if v_n <> 1 then
    raise exception 'La caparra tenuta non compare fra le caparre tenute.';
  end if;
  if (select serata from caparre_trattenute() where movimento_id::text = v_movs[1])
     is distinct from oggi_a_roma() then
    raise exception 'La caparra tenuta non dice di che serata era.';
  end if;

  -- (3) NON SI TIENE DUE VOLTE.
  begin
    perform trattieni_caparra(v_res);
    raise exception 'La stessa caparra e'' stata tenuta due volte.';
  exception when sqlstate 'P0001' then
    if sqlerrm not like '%gia''%tenuta%' then raise; end if;
  end;

  -- (4) LA VIA DI RITORNO ESISTE, e rimette la caparra disponibile.
  perform annulla_trattenuta_caparra(v_res);
  if (select caparra_trattenuta_il from cash_movements where id::text = v_movs[1]) is not null then
    raise exception 'Annullare la trattenuta non l''ha tolta.';
  end if;
  select count(*) into v_n from caparre_trattenute();
  if exists (select 1 from caparre_trattenute() where movimento_id::text = v_movs[1]) then
    raise exception 'La caparra annullata compare ancora fra quelle tenute.';
  end if;

  -- (5) UNA SOLA FINE: scalata su un conto, non si puo' piu' tenere.
  --     ⚠️ Si prova col GESTO vero, non scrivendo la colonna a mano: e' la
  --        strada da cui il difetto arriverebbe.
  update cash_movements set caparra_usata_su_conto =
    (select id from orders order by created_at limit 1)
   where id::text = v_movs[1] and exists (select 1 from orders);
  if (select caparra_usata_su_conto from cash_movements where id::text = v_movs[1]) is not null then
    begin
      perform trattieni_caparra(v_res);
      raise exception 'Una caparra gia'' scalata su un conto e'' stata anche tenuta: la stessa somma contata due volte.';
    exception when sqlstate 'P0001' then
      if sqlerrm not like '%gia''%scalata%' then raise; end if;
    end;
    update cash_movements set caparra_usata_su_conto = null where id::text = v_movs[1];
  else
    raise notice 'verifica: nessun conto su cui provare la doppia fine (il controllo del vincolo resta sotto).';
  end if;

  -- (6) E IL VINCOLO REGGE ANCHE SCRIVENDO DRITTO IN TABELLA.
  begin
    update cash_movements
       set caparra_trattenuta_il = oggi_a_roma(),
           caparra_usata_su_conto = (select id from orders order by created_at limit 1)
     where id::text = v_movs[1] and exists (select 1 from orders);
    if exists (select 1 from orders) then
      raise exception 'Il vincolo non ha impedito le due fini insieme.';
    end if;
  exception when sqlstate '23514' then
    null;  -- e' quello che deve succedere
  end;
  update cash_movements set caparra_trattenuta_il = null, caparra_usata_su_conto = null
   where id::text = v_movs[1];

  -- (7) SOPRAVVIVE ALLA PULIZIA DELLA PRIVACY: si tiene, si cancella la
  --     prenotazione come fa la pulizia notturna, e la riga deve ancora
  --     dire di che serata era.
  --     🔴 E' il controllo che vale di piu': se `reservation_id` fosse
  --        `on delete cascade`, dopo sei mesi quel denaro sparirebbe dalla
  --        cassa senza che nessun errore lo dica.
  insert into reservations (customer_name, reservation_date, reservation_time, party_size, status, source)
  values ('VERIFICA trattenuta privacy', oggi_a_roma() - 1, '21:00', 2, 'confermata', 'interno')
  returning id into v_res2;
  v_r := registra_caparra(v_res2, 25);
  v_movs := v_movs || (v_r->>'movimento_id');
  perform trattieni_caparra(v_res2, 'VERIFICA privacy');
  delete from reservation_deposits where reservation_id = v_res2;
  delete from reservations where id = v_res2;

  if (select reservation_id from cash_movements where id::text = v_movs[2]) is not null then
    raise exception 'La prenotazione cancellata non ha svuotato il legame: il denaro resterebbe agganciato a una riga che non c''e''.';
  end if;
  if (select serata from caparre_trattenute() where movimento_id::text = v_movs[2])
     is distinct from oggi_a_roma() - 1 then
    raise exception 'Dopo la pulizia della privacy la caparra tenuta non dice piu'' di che serata era.';
  end if;
  if (select count(*) from caparre_trattenute() where movimento_id::text = v_movs[2]) <> 1 then
    raise exception 'La caparra tenuta e'' sparita insieme alla prenotazione.';
  end if;

  -- ------------------------------------------------------------------------
  -- PULIZIA — solo per identificativo, tenuto in un ELENCO
  -- ------------------------------------------------------------------------
  delete from reservation_deposits where reservation_id::text = any(v_resid);
  delete from cash_movements where id::text = any(v_movs);
  delete from reservations where id::text = any(v_resid);
  delete from deleted_records where record_id = any(v_movs) or record_id = any(v_resid);

  if (select coalesce(balance, 0) from v_cash_balance where entity_id = v_ent) <> v_s0 then
    raise exception 'Il saldo di cassa non e'' tornato a quello di partenza.';
  end if;

  perform set_config('request.jwt.claims', null, true);
  perform pretendi_nessun_residuo(v_foto, 'la verifica della caparra trattenuta');
  raise notice 'verifica: la caparra tenuta non muove la cassa, si annulla, non si conta due volte e sopravvive alla pulizia della privacy. Saldo tornato a %', euro(v_s0);
end $verifica$;

insert into applied_migrations (version, name)
values ('20260827000003', 'la_caparra_trattenuta')
on conflict (version) do nothing;
