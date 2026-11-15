-- =====================================================================
-- MEMO LEGGE TUTTO: RITOCCHI DALLA REVISIONE — 15/11/2026
-- =====================================================================
--
-- La 20261115000010 è già applicata e non si riscrive. La revisione ha chiesto:
--   1. le prenotazioni non mostrano più telefono, email e note al modello
--      (le note contengono spesso allergie: dato sulla salute); resta solo
--      un «ha_note». La ricerca per telefono o email resta;
--   2. le prenotazioni future vengono per prime (prima le più vecchie, e
--      con centinaia di righe il modello non vedeva nulla di futuro);
--   3. il totale delle fatture ai clienti esclude bozze e scartate;
--   4. il costo dei piatti non ha un totale: sommare piatti diversi non
--      ha senso, quindi il totale è sempre zero.
--
-- Le tre funzioni cambiano solo in questi punti rispetto alla 000010.
--
-- rete-guardie: memo_leggi_prenotazioni — telefono, email e note si tolgono apposta: sono dati personali e sulla salute (allergie) che a MEMO non servono; resta «ha_note»
--
-- Idempotente, con verifica finale annullata (zero residui).
-- =====================================================================

create or replace function memo_leggi_prenotazioni(p_cerca text default null)
returns table (riga_id uuid, etichetta text, dati jsonb, conteggio integer, totale numeric)
language plpgsql stable security definer set search_path = public as $fn$
begin
  if not is_titolare() then raise exception 'La chat di MEMO e'' riservata al titolare.'; end if;
  return query
  with righe as (
    select r.id, coalesce(nullif(r.customer_name, ''), 'Prenotazione') as titolo, r.reservation_date as ord1, r.reservation_time as ord2,
           jsonb_build_object(
             'data_prenotazione', r.reservation_date, 'ora_prenotazione', r.reservation_time,
             'persone', r.party_size, 'stato', r.status, 'tipo', r.type,
             'ha_note', nullif(btrim(coalesce(r.notes, '')), '') is not null,
             'tavoli', coalesce((select jsonb_agg(pt.etichetta_al_momento order by pt.etichetta_al_momento)
                                  from prenotazione_tavoli pt where pt.reservation_id = r.id), '[]'::jsonb)
           ) as dettaglio
      from reservations r
     where p_cerca is null
        or coalesce(r.customer_name, '') ilike '%' || p_cerca || '%'
        or coalesce(r.customer_phone, '') ilike '%' || p_cerca || '%'
        or coalesce(r.customer_email, '') ilike '%' || p_cerca || '%'
  ) select id, titolo, dettaglio, count(*) over ()::integer, count(*) over ()::numeric from righe
   order by (ord1 >= (now() at time zone 'Europe/Rome')::date) desc,
            case when ord1 >= (now() at time zone 'Europe/Rome')::date then ord1 end asc,
            case when ord1 >= (now() at time zone 'Europe/Rome')::date then ord2 end asc,
            ord1 desc, ord2 desc, id limit 50;
end $fn$;

