-- =====================================================================
-- LE TABELLE CHE NESSUNO AVEVA CLASSIFICATO
-- 29/08/2026 — Blocco 5 (punto 5a) del mandato del 29/08 (sera)
-- =====================================================================
-- ⚠️ QUESTA MIGRAZIONE È UNA PROPOSTA, ed è scritta per essere letta e
-- corretta. Il criterio è dell'08/08 e non è toccato: *nel registro sta
-- ogni riga cancellata dalle tabelle economicamente o legalmente
-- rilevanti*. Alessio l'ha precisato il 26/08: **ci sta ciò la cui
-- cancellazione lascerebbe un buco che qualcuno un giorno dovrà spiegare
-- a un terzo** — un controllore, un consulente, un cliente.
--
-- Ogni riga qui sotto porta la sua ragione in una frase. Cambiarla vuol
-- dire cambiare `dentro` e riscrivere la ragione: il file si legge tutto
-- in una volta apposta.
--
-- ---------------------------------------------------------------------
-- 🔴 LE TABELLE DA CLASSIFICARE NON ERANO UNDICI: SONO SEDICI
-- ---------------------------------------------------------------------
-- Il mandato ne nomina undici — quelle con la classificazione **vuota**.
-- Misurato, ce ne sono altre **cinque che non compaiono affatto** nel
-- catalogo, nate dopo l'ultimo censimento:
--
--   · `cataloghi_vocabolario`, `categorie_ingrediente` — dal 27/08
--   · `settimana_cucina` — da IERI, col calendario della cucina
--   · `preparazioni_da_fare`, `preparazioni_ricorrenti` — da STANOTTE,
--     con questo stesso mandato
--
-- ⚠️ **Le ultime due sono mie, e classificarle è parte del lavoro**: ieri
-- una sessione ha lasciato `settimana_cucina` non classificata, e stanotte
-- avrei fatto lo stesso senza guardare. La rete se n'era accorta
-- (`perimetro_da_sistemare()` le nomina): il buco non era nel controllo,
-- era in chi non lo interrogava.
--
-- ---------------------------------------------------------------------
-- 🔴 E UNA MISURA HA CAMBIATO LA PROPOSTA
-- ---------------------------------------------------------------------
-- `order_tables` — quali tavoli stanno su un conto — sembrava dover
-- entrare per forza: `orders` è dentro dal 26/08, e la sua ragione scritta
-- dice «sta o cade con `orders`».
--
-- **Ma `order_tables` NON HA UNA COLONNA `id`** — guardato, non dedotto.
-- È esattamente l'ostacolo che tiene fuori le caparre: la lapide
-- nascerebbe **senza riferimento**, e una lapide senza `record_id` è la
-- cosa che il controllo del perimetro respinge. Quindi resta **da
-- decidere**, e la decisione ha un prerequisito tecnico, non di merito.
-- =====================================================================

insert into perimetro_registro (tabella, dentro, ragione) values

-- --- DENTRO ----------------------------------------------------------------
('preventivi', true,
 'Un prezzo promesso a un cliente prima di conoscere il costo. PROPOSTA del 29/08/2026: e'' il documento che dice cosa gli e'' stato promesso, e il terzo che un giorno lo chiedera'' e'' il cliente stesso.'),
('preventivo_fogli', true,
 'Cosa diceva il foglio che il cliente ha in mano. PROPOSTA del 29/08/2026: e'' la prova di cosa gli e'' stato promesso, fotografata al momento — e cancellarla lascia la promessa senza documento.'),
('preventivo_righe', true,
 'Le voci di un preventivo, coi loro importi. PROPOSTA del 29/08/2026: sta o cade con `preventivi`, e senza le righe la testata dichiara un totale che nessuno puo'' ricontrollare.'),
('scadenze_previste', true,
 'Le uscite future che il gestionale non deduce da solo: affitto, rate, utenze. PROPOSTA del 29/08/2026: le scrive Alessio a mano, e cancellarne una fa sparire un pagamento dovuto senza che niente lo dica.'),
('storico_costi_ricetta', true,
 'Quanto costava una ricetta, registrato a ogni cambiamento. PROPOSTA del 29/08/2026: e'' l''unica cosa che non si ricostruisce a posteriori — i prezzi di oggi non dicono quanto costava quel piatto a marzo, ed e'' da li'' che si spiega un margine.'),

-- --- FUORI -----------------------------------------------------------------
('dettature', false,
 '⚠️ FUORI PER ORA. PROPOSTA del 29/08/2026: ogni comando vocale col suo costo. Non e'' il documento di un fatto del locale — e'' il CONTATORE DI SPESA di uno strumento, e la spesa si sorveglia col tetto, che si guarda prima di ogni chiamata. ⚠️ L''argomento contrario va detto: cancellandone una la spesa del mese cala, quindi il numero non e'' piu'' ricontrollabile. Se quel totale diventera'' una cosa su cui si decide, questa riga va rovesciata.'),
