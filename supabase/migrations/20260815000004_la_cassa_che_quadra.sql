-- ---------------------------------------------------------------------
-- La cassa che quadra — Blocco 6a del mandato «personale e tesoreria»
-- ---------------------------------------------------------------------
-- Il mandato non chiede un modulo nuovo: chiede di far crescere «Cassa,
-- Banca e Prima Nota», che ha l'ossatura giusta — due saldi separati — e
-- dentro poca vita.
--
-- IL CONCETTO CHE REGGE IL BLOCCO: un costo non è un'uscita. Il costo del
-- personale di agosto sta ad agosto nel conto economico; lo stipendio esce
-- il 10 di settembre e l'F24 il 16. Chi guarda solo la cassa crede che
-- agosto sia leggerissimo e settembre un disastro; chi guarda solo il
-- conto economico sa se guadagna ma non **se arriva al 16 con i soldi sul
-- conto** — ed è la seconda domanda quella che chiude i ristoranti.
--
-- =====================================================================
-- 1. IL SALDO DI CASSA ERA INCOMPLETO, E LO DICHIARAVA
-- =====================================================================
-- Dal 04/08/2026 chiudere un conto NON scrive in prima nota, e la ragione
-- resta valida: gli incassi di sala arriveranno tutti insieme dal
-- registratore telematico, e scriverli anche per conto li conterebbe due
-- volte. Ma la conseguenza era che il saldo di Cassa **escludeva in
-- silenzio ogni incasso di sala** — tanto che dal 14/08 la schermata lo
-- dichiara con una riga sotto il saldo.
--
-- Un numero che si deve spiegare con una nota sotto non è una risposta
-- alla domanda «quanto contante ho nel cassetto?».
--
-- ⚠️ LA SOLUZIONE NON È SCRIVERE RIGHE FINTE IN PRIMA NOTA. Gli incassi
-- contanti si **leggono dai conti chiusi**, non si copiano: stesso patto
-- di `lista_spesa()`, dove giacenza e soglia vengono dal conteggio vero e
-- non da una copia congelata. Così la prima nota resta il registro di ciò
-- che Alessio ha scritto, e il giorno che arriva il registratore
-- telematico non c'è nessuna riga doppia da andare a togliere.
--
-- ⚠️ E RISPETTA LA DECISIONE DEL 15/08 SUI RICAVI: i conti chiusi sono
-- l'unica fonte, e questa funzione **non aggiunge ricavo** — ripartisce lo
-- stesso incasso per mezzo di pagamento. Il contante va nel cassetto, la
-- carta arriverà in banca (Blocco 6b). Nessun euro viene contato due volte
-- perché nessun euro viene contato una seconda volta da qui.
--
-- =====================================================================
-- 2. LE CAUSALI DI SISTEMA, E PERCHÉ NE SERVONO
-- =====================================================================
-- Le causali sono dati di Alessio: il gestionale non ne propone (regola
-- del 14/08 sugli sconti e omaggi). Ma due movimenti di questo blocco li
-- **genera il sistema** — la differenza di cassa e il versamento in banca
-- — e un movimento senza causale è una riga di prima nota che non si può
-- leggere. Quindi quattro causali nascono marcate `di_sistema`.
--
-- ⚠️ E sono protette da un vincolo, non da un'abitudine: una causale di
-- sistema non si può spegnere né marcare «è un costo fisso». Un versamento
-- in banca contato fra i costi fissi falserebbe lo scostamento della
-- Proiezione, e nessuno saprebbe perché.
--
-- =====================================================================
-- 3. LA TRAPPOLA CHE QUESTO BLOCCO APRE, E CHE VA CHIUSA QUI DENTRO
-- =====================================================================
-- ⚠️ Fino a ieri ogni uscita di prima nota era un COSTO. Da oggi non più:
-- un versamento in banca è un'uscita dalla cassa e **non è un costo**, è
-- lo stesso denaro che cambia posto. `rettifiche_fiscali()` e
-- `costi_da_classificare()`, scritte stamattina, sommano tutte le uscite:
-- senza correggerle, ogni versamento comparirebbe fra i costi da
-- classificare e gonfierebbe i costi totali dell'anno.
--
-- Si correggono qui, nella stessa migrazione che crea il problema. Una
-- trappola aperta in una migrazione e chiusa in quella dopo è una trappola
-- che per un po' è stata aperta.
--
-- Idempotente (§7 punto 3), con blocco di verifica e auto-registrazione.
-- ---------------------------------------------------------------------

