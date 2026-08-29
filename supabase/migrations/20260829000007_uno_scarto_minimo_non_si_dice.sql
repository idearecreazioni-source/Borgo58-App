-- =====================================================================
-- UNO SCARTO MINIMO NON SI DICE, E LA SOGLIA E' IN PERCENTUALE
-- 29/08/2026 — Blocco 2 del mandato del 29/08 (punto 2i)
-- =====================================================================
-- 🔴 IL FATTO, misurato sulla schermata di Alessio: la fascia «Cosa non e'
-- sceso dal magazzino» segnalava **«mancano 0.0002 kg»** di zafferano e
-- **«0.0206 kg»** di pinoli. Sono numeri veri e sono rumore: un elenco di
-- avvisi in cui due righe su tre non chiedono niente e' un elenco che si
-- smette di aprire.
--
-- ---------------------------------------------------------------------
-- PERCHE' IN PERCENTUALE, e non in grammi
-- ---------------------------------------------------------------------
-- E' la ragione data da Alessio: **venti grammi di pinoli sono rumore,
-- venti di zafferano sono un mese di scorta**. Una soglia in peso non
-- distingue i due casi — e qualunque numero si scegliesse sarebbe giusto
-- per una cucina e sbagliato per l'altra.
-- In percentuale della dose prevista, invece, la domanda diventa sempre la
-- stessa: *quanto della ricetta non e' sceso?* Sotto l'uno per cento, la
-- ricetta e' stata seguita.
--
-- ---------------------------------------------------------------------
-- ⚠️ LA SOGLIA CHE C'ERA NON ERA UNA SOGLIA
-- ---------------------------------------------------------------------
-- Nei quattro punti dove nasce un'anomalia c'e' gia' `pizzico_trascurabile`,
-- e sembrerebbe il posto giusto. Letto il corpo vivo, **non lo e'**:
--
--     select round(coalesce(p_quantita, 0), 4) <= 0;
--
-- cioe' e' vera solo quando la quantita' e' **zero**. Il suo commento lo
-- dice: «sotto un decimo di grammo non c'e' nessun numero da scrivere» — e'
-- la taglia della colonna, non una soglia di rilevanza. Fa un lavoro
-- diverso e lo fa bene: **non si tocca**.
--
-- ⚠️ E LA NUOVA NON LA SOSTITUISCE: rispondono a due domande diverse — «si
-- puo' scrivere questo numero?» e «vale la pena dirlo?». Fonderle
-- porterebbe a non registrare piu' scarichi veri di pochi grammi.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. LA DOMANDA, IN UN POSTO SOLO
-- ---------------------------------------------------------------------
create or replace function scarto_da_dire(p_mancante numeric, p_richiesta numeric)
returns boolean
language sql
immutable
as $fn$
  select case
    -- Zero non si dice mai: non e' uno scarto.
    when coalesce(p_mancante, 0) <= 0 then false
    -- ⚠️ SENZA LA DOSE PREVISTA NON SI PUO' DECIDERE, e allora **si dice**:
    -- tacere qui vorrebbe dire nascondere uno scarto perche' non si sa
    -- quanto pesa, che e' il contrario di quello che serve. E' la regola
    -- del progetto: uno zero — o un silenzio — non e' una risposta.
    when coalesce(p_richiesta, 0) <= 0 then true
    -- Sotto l'uno per cento della dose prevista la ricetta e' stata
    -- seguita: quello che manca e' il resto di un arrotondamento.
    else p_mancante / p_richiesta > 0.01
  end;
$fn$;

comment on function scarto_da_dire(numeric, numeric) is
  'Vale la pena segnalare che questo tanto non e'' sceso? Si guarda la percentuale sulla dose prevista, non il peso: venti grammi di pinoli sono rumore, venti di zafferano sono un mese di scorta. Senza la dose prevista si segnala, perche'' non sapere non e'' una ragione per tacere.';

