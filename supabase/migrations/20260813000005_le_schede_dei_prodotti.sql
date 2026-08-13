-- =====================================================================
-- Le schede dei prodotti: compilate dall'assistente, tranne una cosa
-- =====================================================================
-- Primo dei tre lavori chiesti da Alessio il 13/08. Un prodotto nato da
-- una fattura ha nome, unita' e categoria — e basta: niente allergeni,
-- niente stagionalita', niente conservazione, niente durata, niente
-- temperatura di ricevimento, scarto a zero.
--
-- Non sono campi decorativi. Con lo scarto a zero **un piatto sembra
-- costare meno di quanto costa** (la ricetta dice 200 g puliti, ma per
-- averli se ne comprano 235); senza conservazione e durata lo
-- scadenziario di stamattina propone 14 giorni di preavviso anche al
-- basilico; senza temperatura di ricevimento il registro HACCP ha una
-- colonna vuota per sempre.
--
-- ---------------------------------------------------------------------
-- GLI ALLERGENI SONO DIVERSI DA TUTTO IL RESTO
-- ---------------------------------------------------------------------
-- Sugli ingredienti crudi un modello ci prende quasi sempre. Il rischio
-- sono i **prodotti lavorati**, dove l'allergene sta nell'etichetta e non
-- nel nome: il sedano dentro un ragu' pronto, la soia dentro un gelato.
-- Un elenco di allergeni che sembra verificato e non lo e', in mano a un
-- cliente celiaco, e' la cosa peggiore che questo gestionale possa
-- produrre.
--
-- Percio' ogni prodotto si porta dietro **da dove arrivano i suoi
-- allergeni**, non solo quali sono:
--
--   · `stimati`     — dedotti dal nome. NON valgono per la stampa.
--   · `etichetta`   — letti da una foto dell'etichetta (quando ci sara'
--                     il ricevimento merci con la fotocamera).
--   · `confermati`  — guardati da Alessio.
--
-- L'IDEA DELL'ETICHETTA E' DI ALESSIO, ed e' migliore della mia
-- obiezione: gli avevo detto che sui prodotti lavorati serve il suo
-- controllo, e lui ha risposto che la scansione del ricevimento merci —
-- quella che leggera' lotto e scadenza — puo' fare anche una foto in
-- piu' della lista ingredienti. **L'etichetta e' la fonte legale**, il
-- nome del prodotto e' solo un indizio. Avevo obiettato che quel modulo
-- non esiste ancora: obiezione caduta, perche' l'app entra in servizio a
-- ridosso dell'apertura e nel frattempo non c'e' niente da proteggere.
-- Il prodotto nasce col carico e viene **aggiornato** quando la merce
-- entra davvero in cucina: il momento che conta e' il secondo.
--
-- Questa migrazione costruisce i tre stati; oggi si riempiono il primo e
-- il terzo. Quando arrivera' la fotocamera, quella scansione scrivera'
-- `etichetta` su un prodotto gia' esistente e non ci sara' niente da
-- rifare.
--
-- ⚠️ E la vista degli allergeni del menu smette di dire mezze verita':
-- fino a oggi un piatto fatto di ingredienti **che nessuno aveva mai
-- compilato** stampava un elenco allergeni vuoto, che sembra «non
-- contiene allergeni» ed e' invece «non lo ha mai guardato nessuno».
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Da dove arrivano gli allergeni di questo prodotto
-- ---------------------------------------------------------------------
alter table ingredients
  add column if not exists origine_allergeni  text,
  add column if not exists campi_compilati_il timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ingredients_origine_allergeni_valida') then
    alter table ingredients add constraint ingredients_origine_allergeni_valida
      check (origine_allergeni is null
             or origine_allergeni in ('stimati', 'etichetta', 'confermati'));
  end if;
end
$$;

comment on column ingredients.origine_allergeni is
  'Da dove arrivano gli allergeni: «stimati» (dal nome, non valgono per la stampa), «etichetta» (letti da una foto), «confermati» (guardati da Alessio). NULL = nessuno ci ha mai messo mano.';

