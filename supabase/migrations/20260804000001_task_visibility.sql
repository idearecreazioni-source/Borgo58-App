-- =====================================================================
-- Borgo 58 · Migrazione 0026 — Visibilità dei task in Agenda (§3.18)
-- =====================================================================
-- CORREGGE UNA LACUNA REALE E ATTIVA, non un rischio teorico.
--
-- L'Agenda (modulo 2) è condivisa con lo staff (§3.9) e la sua RLS era
-- aperta a chiunque fosse autenticato:
--     create policy tasks_select_all ... using (true);
-- Ma quattro moduli RISERVATI AL TITOLARE creano task automatici scrivendo
-- dati riservati direttamente nel titolo:
--
--   personale           → "Rinnovo documento — Mario Rossi: certificato HACCP"
--   proiezione_fiscale  → "Strumento fiscale: <nome>"
--   archivio_documenti  → "Scadenza documento: <titolo>"
--   fatture_fornitori   → "Pagare fattura #12 — <fornitore> (1.250€)"
--
-- Risultato: nome e documenti di un dipendente erano leggibili dallo staff
-- nell'Agenda condivisa e nella Dashboard home. È esattamente il "caso
-- peggiore" descritto in §3.18 del brief.
--
-- PRINCIPIO APPLICATO (§3.18): "il permesso vive nel database (RLS), non
-- nella schermata". Il fix è qui, nel DB — il frontend non viene reso
-- responsabile della riservatezza, solo allineato per coerenza visiva.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Flag di visibilità sul singolo task
-- ---------------------------------------------------------------------
-- Default `true`: l'Agenda NASCE condivisa (§3.9, "utile anche per compiti
-- operativi tipo 'pulire la cappa'"). La riservatezza è l'eccezione, non
-- la regola — ma è un'eccezione imposta dal server, vedi punto 3.
alter table tasks add column visibile_staff boolean not null default true;

comment on column tasks.visibile_staff is
  'Visibilità del singolo task per il ruolo staff (§3.18). Per i task automatici (origine_modulo non nullo) NON è scelto dal client: lo impone il trigger trg_task_visibility a partire dal modulo di origine. Per i task manuali è una scelta del titolare.';

