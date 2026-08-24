-- =====================================================================
-- I DICIASSETTE CONFRONTI COL FOGLIO REGGONO ANCHE CON LE FORME
-- 24/08/2026 — coda della 20260824000029
-- =====================================================================
-- Il mandato delle linee lo dice: *«i 17 confronti col foglio vero
-- andrebbero rifatti: è il banco di prova che dal 15/08 dice se il
-- gestionale calcola come il modello di Alessio»*.
--
-- ⚠️ MISURATO: i confronti sono **17** e sono ancora quelli — la struttura
-- delle linee è cambiata, non le voci che il foglio dichiara. Quello che
-- serviva non era rifarli, era **provare che reggono**: se cambiando il
-- modo di distinguere le forme uno dei diciassette smettesse di tornare,
-- vorrebbe dire che il gestionale ha smesso di calcolare come il piano di
-- Alessio, e nessuno se ne accorgerebbe finché non riapre quella scheda.
--
-- 🔴 E STA IN UNA MIGRAZIONE NUOVA, non dentro la 20260824000029: quella
-- è già applicata sul progetto di prova, e **una migrazione applicata non
-- si riscrive mai** (regola di Alessio del 23/08) — nemmeno quando la
-- correzione è un blocco solo e il file non è ancora andato in produzione.
-- Il file racconta cosa è successo quel giorno.
--
-- ⚠️ IL CASO SI COSTRUISCE, perché altrimenti questa verifica non
-- misurerebbe niente dove gira: sul progetto di prova nessuna previsione
-- viene dal foglio, quindi `controlli` è vuoto e i confronti sono zero. In
-- produzione ce n'è una con tutte e diciassette. Far girare per la prima
-- volta sui dati veri il controllo che conta è la trappola che questo
-- progetto ha incontrato quattro volte.
-- =====================================================================

do $verifica$
declare
  v_titolare  uuid;
  v_lapidi    integer;
  v_lapidi2   integer;
  v_scenario  uuid;
  v_congelato boolean;
  v_prima     integer;
  v_quanti    integer;
  v_storti    integer;
  v_controlli jsonb;
  r           record;
begin
  select count(*) into v_lapidi from deleted_records;

  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  if v_titolare is null then
    raise exception 'Nessun titolare in user_roles: impossibile verificare.';
  end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

  -- (a) DOVE I CONTROLLI CI SONO GIÀ — la produzione — si pretende che
  --     tornino tutti. ⚠️ Se qui ne trovasse uno storto, la migrazione si
  --     ferma **prima** di registrarsi: il gestionale avrebbe smesso di
  --     riprodurre il piano di Alessio, e quello è un motivo per non
  --     andare avanti.
  for r in select s.id, s.nome from scenari_proiezione s where s.controlli is not null
  loop
    select count(*), count(*) filter (where abs(c.differenza) > 0.01)
      into v_quanti, v_storti
      from confronto_col_foglio(r.id) c;

    raise notice 'Previsione «%»: % confronti col foglio, % non tornano.', r.nome, v_quanti, v_storti;
    if v_storti > 0 then
      raise exception
        'Sulla previsione «%» % totali su % non tornano piu'' col foglio: il calcolo nuovo non riproduce il piano.',
        r.nome, v_storti, v_quanti;
    end if;
  end loop;

  -- (b) 🔴 E DOVE NON CI SONO, SI COSTRUISCONO. Senza questo blocco la
  --     verifica passerebbe sul progetto di prova senza aver confrontato
  --     niente — e il controllo vero girerebbe per la prima volta in
  --     produzione, che è tardi.
  select s.id, s.congelato_il is not null into v_scenario, v_congelato
    from scenari_proiezione s where s.controlli is null
     and exists (select 1 from scenario_linee_accessorie a where a.scenario_id = s.id)
   limit 1;

  if v_scenario is null or v_congelato then
    raise notice 'Nessuna previsione libera senza controlli: il caso non e'' stato costruito qui.';
  else
    -- I controlli si scrivono con i numeri che il gestionale calcola
    -- ADESSO: così un confronto che non torna dopo vorrà dire che il
    -- calcolo si è mosso, che è esattamente la domanda.
    select jsonb_build_object(
             'copertiSala',          round(sum(r2.coperti), 2),
             'ricaviSala',           round(sum(r2.ricavi_sala), 2),
             'ricaviAccessori',      round(sum(r2.ricavi_accessori), 2),
             'margineAccessori',     round(sum(r2.margine_accessori), 2),
             'ricaviTotali',         round(sum(r2.ricavi_totali), 2)
           )
      into v_controlli
      from calcola_proiezione(v_scenario) r2;

    update scenari_proiezione set controlli = v_controlli where id = v_scenario;

    select count(*) filter (where abs(c.differenza) > 0.01) into v_prima
      from confronto_col_foglio(v_scenario) c;
    if v_prima > 0 then
      raise exception 'Il confronto costruito non torna con sé stesso: % voci storte.', v_prima;
    end if;

    -- ⚠️ LA CONTROPROVA CHE DISCRIMINA: se si cambia la forma di una linea
    --     per davvero, i confronti DEVONO smettere di tornare. Senza
    --     questa, un `confronto_col_foglio` che non guarda niente
    --     passerebbe il controllo qui sopra — e passerebbe sempre.
    update scenario_linee_accessorie set forma = 'a_forfait' where scenario_id = v_scenario;
    select count(*) filter (where abs(c.differenza) > 0.01) into v_storti
      from confronto_col_foglio(v_scenario) c;
    if v_storti = 0 then
      raise exception
        'Cambiando la forma di tutte le linee i confronti tornano lo stesso: il confronto non guarda i numeri.';
    end if;

    -- Si rimette com'era, e SOLO cio' che questa verifica ha toccato.
    update scenario_linee_accessorie set forma = null where scenario_id = v_scenario;
    update scenari_proiezione set controlli = null where id = v_scenario;
    raise notice 'Confronti costruiti: tornano con la forma giusta (% storti) e si rompono cambiandola (% storti).', v_prima, v_storti;
  end if;

  select count(*) into v_lapidi2 from deleted_records;
  if v_lapidi2 <> v_lapidi then
    raise exception 'La verifica ha lasciato % lapidi nel registro.', v_lapidi2 - v_lapidi;
  end if;

  raise notice 'Il confronto col foglio regge alle forme.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260824000030', 'i_diciassette_confronti_reggono') on conflict (version) do nothing;
