-- =====================================================================
-- IL CONFRONTO NOTTURNO: MEMO CONTRO LE PAGINE — 15/11/2026
-- =====================================================================
--
-- Il 15/11 la chat ha dato 69 voci e 98.586,80 € per il piano, mentre la
-- pagina diceva 63 e 77.620,80 €. Le prove nei Controlli girano su Prova,
-- con i dati di prova; l'errore del piano è comparso solo con i dati veri.
-- Questo è il secondo paracadute (richiesta del revisore, approvata da
-- Alessio il 15/11): ogni notte, SU WORK, si confronta quello che dice MEMO
-- con quello che dicono le pagine, e se non coincide arriva un avviso.
--
-- ⚠️ Solo conteggi e totali, solo lettura, niente intelligenza artificiale
--    (costo zero), nessun dato personale: il risultato di ogni confronto resta
--    scritto in `memo_confronti`, leggibile dal titolare e da un accesso di
--    sola lettura.
--
-- ⚠️ Il lavoro si appoggia al sistema che c'è già, non ne inventa uno:
--    - gira con pg_cron, alle 03:30 di Roma (alle 1:30 e alle 2:30 UTC, e passa
--      solo quella che cade alle 3: l'ora legale non lo sposta), come
--      `avvisa_scadenze`;
--    - l'avviso va su Telegram con `segnala_allarme` (uno per tipo all'ora,
--      con il suo freno);
--    - lascia il battito in `stato_lavori` ed è sorvegliato dalla sentinella
--      (`lavori_sorvegliati`): se il confronto smette di girare per più di 26
--      ore, la sentinella lo dice. Se il confronto stesso si rompe a metà,
--      c'è un avviso a parte («non è riuscito»).
--    Un controllo che tace perché è rotto è il caso peggiore.
--
-- ⚠️ La «pagina» è scritta qui in SQL semplice, con la stessa regola del
--    codice della pagina (voci senza sottovoci, fatture non pagate per
--    società, cassa per soggetto, movimenti di banca non ignorati, ...). È una
--    seconda strada al numero: se la funzione di MEMO cambia e smette di
--    coincidere, il confronto lo vede.
--
-- rete-guardie: memo_leggi_piano — la verifica la rompe APPOSTA dentro una transazione che si annulla (per provare che il confronto se ne accorge): la funzione vera non cambia
--
-- Idempotente, con verifica finale annullata (zero residui).
-- =====================================================================

create table if not exists memo_confronti (
  id               uuid primary key default gen_random_uuid(),
  eseguito_il      timestamptz not null,
  lettura          text not null,
  memo_conteggio   integer,
  pagina_conteggio integer,
  memo_totale      numeric,
  pagina_totale    numeric,
  coincide         boolean not null,
  creato_il        timestamptz not null default now()
);

comment on table memo_confronti is
  'Ogni notte, per ogni lettura di MEMO: quanto dice MEMO e quanto dice la pagina (solo conteggi e totali). coincide = vero se i due numeri sono uguali. Scritta solo da memo_confronta_con_le_pagine().';
comment on column memo_confronti.eseguito_il is 'Quando è girato il confronto (tutte le righe dello stesso giro hanno lo stesso valore).';
comment on column memo_confronti.lettura is 'Il nome della lettura, con la società o il soggetto quando il numero è per società o per soggetto.';
comment on column memo_confronti.memo_conteggio is 'Il conteggio che MEMO dichiara.';
comment on column memo_confronti.pagina_conteggio is 'Il conteggio calcolato con la regola della pagina.';
comment on column memo_confronti.memo_totale is 'Il totale che MEMO dichiara (zero dove la lettura non ha un totale).';
comment on column memo_confronti.pagina_totale is 'Il totale calcolato con la regola della pagina.';
comment on column memo_confronti.coincide is 'Vero se conteggio e totale sono uguali (al centesimo).';

create index if not exists idx_memo_confronti_data on memo_confronti (eseguito_il desc, lettura);

alter table memo_confronti enable row level security;
drop policy if exists memo_confronti_leggi on memo_confronti;
create policy memo_confronti_leggi on memo_confronti
  for select to authenticated using ((select is_titolare()));

-- ---------------------------------------------------------------------
-- La riga di un confronto, e la frase di un confronto che non torna
-- ---------------------------------------------------------------------
create or replace function memo_confronto_registra(
  p_ora timestamptz, p_lettura text, p_mc integer, p_pc integer, p_mt numeric, p_pt numeric)
