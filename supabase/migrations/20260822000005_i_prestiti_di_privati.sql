-- I PRESTITI DI PRIVATI — 22/08/2026, mandato di Alessio.
--
-- 🔴 IL PROBLEMA IN UNA RIGA: oggi quei soldi entrerebbero come «altro
-- incasso», indistinguibili da un incasso vero. Il gestionale deve saper
-- rispondere a **due domande che oggi hanno la stessa risposta**:
--
--     «quanti soldi ho?»  ·  «quanti soldi sono MIEI?»
--
-- ---------------------------------------------------------------------
-- 🔴 COSA HO MISURATO PRIMA DI SCEGLIERE, come chiedeva il mandato
-- ---------------------------------------------------------------------
--
-- **1. La Proiezione è al sicuro, ed era la cosa da verificare per prima.**
-- I ricavi del consuntivo (`chiudi_mese`) vengono **esclusivamente dai conti
-- chiusi**, mai dalla prima nota: `select … from orders where status in
-- ('chiuso','omaggiato')`. Quindi trentamila euro che entrano in cassa **non
-- toccano né il food cost né le imposte proiettate**. È la regola del 15/08
-- — *i conti chiusi sono l'unica fonte dei ricavi* — che protegge un caso
-- che nessuno aveva in mente quando fu scritta.
--
-- **2. Ma il SALDO li conta, e deve.** I 4.990 di Manuela sono contanti nel
-- cassetto: se non entrassero nel saldo, il primo conteggio darebbe
-- un'eccedenza di 4.990 e una rettifica per un errore che non esiste. È la
-- lezione delle mance in contanti del 16/08.
--
-- ⚠️ **Il punto delicato è un altro**: la schermata Cassa scompone il saldo
-- in «fondo + **incassi** − uscite», e `declared_takings` prende *tutte* le
-- entrate che non siano del titolare. Senza fare niente, i 4.990
-- comparirebbero fra gli **incassi** — che è esattamente la confusione che
-- questo lavoro deve togliere.
--
-- **3. «Ce la faccio?» regge lo spazio di manovra senza un secondo calcolo.**
-- `previsione_cassa(p_entity_id, p_fino_al)` ha **già** l'orizzonte
-- parametrico (predefinito 30 giorni). Lo spazio di manovra è quello stesso
-- conto **a sei mesi, meno la riserva**: nessuna formula nuova, come il
-- mandato imponeva.
--
-- **4. `is_owner_injection` esiste ma dice un'altra cosa**: sono soldi *del
-- titolare*, che non si devono a nessuno. Un prestito è un **debito verso un
-- terzo**. Confonderli rifarebbe il difetto in un altro posto.
--
-- **5. `anticipazioni_socio` è il verso opposto**: Alessio paga una spesa di
-- tasca sua e si fa rimborsare. Ha perfino la regola di deducibilità, perché
-- è un **costo**. Un prestito non è un costo: è denaro finanziario.

-- ---------------------------------------------------------------------
-- 1. Il debito, che vive nel tempo
-- ---------------------------------------------------------------------
create table if not exists prestiti_privati (
  id           uuid primary key default gen_random_uuid(),
  entity_id    uuid not null references entities(id) on delete restrict,
  da_chi       text not null check (btrim(da_chi) <> ''),
  importo      numeric(14,2) not null check (importo > 0),
  -- ⚠️ Come è ENTRATO, non «come si restituirà»: è un fatto già avvenuto.
  mezzo        text not null check (mezzo in ('cassa', 'banca')),
  ricevuto_il  date not null,
  nota         text,
  -- Il movimento di prima nota che ne è conseguito: i soldi sono entrati
  -- davvero, e il saldo deve vederli.
  movimento_id uuid references cash_movements(id) on delete set null,
  created_at   timestamptz not null default now()
);

comment on table prestiti_privati is
  'Prestiti ricevuti da privati per l''investimento iniziale. NON sono ricavi e NON sono incassi: sono denaro che sta in cassa e va restituito. Nessuna scadenza, per decisione di Alessio del 22/08/2026.';

