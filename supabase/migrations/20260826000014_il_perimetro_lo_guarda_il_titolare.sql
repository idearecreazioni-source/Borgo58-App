-- ============================================================================
-- IL PERIMETRO LO GUARDA IL TITOLARE — 26/08/2026
-- ============================================================================
--
-- 🔴 DIFETTO MIO, TROVATO DA UNA RETE CHE ESISTEVA GIA'. Le due funzioni
--    del perimetro nate un'ora fa — `perimetro_da_sistemare()` e
--    `perimetro_da_decidere()` — sono `security definer` e concesse ad
--    `authenticated` **senza portiere**: dentro non c'e' nessun
--    `is_titolare()`, quindi giravano coi permessi della proprietaria per
--    chiunque avesse un accesso, staff compreso.
--
--    A dirlo e' stata `tests/app/permessi.test.js`, diventata rossa da
--    sola: l'elenco delle funzioni che scavalcano la RLS senza chiedere
--    chi sei e' passato da 23 a 25, e le due in piu' erano le mie. ⚠️ Quella
--    prova l'elenco se lo costruisce dal catalogo a ogni esecuzione — e' il
--    motivo per cui se n'e' accorta senza che nessuno si ricordasse di
--    aggiornarla.
--
-- ⚠️ COSA USCIVA, detto senza gonfiarlo: i nomi delle tabelle del
--    gestionale e le ragioni per cui stanno dentro o fuori dal registro
--    delle cancellazioni. Non sono soldi e non sono dati di persone. Ma la
--    regola del 13/08 non ammette eccezioni per il contenuto — ogni
--    `security definer` ha il suo portiere — e proprio perche' qui il
--    danno sarebbe piccolo, questo e' il caso in cui l'eccezione si
--    concede volentieri e poi la volta dopo si concede su qualcosa che
--    conta.
--
-- ⚠️ Perche' una migrazione nuova: la `…011` e la `…012` sono gia' state
--    applicate al progetto di prova, e le migrazioni applicate non si
--    riscrivono (regola del 23/08). La correzione va nella migrazione che
--    chiude il caso.
--
-- ----------------------------------------------------------------------------
-- COSA ABBIAMO ROVESCIATO
-- ----------------------------------------------------------------------------
-- Niente. Si applica una regola in vigore dal 13/08 a due funzioni che le
-- erano sfuggite per un'ora.
-- ============================================================================

-- ⚠️ Diventano `plpgsql`: in `language sql` il portiere non si puo'
--    scrivere prima della query. Il corpo della domanda resta identico —
--    e' lo stesso di `20260826000012`, che ha aggiunto il quarto caso.
create or replace function perimetro_da_sistemare()
returns table(tabella text, problema text, dettaglio text)
language plpgsql
stable security definer
set search_path to 'public'
as $funzione$
begin
  if not is_titolare() then
    raise exception 'Il perimetro del registro delle cancellazioni e'' riservato al titolare.';
  end if;

  return query
  with vere as (
    select c.relname::text as t,
           exists (select 1 from pg_trigger g
                    where g.tgrelid = c.oid and not g.tgisinternal
                      and pg_get_triggerdef(g.oid) ilike '%log_deleted_record%') as ha_trigger
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r'
  )
  -- 1. Il caso dei diciotto giorni: esiste e nessuno ha detto cosa sia.
  select v.t, 'non classificata'::text,
         'Nata dopo l''ultimo censimento e nessuno ha detto se sta dentro il registro delle cancellazioni.'::text
    from vere v
   where not exists (select 1 from perimetro_registro p where p.tabella = v.t)
  union all
  -- 2. Detta dentro e senza registro.
  select p.tabella, 'manca il registro'::text, p.ragione
    from perimetro_registro p join vere v on v.t = p.tabella
   where p.dentro and not v.ha_trigger
  union all
  -- 3. Detta fuori e col registro addosso.
  select p.tabella, 'registro di troppo'::text, p.ragione
    from perimetro_registro p join vere v on v.t = p.tabella
   where p.dentro = false and v.ha_trigger
  union all
  -- 4. 🔴 Da decidere, e intanto qualcuno ha deciso: su `dentro` vuoto la
  --    condizione del punto 3 vale `null` e non scatta.
  select p.tabella, 'decisa di fatto'::text,
         ('Nessuno ha deciso se stia dentro, e intanto il registro c''e'' gia''. O si scrive la decisione, o si toglie il trigger. — ' || p.ragione)::text
    from perimetro_registro p join vere v on v.t = p.tabella
   where p.dentro is null and v.ha_trigger
  union all
  -- 5. Classificata e sparita.
  select p.tabella, 'classificata ma non esiste piu'''::text, p.ragione
    from perimetro_registro p
   where not exists (select 1 from vere v where v.t = p.tabella)
  order by 2, 1;
