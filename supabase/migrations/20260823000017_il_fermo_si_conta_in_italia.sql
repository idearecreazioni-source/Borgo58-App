-- =====================================================================
-- IL FERMO SI CONTA IN ITALIA, NON A GREENWICH
-- 23/08/2026
-- =====================================================================
-- Coda del blocco 3, e 🔴 **non l'ha trovata una rilettura: l'ha trovata
-- la rete del 18/08**, diventando rossa e nominando quattro funzioni:
--
--   * `partite_ferme` — «taglia a data abbattuta_il senza fuso · taglia a
--     data received_at senza fuso · usa current_date»
--   * `abbatti_partita` — «usa current_date»
--   * `rimanda_partita` — «usa current_date»
--   * `sprechi_e_resi` — «taglia a data created_at senza fuso»
--
-- ---------------------------------------------------------------------
-- PERCHE' MORDE, e non e' teorico
-- ---------------------------------------------------------------------
-- Il fuso del database e' **UTC**: fra mezzanotte e le due di notte
-- `current_date` risponde **ieri** (misurato il 18/08 alle 01:31). In un
-- locale che chiude all'una questo vuol dire:
--
--   * una partita risulta ferma da **un giorno in meno** del vero;
--   * «ricordamelo fra 7 giorni» ne conta **6**;
--   * un abbattimento con scadenza «domani» viene **rifiutato**, perche'
--     per il database domani e' oggi.
--
-- ⚠️ Ed e' la QUINTA ricomparsa della stessa famiglia (§8): la trappola
-- e' curata cinque volte sul posto e ricompare in ogni punto nuovo. Qui e'
-- ricomparsa in un blocco scritto **oggi**, con la regola gia' scritta
-- negli appunti.
--
-- ---------------------------------------------------------------------
-- QUALE GIORNO E' QUELLO GIUSTO: il CALENDARIO, non la serata
-- ---------------------------------------------------------------------
-- Il censimento del 18/08 divide i punti in due: chi intende la **serata
-- di servizio** e chi il **giorno di calendario**. Questi sono del
-- secondo gruppo, ed e' una scelta e non una comodita': *«questa partita
-- e' ferma da 25 giorni»* e' una durata fisica, e vale uguale che il
-- prodotto sia in cella dalle 19 o dalle 3 di notte. Un abbattimento e
-- una scadenza sono date del calendario, non serate.
--
-- ⚠️ Il calendario pero' dev'essere **quello italiano**: `oggi_a_roma()`,
-- non `current_date`.
-- =====================================================================

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
declare
  v_oggi date := oggi_a_roma();
