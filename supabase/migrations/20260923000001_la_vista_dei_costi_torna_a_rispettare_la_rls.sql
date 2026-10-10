-- =====================================================================
-- LA VISTA DEI COSTI TORNA A RISPETTARE LA RLS — 23/09/2026
-- =====================================================================
--
-- 🔴 COSA E' SUCCESSO, e non e' un caso raro: e' una trappola che questo
--    progetto AVEVA GIA' SCRITTO. R12 (`20260922000001`) riscrive
--    `v_recipe_row_costs` per togliere l'eredita' viva dal prodotto, e la
--    riscrive con `create or replace view` prendendo il corpo da
--    `pg_get_viewdef()`.
--
--    `pg_get_viewdef()` restituisce **la query, non le opzioni della
--    vista**. E `create or replace view` senza `with (...)` le azzera.
--    Risultato: `security_invoker` e' sparito, e la vista ha ripreso a
--    girare coi permessi del PROPRIETARIO — cioe' scavalcando la RLS di
--    chi la interroga, ed esponendo `costo`, che sono i prezzi d'acquisto.
--
-- ⚠️ E LA FRASE ERA GIA' SCRITTA, nel commento della rete del 04/09:
--    *«la rete serve perche' l'elenco non cresca in silenzio:
--    `create or replace view` perde l'opzione senza dare errore».*
--    Non e' una scoperta: e' una trappola conosciuta in cui sono caduto
--    lo stesso. *Una trappola scritta non e' una trappola chiusa.*
--
-- ⚠️ ED E' LA STESSA FAMIGLIA DEL 24/08 — *un `revoke`/`grant` ricopiato
--    e' una riscrittura come le altre* — in una forma nuova: la' erano i
--    permessi di una funzione, qui le OPZIONI di una vista. Di un oggetto
--    si riprende dal database tutto cio' che lo descrive, non solo il
--    corpo.
--
-- ⚠️ A TROVARLO E' STATA UNA RETE CHE ESISTEVA GIA' (`tests/app/permessi.
--    test.js`), diventata rossa da sola: «solo 8 viste scavalcano la RLS»
--    ne ha trovate 9, e ha nominato la colonna esposta —
--    `v_recipe_row_costs → costo`. Non l'ha trovato una rilettura.
--
-- ---------------------------------------------------------------------
-- PERCHE' UNA MIGRAZIONE NUOVA, E NON UNA CORREZIONE DI R12
-- ---------------------------------------------------------------------
-- R12 e' GIA' REGISTRATA sul progetto di prova. Correggere il suo file
-- non cambierebbe niente li' dentro — la migrazione non gira due volte —
-- e renderebbe quel file una bugia per chi ricostruira' da zero fra un
-- anno. *Una migrazione gia' applicata non si riscrive mai* (regola del
-- 23/08): si ripara in avanti, aggiungendo.
--
-- ---------------------------------------------------------------------
-- E SI CAMBIA SOLO L'OPZIONE
-- ---------------------------------------------------------------------
-- ⚠️ Niente `create or replace view`, niente `drop view`, niente
--    `cascade`, nessun `grant`, nessuna policy: il corpo della vista e'
--    giusto — quello che R12 ha fatto al suo interno e' voluto. A mancare
--    e' una sola opzione, e `alter view ... set (...)` cambia quella e
--    nient'altro.
-- ⚠️ E rifare la vista sarebbe anche piu' pericoloso: ricrearla vuol dire
--    rifarne i permessi a memoria, che e' esattamente la trappola del
--    24/08 da cui questo difetto viene.

alter view v_recipe_row_costs set (security_invoker = true);

-- =====================================================================
-- VERIFICA
-- =====================================================================
do $verifica$
declare
  v_oid    oid;
  v_attiva boolean;
begin
  -- 1. La vista dev'esserci. Se non c'e', qualcuno l'ha tolta e questa
  --    migrazione sta riparando qualcosa che non esiste piu'.
  select c.oid into v_oid
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'v' and c.relname = 'v_recipe_row_costs';
  if v_oid is null then
    raise exception 'La vista v_recipe_row_costs non esiste: non c''e'' niente da riparare, e questo non e'' lo stato che mi aspettavo.';
  end if;

  -- 2. E l'opzione dev'essere tornata ATTIVA.
  -- ⚠️ Si legge il VALORE, non la presenza della parola: Postgres conserva
  --    l'opzione com'e' stata scritta, e `on`, `1`, `yes` sono veri quanto
  --    `true`. Un controllo che cercasse `= 'security_invoker=true'`
  --    direbbe «manca» su una vista protetta benissimo.
  select coalesce(
           (select split_part(o, '=', 2)::boolean
              from unnest(coalesce(c.reloptions, '{}')) o
             where o like 'security_invoker=%'), false)
    into v_attiva
    from pg_class c where c.oid = v_oid;

  if not v_attiva then
    raise exception 'security_invoker NON e'' tornato attivo su v_recipe_row_costs: la vista continuerebbe a girare coi permessi del proprietario, mostrando i costi d''acquisto a chi non deve vederli.';
  end if;

  raise notice 'Fatto: v_recipe_row_costs applica di nuovo la RLS di chi la interroga.';
end $verifica$;

-- La migrazione si registra da sé
insert into applied_migrations (version, name)
values ('20260923000001', 'la_vista_dei_costi_torna_a_rispettare_la_rls')
on conflict (version) do nothing;
