-- =====================================================================
-- LA SPESA SPICCIOLA — quella che si fa di persona al supermercato
-- 23/08/2026 — blocco 8 del mandato del collaudo
-- =====================================================================
-- Richiesta di Alessio, e la prima riga del mandato dice gia' tutto:
-- **da tenere separata dalla Lista della spesa**. Quella nasce dalle
-- soglie del magazzino e finisce in un ordine a un fornitore; questa e'
-- la roba che compra lui passando dal supermercato.
--
-- ⚠️ NON SI COLLEGA A NIENTE, ed e' scritto nel mandato: niente soglie,
-- niente ordini, niente giacenze. Non toglie e non aggiunge merce, non
-- scrive nessun costo, non entra in nessun totale. E' un foglietto in
-- tasca, e il suo valore e' esattamente quello.
--
-- ⚠️ QUINDI NIENTE `entity_id`. Ogni tabella economicamente rilevante di
-- questo gestionale ne ha uno — qui non serve, perche' qui non passa un
-- euro. Metterlo «per sicurezza» vorrebbe dire aggiungere un campo che
-- nessun calcolo legge, e questo progetto ha appena finito di togliere i
-- parametri spenti. Il giorno in cui questa lista dovesse produrre un
-- costo, quel giorno vorra' anche una decisione su chi lo sostiene.
--
-- ---------------------------------------------------------------------
-- SOLO TESTO, e il perche'
-- ---------------------------------------------------------------------
-- Il mandato dice: «deve poter contenere articoli liberi, non solo
-- prodotti a magazzino». La forma che lo rispetta senza aprire porte e'
-- **testo e basta**: nessun riferimento a `ingredients`. Un collegamento
-- al catalogo sarebbe la prima crepa da cui torna il magazzino — e il
-- mandato lo vieta due volte.
--
-- ---------------------------------------------------------------------
-- LE CATEGORIE SONO SUE, NON MIE
-- ---------------------------------------------------------------------
-- ⚠️ `categoria` e' TESTO LIBERO e non un vocabolario chiuso, ed e' una
-- scelta con una ragione: quali sono le categorie della spesa al
-- supermercato di Alessio non lo so — «pulizia», «cancelleria», «bar»
-- sono parole mie, e il giorno che ne servisse una nuova dovrebbe
-- chiedere una migrazione per aggiungere una riga alla spesa. E' la
-- stessa forma delle causali di cassa: dati suoi, non un elenco scritto
-- nel codice. La schermata gli propone quelle che ha gia' usato, cosi'
-- non ne nascono tre scritte in tre modi.
--
-- ⚠️ E vuota e' ammessa: «non l'ho ancora deciso» e' una risposta, e
-- costringerlo a scegliere una categoria per scrivere «sacchetti» vuol
-- dire che scrivera' «altro» a tutto.
--
-- ---------------------------------------------------------------------
-- «SPARISCE DALL'ELENCO» NON VUOL DIRE CANCELLATO
-- ---------------------------------------------------------------------
-- Il gesto chiesto e': si tocca l'articolo e sparisce (= messo nel
-- carrello). Qui sparisce **dall'elenco di cosa manca**, e va a finire
-- fra le cose prese. ⚠️ Non si cancella: davanti allo scaffale si tocca
-- per sbaglio, e un gesto che si puo' solo fare e mai disfare e' un
-- vicolo cieco — regola del 16/08. Rimetterlo in lista e' un tocco.
-- =====================================================================

create table if not exists spesa_spicciola (
  id           uuid primary key default gen_random_uuid(),
  articolo     text not null,
  categoria    text,
  nota         text,
  nel_carrello boolean not null default false,
  preso_il     timestamptz,
  created_at   timestamptz not null default now(),
  constraint spesa_spicciola_articolo_non_vuoto check (length(trim(articolo)) > 0)
);

comment on table spesa_spicciola is
  'La spesa che Alessio fa di persona al supermercato (23/08/2026). SEPARATA dalla lista della spesa: non nasce dalle soglie, non finisce in un ordine, non tocca le giacenze e non scrive nessun costo. Testo libero, categorie sue.';

-- ⚠️ La data di quando e'' stato preso NON si riempie da sola con un
-- valore predefinito: la scrive il trigger insieme allo stato, cosi' i
-- due non possono contraddirsi. Un predefinito qui sarebbe la terza
-- copia della regola «che giorno e' oggi» (lezione del 19/08).
create or replace function spesa_spicciola_preso_il()
returns trigger
language plpgsql
set search_path = public
as $trg$
begin
  if new.nel_carrello and not coalesce(old.nel_carrello, false) then
    new.preso_il := now();
  elsif not new.nel_carrello then
    new.preso_il := null;
  end if;
  return new;
end;
$trg$;

-- 🔴 ANCHE UNA FUNZIONE TRIGGER NASCE ESEGUIBILE DA CHIUNQUE ABBIA LA
-- CHIAVE PUBBLICA (§8, lezione del 15/08). Fuori da un trigger non
-- girerebbe comunque, quindi non esce nessun dato — ma l'elenco di chi
-- puo' bussare da fuori NON DEVE CRESCERE IN SILENZIO, ed e' il controllo
-- che il 13/08 e' stato reso automatico apposta.
-- ⚠️ E l'ha trovata la prova, non una rilettura: `tests/app/permessi.test.js`
-- e' diventata rossa da sola nominando la funzione nuova. E' esattamente
-- il lavoro per cui era stata scritta.
revoke all on function spesa_spicciola_preso_il() from public, anon, authenticated;