-- =====================================================================
-- Le causali di sistema
-- =====================================================================
alter table cash_causali
  add column if not exists di_sistema boolean not null default false;

comment on column cash_causali.di_sistema is
  'Causale generata dal gestionale, non da Alessio (15/08/2026): differenza di cassa e versamento in banca. Non si spegne e non entra nei costi fissi — vincolo, non convenzione.';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'cash_causali_di_sistema_protetta'
  ) then
    alter table cash_causali add constraint cash_causali_di_sistema_protetta
      check (not di_sistema or (active and not conta_nei_fissi));
  end if;
end $$;

-- ⚠️ `cash_causali` non ha nessun vincolo unico — di proposito: Alessio
-- puo' chiamare due sue causali come vuole. Ma le quattro di sistema
-- devono essere una sola ciascuna, altrimenti una riesecuzione della
-- migrazione ne creerebbe altre quattro e le funzioni sotto sceglierebbero
-- a caso con `limit 1`. L'unicita' vale SOLO per quelle: indice parziale.
create unique index if not exists ux_cash_causali_di_sistema
  on cash_causali (label, kind) where di_sistema;

insert into cash_causali (label, kind, di_sistema) values
  ('Versamento in banca',         'uscita',  true),
  ('Versamento dalla cassa',      'entrata', true),
  ('Differenza di cassa in meno', 'uscita',  true),
  ('Differenza di cassa in più',  'entrata', true)
on conflict (label, kind) where di_sistema do nothing;

-- =====================================================================
-- Il conteggio del cassetto
-- =====================================================================
create table if not exists conteggi_cassa (
  id            uuid primary key default gen_random_uuid(),
  entity_id     uuid not null references entities(id) on delete restrict,
  contato_il    date not null default current_date,
  -- ⚠️ Il teorico si FOTOGRAFA al momento del conteggio. Ricalcolandolo
  -- dopo, la differenza di un conteggio di marzo cambierebbe da sola ogni
  -- volta che si registra un movimento arretrato — stesso principio dei
  -- risultati congelati di uno scenario e del costo congelato sul lotto.
  teorico       numeric(14,2) not null,
  contato       numeric(14,2) not null check (contato >= 0),
  differenza    numeric(14,2) not null,
  movimento_id  uuid references cash_movements(id) on delete set null,
  nota          text,
  contato_da    uuid,
  created_at    timestamptz not null default now()
);

comment on table conteggi_cassa is
  'Conteggio fisico del cassetto (15/08/2026, Blocco 6a). Il teorico e'' fotografato, mai ricalcolato. La differenza NON si aggiusta in silenzio: genera un movimento di prima nota con la sua causale, e le differenze croniche restano leggibili come informazione.';

create index if not exists idx_conteggi_cassa_data on conteggi_cassa(entity_id, contato_il desc);

alter table conteggi_cassa enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='conteggi_cassa'
      and policyname='conteggi_cassa_titolare'
  ) then
    create policy conteggi_cassa_titolare on conteggi_cassa
      for all using ((select is_titolare())) with check ((select is_titolare()));
  end if;
end $$;

revoke all on table conteggi_cassa from public, anon;

-- =====================================================================
-- Il saldo della tesoreria — UNA sola risposta a «quanto ho»
-- =====================================================================
-- ⚠️ `v_cash_balance` resta dov'è e non cambia significato: la sua colonna
-- `balance` è il contante mosso dalla PRIMA NOTA, ed è ancora la risposta
-- giusta a un'altra domanda («quanto ho scritto io»). Ma la domanda
-- «quanto contante c'è nel cassetto» da adesso ha **una risposta sola**, e
-- sta qui. La schermata smette di mostrare l'altra come se fosse il saldo.
create or replace function saldo_tesoreria(p_entity_id uuid)
returns table (
  contante_prima_nota   numeric,
  incassi_contanti_sala numeric,
  conti_contanti        integer,
  contante_atteso       numeric,
  saldo_banca           numeric,
  ultimo_conteggio_il   date,
  ultima_differenza     numeric,
  avvertenza            text
)
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_pn      numeric;
  v_banca   numeric;
  v_sala    numeric;
  v_conti   integer;
  v_data    date;
  v_diff    numeric;
