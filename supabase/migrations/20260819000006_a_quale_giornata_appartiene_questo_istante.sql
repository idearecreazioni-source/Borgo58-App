-- A QUALE GIORNATA APPARTIENE QUESTO ISTANTE — una risposta sola
-- =====================================================================
-- Censimento: docs/referti/20260819_censimento_giornata_operativa.md
-- Regola e perimetro: decisi da Alessio il 19/08/2026.
--
-- 🔴 LA REGOLA, CON LE SUE PAROLE E IL SUO PERIMETRO. Dopo mezzanotte, in
-- questo locale, l'unico movimento che capita è il conto incassato a fine
-- servizio. Quindi seguono **la serata in corso** due gesti soli:
--   1. il **conto** incassato dopo mezzanotte;
--   2. il **conteggio del cassetto** di fine serata.
-- ⚠️ **Tutto il resto segue il calendario**: banca, carte, fatture,
-- scadenze, uscite, spese, prenotazioni, turni, HACCP.
--
-- ⚠️ NON È UNA SEMPLIFICAZIONE DA ALLARGARE COL TEMPO. La proposta più
-- larga era «tutto ciò che passa dal cassetto», e Alessio l'ha **ristretta**:
-- quei movimenti, dopo mezzanotte, da lui non ci sono.
--
-- ⚠️ E I DUE GESTI STANNO INSIEME O NON FUNZIONA NESSUNO DEI DUE: se
-- l'incasso delle 00:30 va su sabato e il conteggio del cassetto finisce su
-- domenica, il gestionale confronta i soldi contati stanotte con gli incassi
-- di un'altra giornata e **dichiara un ammanco che non esiste**.

-- ---------------------------------------------------------------------
-- 1 · Che giorno è, a Roma
-- ---------------------------------------------------------------------
-- 🔴 `current_date` NON È MAI LA RISPOSTA GIUSTA, nemmeno dove la
-- mezzanotte va benissimo: il database vive a Greenwich, e fra mezzanotte e
-- le due dice **ieri** a chiunque. Misurato mentre accadeva il 18/08: alle
-- 01:31 italiane rispondeva 2026-08-17.
create or replace function oggi_a_roma()
returns date
language sql
stable
set search_path = public
as $$
  select (now() at time zone 'Europe/Rome')::date;
$$;

revoke all on function oggi_a_roma() from public, anon;
grant execute on function oggi_a_roma() to authenticated;

-- ---------------------------------------------------------------------
-- 2 · Quale SERATA è questa
-- ---------------------------------------------------------------------
-- ⚠️ È IL GEMELLO SQL DI `serataDiServizio()` (src/lib/calcoli/serata.js),
-- e la parentela non è un modo di dire: quella funzione fu scritta **pura**
-- il 18/08 apposta — riceve l'ora invece di contenerla — perché il giorno
-- che il database avesse la sua le due leggessero **lo stesso numero**.
-- L'ora è un dato di Alessio: `service_settings.ora_fine_serata`, oggi le
-- 05:00. Scriverla qui sarebbe il dodicesimo orologio.
--
-- ⚠️ NON SI COPIA LA REGOLA, SI CHIAMA QUESTA. Se «la giornata operativa»
-- diventa trentadue espressioni ripetute, la prossima modifica ne
-- dimenticherà una e nessuna prova lo dirà — è la lezione tornata tre volte
-- in due giorni.
create or replace function serata_di_servizio(p_istante timestamptz default now())
returns date
language sql
stable
set search_path = public
as $$
  select case
           when (p_istante at time zone 'Europe/Rome')::time
                < coalesce((select ora_fine_serata from service_settings where id = 1), '05:00')
           then ((p_istante at time zone 'Europe/Rome')::date - 1)
           else (p_istante at time zone 'Europe/Rome')::date
         end;
$$;

comment on function serata_di_servizio(timestamptz) is
  'A quale SERATA appartiene un istante: prima di service_settings.ora_fine_serata è ancora la sera prima. Gemello SQL di serataDiServizio() in src/lib/calcoli/serata.js — le due devono dare la stessa risposta sullo stesso istante.';

revoke all on function serata_di_servizio(timestamptz) from public, anon;
grant execute on function serata_di_servizio(timestamptz) to authenticated;

