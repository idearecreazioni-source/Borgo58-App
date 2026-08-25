-- ============================================================================
-- GLI ALLERGENI DEDOTTI VALGONO COME CONFERMATI — 25/08/2026
-- ============================================================================
--
-- ✅ DECISIONE DI ALESSIO, e corregge una regola introdotta senza mandato
--    poche ore prima:
--
--      «Gli allergeni dedotti sono da considerarsi CONFERMATI. L'origine
--       — etichetta, fonte nominata, dedotto, messo da Alessio — serve a
--       INFORMARE il cameriere quando un cliente chiede, non a bloccare
--       niente.»
--
--    Quindi un prodotto con un allergene dedotto **non resta "da
--    verificare"**, e i piatti che lo usano **non escono dal menu
--    stampato**.
--
-- ⚠️ COSA NON CAMBIA, ed e' la meta' che era giusta: la distinzione
--    dell'origine RESTA. `allergeni_prodotto`, `allergeni_con_origine` e
--    le quattro letture che la sala legge al tavolo non si toccano. Cambia
--    solo che quella distinzione smette di **impedire**.
--
-- ----------------------------------------------------------------------------
-- LA CURA STA IN UN POSTO SOLO, e non e' una comodita'
-- ----------------------------------------------------------------------------
-- Il segno `allergeni_da_verificare` nasce qui e arriva in **22 punti**
-- del gestionale, in **7 file**, di cui **15 dentro le schermate**
-- (contati, non stimati). Fra questi: il menu stampato — che svuotava
-- l'elenco allergeni —, l'asterisco accanto al nome del piatto, la riga
-- delle tracce, due filtri «senza glutine», due contatori di quelli
-- esclusi, e la scheda che il personale legge in cucina.
--
-- Correggerli uno per uno vorrebbe dire «trovarli tutti», e il
-- ventitreesimo che nascera' domani ricomincerebbe. Qui invece cambia la
-- definizione del segno, e i 22 punti si sistemano insieme.
--
-- ⚠️ **IL 22 E' UN PAVIMENTO, NON UN TOTALE**: sono i richiami che
--    NOMINANO quel segno. Uno che lo guardasse per interposta persona —
--    una funzione che lo riceve gia' calcolato, una vista che lo
--    incorpora — non comparirebbe in quel conto.
--
-- ----------------------------------------------------------------------------
-- 🔴 QUELLO CHE RESTA BLOCCANTE, E PERCHE' NON L'HO TOCCATO
-- ----------------------------------------------------------------------------
-- Restano «da verificare» gli ingredienti la cui origine e' **vuota**:
-- `origine_allergeni is null`. La decisione di Alessio parla dei
-- **dedotti** — cioe' di un caso in cui *qualcuno ha guardato*, foss'anche
-- una macchina — e un'origine vuota e' una cosa diversa: **nessuno ha
-- guardato**. Estenderla anche a quel caso sarebbe decidere al posto suo
-- su un filtro che risponde a un celiaco.
--
-- ⚠️ MA C'E' UN DIFETTO DENTRO QUEL CASO, ed e' mio: l'origine vuota oggi
--    mescola DUE situazioni molto diverse —
--      · nessuno ha mai guardato quel prodotto;
--      · **gli allergeni li ha scritti Alessio a mano** dalla scheda, che
--        e' la fonte piu' affidabile che esista.
--    Nella seconda il gestionale si contraddice gia' da stasera:
--    `allergeni_con_origine` risponde alla sala «Verificato da Alessio»
--    per lo stesso allergene che questa vista chiama «da verificare».
--    Due posti che dicono cose opposte dello stesso fatto.
--    **Dichiarato e non chiuso**: la cura vuole una decisione di Alessio,
--    ed e' fra le domande del riepilogo.
-- ============================================================================

