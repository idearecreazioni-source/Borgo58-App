-- ---------------------------------------------------------------------
-- L'attributo di deducibilità — §9 del mandato «personale e tesoreria»
-- ---------------------------------------------------------------------
-- Il mandato lo chiede come lavoro TRASVERSALE, e con una frase precisa:
-- «va costruito una volta sola». Ogni voce di costo porta un attributo che
-- dice se è fiscalmente deducibile, perché la Proiezione lavora su due basi
-- — l'utile gestionale e l'imponibile — e senza la distinzione produce
-- stime sbagliate su situazioni del tutto normali (multe, rappresentanza,
-- costi senza documento).
--
-- =====================================================================
-- ASSORBE, NON AFFIANCA — ed è la scoperta che ha deciso il blocco
-- =====================================================================
-- Le regole di deducibilità ESISTONO GIÀ, e stanno in `src/lib/constants.js`
-- dentro `DEDUCTION_CATEGORIES`: percentuali (75% trasferte), plafond
-- rappresentanza, regola contanti. Il calcolo sta in `src/lib/deducibility.js`.
-- Il commento sopra quell'elenco dice, testualmente, «unica fonte di verità».
--
-- ⚠️ È la stessa situazione del 15/08 col Simulatore fiscale, che calcolava
-- IRES e IRAP in JavaScript dentro la schermata. Costruire l'attributo del
-- mandato accanto a quell'elenco avrebbe dato al gestionale **due risposte
-- alla stessa domanda** — «questa spesa è deducibile?» — e nessun modo di
-- sapere quale credere. Quindi si assorbe: le regole scendono nel database,
-- le governa Alessio, e il modulo Deduzioni le interroga invece di
-- possederle.
--
-- ⚠️ E c'è un motivo in più, che vale da solo: quelle percentuali sono
-- OGGETTO del quesito aperto a Laura (L4 e L9 in
-- docs/quesiti/QUESITI_CONSULENTI.md). Un parametro che aspetta la risposta
-- di un consulente non può vivere in un file sorgente: il giorno che lei
-- risponde, cambiarlo diventa un deploy invece che un campo.
--
-- =====================================================================
-- LE TRE RISPOSTE POSSIBILI, E LA TERZA È QUELLA CHE CONTA
-- =====================================================================
-- Un costo può essere: deducibile (in tutto o in parte), indeducibile,
-- oppure **non classificato — nessuno l'ha ancora detto**.
--
-- ⚠️ Il terzo stato NON è un dettaglio, è il cuore della migrazione. Se il
-- valore predefinito fosse «deducibile», la stima delle imposte sarebbe più
-- bassa del vero **sempre nella stessa direzione** — la stessa forma di
-- errore dello scarto a zero, dell'elenco allergeni vuoto e della
-- maxi-deduzione accesa di partenza. Se fosse «indeducibile», sarebbe più
-- alta, sempre. Nessuna delle due è una stima: sono un numero storto con
-- l'aria di essere un dato.
--
-- Quindi la colonna nasce `null` e `null` vuol dire «non l'ha ancora detto
-- nessuno» — lezione del 14/08, quando un `not null default false` rispose
-- al posto di Alessio su nove scostamenti che aveva appena creato. E chi
-- legge riceve i due numeri separati: quanto è classificato, e quanto no.
--
-- =====================================================================
-- LA REGOLA SI EREDITA, LA SCELTA VINCE
-- =====================================================================
-- Classificare a mano ogni movimento di prima nota è una cosa che nessuno
-- fa per più di due settimane. Quindi la regola abituale sta sulla
-- **causale** (per la prima nota) e sul **fornitore** (per le fatture), e
-- la riga la eredita; una scelta esplicita sulla riga vince sempre
-- sull'eredità. È la stessa forma del 14/08, quando il fornitore abituale
-- del prodotto ha smesso di dover essere ripetuto su ogni riga della lista
-- della spesa.
--
-- =====================================================================
-- QUELLO CHE QUESTA MIGRAZIONE NON FA, E PERCHÉ
-- =====================================================================
-- 1. **Non inventa nessun caso.** Le cinque regole seminate sono quelle che
--    esistono già nel codice, spostate con le loro percentuali intatte, e
--    nascono con `verificata_il` VUOTA: nessuno le ha confermate, ed è la
--    verità (quesito L4). Se ne aggiunge UNA sola che non c'era —
--    «Indeducibile» allo 0% — perché senza di essa non si può classificare
--    come indeducibile niente, e l'elenco dei casi veri lo darà Laura (L9).
-- 2. **Non tocca `calcola_imposte()`.** Il motore unico riceve già un
--    imponibile, non un utile: la rettifica si somma PRIMA, da chi calcola
--    l'imponibile. Un motore solo resta un motore solo.
-- 3. **Non entra ancora nella Proiezione**, e non per prudenza: i costi di
--    uno scenario sono righe di PIANO senza documento, mentre la rettifica
--    si calcola sui costi VERI. Sommarle conterebbe due volte le stesse
--    spese, e oggi — con zero movimenti in produzione — il risultato
--    sarebbe zero, cioè indistinguibile da «nessuna rettifica necessaria».
--    È il collegamento che si fa quando ci sono costi veri classificati.
--
-- Idempotente (§7 punto 3), con blocco di verifica e auto-registrazione.
-- ---------------------------------------------------------------------