end $funzione$;

comment on function perimetro_da_sistemare() is
  'Cosa non torna fra il perimetro dichiarato e il registro delle cancellazioni vero. Dichiara una PROPRIETA'' e non una quantita'': non dice «devono essere 21», dice «ogni tabella ha una risposta, e il registro corrisponde alla risposta». I cinque casi: non classificata · manca il registro · registro di troppo · decisa di fatto · classificata ma non esiste piu''. Riservata al titolare.';

revoke all on function perimetro_da_sistemare() from public, anon, authenticated;
grant execute on function perimetro_da_sistemare() to authenticated;

create or replace function perimetro_da_decidere()
returns table(tabella text, ragione text)
language plpgsql
stable security definer
set search_path to 'public'
as $funzione$
begin
  if not is_titolare() then
    raise exception 'Il perimetro del registro delle cancellazioni e'' riservato al titolare.';
  end if;

  return query
    select p.tabella, p.ragione from perimetro_registro p
     where p.dentro is null order by p.tabella;
end $funzione$;

comment on function perimetro_da_decidere() is
  'Le tabelle su cui nessuno ha ancora deciso se stiano dentro il registro delle cancellazioni. Vuoto non e'' un no: e'' una domanda aperta, e si vede invece di sparire. Riservata al titolare.';

revoke all on function perimetro_da_decidere() from public, anon, authenticated;
grant execute on function perimetro_da_decidere() to authenticated;

-- ============================================================================
-- VERIFICA
-- ============================================================================
-- ⚠️ IL PORTIERE SI PROVA DA CHI NON DEVE PASSARE, non da chi deve: una
--    verifica che chiama la funzione da titolare e la vede rispondere non
--    ha provato il portiere — ha provato la query.
do $verifica$
declare
  v_tit    uuid;
  v_staff  uuid;
  v_n      integer;
  v_passa  boolean;
begin
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  select user_id into v_staff from user_roles where role <> 'titolare' limit 1;
  if v_tit is null or v_staff is null then
    raise exception 'Servono un titolare e un accesso non titolare: questa verifica non puo'' girare.';
  end if;

  -- (A) Il titolare passa, e la risposta e' quella di prima.
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);
  select count(*) into v_n from perimetro_da_sistemare();
  if v_n <> 0 then
    raise exception 'Il perimetro non torna su % voci: %', v_n,
      (select string_agg(tabella || ' (' || problema || ')', ' · ') from perimetro_da_sistemare());
  end if;
  select count(*) into v_n from perimetro_da_decidere();
  if v_n = 0 then
    raise exception 'Non risulta nessuna tabella da decidere, e ce ne sono.';
  end if;
  raise notice 'il titolare passa: 0 da sistemare, % da decidere', v_n;

  -- (B) 🔴 CHI NON E' IL TITOLARE VIENE RESPINTO. Tutte e due.
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);

  v_passa := true;
  begin
    perform count(*) from perimetro_da_sistemare();
  exception when others then
    v_passa := false;
  end;
  if v_passa then
    raise exception 'Un accesso che non e'' il titolare ha letto il perimetro da sistemare.';
  end if;

  v_passa := true;
  begin
    perform count(*) from perimetro_da_decidere();
  exception when others then
    v_passa := false;
  end;
  if v_passa then
    raise exception 'Un accesso che non e'' il titolare ha letto le tabelle da decidere.';
  end if;
  raise notice 'chi non e'' il titolare viene respinto su tutte e due';

  perform set_config('request.jwt.claims', null, true);
end $verifica$;

insert into applied_migrations (version, name)
values ('20260826000014', 'il_perimetro_lo_guarda_il_titolare') on conflict (version) do nothing;
