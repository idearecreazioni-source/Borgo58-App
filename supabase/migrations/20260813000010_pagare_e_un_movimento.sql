-- =====================================================================
-- Segnare una fattura «pagata» è un movimento di denaro, non un'etichetta
-- =====================================================================
-- Nasce da una domanda di Alessio sul modulo banca: *«oltre a una copia
-- dell'estratto conto, che posso già vedere dall'home banking, cosa
-- otterremmo?»*. Domanda giusta — se il risultato è una copia, non vale
-- la pena costruirlo. Il valore sta nel **confronto** fra quello che la
-- banca dice e quello che il gestionale si aspettava.
--
-- Andando a vedere com'era fatto quel confronto, è saltato fuori che
-- mancava un pezzo prima ancora della banca:
--
--   `pay_supplier_invoice` segna la fattura «pagata», scrive il metodo e
--   chiude il promemoria — e **non scrive niente in prima nota**.
--
-- Quindi «pagata» e «uscita di denaro» erano due fatti separati che
-- nessuno confrontava. Le conseguenze, tutte e tre reali:
--
-- 1. **La prima nota nasce incompleta**: i pagamenti ai fornitori — cioè
--    la parte più grossa delle uscite di un'osteria — non ci sono, a meno
--    di ribatterli a mano.
-- 2. **Se li ribatte a mano, niente impedisce di contarli due volte**:
--    non c'era nessun legame fra la fattura e il movimento.
-- 3. **Il saldo di cassa e di banca sono sbagliati per difetto**, e in un
--    modo che non si nota: mancano uscite, quindi c'è sempre più denaro
--    del vero.
--
-- ⚠️ LA CORREZIONE È PREVENIRE, NON SEGNALARE. Si poteva costruire una
-- schermata che elenca le fatture pagate senza movimento — cioè
-- accorgersi dopo di una divergenza che non doveva potersi creare. Il
-- progetto ha già scelto un'altra strada nei casi analoghi: «i doppioni
-- diventano impossibili per costruzione» (12/08, ingredienti). Qui è la
-- stessa cosa: pagare una fattura **è** un movimento, quindi le due
-- scritture avvengono insieme o non avvengono.
--
-- E siccome sono due tabelle in una transazione sola, resta dentro la
-- funzione Postgres che il corridoio già chiama (regola B4): non è una
-- scrittura nuova dal browser.
--
-- Il legame `cash_movements.supplier_invoice_id` serve a due cose: a non
-- pagare due volte, e — quando arriveranno gli estratti conto — a dire
-- *quale* riga della banca corrisponde a *quale* fattura. È il pezzo su
-- cui poggerà la riconciliazione vera, e si costruisce adesso perché non
-- dipende dalla banca.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Il legame fra un'uscita e la fattura che l'ha causata
-- ---------------------------------------------------------------------
alter table cash_movements
  add column if not exists supplier_invoice_id uuid references supplier_invoices(id) on delete set null;

comment on column cash_movements.supplier_invoice_id is
  'La fattura fornitore che ha causato questa uscita, quando c''e''. Serve a non pagarla due volte e a riconciliare con l''estratto conto quando ci sara''.';

create unique index if not exists idx_cash_movements_una_per_fattura
  on cash_movements (supplier_invoice_id)
  where supplier_invoice_id is not null;

comment on index idx_cash_movements_una_per_fattura is
  'Una fattura produce UN movimento: il doppio pagamento diventa impossibile per costruzione, non segnalato dopo.';

-- ---------------------------------------------------------------------
-- 2. Pagare scrive anche in prima nota
-- ---------------------------------------------------------------------
create or replace function pay_supplier_invoice(p_invoice_id uuid, p_payment_method text)
returns uuid
language plpgsql
security definer
set search_path = public
as $funzione$
declare
  v_inv       supplier_invoices%rowtype;
  v_fornitore text;
  v_mezzo     text;
