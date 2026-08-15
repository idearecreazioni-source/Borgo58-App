-- ---------------------------------------------------------------------
-- «Ho messo di tasca mia» — Blocco 7 del mandato «personale e tesoreria»
-- ---------------------------------------------------------------------
-- Non è «lo spazio dei soldi personali di Alessio»: è il **registro dei
-- pagamenti che lui fa con i propri fondi per conto della società**. Il
-- suo conto privato e le sue spese personali non entrano nel gestionale.
--
-- ⚠️ E il verso opposto — prendere dalla cassa per spese personali — **è
-- stato escluso da Alessio e non si costruisce.** Non c'è nessuna funzione
-- che lo faccia, e non è una dimenticanza.
--
-- =====================================================================
-- LA COSA CHE VA CAPITA PRIMA DI SCRIVERE UNA RIGA
-- =====================================================================
-- Quando Alessio paga di tasca sua succedono **due cose diverse**:
--   1. la società ha una **spesa**;
--   2. la società ha un **debito verso di lui**.
-- Quando si rimborsa dalla cassa, il debito si chiude — e **non è una
-- seconda spesa**, è lo stesso denaro che finisce di fare il suo giro.
--
-- ⚠️ Contarle entrambe come costo farebbe risultare la stessa cosa pagata
-- due volte, e le imposte stimate sarebbero sbagliate. È la stessa forma
-- del doppio conteggio dei ricavi che Alessio ha chiuso stamattina
-- decidendo che comandano i conti chiusi.
--
-- Quindi, per costruzione:
--   · l'**anticipazione** è il posto dove vive la spesa;
--   · il **pareggio** genera un movimento con **causale di sistema**, che
--     dal Blocco 6 è già fuori dai costi. Nessun doppio conteggio, e non
--     perché qualcuno si ricordi di escluderlo: perché la causale lo è.
--
-- ⚠️ E C'È IL CASO OPPOSTO, che è quello che frega. Se quella spesa ha
-- **già una fattura registrata** — Alessio paga di tasca sua una fattura
-- fornitore — allora la spesa è contata lì, e l'anticipazione è **soltanto
-- il debito**. Per questo esiste il collegamento facoltativo alla fattura:
-- collegata, la riga non è un costo; scollegata, lo è, perché non è
-- registrata da nessun'altra parte.
--
-- =====================================================================
-- I TAG SONO UN VOCABOLARIO CHIUSO, E OBBLIGATORI
-- =====================================================================
-- Testo libero diventerebbe «fornitore», «Fornitori» e «pagam. fornit.»,
-- e i totali smetterebbero di sommarsi. ⚠️ E il tag è `not null` per la
-- stessa ragione per cui lo è la causale di uno sconto (14/08): **i totali
-- per tag sono la diagnosi**. Se «fornitore urgente» domina la classifica,
-- il problema non sono le anticipazioni — è la cassa tenuta troppo scarica.
--
-- Il vocabolario nasce **vuoto**: le voci le mette lui, come le causali.
--
-- Idempotente (§7 punto 3), con blocco di verifica e auto-registrazione.
-- ---------------------------------------------------------------------

-- =====================================================================
-- 1. Il vocabolario dei tag
-- =====================================================================
create table if not exists tag_anticipazioni (
  id         uuid primary key default gen_random_uuid(),
  etichetta  text not null unique,
  attivo     boolean not null default true,
  ordine     integer not null default 100,
  created_at timestamptz not null default now()
);

comment on table tag_anticipazioni is
  'Vocabolario chiuso dei motivi per cui il titolare anticipa denaro (15/08/2026). Nasce VUOTO: le voci le mette Alessio, come le causali. Testo libero produrrebbe tre modi di scrivere la stessa cosa e totali che non si sommano.';

alter table tag_anticipazioni enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public'
                   and tablename='tag_anticipazioni' and policyname='tag_anticipazioni_titolare') then
    create policy tag_anticipazioni_titolare on tag_anticipazioni
      for all using ((select is_titolare())) with check ((select is_titolare()));
  end if;
end $$;
revoke all on table tag_anticipazioni from public, anon;

