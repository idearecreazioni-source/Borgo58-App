-- =====================================================================
-- GLI EVENTI NEI MESI CONGELATI E NELLA CHIUSURA DELL'ANNO (14/11/2026)
-- =====================================================================
--
-- Alessio, 14/11: «sì, aggiungile» — le fatture degli eventi (senza tavolo)
-- entrano anche nei mesi congelati e nella chiusura dell'anno. Il disegno è
-- stato rivisto da ecc:database-reviewer prima di scrivere codice
-- («vai con modifiche»): le modifiche sono fatte.
--
-- COSA ENTRA
--   1. `misure_del_mese` dà anche `imponibile_eventi` e `imposta_eventi`
--      (quelli congelati all'emissione) e conta le fatture NUMERATE, SENZA
--      TAVOLO, NON SCARTATE: «da inviare» conta (ha il suo numero e sta per
--      partire); una scartata no finché non si rimanda; una bozza non ha numero.
--   2. `consuntivi_mensili` e `chiusure_annuali` hanno tre colonne nuove, VUOTE
--      per i mesi congelati prima di oggi (vuoto = «non registrato», non zero):
--      `ricavi_eventi`, `eventi_quanti`, `imposta_eventi`. Si aggiungono e non
--      si riscrive niente: aggiungere una colonna non è un UPDATE, quindi il
--      blocco dei consuntivi non scatta.
--   3. `chiudi_mese` e `chiudi_anno` le scrivono. E SI RIFIUTANO se nel periodo
--      c'è una fattura di evento «da inviare» o scartata: entrerebbe nei
--      numeri DOPO la foto, che non si rifà.
--   4. `misure_dell_anno` somma gli eventi: dalla foto del mese se li ha, dal
--      vivo se il mese è stato fotografato prima di oggi (una fattura ha
--      totale e data che non cambiano).
--
-- COSA NON ENTRA, e va detto
--   · La STIMA DELLE IMPOSTE a fine anno non cambia di un euro. Gli eventi
--     previsti stanno nel piano «come previsti» perché nessuno li misurava:
--     sostituirli con quelli veri vorrebbe un margine che le fatture non
--     hanno (il piano ha il suo costo per ogni linea). Il revisore l'ha
--     sconsigliato; si propone ad Alessio a parte.
--   · `ricavi` (di sala) non cambia: né scontrino medio né confronto col piano.
--
-- Le funzioni che cambiano le colonne restituite si eliminano e si ricreano,
-- SENZA «cascade»: se qualcosa le usasse in modo nascosto, la migrazione si
-- fermerebbe invece di tacere. I permessi si rimettono qui sotto.
--
-- Idempotente. Si auto-registra. Verifica annullata, zero residui.

-- ---------------------------------------------------------------------
-- 1. LE COLONNE NUOVE (vuote per ciò che è già stato congelato)
-- ---------------------------------------------------------------------
alter table consuntivi_mensili add column if not exists ricavi_eventi  numeric;
alter table consuntivi_mensili add column if not exists eventi_quanti  integer;
alter table consuntivi_mensili add column if not exists imposta_eventi numeric;
alter table chiusure_annuali   add column if not exists ricavi_eventi  numeric;
alter table chiusure_annuali   add column if not exists eventi_quanti  integer;
alter table chiusure_annuali   add column if not exists imposta_eventi numeric;

comment on column consuntivi_mensili.ricavi_eventi is
  'Ricavi degli eventi (fatture ai clienti senza tavolo, totale IVA compresa) del mese al momento della foto. VUOTO per i mesi fotografati prima del 14/11/2026: vuol dire «non registrato», non zero.';
comment on column consuntivi_mensili.imposta_eventi is
  'L''IVA di quelle fatture, come congelata all''emissione. Vuoto come ricavi_eventi per i mesi vecchi.';
comment on column chiusure_annuali.ricavi_eventi is
  'Ricavi degli eventi dell''anno al momento della chiusura (vuoto per le chiusure fatte prima del 14/11/2026).';
comment on column chiusure_annuali.imposta_eventi is
  'L''IVA delle fatture degli eventi dell''anno, come congelata all''emissione.';

-- ---------------------------------------------------------------------
-- 2. LE FUNZIONI
-- ---------------------------------------------------------------------
drop function public.misure_del_mese(uuid, integer, integer);
drop function public.misure_dell_anno(uuid, integer);


CREATE FUNCTION public.misure_del_mese(p_entity_id uuid, p_anno integer, p_mese integer)
 RETURNS TABLE(coperti numeric, ricavi numeric, food_cost numeric, fissi numeric, omaggi_costo numeric, omaggi_quanti integer, conti_chiusi integer, origine_coperti text, origine_ricavi text, origine_food_cost text, origine_fissi text, ricavi_eventi numeric, eventi_quanti integer, imponibile_eventi numeric, imposta_eventi numeric)
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
  v_fatt  numeric;
  v_fatture integer;
  v_fimp  numeric;
  v_fiva  numeric;
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

  -- 🔴 GLI EVENTI SI CONTANO A PARTE (14/11/2026, deciso da Alessio: «gli
  --    eventi si contano con gli eventi, non con lo scontrino medio dei
  --    normali servizi»). Le fatture ai clienti SENZA tavolo (un evento, un
  --    catering) sono qui nella colonna `ricavi_eventi`, alla data della
  --    fattura e col totale, e NON nei `ricavi`: i `ricavi` restano quelli
  --    dei conti di sala, e con loro lo scontrino medio, il confronto col
  --    piano e i mesi congelati.
  --    ⚠️ SOLO senza tavolo: la fattura di un conto è già il conto.
  -- ⚠️ QUALI FATTURE: numerate, senza tavolo, e NON scartate (14/11/2026,
  --    revisione): una scartata non è valida finché non si rimanda, e una
  --    bozza non ha numero. «Da inviare» conta: ha il suo numero e sta per
  --    partire. Totale, imponibile e IVA sono quelli congelati all'emissione.
  select coalesce(sum(fe.totale), 0), count(*), coalesce(sum(fe.imponibile), 0), coalesce(sum(fe.imposta), 0)
    into v_fatt, v_fatture, v_fimp, v_fiva
    from fatture_emesse fe
   where fe.entity_id = p_entity_id
     and fe.order_id is null
     and fe.numero is not null
     and fe.stato in ('da_inviare', 'inviata', 'consegnata', 'messa_a_disposizione')
     and fe.data >= v_dal and fe.data < v_al;

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
    case when v_causali_marcate > 0 then 'misurato' else 'assente' end,
    v_fatt, v_fatture, v_fimp, v_fiva;
end;
$function$;


comment on function misure_del_mese(uuid, integer, integer) is
  'I numeri veri di un mese: coperti, ricavi incassati dai conti dei tavoli (con cui si calcolano lo scontrino medio e il confronto col piano), food cost, fissi, omaggi; e, a parte, gli eventi (fatture ai clienti senza tavolo, numerate e non scartate: totale, conteggio, imponibile e IVA). Solo il titolare.';
revoke all on function misure_del_mese(uuid, integer, integer) from public, anon, authenticated;
grant execute on function misure_del_mese(uuid, integer, integer) to authenticated;

-- chiudi_mese: ripresa da 20260816000009 con le tre colonne e il fermo.
create or replace function chiudi_mese(p_entity_id uuid, p_anno integer, p_mese integer, p_note text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  m        record;
  v_id     uuid;
  v_prec   integer;
  v_prima  timestamptz;
begin
  if not is_titolare() then
    raise exception 'Chiudere un mese e'' riservato al titolare.';
  end if;

  if make_date(p_anno, p_mese, 1) + interval '1 month' > now() then
    raise exception 'Il % non e'' ancora finito: un consuntivo si scrive a mese chiuso, e non si potrebbe piu'' rifare.',
      to_char(make_date(p_anno, p_mese, 1), 'MM/YYYY');
  end if;

  if exists (select 1 from consuntivi_mensili
              where entity_id = p_entity_id and anno = p_anno and mese = p_mese) then
    raise exception 'Il % e'' gia'' stato chiuso.', to_char(make_date(p_anno, p_mese, 1), 'MM/YYYY');
  end if;

  -- ⚠️ Quante volte questo stesso mese e' gia' stato fotografato e poi
  -- cancellato. Si legge dal registro delle cancellazioni invece di
  -- tenere un contatore da qualche parte: la verita' sta gia' li', e un
  -- contatore separato sarebbe un secondo posto da tenere allineato.
  select count(*), min((record->>'chiuso_il')::timestamptz)
    into v_prec, v_prima
    from deleted_records
   where table_name = 'consuntivi_mensili'
     and record->>'entity_id' = p_entity_id::text
     and (record->>'anno')::integer = p_anno
     and (record->>'mese')::integer = p_mese;

  -- 🔴 UN MESE NON SI CONGELA CON UNA FATTURA DI EVENTO ANCORA IN SOSPESO
  --    (14/11/2026, revisione): una fattura senza tavolo «da inviare» o
  --    scartata datata in questo mese entrerebbe nei numeri dopo la foto, e
  --    la foto non si riscrive. Prima si manda o si corregge.
  if exists (
    select 1 from fatture_emesse fe
     where fe.entity_id = p_entity_id and fe.order_id is null and fe.numero is not null
       and fe.stato in ('da_inviare', 'scartata')
       and fe.data >= make_date(p_anno, p_mese, 1)
       and fe.data < (make_date(p_anno, p_mese, 1) + interval '1 month')::date
  ) then
    raise exception 'Ci sono fatture del % ancora da mandare o scartate dallo SdI: mandale o correggile prima di chiudere il mese, perche'' la fotografia non si rifa''.',
      to_char(make_date(p_anno, p_mese, 1), 'MM/YYYY');
  end if;

  select * into m from misure_del_mese(p_entity_id, p_anno, p_mese);

  insert into consuntivi_mensili (
    entity_id, anno, mese, chiuso_da,
    coperti, ricavi, food_cost, fissi, omaggi_costo, omaggi_quanti, conti_chiusi,
    origine_coperti, origine_ricavi, origine_food_cost, origine_fissi, note,
    chiusure_precedenti, prima_chiusura_il,
    ricavi_eventi, eventi_quanti, imposta_eventi
  ) values (
    p_entity_id, p_anno, p_mese, auth.uid(),
    m.coperti, m.ricavi, m.food_cost, m.fissi, m.omaggi_costo, m.omaggi_quanti, m.conti_chiusi,
    m.origine_coperti, m.origine_ricavi, m.origine_food_cost, m.origine_fissi, p_note,
    coalesce(v_prec, 0), v_prima,
    m.ricavi_eventi, m.eventi_quanti, m.imposta_eventi
  ) returning id into v_id;

  return v_id;
end;
$function$;

revoke all on function chiudi_mese(uuid, integer, integer, text) from public, anon, authenticated;
grant execute on function chiudi_mese(uuid, integer, integer, text) to authenticated;

-- misure_dell_anno: ripresa da 20260923000003 con gli eventi.
create or replace function misure_dell_anno(p_entity_id uuid, p_anno integer)
returns table (
  coperti                 numeric,
  ricavi                  numeric,
  food_cost               numeric,
  fissi                   numeric,
  omaggi_costo            numeric,
  omaggi_quanti           integer,
  conti_chiusi            integer,
  origine_coperti         text,
  origine_ricavi          text,
  origine_food_cost       text,
  origine_fissi           text,
  mesi_fotografati        integer,
  conti_senza_documento   integer,
  incasso_senza_documento numeric,
  anno_finito             boolean,
  ricavi_eventi           numeric,
  eventi_quanti           integer,
  imposta_eventi          numeric
)
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  i       integer;
  c       record;
  m       record;
  v_cop numeric := 0; v_ric numeric := 0; v_fc numeric := 0; v_fis numeric := 0;
  n_cop integer := 0; n_ric integer := 0; n_fc integer := 0; n_fis integer := 0;
  v_omc numeric := 0; v_omq integer := 0; v_conti integer := 0;
  v_foto integer := 0;
  v_er numeric := 0; v_eq integer := 0; v_ei numeric := 0;
  v_senza_n integer := 0;
  v_senza_e numeric := 0;
  -- cosa dice il mese: valore e origine
  x_cop numeric; x_ric numeric; x_fc numeric; x_fis numeric;
  o_cop text;    o_ric text;    o_fc text;    o_fis text;
begin
  -- ⚠️ RIFIUTA, non filtra: un filtro nella `where` risponderebbe un
  --    elenco vuoto a chi non deve vedere, e un elenco vuoto si legge
  --    «non c'e' niente» — una rassicurazione falsa (27/08).
  if not is_titolare() then
    raise exception 'I numeri dell''anno sono riservati al titolare.';
  end if;

  for i in 1..12 loop
    select * into c from consuntivi_mensili
     where entity_id = p_entity_id and anno = p_anno and mese = i;

    if c.id is not null then
      v_foto := v_foto + 1;
      x_cop := c.coperti; x_ric := c.ricavi; x_fc := c.food_cost; x_fis := c.fissi;
      o_cop := c.origine_coperti; o_ric := c.origine_ricavi;
      o_fc  := c.origine_food_cost; o_fis := c.origine_fissi;
      v_omc := v_omc + coalesce(c.omaggi_costo, 0);
      v_omq := v_omq + coalesce(c.omaggi_quanti, 0);
      v_conti := v_conti + coalesce(c.conti_chiusi, 0);
    else
      select * into m from misure_del_mese(p_entity_id, p_anno, i);
      x_cop := m.coperti; x_ric := m.ricavi; x_fc := m.food_cost; x_fis := m.fissi;
      o_cop := m.origine_coperti; o_ric := m.origine_ricavi;
      o_fc  := m.origine_food_cost; o_fis := m.origine_fissi;
      v_omc := v_omc + coalesce(m.omaggi_costo, 0);
      v_omq := v_omq + coalesce(m.omaggi_quanti, 0);
      v_conti := v_conti + coalesce(m.conti_chiusi, 0);
    end if;

    -- Gli eventi (14/11/2026): dalla foto del mese se li ha registrati, altrimenti
    -- dal vivo (una fattura ha totale e data che non cambiano). I mesi
    -- fotografati prima di oggi restano senza il dato, e qui si leggono lo stesso.
    if c.id is not null and c.ricavi_eventi is not null then
      v_er := v_er + c.ricavi_eventi;
      v_eq := v_eq + coalesce(c.eventi_quanti, 0);
      v_ei := v_ei + coalesce(c.imposta_eventi, 0);
    else
      if c.id is not null then
        select * into m from misure_del_mese(p_entity_id, p_anno, i);
      end if;
      v_er := v_er + coalesce(m.ricavi_eventi, 0);
      v_eq := v_eq + coalesce(m.eventi_quanti, 0);
      v_ei := v_ei + coalesce(m.imposta_eventi, 0);
    end if;

    -- ⚠️ Ogni voce si accumula SOLO nei mesi in cui e' misurata (15/08).
    if o_cop = 'misurato' then v_cop := v_cop + coalesce(x_cop, 0); n_cop := n_cop + 1; end if;
    if o_ric = 'misurato' then v_ric := v_ric + coalesce(x_ric, 0); n_ric := n_ric + 1; end if;
    if o_fc  = 'misurato' then v_fc  := v_fc  + coalesce(x_fc,  0); n_fc  := n_fc  + 1; end if;
    if o_fis = 'misurato' then v_fis := v_fis + coalesce(x_fis, 0); n_fis := n_fis + 1; end if;
  end loop;

  -- 🔴 I CONTI SENZA DOCUMENTO DELL'ANNO. Il perimetro e' la SERATA, non
  --    il calendario: lo decide `conti_senza_documento`, che e' gia' la
  --    regola unica di questa domanda e filtra su serata_di_servizio().
  select count(*)::integer, coalesce(sum(s.incasso), 0)
    into v_senza_n, v_senza_e
    from conti_senza_documento(
           p_entity_id,
           make_date(p_anno, 1, 1),
           make_date(p_anno, 12, 31)) s;

  return query select
    case when n_cop > 0 then v_cop end,
    case when n_ric > 0 then v_ric end,
    case when n_fc  > 0 then v_fc  end,
    case when n_fis > 0 then v_fis end,
    v_omc,
    v_omq,
    v_conti,
    case when n_cop > 0 then 'misurato' else 'assente' end,
    case when n_ric > 0 then 'misurato' else 'assente' end,
    case when n_fc  > 0 then 'misurato' else 'assente' end,
    case when n_fis > 0 then 'misurato' else 'assente' end,
    v_foto,
    v_senza_n,
    v_senza_e,
    -- ⚠️ «L'anno e' finito» si chiede alla SERATA: alle due di notte del
    --    1° gennaio la serata e' ancora il 31 dicembre, e il servizio di
    --    quell'anno non e' ancora chiuso.
    (serata_di_servizio(now()) > make_date(p_anno, 12, 31)),
    v_er, v_eq, v_ei;
end;
$function$;

comment on function misure_dell_anno is
  'Cosa si e'' potuto misurare di un anno, per un soggetto. Cammina i dodici mesi: la fotografia del mese se c''e'', altrimenti la misura dal vivo; e, a parte, gli eventi (dalla foto se li ha, dal vivo altrimenti).';
revoke all on function misure_dell_anno(uuid, integer) from public, anon, authenticated;
grant execute on function misure_dell_anno(uuid, integer) to authenticated;

-- chiudi_anno: ripresa da 20260923000003 con le tre colonne e il fermo.
create or replace function chiudi_anno(
  p_entity_id uuid,
  p_anno integer,
  p_conferma_conti_senza_documento boolean default false,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  m       record;
  v_id    uuid;
  v_prec  integer;
  v_prima timestamptz;
begin
  if not is_titolare() then
    raise exception 'Chiudere un anno e'' riservato al titolare.';
  end if;

  select * into m from misure_dell_anno(p_entity_id, p_anno);

  if not m.anno_finito then
    raise exception 'Il % non e'' ancora finito: una chiusura si scrive ad anno chiuso, e non si potrebbe piu'' rifare. La serata di servizio di adesso e'' il %.',
      p_anno, to_char(serata_di_servizio(now()), 'DD/MM/YYYY');
  end if;

  -- 🔴 NEANCHE UN ANNO SI CONGELA CON UNA FATTURA DI EVENTO IN SOSPESO (14/11/2026).
  if exists (
    select 1 from fatture_emesse fe
     where fe.entity_id = p_entity_id and fe.order_id is null and fe.numero is not null
       and fe.stato in ('da_inviare', 'scartata')
       and fe.data >= make_date(p_anno, 1, 1) and fe.data < make_date(p_anno + 1, 1, 1)
  ) then
    raise exception 'Ci sono fatture del % ancora da mandare o scartate dallo SdI: mandale o correggile prima di chiudere l''anno, perche'' la fotografia non si rifa''.', p_anno;
  end if;

  if exists (select 1 from chiusure_annuali
              where entity_id = p_entity_id and anno = p_anno) then
    raise exception 'Il % e'' gia'' stato chiuso per questo soggetto. Se la fotografia e'' sbagliata si cancella e si richiude: quella nuova dichiarera'' di essere una seconda.', p_anno;
  end if;

  -- 🔴 L'AVVISO, E IL FERMO. Non si chiude in silenzio un anno che lascia
  --    indietro dei conti senza documento: il gestionale dice quanti sono
  --    e quanto valgono, e aspetta che il titolare dichiari di averli visti.
  -- ⚠️ E NON LI TOCCA. Non li riclassifica, non li fiscalizza, non li
  --    sposta di anno. Dove finiscono se vengono regolarizzati dopo e' il
  --    quesito L21, ancora aperto: rispondere qui sarebbe deciderlo.
  if m.conti_senza_documento > 0 and not coalesce(p_conferma_conti_senza_documento, false) then
    raise exception '%, per %. Guardali prima di chiudere: la fotografia non si rifa''. Se vuoi chiudere lo stesso conferma — resteranno esattamente dove sono, e nessuno li spostera''.',
      case when m.conti_senza_documento = 1
           then format('Resta 1 conto del %s senza documento fiscale', p_anno)
           else format('Restano %s conti del %s senza documento fiscale',
                       m.conti_senza_documento, p_anno)
      end,
      euro(m.incasso_senza_documento);
  end if;

  -- ⚠️ Quante volte questo stesso anno e' gia' stato fotografato e poi
  --    cancellato. Si legge dal registro delle cancellazioni invece di
  --    tenere un contatore da qualche parte: la verita' sta gia' li', e un
  --    contatore separato sarebbe un secondo posto da tenere allineato.
  select count(*), min((record->>'chiusa_il')::timestamptz)
    into v_prec, v_prima
    from deleted_records
   where table_name = 'chiusure_annuali'
     and record->>'entity_id' = p_entity_id::text
     and (record->>'anno')::integer = p_anno;

  insert into chiusure_annuali (
    entity_id, anno, chiusa_da,
    coperti, ricavi, food_cost, fissi, omaggi_costo, omaggi_quanti, conti_chiusi,
    origine_coperti, origine_ricavi, origine_food_cost, origine_fissi,
    mesi_fotografati, conti_senza_documento, incasso_senza_documento,
    chiusure_precedenti, prima_chiusura_il, note,
    ricavi_eventi, eventi_quanti, imposta_eventi
  ) values (
    p_entity_id, p_anno, auth.uid(),
    m.coperti, m.ricavi, m.food_cost, m.fissi, m.omaggi_costo, m.omaggi_quanti, m.conti_chiusi,
    m.origine_coperti, m.origine_ricavi, m.origine_food_cost, m.origine_fissi,
    m.mesi_fotografati, m.conti_senza_documento, m.incasso_senza_documento,
    coalesce(v_prec, 0), v_prima, p_note,
    m.ricavi_eventi, m.eventi_quanti, m.imposta_eventi
  ) returning id into v_id;

  return v_id;
end;
$function$;

revoke all on function chiudi_anno(uuid, integer, boolean, text) from public, anon, authenticated;
grant execute on function chiudi_anno(uuid, integer, boolean, text) to authenticated;

-- ---------------------------------------------------------------------
-- VERIFICA — dentro una sotto-transazione che si annulla
-- ---------------------------------------------------------------------
--   (1) bozza e scartata non contano; «da inviare» sì; il tavolo no; totale,
--       imponibile e IVA tornano;
--   (2) un mese con una fattura «da inviare» o scartata non si congela;
--       dopo che è partita si congela e la foto porta gli eventi;
--   (3) la chiusura dell'anno somma: il mese fotografato dalla foto, quello
--       non fotografato e quello fotografato senza il dato dal vivo;
--   (4) i permessi: il titolare sì, da fuori no;
--   (5) la foto non cambia i `ricavi` di sala.
do $verifica$
declare
  v_foto      jsonb := foto_righe();
  v_titolare  uuid;
  v_srls      uuid;
  v_cli       uuid;
  v_f         uuid;
  v_mar       uuid;
  m           record;
  c           record;
  v_ok        boolean;
begin
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  select id into v_srls from entities where entity_type = 'srls' limit 1;
  if v_titolare is null or v_srls is null then
    raise exception 'VERIFICA: servono un titolare e Borgo 58.';
  end if;

  begin  -- <<< la sotto-transazione che verrà annullata
    perform set_config('request.jwt.claims', json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);
    insert into clienti_fattura (denominazione, partita_iva, indirizzo, cap, comune, provincia)
    values ('ZZ Ditta degli eventi due srl', '01234567897', 'Via Prova 10', '84043', 'Agropoli', 'SA')
    returning id into v_cli;

    -- Marzo 1996: una bozza, una scartata, una «da inviare» (250), una per un tavolo.
    insert into fatture_emesse (entity_id, cliente_id, data) values (v_srls, v_cli, date '1996-03-15') returning id into v_mar;
    insert into fatture_emesse_righe (fattura_id, posizione, descrizione, quantita, prezzo_unitario) values (v_mar, 1, 'ZZ Bozza', 1, 999.00);

    insert into fatture_emesse (entity_id, cliente_id, data) values (v_srls, v_cli, date '1996-03-16') returning id into v_f;
    insert into fatture_emesse_righe (fattura_id, posizione, descrizione, quantita, prezzo_unitario) values (v_f, 1, 'ZZ Scartata', 1, 777.00);
    update fatture_emesse set numero = 990001, stato = 'scartata', imponibile = 636.89, imposta = 140.11, totale = 777.00 where id = v_f;

    insert into fatture_emesse (entity_id, cliente_id, data) values (v_srls, v_cli, date '1996-03-17') returning id into v_f;
    insert into fatture_emesse_righe (fattura_id, posizione, descrizione, quantita, prezzo_unitario) values (v_f, 1, 'ZZ Catering', 1, 250.00);
    update fatture_emesse set numero = 990002, stato = 'da_inviare', imponibile = 227.27, imposta = 22.73, totale = 250.00 where id = v_f;

    -- (1) solo la «da inviare» conta
    select * into m from misure_del_mese(v_srls, 1996, 3);
    if m.ricavi_eventi <> 250.00 or m.eventi_quanti <> 1 or m.imponibile_eventi <> 227.27 or m.imposta_eventi <> 22.73 then
      raise exception 'VERIFICA (1): contano bozza o scartata, o i totali non tornano: % % % %', m.ricavi_eventi, m.eventi_quanti, m.imponibile_eventi, m.imposta_eventi;
    end if;
    update fatture_emesse set stato = 'inviata' where numero = 990001 and entity_id = v_srls;  -- la scartata rimandata
    select * into m from misure_del_mese(v_srls, 1996, 3);
    if m.ricavi_eventi <> 1027.00 or m.eventi_quanti <> 2 then
      raise exception 'VERIFICA (1): la scartata rimandata non è entrata: %', m.ricavi_eventi;
    end if;
    update fatture_emesse set stato = 'scartata' where numero = 990001 and entity_id = v_srls;
    update fatture_emesse set stato = 'inviata' where numero = 990002 and entity_id = v_srls;

    -- (2) ma finché la scartata è in sospeso il mese non si congela
    v_ok := false;
    begin
      perform chiudi_mese(v_srls, 1996, 3);
    exception when others then
      v_ok := sqlerrm like 'Ci sono fatture del 03/1996 ancora da mandare o scartate%';
    end;
    if not v_ok then
      raise exception 'VERIFICA (2): un mese con una fattura scartata si è congelato.';
    end if;
    update fatture_emesse set stato = 'inviata' where numero = 990001 and entity_id = v_srls;
    perform chiudi_mese(v_srls, 1996, 3);
    select * into c from consuntivi_mensili where entity_id = v_srls and anno = 1996 and mese = 3;
    if c.ricavi_eventi <> 1027.00 or c.eventi_quanti <> 2 or c.imposta_eventi <> 162.84 then
      raise exception 'VERIFICA (2): la foto non porta gli eventi: % % %', c.ricavi_eventi, c.eventi_quanti, c.imposta_eventi;
    end if;
    -- (5) e i ricavi di sala non si sono mossi
    if coalesce(c.ricavi, 0) <> coalesce((select ricavi from misure_del_mese(v_srls, 1995, 3)), 0) then
      raise exception 'VERIFICA (5): la foto ha messo gli eventi nei ricavi di sala.';
    end if;

    -- (3) aprile (non fotografato, 100) e maggio (fotografato SENZA il dato, 50)
    insert into fatture_emesse (entity_id, cliente_id, data) values (v_srls, v_cli, date '1996-04-10') returning id into v_f;
    insert into fatture_emesse_righe (fattura_id, posizione, descrizione, quantita, prezzo_unitario) values (v_f, 1, 'ZZ Aprile', 1, 100.00);
    update fatture_emesse set numero = 990003, stato = 'consegnata', imponibile = 90.91, imposta = 9.09, totale = 100.00 where id = v_f;
    insert into consuntivi_mensili (entity_id, anno, mese, origine_coperti, origine_ricavi, origine_food_cost, origine_fissi)
    values (v_srls, 1996, 5, 'assente', 'assente', 'assente', 'assente');
    insert into fatture_emesse (entity_id, cliente_id, data) values (v_srls, v_cli, date '1996-05-20') returning id into v_f;
    insert into fatture_emesse_righe (fattura_id, posizione, descrizione, quantita, prezzo_unitario) values (v_f, 1, 'ZZ Maggio', 1, 50.00);
    update fatture_emesse set numero = 990004, stato = 'messa_a_disposizione', imponibile = 45.45, imposta = 4.55, totale = 50.00 where id = v_f;
    select * into m from misure_dell_anno(v_srls, 1996);
    if m.ricavi_eventi <> 1177.00 or m.eventi_quanti <> 4 or m.imposta_eventi <> 176.48 then
      raise exception 'VERIFICA (3): l''anno non somma foto, mese vivo e foto vuota: % % %', m.ricavi_eventi, m.eventi_quanti, m.imposta_eventi;
    end if;
    perform chiudi_anno(v_srls, 1996, false, null);
    if not exists (select 1 from chiusure_annuali where entity_id = v_srls and anno = 1996
                    and ricavi_eventi = 1177.00 and eventi_quanti = 4 and imposta_eventi = 176.48) then
      raise exception 'VERIFICA (3): la chiusura dell''anno non porta gli eventi.';
    end if;

    -- (4) i permessi
    if not has_function_privilege('authenticated', 'public.misure_dell_anno(uuid,integer)', 'execute')
       or has_function_privilege('anon', 'public.misure_dell_anno(uuid,integer)', 'execute')
       or has_function_privilege('anon', 'public.misure_del_mese(uuid,integer,integer)', 'execute')
       or not has_function_privilege('authenticated', 'public.misure_del_mese(uuid,integer,integer)', 'execute') then
      raise exception 'VERIFICA (4): i permessi delle funzioni ricreate non sono quelli di prima.';
    end if;

    raise exception 'ZZ_ANNULLA';
  exception when others then
    if sqlerrm <> 'ZZ_ANNULLA' then raise; end if;
  end;

  perform set_config('request.jwt.claims', null, true);
  perform pretendi_nessun_residuo(v_foto, 'la verifica degli eventi nei mesi e nell''anno');

  raise notice 'Fatto: bozza e scartata non contano, «da inviare» sì; un mese con una fattura in sospeso non si congela; la foto del mese e quella dell''anno portano gli eventi (dalla foto, dal vivo, o dal vivo se la foto è vuota); i ricavi di sala non si muovono; i permessi sono quelli di prima. Provato e annullato: zero residui.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20261114000003', 'gli_eventi_nella_contabilita')
on conflict (version) do nothing;
