-- =====================================================================
-- I MATERIALI DI CONSUMO HANNO LE LORO PAROLE
-- 29/08/2026 — richiesta di Alessio
-- =====================================================================
-- 🔴 IL DIFETTO, visto da lui aprendo la scheda della «Carta forno»: le
-- categorie e le unita di misura proposte sono quelle degli ALIMENTI. Un
-- rotolo di carta forno finisce in categoria «Altro» perche le altre
-- quattordici parlano di verdura, pesce e latticini — e come unita gli si
-- offrono kg, g, mazzo.
--
-- ⚠️ LE PAROLE NUOVE LE PROPONGO IO E LE CORREGGE LUI, ed e stato chiesto
-- espressamente cosi. Stanno qui sotto, e sono dati: si cambiano dalla
-- schermata, non con una migrazione.
--
-- 🔴 UN CONCETTO SOLO PER TUTT E DUE I CATALOGHI: `ambito`, con tre valori
-- — `alimenti`, `materiali`, `entrambi`. Il terzo non e una comodita: il
-- litro e il pezzo servono ai due mondi allo stesso modo, e sdoppiarli
-- darebbe due righe che dicono la stessa cosa e possono divergere. Con due
-- soli valori bisognerebbe scegliere quale mondo se li tiene, e sbagliare.
--
-- ⚠️ LE UNITA DIVENTANO DATI, come le categorie il 27/08. Fino a stanotte
-- vivevano in un elenco scritto nel codice (`UNITS` in `constants.js`), e
-- aggiungere «rotolo» solo per i materiali avrebbe voluto dire un secondo
-- elenco accanto al primo: due verita sulla stessa cosa, che e precisamente
-- cio che la nota sulle categorie dice di non rifare. Una tabella sola, e
-- il codice la legge.

-- ---------------------------------------------------------------------
-- 1. L'ambito sulle categorie che gia c'erano.
--
--    ⚠️ QUI IL VALORE PREDEFINITO E LA RISPOSTA GIUSTA, e va detto perche
--    la regola del 14/08 dice il contrario in generale: un predefinito su
--    righe gia esistenti risponde al posto di chi non ha risposto. Non qui:
--    quelle quindici categorie sono nate in un mondo dove i materiali di
--    consumo non esistevano, quindi «alimenti» non e una risposta inventata
--    — e la storia di cio che sono.
-- ---------------------------------------------------------------------
alter table categorie_ingrediente
  add column if not exists ambito text not null default 'alimenti';

do $vincolo$
begin
  if not exists (select 1 from pg_constraint where conname = 'categorie_ingrediente_ambito_check') then
    alter table categorie_ingrediente
      add constraint categorie_ingrediente_ambito_check
      check (ambito in ('alimenti', 'materiali', 'entrambi'));
  end if;
end
$vincolo$;

comment on constraint categorie_ingrediente_ambito_check on categorie_ingrediente is
  'Una categoria vale per gli alimenti, per i materiali di consumo, o per tutti e due: non c''e'' un quarto caso.';

comment on column categorie_ingrediente.ambito is
  'A quale dei due mondi appartiene: alimenti, materiali, entrambi. «Altro» sta in entrambi apposta — sdoppiarla darebbe due righe che dicono la stessa cosa.';

-- «Altro» e il contenitore di tutti e due i mondi: una sola riga.
update categorie_ingrediente set ambito = 'entrambi' where codice = 'altro';

