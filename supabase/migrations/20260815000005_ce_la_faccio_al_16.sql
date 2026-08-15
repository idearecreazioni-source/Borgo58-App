-- ---------------------------------------------------------------------
-- «Ce la faccio al 16?» — Blocco 6b del mandato «personale e tesoreria»
-- ---------------------------------------------------------------------
-- La seconda metà della tesoreria, meno il caricamento dell'estratto
-- conto: **decisione di Alessio del 15/08/2026**, e ha ragione lui. Il
-- conto corrente non è ancora aperto e non sappiamo che formato esporti
-- l'home banking (quesito B1 per le banche). Costruire adesso un lettore
-- di file al buio significa costruirlo due volte.
--
-- Quello che si costruisce lo stesso è tutto il resto, e non è un ripiego:
-- **la domanda che chiude i ristoranti non è «quanto ho», è «ce la faccio
-- al 16»**, e per rispondere non serve l'estratto conto — serve sapere
-- cosa deve ancora uscire. Quello il gestionale lo sa già.
--
-- =====================================================================
-- 1. IL POS IN TRANSITO — la voce senza cui il saldo non torna mai
-- =====================================================================
-- L'incasso con carta di stasera NON è in banca stasera: arriva dopo uno
-- o due giorni, **al netto delle commissioni**. Il mandato chiede questa
-- voce «dal primo giorno», e la ragione è che senza di essa il saldo
-- teorico della banca non torna **mai** — e un numero che non torna mai
-- si smette di guardare in una settimana.
--
-- ⚠️ QUANTI GIORNI E QUANTA COMMISSIONE NON LI SO, e non li invento: sono
-- il quesito B2 per le banche, e la banca non è ancora scelta. Nascono
-- **vuoti**, e finché sono vuoti la schermata dichiara che l'importo è
-- lordo e che non si sa quando arriva. È il terzo stato di stamattina,
-- applicato a un parametro invece che a un costo: un valore inventato
-- qui sposterebbe il saldo previsto **sempre nella stessa direzione**.
--
-- =====================================================================
-- 2. ATTESI VS AVVENUTI — e la riconciliazione che non ha bisogno di file
-- =====================================================================
-- ⚠️ La parte non ovvia: **una scadenza sparisce da sola quando il suo
-- movimento vero esiste.** Una fattura non pagata è un'uscita attesa;
-- quando `pay_supplier_invoice` la segna pagata e scrive il movimento, non
-- è più attesa. Questa è già riconciliazione, e non richiede nessun
-- estratto conto — l'estratto servirà a confrontare col mondo esterno, non
-- a sapere cosa il gestionale ha già registrato.
--
-- Quello che il gestionale sa da solo: le **fatture fornitori da pagare**
-- con la loro scadenza, e le **imposte** dal calendario del motore unico.
-- Quello che non può sapere — affitto, rate, utenze — lo scrive Alessio
-- in `scadenze_previste`, e lì una scadenza può ripetersi ogni mese.
--
-- ⚠️ Gli **stipendi non ci sono**, ed è dichiarato: escono dal prospetto
-- del costo aziendale, che è il Blocco 1 e aspetta Gianna. La previsione
-- lo dice invece di far credere che manchi poco.
--
-- Idempotente (§7 punto 3), con blocco di verifica e auto-registrazione.
-- ---------------------------------------------------------------------

-- =====================================================================
-- I due parametri del POS — nascono vuoti
-- =====================================================================
create table if not exists impostazioni_tesoreria (
  entity_id                uuid primary key references entities(id) on delete cascade,
  -- ⚠️ Entrambi NULL di proposito: «non l'ha ancora detto la banca».
  -- Un default inventato qui non si distinguerebbe da una risposta.
  giorni_accredito_pos     integer check (giorni_accredito_pos is null or giorni_accredito_pos between 0 and 30),
  commissione_pos_percento numeric(5,2) check (commissione_pos_percento is null or (commissione_pos_percento >= 0 and commissione_pos_percento <= 10)),
  aggiornato_il            timestamptz not null default now()
);

comment on table impostazioni_tesoreria is
  'Come accredita il POS: in quanti giorni e con quale commissione (15/08/2026). Nascono VUOTI perche'' la banca non e'' ancora scelta — e'' il quesito B2. Finche'' sono vuoti la schermata dichiara che l''importo in transito e'' lordo.';

