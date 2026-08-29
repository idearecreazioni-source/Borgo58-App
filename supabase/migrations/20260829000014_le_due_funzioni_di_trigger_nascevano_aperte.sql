-- =====================================================================
-- LE DUE FUNZIONI DI TRIGGER NASCEVANO APERTE
-- 29/08/2026 — coda del Blocco 2 del mandato del 29/08 (sera)
-- =====================================================================
-- 🔴 DIFETTO MIO, e non è nuovo: è la trappola scritta in CLAUDE.md §8 dal
-- 15/08/2026 — *«anche una funzione trigger nasce eseguibile da chiunque
-- abbia la chiave pubblica»* — ripetuta oggi, poche ore dopo aver letto
-- quel documento.
--
-- Le due nate stanotte, `normalizza_stagionalita()` e
-- `vieta_non_alimentare_in_ricetta()`, sono state create senza il
-- `revoke`: Postgres concede l'esecuzione a `public` per impostazione
-- predefinita, e Supabase espone via PostgREST tutto ciò che `anon` può
-- eseguire. L'elenco delle funzioni raggiungibili con la sola chiave
-- pubblica è passato da **13 a 15**.
--
-- ⚠️ **Nessun dato usciva**: fuori da un trigger queste due si rifiutano di
-- girare (`NEW` non esiste). Ma **quell'elenco non deve crescere in
-- silenzio**, ed è precisamente la regola nata il 13/08 quando era
-- cresciuto da 12 a 14 senza che nessuno lo dicesse.
--
-- ✅ **E a prenderlo è stata la rete, non la memoria.** La prova
-- `tests/app/permessi.test.js` è diventata rossa da sola nominando le due
-- funzioni comparse — che è esattamente il lavoro per cui esiste, e la
-- ragione per cui un elenco scritto a mano in un documento non basta.
--
-- ⚠️ **Non riscrivo le due migrazioni che le hanno create** (`…011` e
-- `…012`): sono già applicate sul progetto di prova, e una migrazione
-- applicata non si riscrive mai (regola di Alessio, 23/08). Quei file
-- raccontano cosa è successo quella notte, questo racconta cosa è
-- successo un'ora dopo.
-- =====================================================================

revoke all on function normalizza_stagionalita() from public, anon, authenticated;
revoke all on function vieta_non_alimentare_in_ricetta() from public, anon, authenticated;

-- =====================================================================
-- VERIFICA
-- =====================================================================
do $verifica$
declare
  v_foto   jsonb := foto_righe();
  v_aperte integer;
  v_nomi   text;
  v_atteso integer := 13;
begin
  -- (1) LE DUE NON SONO PIÙ RAGGIUNGIBILI CON LA CHIAVE PUBBLICA.
  select count(*) into v_aperte
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in ('normalizza_stagionalita', 'vieta_non_alimentare_in_ricetta')
     and has_function_privilege('anon', p.oid, 'execute');
  if v_aperte <> 0 then
    raise exception 'Le funzioni di trigger sono ancora aperte ad anon (%).', v_aperte;
  end if;

  -- (2) E L'ELENCO È TORNATO A TREDICI. ⚠️ Il numero non è una fotografia
  --     travestita da regola: è il conteggio che `tests/app/permessi.test.js`
  --     dichiara nome per nome, e se cambia una delle due cose l'altra
  --     diventa rossa. Il messaggio dice QUALI sono, non solo quante.
  select count(*), string_agg(p.proname, ', ' order by p.proname)
    into v_aperte, v_nomi
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute');
  if v_aperte <> v_atteso then
    raise exception 'Con la chiave pubblica si eseguono % funzioni invece di %: %',
      v_aperte, v_atteso, v_nomi;
  end if;

  -- (3) 🔴 E I DUE TRIGGER DEVONO CONTINUARE A FUNZIONARE: un `revoke` su
  --     una funzione di trigger non deve fermarla, perché il motore la
  --     esegue per conto della tabella e non per conto di un utente.
  --     Senza questo controllo, la cura del permesso potrebbe aver spento
  --     una regola — e la stagionalità tornerebbe a scriversi in dodici
  --     pezzi senza che niente lo dica.
  if not exists (select 1 from pg_trigger
                  where tgrelid = 'ingredients'::regclass
                    and tgname = 'trg_normalizza_stagionalita' and tgenabled = 'O') then
    raise exception 'Il trigger della stagionalita'' non e'' piu'' acceso.';
  end if;
  if not exists (select 1 from pg_trigger
                  where tgrelid = 'recipe_ingredients'::regclass
                    and tgname = 'trg_vieta_non_alimentare_in_ricetta' and tgenabled = 'O') then
    raise exception 'Il trigger dei materiali di consumo non e'' piu'' acceso.';
  end if;

  perform pretendi_nessun_residuo(v_foto, 'la verifica dei permessi delle funzioni di trigger');
  raise notice 'Le due funzioni di trigger sono chiuse, e i due trigger funzionano lo stesso. Con la chiave pubblica si eseguono % funzioni.', v_aperte;
end
$verifica$;

insert into applied_migrations (version, name)
values ('20260829000014', 'le_due_funzioni_di_trigger_nascevano_aperte') on conflict (version) do nothing;
