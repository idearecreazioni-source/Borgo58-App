-- 25/11/2026 — Revisione dell'11/11, punto 32: «stesso fornitore + stesso numero + stessa data» era controllato solo da
-- una funzione (quella del file elettronico), non dal database. Chi scriveva due volte la stessa fattura a mano, o da
-- due strade insieme, la registrava due volte e il debito risultava doppio.
-- Cura:
--   1. un INDICE UNICO sul database (la barriera vera, vale anche se due richieste arrivano insieme);
--   2. un controllo prima della scrittura che dice la frase chiara invece di un errore tecnico.
-- Il numero si confronta senza spazi, trattini o minuscole («FT/12» = «ft 12»), come già fa la lettura del file.
-- Prima di crearlo, si controlla che non ci siano già doppioni (se ci sono, la migrazione si ferma e li elenca).

do $indice$
declare
  v_n integer;
begin
  perform set_config('request.jwt.claims', null, true);
  select count(*) into v_n from (
    select 1
      from supplier_invoices
     where regexp_replace(upper(coalesce(invoice_number, '')), '[^A-Z0-9]', '', 'g') <> ''
     group by supplier_id, invoice_date, regexp_replace(upper(coalesce(invoice_number, '')), '[^A-Z0-9]', '', 'g')
    having count(*) > 1) t;
  if v_n > 0 then
    raise exception 'Ci sono già % gruppi di fatture doppie (stesso fornitore, numero e data): vanno sistemati a mano prima di mettere il vincolo.', v_n;
  end if;
end $indice$;

create unique index if not exists uq_supplier_invoices_fornitore_numero_data
  on supplier_invoices (supplier_id, invoice_date, (regexp_replace(upper(coalesce(invoice_number, '')), '[^A-Z0-9]', '', 'g')))
  where regexp_replace(upper(coalesce(invoice_number, '')), '[^A-Z0-9]', '', 'g') <> '';

create or replace function supplier_invoices_no_doppione()
returns trigger
language plpgsql
set search_path to 'public'
as $funzione$
declare
  v_num text := regexp_replace(upper(coalesce(new.invoice_number, '')), '[^A-Z0-9]', '', 'g');
begin
  if v_num = '' then return new; end if;
  if exists (
    select 1 from supplier_invoices si
     where si.supplier_id = new.supplier_id
       and si.invoice_date = new.invoice_date
       and regexp_replace(upper(coalesce(si.invoice_number, '')), '[^A-Z0-9]', '', 'g') = v_num
       and si.id is distinct from new.id
  ) then
    raise exception 'La fattura n. % del % di questo fornitore è già registrata. Se è la stessa, non serve scriverla di nuovo; se quella già scritta era sbagliata, toglila prima da Fatture fornitori.',
      new.invoice_number, to_char(new.invoice_date, 'DD/MM/YYYY');
  end if;
  return new;
end $funzione$;

revoke all on function supplier_invoices_no_doppione() from public, anon, authenticated;

drop trigger if exists supplier_invoices_no_doppione on supplier_invoices;
create trigger supplier_invoices_no_doppione
  before insert or update of supplier_id, invoice_date, invoice_number on supplier_invoices
  for each row execute function supplier_invoices_no_doppione();

-- ---------------------------------------------------------------------
-- VERIFICA (blocco annullato, zero residui)
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_ent  uuid;
  v_forn uuid;
  v_no   boolean;
begin
  select id into v_ent from entities limit 1;
  if v_ent is null then raise notice 'VERIFICA: nessuna entità, salto la prova di scrittura.'; return; end if;

  begin
    insert into suppliers (entity_id, name) values (v_ent, 'ZZ fornitore verifica doppione') returning id into v_forn;
    insert into supplier_invoices (entity_id, supplier_id, invoice_date, invoice_number, amount)
      values (v_ent, v_forn, date '2026-01-15', 'ZZ/12', 10);

    -- (1) stesso numero scritto in un altro modo → rifiutata con la frase chiara.
    v_no := false;
    begin
      insert into supplier_invoices (entity_id, supplier_id, invoice_date, invoice_number, amount)
        values (v_ent, v_forn, date '2026-01-15', ' zz-12 ', 10);
    exception when raise_exception then v_no := (sqlerrm like '%già registrata%');
    end;
    if not v_no then raise exception 'VERIFICA (1): il doppione non è stato fermato con la frase chiara.'; end if;

    -- (2) altra data o altro numero → entra.
    insert into supplier_invoices (entity_id, supplier_id, invoice_date, invoice_number, amount)
      values (v_ent, v_forn, date '2026-01-16', 'ZZ/12', 10), (v_ent, v_forn, date '2026-01-15', 'ZZ/13', 10);

    -- (3) senza numero ne entrano quante si vuole.
    insert into supplier_invoices (entity_id, supplier_id, invoice_date, invoice_number, amount)
      values (v_ent, v_forn, date '2026-01-15', null, 10), (v_ent, v_forn, date '2026-01-15', null, 10);

    raise exception 'ZZ_ANNULLA';
  exception when others then
    if sqlerrm <> 'ZZ_ANNULLA' then raise; end if;
  end;

  if exists (select 1 from suppliers where name = 'ZZ fornitore verifica doppione') then
    raise exception 'VERIFICA (4): resta un residuo della verifica.';
  end if;
  raise notice 'Fatto: la stessa fattura (fornitore, numero, data) non entra due volte. Provato e annullato: zero residui.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20261125000003', 'la_stessa_fattura_non_entra_due_volte')
on conflict (version) do nothing;
