-- SU UN CONTO CHIUSO O ANNULLATO NON SI SCRIVONO RIGHE — 22/08/2026.
--
-- 🔴 IL DIFETTO, misurato ieri con due sessioni sullo stesso database e
-- riprodotto oggi: due tablet, uno annulla il tavolo, l'altro continua a
-- servire. Il secondo **segna un piatto e la riga viene scritta**, su un
-- conto che per il gestionale non esiste più. Nessun errore, niente.
--
-- ⚠️ E LA MISURA HA CORRETTO IL REFERTO DI IERI, che vale la pena dire: il
-- referto diceva anche *«premo Invia e non succede niente, nessun errore»*.
-- **Non era esatto.** L'invio è già rifiutato dal trigger del 16/08, con un
-- messaggio suo; ieri non l'avevo trovato perché cercavo a schermo le parole
-- «annullato / errore / violato», e quel messaggio dice «già chiuso».
-- *Una ricerca che non trova non è una prova che non ci sia.*
--
-- Quindi restano due cose vere da fare, e sono queste:
--
--   1. `trg_riga_servita` copre **update e delete**, non **insert**. È il
--      buco: la riga entra.
--   2. Il messaggio dice «questo conto è già chiuso» anche quando il conto è
--      **annullato**, che è un'altra cosa. Chi serve deve capire **perché**,
--      non solo che non funziona: *«questo tavolo è stato annullato»* è
--      l'informazione che gli serve per sapere cosa fare — riaprirlo.

-- ---------------------------------------------------------------------
-- 1. Il vincolo che mancava: niente righe nuove su un conto non aperto
-- ---------------------------------------------------------------------
create or replace function vieta_riga_su_conto_non_aperto()
returns trigger
language plpgsql
security definer
set search_path = public
as $trigger$
declare
  v_stato   order_status;
  v_tavolo  text;
begin
  select status, table_label into v_stato, v_tavolo
    from orders where id = new.order_id;

  -- Il conto non esiste (o sta sparendo): non è affare di questo trigger.
  -- La chiave esterna dice già la sua.
  if not found then
    return new;
  end if;

  if v_stato = 'aperto' then
    return new;
  end if;

  -- ⚠️ DUE MESSAGGI, NON UNO, ed è il punto del blocco. «Chiuso» e
  -- «annullato» sono due fatti diversi e portano a due gesti diversi: da un
  -- conto chiuso si riapre un tavolo nuovo, da uno annullato si ricomincia.
  -- Un messaggio solo direbbe a chi serve che «non si può», e lo lascerebbe
  -- lì a premere di nuovo.
  if v_stato = 'annullato' then
    raise exception
      'Il tavolo % e'' stato annullato da un''altra postazione: quello che segni adesso andrebbe perso. Riapri il tavolo e riprendi la comanda.',
      coalesce(v_tavolo, 'di questo conto');
  end if;

  raise exception
    'Il conto del tavolo % e'' gia'' chiuso: non si aggiungono piatti a un conto su cui hai gia'' incassato. Apri un conto nuovo.',
    coalesce(v_tavolo, 'di questo conto');
end;
$trigger$;

revoke all on function vieta_riga_su_conto_non_aperto() from public, anon, authenticated;

drop trigger if exists trg_riga_su_conto_non_aperto on order_items;
create trigger trg_riga_su_conto_non_aperto
  before insert on order_items
  for each row execute function vieta_riga_su_conto_non_aperto();

-- ---------------------------------------------------------------------
-- 2. E anche il rifiuto dell'INVIO impara a dire «annullato»
--
-- ⚠️ Si tocca solo il messaggio, non la regola: quel trigger difende bene, e
-- il difetto era che diceva la cosa sbagliata. Un conto annullato non è
-- «già chiuso» — e chi legge deve poter capire in che situazione si trova.
-- ---------------------------------------------------------------------
create or replace function vieta_modifica_riga_servita()
returns trigger
language plpgsql
security definer
set search_path = public
as $trigger$
declare
  v_stato   order_status;
  v_riga    order_items%rowtype;
  v_nome    text;
  v_come    text;
begin
  v_riga := case when tg_op = 'DELETE' then old else new end;

  -- Se il conto stesso sta sparendo, le sue righe se ne vanno con lui.
  select status into v_stato from orders where id = v_riga.order_id;
  if not found then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  v_nome := coalesce(
    (select r.name from recipes r where r.id = old.recipe_id),
    nullif(trim(old.free_text_name), ''),
    'questa riga');

  if v_stato is distinct from 'aperto' then
    -- ⚠️ LA SOLA NOVITÀ DEL 22/08: la parola giusta per lo stato giusto.
    v_come := case when v_stato = 'annullato'
                   then 'e'' stato annullato da un''altra postazione'
                   else 'e'' gia'' chiuso' end;

    if tg_op = 'DELETE' then
      raise exception
        'Questo conto %: «%» non si puo'' togliere. Il totale su cui hai incassato non deve cambiare dopo.', v_come, v_nome;
    end if;
    if new.quantity is distinct from old.quantity
       or new.unit_price is distinct from old.unit_price
       or new.recipe_id is distinct from old.recipe_id
       or new.free_text_name is distinct from old.free_text_name
       or new.voided_at is distinct from old.voided_at
       or new.sent_at is distinct from old.sent_at then
      raise exception
        'Questo conto %: «%» non si puo'' piu'' mandare in cucina. Se il tavolo e'' ancora li'', riaprilo e riprendi la comanda.', v_come, v_nome;
    end if;
    -- Restano ammessi la nota e «ticket stampato»: non spostano un euro.
    return new;
  end if;

  -- Conto aperto, riga MAI INVIATA: si fa tutto.
  if old.sent_at is null then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  -- Conto aperto, riga GIA' INVIATA.
  if tg_op = 'DELETE' then
    raise exception
      '«%» e'' gia'' andata in cucina: non si cancella, si storna — cosi'' resta scritto che era stata ordinata e poi tolta.', v_nome;
  end if;

  if new.quantity is distinct from old.quantity
     or new.unit_price is distinct from old.unit_price
     or new.recipe_id is distinct from old.recipe_id
     or new.free_text_name is distinct from old.free_text_name then
    raise exception
      '«%» e'' gia'' andata in cucina: si storna e si riordina, non si corregge.', v_nome;
  end if;

  return new;
