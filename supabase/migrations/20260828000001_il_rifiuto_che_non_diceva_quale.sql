-- ============================================================================
-- IL RIFIUTO CHE NON DICEVA QUALE — 28/08/2026
-- ============================================================================
--
-- 🔴 IL TELAIO, NON I CASI. La macchina che traduce un rifiuto del database
--    in italiano esiste dal 24/08 e funziona: `nomeDelVincolo()` riconosce
--    QUATTRO forme di messaggio (limite, doppione, chiave esterna,
--    esclusione), `spiega_vincolo()` va a prendere la frase, e
--    `src/lib/supabase.js` la rimette al posto di quella di Postgres.
--
--    Il guardiano che tiene quella macchina RIFORNITA — `vincoli_senza_frase()`,
--    nato il 25/08 — ne copre **una su quattro**: filtra `contype = 'c'`.
--
-- ----------------------------------------------------------------------------
-- LA MISURA, in produzione il 28/08 (contata, non stimata)
-- ----------------------------------------------------------------------------
--   · vincoli che possono RIFIUTARE un gesto e non sono `check`:
--       23 unicita'                   → 23 senza frase
--       58 chiavi esterne `restrict`  → 56 senza frase
--        7 chiavi esterne `no action` →  7 senza frase
--        1 esclusione                 →  0 senza frase
--     In tutto **89, di cui 86 mute**: chi le incontra legge «c'e' una regola
--     che lo impedisce (nome_tecnico)», che dice CHE c'e' una regola, non
--     QUALE — e nessuna di loro poteva far diventare rossa nessuna prova,
--     perche' la rete non le guardava.
--
-- ⚠️ E SONO PROPRIO QUELLE CHE SCATTANO IN SERVIZIO: un tavolo gia' occupato,
--    un doppione, una prenotazione che non si cancella perche' ci sta sopra un
--    conto. I `check` fermano un numero assurdo — cosa che capita a chi
--    digita; questi fermano un GESTO, cosa che capita a chi lavora.
--
-- ----------------------------------------------------------------------------
-- PERCHE' LE CHIAVI ESTERNE `cascade` E `set null` RESTANO FUORI
-- ----------------------------------------------------------------------------
--    Sono 111 su 176, e **non rifiutano niente**: alla cancellazione del
--    padre AGISCONO (portano via la riga, o svuotano il legame). L'unico modo
--    di farle scattare e' inserire una riga che punta a un padre inesistente —
--    e nel gestionale quello non e' un gesto di chi lavora, e' un difetto di
--    programmazione: le schermate scelgono da elenchi.
--
-- ⚠️ Metterle nella rete vorrebbe dire pretendere 111 frasi per un rifiuto
--    che nessuno vedra' mai, cioe' **il modo in cui una rete viene spenta**.
--    Il filtro e' dichiarato qui e nel commento della funzione, perche' fra sei
--    mesi «perche' queste si' e quelle no» sia una domanda con risposta.
--
-- ----------------------------------------------------------------------------
-- 🔴 E UNA QUINTA FORMA NON ERA RICONOSCIUTA AFFATTO — il dato obbligatorio
-- ----------------------------------------------------------------------------
--    Misurato sul progetto di prova provocando i rifiuti veri e leggendo cosa
--    torna, non deducendolo dalla documentazione di Postgres:
--
--      23502  null value in column "obbl" of relation "_mis_b58"
--             violates not-null constraint
--
-- 🔴 **QUEL MESSAGGIO NON HA NESSUN NOME DI VINCOLO FRA VIRGOLETTE**, quindi
--    tutte e quattro le espressioni di `nomeDelVincolo()` falliscono e la
--    frase arriva a schermo **in inglese, cosi' com'e'**, nominando una colonna
--    di database. Le colonne obbligatorie senza valore predefinito sono
--    **341, su 116 tabelle**.
--
-- ⚠️ E LA CURA NON E' SCRIVERE 341 SPIEGAZIONI. Un `not null` che arriva a chi
--    lavora e' quasi sempre un difetto della schermata — un campo che non e'
--    stato mandato — non una regola che quella persona puo' rispettare. Quindi
--    la frase dice che **manca un dato**, dice **quale** con le parole che il
--    database ha (il commento della colonna, se c'e': ce l'hanno 32 su 341), e
--    dice **cosa fare**: riportarlo. Non finge una regola che non c'e'.
--
-- ----------------------------------------------------------------------------
-- COSA CAMBIA PER IL LOCALE
-- ----------------------------------------------------------------------------
--    Ventitre' rifiuti che dicevano un nome tecnico adesso dicono una frase.
--    Nessuna regola e' cambiata: cambia solo cosa si legge quando scattano.
-- ============================================================================

-- ---------------------------------------------------------------------
-- 1 · Le ventitre' frasi dei doppioni
-- ---------------------------------------------------------------------
-- ⚠️ Ognuna dice COSA e' stato rifiutato, PERCHE', e COSA FARE ADESSO —
-- la terza parte e' quella che distingue un rifiuto da un vicolo cieco
-- (difetto n. 8 del mandato di correzione, 16/08).

comment on constraint cash_causali_label_kind_key on cash_causali is
  'C''e'' gia'' una causale con questo nome per lo stesso tipo di movimento. Usa quella che esiste, oppure dai a questa un nome diverso.';

comment on constraint chiavi_voce_impronta_key on chiavi_voce is
  'Questa chiave della Scorciatoia esiste gia''. Non serve crearne una seconda: quella che hai continua a funzionare.';

comment on constraint consuntivi_mensili_entity_id_anno_mese_key on consuntivi_mensili is
  'Il consuntivo di questo mese per questa societa'' e'' gia'' stato registrato. Aprilo invece di rifarlo.';

comment on constraint correzioni_coperti_data_tavoli_key on correzioni_coperti is
  'Su questo gruppo di tavoli c''e'' gia'' una correzione dei coperti per questa giornata. Cambia quella invece di aggiungerne una seconda: due correzioni sullo stesso gruppo direbbero due numeri diversi.';

comment on constraint customers_phone_key on customers is
  'C''e'' gia'' un cliente con questo numero di telefono. Apri la sua scheda invece di creare una seconda anagrafica: due schede per la stessa persona dividono la sua storia in due.';

comment on constraint dining_tables_label_unique on dining_tables is
  'C''e'' gia'' un tavolo con questo nome. Dagliene uno diverso: il nome e'' quello che finisce sul biglietto della cucina, e due tavoli uguali mandano i piatti nel posto sbagliato.';

comment on constraint disposizioni_giornaliere_data_dining_table_id_key on disposizioni_giornaliere is
  'Questo tavolo e'' gia'' stato spostato per questa giornata. Lo spostamento si aggiorna, non si aggiunge.';

comment on constraint email_inviate_reservation_id_tipo_key on email_inviate is
  'Questa email e'' gia'' partita per questa prenotazione. Non ne parte una seconda: al cliente arriverebbe due volte la stessa conferma.';

comment on constraint formati_tavolo_nome_key on formati_tavolo is
  'C''e'' gia'' un formato di tavolo con questo nome. Cambia quello che esiste, oppure scegli un nome diverso.';

comment on constraint lavori_sorvegliati_nome_cron_key on lavori_sorvegliati is
  'Questo lavoro pianificato e'' gia'' sorvegliato. Una seconda riga non lo sorveglia meglio: farebbe partire due avvisi per lo stesso silenzio.';

comment on constraint menu_items_menu_id_recipe_id_key on menu_items is
  'Questo piatto e'' gia'' in questo menu. Se volevi cambiarne il prezzo o la posizione, modifica la riga che c''e''.';

comment on constraint note_credito_utilizzi_nota_id_fattura_id_key on note_credito_utilizzi is
  'Questa nota di credito e'' gia'' stata scalata su questa fattura. Per cambiare quanto ci si scala, togli l''utilizzo che c''e'' e rifallo.';

comment on constraint order_item_sostituzione_unica on order_item_sostituzioni is
  'Per questo allergene questa sostituzione e'' gia'' dichiarata su questa riga del conto.';

comment on constraint payslips_employee_id_period_month_key on payslips is
  'La busta paga di questo dipendente per questo mese esiste gia''. Apri quella invece di caricarne una seconda: il costo del personale del mese la conterebbe due volte.';

comment on constraint posta_ricevuta_messaggio_id_key on posta_ricevuta is
  'Questo messaggio e'' gia'' entrato. E'' il freno che impedisce a una mail di essere letta — e pagata — due volte.';

comment on constraint prenotazione_tavoli_reservation_id_dining_table_id_key on prenotazione_tavoli is
  'Questo tavolo e'' gia'' assegnato a questa prenotazione.';

comment on constraint recipe_steps_recipe_id_step_number_key on recipe_steps is
  'In questa ricetta esiste gia'' una fase con questo numero. Rinumera la fase, oppure cambia quella che c''e''.';

comment on constraint regole_deducibilita_etichetta_key on regole_deducibilita is
  'C''e'' gia'' una regola di deducibilita'' con questa etichetta. Due regole con lo stesso nome renderebbero impossibile capire quale e'' stata applicata a un costo.';

comment on constraint scelta_allergene_unica on scelte_allergene is
  'Per questo piatto questo allergene e'' gia'' stato esaminato. Cambia la scelta che c''e'' invece di aggiungerne una seconda.';

comment on constraint scenario_mesi_scenario_id_mese_key on scenario_mesi is
  'Questo mese c''e'' gia'' in questa previsione.';

comment on constraint service_hours_weekday_servizio_key on service_hours is
  'Gli orari di questo servizio per questo giorno esistono gia''. Si modificano, non si aggiungono: due righe direbbero due orari diversi allo stesso cliente.';

comment on constraint sostituzione_allergene_unica on sostituzioni_allergene is
  'Questa sostituzione e'' gia'' dichiarata per questo allergene su questo piatto.';

comment on constraint tag_anticipazioni_etichetta_key on tag_anticipazioni is
  'C''e'' gia'' un tag con questa etichetta.';

-- ---------------------------------------------------------------------
-- 2 · Il tipo entra nella linea di partenza
-- ---------------------------------------------------------------------
-- ⚠️ SERVE PER POTER CONGELARE UNA VOLTA SOLA, PER TIPO. L'inserimento del
-- 25/08 si proteggeva con `not exists (select 1 from vincoli_muti_noti)` —
-- sull'INTERA tabella — che era giusto finche' i tipi erano uno. Con due,
-- quella guardia impedirebbe per sempre di congelare i tipi aggiunti dopo.
alter table vincoli_muti_noti add column if not exists tipo char(1) not null default 'c';

comment on column vincoli_muti_noti.tipo is
  'Il tipo del vincolo, come lo scrive Postgres: c = limite, u = unicita'', f = chiave esterna, x = esclusione. Serve a congelare la linea di partenza UNA VOLTA PER TIPO: senza, la guardia del 25/08 (che guarda l''intera tabella) impedirebbe per sempre di congelare i tipi aggiunti dopo.';

-- ---------------------------------------------------------------------
-- 3 · La linea di partenza delle chiavi esterne che rifiutano
-- ---------------------------------------------------------------------
-- ⚠️ Le unicita' NON si congelano: le ventitre' frasi sono scritte qui
-- sopra, quindi da adesso il conto dei muti fra le unicita' e' ZERO ed e'
-- una proprieta', non un perdono.
insert into vincoli_muti_noti (conname, tabella, tipo)
select c.conname, t.relname, c.contype
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  join pg_namespace n on n.oid = t.relnamespace
 where n.nspname = 'public'
   and c.contype = 'f'
   and c.confdeltype in ('r', 'a')
   and obj_description(c.oid, 'pg_constraint') is null
   and not exists (select 1 from vincoli_muti_noti v where v.tipo = 'f')
on conflict (conname) do nothing;

-- ---------------------------------------------------------------------
-- 4 · Il guardiano guarda tutte e quattro le forme che sa tradurre
-- ---------------------------------------------------------------------
create or replace function public.vincoli_senza_frase()
returns table (conname text, tabella text, definizione text)
language plpgsql
stable security definer
set search_path to 'public'
as $function$
begin
  if not is_titolare() then
    raise exception 'Riservato al titolare.';
  end if;
  return query
  select c.conname::text, t.relname::text, pg_get_constraintdef(c.oid)
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
   where n.nspname = 'public'
     -- ⚠️ LE QUATTRO FORME CHE `nomeDelVincolo()` SA RICONOSCERE, e non una
     -- di piu': una rete che pretendesse una frase per un rifiuto che il
     -- gestionale non sa nemmeno intercettare chiederebbe un lavoro che non
     -- arriva a nessuno.
     and (
       c.contype in ('c', 'u', 'x')
       -- ⚠️ Delle chiavi esterne solo quelle che RIFIUTANO. `cascade` e
       -- `set null` agiscono invece di rifiutare: sono 111 su 176, e
       -- pretendere una frase da loro riempirebbe la rete di lavoro per un
       -- messaggio che nessuno leggera' mai.
       or (c.contype = 'f' and c.confdeltype in ('r', 'a'))
     )
     and obj_description(c.oid, 'pg_constraint') is null
     and c.conname not in (select v.conname from vincoli_muti_noti v)
   order by t.relname, c.conname;
end $function$;

comment on function public.vincoli_senza_frase() is
  'I vincoli che possono RIFIUTARE un gesto e non hanno una spiegazione in italiano, esclusa la linea di partenza congelata. Copre le quattro forme che il gestionale sa riconoscere in un messaggio di Postgres: limiti, unicita'', esclusioni e le chiavi esterne che rifiutano una cancellazione (`restrict` e `no action`). Le chiavi esterne `cascade` e `set null` sono fuori apposta: non rifiutano, agiscono. Quando ne compare uno, chi riceve quel rifiuto legge «c''e'' una regola che lo impedisce» senza sapere quale.';

revoke all on function public.vincoli_senza_frase() from public, anon, authenticated;
grant execute on function public.vincoli_senza_frase() to authenticated;

-- ---------------------------------------------------------------------
-- 5 · La quinta forma: manca un dato obbligatorio
-- ---------------------------------------------------------------------
create or replace function public.spiega_campo_obbligatorio(p_tabella text, p_colonna text)
returns text
language plpgsql
stable security definer
set search_path to 'public'
as $function$
begin
  if auth.uid() is null then
    raise exception 'Operazione consentita solo a un utente autenticato';
  end if;

  return (
    select col_description(c.oid, a.attnum)
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      join pg_attribute a on a.attrelid = c.oid and a.attname = p_colonna
     where n.nspname = 'public'
       and c.relname = p_tabella
       and a.attnum > 0
       and not a.attisdropped
     limit 1
  );
end $function$;

comment on function public.spiega_campo_obbligatorio(text, text) is
  'Come si chiama in italiano un dato obbligatorio, per poterlo dire a chi ha appena ricevuto «violates not-null constraint». Restituisce il commento della colonna, oppure niente: senza commento chi chiama usa il nome tecnico invece di inventare una spiegazione. Al 28/08/2026 ce l''hanno 32 colonne obbligatorie su 341.';

revoke all on function public.spiega_campo_obbligatorio(text, text) from public, anon, authenticated;
grant execute on function public.spiega_campo_obbligatorio(text, text) to authenticated;

-- ---------------------------------------------------------------------
-- Verifica — provata ROMPENDOLA in due modi diversi
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_titolare  uuid;
  v_lapidi    bigint;
  v_lapidi2   bigint;
  v_muti      integer;
  v_unici     integer;
  v_congelati integer;
  v_colonna   text;
  v_doppi     integer;
begin
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  if v_titolare is null then
    raise exception 'Serve un titolare per verificare.';
  end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

  select count(*) into v_lapidi from deleted_records;

  -- (a) NESSUN NOME DOPPIO fra i vincoli che la rete guarda. `conname` e' la
  --     chiave primaria della linea di partenza: se due tabelle avessero un
  --     vincolo con lo stesso nome, il congelamento ne perderebbe uno IN
  --     SILENZIO e la rete tacerebbe su di lui per sempre.
  select count(*) into v_doppi from (
    select c.conname
      from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace
     where n.nspname = 'public'
       and (c.contype in ('c','u','x') or (c.contype = 'f' and c.confdeltype in ('r','a')))
     group by c.conname having count(*) > 1
  ) x;
  if v_doppi > 0 then
    raise exception 'Ci sono % nomi di vincolo ripetuti: la linea di partenza ne perderebbe uno in silenzio.', v_doppi;
  end if;

  -- (b) LE VENTITRE' FRASI CI SONO — e si guarda la PROPRIETA', non il
  --     numero: «nessuna unicita' e' muta» resta vera anche il giorno che ne
  --     nasce una ventiquattresima con la sua frase.
  select count(*) into v_unici
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
   where n.nspname = 'public' and c.contype = 'u'
     and obj_description(c.oid, 'pg_constraint') is null;
  if v_unici > 0 then
    raise exception 'Ci sono ancora % vincoli di unicita'' senza frase italiana.', v_unici;
  end if;

  -- (c) LA LINEA DI PARTENZA DELLE CHIAVI ESTERNE NON E' VUOTA. Vuota, il
  --     controllo (d) sarebbe verde per il motivo sbagliato — non «nessuno
  --     e' muto» ma «non ho guardato».
  select count(*) into v_congelati from vincoli_muti_noti where tipo = 'f';
  if v_congelati = 0 then
    raise exception 'Nessuna chiave esterna congelata: la linea di partenza non e'' stata scritta.';
  end if;

  -- (d) E ADESSO IL GUARDIANO TACE, perche' tutto cio' che e' muto e'
  --     dichiarato.
  select count(*) into v_muti from vincoli_senza_frase();
  if v_muti > 0 then
    raise exception 'Il guardiano trova % vincoli muti fuori dalla linea di partenza.', v_muti;
  end if;

  -- (e) ROTTURA 1 — un'UNICITA' nata muta dev'essere vista. E' la forma che
  --     prima di questa migrazione era invisibile per sempre.
  create table _prova_muto_28082026 (id int primary key, x int);
  alter table _prova_muto_28082026 add constraint prova_muto_unico_28082026 unique (x);
  select count(*) into v_muti from vincoli_senza_frase() r where r.conname = 'prova_muto_unico_28082026';
  if v_muti <> 1 then
    raise exception 'Un''unicita'' nata muta non viene vista dal guardiano: e'' il difetto che questa migrazione chiude.';
  end if;
  comment on constraint prova_muto_unico_28082026 on _prova_muto_28082026 is 'Prova.';
  select count(*) into v_muti from vincoli_senza_frase() r where r.conname = 'prova_muto_unico_28082026';
  if v_muti <> 0 then
    raise exception 'Scritta la frase, il guardiano continua a segnalare.';
  end if;

  -- (f) ROTTURA 2 — una chiave esterna `cascade` nata muta NON dev'essere
  --     segnalata. ⚠️ Serve quanto la prima e va nel verso opposto: una rete
  --     troppo larga chiederebbe 111 frasi per rifiuti che nessuno vedra'
  --     mai, e una rete che chiede sempre viene spenta.
  create table _prova_figlia_28082026 (
    id int primary key,
    padre int not null references _prova_muto_28082026(id) on delete cascade
  );
  select count(*) into v_muti from vincoli_senza_frase() r where r.tabella = '_prova_figlia_28082026';
  if v_muti <> 0 then
    raise exception 'Una chiave esterna «cascade» viene segnalata: la rete e'' piu'' larga di cio'' che sa tradurre.';
  end if;

  -- (g) E UNA `restrict` NELLA STESSA TABELLA DEV'ESSERE SEGNALATA: senza
  --     questo confronto, (f) potrebbe essere verde perche' la rete non
  --     guarda affatto le chiavi esterne.
  alter table _prova_figlia_28082026
    add constraint prova_muto_restrict_28082026 foreign key (padre)
    references _prova_muto_28082026(id) on delete restrict;
  select count(*) into v_muti from vincoli_senza_frase() r where r.conname = 'prova_muto_restrict_28082026';
  if v_muti <> 1 then
    raise exception 'Una chiave esterna «restrict» nata muta non viene vista.';
  end if;

  drop table _prova_figlia_28082026;
  drop table _prova_muto_28082026;

  -- (h) LA QUINTA FORMA RISPONDE. ⚠️ Si sceglie una colonna che ha DAVVERO
  --     un commento, altrimenti si starebbe misurando il ramo «non ce l'ha»
  --     credendo di misurare l'altro (trappola del caso vuoto, 17/08).
  select a.attname into v_colonna
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
   where n.nspname = 'public' and c.relkind = 'r' and a.attnotnull
     and col_description(c.oid, a.attnum) is not null
     and c.relname = 'vincoli_muti_noti'
   limit 1;
  if v_colonna is null then
    raise exception 'Non trovo la colonna con commento su cui provare la quinta forma.';
  end if;
  if spiega_campo_obbligatorio('vincoli_muti_noti', v_colonna) is null then
    raise exception 'La quinta forma non restituisce il commento di una colonna che ce l''ha.';
  end if;

  -- (i) SENZA COMMENTO SI RISPONDE VUOTO, non si inventa.
  if spiega_campo_obbligatorio('vincoli_muti_noti', 'congelato_il') is not null then
    raise exception 'Una colonna senza commento riceve una spiegazione inventata.';
  end if;

  select count(*) into v_lapidi2 from deleted_records;
  if v_lapidi2 <> v_lapidi then
    raise exception 'La verifica ha lasciato % lapidi nel registro.', v_lapidi2 - v_lapidi;
  end if;

  raise notice 'Ventitre'' frasi scritte, % chiavi esterne congelate, zero unicita'' mute, la quinta forma risponde.', v_congelati;
end $verifica$;

insert into applied_migrations (version, name)
values ('20260828000001', 'il_rifiuto_che_non_diceva_quale') on conflict (version) do nothing;
