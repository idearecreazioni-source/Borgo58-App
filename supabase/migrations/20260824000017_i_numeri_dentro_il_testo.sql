-- =====================================================================
-- I NUMERI CHE VIVONO DENTRO UNA COLONNA DI TESTO
-- 24/08/2026 — il buco che il censimento del mattino non poteva vedere
-- =====================================================================
-- 🔴 TROVATO DA ALESSIO COL GESTIONALE IN MANO, non da una rete: ha
-- scritto **-100** come temperatura attesa alla consegna di un
-- ingrediente, e il gestionale l'ha accettata senza dire niente. Lo
-- scarto al 100%, nella stessa schermata, veniva respinto con la sua
-- spiegazione in italiano.
--
-- ⚠️ LA RAGIONE E' STRUTTURALE, e vale oltre le temperature: il giro dei
-- vincoli del 24/08 cercava fra le colonne **numeriche**, e
-- `ingredients.temperatura_attesa` e' una colonna di **testo** — deve
-- poter contenere «0-4 °C», «-18 °C» e «ambiente», che numeri non sono.
-- **Un numero scritto in una colonna di testo non compare in un
-- censimento dei numeri.** E' la stessa forma del difetto del 22/08 — un
-- censimento «per posti» tace su tutto cio' che non e' un posto — letta
-- sui tipi invece che sulle schermate.
--
-- 🔴 E PERCHE' MORDE: e' una colonna dell'HACCP. Dice a che temperatura
-- la merce **dovrebbe** arrivare, e serve a confrontarla con quella che
-- il termometro misura davvero. Un'aspettativa a -100 gradi rende quel
-- confronto **inservibile**: qualunque misura vera risulta «piu' calda
-- del previsto», e il controllo smette di dire qualcosa.
--
-- ⚠️ LE DUE SOGLIE SONO DI ALESSIO: «sotto -40 e sopra 60 gradi non
-- esiste consegna vera». Misurate contro i casi legittimi prima di
-- sceglierle: -18 (freezer), -25 (surgelato profondo), 0-4 (pesce), 60
-- (caldo trasportato) passano tutti.
--
-- ⚠️ E LA FASE DI UNA RICETTA E' UN'ALTRA COSA: li' si cuoce, e 140 o 250
-- gradi sono un forno. Stessa forma, soglia diversa — dare a tutt'e due
-- lo stesso limite avrebbe reso inutile quello stretto.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1 · La regola: quali numeri ci sono dentro un testo
-- ---------------------------------------------------------------------
-- ⚠️ Deve essere `immutable`: un vincolo `check` non accetta funzioni che
-- potrebbero cambiare risposta nel tempo.
--
-- ⚠️ E il segno meno si prende solo se ATTACCATO alla cifra: in «0-4 °C»
-- il trattino separa un intervallo, e leggerlo come meno darebbe -4 — che
-- resta dentro i limiti, quindi qui non cambia niente, ma la forma giusta
-- e' quella.
-- 🔴 IL GRUPPO DEVE CATTURARE TUTTO, e la prima versione non lo faceva.
-- `regexp_matches` restituisce **i gruppi di cattura**, non la
-- corrispondenza intera: con `([.,][0-9]+)?` come unico gruppo tornava
-- solo la parte decimale — cioe' `null` su un numero intero.
-- ⚠️ E LA SPIA E' STATA LA SANATORIA: ha stampato «temperature fuori scala
-- svuotate: 0» mentre di righe fuori scala ce n'erano due. Uno zero che
-- sembra «niente da fare» e invece e' «non ho guardato». Stessa forma del
-- difetto del 17/08, e per la stessa ragione si e' visto: ogni sanatoria
-- dichiara quante righe ha toccato.
create or replace function numeri_nel_testo(p_testo text)
returns numeric[]
language sql
immutable
as $$
  select coalesce(array_agg(replace(g[1], ',', '.')::numeric), '{}')
    from regexp_matches(coalesce(p_testo, ''), '(-?[0-9]+(?:[.,][0-9]+)?)', 'g') as m(g)
$$;

comment on function numeri_nel_testo(text) is
  'I numeri contenuti in un testo libero, per poterli confrontare con un limite. Serve dove una colonna deve restare testo perche'' ammette anche parole — «ambiente», «0-4 °C» — ma i numeri che ci finiscono dentro hanno lo stesso un limite naturale.';

