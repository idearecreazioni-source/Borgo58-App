-- ============================================================================
-- IL CASO CHE LA VERIFICA NON PRENDEVA — 25/08/2026
-- ============================================================================
--
-- 🔴 TROVATO ROMPENDO, NON RILEGGENDO. La migrazione `…014` decide che una
--    fonte consultata tiene l'elenco degli allergeni FUORI dalla stampa
--    del menu, esattamente come una deduzione: `origine_dell_insieme`
--    mette `dedotto` e `fonte` nello stesso gruppo. Poi la sua verifica
--    prova tre origini insieme — etichetta, fonte E dedotto — e con un
--    dedotto dentro il risultato e' «stimati» comunque.
--
--    ⚠️ **Togliendo `fonte` da quel gruppo, la verifica resta VERDE.**
--    Provato sul progetto di prova, non dedotto: riscritta la funzione
--    senza `fonte` e rieseguito il blocco, e' passata senza un errore.
--    Cioe' la regola piu' delicata di quella migrazione — quella che
--    decide se un elenco di allergeni finisce stampato su un menu — non
--    era sorvegliata da niente.
--
-- ⚠️ IL CASO CHE DISCRIMINA E' UNO SOLO: **etichetta piu' fonte, senza
--    nessun dedotto**. Li' le due risposte si separano — la regola giusta
--    dice «stimati», quella rotta dice «etichetta», e «etichetta» vuol
--    dire che l'elenco si puo' stampare. E' la stessa lezione del 19/08
--    sui finger food: il numero di elementi di una prova non e' un
--    dettaglio di comodo, decide se la prova DISTINGUE o si limita a non
--    lamentarsi.
--
-- ⚠️ NON SI RISCRIVE LA `…014` (regola del 23/08): il file racconta cosa
--    e' successo quel giorno. Qui si aggiunge il caso mancante, con roba
--    propria, come la `…012` ha fatto per le tre verifiche di prima.
--
-- ✅ NON CAMBIA NESSUN COMPORTAMENTO: non c'e' una riga di codice nuova.
--    E' solo una verifica che prima non c'era.
-- ============================================================================

do $verifica$
declare
  v_tit uuid;
  v_ent uuid;
  v_mio uuid;
  v_txt text;
  v_n   integer;
  v_lapidi_pre  integer;
  v_lapidi_post integer;
begin
  select count(*) into v_lapidi_pre from deleted_records;

  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  if v_tit is null then
    raise exception 'Nessun titolare in user_roles: impossibile verificare.';
  end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);

  select id into v_ent from entities order by created_at limit 1;
  if v_ent is null then
    raise exception 'Nessuna societa'': impossibile verificare.';
  end if;

  -- Il perimetro e' fatto di roba creata qui: un prodotto proprio, mai uno
  -- di Alessio.
  insert into ingredients (entity_id, name, category, unit, current_price)
  values (v_ent, 'ZZ verifica fonte e etichetta', 'secco_dispensa', 'kg', 1.00)
  returning id into v_mio;

  -- ------------------------------------------------------------------
  -- IL CASO: etichetta + fonte, e NESSUN dedotto.
  -- ⚠️ E' l'unico punto in cui la regola giusta e quella rotta danno
  --    risposte diverse. Con un dedotto in mezzo darebbero le stesse.
  -- ------------------------------------------------------------------
  update ingredients
     set allergens = array['glutine','latte']::allergen[]
   where id = v_mio;

  insert into allergeni_prodotto (ingredient_id, allergene, origine, fonte, creato_da)
  values (v_mio, 'glutine', 'etichetta', null, v_tit),
         (v_mio, 'latte',   'fonte',     'scheda tecnica del produttore', v_tit);

  select origine_allergeni into v_txt from ingredients where id = v_mio;
  if v_txt <> 'stimati' then
    raise exception
      'Un allergene ricavato da una fonte consultata non tiene l''elenco fuori dalla stampa: l''insieme risulta «%» invece di «stimati». Cosi'' un elenco che nessuno ha letto su un''etichetta finirebbe stampato su un menu.',
      v_txt;
  end if;

  -- ------------------------------------------------------------------
  -- E il verso opposto, perche' una regola che dice sempre «stimati»
  -- passerebbe la prova qui sopra senza distinguere niente.
  -- ------------------------------------------------------------------
  delete from allergeni_prodotto where ingredient_id = v_mio and allergene = 'latte';
  update ingredients set allergens = array['glutine']::allergen[] where id = v_mio;

  select origine_allergeni into v_txt from ingredients where id = v_mio;
  if v_txt <> 'etichetta' then
    raise exception
      'Con la sola etichetta l''insieme risulta «%» invece di «etichetta»: una regola che risponde sempre «stimati» non distingue niente.',
      v_txt;
  end if;

  -- ------------------------------------------------------------------
  -- Pulizia — per identificativo
  -- ------------------------------------------------------------------
  delete from allergeni_prodotto where ingredient_id = v_mio;
  delete from ingredients where id = v_mio;

  select count(*) into v_n from ingredients where id = v_mio;
  if v_n <> 0 then raise exception 'Il prodotto della verifica e'' rimasto'; end if;

  select count(*) into v_lapidi_post from deleted_records;
  if v_lapidi_post <> v_lapidi_pre then
    raise exception 'La verifica ha lasciato % lapidi nel registro', v_lapidi_post - v_lapidi_pre;
  end if;

  perform set_config('request.jwt.claims', null, true);

  raise notice 'Il caso che mancava e'' coperto: una fonte consultata tiene l''elenco fuori dalla stampa, e la sola etichetta ce lo rimette.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260825000015', 'il_caso_che_la_verifica_non_prendeva')
on conflict (version) do nothing;
