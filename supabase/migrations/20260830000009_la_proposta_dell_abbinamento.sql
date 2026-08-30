-- =====================================================================
-- LA PROPOSTA DELL'ABBINAMENTO — 30/08/2026
-- =====================================================================
--
-- 🔴 DECISIONE DI ALESSIO, col suo vincolo: il gestionale **propone** quale
-- prodotto comprato corrisponde a una voce della carta, e nella proposta si
-- devono vedere **PRODUTTORE, ANNATA e FORMATO** — non solo il nome.
-- Le sue parole: *«Grillo» contro «Grillo» è testa o croce.*
--
-- ⚠️ **PROPONE, NON DECIDE** (regola sua del 25/08): senza il suo sì non
-- collega niente. Questa funzione **legge e basta** — non scrive una riga.
--
-- 🔴 E UNA COSA VA DETTA SUBITO, perché è un limite e non una dimenticanza:
-- **l'annata non ha una colonna**. È la decisione di stamattina — *l'annata
-- è una confezione, non una riga nuova* — quindi vive **dentro la
-- descrizione dell'articolo** («Nero d'Avola 2022»), insieme a com'è scritta
-- sulla fattura. La proposta quindi mostra **la descrizione per intero**,
-- che è il posto dove l'annata si legge, accanto a marca e formato che
-- hanno colonne loro. ⚠️ Il gestionale **non estrae** l'annata e non prova
-- a indovinarla: mostra quello che c'è scritto.
--
-- ⚠️ COME SI SOMIGLIANO DUE NOMI, e perché così. Non c'è `pg_trgm` in
-- questo database (misurato: le estensioni sono otto e quella non c'è),
-- quindi si contano **le parole in comune** usando il normalizzatore che il
-- progetto ha già (`nome_ingrediente_chiave`, che toglie accenti e
-- punteggiatura). Le parole di **una o due lettere si buttano**: «di», «e»,
-- «da» starebbero in ogni nome e farebbero somigliare tutto a tutto.
--
-- ⚠️ E NON PROPONE NIENTE QUANDO NON HA NIENTE DA DIRE: zero parole in
-- comune = nessuna riga. Una proposta a caso è peggio di nessuna proposta —
-- si accetta guardando di sfuggita, e da lì in poi il magazzino scarica il
-- vino sbagliato senza che nessun errore lo dica.

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
  -- Il portiere RIFIUTA, non filtra: la proposta porta con sé i prezzi
  -- d'acquisto, e un elenco vuoto si leggerebbe «non c'è niente da
  -- abbinare» (lezione del 27/08).
  if not (select is_titolare()) then
    raise exception 'Le proposte di abbinamento le vede solo il titolare: contengono i prezzi d''acquisto.';
  end if;

  return query
  with voci as (
    select b.id, b.name, b.serving, b.producer,
           array(select w from unnest(string_to_array(nome_ingrediente_chiave(b.name), ' ')) w
                  where length(w) > 2) as parole
      from bar_items b
     where b.ingredient_id is null
       and b.active
       and (p_bar_item_id is null or b.id = p_bar_item_id)
  ),
  candidati as (
    select v.id, v.name, v.serving, v.producer, i.id as ing, i.name as prodotto,
           cardinality(array(
             select unnest(v.parole)
             intersect
             select w from unnest(string_to_array(nome_ingrediente_chiave(i.name), ' ')) w
              where length(w) > 2
           )) as comuni
      from voci v
      cross join ingredients i
     where i.active and i.alimentare and i.preparazione_id is null
  )
  select c.id, c.name, c.serving, c.producer, c.ing, c.prodotto, c.comuni,
         -- 🔴 LE CONFEZIONI COMPRATE DAVVERO, ed è la parte che Alessio ha
         --    chiesto: marca, formato e la descrizione — che è dove si legge
         --    l'annata. Vuoto vuol dire «di questo prodotto non hai ancora
         --    comprato niente», e la schermata lo dice invece di tacere.
         coalesce((
           select jsonb_agg(jsonb_build_object(
                    'marca', a.marca, 'formato', a.formato,
                    'descrizione', a.descrizione, 'fornitore', s.name)
                  order by a.aggiornato_il desc)
             from articoli_fornitore a
             left join suppliers s on s.id = a.supplier_id
            where a.ingredient_id = c.ing and not a.ignora
         ), '[]'::jsonb),
         nullif((select i2.current_price from ingredients i2 where i2.id = c.ing), 0)
    from candidati c
   where c.comuni > 0
   order by c.id, c.comuni desc, c.prodotto;
end;
$function$;

-- ⚠️ I PERMESSI SULLO STAMPO DELLE ALTRE CHE ESPONGONO PREZZI D'ACQUISTO,
--    misurato il 30/08: `varianti_ingrediente` e `margine_carta` sono
--    concesse a `authenticated` e hanno il portiere dentro. Nessun `grant`
--    scritto a memoria: questo è quello che si è letto dal database.
revoke all on function abbinamenti_carta_proposti(uuid) from public, anon, authenticated;
grant execute on function abbinamenti_carta_proposti(uuid) to authenticated;

do $verifica$
declare
  v_foto   jsonb := foto_righe();
  v_ent    uuid;
  v_tit    uuid;
  v_n      integer;
  v_ok     boolean;
  v_msg    text;
  v_conf   jsonb;
  v_prod   text;
  v_com    integer;
begin
  select id into v_ent from entities order by created_at limit 1;
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  if v_ent is null or v_tit is null then
    raise exception 'Manca la societa'' o il titolare: impossibile verificare.';
  end if;

  -- 🔴 LA VERIFICA NON CANCELLA, ANNULLA (decisione del 30/08): tutto quello
  --    che costruisce vive in una sotto-transazione che alla fine rientra.
  --    Cosi' il registro delle cancellazioni resta ACCESO per tutto il tempo
  --    e non c'e' nessuna lapide da togliere.
  --    ⚠️ Il `raise` dentro il gestore non e' un dettaglio: senza, una
  --       verifica FALLITA verrebbe inghiottita dallo stesso meccanismo che
  --       serve ad annullare, e la migrazione passerebbe verde.
  begin
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);

    -- L'esempio si costruisce: due prodotti che si somigliano solo in parte,
    -- cosi' la proposta deve SCEGLIERE invece di dire tutto.
    insert into ingredients (name, category, unit, current_price, entity_id, alimentare, tenuto_in_magazzino)
    values ('ZZ Nero d''Avola Feudo', 'bevande', 'pz', 7, v_ent, true, true);
    insert into ingredients (name, category, unit, current_price, entity_id, alimentare, tenuto_in_magazzino)
    values ('ZZ Zucchina siciliana lunga', 'verdura', 'kg', 2, v_ent, true, true);

    insert into articoli_fornitore (descrizione, chiave, ingredient_id, marca, formato)
    select 'ZZ Nero d''Avola 2022 Feudo Arancio', chiave_articolo('ZZ Nero d''Avola 2022 Feudo Arancio'),
           i.id, 'Feudo Arancio', '0,75 l'
      from ingredients i where i.name = 'ZZ Nero d''Avola Feudo';

    insert into bar_items (section, category, name, serving, selling_price, producer)
    values ('vini', 'ZZ prova', 'ZZ Nero d''Avola Feudo', 'Bottiglia', 18, 'Feudo Arancio');

    -- (1) PROPONE IL PRODOTTO GIUSTO, e non l'altro.
    select count(*) into v_n from abbinamenti_carta_proposti()
     where voce = 'ZZ Nero d''Avola Feudo';
    if v_n = 0 then
      raise exception 'Nessuna proposta per una voce che ha il suo prodotto in magazzino.';
    end if;

    select prodotto, parole_in_comune, confezioni into v_prod, v_com, v_conf
      from abbinamenti_carta_proposti()
     where voce = 'ZZ Nero d''Avola Feudo'
     order by parole_in_comune desc limit 1;
    if v_prod is distinct from 'ZZ Nero d''Avola Feudo' then
      raise exception 'La proposta migliore e'' «%» invece del prodotto giusto.', coalesce(v_prod, '(vuoto)');
    end if;

    -- (2) LA ZUCCHINA NON C'ENTRA E NON DEVE COMPARIRE. Senza questo
    --     controllo, una funzione che proponesse TUTTO passerebbe il (1).
    if exists (select 1 from abbinamenti_carta_proposti()
                where voce = 'ZZ Nero d''Avola Feudo' and prodotto like '%Zucchina%') then
      raise exception 'La proposta comprende un prodotto che non c''entra niente.';
    end if;

    -- (3) 🔴 SI VEDONO PRODUTTORE, ANNATA E FORMATO — il vincolo di Alessio.
    --     L'annata non ha una colonna: si legge dentro la descrizione, ed e'
    --     li' che si controlla.
    if v_conf->0->>'marca' is distinct from 'Feudo Arancio' then
      raise exception 'La proposta non porta il produttore: «%».', coalesce(v_conf->0->>'marca', '(vuoto)');
    end if;
    if v_conf->0->>'formato' is distinct from '0,75 l' then
      raise exception 'La proposta non porta il formato: «%».', coalesce(v_conf->0->>'formato', '(vuoto)');
    end if;
    if coalesce(v_conf->0->>'descrizione', '') not like '%2022%' then
      raise exception 'La proposta non porta l''annata: nella descrizione non c''e'' «%».', '2022';
    end if;

    -- (4) NON SCRIVE NIENTE: la voce resta senza prodotto finche' non lo
    --     dice Alessio.
    if exists (select 1 from bar_items where name = 'ZZ Nero d''Avola Feudo' and ingredient_id is not null) then
      raise exception 'La proposta ha COLLEGATO da sola: doveva solo proporre.';
    end if;

    -- (5) E IL PORTIERE RIFIUTA chi non e' il titolare.
    perform set_config('request.jwt.claims',
      json_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, true);
    v_ok := false;
    begin
      perform count(*) from abbinamenti_carta_proposti();
    exception when others then
      v_ok := true; v_msg := sqlerrm;
    end;
    if not v_ok then
      raise exception 'Le proposte si sono fatte leggere da chi non e'' il titolare.';
    end if;
    if v_msg not like '%solo il titolare%' then
      raise exception 'Il rifiuto non dice chi puo'' vederle: «%».', v_msg;
    end if;

    raise exception 'ZZ_ANNULLA' using errcode = 'P0001';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'ZZ_ANNULLA' then raise; end if;
  end;

  perform set_config('request.jwt.claims', null, true);

  -- ⚠️ NIENTE DA CANCELLARE, ed e' il punto: si controlla che sia vero.
  select count(*) into v_n from bar_items where category = 'ZZ prova';
  if v_n > 0 then
    raise exception 'Sono rimaste % voci di carta: l''annullamento non ha funzionato.', v_n;
  end if;
  select count(*) into v_n from ingredients where name like 'ZZ %';
  if v_n > 0 then
    raise exception 'Sono rimasti % prodotti: l''annullamento non ha funzionato.', v_n;
  end if;
  select count(*) into v_n from pg_trigger t where t.tgenabled = 'D' and not t.tgisinternal;
  if v_n > 0 then
    raise exception '% trigger sono spenti: la guardia non e'' rimasta accesa.', v_n;
  end if;

  perform pretendi_nessun_residuo(v_foto, 'la verifica della proposta di abbinamento');
  raise notice 'Fatto: la proposta trova il prodotto giusto, scarta quello che non c''entra, porta produttore/annata/formato, e non collega niente da sola.';
end
$verifica$;

insert into applied_migrations (version, name)
values ('20260830000009', 'la_proposta_dell_abbinamento') on conflict (version) do nothing;