-- ⚠️ Corpo ripreso VIVO dal database (`pg_get_viewdef`), non dal file che
--    l'ha creata: fra i due ci stanno tutte le migrazioni che l'hanno
--    toccata. Cambia una parola in due righe — `stimati` entra fra le
--    origini che vanno bene.
create or replace view v_recipe_allergens as
 WITH RECURSIVE reachable AS (
         SELECT ri.recipe_id AS root_recipe_id,
            ri.ingredient_id,
            ri.component_recipe_id,
            1 AS depth
           FROM recipe_ingredients ri
        UNION ALL
         SELECT r.root_recipe_id,
            ri2.ingredient_id,
            ri2.component_recipe_id,
            r.depth + 1
           FROM reachable r
             JOIN recipe_ingredients ri2 ON ri2.recipe_id = r.component_recipe_id
          WHERE r.component_recipe_id IS NOT NULL AND r.depth < 10
        )
 SELECT reachable.root_recipe_id AS recipe_id,
    COALESCE(array_agg(DISTINCT a.a ORDER BY a.a) FILTER (WHERE a.a IS NOT NULL), '{}'::allergen[]) AS allergens,
    -- 🔴 `stimati` E' ENTRATO QUI il 25/08: un allergene dedotto vale come
    -- confermato, per decisione di Alessio. Prima faceva scattare il segno,
    -- e il segno svuotava l'elenco allergeni sul menu stampato.
    COALESCE(bool_or(COALESCE(i.origine_allergeni, 'mai_guardati'::text) <> ALL (ARRAY['confermati'::text, 'etichetta'::text, 'stimati'::text])), false) AS allergeni_da_verificare,
    COALESCE(array_agg(DISTINCT i.name) FILTER (WHERE COALESCE(i.origine_allergeni, 'mai_guardati'::text) <> ALL (ARRAY['confermati'::text, 'etichetta'::text, 'stimati'::text])), '{}'::text[]) AS ingredienti_da_verificare,
    COALESCE(array_agg(DISTINCT t.t ORDER BY t.t) FILTER (WHERE t.t IS NOT NULL AND NOT (t.t = ANY (i.allergens))), '{}'::allergen[]) AS tracce
   FROM reachable
     JOIN ingredients i ON i.id = reachable.ingredient_id
     LEFT JOIN LATERAL unnest(i.allergens) a(a) ON true
     LEFT JOIN LATERAL unnest(i.allergeni_tracce) t(t) ON true
  GROUP BY reachable.root_recipe_id;

comment on view v_recipe_allergens is
  'Gli allergeni di un piatto, risalendo le preparazioni. `allergeni_da_verificare` dice che almeno un ingrediente non l''ha guardato nessuno — NON che sia stato dedotto: dal 25/08/2026 un allergene dedotto vale come confermato (decisione di Alessio), e l''origine serve a informare chi e'' in sala, non a impedire la stampa del menu.';

-- ============================================================================
-- VERIFICA
-- ============================================================================
-- ⚠️ Il perimetro e' fatto di roba creata qui: una ricetta propria e due
--    ingredienti propri, mai quelli di Alessio (lezione del 16/08).
do $verifica$
declare
  v_tit    uuid;
  v_ent    uuid;
  v_ric    uuid;
  v_ded    uuid;
  v_muto   uuid;
  v_r      record;
  v_n      integer;
  v_lapidi_pre  integer;
  v_lapidi_post integer;
