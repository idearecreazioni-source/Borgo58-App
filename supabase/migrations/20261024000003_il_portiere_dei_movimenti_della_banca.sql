-- =====================================================================
-- IL PORTIERE DEI MOVIMENTI DELLA BANCA STA DENTRO OGNI GESTO — 24/10/2026
-- =====================================================================
--
-- 🔴 LO HA TROVATO LA RETE (`tests/app/permessi.test.js`, «funzioni senza
-- portiere»). Quattro funzioni della `20261024000001` sono `security
-- definer` e il controllo del titolare lo facevano CHIAMANDO
-- `movimento_banca_da_abbinare()`, nell'inizializzazione di una variabile.
-- Il rifiuto c'era davvero (lo staff veniva respinto), ma stava in
-- un'altra funzione: chi legge il gesto non lo vede, e la rete che cerca
-- il portiere nel corpo di ogni funzione nemmeno.
--
-- ⚠️ La cura non è aggiungere quattro eccezioni alla rete: è scrivere il
-- portiere dove la rete e chi legge lo cercano. Corpi presi dalla
-- `…001` (l'unica che li ha mai scritti: corpo vivo della prova =
-- file), cambia solo l'inizio. `create or replace` conserva commenti e
-- permessi.
-- =====================================================================

create or replace function paga_fattura_da_movimento_banca(p_movimento uuid, p_fattura uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_m      movimenti_banca%rowtype;
  v_entita uuid;
  v_inv    supplier_invoices%rowtype;
  v_cm     uuid;
begin
  -- Il portiere, scritto qui e non solo dentro l'aiuto comune.
  if not is_titolare() then
    raise exception 'Abbinare i movimenti della banca e'' riservato al titolare.';
  end if;
  v_m := movimento_banca_da_abbinare(p_movimento);
  select entity_id into v_entita from conti_bancari where id = v_m.conto_id;
  select * into v_inv from supplier_invoices where id = p_fattura;
  if v_inv.id is null then
    raise exception 'Fattura non trovata.';
  end if;
  if v_m.importo > 0 then
    raise exception 'Questo movimento e'' un''entrata: non puo'' pagare una fattura d''acquisto.';
  end if;
  if v_inv.entity_id is distinct from v_entita then
    raise exception 'La fattura e il conto appartengono a due societa'' diverse.';
  end if;
  if v_inv.status::text = 'pagata' then
    raise exception 'Questa fattura risulta gia'' pagata: abbina il bonifico al suo movimento di prima nota invece.';
  end if;
  if da_pagare(v_inv) is distinct from -v_m.importo then
    raise exception 'Il bonifico e'' di % e la fattura chiede %: non si abbinano importi diversi.',
      euro(-v_m.importo), euro(da_pagare(v_inv));
  end if;

  perform pay_supplier_invoice(p_fattura, 'bonifico', v_m.data_contabile, v_m.riferimento_banca, null);

  select id into v_cm from cash_movements where supplier_invoice_id = p_fattura;
  if v_cm is null then
    raise exception 'Il pagamento non ha scritto il movimento di prima nota: non si abbina niente.';
  end if;
  update cash_movements set conto_id = v_m.conto_id where id = v_cm;
  update movimenti_banca set cash_movement_id = v_cm where id = v_m.id;

  return jsonb_build_object('cash_movement_id', v_cm);
end $fn$;

create or replace function abbina_movimento_banca(p_movimento uuid, p_cash_movement uuid)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_m      movimenti_banca%rowtype;
  v_entita uuid;
  v_cm     cash_movements%rowtype;
begin
  -- Il portiere, scritto qui e non solo dentro l'aiuto comune.
  if not is_titolare() then
    raise exception 'Abbinare i movimenti della banca e'' riservato al titolare.';
  end if;
  v_m := movimento_banca_da_abbinare(p_movimento);
  select entity_id into v_entita from conti_bancari where id = v_m.conto_id;
  select * into v_cm from cash_movements where id = p_cash_movement;
  if v_cm.id is null then
    raise exception 'Movimento di prima nota non trovato.';
  end if;
  if v_cm.mezzo is distinct from 'banca' then
    raise exception 'Quel movimento di prima nota e'' di cassa, non di banca.';
  end if;
  if v_cm.entity_id is distinct from v_entita
     or (v_cm.conto_id is not null and v_cm.conto_id is distinct from v_m.conto_id) then
    raise exception 'Quel movimento di prima nota e'' su un altro conto.';
  end if;
  if v_cm.direction::text is distinct from (case when v_m.importo < 0 then 'uscita' else 'entrata' end)
     or v_cm.amount is distinct from abs(v_m.importo) then
    raise exception 'Gli importi non coincidono: in banca % , in prima nota % (%).',
      euro(v_m.importo), euro(v_cm.amount), v_cm.direction;
  end if;
  if exists (select 1 from movimenti_banca where cash_movement_id = p_cash_movement) then
    raise exception 'Quel movimento di prima nota e'' gia'' abbinato a un altro movimento della banca.';
  end if;

  update movimenti_banca set cash_movement_id = p_cash_movement where id = v_m.id;
end $fn$;

create or replace function registra_movimento_banca(
  p_movimento uuid, p_causale uuid, p_tipo_documento text, p_descrizione text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_m      movimenti_banca%rowtype;
  v_entita uuid;
  v_cm     uuid;
begin
  -- Il portiere, scritto qui e non solo dentro l'aiuto comune.
  if not is_titolare() then
    raise exception 'Abbinare i movimenti della banca e'' riservato al titolare.';
  end if;
  v_m := movimento_banca_da_abbinare(p_movimento);
  -- ⚠️ Le causali DI SISTEMA (versamenti, differenze di cassa, rimborsi)
  --    sono spostamenti di denaro, non spese: sceglierne una qui farebbe
  --    sparire un costo vero dai conti in silenzio. E il verso deve
  --    combaciare: una causale d'entrata su un addebito è un errore.
  if p_causale is null or not exists (
       select 1 from cash_causali
        where id = p_causale and active and not di_sistema
          and kind = (case when v_m.importo < 0 then 'uscita' else 'entrata' end)) then
    raise exception 'Scegli una causale di %: fra le tue, attiva.',
      case when v_m.importo < 0 then 'uscita' else 'entrata' end;
  end if;
  if nullif(btrim(coalesce(p_tipo_documento, '')), '') is null then
    raise exception 'Di'' se c''e'' un documento per questo movimento.';
  end if;
  select entity_id into v_entita from conti_bancari where id = v_m.conto_id;

  insert into cash_movements (
    entity_id, direction, amount, movement_date, mezzo, conto_id, causale_id,
    tipo_documento, business_purpose, riferimento_pagamento)
  values (
    v_entita,
    (case when v_m.importo < 0 then 'uscita' else 'entrata' end)::cash_direction,
    abs(v_m.importo), v_m.data_contabile, 'banca', v_m.conto_id, p_causale,
    p_tipo_documento::cash_document_type,
    coalesce(nullif(btrim(coalesce(p_descrizione, '')), ''), v_m.descrizione),
    v_m.riferimento_banca)
  returning id into v_cm;

  update movimenti_banca set cash_movement_id = v_cm where id = v_m.id;
  return jsonb_build_object('cash_movement_id', v_cm);
end $fn$;

create or replace function ignora_movimento_banca(p_movimento uuid, p_perche text)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare v_m movimenti_banca%rowtype;
begin
  -- Il portiere, scritto qui e non solo dentro l'aiuto comune.
  if not is_titolare() then
    raise exception 'Abbinare i movimenti della banca e'' riservato al titolare.';
  end if;
  v_m := movimento_banca_da_abbinare(p_movimento);
  if nullif(btrim(coalesce(p_perche, '')), '') is null then
    raise exception 'Per ignorare un movimento della banca serve scrivere il perche''.';
  end if;
  update movimenti_banca set ignorato_il = now(), ignorato_perche = btrim(p_perche) where id = v_m.id;
end $fn$;

do $verifica$
declare v_senza text;
begin
  select string_agg(p.proname, ', ' order by p.proname) into v_senza
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in ('paga_fattura_da_movimento_banca', 'abbina_movimento_banca',
                      'registra_movimento_banca', 'ignora_movimento_banca')
    and position('if not is_titolare() then' in pg_get_functiondef(p.oid)) = 0;
  if v_senza is not null then
    raise exception 'VERIFICA: senza portiere nel proprio corpo: %', v_senza;
  end if;
  if (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public'
         and p.proname in ('paga_fattura_da_movimento_banca', 'abbina_movimento_banca',
                           'registra_movimento_banca', 'ignora_movimento_banca')
         and has_function_privilege('anon', p.oid, 'execute')) > 0 then
    raise exception 'VERIFICA: un gesto dei movimenti della banca e'' eseguibile con la chiave pubblica.';
  end if;
  raise notice 'Fatto: i quattro gesti dei movimenti della banca chiedono da se'' chi sei.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20261024000003', 'il_portiere_dei_movimenti_della_banca')
on conflict (version) do nothing;
