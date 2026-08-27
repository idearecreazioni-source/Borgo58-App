-- ============================================================================
-- LA MANO DI ALESSIO SI REGISTRA DA SÉ — 27/08/2026
-- ============================================================================
--
-- **Decisione in vigore del 25/08**: *«quando Alessio tocca a mano gli
-- allergeni di un prodotto, il gestionale scrive DA SÉ che li ha verificati
-- lui: è la verità ed è la fonte più affidabile.»*
--
-- 🔴 NON SUCCEDEVA, e si vede aprendo la scheda di un prodotto. Il payload
--    che quella schermata manda ha `allergens` e **non ha**
--    `origine_allergeni`: cambiando le spunte, l'origine resta com'era.
--    Un prodotto che nessuno aveva guardato restava «non l'ha guardato
--    nessuno» **dopo che Alessio l'aveva guardato** — cioè il gestionale
--    diceva il falso proprio nel caso in cui l'informazione vale di più.
--
-- ⚠️ E la conseguenza non era estetica: l'origine vuota è l'unico caso che
--    tiene ancora l'elenco fuori dal menu stampato. Alessio poteva mettere
--    gli allergeni a mano e vedere il piatto restare senza allergeni sulla
--    carta.
--
-- ----------------------------------------------------------------------------
-- LA CURA STA NEL DATABASE, NON NEL PAYLOAD DELLA SCHERMATA
-- ----------------------------------------------------------------------------
-- Quella tabella si scrive da **cinque porte**: la scheda dell'ingrediente,
-- la conferma in blocco, la lettura di un'etichetta, la compilazione
-- dell'assistente, il carico da fattura. Aggiungere un campo al payload di
-- una schermata cura quella schermata; la volta che se ne aggiunge una sesta
-- il difetto torna, e torna in silenzio.
--
-- 🔴 COME SI DISTINGUE UNA MANO DA UNA MACCHINA, ed è il punto delicato:
--    **chi sa da dove vengono gli allergeni lo DICHIARA**. L'assistente
--    scrive `allergens` *e* `origine_allergeni` insieme; una persona che
--    spunta delle caselle cambia solo il primo. Quindi:
--
--        allergens cambia  E  origine_allergeni NON cambia  →  è una mano
--
--    ⚠️ Il verso conta: se il criterio fosse «allergens cambia → è una
--       mano», il trigger sovrascriverebbe con «verificato da Alessio» anche
--       quello che l'assistente ha appena dedotto — e toglierebbe al
--       cameriere l'unica informazione che gli dice di non garantire.
--
-- ----------------------------------------------------------------------------
-- E LA STESSA COSA PER OGNI SINGOLO ALLERGENE
-- ----------------------------------------------------------------------------
-- `allergeni_prodotto` tiene l'origine **per allergene**, che è il dato che
-- serve in sala. Quando la mano di Alessio passa, gli allergeni che non
-- hanno ancora una riga la prendono con origine `alessio`.
--
-- ⚠️ `on conflict do nothing`, e non è pigrizia: un allergene che ha già la
--    sua origine — letto in etichetta, o da una fonte nominata — **non
--    diventa «l'ha detto Alessio»** solo perché lui ha spuntato una casella
--    accanto. L'etichetta resta la fonte legale.
-- ============================================================================