begin
  if not is_titolare() then
    raise exception 'I saldi sono riservati al titolare.';
  end if;

  -- ⚠️ La vista si alias-a: `saldo_banca` è anche il nome di una colonna
  -- restituita da questa funzione, e senza prefisso Postgres non sa se ci
  -- si riferisce alla vista o al proprio parametro di uscita.
  select coalesce(b.balance, 0), coalesce(b.saldo_banca, 0)
    into v_pn, v_banca
    from v_cash_balance b where b.entity_id = p_entity_id;
  v_pn := coalesce(v_pn, 0);
  v_banca := coalesce(v_banca, 0);

  -- Gli incassi in contante dei conti chiusi, LETTI e non copiati.
  -- Dove c'e' uno sconto o un omaggio vale l'INCASSATO, non il valore del
  -- conto: un omaggio vale come il piatto e incassa zero (regola del
  -- 15/08 sui ricavi).
  select coalesce(sum(coalesce(d.collected_amount, t.totale)), 0), count(*)
    into v_sala, v_conti
    from orders o
    left join discounts_gifts d on d.id = o.discount_gift_id
    cross join lateral totale_conto(o.id) t
   where o.entity_id = p_entity_id
     and o.status in ('chiuso', 'omaggiato')
     and o.payment_method = 'contante';

  select k.contato_il, k.differenza into v_data, v_diff
    from conteggi_cassa k
   where k.entity_id = p_entity_id
   order by k.contato_il desc, k.created_at desc
   limit 1;

  return query select
    v_pn,
    v_sala,
    v_conti,
    v_pn + v_sala,
    v_banca,
    v_data,
    v_diff,
    -- Il numero e il suo limite viaggiano insieme, come per
    -- `calcola_imposte()` e `rettifiche_fiscali()`.
    (case
       when v_conti = 0 then
         'Nessun conto chiuso in contante: il contante atteso e'' solo quello scritto in prima nota.'
       else
         'Il contante atteso comprende ' || v_conti || ' conti chiusi in contante, letti dalla sala e non riscritti in prima nota.'
     end)
    || ' Gli incassi con carta non sono qui: arrivano in banca dopo qualche giorno, al netto delle commissioni.'
    || (case
          when v_data is null then ' Il cassetto non e'' mai stato contato: finche'' non lo conti, questo e'' un numero teorico.'
          else ' Ultimo conteggio del cassetto: ' || to_char(v_data, 'DD/MM/YYYY') || '.'
        end);
end;
$function$;

comment on function saldo_tesoreria is
  'L''unica risposta a «quanto contante ho e quanto ho in banca» (15/08/2026). Gli incassi di sala si LEGGONO dai conti chiusi: nessuna riga finta in prima nota, quindi niente da togliere il giorno del registratore telematico.';

revoke all on function saldo_tesoreria(uuid) from public, anon, authenticated;
grant execute on function saldo_tesoreria(uuid) to authenticated;

