-- =====================================================================
-- LO SCADENZIARIO SA DA QUANTO E' FERMA, E SE L'HAI FATTA TU
-- 29/08/2026 — Blocco 2 del mandato del 29/08 (pomeriggio)
-- =====================================================================
-- ---------------------------------------------------------------------
-- LA MISURA, e ha spostato i difetti di schermata
-- ---------------------------------------------------------------------
-- Il mandato colloca tre difetti nel Magazzino e nella scheda
-- dell'ingrediente. Aperte le schermate a 375 punti coi dati veri del
-- progetto di prova (133 ingredienti, 204 lotti attivi, 140 scaduti), stanno
-- altrove:
--
--   · **il Magazzino ha gia' una riga per ingrediente** — 133 righe su 133
--     ingredienti, non una per lotto;
--   · le righe ripetute sono in **Scadenze** (201 righe: «Sarde» 13 volte,
--     «Carota» 12, «Caciocavallo ragusano» 9) e in **«Da quanto e' ferma»**
--     (altre 201, gli stessi lotti);
--   · «scade il» su roba scaduta da due mesi e mezzo e la sezione «l'ho
--     trasformato» **non sono nella scheda dell'ingrediente**: vivono
--     tutt'e due in `Fermi.jsx`, cioe' «Da quanto e' ferma».
--
-- ⚠️ Non cambia cosa c'e' da fare: cambia dove. E se avessi corretto dove
-- il mandato diceva, avrei toccato una schermata sana e lasciato intatte
-- le due malate.
--
-- ---------------------------------------------------------------------
-- COSA MANCA ALLA FUNZIONE, e perche' si estende invece di aggiungerne una
-- ---------------------------------------------------------------------
-- Per raggruppare per ingrediente e ordinare «piu' fermo prima» servono due
-- cose che `partite_in_scadenza()` non dice: **da quanto quella partita non
-- si muove** e **se e' roba comprata o una preparazione fatta in casa**.
--
-- Il primo dato esiste gia' in `partite_in_giacenza()` (`ferma_da`), il
-- secondo in `ingredients.preparazione_id`. Si aggiungono QUI invece di
-- chiederli con una seconda interrogazione: due elenchi che si incrociano
-- nel browser divergono al primo lotto che entra fra una lettura e l'altra,
-- e a restare indietro sarebbe quello guardato meno.
--
-- ⚠️ SI DEVE DROPPARE, perche' cambiano le colonne restituite. E dopo un
-- `drop` i permessi tornano aperti a chiunque abbia la chiave pubblica:
-- si rimettono **identici a quelli misurati prima di toccarla** —
-- `postgres` piu' `authenticated` — non ricopiati dalle funzioni accanto.
-- =====================================================================

drop function if exists partite_in_scadenza();

create or replace function partite_in_scadenza()
returns table(lotto_id uuid, ingrediente text, ingrediente_id uuid, quantita numeric,
              unita text, scadenza date, giorni_mancanti integer, preavviso integer,
              lotto_fornitore text, da_segnalare boolean, perche_muta text,
              ferma_da integer, e_preparazione boolean)
language sql
stable
security definer
set search_path = public
as $fn$
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
$fn$;

revoke all on function partite_in_scadenza() from public, anon, authenticated;
grant execute on function partite_in_scadenza() to authenticated;

-- =====================================================================
-- VERIFICA
-- =====================================================================
do $verifica$
declare
  v_tit uuid;
  v_foto jsonb;
  v_n integer;
  v_scadute integer;
  v_prep integer;
  v_ferme integer;
  v_max integer;
  v_permesso boolean;
begin
  v_foto := foto_righe();
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  if v_tit is null then raise exception 'Verifica impossibile: nessun titolare.'; end if;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);

  select count(*), count(*) filter (where giorni_mancanti < 0),
         count(*) filter (where e_preparazione), count(*) filter (where ferma_da is not null),
         max(ferma_da)
    into v_n, v_scadute, v_prep, v_ferme, v_max
    from partite_in_scadenza();

  -- (1) La funzione risponde, e su dati che hanno qualcosa da dire: su un
  --     magazzino vuoto ogni controllo qui sotto passerebbe senza provare
  --     niente (trappola del caso vuoto).
  if v_n = 0 then
    raise exception 'Verifica impossibile: nessuna partita con scadenza in giacenza.';
  end if;

  -- (2) I due dati nuovi ci sono per TUTTE le righe: se «da quanto e' ferma»
  --     fosse vuoto su qualcuna, l'ordinamento «piu' fermo prima» metterebbe
  --     quelle righe a caso senza dirlo.
  if v_ferme <> v_n then
    raise exception '% righe su % non sanno da quanto sono ferme.', v_n - v_ferme, v_n;
  end if;
  if v_max is null or v_max < 0 then
    raise exception 'Il conto dei giorni fermi non torna: massimo %.', v_max;
  end if;

  -- (3) 🔴 E DISTINGUE DAVVERO: se `e_preparazione` fosse sempre falso, il
  --     filtro «comprati / preparati da me» risulterebbe costruito e non
  --     separerebbe niente — un filtro che non filtra e' peggio di nessun
  --     filtro, perche' chi lo usa crede di aver ristretto.
  if v_prep = 0 and exists (select 1 from ingredients where preparazione_id is not null) then
    raise exception 'Ci sono preparazioni in anagrafica ma nessuna partita risulta preparata in casa.';
  end if;

  -- (4) I permessi sono quelli di prima del drop, non quelli comodi.
  select has_function_privilege('anon', p.oid, 'execute') into v_permesso
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'partite_in_scadenza';
  if v_permesso then
    raise exception 'Dopo il drop la funzione e'' rimasta aperta alla chiave pubblica.';
  end if;

  perform set_config('request.jwt.claims', null, true);
  perform pretendi_nessun_residuo(v_foto, 'la verifica dello scadenziario');
  raise notice 'Lo scadenziario dice anche da quanto una partita e'' ferma (max % giorni) e se e'' roba preparata in casa (% righe su %). Scadute: %.',
    v_max, v_prep, v_n, v_scadute;
end
$verifica$;

insert into applied_migrations (version, name)
values ('20260829000006', 'lo_scadenziario_sa_di_piu') on conflict (version) do nothing;
