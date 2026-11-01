-- L'ANTICIPO PAGA LA FATTURA — 01/11/2026.
--
-- Decisione di Alessio: quando una nota «Anticipo da rimborsarmi»
-- (`anticipazioni_socio`) e' collegata a una fattura fornitore, LA FATTURA
-- DIVENTA PAGATA — in elenco si legge «pagata (anticipo)» — ed esce dalle
-- scadenze e dal «da pagare». Il debito verso di lui resta dov'e': fra gli
-- anticipi da rimborsare.
--
-- 🔴 IL PUNTO DA NON PERDERE: NIENTE VA CONTATO DUE VOLTE.
--    · La CASSA e la BANCA non si muovono: la societa' non ha pagato, ha
--      pagato lui. Quindi questa operazione NON scrive nessun movimento in
--      prima nota (a differenza di `pay_supplier_invoice`). L'uscita vera
--      nascera' quando lo rimborsa (`pareggia_anticipazione`), con la
--      causale di sistema «Rimborso al titolare», che non e' un costo.
--    · Il COSTO resta quello della fattura (`rettifiche_fiscali` conta le
--      fatture per data fattura, a prescindere da come sono pagate, e
--      scarta le note collegate a una fattura). Non cambia nessuna
--      funzione fiscale: e' la ragione per cui qui non se ne tocca nessuna.
--    · Le fatture pagate "senza movimento" sono un'anomalia per
--      `quadratura_pagamenti`: qui la si insegna a riconoscere questo caso
--      (e a segnalare quello rovesciato, che e' un guasto vero).
--
-- IL MARCATORE: `supplier_invoices.payment_method = 'anticipo'`. Un valore
-- nuovo del vocabolario chiuso, scritto SOLO da questa funzione (il menu
-- «Come paghi» non lo offre: vedi `inPiuNelDatabase` in vocabolari.js).
--
-- LA SCELTA SULL'IMPORTO: la nota deve valere ESATTAMENTE quanto resta da
-- pagare della fattura (`da_pagare()`, cioe' il totale meno le note di
-- credito gia' scalate). Un anticipo parziale lascerebbe la fattura in
-- mezzo: ne' pagata ne' da pagare. Se ha anticipato meno, la nota si
-- registra senza collegare la fattura.

-- ---------------------------------------------------------------------
-- 1. Il vocabolario dei metodi di pagamento della fattura: entra «anticipo»
-- ---------------------------------------------------------------------
-- ⚠️ Il vincolo e' sulla TABELLA (vale anche per chi scrive dal browser) e
-- `pay_supplier_invoice` ha il suo elenco, che NON si allarga: pagare con
-- «anticipo» dal menu di pagamento vorrebbe dire pagare senza una nota.
alter table supplier_invoices drop constraint if exists supplier_invoices_payment_method_check;
alter table supplier_invoices add constraint supplier_invoices_payment_method_check
  check (payment_method = any (array['contante', 'bonifico', 'carta', 'assegno', 'anticipo']));

-- ---------------------------------------------------------------------
-- 2. Registrare l'anticipo, e pagare la fattura collegata, insieme
-- ---------------------------------------------------------------------
create or replace function registra_anticipazione(
  p_entity_id             uuid,
  p_importo               numeric,
  p_pagata_il             date,
  p_tag_id                uuid,
  p_fondi                 text    default 'contanti',
  p_supplier_invoice_id   uuid    default null,
  p_documento_riferimento text    default null,
  p_e_investimento        boolean default false,
  p_nota                  text    default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $funzione$
declare
  v_inv   supplier_invoices%rowtype;
  v_netto numeric;
  v_data  date;
  v_id    uuid;
begin
  if not is_titolare() then
    raise exception 'Le anticipazioni del titolare sono riservate al titolare.';
  end if;

  v_data := coalesce(p_pagata_il, (now() at time zone 'Europe/Rome')::date);

  if p_supplier_invoice_id is not null then
    -- Riga bloccata: due note sulla stessa fattura, in contemporanea, non
    -- possono passare entrambe.
    select * into v_inv from supplier_invoices where id = p_supplier_invoice_id for update;
    if v_inv.id is null then
      raise exception 'Fattura non trovata';
    end if;
    if v_inv.entity_id is distinct from p_entity_id then
      raise exception 'La fattura appartiene a un altro soggetto: la nota e la fattura devono essere della stessa societa''.';
    end if;
    if v_inv.status <> 'da_pagare' then
      raise exception 'Questa fattura risulta gia'' pagata: non si puo'' collegare a un anticipo.';
    end if;
    -- Il permesso per il trigger del §2-bis: vale solo in questa
    -- transazione e solo per QUESTA fattura.
    perform set_config('b58.anticipo_fattura', p_supplier_invoice_id::text, true);

    v_netto := da_pagare(v_inv);
    if round(p_importo, 2) is distinct from v_netto then
      raise exception
        'La fattura vale % da pagare e la nota %: per segnarla pagata con l''anticipo devono coincidere. Se hai anticipato una cifra diversa, registra la nota senza collegare la fattura.',
        euro(v_netto), euro(round(p_importo, 2));
    end if;
  end if;

  insert into anticipazioni_socio (
    entity_id, importo, pagata_il, tag_id, fondi, supplier_invoice_id,
    documento_riferimento, e_investimento, nota
  ) values (
    p_entity_id, p_importo, v_data, p_tag_id, coalesce(p_fondi, 'contanti'),
    p_supplier_invoice_id, p_documento_riferimento,
    coalesce(p_e_investimento, false), p_nota
  )
  returning id into v_id;

  if p_supplier_invoice_id is not null then
    -- `paid_at` e' un istante: mezzogiorno di Roma del giorno in cui ha
    -- anticipato, cosi' qualunque taglio per fuso cade sul giorno giusto.
    update supplier_invoices
       set status = 'pagata',
           paid_at = ((v_data + time '12:00') at time zone 'Europe/Rome'),
           payment_method = 'anticipo'
     where id = p_supplier_invoice_id;

    -- Come `pay_supplier_invoice`: il promemoria di scadenza si chiude, e
    -- un promemoria gia' sparito non e' un errore.
    if v_inv.task_id is not null then
      update tasks set status = 'completato' where id = v_inv.task_id;
    end if;
    -- ⚠️ NESSUN `insert into cash_movements`, ed e' voluto: vedi la testata.
  end if;

  return v_id;
end;
$funzione$;

comment on function registra_anticipazione(uuid, numeric, date, uuid, text, uuid, text, boolean, text) is
  'Registra «Anticipo da rimborsarmi». Se e'' collegata a una fattura da pagare, la segna pagata (payment_method = anticipo) nella stessa transazione, SENZA scrivere nessun movimento in prima nota: la societa'' non ha pagato, ha pagato il titolare. La nota deve valere quanto resta da pagare (01/11/2026).';

revoke all on function registra_anticipazione(uuid, numeric, date, uuid, text, uuid, text, boolean, text)
  from public, anon, authenticated;
grant execute on function registra_anticipazione(uuid, numeric, date, uuid, text, uuid, text, boolean, text)
  to authenticated;

-- ---------------------------------------------------------------------
-- 2-bis. Nessuna nota si collega a una fattura da pagare per un'altra strada
-- ---------------------------------------------------------------------
-- 🔴 Una nota collegata a una fattura ancora da pagare e' il buco che questa
-- migrazione chiude: la spesa sembrerebbe ancora da pagare (e pagabile dalla
-- cassa) con il debito verso il titolare gia' scritto. Solo
-- `registra_anticipazione` puo' farlo, perche' nella stessa transazione
-- segna la fattura pagata.
-- ⚠️ `insert or update` SENZA `of supplier_invoice_id` (trappola del
-- 27/08): la condizione sul cambiamento la scrive il corpo.
create or replace function guardia_anticipo_su_fattura()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if new.supplier_invoice_id is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.supplier_invoice_id is not distinct from new.supplier_invoice_id then
    return new;
  end if;
  if exists (select 1 from supplier_invoices i
              where i.id = new.supplier_invoice_id and i.status = 'da_pagare')
     and current_setting('b58.anticipo_fattura', true) is distinct from new.supplier_invoice_id::text then
    raise exception
      'Una nota non si collega a una fattura ancora da pagare scrivendo la nota da sola: la fattura resterebbe fra le scadenze, pagabile una seconda volta. Registrala da «Anticipo da rimborsarmi» scegliendo la fattura.';
  end if;
  return new;
end;
$fn$;

revoke all on function guardia_anticipo_su_fattura() from public, anon, authenticated;

drop trigger if exists trg_guardia_anticipo_su_fattura on anticipazioni_socio;
create trigger trg_guardia_anticipo_su_fattura
  before insert or update on anticipazioni_socio
  for each row execute function guardia_anticipo_su_fattura();

-- ---------------------------------------------------------------------
-- 3. Eliminare l'anticipo riapre la fattura
-- ---------------------------------------------------------------------
-- ⚠️ RIPRESA DAL CORPO VIVO sulla Prova (quello riscritto da
-- `20260817000005`: il messaggio usa `euro()`), con due aggiunte in
-- fondo: il blocco della riga fattura e la riapertura.
create or replace function delete_anticipazione(p_anticipazione_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $funzione$
declare
  a anticipazioni_socio%rowtype;
  v_importo numeric;
begin
  if not is_titolare() then
    raise exception 'Le anticipazioni del titolare sono riservate al titolare.';
  end if;

  select * into a from anticipazioni_socio where id = p_anticipazione_id for update;
  if a.id is null then
    raise exception 'Questa nota non esiste.';
  end if;

  if a.pareggiata_il is not null then
    select amount into v_importo from cash_movements where id = a.movimento_id;
    raise exception
      'Questa nota e'' gia'' stata rimborsata il %: in prima nota c''e'' un''uscita di %. Cancellandola resterebbero soldi usciti dal cassetto senza il perche''. Annulla prima il rimborso.',
      to_char(a.pareggiata_il, 'DD/MM/YYYY'),
      euro(coalesce(v_importo, a.importo));
  end if;

  -- Riga fattura bloccata prima di toccarla: un pagamento o un annullo in
  -- contemporanea non possono incrociarsi con la riapertura.
  if a.supplier_invoice_id is not null then
    perform 1 from supplier_invoices where id = a.supplier_invoice_id for update;
  end if;

  delete from anticipazioni_socio where id = p_anticipazione_id;

  -- NUOVO: se quella nota aveva pagato la fattura, la fattura torna da
  -- pagare — altrimenti resterebbe «pagata (anticipo)» senza nessun
  -- anticipo dietro. Solo se e' ancora pagata CON l'anticipo (non tocca una
  -- fattura pagata in altro modo) e solo se non resta un'altra nota
  -- collegata.
  if a.supplier_invoice_id is not null then
    update supplier_invoices i
       set status = 'da_pagare', paid_at = null, payment_method = null
     where i.id = a.supplier_invoice_id
       and i.status = 'pagata'
       and i.payment_method = 'anticipo'
       and not exists (select 1 from anticipazioni_socio x where x.supplier_invoice_id = i.id);

    if found then
      update tasks set status = 'da_fare'
       where id = (select task_id from supplier_invoices where id = a.supplier_invoice_id);
    end if;
  end if;
end;
$funzione$;

comment on function delete_anticipazione is
  'Cancella una nota «ho messo di tasca mia», ma RESPINGE se e'' gia'' stata rimborsata (16/08/2026). Se la nota aveva pagato una fattura (anticipo), la fattura torna da pagare (01/11/2026).';

revoke all on function delete_anticipazione(uuid) from public, anon, authenticated;
grant execute on function delete_anticipazione(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 4. Annullare il pagamento non riapre una fattura pagata con l'anticipo
-- ---------------------------------------------------------------------
-- 🔴 Senza questo rifiuto «Annulla il pagamento» rimetterebbe la fattura da
-- pagare con la nota ancora collegata: pagabile una seconda volta dalla
-- cassa, cioe' la stessa spesa due volte. La strada per riaprirla e'
-- eliminare la nota (§3).
-- ⚠️ RIPRESA DA `20260817000002` (ultima versione), con la sola aggiunta
-- del rifiuto.
create or replace function annulla_pagamento_fattura(p_invoice_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $funzione$
declare
  v_inv supplier_invoices%rowtype;
  v_mov uuid;
begin
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' annullare un pagamento';
  end if;

  select * into v_inv from supplier_invoices where id = p_invoice_id for update;
  if v_inv.id is null then
    raise exception 'Fattura non trovata';
  end if;
  if v_inv.status <> 'pagata' then
    raise exception 'Questa fattura non risulta pagata: non c''e'' nessun pagamento da annullare.';
  end if;
  if v_inv.payment_method = 'anticipo' then
    raise exception
      'Questa fattura risulta pagata con un anticipo tuo: non c''e'' nessuna uscita da annullare. Per riaprirla elimina la nota in «Anticipo da rimborsarmi» (se l''hai gia'' rimborsata, annulla prima il rimborso).';
  end if;

  update supplier_invoices
     set status = 'da_pagare', paid_at = null, payment_method = null
   where id = p_invoice_id;

  if v_inv.task_id is not null then
    update tasks set status = 'da_fare' where id = v_inv.task_id;
  end if;

  delete from note_credito_utilizzi u
   where u.fattura_id = p_invoice_id
     and coalesce((select n.fattura_id from note_credito n where n.id = u.nota_id), '00000000-0000-0000-0000-000000000000'::uuid)
         is distinct from p_invoice_id;

  select id into v_mov from cash_movements where supplier_invoice_id = p_invoice_id;
  if v_mov is not null then
    update cash_movements set supplier_invoice_id = null where id = v_mov;
    delete from cash_movements where id = v_mov;
  end if;

  return p_invoice_id;
end;
$funzione$;

revoke all on function annulla_pagamento_fattura(uuid) from public, anon, authenticated;
grant execute on function annulla_pagamento_fattura(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 5. La quadratura dei pagamenti conosce l'anticipo
-- ---------------------------------------------------------------------
-- ⚠️ RIPRESA DA `20260819000008` (ultima versione). Tre cose:
--   (a) una fattura pagata con l'anticipo e' SENZA movimento per costruzione:
--       non e' un'anomalia, e non si segnala;
--   (b) ma una fattura «anticipo» senza nessuna nota collegata e' un guasto
--       (e' pagata da nessuno): si segnala;
--   (c) e una fattura «anticipo» che ha anche un'uscita in prima nota e'
--       pagata due volte: si segnala.
create or replace function public.quadratura_pagamenti(p_dal date default null::date, p_al date default null::date)
 returns table(genere text, quando date, importo numeric, descrizione text, perche text)
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
begin
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' vedere la quadratura dei pagamenti';
  end if;

  return query
  select 'fattura_senza_movimento'::text,
         (v_inv.paid_at at time zone 'Europe/Rome')::date,
         v_inv.amount,
         'Fattura ' || coalesce(v_inv.invoice_number, '(senza numero)')
           || coalesce(' — ' || s.name, ''),
         'Risulta pagata, ma in prima nota non c''e'' nessuna uscita collegata.'
    from supplier_invoices v_inv
    left join suppliers s on s.id = v_inv.supplier_id
   where v_inv.status = 'pagata'
     and da_pagare(v_inv) > 0
     -- (a) pagata con un anticipo: nessuna uscita, per costruzione.
     and v_inv.payment_method is distinct from 'anticipo'
     and not exists (select 1 from cash_movements m where m.supplier_invoice_id = v_inv.id)
     and (p_dal is null or (v_inv.paid_at at time zone 'Europe/Rome')::date >= p_dal)
     and (p_al  is null or (v_inv.paid_at at time zone 'Europe/Rome')::date <= p_al)

  union all

  -- (b) «pagata con l'anticipo» ma senza la nota che la giustifica.
  select 'anticipo_senza_nota'::text,
         (v_inv.paid_at at time zone 'Europe/Rome')::date,
         v_inv.amount,
         'Fattura ' || coalesce(v_inv.invoice_number, '(senza numero)')
           || coalesce(' — ' || s.name, ''),
         'Risulta pagata con un anticipo, ma nessuna nota «Anticipo da rimborsarmi» e'' collegata.'
    from supplier_invoices v_inv
    left join suppliers s on s.id = v_inv.supplier_id
   where v_inv.status = 'pagata'
     and v_inv.payment_method = 'anticipo'
     and not exists (select 1 from anticipazioni_socio a where a.supplier_invoice_id = v_inv.id)
     and (p_dal is null or (v_inv.paid_at at time zone 'Europe/Rome')::date >= p_dal)
     and (p_al  is null or (v_inv.paid_at at time zone 'Europe/Rome')::date <= p_al)

  union all

  -- (c) pagata con l'anticipo E con un'uscita in prima nota: due volte.
  select 'anticipo_e_uscita'::text,
         m.movement_date,
         m.amount,
         'Fattura ' || coalesce(v_inv.invoice_number, '(senza numero)')
           || coalesce(' — ' || s.name, ''),
         'Risulta pagata con un anticipo e in prima nota c''e'' anche un''uscita che la paga: la spesa e'' contata due volte.'
    from supplier_invoices v_inv
    join cash_movements m on m.supplier_invoice_id = v_inv.id
    left join suppliers s on s.id = v_inv.supplier_id
   where v_inv.status = 'pagata'
     and v_inv.payment_method = 'anticipo'
     and (p_dal is null or m.movement_date >= p_dal)
     and (p_al  is null or m.movement_date <= p_al)

  union all

  select 'movimento_senza_fattura'::text,
         m.movement_date,
         m.amount,
         coalesce(nullif(m.business_purpose, ''), 'Uscita senza descrizione'),
         'Uscita con documento «fattura» che non risulta collegata a nessuna fattura registrata.'
    from cash_movements m
   where m.direction = 'uscita'
     and m.tipo_documento = 'fattura'
     and m.supplier_invoice_id is null
     and (p_dal is null or m.movement_date >= p_dal)
     and (p_al  is null or m.movement_date <= p_al)

  order by 2 desc nulls last;
end
$function$;

revoke all on function quadratura_pagamenti(date, date) from public, anon, authenticated;
grant execute on function quadratura_pagamenti(date, date) to authenticated;

-- ---------------------------------------------------------------------
-- 6. Le note gia' esistenti collegate a una fattura ancora da pagare
-- ---------------------------------------------------------------------
-- Passo unico e ripetibile: tocca SOLO le fatture ancora `da_pagare` con
-- UNA sola nota collegata che vale esattamente quanto resta da pagare (le
-- stesse condizioni della funzione nuova). Alla seconda applicazione non
-- trova piu' niente. Quelle che non soddisfano le condizioni NON si
-- toccano: restano come sono, e se ne dice il numero.
do $dati$
declare
  v_sistemate integer;
  v_restano   integer;
begin
  with da_sistemare as (
    select i.id as fattura, i.task_id, a.pagata_il
      from supplier_invoices i
      join anticipazioni_socio a on a.supplier_invoice_id = i.id
     where i.status = 'da_pagare'
       and (select count(*) from anticipazioni_socio x where x.supplier_invoice_id = i.id) = 1
       and a.entity_id = i.entity_id
       and a.importo = da_pagare(i)
  ),
  aggiornate as (
    update supplier_invoices s
       set status = 'pagata',
           paid_at = ((d.pagata_il + time '12:00') at time zone 'Europe/Rome'),
           payment_method = 'anticipo'
      from da_sistemare d
     where s.id = d.fattura
    returning s.id, s.task_id
  ),
  promemoria as (
    update tasks t set status = 'completato'
      from aggiornate g
     where t.id = g.task_id
    returning t.id
  )
  select count(*) into v_sistemate from aggiornate;

  select count(distinct i.id) into v_restano
    from supplier_invoices i
    join anticipazioni_socio a on a.supplier_invoice_id = i.id
   where i.status = 'da_pagare';

  raise notice 'Anticipi gia'' esistenti: % fatture segnate pagate (anticipo); % fatture da pagare restano collegate a una nota con importo diverso o con piu'' note (da guardare a mano).',
    v_sistemate, v_restano;
end
$dati$;

-- ---------------------------------------------------------------------
-- VERIFICA
-- ---------------------------------------------------------------------
-- Tutto dentro una sotto-transazione che viene annullata: nessuna riga
-- resta, e il controllo finale lo pretende.
do $verifica$
declare
  v_foto  jsonb := foto_righe();
  v_ente  uuid;
  v_tit   uuid;
  v_tag   uuid;
  v_forn  uuid;
  v_fatt  uuid;
  v_fatt2 uuid;
  v_fatt3 uuid;
  v_ant   uuid;
  v_n     integer;
  v_prima integer;
  v_cassa numeric;
  v_costi numeric;
  v_preso boolean;
  t       record;
begin
  select id into v_ente from entities where entity_type = 'srls';
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  -- (0) Struttura: la funzione c'e', e' chiusa a anon/public, il vincolo
  --     ammette «anticipo» e `pay_supplier_invoice` NO.
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                  where n.nspname = 'public' and p.proname = 'registra_anticipazione' and p.prosecdef
                    and p.proconfig::text like '%search_path%') then
    raise exception 'VERIFICA (0a): registra_anticipazione manca o non e'' security definer con search_path.';
  end if;
  if has_function_privilege('anon', 'registra_anticipazione(uuid,numeric,date,uuid,text,uuid,text,boolean,text)', 'execute')
     or has_function_privilege('public', 'registra_anticipazione(uuid,numeric,date,uuid,text,uuid,text,boolean,text)', 'execute') then
    raise exception 'VERIFICA (0b): registra_anticipazione e'' eseguibile da anon/public.';
  end if;
  if not has_function_privilege('authenticated', 'registra_anticipazione(uuid,numeric,date,uuid,text,uuid,text,boolean,text)', 'execute') then
    raise exception 'VERIFICA (0c): registra_anticipazione non e'' eseguibile da authenticated (il corridoio la chiama col token dell''utente).';
  end if;
  if pg_get_functiondef('pay_supplier_invoice(uuid,text,date,text,uuid[])'::regprocedure) like '%''anticipo''%' then
    raise exception 'VERIFICA (0d): pay_supplier_invoice ha imparato «anticipo»: si potrebbe pagare con l''anticipo senza nessuna nota.';
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'trg_guardia_anticipo_su_fattura'
                    and tgrelid = 'anticipazioni_socio'::regclass and not tgisinternal) then
    raise exception 'VERIFICA (0e): manca il trigger che impedisce di collegare una nota a una fattura da pagare.';
  end if;

  -- Su un database vuoto (CI, installazione nuova) le prove sui dati non
  -- hanno su cosa girare: la struttura e' gia' stata verificata qui sopra.
  if v_ente is null or v_tit is null then
    raise notice 'Verifica sui dati saltata: manca la societa'' o il titolare (srls=%, titolare=%). Struttura verificata.', v_ente, v_tit;
    return;
  end if;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);

  begin  -- <<< la sotto-transazione che verra' annullata

    insert into tag_anticipazioni (etichetta) values ('ZZ anticipo-fattura verifica')
    returning id into v_tag;
    insert into suppliers (entity_id, name) values (v_ente, 'ZZ fornitore anticipo')
    returning id into v_forn;
    insert into supplier_invoices (entity_id, supplier_id, invoice_number, invoice_date, amount)
    values (v_ente, v_forn, 'ZZ-ANT-1', make_date(2094, 5, 1), 80.00)
    returning id into v_fatt;
    insert into supplier_invoices (entity_id, supplier_id, invoice_number, invoice_date, amount)
    values (v_ente, v_forn, 'ZZ-ANT-2', make_date(2094, 5, 2), 50.00)
    returning id into v_fatt2;

    select count(*) into v_prima from cash_movements;
    select contante_atteso into v_cassa from saldo_tesoreria(v_ente);
    select costi_totali into v_costi from rettifiche_fiscali(v_ente, 2094);
    if v_costi is distinct from 130.00 then
      raise exception 'VERIFICA (1): punto di partenza dei costi 2094 inatteso: % invece di 130,00.', v_costi;
    end if;

    -- (2) Importo diverso dalla fattura: respinto, e non cambia niente.
    v_preso := false;
    begin
      perform registra_anticipazione(v_ente, 79.00, make_date(2094, 5, 3), v_tag, 'contanti', v_fatt);
    exception when others then
      v_preso := true;
      if sqlerrm not like '%devono coincidere%' or sqlerrm not like '%79,00 €%' or sqlerrm like '%euro%' then
        raise exception 'VERIFICA (2): rifiuto col messaggio sbagliato: %', sqlerrm;
      end if;
    end;
    if not v_preso then raise exception 'VERIFICA (2): un anticipo di importo diverso e'' passato.'; end if;
    if (select status from supplier_invoices where id = v_fatt) <> 'da_pagare' then
      raise exception 'VERIFICA (2): il rifiuto ha comunque toccato la fattura.';
    end if;

    -- (3) Il caso buono: nota + fattura pagata (anticipo), nessun movimento.
    v_ant := registra_anticipazione(v_ente, 80.00, make_date(2094, 5, 3), v_tag, 'contanti', v_fatt,
                                    'RIC-ANT', false, 'ZZ');
    select * into t from supplier_invoices where id = v_fatt;
    if t.status <> 'pagata' or t.payment_method is distinct from 'anticipo' or t.paid_at is null then
      raise exception 'VERIFICA (3a): la fattura non risulta pagata (anticipo): % / %.', t.status, t.payment_method;
    end if;
    if (t.paid_at at time zone 'Europe/Rome')::date <> make_date(2094, 5, 3) then
      raise exception 'VERIFICA (3b): la data di pagamento non e'' il giorno dell''anticipo: %.', t.paid_at;
    end if;
    select count(*) into v_n from cash_movements;
    if v_n <> v_prima then
      raise exception 'VERIFICA (3c): l''anticipo ha scritto % movimenti in prima nota (doveva scriverne zero).', v_n - v_prima;
    end if;
    if (select contante_atteso from saldo_tesoreria(v_ente)) is distinct from v_cassa then
      raise exception 'VERIFICA (3d): la cassa si e'' mossa.';
    end if;

    -- (4) Il costo non e' contato due volte: resta 130 (le due fatture).
    select costi_totali into v_costi from rettifiche_fiscali(v_ente, 2094);
    if v_costi is distinct from 130.00 then
      raise exception 'VERIFICA (4): i costi 2094 sono % invece di 130,00.', v_costi;
    end if;

    -- (5) La quadratura non la segnala; non e' piu' fra le da pagare.
    if exists (select 1 from quadratura_pagamenti(null, null) q where q.descrizione like '%ZZ-ANT-1%') then
      raise exception 'VERIFICA (5a): la quadratura segnala la fattura pagata con l''anticipo.';
    end if;
    if exists (select 1 from supplier_invoices where id = v_fatt and status = 'da_pagare') then
      raise exception 'VERIFICA (5b): la fattura risulta ancora da pagare.';
    end if;

    -- (6) Non si ricollega: una seconda nota sulla stessa fattura e' respinta.
    v_preso := false;
    begin
      perform registra_anticipazione(v_ente, 80.00, make_date(2094, 5, 4), v_tag, 'contanti', v_fatt);
    exception when others then
      v_preso := true;
      if sqlerrm not like '%gia%pagata%' then
        raise exception 'VERIFICA (6): rifiuto col messaggio sbagliato: %', sqlerrm;
      end if;
    end;
    if not v_preso then raise exception 'VERIFICA (6): una fattura gia'' pagata si e'' lasciata collegare ancora.'; end if;

    -- (7) «Annulla il pagamento» e' respinto con la strada giusta.
    v_preso := false;
    begin
      perform annulla_pagamento_fattura(v_fatt);
    exception when others then
      v_preso := true;
      if sqlerrm not like '%Anticipo da rimborsarmi%' then
        raise exception 'VERIFICA (7): rifiuto col messaggio sbagliato: %', sqlerrm;
      end if;
    end;
    if not v_preso then raise exception 'VERIFICA (7): annulla_pagamento_fattura ha riaperto una fattura pagata con l''anticipo.'; end if;

    -- (8) La quadratura segnala i due guasti rovesciati.
    update supplier_invoices set status = 'pagata', paid_at = now(), payment_method = 'anticipo'
     where id = v_fatt2;  -- anticipo senza nota
    if not exists (select 1 from quadratura_pagamenti(null, null) q
                    where q.genere = 'anticipo_senza_nota' and q.descrizione like '%ZZ-ANT-2%') then
      raise exception 'VERIFICA (8a): la quadratura non vede un anticipo senza nota.';
    end if;
    insert into cash_movements (entity_id, direction, amount, movement_date, mezzo,
                                tipo_documento, business_purpose, supplier_invoice_id)
    values (v_ente, 'uscita', 50.00, make_date(2094, 5, 5), 'cassa', 'fattura', 'ZZ doppio', v_fatt2);
    if not exists (select 1 from quadratura_pagamenti(null, null) q
                    where q.genere = 'anticipo_e_uscita' and q.descrizione like '%ZZ-ANT-2%') then
      raise exception 'VERIFICA (8b): la quadratura non vede un anticipo pagato anche in cassa.';
    end if;

    -- (9) Eliminare la nota riapre la fattura; il rimborso blocca l'eliminazione.
    perform delete_anticipazione(v_ant);
    select * into t from supplier_invoices where id = v_fatt;
    if t.status <> 'da_pagare' or t.paid_at is not null or t.payment_method is not null then
      raise exception 'VERIFICA (9a): eliminando la nota la fattura non e'' tornata da pagare: % / %.', t.status, t.payment_method;
    end if;

    v_ant := registra_anticipazione(v_ente, 80.00, make_date(2094, 5, 6), v_tag, 'contanti', v_fatt);
    -- Il rimborso (pareggio) esce dalla cassa: serve contante nel cassetto.
    insert into cash_movements (entity_id, direction, amount, movement_date, mezzo, tipo_documento, note)
    values (v_ente, 'entrata', 500.00, make_date(2094, 5, 6), 'cassa', 'non_documentato', 'ZZ fondo di verifica');
    perform pareggia_anticipazione(v_ant, make_date(2094, 5, 7));
    v_preso := false;
    begin
      perform delete_anticipazione(v_ant);
    exception when others then v_preso := true;
    end;
    if not v_preso then raise exception 'VERIFICA (9b): una nota rimborsata si e'' lasciata eliminare.'; end if;
    -- Il rimborso non e' un costo: i costi restano 130.
    select costi_totali into v_costi from rettifiche_fiscali(v_ente, 2094);
    if v_costi is distinct from 130.00 then
      raise exception 'VERIFICA (9c): dopo il rimborso i costi 2094 sono % invece di 130,00.', v_costi;
    end if;

    -- (11) Il trigger: scrivere la nota da sola su una fattura da pagare e'
    --      respinto (insert e update); la via giusta passa.
    insert into supplier_invoices (entity_id, supplier_id, invoice_number, invoice_date, amount)
    values (v_ente, v_forn, 'ZZ-ANT-3', make_date(2094, 5, 9), 20.00)
    returning id into v_fatt3;
    v_preso := false;
    begin
      insert into anticipazioni_socio (entity_id, importo, pagata_il, tag_id, supplier_invoice_id)
      values (v_ente, 20.00, make_date(2094, 5, 9), v_tag, v_fatt3);
    exception when others then
      v_preso := true;
      if sqlerrm not like '%ancora da pagare%' then
        raise exception 'VERIFICA (11a): rifiuto col messaggio sbagliato: %', sqlerrm;
      end if;
    end;
    if not v_preso then raise exception 'VERIFICA (11a): una nota si e'' collegata a una fattura da pagare scrivendo dritto.'; end if;
    insert into anticipazioni_socio (entity_id, importo, pagata_il, tag_id)
    values (v_ente, 20.00, make_date(2094, 5, 9), v_tag)
    returning id into v_ant;
    v_preso := false;
    begin
      update anticipazioni_socio set supplier_invoice_id = v_fatt3 where id = v_ant;
    exception when others then
      v_preso := true;
      if sqlerrm not like '%ancora da pagare%' then
        raise exception 'VERIFICA (11b): rifiuto col messaggio sbagliato: %', sqlerrm;
      end if;
    end;
    if not v_preso then raise exception 'VERIFICA (11b): il collegamento tardivo a una fattura da pagare e'' passato.'; end if;
    perform registra_anticipazione(v_ente, 20.00, make_date(2094, 5, 9), v_tag, 'contanti', v_fatt3);
    if (select status from supplier_invoices where id = v_fatt3) <> 'pagata' then
      raise exception 'VERIFICA (11c): la via giusta non ha pagato la fattura.';
    end if;

    -- (10) Senza titolare tutto si rifiuta.
    perform set_config('request.jwt.claims', null, true);
    v_preso := false;
    begin
      perform registra_anticipazione(v_ente, 80.00, make_date(2094, 5, 8), v_tag, 'contanti', null);
    exception when others then
      v_preso := true;
      if sqlerrm not like '%riservate al titolare%' then
        raise exception 'VERIFICA (10): rifiuto col messaggio sbagliato: %', sqlerrm;
      end if;
    end;
    if not v_preso then raise exception 'VERIFICA (10): registra_anticipazione risponde anche a chi non e'' titolare.'; end if;

    raise exception 'ZZ_ANNULLA';
  exception when others then
    if sqlerrm <> 'ZZ_ANNULLA' then raise; end if;
  end;

  perform set_config('request.jwt.claims', null, true);
  perform pretendi_nessun_residuo(v_foto, 'la verifica dell''anticipo che paga la fattura');

  raise notice 'Fatto: un anticipo collegato a una fattura la segna pagata (anticipo) senza muovere cassa ne'' banca, i costi restano contati una volta, la quadratura non la segnala (e segnala i due guasti rovesciati), non si ricollega ne'' si annulla come un pagamento, eliminare la nota la riapre. Provato e annullato: zero residui.';
end $verifica$;

-- ---------------------------------------------------------------------
-- La migrazione si registra da sé
-- ---------------------------------------------------------------------
insert into applied_migrations (version, name)
values ('20261101000001', 'l_anticipo_paga_la_fattura')
on conflict (version) do nothing;
