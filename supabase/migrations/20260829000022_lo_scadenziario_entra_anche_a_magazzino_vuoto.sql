-- =====================================================================
-- LO SCADENZIARIO ENTRA ANCHE IN UN MAGAZZINO VUOTO
-- 29/08/2026 — chiude la 20260829000006, che in produzione si e' fermata
-- =====================================================================
-- 🔴 COSA E' SUCCESSO, misurato e non dedotto. Applicando i diciassette
-- lavori in attesa, la catena si e' fermata alla seconda:
--
--     ERROR: Verifica impossibile: nessuna partita con scadenza in giacenza.
--
-- **Non e' un guasto: e' una guardia voluta.** Il blocco di verifica della
-- `20260829000006` si rifiuta di passare su un magazzino vuoto, e ha
-- ragione — la' sotto ogni controllo passerebbe senza provare niente, che
-- e' la trappola del caso vuoto del 17/08.
--
-- ⚠️ **Ma quella guardia ha un prezzo che nessuno aveva pagato prima**:
-- in produzione gli ingredienti sono **zero** (Alessio ha ripulito il
-- gestionale), quindi lotti con scadenza non ce ne sono e non ce ne
-- saranno finche' non entra la prima merce vera. Quella migrazione **non
-- puo' entrare in produzione**, oggi e per tutto il tempo in cui il
-- magazzino resta vuoto.
--
-- 🔴 E LA CONSEGUENZA NON ERA TEORICA. Il codice della schermata
-- **Scadenze** e' gia' pubblicato, e legge due colonne che solo quella
-- migrazione aggiunge — `ferma_da` e `e_preparazione`. Senza di lei:
--   · «ferma da undefined giorni» a schermo;
--   · il filtro «comprati / preparati» mette **tutto** fra i comprati e
--     **niente** fra i preparati, senza nessun errore.
-- ⚠️ Oggi non morde, perche' con zero lotti quella schermata e' vuota: e'
-- un difetto **armato**, che scatterebbe col primo carico. E' la stessa
-- forma del 22/08, quando il codice online chiedeva una colonna che il
-- database vero non aveva e in sala una comanda smetteva di funzionare.
--
-- ---------------------------------------------------------------------
-- COSA FA QUESTA, E PERCHE' NON RISCRIVE QUELLA
-- ---------------------------------------------------------------------
-- Installa **lo stesso identico corpo** della `…006` — ripreso dal
-- database del progetto di prova, dove quella migrazione e' applicata, e
-- non ricopiato dal file — e lo verifica con un esempio che **si
-- costruisce da se'**: un ingrediente e un lotto creati qui, controllati,
-- e tolti.
--
-- ⚠️ *Un esempio si costruisce, non si prende in prestito: se una verifica
-- dipende dai dati di Alessio, cade il giorno che quei dati mancano.* La
-- `…006` prendeva in prestito, e infatti e' caduta.
--
-- ⚠️ E i PERMESSI sono quelli **misurati** su tutt'e due i database prima
-- di toccare niente — `security definer`, chiuso ad `anon`, aperto a chi
-- ha fatto il login — non quelli ricopiati da una funzione accanto. E'
-- l'errore che ho gia' pagato stanotte sulla `20260829000018`.
--
-- ---------------------------------------------------------------------
-- 🔴 LA 20260829000006 SI REGISTRA QUI, E VA SALTATA PER SEMPRE
-- ---------------------------------------------------------------------
-- Come il 24/08 la `…032` registro' la `…030`. Senza questa riga, ogni
-- prossima applicazione riproverebbe la `…006` e si fermerebbe di nuovo
-- sullo stesso punto.
--
-- ⚠️ **E vale anche per una ricostruzione da zero**, finche' il magazzino
-- di partenza e' vuoto:
--     npm run migra -- --salta 20260829000006 --conferma
-- Scritto qui perche' fra sei mesi nessuno rifaccia l'indagine.
-- =====================================================================

drop function if exists partite_in_scadenza();

