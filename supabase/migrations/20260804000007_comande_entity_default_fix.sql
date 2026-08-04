-- =====================================================================
-- Borgo 58 · Migrazione 0032 — Fix: il trigger leggeva entities coi
-- permessi dello staff, non i suoi
-- =====================================================================
-- Trovato verificando dal vivo con login staff (secondo giro): la
-- creazione tavolo falliva ancora, con
-- "null value in column entity_id ... violates not-null constraint".
--
-- CAUSA: set_order_entity_srls() (20260804000006) è SECURITY INVOKER per
-- default — gira con i permessi di chi esegue l'INSERT. Quando è lo
-- staff a creare un ordine, la sua stessa `select ... from entities`
-- dentro il trigger è filtrata dalla RLS titolare-only su entities
-- (P.IVA/codice fiscale): restituisce zero righe, `select into` lascia
-- new.entity_id nullo, e il vincolo NOT NULL blocca l'insert.
--
-- Stesso identico principio già applicato a link_reservation_customer()
-- (20260802000009): una funzione che deve leggere/scrivere qualcosa
-- fuori dai permessi del chiamante ha bisogno di SECURITY DEFINER,
-- altrimenti eredita i permessi di chi la esegue, non del suo autore.
-- =====================================================================
create or replace function set_order_entity_srls()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.entity_id is null then
    select id into new.entity_id from entities where entity_type = 'srls';
  end if;
  return new;
end;
$$;

comment on function set_order_entity_srls() is
  'SECURITY DEFINER: deve leggere entities anche quando chi inserisce l''ordine è lo staff, che non ha accesso diretto a quella tabella (P.IVA/codice fiscale, titolare-only). Vedi 20260804000006/7 per la storia completa del fix.';