end;
$trigger$;

revoke all on function vieta_modifica_riga_servita() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- VERIFICA
-- ---------------------------------------------------------------------
do $$
declare
  v_ente    uuid;
  v_tavolo  uuid;
  v_conto   uuid;
  v_riga    uuid;
  v_ricetta uuid;
  v_msg     text;
begin
  select id into v_ente from entities limit 1;
  select id into v_tavolo from dining_tables where tipo = 'tavolo' and active limit 1;
  select id into v_ricetta from recipes limit 1;

  insert into orders (entity_id, table_label, status, coperti, coperto_unit_price)
  values (v_ente, 'VERIFICA righe', 'aperto', 2, 5) returning id into v_conto;

  -- 1. CON IL CONTO APERTO SI SCRIVE. ⚠️ È la prova all'incontrario, e
  --    senza di lei le due dopo non misurano niente: un trigger che
  --    rifiutasse SEMPRE le passerebbe entrambe.
  insert into order_items (order_id, recipe_id, destination, quantity, unit_price, turno)
  values (v_conto, v_ricetta, 'cucina', 1, 10, 1) returning id into v_riga;
  if v_riga is null then
    raise exception 'Con il conto aperto la riga non e'' entrata: il trigger rifiuta troppo.';
  end if;

  -- 2. CONTO ANNULLATO → rifiuto, e il messaggio dice ANNULLATO.
  update orders set status = 'annullato', cancel_reason = 'verifica', closed_at = now()
   where id = v_conto;
  begin
    insert into order_items (order_id, recipe_id, destination, quantity, unit_price, turno)
    values (v_conto, v_ricetta, 'cucina', 1, 10, 1);
    raise exception 'Su un conto ANNULLATO la riga e'' entrata lo stesso.';
  exception
    when sqlstate 'P0001' then
      get stacked diagnostics v_msg = message_text;
      if v_msg not like '%annullato%' then
        raise exception 'Rifiutata, ma il messaggio non dice che e'' annullato: %', v_msg;
      end if;
      if v_msg not like '%Riapri%' then
        raise exception 'Il rifiuto non dice cosa fare: %', v_msg;
      end if;
  end;

  -- 3. CONTO CHIUSO → rifiuto, e il messaggio dice CHIUSO (non «annullato»).
  update orders set status = 'chiuso', cancel_reason = null where id = v_conto;
  begin
    insert into order_items (order_id, recipe_id, destination, quantity, unit_price, turno)
    values (v_conto, v_ricetta, 'cucina', 1, 10, 1);
    raise exception 'Su un conto CHIUSO la riga e'' entrata lo stesso.';
  exception
    when sqlstate 'P0001' then
      get stacked diagnostics v_msg = message_text;
      if v_msg like '%annullato%' then
        raise exception 'Un conto chiuso viene chiamato «annullato»: %', v_msg;
      end if;
      if v_msg not like '%gia'' chiuso%' then
        raise exception 'Il rifiuto su un conto chiuso non lo dice: %', v_msg;
      end if;
  end;

  -- 4. E L'INVIO su un conto annullato lo dice con la parola giusta.
  update orders set status = 'annullato' where id = v_conto;
  begin
    update order_items set sent_at = now() where id = v_riga;
    raise exception 'L''invio su un conto annullato e'' passato.';
  exception
    when sqlstate 'P0001' then
      get stacked diagnostics v_msg = message_text;
      if v_msg not like '%annullato%' then
        raise exception 'L''invio e'' rifiutato ma non dice che il conto e'' annullato: %', v_msg;
      end if;
  end;

  -- ⚠️ PULIZIA: SI CANCELLA IL CONTO, NON LE RIGHE — e l'ordine è
  -- obbligato, non una preferenza. Provando al contrario la verifica si è
  -- fermata da sé: il trigger difende le righe di un conto non aperto, e
  -- aveva ragione. La strada giusta è quella che il trigger stesso prevede
  -- — *se il conto sta sparendo, le sue righe se ne vanno con lui* — e le
  -- righe se le porta via la cascata.
  --
  -- 🔴 È anche la conferma che la protezione morde davvero: se avessi
  -- potuto cancellarle a mano, vorrebbe dire che il vincolo non tiene.
  delete from orders where id = v_conto;
  if exists (select 1 from order_items where order_id = v_conto) then
    raise exception 'Il conto e'' sparito e le sue righe no: manca la cascata.';
  end if;

  raise notice 'Verifica passata: la riga entra su un conto aperto, e su annullato o chiuso e'' rifiutata con la parola giusta.';
end $$;

insert into applied_migrations (version, name)
values ('20260822000003', 'niente_righe_su_un_conto_chiuso') on conflict (version) do nothing;