-- =====================================================================
-- 1. Il vocabolario delle regole — lo governa Alessio
-- =====================================================================
create table if not exists regole_deducibilita (
  id                     uuid primary key default gen_random_uuid(),
  etichetta              text not null unique,
  percentuale_deducibile numeric(5,2) not null
                           check (percentuale_deducibile >= 0 and percentuale_deducibile <= 100),
  -- Regola contanti: per alcune categorie il pagamento non tracciato rende
  -- la spesa indeducibile. È una proprietà della regola, non del costo.
  vieta_contante         boolean not null default false,
  -- Rappresentanza: deducibile entro un tetto commisurato ai ricavi. Il
  -- tetto è un parametro di `fiscal_settings`, non un numero qui dentro.
  soggetta_a_plafond     boolean not null default false,
  riferimento_normativo  text,
  nota                   text,
  -- ⚠️ NULL = nessun consulente l'ha confermata. Stesso identico patto di
  -- `fiscal_settings.parametri_confermati_da_laura`: una stima di cui si
  -- conosce l'età vale il doppio di una stima muta.
  verificata_il          date,
  attiva                 boolean not null default true,
  ordine                 integer not null default 100,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

comment on table regole_deducibilita is
  'L''unico posto dove vive una regola di deducibilita'' (15/08/2026, §9 del mandato personale e tesoreria). Assorbe DEDUCTION_CATEGORIES, che stava in src/lib/constants.js e si dichiarava «unica fonte di verita''» dentro il bundle pubblico. verificata_il vuota = nessuno l''ha confermata (quesito L4/L9 per la commercialista).';

comment on column regole_deducibilita.verificata_il is
  'Data in cui la commercialista ha confermato questa regola. Vuota = mai confermata, e le schermate lo dichiarano.';

alter table regole_deducibilita enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'regole_deducibilita'
       and policyname = 'regole_deducibilita_titolare'
  ) then
    create policy regole_deducibilita_titolare on regole_deducibilita
      for all using ((select is_titolare())) with check ((select is_titolare()));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'trg_regole_deducibilita_updated_at'
  ) then
    create trigger trg_regole_deducibilita_updated_at before update on regole_deducibilita
      for each row execute function set_updated_at();
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Le regole che esistevano già, spostate senza toccarne i numeri.
-- ⚠️ Non sono state scelte da me oggi: sono `DEDUCTION_CATEGORIES` di
-- src/lib/constants.js, in produzione da agosto. Spostarle cambiando anche
-- solo una percentuale avrebbe fatto cambiare da solo, in silenzio, il
-- calcolo di una schermata che Alessio gia' usa.
-- ---------------------------------------------------------------------
insert into regole_deducibilita
  (etichetta, percentuale_deducibile, vieta_contante, soggetta_a_plafond, nota, ordine)
values
  ('Formazione / aggiornamento', 100, false, false,
   'Interamente deducibile per una societa'', nessun plafond.', 10),
  ('Trasferte (vitto/alloggio/trasporto)', 75, true, false,
   '75% deducibile. Dal 2025 il pagamento in contanti la rende indeducibile (esenti i biglietti di trasporto pubblico di linea e le indennita'' chilometriche entro i limiti).', 20),
  ('Rappresentanza', 100, true, true,
   'Deducibile entro il plafond commisurato ai ricavi. Sotto la soglia per persona sempre deducibile fuori plafond. Dal 2025 il contante la rende indeducibile.', 30),
  ('Marketing / pubblicita''', 100, false, false,
   'Spese di pubblicita'' deducibili.', 40),
  ('Altro (spesa aziendale documentata)', 100, false, false,
   'Spesa aziendale documentata.', 50),
  -- L'unica aggiunta, ed e' un contenitore vuoto e non un caso: senza,
  -- non si potrebbe classificare NIENTE come indeducibile finche' Laura
  -- non risponde. Quali costi ci finiscano dentro lo dira' lei (L9).
  ('Indeducibile', 0, false, false,
   'Contenitore per cio'' che non si deduce. L''elenco dei casi ricorrenti e'' il quesito L9 per la commercialista: finche'' non risponde, ci finisce dentro solo cio'' che decide Alessio, voce per voce.', 90)
on conflict (etichetta) do nothing;

revoke all on table regole_deducibilita from public, anon;

