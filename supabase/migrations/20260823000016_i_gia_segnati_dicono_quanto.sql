-- =====================================================================
-- I «GIA' SEGNATI» DICONO QUANTO, E CHI C'ERA
-- 23/08/2026
-- =====================================================================
-- Blocco 5 del mandato del 23/08, l'ultimo.
--
-- ---------------------------------------------------------------------
-- IL DIFETTO, misurato
-- ---------------------------------------------------------------------
-- L'elenco dei conti gia' sistemati mostrava **data, tavolo e tipo di
-- documento**, e basta. Misurato sul progetto di prova: **15 gruppi di
-- righe indistinguibili fra loro** — stessa data, stesso tavolo, stesso
-- tipo. Con l'importo diventano una sola riga ciascuno, e il gestionale
-- quel numero ce l'ha gia'.
--
-- ⚠️ E il nome del cliente c'e' su **176 conti su 329**: e' il primo posto
-- in cui il legame conto→prenotazione del 18/08 diventa **visibile**. Fino
-- a oggi quel dato era scritto e non lo mostrava nessuna schermata — che
-- per chi usa l'app e' indistinguibile da un dato non scritto.
--
-- ---------------------------------------------------------------------
-- ⚠️ IL CASO CHE RESTA, dichiarato e lasciato li'
-- ---------------------------------------------------------------------
-- Due conti **sullo stesso tavolo, chiusi nello stesso minuto, per lo
-- stesso importo, senza nome** restano indistinguibili. Non si costruisce
-- niente per quello: e' un caso che in una sala da 34 coperti non si
-- presenta, e l'unica cura sarebbe mostrare l'identificativo del conto —
-- cioe' un numero che non dice niente a nessuno.
--
-- 🔴 *«Non puo' succedere» non e' una proprieta' del programma, e' del
-- locale* (regola del 19/08): nessun vincolo lo impedisce, lo impedisce
-- un'osteria piccola. Scritto qui perche' chi legge fra un anno non si
-- fermi al «non puo' succedere».
--
-- ---------------------------------------------------------------------
-- PERCHE' UNA FUNZIONE E NON UN `select` PIU' LARGO
-- ---------------------------------------------------------------------
-- L'importo di un conto non e' una colonna: e' `totale_conto()`, che e'
-- **l'unico posto dove si calcola il totale di un conto** dal 15/08.
-- Leggerlo da PostgREST vorrebbe dire ricalcolarlo nella schermata — cioe'
-- il quarto posto che dice quanto vale un conto.
-- =====================================================================

create or replace function conti_fiscalizzati(
  p_entity_id uuid,
  p_dal       date default null,
  p_al        date default null
)
returns table (
  order_id          uuid,
  chiuso_il         timestamptz,
  serata            date,
  tavolo            text,
  incasso           numeric,
  cliente           text,
  documento         text,
  numero            text,
  emesso_il         date
)
language plpgsql
stable
security definer
set search_path = public
as $funzione$
declare
  v_dal date := coalesce(p_dal, date_trunc('month', oggi_a_roma())::date);
  v_al  date := coalesce(p_al, oggi_a_roma());
begin
  if not is_titolare() then
    raise exception 'La quadratura fiscale è riservata al titolare.';
  end if;

  return query
  select o.id,
         o.closed_at,
         serata_di_servizio(o.closed_at),
         o.table_label,
         -- ⚠️ Lo stesso incasso della quadratura: se qui si mostrasse il
         -- valore dei piatti invece di quello che è entrato, un conto
         -- scontato direbbe due numeri diversi in due riquadri della
         -- stessa schermata.
         coalesce(d.collected_amount, t.totale),
         -- ⚠️ Il nome arriva dalla PRENOTAZIONE, che è il legame del
         -- 18/08. Vuoto è normale e non è un difetto: chi entra senza
         -- prenotare non ha un nome, e inventarlo sarebbe peggio.
         r.customer_name,
         o.documento_fiscale,
         o.documento_numero,
         o.documento_emesso_il
    from orders o
    left join discounts_gifts d on d.id = o.discount_gift_id
    left join reservations r on r.id = o.reservation_id
    cross join lateral totale_conto(o.id) t
   where o.entity_id = p_entity_id
     and o.status in ('chiuso', 'omaggiato')
     and o.documento_fiscale is not null
     and serata_di_servizio(o.closed_at) between v_dal and v_al
   order by o.closed_at desc;
end $funzione$;

comment on function conti_fiscalizzati(uuid, date, date) is
  'I conti che hanno già il loro documento fiscale, con l''importo e il nome di chi c''era (23/08/2026). ⚠️ Prima mostrava data, tavolo e tipo: 15 gruppi di righe erano indistinguibili fra loro. ⚠️ Il nome viene dalla prenotazione — è il primo posto in cui il legame conto→prenotazione del 18/08 si vede.';

revoke all on function conti_fiscalizzati(uuid, date, date) from public, anon, authenticated;
grant execute on function conti_fiscalizzati(uuid, date, date) to authenticated;