begin
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' registrare un pagamento';
  end if;
  if p_payment_method is null or p_payment_method not in ('contante', 'bonifico', 'carta') then
    raise exception 'Metodo di pagamento non valido: %', coalesce(p_payment_method, '(mancante)');
  end if;

  -- Riga bloccata: due pagamenti contemporanei della stessa fattura non
  -- possono sovrapporsi.
  select * into v_inv from supplier_invoices where id = p_invoice_id for update;
  if v_inv.id is null then
    raise exception 'Fattura non trovata';
  end if;
  if v_inv.status = 'pagata' then
    raise exception 'Questa fattura risulta gia'' pagata';
  end if;

  update supplier_invoices
     set status = 'pagata', paid_at = now(), payment_method = p_payment_method
   where id = p_invoice_id;

  -- Chiusura del promemoria nella stessa transazione. Se il task e' stato
  -- nel frattempo eliminato dall'Agenda ("Elimina i completati"), l'update
  -- non trova righe e NON e' un errore: bloccare un pagamento vero per un
  -- promemoria gia' sparito sarebbe il danno peggiore.
  if v_inv.task_id is not null then
    update tasks set status = 'completato' where id = v_inv.task_id;
  end if;

  -- IL MOVIMENTO. Un pagamento e' denaro che esce: se non finisce in
  -- prima nota, la prima nota non e' la prima nota.
  --
  -- Il mezzo si deduce dal metodo: contante dal cassetto, bonifico e
  -- carta dal conto. La carta e' un'approssimazione dichiarata — quando
  -- ci sara' il POS e si sapra' come si comporta, quel caso diventera' un
  -- valore suo (per questo `mezzo` e' un testo con vincolo e non un enum).
  v_mezzo := case when p_payment_method = 'contante' then 'cassa' else 'banca' end;

  select name into v_fornitore from suppliers where id = v_inv.supplier_id;

  insert into cash_movements (
    entity_id, direction, amount, movement_date, mezzo,
    tipo_documento, document_reference, business_purpose,
    supplier_invoice_id
  ) values (
    v_inv.entity_id, 'uscita', v_inv.amount,
    (now() at time zone 'Europe/Rome')::date,
    v_mezzo,
    'fattura',
    coalesce(nullif(v_inv.document_reference, ''), v_inv.invoice_number),
    'Pagamento fattura ' || coalesce(v_inv.invoice_number, '')
      || coalesce(' — ' || v_fornitore, ''),
    p_invoice_id
  );

  return p_invoice_id;
end;
$funzione$;

comment on function pay_supplier_invoice(uuid, text) is
  'Segna pagata una fattura fornitore, chiude il promemoria e SCRIVE L''USCITA IN PRIMA NOTA, in una transazione sola. Pagare e'' un movimento di denaro, non un''etichetta.';

revoke all on function pay_supplier_invoice(uuid, text) from public, anon;
grant execute on function pay_supplier_invoice(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- 3. Il confronto: cosa non torna, oggi e con l'estratto conto domani
-- ---------------------------------------------------------------------
-- Quello che la costruzione non puo' impedire resta da guardare: fatture
-- pagate prima che esistesse questo collegamento, movimenti battuti a
-- mano che duplicano un pagamento, uscite senza documento.
create or replace function quadratura_pagamenti(p_dal date default null, p_al date default null)
returns table (
  genere      text,
  quando      date,
  importo     numeric,
  descrizione text,
  perche      text
)
language sql
stable
security definer
set search_path = public
as $funzione$
  -- 1. Risulta pagata, ma dal cassetto o dal conto non e' uscito niente.
  select 'fattura_senza_movimento'::text,
         v_inv.paid_at::date,
         v_inv.amount,
         'Fattura ' || coalesce(v_inv.invoice_number, '(senza numero)')
           || coalesce(' — ' || s.name, ''),
         'Risulta pagata, ma in prima nota non c''e'' nessuna uscita collegata.'
    from supplier_invoices v_inv
    left join suppliers s on s.id = v_inv.supplier_id
   where v_inv.status = 'pagata'
     and not exists (select 1 from cash_movements m where m.supplier_invoice_id = v_inv.id)
     and (p_dal is null or v_inv.paid_at::date >= p_dal)
     and (p_al  is null or v_inv.paid_at::date <= p_al)

  union all

  -- 2. E' uscito denaro con la causale «fattura», ma non e' agganciato a
  --    nessuna: o e' una fattura non registrata, o e' il doppione di un
  --    pagamento gia' scritto.
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
$funzione$;

comment on function quadratura_pagamenti(date, date) is
  'Cosa non torna fra le fatture fornitore e la prima nota. Quello che si poteva impedire e'' impedito per costruzione: qui restano i casi che nessun vincolo puo'' prevenire.';

revoke all on function quadratura_pagamenti(date, date) from public, anon, authenticated;
grant execute on function quadratura_pagamenti(date, date) to authenticated;

-- ---------------------------------------------------------------------
-- 4. Verifica (§7 punti 1-3)
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_ente uuid;
  v_forn uuid;
  v_inv  uuid;
  v_mov  record;
  v_saldo_prima numeric;
  v_saldo_dopo  numeric;
  v_titolare uuid;
  v_staff    uuid;
  respinto   boolean;
  n      integer;
begin
  select id into v_ente from entities order by created_at limit 1;
  if v_ente is null then raise exception 'Nessuna entita''.'; end if;

  -- `is_titolare()` durante una migrazione e' FALSO (l'SQL gira come
  -- `postgres`, non come utente applicativo): senza impersonare, questa
  -- verifica proverebbe soltanto che la funzione rifiuta tutti.
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  select user_id into v_staff    from user_roles where role = 'staff'    limit 1;
  if v_titolare is null then
    raise exception 'Nessun titolare in user_roles: la verifica non puo'' impersonare nessuno.';
  end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

  insert into suppliers (entity_id, name, category)
  values (v_ente, 'PROVA PAGA fornitore', 'ortofrutta') returning id into v_forn;
  insert into supplier_invoices (entity_id, supplier_id, invoice_number, invoice_date, amount, status)
  values (v_ente, v_forn, 'PROVA-PAGA-1', current_date, 240, 'da_pagare') returning id into v_inv;

  select saldo_banca into v_saldo_prima from v_cash_balance where entity_id = v_ente;

  -- 1. Pagare con bonifico scrive l'uscita in BANCA, agganciata alla fattura.
  perform pay_supplier_invoice(v_inv, 'bonifico');

  select * into v_mov from cash_movements where supplier_invoice_id = v_inv;
  if v_mov.id is null then
    raise exception 'Pagare una fattura non ha scritto niente in prima nota.';
  end if;
  if v_mov.mezzo <> 'banca' or v_mov.direction <> 'uscita' or v_mov.amount <> 240 then
    raise exception 'Il movimento e'' sbagliato: % % %.', v_mov.mezzo, v_mov.direction, v_mov.amount;
  end if;

  select saldo_banca into v_saldo_dopo from v_cash_balance where entity_id = v_ente;
  if v_saldo_dopo is distinct from v_saldo_prima - 240 then
    raise exception 'Il saldo di banca non e'' calato di 240 (da % a %).', v_saldo_prima, v_saldo_dopo;
  end if;

  -- 2. Non si paga due volte.
  begin
    perform pay_supplier_invoice(v_inv, 'bonifico');
    raise exception 'La stessa fattura e'' stata pagata due volte.';
  exception when sqlstate 'P0001' then
    if sqlerrm not like '%gia%pagata%' then
      raise exception 'Rifiuto inatteso: %', sqlerrm;
    end if;
  end;

  -- 3. E nemmeno aggirando la funzione: il vincolo e' sulla tabella.
  begin
    insert into cash_movements (entity_id, direction, amount, mezzo, tipo_documento,
                                business_purpose, supplier_invoice_id)
    values (v_ente, 'uscita', 240, 'banca', 'fattura', 'PROVA PAGA doppione', v_inv);
    raise exception 'Un secondo movimento per la stessa fattura e'' stato accettato.';
  exception when unique_violation then
    null;  -- e' il rifiuto che ci si aspetta
  end;

  -- 4. La quadratura non segnala niente quando tutto torna.
  select count(*) into n from quadratura_pagamenti()
   where descrizione like '%PROVA-PAGA-1%';
  if n <> 0 then
    raise exception 'La quadratura segnala una fattura che invece e'' a posto.';
  end if;

  -- 5. ...e segnala il caso che nessun vincolo puo' impedire: una fattura
  --    segnata pagata senza il suo movimento (com'erano tutte fino a ieri).
  delete from cash_movements where supplier_invoice_id = v_inv;
  select count(*) into n from quadratura_pagamenti()
   where genere = 'fattura_senza_movimento' and descrizione like '%PROVA-PAGA-1%';
  if n <> 1 then
    raise exception 'La quadratura non vede una fattura pagata senza uscita.';
  end if;

  -- 6. E il movimento battuto a mano che non aggancia niente.
  insert into cash_movements (entity_id, direction, amount, mezzo, tipo_documento, business_purpose)
  values (v_ente, 'uscita', 99, 'banca', 'fattura', 'PROVA PAGA a mano');
  select count(*) into n from quadratura_pagamenti()
   where genere = 'movimento_senza_fattura' and descrizione like '%PROVA PAGA a mano%';
  if n <> 1 then
    raise exception 'La quadratura non vede un''uscita «fattura» senza fattura.';
  end if;

  -- 6-bis. Lo staff non paga fatture: il permesso non si e' allargato
  --        aggiungendo la scrittura in prima nota.
  if v_staff is not null then
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
    respinto := false;
    begin
      perform pay_supplier_invoice(v_inv, 'contante');
    exception when sqlstate 'P0001' then
      respinto := true;
    end;
    if not respinto then
      raise exception 'Un utente STAFF ha potuto registrare il pagamento di una fattura.';
    end if;
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);
  end if;

  -- 7. Pulizia (regola del 12/08).
  delete from cash_movements where business_purpose like 'PROVA PAGA%'
     or supplier_invoice_id = v_inv;
  delete from supplier_invoices where id = v_inv;
  delete from suppliers where id = v_forn;

  select count(*) into n from suppliers where name like 'PROVA PAGA%';
  if n <> 0 then raise exception 'La prova ha lasciato % fornitori.', n; end if;
  select count(*) into n from cash_movements where business_purpose like 'PROVA PAGA%';
  if n <> 0 then raise exception 'La prova ha lasciato % movimenti.', n; end if;

  raise notice 'Pagare una fattura e'' un movimento: prima nota completa, doppio pagamento impossibile.';
end
$verifica$;

insert into applied_migrations (version, name)
values ('20260813000010', 'pagare_e_un_movimento')
on conflict (version) do nothing;

select count(*) as fatture_pagate_senza_movimento
  from quadratura_pagamenti()
 where genere = 'fattura_senza_movimento';
