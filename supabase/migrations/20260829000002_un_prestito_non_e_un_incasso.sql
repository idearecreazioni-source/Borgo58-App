-- =====================================================================
-- UN PRESTITO NON E' UN INCASSO, E RESTITUIRLO NON E' UN COSTO
-- 29/08/2026 — Blocco 3 del mandato del 29/08
-- =====================================================================
-- La decisione e' di Alessio, del 20/08: *un finanziamento non e' un ricavo
-- e restituire il capitale non e' un costo*. La struttura dei prestiti
-- esiste dal 22/08 ed e' buona; quello che mancava e' che quella decisione
-- fosse **imposta** invece che affidata a chi compila.
--
-- ---------------------------------------------------------------------
-- LA MISURA, fatta prima di scrivere una riga (e chiesta dal mandato)
-- ---------------------------------------------------------------------
-- Domanda: *cosa fanno i riepiloghi di cassa con un movimento senza
-- causale?* Risposta, letta nei corpi vivi:
--
--   · `costi_da_classificare` e `rettifiche_fiscali` filtrano le uscite con
--     `left join cash_causali` e **`coalesce(c.di_sistema, false) = false`**.
--     Un movimento SENZA causale ha `di_sistema` nullo, quindi il coalesce
--     lo rende `false`, quindi **non viene escluso**: 🔴 una restituzione
--     di prestito entra fra i costi da classificare, etichettata «Uscita
--     senza causale». Nel calcolo delle imposte diventa un costo che non
--     esiste.
--   · In ENTRATA il prestito non compare fra i ricavi — ma **non per il
--     motivo scritto nel codice**. Il commento di `registra_prestito_privato`
--     dice che a tenerlo fuori dagli incassi e' `prestito_id`: misurato,
--     **nessuna funzione di riepilogo guarda quella colonna** (solo le due
--     che la scrivono). A tenerlo fuori e' la decisione del 15/08 — i ricavi
--     si leggono dai conti chiusi, non dalle entrate di prima nota.
--     *L'effetto era giusto, la ragione scritta no.*
--
-- ⚠️ E DA QUESTO SEGUE LA FORMA DELLA CURA: il meccanismo che esclude i
-- movimenti di sistema **esiste gia' e funziona**. Non serve toccare
-- `costi_da_classificare` ne' `rettifiche_fiscali`: basta che i due
-- movimenti dei prestiti abbiano una causale di sistema, e ne restano fuori
-- da soli. *Si toglie il motivo per cui il difetto esiste, invece di
-- aggiungere un'eccezione in ogni posto che potrebbe inciamparci.*
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. LE DUE CAUSALI DI SISTEMA
-- ---------------------------------------------------------------------
-- ⚠️ `di_sistema` non e' un'etichetta: un vincolo che c'e' gia'
-- (`cash_causali_di_sistema_protetta`) impedisce di spegnerle e di marcarle
-- «costo fisso». Sono le ottava e nona, accanto a caparre, versamenti e
-- rimborso al titolare.
insert into cash_causali (label, kind, di_sistema, active, conta_nei_fissi)
values ('Prestito ricevuto', 'entrata', true, true, false)
on conflict (label, kind) do update set di_sistema = true, active = true, conta_nei_fissi = false;

insert into cash_causali (label, kind, di_sistema, active, conta_nei_fissi)
values ('Restituzione di prestito', 'uscita', true, true, false)
on conflict (label, kind) do update set di_sistema = true, active = true, conta_nei_fissi = false;

-- ---------------------------------------------------------------------
-- 2. LA RISERVA DIVENTA UN NUMERO DI ALESSIO
-- ---------------------------------------------------------------------
-- Decisione sua del 28/08. Il valore resta 5.000 €: cambia che si modifica
-- da una schermata invece che da una migrazione.
--
-- ⚠️ NASCE VUOTA E NON A 5000, e la differenza conta: `impostazioni_tesoreria`
-- puo' non avere affatto una riga per un'entita' (l'azienda agricola non ce
-- l'ha), quindi il ripiego deve stare nel calcolo e non nel dato. E **zero
-- resta zero**: se Alessio scrive 0 vuol dire «nessuna riserva», non «non
-- l'ho detto». Vuoto e zero sono due risposte diverse.
alter table impostazioni_tesoreria
  add column if not exists riserva_prestiti numeric;

comment on column impostazioni_tesoreria.riserva_prestiti is
  'Quanto tenere da parte prima di restituire un prestito. Vuoto = il ripiego di 5.000 euro; zero = nessuna riserva, ed e'' una risposta come le altre.';

