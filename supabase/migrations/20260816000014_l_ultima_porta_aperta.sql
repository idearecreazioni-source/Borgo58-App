-- =====================================================================
-- L'ultima porta aperta per difetto
-- =====================================================================
-- Piccolezze del mandato di correzione (16/08/2026) — questa e' l'unica
-- del gruppo con un effetto di SICUREZZA e non solo di pulizia, quindi
-- viene per prima e con la verifica che il validatore ha chiesto.
--
-- `abbina_righe_carico` non ha mai avuto nessun `revoke`: i suoi permessi
-- sono quelli **predefiniti di Postgres**, che concedono l'esecuzione a
-- `public` — e quindi ad `anon`, cioe' a chiunque abbia la chiave
-- pubblica che sta nel bundle del sito. E' l'ultima rimasta dello stato
-- congelato del 13/08, e nel commento di quel giorno era gia' segnata
-- come «merita un giro suo».
--
-- ⚠️ CONTROLLATO PRIMA DI TOGLIERE, non dopo (richiesta del validatore:
-- una revoca su qualcosa che serve rompe in silenzio invece di chiudere
-- un buco). Letto col connettore:
--   · nessuna funzione di `public` la nomina nel proprio corpo;
--   · nessuna schermata la chiama (non compare fra le `rpc(` del sito);
--   · **la usa un trigger e basta**: `trg_abbina_righe_carico` su
--     `posta_azioni`.
-- Una funzione di trigger non ha bisogno del permesso di esecuzione
-- perche' il trigger scatti — lo esegue il motore per conto della
-- tabella. Toglierlo non rompe niente, e chiude una porta che non serviva
-- a nessuno.
--
-- ⚠️ CONSEGUENZA DICHIARATA: l'elenco congelato delle funzioni
-- raggiungibili con la sola chiave pubblica scende **da 12 a 11**, e la
-- prova che lo sorveglia (`tests/app/permessi.test.js`) va aggiornata
-- nella stessa consegna. E' l'unico modo ammesso di far cambiare quel
-- numero: una riga in meno, dichiarata. Se cambiasse senza che nessuno lo
-- dica, sarebbe il difetto del 12/08.
-- =====================================================================

revoke all on function abbina_righe_carico() from public, anon, authenticated;

comment on function abbina_righe_carico is
  'Funzione di trigger: abbina le righe di un carico da fattura agli ingredienti conosciuti. Dal 16/08/2026 non e'' piu'' eseguibile da nessun ruolo applicativo — la esegue il motore per conto del trigger su posta_azioni, che non ha bisogno di permessi. Era l''ultima rimasta coi permessi predefiniti di Postgres, cioe'' aperta a chiunque abbia la chiave pubblica del sito.';

-- ---------------------------------------------------------------------
-- Verifica sul campo (§5 punti 1-3)
-- ---------------------------------------------------------------------
do $verifica$
declare
  n integer;
begin
  -- 1. La porta e' chiusa.
  if has_function_privilege('anon', 'abbina_righe_carico()', 'execute') then
    raise exception 'abbina_righe_carico e'' ancora eseguibile con la sola chiave pubblica.';
  end if;
  if has_function_privilege('authenticated', 'abbina_righe_carico()', 'execute') then
    raise exception 'abbina_righe_carico e'' ancora eseguibile dal gestionale: non serve a nessuno li'' dentro.';
  end if;

  -- 2. ⚠️ E IL TRIGGER FUNZIONA ANCORA. Togliere un permesso a una
  -- funzione di trigger non dovrebbe cambiare niente — ma «non dovrebbe»
  -- non e' una verifica: qui si controlla che il trigger sia ancora
  -- attaccato e acceso, che e' la parte che si potrebbe rompere in
  -- silenzio.
  select count(*) into n
    from pg_trigger
   where tgname = 'trg_abbina_righe_carico'
     and tgrelid = 'posta_azioni'::regclass
     and not tgisinternal
     and tgenabled <> 'D';
  if n <> 1 then
    raise exception 'Il trigger che abbina le righe del carico non e'' piu'' attivo su posta_azioni.';
  end if;

  -- 3. L'elenco congelato e' sceso di uno e non di piu'.
  select count(*) into n
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute');
  if n <> 11 then
    raise exception
      'Le funzioni raggiungibili con la sola chiave pubblica sono %, non le 11 attese: la revoca ha toccato piu'' del previsto, o qualcosa e'' cambiato.', n;
  end if;

  raise notice 'L''elenco delle funzioni aperte alla chiave pubblica e'' sceso da 12 a %.', n;
end $verifica$;

insert into applied_migrations (version, name)
values ('20260816000014', 'l_ultima_porta_aperta')
on conflict (version) do nothing;

select
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')) as aperte_alla_chiave_pubblica,
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proacl is null)                                 as senza_permessi_dichiarati;
