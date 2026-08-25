-- ============================================================================
-- OGNI CAMPO RICORDA CHI L'HA MESSO — 25/08/2026
-- ============================================================================
--
-- ✅ DECISIONE DI ALESSIO (punto d del mandato): ogni campo di una scheda
--    ricorda chi l'ha messo — l'assistente o lui. **Una marcatura per
--    campo, non un registro delle modifiche.** Serve il giorno che un dato
--    risulta sbagliato: sapere se l'ha scritto lui o dedotto la macchina
--    cambia dove si va a cercare. E se corregge un campo compilato
--    dall'assistente, la marcatura passa a lui.
--
-- ⚠️ NON E' `campi_da_confermare`, ED E' LA DISTINZIONE CHE REGGE TUTTO.
--    Quella colonna esiste dal 23/08 e risponde a un'altra domanda:
--    «questo campo l'ha compilato la macchina e **nessuno l'ha ancora
--    guardato**». Ma la scheda che nasce da una foto **Alessio la vede
--    prima di salvarla** — e' il punto (a) dello stesso mandato — quindi
--    quei campi sono guardati per costruzione, e metterli li' direbbe il
--    falso.
--    Resta l'altra domanda, che nessuna colonna risponde: **chi ha scritto
--    questo valore?** Un campo guardato e lasciato com'era l'ha comunque
--    proposto la macchina, e fra sei mesi la differenza conta.
--
-- 🔴 IL CONFRONTO LO PUO' FARE SOLO IL CLIENT, e non e' una comodita': il
--    database vede arrivare un valore e non ha modo di sapere se e' quello
--    che l'assistente aveva proposto o quello che Alessio ci ha scritto
--    sopra. Quel confronto avviene nel modulo, fra la proposta e cio' che
--    c'e' nei campi al momento di salvare. Per questo la marcatura arriva
--    da fuori invece di essere dedotta qui dentro.
--
-- ⚠️ E POI SI DIFENDE DA SOLA: se qualcuno cambia quel campo dopo, la
--    marcatura cade — con lo stesso trigger che gia' fa cadere
--    «da confermare», esteso invece che affiancato. Due trigger che
--    guardano gli stessi campi finirebbero per non guardare gli stessi
--    campi.
-- ============================================================================

alter table ingredients
  add column if not exists campi_dall_assistente text[] not null default '{}';

comment on column ingredients.campi_dall_assistente is
  'I campi il cui valore l''ha proposto l''assistente e Alessio ha lasciato com''era. Non vuol dire «non guardato» (per quello c''e'' campi_da_confermare): vuol dire «questo numero non l''ha scritto una persona». Cade da se'' quando qualcuno cambia quel campo.';

-- ----------------------------------------------------------------------------
-- Il trigger che c'era, esteso
-- ----------------------------------------------------------------------------
-- ⚠️ Corpo ripreso VIVO dal database (`pg_get_functiondef`), non dal file
--    che l'ha creato: fra i due ci stanno tutte le migrazioni che l'hanno
--    toccata (regola del 18/08, pagata con un battito di sentinella perso).
--    Cambiano due cose: la colonna nuova cade insieme all'altra, e la
--    funzione prende il `search_path` fissato che non aveva — la regola
--    del 10/08 lo vuole su ogni funzione trigger, e questa era rimasta
--    indietro.
create or replace function tocca_campo_confermato()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
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
$function$;