do $vincolo$
begin
  if not exists (select 1 from pg_constraint where conname = 'impostazioni_tesoreria_riserva_non_negativa') then
    alter table impostazioni_tesoreria
      add constraint impostazioni_tesoreria_riserva_non_negativa check (riserva_prestiti is null or riserva_prestiti >= 0);
  end if;
end
$vincolo$;

comment on constraint impostazioni_tesoreria_riserva_non_negativa on impostazioni_tesoreria is
  'La riserva non puo'' essere negativa: una riserva sotto zero direbbe di restituire piu'' soldi di quanti ce ne sono.';

-- ---------------------------------------------------------------------
-- 3. LO SPAZIO DI MANOVRA LEGGE LA RISERVA DI ALESSIO
-- ---------------------------------------------------------------------
-- Corpo ripreso dal database vivo il 29/08. Cambia solo da dove viene la
-- riserva.
create or replace function spazio_di_manovra(p_entity_id uuid)
returns table(liquidita_a_sei_mesi numeric, riserva numeric, restituibile_adesso numeric, debito_residuo numeric, avvertenza text)
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_prev    numeric;
  v_avv     text;
  v_debito  numeric;
  v_riserva numeric;
begin
  if not (select is_titolare()) then
    raise exception 'I prestiti sono riservati al titolare.';
  end if;

  -- ⚠️ Il ripiego sta QUI e non nella colonna: un'entita' senza riga di
  -- impostazioni non deve ritrovarsi senza riserva, che sarebbe la piu'
  -- generosa delle risposte proprio dove nessuno ha deciso niente.
  select coalesce(t.riserva_prestiti, 5000) into v_riserva
    from impostazioni_tesoreria t where t.entity_id = p_entity_id;
  v_riserva := coalesce(v_riserva, 5000);

  -- 🔴 NESSUN CALCOLO NUOVO: si chiama «Ce la faccio?» con un orizzonte di
  -- sei mesi invece dei trenta giorni predefiniti.
  select p.saldo_previsto, p.avvertenza into v_prev, v_avv
    from previsione_cassa(p_entity_id, (oggi_a_roma() + 182)) p;

  select coalesce(sum(a.residuo), 0) into v_debito from prestiti_aperti(p_entity_id) a;

  return query select
    v_prev,
    v_riserva,
    -- ⚠️ Non si restituisce piu' di quello che si deve, e non si scende mai
    -- sotto zero: un numero negativo qui si leggerebbe come un obbligo.
    greatest(0, least(v_prev - v_riserva, v_debito)),
    v_debito,
    -- Il numero e il suo limite viaggiano insieme, come per le imposte.
    'Liquidita'' prevista a sei mesi, meno una riserva di ' ||
    euro(v_riserva) || '. ' || coalesce(v_avv, '');
end;
$fn$;

-- ---------------------------------------------------------------------
-- 4. IL PRESTITO ENTRA CON LA SUA CAUSALE, SEMPRE
-- ---------------------------------------------------------------------
-- ⚠️ Il parametro `p_causale_id` ESCE dalla firma invece di diventare
-- obbligatorio: la causale di un prestito non e' una scelta di chi
-- registra: e' la stessa, tutte le volte, e chiederla e' offrire la
-- possibilita' di sbagliarla. Un parametro tolto e' un caso che non
-- esiste piu'.
drop function if exists registra_prestito_privato(uuid, text, numeric, text, date, uuid, text);