-- ---------------------------------------------------------------------
-- 2. Whitelist dei moduli di origine condivisi — FAIL-CLOSED
-- ---------------------------------------------------------------------
-- Un `origine_modulo` NON elencato qui è, per definizione, riservato al
-- titolare. È deliberato: se domani un modulo nuovo inizia a generare task
-- e nessuno ci pensa, quei task nascono riservati (silenziosi) invece di
-- nascere pubblici (una fuga di dati). Il costo di sbagliare in questa
-- direzione è un promemoria che lo staff non vede; nell'altra direzione è
-- il nome di un dipendente esposto.
--
-- L'array è VUOTO oggi, e non è una dimenticanza: tutti e quattro i moduli
-- che generano task (sopra) sono riservati al titolare per il brief (§4,
-- moduli 3/9/11/15). Quando l'Agenda riceverà task da moduli operativi
-- realmente condivisi — HACCP (§4 modulo 7, es. "pulire la cappa"),
-- Magazzino (§4 modulo 4), Calendario/prenotazioni (§4 modulo 6) — è QUI
-- che va aggiunto il valore, come decisione esplicita.
create or replace function task_origin_visible_to_staff(p_origine text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select p_origine = any (array[]::text[]);
$$;

comment on function task_origin_visible_to_staff(text) is
  'Whitelist fail-closed dei moduli di origine i cui task automatici sono visibili allo staff (§3.18). Vuota per costruzione: oggi ogni modulo che genera task è riservato al titolare. Aggiungere un valore qui è una decisione deliberata di esporre allo staff.';

-- ---------------------------------------------------------------------
-- 3. Il flag lo decide il server, non il client
-- ---------------------------------------------------------------------
-- Perché un trigger e non `visibile_staff: false` nelle 4 chiamate JS:
-- affidarsi al client significa che il quinto modulo, scritto tra sei mesi,
-- può dimenticarsene e nessuno se ne accorge finché non è tardi. Qui la
-- regola è una sola, in un punto solo, e vale anche per chi scrive sulla
-- tabella senza passare dal nostro codice.
create or replace function set_task_visibility()
returns trigger
language plpgsql
as $$
begin
  if new.origine_modulo is not null then
    -- Task automatico: la visibilità è ereditata dal modulo di origine
    -- (§3.18) e il valore proposto dal client viene ignorato. Vale anche
    -- in UPDATE, così non si può "ripulire" un task riservato modificandolo.
    new.visibile_staff := task_origin_visible_to_staff(new.origine_modulo);
  elsif not is_titolare() then
    -- Task manuale creato dallo staff: resta condiviso. Lo staff non ha
    -- motivo di creare task nascosti (userebbe l'account condiviso per
    -- nasconderli a sé stesso) e la funzione non è esposta nella sua UI.
    new.visibile_staff := true;
  end if;
  -- Task manuale del titolare: il valore passato vale così com'è.
  return new;
end;
$$;

create trigger trg_task_visibility
  before insert or update on tasks
  for each row execute function set_task_visibility();

-- ---------------------------------------------------------------------
-- 4. Sanatoria dei task già esistenti
-- ---------------------------------------------------------------------
-- I task automatici già in tabella sono stati creati quando il flag non
-- esisteva: sono tutti nati `true` per via del default. Vanno riportati
-- alla visibilità corretta, altrimenti il fix varrebbe solo per il futuro
-- e i dati già esposti resterebbero esposti.
update tasks
set visibile_staff = false
where origine_modulo is not null
  and not task_origin_visible_to_staff(origine_modulo);

-- Adempimenti societari SRLS (seed della migrazione 20260802000001):
-- bilancio, diritto camerale, tassa libri sociali, titolare effettivo.
-- Hanno origine_modulo NULL (inseriti direttamente dal seed) ma sono
-- materia societaria/fiscale — §3.5 li lascia fuori dall'accesso staff
-- ("tutto il resto invisibile"). Sono riconoscibili solo dalla categoria.
-- ⚠️ Scelta di merito, non tecnica: se Alessio preferisce che lo staff veda
-- queste scadenze, basta rimettere `visibile_staff = true` su queste righe.
update tasks
set visibile_staff = false
where origine_modulo is null
  and category = 'Adempimenti societari';

-- ---------------------------------------------------------------------
-- 5. RLS — la barriera vera
-- ---------------------------------------------------------------------
-- Sostituisce le quattro policy aperte della migrazione 20260802000001.
-- Il predicato è lo stesso per select/insert/update, così non esistono
-- asimmetrie sfruttabili: in Postgres la USING di UPDATE è indipendente da
-- quella di SELECT — lasciare `using (true)` sull'update avrebbe permesso
-- di modificare (alla cieca) una riga che non si può nemmeno leggere.
drop policy if exists tasks_select_all on tasks;
drop policy if exists tasks_insert_all on tasks;
drop policy if exists tasks_update_all on tasks;

create policy tasks_select_visible on tasks
  for select to authenticated
  using ((select is_titolare()) or visibile_staff);

-- WITH CHECK è valutata DOPO il trigger del punto 3: quando lo staff
-- inserisce, il flag è già stato forzato a true, quindi la condizione passa.
-- Se invece lo staff tentasse di inserire un task con un origine_modulo
-- riservato (es. 'personale'), il trigger lo porterebbe a false e questa
-- policy rifiuterebbe l'inserimento — niente task riservati creati dallo staff.
create policy tasks_insert_visible on tasks
  for insert to authenticated
  with check ((select is_titolare()) or visibile_staff);

create policy tasks_update_visible on tasks
  for update to authenticated
  using ((select is_titolare()) or visibile_staff)
  with check ((select is_titolare()) or visibile_staff);

-- La delete resta invariata (solo titolare, migrazione 20260802000001).

-- ---------------------------------------------------------------------
-- Nota su Telegram (migrazione 20260802000002)
-- ---------------------------------------------------------------------
-- send_due_task_reminders() è SECURITY DEFINER e gira da pg_cron: continua
-- a vedere tutti i task, inclusi quelli riservati, e li manda sul Telegram
-- di Alessio. È corretto così — il canale è personale, non condiviso con lo
-- staff — quindi nessuna modifica lì.