-- ⚠️ LE SEI CATEGORIE DEI MATERIALI, proposte da me su richiesta di Alessio.
--    Cinque le ha nominate lui (pulizia, carta e monouso, imballaggi,
--    attrezzatura minuta, manutenzione); la sesta — ufficio e cassa — la
--    aggiungo perche in un locale ci sono i rotoli dello scontrino, il
--    toner e la cancelleria, e senza finirebbero in «Altro», cioe il posto
--    da cui questo lavoro nasce.
insert into categorie_ingrediente (codice, nome, ordine, attiva, di_sistema, ambito)
values
  ('pulizia',        'Pulizia e sanificazione',     200, true, true, 'materiali'),
  ('carta_monouso',  'Carta e monouso',             210, true, true, 'materiali'),
  ('imballaggi',     'Imballaggi e asporto',        220, true, true, 'materiali'),
  ('attrezzatura',   'Attrezzatura minuta',         230, true, true, 'materiali'),
  ('manutenzione',   'Manutenzione e ricambi',      240, true, true, 'materiali'),
  ('ufficio_cassa',  'Ufficio e cassa',             250, true, true, 'materiali')
on conflict (codice) do nothing;

-- ---------------------------------------------------------------------
-- 2. Le unita di misura.
--
--    🔴 `ingredients.unit` NON E TESTO LIBERO: e un ENUM (`unit_type`), e
--    me l ha detto il database fermando la prima versione di questa
--    migrazione. Il mio controllo cercava un vincolo `check` e non lo
--    vedeva — un enum e un vocabolario chiuso che si scrive in un altro
--    posto. Quindi «rotolo» non basta metterlo in una tabella: senza
--    aggiungerlo al tipo, salvarlo su un prodotto verrebbe RIFIUTATO.
--
--    ⚠️ E IL PREZZO DELL ENUM E DICHIARATO, non aggirato: finche resta,
--    un unita NUOVA non si puo aggiungere mentre si compila — come si fa
--    invece con le categorie, che il 27/08 hanno smesso di essere un enum
--    proprio per questo. Toglierlo e un lavoro a se: `unit_type` e usato
--    da SETTE colonne e CINQUE viste (misurato), contro l unica colonna
--    di `ingredient_category` — e quella conversione costo 684 righe piu
--    altre 780 per rimediare ai tre punti che aveva rotto in silenzio.
--    Farla stanotte, di corsa, sarebbe la cosa sbagliata.
--
--    ⚠️ Un valore aggiunto a un enum NON e usabile nella stessa
--    transazione, e queste migrazioni girano tutte in una transazione
--    sola: qui sotto si controlla che il valore ESISTA, e che si possa
--    davvero SALVARE lo prova `tests/app/unita-materiali.test.js`, che
--    gira dopo, con un prodotto vero.
-- ---------------------------------------------------------------------
do $enum$
declare
  v text;
begin
  foreach v in array array['rotolo', 'conf', 'paio', 'm'] loop
    if not exists (select 1 from pg_enum e join pg_type ty on ty.oid = e.enumtypid
                    where ty.typname = 'unit_type' and e.enumlabel = v) then
      execute format('alter type unit_type add value %L', v);
    end if;
  end loop;
end
$enum$;
create table if not exists unita_misura (
  codice      text primary key,
  nome        text not null,
  ordine      integer not null default 500,
  ambito      text not null default 'alimenti'
              check (ambito in ('alimenti', 'materiali', 'entrambi')),
  attiva      boolean not null default true,
  di_sistema  boolean not null default false,
  creata_il   timestamptz not null default now(),
  creata_da   uuid
);

comment on table unita_misura is
  'Le unita con cui si compra e si conta un prodotto. Dal 29/08/2026 sono dati e non piu'' un elenco nel codice: aggiungerne una per i materiali non deve creare un secondo elenco accanto al primo.';

alter table unita_misura enable row level security;

do $policy$
begin
  if not exists (select 1 from pg_policies where tablename = 'unita_misura' and policyname = 'unita_misura_lettura') then
    create policy unita_misura_lettura on unita_misura
      for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'unita_misura' and policyname = 'unita_misura_titolare') then
    create policy unita_misura_titolare on unita_misura
      for all to authenticated
      using ((select is_titolare())) with check ((select is_titolare()));
  end if;
end
$policy$;

