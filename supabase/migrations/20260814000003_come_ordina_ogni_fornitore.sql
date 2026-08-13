-- =====================================================================
-- Come si ordina a questo fornitore: lo dice lui, una volta
-- =====================================================================
-- Chiesto da Alessio il 14/08/2026, mezz'ora dopo aver mandato il primo
-- ordine vero su WhatsApp: *«nel caso in cui un fornitore preferisse una
-- mail possiamo inserire una scelta?»*.
--
-- **Due decisioni sue**, poste in termini di conseguenze e non di
-- implementazione:
--
-- 1. **La mail si apre nella sua posta col messaggio pronto**, non parte
--    dal gestionale. E' la stessa forma di WhatsApp: il gestionale
--    scrive, lui preme invio. Cosi' una copia resta nella sua posta
--    inviata e la risposta del fornitore arriva in casella — mentre un
--    invio automatico da `prenotazioni@borgo58.it` sarebbe un ordine che
--    nessuno ha riletto, invisibile finche' non manca la merce.
--    *(La macchina per inviare davvero esiste gia' — Resend, dall'11/08.
--    Non e' un limite tecnico: e' una scelta.)*
-- 2. **Il canale si scrive UNA VOLTA sulla scheda del fornitore**, non si
--    sceglie a ogni ordine. La domanda «come preferisce essere
--    contattato» ha sempre la stessa risposta per lo stesso fornitore:
--    chiederla ogni volta e' un clic che non aggiunge informazione.
--
-- ⚠️ **Non deciderlo da soli quando ci sono tutti e due i recapiti**. La
--    terza strada possibile era «se ha il numero usa WhatsApp, se ha solo
--    la mail usa la mail»: zero da compilare, ma con entrambi i recapiti
--    sceglierebbe il gestionale, e sceglierebbe male senza dirlo. Il
--    campo resta **vuoto finche' non lo compila**, e finche' e' vuoto la
--    schermata offre le strade che i recapiti permettono, senza
--    preferirne una.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Il campo
-- ---------------------------------------------------------------------
alter table suppliers
  add column if not exists canale_ordine text;

alter table suppliers drop constraint if exists canale_ordine_valido;
alter table suppliers add constraint canale_ordine_valido
  check (canale_ordine is null or canale_ordine in ('whatsapp', 'email', 'telefono'));

comment on column suppliers.canale_ordine is
  'Come questo fornitore preferisce ricevere gli ordini. Vuoto = non l''ha ancora detto, e la schermata non sceglie al posto suo. «telefono» vuol dire che il messaggio serve solo a leggerlo mentre gli si parla.';