-- ⚠️ NESSUNA COLONNA «SCADENZA», ed è una scelta esplicita: *«non hanno
-- scadenza e il gestionale non deve chiedermi quando restituire — deve solo
-- dirmi quanto posso»*. Una colonna vuota che nessuno riempie diventa il
-- posto da cui un giorno nasce un promemoria che nessuno ha chiesto.

create table if not exists restituzioni_prestito (
  id            uuid primary key default gen_random_uuid(),
  prestito_id   uuid not null references prestiti_privati(id) on delete restrict,
  importo       numeric(14,2) not null check (importo > 0),
  mezzo         text not null check (mezzo in ('cassa', 'banca')),
  restituito_il date not null,
  nota          text,
  movimento_id  uuid references cash_movements(id) on delete set null,
  created_at    timestamptz not null default now()
);

comment on table restituzioni_prestito is
  'Le restituzioni, parziali o totali. Un prestito si estingue quando la somma delle sue restituzioni pareggia l''importo — non c''e'' nessuna data entro cui debba succedere.';

create index if not exists idx_restituzioni_prestito on restituzioni_prestito (prestito_id);
create index if not exists idx_prestiti_entita on prestiti_privati (entity_id, ricevuto_il desc);

alter table prestiti_privati enable row level security;
alter table restituzioni_prestito enable row level security;

-- 🔴 SOLO IL TITOLARE, e non è prudenza generica: sapere chi ha prestato
-- soldi ad Alessio e quanto gliene deve ancora è un fatto suo e delle
-- persone che glieli hanno dati. Non c'entra col servizio.
drop policy if exists prestiti_titolare on prestiti_privati;
create policy prestiti_titolare on prestiti_privati
  for all to authenticated using ((select is_titolare())) with check ((select is_titolare()));

drop policy if exists restituzioni_titolare on restituzioni_prestito;
create policy restituzioni_titolare on restituzioni_prestito
  for all to authenticated using ((select is_titolare())) with check ((select is_titolare()));