-- =====================================================================
-- VERIFICA
-- =====================================================================
do $verifica$
declare
  v_tit     uuid;
  v_staff   uuid;
  v_ente    uuid;
  v_n       int;
  v_amb     int;
  v_tot     numeric;
  v_somma   numeric;
  v_passato boolean;
  v_motivo  text;
  -- ⚠️ ESTREMI LARGHI, non i predefiniti: il periodo predefinito è il
  -- mese in corso, e li' dentro ci sono 3 conti — la verifica passava
  -- annunciando «nessun conto porta il nome» e «0 gruppi indistinguibili»
  -- mentre nei dati sono 176 e 15. E' la regola del caso vuoto: la prova
  -- girava dove il caso non c'e'.
  v_da_sempre  date := date '2000-01-01';
  v_per_sempre date := date '2099-12-31';
begin
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  select user_id into v_staff from user_roles where role = 'staff' limit 1;
  select id into v_ente from entities order by created_at limit 1;
  if v_tit is null then raise exception 'Nessun titolare: impossibile verificare.'; end if;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);

  -- ===== 1. Ogni riga ha un importo. Un elenco di soldi in cui una riga
  -- =====    non dice quanto è la ragione per cui questo blocco esiste.
  select count(*) into v_n from conti_fiscalizzati(v_ente, v_da_sempre, v_per_sempre) c
   where c.incasso is null;
  if v_n > 0 then
    raise exception '% righe dei «già segnati» non dicono quanto.', v_n;
  end if;

  -- ===== 2. 🔴 LA PROPRIETA': l'importo qui e quello della quadratura
  -- =====    sono LO STESSO NUMERO. Se divergessero, la stessa schermata
  -- =====    direbbe due cifre diverse sullo stesso conto.
  select q.fiscalizzato into v_tot from quadratura_fiscale(v_ente, v_da_sempre, v_per_sempre) q;
  select coalesce(sum(c.incasso), 0) into v_somma
    from conti_fiscalizzati(v_ente, v_da_sempre, v_per_sempre) c
   where c.documento in ('scontrino', 'fattura');

  if v_tot <> v_somma then
    raise exception 'La somma dei «già segnati» fa % e la quadratura dice %.', v_somma, v_tot;
  end if;

  -- ===== 3. Il nome c'è dove c'è una prenotazione, e MANCA dove non
  -- =====    ce n'è: vuoto è un'informazione, non un difetto.
  select count(*) into v_n from conti_fiscalizzati(v_ente, v_da_sempre, v_per_sempre) c
   where c.cliente is not null;
  if v_n = 0 then
    raise notice 'ATTENZIONE: nessun conto porta il nome del cliente. Il legame conto-prenotazione non è esercitato da questa verifica.';
  end if;

  -- ⚠️ E non deve inventarlo: un conto senza prenotazione ha il nome vuoto.
  if exists (
    select 1 from conti_fiscalizzati(v_ente, v_da_sempre, v_per_sempre) c
     join orders o on o.id = c.order_id
    where o.reservation_id is null and c.cliente is not null
  ) then
    raise exception 'Un conto senza prenotazione porta un nome che nessuno ha scritto.';
  end if;

  -- ===== 4. 🔴 QUANTE RIGHE RESTANO INDISTINGUIBILI, misurato e non
  -- =====    sperato: prima erano 15 gruppi (data, tavolo, tipo).
  -- =====    Con l'importo e il nome il numero deve CALARE.
  select count(*) into v_amb from (
    select c.serata, c.tavolo, c.documento, count(*)
      from conti_fiscalizzati(v_ente, v_da_sempre, v_per_sempre) c
     group by 1,2,3 having count(*) > 1) x;

  select count(*) into v_n from (
    select c.serata, c.tavolo, c.documento, c.incasso, coalesce(c.cliente,''), count(*)
      from conti_fiscalizzati(v_ente, v_da_sempre, v_per_sempre) c
     group by 1,2,3,4,5 having count(*) > 1) y;

  if v_n >= v_amb and v_amb > 0 then
    raise exception 'Aggiungere importo e nome non ha distinto nessuna riga: prima % gruppi, adesso %.',
      v_amb, v_n;
  end if;
  raise notice 'Righe indistinguibili: % gruppi con data+tavolo+tipo, % aggiungendo importo e nome.',
    v_amb, v_n;

  perform set_config('request.jwt.claims', null, true);

  -- ===== 5. Il portiere.
  if v_staff is not null then
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
    v_passato := false;
    begin
      perform * from conti_fiscalizzati(v_ente, v_da_sempre, v_per_sempre);
      v_passato := true;
    exception when others then
      v_motivo := sqlerrm;
    end;
    perform set_config('request.jwt.claims', null, true);

    if v_passato then
      raise exception 'Dalla sala si leggono gli incassi dei conti già segnati.';
    end if;
    if v_motivo not like '%riservata al titolare%' then
      raise exception 'Il portiere ha rifiutato per un altro motivo: %', v_motivo;
    end if;
  end if;

  raise notice 'Verifica passata: ogni riga dice quanto, e la somma coincide con la quadratura.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260823000016', 'i_gia_segnati_dicono_quanto') on conflict (version) do nothing;