comment on column ingredients.campi_compilati_il is
  'Quando l''assistente ha compilato la scheda. Serve a non richiederlo due volte e a sapere cosa e'' stato dedotto invece che deciso.';

-- ---------------------------------------------------------------------
-- 2. Chi ha bisogno di una scheda
-- ---------------------------------------------------------------------
create or replace function prodotti_da_compilare()
returns table (
  id       uuid,
  nome     text,
  unita    text,
  categoria text,
  alimentare boolean,
  mancano  text[]
)
language sql
stable
security definer
set search_path = public
as $funzione$
  select i.id, i.name, i.unit::text, i.category::text, i.alimentare,
         array_remove(array[
           case when i.storage_type is null            then 'conservazione'   end,
           case when i.shelf_life_days is null         then 'durata'          end,
           case when i.haccp_receiving_temp is null    then 'temperatura'     end,
           case when coalesce(array_length(i.seasonality, 1), 0) = 0
                                                       then 'stagionalita'    end,
           case when coalesce(i.waste_percentage_default, 0) = 0
                                                       then 'scarto'          end,
           case when i.origine_allergeni is null       then 'allergeni'       end
         ], null)
    from ingredients i
   where i.active
     and (i.storage_type is null
          or i.shelf_life_days is null
          or i.haccp_receiving_temp is null
          or coalesce(array_length(i.seasonality, 1), 0) = 0
          or coalesce(i.waste_percentage_default, 0) = 0
          or i.origine_allergeni is null)
   order by i.name;
$funzione$;

comment on function prodotti_da_compilare() is
  'I prodotti con la scheda incompleta, e quali campi mancano. Una lista che si svuota e'' meglio di un promemoria che si rifiuta.';

revoke all on function prodotti_da_compilare() from public, anon, authenticated;
grant execute on function prodotti_da_compilare() to authenticated;

