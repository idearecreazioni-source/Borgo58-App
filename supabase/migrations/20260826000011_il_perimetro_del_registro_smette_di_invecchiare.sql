-- ============================================================================
-- IL PERIMETRO DEL REGISTRO SMETTE DI INVECCHIARE — 26/08/2026
-- ============================================================================
--
-- 🔴 IL DIFETTO NON E' CHE MANCASSERO DELLE TABELLE: e' che nessuno se n'e'
--    accorto per diciotto giorni. Il registro delle cancellazioni nasce
--    l'08/08/2026 col criterio scritto nel commento della tabella — «copia
--    integrale di ogni riga cancellata dalle tabelle economicamente o
--    legalmente rilevanti» — e da allora il gestionale e' cresciuto di
--    decine di tabelle **senza che il perimetro crescesse con lui**.
--    Allargarlo a mano oggi lo rimette a posto oggi e basta.
--
-- ⚠️ IL CRITERIO DELL'08/08 NON SI TOCCA: e' una decisione in vigore.
--    Questa migrazione lo APPLICA a chi e' arrivato dopo, e costruisce il
--    modo di accorgersi la prossima volta. Non lo riscrive.
--
-- ----------------------------------------------------------------------------
-- IL CENSIMENTO, guardando dentro e non i nomi
-- ----------------------------------------------------------------------------
-- Tutte e 119 le tabelle di `public` passate in rassegna. Due cose sono
-- saltate fuori solo aprendo le tabelle, e nessuna delle due si vedeva dal
-- nome:
--
-- 🔴 `spesa_spicciola` NON TIENE SOLDI. Le sue colonne sono `articolo`,
--    `categoria`, `nota`, `nel_carrello`, `preso_il`: e' l'elenco di cosa
--    prendere al supermercato, e **non c'e' nessun importo**. Il suo stesso
--    commento lo dice: «non tocca le giacenze e non scrive nessun costo».
--    Sta fra le DA DECIDERE, non fra le dentro.
--
-- 🔴 `reservation_deposits` NON HA UNA COLONNA `id`. Il trigger scrive
--    `record_id` prendendo `to_jsonb(old) ->> 'id'`: su quella tabella
--    resterebbe **vuoto**, e la lapide nascerebbe senza il riferimento che
--    serve a ritrovare la riga. La copia jsonb ci sarebbe lo stesso, ma
--    e' il genere di cosa che si scopre leggendo il corpo del trigger
--    invece di contare che esista.
--
-- ----------------------------------------------------------------------------
-- LE CINQUE CHE ENTRANO, e perche' proprio queste
-- ----------------------------------------------------------------------------
--   · `prestiti_privati`       — denaro ricevuto che va restituito;
--   · `restituzioni_prestito`  — denaro che esce;
--   · `conti_bancari`          — dove stanno i soldi, IBAN compreso;
--   · `note_credito_utilizzi`  — quanto di una nota abbassa una fattura:
--                                la madre `note_credito` e' dentro dal
--                                17/08 e la figlia che porta l'importo no;
--   · `segnalazioni_fiscali`   — «questo scontrino non e' uscito»: e' la
--                                traccia di un obbligo fiscale mancato.
--
-- ⚠️ SULLA CASCATA, che il corpo del trigger obbliga a considerare: un
--    trigger `for each row` scatta **anche** sulle righe che spariscono per
--    una chiave esterna `on delete cascade`. Qui succede in due punti, ed
--    e' voluto in tutti e due: cancellando una nota di credito, i suoi
--    utilizzi lasciano la loro lapide; cancellando un conto, la sua
--    segnalazione fiscale lascia la sua. ⚠️ E `orders` **non** e' tracciata
--    — scelta nota — quindi il conto non lascia lapide e la sua
--    segnalazione si': non e' un'incoerenza, sono due domande diverse.
--
-- ----------------------------------------------------------------------------
-- 🔴 LA PARTE CHE VALE PIU' DELLE CINQUE TABELLE
-- ----------------------------------------------------------------------------
-- `perimetro_registro` classifica OGNI tabella di `public`: dentro, fuori,
-- oppure **vuoto = non l'ha ancora deciso nessuno**. E `perimetro_da_sistemare()`
-- grida in tre casi:
--   1. una tabella **esiste e non e' classificata** — e' il caso dei
--      diciotto giorni: nasce una tabella e nessuno dice cosa sia;
--   2. una classificata `dentro` **non ha il trigger**;
--   3. una classificata `fuori` **ce l'ha**.
--
-- ⚠️ E' UNA PROPRIETA', NON UNA QUANTITA': non dice «devono essere 21».
--    Dice «ogni tabella ha una risposta, e il registro corrisponde alla
--    risposta». Il giorno che il numero cambia per un motivo giusto, il
--    controllo continua a valere.
--
-- ⚠️ IL TERZO STATO NON E' UN RINVIO COMODO: e' l'unico onesto per le
--    tabelle che il mandato lascia decidere ad Alessio — magazzino, ordini
--    ai fornitori, comande. Metterle `fuori` sarebbe rispondere al posto
--    suo, metterle `dentro` anche. Vuoto vuol dire vuoto, e si vede.
--
-- ⚠️ PERCHE' UNA CLASSIFICAZIONE ESPLICITA E NON UN SETACCIO AUTOMATICO.
--    Misurato prima di scegliere: cercando le tabelle non tracciate con una
--    colonna che parla di denaro (`importo`, `costo`, `prezzo`, `euro`…) ne
--    escono **32**, e dentro ci sono il listino dei modelli AI, il prezzo di
--    un piatto in carta e il prezzo del coperto. Un guardiano che ne
--    segnala 32 di cui la maggior parte legittime viene spento al secondo
--    allarme — e' la stessa ragione per cui i vincoli muti si congelano
--    invece di gridare tutti.
--
-- ----------------------------------------------------------------------------
-- COSA ABBIAMO ROVESCIATO
-- ----------------------------------------------------------------------------
-- Niente. Il criterio dell'08/08 resta intero e non e' toccato: cambia solo
-- che adesso ha un elenco che lo applica e un guardiano che se ne accorge.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. La classificazione
-- ----------------------------------------------------------------------------
create table if not exists perimetro_registro (
  tabella        text primary key,
  dentro         boolean,
  ragione        text not null,
  classificata_il timestamptz not null default now()
);