drop trigger if exists trg_spesa_spicciola_preso_il on spesa_spicciola;
create trigger trg_spesa_spicciola_preso_il
  before insert or update on spesa_spicciola
  for each row execute function spesa_spicciola_preso_il();

-- ---------------------------------------------------------------------
-- Permessi
-- ---------------------------------------------------------------------
-- Tabella CONDIVISA, sullo stampo delle altre di servizio: chi si accorge
-- che sono finiti i sacchetti e' chi sta in cucina, non chi guarda i
-- conti. Lettura e scrittura a tutto lo staff; la cancellazione resta al
-- titolare, come dappertutto.
alter table spesa_spicciola enable row level security;

drop policy if exists spesa_spicciola_select on spesa_spicciola;
create policy spesa_spicciola_select on spesa_spicciola
  for select to authenticated using (true);

drop policy if exists spesa_spicciola_insert on spesa_spicciola;
create policy spesa_spicciola_insert on spesa_spicciola
  for insert to authenticated with check (true);

drop policy if exists spesa_spicciola_update on spesa_spicciola;
create policy spesa_spicciola_update on spesa_spicciola
  for update to authenticated using (true) with check (true);

drop policy if exists spesa_spicciola_delete on spesa_spicciola;
create policy spesa_spicciola_delete on spesa_spicciola
  for delete to authenticated using ((select is_titolare()));

-- Le categorie gia' usate, per proporle invece di farle riscrivere.
-- ⚠️ Si ricavano dai dati, non da un elenco: cosi' non possono divergere
-- da quello che c'e' davvero scritto nelle righe.
create or replace function categorie_spesa_spicciola()
returns table (categoria text, quante integer)
language sql
stable
security invoker
set search_path = public
as $funzione$
  select s.categoria, count(*)::integer
    from spesa_spicciola s
   where s.categoria is not null and length(trim(s.categoria)) > 0
   group by s.categoria
   order by count(*) desc, s.categoria;
$funzione$;

revoke all on function categorie_spesa_spicciola() from public, anon, authenticated;
grant execute on function categorie_spesa_spicciola() to authenticated;

-- =====================================================================
-- VERIFICA
-- =====================================================================
do $verifica$
declare
  v_tit  uuid;
  v_a    uuid;
  v_b    uuid;
  v_n    integer;
  v_data timestamptz;
  v_ok   boolean;
begin
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  if v_tit is null then raise exception 'Nessun titolare: impossibile verificare.'; end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);

  -- 1. Un articolo libero entra: nessun collegamento al magazzino.
  insert into spesa_spicciola (articolo, categoria)
  values ('ZZ sacchetti per il pane', 'ZZ prova pulizia') returning id into v_a;
  insert into spesa_spicciola (articolo) values ('ZZ senza categoria') returning id into v_b;

  select preso_il into v_data from spesa_spicciola where id = v_a;
  if v_data is not null then
    raise exception 'Un articolo appena scritto risulta gia'' preso.';
  end if;

  -- 2. Toccato: va nel carrello, e la data la scrive il gestionale.
  update spesa_spicciola set nel_carrello = true where id = v_a;
  select preso_il into v_data from spesa_spicciola where id = v_a;
  if v_data is null then
    raise exception 'Messo nel carrello senza sapere quando.';
  end if;

  -- 3. 🔴 E SI TORNA INDIETRO: davanti allo scaffale si tocca per
  --    sbaglio. Rimettendolo in lista la data sparisce insieme allo
  --    stato — due cose che non possono contraddirsi, perche' le scrive
  --    lo stesso trigger.
  update spesa_spicciola set nel_carrello = false where id = v_a;
  select preso_il into v_data from spesa_spicciola where id = v_a;
  if v_data is not null then
    raise exception 'Rimesso in lista, ma risulta ancora preso il %.', v_data;
  end if;

  -- 4. Un articolo senza nome non entra.
  begin
    insert into spesa_spicciola (articolo) values ('   ');
    v_ok := true;
  exception when check_violation then
    v_ok := false;
  end;
  if v_ok then raise exception 'E'' entrato un articolo senza nome.'; end if;

  -- 4-bis. 🔴 E LA FUNZIONE DEL TRIGGER NON E' APERTA AL MONDO: l'elenco
  --        di chi puo' bussare da fuori non deve crescere in silenzio.
  if exists (
    select 1 from funzioni_aperte_ad_anon() f where f.nome = 'spesa_spicciola_preso_il'
  ) then
    raise exception 'La funzione del trigger e'' rimasta eseguibile con la chiave pubblica.';
  end if;

  -- 5. Le categorie si ricavano dai dati, e quella vuota non conta.
  select count(*) into v_n from categorie_spesa_spicciola() c
   where c.categoria = 'ZZ prova pulizia';
  if v_n <> 1 then
    raise exception 'La categoria scritta non compare fra quelle proposte.';
  end if;
  select count(*) into v_n from categorie_spesa_spicciola() c where c.categoria is null;
  if v_n <> 0 then
    raise exception 'Fra le categorie proposte ce n''e'' una vuota.';
  end if;

  -- ===== pulizia
  delete from spesa_spicciola where articolo like 'ZZ %';
  select count(*) into v_n from spesa_spicciola where articolo like 'ZZ %';
  if v_n <> 0 then raise exception 'La verifica ha lasciato % righe.', v_n; end if;

  perform set_config('request.jwt.claims', null, true);
  raise notice 'Verifica passata: articoli liberi, categorie sue, e dal carrello si torna indietro.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260823000021', 'la_spesa_spicciola') on conflict (version) do nothing;
