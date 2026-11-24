-- 24/11/2026 — Revisione dell'11/11, punto 19: l'importo di un pagamento già legato a una fattura si può cambiare senza allarmi.
--
-- Cosa succedeva: il movimento di prima nota che paga una fattura (`cash_movements.supplier_invoice_id`) si poteva
-- correggere nell'importo come qualunque altro. Correggere per sbaglio da 1.000 a 100 lasciava la fattura «pagata» per
-- 1.000 e la cassa uscita per 100: cassa e fattura non tornavano più di 900 euro, e nessun controllo lo diceva. Può farlo solo
-- il titolare: è un rischio di errore, non di furto.
-- Cura: l'importo di un movimento legato a una fattura NON si cambia. Se il pagamento era sbagliato si annulla il pagamento
-- della fattura (`annulla_pagamento_fattura`) e si registra di nuovo con l'importo giusto: la fattura e la cassa si muovono
-- insieme, come quando è stato scritto. Tutto il resto del movimento (nota, data, mezzo, riferimento) si può correggere.
-- Non si tocca niente di quello che c'è: vale solo per le modifiche da adesso.
-- Limite accettato: chi ha il token del titolare potrebbe scollegare il movimento dalla fattura e POI cambiare l'importo (due
-- gesti): è lo stesso scollegamento che fanno apposta l'annullo del pagamento, la nota di credito e l'anticipo, quindi non si chiude.

create or replace function movimento_di_fattura_importo_fermo()
returns trigger language plpgsql set search_path = public as $funzione$
begin
  raise exception 'Questo movimento paga una fattura: l''importo non si cambia da qui (era % euro, non può diventare % euro). Se il pagamento era sbagliato, annulla il pagamento della fattura e registralo di nuovo con l''importo giusto.',
    to_char(old.amount, 'FM999999990.00'), to_char(new.amount, 'FM999999990.00')
    using errcode = 'check_violation';
end $funzione$;

revoke all on function movimento_di_fattura_importo_fermo() from public, anon, authenticated;

drop trigger if exists movimento_di_fattura_importo_fermo on cash_movements;
create trigger movimento_di_fattura_importo_fermo
  before update of amount on cash_movements
  for each row
  when (old.supplier_invoice_id is not null and new.amount is distinct from old.amount)
  execute function movimento_di_fattura_importo_fermo();

comment on trigger movimento_di_fattura_importo_fermo on cash_movements is
  'Un movimento legato a una fattura non cambia importo: cassa e fattura non devono divergere in silenzio. Per correggere si annulla il pagamento della fattura e lo si rifà.';

-- ---------------------------------------------------------------------
-- VERIFICA (in un blocco annullato, zero residui)
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_ent uuid;
  v_forn uuid;
  v_fat uuid;
  v_mov uuid;
  v_libero uuid;
  v_no boolean;
begin
  select id into v_ent from entities where entity_type = 'srls' limit 1;
  if v_ent is null then raise exception 'VERIFICA: manca la società.'; end if;

  begin
    insert into suppliers (entity_id, name) values (v_ent, 'ZZ Fornitore di verifica pagamento') returning id into v_forn;
    insert into supplier_invoices (entity_id, supplier_id, invoice_number, invoice_date, due_date, amount)
      values (v_ent, v_forn, 'ZZ-PAG-1', date '2026-10-01', date '2026-10-31', 1000) returning id into v_fat;
    insert into cash_movements (entity_id, direction, amount, movement_date, mezzo, tipo_documento, supplier_invoice_id)
      values (v_ent, 'uscita', 1000, date '2026-11-01', 'cassa', 'fattura', v_fat) returning id into v_mov;
    insert into cash_movements (entity_id, direction, amount, movement_date, mezzo, tipo_documento)
      values (v_ent, 'uscita', 50, date '2026-11-01', 'cassa', 'non_documentato') returning id into v_libero;

    -- (1) l'importo di un pagamento di fattura NON cambia, e il messaggio lo dice.
    v_no := false;
    begin
      update cash_movements set amount = 100 where id = v_mov;
    exception when check_violation then v_no := (sqlerrm like '%l''importo non si cambia%');
    end;
    if not v_no then raise exception 'VERIFICA (1): l''importo di un pagamento di fattura si è potuto cambiare.'; end if;
    if (select amount from cash_movements where id = v_mov) <> 1000 then
      raise exception 'VERIFICA (1b): l''importo è cambiato lo stesso.';
    end if;

    -- (2) tutto il resto dello stesso movimento si corregge ancora; lo stesso importo riscritto non è un cambio.
    update cash_movements set note = 'una nota corretta', movement_date = date '2026-11-02' where id = v_mov;
    update cash_movements set amount = 1000 where id = v_mov;
    if (select note from cash_movements where id = v_mov) is distinct from 'una nota corretta' then
      raise exception 'VERIFICA (2): la nota di un pagamento di fattura non si corregge più.';
    end if;

    -- (3) un movimento SENZA fattura cambia importo come sempre.
    update cash_movements set amount = 60 where id = v_libero;
    if (select amount from cash_movements where id = v_libero) <> 60 then
      raise exception 'VERIFICA (3): un movimento senza fattura non cambia più importo.';
    end if;

    raise exception 'ZZ_ANNULLA';
  exception when others then
    if sqlerrm <> 'ZZ_ANNULLA' then raise; end if;
  end;

  if exists (select 1 from supplier_invoices where invoice_number = 'ZZ-PAG-1')
     or exists (select 1 from suppliers where name = 'ZZ Fornitore di verifica pagamento') then
    raise exception 'VERIFICA (4): resta un residuo della verifica.';
  end if;
  if has_function_privilege('anon', 'movimento_di_fattura_importo_fermo()', 'execute')
     or has_function_privilege('authenticated', 'movimento_di_fattura_importo_fermo()', 'execute') then
    raise exception 'VERIFICA (5): la funzione del blocco è chiamabile da chi non deve.';
  end if;

  raise notice 'Fatto: l''importo di un movimento legato a una fattura non si cambia più (si annulla il pagamento e lo si rifà); nota, data e mezzo si correggono ancora, e un movimento senza fattura non cambia. Provato e annullato: zero residui.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20261124000002', 'l_importo_di_un_pagamento_di_fattura_non_si_cambia')
on conflict (version) do nothing;