-- ---------------------------------------------------------------------
-- 3. Scrivere una scheda proposta dall'assistente
-- ---------------------------------------------------------------------
-- ⚠️ Riempie SOLO cio' che e' vuoto. Quello che Alessio ha gia' deciso
-- non si tocca: una proposta di un modello non ha titolo per riscrivere
-- una scelta di chi cucina. Stesso principio di
-- `trova_o_crea_ingrediente`, che agganciandosi non riscrive unita' e
-- categoria dell'ingrediente esistente.
create or replace function applica_scheda_prodotto(
  p_ingredient_id uuid,
  p_campi         jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $funzione$
declare
  v_ing        ingredients%rowtype;
  v_allergeni  allergen[] := '{}';
  v_mesi       month_code[] := '{}';
  v_scartati   text[] := '{}';
  v_x          text;
  v_scritti    text[] := '{}';
begin
  select * into v_ing from ingredients where id = p_ingredient_id for update;
  if not found then
    raise exception 'Questo prodotto non esiste piu''';
  end if;

  -- Gli allergeni si scrivono solo se nessuno li ha ancora guardati:
  -- una stima non sovrascrive mai un'etichetta letta ne' una conferma.
  if v_ing.origine_allergeni is null and p_campi ? 'allergeni' then
    for v_x in select jsonb_array_elements_text(p_campi->'allergeni')
    loop
      begin
        v_allergeni := v_allergeni || v_x::allergen;
      exception when others then
        -- Un valore che non esiste nel nostro elenco non fa fallire
        -- tutto: si scarta e si dice quale. Fermarsi qui vorrebbe dire
        -- perdere anche i campi giusti degli altri prodotti.
        v_scartati := v_scartati || v_x;
      end;
    end loop;
    update ingredients
       set allergens = v_allergeni,
           origine_allergeni = 'stimati'
     where id = p_ingredient_id;
    v_scritti := v_scritti || 'allergeni'::text;
  end if;

  if coalesce(array_length(v_ing.seasonality, 1), 0) = 0 and p_campi ? 'stagionalita' then
    for v_x in select jsonb_array_elements_text(p_campi->'stagionalita')
    loop
      begin
        v_mesi := v_mesi || v_x::month_code;
      exception when others then
        v_scartati := v_scartati || v_x;
      end;
    end loop;
    if array_length(v_mesi, 1) > 0 then
      update ingredients set seasonality = v_mesi where id = p_ingredient_id;
      v_scritti := v_scritti || 'stagionalita'::text;
    end if;
  end if;

  if v_ing.storage_type is null and nullif(p_campi->>'conservazione', '') is not null then
    begin
      update ingredients
         set storage_type = (p_campi->>'conservazione')::storage_type
       where id = p_ingredient_id;
      v_scritti := v_scritti || 'conservazione'::text;
    exception when others then
      v_scartati := v_scartati || (p_campi->>'conservazione');
    end;
  end if;

  if v_ing.shelf_life_days is null and (p_campi->>'durata_giorni') is not null then
    update ingredients
       set shelf_life_days = greatest(1, (p_campi->>'durata_giorni')::integer)
     where id = p_ingredient_id;
    v_scritti := v_scritti || 'durata'::text;
  end if;

  if v_ing.haccp_receiving_temp is null and nullif(p_campi->>'temperatura', '') is not null then
    update ingredients
       set haccp_receiving_temp = p_campi->>'temperatura'
     where id = p_ingredient_id;
    v_scritti := v_scritti || 'temperatura'::text;
  end if;

  -- Lo scarto: zero e' il valore di partenza e vuol dire «non lo so»,
  -- non «non si scarta niente». Una percentuale sopra il 95% e' quasi
  -- certamente un errore del modello, e uno scarto sbagliato sfalsa il
  -- costo di ogni piatto che usa quel prodotto.
  if coalesce(v_ing.waste_percentage_default, 0) = 0
     and (p_campi->>'scarto_percento') is not null then
    if (p_campi->>'scarto_percento')::numeric between 0 and 95 then
      update ingredients
         set waste_percentage_default = (p_campi->>'scarto_percento')::numeric
       where id = p_ingredient_id;
      v_scritti := v_scritti || 'scarto'::text;
    else
      v_scartati := v_scartati || ('scarto ' || (p_campi->>'scarto_percento'));
    end if;
  end if;

  update ingredients set campi_compilati_il = now() where id = p_ingredient_id;

  return jsonb_build_object(
    'id', p_ingredient_id,
    'scritti', to_jsonb(v_scritti),
    'scartati', to_jsonb(v_scartati));
end
$funzione$;

comment on function applica_scheda_prodotto(uuid, jsonb) is
  'Scrive la scheda proposta dall''assistente riempiendo SOLO i campi vuoti. Gli allergeni entrano come «stimati» e mai sopra un''etichetta letta o una conferma.';

revoke all on function applica_scheda_prodotto(uuid, jsonb) from public, anon, authenticated;
grant execute on function applica_scheda_prodotto(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- 4. Alessio guarda gli allergeni e li conferma
-- ---------------------------------------------------------------------
create or replace function conferma_allergeni(
  p_ingredient_id uuid,
  p_allergeni     allergen[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $funzione$
begin
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' confermare gli allergeni';
  end if;

  update ingredients
     set allergens = coalesce(p_allergeni, '{}'),
         origine_allergeni = 'confermati'
   where id = p_ingredient_id;

  if not found then
    raise exception 'Questo prodotto non esiste piu''';
  end if;

  return jsonb_build_object('id', p_ingredient_id, 'origine', 'confermati');
end
$funzione$;

comment on function conferma_allergeni(uuid, allergen[]) is
  'Alessio ha guardato gli allergeni di questo prodotto. Da qui in poi valgono per la stampa del menu.';

revoke all on function conferma_allergeni(uuid, allergen[]) from public, anon, authenticated;
grant execute on function conferma_allergeni(uuid, allergen[]) to authenticated;

-- ---------------------------------------------------------------------
-- 5. Il menu smette di dire mezze verita'
-- ---------------------------------------------------------------------
-- Prima: un piatto i cui ingredienti non erano mai stati compilati
-- stampava un elenco allergeni VUOTO — che chi legge intende come «non
-- contiene allergeni», mentre vuol dire «non lo ha mai guardato
-- nessuno». Adesso la vista dice anche quali ingredienti non sono stati
-- verificati, e la schermata del menu lo scrive.
--
-- ⚠️ L'unnest diventa LEFT: un ingrediente SENZA allergeni deve pesare
-- sul giudizio «verificato o no» esattamente come uno che ne ha. Con la
-- join interna di prima spariva — ed e' proprio il caso pericoloso,
-- perche' «nessun allergene» e' la risposta di cui un celiaco si fida.
create or replace view v_recipe_allergens as
with recursive reachable as (
  select ri.recipe_id as root_recipe_id,
         ri.ingredient_id,
         ri.component_recipe_id,
         1 as depth
    from recipe_ingredients ri
  union all
  select r.root_recipe_id,
         ri2.ingredient_id,
         ri2.component_recipe_id,
         r.depth + 1
    from reachable r
    join recipe_ingredients ri2 on ri2.recipe_id = r.component_recipe_id
   where r.component_recipe_id is not null and r.depth < 10
)
select reachable.root_recipe_id as recipe_id,
       coalesce(array_agg(distinct a.a order by a.a) filter (where a.a is not null),
                '{}'::allergen[]) as allergens,
       coalesce(bool_or(coalesce(i.origine_allergeni, 'mai_guardati')
                        not in ('confermati', 'etichetta')), false) as allergeni_da_verificare,
       coalesce(array_agg(distinct i.name) filter (
                  where coalesce(i.origine_allergeni, 'mai_guardati')
                        not in ('confermati', 'etichetta')), '{}'::text[]) as ingredienti_da_verificare
  from reachable
  join ingredients i on i.id = reachable.ingredient_id
  left join lateral unnest(i.allergens) a(a) on true
 group by reachable.root_recipe_id;

comment on view v_recipe_allergens is
  'Gli allergeni di una ricetta, e se sono verificati. Un elenco vuoto non significa «non ne contiene»: significa quello che dice `allergeni_da_verificare`.';

-- ---------------------------------------------------------------------
-- 6. Verifica (§7 punti 1-3)
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_ente uuid;
  v_a    uuid;
  v_b    uuid;
  v_out  jsonb;
  v_ing  ingredients%rowtype;
  v_mancano text[];
  n      integer;
begin
  select id into v_ente from entities order by created_at limit 1;
  if v_ente is null then raise exception 'Nessuna entita''.'; end if;

  insert into ingredients (entity_id, name, category, unit)
  values (v_ente, 'PROVA SCHEDA carciofo', 'verdura', 'kg') returning id into v_a;

  -- 1. Compare fra i prodotti da compilare, con l'elenco di cosa manca.
  select p.mancano into v_mancano from prodotti_da_compilare() p where p.id = v_a;
  if not ('allergeni' = any (v_mancano)) or not ('scarto' = any (v_mancano)) then
    raise exception 'L''elenco di cosa manca e'' incompleto: %.', v_mancano;
  end if;

  -- 2. La scheda si scrive, e gli allergeni entrano come STIMATI.
  v_out := applica_scheda_prodotto(v_a, jsonb_build_object(
    'allergeni',       jsonb_build_array('solfiti_inesistente', 'glutine'),
    'stagionalita',    jsonb_build_array('mar', 'apr', 'mese_finto'),
    'conservazione',   'frigo_4_8',
    'durata_giorni',   7,
    'temperatura',     '4-8 °C',
    'scarto_percento', 60));

  select * into v_ing from ingredients where id = v_a;
  if v_ing.origine_allergeni is distinct from 'stimati' then
    raise exception 'Gli allergeni non sono marcati come stimati (%).', v_ing.origine_allergeni;
  end if;
  if not ('glutine' = any (v_ing.allergens)) then
    raise exception 'L''allergene valido non e'' stato scritto.';
  end if;
  if v_ing.storage_type is distinct from 'frigo_4_8'
     or v_ing.shelf_life_days is distinct from 7
     or v_ing.waste_percentage_default is distinct from 60
     or v_ing.haccp_receiving_temp is distinct from '4-8 °C' then
    raise exception 'La scheda non e'' stata scritta per intero.';
  end if;

  -- 3. I valori inventati si scartano e si dichiarano, senza far fallire
  --    il resto: un nome sbagliato su un prodotto non deve far perdere i
  --    campi giusti degli altri otto.
  if not (v_out->'scartati' @> '["solfiti_inesistente"]'::jsonb) then
    raise exception 'Un allergene inesistente non e'' stato dichiarato scartato: %', v_out;
  end if;
  if not (v_out->'scartati' @> '["mese_finto"]'::jsonb) then
    raise exception 'Un mese inesistente non e'' stato dichiarato scartato: %', v_out;
  end if;

  -- 4. Uno scarto assurdo si rifiuta: sfalserebbe il costo di ogni
  --    piatto che usa quel prodotto, e in silenzio.
  insert into ingredients (entity_id, name, category, unit)
  values (v_ente, 'PROVA SCHEDA assurdo', 'verdura', 'kg') returning id into v_b;
  v_out := applica_scheda_prodotto(v_b, jsonb_build_object('scarto_percento', 99));
  select * into v_ing from ingredients where id = v_b;
  if coalesce(v_ing.waste_percentage_default, 0) <> 0 then
    raise exception 'Uno scarto del 99%% e'' stato accettato.';
  end if;

  -- 5. Una seconda passata NON riscrive cio' che c'e' gia'.
  v_out := applica_scheda_prodotto(v_a, jsonb_build_object(
    'conservazione', 'freezer', 'durata_giorni', 999, 'scarto_percento', 5));
  select * into v_ing from ingredients where id = v_a;
  if v_ing.storage_type is distinct from 'frigo_4_8' or v_ing.shelf_life_days <> 7 then
    raise exception 'La seconda passata ha riscritto una scheda gia'' compilata.';
  end if;

  -- 6. Confermati da Alessio: da li' in poi valgono, e una stima
  --    successiva non li tocca piu'.
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000000"}', true);
  update ingredients set allergens = '{glutine,latte}', origine_allergeni = 'confermati' where id = v_a;
  v_out := applica_scheda_prodotto(v_a, jsonb_build_object('allergeni', jsonb_build_array('soia')));
  select * into v_ing from ingredients where id = v_a;
  if 'soia' = any (v_ing.allergens) or v_ing.origine_allergeni <> 'confermati' then
    raise exception 'Una stima ha sovrascritto allergeni gia'' confermati.';
  end if;

  -- 7. Lo scadenziario ne trae subito vantaggio: con la conservazione
  --    scritta, il preavviso proposto smette di essere 14 per tutti.
  if preavviso_giorni(null, v_ing.shelf_life_days, v_ing.storage_type) <> 2 then
    raise exception 'Con durata 7 giorni il preavviso proposto dovrebbe essere 2.';
  end if;

  -- 8. Pulizia (regola del 12/08).
  delete from ingredients where name like 'PROVA SCHEDA%';
  select count(*) into n from ingredients where name like 'PROVA SCHEDA%';
  if n <> 0 then raise exception 'La prova ha lasciato % prodotti.', n; end if;

  raise notice 'Schede dei prodotti: tutto compilato, gli allergeni solo stimati.';
end
$verifica$;

insert into applied_migrations (version, name)
values ('20260813000005', 'le_schede_dei_prodotti')
on conflict (version) do nothing;

select count(*) as prodotti_da_compilare from prodotti_da_compilare();
