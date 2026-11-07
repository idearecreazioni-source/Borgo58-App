-- =====================================================================
-- IL PIANO DELL'INVESTIMENTO, PARTE 7 — LE RATE NELLA PREVISIONE DI CASSA
-- (07/11/2026)
-- =====================================================================
--
-- 🔴 RICHIESTA A DI ALESSIO: le rate del piano ancora da pagare entrano fra
--    i movimenti attesi, quindi nella previsione di cassa («ce la faccio
--    al 16?») e nello scadenziario della pagina del piano.
--
-- 🔴 MAI DUE VOLTE (la regola chiesta dalla chat madre il 07/11). Una rata
--    compare solo per la parte che NESSUN'ALTRA RIGA racconta già:
--      · un pagamento collegato (prima nota o anticipo) la copre: quei
--        soldi sono già usciti;
--      · una fattura collegata e ancora da pagare la copre: compare già
--        fra i movimenti attesi come «fattura», con la sua scadenza;
--      · una fattura già pagata conta tramite il suo pagamento (parte 5),
--        e se il pagamento non è collegato conta lei, per non lasciare
--        la rata aperta su una cosa già pagata.
--
-- ⚠️ QUALE RATA COPRE UN COLLEGAMENTO: se il collegamento dice la rata,
--    copre quella; se dice solo la voce, copre le rate della voce in
--    ordine, dall'acconto in poi. Così un acconto pagato senza dire la
--    rata chiude l'acconto, non l'ultima rata.
--
-- ⚠️ LA DATA DI UNA RATA: l'acconto scade l'ultimo giorno prima
--    dell'apertura; il mese N il primo giorno di quel mese (la data più
--    prudente). Una rata già scaduta e non pagata compare a oggi: è
--    ancora da pagare, non è sparita.
--
-- ⚠️ SOLO PER BORGO 58: il piano è della società. La tasca e l'orto non
--    vedono le rate.
-- ⚠️ UNA RATA PAGATA DALLA TASCA È PAGATA (revisione del 07/11): se Alessio
--    l'ha pagata coi suoi soldi, Borgo 58 non la paga più, e la rata esce
--    dalla previsione della società.
-- ⚠️ UNA VOCE «STIMATA» SI DICE: la rata entra lo stesso nella previsione
--    (prudenza), ma la descrizione porta «(stimata)».

