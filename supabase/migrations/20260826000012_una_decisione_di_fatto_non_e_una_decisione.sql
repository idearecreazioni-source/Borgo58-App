-- ============================================================================
-- UNA DECISIONE DI FATTO NON E' UNA DECISIONE — 26/08/2026
-- ============================================================================
--
-- 🔴 BUCO NEL GUARDIANO APPENA SCRITTO, trovato ROMPENDOLO e non
--    rileggendolo. Il controllo `perimetro_da_sistemare()` della
--    `20260826000011` guarda tre casi, e il terzo e' scritto cosi':
--
--        where p.dentro = false and v.ha_trigger
--
--    Su una tabella classificata **da decidere** (`dentro` vuoto) quella
--    condizione vale `null`, quindi non scatta. Messo apposta il trigger su
--    `spesa_spicciola` — che e' fra le da decidere — il guardiano ha detto
--    «tutto a posto», e a fermare la verifica e' stato un altro controllo,
--    quello che conta le lapidi.
--
-- ⚠️ E NON E' UN CASO DI SCUOLA: e' precisamente il modo in cui il
--    perimetro si allargherebbe di nuovo in silenzio. Qualcuno attacca il
--    registro a una tabella su cui Alessio non ha ancora deciso niente,
--    e da quel momento la decisione **e' stata presa di fatto** — senza
--    che nessuno l'abbia scritta, e senza che niente lo dica. Fra sei mesi
--    quella riga vuota si legge «non deciso» mentre il gestionale sta gia'
--    facendo una cosa.
--
-- ⚠️ Perche' una migrazione nuova invece di correggere quella di un'ora
--    fa: la `…011` e' gia' stata applicata al progetto di prova, e da quel
--    momento racconta cosa e' successo. Le migrazioni applicate non si
--    riscrivono (regola di Alessio del 23/08), e la dichiarazione va nella
--    migrazione che chiude il caso.
--
-- ----------------------------------------------------------------------------
-- COSA ABBIAMO ROVESCIATO
-- ----------------------------------------------------------------------------
-- Niente. Si aggiunge un quarto caso a un guardiano nato un'ora fa, e la
-- ragione per cui mancava e' scritta sopra.
-- ============================================================================

create or replace function perimetro_da_sistemare()
returns table(tabella text, problema text, dettaglio text)
language sql
stable security definer
set search_path to 'public'
as $funzione$
  with vere as (
    select c.relname::text as t,
           exists (select 1 from pg_trigger g
                    where g.tgrelid = c.oid and not g.tgisinternal
                      and pg_get_triggerdef(g.oid) ilike '%log_deleted_record%') as ha_trigger
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r'
  )
  -- 1. Il caso dei diciotto giorni: esiste e nessuno ha detto cosa sia.
  select v.t, 'non classificata',
         'Nata dopo l''ultimo censimento e nessuno ha detto se sta dentro il registro delle cancellazioni.'
    from vere v
   where not exists (select 1 from perimetro_registro p where p.tabella = v.t)
  union all
  -- 2. Detta dentro e senza registro.
  select p.tabella, 'manca il registro', p.ragione
    from perimetro_registro p join vere v on v.t = p.tabella
   where p.dentro and not v.ha_trigger
  union all
  -- 3. Detta fuori e col registro addosso.
  select p.tabella, 'registro di troppo', p.ragione
    from perimetro_registro p join vere v on v.t = p.tabella
   where p.dentro = false and v.ha_trigger
  union all
  -- 4. 🔴 DA DECIDERE, E INTANTO QUALCUNO HA DECISO. Il caso che mancava:
  --    su `dentro` vuoto la condizione del punto 3 vale `null` e non
  --    scatta, quindi il registro poteva comparire su una tabella su cui
  --    nessuno si era pronunciato — cioe' la decisione veniva presa senza
  --    essere scritta da nessuna parte.
  select p.tabella, 'decisa di fatto',
         'Nessuno ha deciso se stia dentro, e intanto il registro c''e'' gia''. O si scrive la decisione, o si toglie il trigger. — ' || p.ragione
    from perimetro_registro p join vere v on v.t = p.tabella
   where p.dentro is null and v.ha_trigger
  union all
  -- 5. Classificata e sparita: l'elenco non deve invecchiare dall'altra parte.
  select p.tabella, 'classificata ma non esiste piu''', p.ragione
    from perimetro_registro p
   where not exists (select 1 from vere v where v.t = p.tabella)
  order by 2, 1;