revoke all on function numeri_nel_testo(text) from public, anon;
grant execute on function numeri_nel_testo(text) to authenticated;

-- ⚠️ `regexp_matches` con 'g' restituisce UNA RIGA PER OCCORRENZA, quindi
-- serve l'aggregazione: la prima versione ne prendeva una sola, e su
-- «0-4 °C» avrebbe guardato lo 0 e ignorato il resto.
create or replace function numeri_fuori_intervallo(p_testo text, p_min numeric, p_max numeric)
returns boolean
language sql
immutable
as $$
  select exists (
    select 1 from unnest(numeri_nel_testo(p_testo)) as n
     where n < p_min or n > p_max
  )
$$;

comment on function numeri_fuori_intervallo(text, numeric, numeric) is
  'Vero se dentro il testo c''e'' almeno un numero fuori dall''intervallo. Un testo senza numeri — «ambiente» — non e'' mai fuori: l''assenza di un numero non e'' un numero sbagliato.';

revoke all on function numeri_fuori_intervallo(text, numeric, numeric) from public, anon;
grant execute on function numeri_fuori_intervallo(text, numeric, numeric) to authenticated;

-- ---------------------------------------------------------------------
-- 2 · La sanatoria: i valori assurdi che ci sono GIA'
-- ---------------------------------------------------------------------
-- 🔴 Sul progetto di prova ci sono **due** temperature fuori scala (-100 e
-- -50): sono i valori con cui Alessio ha trovato il difetto. In
-- produzione la tabella e' vuota.
--
-- ⚠️ SI SVUOTANO, non si correggono: `null` vuol dire «non l'ha ancora
-- detto nessuno», che e' la verita'. Metterci un numero al posto suo
-- sarebbe rispondere per lui — la trappola del 14/08 — e su una colonna
-- HACCP sarebbe peggio: un'aspettativa inventata rende il confronto col
-- termometro una finzione.
--
-- ⚠️ E DICHIARA QUANTE RIGHE TOCCA (regola del 16/08): uno zero non e' un
-- errore, ma va detto.
do $sanatoria$
declare v_quante integer;
begin
  update ingredients
     set temperatura_attesa = null
   where temperatura_attesa is not null
     and numeri_fuori_intervallo(temperatura_attesa, -40, 60);
  get diagnostics v_quante = row_count;
  raise notice 'Temperature attese fuori scala svuotate: %.', v_quante;

  update recipe_steps
     set temperature_c = null
   where temperature_c is not null
     and numeri_fuori_intervallo(temperature_c, -40, 300);
  get diagnostics v_quante = row_count;
  raise notice 'Temperature di fase fuori scala svuotate: %.', v_quante;
end $sanatoria$;

-- ---------------------------------------------------------------------
-- 3 · I due vincoli sulle temperature
-- ---------------------------------------------------------------------
alter table ingredients drop constraint if exists ingredienti_temperatura_del_mondo;
alter table ingredients
  add constraint ingredienti_temperatura_del_mondo
  check (temperatura_attesa is null
         or not numeri_fuori_intervallo(temperatura_attesa, -40, 60));

comment on constraint ingredienti_temperatura_del_mondo on ingredients is
  'La temperatura a cui la merce dovrebbe arrivare sta fra -40 e 60 gradi: sotto e sopra non esiste una consegna vera. Si possono scrivere anche parole («ambiente») o intervalli («0-4 °C»); il controllo guarda solo i numeri che ci sono dentro.';

alter table recipe_steps drop constraint if exists fase_temperatura_del_mondo;
alter table recipe_steps
  add constraint fase_temperatura_del_mondo
  check (temperature_c is null
         or not numeri_fuori_intervallo(temperature_c, -40, 300));

comment on constraint fase_temperatura_del_mondo on recipe_steps is
  'La temperatura di una fase sta fra -40 e 300 gradi: sotto c''e'' solo un abbattitore industriale, sopra non c''e'' nessun forno da cucina. Piu'' larga di quella della consegna perche'' qui si cuoce.';

-- ---------------------------------------------------------------------
-- Verifica — nei DUE versi, come pretende la regola del 24/08
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_ing      uuid;
  v_entita   uuid;
  v_ricetta  uuid;
  v_respinto boolean;
  v_lapidi   integer;
  v_lapidi2  integer;
  v_prima    text;
