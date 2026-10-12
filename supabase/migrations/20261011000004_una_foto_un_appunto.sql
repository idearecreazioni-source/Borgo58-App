-- UNA FOTO, UN APPUNTO (12/10/2026, rilievo della validazione sulla #178)
--
-- 🔴 IL CASO: si fotografa uno scontrino, il gestionale lo mette «da
--    collocare» chiamando `annota_spesa_da_collocare`. Se la rete cade
--    DOPO che il database ha scritto ma PRIMA che la risposta torni, la
--    schermata dice «Non sono riuscito a metterla da parte» e offre
--    «Riprova». Riprovando nasceva un SECONDO appunto per la stessa spesa
--    — e con una seconda copia della foto, perché il percorso del file era
--    nuovo a ogni giro.
--
--    ⚠️ Non e' un caso di scuola: e' il telefono in cucina col segnale
--    debole, cioe' esattamente dove si fotografano gli scontrini. E il
--    doppione non da' nessun errore: compaiono due spese uguali, e se le si
--    colloca tutte e due la stessa uscita finisce in prima nota due volte.
--
-- LA CURA: la schermata genera una CHIAVE una volta sola per ogni foto
--    letta, e la ripassa identica a ogni «Riprova». Il database ricorda la
--    chiave (`spese_da_collocare.chiave`, unica) e alla seconda chiamata
--    restituisce l'appunto gia' scritto invece di scriverne un altro.
--    ⚠️ La difesa sta qui e non nella schermata: un pulsante spento o una
--    guardia nel browser non sanno se la prima chiamata e' arrivata.
--
-- ⚠️ La voce non ne ha bisogno: l'appunto dettato si scrive approvandolo,
--    e `approva_appunto` lo fa una volta sola per costruzione.

alter table spese_da_collocare add column if not exists chiave uuid;

comment on column spese_da_collocare.chiave is
  'Generata dalla schermata una volta per ogni foto letta, e ripassata identica a ogni «Riprova». Serve a non scrivere due appunti per la stessa foto quando la rete cade dopo che il database ha gia'' scritto. Vuota sugli appunti dettati, che non ne hanno bisogno.';

create unique index if not exists spese_da_collocare_chiave_unica
  on spese_da_collocare (chiave) where chiave is not null;

-- Il corpo viene dalla 20261011000002 (la `…003` non la tocca): cambia solo
-- il riconoscimento della chiave.
create or replace function annota_spesa_da_collocare(p_campi jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_chiave uuid;
  v_id     uuid;
begin
  if not is_titolare() then
    raise exception 'Mettere una spesa fra quelle da collocare e'' riservato al titolare.';
  end if;

  v_chiave := nullif(btrim(coalesce(p_campi->>'chiave', '')), '')::uuid;
  if v_chiave is null then
    return scrivi_spesa_da_collocare('foto', p_campi);
  end if;

  -- La stessa foto e' gia' entrata: si restituisce quella, senza scrivere.
  select id into v_id from spese_da_collocare where chiave = v_chiave;
  if v_id is not null then
    return v_id;
  end if;

  -- ⚠️ Due chiamate quasi insieme passano tutte e due il controllo di
  --    sopra: decide l'indice unico. Chi arriva secondo vede annullato il
  --    proprio inserimento (il blocco rientra) e riceve l'appunto del primo.
  begin
    v_id := scrivi_spesa_da_collocare('foto', p_campi);
    update spese_da_collocare set chiave = v_chiave where id = v_id;
  exception when unique_violation then
    select id into v_id from spese_da_collocare where chiave = v_chiave;
    -- Un'altra unicita' violata non e' «la stessa foto»: non si risponde
    -- con un vuoto, si ridice l'errore.
    if v_id is null then
      raise;
    end if;
  end;
  return v_id;
end $fn$;

revoke all on function annota_spesa_da_collocare(jsonb) from public, anon, authenticated;
grant execute on function annota_spesa_da_collocare(jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- VERIFICA — si prova e si annulla
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_foto     jsonb := foto_righe();
  v_titolare uuid;
  v_staff    uuid;
  v_chiave   uuid := gen_random_uuid();
  v_a        uuid;
  v_b        uuid;
  v_n        integer;
  v_respinto boolean;
begin
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  select user_id into v_staff from user_roles where role = 'staff' limit 1;
  if v_titolare is null or v_staff is null then
    raise exception 'VERIFICA: servono un titolare e uno staff in user_roles.';
  end if;
  if has_function_privilege('anon', 'annota_spesa_da_collocare(jsonb)', 'execute') then
    raise exception 'VERIFICA: annota_spesa_da_collocare e'' aperta ad anon.';
  end if;

  begin  -- <<< la sotto-transazione che verra' annullata
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

    -- 1. La stessa chiave due volte: un appunto solo, lo stesso.
    v_a := annota_spesa_da_collocare(jsonb_build_object(
      'importo', 8, 'descrizione', 'ZZ verifica - una foto', 'chiave', v_chiave));
    v_b := annota_spesa_da_collocare(jsonb_build_object(
      'importo', 8, 'descrizione', 'ZZ verifica - una foto', 'chiave', v_chiave));
    select count(*) into v_n from spese_da_collocare where chiave = v_chiave;
    if v_a is distinct from v_b or v_n is distinct from 1 then
      raise exception 'VERIFICA: la stessa foto riprovata ha scritto % appunti (% / %).', v_n, v_a, v_b;
    end if;

    -- 2. Senza chiave si comporta come prima: due chiamate, due appunti.
    v_a := annota_spesa_da_collocare(jsonb_build_object('importo', 9, 'descrizione', 'ZZ verifica - senza chiave'));
    v_b := annota_spesa_da_collocare(jsonb_build_object('importo', 9, 'descrizione', 'ZZ verifica - senza chiave'));
    if v_a is not distinct from v_b then
      raise exception 'VERIFICA: senza chiave due appunti sono diventati uno.';
    end if;

    -- 3. Il portiere resta.
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
    v_respinto := false;
    begin
      perform annota_spesa_da_collocare(jsonb_build_object('importo', 1, 'chiave', gen_random_uuid()));
    exception when others then v_respinto := sqlerrm like '%riservato al titolare%';
    end;
    if not v_respinto then raise exception 'VERIFICA: lo staff ha messo una spesa da collocare.'; end if;

    raise exception 'ZZ_ANNULLA';  -- <<< qui la sotto-transazione rientra
  exception when others then
    if sqlerrm <> 'ZZ_ANNULLA' then raise; end if;
  end;

  perform set_config('request.jwt.claims', null, true);
  perform pretendi_nessun_residuo(v_foto, 'la verifica di una foto, un appunto');

  raise notice 'Fatto: la stessa foto riprovata scrive un appunto solo; senza chiave nulla cambia; lo staff e'' respinto. Provato e annullato: zero residui.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20261011000004', 'una_foto_un_appunto')
on conflict (version) do nothing;
