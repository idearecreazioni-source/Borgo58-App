-- =====================================================================
-- 20261010000002 — LA BOZZA DA UN LINK (Ricettario, bocca 1: i link)
-- =====================================================================
--
-- Una ricetta di Clove si importa incollandone il link: la funzione online
-- `ricetta-da-link` apre la pagina e ne legge la ricetta dichiarata, il
-- gestionale la smonta col lettore dell'anteprima da testo (una regola sola
-- per quantita' e buchi), e questa funzione la scrive come BOZZA.
--
-- 🔴 PERCHE' UNA FUNZIONE E NON TRE SCRITTURE DAL BROWSER. La bozza, i suoi
--    ingredienti e i suoi passaggi sono tre tabelle: a meta' resterebbe una
--    bozza col titolo e senza ricetta, che sembra solo incompleta. Regola B4:
--    una funzione, una transazione, dal corridoio.
--
-- ⚠️ IL DOPPIO TOCCO NON CREA DUE BOZZE. `gesto_creazione` e' unico: lo
--    stesso gesto ripetuto riceve la stessa bozza. Stessa forma della
--    promozione (`gesto_promozione`).
--
-- ⚠️ COSA NON FA, apposta:
--    · non collega nessun ingrediente all'anagrafica (`ingredient_id` resta
--      vuoto: il collegamento lo sceglie Alessio, ed e' un buco finche'
--      manca);
--    · non tocca il Ricettario: la ricetta nasce solo dalla promozione;
--    · non inventa il titolo: senza titolo rifiuta, e lo dice.
-- =====================================================================

alter table bozze_ricetta add column if not exists gesto_creazione uuid;

comment on column bozze_ricetta.gesto_creazione is
  'Il gesto che ha creato la bozza da una lettura (link). Unico: lo stesso gesto ripetuto riceve la stessa bozza invece di crearne una seconda. Vuoto per le bozze scritte a mano.';

create unique index if not exists bozze_ricetta_gesto_creazione_idx
  on bozze_ricetta (gesto_creazione) where gesto_creazione is not null;