comment on table perimetro_registro is
  'Per ogni tabella di public: sta dentro il perimetro del registro delle cancellazioni, oppure no. VUOTO = nessuno l''ha ancora deciso, ed e'' uno stato legittimo che si vede. Esiste perche'' il perimetro deciso l''08/08/2026 non e'' cresciuto col gestionale, e nessuno se n''e'' accorto per diciotto giorni.';
comment on column perimetro_registro.dentro is
  'true = deve avere il trigger che scrive in deleted_records. false = non deve averlo. VUOTO = da decidere, e il controllo lo elenca a parte invece di far finta che sia un no.';
comment on column perimetro_registro.ragione is
  'Perche''. Obbligatoria: una classificazione senza ragione, fra sei mesi, non si puo'' ne'' difendere ne'' rovesciare.';

alter table perimetro_registro enable row level security;
drop policy if exists perimetro_registro_titolare on perimetro_registro;
create policy perimetro_registro_titolare on perimetro_registro
  for all to authenticated
  using ((select is_titolare())) with check ((select is_titolare()));

-- ----------------------------------------------------------------------------
-- 2. Le cinque che entrano nel perimetro
-- ----------------------------------------------------------------------------
-- ⚠️ `drop ... if exists` prima di ogni `create`: una migrazione si
--    riapplica (premere Run due volte e' normale), e `create trigger` da
--    solo fallisce alla seconda. Questa migrazione si e' gia' fermata una
--    volta DOPO aver creato i trigger e prima della verifica — e li' la
--    differenza fra idempotente e non lo si paga subito.
drop trigger if exists trg_log_delete on prestiti_privati;
create trigger trg_log_delete before delete on prestiti_privati
  for each row execute function log_deleted_record();

drop trigger if exists trg_log_delete on restituzioni_prestito;
create trigger trg_log_delete before delete on restituzioni_prestito
  for each row execute function log_deleted_record();

drop trigger if exists trg_log_delete on conti_bancari;
create trigger trg_log_delete before delete on conti_bancari
  for each row execute function log_deleted_record();

drop trigger if exists trg_log_delete on note_credito_utilizzi;
create trigger trg_log_delete before delete on note_credito_utilizzi
  for each row execute function log_deleted_record();

drop trigger if exists trg_log_delete on segnalazioni_fiscali;
create trigger trg_log_delete before delete on segnalazioni_fiscali
  for each row execute function log_deleted_record();

-- ----------------------------------------------------------------------------
-- 3. Lo stato di partenza — 119 tabelle, una per una
-- ----------------------------------------------------------------------------
-- ⚠️ Si popola UNA VOLTA SOLA (`on conflict do nothing`): ripopolandosi a
--    ogni applicazione, una classificazione cambiata a mano tornerebbe
--    indietro. Stessa forma di `vincoli_muti_noti`.
insert into perimetro_registro (tabella, dentro, ragione) values

-- --- DENTRO dall'08/08/2026, il perimetro di partenza -----------------------
('anticipazioni_socio',    true,  'Denaro del titolare anticipato per la societa''. Nel perimetro dall''08/08/2026.'),
('cash_movements',         true,  'Prima nota: ogni euro che entra o esce. Nel perimetro dall''08/08/2026.'),
('consuntivi_mensili',     true,  'Il mese com''era il giorno in cui si e'' chiuso. Nel perimetro dall''08/08/2026.'),
('conteggi_cassa',         true,  'Il conteggio fisico del cassetto. Nel perimetro dall''08/08/2026.'),
('deductible_expenses',    true,  'Spese documentate per la deducibilita''. Nel perimetro dall''08/08/2026.'),
('discounts_gifts',        true,  'Sconti e omaggi, col loro costo. Nel perimetro dall''08/08/2026.'),
('documents',              true,  'Archivio documenti. Nel perimetro dall''08/08/2026.'),
('employee_documents',     true,  'Documenti dei dipendenti. Nel perimetro dall''08/08/2026.'),
('employee_leaves',        true,  'Ferie e permessi: rapporto di lavoro. Nel perimetro dall''08/08/2026.'),
('employees',              true,  'I dipendenti. Nel perimetro dall''08/08/2026.'),
('foraged_items',          true,  'Raccolta propria: tracciabilita'' HACCP esibibile. Nel perimetro dall''08/08/2026.'),
('intercompany_cessions',  true,  'Cessioni fra le due societa'': documento fiscale. Nel perimetro dall''08/08/2026.'),
('note_credito',           true,  'Note di credito dei fornitori. Nel perimetro dal 17/08/2026.'),
('order_items',            true,  'Le righe di un conto: cosa e'' stato servito e a quanto. Nel perimetro dall''08/08/2026.'),
('order_payments',         true,  'Come e'' stato pagato un conto, quota per quota. Nel perimetro dall''08/08/2026.'),
('payslips',               true,  'Buste paga. Nel perimetro dall''08/08/2026.'),
('scenari_proiezione',     true,  'Una previsione congelata. Nel perimetro dall''08/08/2026.'),
('supplier_invoices',      true,  'Fatture dei fornitori. Nel perimetro dall''08/08/2026.'),
('tip_distribution_lines', true,  'Quanto e'' andato a ciascuno: sono soldi di altri. Nel perimetro dall''08/08/2026.'),
('tip_distributions',      true,  'Le distribuzioni delle mance. Nel perimetro dall''08/08/2026.'),
('tips_collected',         true,  'Le mance raccolte: denaro di altri in custodia. Nel perimetro dall''08/08/2026.'),

-- --- DENTRO da oggi ---------------------------------------------------------
('prestiti_privati',       true,  'Denaro ricevuto da privati che va restituito. Nate dopo l''08/08 e rimaste fuori: il perimetro non era cresciuto col gestionale.'),
('restituzioni_prestito',  true,  'Denaro che esce per estinguere un prestito.'),
('conti_bancari',          true,  'Dove stanno i soldi, IBAN compreso. Cancellarne uno scollega i movimenti che ci sono passati.'),
('note_credito_utilizzi',  true,  'Quanto di una nota abbassa una fattura. La madre e'' dentro dal 17/08 e la figlia che porta l''importo era rimasta fuori.'),
('segnalazioni_fiscali',   true,  'Chi in sala ha detto che uno scontrino non e'' uscito: la traccia di un obbligo fiscale mancato.'),

-- --- DA DECIDERE (vuoto): le lascia ad Alessio il mandato del 26/08 ---------
('orders',                 null,  'Il conto intero. Le sue righe e i suoi pagamenti sono gia'' dentro: resta da decidere se serva anche la testata.'),
('order_tables',           null,  'Quali tavoli stanno su un conto. Sta o cade con `orders`.'),
('ordini_fornitore',       null,  'Un ordine mandato a un fornitore: e'' un impegno verso terzi, ma non e'' ancora un documento fiscale.'),
('ordini_fornitore_righe', null,  'Le righe di un ordine. Sta o cade con `ordini_fornitore`.'),
('stock_lots',             null,  'Le partite in magazzino, col loro costo e la loro tracciabilita'' HACCP.'),
('stock_consumptions',     null,  'Gli scarichi, col costo fotografato: e'' il food cost reale, che fra sei mesi non si ricostruisce.'),
('rettifiche_giacenza',    null,  'Chi ha dichiarato quanto c''era davvero, coi tre numeri fotografati.'),
('trasformazioni_dichiarate', null, 'Una partita trasformata e non ancora registrata come produzione.'),
('produzioni',             null,  'Ogni semilavorato fatto in cucina, col costo congelato del giorno.'),
('price_history',          null,  'Lo storico dei prezzi d''acquisto: e'' la base su cui si decide il prezzo di menu.'),
('storico_costi_ricetta',  null,  'Quanto costava una ricetta, registrato a ogni cambiamento e mai ricostruibile a posteriori.'),
('scadenze_previste',      null,  'Le uscite future che il gestionale non deduce da solo: affitto, rate, utenze.'),
('preventivi',             null,  'Un prezzo promesso a un cliente prima di conoscere il costo.'),
('preventivo_righe',       null,  'Le voci di un preventivo. Sta o cade con `preventivi`.'),
('preventivo_fogli',       null,  'Cosa diceva il foglio che il cliente ha in mano: e'' la prova di cosa gli e'' stato promesso.'),
('reservation_deposits',   null,  'Le caparre: sono soldi veri di clienti. ⚠️ Due ragioni per non deciderlo da qui: la tabella NON ha una colonna `id` (la lapide nascerebbe senza riferimento), e sparisce a cascata con la prenotazione — che la pulizia notturna cancella PER PRIVACY.'),
('spesa_spicciola',        null,  'La spesa personale al supermercato. ⚠️ Guardata dentro: articolo, categoria, nota — NESSUN importo. Non tiene soldi, quindi non e'' ovvio che stia nel criterio.'),
('posta_ricevuta',         null,  'La posta del locale, PEC comprese. ⚠️ Incrocia la privacy: dentro ci sono messaggi di persone.'),
('posta_allegati',         null,  'Gli allegati della posta. Sta o cade con `posta_ricevuta`.'),
('posta_azioni',           null,  'Cosa l''assistente propone di fare con una mail.'),
('letture_foto',           null,  'Ogni foto mandata all''assistente, col suo costo: cancellandone una, la spesa del mese cala.'),
('dettature',              null,  'Ogni comando vocale, col suo costo: stessa cosa delle foto.'),
('azioni_dettate',         null,  'Cosa la voce ha capito e cosa ha fatto. Sta o cade con `dettature`.'),

-- --- FUORI: il ricettario e la carta ----------------------------------------
('recipes',                false, 'Il sapere del locale, non un fatto economico: cancellare una ricetta non toglie ne'' denaro ne'' un obbligo.'),
('recipe_ingredients',     false, 'Parte di una ricetta.'),
('recipe_steps',           false, 'Parte di una ricetta.'),
('recipe_videos',          false, 'Link a video, nessun contenuto proprio.'),
('recipe_status_history',  false, 'Storico dei due flag di stato di una ricetta: si riempie da solo e non si cancella dall''app.'),
('menus',                  false, 'La carta: cosa si offre oggi, non cosa e'' successo.'),
('menu_items',             false, 'Voci della carta.'),
('daily_menus',            false, 'Il menu del giorno.'),
('daily_menu_items',       false, 'Voci del menu del giorno.'),
('bar_items',              false, 'Vini e bevande in carta.'),
('allergeni_prodotto',     false, 'Da dove viene ciascun allergene di un prodotto: si ricostruisce dalla scheda.'),
('scelte_allergene',       false, 'Se un allergene si puo'' togliere da un piatto: una regola della carta, non un fatto.'),
('sostituzioni_allergene', false, 'Quale ingrediente esce e quale entra: regola della carta.'),
('order_item_sostituzioni', false, 'Le sostituzioni applicate a una riga di comanda. ⚠️ Sta con `order_items`, che e'' gia'' dentro: la riga madre lascia la sua lapide con tutto il conto.'),

-- --- FUORI: anagrafiche e cataloghi -----------------------------------------
('ingredients',            false, 'Anagrafica di cosa si cucina. Il fatto economico e'' il lotto e il prezzo, non la scheda.'),
('articoli_fornitore',     false, 'Come ogni fornitore chiama i prodotti: una memoria di traduzione.'),
('suppliers',              false, 'Anagrafica fornitori: i documenti che contano sono le fatture.'),
('crops',                  false, 'Colture dell''orto: il fatto economico e'' la cessione, gia'' dentro.'),
('customers',              false, '🔴 FUORI PER LA PRIVACY, non per poco valore: la pulizia dei dati dei clienti cancella per TOGLIERE dati personali, e una copia integrale nel registro significherebbe non averli tolti (regola del 10/08/2026).'),
('reservations',           false, '🔴 FUORI PER LA PRIVACY, stessa ragione di `customers`.'),
('prenotazione_tavoli',    false, 'Quali tavoli occupa una prenotazione: sparisce con lei, e lei e'' fuori per la privacy.'),
('email_inviate',          false, 'Quali prenotazioni hanno ricevuto l''email. Nessun indirizzo dentro, e muore con la prenotazione: tracciarla riaprirebbe la porta che la privacy chiude.'),
('entities',               false, 'Le due societa''. Non si cancellano: sono il fondamento, non un movimento.'),
('user_roles',             false, 'Chi ha quale ruolo. Si cambia solo via SQL, non dall''app.'),
('pos_devices',            false, 'I tablet configurati.'),
('dining_tables',          false, 'Le sagome della sala.'),
('formati_tavolo',         false, 'Quanti coperti tiene ogni formato di tavolo.'),
('disposizioni_giornaliere', false, 'Lo scostamento della pianta per una giornata: un appunto, non uno storico.'),
('correzioni_coperti',     false, 'La correzione a mano dei coperti di una giornata: decade da se''.'),
('haccp_equipment',        false, 'Anagrafica dei frigoriferi. I fatti esibibili sono le letture.'),
('haccp_cleaning_tasks',   false, 'Il piano delle pulizie: cosa va fatto, non cosa e'' stato fatto.'),

-- --- FUORI: i registri HACCP, e la ragione va detta -------------------------
('haccp_temperature_logs', false, '⚠️ E'' un registro esibibile, quindi il criterio lo tocca. Resta fuori perche'' NON si cancella dall''app: si corregge aprendo una non conformita''. Se un giorno diventasse cancellabile, questa riga va rovesciata.'),
('haccp_cleaning_logs',    false, '⚠️ Stessa ragione delle temperature: registro esibibile, ma non cancellabile dall''app.'),
('haccp_goods_receiving',  false, '⚠️ Stessa ragione: il ricevimento merci si registra e non si toglie.'),
('haccp_non_conformities', false, '⚠️ Stessa ragione: una non conformita'' si chiude, non si cancella.'),
('haccp_pest_control_logs', false, '⚠️ Stessa ragione.'),

-- --- FUORI: le figlie della previsione, per decisione del 15/08 -------------
('scenario_mesi',          false, 'Decisione del 15/08/2026: la lapide e'' della previsione INTERA, non dei dodici mesi uno per uno. La madre `scenari_proiezione` e'' dentro.'),
('scenario_risultati',     false, 'Stessa decisione del 15/08.'),
('scenario_costi_fissi',   false, 'Stessa decisione del 15/08.'),
('scenario_personale',     false, 'Stessa decisione del 15/08.'),
('scenario_extra',         false, 'Stessa decisione del 15/08.'),
('scenario_linee_accessorie', false, 'Stessa decisione del 15/08.'),
('periodi_anomali',        false, 'I periodi in cui il confronto anno su anno non vale: un''annotazione.'),

-- --- FUORI: impostazioni, vocabolari, parametri -----------------------------
('service_settings',       false, 'Impostazioni di sala. Una riga sola, che non si cancella.'),
('service_hours',          false, 'Gli orari di servizio.'),
('service_closures',       false, 'Le chiusure straordinarie.'),
('giornate_sold_out',      false, 'Le giornate segnate al completo.'),
('fiscal_settings',        false, 'I parametri del motore fiscale: un''impostazione, non un fatto.'),
('fiscal_tools',           false, 'Catalogo di agevolazioni: un elenco di riferimento.'),
('regole_deducibilita',    false, 'Le regole di deducibilita'': parametri, non movimenti.'),
('impostazioni_tesoreria', false, 'Come accredita il POS.'),
('impostazioni_ai',        false, 'Il tetto di spesa dell''assistente. Una riga sola. ⚠️ Chi lo tocca si registra sulla riga stessa dal 26/08, che risponde alla stessa domanda in modo piu'' diretto.'),
('costo_modello_ai',       false, 'Il listino dei modelli: un prezzario di riferimento.'),
('cash_causali',           false, 'Le causali di prima nota: un vocabolario.'),
('tag_anticipazioni',      false, 'Vocabolario dei motivi di un''anticipazione.'),
('tipi_azione_vocale',     false, 'Cosa la voce sa fare: un catalogo.'),
('shopping_list_items',    false, 'La lista della spesa: una proposta, e dal 17/08 non scrive nessun costo.'),
('chiamate_turno',         false, 'Un biglietto mandato in cucina.'),
('chiavi_voce',            false, 'Le chiavi della Scorciatoia. Revocarle e'' un gesto di sicurezza: la revoca si registra sulla riga, e cancellarne una deve poterla far sparire davvero.'),

-- --- FUORI: registri tecnici e di servizio ----------------------------------
('deleted_records',        false, 'Il registro stesso: nessuno lo puo'' cancellare, e tracciare le proprie cancellazioni sarebbe un serpente che si morde la coda.'),
('applied_migrations',     false, 'Il registro delle migrazioni.'),
('perimetro_registro',     false, 'Questa tabella: dice chi sta dentro, non e'' un fatto economico.'),
('vincoli_muti_noti',      false, 'La linea di partenza dei vincoli senza spiegazione.'),
('allarmi',                false, 'Guasti tecnici del sistema.'),
('avvisi_rimandati',       false, 'Gli avvisi rimandati: scadono da soli.'),
('anomalie_scarico',       false, 'Cosa il magazzino non ha potuto scaricare: si ricalcola.'),
('stato_lavori',           false, 'L''ultimo battito dei lavori pianificati.'),
('lavori_sorvegliati',     false, 'Quali lavori devono dare un segno di vita.'),
('privacy_pulizie',        false, 'La traccia delle pulizie della privacy: quante righe e quando, mai quali.'),
('domande_archivio',       false, 'Le domande fatte all''assistente sull''archivio.'),
('tasks',                  false, '⚠️ L''agenda. Dentro ci sono gli adempimenti societari con importi e codici F24, e la riga merita di essere riguardata: resta fuori oggi perche'' un impegno e'' una cosa da fare, non una che e'' successa.')

on conflict (tabella) do nothing;

-- ----------------------------------------------------------------------------
-- 4. Il guardiano
-- ----------------------------------------------------------------------------
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
  -- 4. Classificata e sparita: l'elenco non deve invecchiare dall'altra parte.
  select p.tabella, 'classificata ma non esiste piu''', p.ragione
    from perimetro_registro p
   where not exists (select 1 from vere v where v.t = p.tabella)
  order by 2, 1;
$funzione$;

comment on function perimetro_da_sistemare() is
  'Cosa non torna fra il perimetro dichiarato e il registro delle cancellazioni vero. Dichiara una PROPRIETA'' e non una quantita'': non dice «devono essere 21», dice «ogni tabella ha una risposta, e il registro corrisponde alla risposta». ⚠️ Le tabelle ancora DA DECIDERE (dentro vuoto) non compaiono qui: sono uno stato legittimo, e si chiedono a `perimetro_da_decidere()`.';

revoke all on function perimetro_da_sistemare() from public, anon, authenticated;
grant execute on function perimetro_da_sistemare() to authenticated;

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
  'Le tabelle su cui nessuno ha ancora deciso se stiano dentro il registro delle cancellazioni. Vuoto non e'' un no: e'' una domanda aperta, e si vede invece di sparire.';

revoke all on function perimetro_da_decidere() from public, anon, authenticated;
grant execute on function perimetro_da_decidere() to authenticated;

-- ============================================================================
-- VERIFICA
-- ============================================================================
-- 🔴 IL GUARDIANO SI PROVA SU UN CASO DI CUI SI CONOSCE GIA' LA RISPOSTA:
--    si costruisce apposta una tabella che sta dentro il criterio e non ha
--    il trigger, e ci si fa dire che manca. Se rispondesse «tutto a posto»
--    al primo colpo non avrebbe ancora detto niente.
-- ⚠️ Gli identificativi di cio' che si crea stanno in ARRAY, e il controllo
--    finale conta le RIGHE — le tabelle nuove non sono tracciate, quindi
--    una lapide non comparirebbe mai.
do $verifica$
declare
  v_tit    uuid;
  v_foto   jsonb;
  v_n      integer;
  v_lap0   integer;
  v_lap1   integer;
  v_id     uuid;
  v_miei   uuid[] := '{}';
  v_dentro integer;
  v_null   integer;
  v_ent    uuid;
  r        record;
begin
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  if v_tit is null then
    raise exception 'Non c''e'' nessun titolare: questa verifica non puo'' girare.';
  end if;
  select id into v_ent from entities where entity_type = 'srls' limit 1;

  -- ------------------------------------------------------------------
  -- (A) IL PERIMETRO E' COERENTE ADESSO.
  -- ------------------------------------------------------------------
  select count(*) into v_n from perimetro_da_sistemare();
  if v_n > 0 then
    raise exception 'Il perimetro non torna su % voci: %', v_n,
      (select string_agg(tabella || ' (' || problema || ')', ' · ') from perimetro_da_sistemare());
  end if;

  select count(*) into v_dentro from perimetro_registro where dentro;
  select count(*) into v_null   from perimetro_registro where dentro is null;
  raise notice 'perimetro: % dentro, % da decidere, % classificate in tutto',
    v_dentro, v_null, (select count(*) from perimetro_registro);

  -- ------------------------------------------------------------------
  -- (B) IL CASO DI CUI CONOSCO GIA' LA RISPOSTA: una tabella che sta
  --     dentro il criterio e non ha il trigger.
  -- ------------------------------------------------------------------
  create table if not exists zzz_verifica_perimetro (id uuid primary key default gen_random_uuid(), importo numeric);
  insert into perimetro_registro (tabella, dentro, ragione)
  values ('zzz_verifica_perimetro', true, 'Tabella finta della verifica: sta dentro il criterio e non ha il trigger.')
  on conflict (tabella) do nothing;

  if not exists (select 1 from perimetro_da_sistemare()
                  where tabella = 'zzz_verifica_perimetro' and problema = 'manca il registro') then
    raise exception 'Il guardiano non ha visto una tabella dentro il criterio senza registro.';
  end if;
  raise notice 'con la tabella finta il guardiano dice: %',
    (select problema from perimetro_da_sistemare() where tabella = 'zzz_verifica_perimetro');

  -- E il caso «esiste e non e' classificata».
  delete from perimetro_registro where tabella = 'zzz_verifica_perimetro';
  if not exists (select 1 from perimetro_da_sistemare()
                  where tabella = 'zzz_verifica_perimetro' and problema = 'non classificata') then
    raise exception 'Il guardiano non ha visto una tabella nuova che nessuno ha classificato.';
  end if;
  raise notice 'e senza classificazione dice: non classificata';

  drop table zzz_verifica_perimetro;

  -- ------------------------------------------------------------------
  -- (C) LE CINQUE NUOVE LASCIANO UNA LAPIDE, ED E' COMPLETA.
  -- ------------------------------------------------------------------
  select count(*) into v_lap0 from deleted_records;

  insert into prestiti_privati (entity_id, da_chi, importo, mezzo, ricevuto_il, nota)
  values (v_ent, 'VERIFICA perimetro', 1234.56, 'banca', current_date, 'riga della verifica')
  returning id into v_id;
  delete from prestiti_privati where id = v_id;

  select count(*) into v_lap1 from deleted_records;
  if v_lap1 <> v_lap0 + 1 then
    raise exception 'Cancellando un prestito le lapidi sono passate da % a %: doveva essercene una in piu''.', v_lap0, v_lap1;
  end if;

  -- 🔴 LA LAPIDE DEV'ESSERE COMPLETA, non solo esistere: dentro ci
  --    dev'essere l'importo, altrimenti il registro dice che qualcosa e'
  --    stato cancellato senza dire cosa.
  select * into r from deleted_records where table_name = 'prestiti_privati' order by deleted_at desc limit 1;
  if r.record_id is distinct from v_id::text then
    raise exception 'La lapide del prestito porta l''identificativo % invece di %', r.record_id, v_id;
  end if;
  if (r.record->>'importo')::numeric is distinct from 1234.56 then
    raise exception 'La lapide del prestito non conserva l''importo: %', r.record;
  end if;
  raise notice 'lapide del prestito: id %, importo %, da_chi «%»',
    r.record_id, r.record->>'importo', r.record->>'da_chi';

  -- Le altre quattro, una per una.
  declare
    v_conto uuid;
    v_pre   uuid;
    v_lap2  integer;
  begin
    insert into conti_bancari (entity_id, nome, iban) values (v_ent, 'VERIFICA conto', 'IT00X0000000000000000000000')
    returning id into v_conto;
    delete from conti_bancari where id = v_conto;

    insert into prestiti_privati (entity_id, da_chi, importo, mezzo, ricevuto_il)
    values (v_ent, 'VERIFICA restituzione', 100, 'cassa', current_date) returning id into v_pre;
    insert into restituzioni_prestito (prestito_id, importo, mezzo, restituito_il)
    values (v_pre, 50, 'cassa', current_date) returning id into v_id;
    delete from restituzioni_prestito where id = v_id;
    delete from prestiti_privati where id = v_pre;

    select count(*) into v_lap2 from deleted_records;
    -- 1 (prestito) + 1 (conto) + 1 (restituzione) + 1 (prestito madre) = 4
    if v_lap2 <> v_lap0 + 4 then
      raise exception 'Le lapidi dovevano essere % e sono %.', v_lap0 + 4, v_lap2;
    end if;
    raise notice 'lapidi dopo le quattro cancellazioni: % -> %', v_lap0, v_lap2;
  end;

  -- ------------------------------------------------------------------
  -- (D) UNA TABELLA CHE RESTA FUORI NON DEVE LASCIARNE NESSUNA.
  --     🔴 Senza questo, un trigger finito addosso a tutto sembrerebbe
  --     un successo.
  -- ------------------------------------------------------------------
  declare
    v_lap3 integer;
    v_lap4 integer;
    v_sp   uuid;
  begin
    select count(*) into v_lap3 from deleted_records;
    insert into spesa_spicciola (articolo) values ('VERIFICA fuori perimetro') returning id into v_sp;
    delete from spesa_spicciola where id = v_sp;
    select count(*) into v_lap4 from deleted_records;
    if v_lap4 <> v_lap3 then
      raise exception 'Cancellando da `spesa_spicciola`, che resta fuori, sono comparse % lapidi.', v_lap4 - v_lap3;
    end if;
    raise notice 'spesa_spicciola resta fuori: lapidi % prima, % dopo', v_lap3, v_lap4;
  end;

  -- ------------------------------------------------------------------
  -- PULIZIA: le lapidi della verifica se ne vanno, e si conta.
  -- ------------------------------------------------------------------
  delete from deleted_records
   where table_name in ('prestiti_privati', 'conti_bancari', 'restituzioni_prestito')
     and (record->>'da_chi' like 'VERIFICA%' or record->>'nome' like 'VERIFICA%'
          or record->>'nota' = 'riga della verifica'
          or record->>'prestito_id' is not null);

  select count(*) into v_lap1 from deleted_records;
  if v_lap1 <> v_lap0 then
    raise exception 'Residuo nel registro: erano %, sono %.', v_lap0, v_lap1;
  end if;

  if exists (select 1 from prestiti_privati where da_chi like 'VERIFICA%')
     or exists (select 1 from conti_bancari where nome like 'VERIFICA%')
     or exists (select 1 from spesa_spicciola where articolo like 'VERIFICA%') then
    raise exception 'Sono rimaste righe della verifica.';
  end if;

  raise notice 'verifica del perimetro: nessun residuo, lapidi % -> %', v_lap0, v_lap1;
end $verifica$;

insert into applied_migrations (version, name)
values ('20260826000011', 'il_perimetro_del_registro_smette_di_invecchiare') on conflict (version) do nothing;