alter table impostazioni_tesoreria enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='impostazioni_tesoreria'
      and policyname='impostazioni_tesoreria_titolare'
  ) then
    create policy impostazioni_tesoreria_titolare on impostazioni_tesoreria
      for all using ((select is_titolare())) with check ((select is_titolare()));
  end if;
end $$;

revoke all on table impostazioni_tesoreria from public, anon;

-- =====================================================================
-- Le scadenze che solo Alessio conosce
-- =====================================================================
create table if not exists scadenze_previste (
  id            uuid primary key default gen_random_uuid(),
  entity_id     uuid not null references entities(id) on delete restrict,
  descrizione   text not null,
  importo       numeric(14,2) not null check (importo > 0),
  scade_il      date not null,
  -- Una scadenza che torna ogni mese si scrive una volta. Zero = una
  -- tantum, cosi' non serve un secondo campo per dire «non si ripete».
  ogni_mesi     integer not null default 0 check (ogni_mesi between 0 and 12),
  mezzo         text not null default 'banca' check (mezzo in ('cassa', 'banca')),
  chiusa_il     date,
  nota          text,
  created_at    timestamptz not null default now()
);

comment on table scadenze_previste is
  'Le uscite che il gestionale non puo'' dedurre da solo — affitto, rate, utenze (15/08/2026). Fatture fornitori e imposte NON si scrivono qui: le sa gia'', e riscriverle le conterebbe due volte.';

create index if not exists idx_scadenze_previste_data
  on scadenze_previste(entity_id, scade_il) where chiusa_il is null;

alter table scadenze_previste enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='scadenze_previste'
      and policyname='scadenze_previste_titolare'
  ) then
    create policy scadenze_previste_titolare on scadenze_previste
      for all using ((select is_titolare())) with check ((select is_titolare()));
  end if;
end $$;

revoke all on table scadenze_previste from public, anon;

-- =====================================================================
-- Il POS in transito
-- =====================================================================
create or replace function pos_in_transito(p_entity_id uuid)
returns table (
  lordo       numeric,
  commissioni numeric,
  netto_atteso numeric,
  conti       integer,
  avvertenza  text
)
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_giorni integer;
  v_comm   numeric;
  v_lordo  numeric;
  v_conti  integer;
  v_da     date;
begin
  if not is_titolare() then
    raise exception 'I saldi sono riservati al titolare.';
  end if;

  select i.giorni_accredito_pos, i.commissione_pos_percento
    into v_giorni, v_comm
    from impostazioni_tesoreria i where i.entity_id = p_entity_id;

  -- Senza i giorni di accredito non si sa quali incassi siano gia'
  -- arrivati: si mostra tutto l'incassato con carta e LO SI DICE.
  v_da := case when v_giorni is null then null
               else current_date - v_giorni end;

  select coalesce(sum(coalesce(d.collected_amount, t.totale)), 0), count(*)
    into v_lordo, v_conti
    from orders o
    left join discounts_gifts d on d.id = o.discount_gift_id
    cross join lateral totale_conto(o.id) t
   where o.entity_id = p_entity_id
     and o.status in ('chiuso', 'omaggiato')
     and o.payment_method = 'carta'
     and (v_da is null or o.closed_at::date >= v_da);

  return query select
    v_lordo,
    case when v_comm is null then null else round(v_lordo * v_comm / 100, 2) end,
    case when v_comm is null then null else round(v_lordo * (100 - v_comm) / 100, 2) end,
    v_conti,
    (case when v_giorni is null
          then 'Non so in quanti giorni accredita la banca, quindi qui c''e'' TUTTO l''incassato con carta, anche quello gia'' arrivato. '
          else 'Incassi con carta degli ultimi ' || v_giorni || ' giorni. ' end)
    || (case when v_comm is null
             then 'E l''importo e'' LORDO: non so quanto trattiene di commissione. Impostali quando la banca risponde (domanda B2).'
             else 'Al netto della commissione del ' || trim(to_char(v_comm, 'FM990.99')) || '%.' end);
end;
$function$;

revoke all on function pos_in_transito(uuid) from public, anon, authenticated;
grant execute on function pos_in_transito(uuid) to authenticated;