create or replace function crea_bozza_da_lettura(
  p_bozza       jsonb,
  p_ingredienti jsonb,
  p_passaggi    jsonb,
  p_gesto       uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $funzione$
declare
  v_id      uuid;
  v_titolo  text;
  v_origine text;
  v_riga    jsonb;
  v_n       integer := 0;
begin
  if not is_titolare() then
    raise exception 'Creare una bozza di ricetta e'' riservato al titolare.';
  end if;
  if p_gesto is null then
    raise exception 'Manca l''identificativo del gesto: senza, un doppio tocco potrebbe creare due bozze.';
  end if;

  -- Lo stesso gesto ripetuto: la stessa bozza, nessuna scrittura.
  select id into v_id from bozze_ricetta where gesto_creazione = p_gesto;
  if found then
    return jsonb_build_object('bozza_id', v_id, 'gia_fatto', true);
  end if;

  v_titolo := nullif(btrim(coalesce(p_bozza ->> 'titolo', '')), '');
  if v_titolo is null then
    raise exception 'La ricetta letta non ha un titolo: non posso creare la bozza senza.';
  end if;
  v_origine := coalesce(p_bozza ->> 'origine_tipo', 'link');

  insert into bozze_ricetta (
    titolo, origine_tipo, origine_riferimento, sunto, porzioni,
    buchi_dichiarati, gesto_creazione
  ) values (
    v_titolo,
    v_origine,
    nullif(btrim(coalesce(p_bozza ->> 'origine_riferimento', '')), ''),
    nullif(btrim(coalesce(p_bozza ->> 'sunto', '')), ''),
    (p_bozza ->> 'porzioni')::integer,
    coalesce(
      (select array_agg(b) from jsonb_array_elements_text(coalesce(p_bozza -> 'buchi_dichiarati', '[]'::jsonb)) b),
      '{}'),
    p_gesto
  )
  returning id into v_id;

  for v_riga in select * from jsonb_array_elements(coalesce(p_ingredienti, '[]'::jsonb)) loop
    v_n := v_n + 1;
    insert into bozze_ricetta_ingredienti (
      bozza_id, posizione, testo_originale, nome, quantita, unita, nota
    ) values (
      v_id,
      v_n,
      nullif(v_riga ->> 'testo_originale', ''),
      btrim(v_riga ->> 'nome'),
      (v_riga ->> 'quantita')::numeric,
      nullif(btrim(coalesce(v_riga ->> 'unita', '')), ''),
      nullif(btrim(coalesce(v_riga ->> 'nota', '')), '')
    );
  end loop;

  v_n := 0;
  for v_riga in select * from jsonb_array_elements(coalesce(p_passaggi, '[]'::jsonb)) loop
    v_n := v_n + 1;
    insert into bozze_ricetta_passaggi (bozza_id, posizione, descrizione)
    values (v_id, v_n, nullif(btrim(coalesce(v_riga ->> 'descrizione', '')), ''));
  end loop;

  return jsonb_build_object('bozza_id', v_id, 'gia_fatto', false);
end
$funzione$;

comment on function crea_bozza_da_lettura(jsonb, jsonb, jsonb, uuid) is
  'Crea una bozza di ricetta da una lettura (un link): bozza, ingredienti e passaggi in una transazione. Non collega ingredienti all''anagrafica, non tocca il Ricettario, rifiuta senza titolo; lo stesso gesto ripetuto riceve la stessa bozza. Solo titolare, e solo attraverso il corridoio.';

revoke all on function crea_bozza_da_lettura(jsonb, jsonb, jsonb, uuid) from public, anon, authenticated;
grant execute on function crea_bozza_da_lettura(jsonb, jsonb, jsonb, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- VERIFICA
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_foto     jsonb := foto_righe();
  v_titolare uuid;
  v_staff    uuid;
  v_gesto    uuid := gen_random_uuid();
  v_r        jsonb;
  v_r2       jsonb;
  v_bozza    uuid;
  v_n        integer;
  v_respinto boolean;
  v_ricette0 integer;
begin
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  select user_id into v_staff from user_roles where role = 'staff' limit 1;
  if v_titolare is null or v_staff is null then
    raise exception 'VERIFICA: servono un titolare e uno staff in user_roles.';
  end if;

  -- (0) Dal catalogo: niente alla chiave pubblica, e il gesto non si scrive dal browser.
  if has_function_privilege('anon', 'crea_bozza_da_lettura(jsonb, jsonb, jsonb, uuid)', 'execute') then
    raise exception 'VERIFICA: la creazione da lettura e'' eseguibile con la chiave pubblica.';
  end if;
  if has_column_privilege('authenticated', 'bozze_ricetta', 'gesto_creazione', 'INSERT')
     or has_column_privilege('authenticated', 'bozze_ricetta', 'gesto_creazione', 'UPDATE') then
    raise exception 'VERIFICA: il gesto di creazione si potrebbe scrivere dal browser.';
  end if;

  begin  -- <<< la sotto-transazione che verra' annullata
    select count(*) into v_ricette0 from recipes;

    -- (1) Lo staff viene respinto.
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
    v_respinto := false;
    begin
      perform crea_bozza_da_lettura('{"titolo":"ZZ verifica link - staff"}', '[]', '[]', gen_random_uuid());
    exception when others then v_respinto := true;
    end;
    if not v_respinto then
      raise exception 'VERIFICA: lo staff ha creato una bozza da un link.';
    end if;

    -- (2) Il titolare crea bozza, ingredienti (uno con buco) e passaggi.
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);
    v_r := crea_bozza_da_lettura(
      '{"titolo":"ZZ verifica link - panna cotta","origine_tipo":"link","origine_riferimento":"https://clove.kitchen/recipes/zz","porzioni":4,"buchi_dichiarati":["«Acqua fredda, q.b.»: quantità non scritta"]}',
      '[{"testo_originale":"6 g gelatina","nome":"gelatina","quantita":6,"unita":"g"},{"testo_originale":"Acqua fredda, q.b.","nome":"Acqua fredda","quantita":null,"unita":null,"nota":"q.b."}]',
      '[{"descrizione":"Ammolla la gelatina."},{"descrizione":"Scalda la panna."}]',
      v_gesto);
    v_bozza := (v_r ->> 'bozza_id')::uuid;
    if (v_r ->> 'gia_fatto')::boolean then
      raise exception 'VERIFICA: la prima creazione si dichiara gia'' fatta.';
    end if;
    select count(*) into v_n from bozze_ricetta_ingredienti where bozza_id = v_bozza;
    if v_n <> 2 then raise exception 'VERIFICA: ingredienti attesi 2, trovati %.', v_n; end if;
    if exists (select 1 from bozze_ricetta_ingredienti where bozza_id = v_bozza and ingredient_id is not null) then
      raise exception 'VERIFICA: un ingrediente e'' stato collegato da solo all''anagrafica.';
    end if;
    if (select quantita from bozze_ricetta_ingredienti where bozza_id = v_bozza and posizione = 2) is not null then
      raise exception 'VERIFICA: una quantita'' non scritta e'' diventata un numero.';
    end if;
    select count(*) into v_n from bozze_ricetta_passaggi where bozza_id = v_bozza;
    if v_n <> 2 then raise exception 'VERIFICA: passaggi attesi 2, trovati %.', v_n; end if;
    if (select origine_tipo from bozze_ricetta where id = v_bozza) is distinct from 'link'
       or (select porzioni from bozze_ricetta where id = v_bozza) is distinct from 4
       or (select cardinality(buchi_dichiarati) from bozze_ricetta where id = v_bozza) is distinct from 1 then
      raise exception 'VERIFICA: origine, porzioni o buchi non sono quelli letti.';
    end if;

    -- (3) Lo stesso gesto: la stessa bozza, nessuna riga in piu'.
    v_r2 := crea_bozza_da_lettura('{"titolo":"ZZ verifica link - doppione"}', '[]', '[]', v_gesto);
    if (v_r2 ->> 'bozza_id')::uuid is distinct from v_bozza or not (v_r2 ->> 'gia_fatto')::boolean then
      raise exception 'VERIFICA: il doppio tocco ha creato una seconda bozza.';
    end if;
    if (select count(*) from bozze_ricetta where gesto_creazione = v_gesto) <> 1 then
      raise exception 'VERIFICA: con lo stesso gesto ci sono piu'' bozze.';
    end if;

    -- (4) Senza titolo: rifiuto, nessuna bozza.
    v_respinto := false;
    begin
      perform crea_bozza_da_lettura('{"titolo":"  "}', '[]', '[]', gen_random_uuid());
    exception when others then v_respinto := true;
    end;
    if not v_respinto then
      raise exception 'VERIFICA: una bozza senza titolo e'' stata creata.';
    end if;

    -- (5) Il Ricettario non e' stato toccato.
    if (select count(*) from recipes) <> v_ricette0 then
      raise exception 'VERIFICA: la creazione di una bozza ha toccato il Ricettario.';
    end if;

    raise exception 'ZZ_ANNULLA';  -- <<< qui la sotto-transazione rientra
  exception when others then
    if sqlerrm <> 'ZZ_ANNULLA' then raise; end if;
  end;

  perform set_config('request.jwt.claims', null, true);
  perform pretendi_nessun_residuo(v_foto, 'la verifica della bozza da un link');

  raise notice 'Fatto: la bozza da un link nasce intera o non nasce, lo staff e'' respinto, il doppio tocco non duplica, i buchi restano buchi e il Ricettario non si muove. Provato e annullato: zero residui.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20261010000002', 'la_bozza_da_un_link')
on conflict (version) do nothing;