-- ⚠️ I CODICI DELLE PRIME CINQUE SONO QUELLI CHE GIA' STANNO SCRITTI SUI
--    PRODOTTI (`kg`, `g`, `l`, `pz`, `mazzo`): cambiarli renderebbe illeggibile
--    l'unita' di 133 prodotti veri. Si aggiunge, non si rinomina.
insert into unita_misura (codice, nome, ordine, ambito, di_sistema)
values
  ('kg',     'kg',          10,  'alimenti',  true),
  ('g',      'g',           20,  'alimenti',  true),
  ('l',      'l',           30,  'entrambi',  true),
  ('pz',     'pezzo',       40,  'entrambi',  true),
  ('mazzo',  'mazzo',       50,  'alimenti',  true),
  ('rotolo', 'rotolo',      60,  'materiali', true),
  ('conf',   'confezione',  70,  'materiali', true),
  ('paio',   'paio',        80,  'materiali', true),
  ('m',      'metro',       90,  'materiali', true)
on conflict (codice) do nothing;

-- ---------------------------------------------------------------------
-- 3. Chi propone che cosa.
--
--    ⚠️ Le due funzioni cambiano FORMA (prima non avevano parametri),
--    quindi vanno tolte e rifatte — e una funzione rifatta nasce
--    ESEGUIBILE DA CHIUNQUE ABBIA LA CHIAVE PUBBLICA. I permessi qui sotto
--    sono quelli LETTI da `pg_proc.proacl` prima di toccarle, non
--    ricopiati a memoria dalle funzioni accanto.
-- ---------------------------------------------------------------------
drop function if exists public.categorie_proponibili();
drop function if exists public.categorie_proponibili(text);

create function public.categorie_proponibili(p_ambito text default 'alimenti')
returns table(codice text, nome text, ordine integer)
language sql stable
set search_path to 'public'
as $$
  select c.codice, c.nome, c.ordine
    from categorie_ingrediente c
   where c.attiva
     and (c.ambito = 'entrambi' or c.ambito = coalesce(nullif(btrim(p_ambito), ''), 'alimenti'))
   order by c.ordine, c.nome;
$$;

revoke all on function public.categorie_proponibili(text) from public, anon, authenticated;
grant execute on function public.categorie_proponibili(text) to authenticated;

create or replace function public.unita_proponibili(p_ambito text default 'alimenti')
returns table(codice text, nome text, ordine integer)
language sql stable
set search_path to 'public'
as $$
  select u.codice, u.nome, u.ordine
    from unita_misura u
   where u.attiva
     and (u.ambito = 'entrambi' or u.ambito = coalesce(nullif(btrim(p_ambito), ''), 'alimenti'))
   order by u.ordine, u.nome;
$$;

revoke all on function public.unita_proponibili(text) from public, anon, authenticated;
grant execute on function public.unita_proponibili(text) to authenticated;

-- ---------------------------------------------------------------------
-- 4. Aggiungerne una mentre si compila, nel mondo giusto.
-- ---------------------------------------------------------------------
-- rete-guardie: aggiungi_categoria_ingrediente — prende l ambito, che prima non esisteva
drop function if exists public.aggiungi_categoria_ingrediente(text);
drop function if exists public.aggiungi_categoria_ingrediente(text, text);

create function public.aggiungi_categoria_ingrediente(p_nome text, p_ambito text default 'alimenti')
returns jsonb
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_nome   text;
  v_codice text;
  v_gia    text;
  v_amb    text;
