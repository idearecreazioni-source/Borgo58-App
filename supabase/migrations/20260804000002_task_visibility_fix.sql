-- =====================================================================
-- Borgo 58 · Migrazione 0027 — Correzione al fix di visibilità (§3.18)
-- =====================================================================
-- Corregge un errore introdotto dalla migrazione 20260804000001, trovato
-- durante la verifica dal vivo del 04/08/2026: gli adempimenti societari
-- risultavano ancora visibili allo staff nonostante la sanatoria.
--
-- CAUSA — il trigger annullava la sanatoria della sua stessa migrazione:
-- `set_task_visibility()` conteneva la regola "task manuale creato da un
-- non-titolare → forza visibile_staff = true". Quella regola scattava
-- anche in UPDATE, e la sanatoria degli adempimenti societari È un UPDATE
-- su task manuali (origine_modulo nullo). Eseguita dall'SQL Editor, dove
-- il ruolo di database non è il titolare, la sanatoria veniva riscritta a
-- `true` nello stesso istante in cui metteva `false`. I task automatici
-- non ne erano affetti: passano dall'altro ramo del trigger, ed è per
-- questo che la parte più importante del fix funzionava già.
--
-- PROBLEMA PIÙ GRAVE DIETRO IL SINTOMO: la stessa regola, applicandosi
-- agli UPDATE, faceva tornare visibile allo staff QUALUNQUE task che il
-- titolare avesse marcato come riservato, non appena quel task fosse
-- stato modificato da un contesto non-titolare (job pg_cron, funzione
-- SECURITY DEFINER, manutenzione via SQL Editor). Una regressione
-- silenziosa della privacy, peggiore del sintomo che l'ha rivelata.
--
-- La guardia serviva a impedire allo STAFF di creare task nascosti: è
-- quindi una regola di INSERT, non di UPDATE. Sugli UPDATE è comunque la
-- RLS a impedire allo staff di nascondere un task (la WITH CHECK di
-- tasks_update_visible rifiuta una riga con visibile_staff = false
-- scritta da chi non è titolare), quindi restringere il trigger al solo
-- INSERT non apre alcun buco.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Il trigger non tocca più i task manuali in UPDATE
-- ---------------------------------------------------------------------
create or replace function set_task_visibility()
returns trigger
language plpgsql
as $$
begin
  if new.origine_modulo is not null then
    -- Task automatico: visibilità ereditata dal modulo di origine (§3.18),
    -- sia in insert che in update — così non si può "ripulire" un task
    -- riservato modificandolo.
    new.visibile_staff := task_origin_visible_to_staff(new.origine_modulo);
  elsif tg_op = 'INSERT' and not is_titolare() then
    -- Task manuale creato da un non-titolare: nasce condiviso. Solo in
    -- INSERT: in UPDATE il valore già sulla riga va rispettato, altrimenti
    -- una modifica qualsiasi fatta fuori dalla sessione del titolare
    -- riporterebbe in chiaro un task che lui aveva riservato.
    new.visibile_staff := true;
  end if;
  return new;
end;
$$;

comment on function set_task_visibility() is
  'Impone visibile_staff sui task (§3.18): derivato da origine_modulo per i task automatici (insert e update), forzato a true solo all''INSERT di un task manuale da parte di un non-titolare. Non tocca i task manuali in UPDATE — vedi migrazione 20260804000002.';

-- ---------------------------------------------------------------------
-- 2. Sanatoria, di nuovo — ora non viene più riscritta dal trigger
-- ---------------------------------------------------------------------
-- Adempimenti societari SRLS del seed (migrazione 20260802000001):
-- materia societaria/fiscale, fuori dall'accesso staff per §3.5.
-- ⚠️ Resta una scelta di merito, non tecnica: se Alessio preferisce che lo
-- staff veda queste scadenze, basta rimettere `visibile_staff = true`.
update tasks
set visibile_staff = false
where origine_modulo is null
  and category = 'Adempimenti societari';

-- Rete di sicurezza: se qualche task automatico fosse stato modificato
-- nella finestra tra le due migrazioni, riallinealo alla whitelist.
update tasks
set visibile_staff = task_origin_visible_to_staff(origine_modulo)
where origine_modulo is not null
  and visibile_staff is distinct from task_origin_visible_to_staff(origine_modulo);