-- ----------------------------------------------------------------------------
-- Segnare quali campi ha proposto l'assistente
-- ----------------------------------------------------------------------------
create or replace function marca_campi_dall_assistente(
  p_ingredient_id uuid,
  p_campi         text[]
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $funzione$
declare
  v_noti  text[] := array['nome','categoria','unita','conservazione','durata','temperatura','stagionalita'];
  v_buoni text[];
  v_scartati text[];
begin
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' segnare i campi di una scheda.';
  end if;

  -- ⚠️ UN VOCABOLARIO CHIUSO, e serve: un nome di campo scritto storto
  --    entrerebbe in un elenco che la schermata legge, e li' comparirebbe
  --    una marcatura su un campo che non esiste — muta e mai spiegabile.
  select coalesce(array_agg(x order by x), '{}') into v_buoni
    from unnest(coalesce(p_campi, '{}')) x where x = any(v_noti);
  select coalesce(array_agg(x order by x), '{}') into v_scartati
    from unnest(coalesce(p_campi, '{}')) x where x <> all(v_noti);

  update ingredients
     set campi_dall_assistente = v_buoni
   where id = p_ingredient_id;

  if not found then
    raise exception 'Questo prodotto non esiste piu''.';
  end if;

  return jsonb_build_object('segnati', to_jsonb(v_buoni), 'scartati', to_jsonb(v_scartati));
end $funzione$;

revoke all on function marca_campi_dall_assistente(uuid, text[]) from public, anon, authenticated;
grant execute on function marca_campi_dall_assistente(uuid, text[]) to authenticated;

-- ============================================================================
-- VERIFICA
-- ============================================================================
do $verifica$
declare
  v_tit uuid;
  v_ent uuid;
  v_mio uuid;
  v_esito jsonb;
  v_campi text[];
  v_n integer;
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

  insert into ingredients (entity_id, name, category, unit, current_price, storage_type, shelf_life_days)
  values (v_ent, 'ZZ verifica marcatura', 'secco_dispensa', 'kg', 1.00, 'dispensa', 200)
  returning id into v_mio;

  -- (A) Si segnano i campi proposti, e i nomi inventati si scartano.
  v_esito := marca_campi_dall_assistente(v_mio, array['nome','conservazione','durata','campo_inventato']);
  if v_esito->>'scartati' not like '%campo_inventato%' then
    raise exception 'Un nome di campo inventato non e'' stato scartato: %', v_esito;
  end if;

  select campi_dall_assistente into v_campi from ingredients where id = v_mio;
  if not ('conservazione' = any(v_campi) and 'durata' = any(v_campi) and 'nome' = any(v_campi)) then
    raise exception 'I campi non sono stati segnati: %', v_campi;
  end if;
  if 'campo_inventato' = any(v_campi) then
    raise exception 'Il campo inventato e'' finito nell''elenco';
  end if;

  -- (B) Alessio cambia la durata: quella marcatura cade, le altre no.
  --     ⚠️ E' il cuore del punto (d): «se corregge un campo compilato
  --     dall'assistente, la marcatura passa a lui».
  update ingredients set shelf_life_days = 90 where id = v_mio;
  select campi_dall_assistente into v_campi from ingredients where id = v_mio;
  if 'durata' = any(v_campi) then
    raise exception 'La durata risulta ancora dell''assistente dopo che e'' stata cambiata: %', v_campi;
  end if;
  if not ('conservazione' = any(v_campi)) then
    raise exception 'Cambiando la durata e'' caduta anche la conservazione: %', v_campi;
  end if;

  -- (C) Riscrivere lo STESSO valore non e' una correzione.
  --     ⚠️ Senza questo verso, un salvataggio qualunque cancellerebbe
  --     tutte le marcature e la colonna sarebbe sempre vuota — cioe'
  --     inutile, e nessuno se ne accorgerebbe.
  update ingredients set storage_type = 'dispensa' where id = v_mio;
  select campi_dall_assistente into v_campi from ingredients where id = v_mio;
  if not ('conservazione' = any(v_campi)) then
    raise exception 'Riscrivere lo stesso valore ha fatto cadere la marcatura: %', v_campi;
  end if;

  -- (D) Il nome: cambiandolo, cade.
  update ingredients set name = 'ZZ verifica marcatura, corretto' where id = v_mio;
  select campi_dall_assistente into v_campi from ingredients where id = v_mio;
  if 'nome' = any(v_campi) then
    raise exception 'Il nome risulta ancora dell''assistente dopo essere stato riscritto: %', v_campi;
  end if;

  -- Pulizia
  delete from ingredients where id = v_mio;
  select count(*) into v_n from ingredients where id = v_mio;
  if v_n <> 0 then raise exception 'Il prodotto della verifica e'' rimasto'; end if;

  select count(*) into v_lapidi_post from deleted_records;
  if v_lapidi_post <> v_lapidi_pre then
    raise exception 'La verifica ha lasciato % lapidi', v_lapidi_post - v_lapidi_pre;
  end if;

  perform set_config('request.jwt.claims', null, true);

  raise notice 'Ogni campo ricorda chi l''ha messo: la marcatura cade quando il valore cambia, resta quando si riscrive uguale, e un nome di campo inventato non entra.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260825000016', 'ogni_campo_ricorda_chi_l_ha_messo')
on conflict (version) do nothing;
