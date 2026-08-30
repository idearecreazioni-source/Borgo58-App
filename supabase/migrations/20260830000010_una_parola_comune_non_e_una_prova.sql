-- =====================================================================
-- UNA PAROLA IN COMUNE NON È UNA PROVA — 30/08/2026
-- =====================================================================
--
-- 🔴 TROVATO GUARDANDO LA SCHERMATA, non rileggendo. La proposta di
-- abbinamento nata un'ora fa funzionava — il prodotto giusto usciva primo,
-- con tre parole in comune — **e sotto ne metteva altre cinque che non
-- c'entravano niente**: su «Nero d'Avola» proponeva «Cece nero», «Gelso
-- nero», «Maialino nero dei Nebrodi».
--
-- MISURATO sul progetto di prova: delle proposte per «Nero d'Avola»,
-- **10 su 12** poggiavano su **una parola sola**; e quella parola, «nero»,
-- sta in **5 prodotti**. Su «Etna Rosso» erano **8 su 8**, tutte per
-- «rosso», che sta in 4.
--
-- ⚠️ E NON È UN DIFETTO DA POCO, perché il commento che avevo scritto un'ora
-- prima diceva già cosa sarebbe successo: *«una proposta a caso si accetta
-- guardando di sfuggita, e da lì in poi il magazzino scarica il vino
-- sbagliato senza che nessun errore lo dica»*. La regola c'era, il filtro no.
--
-- 🔴 LA REGOLA NUOVA, e non è una soglia inventata: **una proposta ha bisogno
-- o di QUANTITÀ o di SPECIFICITÀ**.
--   · **due parole in comune** — due coincidenze non sono un caso; oppure
--   · **una parola sola, ma che appartiene a UN PRODOTTO SOLO** — «zibibbo»
--     sta in un prodotto e basta, quindi identifica; «nero» sta in cinque e
--     non identifica niente.
-- ⚠️ **Non c'è nessun numero magico da tarare**: «appartiene a un prodotto
--    solo» è una proprietà dei dati, non una soglia scelta a occhio, e
--    resta vera il giorno che i prodotti saranno mille. È la lezione del
--    16/08 — *un guardiano deve esprimere una proprietà, non una quantità*.
--
-- ✅ COSA CAMBIA, misurato dopo: «Nero d'Avola» passa da 12 proposte a
--    quelle che hanno davvero qualcosa; «Zibibbo secco» tiene la sua, perché
--    «zibibbo» identifica; «Etna Rosso» ne perde tutte e otto, ed è giusto —
--    quel prodotto in magazzino non c'è.

create or replace function abbinamenti_carta_proposti(p_bar_item_id uuid default null)
returns table (
  bar_item_id     uuid,
  voce            text,
  serving         text,
  produttore_carta text,
  ingredient_id   uuid,
  prodotto        text,
  parole_in_comune integer,
  confezioni      jsonb,
  ultimo_prezzo   numeric
)
language plpgsql
stable
security definer
set search_path = public
as $function$
begin
  if not (select is_titolare()) then
    raise exception 'Le proposte di abbinamento le vede solo il titolare: contengono i prezzi d''acquisto.';
  end if;

  return query
  with prodotti as (
    select i.id, i.name,
           array(select w from unnest(string_to_array(nome_ingrediente_chiave(i.name), ' ')) w
                  where length(w) > 2) as parole
      from ingredients i
     where i.active and i.alimentare and i.preparazione_id is null
  ),
  -- 🔴 QUANTO IDENTIFICA UNA PAROLA: in quanti prodotti compare. Si conta,
  --    non si decide.
  peso as (
    select w, count(*)::integer as in_quanti
      from prodotti p, unnest(p.parole) w
     group by w
  ),
  voci as (
    select b.id, b.name, b.serving, b.producer,
           array(select w from unnest(string_to_array(nome_ingrediente_chiave(b.name), ' ')) w
                  where length(w) > 2) as parole
      from bar_items b
     where b.ingredient_id is null and b.active
       and (p_bar_item_id is null or b.id = p_bar_item_id)
  ),
  candidati as (
    select v.id, v.name, v.serving, v.producer, p.id as ing, p.name as prodotto,
           array(select unnest(v.parole) intersect select unnest(p.parole)) as comuni
      from voci v cross join prodotti p
  ),
  vagliati as (
    select c.*,
           cardinality(c.comuni) as quante,
           -- specificità: la parola in comune più rara appartiene a UN solo
           -- prodotto?
           (select min(pe.in_quanti) from peso pe where pe.w = any(c.comuni)) as la_piu_rara
      from candidati c
     where cardinality(c.comuni) > 0
  )
  select v.id, v.name, v.serving, v.producer, v.ing, v.prodotto, v.quante,
         coalesce((
           select jsonb_agg(jsonb_build_object(
                    'marca', a.marca, 'formato', a.formato,
                    'descrizione', a.descrizione, 'fornitore', s.name)
                  order by a.aggiornato_il desc)
             from articoli_fornitore a
             left join suppliers s on s.id = a.supplier_id
            where a.ingredient_id = v.ing and not a.ignora
         ), '[]'::jsonb),
         nullif((select i2.current_price from ingredients i2 where i2.id = v.ing), 0)
    from vagliati v
   -- O QUANTITÀ (due parole) O SPECIFICITÀ (una parola che sta in un
   -- prodotto solo). Niente altro passa.
   where v.quante >= 2 or v.la_piu_rara = 1
   order by v.id, v.quante desc, v.la_piu_rara, v.prodotto;