$funzione$;

comment on function perimetro_da_sistemare() is
  'Cosa non torna fra il perimetro dichiarato e il registro delle cancellazioni vero. Dichiara una PROPRIETA'' e non una quantita'': non dice «devono essere 21», dice «ogni tabella ha una risposta, e il registro corrisponde alla risposta». I cinque casi: non classificata · manca il registro · registro di troppo · decisa di fatto (vuota ma col trigger addosso) · classificata ma non esiste piu''. ⚠️ Le tabelle ancora DA DECIDERE senza trigger non compaiono qui: sono uno stato legittimo, e si chiedono a `perimetro_da_decidere()`.';

revoke all on function perimetro_da_sistemare() from public, anon, authenticated;
grant execute on function perimetro_da_sistemare() to authenticated;

-- ============================================================================
-- VERIFICA
-- ============================================================================
-- ⚠️ Si prova ROMPENDO, perche' e' rompendo che il buco e' saltato fuori:
--    si mette il trigger su una tabella da decidere e ci si fa dire che
--    qualcuno ha deciso al posto di Alessio. E si controlla il verso
--    opposto — senza trigger quella stessa tabella non deve comparire —
--    perche' un guardiano che segnala tutte le ventitre da decidere
--    griderebbe sempre, e quelli si spengono.
do $verifica$
declare
  v_prima  integer;
  v_dopo   integer;
  v_scelta text;
  v_lap0   integer;
  v_lap1   integer;
begin
  select count(*) into v_prima from perimetro_da_sistemare();
  if v_prima <> 0 then
    raise exception 'Il perimetro non torna gia'' in partenza, su % voci: %', v_prima,
      (select string_agg(tabella || ' (' || problema || ')', ' · ') from perimetro_da_sistemare());
  end if;

  -- Una qualunque delle da decidere, scelta dal database e non a mano:
  -- scritta a mano sarebbe un fossile il giorno che Alessio la decide.
  select tabella into v_scelta from perimetro_registro where dentro is null order by tabella limit 1;
  if v_scelta is null then
    raise exception 'Non c''e'' nessuna tabella da decidere: questa verifica non puo'' provare niente.';
  end if;

  -- ------------------------------------------------------------------
  -- (A) SENZA TRIGGER, UNA DA DECIDERE NON DEVE COMPARIRE.
  -- ------------------------------------------------------------------
  if exists (select 1 from perimetro_da_sistemare() where tabella = v_scelta) then
    raise exception '«%» e'' solo da decidere e il guardiano la segnala gia''.', v_scelta;
  end if;

  -- ------------------------------------------------------------------
  -- (B) COL TRIGGER, DEVE DIRE CHE QUALCUNO HA DECISO DI FATTO.
  -- ------------------------------------------------------------------
  execute format('create trigger trg_log_delete before delete on %I for each row execute function log_deleted_record()', v_scelta);

  select count(*) into v_dopo from perimetro_da_sistemare();
  if v_dopo <> 1 then
    raise exception 'Il guardiano doveva vedere UNA voce e ne vede %.', v_dopo;
  end if;
  if not exists (select 1 from perimetro_da_sistemare()
                  where tabella = v_scelta and problema = 'decisa di fatto') then
    raise exception 'Il guardiano ha visto qualcosa, ma non «decisa di fatto»: %',
      (select problema from perimetro_da_sistemare() where tabella = v_scelta);
  end if;
  raise notice 'col trigger su «%» il guardiano dice: %', v_scelta,
    (select problema from perimetro_da_sistemare() where tabella = v_scelta);

  execute format('drop trigger trg_log_delete on %I', v_scelta);

  select count(*) into v_dopo from perimetro_da_sistemare();
  if v_dopo <> 0 then
    raise exception 'Tolto il trigger restano % voci.', v_dopo;
  end if;
  raise notice 'tolto il trigger, il guardiano tace: % voci', v_dopo;

  -- ------------------------------------------------------------------
  -- (C) Il registro non si e' mosso: questa verifica non cancella niente.
  -- ------------------------------------------------------------------
  select count(*) into v_lap0 from deleted_records;
  select count(*) into v_lap1 from perimetro_registro;
  raise notice 'lapidi %, classificazioni % — invariate', v_lap0, v_lap1;
end $verifica$;

insert into applied_migrations (version, name)
values ('20260826000012', 'una_decisione_di_fatto_non_e_una_decisione') on conflict (version) do nothing;