('azioni_dettate', false,
 'Cosa la voce ha capito e cosa ha fatto. FUORI PER ORA con `dettature`, stessa proposta del 29/08/2026. ⚠️ Cio'' che l''azione ha PRODOTTO — un movimento di cassa, uno scarico — e'' tracciato per conto suo dall''08/08: qui resta il racconto di come e'' stato chiesto.'),
('letture_foto', false,
 'Ogni foto mandata all''assistente, col suo costo. FUORI PER ORA con `dettature`, stessa proposta e stessa ragione del 29/08/2026. ⚠️ La foto stessa non viene mai salvata: qui c''e'' solo quanto e'' costata leggerla.'),
('cataloghi_vocabolario', false,
 'Gli elenchi che il gestionale propone nei menu a tendina. PROPOSTA del 29/08/2026: e'' configurazione, non un fatto — non tiene soldi e non documenta niente che sia successo.'),
('categorie_ingrediente', false,
 'Le categorie dei prodotti, diventate dati il 27/08. PROPOSTA del 29/08/2026: configurazione, come sopra. ⚠️ Una categoria spenta resta legale per chi la porta, quindi cancellarne una non fa sparire nessun prodotto.'),
('settimana_cucina', false,
 'In quali giorni della settimana si lavora in cucina. PROPOSTA del 29/08/2026: e'' un''impostazione a sette righe fisse — non si cancella, si cambia — e il registro delle cancellazioni non ha niente da registrarci.'),
('preparazioni_da_fare', false,
 'La lista delle cose da fare in cucina, nata il 29/08/2026. PROPOSTA dello stesso giorno: e'' un promemoria, e si toglie con un tocco per costruzione — la voce sparisce da sola appena la produzione viene registrata. Non tiene soldi e non documenta niente.'),
('preparazioni_ricorrenti', false,
 'Ogni quanti giorni una preparazione torna in lista, nata il 29/08/2026. PROPOSTA dello stesso giorno: e'' un''impostazione, come `settimana_cucina`.'),

-- --- RESTANO DA DECIDERE ---------------------------------------------------
-- ⚠️ Queste tre NON si decidono da qui, e le ragioni sono diverse fra
-- loro. Restano con `dentro` vuoto, che il controllo distingue da «fuori»:
-- una decisa fuori sparisce dall'elenco, una vuota resta li' a chiedere.
('price_history', null,
 '🔴 DA DECIDERE, e il mandato del 29/08 dice espressamente di non deciderlo da qui. Lo storico dei prezzi d''acquisto: e'' la base su cui si decide il prezzo di menu, e una riga cancellata cambia il food cost di ogni piatto che usa quell''ingrediente — all''indietro. ⚠️ Ma e'' anche la tabella che cresce di piu'': ogni carico ne scrive una, e il registro non si puo'' ripulire da nessuno.'),
('reservation_deposits', null,
 '🔴 DA DECIDERE. Le caparre sono soldi veri di clienti, ma ci sono due ostacoli TECNICI prima del merito, misurati il 26/08 e ancora veri: la tabella NON ha una colonna `id`, quindi la lapide nascerebbe senza riferimento; e sparisce a cascata con la prenotazione, che la pulizia notturna cancella PER PRIVACY — mettendola dentro, quella pulizia lascerebbe nel registro i dati che stava togliendo.'),
('order_tables', null,
 '🔴 DA DECIDERE, e la ragione e'' cambiata guardando le colonne il 29/08/2026. Sembrava dover entrare con `orders`, che e'' dentro dal 26/08 — ma **`order_tables` non ha una colonna `id`**, quindi la lapide nascerebbe senza riferimento: e'' lo stesso ostacolo delle caparre. Prima della decisione di merito serve una chiave primaria vera.')

on conflict (tabella) do update
  set dentro = excluded.dentro,
      ragione = excluded.ragione,
      classificata_il = now();

-- ---------------------------------------------------------------------
-- I trigger sulle cinque che entrano
-- ---------------------------------------------------------------------
-- ⚠️ Si nominano una per una: nessun ciclo su «tutte quelle dentro». Un
-- ciclo attaccherebbe il trigger anche a una tabella classificata dentro
-- per sbaglio, e il registro non si puo' ripulire da nessuno.
drop trigger if exists trg_log_delete on preventivi;
create trigger trg_log_delete before delete on preventivi
  for each row execute function log_deleted_record();

drop trigger if exists trg_log_delete on preventivo_fogli;
create trigger trg_log_delete before delete on preventivo_fogli
  for each row execute function log_deleted_record();

drop trigger if exists trg_log_delete on preventivo_righe;
create trigger trg_log_delete before delete on preventivo_righe
  for each row execute function log_deleted_record();

drop trigger if exists trg_log_delete on scadenze_previste;
create trigger trg_log_delete before delete on scadenze_previste
  for each row execute function log_deleted_record();

drop trigger if exists trg_log_delete on storico_costi_ricetta;
create trigger trg_log_delete before delete on storico_costi_ricetta
  for each row execute function log_deleted_record();