create or replace function tocca_campo_confermato()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_tolti text[] := '{}';
begin
  -- ⚠️ Solo se il VALORE cambia davvero: un salvataggio che riscrive lo
  -- stesso numero non e' uno sguardo. Ed e' la differenza fra «l'ha
  -- confermato» e «ha premuto Salva».
  -- ⚠️ IL `::text` NON E' PIGNOLERIA: senza, Postgres legge 'durata' come
  -- un letterale di ARRAY e si ferma con «malformed array literal». Trovato
  -- applicando, non rileggendo — la verifica chiama la funzione, e una
  -- funzione che si crea non e' una funzione che funziona (17/08).
  if new.seasonality is distinct from old.seasonality then v_tolti := v_tolti || 'stagionalita'::text; end if;
  if new.storage_type is distinct from old.storage_type then v_tolti := v_tolti || 'conservazione'::text; end if;
  if new.shelf_life_days is distinct from old.shelf_life_days then v_tolti := v_tolti || 'durata'::text; end if;
  if new.temperatura_attesa is distinct from old.temperatura_attesa then v_tolti := v_tolti || 'temperatura'::text; end if;
  if new.waste_percentage_default is distinct from old.waste_percentage_default then v_tolti := v_tolti || 'scarto'::text; end if;

  -- 🔴 AGGIUNTI IL 25/08: i campi che una lettura d'etichetta puo'
  -- proporre e che prima nessuno sorvegliava. Senza queste due righe, il
  -- nome e la categoria resterebbero marcati «l'ha messi l'assistente»
  -- anche dopo che Alessio li ha riscritti — cioe' la marcatura direbbe
  -- il falso proprio nel caso in cui serve.
  if new.name is distinct from old.name then v_tolti := v_tolti || 'nome'::text; end if;
  if new.category is distinct from old.category then v_tolti := v_tolti || 'categoria'::text; end if;
  if new.unit is distinct from old.unit then v_tolti := v_tolti || 'unita'::text; end if;

  -- 🔴 AGGIUNTO IL 27/08: la mano che tocca gli allergeni si registra da
  --    se'. Chi sa da dove vengono lo DICHIARA scrivendo anche l'origine;
  --    chi cambia il solo elenco e' una persona che ha guardato.
  if new.allergens is distinct from old.allergens
     and new.origine_allergeni is not distinct from old.origine_allergeni then
    new.origine_allergeni := 'confermati';
    v_tolti := v_tolti || 'allergeni'::text;
  end if;

  if array_length(v_tolti, 1) > 0 then
    new.campi_da_confermare := coalesce((
      select array_agg(x order by x)
        from unnest(new.campi_da_confermare) x
       where x <> all (v_tolti)
    ), '{}');

    new.campi_dall_assistente := coalesce((
      select array_agg(x order by x)
        from unnest(new.campi_dall_assistente) x
       where x <> all (v_tolti)
    ), '{}');
  end if;
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- E l'origine del singolo allergene
-- ----------------------------------------------------------------------------

create or replace function segna_allergeni_di_alessio()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- ⚠️ Solo quando l'origine PASSA a «confermati»: se ci era gia', questa
  --    update non e' lo sguardo che la fa diventare vera.
  if new.origine_allergeni is distinct from 'confermati'
     or old.origine_allergeni is not distinct from 'confermati' then
    return new;
  end if;

  insert into allergeni_prodotto (ingredient_id, allergene, origine, creato_da)
  select new.id, a, 'alessio', auth.uid()
    from unnest(coalesce(new.allergens, '{}'::allergen[])) a
  on conflict (ingredient_id, allergene) do nothing;

  return new;
end $$;

comment on function segna_allergeni_di_alessio() is
  'Quando Alessio guarda gli allergeni di un prodotto, quelli che non hanno ancora un''origine prendono la sua. ⚠️ `do nothing` sui gia'' presenti: un allergene letto in etichetta NON diventa «l''ha detto Alessio» perche'' lui ha spuntato una casella accanto — l''etichetta resta la fonte legale.';

revoke all on function segna_allergeni_di_alessio() from public, anon, authenticated;

-- 🔴 SENZA `OF origine_allergeni`, ED È LA PARTE CHE HO SBAGLIATO PRIMA.
--    In Postgres `update of colonna` guarda le colonne **nominate nella
--    UPDATE**, non quelle che sono cambiate: qui l'origine la scrive il
--    trigger BEFORE, e chi salva dalla schermata nomina solo `allergens`.
--    Col filtro, questo trigger non scattava mai — e la verifica l'ha
--    preso al primo colpo, dicendo che il sedano messo a mano non
--    risultava messo da Alessio.
--    ⚠️ La condizione sta DENTRO la funzione, dove guarda cosa è cambiato
--       davvero invece di cosa è stato scritto.
drop trigger if exists trg_segna_allergeni_di_alessio on ingredients;
create trigger trg_segna_allergeni_di_alessio
  after update on ingredients
  for each row execute function segna_allergeni_di_alessio();

-- ============================================================================
-- VERIFICA
-- ============================================================================
do $verifica$
declare
  v_foto  jsonb;
  v_tit   uuid;
  v_ent   uuid;
  v_a     uuid;
  v_b     uuid;
  v_ingr  text[] := '{}';
  v_n     integer;