-- =====================================================================
-- Registrare un conteggio del cassetto — corridoio (B4): due tabelle
-- =====================================================================
-- ⚠️ La differenza NON si aggiusta in silenzio, e nemmeno si limita a
-- essere dichiarata: **genera un movimento vero**. Se restasse solo scritta
-- nel conteggio, il saldo continuerebbe a dire un numero che il cassetto
-- ha gia' smentito, e alla settimana dopo la differenza si sommerebbe a
-- se stessa. La riga porta la causale di sistema e il rimando al conteggio,
-- quindi resta riconoscibile per sempre come «questo l'ha messo il
-- conteggio», non come un'entrata o un'uscita vera.
create or replace function registra_conteggio_cassa(
  p_entity_id uuid,
  p_contato   numeric,
  p_data      date default current_date,
  p_nota      text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_teorico   numeric;
  v_diff      numeric;
  v_causale   uuid;
  v_movimento uuid;
  v_conteggio uuid;
begin
  if not is_titolare() then
    raise exception 'Il conteggio del cassetto e'' riservato al titolare.';
  end if;
  if p_contato is null or p_contato < 0 then
    raise exception 'Quanto hai contato nel cassetto? Serve un importo, anche zero.';
  end if;

  select contante_atteso into v_teorico from saldo_tesoreria(p_entity_id);
  v_diff := round(p_contato - v_teorico, 2);

  insert into conteggi_cassa (entity_id, contato_il, teorico, contato, differenza, nota, contato_da)
  values (p_entity_id, coalesce(p_data, current_date), v_teorico, p_contato, v_diff, p_nota, auth.uid())
  returning id into v_conteggio;

  if v_diff <> 0 then
    select id into v_causale from cash_causali
     where di_sistema
       and label = case when v_diff < 0 then 'Differenza di cassa in meno'
                        else 'Differenza di cassa in più' end
     limit 1;
    if v_causale is null then
      raise exception 'Manca la causale di sistema per la differenza di cassa.';
    end if;

    insert into cash_movements
      (entity_id, direction, amount, movement_date, causale_id, mezzo, tipo_documento, note)
    values
      (p_entity_id,
       case when v_diff < 0 then 'uscita' else 'entrata' end::cash_direction,
       abs(v_diff),
       coalesce(p_data, current_date),
       v_causale,
       'cassa',
       'non_documentato',
       'Differenza rilevata contando il cassetto il '
         || to_char(coalesce(p_data, current_date), 'DD/MM/YYYY')
         || coalesce('. ' || p_nota, ''))
    returning id into v_movimento;

    update conteggi_cassa set movimento_id = v_movimento where id = v_conteggio;
  end if;

  return v_conteggio;
end;
$function$;

comment on function registra_conteggio_cassa is
  'Conteggio del cassetto: fotografa il teorico, registra la differenza e la fa diventare un movimento vero (15/08/2026). Due tabelle in una transazione, quindi passa dal corridoio (Contratto B4).';

revoke all on function registra_conteggio_cassa(uuid, numeric, date, text) from public, anon, authenticated;
grant execute on function registra_conteggio_cassa(uuid, numeric, date, text) to authenticated;

-- =====================================================================
-- Il versamento in banca è un TRASFERIMENTO — corridoio (B4)
-- =====================================================================
-- ⚠️ Non è un'uscita, ed è la ragione per cui è una funzione e non due
-- righe scritte a mano: il patrimonio non cambia, cambia solo dove sta il
-- denaro. Registrandolo come una sola uscita dalla cassa, il gestionale
-- direbbe che quei soldi sono spesi.
create or replace function versa_in_banca(
  p_entity_id uuid,
  p_importo   numeric,
  p_data      date default current_date,
  p_nota      text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_out       uuid;
  v_in        uuid;
  v_movimento uuid;
  v_disponibile numeric;
begin
  if not is_titolare() then
    raise exception 'I versamenti sono riservati al titolare.';
  end if;
  if p_importo is null or p_importo <= 0 then
    raise exception 'Quanto stai versando? Serve un importo maggiore di zero.';
  end if;

  select contante_atteso into v_disponibile from saldo_tesoreria(p_entity_id);
  if p_importo > v_disponibile then
    raise exception 'Nel cassetto risultano % euro: non puoi versarne %.',
      to_char(v_disponibile, 'FM999999990.00'), to_char(p_importo, 'FM999999990.00');
  end if;

  select id into v_out from cash_causali
   where di_sistema and label = 'Versamento in banca' and kind = 'uscita' limit 1;
  select id into v_in from cash_causali
   where di_sistema and label = 'Versamento dalla cassa' and kind = 'entrata' limit 1;
  if v_out is null or v_in is null then
    raise exception 'Mancano le causali di sistema del versamento.';
  end if;

  insert into cash_movements
    (entity_id, direction, amount, movement_date, causale_id, mezzo, tipo_documento, note)
  values
    (p_entity_id, 'uscita', p_importo, coalesce(p_data, current_date), v_out, 'cassa',
     'non_documentato', coalesce(p_nota, 'Versamento in banca'))
  returning id into v_movimento;

  insert into cash_movements
    (entity_id, direction, amount, movement_date, causale_id, mezzo, tipo_documento, note)
  values
    (p_entity_id, 'entrata', p_importo, coalesce(p_data, current_date), v_in, 'banca',
     'non_documentato', coalesce(p_nota, 'Versamento dalla cassa'));

  return v_movimento;
end;
$function$;

comment on function versa_in_banca is
  'Un versamento e'' un trasferimento, non un''uscita (15/08/2026): due movimenti in una transazione, cassa giu'' e banca su. Corridoio (Contratto B4).';

revoke all on function versa_in_banca(uuid, numeric, date, text) from public, anon, authenticated;
grant execute on function versa_in_banca(uuid, numeric, date, text) to authenticated;

-- =====================================================================
-- La trappola aperta sopra, chiusa qui
-- =====================================================================
-- ⚠️ Da oggi non tutte le uscite di prima nota sono costi: i movimenti con
-- causale di sistema sono trasferimenti e rilevazioni, non spese. Le due
-- funzioni scritte stamattina vanno corrette **nella stessa migrazione che
-- crea il problema**, altrimenti ogni versamento comparirebbe fra i costi
-- da classificare e gonfierebbe i costi dell'anno.
create or replace function rettifiche_fiscali(
  p_entity_id uuid,
  p_anno      integer
)
returns table (
  costi_totali           numeric,
  costi_classificati     numeric,
  quota_deducibile       numeric,
  rettifica_in_aumento   numeric,
  non_classificato       numeric,
  righe_non_classificate integer,
  senza_documento        numeric,
  plafond                numeric,
  eccedenza_plafond      numeric,
  regole_non_confermate  integer,
  avvertenza             text
)
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_plafond  numeric;
  v_ricavi   numeric;
  v_perc     numeric;
begin
  if not is_titolare() then
    raise exception 'I numeri fiscali sono riservati al titolare.';
  end if;

  select annual_revenue_estimate, plafond_rappresentanza_percento
    into v_ricavi, v_perc
    from fiscal_settings where entity_id = p_entity_id;

  v_plafond := case when v_ricavi is not null and v_ricavi > 0
                    then round(v_ricavi * coalesce(v_perc, 0) / 100, 2)
                    else null end;

  return query
  with righe as (
    select m.amount                                    as importo,
           coalesce(m.regola_deducibilita_id, c.regola_deducibilita_id) as regola_id,
           (m.mezzo = 'cassa')                         as in_contante,
           (m.tipo_documento <> 'non_documentato')     as documentato
      from cash_movements m
      left join cash_causali c on c.id = m.causale_id
     where m.entity_id = p_entity_id
       and m.direction = 'uscita'
       and extract(year from m.movement_date) = p_anno
       -- ⚠️ Un versamento in banca e' un trasferimento, non un costo.
       and coalesce(c.di_sistema, false) = false
    union all
    select i.amount,
           coalesce(i.regola_deducibilita_id, s.regola_deducibilita_id),
           (i.payment_method = 'contante'),
           true
      from supplier_invoices i
      left join suppliers s on s.id = i.supplier_id
     where i.entity_id = p_entity_id
       and extract(year from i.invoice_date) = p_anno
  ),
  valutate as (
    select r.importo, r.regola_id, q.quota, q.stato,
           coalesce(g.soggetta_a_plafond, false) as a_plafond
      from righe r
      cross join lateral quota_deducibile(r.importo, r.regola_id, r.in_contante, r.documentato) q
      left join regole_deducibilita g on g.id = r.regola_id
  ),
  plafonate as (
    select sum(quota) filter (where a_plafond)     as quota_plafond,
           sum(quota) filter (where not a_plafond) as quota_libera
      from valutate
  )
  select
    coalesce((select sum(importo) from valutate), 0),
    coalesce((select sum(importo) from valutate where stato <> 'da_classificare'), 0),
    coalesce((select quota_libera from plafonate), 0)
      + case when v_plafond is null then coalesce((select quota_plafond from plafonate), 0)
             else least(coalesce((select quota_plafond from plafonate), 0), v_plafond) end,
    coalesce((select sum(importo) from valutate where stato <> 'da_classificare'), 0)
      - (coalesce((select quota_libera from plafonate), 0)
         + case when v_plafond is null then coalesce((select quota_plafond from plafonate), 0)
                else least(coalesce((select quota_plafond from plafonate), 0), v_plafond) end),
    coalesce((select sum(importo) from valutate where stato = 'da_classificare'), 0),
    coalesce((select count(*) from valutate where stato = 'da_classificare'), 0)::integer,
    coalesce((select sum(importo) from valutate where stato = 'indeducibile'), 0),
    v_plafond,
    case when v_plafond is null then 0
         else greatest(coalesce((select quota_plafond from plafonate), 0) - v_plafond, 0) end,
    (select count(*)::integer from regole_deducibilita where attiva and verificata_il is null),
    (case
       when (select count(*) from valutate where stato = 'da_classificare') > 0 then
         'Attenzione: '
         || (select count(*) from valutate where stato = 'da_classificare')
         || ' voci di costo non sono ancora classificate e NON sono contate ne'' fra i deducibili ne'' fra gli indeducibili. '
         || 'L''imponibile vero sta fra quello calcolato qui e quello aumentato di tutto il non classificato.'
       else 'Tutte le voci di costo del periodo sono classificate.'
     end)
    || (case
          when (select count(*) from regole_deducibilita where attiva and verificata_il is null) > 0 then
            ' Alcune regole non sono ancora state confermate dalla commercialista (quesiti L4 e L9).'
          else ''
        end)
    || (case when v_plafond is null
             then ' Il plafond della rappresentanza non e'' applicato: manca la stima dei ricavi annui nel Simulatore.'
             else '' end)
    || ' Versamenti in banca e differenze di cassa non sono costi e non sono contati.';
end;
$function$;

revoke all on function rettifiche_fiscali(uuid, integer) from public, anon, authenticated;
grant execute on function rettifiche_fiscali(uuid, integer) to authenticated;

create or replace function costi_da_classificare(
  p_entity_id uuid,
  p_anno      integer
)
returns table (
  origine   text,
  riga_id   uuid,
  data      date,
  etichetta text,
  importo   numeric,
  motivo    text
)
language plpgsql
stable
security definer
set search_path = public
as $function$
begin
  if not is_titolare() then
    raise exception 'I numeri fiscali sono riservati al titolare.';
  end if;

  return query
  select 'prima_nota'::text, m.id, m.movement_date,
         coalesce(c.label, m.note, 'Uscita senza causale')::text,
         m.amount,
         case when m.tipo_documento = 'non_documentato'
              then 'Senza documento: indeducibile. Se il documento esiste, indicalo.'
              else 'Nessuna regola: ne'' sulla riga ne'' sulla causale.' end::text
    from cash_movements m
    left join cash_causali c on c.id = m.causale_id
   where m.entity_id = p_entity_id
     and m.direction = 'uscita'
     and extract(year from m.movement_date) = p_anno
     and coalesce(c.di_sistema, false) = false
     and (m.tipo_documento = 'non_documentato'
          or coalesce(m.regola_deducibilita_id, c.regola_deducibilita_id) is null)
  union all
  select 'fattura'::text, i.id, i.invoice_date,
         coalesce(s.name, 'Fornitore')::text || coalesce(' — ' || i.invoice_number, ''),
         i.amount,
         'Nessuna regola: ne'' sulla fattura ne'' sul fornitore.'::text
    from supplier_invoices i
    left join suppliers s on s.id = i.supplier_id
   where i.entity_id = p_entity_id
     and extract(year from i.invoice_date) = p_anno
     and coalesce(i.regola_deducibilita_id, s.regola_deducibilita_id) is null
  order by 3 desc;
end;
$function$;

revoke all on function costi_da_classificare(uuid, integer) from public, anon, authenticated;
grant execute on function costi_da_classificare(uuid, integer) to authenticated;

-- =====================================================================
-- VERIFICA — nessun gestore d'eccezione sul blocco esterno
-- =====================================================================
do $verifica$
declare
  v_ente     uuid;
  v_titolare uuid;
  v_staff    uuid;
  v_causale  uuid;
  t          record;
  n          integer;
  v_conteggio uuid;
  v_conto    uuid;
  v_diff     numeric;
  respinto   boolean;
begin
  select id into v_ente from entities where entity_type = 'srls' limit 1;
  if v_ente is null then select id into v_ente from entities limit 1; end if;
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  select user_id into v_staff    from user_roles where role = 'staff'    limit 1;
  if v_ente is null or v_titolare is null then
    raise exception 'Prerequisiti mancanti: serve un''entita'' e un titolare.';
  end if;

  -- Le quattro causali di sistema ci sono, una sola per coppia.
  select count(*) into n from cash_causali where di_sistema;
  if n <> 4 then
    raise exception 'Le causali di sistema sono % invece di 4.', n;
  end if;

  -- ⚠️ E sono protette dal VINCOLO, non dalla schermata.
  select id into v_causale from cash_causali where di_sistema and label = 'Versamento in banca';
  respinto := false;
  begin
    update cash_causali set conta_nei_fissi = true where id = v_causale;
  exception when check_violation then respinto := true;
  end;
  if not respinto then
    raise exception 'Una causale di sistema si puo'' marcare come costo fisso.';
  end if;

  respinto := false;
  begin
    update cash_causali set active = false where id = v_causale;
  exception when check_violation then respinto := true;
  end;
  if not respinto then
    raise exception 'Una causale di sistema si puo'' spegnere.';
  end if;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

  -- ---- Il versamento è un trasferimento ------------------------------
  insert into cash_movements (entity_id, direction, amount, movement_date, mezzo,
                              tipo_documento, note)
  values (v_ente, 'entrata', 1000, make_date(2096, 5, 1), 'cassa', 'non_documentato',
          '__PROVA TESORERIA fondo__');

  select * into t from saldo_tesoreria(v_ente);
  if t.contante_prima_nota < 1000 then
    raise exception 'Il fondo di prova non risulta in cassa: %.', t.contante_prima_nota;
  end if;

  perform versa_in_banca(v_ente, 400, make_date(2096, 5, 2), '__PROVA TESORERIA versamento__');

  select * into t from saldo_tesoreria(v_ente);
  -- Il denaro non è sparito: è cambiato di posto.
  if t.contante_prima_nota <> 600 then
    raise exception 'Dopo il versamento la cassa dice % invece di 600.', t.contante_prima_nota;
  end if;
  if t.saldo_banca <> 400 then
    raise exception 'Dopo il versamento la banca dice % invece di 400.', t.saldo_banca;
  end if;

  -- ⚠️ E il versamento NON è un costo: la trappola aperta da questa
  -- migrazione deve risultare chiusa dalla migrazione stessa.
  select * into t from rettifiche_fiscali(v_ente, 2096);
  if t.costi_totali <> 0 then
    raise exception 'Il versamento in banca risulta fra i costi (% euro).', t.costi_totali;
  end if;
  select count(*) into n from costi_da_classificare(v_ente, 2096);
  if n <> 0 then
    raise exception 'Il versamento in banca compare fra i costi da classificare (% righe).', n;
  end if;

  -- Non si versa piu' di quello che c'e'.
  respinto := false;
  begin
    perform versa_in_banca(v_ente, 99999, make_date(2096, 5, 3), null);
  exception when sqlstate 'P0001' then respinto := true;
  end;
  if not respinto then
    raise exception 'Si e'' potuto versare piu'' contante di quanto ce n''era.';
  end if;

  -- ---- Il conteggio del cassetto -------------------------------------
  -- Nel cassetto ce ne sono 600 in teoria; se ne contano 580.
  v_conteggio := registra_conteggio_cassa(v_ente, 580, make_date(2096, 5, 4), '__PROVA TESORERIA conteggio__');

  select differenza into v_diff from conteggi_cassa where id = v_conteggio;
  if v_diff <> -20 then
    raise exception 'La differenza di cassa e'' % invece di -20.', v_diff;
  end if;

  -- ⚠️ La differenza ha generato un movimento VERO: senza, il saldo
  -- continuerebbe a dire 600 su un cassetto che ne contiene 580.
  if (select movimento_id from conteggi_cassa where id = v_conteggio) is null then
    raise exception 'La differenza di cassa non ha generato nessun movimento.';
  end if;

  select * into t from saldo_tesoreria(v_ente);
  if t.contante_atteso <> 580 then
    raise exception 'Dopo il conteggio il contante atteso e'' % invece di 580.', t.contante_atteso;
  end if;

  -- E nemmeno la differenza è un costo.
  select * into t from rettifiche_fiscali(v_ente, 2096);
  if t.costi_totali <> 0 then
    raise exception 'La differenza di cassa risulta fra i costi.';
  end if;

  -- Contando di nuovo lo stesso importo, la differenza e' zero e nessun
  -- movimento nuovo: la correzione non si somma a se' stessa.
  perform registra_conteggio_cassa(v_ente, 580, make_date(2096, 5, 5), '__PROVA TESORERIA conteggio 2__');
  select * into t from saldo_tesoreria(v_ente);
  if t.contante_atteso <> 580 then
    raise exception 'Il secondo conteggio ha mosso il saldo: %.', t.contante_atteso;
  end if;

  -- ---- IL PEZZO PRINCIPALE: un conto chiuso in contante entra nel saldo
  -- ⚠️ È la ragione per cui esiste questo blocco, e va provato con un
  -- conto vero: senza, resterebbe verificata solo la parte che non
  -- cambiava niente. Il conto NON scrive in prima nota (regola del 04/08,
  -- invariata) — deve entrare nel saldo perché il saldo lo LEGGE.
  insert into orders (entity_id, table_label, status, payment_method, coperti,
                      coperto_unit_price, opened_at, closed_at, note)
  values (v_ente, '__PROVA TESORERIA T1__', 'chiuso', 'contante', 2, 5,
          make_date(2096,5,7), make_date(2096,5,7), '__PROVA TESORERIA conto__')
  returning id into v_conto;

  insert into order_items (order_id, free_text_name, destination, quantity, unit_price)
  values (v_conto, 'Piatto di prova', 'cucina', 2, 20);

  -- 2 piatti da 20 + 2 coperti da 5 = 50.
  select * into t from saldo_tesoreria(v_ente);
  if t.incassi_contanti_sala <> 50 then
    raise exception 'Il conto chiuso in contante vale % invece di 50.', t.incassi_contanti_sala;
  end if;
  if t.conti_contanti <> 1 then
    raise exception 'I conti in contante contati sono % invece di 1.', t.conti_contanti;
  end if;
  if t.contante_atteso <> 630 then
    raise exception 'Il contante atteso e'' % invece di 630 (580 + 50 di sala).', t.contante_atteso;
  end if;

  -- ⚠️ E in prima nota NON è comparso niente: il saldo lo legge, non lo
  -- copia. Se lo copiasse, il giorno del registratore telematico ci
  -- sarebbe una riga da andare a togliere per ogni conto mai chiuso.
  select count(*) into n from cash_movements
   where entity_id = v_ente and movement_date = make_date(2096,5,7);
  if n <> 0 then
    raise exception 'Chiudere un conto ha scritto % righe in prima nota.', n;
  end if;

  -- Un conto pagato con CARTA non entra nel contante: quei soldi
  -- arriveranno in banca, non nel cassetto.
  update orders set payment_method = 'carta' where id = v_conto;
  select * into t from saldo_tesoreria(v_ente);
  if t.incassi_contanti_sala <> 0 then
    raise exception 'Un conto pagato con carta risulta nel contante (%).', t.incassi_contanti_sala;
  end if;
  update orders set payment_method = 'contante' where id = v_conto;

  -- ---- Il portiere ----------------------------------------------------
  if v_staff is not null then
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);

    respinto := false;
    begin
      perform * from saldo_tesoreria(v_ente);
    exception when sqlstate 'P0001' then respinto := true;
    end;
    if not respinto then
      raise exception 'Lo staff legge i saldi della tesoreria.';
    end if;

    respinto := false;
    begin
      perform versa_in_banca(v_ente, 10, make_date(2096, 5, 6), null);
    exception when sqlstate 'P0001' then respinto := true;
    end;
    if not respinto then
      raise exception 'Lo staff puo'' versare in banca.';
    end if;

    respinto := false;
    begin
      perform registra_conteggio_cassa(v_ente, 10, make_date(2096, 5, 6), null);
    exception when sqlstate 'P0001' then respinto := true;
    end;
    if not respinto then
      raise exception 'Lo staff puo'' contare il cassetto.';
    end if;
  end if;

  -- ---- Pulizia ---------------------------------------------------------
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

  -- ⚠️ Si cancella per DATA e non per testo della nota: il movimento nato
  -- dalla differenza porta una nota scritta dalla funzione, non da me, e
  -- inseguirla con un `like` è il modo in cui una pulizia lascia indietro
  -- proprio la riga che ha creato per ultima. Tutta la prova vive nel
  -- 2096, che è un anno in cui non esiste nient'altro.
  delete from order_items where order_id in (select id from orders where note like '%PROVA TESORERIA%');
  delete from orders where note like '%PROVA TESORERIA%';
  delete from conteggi_cassa
   where contato_il between make_date(2096,1,1) and make_date(2096,12,31);
  delete from cash_movements
   where movement_date between make_date(2096,1,1) and make_date(2096,12,31);

  select count(*) into n from cash_movements
   where movement_date between make_date(2096,1,1) and make_date(2096,12,31);
  if n <> 0 then
    raise exception 'La verifica ha lasciato % movimenti nel 2096.', n;
  end if;
  select count(*) into n from conteggi_cassa;
  if n <> 0 then
    raise exception 'La verifica ha lasciato % conteggi del cassetto.', n;
  end if;
  select count(*) into n from orders where note like '%PROVA TESORERIA%';
  if n <> 0 then
    raise exception 'La verifica ha lasciato % conti di prova.', n;
  end if;

  perform set_config('request.jwt.claims', null, true);
  raise notice 'La cassa quadra: il versamento sposta e non spende, la differenza si dichiara e corregge, e nessuno dei due e'' un costo.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260815000004', 'la_cassa_che_quadra')
on conflict (version) do nothing;

select
  (select count(*) from cash_causali where di_sistema)  as causali_di_sistema,
  (select count(*) from conteggi_cassa)                 as conteggi,
  (select count(*) from cash_movements)                 as movimenti,
  (select count(*) from orders where status in ('chiuso','omaggiato')
     and payment_method = 'contante')                   as conti_chiusi_in_contante;