-- =====================================================================
-- VERIFICA
-- =====================================================================
do $verifica$
declare
  v_foto     jsonb := foto_righe();
  v_ent      uuid;
  v_prev     uuid;
  v_lapidi   integer;
  v_dopo     integer;
  -- ⚠️ `deleted_records.record_id` e' TESTO, non uuid: la lapide deve poter
  -- nascere anche da una tabella con una chiave che uuid non e'.
  v_rec      text;
  v_utente   uuid;
  v_da_fare  integer;
  v_sistemare integer;
begin
  select ur.user_id into v_utente from user_roles ur where ur.role = 'titolare' limit 1;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_utente, 'role', 'authenticated')::text, true);

  -- (1) 🔴 NON RESTA NIENTE DI NON CLASSIFICATO. È il controllo che chiude
  --     il buco vero: `perimetro_da_sistemare()` nominava cinque tabelle
  --     che nel catalogo non c'erano affatto, due delle quali nate
  --     stanotte con questo stesso mandato.
  select count(*) into v_sistemare from perimetro_da_sistemare();
  if v_sistemare <> 0 then
    raise exception 'Ci sono ancora % tabelle fuori dal catalogo del perimetro.', v_sistemare;
  end if;

  -- (2) E LE DA DECIDERE SONO ESATTAMENTE TRE, quelle che il mandato dice
  --     di non decidere piu' quella che una misura ha fermato.
  --     ⚠️ NON un conteggio travestito da regola: sono nominate.
  select count(*) into v_da_fare from perimetro_da_decidere()
   where tabella not in ('price_history', 'reservation_deposits', 'order_tables');
  if v_da_fare <> 0 then
    raise exception 'Sono rimaste % tabelle da decidere oltre alle tre dichiarate.', v_da_fare;
  end if;
  if (select count(*) from perimetro_da_decidere()) <> 3 then
    raise exception 'Le tabelle da decidere non sono tre: %',
      (select string_agg(tabella, ', ') from perimetro_da_decidere());
  end if;

  perform set_config('request.jwt.claims', null, true);

  -- (3) 🔴 SU UNA CHE ENTRA, LA LAPIDE C'È **E HA IL RIFERIMENTO**. Contare
  --     che il numero sia salito non basta: una lapide senza `record_id` è
  --     precisamente il difetto che tiene fuori le caparre.
  select count(*) into v_lapidi from deleted_records;

  select id into v_ent from entities order by created_at limit 1;
  -- ⚠️ Le colonne vere si sono guardate: `scade_il`, non «data_prevista»,
  -- e `entity_id` e' obbligatoria. Guardarle costa dieci secondi, e la
  -- migrazione si era gia' fermata una volta per averle indovinate.
  insert into scadenze_previste (entity_id, descrizione, importo, scade_il)
  values (v_ent, 'VERIFICA-29AGO scadenza', 1.00, (now() at time zone 'Europe/Rome')::date + 30)
  returning id into v_prev;

  delete from scadenze_previste where id = v_prev;

  select count(*) into v_dopo from deleted_records;
  if v_dopo <> v_lapidi + 1 then
    raise exception 'Cancellando una scadenza prevista non e'' nata nessuna lapide (% -> %).',
      v_lapidi, v_dopo;
  end if;
  select record_id into v_rec from deleted_records
   where table_name = 'scadenze_previste' order by deleted_at desc limit 1;
  if v_rec is distinct from v_prev::text then
    raise exception 'La lapide della scadenza prevista non porta il riferimento giusto (% invece di %).',
      v_rec, v_prev;
  end if;

  -- ⚠️ La lapide creata da questa verifica si TOGLIE: il registro e'
  -- esibibile, e righe finte li' dentro rompono il guardiano che ogni
  -- migrazione usa per difendersi (lezione del 19/08).
  delete from deleted_records where record_id = v_prev::text;

  -- (4) E SU UNA DECISA FUORI LA LAPIDE NON DEVE COMPARIRE — senza questo,
  --     un trigger messo per sbaglio su tutte passerebbe inosservato.
  select count(*) into v_lapidi from deleted_records;
  insert into preparazioni_ricorrenti (recipe_id, ogni_giorni)
  select r.id, 7 from recipes r where r.recipe_type = 'preparazione' limit 1;
  delete from preparazioni_ricorrenti
   where recipe_id in (select r.id from recipes r where r.recipe_type = 'preparazione' limit 1);
  select count(*) into v_dopo from deleted_records;
  if v_dopo <> v_lapidi then
    raise exception 'Una tabella decisa FUORI ha lasciato una lapide (% -> %).', v_lapidi, v_dopo;
  end if;

  perform pretendi_nessun_residuo(v_foto, 'la verifica del perimetro classificato');
  raise notice 'Le sedici tabelle sono classificate: cinque dentro, otto fuori, tre da decidere (price_history, reservation_deposits, order_tables).';
end
$verifica$;

insert into applied_migrations (version, name)
values ('20260829000021', 'le_undici_che_nessuno_aveva_classificato') on conflict (version) do nothing;
