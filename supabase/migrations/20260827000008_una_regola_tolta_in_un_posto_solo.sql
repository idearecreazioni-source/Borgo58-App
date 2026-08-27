-- ============================================================================
-- UNA REGOLA TOLTA IN UN POSTO SOLO — 27/08/2026
-- ============================================================================
--
-- 🔴 IL FATTO, misurato dalla storia e non dedotto. Il 25/08 Alessio decide:
--    *«gli allergeni dedotti sono da considerarsi CONFERMATI; l'origine
--    informa il cameriere, non blocca niente. La regola opposta e' stata
--    introdotta da Code senza mandato e VA RIMOSSA.»*
--
--    La rimozione e' stata fatta. **In un posto solo.**
--
--    · nella VISTA `v_recipe_allergens` — tolta, e li' un dedotto passa
--      davvero (misurato: `stimati` e' fra i valori accettati);
--    · nella SCHERMATA delle schede prodotto — rimasta, col titolo
--      «Allergeni da confermare», la frase «finche' non li confermi non
--      vengono usati per la stampa del menu», e «Confermo tutti» accanto;
--    · nel commento di questa COLONNA — rimasto: «(dal nome, non valgono
--      per la stampa)»;
--    · in un commento di `src/lib/api/schedeProdotto.js` — rimasto.
--
-- ⚠️ QUINDI NON E' «TORNATA»: non e' mai stata tolta da tre posti su
--    quattro. E la domanda del mandato — *se e' tornata, c'e' un modo per
--    cui una cosa tolta rientra* — ha una risposta diversa e piu' utile:
--    **una regola vive in piu' posti di quanti se ne toccano correggendola**,
--    e si toglie dal posto dove il difetto e' stato MISURATO. E' la stessa
--    famiglia della cura nata nella schermata dove il difetto e' stato visto
--    (18/08), qui letta al contrario: la cura e' nata nel database, dove il
--    difetto era stato misurato, e le parole sono rimaste indietro.
--
-- ⚠️ E le parole rimaste indietro non erano innocue: **dicevano una cosa
--    falsa sul gestionale**. Chi le leggeva credeva che confermare servisse
--    a qualcosa, e quel qualcosa gia' funzionava da se'.
--
-- ----------------------------------------------------------------------------
-- QUELLO CHE RESTA, ed e' il dato
-- ----------------------------------------------------------------------------
-- L'origine di ogni allergene **non sparisce**: e' la decisione del 24/08 e
-- serve al cameriere davanti a un cliente che chiede. Sparisce il cancello.
--
-- ⚠️ E resta anche l'unico caso che blocca ancora: l'origine **vuota**, cioe'
--    «non l'ha guardato nessuno» — che non e' un dedotto. La decisione del
--    25/08 lo dichiara e lo affida al sorvegliante notturno; finche' quello
--    non esiste, il comportamento provvisorio e' questo e va **detto**, non
--    taciuto.
-- ============================================================================

comment on column ingredients.origine_allergeni is
  'Da dove arrivano gli allergeni: «stimati» (dedotti dal nome), «etichetta» (letti da una foto), «fonte» (da una fonte consultata e nominata), «confermati» (guardati da Alessio). NULL = non ci ha mai messo mano nessuno. ⚠️ SERVE A INFORMARE CHI E'' IN SALA, NON A BLOCCARE: dal 25/08/2026 un allergene dedotto vale come confermato (decisione di Alessio) e finisce nel menu stampato come gli altri. L''unico caso che tiene ancora l''elenco fuori dal menu e'' il NULL — «non l''ha guardato nessuno» — che e'' un''altra cosa da «dedotto».';

-- ============================================================================
-- VERIFICA
-- ============================================================================
do $verifica$
declare
  v_foto   jsonb;
  v_tit    uuid;
  v_ent    uuid;
  v_ded    uuid;
  v_mai    uuid;
  v_r1     uuid;
  v_r2     uuid;
  v_ingr   text[] := '{}';
  v_ric    text[] := '{}';
  v_v      record;
begin
  v_foto := foto_righe();
  select id into v_ent from entities where entity_type = 'srls' limit 1;
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', v_tit)::text, true);

  -- (0) IL COMMENTO NON DICE PIU' LA COSA FALSA.
  --     ⚠️ Si guarda il catalogo, non il fatto di averlo appena scritto.
  if col_description('ingredients'::regclass,
       (select ordinal_position from information_schema.columns
         where table_name = 'ingredients' and column_name = 'origine_allergeni'))
     like '%non valgono per la stampa%' then
    raise exception 'Il commento della colonna dice ancora che i dedotti non valgono per la stampa.';
  end if;

  -- Due prodotti miei: uno DEDOTTO, uno che non ha guardato nessuno.
  v_ded := (create_ingredient(v_ent, 'VERIFICA dedotto', 'farine_cereali', 'kg', 1)->>'id')::uuid;
  v_mai := (create_ingredient(v_ent, 'VERIFICA mai guardato', 'verdura', 'kg', 1)->>'id')::uuid;
  v_ingr := v_ingr || v_ded::text || v_mai::text;
  update ingredients set allergens = array['glutine']::allergen[], origine_allergeni = 'stimati'
   where id = v_ded;
  update ingredients set allergens = array['sedano']::allergen[], origine_allergeni = null
   where id = v_mai;

  insert into recipes (name, category) values ('VERIFICA piatto col dedotto', 'primo')
  returning id into v_r1;
  insert into recipes (name, category) values ('VERIFICA piatto mai guardato', 'primo')
  returning id into v_r2;
  v_ric := v_ric || v_r1::text || v_r2::text;
  insert into recipe_ingredients (recipe_id, ingredient_id, quantity, unit)
  values (v_r1, v_ded, 1, 'kg'), (v_r2, v_mai, 1, 'kg');

  -- (1) 🔴 IL PUNTO DEL MANDATO: un piatto col solo allergene DEDOTTO, che
  --     non ha guardato nessuno, NON risulta da verificare — quindi il suo
  --     elenco finisce sul menu stampato.
  select * into v_v from v_recipe_allergens where recipe_id = v_r1;
  if v_v.allergeni_da_verificare then
    raise exception 'Un piatto col solo allergene dedotto risulta ancora «da verificare»: sul menu stampato il suo elenco verrebbe svuotato.';
  end if;
  if not ('glutine' = any(v_v.allergens)) then
    raise exception 'Il glutine dedotto non arriva nell''elenco del piatto.';
  end if;

  -- (2) E LA PROVA DISCRIMINA: il caso vuoto blocca ancora, ed e' voluto.
  --     ⚠️ Senza questo controllo passerebbe anche una vista che non guarda
  --        niente e risponde sempre «a posto».
  select * into v_v from v_recipe_allergens where recipe_id = v_r2;
  if not v_v.allergeni_da_verificare then
    raise exception 'Un piatto il cui allergene non l''ha guardato nessuno passa come verificato: sono due casi diversi e vanno distinti.';
  end if;
  if not ('VERIFICA mai guardato' = any(v_v.ingredienti_da_verificare)) then
    raise exception 'Il prodotto mai guardato non viene nominato fra quelli da verificare.';
  end if;

  -- Pulizia — solo roba mia, per identificativo, in un elenco.
  delete from recipe_ingredients where recipe_id::text = any(v_ric);
  delete from recipes where id::text = any(v_ric);
  delete from price_history where ingredient_id::text = any(v_ingr);
  delete from ingredients where id::text = any(v_ingr);
  delete from deleted_records
   where record_id = any(v_ingr) or record_id = any(v_ric)
      or (record ->> 'ingredient_id') = any(v_ingr)
      or (record ->> 'recipe_id') = any(v_ric);

  perform set_config('request.jwt.claims', null, true);
  perform pretendi_nessun_residuo(v_foto, 'la verifica del dedotto che vale');
  raise notice 'verifica: un allergene dedotto finisce nel menu stampato, e «non l''ha guardato nessuno» resta un caso a se''';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260827000008', 'una_regola_tolta_in_un_posto_solo')
on conflict (version) do nothing;