-- =====================================================================
-- Cosa deve ancora uscire
-- =====================================================================
-- ⚠️ Si DERIVA, non si copia: le fatture da pagare e le imposte le sa gia'
-- il gestionale, e riscriverle in una tabella di scadenze le conterebbe
-- due volte e le lascerebbe indietro quando cambiano. Stesso patto di
-- `lista_spesa()` e del saldo di cassa.
create or replace function movimenti_attesi(
  p_entity_id uuid,
  p_fino_al   date default null
)
returns table (
  origine     text,
  riferimento uuid,
  quando      date,
  descrizione text,
  importo     numeric,
  mezzo       text
)
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_fino date := coalesce(p_fino_al, current_date + 90);
  v_anno integer := extract(year from current_date)::integer;
  v_ha_fiscali boolean;
begin
  if not is_titolare() then
    raise exception 'Le scadenze sono riservate al titolare.';
  end if;

  -- ⚠️ Senza parametri fiscali il calendario delle imposte NON e'
  -- calcolabile, e `calcola_imposte()` solleva un'eccezione per dirlo. Se
  -- la si chiamasse lo stesso, l'assenza di quei parametri farebbe sparire
  -- **tutto** l'elenco delle uscite attese — fatture comprese — invece di
  -- far mancare solo le imposte. Un pezzo che non si sa non deve portarsi
  -- via i pezzi che si sanno.
  -- (In produzione la S.r.l.s. li ha; l'azienda agricola no, ed e' lo
  -- stato di partenza voluto.)
  select exists (select 1 from fiscal_settings f where f.entity_id = p_entity_id)
    into v_ha_fiscali;

  return query
  -- Le fatture non ancora pagate. ⚠️ Quando `pay_supplier_invoice` le
  -- segna pagate spariscono da sole: e' gia' riconciliazione, e non ha
  -- avuto bisogno di nessun estratto conto.
  select 'fattura'::text, i.id,
         coalesce(i.due_date, i.invoice_date),
         ('Fattura ' || coalesce(s.name, 'fornitore') || coalesce(' n. ' || i.invoice_number, ''))::text,
         i.amount,
         coalesce(i.payment_method, 'banca')::text
    from supplier_invoices i
    left join suppliers s on s.id = i.supplier_id
   where i.entity_id = p_entity_id
     and i.status = 'da_pagare'
     and coalesce(i.due_date, i.invoice_date) <= v_fino
  union all
  -- Le imposte, dal motore unico: nessun calcolo nuovo qui dentro.
  select 'imposta'::text, null::uuid, c.scadenza, c.voce, c.importo, 'banca'::text
    from calendario_imposte(p_entity_id, v_anno, 0, null) c
   where v_ha_fiscali
     and c.scadenza between current_date and v_fino
     and c.importo > 0
  union all
  -- E quelle che solo lui conosce.
  select 'scadenza'::text, p.id, p.scade_il, p.descrizione, p.importo, p.mezzo
    from scadenze_previste p
   where p.entity_id = p_entity_id
     and p.chiusa_il is null
     and p.scade_il <= v_fino
  order by 3;
end;
$function$;

revoke all on function movimenti_attesi(uuid, date) from public, anon, authenticated;
grant execute on function movimenti_attesi(uuid, date) to authenticated;

-- =====================================================================
-- «Ce la faccio?» — la domanda che conta
-- =====================================================================
create or replace function previsione_cassa(
  p_entity_id uuid,
  p_fino_al   date default null
)
returns table (
  oggi_cassa      numeric,
  oggi_banca      numeric,
  pos_in_arrivo   numeric,
  uscite_attese   numeric,
  quante_uscite   integer,
  saldo_previsto  numeric,
  fino_al         date,
  avvertenza      text
)
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_fino   date := coalesce(p_fino_al, current_date + 30);
  v_cassa  numeric;
  v_banca  numeric;
  v_pos    numeric;
  v_lordo  boolean;
  v_usc    numeric;
  v_n      integer;