-- =====================================================================
-- 2. Le anticipazioni
-- =====================================================================
create table if not exists anticipazioni_socio (
  id             uuid primary key default gen_random_uuid(),
  entity_id      uuid not null references entities(id) on delete restrict,
  importo        numeric(14,2) not null check (importo > 0),
  pagata_il      date not null default current_date,
  -- ⚠️ Obbligatorio: i totali per tag sono la diagnosi, non un'etichetta.
  tag_id         uuid not null references tag_anticipazioni(id) on delete restrict,
  -- Con che soldi ha pagato LUI. `conto_personale` fa scattare da solo la
  -- comunicazione alla commercialista: nei registri la fattura
  -- risulterebbe pagata da un conto che non e' della societa'.
  fondi          text not null default 'contanti'
                   check (fondi in ('contanti', 'conto_personale')),
  -- ⚠️ Se la spesa e' gia' registrata come fattura, questa riga e' SOLO il
  -- debito verso di lui e non un costo nuovo. Scollegata, e' il costo.
  supplier_invoice_id uuid references supplier_invoices(id) on delete set null,
  documento_riferimento text,
  regola_deducibilita_id uuid references regole_deducibilita(id) on delete set null,
  nota           text,
  pareggiata_il  date,
  movimento_id   uuid references cash_movements(id) on delete set null,
  created_at     timestamptz not null default now(),
  -- Il pareggio e il suo movimento nascono e muoiono insieme.
  constraint anticipazione_pareggio_coerente
    check ((pareggiata_il is null) = (movimento_id is null))
);

comment on table anticipazioni_socio is
  'Cio'' che il titolare paga con fondi propri PER CONTO DELLA SOCIETA'' (15/08/2026, Blocco 7). Non e'' lo spazio dei suoi soldi personali. Collegata a una fattura vale solo come debito; scollegata e'' anche il costo, perche'' non e'' registrato altrove. Il verso opposto — prendere dalla cassa per spese personali — e'' stato escluso da Alessio e non esiste.';

comment on column anticipazioni_socio.supplier_invoice_id is
  'Se la spesa ha gia'' una fattura, il costo e'' contato li'': questa riga resta solo il debito. Senza collegamento, questa riga E'' il costo.';

create index if not exists idx_anticipazioni_aperte
  on anticipazioni_socio(entity_id, pagata_il) where pareggiata_il is null;

alter table anticipazioni_socio enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public'
                   and tablename='anticipazioni_socio' and policyname='anticipazioni_socio_titolare') then
    create policy anticipazioni_socio_titolare on anticipazioni_socio
      for all using ((select is_titolare())) with check ((select is_titolare()));
  end if;
end $$;
revoke all on table anticipazioni_socio from public, anon;

-- La causale di sistema del rimborso. ⚠️ Essendo `di_sistema` e' gia'
-- fuori dai costi e fuori dai costi fissi (vincolo del Blocco 6): il
-- rimborso non deve mai risultare una spesa, perche' la spesa e' la riga
-- dell'anticipazione.
insert into cash_causali (label, kind, di_sistema)
values ('Rimborso al titolare', 'uscita', true)
on conflict (label, kind) where di_sistema do nothing;

-- La soglia oltre cui una anticipazione si comunica alla commercialista.
-- ⚠️ Nasce VUOTA: e' il quesito L10, e Alessio la fissera' con Laura. Un
-- numero inventato qui deciderebbe al posto suo cosa e' rilevante.
alter table impostazioni_tesoreria
  add column if not exists soglia_anticipazione numeric(14,2)
    check (soglia_anticipazione is null or soglia_anticipazione > 0);

comment on column impostazioni_tesoreria.soglia_anticipazione is
  'Oltre questo importo un''anticipazione entra da sola nel pacchetto per la commercialista. VUOTA finche'' Alessio non la fissa con lei (quesito L10).';

-- =====================================================================
-- 3. Quanto ti deve la società
-- =====================================================================
create or replace function saldo_anticipazioni(p_entity_id uuid)
returns table (
  ti_deve        numeric,
  note_aperte    integer,
  piu_vecchia_il date,
  totale_anno    numeric,
  avvertenza     text
)
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_deve   numeric;
  v_n      integer;
  v_da     date;
  v_anno   numeric;
