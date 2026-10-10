-- =====================================================================
-- 20261010000003 — L'ASSISTENTE SISTEMA LA RICETTA IMPORTATA
-- =====================================================================
--
-- Decisione di Alessio (10/10/2026), dopo la prima importazione vera da
-- Clove: *«così non me ne esco più»* — 33 voci da compilare a mano per ogni
-- ricetta. Le bozze diventano il suo ricettario virtuale, e all'importazione
-- l'assistente PROPONE categoria, fase di ogni passaggio e nome pulito di
-- ogni ingrediente (funzione online `ricetta-da-link`, `proposte.ts`).
--
-- Questa migrazione fa tre cose:
--
--   1. 🔴 LA SPESA SI CONTA. Ogni chiamata all'assistente da un link si
--      registra in `letture_ricetta`, e `consumi_ai` la comprende: rientra nel
--      tetto unico (decisione del 29/08: *un tetto solo, che copre qualunque
--      cosa venga dopo*). Anche la chiamata fallita a meta': si paga lo stesso.
--      ⚠️ Una tabella sua, e non una colonna sulla bozza: cancellando una
--      bozza la spesa del mese sarebbe scesa, e un tetto che si abbassa
--      buttando via il lavoro non e' un tetto.
--
--   2. LA BOZZA DICE COSA HA PROPOSTO L'ASSISTENTE
--      (`bozze_ricetta.proposte_assistente`): una proposta non si deve
--      confondere con una cosa scritta da Alessio. Si svuota col suo «Visto».
--
--   3. `crea_bozza_da_lettura` SCRIVE CATEGORIA, FASI E PROPOSTE, che fino a
--      oggi non riceveva. Riscritta dal corpo vivo (20261010000002, applicata
--      sul progetto di prova lo stesso giorno, non toccata da altre).
--
-- ⚠️ COSA NON CAMBIA: la promozione a ricetta del locale. Pretende ancora
--    ogni ingrediente collegato al magazzino — e' il passo che Alessio fara'
--    quando comprera' gli ingredienti. L'assistente non collega niente.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. LA SPESA DELLE LETTURE DI RICETTA
-- ---------------------------------------------------------------------
create table if not exists letture_ricetta (
  id             uuid primary key default gen_random_uuid(),
  esito          text not null,
  modello        text,
  token_domanda  integer not null default 0,
  token_risposta integer not null default 0,
  costo_euro     numeric(10,5) not null default 0,
  messaggio      text,
  creato_il      timestamptz not null default now(),
  creato_da      uuid references auth.users(id) on delete set null,
  constraint lettura_ricetta_esito_noto check (esito in ('proposte', 'tetto', 'errore')),
  constraint lettura_ricetta_costo_sensato check (costo_euro >= 0)
);

comment on table letture_ricetta is
  'Ogni volta che l''assistente e'' stato chiamato su una ricetta letta da un link: l''esito, i token, il costo. Entra nel tetto unico della spesa (consumi_ai). Non si cancella dall''app: una spesa cancellata farebbe scendere il conto del mese.';
comment on column letture_ricetta.esito is
  'proposte (l''assistente ha risposto) · tetto (non chiamato: tetto raggiunto) · errore (chiamato e fallito: i token spesi si registrano lo stesso).';
comment on constraint lettura_ricetta_esito_noto on letture_ricetta is
  'L''esito di una lettura di ricetta e'' proposte, tetto o errore.';
comment on constraint lettura_ricetta_costo_sensato on letture_ricetta is
  'Il costo di una lettura non puo'' essere negativo.';

alter table letture_ricetta enable row level security;
drop policy if exists letture_ricetta_titolare_select on letture_ricetta;
create policy letture_ricetta_titolare_select on letture_ricetta
  for select to authenticated
  using ((select is_titolare()));

-- Si scrive SOLO dalla funzione qui sotto; dal browser si legge e basta.
revoke all on letture_ricetta from public, anon, authenticated;
grant select on letture_ricetta to authenticated;

insert into perimetro_registro (tabella, dentro, ragione) values
  ('letture_ricetta', false,
   'Il registro della spesa dell''assistente sulle ricette importate. Fuori dal registro delle cancellazioni perche'' dall''app non si cancella affatto: nessun permesso di cancellazione. Fuori dal 10/10/2026.')