-- ---------------------------------------------------------------------
-- 3 · Gli otto predefiniti di colonna, decisi uno per uno
-- ---------------------------------------------------------------------
-- ⚠️ SONO IL GRUPPO PEGGIORE, ed è la famiglia dei 33 posti silenziosi: chi
-- scrive una riga senza la data **non sta scegliendo**, e il valore arriva
-- da solo. Nessuno di questi resta com'era «perché tanto di solito va bene»:
-- ognuno prende una regola dichiarata.
--
-- ⚠️ SOLO UNO PRENDE LA SERATA, ed è il gesto n. 2 del perimetro. Gli altri
-- sette prendono il calendario di Roma — che per loro non cambia la regola,
-- **cambia il fuso**: fino a ieri fra mezzanotte e le due scrivevano ieri.
alter table conteggi_cassa      alter column contato_il     set default serata_di_servizio();

alter table cash_movements      alter column movement_date  set default oggi_a_roma();
alter table tips_collected      alter column collected_date set default oggi_a_roma();
alter table discounts_gifts     alter column movement_date  set default oggi_a_roma();
alter table daily_menus         alter column service_date   set default oggi_a_roma();
alter table anticipazioni_socio alter column pagata_il      set default oggi_a_roma();
alter table deductible_expenses alter column expense_date   set default oggi_a_roma();
alter table foraged_items       alter column harvest_date   set default oggi_a_roma();

comment on column conteggi_cassa.contato_il is
  'La SERATA a cui appartiene il conteggio del cassetto (gesto 2 del perimetro del 19/08): contando alle 00:30 si chiude la serata di ieri. La schermata la mostra e la fa confermare.';

-- ---------------------------------------------------------------------
-- 4 · Le funzioni, riprese dal database e corrette
-- ---------------------------------------------------------------------
-- ⚠️ Riprese con `pg_get_functiondef` (regola del 18/08) e cambiate solo
-- dove decidono una data. Undici funzioni, 27 sostituzioni.


