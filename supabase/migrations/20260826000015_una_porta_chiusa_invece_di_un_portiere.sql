-- ============================================================================
-- UNA PORTA CHIUSA INVECE DI UN PORTIERE — 26/08/2026
-- ============================================================================
--
-- 🔴 LA `…014` HA CURATO UN DIFETTO E NE HA APERTO UN ALTRO, e lo ha detto
--    un'altra rete un minuto dopo. Mettendo il portiere `is_titolare()`
--    dentro `perimetro_da_sistemare()`, le verifiche delle migrazioni
--    `…011` e `…012` — che quella funzione la chiamano — sono diventate
--    **fragili**: una migrazione non ha un utente, ha un proprietario,
--    quindi su una ricostruzione da zero quelle due si fermerebbero.
--
--    A dirlo e' stata `tests/app/migrazioni-senza-portieri.test.js`, che
--    l'elenco delle funzioni col portiere se lo costruisce dal catalogo:
--    e' lo stesso caso gia' documentato in quella prova, dove la `…013`
--    del 24/08 rese fragile una chiamata della `…012` senza che una sola
--    riga di quel file fosse cambiata.
--
-- ----------------------------------------------------------------------------
-- LA CURA GIUSTA ERA L'ALTRA, E LA MISURA LO DICE
-- ----------------------------------------------------------------------------
-- Le strade erano due, e non si equivalgono:
--
--   (a) DICHIARARE la chiamata con `rete-portieri:` e lasciare il portiere.
--       Zittisce la rete, e **lascia in piedi il problema vero**: quelle
--       due migrazioni andrebbero saltate per sempre in ogni ricostruzione
--       da zero, come gia' succede per la `20260824000030` e la `…033`.
--       Un debito che si paga ogni volta che qualcuno ricostruisce.
--
--   (b) TOGLIERE il portiere e insieme la concessione: la funzione resta
--       `security definer`, ma **non e' piu' eseguibile da nessun accesso**
--       — solo da chi ha il database in mano. Le migrazioni tornano a
--       chiamarla senza problemi, e chi non deve leggerla non ci arriva
--       lo stesso, perche' la porta non c'e'.
--
-- Si prende la (b), ed e' il precedente di `uscite_future` (19/08): quando
-- nessuna schermata chiama una funzione, la si CHIUDE invece di dotarla di
-- un portiere. ⚠️ Misurato prima di sceglierlo: `perimetro_da_sistemare` e
-- `perimetro_da_decidere` non sono chiamate da nessun punto di `src/`.
--
-- ⚠️ E IL GIORNO CHE SERVIRANNO A UNA SCHERMATA la strada e' scritta qui:
--    si rimette il portiere, si ridà il `grant`, **e si dichiara con
--    `rete-portieri:` ogni migrazione che le chiama** — cioe' si paga
--    allora il prezzo che oggi non ha senso pagare.
--
-- ----------------------------------------------------------------------------
-- COSA ABBIAMO ROVESCIATO
-- ----------------------------------------------------------------------------
-- Si rovescia la `…014`, di un'ora fa. La sua ragione — «ogni
-- `security definer` ha il suo portiere», 13/08 — **vale ancora intera**:
-- quello che cambia e' che qui il modo di rispettarla non e' mettere un
-- portiere a una porta che nessuno attraversa, ma **togliere la porta**.
-- La regola del 13/08 dice che nessuno deve poter scavalcare la RLS senza
-- essere riconosciuto, e una funzione che nessun accesso puo' eseguire
-- soddisfa quella regola meglio di una che li respinge uno per uno.
--
-- rete-guardie: perimetro_da_sistemare — il portiere si toglie APPOSTA, insieme al grant: senza concessione nessun accesso ci arriva, e la funzione torna chiamabile da una migrazione. La rete ha ragione a segnalarlo, ed e' il caso in cui la dichiarazione serve.
-- rete-guardie: perimetro_da_decidere — stessa ragione della sorella: portiere e grant se ne vanno insieme, e togliere solo uno dei due sarebbe il difetto.
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
  -- 4. 🔴 Da decidere, e intanto qualcuno ha deciso: su `dentro` vuoto la
  --    condizione del punto 3 vale `null` e non scatta, quindi il registro
  --    poteva comparire su una tabella su cui nessuno si era pronunciato.
  select p.tabella, 'decisa di fatto',
         'Nessuno ha deciso se stia dentro, e intanto il registro c''e'' gia''. O si scrive la decisione, o si toglie il trigger. — ' || p.ragione
    from perimetro_registro p join vere v on v.t = p.tabella
   where p.dentro is null and v.ha_trigger
  union all
  -- 5. Classificata e sparita.
  select p.tabella, 'classificata ma non esiste piu''', p.ragione
    from perimetro_registro p
   where not exists (select 1 from vere v where v.t = p.tabella)
  order by 2, 1;
$funzione$;