-- ---------------------------------------------------------------------
-- 2. E L'ANOMALIA SI PORTA DIETRO IL SUO DENOMINATORE
-- ---------------------------------------------------------------------
-- Serve alla schermata per dire **quanto** della ricetta non e' sceso, e a
-- chiunque riguardi quelle righe fra sei mesi.
-- ⚠️ Le tre righe gia' scritte restano senza, e non si riempiono a
-- indovinare: la dose prevista di quel giorno non e' ricostruibile, e un
-- numero plausibile messo li' sarebbe indistinguibile da uno vero.
alter table anomalie_scarico
  add column if not exists quantita_richiesta numeric;

comment on column anomalie_scarico.quantita_richiesta is
  'Quanto ne chiedeva la ricetta. Vuoto sulle righe scritte prima del 29/08/2026: non si ricostruisce, e senza denominatore la riga si segnala sempre.';

-- ---------------------------------------------------------------------
-- 3. I DUE PUNTI DOVE NASCE «NON CE N'ERA ABBASTANZA»
-- ---------------------------------------------------------------------
-- 🔴 SI RISCRIVE DAL CORPO VIVO, e la sostituzione **si controlla**: la
-- volta scorsa una replace di questo tipo non ha attecchito e la migrazione
-- e' passata lo stesso, lasciando la funzione com'era. Qui, se il punto non
-- si trova, la migrazione si ferma.
do $riscrivi$
declare
  v_nome text;
  v_corpo text;
  v_nuovo text;
  v_cerca text;
  v_metti text;
begin
  foreach v_nome in array array['scarica_magazzino_conto', 'registra_produzione'] loop
    select pg_get_functiondef(p.oid) into v_corpo
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = v_nome;
    if v_corpo is null then
      raise exception 'La funzione % non esiste: il corpo vivo va riletto prima di riscriverlo.', v_nome;
    end if;

    -- ⚠️ IDEMPOTENTE: al secondo giro il corpo usa gia' la soglia nuova e
    -- il punto da cambiare non c'e' piu'. Senza questa riga la migrazione
    -- si fermerebbe rilanciandola — e rilanciare una migrazione, in questo
    -- progetto, e' normale. Trovato rilanciandola, non rileggendola.
    if position('scarto_da_dire' in v_corpo) > 0 then
      raise notice '% usa gia'' la soglia nuova: niente da fare.', v_nome;
      continue;
    end if;

    if v_nome = 'scarica_magazzino_conto' then
      v_cerca := 'if not pizzico_trascurabile(v_da_togliere) then';
      v_metti := 'if scarto_da_dire(v_da_togliere, v_riga.quantita) then';
    else
      v_cerca := 'if not pizzico_trascurabile(v_da) then';
      v_metti := 'if scarto_da_dire(v_da, v_riga.quantita) then';
    end if;

    if position(v_cerca in v_corpo) = 0 then
      raise exception 'In % non trovo il punto da cambiare («%»): il corpo vivo e'' diverso da quello letto.',
        v_nome, v_cerca;
    end if;
    v_nuovo := replace(v_corpo, v_cerca, v_metti);

    -- E l'anomalia scrive anche la dose prevista.
    if v_nome = 'scarica_magazzino_conto' then
      v_cerca := '(order_id, ingredient_id, tipo, descrizione, quantita_mancante)' || chr(10) ||
                 '          values' || chr(10) ||
                 '            (p_order_id, v_riga.ingredient_id, ''giacenza_insufficiente'',';
      v_metti := '(order_id, ingredient_id, tipo, descrizione, quantita_mancante, quantita_richiesta)' || chr(10) ||
                 '          values' || chr(10) ||
                 '            (p_order_id, v_riga.ingredient_id, ''giacenza_insufficiente'',';
    else
      v_cerca := '(produzione_id, ingredient_id, tipo, descrizione, quantita_mancante)' || chr(13) || chr(10) ||
                 '      values';
      v_metti := '(produzione_id, ingredient_id, tipo, descrizione, quantita_mancante, quantita_richiesta)' || chr(13) || chr(10) ||
                 '      values';
    end if;
    if position(v_cerca in v_nuovo) = 0 then
      raise exception 'In % non trovo l''inserimento dell''anomalia da allargare.', v_nome;
    end if;
    v_nuovo := replace(v_nuovo, v_cerca, v_metti);

    -- …e il valore in fondo alla values.
    if v_nome = 'scarica_magazzino_conto' then
      v_cerca := 'round(v_da_togliere, 4));';
      v_metti := 'round(v_da_togliere, 4), v_riga.quantita);';
    else
      v_cerca := 'round(v_da, 4));';
      v_metti := 'round(v_da, 4), v_riga.quantita);';
    end if;
    if position(v_cerca in v_nuovo) = 0 then
      raise exception 'In % non trovo il valore da affiancare («%»).', v_nome, v_cerca;
    end if;
    v_nuovo := replace(v_nuovo, v_cerca, v_metti);

    execute v_nuovo;
  end loop;