begin
  if not is_titolare() then
    raise exception 'Le anticipazioni del titolare sono riservate al titolare.';
  end if;

  select coalesce(sum(a.importo), 0), count(*), min(a.pagata_il)
    into v_deve, v_n, v_da
    from anticipazioni_socio a
   where a.entity_id = p_entity_id and a.pareggiata_il is null;

  select coalesce(sum(a.importo), 0) into v_anno
    from anticipazioni_socio a
   where a.entity_id = p_entity_id
     and extract(year from a.pagata_il) = extract(year from current_date);

  return query select
    v_deve, v_n, v_da, v_anno,
    (case when v_n = 0 then 'Nessuna nota aperta: la societa'' non ti deve niente.'
          else 'In questo momento la societa'' ti deve ' || to_char(v_deve, 'FM999999990.00') || ' euro.'
     end)
    -- ⚠️ Il limite viaggia col numero: questo saldo NON entra nella
    -- previsione di cassa, e va detto. Una nota aperta non ha una
    -- scadenza — il rimborso lo decide lui — e darle una data inventata
    -- sposterebbe il saldo previsto di una cifra che nessuno ha promesso.
    || case when v_n > 0
            then ' Non e'' contato fra le uscite previste: una nota aperta non ha una scadenza, il rimborso lo decidi tu.'
            else '' end;
end;
$function$;

revoke all on function saldo_anticipazioni(uuid) from public, anon, authenticated;
grant execute on function saldo_anticipazioni(uuid) to authenticated;

