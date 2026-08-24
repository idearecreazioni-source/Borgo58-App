-- =====================================================================
-- I NUMERI CHE MERITANO UN'OCCHIATA — i limiti SOSPETTI
-- 24/08/2026 — terzo gruppo delle reti sui numeri assurdi
-- =====================================================================
-- 🔴 LA DISTINZIONE E' DI ALESSIO, ed e' la parte che rende usabili le
-- reti: *«Per ognuno decidi se il limite e' CERTO (allora si rifiuta il
-- dato) o SOSPETTO (allora si accetta ma si avvisa). Un'aliquota a 250 e'
-- certamente sbagliata; un food cost al 55% e' solo strano.»*
--
-- I certi sono diventati vincoli (`…008` e `…010`). Qui ci sono gli
-- strani: **si accettano e si mostrano**, come fa gia'
-- `quadratura_pagamenti()` dal 13/08 — «non sono errori certi: sono le
-- cose che meritano un'occhiata».
--
-- ---------------------------------------------------------------------
-- ⚠️ LE SOGLIE SONO TARATE SUI DATI VERI, non scelte a mente
-- ---------------------------------------------------------------------
-- Prima di scriverle ho contato quante righe ognuna avrebbe segnalato sul
-- gestionale di prova, che ha due mesi di vita a scala vera:
--
--   food cost oltre il 50%        0        prezzo ingrediente oltre 500   1
--   beverage cost oltre il 50%    0        durata oltre i tre anni        1
--   pressione oltre il 150%       0        movimento cassa oltre 10.000   1
--   ore fuori da 4..12            0        riga di ricetta oltre 5 unita' 2
--   scarto oltre il 60%           0        fattura oltre 20.000           0
--   scontrino coperto oltre 200   0        commissione POS oltre il 5%    0
--
-- **Quattro segnalazioni in tutto**, e sono quattro casi da guardare
-- davvero. Se una soglia ne producesse cinquanta, non sarebbe una rete:
-- sarebbe un guardiano che grida sempre, e quelli si imparano a spegnere
-- (lezione del freno anti-tempesta, 13/08).
--
-- ⚠️ E UNA SEGNALAZIONE NON E' UN ERRORE. Lo zafferano in pistilli a
-- 2.400 € al chilo e' il prezzo vero dello zafferano; l'aceto che dura
-- cinque anni e' l'aceto. Il setaccio dice **dove guardare**, non cosa e'
-- sbagliato — e la riga lo scrive, perche' chi la legge non concluda che
-- c'e' un difetto.
-- =====================================================================