comment on function perimetro_da_sistemare() is
  'Cosa non torna fra il perimetro dichiarato e il registro delle cancellazioni vero. Dichiara una PROPRIETA'' e non una quantita''. I cinque casi: non classificata · manca il registro · registro di troppo · decisa di fatto · classificata ma non esiste piu''. ⚠️ NON e'' concessa a nessun accesso: ci si arriva solo col database in mano. Il giorno che servira'' a una schermata, si rimette il portiere `is_titolare()`, si ridà il grant, e si dichiara con `rete-portieri:` ogni migrazione che la chiama.';

revoke all on function perimetro_da_sistemare() from public, anon, authenticated;

create or replace function perimetro_da_decidere()
returns table(tabella text, ragione text)
language sql
stable security definer
set search_path to 'public'
as $funzione$
  select p.tabella, p.ragione from perimetro_registro p
   where p.dentro is null order by p.tabella;
$funzione$;

comment on function perimetro_da_decidere() is
  'Le tabelle su cui nessuno ha ancora deciso se stiano dentro il registro delle cancellazioni. Vuoto non e'' un no: e'' una domanda aperta, e si vede invece di sparire. ⚠️ Non concessa a nessun accesso, come la sorella.';

revoke all on function perimetro_da_decidere() from public, anon, authenticated;

-- ============================================================================
-- VERIFICA
-- ============================================================================
-- ⚠️ Si prova la cosa che serve DAVVERO: che una migrazione — cioe' chi non
--    ha nessun utente addosso — possa chiamarle. E' esattamente cio' che
--    la `…014` aveva rotto, e che nessuna rilettura di quel file avrebbe
--    mostrato: lo ha mostrato una prova che guarda le altre migrazioni.
do $verifica$
declare
  v_n     integer;
  v_dec   integer;
  v_staff uuid;
  v_passa boolean;
begin
  -- (A) SENZA NESSUN CLAIM — come una migrazione — devono rispondere.
  perform set_config('request.jwt.claims', null, true);
  select count(*) into v_n from perimetro_da_sistemare();
  if v_n <> 0 then
    raise exception 'Il perimetro non torna su % voci: %', v_n,
      (select string_agg(tabella || ' (' || problema || ')', ' · ') from perimetro_da_sistemare());
  end if;
  select count(*) into v_dec from perimetro_da_decidere();
  if v_dec = 0 then
    raise exception 'Non risulta nessuna tabella da decidere, e ce ne sono.';
  end if;
  raise notice 'senza claims (come una migrazione): 0 da sistemare, % da decidere', v_dec;

  -- (B) E NESSUN ACCESSO PUO' ESEGUIRLE. Si chiede al catalogo dei
  --     permessi, non provando a chiamarle: dentro questo blocco si e'
  --     comunque proprietari, quindi una chiamata riuscirebbe sempre e
  --     non proverebbe niente.
  if has_function_privilege('authenticated', 'public.perimetro_da_sistemare()', 'execute')
     or has_function_privilege('anon', 'public.perimetro_da_sistemare()', 'execute')
     or has_function_privilege('authenticated', 'public.perimetro_da_decidere()', 'execute')
     or has_function_privilege('anon', 'public.perimetro_da_decidere()', 'execute') then
    raise exception 'Una delle due funzioni del perimetro e'' ancora eseguibile da un accesso.';
  end if;
  raise notice 'nessun accesso puo'' eseguirle: la porta non c''e''';

  -- (C) E il portiere non c'e' piu' nel corpo: e' cio' che rende di nuovo
  --     innocue le chiamate dentro le migrazioni `…011` e `…012`.
  --     ⚠️ Si guarda il CATALOGO e non `funzioni_col_portiere()`: quella ha
  --     essa stessa un portiere, e chiamata da qui — dove non c'e' nessun
  --     utente — risponde «riservata al titolare». Ci si e' fermati sopra
  --     la prima volta, ed e' lo stesso caso che questa migrazione cura.
  --     Il criterio riconosciuto e' quello di `funzioni_col_portiere()`,
  --     ricopiato qui perche' e' l'unico modo di chiederlo senza portiere.
  if exists (
    select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public'
     where p.proname in ('perimetro_da_sistemare', 'perimetro_da_decidere')
       and (pg_get_functiondef(p.oid) ~ 'not\s+\(?\s*(select\s+)?is_titolare\s*\(\s*\)'
         or pg_get_functiondef(p.oid) ~ 'auth\.uid\s*\(\s*\)\s+is\s+null')
  ) then
    raise exception 'Una delle due risulta ancora col portiere: le migrazioni che la chiamano resterebbero fragili.';
  end if;
  raise notice 'nessun portiere nel corpo: le migrazioni …011 e …012 tornano a girare su una ricostruzione da zero';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260826000015', 'una_porta_chiusa_invece_di_un_portiere') on conflict (version) do nothing;