returns void
language sql
security definer
set search_path = public
as $fn$
  insert into memo_confronti (eseguito_il, lettura, memo_conteggio, pagina_conteggio, memo_totale, pagina_totale, coincide)
  values (p_ora, p_lettura, p_mc, p_pc, p_mt, p_pt,
          p_mc is not distinct from p_pc and abs(coalesce(p_mt, 0) - coalesce(p_pt, 0)) < 0.005);
$fn$;
revoke all on function memo_confronto_registra(timestamptz, text, integer, integer, numeric, numeric) from public, anon, authenticated;

create or replace function memo_confronto_frase(p_lettura text, p_mc integer, p_pc integer, p_mt numeric, p_pt numeric)
returns text
language sql
immutable
set search_path = public
as $fn$
  select p_lettura || ': MEMO dice ' || coalesce(p_mc::text, '?') || ' righe'
         || case when coalesce(p_mt, 0) <> 0 or coalesce(p_pt, 0) <> 0
                 then ' e ' || to_char(coalesce(p_mt, 0), 'FM999G999G990D00') || ' €' else '' end
         || ', la pagina ' || coalesce(p_pc::text, '?') || ' righe'
         || case when coalesce(p_mt, 0) <> 0 or coalesce(p_pt, 0) <> 0
                 then ' e ' || to_char(coalesce(p_pt, 0), 'FM999G999G990D00') || ' €' else '' end;
$fn$;
revoke all on function memo_confronto_frase(text, integer, integer, numeric, numeric) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Il confronto: MEMO contro la regola della pagina, per tutte le letture
-- ---------------------------------------------------------------------
create or replace function memo_confronta_con_le_pagine()
returns table (lettura text, memo_conteggio integer, pagina_conteggio integer,
               memo_totale numeric, pagina_totale numeric, coincide boolean)
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_ora      timestamptz := clock_timestamp();
  v_titolare uuid;
  v_mc integer; v_mt numeric; v_pc integer; v_pt numeric;
  r record;