begin
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' aggiungere una categoria';
  end if;

  v_nome := nullif(btrim(coalesce(p_nome, '')), '');
  if v_nome is null then
    raise exception 'Serve il nome della categoria';
  end if;

  v_amb := coalesce(nullif(btrim(p_ambito), ''), 'alimenti');
  if v_amb not in ('alimenti', 'materiali', 'entrambi') then
    raise exception 'Non so dove metterla: «%» non e'' ne'' alimenti ne'' materiali', p_ambito;
  end if;

  -- Il codice si ricava dal nome, con la stessa forma dei quindici che
  -- c'erano: minuscolo, senza accenti, spazi in trattini bassi.
  v_codice := regexp_replace(
                regexp_replace(lower(translate(v_nome,
                  'àáâäãèéêëìíîïòóôöõùúûüçñ', 'aaaaaeeeeiiiiooooouuuucn')),
                  '[^a-z0-9]+', '_', 'g'),
                '^_+|_+$', '', 'g');
  if v_codice is null or v_codice = '' then
    raise exception 'Da «%» non riesco a ricavare un codice: usa qualche lettera', v_nome;
  end if;

  -- ⚠️ Se c'e' gia', si dice QUALE e non si fa finta di averla creata: due
  --    categorie che si somigliano sono il doppione che questo catalogo
  --    esiste per evitare.
  select c.codice into v_gia from categorie_ingrediente c where c.codice = v_codice;
  if v_gia is not null then
    return jsonb_build_object('codice', v_gia, 'nuova', false,
      'nome', (select nome from categorie_ingrediente where codice = v_gia));
  end if;

  insert into categorie_ingrediente (codice, nome, ordine, di_sistema, ambito, creata_da)
  values (v_codice, v_nome, 500, false, v_amb, auth.uid());

  return jsonb_build_object('codice', v_codice, 'nuova', true, 'nome', v_nome);
end;
$$;

revoke all on function public.aggiungi_categoria_ingrediente(text, text) from public, anon, authenticated;
grant execute on function public.aggiungi_categoria_ingrediente(text, text) to authenticated;

-- ⚠️ NON C E UN «aggiungi unita» come per le categorie, ed e una rinuncia
--    dichiarata invece che una dimenticanza: finche `unit_type` e un enum,
--    un pulsante che crea un unita nuova prometterebbe una cosa che il
--    database poi RIFIUTA al salvataggio. Un gesto che riesce a meta e
--    peggio di un gesto che non c e.


-- =====================================================================
-- VERIFICA
-- =====================================================================
do $verifica$
declare
  v_foto   jsonb;
  v_tit    uuid;
  v_alim   integer;
  v_mat    integer;
  v_ua     integer;
  v_um     integer;
  r        jsonb;
  v_miei   text[] := '{}';
