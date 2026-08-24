-- =====================================================================
-- LA VERIFICA CHE ORA HA BISOGNO DEI CLAIMS
-- 24/08/2026 — coda della 20260824000013, aggiunta e non riscritta
-- =====================================================================
-- 🔴 TROVATO DA UNA RETE DEL PROGETTO, la terza in una sera:
--
--   tests/app/migrazioni-senza-portieri.test.js
--   «20260824000012 chiama spiega_vincolo() in un blocco senza impostare
--    i claims»
--
-- ⚠️ E QUANDO L'HO SCRITTA ERA GIUSTA: la 012 crea `spiega_vincolo()`
-- **senza portiere** e la chiama subito dopo per verificarla. Poi la 013
-- — la migrazione successiva, di poche ore dopo — le ha messo il portiere.
-- Da quel momento quella chiamata **e' diventata fragile**, senza che
-- nessuna riga della 012 sia cambiata.
--
-- 🔴 IL CASO IN CUI MORDE, misurato non ipotizzato: girando le migrazioni
-- in ordine da zero la 012 passa, perche' in quel momento il portiere non
-- c'e' ancora. **Ma riapplicandola dopo la 013** — cosa che si fa con
-- `npm run prova:migra <nome>`, ed e' successo piu' volte stanotte — la
-- verifica fallirebbe con «Operazione consentita solo a un utente
-- autenticato», e chi la legge cercherebbe un difetto nel portiere invece
-- che nell'ordine.
--
-- ⚠️ E' LA STESSA FAMIGLIA DELLE FRASI DIVENTATE FALSE, su un blocco di
-- verifica invece che su una schermata: era vera quando e' stata scritta,
-- l'ha resa falsa qualcosa che e' successo dopo. Con l'aggravante che a
-- rendere falsa la 012 e' stata **la migrazione che le sta accanto**.
--
-- ⚠️ La 012 non si riscrive (regola del 23/08). La verifica buona sta
-- qui, con i claims impostati come fanno tutti i blocchi di verifica di
-- questo progetto.
-- =====================================================================

do $verifica$
declare
  v_titolare uuid;
  v_frase    text;
  v_senza    integer;
begin
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  if v_titolare is null then
    raise exception 'Nessun titolare in user_roles: impossibile verificare.';
  end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

  -- (a) La spiegazione si legge, ora che chi chiede ha un nome.
  v_frase := spiega_vincolo('scenario_frazioni_sono_frazioni');
  if v_frase is null or v_frase not ilike '%frazione%' then
    raise exception 'Il vincolo delle frazioni non ha restituito la sua spiegazione.';
  end if;

  -- (b) Un nome inesistente resta VUOTO, non inventa e non solleva.
  if spiega_vincolo('vincolo-che-non-esiste-828') is not null then
    raise exception 'Un vincolo inesistente ha restituito qualcosa.';
  end if;

  -- (c) La proprieta' che conta: ogni vincolo delle reti ha la sua
  --     spiegazione. Diventa rossa il giorno che qualcuno ne aggiunge uno
  --     muto — cioe' un rifiuto che nessuno sa tradurre.
  select count(*) into v_senza
    from pg_constraint c
    join pg_namespace n on n.oid = c.connamespace
   where n.nspname = 'public'
     and c.contype = 'c'
     and c.conname in (
       'fiscal_settings_aliquote_in_punti',
       'fiscal_settings_numeri_sensati',
       'scenario_frazioni_sono_frazioni',
       'scenario_numeri_sensati',
       'scenario_mesi_servizi_sensati',
       'supplier_invoices_importo_non_negativo',
       'payslips_importi_sensati',
       'cessioni_numeri_sensati',
       'service_settings_soglia_rincaro_valida',
       'ingredients_scarto_sotto_cento',
       'recipe_ingredienti_numeri_sensati',
       'ingredients_durate_sensate',
       'crops_raccolto_non_negativo',
       'temperature_dentro_il_mondo'
     )
     and obj_description(c.oid, 'pg_constraint') is null;

  if v_senza > 0 then
    raise exception '% vincoli delle reti non hanno la loro spiegazione in italiano.', v_senza;
  end if;

  -- (d) ⚠️ E IL PORTIERE MORDE DAVVERO. Senza questa prova, la verifica
  --     passerebbe anche il giorno che qualcuno lo togliesse — e la
  --     spiegazione tornerebbe leggibile con la sola chiave pubblica
  --     senza che nessuno se ne accorga.
  declare
    v_respinto boolean := false;
  begin
    perform set_config('request.jwt.claims', '', true);
    begin
      perform spiega_vincolo('scenario_frazioni_sono_frazioni');
    exception when others then v_respinto := true;
    end;
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);
    if not v_respinto then
      raise exception 'Senza utente la spiegazione si legge lo stesso: il portiere non morde.';
    end if;
  end;

  raise notice 'Le spiegazioni dei vincoli si leggono da chi lavora, e solo da lui: quattordici controllate.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260824000014', 'la_verifica_che_ora_ha_bisogno_dei_claims') on conflict (version) do nothing;

-- ---------------------------------------------------------------------
-- La dichiarazione che chiude il caso presso la rete
-- ---------------------------------------------------------------------
-- ⚠️ La rete `migrazioni-senza-portieri` guarda il TESTO delle migrazioni,
-- e il testo della 012 non cambia: continuerebbe a gridare per sempre, e
-- un guardiano che grida sempre si impara a spegnere. La dichiarazione
-- sta QUI — nella migrazione che chiude il caso, non in quella che lo ha
-- causato — perche' le migrazioni gia' applicate non si riscrivono.
--
-- ⚠️ E non spegne la rete: tace solo su questa coppia. Ogni altro caso
-- continua a gridare, e la prova lo verifica rompendolo.
--
-- rete-portieri: 20260824000012 chiama spiega_vincolo — quando quel file
-- e' stato scritto la funzione NON aveva portiere: gliel'ha messo la 013,
-- poche ore dopo. Applicando le migrazioni in ordine da zero la 012 gira
-- prima della 013 e passa; il caso in cui morde e' la RIAPPLICAZIONE
-- singola, e la verifica buona — con i claims — e' qui sopra.