begin
  select count(*) into v_lapidi_pre from deleted_records;

  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  if v_tit is null then raise exception 'Nessun titolare in user_roles.'; end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);

  select id into v_ent from entities order by created_at limit 1;
  if v_ent is null then raise exception 'Nessuna societa''.'; end if;

  -- Un ingrediente coi soli allergeni DEDOTTI...
  insert into ingredients (entity_id, name, category, unit, current_price, allergens, origine_allergeni)
  values (v_ent, 'ZZ dedotto', 'farine_cereali', 'kg', 1, array['glutine']::allergen[], 'stimati')
  returning id into v_ded;

  -- ...e uno che non ha mai guardato nessuno.
  insert into ingredients (entity_id, name, category, unit, current_price, allergens, origine_allergeni)
  values (v_ent, 'ZZ mai guardato', 'altro', 'kg', 1, '{}'::allergen[], null)
  returning id into v_muto;

  -- ⚠️ `recipes` NON ha `entity_id`: la ricetta appartiene al Ricettario,
  --    non a una societa'. Chiesto al catalogo invece di darlo per
  --    scontato — il primo tentativo di questa verifica si e' fermato
  --    proprio li'.
  insert into recipes (name, category)
  values ('ZZ piatto col dedotto', 'primo')
  returning id into v_ric;

  insert into recipe_ingredients (recipe_id, ingredient_id, quantity, unit)
  values (v_ric, v_ded, 1, 'kg');

  -- ------------------------------------------------------------------
  -- (A) IL CASO DEL MANDATO: un piatto col solo allergene dedotto NON e'
  --     piu' «da verificare», e il suo glutine arriva al menu.
  -- ------------------------------------------------------------------
  select * into v_r from v_recipe_allergens where recipe_id = v_ric;
  if v_r.allergeni_da_verificare then
    raise exception 'Un piatto col solo allergene dedotto risulta ancora «da verificare»: sul menu stampato il suo elenco verrebbe svuotato.';
  end if;
  if not ('glutine' = any(v_r.allergens)) then
    raise exception 'Il glutine dedotto non arriva nell''elenco del piatto';
  end if;
  if array_length(v_r.ingredienti_da_verificare, 1) is not null then
    raise exception 'Il piatto elenca ingredienti da verificare che non ci sono: %', v_r.ingredienti_da_verificare;
  end if;

  -- ------------------------------------------------------------------
  -- (B) IL VERSO OPPOSTO, senza cui la regola non distinguerebbe niente:
  --     un ingrediente che NON ha guardato nessuno continua a far
  --     scattare il segno. Se sparisse anche questo, la vista
  --     risponderebbe sempre «tutto a posto» e nessuno se ne
  --     accorgerebbe — e sotto c'e' un filtro che risponde a un celiaco.
  -- ------------------------------------------------------------------
  insert into recipe_ingredients (recipe_id, ingredient_id, quantity, unit)
  values (v_ric, v_muto, 1, 'kg');

  select * into v_r from v_recipe_allergens where recipe_id = v_ric;
  if not v_r.allergeni_da_verificare then
    raise exception 'Un ingrediente che non ha guardato nessuno non fa piu'' scattare il segno: la vista risponderebbe sempre «tutto a posto».';
  end if;
  if not ('ZZ mai guardato' = any(v_r.ingredienti_da_verificare)) then
    raise exception 'Il segno scatta ma non dice quale ingrediente: %', v_r.ingredienti_da_verificare;
  end if;
  -- ⚠️ E nomina SOLO quello: il dedotto non deve piu' comparire.
  if 'ZZ dedotto' = any(v_r.ingredienti_da_verificare) then
    raise exception 'L''ingrediente dedotto e'' ancora fra quelli da verificare';
  end if;

  -- ------------------------------------------------------------------
  -- Pulizia — per identificativo, figlie prima delle madri
  -- ------------------------------------------------------------------
  delete from recipe_ingredients where recipe_id = v_ric;
  delete from recipes where id = v_ric;
  delete from ingredients where id in (v_ded, v_muto);

  select count(*) into v_n from ingredients where id in (v_ded, v_muto);
  if v_n <> 0 then raise exception 'Sono rimasti % ingredienti della verifica', v_n; end if;
  select count(*) into v_n from recipes where id = v_ric;
  if v_n <> 0 then raise exception 'E'' rimasta la ricetta della verifica'; end if;

  select count(*) into v_lapidi_post from deleted_records;
  if v_lapidi_post <> v_lapidi_pre then
    raise exception 'La verifica ha lasciato % lapidi', v_lapidi_post - v_lapidi_pre;
  end if;

  perform set_config('request.jwt.claims', null, true);

  raise notice 'Un allergene dedotto vale come confermato: il piatto non e'' piu'' «da verificare» e il suo elenco arriva al menu. Un ingrediente che non ha guardato nessuno continua a farlo scattare.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260825000018', 'gli_allergeni_dedotti_valgono')
on conflict (version) do nothing;