-- ---------------------------------------------------------------------
-- 1. LE RATE ANCORA APERTE
-- ---------------------------------------------------------------------
create or replace function piano_rate_aperte()
returns table (
  rata_id     uuid,
  voce_id     uuid,
  voce        text,
  mese_rel    smallint,
  stato       text,
  scade_il    date,
  importo     numeric,
  aperto      numeric
)
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_apertura date;
begin
  if not is_titolare() then
    raise exception 'Il piano dell''investimento è riservato al titolare.';
  end if;
  select mese_apertura into v_apertura from piano_impostazioni;

  return query
  with pagamenti as (
    select c.voce_id, c.rata_id, c.importo_attribuito as importo, m.supplier_invoice_id as fattura
      from piano_collegamenti c
      join cash_movements m on m.id = c.cash_movement_id
     where m.e_investimento and m.direction = 'uscita'
    union all
    select c.voce_id, c.rata_id, c.importo_attribuito, a.supplier_invoice_id
      from piano_collegamenti c
      join anticipazioni_socio a on a.id = c.anticipazione_id
     where a.e_investimento
  ),
  -- Ogni cosa che copre una rata, contata una volta sola: i pagamenti, e
  -- delle fatture solo la parte che i pagamenti della stessa voce non
  -- coprono già (la stessa regola dell'impegnato, parte 5).
  coperture as (
    select p.voce_id, p.rata_id, p.importo from pagamenti p
    union all
    select c.voce_id, c.rata_id,
           greatest(c.importo_attribuito - coalesce((
             select sum(p.importo) from pagamenti p where p.fattura = i.id and p.voce_id = c.voce_id
           ), 0), 0)
      from piano_collegamenti c
      join supplier_invoices i on i.id = c.supplier_invoice_id
  ),
  rate as (
    select r.id, r.voce_id, v.descrizione, v.stato, r.mese_rel, r.importo,
           -- La parte della rata coperta dai collegamenti che la nominano.
           greatest(r.importo - coalesce((
             select sum(k.importo) from coperture k where k.rata_id = r.id
           ), 0), 0) as dopo_esplicite
      from piano_rate r
      join piano_voci v on v.id = r.voce_id
     where v.archiviata_il is null
  ),
  libere as (
    -- I collegamenti che dicono solo la voce, più quello che i collegamenti
    -- a una rata hanno messo oltre la rata stessa.
    select v.id as voce_id,
           coalesce((select sum(k.importo) from coperture k where k.voce_id = v.id and k.rata_id is null), 0)
         + coalesce((
             select sum(greatest(e.coperto - r2.importo, 0))
               from piano_rate r2
               join lateral (select coalesce(sum(k.importo), 0) as coperto from coperture k where k.rata_id = r2.id) e on true
              where r2.voce_id = v.id
           ), 0) as libero
      from piano_voci v
  ),
  in_ordine as (
    select r.*, l.libero,
           coalesce(sum(r.dopo_esplicite) over (
             partition by r.voce_id order by r.mese_rel
             rows between unbounded preceding and 1 preceding
           ), 0) as prima
      from rate r
      join libere l on l.voce_id = r.voce_id
  )
  select o.id,
         o.voce_id,
         o.descrizione::text,
         o.mese_rel,
         o.stato::text,
         (case when o.mese_rel = 0 then v_apertura - 1
               else (v_apertura + make_interval(months => o.mese_rel - 1))::date end),
         o.importo,
         greatest(o.dopo_esplicite - greatest(o.libero - o.prima, 0), 0)::numeric
    from in_ordine o
   order by o.mese_rel, o.descrizione, o.id;
end;
$fn$;

revoke all on function piano_rate_aperte() from public, anon, authenticated;
grant execute on function piano_rate_aperte() to authenticated;

-- ---------------------------------------------------------------------
-- 2. I MOVIMENTI ATTESI, CON LE RATE
-- ---------------------------------------------------------------------
-- Come in 20260817000002, con un ramo in più in fondo: le rate aperte.
create or replace function movimenti_attesi(p_entity_id uuid, p_fino_al date default null)
returns table (origine text, riferimento uuid, quando date, descrizione text, importo numeric, mezzo text)
language plpgsql
stable
security definer
set search_path = public
as $funzione$
declare
  v_oggi date := (now() at time zone 'Europe/Rome')::date;
  v_fino date := coalesce(p_fino_al, v_oggi + 90);
  v_anno integer := extract(year from v_oggi)::integer;
  v_ha_fiscali boolean;
  v_srls boolean;
begin
  if not is_titolare() then
    raise exception 'Le scadenze sono riservate al titolare.';
  end if;

  select exists (select 1 from fiscal_settings f where f.entity_id = p_entity_id)
    into v_ha_fiscali;
  select exists (select 1 from entities e where e.id = p_entity_id and e.entity_type = 'srls')
    into v_srls;

  return query
  -- ⚠️ AL NETTO DELLE NOTE DI CREDITO: aspettarsi 250 quando ne usciranno
  -- 210 fa stare piu' stretti del necessario, e una previsione che sbaglia
  -- sempre nella stessa direzione si smette di guardare. La fattura
  -- coperta per intero non compare affatto — non uscira' niente.
  select 'fattura'::text, i.id,
         coalesce(i.due_date, i.invoice_date),
         ('Fattura ' || coalesce(s.name, 'fornitore') || coalesce(' n. ' || i.invoice_number, '')
           || case when note_scalate(i) > 0
                   then ' (al netto di ' || to_char(note_scalate(i), 'FM999999990.00') || ' di nota di credito)'
                   else '' end)::text,
         da_pagare(i),
         coalesce(i.payment_method, 'banca')::text
    from supplier_invoices i
    left join suppliers s on s.id = i.supplier_id
   where i.entity_id = p_entity_id
     and i.status = 'da_pagare'
     and da_pagare(i) > 0
     and coalesce(i.due_date, i.invoice_date) <= v_fino
  union all
  select 'uscita_futura'::text, m.id, m.movement_date,
         ('Gia'' registrata: ' || coalesce(nullif(m.business_purpose, ''),
             coalesce(c.label, 'uscita'))
           || coalesce(' (' || m.riferimento_pagamento || ')', ''))::text,
         m.amount,
         (case when m.mezzo = 'cassa' then 'contante' else 'banca' end)::text
    from cash_movements m
    left join cash_causali c on c.id = m.causale_id
   where m.entity_id = p_entity_id
     and m.direction = 'uscita'
     and m.movement_date > v_oggi
     and m.movement_date <= v_fino
  union all
  select 'imposta'::text, null::uuid, c.scadenza, c.voce, c.importo, 'banca'::text
    from calendario_imposte(p_entity_id, v_anno, 0, null) c
   where v_ha_fiscali
     and c.scadenza between v_oggi and v_fino
     and c.importo > 0
  union all
  select 'scadenza'::text, p.id, p.scade_il, p.descrizione, p.importo, p.mezzo
    from scadenze_previste p
   where p.entity_id = p_entity_id
     and p.chiusa_il is null
     and p.scade_il <= v_fino
  union all
  -- 🔴 LE RATE DEL PIANO, per la sola parte che nessun'altra riga racconta
  --    già (piano_rate_aperte). Una rata scaduta e non pagata compare a
  --    oggi: è ancora da pagare.
  select 'rata_piano'::text, r.rata_id,
         greatest(r.scade_il, v_oggi),
         ('Piano: ' || r.voce || case when r.mese_rel = 0 then ' (acconto)' else '' end
           || case when r.stato = 'stimato' then ' (stimata)' else '' end)::text,
         r.aperto,
         'banca'::text
    from piano_rate_aperte() r
   where v_srls
     and r.aperto > 0
     and greatest(r.scade_il, v_oggi) <= v_fino
  order by 3;
end;
$funzione$;

revoke all on function movimenti_attesi(uuid, date) from public, anon, authenticated;
grant execute on function movimenti_attesi(uuid, date) to authenticated;

-- ---------------------------------------------------------------------
-- 3. VERIFICA
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_foto     jsonb := foto_righe();
  v_titolare uuid;
  v_staff    uuid;
  v_srls     uuid;
  v_agri     uuid;
  v_caus     uuid;
  v_forn     uuid;
  v_voce     uuid;
  v_r0       uuid;
  v_r1       uuid;
  v_r2       uuid;
  v_fat      uuid;
  v_fat2     uuid;
  v_mov      uuid;
  v_mov2     uuid;
  v_aperto   numeric;
  v_n        integer;
  v_rifiuto  boolean;
  v_fino     date;
begin
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  select user_id into v_staff from user_roles where role = 'staff' limit 1;
  select id into v_srls from entities where entity_type = 'srls' limit 1;
  select id into v_agri from entities where entity_type = 'azienda_agricola' limit 1;
  select id into v_caus from cash_causali where kind = 'uscita' and active and not di_sistema order by created_at limit 1;
  if v_titolare is null or v_staff is null or v_srls is null or v_agri is null or v_caus is null then
    raise exception 'VERIFICA: servono un titolare, uno staff, Borgo 58, l''orto e una causale d''uscita.';
  end if;

  begin
    insert into suppliers (entity_id, name) values (v_srls, 'ZZ fornitore rate piano') returning id into v_forn;
    insert into supplier_invoices (entity_id, supplier_id, invoice_number, invoice_date, due_date, amount)
    values (v_srls, v_forn, 'ZZ-R1', current_date, current_date + 5, 300.00) returning id into v_fat;

    perform set_config('request.jwt.claims', json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);
    set local role authenticated;

    -- Una voce da 1.000: 400 di acconto, 300 il mese 1, 300 il mese 2.
    insert into piano_voci (gruppo, descrizione, importo_ivato) values ('A', 'ZZ forno delle rate', 1000.00) returning id into v_voce;
    insert into piano_rate (voce_id, mese_rel, importo) values (v_voce, 0, 400.00) returning id into v_r0;
    insert into piano_rate (voce_id, mese_rel, importo) values (v_voce, 1, 300.00) returning id into v_r1;
    insert into piano_rate (voce_id, mese_rel, importo) values (v_voce, 2, 300.00) returning id into v_r2;

    -- (1) Niente collegato: tre rate aperte per intero.
    select coalesce(sum(aperto), 0) into v_aperto from piano_rate_aperte() where voce_id = v_voce;
    if v_aperto <> 1000.00 then raise exception 'VERIFICA (1): senza collegamenti le rate aperte dovevano fare 1.000 €, fanno %.', v_aperto; end if;

    -- (2) Un pagamento di 250 collegato alla sola voce copre l'acconto, in ordine.
    insert into cash_movements (entity_id, direction, amount, movement_date, causale_id, mezzo, business_purpose, e_investimento)
    values (v_srls, 'uscita', 250.00, current_date, v_caus, 'cassa', 'ZZ verifica rate - acconto', true)
    returning id into v_mov;
    insert into piano_collegamenti (voce_id, cash_movement_id, importo_attribuito) values (v_voce, v_mov, 250.00);
    select aperto into v_aperto from piano_rate_aperte() where rata_id = v_r0;
    if v_aperto <> 150.00 then raise exception 'VERIFICA (2): l''acconto doveva restare aperto per 150 €, resta %.', v_aperto; end if;
    select aperto into v_aperto from piano_rate_aperte() where rata_id = v_r1;
    if v_aperto <> 300.00 then raise exception 'VERIFICA (2b): il mese 1 doveva restare intero, resta %.', v_aperto; end if;

    -- (3) Una fattura da 300 collegata alla rata del mese 1: la rata si
    --     chiude, e la fattura compare una volta sola, come fattura.
    update supplier_invoices set e_investimento = true where id = v_fat;
    insert into piano_collegamenti (voce_id, rata_id, supplier_invoice_id, importo_attribuito) values (v_voce, v_r1, v_fat, 300.00);
    set constraints all immediate;
    set constraints all deferred;
    select aperto into v_aperto from piano_rate_aperte() where rata_id = v_r1;
    if v_aperto <> 0 then raise exception 'VERIFICA (3): la rata coperta dalla fattura resta aperta per %.', v_aperto; end if;

    -- (4) Nei movimenti attesi di Borgo 58: la fattura una volta, e le rate
    --     solo per quello che resta (150 di acconto + 300 del mese 2).
    -- Mai prima di oggi + 30: la verifica deve passare anche dopo l'apertura.
    v_fino := greatest((select mese_apertura from piano_impostazioni) + 60, current_date + 30);
    select count(*) into v_n from movimenti_attesi(v_srls, v_fino) m where m.origine = 'fattura' and m.riferimento = v_fat;
    if v_n <> 1 then raise exception 'VERIFICA (4a): la fattura collegata compare % volte fra i movimenti attesi.', v_n; end if;
    select coalesce(sum(m.importo), 0) into v_aperto from movimenti_attesi(v_srls, v_fino) m
     where m.origine = 'rata_piano' and m.riferimento in (v_r0, v_r1, v_r2);
    if v_aperto <> 450.00 then raise exception 'VERIFICA (4b): le rate fra i movimenti attesi dovevano fare 450 €, fanno %.', v_aperto; end if;
    select count(*) into v_n from movimenti_attesi(v_srls, v_fino) m where m.riferimento = v_r1;
    if v_n <> 0 then raise exception 'VERIFICA (4c): la rata chiusa dalla fattura compare ancora fra i movimenti attesi.'; end if;

    -- (4d) Il caso principale contro i doppioni: una fattura da 300 sulla
    --      rata del mese 2, poi pagata; i collegamenti passano al pagamento
    --      con la stessa rata. Copre 300, non 600: il mese 2 si chiude e
    --      l'acconto resta aperto per 150 come prima.
    insert into supplier_invoices (entity_id, supplier_id, invoice_number, invoice_date, amount)
    values (v_srls, v_forn, 'ZZ-R2', current_date, 300.00) returning id into v_fat2;
    update supplier_invoices set e_investimento = true where id = v_fat2;
    insert into piano_collegamenti (voce_id, rata_id, supplier_invoice_id, importo_attribuito) values (v_voce, v_r2, v_fat2, 300.00);
    insert into cash_movements (entity_id, direction, amount, movement_date, mezzo, business_purpose, supplier_invoice_id)
    values (v_srls, 'uscita', 300.00, current_date, 'cassa', 'ZZ verifica rate - paga la fattura', v_fat2)
    returning id into v_mov2;
    update supplier_invoices set status = 'pagata', paid_at = now(), payment_method = 'contante' where id = v_fat2;
    set constraints all immediate;
    set constraints all deferred;
    select count(*) into v_n from piano_collegamenti where cash_movement_id = v_mov2 and rata_id = v_r2;
    if v_n <> 1 then raise exception 'VERIFICA (4d): il pagamento della fattura non ha ereditato il collegamento alla rata.'; end if;
    select aperto into v_aperto from piano_rate_aperte() where rata_id = v_r2;
    if v_aperto <> 0 then raise exception 'VERIFICA (4d): la rata pagata con la fattura resta aperta per %.', v_aperto; end if;
    select aperto into v_aperto from piano_rate_aperte() where rata_id = v_r0;
    if v_aperto <> 150.00 then raise exception 'VERIFICA (4e): fattura e pagamento contati due volte: l''acconto doveva restare 150 €, resta %.', v_aperto; end if;

    -- (5) L'orto non vede le rate.
    select count(*) into v_n from movimenti_attesi(v_agri, v_fino) m where m.origine = 'rata_piano';
    if v_n <> 0 then raise exception 'VERIFICA (5): l''orto vede % rate del piano.', v_n; end if;

    -- (6) Lo staff riceve un rifiuto, non un elenco vuoto.
    perform set_config('request.jwt.claims', json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
    v_rifiuto := false;
    begin
      perform * from piano_rate_aperte();
    exception when raise_exception then v_rifiuto := sqlerrm like '%riservato al titolare%';
    end;
    if not v_rifiuto then raise exception 'VERIFICA (6): lo staff ha letto le rate aperte del piano.'; end if;
    reset role;
    perform set_config('request.jwt.claims', null, true);

    if has_function_privilege('anon', 'piano_rate_aperte()', 'execute') then
      raise exception 'VERIFICA (7): anon può leggere le rate aperte del piano.';
    end if;

    raise exception 'ZZ_ANNULLA';
  exception when others then
    if sqlerrm <> 'ZZ_ANNULLA' then raise; end if;
  end;

  reset role;
  perform set_config('request.jwt.claims', null, true);
  perform pretendi_nessun_residuo(v_foto, 'la verifica delle rate del piano nella previsione');

  raise notice 'Fatto: le rate aperte del piano entrano nei movimenti attesi di Borgo 58 per la sola parte non coperta da pagamenti o fatture collegate; un pagamento senza rata copre le rate in ordine; la fattura collegata compare una volta sola; l''orto non le vede; lo staff riceve un rifiuto. Provato e annullato: zero residui.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20261107000004', 'le_rate_del_piano_nella_previsione')
on conflict (version) do nothing;
