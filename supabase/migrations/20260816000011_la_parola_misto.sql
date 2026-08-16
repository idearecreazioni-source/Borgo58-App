-- =====================================================================
-- La parola «misto»
-- =====================================================================
-- Blocco 9 del mandato di correzione, primo dei due file — e sta da solo
-- per un motivo tecnico che il progetto ha gia' incontrato (CLAUDE.md
-- §6): **un valore aggiunto a un enum non e' usabile nella stessa
-- migrazione in cui viene aggiunto.** Qui si aggiunge e basta; a usarlo
-- e' `20260816000012`.
--
-- Perche' serve una parola nuova: da domani un conto puo' essere pagato
-- **una parte in contanti e una con la carta**, e `orders.payment_method`
-- deve poter dire proprio quello. Le alternative erano due, entrambe
-- peggiori:
--   · lasciarlo **vuoto** — ma «vuoto» nel gestionale vuol dire «non
--     l'ho ancora detto», e un conto pagato davanti a te non e' un conto
--     di cui non si sa niente;
--   · scriverci il mezzo della quota **piu' grossa** — cioe' inventare
--     una risposta a una domanda che ha due risposte.
-- =====================================================================

do $$
begin
  if not exists (
    select 1 from pg_enum e
     join pg_type t on t.oid = e.enumtypid
    where t.typname = 'order_payment_method' and e.enumlabel = 'misto'
  ) then
    alter type order_payment_method add value 'misto';
  end if;
end $$;

comment on type order_payment_method is
  'Come e'' stato pagato un conto. «misto» (16/08/2026, Blocco 9) vuol dire che l''incasso e'' diviso su piu'' mezzi: il dettaglio sta in order_payments, e questa colonna ne e'' solo il riflesso.';

-- ---------------------------------------------------------------------
-- Verifica sul campo (§5 punto 3)
-- ---------------------------------------------------------------------
-- ⚠️ Si controlla che la parola CI SIA, non la si usa: usarla qui
-- fallirebbe, ed e' esattamente il motivo per cui questa migrazione e'
-- separata dalla prossima.
do $verifica$
declare
  n integer;
begin
  select count(*) into n
    from pg_enum e join pg_type t on t.oid = e.enumtypid
   where t.typname = 'order_payment_method' and e.enumlabel = 'misto';
  if n <> 1 then
    raise exception 'Il valore «misto» non risulta fra i mezzi di pagamento ammessi.';
  end if;

  -- E le due parole di prima devono esserci ancora: aggiungere non e'
  -- sostituire, e un conto gia' chiuso in contante deve restare leggibile.
  select count(*) into n
    from pg_enum e join pg_type t on t.oid = e.enumtypid
   where t.typname = 'order_payment_method' and e.enumlabel in ('contante', 'carta');
  if n <> 2 then
    raise exception 'I mezzi di pagamento di prima non ci sono piu'' tutti: ne risultano %.', n;
  end if;

  raise notice 'La parola «misto» c''e''. A usarla e'' la migrazione dopo.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260816000011', 'la_parola_misto')
on conflict (version) do nothing;

select string_agg(e.enumlabel, ', ' order by e.enumsortorder) as mezzi_ammessi
  from pg_enum e join pg_type t on t.oid = e.enumtypid
 where t.typname = 'order_payment_method';