begin
  -- Si legge COME LEGGE MEMO: con la sessione del titolare. Il lavoro pianificato
  -- non ne ha una, quindi la si imposta qui, solo per questa transazione.
  select ur.user_id into v_titolare from user_roles ur where ur.role = 'titolare' limit 1;
  if v_titolare is null then
    raise exception 'Non c''e'' un titolare: non posso leggere come legge MEMO.';
  end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

  -- PIANO: le voci vive che non hanno sottovoci vive (la madre è già la somma delle figlie).
  select coalesce(max(l.conteggio), 0), coalesce(max(l.totale), 0) into v_mc, v_mt from memo_leggi_piano(null) l;
  select count(*)::integer, coalesce(sum(v.importo_ivato), 0) into v_pc, v_pt
    from piano_voci v
   where v.archiviata_il is null
     and not exists (select 1 from piano_voci f where f.madre_id = v.id and f.archiviata_il is null);
  perform memo_confronto_registra(v_ora, 'piano dell''investimento', v_mc, v_pc, v_mt, v_pt);

  -- FATTURE FORNITORI: per società; il totale è il da pagare delle sole non pagate.
  for r in
    select e.name as nome,
           (select count(*) from supplier_invoices i where i.entity_id = e.id)::integer as pc,
           (select coalesce(sum(da_pagare(i)), 0) from supplier_invoices i
             where i.entity_id = e.id and i.status = 'da_pagare') as pt
      from entities e
     where exists (select 1 from supplier_invoices i where i.entity_id = e.id)
     order by e.name
  loop
    select coalesce(max(l.conteggio), 0), coalesce(max(l.totale), 0) into v_mc, v_mt
      from memo_leggi_fatture_fornitori(null) l where l.dati->>'societa' = r.nome;
    perform memo_confronto_registra(v_ora, 'fatture fornitori (' || r.nome || ')', v_mc, r.pc, v_mt, r.pt);
  end loop;

  -- CASSA: per soggetto, entrate meno uscite.
  for r in
    select e.name as nome,
           (select count(*) from cash_movements m where m.entity_id = e.id)::integer as pc,
           (select coalesce(sum(case when m.direction = 'entrata' then m.amount else -m.amount end), 0)
              from cash_movements m where m.entity_id = e.id) as pt
      from entities e
     where exists (select 1 from cash_movements m where m.entity_id = e.id)
     order by e.name
  loop
    select coalesce(max(l.conteggio), 0), coalesce(max(l.totale), 0) into v_mc, v_mt
      from memo_leggi_cassa(null) l where l.dati->>'soggetto' = r.nome;
    perform memo_confronto_registra(v_ora, 'cassa (' || r.nome || ')', v_mc, r.pc, v_mt, r.pt);
  end loop;

  -- BANCA: i movimenti non ignorati (un abbinato resta, anche se segnato ignorato).
  select coalesce(max(l.conteggio), 0), coalesce(max(l.totale), 0) into v_mc, v_mt from memo_leggi_banca(null) l;
  select count(*)::integer, coalesce(sum(m.importo), 0) into v_pc, v_pt
    from movimenti_banca m where (m.ignorato_il is null or m.cash_movement_id is not null);
  perform memo_confronto_registra(v_ora, 'banca', v_mc, v_pc, v_mt, v_pt);

  -- PRENOTAZIONI: le valide (confermate o in attesa) e i loro coperti.
  select coalesce(max(l.conteggio), 0), coalesce(max(l.totale), 0) into v_mc, v_mt from memo_leggi_prenotazioni(null) l;
  select (count(*) filter (where rs.status in ('confermata', 'richiesta_in_attesa')))::integer,
         coalesce(sum(coalesce(rs.party_size, 0)) filter (where rs.status in ('confermata', 'richiesta_in_attesa')), 0)
    into v_pc, v_pt from reservations rs;
  perform memo_confronto_registra(v_ora, 'prenotazioni', v_mc, v_pc, v_mt, v_pt);

  -- MAGAZZINO: i prodotti attivi (nessun totale).
  select coalesce(max(l.conteggio), 0), coalesce(max(l.totale), 0) into v_mc, v_mt from memo_leggi_magazzino(null) l;
  select count(*)::integer into v_pc from v_stock_levels;
  perform memo_confronto_registra(v_ora, 'magazzino', v_mc, v_pc, v_mt, 0);

  -- HACCP: le righe dei cinque registri (nessun totale).
  select coalesce(max(l.conteggio), 0), coalesce(max(l.totale), 0) into v_mc, v_mt from memo_leggi_haccp(null) l;
  select ((select count(*) from v_haccp_temperature_logs)
        + (select count(*) from haccp_non_conformities)
        + (select count(*) from haccp_goods_receiving)
        + (select count(*) from haccp_cleaning_logs cl join haccp_cleaning_tasks ct on ct.id = cl.task_id)
        + (select count(*) from haccp_pest_control_logs))::integer into v_pc;
  perform memo_confronto_registra(v_ora, 'HACCP', v_mc, v_pc, v_mt, 0);

  -- AGENDA: gli impegni aperti, dalla stessa funzione della pagina (nessun totale).
  select coalesce(max(l.conteggio), 0), coalesce(max(l.totale), 0) into v_mc, v_mt from memo_leggi_agenda(null) l;
  select count(*)::integer into v_pc from agenda_corsie();
  perform memo_confronto_registra(v_ora, 'agenda', v_mc, v_pc, v_mt, 0);

  -- COSTO PIATTI: le ricette con il loro costo (nessun totale).
  select coalesce(max(l.conteggio), 0), coalesce(max(l.totale), 0) into v_mc, v_mt from memo_leggi_costo_piatti(null) l;
  select count(*)::integer into v_pc from recipes rc join v_recipe_costs c on c.recipe_id = rc.id;
  perform memo_confronto_registra(v_ora, 'costo piatti', v_mc, v_pc, v_mt, 0);

  -- ARCHIVIO: i documenti e la somma dei loro importi.
  select coalesce(max(l.conteggio), 0), coalesce(max(l.totale), 0) into v_mc, v_mt from memo_leggi_documenti(null) l;
  select count(*)::integer, coalesce(sum(d.amount), 0) into v_pc, v_pt from documents d;
  perform memo_confronto_registra(v_ora, 'archivio documenti', v_mc, v_pc, v_mt, v_pt);

  -- FATTURE AI CLIENTI: tutte; il totale esclude bozze e scartate.
  select coalesce(max(l.conteggio), 0), coalesce(max(l.totale), 0) into v_mc, v_mt from memo_leggi_fatture_clienti(null) l;
  select count(*)::integer, coalesce(sum(f.totale) filter (where f.stato not in ('bozza', 'scartata')), 0) into v_pc, v_pt
    from fatture_emesse f join clienti_fattura c on c.id = f.cliente_id;
  perform memo_confronto_registra(v_ora, 'fatture ai clienti', v_mc, v_pc, v_mt, v_pt);

  return query
    select c.lettura, c.memo_conteggio, c.pagina_conteggio, c.memo_totale, c.pagina_totale, c.coincide
      from memo_confronti c where c.eseguito_il = v_ora order by c.lettura;