begin
  if not is_titolare() then
    raise exception 'La previsione di cassa e'' riservata al titolare.';
  end if;

  select s.contante_atteso, s.saldo_banca into v_cassa, v_banca
    from saldo_tesoreria(p_entity_id) s;

  select p.lordo, (p.netto_atteso is null) into v_pos, v_lordo
    from pos_in_transito(p_entity_id) p;

  select coalesce(sum(m.importo), 0), count(*) into v_usc, v_n
    from movimenti_attesi(p_entity_id, v_fino) m;

  return query select
    v_cassa, v_banca, v_pos, v_usc, v_n,
    v_cassa + v_banca + v_pos - v_usc,
    v_fino,
    -- ⚠️ Il limite viaggia col numero, e qui il limite e' grosso: manca
    -- il costo del personale, che e' la voce piu' pesante dell'anno.
    'Previsione al ' || to_char(v_fino, 'DD/MM/YYYY') || '. '
    || '⚠️ NON comprende gli stipendi: escono dal prospetto del costo aziendale, che arriva col Consulente del Lavoro. '
    || case when v_lordo then 'Gli incassi con carta sono contati al lordo delle commissioni. ' else '' end
    || 'Le fatture gia'' pagate non sono contate due volte: spariscono da sole quando registri il pagamento.';
end;
$function$;

comment on function previsione_cassa is
  'La domanda che chiude i ristoranti non e'' «quanto ho» ma «arrivo al 16 con i soldi sul conto» (15/08/2026). Somma cio'' che c''e'' e cio'' che sta arrivando, toglie cio'' che deve uscire, e dichiara cosa NON sa ancora.';

revoke all on function previsione_cassa(uuid, date) from public, anon, authenticated;
grant execute on function previsione_cassa(uuid, date) to authenticated;

-- =====================================================================
-- VERIFICA
-- =====================================================================
do $verifica$
declare
  v_ente     uuid;
  v_titolare uuid;
  v_staff    uuid;
  v_forn     uuid;
  v_fatt     uuid;
  t          record;
  p          record;
  n          integer;
  respinto   boolean;
