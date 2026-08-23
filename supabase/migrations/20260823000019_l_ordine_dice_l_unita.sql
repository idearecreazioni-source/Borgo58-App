-- =====================================================================
-- L'ORDINE DICE L'UNITA' DI MISURA
-- 23/08/2026
-- =====================================================================
-- Blocco 4 del mandato accodato del 23/08.
--
-- ---------------------------------------------------------------------
-- IL DIFETTO, e non era «manca l'unita'»: era «manca A VOLTE»
-- ---------------------------------------------------------------------
-- Il messaggio per il fornitore elencava «Agnello — 2», «Coniglio —
-- 0,339»: due chili? due pezzi? due casse? Chi legge deve indovinare, e
-- chi indovina manda la merce sbagliata.
--
-- 🔴 **L'unita' c'era gia' nel codice**, ed e' quello che rende il difetto
-- silenzioso: il testo scriveva `coalesce(' ' || unita_fattura, '')`,
-- cioe' **l'unita' del FORNITORE** — «cassa da 6 kg», «bustina». Quella
-- esiste solo se qualcuno ha gia' registrato una dicitura per quel
-- prodotto presso quel fornitore.
--
-- ⚠️ Quindi la riga era completa per i prodotti gia' comprati almeno una
-- volta da quel fornitore, e monca per tutti gli altri — che sono la
-- maggioranza finche' il locale non e' aperto. *Un difetto che si vede
-- solo su una parte delle righe si scambia per una svista di quella
-- riga.*
--
-- ---------------------------------------------------------------------
-- LA CURA: si ripiega sull'unita' del PRODOTTO
-- ---------------------------------------------------------------------
-- E i due numeri restano coerenti, che e' la parte da non sbagliare:
--
--   * **con la dicitura del fornitore** la quantita' e' gia' convertita in
--     confezioni (`ceil(serve / fattore)`), quindi accanto ci va la sua
--     unita': «2 casse da 6 kg»;
--   * **senza dicitura** la quantita' e' quella di partenza, nell'unita'
--     dell'ingrediente, e accanto ci va quella: «2 kg».
--
-- 🔴 E' lo stesso `case` che sceglie la quantita', letto dall'altra parte:
-- se l'unita' si scegliesse con una regola diversa da quella che sceglie
-- il numero, prima o poi comparirebbe **il numero delle casse con
-- l'etichetta dei chili** — un ordine sbagliato di sei volte, scritto in
-- una riga che sembra giusta.
--
-- ⚠️ Nessuna unita' viene inventata: se il prodotto non ne ha nemmeno una
-- sua (voce libera scritta a mano nella lista), la riga resta senza — ed
-- e' giusto, perche' li' non c'e' niente da dire.
--
-- 🔴 Il corpo e' stato preso VIVO dal database (`npm run funzione:viva`),
-- non dal file che l'ha creata: fra i due ci stanno tutte le migrazioni
-- che l'hanno toccata.

CREATE OR REPLACE FUNCTION public.bozza_ordine(p_supplier_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      -- 🔴 L'UNITA' CHE VA SCRITTA ACCANTO A QUEL NUMERO (23/08/2026), e la
      -- condizione e' la STESSA che sceglie il numero qui sopra: se si
      -- scegliessero con due regole diverse, prima o poi comparirebbe il
      -- numero delle confezioni con l'etichetta dei chili.
      case
        when a.fattore is not null and a.fattore > 0 and sli.quantity_needed is not null
          then a.unita_fattura
        else coalesce(a.unita_fattura, coalesce(sli.unit, i.unit)::text)
      end                                                as unita_da_scrivere,
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
             then ' — ' || quantita(righe.quantita)
                  || coalesce(' ' || righe.unita_da_scrivere, '')
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
$function$;

revoke all on function bozza_ordine(uuid) from public, anon, authenticated;
grant execute on function bozza_ordine(uuid) to authenticated;

-- =====================================================================
-- VERIFICA
-- =====================================================================
do $verifica$
declare
  v_tit    uuid;
  v_ente   uuid;
  v_forn   uuid;
  v_ing    uuid;
  v_art    uuid;
  v_riga   uuid;
  v_testo  text;
  v_lapidi int;
  v_lapidi2 int;
begin
  select count(*) into v_lapidi from deleted_records;
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  select id into v_ente from entities order by created_at limit 1;
  if v_tit is null then raise exception 'Nessun titolare: impossibile verificare.'; end if;

  insert into suppliers (entity_id, name, contact_phone) values (v_ente, 'ZZ Fornitore prova unita', '0932111222')
  returning id into v_forn;

  insert into ingredients (entity_id, name, category, unit, current_price)
  values (v_ente, 'ZZ prodotto senza dicitura', 'verdura', 'kg', 2)
  returning id into v_ing;

  insert into shopping_list_items (ingredient_id, quantity_needed, unit, source, supplier_id)
  values (v_ing, 2, 'kg', 'manuale', v_forn)
  returning id into v_riga;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);

  -- ===== 1. 🔴 IL CASO DEL DIFETTO: nessuna dicitura del fornitore.
  -- =====    Prima qui usciva «— 2» e basta.
  select (bozza_ordine(v_forn) ->> 'testo') into v_testo;

  if v_testo not like '%2 kg%' then
    raise exception 'Senza la dicitura del fornitore la riga non dice l''unita'': %', v_testo;
  end if;

  -- ===== 2. E CON la dicitura, l'unita' e' quella del fornitore e il
  -- =====    numero sono le confezioni: i due devono restare d'accordo.
  insert into articoli_fornitore (supplier_id, ingredient_id, descrizione,
                                  unita_fattura, fattore, chiave)
  values (v_forn, v_ing, 'Cassa mista', 'casse da 6 kg', 6,
          'zz-prova-unita-' || v_forn::text)
  returning id into v_art;

  -- Servono 2 kg e la cassa e' da 6: si chiede UNA cassa.
  select (bozza_ordine(v_forn) ->> 'testo') into v_testo;

  if v_testo not like '%1 casse da 6 kg%' then
    raise exception 'Con la dicitura del fornitore la riga non dice le sue confezioni: %', v_testo;
  end if;

  -- 🔴 E NON deve dire «kg» accanto a un numero di casse: sarebbe un
  -- ordine sbagliato di sei volte, scritto in una riga che sembra giusta.
  if v_testo like '%1 kg%' then
    raise exception 'La riga scrive il numero delle confezioni con l''unita'' del prodotto: %', v_testo;
  end if;

  perform set_config('request.jwt.claims', null, true);

  -- ===== pulizia
  delete from shopping_list_items where id = v_riga;
  delete from articoli_fornitore where id = v_art;
  delete from ingredients where id = v_ing;
  delete from suppliers where id = v_forn;

  select count(*) into v_lapidi2 from deleted_records;
  if v_lapidi2 <> v_lapidi then
    raise exception 'La verifica ha lasciato % lapidi nel registro.', v_lapidi2 - v_lapidi;
  end if;

  raise notice 'Verifica passata: l''ordine dice l''unita'' in tutti e due i casi, e non le scambia.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260823000019', 'l_ordine_dice_l_unita') on conflict (version) do nothing;