create or replace function numeri_sospetti()
returns table (
  dove       text,
  che_cosa   text,
  valore     text,
  perche     text,
  riferimento uuid
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  -- 🔴 IL PORTIERE. `security definer` gira senza RLS, quindi il controllo
  -- va rimesso dentro (rilievo del validatore del 13/08): qui ci sono
  -- prezzi d'acquisto, importi di fatture e movimenti di cassa, che lo
  -- staff non deve vedere. E chi non deve vedere riceve un RIFIUTO, non
  -- un elenco vuoto — una schermata vuota e' una rassicurazione falsa.
  if not is_titolare() then
    raise exception 'I numeri sospetti sono riservati al titolare.';
  end if;

  return query
  -- Previsione: le percentuali strane
  select 'Previsione'::text,
         s.nome || ' — food cost',
         to_char(s.food_cost_percento * 100, 'FM990.0') || '%',
         'Sopra il 50%: possibile, ma su un piatto vuol dire che quasi meta'' del prezzo e'' materia prima.'::text,
         s.id
    from scenari_proiezione s where s.food_cost_percento > 0.5

  union all
  select 'Previsione',
         s.nome || ' — beverage cost',
         to_char(s.beverage_cost_percento * 100, 'FM990.0') || '%',
         'Sopra il 50%: sul beverage il margine e'' di solito piu'' alto che sul cibo.',
         s.id
    from scenari_proiezione s where s.beverage_cost_percento > 0.5

  union all
  select 'Previsione',
         s.nome || ' — tasse e contributi sopra il netto',
         to_char(s.pressione_personale * 100, 'FM990.0') || '%',
         'Sopra il 150%: il costo aziendale sarebbe piu'' del doppio di quello che il dipendente porta a casa.',
         s.id
    from scenari_proiezione s where s.pressione_personale > 1.5

  union all
  select 'Previsione',
         s.nome || ' — ore lavorate al giorno',
         to_char(s.ore_giorno, 'FM990.0') || ' ore',
         'Fuori dall''intervallo 4-12: possibile, ma cambia il netto orario di tutto il personale.',
         s.id
    from scenari_proiezione s where s.ore_giorno < 4 or s.ore_giorno > 12

  union all
  select 'Previsione',
         s.nome || ' — commissione POS',
         to_char(s.commissione_pos_percento * 100, 'FM990.00') || '%',
         'Sopra il 5%: e'' molto piu'' del normale per un esercizio commerciale.',
         s.id
    from scenari_proiezione s where s.commissione_pos_percento > 0.05

  union all
  select 'Previsione',
         s.nome || ' — scontrino per coperto',
         to_char(s.scontrino_food + s.scontrino_beverage, 'FM999990.00') || ' €',
         'Sopra i 200 € a persona: possibile per un menu degustazione, non per il servizio normale.',
         s.id
    from scenari_proiezione s where s.scontrino_food + s.scontrino_beverage > 200

  -- Magazzino
  union all
  select 'Magazzino',
         i.name || ' — scarto',
         to_char(i.waste_percentage_default, 'FM990.0') || '%',
         'Sopra il 60%: succede (carciofi, pesce da pulire), ma triplica il fabbisogno di quel prodotto.',
         i.id
    from ingredients i where i.active and i.waste_percentage_default > 60

  union all
  select 'Magazzino',
         i.name || ' — durata dichiarata',
         i.shelf_life_days::text || ' giorni',
         'Oltre i tre anni: giusto per aceto, sale e conserve; sospetto per tutto il resto.',
         i.id
    from ingredients i where i.active and i.shelf_life_days > 1095

  union all
  select 'Magazzino',
         i.name || ' — prezzo per ' || i.unit::text,
         to_char(i.current_price, 'FM999990.00') || ' €',
         'Sopra i 500 € per unita'': vero per zafferano e tartufo, altrimenti e'' un''unita'' di misura sbagliata.',
         i.id
    from ingredients i where i.active and i.current_price > 500

  union all
  select 'Ricettario',
         r.name || ' — una riga da ' || to_char(ri.quantity, 'FM999990.0000') || ' ' ||
           coalesce(i.unit::text, ''),
         to_char(ri.quantity, 'FM999990.0000'),
         'Oltre 5 unita'' in una riga di ricetta: possibile su acqua e farina, sospetto su tutto il resto — e'' la forma dei grammi scritti come chili.',
         ri.recipe_id
    from recipe_ingredients ri
    join recipes r on r.id = ri.recipe_id
    left join ingredients i on i.id = ri.ingredient_id
   where ri.quantity > 5

  -- Denaro
  union all
  select 'Fatture fornitori',
         s.name || ' — fattura ' || f.invoice_number,
         to_char(f.amount, 'FM999990.00') || ' €',
         'Sopra i 20.000 €: per un''osteria da 34 coperti e'' fuori scala, e una virgola persa fa esattamente questo.',
         f.id
    from supplier_invoices f join suppliers s on s.id = f.supplier_id
   where f.amount > 20000

  union all
  select 'Prima nota',
         coalesce(nullif(btrim(coalesce(m.note, '')), ''), c.label, 'movimento senza descrizione'),
         to_char(m.amount, 'FM999990.00') || ' €',
         'Movimento sopra i 10.000 €: puo'' essere un finanziamento o un versamento, ma vale la pena rileggerlo.',
         m.id
    from cash_movements m left join cash_causali c on c.id = m.causale_id
   where m.amount > 10000

  union all
  select 'Editor menu',
         coalesce(r.name, 'piatto senza ricetta') || ' — prezzo di vendita',
         to_char(mi.selling_price, 'FM999990.00') || ' €',
         'Sopra i 100 € a piatto: fuori scala per questo locale.',
         mi.id
    from menu_items mi left join recipes r on r.id = mi.recipe_id
   where mi.selling_price > 100

  order by 1, 2;
end $$;

comment on function numeri_sospetti() is
  'I numeri fuori dall''ordinario, che il gestionale accetta ma segnala. NON sono errori: sono le cose che meritano un''occhiata — lo zafferano a 2.400 €/kg e'' il prezzo vero dello zafferano. I limiti CERTI sono vincoli, e stanno nelle migrazioni 008 e 010.';

-- ⚠️ `authenticated` si conserva perche' e' col token dell'utente vero
-- che il gestionale chiama le funzioni; a decidere chi vede e' il portiere
-- dentro la funzione, non il permesso.
revoke all on function numeri_sospetti() from public, anon;
grant execute on function numeri_sospetti() to authenticated;

-- ---------------------------------------------------------------------
-- Verifica — il setaccio DISCRIMINA
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_titolare uuid;
  v_ente     uuid;
  v_ing      uuid;
  v_prima    bigint;
  v_dopo     bigint;
  v_lapidi_p bigint;
  v_lapidi_d bigint;
begin
  select count(*) into v_lapidi_p from deleted_records;

  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  if v_titolare is null then
    raise exception 'Nessun titolare in user_roles: impossibile verificare.';
  end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

  select id into v_ente from entities order by created_at limit 1;
  select count(*) into v_prima from numeri_sospetti();

  -- (a) Un ingrediente con uno scarto altissimo compare, e il gestionale
  --     lo ACCETTA — e' la differenza fra sospetto e certo.
  insert into ingredients (entity_id, name, unit, category, tenuto_in_magazzino, waste_percentage_default)
  values (v_ente, 'VERIFICA 831 carciofo', 'kg', 'altro', true, 75) returning id into v_ing;

  select count(*) into v_dopo from numeri_sospetti();
  if v_dopo <> v_prima + 1 then
    raise exception 'Uno scarto del 75%% doveva comparire fra i sospetti: prima %, dopo %.', v_prima, v_dopo;
  end if;
  if not exists (select 1 from numeri_sospetti() where riferimento = v_ing and che_cosa like '%scarto%') then
    raise exception 'La riga del sospetto non nomina lo scarto.';
  end if;

  -- (b) ⚠️ E il verso opposto: uno scarto NORMALE non deve comparire. Un
  --     setaccio che segnala tutto non e' un setaccio.
  update ingredients set waste_percentage_default = 20 where id = v_ing;
  select count(*) into v_dopo from numeri_sospetti();
  if v_dopo <> v_prima then
    raise exception 'Uno scarto del 20%% non doveva comparire: attese % righe, contate %.', v_prima, v_dopo;
  end if;

  -- (c) E il bordo: 60 esatto non compare, 60,1 si'. La soglia e' dove
  --     dice di essere.
  update ingredients set waste_percentage_default = 60 where id = v_ing;
  if exists (select 1 from numeri_sospetti() where riferimento = v_ing) then
    raise exception 'Esattamente 60%% non doveva comparire: la soglia e'' «oltre».';
  end if;
  update ingredients set waste_percentage_default = 60.1 where id = v_ing;
  if not exists (select 1 from numeri_sospetti() where riferimento = v_ing) then
    raise exception '60,1%% doveva comparire.';
  end if;

  delete from price_history where ingredient_id = v_ing;
  delete from ingredients where id = v_ing;

  if (select count(*) from numeri_sospetti()) <> v_prima then
    raise exception 'I sospetti non sono tornati a %.', v_prima;
  end if;

  -- (d) Il portiere: allo staff si rifiuta, non si risponde vuoto.
  declare
    v_staff    uuid;
    v_respinto boolean := false;
  begin
    select user_id into v_staff from user_roles where role = 'staff' limit 1;
    if v_staff is not null then
      perform set_config('request.jwt.claims',
        json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
      begin
        perform count(*) from numeri_sospetti();
      exception when others then v_respinto := true;
      end;
      perform set_config('request.jwt.claims',
        json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);
      if not v_respinto then
        raise exception 'Lo staff ha potuto leggere i numeri sospetti: dentro ci sono prezzi d''acquisto.';
      end if;
    else
      raise notice 'Nessun utente staff: il portiere non e'' stato provato.';
    end if;
  end;

  select count(*) into v_lapidi_d from deleted_records;
  if v_lapidi_d <> v_lapidi_p then
    raise exception 'Il registro delle cancellazioni e'' passato da % a %.', v_lapidi_p, v_lapidi_d;
  end if;

  raise notice 'Numeri sospetti: % segnalazioni sui dati veri, setaccio provato nei due versi, sul bordo e col portiere.', v_prima;
end $verifica$;

insert into applied_migrations (version, name)
values ('20260824000011', 'i_numeri_che_meritano_un_occhiata') on conflict (version) do nothing;
