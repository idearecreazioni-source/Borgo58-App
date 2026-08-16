-- ---------------------------------------------------------------------
-- La prova rimette il detergente
-- ---------------------------------------------------------------------
-- 🔴 DIFETTO MIO, IN PRODUZIONE, SU DATI VERI. Trovato leggendo la
-- giacenza col connettore dopo aver applicato `20260816000003`, invece di
-- fidarmi del «residui: zero» che la verifica di quella migrazione
-- dichiarava in perfetta buona fede.
--
-- COSA E' SUCCESSO. La verifica del vitto del personale doveva provare che
-- uno scarico a mano registra finalmente il costo. Per farlo:
--   1. sceglieva **un ingrediente qualunque** gia' esistente
--      (`select id from ingredients ... limit 1`);
--   2. gli aggiungeva un lotto di prova da 10 a 3,00;
--   3. scaricava 2 unita' col metodo FEFO;
--   4. cancellava lo scarico e **il lotto di prova**.
--
-- ⚠️ IL PASSO 3 NON HA PRESO DAL LOTTO DI PROVA. FEFO ordina per scadenza
-- e, a parita' di scadenza, per data di ricevimento: il lotto vero del
-- «Detergente sgrassante» (ricevuto il 12/08, senza scadenza) viene
-- **prima** di quello di prova (ricevuto oggi, senza scadenza). Quindi le
-- 2 unita' sono uscite dalla merce vera di Alessio, e la pulizia ha
-- cancellato il lotto di prova — ancora intero — lasciando la giacenza
-- vera corta di 2 **senza nessuno scarico che lo spieghi**.
--
-- ⚠️ E' ESATTAMENTE LA LEZIONE DEL 14/08, la stessa che allora lascio' due
-- tavoli in mezzo ai divani: *una verifica che MODIFICA dati esistenti non
-- si ripulisce cancellando, si ripulisce RIMETTENDO*. Allora il controllo
-- finale contava le righe lasciate in giro e non i valori cambiati su
-- righe che dovevano restare; qui ha fatto lo stesso errore su una
-- colonna invece che su una riga.
--
-- ⚠️ LA REGOLA CHE NE ESCE, ed e' piu' stretta di quella del 14/08: una
-- verifica che deve provare uno scarico **non riusa un ingrediente vero**.
-- Se ne crea uno proprio, sempre — non solo quando non ce ne sono. Con un
-- ingrediente tutto suo, FEFO non ha nient'altro da cui pescare e il
-- problema non puo' presentarsi. Il perimetro di una prova deve essere
-- fatto di roba che la prova ha creato.
--
-- ⚠️ PERIMETRO STRETTO, come per i due tavoli: si rimette **solo** se la
-- giacenza e' ancora esattamente dove la verifica l'ha lasciata — stesso
-- costo unitario, stessa quantita' ricevuta, 8 rimaste, e **nessuno
-- scarico registrato su quell'ingrediente**. Se nel frattempo Alessio
-- avesse consumato o caricato qualcosa, non si tocca niente: meglio una
-- correzione che non parte che una che sovrascrive una sua scelta.
--
-- Idempotente per costruzione: rimessa la giacenza, la condizione non e'
-- piu' vera e la seconda esecuzione non fa nulla.
-- ---------------------------------------------------------------------

update stock_lots l
   set quantity_remaining = l.quantity_received
  from ingredients i
 where i.id = l.ingredient_id
   and i.name = 'Detergente sgrassante'
   and l.unit_cost = 1.28
   and l.quantity_received = 10
   and l.quantity_remaining = 8
   and l.expiry_date is null
   -- La firma che rende sicuro il perimetro: se ci fosse anche un solo
   -- scarico registrato, quelle 2 unita' avrebbero una spiegazione e non
   -- sarebbero le mie.
   and not exists (
     select 1 from stock_consumptions sc where sc.ingredient_id = i.id
   );

-- =====================================================================
-- VERIFICA
-- =====================================================================
do $verifica$
declare
  n        integer;
  v_ingr   uuid;
  v_lotto  uuid;
  v_prima  numeric;
  v_dopo   numeric;
  respinto boolean;