-- =====================================================================
-- 2. I due parametri del plafond scendono dal codice al database
-- =====================================================================
-- Stavano in src/lib/constants.js come RAPPRESENTANZA_PLAFOND_RATE e
-- RAPPRESENTANZA_PER_PERSON_THRESHOLD. Sono parametri fiscali: li governa
-- Alessio dopo Laura, come le aliquote.
--
-- ⚠️ Lezione del 15/08, terza ricomparsa quel giorno: il valore predefinito
-- e la sanatoria delle righe che esistono gia' sono DUE COSE DIVERSE e
-- servono ENTRAMBE. In produzione `fiscal_settings` ha una riga (la
-- S.r.l.s.); sul progetto di prova nessuna. Il solo default lascerebbe
-- senza parametri la riga che c'e'; la sola sanatoria lascerebbe senza
-- parametri l'azienda agricola quando nascera'.
--
-- ⚠️ E non e' il difetto del 14/08 (un default che risponde al posto
-- dell'utente): qui il default riproduce ESATTAMENTE il numero che il
-- codice usa gia' oggi, quindi non cambia nessun risultato. Se cambiasse
-- qualcosa, sarebbe una risposta data da me.
alter table fiscal_settings
  add column if not exists plafond_rappresentanza_percento numeric(5,2) not null default 1.5;

update fiscal_settings
   set plafond_rappresentanza_percento = 1.5
 where plafond_rappresentanza_percento is null;

-- ⚠️ NON si sposta anche `RAPPRESENTANZA_PER_PERSON_THRESHOLD`, e il motivo
-- e' una scoperta di questo blocco: quella costante **non e' letta da
-- nessun calcolo**. Sta solo dentro il testo di un campo della schermata
-- Deduzioni («N. persone (soglia 50€/pers.)»), che quindi promette una
-- regola che nessuno applica. Portarla nel database avrebbe creato un
-- parametro spento — la cosa che il 14/08 si e' finito di togliere dalla
-- capienza. Il testo della schermata viene corretto; se un giorno la
-- regola servira' davvero, nascera' con il suo calcolo.

comment on column fiscal_settings.plafond_rappresentanza_percento is
  'Percentuale dei ricavi entro cui la rappresentanza e'' deducibile. Era RAPPRESENTANZA_PLAFOND_RATE in src/lib/constants.js: spostata senza cambiarne il valore (15/08/2026).';

-- =====================================================================
-- 3. L'attributo sulle righe di costo — e su chi lo detta per abitudine
-- =====================================================================
-- Nullable ovunque, e il null e' il terzo stato: «non l'ha detto nessuno».
alter table cash_causali
  add column if not exists regola_deducibilita_id uuid references regole_deducibilita(id) on delete set null;
alter table cash_movements
  add column if not exists regola_deducibilita_id uuid references regole_deducibilita(id) on delete set null;
alter table suppliers
  add column if not exists regola_deducibilita_id uuid references regole_deducibilita(id) on delete set null;
alter table supplier_invoices
  add column if not exists regola_deducibilita_id uuid references regole_deducibilita(id) on delete set null;
alter table deductible_expenses
  add column if not exists regola_deducibilita_id uuid references regole_deducibilita(id) on delete set null;

comment on column cash_causali.regola_deducibilita_id is
  'La regola ABITUALE per questa causale. La riga di prima nota la eredita; una scelta esplicita sulla riga vince (stesso patto del fornitore abituale sul prodotto, 14/08/2026).';
comment on column cash_movements.regola_deducibilita_id is
  'Scelta esplicita per QUESTO movimento. Vuota = si eredita dalla causale; vuote entrambe = non classificato, e si dichiara.';

create index if not exists idx_cash_movements_regola on cash_movements(regola_deducibilita_id);
create index if not exists idx_supplier_invoices_regola on supplier_invoices(regola_deducibilita_id);
create index if not exists idx_deductible_expenses_regola on deductible_expenses(regola_deducibilita_id);

-- ---------------------------------------------------------------------
-- `deductible_expenses.category` diventa la regola, e poi sparisce.
-- ⚠️ Si RIMUOVE, non si spegne. Una colonna lasciata li' a dire la stessa
-- cosa in un secondo modo e' esattamente cio' che questo blocco esiste per
-- togliere: fra tre mesi qualcuno la riempie credendo di riparare qualcosa
-- e i totali si dividono in due. Stessa scelta del 14/08 con la capienza.
-- La corrispondenza e' totale — cinque categorie, cinque regole — quindi
-- non si perde nessuna informazione.
-- ---------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'deductible_expenses'
       and column_name = 'category'
  ) then
    update deductible_expenses e
       set regola_deducibilita_id = r.id
      from regole_deducibilita r
     where e.regola_deducibilita_id is null
       and r.etichetta = case e.category::text
                           when 'formazione'     then 'Formazione / aggiornamento'
                           when 'trasferta'      then 'Trasferte (vitto/alloggio/trasporto)'
                           when 'rappresentanza' then 'Rappresentanza'
                           when 'marketing'      then 'Marketing / pubblicita'''
                           when 'altro'          then 'Altro (spesa aziendale documentata)'
                         end;

    -- Nessuna riga puo' restare senza regola: se la corrispondenza avesse
    -- un buco, meglio fermarsi qui che scoprirlo da un totale sbagliato.
    if exists (select 1 from deductible_expenses where regola_deducibilita_id is null) then
      raise exception 'Ci sono spese la cui categoria non ha trovato la regola corrispondente: la migrazione si ferma invece di lasciarle senza.';
    end if;

    alter table deductible_expenses drop column category;
  end if;