CREATE OR REPLACE FUNCTION public.partite_in_scadenza()
 RETURNS TABLE(lotto_id uuid, ingrediente text, ingrediente_id uuid, quantita numeric, unita text, scadenza date, giorni_mancanti integer, preavviso integer, lotto_fornitore text, da_segnalare boolean, perche_muta text, ferma_da integer, e_preparazione boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with oggi as (select (now() at time zone 'Europe/Rome')::date as g),
  aperte as (
    select l.id, l.ingredient_id, l.quantity_remaining, l.expiry_date,
           l.received_at, l.supplier_batch_number,
           i.name, i.unit::text as unita,
           preavviso_giorni(i.giorni_preavviso_scadenza) as preavviso,
           -- 🔴 «Da quanto non si muove» si conta dall'ULTIMA MOSSA, non
           -- dall'arrivo: una partita da cui si e' preso qualcosa ieri non
           -- e' ferma da tre mesi solo perche' e' entrata a maggio.
           -- ⚠️ E LA FORMA E' QUELLA CHE `partite_in_giacenza()` USA GIA',
           -- ripresa dal suo corpo vivo invece di inventarne una seconda:
           -- gli scarichi sono registrati per INGREDIENTE e non per lotto
           -- (`stock_consumptions` non ha nessuna colonna del lotto), quindi
           -- «l'ultima mossa» e' la piu' recente fra l'arrivo di questa
           -- partita e l'ultimo scarico di quell'ingrediente. Due modi
           -- diversi di contare la stessa cosa darebbero due numeri, e a
           -- divergere sarebbe quello guardato meno spesso.
           greatest(
             (l.received_at at time zone 'Europe/Rome')::date,
             coalesce((select max((c.created_at at time zone 'Europe/Rome')::date)
                         from stock_consumptions c
                        where c.ingredient_id = l.ingredient_id),
                      (l.received_at at time zone 'Europe/Rome')::date)
           ) as ultima_mossa,
           -- Il dato per distinguere cio' che si compra da cio' che si
           -- prepara c'e' gia' e nessuna schermata lo usava.
           i.preparazione_id is not null as e_preparazione
      from stock_lots l
      join ingredients i on i.id = l.ingredient_id
     where l.quantity_remaining > 0
       and l.expiry_date is not null
       and l.chiusa_il is null
  )
  select a.id, a.name, a.ingredient_id, a.quantity_remaining, a.unita,
         a.expiry_date,
         (a.expiry_date - o.g)::integer,
         a.preavviso,
         a.supplier_batch_number,
         (a.expiry_date - o.g) <= a.preavviso and not exists (
           select 1 from aperte n
            where n.ingredient_id = a.ingredient_id
              and n.id <> a.id
              and n.received_at > a.received_at
         ),
         case
           when exists (
             select 1 from aperte n
              where n.ingredient_id = a.ingredient_id
                and n.id <> a.id
                and n.received_at > a.received_at
           ) then 'ne e'' entrata una partita piu'' recente, ancora in giacenza'
           when (a.expiry_date - o.g) > a.preavviso
             then 'mancano piu'' di ' || a.preavviso || ' giorni'
           else null
         end,
         (o.g - a.ultima_mossa)::integer,
         a.e_preparazione
    from aperte a cross join oggi o
   order by a.expiry_date, a.name;
$function$

;

-- I permessi MISURATI, non ricopiati: security definer, chiuso ad anon,
-- aperto a chi ha fatto il login. Identici su produzione e progetto di prova.
revoke all on function partite_in_scadenza() from public, anon, authenticated;
grant execute on function partite_in_scadenza() to authenticated;

-- ---------------------------------------------------------------------
-- La 20260829000006 si registra qui
-- ---------------------------------------------------------------------
insert into applied_migrations (version, name)
values ('20260829000006', 'lo_scadenziario_sa_di_piu') on conflict (version) do nothing;

-- =====================================================================
-- VERIFICA — con l'esempio costruito, non preso in prestito
-- =====================================================================
do $verifica$
declare
  v_foto    jsonb := foto_righe();
  v_tit     uuid;
  v_ent     uuid;
  v_ing     uuid;
  v_lotto   uuid;
  r         record;
  v_quante  integer;
begin
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  if v_tit is null then
    raise exception 'Verifica impossibile: nessun titolare.';
  end if;
  select id into v_ent from entities order by created_at limit 1;
  if v_ent is null then
    raise exception 'Verifica impossibile: nessuna societa''.';
  end if;

  -- (0) LA SOSTITUZIONE HA ATTECCHITO: le due colonne nuove ci sono.
  --     Si guarda il corpo vivo, non il file.
  if pg_get_function_result('partite_in_scadenza()'::regprocedure) not like '%ferma_da%'
     or pg_get_function_result('partite_in_scadenza()'::regprocedure) not like '%e_preparazione%' then
    raise exception 'La funzione non restituisce le due colonne nuove: la schermata Scadenze continuerebbe a leggere «undefined».';
  end if;

  -- ⚠️ L'ESEMPIO SE LO COSTRUISCE QUESTA VERIFICA. Un ingrediente e un
  -- lotto suoi: se domani Alessio svuotasse il magazzino — com'e' adesso —
  -- questo blocco non cambierebbe risposta. E' l'unica differenza con la
  -- `…006`, ed e' la ragione per cui questa entra e quella no.
  -- ⚠️ Senza costo unitario, cosi' nessun riflesso di prezzo si mette in
  -- moto su un prodotto che vive dieci secondi.
  insert into ingredients (entity_id, name, category, unit, alimentare,
                           tenuto_in_magazzino, giorni_preavviso_scadenza)
  values (v_ent, 'VERIFICA-29AGO scadenziario', 'altro', 'kg', true, true, 30)
  returning id into v_ing;

  insert into stock_lots (ingredient_id, quantity_received, quantity_remaining,
                          expiry_date, received_at)
  values (v_ing, 5, 5,
          (now() at time zone 'Europe/Rome')::date + 3,
          now() - interval '10 days')
  returning id into v_lotto;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);

  -- (1) LA PARTITA COMPARE, ed e' quella costruita qui.
  select count(*) into v_quante from partite_in_scadenza() p where p.lotto_id = v_lotto;
  if v_quante <> 1 then
    raise exception 'La partita costruita dalla verifica non compare nello scadenziario (trovata % volte).', v_quante;
  end if;

  select * into r from partite_in_scadenza() p where p.lotto_id = v_lotto;

  -- (2) 🔴 LE DUE COLONNE NUOVE RISPONDONO, e con i valori giusti. E' quello
  --     che la schermata Scadenze legge: `ferma_da` per ordinare «piu'
  --     fermo prima», `e_preparazione` per il filtro comprati/preparati.
  if r.ferma_da is null then
    raise exception 'La colonna «da quanto e'' ferma» torna vuota: a schermo si leggerebbe «ferma da undefined giorni».';
  end if;
  if r.ferma_da <> 10 then
    raise exception 'La partita e'' ferma da 10 giorni e la funzione dice %.', r.ferma_da;
  end if;
  if r.e_preparazione is distinct from false then
    raise exception 'Un prodotto COMPRATO risulta una preparazione (%): il filtro metterebbe tutto dalla parte sbagliata.', r.e_preparazione;
  end if;

  -- (3) E IL RESTO NON E' CAMBIATO: la scadenza fra tre giorni si conta
  --     giusta, e la partita e' da segnalare col preavviso di trenta.
  if r.giorni_mancanti <> 3 then
    raise exception 'I giorni che mancano alla scadenza sono % invece di 3.', r.giorni_mancanti;
  end if;
  if not r.da_segnalare then
    raise exception 'Una partita che scade fra tre giorni con trenta di preavviso non risulta da segnalare (perche'': %).', r.perche_muta;
  end if;

  perform set_config('request.jwt.claims', null, true);

  -- Si toglie quello che questa verifica ha creato, per identificativo.
  delete from stock_lots where id = v_lotto;
  delete from ingredients where id = v_ing;

  perform pretendi_nessun_residuo(v_foto, 'la verifica dello scadenziario');
  raise notice 'Lo scadenziario risponde con «da quanto e'' ferma» e «e'' una preparazione», provate su un lotto costruito qui. La 20260829000006 e'' registrata.';
end
$verifica$;

insert into applied_migrations (version, name)
values ('20260829000022', 'lo_scadenziario_entra_anche_a_magazzino_vuoto') on conflict (version) do nothing;