begin
  v_foto := foto_righe();

  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  if v_tit is null then
    raise exception 'Verifica impossibile: nessun titolare in user_roles.';
  end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);

  -- (1) I DUE MONDI SONO DAVVERO DUE. Il controllo che conta non e' «ci
  --     sono le categorie dei materiali»: e' che quelle degli alimenti
  --     NON compaiano fra i materiali, che e' il difetto visto da Alessio.
  select count(*) into v_alim from categorie_proponibili('alimenti');
  select count(*) into v_mat  from categorie_proponibili('materiali');
  if v_alim < 15 then
    raise exception 'Le categorie degli alimenti sono % invece di almeno 15.', v_alim;
  end if;
  if v_mat < 7 then
    raise exception 'Le categorie dei materiali sono % invece di almeno 7 (le sei nuove piu'' «Altro»).', v_mat;
  end if;
  if exists (select 1 from categorie_proponibili('materiali') where codice in ('verdura', 'pesce', 'latticini')) then
    raise exception 'Fra le categorie dei materiali compare ancora della roba da mangiare: e'' il difetto che questa migrazione chiude.';
  end if;
  if not exists (select 1 from categorie_proponibili('materiali') where codice = 'altro')
     or not exists (select 1 from categorie_proponibili('alimenti') where codice = 'altro') then
    raise exception '«Altro» deve comparire in tutti e due i mondi: e'' l''unica riga con ambito «entrambi».';
  end if;

  -- (2) LE UNITA', allo stesso modo. `kg` non si offre su un rotolo di
  --     carta forno; `pezzo` e `litro` si offrono a tutti e due.
  select count(*) into v_ua from unita_proponibili('alimenti');
  select count(*) into v_um from unita_proponibili('materiali');
  if v_ua <> 5 then
    raise exception 'Le unita'' degli alimenti sono % invece di 5.', v_ua;
  end if;
  if v_um <> 6 then
    raise exception 'Le unita'' dei materiali sono % invece di 6.', v_um;
  end if;
  if exists (select 1 from unita_proponibili('materiali') where codice in ('kg', 'g', 'mazzo')) then
    raise exception 'Fra le unita'' dei materiali compaiono ancora kg, g o mazzo.';
  end if;
  if not exists (select 1 from unita_proponibili('materiali') where codice = 'pz')
     or not exists (select 1 from unita_proponibili('alimenti') where codice = 'pz') then
    raise exception 'Il pezzo deve comparire in tutti e due i mondi.';
  end if;

  -- (3) 🔴 LE UNITA' DEI PRODOTTI VERI SONO TUTTE NEL CATALOGO. Senza
  --     questo controllo, un codice scritto diverso renderebbe illeggibile
  --     l'unita' di prodotti veri — e nessun errore lo direbbe.
  if exists (select 1 from ingredients i
              where i.unit is not null
                and not exists (select 1 from unita_misura u where u.codice = i.unit::text)) then
    raise exception 'Ci sono prodotti con un''unita'' che il catalogo non conosce: %',
      (select string_agg(distinct i.unit::text, ', ') from ingredients i
        where i.unit is not null and not exists (select 1 from unita_misura u where u.codice = i.unit::text));
  end if;

  -- (4) SI PUO' AGGIUNGERNE UNA MENTRE SI COMPILA, e va nel mondo giusto.
  r := aggiungi_categoria_ingrediente('VERIFICA categoria materiale', 'materiali');
  if (r->>'nuova')::boolean is not true then
    raise exception 'La categoria di prova non e'' stata creata: %', r;
  end if;
  v_miei := v_miei || (r->>'codice');
  if not exists (select 1 from categorie_proponibili('materiali') where codice = r->>'codice') then
    raise exception 'La categoria appena creata per i materiali non compare fra i materiali.';
  end if;
  if exists (select 1 from categorie_proponibili('alimenti') where codice = r->>'codice') then
    raise exception 'La categoria dei materiali compare anche fra gli alimenti.';
  end if;

  -- 🔴 E I QUATTRO VALORI NUOVI ESISTONO DAVVERO NEL TIPO. Senza questo,
  --    il catalogo offrirebbe «rotolo» e il salvataggio lo rifiuterebbe:
  --    un elenco che propone cose che non si possono scegliere.
  if exists (select u.codice from unita_misura u
              where u.attiva
                and not exists (select 1 from pg_enum e join pg_type ty on ty.oid = e.enumtypid
                                 where ty.typname = 'unit_type' and e.enumlabel = u.codice)) then
    raise exception 'Il catalogo propone unita'' che il database rifiuterebbe: %',
      (select string_agg(u.codice, ', ') from unita_misura u where u.attiva
        and not exists (select 1 from pg_enum e join pg_type ty on ty.oid = e.enumtypid
                         where ty.typname = 'unit_type' and e.enumlabel = u.codice));
  end if;

  -- (5) UN AMBITO CHE NON ESISTE VIENE RIFIUTATO, e lo dice in italiano.
  begin
    perform aggiungi_categoria_ingrediente('VERIFICA ambito storto', 'pianeti');
    raise exception 'Un ambito inventato e'' stato accettato.';
  exception when sqlstate 'P0001' then
    if position('alimenti' in sqlerrm) = 0 then
      raise exception 'Il rifiuto non spiega il motivo: %', sqlerrm;
    end if;
  end;

  delete from categorie_ingrediente where codice = any(v_miei);
  perform set_config('request.jwt.claims', null, true);

  perform pretendi_nessun_residuo(v_foto, 'la verifica dei materiali di consumo');
  raise notice 'I due mondi sono separati: % categorie e % unita'' per gli alimenti, % e % per i materiali.',
    v_alim, v_ua, v_mat, v_um;
end
$verifica$;

insert into applied_migrations (version, name)
values ('20260829000024', 'i_materiali_hanno_le_loro_parole') on conflict (version) do nothing;
