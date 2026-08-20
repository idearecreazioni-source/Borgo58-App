-- =====================================================================
-- UNA PERCENTUALE SI SCRIVE IN UN MODO SOLO
-- 21/08/2026
-- =====================================================================
-- 🔴 TROVATO DALLE MANI DI ALESSIO al collaudo, e la misura ne ha trovati
-- DUE in più di quello segnalato.
--
-- Il difetto segnalato: nella vista «Per me» del preventivo si leggeva
-- **«Food cost obiettivo 25.0#%»**. In PostgreSQL `#` NON è un simbolo di
-- formato, e i caratteri non riconosciuti nel template **escono
-- letteralmente**. Era una maschera pensata con la testa a Excel, dove `#`
-- significa «cifra se serve».
--
-- 🔴 E CERCANDO SE IL GESTO SI FOSSE RIPETUTO ne è uscito un secondo,
-- diverso e più insidioso: `FM990.99` su un numero **intero** produce
-- «25.» — un punto orfano. Misurato sui dati veri: **tutte e sei** le
-- regole di deducibilità lo mostrano («100.% deducibile», «75.%», «0.%»).
-- Non era un caso limite: era ogni riga.
-- E un terzo punto è **armato e non ancora vivo**: la commissione del POS,
-- che oggi è vuota — il giorno che Alessio scrive «2» direbbe «2.%».
--
-- ⚠️ LA CURA NON È CORREGGERE TRE MASCHERE, ed è la stessa lezione del
-- 17/08 sugli importi: `euro()` esiste perché *un importo si scrive in un
-- modo solo*, e per le percentuali quel posto non c'era. Finché la maschera
-- si riscrive a mano in ogni funzione, il prossimo `#` è già in arrivo.
--
-- ⚠️ E LE TRE FUNZIONI SONO RISCRITTE DAL CORPO **VIVO** letto dal
-- database, non dai file che le avevano create (regola del 18/08, nata da
-- un difetto vero): fra il file e la funzione ci stanno tutte le migrazioni
-- che l'hanno toccata nel frattempo.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1 · L'UNICO POSTO DOVE SI SCRIVE UNA PERCENTUALE
-- ---------------------------------------------------------------------
-- ⚠️ Come si legge in italiano: **senza decimali quando è un numero tondo**
-- («100%», non «100.0%») e **con la virgola** quando ce ne sono («25,5%»).
-- Il punto come separatore decimale è la scrittura inglese, e in un
-- messaggio che Alessio legge in mezzo al servizio stona come stonava il
-- cancelletto.
--
-- ⚠️ E il simbolo `%` NON sta qui dentro: le tre frasi che la usano lo
-- scrivono già, e metterlo in tutte e due i posti darebbe «25%%».
create or replace function percento(p_valore numeric)
returns text
language sql
immutable
as $fn$
  select case
    when p_valore is null then null
    -- Numero tondo: nessun decimale. `FM` toglie gli spazi di riempimento.
    when p_valore = trunc(p_valore) then to_char(p_valore, 'FM999999990')
    -- Altrimenti fino a due decimali, con la virgola italiana e senza zeri
    -- inutili in coda: 25,5 e non 25,50.
    else replace(rtrim(rtrim(to_char(p_valore, 'FM999999990.00'), '0'), '.'), '.', ',')
  end;
$fn$;

comment on function percento(numeric) is
  'L''unico posto dove una percentuale diventa testo. Nato il 21/08/2026 da «25.0#%» letto a schermo: finche'' la maschera si riscrive a mano in ogni funzione, il prossimo carattere sbagliato e'' gia'' in arrivo.';

-- ⚠️ Serve a chiunque legga una frase che la contiene, quindi a tutto lo
-- staff. Non espone niente: trasforma un numero in testo.
revoke all on function percento(numeric) from public, anon, authenticated;
grant execute on function percento(numeric) to authenticated;


-- ---------------------------------------------------------------------
-- 2 · LE TRE FUNZIONI CHE LA USANO
-- ---------------------------------------------------------------------
-- pos_in_transito: UNA RIGA SOLA cambiata. Il resto e' il corpo VIVO letto dal
-- database, non dal file che lo aveva creato — regola del 18/08, nata da un
-- difetto vero: fra i due ci stanno tutte le migrazioni che l'hanno toccato.
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
             else 'Al netto della commissione del ' || percento(v_comm) || '%.' end)
    || (case when v_mance > 0
             then ' Comprende ' || euro(v_mance)
                  || ' euro di mance: la banca accredita anche quelle, ma non sono ricavi tuoi.'
             else '' end);
end;
$function$;