end;
$function$;

-- ⚠️ `create or replace` con la stessa firma CONSERVA i permessi. Non si
--    riscrive nessun `grant` a memoria: la verifica li misura.

do $verifica$
declare
  v_foto  jsonb := foto_righe();
  v_ent   uuid;
  v_tit   uuid;
  v_n     integer;
  v_prod  text;
begin
  select id into v_ent from entities order by created_at limit 1;
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  if v_ent is null or v_tit is null then
    raise exception 'Manca la societa'' o il titolare: impossibile verificare.';
  end if;

  -- I permessi: `create or replace` li conserva, e qui si controlla.
  if not has_function_privilege('authenticated', 'abbinamenti_carta_proposti(uuid)', 'execute') then
    raise exception 'La proposta non e'' piu'' leggibile da chi usa il gestionale.';
  end if;
  if has_function_privilege('anon', 'abbinamenti_carta_proposti(uuid)', 'execute') then
    raise exception 'La proposta e'' diventata leggibile con la chiave pubblica.';
  end if;

  -- 🔴 LA VERIFICA NON CANCELLA, ANNULLA (30/08).
  begin
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);

    -- ⚠️ L'ESEMPIO È COSTRUITO PERCHÉ LE DUE RISPOSTE SBAGLIATE SIANO
    --    DIVERSE FRA LORO (19/08). Tre prodotti che condividono la parola
    --    «zzverde» — quindi comune, tre volte — e uno che condivide
    --    «zzbarolino», che sta in un prodotto solo.
    insert into ingredients (name, category, unit, current_price, entity_id, alimentare, tenuto_in_magazzino)
    values ('ZZ zzverde uno',  'verdura', 'kg', 1, v_ent, true, true),
           ('ZZ zzverde due',  'verdura', 'kg', 1, v_ent, true, true),
           ('ZZ zzverde tre',  'verdura', 'kg', 1, v_ent, true, true),
           ('ZZ zzbarolino solo', 'bevande', 'pz', 9, v_ent, true, true);

    -- (1) UNA PAROLA COMUNE NON BASTA. «zzverde» sta in tre prodotti.
    insert into bar_items (section, category, name, serving, selling_price)
    values ('vini', 'ZZ prova', 'zzverde qualcosa', 'Bottiglia', 10);
    select count(*) into v_n from abbinamenti_carta_proposti() where voce = 'zzverde qualcosa';
    if v_n <> 0 then
      raise exception 'Con una sola parola comune escono % proposte: doveva non uscirne nessuna.', v_n;
    end if;

    -- (2) UNA PAROLA RARA BASTA. «zzbarolino» sta in un prodotto solo.
    insert into bar_items (section, category, name, serving, selling_price)
    values ('vini', 'ZZ prova', 'zzbarolino della casa', 'Bottiglia', 12);
    select count(*), max(prodotto) into v_n, v_prod
      from abbinamenti_carta_proposti() where voce = 'zzbarolino della casa';
    if v_n <> 1 or v_prod is distinct from 'ZZ zzbarolino solo' then
      raise exception 'Con una parola che identifica escono % proposte («%»): ne doveva uscire 1, quella giusta.',
        v_n, coalesce(v_prod, '(nessuna)');
    end if;

    -- (3) DUE PAROLE COMUNI BASTANO, anche se nessuna identifica da sola.
    --     Senza questo controllo, una regola che pretendesse SEMPRE una
    --     parola rara passerebbe i due controlli qui sopra.
    insert into bar_items (section, category, name, serving, selling_price)
    values ('vini', 'ZZ prova', 'zzverde due bottiglia', 'Bottiglia', 11);
    select count(*) into v_n from abbinamenti_carta_proposti()
     where voce = 'zzverde due bottiglia' and prodotto = 'ZZ zzverde due';
    if v_n <> 1 then
      raise exception 'Con due parole in comune la proposta giusta non esce (trovate %).', v_n;
    end if;

    raise exception 'ZZ_ANNULLA' using errcode = 'P0001';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'ZZ_ANNULLA' then raise; end if;
  end;

  perform set_config('request.jwt.claims', null, true);

  select count(*) into v_n from ingredients where name like 'ZZ zz%';
  if v_n > 0 then raise exception 'Sono rimasti % prodotti: l''annullamento non ha funzionato.', v_n; end if;
  select count(*) into v_n from pg_trigger t where t.tgenabled = 'D' and not t.tgisinternal;
  if v_n > 0 then raise exception '% trigger sono spenti.', v_n; end if;

  perform pretendi_nessun_residuo(v_foto, 'la verifica della parola che identifica');
  raise notice 'Fatto: una parola comune non basta; una parola che identifica un prodotto solo si.';
end
$verifica$;

insert into applied_migrations (version, name)
values ('20260830000010', 'una_parola_comune_non_e_una_prova') on conflict (version) do nothing;