create or replace function memo_leggi_fatture_clienti(p_cerca text default null)
returns table (riga_id uuid, etichetta text, dati jsonb, conteggio integer, totale numeric)
language plpgsql stable security definer set search_path = public as $fn$
begin
  if not is_titolare() then raise exception 'La chat di MEMO e'' riservata al titolare.'; end if;
  return query
  with righe as (
    select f.id,
           coalesce(nullif(c.denominazione, ''), nullif(trim(concat_ws(' ', c.nome, c.cognome)), ''), 'Cliente')
             || coalesce(' · fattura ' || f.numero::text, ' · bozza') as titolo,
           f.totale as tot_fattura, f.stato as st, f.data as ord1, f.numero as ord2,
           jsonb_build_object('cliente', coalesce(nullif(c.denominazione, ''), nullif(trim(concat_ws(' ', c.nome, c.cognome)), '')),
             'numero', f.numero, 'stato', f.stato, 'imponibile', f.imponibile,
             'imposta', f.imposta, 'totale', f.totale, 'data_fattura', f.data,
             'emessa_il', f.emessa_il, 'inviata_il', f.inviata_il,
             'esito_il', f.esito_il, 'esito', f.esito_note, 'modalita_pagamento', f.modalita_pagamento) as dettaglio
      from fatture_emesse f
      join clienti_fattura c on c.id = f.cliente_id
     where p_cerca is null
        or coalesce(c.denominazione, '') ilike '%' || p_cerca || '%'
        or concat_ws(' ', c.nome, c.cognome) ilike '%' || p_cerca || '%'
        or coalesce(f.numero::text, '') ilike '%' || p_cerca || '%'
  ) select id, titolo, dettaglio, count(*) over ()::integer, coalesce(sum(tot_fattura) filter (where st not in ('bozza', 'scartata')) over (), 0) from righe
   order by ord1 desc, ord2 desc nulls first, id limit 50;
end $fn$;

create or replace function memo_leggi_costo_piatti(p_cerca text default null)
returns table (riga_id uuid, etichetta text, dati jsonb, conteggio integer, totale numeric)
language plpgsql stable security definer set search_path = public as $fn$
begin
  if not is_titolare() then raise exception 'La chat di MEMO e'' riservata al titolare.'; end if;
  return query
  with righe as (
    select r.id, r.name, c.food_cost_portion,
           jsonb_build_object('tipo', r.recipe_type, 'categoria', r.category,
             'porzioni', c.portions_yield, 'costo_ricetta', c.food_cost_base,
             'costo_porzione', c.food_cost_portion, 'in_carta', r.in_carta,
             'pronta_per_carta', r.pronta_per_carta, 'ritirata_il', r.ritirata_il) as dettaglio
      from recipes r
      join v_recipe_costs c on c.recipe_id = r.id
     where p_cerca is null or r.name ilike '%' || p_cerca || '%'
  ) select id, name, dettaglio, count(*) over ()::integer, 0::numeric from righe
   order by name, id limit 50;
end $fn$;

revoke all on function memo_leggi_prenotazioni(text), memo_leggi_fatture_clienti(text), memo_leggi_costo_piatti(text) from public, anon, authenticated;
grant execute on function memo_leggi_prenotazioni(text), memo_leggi_fatture_clienti(text), memo_leggi_costo_piatti(text) to authenticated;

do $verifica$
declare
  v_foto jsonb := foto_righe(); v_titolare uuid; v_n integer; v_tot numeric; v_def text;
begin
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  if v_titolare is null then raise exception 'VERIFICA: serve un titolare.'; end if;
  v_def := pg_get_functiondef('public.memo_leggi_prenotazioni(text)'::regprocedure);
  if v_def like '%''telefono''%' or v_def like '%''email''%' or v_def not like '%ha_note%' then
    raise exception 'VERIFICA: le prenotazioni mostrano ancora i dati personali.';
  end if;
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);
    set local role authenticated;
    perform * from memo_leggi_prenotazioni(null);
    perform * from memo_leggi_fatture_clienti(null);
    select count(*), coalesce(max(totale), 0) into v_n, v_tot from memo_leggi_costo_piatti(null);
    if v_tot <> 0 then raise exception 'VERIFICA: il costo dei piatti ha un totale.'; end if;
    raise exception 'ZZ_ANNULLA';
  exception when others then reset role; if sqlerrm <> 'ZZ_ANNULLA' then raise; end if; end;
  perform set_config('request.jwt.claims', null, true);
  perform pretendi_nessun_residuo(v_foto, 'la verifica dei ritocchi di MEMO legge tutto');
  raise notice 'Fatto: prenotazioni senza dati personali e con le future per prime, fatture senza bozze nel totale, costo piatti senza totale. Provato e annullato: zero residui.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20261115000011', 'memo_legge_tutto_ritocchi') on conflict (version) do nothing;