begin
  v_foto := foto_righe();
  select id into v_ent from entities where entity_type = 'srls' limit 1;
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', v_tit)::text, true);

  v_a := (create_ingredient(v_ent, 'VERIFICA mano di Alessio', 'verdura', 'kg', 1)->>'id')::uuid;
  v_b := (create_ingredient(v_ent, 'VERIFICA mano assistente', 'verdura', 'kg', 1)->>'id')::uuid;
  v_ingr := v_ingr || v_a::text || v_b::text;

  -- (1) 🔴 LA MANO: cambia il SOLO elenco → il gestionale scrive che l'ha
  --     guardato lui.
  if (select origine_allergeni from ingredients where id = v_a) is not null then
    raise exception 'Un prodotto appena creato risulta gia'' guardato da qualcuno.';
  end if;
  update ingredients set allergens = array['sedano']::allergen[] where id = v_a;
  if (select origine_allergeni from ingredients where id = v_a) <> 'confermati' then
    raise exception 'Toccando a mano gli allergeni il gestionale non scrive che li ha verificati lui: risulta «%»',
      coalesce((select origine_allergeni from ingredients where id = v_a), '(vuota)');
  end if;

  -- (2) E IL SINGOLO ALLERGENE PRENDE LA SUA ORIGINE.
  if (select origine from allergeni_prodotto
       where ingredient_id = v_a and allergene = 'sedano') is distinct from 'alessio' then
    raise exception 'Il sedano messo a mano non risulta messo da Alessio.';
  end if;

  -- (3) 🔴 LA MACCHINA NON DIVENTA UNA MANO: chi dichiara l'origine la
  --     tiene. Senza questo controllo il trigger toglierebbe al cameriere
  --     l'unica informazione che gli dice di non garantire.
  update ingredients set allergens = array['glutine']::allergen[], origine_allergeni = 'stimati'
   where id = v_b;
  if (select origine_allergeni from ingredients where id = v_b) <> 'stimati' then
    raise exception 'Un allergene DEDOTTO e'' stato spacciato per verificato da Alessio.';
  end if;
  if exists (select 1 from allergeni_prodotto where ingredient_id = v_b) then
    raise exception 'Il trigger ha scritto un''origine per allergene su una scrittura della macchina.';
  end if;

  -- (4) 🔴 E UN'ORIGINE GIA' SCRITTA NON VIENE SOVRASCRITTA: l'etichetta
  --     e' la fonte legale e resta.
  insert into allergeni_prodotto (ingredient_id, allergene, origine)
  values (v_a, 'glutine', 'etichetta');
  update ingredients set allergens = array['sedano','glutine']::allergen[] where id = v_a;
  if (select origine from allergeni_prodotto
       where ingredient_id = v_a and allergene = 'glutine') <> 'etichetta' then
    raise exception 'Un allergene letto in etichetta e'' diventato «l''ha detto Alessio».';
  end if;

  -- (5) UN SALVATAGGIO CHE NON CAMBIA NIENTE NON E' UNO SGUARDO.
  update ingredients set allergens = array['sedano','glutine']::allergen[], origine_allergeni = null
   where id = v_a;
  update ingredients set haccp_notes = 'VERIFICA' where id = v_a;
  if (select origine_allergeni from ingredients where id = v_a) is not null then
    raise exception 'Premere Salva senza toccare gli allergeni conta come uno sguardo.';
  end if;

  -- Pulizia — solo roba mia, per identificativo, in un elenco.
  delete from allergeni_prodotto where ingredient_id::text = any(v_ingr);
  delete from price_history where ingredient_id::text = any(v_ingr);
  delete from ingredients where id::text = any(v_ingr);
  delete from deleted_records
   where record_id = any(v_ingr) or (record ->> 'ingredient_id') = any(v_ingr);

  perform set_config('request.jwt.claims', null, true);
  perform pretendi_nessun_residuo(v_foto, 'la verifica della mano di Alessio');
  raise notice 'verifica: la mano si registra da se'', la macchina resta macchina, e l''etichetta non viene sovrascritta';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260827000009', 'la_mano_di_alessio_si_registra_da_se')
on conflict (version) do nothing;