end $$;

drop type if exists deduction_category;

-- =====================================================================
-- 4. UN SOLO calcolo della quota deducibile
-- =====================================================================
-- Sostituisce `expenseEligibleAmount` e `expenseCashRuleFails` di
-- src/lib/deducibility.js. Stesso principio di `orderTotals()` e di
-- `calcola_imposte()`: tre schermate che ricalcolano da sole finiscono per
-- dire tre numeri diversi.
--
-- ⚠️ L'ORDINE DELLE REGOLE E' LA REGOLA. «Senza documento» viene PRIMA di
-- tutto, ed e' il criterio 4 di collaudo del mandato: una voce senza
-- documento risulta indeducibile qualunque regola le sia stata assegnata.
-- Se fosse solo questione di scegliere la regola giusta, prima o poi
-- qualcuno assegnerebbe «interamente deducibile» a una spesa senza
-- ricevuta, e nessuno se ne accorgerebbe mai.
create or replace function quota_deducibile(
  p_importo                numeric,
  p_regola_id              uuid,
  p_in_contante            boolean,
  p_documentato            boolean,
  p_esente_regola_contante boolean default false
)
returns table (
  quota  numeric,
  stato  text,
  motivo text
)
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  r regole_deducibilita%rowtype;
begin
  if not is_titolare() then
    raise exception 'La deducibilita'' dei costi e'' riservata al titolare.';
  end if;

  if coalesce(p_documentato, false) = false then
    return query select 0::numeric, 'indeducibile'::text,
      'Senza documento di spesa: non si deduce, qualunque regola le sia assegnata.'::text;
    return;
  end if;

  if p_regola_id is null then
    -- ⚠️ Quota zero MA stato diverso: chi somma non deve poter confondere
    -- «sappiamo che non si deduce» con «non l'ha ancora detto nessuno».
    return query select 0::numeric, 'da_classificare'::text,
      'Nessuno ha ancora detto se questo costo si deduce.'::text;
    return;
  end if;

  select * into r from regole_deducibilita where id = p_regola_id;
  if r.id is null then
    return query select 0::numeric, 'da_classificare'::text,
      'La regola indicata non esiste piu''.'::text;
    return;
  end if;

  if r.vieta_contante and coalesce(p_in_contante, false)
     and not coalesce(p_esente_regola_contante, false) then
    return query select 0::numeric, 'indeducibile'::text,
      ('Pagata in contanti: la regola «' || r.etichetta || '» non ammette il contante.')::text;
    return;
  end if;

  return query select
    round(coalesce(p_importo, 0) * r.percentuale_deducibile / 100, 2),
    case when r.percentuale_deducibile >= 100 then 'deducibile'
         when r.percentuale_deducibile <= 0   then 'indeducibile'
         else 'parziale' end::text,
    ('Regola «' || r.etichetta || '»: ' || trim(to_char(r.percentuale_deducibile, 'FM990.99')) || '% deducibile'
      || case when r.verificata_il is null
              then ' — non ancora confermata dalla commercialista.'
              else ' — confermata il ' || to_char(r.verificata_il, 'DD/MM/YYYY') || '.' end)::text;
end;
$function$;

comment on function quota_deducibile is
  'L''unico posto dove si decide quanto di un costo si deduce (15/08/2026). Assorbe src/lib/deducibility.js. «Senza documento» viene prima di ogni regola: e'' il criterio 4 del mandato.';

revoke all on function quota_deducibile(numeric, uuid, boolean, boolean, boolean) from public, anon, authenticated;
grant execute on function quota_deducibile(numeric, uuid, boolean, boolean, boolean) to authenticated;