-- ---------------------------------------------------------------------
-- 2. La bozza dice anche dove mandarlo
-- ---------------------------------------------------------------------
create or replace function bozza_ordine(p_supplier_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $funzione$
declare
  v_forn      suppliers%rowtype;
  v_righe     jsonb;
  v_testo     text;
  v_telefono  text;
begin
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' preparare un ordine';
  end if;

  select * into v_forn from suppliers where id = p_supplier_id;
  if v_forn.id is null then
    raise exception 'Fornitore non trovato';
  end if;

  -- Il numero per WhatsApp: si tolgono spazi e simboli e si scarta lo 00
  -- internazionale. Se non c'e' gia' il prefisso, si mette 39.
  --
  -- ⚠️ **Lo zero iniziale NON si toglie.** In quasi tutto il mondo il
  --    prefisso urbano perde lo zero passando al formato internazionale;
  --    **in Italia no**: +39 0932 123456 e' la forma giusta, e togliere
  --    quello zero manderebbe l'ordine a un numero diverso da quello
  --    scritto in rubrica. Un errore che non si vede: il messaggio parte
  --    lo stesso, e arriva a uno sconosciuto.
  --
  -- ⚠️ Un numero gia' internazionale si riconosce da 39 **e** dalla
  --    lunghezza: un cellulare come 391 234 5678 comincia per 39 senza
  --    essere prefissato, e trattarlo come tale lo storpierebbe.
  --
  -- Comunque vada, il numero completo torna indietro e la schermata lo
  -- MOSTRA accanto al pulsante: e' Alessio a vedere dove sta per
  -- scrivere, non il gestionale a indovinare per lui.
  v_telefono := regexp_replace(coalesce(v_forn.contact_phone, ''), '[^0-9]', '', 'g');
  if v_telefono like '00%' then v_telefono := substring(v_telefono from 3); end if;
  if v_telefono <> '' and not (v_telefono like '39%' and length(v_telefono) >= 12) then
    v_telefono := '39' || v_telefono;
  end if;
  v_telefono := nullif(v_telefono, '');

  with righe as (
    select
      sli.id                                             as riga_lista_id,
      sli.ingredient_id,
      a.id                                               as articolo_id,
      -- Se non so come lo chiama lui, uso il nome interno E LO DICO.
      coalesce(a.descrizione, i.name, sli.custom_name)   as descrizione,
      (a.id is not null)                                 as dicitura_sua,
      a.unita_fattura,
      a.fattore,
      sli.quantity_needed                                as quantita_base,
      coalesce(sli.unit, i.unit)::text                   as unita_base,
      -- Quante confezioni chiedere: per eccesso, perche' nessuno vende
      -- due terzi di cassa e mancare merce costa piu' che avanzarne.
      case
        when a.fattore is not null and a.fattore > 0 and sli.quantity_needed is not null
          then ceil(sli.quantity_needed / a.fattore)
        else sli.quantity_needed
      end                                                as quantita,
      ultimo.price                                       as prezzo_atteso
    from shopping_list_items sli
    left join ingredients i on i.id = sli.ingredient_id
    -- Fra le diciture di quel fornitore per quell'ingrediente si prende
    -- quella comprata piu' di recente: e' quella che lui riconosce.
    left join lateral (
      select af.*
        from articoli_fornitore af
        left join lateral (
          select max(ph.recorded_at) as quando
            from price_history ph where ph.articolo_id = af.id
        ) u on true
       where af.supplier_id = p_supplier_id
         and af.ingredient_id = sli.ingredient_id
         and not af.ignora
       order by u.quando desc nulls last, af.creato_il desc
       limit 1
    ) a on true
    left join lateral (
      select ph.price
        from price_history ph
       where ph.articolo_id = a.id
       order by ph.recorded_at desc
       limit 1
    ) ultimo on true
    where sli.supplier_id = p_supplier_id
      and sli.status = 'da_comprare'
    order by coalesce(a.descrizione, i.name, sli.custom_name)
  )
  select
    coalesce(jsonb_agg(to_jsonb(righe)), '[]'::jsonb),
    string_agg(
      '• ' || righe.descrizione
        || case when righe.quantita is not null
             then ' — ' || trim(trailing '.' from trim(trailing '0' from to_char(righe.quantita, 'FM999999990.999')))
                  || coalesce(' ' || righe.unita_fattura, '')
             else '' end,
      E'\n' order by righe.descrizione)
  into v_righe, v_testo
  from righe;

  if v_testo is null then
    return jsonb_build_object(
      'fornitore', v_forn.name,
      'supplier_id', v_forn.id,
      'telefono', v_telefono,
      'telefono_scritto', v_forn.contact_phone,
      'email', v_forn.contact_email,
      'canale', v_forn.canale_ordine,
      'oggetto', null,
      'righe', '[]'::jsonb,
      'testo', null);
  end if;

  v_testo :=
    'Buongiorno, ordine per Borgo 58 — '
    || to_char((now() at time zone 'Europe/Rome')::date, 'DD/MM/YYYY')
    || E'\n\n' || v_testo || E'\n\nGrazie!';

  return jsonb_build_object(
    'fornitore', v_forn.name,
    'supplier_id', v_forn.id,
    'telefono', v_telefono,
    'telefono_scritto', v_forn.contact_phone,
    'email', v_forn.contact_email,
    -- Il canale lo ha scritto lui sulla scheda. Vuoto vuol dire «non
    -- l'ha detto»: la schermata offre le strade che i recapiti
    -- permettono, senza preferirne una.
    'canale', v_forn.canale_ordine,
    -- L'oggetto della mail: chi riceve venti ordini al giorno lo legge
    -- prima del corpo, e «Borgo 58» dev'esserci dentro.
    'oggetto', 'Ordine Borgo 58 — '
               || to_char((now() at time zone 'Europe/Rome')::date, 'DD/MM/YYYY'),
    'righe', v_righe,
    'testo', v_testo);
end;
$funzione$;

revoke all on function bozza_ordine(uuid) from public, anon, authenticated;
grant execute on function bozza_ordine(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 3. Verifica (§7 punti 1-3)
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_ente     uuid;
  v_titolare uuid;
  v_forn     uuid;
  v_ing      uuid;
  v_riga     uuid;
  v_bozza    jsonb;
  respinto   boolean;
  n          integer;
begin
  select id into v_ente from entities order by created_at limit 1;
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  if v_ente is null or v_titolare is null then
    raise exception 'Servono un''entita'' e un titolare per questa verifica.';
  end if;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

  insert into suppliers (entity_id, name, category, contact_phone, contact_email)
  values (v_ente, 'PROVA CANALE fornitore', 'ortofrutta', '333 1112223', 'ordini@esempio.it')
  returning id into v_forn;

  insert into ingredients (entity_id, name, category, unit)
  values (v_ente, 'PROVA CANALE semola', 'farine_cereali', 'kg') returning id into v_ing;

  v_riga := add_shopping_list_item(v_ing, null, v_forn, 3, 'kg'::unit_type, null);

  -- 1. Senza canale scritto: il campo torna VUOTO, non un valore
  --    indovinato. E' la differenza fra «non l'ha detto» e «ha detto
  --    WhatsApp», e la schermata deve poterle distinguere.
  v_bozza := bozza_ordine(v_forn);
  if v_bozza->>'canale' is not null then
    raise exception 'Il canale e'' stato indovinato invece di restare vuoto: «%».', v_bozza->>'canale';
  end if;
  if v_bozza->>'email' <> 'ordini@esempio.it' then
    raise exception 'La bozza non porta l''indirizzo del fornitore.';
  end if;
  if v_bozza->>'oggetto' not like 'Ordine Borgo 58%' then
    raise exception 'L''oggetto della mail non nomina il locale: «%».', v_bozza->>'oggetto';
  end if;
  -- Il numero continua a funzionare come prima (nessuna regressione).
  if v_bozza->>'telefono' <> '393331112223' then
    raise exception 'Il numero per WhatsApp e'' cambiato: «%».', v_bozza->>'telefono';
  end if;

  -- 2. Scritto una volta, torna sempre.
  update suppliers set canale_ordine = 'email' where id = v_forn;
  v_bozza := bozza_ordine(v_forn);
  if v_bozza->>'canale' <> 'email' then
    raise exception 'Il canale scritto sulla scheda non arriva alla bozza.';
  end if;

  -- 3. Un canale inventato non entra.
  respinto := false;
  begin
    update suppliers set canale_ordine = 'piccione' where id = v_forn;
  exception when sqlstate '23514' then respinto := true;
  end;
  if not respinto then raise exception 'Un canale inventato e'' stato accettato.'; end if;

  -- 4. E le righe non sono cambiate: questa migrazione tocca il recapito,
  --    non l'ordine.
  select jsonb_array_length(v_bozza->'righe') into n;
  if n <> 1 then raise exception 'La bozza ha perso le righe (ne ha %).', n; end if;

  perform set_config('request.jwt.claims', null, true);

  -- ---- Pulizia (§5 punto 8) ----------------------------------------
  delete from shopping_list_items where ingredient_id = v_ing;
  delete from price_history where ingredient_id = v_ing;
  delete from ingredients where id = v_ing;
  delete from suppliers where id = v_forn;

  select count(*) into n from suppliers where name like 'PROVA CANALE%';
  if n <> 0 then raise exception 'La prova ha lasciato % fornitori.', n; end if;

  raise notice 'Come ordina ogni fornitore: lo dice lui una volta, e finche'' non lo dice il gestionale non sceglie.';
end
$verifica$;

insert into applied_migrations (version, name)
values ('20260814000003', 'come_ordina_ogni_fornitore')
on conflict (version) do nothing;

select canale_ordine, count(*) from suppliers group by canale_ordine;
