-- =====================================================================
-- LO STORICO DENTRO OGNI PREPARAZIONE
-- 29/08/2026 — Blocco 3 (punti 3b e 3c) del mandato del 29/08 (sera)
-- =====================================================================
-- Decisione di Alessio: al posto della tendina, un elenco di voci
-- cliccabili con la RICERCA, in ordine ALFABETICO — gli era stato proposto
-- «le più frequenti in cima» e ha preferito l'alfabetico. E dentro ogni
-- voce lo storico: **quante volte l'ha fatta, quanto è costata le ultime
-- volte, la resa**. Così mentre registra vede il paragone: se il fondo
-- bruno stavolta costa il doppio, se ne accorge lì.
--
-- ---------------------------------------------------------------------
-- PERCHÉ UNA FUNZIONE E NON UN CONTO NELLA SCHERMATA
-- ---------------------------------------------------------------------
-- 🔴 Misurato: `listProduzioni()` legge **al massimo 100** produzioni
-- (`.limit(100)`). Contare «quante volte l'ha fatta» da lì darebbe un
-- numero giusto oggi — 14 produzioni in tutto — e **silenziosamente più
-- basso del vero** fra sei mesi, senza nessun errore e senza che niente
-- lo dica. È la famiglia della risposta più corta che ha l'aria di essere
-- intera.
--
-- ⚠️ E il conto si chiede al database, che le righe le ha tutte: *un
-- controllo chiede al database la risposta, non i dati su cui calcolarla.*
--
-- ---------------------------------------------------------------------
-- IL COSTO LO VEDE SOLO IL TITOLARE, e non si RIFIUTA: si TACE
-- ---------------------------------------------------------------------
-- ⚠️ Qui il portiere-che-rifiuta sarebbe la cura sbagliata, e la
-- distinzione conta. Questo elenco serve **in cucina**: quante volte si è
-- fatto il fondo bruno e quanto ne è uscito sono cose che chi cucina deve
-- vedere. Il **costo** no — è un prezzo d'acquisto.
--
-- ⚠️ Quindi il costo torna **vuoto** allo staff, ed è la stessa forma
-- delle viste `_display` che il progetto usa dal primo giorno. Non è la
-- «schermata vuota che rassicura»: qui il vuoto riguarda **una colonna**,
-- e le altre rispondono. Se tutto l'elenco tornasse vuoto, quella sì
-- sarebbe una rassicurazione falsa.
-- =====================================================================

create or replace function riepilogo_preparazioni()
returns table (
  recipe_id        uuid,
  nome             text,
  unita            text,
  resa_in_ricetta  numeric,
  quante_volte     integer,
  ultima_il        timestamptz,
  resa_ultima      numeric,
  resa_media       numeric,
  costo_ultimo     numeric,
  costo_precedente numeric,
  in_lista         boolean,
  ricorre_ogni     integer
)
language sql
stable
security definer
set search_path = public
as $corpo$
  with fatte as (
    select p.recipe_id,
           p.creato_il,
           p.quantita_ottenuta,
           p.dosi,
           p.costo,
           row_number() over (partition by p.recipe_id order by p.creato_il desc) as quanto_recente
      from produzioni p
  ),
  riassunto as (
    select f.recipe_id,
           count(*)::integer as quante,
           max(f.creato_il) as ultima,
           -- ⚠️ La resa si misura PER DOSE, non per produzione: una doppia
           -- dose che rende il doppio ha la stessa resa di una singola, e
           -- mediare le quantità direbbe che rende di più.
           round(avg(f.quantita_ottenuta / nullif(f.dosi, 0)), 4) as media_per_dose
      from fatte f
     group by f.recipe_id
  )
  select r.id,
         r.name,
         r.yield_unit,
         r.yield_quantity,
         coalesce(ri.quante, 0),
         ri.ultima,
         round((select f.quantita_ottenuta / nullif(f.dosi, 0)
                  from fatte f where f.recipe_id = r.id and f.quanto_recente = 1), 4),
         ri.media_per_dose,
         case when (select is_titolare())
              then (select f.costo from fatte f where f.recipe_id = r.id and f.quanto_recente = 1)
         end,
         case when (select is_titolare())
              then (select f.costo from fatte f where f.recipe_id = r.id and f.quanto_recente = 2)
         end,
         exists (select 1 from preparazioni_da_fare d where d.recipe_id = r.id),
         (select ric.ogni_giorni from preparazioni_ricorrenti ric
           where ric.recipe_id = r.id and ric.attiva)
    from recipes r
    left join riassunto ri on ri.recipe_id = r.id
   where r.recipe_type = 'preparazione'
   -- ⚠️ ALFABETICO, ed è una scelta esplicita di Alessio contro «le più
   -- frequenti in cima»: un elenco che si riordina da solo non si impara
   -- mai a memoria.
   order by r.name;
$corpo$;

comment on function riepilogo_preparazioni() is
  'Le preparazioni in ordine alfabetico, ognuna con quante volte e'' stata fatta, la resa e — al solo titolare — quanto e'' costata le ultime due volte. Il conto si chiede al database perche'' la schermata ne legge al massimo cento.';

revoke all on function riepilogo_preparazioni() from public, anon, authenticated;
grant execute on function riepilogo_preparazioni() to authenticated;

