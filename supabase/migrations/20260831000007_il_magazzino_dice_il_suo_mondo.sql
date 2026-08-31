-- =====================================================================
-- LA GIACENZA DICE IN CHE MONDO STA — 31/08/2026
-- =====================================================================
--
-- 🔴 PERCHE' SERVE, e nasce da un difetto trovato da Alessio con gli occhi:
-- i sette mondi sono stati costruiti, provati e applicati stamattina, e **il
-- Magazzino resta un elenco unico**. La migrazione dei mondi c'era; la porta
-- per arrivarci no.
--
-- ⚠️ E LA CAUSA NON ERA LA SCHERMATA: era che `v_stock_levels` — quello che
-- il Magazzino elenca — **non sa in che mondo sta un prodotto**. Senza questa
-- colonna la schermata avrebbe dovuto chiedere due volte e incrociare a
-- mano, cioe' costruire un secondo posto dove quella risposta vive.
--
-- ⚠️ LA COLONNA VA **IN FONDO**, mai in mezzo: `create or replace view`
-- rifiuta di riordinare le colonne esistenti (`ERROR 42P16`, §6).

create or replace view v_stock_levels as
 SELECT i.id AS ingredient_id,
    i.name AS ingredient_name,
    i.unit,
    i.stock_minimum_threshold,
    COALESCE(sum(sl.quantity_remaining), 0::numeric)::numeric(12,4) AS current_quantity,
    i.stock_minimum_threshold IS NOT NULL AND COALESCE(sum(sl.quantity_remaining), 0::numeric) < i.stock_minimum_threshold AS below_threshold,
    min(sl.expiry_date) FILTER (WHERE sl.quantity_remaining > 0::numeric) AS nearest_expiry,
    i.tenuto_in_magazzino,
    -- 🔴 IL MONDO, IN FONDO (31/08/2026). Arriva dalla CATEGORIA, che e' dove
    --    la decisione vive: il prodotto non porta il mondo addosso, o
    --    sarebbero due posti per la stessa risposta.
    c.mondo
   FROM ingredients i
     LEFT JOIN stock_lots sl ON sl.ingredient_id = i.id
     LEFT JOIN categorie_ingrediente c ON c.codice = i.category
  WHERE i.active
  GROUP BY i.id, i.name, i.unit, i.stock_minimum_threshold, i.tenuto_in_magazzino, c.mondo;

comment on view v_stock_levels is
  'La giacenza di ogni prodotto attivo, col suo mondo del magazzino. '
  '⚠️ Il mondo si legge dalla CATEGORIA e non dal prodotto: due posti per la '
  'stessa risposta prima o poi si contraddicono.';

-- ---------------------------------------------------------------------
-- VERIFICA
-- ---------------------------------------------------------------------
do $verifica$
declare v_senza integer; v_tot integer; v_mondi integer;
begin
  select count(*) into v_tot from v_stock_levels;
  if v_tot = 0 then
    raise notice 'Nessun prodotto: la vista e'' vuota, e non c''e'' altro da controllare.';
  else
    -- Ogni riga dichiara il suo mondo: se una lo lasciasse vuoto, la
    -- schermata divisa in mondi la perderebbe **senza dirlo**.
    select count(*) into v_senza from v_stock_levels where mondo is null;
    if v_senza <> 0 then
      raise exception '% prodotti su % non dicono in che mondo stanno', v_senza, v_tot;
    end if;

    -- ⚠️ E i mondi che compaiono devono essere fra i sette: un ottavo
    --    significherebbe che la chiave esterna non tiene.
    select count(*) into v_mondi
      from (select distinct mondo from v_stock_levels) s
      left join mondi_magazzino m on m.codice = s.mondo
     where m.codice is null;
    if v_mondi <> 0 then
      raise exception '% mondi che non stanno nel catalogo', v_mondi;
    end if;
  end if;

  -- 🔴 IL TIPO DI `current_quantity` NON DEVE ESSERE CAMBIATO. Riscrivendo
  --    questa vista a memoria avevo perso il `numeric(12,4)` — e un tipo
  --    piu' largo non da' nessun errore: cambierebbe solo, in silenzio, come
  --    si arrotondano le giacenze che tutto il Magazzino legge.
  perform 1 from information_schema.columns
   where table_name = 'v_stock_levels' and column_name = 'current_quantity'
     and numeric_precision = 12 and numeric_scale = 4;
  if not found then
    raise exception 'current_quantity ha cambiato tipo: la vista e'' stata riscritta a memoria';
  end if;

  raise notice 'Fatto: la giacenza dice il suo mondo su % prodotti.', v_tot;
end $verifica$;

insert into applied_migrations (version, name)
values ('20260831000007', 'il_magazzino_dice_il_suo_mondo') on conflict (version) do nothing;