-- =====================================================================
-- 5. La lettura: le due basi, e il buco dichiarato
-- =====================================================================
-- ⚠️ PERIMETRO, dichiarato perche' non si deduca guardando il numero: si
-- leggono i **soldi che escono davvero** — uscite di prima nota e fatture
-- fornitori. `deductible_expenses` NON entra: oggi non e' collegata alla
-- prima nota, quindi una trasferta pagata con la carta ci sta due volte, e
-- sommarle raddoppierebbe il costo. Il collegamento e' il §4a del mandato
-- («la voce genera il movimento»), che e' il blocco della tesoreria.
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
  v_plafond        numeric;
  v_ricavi         numeric;
  v_perc           numeric;
  v_ecc            numeric := 0;
  v_non_conf       integer;
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
    -- Prima nota, sole uscite. `mezzo = 'cassa'` e' il contante;
    -- `tipo_documento <> 'non_documentato'` e' l'esistenza del documento.
    select m.amount                                    as importo,
           coalesce(m.regola_deducibilita_id, c.regola_deducibilita_id) as regola_id,
           (m.mezzo = 'cassa')                         as in_contante,
           (m.tipo_documento <> 'non_documentato')     as documentato
      from cash_movements m
      left join cash_causali c on c.id = m.causale_id
     where m.entity_id = p_entity_id
       and m.direction = 'uscita'
       and extract(year from m.movement_date) = p_anno
    union all
    -- Una fattura E' il documento, per definizione.
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
    select r.importo, r.regola_id,
           q.quota, q.stato,
           coalesce(g.soggetta_a_plafond, false) as a_plafond
      from righe r
      cross join lateral quota_deducibile(r.importo, r.regola_id, r.in_contante, r.documentato) q
      left join regole_deducibilita g on g.id = r.regola_id
  ),
  -- Il plafond e' un tetto sull'AGGREGATO, non su una riga: si applica qui.
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
    coalesce((select sum(importo) from valutate
               where stato = 'indeducibile' and regola_id is not null), 0)
      + coalesce((select sum(importo) from valutate where regola_id is null and stato = 'indeducibile'), 0),
    v_plafond,
    case when v_plafond is null then 0
         else greatest(coalesce((select quota_plafond from plafonate), 0) - v_plafond, 0) end,
    (select count(*)::integer from regole_deducibilita where attiva and verificata_il is null),
    -- ⚠️ Il numero e il suo limite viaggiano insieme, come per
    -- `calcola_imposte()`: un'avvertenza che vive nel testo di UNA
    -- schermata non protegge la seconda schermata che mostra lo stesso
    -- numero.
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
             else '' end);
end;
$function$;

comment on function rettifiche_fiscali is
  'Le due basi del mandato: utile gestionale e imponibile (15/08/2026). Legge le uscite di prima nota e le fatture fornitori — NON deductible_expenses, che oggi non e'' collegata alla prima nota e raddoppierebbe i costi. Cio'' che nessuno ha classificato resta VUOTO e dichiarato, mai zero.';

revoke all on function rettifiche_fiscali(uuid, integer) from public, anon, authenticated;
grant execute on function rettifiche_fiscali(uuid, integer) to authenticated;

-- ---------------------------------------------------------------------
-- L'elenco di cosa manca da classificare: senza, «N voci non classificate»
-- e' un rimprovero senza porta. Con, e' una lista di lavoro.
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- Le spese del modulo Deduzioni, gia' valorizzate dal database.
--
-- ⚠️ Serve a chiudere davvero il buco, e non a spostarlo. Senza questa, la
-- schermata avrebbe dovuto ricalcolare la quota riga per riga in
-- JavaScript a partire dalle regole lette dal database — cioe' una SECONDA
-- implementazione della stessa regola, che e' esattamente cio' che questo
-- blocco esiste per togliere. Qui la schermata **mostra** quello che il
-- database ha calcolato: stesso patto di `lista_spesa()`, dove giacenza e
-- soglia sono lette e non copiate.
--
-- ⚠️ E il plafond si applica QUI, sull'aggregato: una quota per riga non
-- puo' sapere quanto hanno gia' consumato le altre righe.
create or replace function spese_deducibili_valorizzate(
  p_entity_id uuid,
  p_anno      integer
)
returns table (
  id                 uuid,
  expense_date       date,
  description        text,
  amount             numeric,
  payment_method     text,
  regola_id          uuid,
  regola             text,
  quota              numeric,
  stato              text,
  motivo             text,
  document_reference text,
  business_purpose   text,
  a_plafond          boolean
)
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_plafond   numeric;
  v_ricavi    numeric;
  v_perc      numeric;
  v_eleggibil numeric;
  v_fattore   numeric := 1;
begin
  if not is_titolare() then
    raise exception 'I numeri fiscali sono riservati al titolare.';
  end if;

  select annual_revenue_estimate, plafond_rappresentanza_percento
    into v_ricavi, v_perc
    from fiscal_settings where entity_id = p_entity_id;
  v_plafond := case when v_ricavi is not null and v_ricavi > 0
                    then round(v_ricavi * coalesce(v_perc, 0) / 100, 2) else null end;

  -- Quanto chiedono, in totale, le righe soggette a plafond.
  select coalesce(sum(q.quota), 0) into v_eleggibil
    from deductible_expenses e
    left join regole_deducibilita g on g.id = e.regola_deducibilita_id
    cross join lateral quota_deducibile(
      e.amount, e.regola_deducibilita_id,
      e.payment_method = 'contante',
      e.document_reference is not null,
      e.exempt_from_cash_rule) q
   where e.entity_id = p_entity_id
     and extract(year from e.expense_date) = p_anno
     and coalesce(g.soggetta_a_plafond, false);

  -- Se sforano, ogni riga a plafond viene ridotta in proporzione: cosi' la
  -- somma delle righe mostrate coincide col totale, invece di lasciare una
  -- differenza che nessuno sa spiegare.
  if v_plafond is not null and v_eleggibil > v_plafond and v_eleggibil > 0 then
    v_fattore := v_plafond / v_eleggibil;
  end if;

  return query
  select e.id, e.expense_date, e.description, e.amount, e.payment_method::text,
         e.regola_deducibilita_id, g.etichetta,
         case when coalesce(g.soggetta_a_plafond, false)
              then round(q.quota * v_fattore, 2) else q.quota end,
         q.stato,
         q.motivo || case
           when coalesce(g.soggetta_a_plafond, false) and v_fattore < 1
             then ' Ridotta dal plafond della rappresentanza.'
           when coalesce(g.soggetta_a_plafond, false) and v_plafond is null
             then ' Plafond non applicato: manca la stima dei ricavi annui.'
           else '' end,
         e.document_reference, e.business_purpose,
         coalesce(g.soggetta_a_plafond, false)
    from deductible_expenses e
    left join regole_deducibilita g on g.id = e.regola_deducibilita_id
    cross join lateral quota_deducibile(
      e.amount, e.regola_deducibilita_id,
      e.payment_method = 'contante',
      e.document_reference is not null,
      e.exempt_from_cash_rule) q
   where e.entity_id = p_entity_id
     and extract(year from e.expense_date) = p_anno
   order by e.expense_date desc;
