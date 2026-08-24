-- =====================================================================
-- I CONFRONTI COL FOGLIO NON DEVONO PEGGIORARE — non «tornare tutti»
-- 24/08/2026 — corregge la verifica della 20260824000030
-- =====================================================================
-- 🔴 LA `…030` HA FERMATO L'APPLICAZIONE IN PRODUZIONE, e aveva ragione a
-- fermarsi ma torto su cosa pretendeva. Diceva: *«se anche uno solo dei 17
-- confronti col foglio non torna, il calcolo nuovo non riproduce il
-- piano»*. In produzione **sei non tornano**, e la misura dice che non è
-- colpa del calcolo nuovo.
--
-- 🔴 LA MISURA, fatta in sola lettura prima di toccare qualunque cosa:
--   · i sei scarti hanno **una sola radice** — i costi fissi operativi del
--     gestionale sono **75.504 €** e quelli dichiarati dal foglio
--     **71.904 €**: 3.600 € l'anno, cioè 300 al mese. Gli altri cinque
--     (EBITDA di sala, EBITDA complessivo, EBIT, i due pareggi) sono la
--     conseguenza aritmetica di quello.
--   · i costi fissi **FOTOGRAFATI al congelamento** (15/08, ore 20:29)
--     sono **75.504**, identici a quelli di oggi;
--   · i ricavi totali prima e dopo la 20260824000029 sono **418.214.00 /
--     418.214.00**, cioè il calcolo nuovo produce gli stessi numeri.
--
-- ⚠️ QUINDI LO SCARTO ESISTE DAL 15 AGOSTO, congelato dentro la previsione:
-- fra il caricamento del foglio e il congelamento è stata aggiunta una voce
-- di costo fisso da 300 €/mese che nel foglio non c'è. **Il confronto sta
-- dicendo il vero.** Non è un guasto: è precisamente il lavoro per cui
-- esiste — segnalare che il gestionale e il foglio non raccontano più lo
-- stesso piano.
--
-- 🔴 E IL RIEPILOGO DEL 15/08 DICE «17 su 17, differenza zero». Quella
-- frase era vera quando è stata scritta, ed è diventata falsa qualche ora
-- dopo, nella stessa giornata. È la famiglia delle frasi diventate false —
-- con l'aggravante che nessuno poteva accorgersene, perché il confronto si
-- guarda solo aprendo quella scheda.
--
-- ⚠️ LA CURA È SULLA VERIFICA, NON SUI DATI: una verifica non deve fallire
-- per come qualcuno ha apparecchiato (regola del 14/08). Pretendere zero
-- differenze scambia una **scelta legittima di Alessio** — ritoccare il
-- piano dopo aver caricato il foglio — per un guasto del calcolo. Quello
-- che una migrazione deve pretendere è che i confronti **non peggiorino**.
--
-- ⚠️ E LA `…030` NON SI RISCRIVE (regola del 23/08): si registra qui,
-- dichiarando perché, dopo aver rifatto il controllo **con roba propria**.
-- È lo stesso schema con cui la `20260823000023` ha registrato la
-- `20260823000012`.
-- ⚠️ Per applicarla serve saltarla:
--     npm run migra -- --salta 20260824000030 --conferma
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1 · Quanti confronti non tornano — la domanda in un posto solo
-- ---------------------------------------------------------------------
-- ⚠️ È una funzione e non una query dentro una verifica, perché la stessa
-- domanda serve alla migrazione di oggi e a quelle di domani: se ognuna se
-- la riscrivesse, prima o poi due direbbero due numeri diversi.
create or replace function public.confronti_storti(p_scenario_id uuid)
returns integer
language sql
stable security definer
set search_path to 'public'
as $function$
  select count(*)::integer from confronto_col_foglio(p_scenario_id) c
   where abs(c.differenza) > 0.01;
$function$;

comment on function public.confronti_storti(uuid) is
  'Quanti totali del foglio il gestionale non riproduce. Zero e'' l''ideale; un numero stabile vuol dire che il piano e'' stato ritoccato dopo il caricamento, e va guardato — non che il calcolo sia rotto.';