begin
  if auth.uid() is null then
    raise exception 'Operazione consentita solo a un utente autenticato';
  end if;

  return query
  with mosse as (
    select c.ingredient_id,
           max((c.created_at at time zone 'Europe/Rome')::date) as ultima
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
             coalesce(m.ultima, (l.received_at at time zone 'Europe/Rome')::date),
             coalesce((l.abbattuta_il at time zone 'Europe/Rome')::date,
                      (l.received_at at time zone 'Europe/Rome')::date)
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
         (v_oggi - b.ultima_mossa)::int,
         b.expiry_date,
         b.ricordamelo_il,
         format('Ferma da %s giorni, e questo prodotto dura %s giorni.',
                (v_oggi - b.ultima_mossa)::int, b.durata)
    from base b
   where (v_oggi - b.ultima_mossa) > b.durata
     and (b.ricordamelo_il is null or b.ricordamelo_il <= v_oggi)
     and b.giac > b.trasf
   order by (v_oggi - b.ultima_mossa) desc;
end $funzione$;

revoke all on function partite_ferme() from public, anon, authenticated;
grant execute on function partite_ferme() to authenticated;

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

  -- ⚠️ In Italia: a mezzanotte e mezza «fra 7 giorni» ne conterebbe 6.
  v_fino := oggi_a_roma() + p_giorni;

  update stock_lots
     set ricordamelo_il = v_fino,
         rinviata_il    = now(),
         rinviata_da    = auth.uid()
   where id = p_lotto_id;

  return jsonb_build_object('lotto_id', p_lotto_id, 'ricordamelo_il', v_fino,
    'frase', format('Rimandata: torna in elenco il %s.', to_char(v_fino, 'DD/MM/YYYY')));
end $funzione$;

revoke all on function rimanda_partita(uuid, int) from public, anon, authenticated;
grant execute on function rimanda_partita(uuid, int) to authenticated;

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

  if p_nuova_scadenza is null then
    raise exception 'Serve la nuova scadenza: dopo un abbattimento la durata la decidi tu. (Quando la biologa darà la tabella delle durate, il gestionale la proporrà da sé.)';
  end if;
  -- ⚠️ A Greenwich, all'una di notte, «domani» sarebbe stato rifiutato.
  if p_nuova_scadenza <= oggi_a_roma() then
    raise exception 'La nuova scadenza deve essere nel futuro: hai scritto %.',
      to_char(p_nuova_scadenza, 'DD/MM/YYYY');
  end if;

  update stock_lots
     set abbattuta_il   = now(),
         expiry_date    = p_nuova_scadenza,
         ricordamelo_il = null,
         note = nullif(concat_ws(' — ', nullif(v_lotto.note, ''),
                  'Abbattuta il ' || to_char(now() at time zone 'Europe/Rome', 'DD/MM/YYYY'),
                  nullif(p_note, '')), '')
   where id = p_lotto_id;

  return jsonb_build_object('lotto_id', p_lotto_id, 'scade_il', p_nuova_scadenza,
    'frase', format('Abbattuta. Nuova scadenza: %s.', to_char(p_nuova_scadenza, 'DD/MM/YYYY')));
end $funzione$;

revoke all on function abbatti_partita(uuid, date, text) from public, anon, authenticated;
grant execute on function abbatti_partita(uuid, date, text) to authenticated;

create or replace function sprechi_e_resi(p_dal date default null, p_al date default null)
returns table (motivo text, quante bigint, valore numeric)
language plpgsql
stable
security definer
set search_path = public
as $funzione$
begin
  if not (select is_titolare()) then
    raise exception 'Gli sprechi in euro sono riservati al titolare.';
  end if;

  return query
  select c.reason::text,
         count(*),
         coalesce(sum(c.costo), 0)
    from stock_consumptions c
   where (p_dal is null or (c.created_at at time zone 'Europe/Rome')::date >= p_dal)
     and (p_al  is null or (c.created_at at time zone 'Europe/Rome')::date <= p_al)
     and c.reason in ('spreco', 'reso_fornitore')
   group by c.reason
   order by c.reason;
end $funzione$;

revoke all on function sprechi_e_resi(date, date) from public, anon, authenticated;
grant execute on function sprechi_e_resi(date, date) to authenticated;

-- =====================================================================
-- VERIFICA
-- =====================================================================
do $verifica$
declare
  v_n     int;
  v_elenco text;
  v_tit    uuid;
begin
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  if v_tit is null then raise exception 'Nessun titolare: impossibile verificare.'; end if;
  -- ⚠️ La rete ha il suo portiere: la verifica di una migrazione non ha un
  -- utente, quindi deve impersonarne uno (lezione del 16/08).
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);

  -- 🔴 SI CHIEDE ALLA RETE, non si rilegge il codice: `funzioni_con_data_utc()`
  -- è la stessa che ha trovato il difetto, e riconosce tre forme diverse
  -- di «chiedere che giorno è senza dire dove».
  select count(*), coalesce(string_agg(f::text, ', '), '')
    into v_n, v_elenco
    from funzioni_con_data_utc() f
   where f::text like '%partite_ferme%'
      or f::text like '%rimanda_partita%'
      or f::text like '%abbatti_partita%'
      or f::text like '%sprechi_e_resi%';

  if v_n > 0 then
    raise exception 'Ci sono ancora funzioni del prodotto fermo che decidono la data a Greenwich: %', v_elenco;
  end if;

  perform set_config('request.jwt.claims', null, true);
  raise notice 'Verifica passata: le quattro funzioni del prodotto fermo contano i giorni in Italia.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260823000017', 'il_fermo_si_conta_in_italia') on conflict (version) do nothing;