end;
$function$;

comment on function spese_deducibili_valorizzate is
  'Le spese del modulo Deduzioni gia'' valorizzate dal database (15/08/2026). La schermata mostra, non ricalcola: una seconda implementazione della regola sarebbe il difetto che questo blocco toglie.';

revoke all on function spese_deducibili_valorizzate(uuid, integer) from public, anon, authenticated;
grant execute on function spese_deducibili_valorizzate(uuid, integer) to authenticated;

-- =====================================================================
-- VERIFICA — nessun gestore d'eccezione sul blocco esterno
-- =====================================================================
-- ⚠️ Lezione del 15/08: un `exception when ...` sul blocco esterno
-- catturerebbe anche il fallimento delle proprie assertion, e la migrazione
-- passerebbe verde con la verifica rotta. I rifiuti attesi si provano uno
-- per uno, con un `begin…exception` annidato.
do $verifica$
declare
  v_ente      uuid;
  v_titolare  uuid;
  v_staff     uuid;
  v_r_piena   uuid;
  v_r_75      uuid;
  v_r_zero    uuid;
  v_causale   uuid;
  v_fornitore uuid;
  q           record;
  t           record;
  v_quota     numeric;
  v_stato     text;
  n           integer;
  respinto    boolean;
  aveva_fs    boolean;