end
$riscrivi$;

-- =====================================================================
-- VERIFICA
-- =====================================================================
do $verifica$
declare
  v_foto jsonb;
  v_corpo text;
  v_nome text;
begin
  v_foto := foto_righe();

  -- (1) La regola: zero non si dice, sotto l'1% non si dice, sopra si'.
  if scarto_da_dire(0, 100) then raise exception 'Uno scarto di zero viene segnalato.'; end if;
  if scarto_da_dire(0.0002, 1) then
    raise exception 'Uno scarto dello 0,02%% viene ancora segnalato: e'' il caso misurato sullo zafferano.';
  end if;
  if not scarto_da_dire(0.5, 1) then
    raise exception 'Uno scarto del 50%% NON viene segnalato: la soglia taglia troppo.';
  end if;
  -- ⚠️ Il bordo esatto, che e' il solo punto dove la regola cambia idea:
  -- l'1% netto NON si dice, l'1,1% si'.
  if scarto_da_dire(1, 100) then raise exception 'L''1%% esatto viene segnalato: il bordo e'' sbagliato.'; end if;
  if not scarto_da_dire(1.1, 100) then raise exception 'L''1,1%% non viene segnalato: il bordo e'' sbagliato.'; end if;

  -- (2) 🔴 SENZA LA DOSE PREVISTA SI SEGNALA. Se tacesse, uno scarto
  --     sconosciuto sparirebbe — ed e' esattamente il caso delle tre righe
  --     gia' scritte, che il denominatore non ce l'hanno.
  if not scarto_da_dire(0.0002, null) then
    raise exception 'Senza la dose prevista lo scarto viene taciuto invece che detto.';
  end if;

  -- (3) E le due funzioni la usano DAVVERO: una migrazione che riscrive un
  --     corpo puo' passare senza aver cambiato niente — successo il 29/08
  --     con i turni. Si guarda il corpo vivo, non il fatto che il comando
  --     sia andato a buon fine.
  foreach v_nome in array array['scarica_magazzino_conto', 'registra_produzione'] loop
    select pg_get_functiondef(p.oid) into v_corpo
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = v_nome;
    if position('scarto_da_dire' in v_corpo) = 0 then
      raise exception '% non usa la soglia nuova: la riscrittura non ha attecchito.', v_nome;
    end if;
    if position('quantita_richiesta' in v_corpo) = 0 then
      raise exception '% non scrive la dose prevista nell''anomalia.', v_nome;
    end if;
  end loop;

  -- (4) …e `pizzico_trascurabile` e' rimasta al suo posto, perche' risponde
  --     a un'altra domanda: «questo numero si puo' scrivere?».
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                  where n.nspname = 'public' and p.proname = 'pizzico_trascurabile') then
    raise exception 'pizzico_trascurabile e'' sparita: serviva ancora, per un''altra domanda.';
  end if;

  perform pretendi_nessun_residuo(v_foto, 'la verifica della soglia sugli scarti');
  raise notice 'Uno scarto sotto l''uno per cento della dose non si segnala piu''; senza la dose prevista si segnala lo stesso.';
end
$verifica$;

insert into applied_migrations (version, name)
values ('20260829000007', 'uno_scarto_minimo_non_si_dice') on conflict (version) do nothing;