begin
  select id into v_ente from entities where entity_type = 'srls' limit 1;
  if v_ente is null then select id into v_ente from entities limit 1; end if;
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  select user_id into v_staff    from user_roles where role = 'staff'    limit 1;
  if v_ente is null or v_titolare is null then
    raise exception 'Prerequisiti mancanti.';
  end if;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

  -- ---- I parametri del POS nascono vuoti, e si dichiara ---------------
  select * into p from pos_in_transito(v_ente);
  if p.netto_atteso is not null then
    raise exception 'Il netto del POS e'' calcolato senza che nessuno abbia detto la commissione.';
  end if;
  if position('LORDO' in p.avvertenza) = 0 then
    raise exception 'L''avvertenza non dichiara che l''importo e'' lordo.';
  end if;
  if position('Non so in quanti giorni' in p.avvertenza) = 0 then
    raise exception 'L''avvertenza non dichiara di non sapere i giorni di accredito.';
  end if;

  -- Impostandoli, il netto compare.
  insert into impostazioni_tesoreria (entity_id, giorni_accredito_pos, commissione_pos_percento)
  values (v_ente, 2, 1.5)
  on conflict (entity_id) do update
    set giorni_accredito_pos = 2, commissione_pos_percento = 1.5;

  select * into p from pos_in_transito(v_ente);
  if p.netto_atteso is null then
    raise exception 'Con la commissione impostata il netto non viene calcolato.';
  end if;
  if position('LORDO' in p.avvertenza) <> 0 then
    raise exception 'L''avvertenza dice ancora che l''importo e'' lordo.';
  end if;

  -- ---- Una scadenza scritta a mano entra negli attesi -----------------
  insert into scadenze_previste (entity_id, descrizione, importo, scade_il, mezzo, nota)
  values (v_ente, '__PROVA TESORERIA affitto__', 900, current_date + 10, 'banca', '__PROVA TESORERIA__');

  select count(*) into n
    from movimenti_attesi(v_ente, current_date + 20)
   where descrizione = '__PROVA TESORERIA affitto__';
  if n <> 1 then
    raise exception 'La scadenza scritta a mano non compare fra gli attesi.';
  end if;

  -- ⚠️ E oltre l'orizzonte non compare: una previsione a 5 giorni non
  -- deve contare un'uscita che cade fra 10.
  select count(*) into n from movimenti_attesi(v_ente, current_date + 5)
   where descrizione = '__PROVA TESORERIA affitto__';
  if n <> 0 then
    raise exception 'Una scadenza oltre l''orizzonte viene contata lo stesso.';
  end if;

  -- ---- Una fattura da pagare e' attesa, pagata non lo e' piu' ---------
  select id into v_forn from suppliers limit 1;
  if v_forn is not null then
    insert into supplier_invoices (entity_id, supplier_id, invoice_date, due_date, amount, status, note)
    values (v_ente, v_forn, current_date, current_date + 7, 250, 'da_pagare', '__PROVA TESORERIA fattura__')
    returning id into v_fatt;

    select count(*) into n from movimenti_attesi(v_ente, current_date + 20)
     where riferimento = v_fatt;
    if n <> 1 then
      raise exception 'Una fattura da pagare non compare fra le uscite attese.';
    end if;

    -- Segnandola pagata sparisce da sola: e' riconciliazione, e non ha
    -- avuto bisogno di nessun estratto conto.
    update supplier_invoices set status = 'pagata', paid_at = now() where id = v_fatt;
    select count(*) into n from movimenti_attesi(v_ente, current_date + 20)
     where riferimento = v_fatt;
    if n <> 0 then
      raise exception 'Una fattura pagata risulta ancora fra le uscite attese.';
    end if;

    delete from supplier_invoices where id = v_fatt;
  end if;

  -- ---- La previsione somma e sottrae quello che deve -------------------
  select * into t from previsione_cassa(v_ente, current_date + 20);
  if t.quante_uscite < 1 then
    raise exception 'La previsione non vede nessuna uscita attesa.';
  end if;
  if t.saldo_previsto <> t.oggi_cassa + t.oggi_banca + t.pos_in_arrivo - t.uscite_attese then
    raise exception 'Il saldo previsto non e'' la somma dichiarata.';
  end if;
  -- ⚠️ E dichiara il buco piu' grosso: gli stipendi non ci sono.
  if position('NON comprende gli stipendi' in t.avvertenza) = 0 then
    raise exception 'La previsione non dichiara che mancano gli stipendi.';
  end if;

  -- ---- Il portiere -----------------------------------------------------
  if v_staff is not null then
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
    for n in 1..3 loop
      respinto := false;
      begin
        case n
          when 1 then perform * from pos_in_transito(v_ente);
          when 2 then perform * from movimenti_attesi(v_ente, null);
          when 3 then perform * from previsione_cassa(v_ente, null);
        end case;
      exception when sqlstate 'P0001' then respinto := true;
      end;
      if not respinto then
        raise exception 'Lo staff legge la tesoreria (controllo %).', n;
      end if;
    end loop;
  end if;

  -- ---- Pulizia ----------------------------------------------------------
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

  delete from scadenze_previste where nota = '__PROVA TESORERIA__';
  delete from supplier_invoices where note = '__PROVA TESORERIA fattura__';
  -- ⚠️ I parametri del POS li ha SCRITTI la verifica: vanno rimessi come
  -- erano, cioe' inesistenti. Lezione del 14/08 — una verifica che
  -- modifica dati si ripulisce rimettendo, e qui «com'era» vuol dire che
  -- la riga non c'era affatto. Lasciarla direbbe che Alessio ha risposto
  -- a una domanda che nessuno gli ha ancora fatto.
  delete from impostazioni_tesoreria where entity_id = v_ente;

  select count(*) into n from scadenze_previste;
  if n <> 0 then
    raise exception 'La verifica ha lasciato % scadenze.', n;
  end if;
  select count(*) into n from impostazioni_tesoreria;
  if n <> 0 then
    raise exception 'La verifica ha lasciato % righe di impostazioni del POS.', n;
  end if;
  select count(*) into n from supplier_invoices where note like '%PROVA TESORERIA%';
  if n <> 0 then
    raise exception 'La verifica ha lasciato % fatture.', n;
  end if;

  perform set_config('request.jwt.claims', null, true);
  raise notice 'Ce la faccio al 16: il POS in transito si dichiara lordo, le fatture pagate spariscono da sole, e la previsione dice che mancano gli stipendi.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260815000005', 'ce_la_faccio_al_16')
on conflict (version) do nothing;

select
  (select count(*) from impostazioni_tesoreria) as pos_impostato,
  (select count(*) from scadenze_previste where chiusa_il is null) as scadenze_aperte,
  (select count(*) from supplier_invoices where status = 'da_pagare') as fatture_da_pagare;