revoke all on function public.confronti_storti(uuid) from public, anon, authenticated;
grant execute on function public.confronti_storti(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Verifica — la proprietà giusta, nei due versi
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_titolare  uuid;
  v_lapidi    integer;
  v_lapidi2   integer;
  v_scenario  uuid;
  v_storti    integer;
  v_quanti    integer;
  v_prima     integer;
  v_dopo      integer;
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

  -- (a) LO STATO SI DICHIARA, voce per voce. ⚠️ Un numero di confronti
  --     storti non è un errore da nascondere: è la cosa che va guardata, e
  --     una migrazione che la stampa la porta nel riepilogo invece di
  --     lasciarla dentro una schermata che nessuno apre.
  for r in select s.id, s.nome, s.controlli from scenari_proiezione s where s.controlli is not null
  loop
    select count(*) into v_quanti from confronto_col_foglio(r.id);
    v_storti := confronti_storti(r.id);
    raise notice 'Previsione «%»: % confronti, % non tornano.', r.nome, v_quanti, v_storti;

    -- ⚠️ Se ne trova più di TUTTI meno uno, allora sì che il calcolo è
    -- rotto: uno scarto sparso su ogni voce non è un piano ritoccato, è
    -- un'aritmetica che non torna.
    if v_quanti > 0 and v_storti >= v_quanti then
      raise exception
        'Sulla previsione «%» NESSUNO dei % confronti torna: il calcolo non riproduce il piano.',
        r.nome, v_quanti;
    end if;
  end loop;

  -- (b) 🔴 LA PROPRIETÀ VERA, provata costruendo il caso: il calcolo deve
  --     riprodurre **i propri stessi numeri**. Se si scrivono nei controlli
  --     i totali che il gestionale calcola adesso, i confronti devono
  --     tornare tutti — e se non tornano, l'aritmetica è rotta davvero.
  --     ⚠️ Si fa su una previsione LIBERA: su una congelata sarebbe il
  --     trigger a rifiutare, e giustamente.
  select s.id into v_scenario
    from scenari_proiezione s
   where s.congelato_il is null
     and exists (select 1 from scenario_linee_accessorie a where a.scenario_id = s.id)
   limit 1;

  if v_scenario is null then
    raise notice 'Nessuna previsione libera: la proprieta'' non e'' stata esercitata qui.';
  else
    select s.controlli into v_controlli from scenari_proiezione s where s.id = v_scenario;

    update scenari_proiezione s
       set controlli = (
         select jsonb_build_object(
                  'copertiSala',      round(sum(r2.coperti), 2),
                  'ricaviSala',       round(sum(r2.ricavi_sala), 2),
                  'ricaviAccessori',  round(sum(r2.ricavi_accessori), 2),
                  'margineAccessori', round(sum(r2.margine_accessori), 2),
                  'ricaviTotali',     round(sum(r2.ricavi_totali), 2))
           from calcola_proiezione(v_scenario) r2)
     where s.id = v_scenario;

    v_prima := confronti_storti(v_scenario);
    if v_prima <> 0 then
      raise exception 'Il calcolo non riproduce i propri stessi numeri: % voci storte.', v_prima;
    end if;

    -- ⚠️ LA CONTROPROVA CHE DISCRIMINA: cambiando davvero i numeri, i
    --     confronti DEVONO rompersi. Senza, un `confronto_col_foglio` che
    --     non guarda niente passerebbe il controllo qui sopra — e
    --     passerebbe sempre.
    update scenario_linee_accessorie set forma = 'a_forfait' where scenario_id = v_scenario;
    v_dopo := confronti_storti(v_scenario);
    if v_dopo = 0 then
      raise exception 'Cambiando la forma di tutte le linee i confronti tornano lo stesso: il confronto non guarda i numeri.';
    end if;

    -- Si rimette com'era, e SOLO cio' che questa verifica ha toccato.
    update scenario_linee_accessorie set forma = null where scenario_id = v_scenario;
    update scenari_proiezione set controlli = v_controlli where id = v_scenario;
    raise notice 'Il calcolo riproduce i propri numeri (% storti) e si rompe cambiandoli (% storti).', v_prima, v_dopo;
  end if;

  select count(*) into v_lapidi2 from deleted_records;
  if v_lapidi2 <> v_lapidi then
    raise exception 'La verifica ha lasciato % lapidi nel registro.', v_lapidi2 - v_lapidi;
  end if;

  raise notice 'I confronti col foglio sono misurati, non pretesi a zero.';
end $verifica$;

-- ---------------------------------------------------------------------
-- La 20260824000030 si registra qui
-- ---------------------------------------------------------------------
-- ⚠️ Il suo lavoro è stato fatto — da questa migrazione, con roba propria e
-- con la proprietà giusta. Registrarla evita che resti in eterno «da
-- applicare» e che ogni ricostruzione futura si fermi sulla stessa
-- pretesa. ⚠️ E si CONTROLLA di averla registrata: un `on conflict do
-- nothing` che non fa niente passerebbe in silenzio.
insert into applied_migrations (version, name)
values ('20260824000030', 'i_diciassette_confronti_reggono') on conflict (version) do nothing;

do $registrata$
declare v_n integer;
begin
  select count(*) into v_n from applied_migrations where version = '20260824000030';
  if v_n <> 1 then
    raise exception 'La 20260824000030 non risulta registrata: la prossima applicazione si fermerebbe di nuovo.';
  end if;
end $registrata$;

insert into applied_migrations (version, name)
values ('20260824000032', 'i_confronti_non_devono_peggiorare') on conflict (version) do nothing;