begin
  select count(*) into v_lapidi from deleted_records;

  -- (a) La regola sui numeri dentro un testo, provata da sola.
  if numeri_nel_testo('0-4 °C') <> array[0, -4]::numeric[] then
    raise exception 'I numeri di «0-4 °C» sono % invece di 0 e -4.', numeri_nel_testo('0-4 °C');
  end if;
  if numeri_nel_testo('ambiente') <> '{}'::numeric[] then
    raise exception 'Un testo senza numeri ne ha restituito qualcuno.';
  end if;
  if not numeri_fuori_intervallo('-100', -40, 60) then
    raise exception '-100 non risulta fuori dall''intervallo.';
  end if;
  -- ⚠️ IL VERSO OPPOSTO, che conta quanto il primo: un limite che
  --     rifiuta anche i casi buoni e'' peggio di nessun limite.
  if numeri_fuori_intervallo('-18 °C', -40, 60) then
    raise exception 'Un freezer a -18 gradi viene rifiutato: il limite e'' troppo stretto.';
  end if;
  if numeri_fuori_intervallo('0-4 °C', -40, 60) then
    raise exception 'Il pesce fresco a 0-4 gradi viene rifiutato.';
  end if;
  if numeri_fuori_intervallo('ambiente', -40, 60) then
    raise exception '«ambiente» viene rifiutato: una parola non e'' un numero sbagliato.';
  end if;

  -- (b) Il vincolo morde sui dati veri. Si usa un ingrediente PROPRIO —
  --     mai uno vero (lezione del 16/08).
  select id into v_entita from entities limit 1;
  if v_entita is null then
    raise exception 'Nessuna entita'': impossibile verificare.';
  end if;

  insert into ingredients (entity_id, name, unit, category, temperatura_attesa)
  values (v_entita, 'verifica-temperatura-20260824', 'kg', 'altro', '0-4 °C')
  returning id into v_ing;

  v_respinto := false;
  begin
    update ingredients set temperatura_attesa = '-100' where id = v_ing;
  exception when check_violation then v_respinto := true;
  end;
  if not v_respinto then
    raise exception 'Una temperatura di -100 gradi e'' stata accettata.';
  end if;

  -- (c) E quella legittima passa, compreso il freezer.
  update ingredients set temperatura_attesa = '-18 °C' where id = v_ing;
  select temperatura_attesa into v_prima from ingredients where id = v_ing;
  if v_prima <> '-18 °C' then
    raise exception 'Il freezer non e'' stato conservato: %.', v_prima;
  end if;

  -- (d) La fase di una ricetta ha la sua soglia, piu' larga.
  insert into recipes (name, category, recipe_type)
  values ('verifica-fase-20260824', 'antipasto', 'piatto_finito')
  returning id into v_ricetta;
  insert into recipe_steps (recipe_id, step_number, phase, description, temperature_c)
  values (v_ricetta, 1, 'cottura', 'verifica', '250');

  v_respinto := false;
  begin
    update recipe_steps set temperature_c = '900' where recipe_id = v_ricetta;
  exception when check_violation then v_respinto := true;
  end;
  if not v_respinto then
    raise exception 'Un forno a 900 gradi e'' stato accettato.';
  end if;

  -- ⚠️ E 250 gradi NON deve essere rifiutato: e'' un forno normale, ed e''
  --     il caso che distingue le due soglie.
  if numeri_fuori_intervallo('250', -40, 300) then
    raise exception 'Un forno a 250 gradi viene rifiutato dalla soglia delle fasi.';
  end if;

  -- (e) Si toglie quello che ha creato lei, per identificativo.
  delete from recipe_steps where recipe_id = v_ricetta;
  delete from recipes where id = v_ricetta;
  delete from ingredients where id = v_ing;

  select count(*) into v_lapidi2 from deleted_records;
  if v_lapidi2 <> v_lapidi then
    raise exception 'La verifica ha lasciato % lapidi nel registro.', v_lapidi2 - v_lapidi;
  end if;

  raise notice 'Le temperature stanno dentro il mondo, e i casi veri passano.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260824000017', 'i_numeri_dentro_il_testo') on conflict (version) do nothing;