-- =====================================================================
-- 4. Il pareggio — corridoio (B4): due tabelle
-- =====================================================================
create or replace function pareggia_anticipazione(
  p_anticipazione_id uuid,
  p_data             date default current_date
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  a           anticipazioni_socio%rowtype;
  v_tag       text;
  v_causale   uuid;
  v_movimento uuid;
  v_cassa     numeric;
begin
  if not is_titolare() then
    raise exception 'Il rimborso e'' riservato al titolare.';
  end if;

  select * into a from anticipazioni_socio where id = p_anticipazione_id;
  if a.id is null then
    raise exception 'Questa nota non esiste.';
  end if;
  if a.pareggiata_il is not null then
    raise exception 'Questa nota e'' gia'' stata pareggiata il %.',
      to_char(a.pareggiata_il, 'DD/MM/YYYY');
  end if;

  select contante_atteso into v_cassa from saldo_tesoreria(a.entity_id);
  if a.importo > v_cassa then
    raise exception 'Nel cassetto risultano % euro: non bastano per rimborsarne %.',
      to_char(v_cassa, 'FM999999990.00'), to_char(a.importo, 'FM999999990.00');
  end if;

  select t.etichetta into v_tag from tag_anticipazioni t where t.id = a.tag_id;

  select id into v_causale from cash_causali
   where di_sistema and label = 'Rimborso al titolare' and kind = 'uscita' limit 1;
  if v_causale is null then
    raise exception 'Manca la causale di sistema del rimborso.';
  end if;

  -- ⚠️ Il tag viaggia nella nota del movimento, cosi' la prima nota resta
  -- leggibile DA SOLA: fra un anno «Rimborso al titolare — fornitore
  -- urgente» si capisce senza aprire un'altra schermata.
  insert into cash_movements
    (entity_id, direction, amount, movement_date, causale_id, mezzo,
     tipo_documento, document_reference, note)
  values
    (a.entity_id, 'uscita', a.importo, coalesce(p_data, current_date), v_causale, 'cassa',
     -- Il `case` produce `text`, la colonna e' un enum: senza cast Postgres
     -- si ferma. Meglio qui che scoprirlo al primo rimborso vero.
     (case when a.documento_riferimento is null then 'non_documentato' else 'scontrino' end)::cash_document_type,
     a.documento_riferimento,
     'Rimborso al titolare — ' || coalesce(v_tag, 'senza tag')
       || coalesce(': ' || a.nota, ''))
  returning id into v_movimento;

  update anticipazioni_socio
     set pareggiata_il = coalesce(p_data, current_date),
         movimento_id  = v_movimento
   where id = p_anticipazione_id;

  return v_movimento;
end;
$function$;

comment on function pareggia_anticipazione is
  'Chiude la nota E fa uscire il rimborso dalla cassa, nella stessa transazione (15/08/2026). Non esiste uno stato in cui una avviene e l''altra no — criterio 12 del mandato. Il movimento porta una causale di sistema, quindi non e'' un costo: il costo e'' la riga dell''anticipazione.';

revoke all on function pareggia_anticipazione(uuid, date) from public, anon, authenticated;
grant execute on function pareggia_anticipazione(uuid, date) to authenticated;

-- =====================================================================
-- 5. Le tre eccezioni che si comunicano da sole
-- =====================================================================
-- Regola del mandato: *ciò che si chiude nel mese resta un promemoria, ciò
-- che sopravvive al mese diventa formale da solo.*
create or replace function anticipazioni_da_comunicare(
  p_entity_id uuid,
  p_anno      integer,
  p_mese      integer
)
returns table (
  anticipazione_id uuid,
  pagata_il        date,
  tag              text,
  importo          numeric,
  perche           text
)
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_soglia numeric;
  v_fine   date;
begin
  if not is_titolare() then
    raise exception 'Le anticipazioni del titolare sono riservate al titolare.';
  end if;

  select i.soglia_anticipazione into v_soglia
    from impostazioni_tesoreria i where i.entity_id = p_entity_id;

  v_fine := (make_date(p_anno, p_mese, 1) + interval '1 month - 1 day')::date;

  return query
  select a.id, a.pagata_il, t.etichetta, a.importo,
         trim(both ' ' from concat_ws(' ',
           case when a.fondi = 'conto_personale'
                then 'Pagata dal tuo conto personale: nei registri la spesa risulterebbe pagata da un conto che non e'' della societa''.' end,
           case when v_soglia is not null and a.importo > v_soglia
                then 'Sopra la soglia che hai fissato con la commercialista.' end,
           case when a.pareggiata_il is null or a.pareggiata_il > v_fine
                then 'Ancora aperta alla fine del mese: non e'' piu'' un dettaglio operativo, e'' un credito alla data del bilancino.' end
         ))::text
    from anticipazioni_socio a
    join tag_anticipazioni t on t.id = a.tag_id
   where a.entity_id = p_entity_id
     and a.pagata_il <= v_fine
     and extract(year from a.pagata_il) = p_anno
     and (
       a.fondi = 'conto_personale'
       or (v_soglia is not null and a.importo > v_soglia)
       or a.pareggiata_il is null
       or a.pareggiata_il > v_fine
     )
   order by a.pagata_il;
end;
$function$;

revoke all on function anticipazioni_da_comunicare(uuid, integer, integer) from public, anon, authenticated;
grant execute on function anticipazioni_da_comunicare(uuid, integer, integer) to authenticated;

-- =====================================================================
-- 6. I totali per tag — sono la diagnosi
-- =====================================================================
create or replace function anticipazioni_per_tag(
  p_entity_id uuid,
  p_anno      integer
)
returns table (
  tag       text,
  quante    integer,
  totale    numeric,
  aperte    integer,
  da_pagare numeric
)
language plpgsql
stable
security definer
set search_path = public
as $function$
begin
  if not is_titolare() then
    raise exception 'Le anticipazioni del titolare sono riservate al titolare.';
  end if;

  return query
  select t.etichetta,
         count(a.id)::integer,
         coalesce(sum(a.importo), 0),
         count(a.id) filter (where a.pareggiata_il is null)::integer,
         coalesce(sum(a.importo) filter (where a.pareggiata_il is null), 0)
    from tag_anticipazioni t
    left join anticipazioni_socio a
      on a.tag_id = t.id
     and a.entity_id = p_entity_id
     and extract(year from a.pagata_il) = p_anno
   group by t.etichetta, t.ordine
  having count(a.id) > 0
   order by coalesce(sum(a.importo), 0) desc;
end;
$function$;

revoke all on function anticipazioni_per_tag(uuid, integer) from public, anon, authenticated;
grant execute on function anticipazioni_per_tag(uuid, integer) to authenticated;

-- =====================================================================
-- 7. Le anticipazioni entrano fra i costi — una volta sola
-- =====================================================================
-- ⚠️ TERZA VOLTA CHE IL PERIMETRO DEI COSTI SI ALLARGA, e va fatto qui
-- dentro come la volta scorsa. Un'anticipazione **senza fattura collegata**
-- è una spesa che non è registrata da nessun'altra parte: lasciarla fuori
-- vorrebbe dire che i costi dell'anno non la contano. Un'anticipazione
-- **con** fattura è già contata lì, e sommarla la conterebbe due volte.
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
  v_plafond numeric;
  v_ricavi  numeric;
  v_perc    numeric;
begin
  if not is_titolare() then
    raise exception 'I numeri fiscali sono riservati al titolare.';
  end if;

  select annual_revenue_estimate, plafond_rappresentanza_percento
    into v_ricavi, v_perc
    from fiscal_settings where entity_id = p_entity_id;

  v_plafond := case when v_ricavi is not null and v_ricavi > 0
                    then round(v_ricavi * coalesce(v_perc, 0) / 100, 2) else null end;

  return query
  with righe as (
    select m.amount as importo,
           coalesce(m.regola_deducibilita_id, c.regola_deducibilita_id) as regola_id,
           (m.mezzo = 'cassa') as in_contante,
           (m.tipo_documento <> 'non_documentato') as documentato
      from cash_movements m
      left join cash_causali c on c.id = m.causale_id
     where m.entity_id = p_entity_id
       and m.direction = 'uscita'
       and extract(year from m.movement_date) = p_anno
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
    union all
    -- Le anticipazioni SENZA fattura: la spesa vive solo qui.
    select a.importo,
           a.regola_deducibilita_id,
           (a.fondi = 'contanti'),
           (a.documento_riferimento is not null)
      from anticipazioni_socio a
     where a.entity_id = p_entity_id
       and extract(year from a.pagata_il) = p_anno
       and a.supplier_invoice_id is null
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
          else '' end)
    || (case when v_plafond is null
             then ' Il plafond della rappresentanza non e'' applicato: manca la stima dei ricavi annui nel Simulatore.'
             else '' end)
    || ' Versamenti in banca, differenze di cassa e rimborsi al titolare non sono costi e non sono contati: '
    || 'quello che hai anticipato di tasca tua e'' contato una volta sola, sulla nota.';
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
  union all
  select 'anticipazione'::text, a.id, a.pagata_il,
         ('Hai messo di tasca tua — ' || t.etichetta)::text,
         a.importo,
         case when a.documento_riferimento is null
              then 'Senza documento: indeducibile. Se hai la ricevuta, indicala.'
              else 'Nessuna regola assegnata.' end::text
    from anticipazioni_socio a
    join tag_anticipazioni t on t.id = a.tag_id
   where a.entity_id = p_entity_id
     and extract(year from a.pagata_il) = p_anno
     and a.supplier_invoice_id is null
     and (a.documento_riferimento is null or a.regola_deducibilita_id is null)
  order by 3 desc;
end;
$function$;

revoke all on function costi_da_classificare(uuid, integer) from public, anon, authenticated;
grant execute on function costi_da_classificare(uuid, integer) to authenticated;

-- =====================================================================
-- VERIFICA
-- =====================================================================
do $verifica$
declare
  v_ente     uuid;
  v_titolare uuid;
  v_staff    uuid;
  v_tag      uuid;
  v_forn     uuid;
  v_fatt     uuid;
  v_a1       uuid;
  v_a2       uuid;
  v_mov      uuid;
  t          record;
  n          integer;
  v_perche   text;
  respinto   boolean;
begin
  select id into v_ente from entities where entity_type = 'srls' limit 1;
  if v_ente is null then select id into v_ente from entities limit 1; end if;
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  select user_id into v_staff    from user_roles where role = 'staff'    limit 1;
  if v_ente is null or v_titolare is null then
    raise exception 'Prerequisiti mancanti.';
  end if;

  -- Il vocabolario nasce vuoto: nessun tag inventato.
  select count(*) into n from tag_anticipazioni;
  if n <> 0 then
    raise exception 'Il vocabolario dei tag nasce con % voci: doveva nascere vuoto.', n;
  end if;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

  insert into tag_anticipazioni (etichetta) values ('__PROVA tag__') returning id into v_tag;

  -- ⚠️ Senza tag non si registra: e' un vincolo, non un controllo di
  -- schermata, e vale anche scrivendo dritto in tabella.
  respinto := false;
  begin
    insert into anticipazioni_socio (entity_id, importo, pagata_il, tag_id)
    values (v_ente, 50, make_date(2094,4,1), null);
  exception when not_null_violation then respinto := true;
  end;
  if not respinto then
    raise exception 'Si e'' potuta registrare un''anticipazione senza tag.';
  end if;

  -- Fondo di cassa per poter rimborsare.
  insert into cash_movements (entity_id, direction, amount, movement_date, mezzo,
                              tipo_documento, note)
  values (v_ente, 'entrata', 500, make_date(2094,4,1), 'cassa', 'non_documentato',
          '__PROVA ANTICIPAZIONI fondo__');

  -- Due note: una senza fattura (e' un costo), una collegata (solo debito).
  insert into anticipazioni_socio (entity_id, importo, pagata_il, tag_id, fondi,
                                   documento_riferimento, nota)
  values (v_ente, 120, make_date(2094,4,2), v_tag, 'contanti', 'RIC-94', '__PROVA senza fattura__')
  returning id into v_a1;

  select id into v_forn from suppliers limit 1;
  if v_forn is not null then
    insert into supplier_invoices (entity_id, supplier_id, invoice_date, amount, status, note)
    values (v_ente, v_forn, make_date(2094,4,3), 80, 'da_pagare', '__PROVA ANTICIPAZIONI fattura__')
    returning id into v_fatt;

    insert into anticipazioni_socio (entity_id, importo, pagata_il, tag_id, fondi,
                                     supplier_invoice_id, nota)
    values (v_ente, 80, make_date(2094,4,3), v_tag, 'conto_personale', v_fatt, '__PROVA con fattura__')
    returning id into v_a2;
  end if;

  -- ---- Il saldo -------------------------------------------------------
  select * into t from saldo_anticipazioni(v_ente);
  if t.ti_deve <> (case when v_fatt is null then 120 else 200 end) then
    raise exception 'La societa'' risulta dover % invece del previsto.', t.ti_deve;
  end if;
  -- ⚠️ E dichiara che non entra nella previsione di cassa.
  if position('Non e'' contato fra le uscite previste' in t.avvertenza) = 0 then
    raise exception 'Il saldo non dichiara di restare fuori dalle uscite previste.';
  end if;

  -- ---- IL PUNTO DEL BLOCCO: il costo si conta UNA VOLTA SOLA ----------
  select * into t from rettifiche_fiscali(v_ente, 2094);
  -- Attesi: 120 (anticipazione senza fattura) + 80 (la fattura stessa).
  -- L'anticipazione collegata NON si somma: sarebbe la stessa spesa due volte.
  if t.costi_totali <> (case when v_fatt is null then 120 else 200 end) then
    raise exception 'I costi sono % — l''anticipazione collegata alla fattura e'' stata contata due volte.', t.costi_totali;
  end if;

  -- ---- Il pareggio: chiude la nota E fa uscire i soldi -----------------
  v_mov := pareggia_anticipazione(v_a1, make_date(2094,4,10));

  if (select pareggiata_il from anticipazioni_socio where id = v_a1) is null then
    raise exception 'Il pareggio non ha chiuso la nota.';
  end if;
  if (select movimento_id from anticipazioni_socio where id = v_a1) is null then
    raise exception 'Il pareggio non ha lasciato il movimento sulla nota.';
  end if;
  select * into t from saldo_tesoreria(v_ente);
  if t.contante_atteso <> 500 - 120 then
    raise exception 'Dopo il rimborso la cassa dice % invece di 380.', t.contante_atteso;
  end if;

  -- ⚠️ E il rimborso NON e' un costo: se lo fosse, quei 120 sarebbero
  -- contati due volte — una sulla nota e una sul rimborso.
  select * into t from rettifiche_fiscali(v_ente, 2094);
  if t.costi_totali <> (case when v_fatt is null then 120 else 200 end) then
    raise exception 'Il rimborso ha aumentato i costi a %.', t.costi_totali;
  end if;

  -- Non si pareggia due volte.
  respinto := false;
  begin
    perform pareggia_anticipazione(v_a1, make_date(2094,4,11));
  exception when sqlstate 'P0001' then respinto := true;
  end;
  if not respinto then
    raise exception 'Una nota gia'' pareggiata si e'' potuta pareggiare di nuovo.';
  end if;

  -- Non si rimborsa piu' di quello che c'e' in cassa.
  if v_a2 is not null then
    insert into anticipazioni_socio (entity_id, importo, pagata_il, tag_id, nota)
    values (v_ente, 99999, make_date(2094,4,4), v_tag, '__PROVA troppo grande__');
    respinto := false;
    begin
      perform pareggia_anticipazione(
        (select id from anticipazioni_socio where nota = '__PROVA troppo grande__'),
        make_date(2094,4,12));
    exception when sqlstate 'P0001' then respinto := true;
    end;
    if not respinto then
      raise exception 'Si e'' potuto rimborsare piu'' di quanto c''era in cassa.';
    end if;
    delete from anticipazioni_socio where nota = '__PROVA troppo grande__';
  end if;

  -- ---- Le tre eccezioni ------------------------------------------------
  if v_a2 is not null then
    select count(*) into n from anticipazioni_da_comunicare(v_ente, 2094, 4)
     where anticipazione_id = v_a2;
    if n <> 1 then
      raise exception 'Una nota pagata dal conto personale non entra nel pacchetto per la commercialista.';
    end if;
    select perche into v_perche from anticipazioni_da_comunicare(v_ente, 2094, 4)
     where anticipazione_id = v_a2;
    if position('conto personale' in v_perche) = 0 then
      raise exception 'Il motivo non nomina il conto personale.';
    end if;
  end if;

  -- Una nota pareggiata DENTRO il mese e senza altre anomalie non entra.
  select count(*) into n from anticipazioni_da_comunicare(v_ente, 2094, 4)
   where anticipazione_id = v_a1;
  if n <> 0 then
    raise exception 'Una nota chiusa dentro il mese entra lo stesso nel pacchetto.';
  end if;

  -- ---- I totali per tag -------------------------------------------------
  select count(*) into n from anticipazioni_per_tag(v_ente, 2094);
  if n <> 1 then
    raise exception 'I totali per tag mostrano % righe invece di 1.', n;
  end if;

  -- ---- Il portiere -------------------------------------------------------
  if v_staff is not null then
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
    for n in 1..4 loop
      respinto := false;
      begin
        case n
          when 1 then perform * from saldo_anticipazioni(v_ente);
          when 2 then perform * from anticipazioni_da_comunicare(v_ente, 2094, 4);
          when 3 then perform * from anticipazioni_per_tag(v_ente, 2094);
          when 4 then perform pareggia_anticipazione(v_a1, null);
        end case;
      exception when sqlstate 'P0001' then respinto := true;
      end;
      if not respinto then
        raise exception 'Lo staff arriva alla sezione personale (controllo %).', n;
      end if;
    end loop;
  end if;

  -- ---- Pulizia -----------------------------------------------------------
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

  delete from anticipazioni_socio where entity_id = v_ente
     and pagata_il between make_date(2094,1,1) and make_date(2094,12,31);
  delete from tag_anticipazioni where etichetta = '__PROVA tag__';
  delete from supplier_invoices where note = '__PROVA ANTICIPAZIONI fattura__';
  delete from cash_movements
   where movement_date between make_date(2094,1,1) and make_date(2094,12,31);

  select count(*) into n from anticipazioni_socio;
  if n <> 0 then raise exception 'La verifica ha lasciato % anticipazioni.', n; end if;
  select count(*) into n from tag_anticipazioni;
  if n <> 0 then raise exception 'La verifica ha lasciato % tag.', n; end if;
  select count(*) into n from cash_movements
   where movement_date between make_date(2094,1,1) and make_date(2094,12,31);
  if n <> 0 then raise exception 'La verifica ha lasciato % movimenti nel 2094.', n; end if;
  select count(*) into n from supplier_invoices where note like '%PROVA ANTICIPAZIONI%';
  if n <> 0 then raise exception 'La verifica ha lasciato % fatture.', n; end if;

  perform set_config('request.jwt.claims', null, true);
  raise notice 'Ho messo di tasca mia: il tag e'' obbligatorio, il costo si conta una volta sola, e il pareggio chiude la nota e fa uscire i soldi insieme.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260815000006', 'ho_messo_di_tasca_mia')
on conflict (version) do nothing;

select
  (select count(*) from tag_anticipazioni)                                as tag,
  (select count(*) from anticipazioni_socio)                              as note,
  (select count(*) from anticipazioni_socio where pareggiata_il is null)  as aperte,
  (select count(*) from cash_causali where di_sistema)                    as causali_di_sistema,
  (select soglia_anticipazione from impostazioni_tesoreria limit 1)       as soglia;