CREATE OR REPLACE FUNCTION public.previsione_cassa(p_entity_id uuid, p_fino_al date DEFAULT NULL::date)
 RETURNS TABLE(oggi_cassa numeric, oggi_banca numeric, pos_in_arrivo numeric, uscite_attese numeric, quante_uscite integer, saldo_previsto numeric, fino_al date, avvertenza text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_fino   date := coalesce(p_fino_al, oggi_a_roma() + 30);
  v_cassa  numeric;
  v_banca  numeric;
  v_pos    numeric;
  v_lordo  boolean;
  v_usc    numeric;
  v_n      integer;
begin
  if not is_titolare() then
    raise exception 'La previsione di cassa e'' riservata al titolare.';
  end if;

  select s.contante_atteso, s.saldo_banca into v_cassa, v_banca
    from saldo_tesoreria(p_entity_id) s;

  select p.lordo, (p.netto_atteso is null) into v_pos, v_lordo
    from pos_in_transito(p_entity_id) p;

  select coalesce(sum(m.importo), 0), count(*) into v_usc, v_n
    from movimenti_attesi(p_entity_id, v_fino) m;

  return query select
    v_cassa, v_banca, v_pos, v_usc, v_n,
    v_cassa + v_banca + v_pos - v_usc,
    v_fino,
    -- ⚠️ Il limite viaggia col numero, e qui il limite e' grosso: manca
    -- il costo del personale, che e' la voce piu' pesante dell'anno.
    'Previsione al ' || to_char(v_fino, 'DD/MM/YYYY') || '. '
    || '⚠️ NON comprende gli stipendi: escono dal prospetto del costo aziendale, che arriva col Consulente del Lavoro. '
    || case when v_lordo then 'Gli incassi con carta sono contati al lordo delle commissioni. ' else '' end
    || 'Le fatture gia'' pagate non sono contate due volte: spariscono da sole quando registri il pagamento.';
end;
$function$;


CREATE OR REPLACE FUNCTION public.versa_in_banca(p_entity_id uuid, p_importo numeric, p_data date DEFAULT oggi_a_roma(), p_nota text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    raise exception 'Nel cassetto risultano %: non puoi versarne %.',
      euro(v_disponibile), euro(p_importo);
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
    (p_entity_id, 'uscita', p_importo, coalesce(p_data, oggi_a_roma()), v_out, 'cassa',
     'non_documentato', coalesce(p_nota, 'Versamento in banca'))
  returning id into v_movimento;

  insert into cash_movements
    (entity_id, direction, amount, movement_date, causale_id, mezzo, tipo_documento, note)
  values
    (p_entity_id, 'entrata', p_importo, coalesce(p_data, oggi_a_roma()), v_in, 'banca',
     'non_documentato', coalesce(p_nota, 'Versamento dalla cassa'));

  return v_movimento;
end;
$function$;


CREATE OR REPLACE FUNCTION public.pareggia_anticipazione(p_anticipazione_id uuid, p_data date DEFAULT oggi_a_roma())
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    raise exception 'Nel cassetto risultano %: non bastano per rimborsarne %.',
      euro(v_cassa), euro(a.importo);
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
    (a.entity_id, 'uscita', a.importo, coalesce(p_data, oggi_a_roma()), v_causale, 'cassa',
     -- Il `case` produce `text`, la colonna e' un enum: senza cast Postgres
     -- si ferma. Meglio qui che scoprirlo al primo rimborso vero.
     (case when a.documento_riferimento is null then 'non_documentato' else 'scontrino' end)::cash_document_type,
     a.documento_riferimento,
     'Rimborso al titolare — ' || coalesce(v_tag, 'senza tag')
       || coalesce(': ' || a.nota, ''))
  returning id into v_movimento;

  update anticipazioni_socio
     set pareggiata_il = coalesce(p_data, oggi_a_roma()),
         movimento_id  = v_movimento
   where id = p_anticipazione_id;

  return v_movimento;
end;
$function$;


CREATE OR REPLACE FUNCTION public.saldo_anticipazioni(p_entity_id uuid)
 RETURNS TABLE(ti_deve numeric, note_aperte integer, piu_vecchia_il date, totale_anno numeric, avvertenza text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
     and extract(year from a.pagata_il) = extract(year from oggi_a_roma());

  return query select
    v_deve, v_n, v_da, v_anno,
    (case when v_n = 0 then 'Nessuna nota aperta: la societa'' non ti deve niente.'
          else 'In questo momento la societa'' ti deve ' || euro(v_deve) || ' euro.'
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


CREATE OR REPLACE FUNCTION public.pos_in_transito(p_entity_id uuid)
 RETURNS TABLE(lordo numeric, mance numeric, commissioni numeric, netto_atteso numeric, conti integer, avvertenza text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_giorni integer;
  v_comm   numeric;
  v_lordo  numeric;
  v_mance  numeric;
  v_conti  integer;
  v_da     date;
begin
  if not is_titolare() then
    raise exception 'I saldi sono riservati al titolare.';
  end if;

  select i.giorni_accredito_pos, i.commissione_pos_percento
    into v_giorni, v_comm
    from impostazioni_tesoreria i where i.entity_id = p_entity_id;

  v_da := case when v_giorni is null then null else oggi_a_roma() - v_giorni end;

  -- ⚠️ Le QUOTE con carta, non i conti «chiusi con carta»: un conto pagato
  -- meta' e meta' portava zero al POS, e il giorno dell'accredito la
  -- banca avrebbe versato una cifra che il gestionale non aspettava.
  select coalesce(sum(p.importo), 0), count(distinct p.order_id)
    into v_lordo, v_conti
    from order_payments p
    join orders o on o.id = p.order_id
   where o.entity_id = p_entity_id
     and o.status in ('chiuso', 'omaggiato')
     and p.mezzo = 'carta'
     and (v_da is null or (o.closed_at at time zone 'Europe/Rome')::date >= v_da);

  select coalesce(sum(tc.amount), 0) into v_mance
    from tips_collected tc
   where tc.entity_id = p_entity_id
     and tc.mezzo = 'carta'
     and (v_da is null or tc.collected_date >= v_da);

  return query select
    v_lordo,
    v_mance,
    case when v_comm is null then null else round((v_lordo + v_mance) * v_comm / 100, 2) end,
    case when v_comm is null then null else round((v_lordo + v_mance) * (100 - v_comm) / 100, 2) end,
    v_conti,
    (case when v_giorni is null
          then 'Non so in quanti giorni accredita la banca, quindi qui c''e'' TUTTO l''incassato con carta, anche quello gia'' arrivato. '
          else 'Incassi con carta degli ultimi ' || v_giorni || ' giorni. ' end)
    || (case when v_comm is null
             then 'E l''importo e'' LORDO: non so quanto trattiene di commissione. Impostali quando la banca risponde (domanda B2).'
             else 'Al netto della commissione del ' || trim(to_char(v_comm, 'FM990.99')) || '%.' end)
    || (case when v_mance > 0
             then ' Comprende ' || euro(v_mance)
                  || ' euro di mance: la banca accredita anche quelle, ma non sono ricavi tuoi.'
             else '' end);
end;
$function$;


CREATE OR REPLACE FUNCTION public.conti_da_fiscalizzare(p_entity_id uuid, p_dal date DEFAULT NULL::date, p_al date DEFAULT NULL::date)
 RETURNS TABLE(order_id uuid, chiuso_il timestamp with time zone, tavolo text, incasso numeric, pagamento text, stato text, coperti integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_dal date := coalesce(p_dal, date_trunc('month', oggi_a_roma())::date);
  v_al  date := coalesce(p_al, oggi_a_roma());
begin
  if not is_titolare() then
    raise exception 'La quadratura fiscale e'' riservata al titolare.';
  end if;

  return query
  select o.id, o.closed_at, o.table_label,
         coalesce(d.collected_amount, t.totale),
         coalesce(o.payment_method::text, 'non indicato'),
         coalesce(o.documento_fiscale, 'da dire'),
         o.coperti
    from orders o
    left join discounts_gifts d on d.id = o.discount_gift_id
    cross join lateral totale_conto(o.id) t
   where o.entity_id = p_entity_id
     and o.status in ('chiuso', 'omaggiato')
     and serata_di_servizio(o.closed_at) between v_dal and v_al
     and coalesce(d.collected_amount, t.totale) > 0
     and (o.documento_fiscale is null or o.documento_fiscale = 'fattura_da_emettere')
   order by o.closed_at desc;
end;
$function$;


CREATE OR REPLACE FUNCTION public.quadratura_fiscale(p_entity_id uuid, p_dal date DEFAULT NULL::date, p_al date DEFAULT NULL::date)
 RETURNS TABLE(incassato numeric, fiscalizzato numeric, da_fiscalizzare numeric, quanti_da_fare integer, fatture_da_emettere numeric, quante_fatture integer, dal date, al date, avvertenza text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_dal date := coalesce(p_dal, date_trunc('month', oggi_a_roma())::date);
  v_al  date := coalesce(p_al, oggi_a_roma());
begin
  if not is_titolare() then
    raise exception 'La quadratura fiscale e'' riservata al titolare.';
  end if;

  return query
  with conti as (
    select o.documento_fiscale,
           coalesce(d.collected_amount, t.totale) as incasso
      from orders o
      left join discounts_gifts d on d.id = o.discount_gift_id
      cross join lateral totale_conto(o.id) t
     where o.entity_id = p_entity_id
       and o.status in ('chiuso', 'omaggiato')
       and serata_di_servizio(o.closed_at) between v_dal and v_al
  ),
  reali as (select * from conti where incasso > 0)
  select
    coalesce((select sum(incasso) from reali), 0),
    coalesce((select sum(incasso) from reali
               where documento_fiscale in ('scontrino', 'fattura')), 0),
    coalesce((select sum(incasso) from reali
               where documento_fiscale is null or documento_fiscale = 'fattura_da_emettere'), 0),
    coalesce((select count(*) from reali
               where documento_fiscale is null or documento_fiscale = 'fattura_da_emettere'), 0)::integer,
    coalesce((select sum(incasso) from reali where documento_fiscale = 'fattura_da_emettere'), 0),
    coalesce((select count(*) from reali where documento_fiscale = 'fattura_da_emettere'), 0)::integer,
    v_dal, v_al,
    -- Il numero e il suo limite viaggiano insieme.
    (case
       when (select count(*) from reali) = 0 then
         'Nessun conto incassato nel periodo.'
       when (select count(*) from reali
              where documento_fiscale is null or documento_fiscale = 'fattura_da_emettere') = 0 then
         'Tutti i conti incassati del periodo hanno il loro documento.'
       else
         (select count(*) from reali
           where documento_fiscale is null or documento_fiscale = 'fattura_da_emettere')
         || ' conti incassati non hanno ancora un documento fiscale. Restano in elenco finche'' non lo emetti: non spariscono da soli.'
     end)
    || ' Gli omaggi non sono contati: non incassano niente, quindi non c''e'' corrispettivo da emettere.'
    || (case
          when exists (select 1 from reali where documento_fiscale = 'scontrino') then ''
          else ' Finche'' non c''e'' il registratore telematico nessuno scontrino puo'' essere battuto, quindi e'' normale che qui risulti tutto da fare.'
        end);
end;
$function$;


CREATE OR REPLACE FUNCTION public.scarichi_senza_ricavo(p_entity_id uuid, p_dal date DEFAULT NULL::date, p_al date DEFAULT NULL::date)
 RETURNS TABLE(motivo text, quante integer, costo numeric, senza_costo integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_dal date := coalesce(p_dal, date_trunc('month', oggi_a_roma())::date);
  v_al  date := coalesce(p_al, oggi_a_roma());
begin
  if not is_titolare() then
    raise exception 'I costi sono riservati al titolare.';
  end if;

  return query
  select sc.reason,
         count(*)::integer,
         coalesce(sum(sc.costo), 0),
         -- ⚠️ Le righe senza costo si contano invece di essere sommate a
         -- zero: uno scarico registrato prima del 16/08 non ha il costo, e
         -- uno zero al posto suo direbbe «non e' costato niente».
         count(*) filter (where sc.costo is null)::integer
    from stock_consumptions sc
   where sc.order_id is null
     and sc.produzione_id is null
     and sc.created_at::date between v_dal and v_al
     and exists (select 1 from ingredients i
                  where i.id = sc.ingredient_id and i.entity_id = p_entity_id)
   group by sc.reason
   order by coalesce(sum(sc.costo), 0) desc;
end;
$function$;


CREATE OR REPLACE FUNCTION public.misure_del_mese(p_entity_id uuid, p_anno integer, p_mese integer)
 RETURNS TABLE(coperti numeric, ricavi numeric, food_cost numeric, fissi numeric, omaggi_costo numeric, omaggi_quanti integer, conti_chiusi integer, origine_coperti text, origine_ricavi text, origine_food_cost text, origine_fissi text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_dal  date;
  v_al   date;
  v_cop  numeric;
  v_ric  numeric;
  v_fc   numeric;
  v_fis  numeric;
  v_conti integer;
  v_causali_marcate integer;
begin
  if not is_titolare() then
    raise exception 'I numeri del mese sono riservati al titolare.';
  end if;

  v_dal := make_date(p_anno, p_mese, 1);
  v_al  := (v_dal + interval '1 month')::date;

  -- I conti chiusi del mese: pagati e omaggiati. Un conto annullato non
  -- e' un mese andato male, e' un tavolo che non ha mangiato.
  select count(*) into v_conti
    from orders o
   where o.entity_id = p_entity_id
     and o.status in ('chiuso', 'omaggiato')
     and serata_di_servizio(o.closed_at) >= v_dal and serata_di_servizio(o.closed_at) < v_al;

  select coalesce(sum(o.coperti), 0) into v_cop
    from orders o
   where o.entity_id = p_entity_id
     and o.status in ('chiuso', 'omaggiato')
     and serata_di_servizio(o.closed_at) >= v_dal and serata_di_servizio(o.closed_at) < v_al;

  -- ⚠️ I ricavi sono quello che e' stato INCASSATO, non quello che il
  -- conto valeva: un omaggio vale come il piatto ma incassa zero, e uno
  -- sconto incassa meno. Prenderne il valore pieno gonfierebbe i ricavi
  -- proprio nei mesi in cui si e' regalato di piu'.
  select coalesce(sum(
           case
             when o.discount_gift_id is not null
               then coalesce((select dg.collected_amount from discounts_gifts dg where dg.id = o.discount_gift_id), 0)
             else (select t.totale from totale_conto(o.id) t)
           end), 0)
    into v_ric
    from orders o
   where o.entity_id = p_entity_id
     and o.status in ('chiuso', 'omaggiato')
     and serata_di_servizio(o.closed_at) >= v_dal and serata_di_servizio(o.closed_at) < v_al;

  -- Il food cost vero: quanto e' costata la merce uscita dalla cella per
  -- quei conti. Con il Ricettario vuoto questo resta zero, ed e' proprio
  -- il caso in cui non va scritto zero.
  select coalesce(sum(sc.costo), 0) into v_fc
    from stock_consumptions sc
    join orders o on o.id = sc.order_id
   where o.entity_id = p_entity_id
     and o.status in ('chiuso', 'omaggiato')
     and serata_di_servizio(o.closed_at) >= v_dal and serata_di_servizio(o.closed_at) < v_al;

  select count(*) into v_causali_marcate from cash_causali where conta_nei_fissi and active;
  select coalesce(sum(cm.amount), 0) into v_fis
    from cash_movements cm
    join cash_causali cc on cc.id = cm.causale_id
   where cm.entity_id = p_entity_id
     and cm.direction = 'uscita'
     and cc.conta_nei_fissi
     and cm.movement_date >= v_dal and cm.movement_date < v_al;

  return query select
    case when v_conti > 0 then v_cop end,
    case when v_conti > 0 then v_ric end,
    case when v_fc > 0 then v_fc end,
    case when v_causali_marcate > 0 then v_fis end,
    coalesce((select sum(dg.costo_ingredienti) from discounts_gifts dg
               where dg.entity_id = p_entity_id and dg.type = 'omaggio'
                 and dg.movement_date >= v_dal and dg.movement_date < v_al), 0),
    coalesce((select count(*)::integer from discounts_gifts dg
               where dg.entity_id = p_entity_id and dg.type = 'omaggio'
                 and dg.movement_date >= v_dal and dg.movement_date < v_al), 0),
    v_conti,
    case when v_conti > 0 then 'misurato' else 'assente' end,
    case when v_conti > 0 then 'misurato' else 'assente' end,
    case when v_fc > 0   then 'misurato' else 'assente' end,
    case when v_causali_marcate > 0 then 'misurato' else 'assente' end;
end;
$function$;


CREATE OR REPLACE FUNCTION public.ricavi_non_fiscalizzati(p_entity_id uuid, p_anno integer)
 RETURNS TABLE(importo numeric, conti integer, promesse numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not is_titolare() then
    raise exception 'I numeri fiscali sono riservati al titolare.';
  end if;

  return query
  with conti_anno as (
    select o.documento_fiscale,
           coalesce(d.collected_amount, t.totale) as incasso
      from orders o
      left join discounts_gifts d on d.id = o.discount_gift_id
      cross join lateral totale_conto(o.id) t
     where o.entity_id = p_entity_id
       and o.status in ('chiuso', 'omaggiato')
       and extract(year from serata_di_servizio(o.closed_at)) = p_anno
  ),
  sospesi as (
    select * from conti_anno
     where incasso > 0
       and (documento_fiscale is null or documento_fiscale = 'fattura_da_emettere')
  )
  select coalesce((select sum(incasso) from sospesi), 0),
         coalesce((select count(*) from sospesi), 0)::integer,
         coalesce((select sum(incasso) from sospesi
                    where documento_fiscale = 'fattura_da_emettere'), 0);
end;
$function$;


CREATE OR REPLACE FUNCTION public.registra_conteggio_cassa(p_entity_id uuid, p_contato numeric, p_data date DEFAULT serata_di_servizio(), p_nota text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  values (p_entity_id, coalesce(p_data, serata_di_servizio()), v_teorico, p_contato, v_diff, p_nota, auth.uid())
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
       coalesce(p_data, serata_di_servizio()),
       v_causale,
       'cassa',
       'non_documentato',
       'Differenza rilevata contando il cassetto il '
         || to_char(coalesce(p_data, serata_di_servizio()), 'DD/MM/YYYY')
         || coalesce('. ' || p_nota, ''))
    returning id into v_movimento;

    update conteggi_cassa set movimento_id = v_movimento where id = v_conteggio;
  end if;

  return v_conteggio;
end;
$function$;


-- ---------------------------------------------------------------------
-- 5 · La rete: chi decide ancora la data a Greenwich
-- ---------------------------------------------------------------------
-- ⚠️ L'elenco se lo costruisce il database a ogni esecuzione, come la rete
-- del corridoio e quella delle funzioni aperte ad anon: una funzione nuova
-- che usasse current_date fa diventare rossa una prova **senza che nessuno
-- si sia ricordato di aggiornare un elenco**.
-- ⚠️ E toglie i commenti prima di guardare: nel censimento del 19/08 uno dei
-- diciotto punti era la parola «current_date» dentro un commento.
create or replace function funzioni_con_data_utc()
returns table (nome text)
language sql
stable
security definer
set search_path = public
as $$
  select p.proname::text
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prokind = 'f'
     -- ⚠️ LA RETE NON PUÒ GUARDARE SE STESSA, e va detto invece che
     -- scoperto: questa funzione contiene la parola che cerca, quindi si
     -- accuserebbe da sola. È la stessa forma della sentinella dei lavori,
     -- che non sorveglia se stessa perché un testimone non testimonia della
     -- propria assenza (12/08).
     and p.proname <> 'funzioni_con_data_utc'
     and regexp_replace(pg_get_functiondef(p.oid), '--[^' || chr(10) || ']*', '', 'g')
         ilike '%current_date%'
   order by p.proname;
$$;

revoke all on function funzioni_con_data_utc() from public, anon;
grant execute on function funzioni_con_data_utc() to authenticated;

-- ---------------------------------------------------------------------
-- VERIFICA
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_ora    time;
  v_g      date;
  v_conta  integer;
  v_nomi   text;
begin
  select ora_fine_serata into v_ora from service_settings where id = 1;
  if v_ora is null then
    raise exception 'Manca l''ora di fine serata: la regola non ha un confine.';
  end if;

  -- =========== I BORDI, che sono l'unico posto dove la regola cambia ===========
  -- ⚠️ Le 04:59 e le 05:01 devono dire due giorni DIVERSI: e' la prova che
  -- puo' fallire. Con un confine a mezzanotte direbbero lo stesso giorno.
  if serata_di_servizio(timestamptz '2026-08-22 00:30+02') <> date '2026-08-21' then
    raise exception 'Un incasso alle 00:30 non cade sulla serata precedente.';
  end if;
  if serata_di_servizio(timestamptz '2026-08-22 04:59+02') <> date '2026-08-21' then
    raise exception 'Le 04:59 non cadono sulla serata precedente.';
  end if;
  if serata_di_servizio(timestamptz '2026-08-22 05:01+02') <> date '2026-08-22' then
    raise exception 'Le 05:01 non cadono sul giorno nuovo.';
  end if;
  if serata_di_servizio(timestamptz '2026-08-22 05:30+02') <> date '2026-08-22' then
    raise exception 'Le 05:30 non cadono sul giorno nuovo.';
  end if;
  -- Le 23:00 e l'01:00 della stessa notte sono la STESSA serata.
  if serata_di_servizio(timestamptz '2026-08-21 23:00+02')
     <> serata_di_servizio(timestamptz '2026-08-22 01:00+02') then
    raise exception 'Le 23:00 e l''01:00 della stessa notte finiscono su due serate diverse.';
  end if;

  -- =========== IL FUSO, che e' l'altra meta' ===========
  -- ⚠️ L'ISTANTE E' SCELTO DOVE I DUE FUSI DANNO DUE SERATE DIVERSE, che e'
  -- l'unico modo di provare il fuso: le 03:30 di Greenwich sono le 05:30
  -- italiane, cioe' gia' il giorno nuovo. Leggendo l'ora di Greenwich
  -- sarebbero le 03:30, cioe' ancora la serata prima — e questo controllo
  -- diventerebbe rosso. Un istante qualunque non discriminerebbe niente.
  if serata_di_servizio(timestamptz '2026-08-22 03:30Z') <> date '2026-08-22' then
    raise exception 'Il fuso non e'' quello di Roma: le 05:30 italiane cadono sulla serata sbagliata.';
  end if;
  if oggi_a_roma() <> (now() at time zone 'Europe/Rome')::date then
    raise exception 'oggi_a_roma() non dice il giorno di Roma.';
  end if;

  -- =========== LE NOTTI DEL CAMBIO DELL'ORA ===========
  -- ⚠️ L'ultima domenica di marzo le 02:00 non esistono, l'ultima di ottobre
  -- le 02:30 capitano due volte. Con il confine alle 5 nessuna delle due
  -- tocca la regola — ma e' precisamente il genere di cosa che si scopre
  -- l'anno dopo, e metterci una prova adesso e' gratis.
  -- 29/03/2026: alle 01:30 (ancora ora solare) e' la serata del 28.
  if serata_di_servizio(timestamptz '2026-03-29 00:30+01') <> date '2026-03-28' then
    raise exception 'Notte del cambio d''ora (marzo): l''01:30 non cade sulla serata del 28.';
  end if;
  -- ...e alle 04:30 (ora legale, dopo il salto) e' ancora la serata del 28.
  if serata_di_servizio(timestamptz '2026-03-29 04:30+02') <> date '2026-03-28' then
    raise exception 'Notte del cambio d''ora (marzo): le 04:30 non cadono sulla serata del 28.';
  end if;
  -- 25/10/2026: le 02:30 capitano due volte, e TUTTE E DUE sono la serata
  -- del 24. Se non fosse cosi', un incasso finirebbe su un giorno e uno
  -- fatto un'ora dopo su un altro.
  if serata_di_servizio(timestamptz '2026-10-25 02:30+02') <> date '2026-10-24'
     or serata_di_servizio(timestamptz '2026-10-25 02:30+01') <> date '2026-10-24' then
    raise exception 'Notte del cambio d''ora (ottobre): le due 02:30 non cadono sulla stessa serata.';
  end if;

  -- =========== I NOVE PUNTI IN UTC NON CI SONO PIU' ===========
  -- ⚠️ Si guarda il database, non il testo delle migrazioni, e si tolgono i
  -- commenti: un censimento che conta le parole dentro i commenti gonfia il
  -- problema (lezione del censimento stesso, 19/08).
  select count(*), string_agg(proname, ', ' order by proname)
    into v_conta, v_nomi
    from (
      select p.proname
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.prokind = 'f'
         and p.proname <> 'funzioni_con_data_utc'   -- la rete non guarda se stessa
         and regexp_replace(pg_get_functiondef(p.oid), '--[^' || chr(10) || ']*', '', 'g')
             ilike '%current_date%'
    ) x;
  if v_conta <> 0 then
    raise exception 'Restano % funzioni che decidono la data sull''orario di Greenwich: %.', v_conta, v_nomi;
  end if;

  select count(*), string_agg(table_name || '.' || column_name, ', ' order by table_name)
    into v_conta, v_nomi
    from information_schema.columns
   where table_schema = 'public' and column_default ilike '%current_date%';
  if v_conta <> 0 then
    raise exception 'Restano % colonne col predefinito in UTC: %.', v_conta, v_nomi;
  end if;

  -- =========== E I DUE GESTI PRENDONO LA SERATA ===========
  if (select column_default from information_schema.columns
       where table_schema = 'public' and table_name = 'conteggi_cassa'
         and column_name = 'contato_il') not like '%serata_di_servizio%' then
    raise exception 'Il conteggio del cassetto non prende la serata.';
  end if;
  if (select pg_get_functiondef(p.oid) from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'quadratura_fiscale')
     not like '%serata_di_servizio%' then
    raise exception 'La quadratura fiscale non data i conti sulla serata.';
  end if;
  if (select pg_get_functiondef(p.oid) from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'conti_da_fiscalizzare')
     not like '%serata_di_servizio%' then
    raise exception 'I conti da fiscalizzare non sono datati sulla serata.';
  end if;

  -- ⚠️ E il resto NON deve averla presa: il perimetro e' stretto apposta.
  if (select pg_get_functiondef(p.oid) from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'pay_supplier_invoice')
     like '%serata_di_servizio%' then
    raise exception 'Il pagamento di una fattura segue la serata: il perimetro si e'' allargato da solo.';
  end if;
  if (select column_default from information_schema.columns
       where table_schema = 'public' and table_name = 'deductible_expenses'
         and column_name = 'expense_date') like '%serata%' then
    raise exception 'Una spesa deducibile segue la serata: il perimetro si e'' allargato da solo.';
  end if;

  raise notice 'Giornata operativa: una funzione sola, bordi a 00:30/04:59/05:01 e notti del cambio d''ora, zero punti rimasti in UTC, e il perimetro stretto ai due gesti.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260819000006', 'a_quale_giornata_appartiene_questo_istante')
on conflict (version) do nothing;