end $fn$;
revoke all on function memo_confronta_con_le_pagine() from public, anon, authenticated;

comment on function memo_confronta_con_le_pagine() is
  'Confronta quello che dice ogni lettura di MEMO con quello che dicono le pagine (solo conteggi e totali), scrive il risultato in memo_confronti e lo restituisce. Solo lettura sui dati; la chiama il lavoro notturno (15/11/2026).';

-- ---------------------------------------------------------------------
-- Il lavoro notturno: confronta, avvisa se non torna, lascia il battito
-- ---------------------------------------------------------------------
create or replace function lancia_confronto_memo(p_forza boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_ora    integer := extract(hour from (now() at time zone 'Europe/Rome'))::integer;
  v_oggi   text := to_char(now() at time zone 'Europe/Rome', 'YYYY-MM-DD');
  v_frasi  text := '';
  v_n      integer := 0;
  v_tot    integer := 0;
  r record;
begin
  -- pg_cron ragiona in UTC e l'Italia cambia ora due volte l'anno: il lavoro è
  -- programmato alle 1:30 E alle 2:30 UTC e passa solo quella che cade alle 3 qui.
  if v_ora <> 3 and not p_forza then
    return jsonb_build_object('saltato', true, 'ora_locale', v_ora);
  end if;

  begin
    for r in select * from memo_confronta_con_le_pagine() loop
      v_tot := v_tot + 1;
      if not r.coincide then
        v_n := v_n + 1;
        if v_n <= 3 then
          v_frasi := v_frasi || case when v_frasi = '' then '' else '; ' end
            || memo_confronto_frase(r.lettura, r.memo_conteggio, r.pagina_conteggio, r.memo_totale, r.pagina_totale);
        end if;
      end if;
    end loop;

    if v_n > 0 then
      perform segnala_allarme(
        'memo_confronto_' || v_oggi,
        'MEMO e le pagine non coincidono. ' || v_frasi
          || case when v_n > 3 then ' (e altre ' || (v_n - 3) || ')' else '' end
          || '. Non fidarti dei numeri della chat finché non lo sistemiamo.',
        jsonb_build_object('giorno', v_oggi, 'letture_diverse', v_n, 'letture_controllate', v_tot));
    end if;
  exception when others then
    -- Un controllo che tace perché è rotto è il caso peggiore: lo si dice, e NON si lascia il battito.
    perform segnala_allarme(
      'memo_confronto_errore',
      'Il controllo notturno che confronta MEMO con le pagine non è riuscito: ' || sqlerrm);
    return jsonb_build_object('errore', sqlerrm);
  end;

  -- Il confronto è arrivato in fondo (anche se qualcosa non coincideva: è
  -- compito dell'avviso dirlo, non della sentinella).
  insert into stato_lavori (nome, ultimo_successo) values ('memo_confronto', now())
  on conflict (nome) do update set ultimo_successo = now();

  return jsonb_build_object('giorno', v_oggi, 'controllate', v_tot, 'diverse', v_n);
end $fn$;
revoke all on function lancia_confronto_memo(boolean) from public, anon, authenticated;

comment on function lancia_confronto_memo(boolean) is
  'Il lavoro notturno del confronto MEMO/pagine: alle 03:30 di Roma confronta, avvisa su Telegram se qualcosa non coincide, lascia il battito per la sentinella. p_forza salta il controllo dell''ora (solo per le prove).';

-- ---------------------------------------------------------------------
-- La sentinella lo sorveglia e pg_cron lo fa partire
-- ---------------------------------------------------------------------
insert into lavori_sorvegliati (nome_lavoro, nome_cron, tolleranza_minuti, cosa_smette)
values ('memo_confronto', 'memo-confronto-notturno', 1560,
        'Il controllo notturno che confronta MEMO con le pagine non gira più: un numero sbagliato nella chat non verrebbe più segnalato.')
on conflict (nome_lavoro) do nothing;

insert into stato_lavori (nome, ultimo_successo) values ('memo_confronto', now())
on conflict (nome) do nothing;

select cron.schedule('memo-confronto-notturno', '30 1,2 * * *', $$select lancia_confronto_memo();$$);

-- ---------------------------------------------------------------------
-- Verifica: il confronto vede le differenze (anche quelle create apposta) e
-- tutto torna su dati veri. Non manda niente su Telegram. Annulla tutto.
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_foto jsonb := foto_righe();
  v_n integer; v_diverse integer; v_dettaglio text; v_frase text;
begin
  if not exists (select 1 from cron.job where jobname = 'memo-confronto-notturno' and active) then
    raise exception 'VERIFICA: il lavoro notturno non e'' pianificato.';
  end if;
  if exists (select 1 from lavori_senza_sentinella()) then
    raise exception 'VERIFICA: un lavoro pianificato non e'' sorvegliato dalla sentinella.';
  end if;

  begin
    -- 1. Con le letture di MEMO come devono essere, TUTTO coincide.
    select count(*)::integer, (count(*) filter (where not c.coincide))::integer,
           string_agg(c.lettura || ' (MEMO ' || coalesce(c.memo_conteggio::text, '?') || '/' || coalesce(c.memo_totale::text, '?')
                      || ' pagina ' || coalesce(c.pagina_conteggio::text, '?') || '/' || coalesce(c.pagina_totale::text, '?') || ')', '; ')
             filter (where not c.coincide)
      into v_n, v_diverse, v_dettaglio from memo_confronta_con_le_pagine() c;
    if v_n < 10 then raise exception 'VERIFICA (1): il confronto ha controllato solo % letture.', v_n; end if;
    if v_diverse > 0 then
      raise exception 'VERIFICA (1): MEMO e la pagina non coincidono gia'' adesso: %.', v_dettaglio;
    end if;

    -- 2. Rompendo apposta la lettura del piano (le madri dentro, come il 15/11), il confronto se ne accorge.
    insert into piano_voci (gruppo, ordine, descrizione, importo_ivato, aliquota_iva, stato)
    values ('D', 980, 'ZZ madre confronto notturno', 1, 22, 'stimato');
    insert into piano_voci (gruppo, ordine, descrizione, importo_ivato, aliquota_iva, stato, madre_id)
    select 'D', 981, 'ZZ figlia confronto notturno', 10, 22, 'stimato', id from piano_voci where descrizione = 'ZZ madre confronto notturno';
    execute $rotta$
      create or replace function memo_leggi_piano(p_cerca text default null)
      returns table (riga_id uuid, etichetta text, dati jsonb, conteggio integer, totale numeric)
      language sql stable security definer set search_path = public as $b$
        select v.id, v.descrizione, '{}'::jsonb, (count(*) over ())::integer, coalesce(sum(v.importo_ivato) over (), 0)
          from piano_voci v where v.archiviata_il is null order by v.gruppo, v.ordine limit 50
      $b$ $rotta$;
    select count(*) filter (where not c.coincide and c.lettura = 'piano dell''investimento')::integer into v_diverse
      from memo_confronta_con_le_pagine() c;
    if v_diverse <> 1 then
      raise exception 'VERIFICA (2): il confronto non si e'' accorto della lettura del piano rotta.';
    end if;

    -- 3. La frase dell'avviso, scritta in italiano.
    v_frase := memo_confronto_frase('piano dell''investimento', 69, 63, 98586.80, 77620.80);
    if v_frase not like 'piano dell''investimento: MEMO dice 69 righe e %, la pagina 63 righe e %' then
      raise exception 'VERIFICA (3): la frase dell''avviso non e'' quella attesa (%).', v_frase;
    end if;

    raise exception 'ZZ_ANNULLA';
  exception when others then if sqlerrm <> 'ZZ_ANNULLA' then raise; end if; end;
  perform set_config('request.jwt.claims', null, true);
  perform pretendi_nessun_residuo(v_foto, 'la verifica del confronto notturno di MEMO');
  raise notice 'Fatto: il confronto notturno vede le differenze e la sentinella lo sorveglia. Provato e annullato: zero residui.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20261115000017', 'il_confronto_notturno_di_memo') on conflict (version) do nothing;