create or replace function registra_prestito_privato(
  p_entity_id uuid, p_da_chi text, p_importo numeric, p_mezzo text,
  p_ricevuto_il date, p_nota text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_id  uuid;
  v_mov uuid;
  v_cau uuid;
begin
  if not (select is_titolare()) then
    raise exception 'I prestiti li registra il titolare.';
  end if;

  select id into v_cau from cash_causali
   where label = 'Prestito ricevuto' and kind = 'entrata' and di_sistema;
  if v_cau is null then
    raise exception 'Manca la causale di sistema «Prestito ricevuto»: senza, il prestito finirebbe fra gli incassi.';
  end if;

  insert into prestiti_privati (entity_id, da_chi, importo, mezzo, ricevuto_il, nota)
  values (p_entity_id, btrim(p_da_chi), p_importo, p_mezzo, p_ricevuto_il, nullif(btrim(p_nota), ''))
  returning id into v_id;

  -- ⚠️ La causale di sistema e' cio' che tiene questi soldi FUORI dai costi
  -- e dalle rettifiche fiscali: `costi_da_classificare` e
  -- `rettifiche_fiscali` scartano le causali di sistema, e senza causale
  -- non scartavano niente. `prestito_id` serve a ritrovare il movimento,
  -- non a escluderlo — misurato il 29/08: nessun riepilogo lo guarda.
  insert into cash_movements (entity_id, direction, amount, movement_date, causale_id, mezzo, note, prestito_id)
  values (p_entity_id, 'entrata', p_importo, p_ricevuto_il, v_cau, p_mezzo,
          'Prestito da ' || btrim(p_da_chi), v_id)
  returning id into v_mov;

  update prestiti_privati set movimento_id = v_mov where id = v_id;

  return jsonb_build_object('prestito_id', v_id, 'movimento_id', v_mov,
    'messaggio', 'Prestito di ' || euro(p_importo) || ' da ' || btrim(p_da_chi) ||
                 ' registrato: e'' in cassa, ma non fra gli incassi.');
end;
$fn$;

revoke all on function registra_prestito_privato(uuid, text, numeric, text, date, text) from public, anon, authenticated;
grant execute on function registra_prestito_privato(uuid, text, numeric, text, date, text) to authenticated;

-- ---------------------------------------------------------------------
-- 5. SI RESTITUISCE COME SI E' RICEVUTO
-- ---------------------------------------------------------------------
-- Decisione del 20/08, finora non imposta: la funzione accettava un mezzo
-- qualunque senza confrontarlo con quello del prestito. ⚠️ Il rifiuto NOMINA
-- il mezzo giusto, invece di dire soltanto che quello scritto non va bene.
drop function if exists registra_restituzione_prestito(uuid, numeric, text, date, uuid, text);

create or replace function registra_restituzione_prestito(
  p_prestito_id uuid, p_importo numeric, p_mezzo text,
  p_restituito_il date, p_nota text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_p       prestiti_privati;
  v_residuo numeric;
  v_mov     uuid;
  v_rest    uuid;
  v_cau     uuid;
begin
  if not (select is_titolare()) then
    raise exception 'Le restituzioni le registra il titolare.';
  end if;

  select * into v_p from prestiti_privati where id = p_prestito_id;
  if not found then raise exception 'Questo prestito non esiste piu''.'; end if;

  -- 🔴 SI RESTITUISCE CON LO STESSO MEZZO con cui e' entrato. Altrimenti i
  -- soldi risultano usciti da un posto in cui non erano mai entrati, e a
  -- fine mese non torna ne' il cassetto ne' la banca.
  if p_mezzo is distinct from v_p.mezzo then
    raise exception 'Questo prestito e'' entrato in %: va restituito da li'', non da %.',
      v_p.mezzo, coalesce(p_mezzo, 'nessun posto');
  end if;

  select id into v_cau from cash_causali
   where label = 'Restituzione di prestito' and kind = 'uscita' and di_sistema;
  if v_cau is null then
    raise exception 'Manca la causale di sistema «Restituzione di prestito»: senza, la restituzione finirebbe fra i costi.';
  end if;

  select residuo into v_residuo from prestiti_aperti(v_p.entity_id) where id = p_prestito_id;

  -- ⚠️ NON SI RESTITUISCE PIU' DI QUELLO CHE SI DEVE, e il rifiuto dice il
  -- numero: chi sta scrivendo ha in mano dei contanti e deve sapere quanto
  -- di quel mucchio riguarda questo prestito.
  if p_importo > v_residuo then
    raise exception 'A % restano da restituire %: non se ne possono registrare %.',
      v_p.da_chi, euro(v_residuo), euro(p_importo);
  end if;

  -- 🔴 `returning` INVECE DEL RIAGGANCIO PER CAMPI. La forma vecchia
  -- ritrovava la riga con «stesso prestito, stessa data, stesso importo,
  -- movimento ancora vuoto».
  -- ⚠️ MISURATO il 29/08 costruendo il caso, non ragionandoci sopra: con
  -- due restituzioni identiche **regge** (2 righe, 0 orfane, 0 movimenti
  -- agganciati due volte) — il caso che il mandato sospettava non morde.
  -- Ma basta **una riga rimasta senza movimento** perche' l'update, che non
  -- ha limite, agganci lo STESSO movimento a piu' righe: provato, e ne ha
  -- agganciato uno due volte. `returning` costa una riga e toglie il caso
  -- invece di renderlo improbabile.
  insert into restituzioni_prestito (prestito_id, importo, mezzo, restituito_il, nota)
  values (p_prestito_id, p_importo, p_mezzo, p_restituito_il, nullif(btrim(p_nota), ''))
  returning id into v_rest;

  insert into cash_movements (entity_id, direction, amount, movement_date, causale_id, mezzo, note, prestito_id)
  values (v_p.entity_id, 'uscita', p_importo, p_restituito_il, v_cau, p_mezzo,
          'Restituzione a ' || v_p.da_chi, p_prestito_id)
  returning id into v_mov;

  update restituzioni_prestito set movimento_id = v_mov where id = v_rest;

  select residuo into v_residuo from prestiti_aperti(v_p.entity_id) where id = p_prestito_id;

  return jsonb_build_object('residuo', v_residuo, 'movimento_id', v_mov,
    'messaggio', case when v_residuo <= 0
                      then 'Restituito tutto a ' || v_p.da_chi || ': il prestito e'' chiuso.'
                      else 'A ' || v_p.da_chi || ' restano ' || euro(v_residuo) || '.' end);
end;
$fn$;

revoke all on function registra_restituzione_prestito(uuid, numeric, text, date, text) from public, anon, authenticated;
grant execute on function registra_restituzione_prestito(uuid, numeric, text, date, text) to authenticated;

-- =====================================================================
-- VERIFICA
-- =====================================================================
do $verifica$
declare
  v_tit uuid;
  v_ent uuid;
  v_prestito uuid;
  v_mov uuid;
  v_cau_e uuid;
  v_cau_u uuid;
  v_ok boolean;
  v_quanti integer;
  v_riserva numeric;
  v_rest_id uuid;
  v_lapidi_prima integer;
  v_lapidi_dopo integer;
  v_foto jsonb;
  v_aveva_riga boolean;
  v_miei uuid[];
begin
  v_foto := foto_righe();
  select count(*) into v_lapidi_prima from deleted_records;
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  select id into v_ent from entities limit 1;
  if v_tit is null or v_ent is null then
    raise exception 'Verifica impossibile: manca il titolare o l''entita''.';
  end if;

  -- (1) Le due causali esistono e sono di sistema.
  select id into v_cau_e from cash_causali where label = 'Prestito ricevuto' and kind = 'entrata' and di_sistema;
  select id into v_cau_u from cash_causali where label = 'Restituzione di prestito' and kind = 'uscita' and di_sistema;
  if v_cau_e is null or v_cau_u is null then
    raise exception 'Le causali di sistema dei prestiti non ci sono.';
  end if;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);

  -- (2) Un prestito nasce con la sua causale, e non gliela passa nessuno.
  select (registra_prestito_privato(v_ent, 'VERIFICA-29AGO-prestito', 400, 'cassa',
          oggi_a_roma(), null) ->> 'prestito_id')::uuid into v_prestito;
  select causale_id into v_mov from cash_movements where prestito_id = v_prestito and direction = 'entrata';
  if v_mov is distinct from v_cau_e then
    raise exception 'Il movimento del prestito non porta la causale di sistema.';
  end if;

  -- (3) 🔴 IL CONTROLLO CHE VALE PIU' DI TUTTI: quel movimento non deve
  --     comparire fra i costi. E' il difetto misurato — un'uscita senza
  --     causale ci finiva dentro come «Uscita senza causale».
  perform registra_restituzione_prestito(v_prestito, 100, 'cassa', oggi_a_roma(), null);
  select count(*) into v_quanti from costi_da_classificare(v_ent, extract(year from oggi_a_roma())::integer) c
   where c.etichetta ilike '%VERIFICA-29AGO%' or c.etichetta = 'Uscita senza causale';
  if v_quanti > 0 then
    raise exception 'La restituzione di un prestito compare ancora fra i costi da classificare (%).', v_quanti;
  end if;

  -- (4) Il mezzo di rientro e' imposto, e il rifiuto nomina quello giusto.
  v_ok := false;
  begin
    perform registra_restituzione_prestito(v_prestito, 10, 'banca', oggi_a_roma(), null);
    v_ok := true;
  exception when others then
    if sqlerrm not like '%cassa%' then
      raise exception 'Il rifiuto sul mezzo non dice da dove va restituito: %', sqlerrm;
    end if;
  end;
  if v_ok then
    raise exception 'Si e'' potuto restituire dalla banca un prestito entrato in cassa.';
  end if;

  -- (5) Ogni restituzione ha il SUO movimento: nessuno agganciato due volte.
  perform registra_restituzione_prestito(v_prestito, 100, 'cassa', oggi_a_roma(), null);
  select count(*) into v_quanti from (
    select movimento_id from restituzioni_prestito
     where prestito_id = v_prestito and movimento_id is not null
     group by movimento_id having count(*) > 1) x;
  if v_quanti > 0 then
    raise exception 'Uno stesso movimento risulta agganciato a piu'' restituzioni (%).', v_quanti;
  end if;
  select count(*) into v_quanti from restituzioni_prestito
   where prestito_id = v_prestito and movimento_id is null;
  if v_quanti > 0 then
    raise exception '% restituzioni sono rimaste senza movimento.', v_quanti;
  end if;

  -- (6) …e regge anche col caso che faceva sbagliare la forma vecchia: una
  --     riga lasciata orfana non si porta dietro le altre.
  update restituzioni_prestito set movimento_id = null where prestito_id = v_prestito and importo = 100;
  perform registra_restituzione_prestito(v_prestito, 100, 'cassa', oggi_a_roma(), null);
  select count(*) into v_quanti from (
    select movimento_id from restituzioni_prestito
     where prestito_id = v_prestito and movimento_id is not null
     group by movimento_id having count(*) > 1) x;
  if v_quanti > 0 then
    raise exception 'Con una riga gia'' orfana, un movimento e'' finito su piu'' restituzioni (%).', v_quanti;
  end if;

  -- (7) La riserva si legge dalle impostazioni, e zero vale zero.
  --     ⚠️ Ci si segna se la riga ESISTEVA gia': rimetterla «com'era»
  --     svuotando il campo non basta se prima non c'era affatto — e' la
  --     differenza fra una riga modificata e una riga nata qui.
  select exists(select 1 from impostazioni_tesoreria where entity_id = v_ent) into v_aveva_riga;
  select s.riserva into v_riserva from spazio_di_manovra(v_ent) s;
  if v_riserva <> 5000 then
    raise exception 'Senza impostazione, la riserva doveva ripiegare su 5000 (era %).', v_riserva;
  end if;
  insert into impostazioni_tesoreria (entity_id, riserva_prestiti) values (v_ent, 0)
    on conflict (entity_id) do update set riserva_prestiti = 0;
  select s.riserva into v_riserva from spazio_di_manovra(v_ent) s;
  if v_riserva <> 0 then
    raise exception 'Riserva scritta a zero e il calcolo ne usa % : lo zero e'' una risposta, non un vuoto.', v_riserva;
  end if;
  if v_aveva_riga then
    update impostazioni_tesoreria set riserva_prestiti = null where entity_id = v_ent;
  else
    delete from impostazioni_tesoreria where entity_id = v_ent;
  end if;

  perform set_config('request.jwt.claims', null, true);

  -- PULIZIA: solo cio' che ha creato questa verifica, per identificativo.
  -- ⚠️ Ci si segna che cosa si cancella PRIMA di cancellarlo: dopo, le
  -- righe non ci sono piu' e le loro lapidi non si saprebbe distinguerle
  -- da quelle vere.
  select array_agg(id) into v_miei from cash_movements where prestito_id = v_prestito;
  select coalesce(v_miei, '{}') || coalesce(array_agg(id), '{}') into v_miei
    from restituzioni_prestito where prestito_id = v_prestito;
  v_miei := coalesce(v_miei, '{}') || v_prestito;

  delete from cash_movements where prestito_id = v_prestito;
  delete from restituzioni_prestito where prestito_id = v_prestito;
  delete from prestiti_privati where id = v_prestito;

  -- 🔴 E LE LAPIDI DI ROBA FINTA ESCONO DAL REGISTRO. Cancellare movimenti
  -- e prestiti lascia una copia in `deleted_records`, che e' un registro
  -- ESIBIBILE e che nessuno puo' ripulire dall'app: righe di prova la'
  -- dentro sono dati finti in mezzo ai dati veri, ed e' esattamente cio'
  -- che la migrazione del 19/08 ha dovuto rimediare a posteriori.
  -- ⚠️ Solo per identificativo, e solo i miei: mai «le piu' recenti».
  -- ⚠️ `record_id` e' TESTO, non un identificativo: il registro conserva
  -- righe di tabelle con chiavi di forme diverse.
  delete from deleted_records where record_id = any(
    select x::text from unnest(v_miei) x);

  select count(*) into v_lapidi_dopo from deleted_records;
  perform pretendi_nessun_residuo(v_foto, 'la verifica dei prestiti');
  raise notice 'Un prestito entra con la sua causale e resta fuori dai costi; si restituisce dal mezzo giusto; ogni restituzione ha il suo movimento; la riserva la decide Alessio. Lapidi: % -> %.',
    v_lapidi_prima, v_lapidi_dopo;
end
$verifica$;

insert into applied_migrations (version, name)
values ('20260829000002', 'un_prestito_non_e_un_incasso') on conflict (version) do nothing;
