-- =====================================================================
-- I CAMPI MESSI DALLA MACCHINA SI VEDONO
-- 23/08/2026
-- =====================================================================
-- Decisione di Alessio, mandato notturno del 23/08: *«temperatura di
-- ricevimento e percentuale di scarto come gli allergeni; stagionalita',
-- conservazione e durata visibili come "messi dalla macchina" ma non
-- bloccanti»*.
--
-- 🔴 IL BUCO CHE CHIUDE, misurato prima di scrivere. Dal 13/08 l'assistente
-- compila cinque campi di un prodotto nuovo — stagionalita', conservazione,
-- durata, temperatura di ricevimento, percentuale di scarto — e il
-- database sa **quando** l'ha fatto (`campi_compilati_il`) ma non **quali**
-- e non se qualcuno li ha guardati dopo. La funzione se lo dice in faccia e
-- poi lo butta via: `applica_scheda_prodotto` calcola l'elenco dei campi
-- scritti (`v_scritti`), lo restituisce a chi la chiama... e non lo scrive
-- da nessuna parte.
--
-- ⚠️ E DUE DI QUEI CINQUE CAMBIANO DEI NUMERI:
--   · lo **scarto** entra nel costo di ogni piatto che usa quel prodotto —
--     con lo scarto sbagliato il food cost e' sbagliato **sempre nella
--     stessa direzione**, e nessuno se ne accorge;
--   · la **temperatura di ricevimento** e' un dato HACCP: finisce su un
--     registro che si esibisce.
-- Gli altri tre spostano un avviso, non un numero.
--
-- ⚠️ PERCHE' UNA LISTA E NON CINQUE COLONNE «origine_…». Gli allergeni ne
-- hanno una perche' li' gli stati sono **tre** e uno e' particolare — letto
-- dall'etichetta, che e' la fonte legale. Qui gli stati sono due (l'ha messo
-- la macchina / l'ha guardato Alessio) e i campi sono cinque: cinque colonne
-- direbbero cinque volte la stessa cosa, e ogni campo nuovo ne vorrebbe una
-- sesta. Una lista di nomi regge anche il campo che nascera' domani.
--
-- ⚠️ E NON BLOCCA NIENTE, come chiesto: e' un segno, non un divieto. Un
-- prodotto con lo scarto da confermare si usa lo stesso, si vende lo stesso,
-- e il suo piatto si mette in carta lo stesso.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1 · LA LISTA
-- ---------------------------------------------------------------------
alter table ingredients
  add column if not exists campi_da_confermare text[] not null default '{}';

comment on column ingredients.campi_da_confermare is
  'I campi che ha compilato la macchina e che nessuno ha ancora guardato: stagionalita, conservazione, durata, temperatura, scarto. Non blocca niente — e'' un segno. Si svuota da se'' quando qualcuno cambia quel campo (trigger tocca_campo_confermato) oppure con conferma_campi_prodotto().';


-- ---------------------------------------------------------------------
-- 2 · CAMBIARE UN CAMPO VUOL DIRE AVERLO GUARDATO
-- ---------------------------------------------------------------------
-- ⚠️ E' un TRIGGER e non una riga nell'applicazione, per la ragione di
-- sempre: le schermate che scrivono su un ingrediente sono piu' d'una — la
-- scheda del prodotto, la creazione da fattura, il carico — e una regola
-- ripetuta in tre posti si dimentica nel quarto.
create or replace function tocca_campo_confermato()
returns trigger
language plpgsql
as $fn$
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
  if new.haccp_receiving_temp is distinct from old.haccp_receiving_temp then v_tolti := v_tolti || 'temperatura'::text; end if;
  if new.waste_percentage_default is distinct from old.waste_percentage_default then v_tolti := v_tolti || 'scarto'::text; end if;

  if array_length(v_tolti, 1) > 0 then
    new.campi_da_confermare := coalesce((
      select array_agg(x order by x)
        from unnest(new.campi_da_confermare) x
       where x <> all (v_tolti)
    ), '{}');
  end if;
  return new;
end;
$fn$;

drop trigger if exists trg_tocca_campo_confermato on ingredients;
create trigger trg_tocca_campo_confermato
  before update on ingredients
  for each row execute function tocca_campo_confermato();


-- ---------------------------------------------------------------------
-- 3 · «VA BENE COSI'» — confermare senza cambiare niente
-- ---------------------------------------------------------------------
-- ⚠️ Serve perche' il caso piu' frequente e' proprio quello: la macchina ha
-- indovinato, e Alessio vuole dire che l'ha guardato **senza** toccare il
-- numero. Senza questa strada, l'unico modo per togliere il segno sarebbe
-- scrivere un valore diverso da quello giusto e poi rimetterlo.
create or replace function conferma_campi_prodotto(p_ingredient_id uuid, p_campi text[])
returns text[]
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_rimasti text[];
begin
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' confermare i campi di un prodotto';
  end if;
  if p_campi is null or array_length(p_campi, 1) is null then
    raise exception 'Quali campi confermo? L''elenco e'' vuoto';
  end if;

  update ingredients
     set campi_da_confermare = coalesce((
           select array_agg(x order by x)
             from unnest(campi_da_confermare) x
            where x <> all (p_campi)
         ), '{}')
   where id = p_ingredient_id
  returning campi_da_confermare into v_rimasti;

  if v_rimasti is null then
    raise exception 'Questo prodotto non esiste piu''';
  end if;
  return v_rimasti;
end;
$fn$;

comment on function conferma_campi_prodotto(uuid, text[]) is
  'Toglie il segno «messo dalla macchina» dai campi indicati, senza cambiarne il valore. Nato il 23/08/2026: il caso piu'' frequente e'' che la macchina abbia indovinato.';

revoke all on function conferma_campi_prodotto(uuid, text[]) from public, anon, authenticated;
grant execute on function conferma_campi_prodotto(uuid, text[]) to authenticated;

revoke all on function tocca_campo_confermato() from public, anon, authenticated;


-- ---------------------------------------------------------------------
-- 4 · QUANTI PRODOTTI ASPETTANO UNO SGUARDO
-- ---------------------------------------------------------------------
-- ⚠️ La domanda che serve non e' «questo prodotto e' da confermare?» ma
-- **«quanti piatti stanno usando uno scarto che nessuno ha guardato?»** —
-- ed e' la sola per cui questo lavoro esiste. Se la risposta stesse solo
-- sulla scheda del singolo prodotto, con cento prodotti non la troverebbe
-- nessuno.
create or replace function campi_da_confermare()
returns table (campo text, quanti bigint, esempi text)
language sql
stable
security definer
set search_path = public
as $fn$
  select c.campo,
         count(*) as quanti,
         string_agg(i.name, ', ' order by i.name) filter (where c.riga <= 3) as esempi
    from ingredients i
    cross join lateral (
      select x as campo, row_number() over () as riga
        from unnest(i.campi_da_confermare) x
    ) c
   group by c.campo
   order by count(*) desc, c.campo;
$fn$;

comment on function campi_da_confermare() is
  'Quanti prodotti hanno ancora un campo messo dalla macchina, per campo, coi primi tre nomi. Serve a rispondere a «quanti piatti usano uno scarto che nessuno ha guardato?».';

revoke all on function campi_da_confermare() from public, anon, authenticated;
grant execute on function campi_da_confermare() to authenticated;


-- ---------------------------------------------------------------------
-- 5 · E LA MACCHINA ADESSO LASCIA IL SEGNO
-- ---------------------------------------------------------------------
-- ⚠️ Il corpo qui sotto e' quello VIVO del database, preso con
-- `pg_get_functiondef` e non riscritto a memoria (regola del 18/08: fra il
-- file che ha creato una funzione e la funzione ci stanno tutte le
-- migrazioni che l'hanno toccata). L'unica differenza e' l'ultima riga.
create or replace function public.applica_scheda_prodotto(p_ingredient_id uuid, p_campi jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_ing        ingredients%rowtype;
  v_allergeni  allergen[] := '{}';
  v_mesi       month_code[] := '{}';
  v_scartati   text[] := '{}';
  v_x          text;
  v_scritti    text[] := '{}';
begin
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' compilare la scheda di un prodotto';
  end if;

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
  -- non «non si scarta niente». Sopra il 95% e' quasi certamente un
  -- errore del modello, e sfalserebbe il costo di ogni piatto.
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

  -- 🔴 IL SEGNO (23/08/2026). Prima questa riga scriveva solo QUANDO la
  -- macchina aveva compilato; adesso scrive anche COSA, cosi' che a schermo
  -- si veda quale numero e' una stima e quale l'ha guardato Alessio.
  --
  -- ⚠️ Gli allergeni restano fuori dalla lista, e non e' una dimenticanza:
  -- ce l'hanno gia' una loro (`origine_allergeni`), con tre stati invece di
  -- due perche' li' esiste l'etichetta, che e' la fonte legale. Metterli
  -- anche qui vorrebbe dire due posti che dicono la stessa cosa e possono
  -- contraddirsi — che in questo progetto e' un difetto, non una comodita'.
  update ingredients
     set campi_compilati_il = now(),
         campi_da_confermare = coalesce((
           select array_agg(distinct x order by x)
             from unnest(campi_da_confermare || v_scritti) x
            where x <> 'allergeni'
         ), '{}')
   where id = p_ingredient_id;

  return jsonb_build_object(
    'id', p_ingredient_id,
    'scritti', to_jsonb(v_scritti),
    'scartati', to_jsonb(v_scartati));
end
$function$;

revoke all on function applica_scheda_prodotto(uuid, jsonb) from public, anon, authenticated;
grant execute on function applica_scheda_prodotto(uuid, jsonb) to authenticated;


-- ---------------------------------------------------------------------
-- 6 · VERIFICA
-- ---------------------------------------------------------------------
-- ⚠️ La prova gira su un ingrediente SUO, creato qui: l'assistente scrive
-- solo sui campi ancora vuoti, quindi su un prodotto vero non scriverebbe
-- niente e questo blocco passerebbe verde senza aver provato niente — la
-- trappola del caso vuoto, dal lato dei dati.
do $$
declare
  v_ent      uuid;
  v_ing      uuid;
  v_esito    jsonb;
  v_lista    text[];
  v_lapidi   integer;
  v_lapidi_2 integer;
begin
  select count(*) into v_lapidi from deleted_records;
  select id into v_ent from entities order by created_at limit 1;

  perform set_config('request.jwt.claims',
    json_build_object('sub', (select user_id from user_roles where role = 'titolare' limit 1),
                      'role', 'authenticated')::text, true);

  insert into ingredients (entity_id, name, unit, category, alimentare)
  values (v_ent, '__PROVA__campi da confermare', 'kg', 'verdura', true)
  returning id into v_ing;

  -- 1. La macchina compila, e lascia il segno.
  v_esito := applica_scheda_prodotto(v_ing, jsonb_build_object(
    'conservazione', 'frigo_4_8',
    'durata_giorni', 6,
    'temperatura', '4 gradi',
    'scarto_percento', 18,
    'allergeni', jsonb_build_array('sedano')));
  select campi_da_confermare into v_lista from ingredients where id = v_ing;
  if not (v_lista @> array['conservazione', 'durata', 'temperatura', 'scarto']) then
    raise exception 'Il segno non e'' stato lasciato: %', v_lista;
  end if;
  if 'allergeni' = any (v_lista) then
    raise exception 'Gli allergeni sono finiti nella lista: hanno gia'' la loro colonna.';
  end if;

  -- 2. Cambiare un campo vuol dire averlo guardato.
  update ingredients set waste_percentage_default = 22 where id = v_ing;
  select campi_da_confermare into v_lista from ingredients where id = v_ing;
  if 'scarto' = any (v_lista) then
    raise exception 'Lo scarto e'' stato cambiato e il segno e'' rimasto: %', v_lista;
  end if;
  if not ('durata' = any (v_lista)) then
    raise exception 'Toccando lo scarto si e'' portato via anche il segno degli altri campi: %', v_lista;
  end if;

  -- 3. ⚠️ E RISCRIVERE LO STESSO VALORE NON E' UNO SGUARDO. E' la
  --    differenza fra «l'ha confermato» e «ha premuto Salva»: senza questo
  --    controllo, un salvataggio qualunque della scheda cancellerebbe tutti
  --    i segni in un colpo solo.
  update ingredients set shelf_life_days = 6 where id = v_ing;
  select campi_da_confermare into v_lista from ingredients where id = v_ing;
  if not ('durata' = any (v_lista)) then
    raise exception 'Riscrivere lo stesso valore ha tolto il segno: %', v_lista;
  end if;

  -- 4. «Va bene cosi'»: si conferma senza cambiare niente.
  v_lista := conferma_campi_prodotto(v_ing, array['durata', 'conservazione']);
  if 'durata' = any (v_lista) or 'conservazione' = any (v_lista) then
    raise exception 'La conferma non ha tolto i campi: %', v_lista;
  end if;
  if not ('temperatura' = any (v_lista)) then
    raise exception 'La conferma si e'' portata via anche cio'' che non era stato confermato: %', v_lista;
  end if;
  if (select shelf_life_days from ingredients where id = v_ing) <> 6 then
    raise exception 'La conferma ha cambiato il valore, e non doveva toccarlo.';
  end if;

  -- 5. Il conteggio per campo risponde.
  if not exists (select 1 from campi_da_confermare() where campo = 'temperatura' and quanti >= 1) then
    raise exception 'Il conteggio per campo non vede la temperatura da confermare.';
  end if;

  -- pulizia
  delete from ingredients where id = v_ing;
  select count(*) into v_lapidi_2 from deleted_records;
  if v_lapidi_2 <> v_lapidi then
    raise exception 'La verifica ha lasciato % lapidi nel registro delle cancellazioni.', v_lapidi_2 - v_lapidi;
  end if;

  raise notice 'Verifica passata: la macchina lascia il segno, cambiare un campo lo toglie, riscrivere lo stesso valore no, e si puo'' confermare senza toccare niente.';
end $$;

insert into applied_migrations (version, name)
values ('20260823000001', 'i_campi_messi_dalla_macchina') on conflict (version) do nothing;