-- =====================================================================
-- VERIFICA
-- =====================================================================
do $verifica$
declare
  v_foto     jsonb := foto_righe();
  v_ent      uuid;
  v_ric      uuid;
  v_ing      uuid;
  v_miei_r   uuid[] := array[]::uuid[];
  v_miei_i   uuid[] := array[]::uuid[];
  v_miei_p   uuid[] := array[]::uuid[];
  v_p        uuid;
  v_utente   uuid;
  r          record;
begin
  -- (0) LA SOSTITUZIONE HA ATTECCHITO?
  if pg_get_functiondef('riepilogo_preparazioni()'::regprocedure) not like '%is_titolare%' then
    raise exception 'riepilogo_preparazioni non distingue il titolare dallo staff.';
  end if;

  select id into v_ent from entities order by created_at limit 1;
  if v_ent is null then
    raise exception 'Non c''e'' nessuna societa'': la verifica non ha un perimetro suo.';
  end if;

  -- ⚠️ IL PERIMETRO SE LO COSTRUISCE QUESTA VERIFICA, e i NUMERI sono
  -- scelti perché le risposte sbagliate siano DIVERSE fra loro: due
  -- produzioni, una da 1 dose che rende 2 e una da 2 dosi che rende 6.
  -- La resa per dose è 2 e 3, media 2,5; mediando le QUANTITÀ verrebbe 4.
  -- Con due produzioni identiche i due conti darebbero lo stesso numero e
  -- la prova non proverebbe niente.
  insert into recipes (name, category, recipe_type, yield_quantity, yield_unit)
  values ('VERIFICA-29AGO storico', 'antipasto', 'preparazione', 2, 'kg')
  returning id into v_ric;
  v_miei_r := v_miei_r || v_ric;

  insert into ingredients (entity_id, name, category, unit, alimentare)
  values (v_ent, 'VERIFICA-29AGO farina storico', 'farine_cereali', 'kg', true)
  returning id into v_ing;
  v_miei_i := v_miei_i || v_ing;

  insert into produzioni (recipe_id, ingredient_id, dosi, quantita_ottenuta, unita, costo, creato_il)
  values (v_ric, v_ing, 1, 2, 'kg', 10.00, now() - interval '2 days')
  returning id into v_p;
  v_miei_p := v_miei_p || v_p;

  insert into produzioni (recipe_id, ingredient_id, dosi, quantita_ottenuta, unita, costo, creato_il)
  values (v_ric, v_ing, 2, 6, 'kg', 30.00, now() - interval '1 day')
  returning id into v_p;
  v_miei_p := v_miei_p || v_p;

  -- (1) DA TITOLARE: due volte, resa media 2,5 per dose, costo ultimo 30 e
  --     precedente 10.
  select ur.user_id into v_utente from user_roles ur where ur.role = 'titolare' limit 1;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_utente, 'role', 'authenticated')::text, true);

  select * into r from riepilogo_preparazioni() where recipe_id = v_ric;
  if r.quante_volte <> 2 then
    raise exception 'Le volte contate sono % invece di 2.', r.quante_volte;
  end if;
  if r.resa_media is distinct from 2.5 then
    raise exception 'La resa media e'' % invece di 2,5 per dose: si stanno mediando le quantita'', non le rese.', r.resa_media;
  end if;
  if r.resa_ultima is distinct from 3 then
    raise exception 'La resa dell''ultima volta e'' % invece di 3.', r.resa_ultima;
  end if;
  if r.costo_ultimo is distinct from 30.00 or r.costo_precedente is distinct from 10.00 then
    raise exception 'I due costi sono % e % invece di 30 e 10.', r.costo_ultimo, r.costo_precedente;
  end if;

  -- (2) 🔴 DALLO STAFF il costo NON esce, e il resto SI'. Se sparisse tutto
  --     sarebbe una schermata vuota, cioe' una rassicurazione falsa; qui
  --     tace una colonna sola.
  select ur.user_id into v_utente from user_roles ur where ur.role <> 'titolare' limit 1;
  if v_utente is null then
    raise exception 'Non c''e'' nessuno staff: la riservatezza del costo non si puo'' mettere alla prova.';
  end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_utente, 'role', 'authenticated')::text, true);

  select * into r from riepilogo_preparazioni() where recipe_id = v_ric;
  if r.recipe_id is null then
    raise exception 'Allo staff l''elenco delle preparazioni torna vuoto: e'' una rassicurazione falsa.';
  end if;
  if r.quante_volte <> 2 then
    raise exception 'Allo staff le volte contate sono % invece di 2.', r.quante_volte;
  end if;
  if r.costo_ultimo is not null or r.costo_precedente is not null then
    raise exception 'Il costo di una produzione esce anche allo staff.';
  end if;

  perform set_config('request.jwt.claims', null, true);

  delete from produzioni where id = any(v_miei_p);
  delete from recipes where id = any(v_miei_r);
  delete from ingredients where id = any(v_miei_i);

  perform pretendi_nessun_residuo(v_foto, 'la verifica dello storico delle preparazioni');
  raise notice 'Lo storico conta tutte le produzioni, la resa e'' per dose, e il costo lo vede solo il titolare.';
end
$verifica$;

insert into applied_migrations (version, name)
values ('20260829000017', 'lo_storico_dentro_ogni_preparazione') on conflict (version) do nothing;