-- ---------------------------------------------------------------------
-- 2. Il movimento sa di essere un prestito
--
-- ⚠️ UNA COLONNA CHE SERVE A DUE COSE, e per questo non è un flag
-- inventato: lega il movimento al debito (che è l'informazione vera) **e**
-- permette al saldo di non chiamarlo «incasso». Un booleano
-- `non_e_un_incasso` avrebbe fatto solo la seconda.
-- ---------------------------------------------------------------------
alter table cash_movements
  add column if not exists prestito_id uuid references prestiti_privati(id) on delete set null;

comment on column cash_movements.prestito_id is
  'Se valorizzata, questo movimento e'' l''entrata di un prestito o la sua restituzione: i soldi si muovono davvero, ma non sono un incasso di vendita.';

-- ---------------------------------------------------------------------
-- 3. Il saldo li vede, ma non li chiama incassi
--
-- ⚠️ Si riscrive `v_cash_balance` PRENDENDOLA DAL DATABASE (pg_get_viewdef)
-- e cambiando una
-- riga: `declared_takings` esclude anche le entrate legate a un prestito.
-- Il TOTALE (`balance`) non cambia di un centesimo — i soldi ci sono — e
-- cambia solo come vengono chiamati.
-- ---------------------------------------------------------------------
create or replace view v_cash_balance as
SELECT e.id AS entity_id,
    e.name AS entity_name,
    COALESCE(sum(
        CASE
            WHEN m.mezzo = 'cassa'::text AND m.direction = 'entrata'::cash_direction THEN m.amount
            WHEN m.mezzo = 'cassa'::text THEN - m.amount
            ELSE 0::numeric
        END), 0::numeric)::numeric(14,2) AS balance,
    COALESCE(sum(
        CASE
            WHEN m.mezzo = 'cassa'::text AND m.is_owner_injection THEN m.amount
            ELSE 0::numeric
        END), 0::numeric)::numeric(14,2) AS owner_float,
    COALESCE(sum(
        CASE
            WHEN m.mezzo = 'cassa'::text AND m.direction = 'entrata'::cash_direction AND NOT m.is_owner_injection AND m.prestito_id IS NULL THEN m.amount
            ELSE 0::numeric
        END), 0::numeric)::numeric(14,2) AS declared_takings,
    COALESCE(sum(
        CASE
            WHEN m.mezzo = 'cassa'::text AND m.direction = 'uscita'::cash_direction THEN m.amount
            ELSE 0::numeric
        END), 0::numeric)::numeric(14,2) AS total_out,
    COALESCE(sum(
        CASE
            WHEN m.mezzo = 'banca'::text AND m.direction = 'entrata'::cash_direction THEN m.amount
            WHEN m.mezzo = 'banca'::text THEN - m.amount
            ELSE 0::numeric
        END), 0::numeric)::numeric(14,2) AS saldo_banca,
    COALESCE(sum(
        CASE
            WHEN m.mezzo = 'banca'::text AND m.direction = 'entrata'::cash_direction THEN m.amount
            ELSE 0::numeric
        END), 0::numeric)::numeric(14,2) AS entrate_banca,
    COALESCE(sum(
        CASE
            WHEN m.mezzo = 'banca'::text AND m.direction = 'uscita'::cash_direction THEN m.amount
            ELSE 0::numeric
        END), 0::numeric)::numeric(14,2) AS uscite_banca,
    -- 🔴 LA COLONNA NUOVA STA IN FONDO, e non e' una scelta di stile:
    -- `create or replace view` accetta di AGGIUNGERE colonne solo in coda —
    -- infilarla in mezzo da' ERROR 42P16. E' scritto nelle trappole di
    -- questo progetto, e la prima stesura di questa migrazione ci era
    -- cascata: l'avevo messa prima di `total_out`.
    COALESCE(sum(
        CASE
            WHEN m.mezzo = 'cassa'::text AND m.direction = 'entrata'::cash_direction AND m.prestito_id IS NOT NULL THEN m.amount
            ELSE 0::numeric
        END), 0::numeric)::numeric(14,2) AS prestiti_in_cassa
   FROM entities e
     LEFT JOIN cash_movements m ON m.entity_id = e.id AND m.movement_date <= (now() AT TIME ZONE 'Europe/Rome'::text)::date
  GROUP BY e.id, e.name;

-- ---------------------------------------------------------------------
-- 4. Quanto si deve, e QUANTO SI PUÒ RESTITUIRE ADESSO
--
-- ⚠️ E il secondo numero è quello che conta: *sapere di dovere 30.000 non
-- serve a decidere niente; sapere che oggi puoi restituirne 3.000 sì.*
-- ---------------------------------------------------------------------
create or replace function prestiti_aperti(p_entity_id uuid)
returns table (
  id            uuid,
  da_chi        text,
  importo       numeric,
  restituito    numeric,
  residuo       numeric,
  mezzo         text,
  ricevuto_il   date,
  estinto       boolean
)
language plpgsql
stable
security definer
set search_path = public
as $fn$
begin
  -- 🔴 UN RIFIUTO, NON UN FILTRO. La prima stesura scriveva
  -- `and (select is_titolare())` dentro il `where`: lo staff otteneva un
  -- **elenco vuoto**, cioe' «non hai preso soldi da nessuno» — che e' una
  -- rassicurazione falsa, la forma respinta il 13/08 su otto funzioni.
  --
  -- ⚠️ E c'e' un secondo motivo, che riguarda le reti: `funzioni_senza_portiere()`
  -- cerca il **gesto** «se non sei il titolare, rifiuta». Un filtro non e'
  -- quel gesto, quindi la funzione compariva fra quelle scoperte — ed e' la
  -- rete che aveva ragione. *Filtrare somiglia a proteggere e non lo e'.*
  if not is_titolare() then
    raise exception 'I prestiti da privati sono riservati al titolare.';
  end if;

  return query
  select p.id, p.da_chi, p.importo,
         coalesce(r.tot, 0)::numeric,
         (p.importo - coalesce(r.tot, 0))::numeric,
         p.mezzo, p.ricevuto_il,
         coalesce(r.tot, 0) >= p.importo
    from prestiti_privati p
    left join lateral (
      select sum(x.importo) as tot from restituzioni_prestito x where x.prestito_id = p.id
    ) r on true
   where p.entity_id = p_entity_id
   order by p.ricevuto_il;
end;
$fn$;

revoke all on function prestiti_aperti(uuid) from public, anon, authenticated;
grant execute on function prestiti_aperti(uuid) to authenticated;

create or replace function spazio_di_manovra(p_entity_id uuid)
returns table (
  liquidita_a_sei_mesi numeric,
  riserva              numeric,
  restituibile_adesso  numeric,
  debito_residuo       numeric,
  avvertenza           text
)
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_prev    numeric;
  v_avv     text;
  v_debito  numeric;
  v_riserva constant numeric := 5000;
begin
  if not (select is_titolare()) then
    raise exception 'I prestiti sono riservati al titolare.';
  end if;

  -- 🔴 NESSUN CALCOLO NUOVO: si chiama «Ce la faccio?» con un orizzonte di
  -- sei mesi invece dei trenta giorni predefiniti. Il mandato lo imponeva —
  -- *non scriverne un secondo* — e la funzione lo permetteva già.
  select p.saldo_previsto, p.avvertenza into v_prev, v_avv
    from previsione_cassa(p_entity_id, (oggi_a_roma() + 182)) p;

  select coalesce(sum(a.residuo), 0) into v_debito from prestiti_aperti(p_entity_id) a;

  return query select
    v_prev,
    v_riserva,
    -- ⚠️ Non si restituisce piu' di quello che si deve, e non si scende mai
    -- sotto zero: un numero negativo qui si leggerebbe come un obbligo.
    greatest(0, least(v_prev - v_riserva, v_debito)),
    v_debito,
    -- Il numero e il suo limite viaggiano insieme, come per le imposte.
    --
    -- 🔴 `euro()` e non `v_riserva::text || ' euro'`, che e' come l'avevo
    -- scritta prima: dava «5000 euro» dentro un gestionale dove ogni altro
    -- importo si legge «5.000,00 €». ⚠️ E la rete del 17/08 non se ne
    -- sarebbe accorta — cerca le maschere `to_char`, non un importo
    -- concatenato a mano: *una regola sorvegliata in una sola delle sue
    -- forme si aggira senza volerlo.*
    'Liquidita'' prevista a sei mesi, meno una riserva di ' ||
    euro(v_riserva) || '. ' || coalesce(v_avv, '');
end;
$fn$;

revoke all on function spazio_di_manovra(uuid) from public, anon, authenticated;
grant execute on function spazio_di_manovra(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- VERIFICA
-- ---------------------------------------------------------------------
do $$
declare
  v_ente   uuid;
  v_tit    uuid;
  v_caus   uuid;
  v_p      uuid;
  v_mov    uuid;
  v_saldo  record;
  v_prima  numeric;
  v_res    record;
begin
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);
  select id into v_ente from entities limit 1;
  select id into v_caus from cash_causali where kind = 'entrata' and active limit 1;

  select declared_takings into v_prima from v_cash_balance where entity_id = v_ente;

  -- 1. Un prestito in CONTANTI, col suo movimento.
  insert into prestiti_privati (entity_id, da_chi, importo, mezzo, ricevuto_il, nota)
  values (v_ente, '__VERIFICA__ Tizio', 1000, 'cassa', oggi_a_roma(), 'prova')
  returning id into v_p;

  insert into cash_movements (entity_id, direction, amount, movement_date, causale_id, mezzo, note, prestito_id)
  values (v_ente, 'entrata', 1000, oggi_a_roma(), v_caus, 'cassa', '__VERIFICA__ prestito', v_p)
  returning id into v_mov;
  update prestiti_privati set movimento_id = v_mov where id = v_p;

  -- 2. 🔴 I SOLDI CI SONO, MA NON SONO INCASSI. È il cuore del blocco.
  select * into v_saldo from v_cash_balance where entity_id = v_ente;
  if v_saldo.declared_takings <> v_prima then
    raise exception 'Il prestito e'' finito fra gli incassi: prima %, dopo %.', v_prima, v_saldo.declared_takings;
  end if;
  if v_saldo.prestiti_in_cassa < 1000 then
    raise exception 'Il prestito non risulta fra i prestiti in cassa (%).', v_saldo.prestiti_in_cassa;
  end if;

  -- 3. ⚠️ E LA SCOMPOSIZIONE TORNA AL TOTALE. Senza questa, la schermata
  --    mostrerebbe un saldo che le sue stesse voci non spiegano — il
  --    difetto che il 16/08 costò le mance in contanti.
  if v_saldo.balance <> v_saldo.owner_float + v_saldo.declared_takings
                        + v_saldo.prestiti_in_cassa - v_saldo.total_out then
    raise exception 'La scomposizione non somma al saldo: % <> % + % + % - %.',
      v_saldo.balance, v_saldo.owner_float, v_saldo.declared_takings,
      v_saldo.prestiti_in_cassa, v_saldo.total_out;
  end if;

  -- 4. Quanto si deve ancora, con una restituzione parziale.
  insert into restituzioni_prestito (prestito_id, importo, mezzo, restituito_il)
  values (v_p, 300, 'cassa', oggi_a_roma());

  select * into v_res from prestiti_aperti(v_ente) where id = v_p;
  if v_res.residuo <> 700 then
    raise exception 'Dopo una restituzione di 300 su 1000 il residuo e'' %.', v_res.residuo;
  end if;
  if v_res.estinto then
    raise exception 'Un prestito con 700 da restituire risulta estinto.';
  end if;

  -- 5. E si estingue quando la somma pareggia — senza nessuna scadenza.
  insert into restituzioni_prestito (prestito_id, importo, mezzo, restituito_il)
  values (v_p, 700, 'cassa', oggi_a_roma());
  select * into v_res from prestiti_aperti(v_ente) where id = v_p;
  if not v_res.estinto or v_res.residuo <> 0 then
    raise exception 'Restituito tutto, ma il prestito non risulta estinto (residuo %).', v_res.residuo;
  end if;

  -- Pulizia.
  -- 🔴 IL GUARDIANO DELLE CANCELLAZIONI SI SPEGNE PER LA SOLA PULIZIA.
  -- `cash_movements` e' una tabella tracciata: cancellare qui lascerebbe
  -- copie finte in un registro **esibibile che nessuno puo' ripulire
  -- dall'app**. E' successo il 19/08 con cinque lapidi, e la prova nata
  -- allora (`registri-esibibili`) ha preso anche questa migrazione.
  alter table cash_movements disable trigger trg_log_delete;

  delete from restituzioni_prestito where prestito_id = v_p;
  update prestiti_privati set movimento_id = null where id = v_p;
  delete from cash_movements where id = v_mov;
  delete from prestiti_privati where id = v_p;

  alter table cash_movements enable trigger trg_log_delete;

  -- ⚠️ Riacceso DAVVERO, chiesto al catalogo e non alla memoria: un
  -- guardiano lasciato spento non da' nessun errore — smette e basta.
  if exists (select 1 from pg_trigger t
               join pg_class c on c.oid = t.tgrelid
              where t.tgname = 'trg_log_delete'
                and c.relname = 'cash_movements'
                and t.tgenabled = 'D') then
    raise exception 'Il registro delle cancellazioni e'' rimasto spento su cash_movements.';
  end if;

  perform set_config('request.jwt.claims', null, true);
  raise notice 'Verifica passata: il prestito sta in cassa senza essere un incasso, la scomposizione torna, e il residuo scende fino a estinguersi.';
end $$;

insert into applied_migrations (version, name)
values ('20260822000005', 'i_prestiti_di_privati') on conflict (version) do nothing;

-- ---------------------------------------------------------------------
-- 5. Le due operazioni atomiche
--
-- ⚠️ DUE TABELLE IN UNA TRANSAZIONE, quindi funzione Postgres e corridoio
-- (Contratto B4): un prestito registrato senza il suo movimento sarebbe un
-- debito che nessun saldo vede, e un movimento senza prestito sarebbe denaro
-- che nessuno sa di dover restituire. Sono le due metà dello stesso fatto.
-- ---------------------------------------------------------------------
create or replace function registra_prestito_privato(
  p_entity_id   uuid,
  p_da_chi      text,
  p_importo     numeric,
  p_mezzo       text,
  p_ricevuto_il date,
  p_causale_id  uuid default null,
  p_nota        text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_id  uuid;
  v_mov uuid;
begin
  if not (select is_titolare()) then
    raise exception 'I prestiti li registra il titolare.';
  end if;

  insert into prestiti_privati (entity_id, da_chi, importo, mezzo, ricevuto_il, nota)
  values (p_entity_id, btrim(p_da_chi), p_importo, p_mezzo, p_ricevuto_il, nullif(btrim(p_nota), ''))
  returning id into v_id;

  -- ⚠️ Il movimento porta `prestito_id`: e' quello che tiene i soldi nel
  -- saldo e fuori dagli incassi. Senza, il prestito comparirebbe fra le
  -- vendite del giorno.
  insert into cash_movements (entity_id, direction, amount, movement_date, causale_id, mezzo, note, prestito_id)
  values (p_entity_id, 'entrata', p_importo, p_ricevuto_il, p_causale_id, p_mezzo,
          'Prestito da ' || btrim(p_da_chi), v_id)
  returning id into v_mov;

  update prestiti_privati set movimento_id = v_mov where id = v_id;

  return jsonb_build_object('prestito_id', v_id, 'movimento_id', v_mov,
    'messaggio', 'Prestito di ' || euro(p_importo) || ' da ' || btrim(p_da_chi) ||
                 ' registrato: e'' in cassa, ma non fra gli incassi.');
end;
$fn$;

revoke all on function registra_prestito_privato(uuid, text, numeric, text, date, uuid, text) from public, anon, authenticated;
grant execute on function registra_prestito_privato(uuid, text, numeric, text, date, uuid, text) to authenticated;

create or replace function registra_restituzione_prestito(
  p_prestito_id   uuid,
  p_importo       numeric,
  p_mezzo         text,
  p_restituito_il date,
  p_causale_id    uuid default null,
  p_nota          text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_p       prestiti_privati;
  v_residuo numeric;
  v_mov     uuid;
begin
  if not (select is_titolare()) then
    raise exception 'Le restituzioni le registra il titolare.';
  end if;

  select * into v_p from prestiti_privati where id = p_prestito_id;
  if not found then raise exception 'Questo prestito non esiste piu''.'; end if;

  select residuo into v_residuo from prestiti_aperti(v_p.entity_id) where id = p_prestito_id;

  -- ⚠️ NON SI RESTITUISCE PIU' DI QUELLO CHE SI DEVE, e il rifiuto dice il
  -- numero: chi sta scrivendo ha in mano dei contanti e deve sapere quanto
  -- di quel mucchio riguarda questo prestito.
  if p_importo > v_residuo then
    raise exception 'A % restano da restituire %: non se ne possono registrare %.',
      v_p.da_chi, euro(v_residuo), euro(p_importo);
  end if;

  insert into restituzioni_prestito (prestito_id, importo, mezzo, restituito_il, nota)
  values (p_prestito_id, p_importo, p_mezzo, p_restituito_il, nullif(btrim(p_nota), ''));

  insert into cash_movements (entity_id, direction, amount, movement_date, causale_id, mezzo, note, prestito_id)
  values (v_p.entity_id, 'uscita', p_importo, p_restituito_il, p_causale_id, p_mezzo,
          'Restituzione a ' || v_p.da_chi, p_prestito_id)
  returning id into v_mov;

  update restituzioni_prestito set movimento_id = v_mov
   where prestito_id = p_prestito_id and movimento_id is null
     and restituito_il = p_restituito_il and importo = p_importo;

  select residuo into v_residuo from prestiti_aperti(v_p.entity_id) where id = p_prestito_id;

  return jsonb_build_object('residuo', v_residuo, 'movimento_id', v_mov,
    'messaggio', case when v_residuo <= 0
                      then 'Restituito tutto a ' || v_p.da_chi || ': il prestito e'' chiuso.'
                      else 'A ' || v_p.da_chi || ' restano ' || euro(v_residuo) || '.' end);
end;
$fn$;

revoke all on function registra_restituzione_prestito(uuid, numeric, text, date, uuid, text) from public, anon, authenticated;
grant execute on function registra_restituzione_prestito(uuid, numeric, text, date, uuid, text) to authenticated;

-- VERIFICA delle due operazioni
do $$
declare
  v_ente uuid; v_tit uuid; v_caus uuid; v_p uuid; v_r record; v_esito jsonb;
begin
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);
  select id into v_ente from entities limit 1;
  select id into v_caus from cash_causali where kind = 'entrata' and active limit 1;

  v_esito := registra_prestito_privato(v_ente, '__VERIFICA__ Caio', 500, 'cassa', oggi_a_roma(), v_caus, null);
  v_p := (v_esito->>'prestito_id')::uuid;

  -- Il movimento c'e', ed e' marcato.
  if not exists (select 1 from cash_movements where prestito_id = v_p and direction = 'entrata') then
    raise exception 'Il prestito non ha generato il suo movimento.';
  end if;

  -- 🔴 NON SI RESTITUISCE PIU' DEL DOVUTO.
  begin
    perform registra_restituzione_prestito(v_p, 600, 'cassa', oggi_a_roma(), v_caus, null);
    raise exception 'Ha accettato una restituzione maggiore del residuo.';
  exception when sqlstate 'P0001' then
    if sqlerrm not like '%restano%' then
      raise exception 'Rifiutata, ma senza dire quanto resta: %', sqlerrm;
    end if;
  end;

  perform registra_restituzione_prestito(v_p, 500, 'cassa', oggi_a_roma(), v_caus, null);
  select * into v_r from prestiti_aperti(v_ente) where id = v_p;
  if not v_r.estinto then raise exception 'Restituito tutto e il prestito non risulta estinto.'; end if;

  -- 🔴 IL GUARDIANO DELLE CANCELLAZIONI SI SPEGNE PER LA SOLA PULIZIA.
  -- `cash_movements` e' una tabella tracciata: cancellare qui lascerebbe
  -- copie finte in un registro **esibibile che nessuno puo' ripulire
  -- dall'app**. E' successo il 19/08 con cinque lapidi, e la prova nata
  -- allora (`registri-esibibili`) ha preso anche questa migrazione.
  alter table cash_movements disable trigger trg_log_delete;

  delete from cash_movements where prestito_id = v_p;
  delete from restituzioni_prestito where prestito_id = v_p;
  delete from prestiti_privati where id = v_p;

  alter table cash_movements enable trigger trg_log_delete;

  -- ⚠️ Riacceso DAVVERO, chiesto al catalogo e non alla memoria: un
  -- guardiano lasciato spento non da' nessun errore — smette e basta.
  if exists (select 1 from pg_trigger t
               join pg_class c on c.oid = t.tgrelid
              where t.tgname = 'trg_log_delete'
                and c.relname = 'cash_movements'
                and t.tgenabled = 'D') then
    raise exception 'Il registro delle cancellazioni e'' rimasto spento su cash_movements.';
  end if;
  perform set_config('request.jwt.claims', null, true);
  raise notice 'Verifica passata: prestito e movimento nascono insieme, e non si restituisce piu'' del dovuto.';
end $$;