begin
  -- 1. Non deve restare nessun lotto nello stato che il difetto produceva.
  select count(*) into n
    from stock_lots l join ingredients i on i.id = l.ingredient_id
   where i.name = 'Detergente sgrassante'
     and l.quantity_received = 10
     and l.quantity_remaining = 8
     and not exists (select 1 from stock_consumptions sc where sc.ingredient_id = i.id);
  if n <> 0 then
    raise exception 'Il detergente risulta ancora corto di 2 unita'' senza scarico che lo spieghi.';
  end if;

  -- 2. E nessun lotto puo' avere meno merce di quella ricevuta senza che
  --    esista almeno uno scarico su quell'ingrediente. E' il controllo
  --    generale: se il difetto si fosse ripetuto su un altro ingrediente,
  --    lo troverebbe qui invece che fra sei mesi.
  select count(*) into n
    from stock_lots l
   where l.quantity_remaining < l.quantity_received
     and not exists (
       select 1 from stock_consumptions sc where sc.ingredient_id = l.ingredient_id
     );
  if n <> 0 then
    raise exception 'Ci sono % lotti con merce mancante e nessuno scarico che la spieghi.', n;
  end if;

  -- 3. ⚠️ E si prova che la regola nuova funziona: uno scarico su un
  --    ingrediente CREATO DALLA PROVA non puo' toccare merce di nessun
  --    altro, perche' FEFO non ha altro da cui pescare.
  insert into ingredients (entity_id, name, category, unit)
  select e.id, '__PROVA FEFO__', 'altro', 'kg' from entities e limit 1
  returning id into v_ingr;

  insert into stock_lots (ingredient_id, quantity_received, quantity_remaining, unit_cost, received_at)
  values (v_ingr, 5, 5, 2, now())
  returning id into v_lotto;

  select coalesce(sum(quantity_remaining), 0) into v_prima
    from stock_lots where ingredient_id <> v_ingr;

  perform set_config('request.jwt.claims',
    json_build_object('sub', (select user_id from user_roles where role = 'titolare' limit 1),
                      'role', 'authenticated')::text, true);
  perform record_stock_consumption(v_ingr, 2, 'vitto_personale', '__PROVA FEFO__');

  select coalesce(sum(quantity_remaining), 0) into v_dopo
    from stock_lots where ingredient_id <> v_ingr;
  if v_prima <> v_dopo then
    raise exception 'Uno scarico su un ingrediente di prova ha toccato la merce di un altro (% -> %).',
      v_prima, v_dopo;
  end if;
  if (select quantity_remaining from stock_lots where id = v_lotto) <> 3 then
    raise exception 'Lo scarico non ha preso dal lotto di prova.';
  end if;

  -- Pulizia: si toglie tutto quello che la prova ha creato, e nient'altro.
  delete from stock_consumptions where note = '__PROVA FEFO__';
  delete from stock_lots where ingredient_id = v_ingr;
  delete from ingredients where id = v_ingr;

  select count(*) into n from ingredients where name = '__PROVA FEFO__';
  if n <> 0 then
    raise exception 'La verifica ha lasciato l''ingrediente di prova.';
  end if;

  -- E la giacenza degli altri e' quella di prima, controllata sui VALORI
  -- e non sul numero di righe.
  select coalesce(sum(quantity_remaining), 0) into v_dopo
    from stock_lots where ingredient_id <> v_ingr;
  if v_prima <> v_dopo then
    raise exception 'La verifica ha cambiato la giacenza di qualcun altro.';
  end if;

  perform set_config('request.jwt.claims', null, true);
  raise notice 'Detergente rimesso, e provato che uno scarico su un ingrediente di prova non tocca la merce vera.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260816000004', 'la_prova_rimette_il_detergente')
on conflict (version) do nothing;

select i.name, l.quantity_received, l.quantity_remaining,
       (select count(*) from stock_consumptions sc where sc.ingredient_id = i.id) as scarichi
  from stock_lots l join ingredients i on i.id = l.ingredient_id
 where i.name = 'Detergente sgrassante';