begin
  select id into v_ente from entities where entity_type = 'srls' limit 1;
  if v_ente is null then select id into v_ente from entities limit 1; end if;
  if v_ente is null then
    raise exception 'Nessuna entita'' nel database: la verifica non puo'' girare.';
  end if;

  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  select user_id into v_staff    from user_roles where role = 'staff'    limit 1;
  if v_titolare is null then
    raise exception 'Nessun titolare in user_roles: prerequisito della verifica.';
  end if;

  select id into v_r_piena from regole_deducibilita where etichetta = 'Altro (spesa aziendale documentata)';
  select id into v_r_75    from regole_deducibilita where etichetta = 'Trasferte (vitto/alloggio/trasporto)';
  select id into v_r_zero  from regole_deducibilita where etichetta = 'Indeducibile';
  if v_r_piena is null or v_r_75 is null or v_r_zero is null then
    raise exception 'Le regole spostate dal codice non ci sono tutte.';
  end if;

  -- Le percentuali non devono essere cambiate nello spostamento.
  if (select percentuale_deducibile from regole_deducibilita
       where etichetta = 'Trasferte (vitto/alloggio/trasporto)') <> 75 then
    raise exception 'La percentuale delle trasferte non e'' piu'' quella che il codice usava.';
  end if;

  -- Nessuna regola NASCE confermata: sarebbe una firma che nessuno ha messo.
  -- ⚠️ Il controllo guarda le sole righe che nessuno ha mai toccato
  -- (`updated_at = created_at`), e non tutte. Lezione del 14/08: una
  -- verifica non deve fallire per come qualcuno ha apparecchiato — il
  -- giorno che Alessio scrive la data di conferma di Laura, rieseguire
  -- questa migrazione si fermerebbe su una sua scelta legittima. E il
  -- guardiano e' una proprieta' dello schema, non una data da ricordare.
  if exists (
    select 1 from regole_deducibilita
     where verificata_il is not null and updated_at = created_at
  ) then
    raise exception 'Una regola nasce gia'' confermata dalla commercialista: nessuno l''ha confermata.';
  end if;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

  -- ---- Il calcolo, caso per caso ------------------------------------
  -- 1. Senza documento: zero, e vince su qualunque regola.
  select * into q from quota_deducibile(100, v_r_piena, false, false);
  if q.quota <> 0 or q.stato <> 'indeducibile' then
    raise exception 'Una spesa senza documento risulta deducibile (quota %, stato %).', q.quota, q.stato;
  end if;

  -- 2. Nessuna regola: zero, ma stato DIVERSO — e' il cuore del blocco.
  select * into q from quota_deducibile(100, null, false, true);
  if q.stato <> 'da_classificare' then
    raise exception 'Un costo senza regola non risulta «da classificare» ma «%».', q.stato;
  end if;

  -- 3. Regola parziale.
  select * into q from quota_deducibile(100, v_r_75, false, true);
  if q.quota <> 75 or q.stato <> 'parziale' then
    raise exception 'La quota parziale non torna: % (stato %).', q.quota, q.stato;
  end if;

  -- 4. Regola parziale MA pagata in contanti: zero.
  select * into q from quota_deducibile(100, v_r_75, true, true);
  if q.quota <> 0 or q.stato <> 'indeducibile' then
    raise exception 'Il contante non azzera una spesa che non lo ammette.';
  end if;

  -- 5. …e l'esenzione dichiarata la riporta deducibile.
  select * into q from quota_deducibile(100, v_r_75, true, true, true);
  if q.quota <> 75 then
    raise exception 'L''esenzione dalla regola contanti non viene applicata.';
  end if;

  -- 6. Regola a zero: indeducibile, e NON «da classificare».
  select * into q from quota_deducibile(100, v_r_zero, false, true);
  if q.quota <> 0 or q.stato <> 'indeducibile' then
    raise exception 'La regola «Indeducibile» non produce uno stato indeducibile.';
  end if;

  -- ---- L'eredita' dalla causale, e la scelta che vince ---------------
  insert into cash_causali (label, kind, regola_deducibilita_id)
  values ('__PROVA DEDUCIBILITA__', 'uscita', v_r_75)
  returning id into v_causale;

  insert into cash_movements (entity_id, direction, amount, movement_date, causale_id,
                              tipo_documento, mezzo, note)
  values (v_ente, 'uscita', 200, make_date(2099, 6, 1), v_causale,
          'fattura', 'banca', '__PROVA DEDUCIBILITA ereditata__');

  select * into t from rettifiche_fiscali(v_ente, 2099);
  if t.quota_deducibile <> 150 then
    raise exception 'La regola non si eredita dalla causale: quota % invece di 150.', t.quota_deducibile;
  end if;
  if t.righe_non_classificate <> 0 then
    raise exception 'Una riga che eredita la regola risulta non classificata.';
  end if;

  -- La scelta esplicita sulla riga vince sull'eredita'.
  update cash_movements set regola_deducibilita_id = v_r_piena
   where note = '__PROVA DEDUCIBILITA ereditata__';
  select * into t from rettifiche_fiscali(v_ente, 2099);
  if t.quota_deducibile <> 200 then
    raise exception 'La scelta sulla riga non vince sull''eredita'': quota %.', t.quota_deducibile;
  end if;

  -- ---- Il buco resta vuoto, mai zero --------------------------------
  insert into cash_movements (entity_id, direction, amount, movement_date,
                              tipo_documento, mezzo, note)
  values (v_ente, 'uscita', 500, make_date(2099, 7, 1), 'fattura', 'banca',
          '__PROVA DEDUCIBILITA senza regola__');

  select * into t from rettifiche_fiscali(v_ente, 2099);
  if t.righe_non_classificate <> 1 or t.non_classificato <> 500 then
    raise exception 'Il non classificato non e'' dichiarato: % righe, %.',
      t.righe_non_classificate, t.non_classificato;
  end if;
  -- ⚠️ E soprattutto: NON deve essere finito ne' fra i deducibili ne'
  -- nella rettifica. Uno zero al posto suo si leggerebbe «tutto a posto».
  if t.quota_deducibile <> 200 then
    raise exception 'Una voce non classificata e'' stata contata fra i deducibili.';
  end if;
  if t.rettifica_in_aumento <> 0 then
    raise exception 'Una voce non classificata e'' finita nella rettifica: %.', t.rettifica_in_aumento;
  end if;
  if t.costi_totali <> 700 or t.costi_classificati <> 200 then
    raise exception 'Totali sbagliati: totali %, classificati %.', t.costi_totali, t.costi_classificati;
  end if;
  if position('non sono ancora classificate' in t.avvertenza) = 0 then
    raise exception 'L''avvertenza non dichiara le voci non classificate.';
  end if;

  -- E l'elenco di cosa manca esiste davvero.
  select count(*) into n from costi_da_classificare(v_ente, 2099);
  if n <> 1 then
    raise exception 'L''elenco dei costi da classificare ne mostra % invece di 1.', n;
  end if;

  -- ---- Un costo senza documento entra nella rettifica ---------------
  insert into cash_movements (entity_id, direction, amount, movement_date, causale_id,
                              tipo_documento, mezzo, note)
  values (v_ente, 'uscita', 300, make_date(2099, 8, 1), v_causale,
          'non_documentato', 'cassa', '__PROVA DEDUCIBILITA senza documento__');

  select * into t from rettifiche_fiscali(v_ente, 2099);
  if t.rettifica_in_aumento <> 300 then
    raise exception 'Un costo senza documento non produce rettifica: %.', t.rettifica_in_aumento;
  end if;
  if t.quota_deducibile <> 200 then
    raise exception 'Un costo senza documento ha aumentato la quota deducibile.';
  end if;

  -- ---- Le spese del modulo Deduzioni, valorizzate dal database -------
  -- ⚠️ Qui si prova anche una CONSEGUENZA dichiarata: da oggi una spesa
  -- senza riferimento al documento non si deduce nemmeno in questo modulo.
  -- Prima si deduceva. Non cambia nessun numero esistente (la tabella e'
  -- vuota in produzione), ma e' un cambio di comportamento e va provato.
  insert into deductible_expenses
    (entity_id, description, amount, expense_date, payment_method,
     regola_deducibilita_id, document_reference)
  values
    (v_ente, '__PROVA DED con documento__', 100, make_date(2099, 3, 1), 'carta',
     v_r_75, 'RIC-2099-1'),
    (v_ente, '__PROVA DED senza documento__', 100, make_date(2099, 3, 2), 'carta',
     v_r_75, null);

  select count(*) into n from spese_deducibili_valorizzate(v_ente, 2099);
  if n <> 2 then
    raise exception 'Le spese valorizzate sono % invece di 2.', n;
  end if;

  select quota, stato into v_quota, v_stato
    from spese_deducibili_valorizzate(v_ente, 2099)
   where description = '__PROVA DED con documento__';
  if v_quota <> 75 then
    raise exception 'La spesa documentata non e'' valorizzata al 75%%: %.', v_quota;
  end if;

  select quota, stato into v_quota, v_stato
    from spese_deducibili_valorizzate(v_ente, 2099)
   where description = '__PROVA DED senza documento__';
  if v_quota <> 0 or v_stato <> 'indeducibile' then
    raise exception 'Una spesa senza riferimento al documento risulta ancora deducibile (% / %).',
      v_quota, v_stato;
  end if;

  delete from deductible_expenses where description like '__PROVA DED%';

  -- ---- Il portiere: lo staff non vede i numeri fiscali --------------
  if v_staff is not null then
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);

    respinto := false;
    begin
      perform * from rettifiche_fiscali(v_ente, 2099);
    exception when sqlstate 'P0001' then respinto := true;
    end;
    if not respinto then
      raise exception 'Lo staff legge le rettifiche fiscali.';
    end if;

    respinto := false;
    begin
      perform * from quota_deducibile(100, v_r_piena, false, true);
    exception when sqlstate 'P0001' then respinto := true;
    end;
    if not respinto then
      raise exception 'Lo staff calcola la deducibilita'' di un costo.';
    end if;

    respinto := false;
    begin
      perform * from costi_da_classificare(v_ente, 2099);
    exception when sqlstate 'P0001' then respinto := true;
    end;
    if not respinto then
      raise exception 'Lo staff legge l''elenco dei costi da classificare.';
    end if;

    respinto := false;
    begin
      perform * from spese_deducibili_valorizzate(v_ente, 2099);
    exception when sqlstate 'P0001' then respinto := true;
    end;
    if not respinto then
      raise exception 'Lo staff legge le spese deducibili valorizzate.';
    end if;
  end if;

  -- ---- Pulizia -------------------------------------------------------
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

  delete from cash_movements where note like '__PROVA DEDUCIBILITA%';
  delete from cash_causali where label = '__PROVA DEDUCIBILITA__';

  -- ⚠️ Si controlla cio' che e' RIMASTO e cio' che e' CAMBIATO (lezione
  -- del 14/08: la verifica della pianta contava le righe e non i valori,
  -- e lascio' due tavoli in mezzo ai divani dichiarando zero residui).
  -- Qui la verifica non ha modificato nessuna riga preesistente: ha solo
  -- creato le proprie. Il controllo e' quindi che non ne resti nessuna, e
  -- che nessuna riga vera abbia preso una regola per strada.
  select count(*) into n from cash_movements where note like '__PROVA DEDUCIBILITA%';
  if n <> 0 then
    raise exception 'La verifica ha lasciato % movimenti nel database.', n;
  end if;
  select count(*) into n from cash_causali where label = '__PROVA DEDUCIBILITA__';
  if n <> 0 then
    raise exception 'La verifica ha lasciato la causale di prova.';
  end if;
  select count(*) into n from deductible_expenses where description like '__PROVA DED%';
  if n <> 0 then
    raise exception 'La verifica ha lasciato % spese nel modulo Deduzioni.', n;
  end if;

  perform set_config('request.jwt.claims', null, true);
  raise notice 'Deducibilita'': senza documento non si deduce, senza regola non si conta, la causale detta l''abitudine e la riga vince.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260815000002', 'attributo_di_deducibilita')
on conflict (version) do nothing;

select
  (select count(*) from regole_deducibilita)                                as regole,
  (select count(*) from regole_deducibilita where verificata_il is null)    as non_confermate,
  (select count(*) from cash_movements where direction = 'uscita')          as uscite_in_prima_nota,
  (select count(*) from supplier_invoices)                                  as fatture,
  (select count(*) from deductible_expenses
    where regola_deducibilita_id is null)                                   as spese_senza_regola,
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'deductible_expenses'
      and column_name = 'category')                                         as colonna_categoria_rimasta;