-- prezzo_preventivo: UNA RIGA SOLA cambiata. Il resto e' il corpo VIVO letto dal
-- database, non dal file che lo aveva creato — regola del 18/08, nata da un
-- difetto vero: fra i due ci stanno tutte le migrazioni che l'hanno toccato.
CREATE OR REPLACE FUNCTION public.prezzo_preventivo(p_preventivo_id uuid)
 RETURNS TABLE(costo_cibo numeric, costo_cibo_a_persona numeric, extra_totale numeric, food_cost_obiettivo_percento numeric, prezzo_a_persona numeric, scavalcato boolean, avvertenza text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_p       preventivi%rowtype;
  v_costo   numeric;
  v_extra   numeric;
  v_ric     numeric;
  v_prop    numeric;
begin
  if not is_titolare() then
    raise exception 'I preventivi sono riservati al titolare.';
  end if;
  select * into v_p from preventivi where id = p_preventivo_id;
  if not found then raise exception 'Questo preventivo non esiste.'; end if;

  -- ⚠️ Il costo FOTOGRAFATO se c'e', quello di adesso se il preventivo non e'
  -- ancora stato scritto: il prezzo di una promessa si costruisce sul costo
  -- di quando la promessa e' stata fatta.
  v_costo := coalesce(v_p.costo_cibo, costo_cibo_preventivo(p_preventivo_id));

  select coalesce(sum(prezzo * quantita), 0) into v_extra
    from preventivo_righe
   where preventivo_id = p_preventivo_id and natura = 'extra';

  v_ric := coalesce(v_p.food_cost_obiettivo_percento,
                    (select s.food_cost_obiettivo_percento from service_settings s where s.id = 1));

  -- 🔴 IL FOOD COST OBIETTIVO SI APPLICA AL SOLO CIBO, e gli extra si
  -- sommano dopo, senza nessun ricarico.
  -- ⚠️ La formula e' una DIVISIONE, non una moltiplicazione: 25% vuol dire
  -- che il cibo pesa un quarto del prezzo, quindi 10 € di cibo fanno 40 € di
  -- cibo venduto. Scritta come «+X%» sarebbe stata leggibile in due modi.
  if v_ric is not null then
    v_prop := round((v_costo / (v_ric / 100.0) + v_extra) / v_p.persone, 2);
  end if;

  return query select
    round(v_costo, 2),
    round(v_costo / v_p.persone, 2),
    round(v_extra, 2),
    v_ric,
    coalesce(v_p.prezzo_a_persona_scavalcato, v_prop),
    v_p.prezzo_a_persona_scavalcato is not null,
    -- ⚠️ IL NUMERO E IL SUO LIMITE VIAGGIANO INSIEME: un'avvertenza scritta
    -- nel testo di una schermata non protegge la seconda che mostra lo
    -- stesso numero.
    case
      when v_ric is null then
        'Nessun food cost obiettivo impostato: il gestionale non puo'' proporre un prezzo. Scrivilo in Sala e orari, oppure metti tu il prezzo a persona.'
      when v_p.prezzo_a_persona_scavalcato is not null then
        'Prezzo scritto a mano: il food cost obiettivo non lo tocca piu''.'
      else
        -- ⚠️ SI DICE COL RISULTATO, non con la percentuale: «10 € di cibo
        -- → 40 €». Una percentuale si puo'' leggere in due modi, un prezzo no.
        'Food cost obiettivo ' || percento(v_ric) || '%: '
        || euro(10) || ' di cibo diventano ' || euro(round(10 / (v_ric / 100.0), 2))
        || '. Vale sul SOLO cibo; gli extra sono sommati dopo, senza ricarico.'
    end
    || case when v_p.costo_cibo is null then ' ⚠️ Costo di adesso: questo preventivo non e'' ancora stato salvato.'
            else ' Costo fotografato il ' || to_char(v_p.costo_rilevato_il at time zone 'Europe/Rome', 'DD/MM/YYYY') || '.' end;
end;
$function$;

-- quota_deducibile: UNA RIGA SOLA cambiata. Il resto e' il corpo VIVO letto dal
-- database, non dal file che lo aveva creato — regola del 18/08, nata da un
-- difetto vero: fra i due ci stanno tutte le migrazioni che l'hanno toccato.
CREATE OR REPLACE FUNCTION public.quota_deducibile(p_importo numeric, p_regola_id uuid, p_in_contante boolean, p_documentato boolean, p_esente_regola_contante boolean DEFAULT false)
 RETURNS TABLE(quota numeric, stato text, motivo text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    ('Regola «' || r.etichetta || '»: ' || percento(r.percentuale_deducibile) || '% deducibile'
      || case when r.verificata_il is null
              then ' — non ancora confermata dalla commercialista.'
              else ' — confermata il ' || to_char(r.verificata_il, 'DD/MM/YYYY') || '.' end)::text;
end;
$function$;


-- ---------------------------------------------------------------------
-- VERIFICA
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_tit    uuid;
  v_testo  text;
  v_quante integer;
  v_lap_p  integer;
  v_lap_d  integer;
begin
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  if v_tit is null then raise exception 'Nessun titolare: impossibile verificare.'; end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);
  select count(*) into v_lap_p from deleted_records;

  -- 1 · I DUE CASI CHE HANNO PRODOTTO IL DIFETTO, e sono scelti perche'
  --     DISTINGUANO le tre risposte sbagliate incontrate:
  --       'FM999990.0#' → «25.0#»  (il cancelletto letterale)
  --       'FM990.99'    → «25.»    (il punto orfano sugli interi)
  --       'FM999990.9'  → «25.»    (la cura che sembra giusta e non lo e')
  if percento(25.0) <> '25' then
    raise exception 'percento(25.0) dice «%» invece di «25».', percento(25.0);
  end if;
  if percento(100) <> '100' then
    raise exception 'percento(100) dice «%» invece di «100».', percento(100);
  end if;
  if percento(0) <> '0' then
    raise exception 'percento(0) dice «%» invece di «0».', percento(0);
  end if;

  -- 2 · I DECIMALI CI SONO QUANDO SERVONO, con la virgola italiana.
  if percento(25.5) <> '25,5' then
    raise exception 'percento(25.5) dice «%» invece di «25,5».', percento(25.5);
  end if;
  if percento(1.25) <> '1,25' then
    raise exception 'percento(1.25) dice «%» invece di «1,25».', percento(1.25);
  end if;
  -- ⚠️ E gli zeri inutili in coda non si scrivono: «25,5», non «25,50».
  if percento(25.50) <> '25,5' then
    raise exception 'percento(25.50) dice «%» invece di «25,5».', percento(25.50);
  end if;

  -- 3 · VUOTO NON E' ZERO (regola del 19/08): se non c'e' percentuale, non
  --     si inventa uno «0».
  if percento(null) is not null then
    raise exception 'percento(null) dice «%» invece di niente.', percento(null);
  end if;

  -- 4 · 🔴 IL CONTROLLO CHE VALE PIU' DEGLI ALTRI: nessuna funzione del
  --     database scrive piu' una percentuale a mano. E' una PROPRIETA', non
  --     un conteggio — se domani qualcuno ne aggiunge una, questa riga la
  --     prende. Stessa forma della verifica di `euro()` del 17/08.
  select count(*) into v_quante
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname <> 'percento'
     and (pg_get_functiondef(p.oid) like '%FM990.99%'
          or pg_get_functiondef(p.oid) like '%FM999990.0#%');
  if v_quante > 0 then
    raise exception
      'Ci sono ancora % funzioni che scrivono una percentuale con una maschera propria.', v_quante;
  end if;

  -- 5 · E LE TRE FRASI RISPONDONO DAVVERO.
  --     ⚠️ Un corpo che si crea non e' un corpo che funziona: Postgres
  --     accetta una funzione che ne chiama una inesistente e non risolve le
  --     chiamate finche' non le esegue (lezione del 17/08). Qui si CHIAMANO.
  select motivo into v_testo
    from quota_deducibile(100, (select id from regole_deducibilita
                                 where percentuale_deducibile = 100 limit 1), false, true);
  if v_testo is null or v_testo like '%100.%' then
    raise exception 'La frase della deducibilita'' dice ancora: %', v_testo;
  end if;
  if v_testo not like '%100%' then
    raise exception 'La frase della deducibilita'' ha perso la percentuale: %', v_testo;
  end if;

  -- ⚠️ Le altre due si chiamano solo per accertarsi che RISPONDANO: il loro
  -- testo dipende da dati che in produzione non ci sono ancora (nessun
  -- preventivo di riferimento, POS non configurato).
  perform * from pos_in_transito((select id from entities order by created_at limit 1));

  select count(*) into v_lap_d from deleted_records;
  if v_lap_d <> v_lap_p then
    raise exception 'La verifica ha lasciato % lapidi nel registro.', v_lap_d - v_lap_p;
  end if;

  perform set_config('request.jwt.claims', null, true);
  raise notice 'Una percentuale si scrive in un modo solo: niente cancelletti, niente punti orfani.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260821000001', 'una_percentuale_si_scrive_in_un_modo_solo')
on conflict (version) do nothing;
