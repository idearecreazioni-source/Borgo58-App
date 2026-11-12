-- =====================================================================
-- «QUANDO ARRIVO» SI SPEGNE — 12/11/2026, deciso da Alessio
-- =====================================================================
--
-- I promemoria per luogo (20261028000001, …000003, …000006) non hanno
-- funzionato nella vita vera: il raggio dei Comandi dell'iPhone è troppo
-- largo, il GPS oscilla, e la stessa notifica arrivava più volte. Alessio
-- ha deciso di toglierli. L'automazione e il comando sull'iPhone li
-- cancella lui; qui si chiude la porta dal lato del gestionale.
--
-- 🔴 NESSUN DATO PERSO. Gli impegni che hanno già un luogo restano impegni
--    normali: la colonna `tasks.luogo` e il suo vincolo `luogo_chiuso`
--    RESTANO come sono, e questa migrazione non li tocca. Restano anche
--    `agenda_corsie()` (che restituisce il luogo in fondo: la schermata
--    semplicemente non lo mostra più) e `completa_task` (che lo porta
--    sull'impegno successivo di un ricorrente). Nessuna delle due dipende
--    da quello che si toglie qui: leggono la colonna, non le chiavi.
--
-- Cosa cambia, e solo questo:
--   1. LE CHIAVI DEL LUOGO ANCORA ATTIVE SI REVOCANO, prima di tutto. Una
--      chiave rimasta nel telefono non deve aprire più niente, nemmeno se
--      domani qualcuno rimettesse la funzione.
--   2. SI TOLGONO LE QUATTRO FUNZIONI: `luogo_promemoria` (l'unica aperta
--      ad `anon`, la porta dell'iPhone), e le tre del titolare per creare,
--      revocare ed elencare le chiavi. Le funzioni online e la pagina
--      «Quando arrivo…» che le chiamavano escono con lo stesso lavoro.
--   3. LA TABELLA `chiavi_luogo` RESTA, come storico: chi l'ha usata,
--      quante volte, quando è stata revocata. Senza chiavi attive e senza
--      funzioni non apre niente; la RLS (solo il titolare) resta la sua.
--      Toglierla sarebbe una cancellazione senza un guadagno.
--
-- Idempotente: la revoca tocca solo le chiavi non ancora revocate, e le
-- funzioni si tolgono «se ci sono». Verifica finale, senza residui.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. LE CHIAVI ATTIVE SI REVOCANO
-- ---------------------------------------------------------------------
update chiavi_luogo set revocata_il = now() where revocata_il is null;

-- ---------------------------------------------------------------------
-- 2. LE QUATTRO FUNZIONI SE NE VANNO
-- ---------------------------------------------------------------------
drop function if exists public.luogo_promemoria(text, text);
drop function if exists public.crea_chiave_luogo(text);
drop function if exists public.revoca_chiave_luogo(uuid);
drop function if exists public.chiavi_luogo_elenco();

-- ---------------------------------------------------------------------
-- 3. I COMMENTI DICONO COM'È ADESSO
-- ---------------------------------------------------------------------
-- ⚠️ Quello di prima su `tasks.luogo` prometteva una notifica all'arrivo
--    (luogo_promemoria): chi lo leggesse domani crederebbe che succeda.
comment on column tasks.luogo is
  'Il luogo scelto con «Quando arrivo» (28/10–12/11/2026). La funzione è stata tolta il 12/11/2026: il valore resta sugli impegni che ce l''hanno, ma nessuno lo ricorda più all''arrivo e le schermate non lo mostrano.';
comment on table chiavi_luogo is
  'Storico delle chiavi di «Quando arrivo» (automazione dell''iPhone), tolto il 12/11/2026: tutte revocate, e le funzioni che le usavano non ci sono più. La chiave in chiaro non è mai stata conservata, solo l''impronta.';

-- ---------------------------------------------------------------------
-- VERIFICA
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_foto jsonb := foto_righe();
begin
  -- (1) Le quattro funzioni non ci sono più, con nessuna firma.
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public'
                and p.proname in ('luogo_promemoria', 'crea_chiave_luogo',
                                  'revoca_chiave_luogo', 'chiavi_luogo_elenco')) then
    raise exception 'VERIFICA (1): una funzione di «Quando arrivo» è ancora nel database.';
  end if;

  -- (2) Nessuna chiave del luogo è ancora attiva.
  if exists (select 1 from chiavi_luogo where revocata_il is null) then
    raise exception 'VERIFICA (2): è rimasta una chiave del luogo attiva.';
  end if;

  -- (3) Il dato degli impegni è intatto: la colonna e il vincolo ci sono.
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'tasks' and column_name = 'luogo') then
    raise exception 'VERIFICA (3): manca tasks.luogo — doveva restare.';
  end if;
  if not exists (select 1 from pg_constraint
                  where conname = 'luogo_chiuso' and conrelid = 'public.tasks'::regclass) then
    raise exception 'VERIFICA (3): manca il vincolo luogo_chiuso — doveva restare.';
  end if;

  -- (4) Le funzioni che leggono la colonna sono ancora vive.
  if to_regprocedure('public.agenda_corsie()') is null
     or to_regprocedure('public.completa_task(uuid)') is null then
    raise exception 'VERIFICA (4): agenda_corsie o completa_task è sparita.';
  end if;

  -- (5) Lo storico resta, chiuso come prima: anon non lo legge.
  if to_regclass('public.chiavi_luogo') is null then
    raise exception 'VERIFICA (5): la tabella chiavi_luogo è sparita — doveva restare come storico.';
  end if;
  if has_table_privilege('anon', 'public.chiavi_luogo', 'select') then
    raise exception 'VERIFICA (5): anon legge lo storico delle chiavi del luogo.';
  end if;

  perform pretendi_nessun_residuo(v_foto, 'la verifica di «Quando arrivo» spento');

  raise notice 'Fatto: «Quando arrivo» è spento — chiavi del luogo revocate, le quattro funzioni tolte, tasks.luogo e il suo vincolo intatti, lo storico delle chiavi conservato.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20261112000007', 'quando_arrivo_si_spegne')
on conflict (version) do nothing;
