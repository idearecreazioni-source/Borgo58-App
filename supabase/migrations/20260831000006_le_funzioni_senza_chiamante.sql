-- =====================================================================
-- CHI NON E' CHIAMATO DA NESSUNO, DENTRO IL DATABASE — 31/08/2026
-- =====================================================================
--
-- 🔴 IL TELAIO DI UNA FAMIGLIA, non la cura di un caso. In due giorni questo
-- progetto ha costruito **quattro volte** qualcosa nel database che nessuna
-- schermata poteva chiedere:
--   · 13/08 — la soglia di magazzino: esisteva, e nessuna schermata la
--     scriveva. La lista della spesa non poteva riempirsi, e **sembrava che
--     funzionasse**;
--   · 31/08 — `speso_dalla_tasca()`: costruita, col portiere giusto, e
--     chiamata da **nessuno**. La Prima nota mostrava un saldo negativo,
--     cioe' precisamente la cosa che quella funzione doveva evitare;
--   · 31/08 — `mondi_del_magazzino()`: sette mondi provati e applicati,
--     mentre il Magazzino restava a due;
--   · 31/08 — `carta_da_ristampare()` e `segna_carta_stampata()`: costruite
--     e **dichiarate senza schermata in un riepilogo**, cioe' un debito
--     scritto invece che un difetto trovato.
--
-- 🔴 E LE PRIME TRE LE HA TROVATE ALESSIO CON GLI OCCHI, in dieci minuti.
-- Tre volte non e' distrazione: e' che il metodo di verifica non aveva un
-- modo di accorgersene. *Questa funzione e' quel modo.*
--
-- ---------------------------------------------------------------------
-- COSA RISPONDE, e cosa NON risponde
-- ---------------------------------------------------------------------
-- Risponde a: **chi, dentro il database, non e' chiamato da nessun altro** —
-- ne' dal corpo di un'altra funzione, ne' da un trigger.
--
-- ⚠️ DA SOLA NON BASTA, ed e' voluto: il database non puo' sapere se una
-- schermata la nomini. La meta' che manca la mette la prova
-- `tests/app/funzioni-senza-schermata.test.js`, che legge `src/` e incrocia.
-- Qui si risponde a *«e' un pezzo interno?»*; li' a *«c'e' una porta?»*.
--
-- ⚠️ SI GUARDANO SOLO LE FUNZIONI ESEGUIBILI DA `authenticated`: una che
-- nessun ruolo puo' chiamare e' gia' coperta da un'altra rete
-- (`funzioni_aperte_ad_anon`, `funzioni_senza_portiere`), e trattarla come
-- orfana darebbe allarmi su porte volutamente chiuse.

create or replace function funzioni_senza_chiamante()
returns table (nome text)
language sql
stable
security definer
set search_path = public
as $$
  with mie as (
    select p.oid, p.proname::text as nome
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     -- ⚠️ `prokind = 'f'`: le aggregate non hanno un corpo da leggere, e
     --    `pg_get_functiondef` su una di loro solleva un errore che
     --    fermerebbe tutta la query (trappola del 27/08).
     where n.nspname = 'public' and p.prokind = 'f'
       and has_function_privilege('authenticated', p.oid, 'execute')
  )
  select m.nome
    from mie m
   where not exists (
     -- La chiama il CORPO di un'altra funzione? Allora e' un pezzo interno.
     -- ⚠️ `q.oid <> m.oid`: la propria definizione contiene il proprio nome,
     --    e senza questa riga nessuna funzione risulterebbe mai orfana.
     select 1
       from pg_proc q
       join pg_namespace n2 on n2.oid = q.pronamespace
      where n2.nspname = 'public' and q.prokind = 'f' and q.oid <> m.oid
        and pg_get_functiondef(q.oid) ~ ('\m' || m.nome || '\M')
   )
     and not exists (select 1 from pg_trigger t where t.tgfoid = m.oid)
   order by 1;
$$;

comment on function funzioni_senza_chiamante is
  'Le funzioni che dentro il database non chiama nessuno: ne'' un''altra '
  'funzione, ne'' un trigger. ⚠️ NON dice che siano orfane — dice che se una '
  'porta esiste, sta FUORI dal database. A incrociare con `src/` e'' la prova '
  '`tests/app/funzioni-senza-schermata.test.js`.';

revoke all on function funzioni_senza_chiamante() from public, anon, authenticated;
grant execute on function funzioni_senza_chiamante() to authenticated;

-- ---------------------------------------------------------------------
-- VERIFICA
-- ---------------------------------------------------------------------
do $verifica$
declare v_n integer; v_ha_interna boolean; v_ha_orfana boolean;
begin
  select count(*) into v_n from funzioni_senza_chiamante();
  if v_n = 0 then
    raise exception 'La funzione non trova NESSUNO: quasi certamente il setaccio e'' rotto.';
  end if;

  -- ⚠️ TARATURA SU CASI DI RISPOSTA NOTA (regola del 26/08), e serve nei DUE
  --    versi: un setaccio che dice «tutti» e uno che dice «nessuno» sono
  --    ugualmente inutili, e tutti e due sembrano funzionare.
  --
  --    `euro()` la chiamano decine di funzioni per formattare un importo:
  --    NON deve comparire. `mondi_del_magazzino()` non la chiama nessuno:
  --    deve comparire.
  select exists (select 1 from funzioni_senza_chiamante() where nome = 'euro')
    into v_ha_interna;
  if v_ha_interna then
    raise exception 'Il setaccio dice che «euro» non e'' chiamata da nessuno: e'' rotto.';
  end if;

  select exists (select 1 from funzioni_senza_chiamante() where nome = 'mondi_del_magazzino')
    into v_ha_orfana;
  if not v_ha_orfana then
    raise exception 'Il setaccio non vede «mondi_del_magazzino», che non chiama nessuno: e'' rotto.';
  end if;

  raise notice 'Fatto: % funzioni non hanno un chiamante dentro il database. Tarato nei due versi.', v_n;
end $verifica$;

insert into applied_migrations (version, name)
values ('20260831000006', 'le_funzioni_senza_chiamante') on conflict (version) do nothing;