on conflict (tabella) do nothing;

create or replace function registra_lettura_ricetta(
  p_esito          text,
  p_modello        text default null,
  p_token_domanda  integer default 0,
  p_token_risposta integer default 0,
  p_messaggio      text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $funzione$
declare
  v_prezzo costo_modello_ai%rowtype;
  v_costo  numeric := 0;
  v_msg    text := p_messaggio;
  v_id     uuid;
begin
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' usare l''assistente.';
  end if;

  if p_modello is not null then
    select * into v_prezzo from costo_modello_ai where modello = p_modello;
    if found then
      v_costo := round(
        coalesce(p_token_domanda, 0)::numeric  / 1000000 * v_prezzo.euro_milione_in +
        coalesce(p_token_risposta, 0)::numeric / 1000000 * v_prezzo.euro_milione_out, 5);
    else
      v_msg := coalesce(v_msg || ' — ', '') ||
        'Il costo di questa lettura non e'' stato conteggiato: il modello «' || p_modello ||
        '» non e'' nel listino. Va aggiunto, altrimenti la spesa del mese risulta piu'' bassa del vero.';
    end if;
  end if;

  insert into letture_ricetta (esito, modello, token_domanda, token_risposta, costo_euro, messaggio, creato_da)
  values (p_esito, p_modello, coalesce(p_token_domanda, 0), coalesce(p_token_risposta, 0), v_costo, v_msg, auth.uid())
  returning id into v_id;

  return jsonb_build_object('id', v_id, 'costo_euro', v_costo, 'nel_listino', v_prezzo.modello is not null);
end $funzione$;

comment on function registra_lettura_ricetta(text, text, integer, integer, text) is
  'Registra una chiamata all''assistente su una ricetta letta da un link, col suo costo dal listino. Solo titolare: la chiama la funzione online ricetta-da-link col token di chi importa.';

revoke all on function registra_lettura_ricetta(text, text, integer, integer, text) from public, anon, authenticated;
grant execute on function registra_lettura_ricetta(text, text, integer, integer, text) to authenticated;

-- ---------------------------------------------------------------------
-- 1b. IL TETTO UNICO LA COMPRENDE
-- ---------------------------------------------------------------------
-- ⚠️ Riscritta dal corpo VIVO (letto dalla produzione il 10/10/2026, uguale
--    a 20260829000003): si aggiunge solo l'ultimo ramo. I permessi restano
--    quelli di 20260829000004 (nessuno dall'app): `create or replace` non li
--    tocca, e qui non se ne riscrive nessuno a memoria.
create or replace function consumi_ai()
returns table(fonte text, quando timestamptz, modello text,
              token_domanda integer, token_risposta integer,
              costo_euro numeric, costo_noto boolean)
language sql
stable
security definer
set search_path = public
as $fn$
  -- Le due che il costo se lo scrivono da sole quando nascono.
  select 'foto'::text, l.creato_il, l.modello, l.token_domanda, l.token_risposta,
         l.costo_euro, l.costo_euro is not null
    from letture_foto l
  union all
  select 'voce', d.creato_il, d.modello, d.token_domanda, d.token_risposta,
         d.costo_euro, d.costo_euro is not null
    from dettature d
  union all
  -- 🔴 L'ARCHIVIO: ha i token e non ha il costo. Si calcola dal listino, e
  -- se il modello non e' a listino il costo resta VUOTO e dichiarato.
  select 'archivio', a.creato_il, a.modello, a.token_domanda, a.token_risposta,
         case when c.modello is null then null
              else round(a.token_domanda::numeric / 1000000 * c.euro_milione_in
                       + a.token_risposta::numeric / 1000000 * c.euro_milione_out, 5) end,
         c.modello is not null
    from domande_archivio a
    left join costo_modello_ai c on c.modello = a.modello
  union all
  -- 🔴 LA POSTA. Le righe nuove portano i due numeri separati; quelle vecchie
  -- solo la somma, e per quelle il costo non si puo' ricostruire.
  select 'posta', p.proposta_il, p.proposta_modello,
         p.proposta_token_domanda, p.proposta_token_risposta,
         case when c.modello is null
               or p.proposta_token_domanda is null
               or p.proposta_token_risposta is null then null
              else round(p.proposta_token_domanda::numeric / 1000000 * c.euro_milione_in
                       + p.proposta_token_risposta::numeric / 1000000 * c.euro_milione_out, 5) end,
         (c.modello is not null
          and p.proposta_token_domanda is not null
          and p.proposta_token_risposta is not null)
    from posta_ricevuta p
    left join costo_modello_ai c on c.modello = p.proposta_modello
   where p.proposta_il is not null
  union all
  -- 10/10/2026: le ricette lette da un link. Il costo se lo scrive da sola
  -- quando nasce; un modello fuori listino lascia 0 e lo dichiara nel
  -- messaggio, quindi qui il costo e' «noto» solo se il modello e' a listino.
  select 'ricetta', r.creato_il, r.modello, r.token_domanda, r.token_risposta,
         case when r.modello is null or c.modello is not null then r.costo_euro end,
         (r.modello is null or c.modello is not null)
    from letture_ricetta r
    left join costo_modello_ai c on c.modello = r.modello;
$fn$;

-- ---------------------------------------------------------------------
-- 2. LA BOZZA DICE COSA HA PROPOSTO L'ASSISTENTE
-- ---------------------------------------------------------------------
alter table bozze_ricetta
  add column if not exists proposte_assistente text[] not null default '{}';

comment on column bozze_ricetta.proposte_assistente is
  'Quali parti della bozza sono PROPOSTE dall''assistente e non scritte da Alessio («la categoria», «le fasi dei passaggi», «i nomi degli ingredienti»). Vuoto: nessuna proposta, oppure le ha gia'' guardate («Visto»). Lo scrive la creazione da un link; dal browser si puo'' solo svuotare.';

grant update (proposte_assistente) on bozze_ricetta to authenticated;

-- ---------------------------------------------------------------------
-- 3. LA CREAZIONE DA UN LINK RICEVE CATEGORIA, FASI E PROPOSTE
-- ---------------------------------------------------------------------
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
  v_id        uuid;
  v_titolo    text;
  v_origine   text;
  v_categoria recipe_category;
  v_fase      step_phase;
  v_riga      jsonb;
  v_n         integer := 0;
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

  -- ⚠️ Un valore fuori elenco si RIFIUTA con un messaggio leggibile: chi
  --    chiama li ha gia' filtrati, quindi arrivare qui vuol dire un difetto.
  begin
    v_categoria := nullif(p_bozza ->> 'categoria', '')::recipe_category;
  exception when invalid_text_representation then
    raise exception 'La categoria «%» non esiste nel Ricettario.', p_bozza ->> 'categoria';
  end;

  insert into bozze_ricetta (
    titolo, origine_tipo, origine_riferimento, sunto, porzioni, categoria,
    buchi_dichiarati, proposte_assistente, gesto_creazione
  ) values (
    v_titolo,
    v_origine,
    nullif(btrim(coalesce(p_bozza ->> 'origine_riferimento', '')), ''),
    nullif(btrim(coalesce(p_bozza ->> 'sunto', '')), ''),
    (p_bozza ->> 'porzioni')::integer,
    v_categoria,
    coalesce(
      (select array_agg(b) from jsonb_array_elements_text(coalesce(p_bozza -> 'buchi_dichiarati', '[]'::jsonb)) b),
      '{}'),
    coalesce(
      (select array_agg(b) from jsonb_array_elements_text(coalesce(p_bozza -> 'proposte_assistente', '[]'::jsonb)) b),
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
    begin
      v_fase := nullif(v_riga ->> 'fase', '')::step_phase;
    exception when invalid_text_representation then
      raise exception 'La fase «%» del passaggio % non esiste.', v_riga ->> 'fase', v_n;
    end;
    insert into bozze_ricetta_passaggi (bozza_id, posizione, fase, descrizione)
    values (v_id, v_n, v_fase, nullif(btrim(coalesce(v_riga ->> 'descrizione', '')), ''));
  end loop;

  return jsonb_build_object('bozza_id', v_id, 'gia_fatto', false);
end
$funzione$;

comment on function crea_bozza_da_lettura(jsonb, jsonb, jsonb, uuid) is
  'Crea una bozza di ricetta da una lettura (un link): bozza, ingredienti e passaggi in una transazione, con categoria, fasi e l''elenco di cio'' che ha proposto l''assistente. Non collega ingredienti all''anagrafica, non tocca il Ricettario, rifiuta senza titolo e rifiuta categorie o fasi fuori elenco; lo stesso gesto ripetuto riceve la stessa bozza. Solo titolare, e solo attraverso il corridoio.';

revoke all on function crea_bozza_da_lettura(jsonb, jsonb, jsonb, uuid) from public, anon, authenticated;
grant execute on function crea_bozza_da_lettura(jsonb, jsonb, jsonb, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- VERIFICA — dentro una sotto-transazione annullata
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_foto     jsonb := foto_righe();
  v_titolare uuid;
  v_staff    uuid;
  v_r        jsonb;
  v_bozza    uuid;
  v_n        integer;
  v_respinto boolean;
  v_costo    numeric;
  v_prezzo   costo_modello_ai%rowtype;
begin
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  select user_id into v_staff from user_roles where role = 'staff' limit 1;
  if v_titolare is null or v_staff is null then
    raise exception 'VERIFICA: servono un titolare e uno staff in user_roles.';
  end if;

  -- (0) Dal catalogo: niente alla chiave pubblica, niente scrittura dal browser.
  if has_function_privilege('anon', 'registra_lettura_ricetta(text, text, integer, integer, text)', 'execute') then
    raise exception 'VERIFICA: la registrazione della spesa e'' eseguibile con la chiave pubblica.';
  end if;
  if has_table_privilege('authenticated', 'letture_ricetta', 'INSERT')
     or has_table_privilege('authenticated', 'letture_ricetta', 'DELETE')
     or has_table_privilege('authenticated', 'letture_ricetta', 'UPDATE') then
    raise exception 'VERIFICA: la spesa dell''assistente si potrebbe scrivere o cancellare dal browser.';
  end if;
  if has_column_privilege('authenticated', 'bozze_ricetta', 'proposte_assistente', 'INSERT') then
    raise exception 'VERIFICA: le proposte dell''assistente si potrebbero inventare dal browser.';
  end if;
  -- La rete delle fonti di spesa non deve vedere la tabella nuova come scoperta.
  if exists (select 1 from fonti_ai_scoperte() f where f.tabella = 'letture_ricetta') then
    raise exception 'VERIFICA: la spesa delle ricette non e'' compresa nel tetto.';
  end if;

  select * into v_prezzo from costo_modello_ai where modello = 'claude-haiku-4-5-20251001';
  if not found then
    raise exception 'VERIFICA: il modello dell''importazione non e'' nel listino: la sua spesa non si conterebbe.';
  end if;

  begin  -- <<< la sotto-transazione che verra' annullata
    -- (1) Lo staff viene respinto, su tutte e due le funzioni.
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
    v_respinto := false;
    begin
      perform registra_lettura_ricetta('proposte', 'claude-haiku-4-5-20251001', 10, 10);
    exception when others then v_respinto := true;
    end;
    if not v_respinto then raise exception 'VERIFICA: lo staff ha registrato una spesa.'; end if;

    -- (2) Il titolare registra: il costo e' quello del listino, e il tetto lo vede.
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);
    v_r := registra_lettura_ricetta('proposte', 'claude-haiku-4-5-20251001', 1000000, 1000000);
    v_costo := round(v_prezzo.euro_milione_in + v_prezzo.euro_milione_out, 5);
    if (v_r ->> 'costo_euro')::numeric is distinct from v_costo then
      raise exception 'VERIFICA: costo atteso %, registrato %.', v_costo, v_r ->> 'costo_euro';
    end if;
    if not exists (select 1 from consumi_ai() c
                    where c.fonte = 'ricetta' and c.costo_euro = v_costo and c.costo_noto) then
      raise exception 'VERIFICA: la spesa della ricetta non compare fra i consumi dell''assistente.';
    end if;
    -- Un modello fuori listino: costo non noto, e dichiarato.
    perform registra_lettura_ricetta('errore', 'ZZ-modello-inesistente', 5, 5);
    if not exists (select 1 from consumi_ai() c
                    where c.fonte = 'ricetta' and c.modello = 'ZZ-modello-inesistente'
                      and c.costo_euro is null and not c.costo_noto) then
      raise exception 'VERIFICA: un costo non calcolabile e'' diventato un numero.';
    end if;

    -- (3) La bozza nasce con categoria, fasi e proposte.
    v_r := crea_bozza_da_lettura(
      '{"titolo":"ZZ verifica assistente","origine_tipo":"link","categoria":"dolce","proposte_assistente":["la categoria","le fasi dei passaggi"]}',
      '[{"testo_originale":"200 ml panna","nome":"panna","quantita":0.2,"unita":"l"}]',
      '[{"descrizione":"Scalda la panna.","fase":"cottura"},{"descrizione":"Fai rapprendere.","fase":null}]',
      gen_random_uuid());
    v_bozza := (v_r ->> 'bozza_id')::uuid;
    if (select categoria::text from bozze_ricetta where id = v_bozza) is distinct from 'dolce'
       or (select cardinality(proposte_assistente) from bozze_ricetta where id = v_bozza) is distinct from 2 then
      raise exception 'VERIFICA: categoria o proposte non sono state scritte.';
    end if;
    if (select fase::text from bozze_ricetta_passaggi where bozza_id = v_bozza and posizione = 1) is distinct from 'cottura'
       or (select fase from bozze_ricetta_passaggi where bozza_id = v_bozza and posizione = 2) is not null then
      raise exception 'VERIFICA: le fasi non sono quelle passate.';
    end if;
    if exists (select 1 from bozze_ricetta_ingredienti where bozza_id = v_bozza and ingredient_id is not null) then
      raise exception 'VERIFICA: un ingrediente e'' stato collegato da solo all''anagrafica.';
    end if;

    -- (4) Una bozza senza proposte nasce con l'elenco vuoto, non nullo.
    v_r := crea_bozza_da_lettura('{"titolo":"ZZ verifica senza assistente"}', '[]', '[]', gen_random_uuid());
    if (select proposte_assistente from bozze_ricetta where id = (v_r ->> 'bozza_id')::uuid) is distinct from '{}'::text[] then
      raise exception 'VERIFICA: una bozza senza proposte ne dichiara qualcuna.';
    end if;

    -- (5) Categoria e fase fuori elenco: rifiutate.
    v_respinto := false;
    begin
      perform crea_bozza_da_lettura('{"titolo":"ZZ x","categoria":"bevanda"}', '[]', '[]', gen_random_uuid());
    exception when others then v_respinto := sqlerrm like '%categoria%';
    end;
    if not v_respinto then raise exception 'VERIFICA: una categoria inventata e'' stata accettata.'; end if;
    v_respinto := false;
    begin
      perform crea_bozza_da_lettura('{"titolo":"ZZ x"}', '[]', '[{"descrizione":"x","fase":"riposo"}]', gen_random_uuid());
    exception when others then v_respinto := sqlerrm like '%fase%';
    end;
    if not v_respinto then raise exception 'VERIFICA: una fase inventata e'' stata accettata.'; end if;

    raise exception 'ZZ_ANNULLA';  -- <<< qui la sotto-transazione rientra
  exception when others then
    if sqlerrm <> 'ZZ_ANNULLA' then raise; end if;
  end;

  perform set_config('request.jwt.claims', null, true);
  perform pretendi_nessun_residuo(v_foto, 'la verifica dell''assistente sulle ricette importate');

  raise notice 'Fatto: la spesa delle ricette importate entra nel tetto (e un costo ignoto resta ignoto), la bozza nasce con categoria, fasi e proposte dichiarate, i valori inventati sono rifiutati e niente si collega da solo al magazzino. Provato e annullato: zero residui.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20261010000003', 'l_assistente_sistema_la_ricetta_importata')
on conflict (version) do nothing;
