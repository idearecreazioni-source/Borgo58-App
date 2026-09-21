-- =====================================================================
-- L'ETICHETTA «INVESTIMENTO» E IL COSTO DEL PROGETTO — C11, 21/09/2026
-- =====================================================================
--
-- 🔴 A CHE DOMANDA RISPONDE, e finora non rispondeva niente: *quanto e'
-- costato mettere in piedi il locale.* `cash_movements` ha 26 colonne e
-- nessuna etichetta, quindi un forno da 6.000 euro e una bolletta della luce
-- sono indistinguibili; e il totale piu' vicino — `rettifiche_fiscali →
-- costi_totali`, in *Fiscale → Deducibilita'* — e' per **anno civile**, per
-- **una societa' sola**, ed **esclude la tasca**.
--
-- 🔴 E' UN'ETICHETTA SU UN'USCITA, NON UN SECONDO ARCHIVIO (decisione di
-- Alessio, 31/08). Una sezione separata creerebbe due verita' sulla stessa
-- spesa e andrebbe smontata dopo l'apertura; un'etichetta si smette solo di
-- usare. ⚠️ **Serve fino a marzo 2027 e poi decade**: per questo non nasce
-- nessun lavoro pianificato, nessuna scadenza, nessuna tabella nuova.
--
-- ⚠️ «IN COSA» E «CON QUALI SOLDI» NON VOGLIONO CAMPI NUOVI: la causale e la
-- nota dicono gia' in cosa, il mezzo e il soggetto dicono gia' con quali
-- soldi. Una colonna in piu' sarebbe una seconda risposta alla stessa
-- domanda.
--
-- ⚠️ E NON E' `tag_anticipazioni`: quelle sono le etichette delle spese che
-- la societa' **rimborsa**, e un investimento non e' un rimborso. Attaccarlo
-- li' darebbe due significati alla stessa tabella.
--
-- ---------------------------------------------------------------------
-- 🔴 NESSUNA CLASSIFICAZIONE AUTOMATICA, E IL PREDEFINITO NON RISPONDE AL
--    POSTO DI NESSUNO
-- ---------------------------------------------------------------------
-- Le righe esistenti restano tutte `false`, e nessuna regola prova a
-- indovinare: non dalla data, non dalla causale, non dall'importo, non dalla
-- fattura, non dalle parole della descrizione. Etichetta a mano Alessio, una
-- riga per volta.
--
-- ⚠️ E QUI IL PREDEFINITO NON E' LA TRAPPOLA DEL 14/08. Quel giorno una
-- colonna `not null default false` rispose **al posto di chi aveva gia'
-- scelto in un altro modo** — c'erano nove scostamenti che dicevano il
-- contrario. Qui non esiste nessuna scelta precedente da contraddire:
-- `false` vuol dire *«nessuno l'ha ancora marcata»*, che e' la verita' su
-- ogni riga scritta prima di oggi. **Non c'e' nessun terzo stato**: o e'
-- marcata o non lo e'. Misurato prima di scriverlo: in produzione i
-- movimenti sono **tre**, tutte uscite.
--
-- ⚠️ E IL QUESITO L19 RESTA APERTO (gli acquisti con fattura fatti prima
-- della partita IVA sono recuperabili, e come vanno intestati). Questa
-- migrazione non ne anticipa la risposta: non classifica niente e non tocca
-- nessun conteggio fiscale.
--
-- ---------------------------------------------------------------------
-- 🔴 I DUE DIVIETI STANNO NEL DATABASE
-- ---------------------------------------------------------------------
-- Una regola nella schermata la aggira chiunque scriva da un'altra porta.
--
--   1. **UN'ENTRATA NON PUO' ESSERE UN INVESTIMENTO** — vincolo `check`.
--      Dichiarativo apposta, e non un trigger: un `check` regge anche a
--      trigger spenti, e i due valori che confronta stanno sulla stessa
--      riga, quindi non serve andare a cercare niente altrove.
--
--   2. **UN'USCITA CON UNA CAUSALE DI SISTEMA NON PUO' ESSERE UN
--      INVESTIMENTO** — trigger, perche' la risposta sta su un'altra
--      tabella (`cash_causali.di_sistema`) e un `check` non la puo'
--      guardare.
--
-- 🔴 LA SECONDA E' LA CARATTERISTICA STRUTTURALE CHE IL PROGETTO USA GIA',
-- non un riconoscimento inventato oggi: dal 15/08 `rettifiche_fiscali()` e
-- `costi_da_classificare()` filtrano `coalesce(c.di_sistema, false) = false`
-- per non contare fra i costi cio' che non e' un costo. Le nove causali di
-- sistema sono *Versamento in banca*, *Versamento dalla cassa*, *Differenza
-- di cassa in piu'*, *in meno*, *Rimborso al titolare*, *Caparra ricevuta*,
-- *Caparra restituita*, *Prestito ricevuto*, *Restituzione di prestito*:
-- denaro che cambia posto, o un debito che si chiude. ⚠️ **E' cosi' che
-- rimborsi, pareggi e anticipazioni non fanno crescere il costo due volte**
-- — riconosciuti da una colonna, mai da una frase o da una descrizione.
--
-- ⚠️ SI RIFIUTA, NON SI IGNORA. La strada alternativa — lasciar marcare e
-- poi non contarlo — darebbe un'etichetta che si accende e non fa niente,
-- cioe' il difetto che questo progetto chiama silenzio. Il rifiuto dice
-- anche **perche'**.
--
-- ⚠️ IL PAGAMENTO DI UNA FATTURA RESTA MARCABILE, ed e' voluto: misurato
-- leggendo il corpo vivo di `pay_supplier_invoice`, quel movimento nasce
-- **senza causale** (`causale_id` non compare nell'`insert`), quindi non e'
-- di sistema. In prima nota quell'uscita e' l'unico posto in cui la spesa
-- compare, e contarla una volta e' giusto.
--
-- ---------------------------------------------------------------------
-- 🔴 «ANTICIPO IO, POI MI RIMBORSO»: UNA VOLTA SOLA, SOTTO BORGO 58
-- ---------------------------------------------------------------------
-- **Decisione di Alessio, 21/09/2026.** Un investimento pagato con
-- un'anticipazione del socio entra nel costo del progetto **una volta**,
-- sotto **Borgo 58** (e' una spesa fatta per conto della societa'), e
-- **prima e dopo il rimborso vale lo stesso**.
--
-- 🔴 LA PRIMA STESURA DI QUESTA MIGRAZIONE LO CONTAVA **ZERO VOLTE**, e la
-- ragione e' che la spesa **non vive in `cash_movements`**: vive in
-- `anticipazioni_socio`. In prima nota compare solo il **rimborso**, con la
-- causale di sistema *Rimborso al titolare* — giustamente non marcabile,
-- perche' un rimborso non e' una spesa. Quindi mettendo l'etichetta solo
-- sui movimenti di cassa, quel denaro non poteva entrare **da nessuna
-- porta**. ⚠️ *Un'etichetta che manca nel punto in cui vive la spesa non e'
-- una regola prudente: e' un buco silenzioso.*
--
-- **La cura e' l'etichetta anche sull'anticipazione** — nel punto in cui la
-- spesa vive. ⚠️ E **non** `tag_anticipazioni`: quello dice *perche'* hai
-- anticipato, non *se* la spesa appartiene all'investimento iniziale.
--
-- ⚠️ IL SOGGETTO ARRIVA DA SE': `anticipazioni_socio.entity_id` e' gia' la
-- societa' **per conto della quale** hai pagato. Non serve nessuna regola
-- che dica «le anticipazioni vanno sotto Borgo 58»: basta raggruppare per
-- soggetto come si fa con la prima nota. ⚠️ E una tasca non anticipa niente
-- per conto di nessuno — quel caso e' **rifiutato**, cosi' il totale della
-- tasca resta, per costruzione, fatto delle sole uscite della tasca.
--
-- ⚠️ PRIMA E DOPO IL RIMBORSO E' LO STESSO NUMERO, per costruzione: si legge
-- `anticipazioni_socio.importo`, e `pareggiata_il` non entra nel conteggio.
-- Il rimborso non aggiunge e non toglie niente.
--
-- ---------------------------------------------------------------------
-- 🔴 FATTURA, ANTICIPAZIONE E RIMBORSO: UNA COPIA SOLA
-- ---------------------------------------------------------------------
-- Il modello permette davvero, per la **stessa fattura**, di avere sia
-- un'anticipazione (`anticipazioni_socio.supplier_invoice_id`) sia il
-- movimento che la paga (`cash_movements.supplier_invoice_id`). E' scritto
-- nel commento del vincolo del 16/08: *«senza il collegamento la nota smette
-- di essere solo un debito e diventa da sola un costo — la spesa
-- risulterebbe contata due volte, in silenzio»*.
--
-- 🔴 **LA CHIAVE DELLA DEDUPLICAZIONE E' `supplier_invoice_id`**, cioe' un
-- **identificativo** e un legame gia' esistente: mai l'importo, mai la data,
-- mai una parola della descrizione.
--
-- ⚠️ **SI IMPEDISCE, NON SI NASCONDE.** Marcare la seconda delle due viene
-- **rifiutato**, e il rifiuto dice *quale* delle due e' gia' contata e come
-- cambiare idea. La strada alternativa — lasciar marcare tutt'e due e poi
-- scartarne una nella somma — darebbe un'etichetta accesa che non fa
-- niente, cioe' il difetto che questo progetto chiama silenzio.
--
-- ⚠️ **E il controllo guarda in tutt'e due i versi e in tutt'e due gli
-- ordini**: i due trigger sono `before insert or update` **senza** filtro di
-- colonna, quindi scatta anche chi marca prima e **collega la fattura
-- dopo** — che e' l'ordine in cui un controllo scritto sulla sola colonna
-- non vedrebbe niente.
--
-- ⚠️ E un'anticipazione **collegata a una fattura non sparisce**: se nessun
-- movimento di pagamento di quella fattura e' marcato, la si marca e conta.
-- La decisione del 16/08 («collegata vale solo come debito») resta vera
-- dov'e' nata — nel **conteggio fiscale**, che non e' toccato — e qui non si
-- applica, perche' questo totale risponde a un'altra domanda: *quanto denaro
-- e' uscito per il progetto*, non *quanto costo e' deducibile*.
--
-- ---------------------------------------------------------------------
-- 🔴 NIENTE E' FISCALE, QUI
-- ---------------------------------------------------------------------
-- L'etichetta non cambia deducibilita', IVA, causale ne' nessuna proprieta'
-- fiscale; non crea nessun debito verso Alessio; non tocca nessun conteggio
-- esistente. `rettifiche_fiscali()`, `costi_da_classificare()`,
-- `calcola_imposte()` e la Proiezione **non sono state riscritte**: non
-- nominano questa colonna e continuano a rispondere come prima. La tasca
-- resta fuori dal fiscale per costruzione (non ha parametri fiscali, e tre
-- trigger del 30/08 impediscono di darglieli): questo totale e'
-- **gestionale**.

-- ---------------------------------------------------------------------
-- 1. LA COLONNA
-- ---------------------------------------------------------------------
alter table cash_movements
  add column if not exists e_investimento boolean not null default false;

comment on column cash_movements.e_investimento is
  'Etichetta manuale: questa uscita e'' una spesa per mettere in piedi il locale. La mette e la toglie Alessio, una riga per volta — nessuna regola la deduce da data, causale, importo, fattura o parole della descrizione. Vale solo su un''uscita, e mai su una riga scritta dal gestionale (causale di sistema). Serve fino all''apertura di marzo 2027; dopo, si smette di usarla. Non e'' un dato fiscale: non cambia deducibilita'', IVA ne'' nessun conteggio delle imposte.';

-- ---------------------------------------------------------------------
-- 2. UN'ENTRATA NON PUO' ESSERE UN INVESTIMENTO
-- ---------------------------------------------------------------------
alter table cash_movements drop constraint if exists investimento_solo_su_uscita;
alter table cash_movements
  add constraint investimento_solo_su_uscita
  check (not e_investimento or direction = 'uscita');

-- ⚠️ LA FRASE E' OBBLIGATORIA (rete del 25/08): senza, il rifiuto arriva in
--    inglese — «violates check constraint» — che in sala non e' un rifiuto,
--    e' un guasto. La traduzione la legge `spiega_vincolo()` da qui.
comment on constraint investimento_solo_su_uscita on cash_movements is
  'Un''entrata non puo'' essere segnata come investimento per il progetto: sono soldi che arrivano, non che escono. Se stai registrando una spesa, cambia il verso in «Uscita».';

-- ---------------------------------------------------------------------
-- 3. UNA RIGA SCRITTA DAL GESTIONALE NON E' UNA SPESA
-- ---------------------------------------------------------------------
create or replace function guardia_investimento()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_etichetta text;
  v_numero    text;
begin
  -- Non marcata: non c'e' niente da controllare, e il gesto piu' frequente
  -- (registrare un movimento normale) non paga nessuna lettura in piu'.
  if not coalesce(new.e_investimento, false) then
    return new;
  end if;

  if new.causale_id is not null then
    select label into v_etichetta
      from cash_causali
     where id = new.causale_id and di_sistema;

    if v_etichetta is not null then
      raise exception 'Questa riga la scrive il gestionale da se'' («%»), quindi non puo'' essere un investimento: e'' denaro che cambia posto o un debito che si chiude, non una spesa. Contarla farebbe crescere due volte il costo del progetto. Se l''investimento e'' la spesa vera, marca quella — non il suo rimborso o il suo versamento.',
        v_etichetta;
    end if;
  end if;

  -- 🔴 LA STESSA FATTURA NON SI CONTA DUE VOLTE. Il legame e'
  --    `supplier_invoice_id` da tutt'e due le parti: un identificativo, non
  --    un importo o una data.
  if new.supplier_invoice_id is not null then
    select coalesce(nullif(i.invoice_number, ''), '(senza numero)')
      into v_numero
      from supplier_invoices i where i.id = new.supplier_invoice_id;

    if exists (
      select 1 from anticipazioni_socio a
       where a.supplier_invoice_id = new.supplier_invoice_id
         and a.e_investimento
    ) then
      raise exception 'La fattura % e'' gia'' contata nel costo del progetto: l''hai pagata di tasca tua e hai marcato quella nota in «Anticipo io, poi mi rimborso». Marcare anche questa uscita la conterebbe due volte. Se vuoi contarla da qui, togli prima l''etichetta alla nota.',
        v_numero;
    end if;
  end if;

  return new;
end;
$fn$;

-- 🔴 LA PORTA SI CHIUDE E BASTA, e non le si mette un portiere (regola del
--    27/08, caso (a)): la chiama **solo** il trigger qui sotto, che e'
--    `security definer` e gira coi permessi del proprietario. Un
--    `is_titolare()` dentro sarebbe la cura sbagliata — dentro un `security
--    definer` l'identita' resta quella di chi chiama, e un movimento scritto
--    da una funzione di servizio verrebbe rifiutato da un controllo che non
--    c'entra niente.
revoke all on function guardia_investimento() from public, anon, authenticated;

-- ⚠️ `insert or update` senza `of e_investimento`, ed e' la trappola del
--    27/08: `update of colonna` guarda cio' che e' stato **nominato**, non
--    cio' che e' cambiato. Cambiando la sola `causale_id` di una riga gia'
--    marcata, un filtro sulla colonna non scatterebbe — e la riga
--    resterebbe marcata con una causale di sistema addosso.
drop trigger if exists trg_guardia_investimento on cash_movements;
create trigger trg_guardia_investimento
  before insert or update on cash_movements
  for each row execute function guardia_investimento();

-- ---------------------------------------------------------------------
-- 3-bis. L'ETICHETTA ANCHE DOVE LA SPESA VIVE DAVVERO
-- ---------------------------------------------------------------------
-- 🔴 Un investimento pagato di tasca propria **per conto della societa'**
--    non passa da `cash_movements`: sta qui. Senza questa colonna quel
--    denaro non aveva nessuna porta da cui entrare nel costo del progetto.
alter table anticipazioni_socio
  add column if not exists e_investimento boolean not null default false;

comment on column anticipazioni_socio.e_investimento is
  'Etichetta manuale: questa nota e'' una spesa per mettere in piedi il locale, anticipata per conto della societa''. La mette e la toglie Alessio, una riga per volta — nessuna regola la deduce dal tag, dall''importo, dalla data o dal testo. Entra nel costo del progetto sotto il soggetto della nota, una volta sola, e vale lo stesso prima e dopo il rimborso. Non e'' un dato fiscale e non cambia nessun conteggio delle imposte: per il fisco una nota collegata a una fattura resta solo un debito, e quella regola non e'' toccata.';

create or replace function guardia_investimento_anticipazione()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_numero text;
begin
  if not coalesce(new.e_investimento, false) then
    return new;
  end if;

  -- 🔴 UNA TASCA NON ANTICIPA NIENTE PER CONTO DI NESSUNO, e il rifiuto e'
  --    cio' che rende il totale della tasca fatto **solo** delle sue uscite,
  --    invece di affidarlo a un filtro che qualcuno deve ricordarsi di
  --    scrivere nella prossima funzione.
  if e_una_tasca(new.entity_id) then
    raise exception 'La tasca non anticipa niente per conto della societa'': sono soldi tuoi che non tornano indietro, e non c''e'' niente da rimborsare. Se e'' una spesa della tasca, registrala dalla Prima nota scegliendo «La tasca di Alessio» e marca li'' l''investimento.';
  end if;

  -- 🔴 LA STESSA FATTURA NON SI CONTA DUE VOLTE — specchio del controllo su
  --    `cash_movements`, sullo stesso identificativo.
  if new.supplier_invoice_id is not null then
    select coalesce(nullif(i.invoice_number, ''), '(senza numero)')
      into v_numero
      from supplier_invoices i where i.id = new.supplier_invoice_id;

    if exists (
      select 1 from cash_movements m
       where m.supplier_invoice_id = new.supplier_invoice_id
         and m.e_investimento
    ) then
      raise exception 'La fattura % e'' gia'' contata nel costo del progetto: in Prima nota c''e'' un''uscita marcata che la paga. Marcare anche questa nota la conterebbe due volte. Se vuoi contarla da qui, togli prima l''etichetta a quell''uscita.',
        v_numero;
    end if;
  end if;

  return new;
end;
$fn$;

revoke all on function guardia_investimento_anticipazione() from public, anon, authenticated;

-- ⚠️ `insert or update` senza `of e_investimento`: la stessa ragione del
--    gemello qui sopra. Chi marca la nota e **collega la fattura dopo**
--    passerebbe indisturbato da un filtro scritto sulla sola colonna.
drop trigger if exists trg_guardia_investimento_anticipazione on anticipazioni_socio;
create trigger trg_guardia_investimento_anticipazione
  before insert or update on anticipazioni_socio
  for each row execute function guardia_investimento_anticipazione();

-- ---------------------------------------------------------------------
-- 4. QUANTO E' COSTATO IL PROGETTO — I NUMERI
-- ---------------------------------------------------------------------
-- 🔴 SI AGGREGA NEL DATABASE, e non e' una comodita': chiedendo un elenco
--    senza dire quante righe se ne vogliono ne tornano **al massimo mille,
--    senza nessun errore** (19/08). Una somma fatta sull'elenco sarebbe
--    quindi un numero credibile e falso appena i movimenti marcati passano
--    il migliaio. Qui il database consegna **una riga per soggetto**: il
--    totale non puo' essere tagliato, per costruzione.
--
-- ⚠️ E PORTA `quante`, che non e' un di piu': e' il numero con cui la
--    schermata sa se il **dettaglio** che ha ricevuto e' intero. Le letture
--    tagliate si denunciano da sole solo sulle letture di elenco (`GET`);
--    questa e' una chiamata a funzione (`POST`), e di li' non passa.
--
-- ⚠️ NON DECIDE CHI ENTRA NEL TOTALE, e nemmeno prova a farlo: restituisce
--    **il tipo stabile** del soggetto (`entity_type`) e lascia che sia chi
--    guarda a sommare. Se la regola «Borgo 58 e la tasca, l'orto no» vivesse
--    anche qui dentro, sarebbe scritta in due posti — e due posti che dicono
--    la stessa cosa un giorno la dicono diversa. Vive in **un posto solo**,
--    `src/lib/calcoli/investimento.js`, dove si prova senza database.
--
-- ⚠️ E PROPRIO PER QUESTO L'ORTO NON SPARISCE: compare con la sua riga, e la
--    schermata lo dichiara **fuori** dal totale invece di inghiottirlo. Una
--    riga marcata che svanisce in silenzio e' un'etichetta che non fa
--    niente.
-- 🔴 LE FONTI SONO DUE, E NON SI SOVRAPPONGONO MAI: la prima nota e le
--    anticipazioni del socio. Sono due tabelle diverse, e l'unico punto in
--    cui potrebbero raccontare la stessa spesa — la **fattura** — e' chiuso
--    a monte dai due trigger, che rifiutano la seconda marcatura sullo
--    stesso `supplier_invoice_id`. Qui dentro quindi si somma e basta:
--    nessuno scarto, nessun filtro che possa far sparire in silenzio una
--    riga che Alessio ha marcato.
create or replace function costo_del_progetto(p_dal date default null, p_al date default null)
returns table (
  entity_id uuid,
  tipo      text,
  soggetto  text,
  quante    integer,
  totale    numeric
)
language plpgsql
stable
security definer
set search_path = public
as $fn$
begin
  -- `security definer` gira senza RLS: il portiere va rimesso dentro, e chi
  -- non deve vedere riceve un RIFIUTO, non un elenco vuoto — un elenco vuoto
  -- si leggerebbe «non e'' stato speso niente» (regola del 13/08).
  if not is_titolare() then
    raise exception 'Il costo del progetto e'' riservato al titolare.';
  end if;

  return query
  with fonti as (
    select m.entity_id, m.amount as importo
      from cash_movements m
     where m.e_investimento
       and m.direction = 'uscita'
       and (p_dal is null or m.movement_date >= p_dal)
       and (p_al  is null or m.movement_date <= p_al)
    union all
    -- ⚠️ `pareggiata_il` NON compare: una nota rimborsata resta una spesa
    --    fatta per il progetto, e il rimborso non aggiunge e non toglie
    --    niente. E' cosi' che «prima e dopo il rimborso» e' lo stesso
    --    numero **per costruzione**, invece che per una regola da provare
    --    ogni volta.
    select a.entity_id, a.importo
      from anticipazioni_socio a
     where a.e_investimento
       and (p_dal is null or a.pagata_il >= p_dal)
       and (p_al  is null or a.pagata_il <= p_al)
  )
  select e.id,
         e.entity_type::text,
         e.name::text,
         count(*)::integer,
         sum(f.importo)::numeric
    from fonti f
    join entities e on e.id = f.entity_id
   group by e.id, e.entity_type, e.name
   order by e.entity_type::text;
end;
$fn$;

revoke all on function costo_del_progetto(date, date) from public, anon, authenticated;
grant execute on function costo_del_progetto(date, date) to authenticated;

-- ---------------------------------------------------------------------
-- 5. ...E LE RIGHE CHE LI COMPONGONO
-- ---------------------------------------------------------------------
-- ⚠️ NESSUNA COPIA DEI MOVIMENTI: questa funzione **legge** la prima nota e
--    basta. Una tabella parallela sarebbe la seconda verita' che l'etichetta
--    esiste apposta per evitare.
--
-- ⚠️ L'ORDINE E' DETERMINATO FINO ALL'ULTIMO CRITERIO (`id`), e serve alla
--    paginazione: due righe con la stessa data e lo stesso istante
--    potrebbero uscire in ordine diverso a ogni pagina, e nel taglio fra una
--    pagina e l'altra una riga sparirebbe mentre un'altra comparirebbe due
--    volte. E' la stessa lezione del 16/08 — *una riga non si riconosce
--    dalla sua posizione in un ordinamento temporale*.
create or replace function righe_costo_del_progetto(p_dal date default null, p_al date default null)
returns table (
  id            uuid,
  fonte         text,
  data          date,
  entity_id     uuid,
  tipo          text,
  soggetto      text,
  causale       text,
  mezzo         text,
  fondi         text,
  descrizione   text,
  nota          text,
  fattura       text,
  rimborso      text,
  importo       numeric
)
language plpgsql
stable
security definer
set search_path = public
as $fn$
begin
  if not is_titolare() then
    raise exception 'Il costo del progetto e'' riservato al titolare.';
  end if;

  -- ⚠️ `mezzo` E `fondi` SONO DUE VOCABOLARI DIVERSI e restano in due
  --    colonne diverse. `mezzo` vale `cassa`/`banca` — da dove escono i
  --    soldi **della societa'**; `fondi` vale `contanti`/`conto_personale` —
  --    con quali soldi **suoi** ha anticipato. Infilare gli uni negli altri
  --    produrrebbe un vocabolario finto, che e' il difetto misurato il
  --    17/08 sul mezzo di pagamento della lista della spesa.
  return query
  select m.id,
         'prima_nota'::text,
         m.movement_date,
         e.id,
         e.entity_type::text,
         e.name::text,
         c.label::text,
         m.mezzo::text,
         null::text,
         m.business_purpose::text,
         m.note::text,
         null::text,
         null::text,
         m.amount::numeric
    from cash_movements m
    join entities e on e.id = m.entity_id
    left join cash_causali c on c.id = m.causale_id
   where m.e_investimento
     and m.direction = 'uscita'
     and (p_dal is null or m.movement_date >= p_dal)
     and (p_al  is null or m.movement_date <= p_al)

  union all

  select a.id,
         'anticipazione'::text,
         a.pagata_il,
         e2.id,
         e2.entity_type::text,
         e2.name::text,
         t.etichetta::text,
         null::text,
         a.fondi::text,
         -- ⚠️ Nessuna «descrizione»: su una nota il posto dove si dice in
         --    cosa e' il **motivo** (il tag, qui sopra) piu' la nota.
         --    `documento_riferimento` e' il riferimento di un documento, non
         --    una descrizione, e metterlo li' sarebbe scrivere una cosa al
         --    posto di un'altra.
         null::text,
         a.nota::text,
         -- La fattura collegata, coi dati che esistono gia': numero e
         -- fornitore. Serve a far vedere il caso, non a nasconderlo.
         (case when a.supplier_invoice_id is null then null
               else 'Fattura ' || coalesce(nullif(i.invoice_number, ''), '(senza numero)')
                    || coalesce(' — ' || s.name, '') end)::text,
         (case when a.pareggiata_il is null then 'da rimborsare'
               else 'rimborsata il ' || to_char(a.pareggiata_il, 'DD/MM/YYYY') end)::text,
         a.importo::numeric
    from anticipazioni_socio a
    join entities e2 on e2.id = a.entity_id
    join tag_anticipazioni t on t.id = a.tag_id
    left join supplier_invoices i on i.id = a.supplier_invoice_id
    left join suppliers s on s.id = i.supplier_id
   where a.e_investimento
     and (p_dal is null or a.pagata_il >= p_dal)
     and (p_al  is null or a.pagata_il <= p_al)

  -- ⚠️ L'ORDINE E' DETERMINATO FINO ALL'ULTIMO CRITERIO, e serve alla
  --    paginazione: nel taglio fra una pagina e l'altra, un ordinamento
  --    ambiguo farebbe sparire una riga e comparire due volte un'altra
  --    (lezione del 16/08). Con due fonti il criterio di mezzo e' la fonte
  --    stessa, e l'ultimo resta l'identificativo.
   order by 3 desc, 2, 1;
end;
$fn$;

revoke all on function righe_costo_del_progetto(date, date) from public, anon, authenticated;
grant execute on function righe_costo_del_progetto(date, date) to authenticated;

-- =====================================================================
-- VERIFICA
-- =====================================================================
-- ⚠️ TUTTO DENTRO UNA SOTTO-TRANSAZIONE CHE VIENE ANNULLATA (regola del
--    30/08): non si cancella niente, quindi il registro delle cancellazioni
--    resta **acceso** per tutto il tempo e non nasce nessuna lapide finta da
--    togliere. E la verifica lavora su roba propria, mai su righe di Alessio.
do $verifica$
declare
  v_foto     jsonb := foto_righe();
  v_srls     uuid;
  v_tasca    uuid;
  v_agri     uuid;
  v_tit      uuid;
  v_caus     uuid;
  v_sys      uuid;
  v_sys_lbl  text;
  v_mov      uuid;
  v_prima    cash_movements%rowtype;
  v_dopo     cash_movements%rowtype;
  v_preso    boolean;
  v_n        integer;
  v_tot      numeric;
  v_frase    text;
  v_marcate_prima integer;
  v_marcate_ant   integer;
  -- Lo stato PRIMA di scrivere qualunque cosa: le verifiche qui sotto
  -- misurano una DIFFERENZA, mai un valore assoluto (vedi il riquadro).
  v_b_srls   numeric;
  v_b_tasca  numeric;
  v_b_agri   numeric;
  v_b_righe  integer;
  v_b_recenti numeric;
  -- Il giro dell'anticipazione: nota, fattura, fornitore, rimborso.
  v_tag      uuid;
  v_ant      uuid;
  v_ant2     uuid;
  v_forn     uuid;
  v_fatt     uuid;
  v_movr     uuid;
  v_testo    text;
begin
  -- ---------------------------------------------------------------
  -- (0) LO STATO DI PARTENZA: nessuna riga esistente e' stata marcata.
  -- ---------------------------------------------------------------
  -- 🔴 E SI GUARDA SOLO ALLA PRIMA APPLICAZIONE, guardata dal registro
  --    delle migrazioni. Scritto senza questa condizione, il controllo
  --    sarebbe **vero il primo giorno e falso il secondo**: appena Alessio
  --    marca la prima spesa, una riapplicazione si fermerebbe su una sua
  --    scelta legittima. E' la trappola del 18/08 — *un controllo che si
  --    rompe al primo gesto normale dell'utente, e poi da' la colpa a quel
  --    gesto, e' peggio di un controllo assente*.
  -- ⚠️ La condizione e' una **proprieta' del registro**, non una data da
  --    ricordare: alla prima applicazione la colonna e' appena nata, quindi
  --    nessun client puo' averci scritto niente, e uno «zero» li' dimostra
  --    davvero che il predefinito non ha risposto al posto di nessuno.
  v_marcate_prima := null;
  if not exists (select 1 from applied_migrations where version = '20260921000003') then
    select count(*) into v_marcate_prima from cash_movements where e_investimento;
    select count(*) into v_marcate_ant   from anticipazioni_socio where e_investimento;
    if v_marcate_prima <> 0 or v_marcate_ant <> 0 then
      raise exception 'Applicando le colonne, % movimenti e % anticipazioni gia'' esistenti risultano marcati: il predefinito ha risposto al posto di qualcuno.',
        v_marcate_prima, v_marcate_ant;
    end if;
  end if;

  select id into v_srls  from entities where entity_type = 'srls';
  select id into v_tasca from entities where entity_type = 'tasca';
  select id into v_agri  from entities where entity_type = 'azienda_agricola';
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  if v_srls is null or v_tasca is null or v_agri is null or v_tit is null then
    raise exception 'Servono i tre soggetti e un titolare per verificare: srls=%, tasca=%, agricola=%, titolare=%',
      v_srls, v_tasca, v_agri, v_tit;
  end if;

  select id into v_caus from cash_causali
   where kind = 'uscita' and active and not di_sistema order by created_at limit 1;
  select id, label into v_sys, v_sys_lbl from cash_causali
   where kind = 'uscita' and di_sistema order by created_at limit 1;
  if v_caus is null or v_sys is null then
    raise exception 'Serve una causale di uscita normale e una di sistema: normale=%, sistema=%', v_caus, v_sys;
  end if;

  -- ---------------------------------------------------------------
  -- (0-bis) IL RIFIUTO PARLA ITALIANO, e si chiede alla porta vera.
  -- ---------------------------------------------------------------
  -- ⚠️ Guardare il commento del vincolo e guardare cosa risponde
  --    `spiega_vincolo` sono due cose diverse: la schermata passa di li',
  --    e un difetto che vivesse solo in quella funzione sarebbe invisibile
  --    a un controllo fatto sul catalogo.
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);
  select spiega_vincolo('investimento_solo_su_uscita') into v_frase;
  if v_frase is null or v_frase !~* 'entrata' then
    raise exception 'Il vincolo non parla italiano: %', coalesce(v_frase, '(nessuna frase)');
  end if;

  begin  -- <<< la sotto-transazione che verra' annullata

    -- -------------------------------------------------------------
    -- (0-ter) LA FOTOGRAFIA DI PARTENZA DEI TRE NUMERI.
    -- -------------------------------------------------------------
    -- 🔴 DA QUI IN POI SI MISURA UNA DIFFERENZA, MAI UN VALORE ASSOLUTO.
    --    Scrivere «Borgo 58 deve valere 100,00» sarebbe una fotografia
    --    travestita da regola: vera oggi, falsa il giorno che Alessio marca
    --    la prima spesa vera — e allora una riapplicazione si fermerebbe su
    --    una sua scelta legittima. *Un guardiano dice come dev'essere fatto
    --    il mondo, non com'era quando l'ho guardato* (16/08).
    select coalesce(sum(totale), 0) into v_b_srls  from costo_del_progetto() where tipo = 'srls';
    select coalesce(sum(totale), 0) into v_b_tasca from costo_del_progetto() where tipo = 'tasca';
    select coalesce(sum(totale), 0) into v_b_agri  from costo_del_progetto() where tipo = 'azienda_agricola';
    select count(*)::integer        into v_b_righe from righe_costo_del_progetto();
    select coalesce(sum(totale), 0) into v_b_recenti
      from costo_del_progetto(current_date - 30, null) where tipo = 'srls';

    -- -------------------------------------------------------------
    -- (1) UN'USCITA NORMALE NASCE NON MARCATA, se nessuno sceglie.
    -- -------------------------------------------------------------
    insert into cash_movements (entity_id, direction, amount, movement_date, causale_id, mezzo, business_purpose)
    values (v_srls, 'uscita', 11.11, current_date, v_caus, 'cassa', 'ZZ verifica investimento - non scelto')
    returning id into v_mov;
    if (select e_investimento from cash_movements where id = v_mov) is distinct from false then
      raise exception 'Un''uscita nuova non e'' nata «non marcata».';
    end if;

    -- -------------------------------------------------------------
    -- (2) LA SCELTA SI CONSERVA: marcata alla nascita, resta marcata.
    -- -------------------------------------------------------------
    insert into cash_movements (entity_id, direction, amount, movement_date, causale_id, mezzo,
                                business_purpose, e_investimento)
    values (v_srls, 'uscita', 100.00, current_date, v_caus, 'cassa', 'ZZ verifica investimento - forno', true)
    returning id into v_mov;
    if (select e_investimento from cash_movements where id = v_mov) is distinct from true then
      raise exception 'La scelta «investimento» fatta alla nascita non e'' stata conservata.';
    end if;

    -- -------------------------------------------------------------
    -- (3) UN'ENTRATA MARCATA E' IMPOSSIBILE — il vincolo `check`.
    -- -------------------------------------------------------------
    v_preso := false;
    begin
      insert into cash_movements (entity_id, direction, amount, movement_date, mezzo,
                                  business_purpose, e_investimento)
      values (v_srls, 'entrata', 50.00, current_date, 'cassa', 'ZZ verifica investimento - entrata', true);
    exception when check_violation then
      v_preso := true;
    end;
    if not v_preso then raise exception 'Un''ENTRATA marcata come investimento NON e'' stata respinta.'; end if;

    -- ⚠️ E non solo in scrittura nuova: marcare DOPO un'entrata gia' scritta
    --    deve essere altrettanto impossibile. E' la porta che si dimentica.
    insert into cash_movements (entity_id, direction, amount, movement_date, mezzo, business_purpose)
    values (v_srls, 'entrata', 50.00, current_date, 'cassa', 'ZZ verifica investimento - entrata 2')
    returning id into v_mov;
    v_preso := false;
    begin
      update cash_movements set e_investimento = true where id = v_mov;
    exception when check_violation then
      v_preso := true;
    end;
    if not v_preso then raise exception 'Un''entrata gia'' scritta si e'' lasciata marcare dopo.'; end if;

    -- -------------------------------------------------------------
    -- (4) UNA RIGA SCRITTA DAL GESTIONALE E' RESPINTA, e dice perche'.
    -- -------------------------------------------------------------
    v_preso := false;
    begin
      insert into cash_movements (entity_id, direction, amount, movement_date, causale_id, mezzo,
                                  business_purpose, e_investimento)
      values (v_srls, 'uscita', 70.00, current_date, v_sys, 'cassa', 'ZZ verifica investimento - di sistema', true);
    exception when others then
      v_preso := true;
      if sqlerrm not like '%la scrive il gestionale da se%' then
        raise exception 'La causale di sistema e'' stata respinta, ma col messaggio sbagliato: %', sqlerrm;
      end if;
      -- La frase deve NOMINARE la causale: «c'e' una regola che lo impedisce»
      -- dice CHE c'e' una regola, non QUALE — ed e' il difetto chiuso il 25/08.
      if sqlerrm not like '%' || v_sys_lbl || '%' then
        raise exception 'Il rifiuto non nomina la causale «%»: %', v_sys_lbl, sqlerrm;
      end if;
    end;
    if not v_preso then raise exception 'Un''uscita con causale di sistema NON e'' stata respinta.'; end if;

    -- ⚠️ E LA PORTA DI LATO: marcare prima, cambiare la causale dopo. Con un
    --    trigger scritto `update of e_investimento` questa passerebbe — ed e'
    --    la trappola del 27/08, misurata: `of colonna` guarda cio' che e'
    --    stato NOMINATO, non cio' che e' cambiato.
    insert into cash_movements (entity_id, direction, amount, movement_date, causale_id, mezzo,
                                business_purpose, e_investimento)
    values (v_srls, 'uscita', 70.00, current_date, v_caus, 'cassa', 'ZZ verifica investimento - poi di sistema', true)
    returning id into v_mov;
    v_preso := false;
    begin
      update cash_movements set causale_id = v_sys where id = v_mov;
    exception when others then
      v_preso := true;
      if sqlerrm not like '%la scrive il gestionale da se%' then
        raise exception 'Il cambio di causale e'' stato respinto, ma col messaggio sbagliato: %', sqlerrm;
      end if;
    end;
    if not v_preso then
      raise exception 'Una riga marcata si e'' lasciata dare una causale di sistema dopo.';
    end if;
    -- ⚠️ Si SMARCA invece di cancellarla: una cancellazione qui dentro
    --    scriverebbe una lapide (poi annullata) e non serve a niente. Cosi'
    --    la riga esce dai conteggi restando dov'e'.
    update cash_movements set e_investimento = false where id = v_mov;

    -- -------------------------------------------------------------
    -- (5) MARCARE E SMARCARE UN'USCITA GIA' SCRITTA, senza perdere niente.
    -- -------------------------------------------------------------
    insert into cash_movements (entity_id, direction, amount, movement_date, causale_id, mezzo,
                                tipo_documento, document_reference, business_purpose, note)
    values (v_srls, 'uscita', 33.00, current_date - 3, v_caus, 'cassa',
            'scontrino', 'ZZ-42', 'ZZ verifica investimento - esistente', 'ZZ nota da non perdere')
    returning id into v_mov;
    select * into v_prima from cash_movements where id = v_mov;

    update cash_movements set e_investimento = true where id = v_mov;
    select * into v_dopo from cash_movements where id = v_mov;
    if not v_dopo.e_investimento then
      raise exception 'Un''uscita esistente non si e'' lasciata marcare.';
    end if;
    -- ⚠️ Si confrontano le colonne UNA PER UNA, non la riga intera:
    --    `updated_at` cambia per forza (lo scrive un trigger), e un confronto
    --    di riga direbbe «e'' cambiato tutto» ogni volta.
    -- ⚠️ E `is distinct from`, mai `<>`: un confronto con un valore che puo'
    --    essere vuoto non scatta mai, e la verifica approverebbe proprio il
    --    caso che deve prendere (trappola del 27/08).
    if (v_dopo.amount, v_dopo.movement_date, v_dopo.causale_id, v_dopo.mezzo,
        v_dopo.tipo_documento, v_dopo.document_reference, v_dopo.business_purpose,
        v_dopo.note, v_dopo.entity_id, v_dopo.direction, v_dopo.regola_deducibilita_id)
       is distinct from
       (v_prima.amount, v_prima.movement_date, v_prima.causale_id, v_prima.mezzo,
        v_prima.tipo_documento, v_prima.document_reference, v_prima.business_purpose,
        v_prima.note, v_prima.entity_id, v_prima.direction, v_prima.regola_deducibilita_id) then
      raise exception 'Marcare un''uscita esistente ne ha cambiato anche altri dati.';
    end if;

    update cash_movements set e_investimento = false where id = v_mov;
    select * into v_dopo from cash_movements where id = v_mov;
    if v_dopo.e_investimento then raise exception 'Un''uscita marcata non si e'' lasciata smarcare.'; end if;
    if (v_dopo.amount, v_dopo.movement_date, v_dopo.causale_id, v_dopo.note,
        v_dopo.tipo_documento, v_dopo.document_reference)
       is distinct from
       (v_prima.amount, v_prima.movement_date, v_prima.causale_id, v_prima.note,
        v_prima.tipo_documento, v_prima.document_reference) then
      raise exception 'Smarcare un''uscita ne ha cambiato anche altri dati.';
    end if;

    -- -------------------------------------------------------------
    -- (6) I TRE SOGGETTI RESTANO SEPARATI, e l'orto ha la sua riga.
    -- -------------------------------------------------------------
    -- ⚠️ Sulla tasca il verso e' uno solo e la regola di deducibilita' e'
    --    sempre «Indeducibile»: la scrive il trigger del 30/08 da se'.
    insert into cash_movements (entity_id, direction, amount, movement_date, mezzo,
                                business_purpose, e_investimento)
    values (v_tasca, 'uscita', 40.00, current_date, 'cassa', 'ZZ verifica investimento - tasca', true);
    insert into cash_movements (entity_id, direction, amount, movement_date, causale_id, mezzo,
                                business_purpose, e_investimento)
    values (v_agri, 'uscita', 25.00, current_date, v_caus, 'cassa', 'ZZ verifica investimento - orto', true);
    -- Un'uscita GROSSA e NON marcata: se entrasse nei totali si vedrebbe.
    insert into cash_movements (entity_id, direction, amount, movement_date, causale_id, mezzo, business_purpose)
    values (v_srls, 'uscita', 999.00, current_date, v_caus, 'cassa', 'ZZ verifica investimento - non marcata');

    select coalesce(sum(totale), 0) into v_tot from costo_del_progetto() where tipo = 'srls';
    if (v_tot - v_b_srls) is distinct from 100.00 then
      raise exception 'Borgo 58 doveva crescere di 100,00 ed e'' cresciuto di %. (L''uscita da 999 non marcata e'' entrata?)',
        v_tot - v_b_srls;
    end if;
    select coalesce(sum(totale), 0) into v_tot from costo_del_progetto() where tipo = 'tasca';
    if (v_tot - v_b_tasca) is distinct from 40.00 then
      raise exception 'La tasca doveva crescere di 40,00 ed e'' cresciuta di %.', v_tot - v_b_tasca;
    end if;
    -- 🔴 L'ORTO HA LA SUA RIGA, SEPARATA: non si fonde con Borgo 58 e non
    --    sparisce. Chi somma e' la schermata, e lo fa sul TIPO stabile.
    select coalesce(sum(totale), 0) into v_tot from costo_del_progetto() where tipo = 'azienda_agricola';
    if (v_tot - v_b_agri) is distinct from 25.00 then
      raise exception 'L''orto doveva avere la sua riga cresciuta di 25,00 ed e'' cresciuta di %.', v_tot - v_b_agri;
    end if;
    -- E i tre tipi ci sono tutti e tre, ognuno una volta sola.
    select count(*)::integer into v_n from costo_del_progetto();
    if v_n <> 3 then
      raise exception 'I soggetti con qualcosa di marcato dovevano essere 3 (una riga ciascuno), sono %.', v_n;
    end if;

    -- -------------------------------------------------------------
    -- (7) IL DETTAGLIO COMPONE I TOTALI, riga per riga.
    -- -------------------------------------------------------------
    select count(*)::integer into v_n from righe_costo_del_progetto();
    if (v_n - v_b_righe) <> 3 then
      raise exception 'Il dettaglio doveva crescere di 3 righe, e'' cresciuto di %.', v_n - v_b_righe;
    end if;
    -- 🔴 E IL CONTEGGIO DELL'AGGREGATO COMBACIA COL DETTAGLIO: e' il numero
    --    con cui la schermata sa se il dettaglio che ha ricevuto e' intero.
    --    Se i due divergessero, il gestionale direbbe «completo» su un
    --    elenco tagliato — cioe' un totale parziale con l'aria di essere
    --    intero.
    select coalesce(sum(quante), 0)::integer into v_n from costo_del_progetto();
    if v_n <> (select count(*) from righe_costo_del_progetto()) then
      raise exception 'Il conteggio dell''aggregato (%) non combacia con le righe del dettaglio (%).',
        v_n, (select count(*) from righe_costo_del_progetto());
    end if;
    -- E la somma del dettaglio combacia con la somma dell'aggregato.
    select coalesce(sum(importo), 0) into v_tot from righe_costo_del_progetto();
    if v_tot is distinct from (select coalesce(sum(totale), 0) from costo_del_progetto()) then
      raise exception 'Il dettaglio somma % e l''aggregato %.',
        v_tot, (select coalesce(sum(totale), 0) from costo_del_progetto());
    end if;

    -- -------------------------------------------------------------
    -- (8) IL PERIODO TAGLIA DAVVERO, e senza periodo c'e' tutta la storia.
    -- -------------------------------------------------------------
    insert into cash_movements (entity_id, direction, amount, movement_date, causale_id, mezzo,
                                business_purpose, e_investimento)
    values (v_srls, 'uscita', 7.00, current_date - 400, v_caus, 'cassa', 'ZZ verifica investimento - vecchia', true);
    select coalesce(sum(totale), 0) into v_tot from costo_del_progetto() where tipo = 'srls';
    if (v_tot - v_b_srls) is distinct from 107.00 then
      raise exception 'Senza periodo il totale deve comprendere tutta la storia: cresciuto di % invece di 107,00.',
        v_tot - v_b_srls;
    end if;
    select coalesce(sum(totale), 0) into v_tot
      from costo_del_progetto(current_date - 30, null) where tipo = 'srls';
    if (v_tot - v_b_recenti) is distinct from 100.00 then
      raise exception 'Il filtro «dal» non ha tagliato: cresciuto di % invece di 100,00.', v_tot - v_b_recenti;
    end if;

    -- =============================================================
    -- «ANTICIPO IO, POI MI RIMBORSO» — LA SECONDA FONTE
    -- =============================================================
    -- Il giro si costruisce per intero con roba propria: un motivo, un
    -- fornitore, una fattura. ⚠️ `tag_anticipazioni` nasce VUOTA per
    -- decisione del 15/08, quindi non si puo' prendere in prestito un tag
    -- di Alessio: non e' detto che ce ne sia uno.
    insert into tag_anticipazioni (etichetta) values ('ZZ verifica investimento')
    returning id into v_tag;

    -- -------------------------------------------------------------
    -- (A) UNA NOTA NASCE NON MARCATA, e non entra.
    -- -------------------------------------------------------------
    insert into anticipazioni_socio (entity_id, importo, pagata_il, tag_id, fondi, nota)
    values (v_srls, 55.00, current_date, v_tag, 'contanti', 'ZZ verifica investimento - non marcata')
    returning id into v_ant;
    if (select e_investimento from anticipazioni_socio where id = v_ant) is distinct from false then
      raise exception 'Una nota nuova non e'' nata «non marcata».';
    end if;
    select coalesce(sum(totale), 0) into v_tot from costo_del_progetto() where tipo = 'srls';
    if (v_tot - v_b_srls) is distinct from 107.00 then
      raise exception 'Una nota NON marcata e'' entrata nel costo: il soggetto e'' cresciuto di %.', v_tot - v_b_srls;
    end if;

    -- -------------------------------------------------------------
    -- (B) MARCATA E NON RIMBORSATA: entra UNA volta, sotto il suo soggetto.
    -- -------------------------------------------------------------
    update anticipazioni_socio set e_investimento = true where id = v_ant;
    select coalesce(sum(totale), 0) into v_tot from costo_del_progetto() where tipo = 'srls';
    if (v_tot - v_b_srls) is distinct from 162.00 then
      raise exception 'La nota marcata doveva aggiungere 55,00 (107 -> 162): il soggetto e'' cresciuto di %.', v_tot - v_b_srls;
    end if;
    -- E una volta sola: nel dettaglio compare una riga, non due.
    if (select count(*) from righe_costo_del_progetto() where id = v_ant) <> 1 then
      raise exception 'La nota marcata compare % volte nel dettaglio invece di una.',
        (select count(*) from righe_costo_del_progetto() where id = v_ant);
    end if;
    -- ⚠️ E LA TASCA NON SI MUOVE: le anticipazioni sono spese fatte per
    --    conto della societa', non soldi della tasca.
    select coalesce(sum(totale), 0) into v_tot from costo_del_progetto() where tipo = 'tasca';
    if (v_tot - v_b_tasca) is distinct from 40.00 then
      raise exception 'Una anticipazione ha mosso il totale della tasca: cresciuta di % invece di 40,00.', v_tot - v_b_tasca;
    end if;

    -- -------------------------------------------------------------
    -- (C) DOPO IL RIMBORSO: resta UNA volta, non zero e non due.
    -- -------------------------------------------------------------
    -- Serve contante nel cassetto: il rimborso esce da li' davvero.
    insert into cash_movements (entity_id, direction, amount, movement_date, mezzo, business_purpose)
    values (v_srls, 'entrata', 10000.00, current_date, 'cassa', 'ZZ verifica investimento - fondo per il rimborso');

    v_movr := pareggia_anticipazione(v_ant, current_date);
    if (select pareggiata_il from anticipazioni_socio where id = v_ant) is null then
      raise exception 'Il rimborso non ha chiuso la nota: la verifica successiva non proverebbe niente.';
    end if;
    select coalesce(sum(totale), 0) into v_tot from costo_del_progetto() where tipo = 'srls';
    if (v_tot - v_b_srls) is distinct from 162.00 then
      raise exception 'Dopo il rimborso il costo e'' cambiato: cresciuto di % invece di 162,00. Prima e dopo deve essere lo stesso numero.',
        v_tot - v_b_srls;
    end if;
    if (select count(*) from righe_costo_del_progetto() where id = v_ant) <> 1 then
      raise exception 'Dopo il rimborso la nota compare % volte nel dettaglio.',
        (select count(*) from righe_costo_del_progetto() where id = v_ant);
    end if;
    -- E il dettaglio lo DICE, invece di far sembrare la nota ancora aperta.
    select rimborso into v_testo from righe_costo_del_progetto() where id = v_ant;
    if v_testo is null or v_testo not like 'rimborsata il%' then
      raise exception 'Il dettaglio non dichiara lo stato del rimborso: «%».', coalesce(v_testo, '(vuoto)');
    end if;

    -- 🔴 E IL MOVIMENTO DEL RIMBORSO — quello VERO, scritto da
    --    `pareggia_anticipazione` — NON e' marcabile. Non si prova su un
    --    movimento costruito a mano che gli somiglia: si prova su quello.
    v_preso := false;
    begin
      update cash_movements set e_investimento = true where id = v_movr;
    exception when others then
      v_preso := true;
      if sqlerrm not like '%la scrive il gestionale da se%' then
        raise exception 'Il rimborso e'' stato respinto, ma col messaggio sbagliato: %', sqlerrm;
      end if;
    end;
    if not v_preso then
      raise exception 'Il movimento «Rimborso al titolare» si e'' lasciato marcare: il costo crescerebbe due volte.';
    end if;

    -- -------------------------------------------------------------
    -- (D) COLLEGATA A UNA FATTURA: entra lo stesso, una volta.
    -- -------------------------------------------------------------
    insert into suppliers (entity_id, name) values (v_srls, 'ZZ fornitore di verifica')
    returning id into v_forn;
    insert into supplier_invoices (entity_id, supplier_id, invoice_number, invoice_date, amount)
    values (v_srls, v_forn, 'ZZ-2026-1', current_date, 300.00)
    returning id into v_fatt;

    insert into anticipazioni_socio (entity_id, importo, pagata_il, tag_id, fondi,
                                     supplier_invoice_id, documento_riferimento, nota, e_investimento)
    values (v_srls, 300.00, current_date, v_tag, 'conto_personale',
            v_fatt, 'ZZ-DOC', 'ZZ verifica investimento - con fattura', true)
    returning id into v_ant2;

    select coalesce(sum(totale), 0) into v_tot from costo_del_progetto() where tipo = 'srls';
    if (v_tot - v_b_srls) is distinct from 462.00 then
      raise exception 'La nota collegata a una fattura non e'' entrata una volta: cresciuto di % invece di 462,00.',
        v_tot - v_b_srls;
    end if;
    -- E la fattura si vede nel dettaglio: il caso non si nasconde.
    select fattura into v_testo from righe_costo_del_progetto() where id = v_ant2;
    if v_testo is null or v_testo not like 'Fattura ZZ-2026-1%' then
      raise exception 'Il dettaglio non dichiara la fattura collegata: «%».', coalesce(v_testo, '(vuoto)');
    end if;

    -- -------------------------------------------------------------
    -- (E) FATTURA + NOTA + MOVIMENTO: il doppione e' IMPEDITO, nei due versi.
    -- -------------------------------------------------------------
    -- Il movimento che paga la stessa fattura non si puo' marcare...
    insert into cash_movements (entity_id, direction, amount, movement_date, mezzo,
                                tipo_documento, business_purpose, supplier_invoice_id)
    values (v_srls, 'uscita', 300.00, current_date, 'cassa', 'fattura',
            'ZZ verifica investimento - pagamento della stessa fattura', v_fatt)
    returning id into v_mov;
    v_preso := false;
    begin
      update cash_movements set e_investimento = true where id = v_mov;
    exception when others then
      v_preso := true;
      if sqlerrm not like '%gia%contata nel costo del progetto%' then
        raise exception 'Il doppione e'' stato respinto, ma col messaggio sbagliato: %', sqlerrm;
      end if;
      if sqlerrm not like '%ZZ-2026-1%' then
        raise exception 'Il rifiuto non nomina la fattura: %', sqlerrm;
      end if;
    end;
    if not v_preso then
      raise exception 'La stessa fattura si e'' lasciata contare due volte (nota + uscita).';
    end if;

    -- ...e allo specchio: tolta l'etichetta alla nota, il movimento si marca,
    -- e allora e' la NOTA a non potersi piu' marcare. ⚠️ E' il verso che si
    -- dimentica, ed e' quello in cui un controllo scritto da una parte sola
    -- passerebbe in silenzio.
    update anticipazioni_socio set e_investimento = false where id = v_ant2;
    update cash_movements set e_investimento = true where id = v_mov;
    v_preso := false;
    begin
      update anticipazioni_socio set e_investimento = true where id = v_ant2;
    exception when others then
      v_preso := true;
      if sqlerrm not like '%gia%contata nel costo del progetto%' then
        raise exception 'Il doppione allo specchio e'' stato respinto, ma col messaggio sbagliato: %', sqlerrm;
      end if;
    end;
    if not v_preso then
      raise exception 'La stessa fattura si e'' lasciata contare due volte (uscita + nota).';
    end if;

    -- 🔴 E L'ORDINE INVERSO: marcare PRIMA e collegare la fattura DOPO. E'
    --    il caso che un trigger scritto `update of e_investimento` non
    --    vedrebbe (trappola del 27/08).
    insert into anticipazioni_socio (entity_id, importo, pagata_il, tag_id, fondi, nota, e_investimento)
    values (v_srls, 12.00, current_date, v_tag, 'contanti', 'ZZ verifica investimento - collego dopo', true)
    returning id into v_ant;
    v_preso := false;
    begin
      update anticipazioni_socio set supplier_invoice_id = v_fatt where id = v_ant;
    exception when others then
      v_preso := true;
      if sqlerrm not like '%gia%contata nel costo del progetto%' then
        raise exception 'Il collegamento tardivo e'' stato respinto, ma col messaggio sbagliato: %', sqlerrm;
      end if;
    end;
    if not v_preso then
      raise exception 'Collegando la fattura DOPO aver marcato, il doppione e'' passato.';
    end if;
    update anticipazioni_socio set e_investimento = false where id = v_ant;

    -- Rimesso lo stato di (D): la nota conta, il movimento no.
    update cash_movements set e_investimento = false where id = v_mov;
    update anticipazioni_socio set e_investimento = true where id = v_ant2;

    -- -------------------------------------------------------------
    -- (F) MARCARE E SMARCARE UNA NOTA non tocca nessun altro dato.
    -- -------------------------------------------------------------
    declare
      p anticipazioni_socio%rowtype;
      d anticipazioni_socio%rowtype;
    begin
      select * into p from anticipazioni_socio where id = v_ant2;
      update anticipazioni_socio set e_investimento = false where id = v_ant2;
      select * into d from anticipazioni_socio where id = v_ant2;
      if d.e_investimento then raise exception 'Una nota marcata non si e'' lasciata smarcare.'; end if;
      -- ⚠️ `is distinct from`, mai `<>`: un confronto con un valore che puo'
      --    essere vuoto non scatta mai (trappola del 27/08), e la verifica
      --    approverebbe proprio il caso che deve prendere.
      if (d.importo, d.pagata_il, d.tag_id, d.fondi, d.supplier_invoice_id,
          d.documento_riferimento, d.nota, d.pareggiata_il, d.movimento_id,
          d.entity_id, d.regola_deducibilita_id)
         is distinct from
         (p.importo, p.pagata_il, p.tag_id, p.fondi, p.supplier_invoice_id,
          p.documento_riferimento, p.nota, p.pareggiata_il, p.movimento_id,
          p.entity_id, p.regola_deducibilita_id) then
        raise exception 'Smarcare una nota ne ha cambiato anche altri dati.';
      end if;
      update anticipazioni_socio set e_investimento = true where id = v_ant2;
      select * into d from anticipazioni_socio where id = v_ant2;
      if not d.e_investimento then raise exception 'Una nota non si e'' lasciata rimarcare.'; end if;
      if (d.importo, d.pagata_il, d.tag_id, d.fondi, d.supplier_invoice_id,
          d.documento_riferimento, d.nota, d.pareggiata_il, d.movimento_id)
         is distinct from
         (p.importo, p.pagata_il, p.tag_id, p.fondi, p.supplier_invoice_id,
          p.documento_riferimento, p.nota, p.pareggiata_il, p.movimento_id) then
        raise exception 'Marcare una nota ne ha cambiato anche altri dati.';
      end if;
    end;

    -- -------------------------------------------------------------
    -- (G) UNA NOTA SULLA TASCA NON SI PUO' MARCARE.
    -- -------------------------------------------------------------
    -- ⚠️ E' cio' che rende il totale della tasca fatto SOLO delle sue
    --    uscite, per costruzione invece che per un filtro da ricordare.
    insert into anticipazioni_socio (entity_id, importo, pagata_il, tag_id, fondi, nota)
    values (v_tasca, 9.00, current_date, v_tag, 'contanti', 'ZZ verifica investimento - tasca')
    returning id into v_ant;
    v_preso := false;
    begin
      update anticipazioni_socio set e_investimento = true where id = v_ant;
    exception when others then
      v_preso := true;
      if sqlerrm not like '%La tasca non anticipa niente%' then
        raise exception 'La nota sulla tasca e'' stata respinta, ma col messaggio sbagliato: %', sqlerrm;
      end if;
    end;
    if not v_preso then raise exception 'Una nota intestata alla tasca si e'' lasciata marcare.'; end if;

    -- -------------------------------------------------------------
    -- (H) AGGREGATO E DETTAGLIO COINCIDONO, con tutt'e due le fonti.
    -- -------------------------------------------------------------
    select coalesce(sum(quante), 0)::integer into v_n from costo_del_progetto();
    if v_n <> (select count(*) from righe_costo_del_progetto()) then
      raise exception 'Il conteggio dell''aggregato (%) non combacia col dettaglio (%) ora che le fonti sono due.',
        v_n, (select count(*) from righe_costo_del_progetto());
    end if;
    select coalesce(sum(importo), 0) into v_tot from righe_costo_del_progetto();
    if v_tot is distinct from (select coalesce(sum(totale), 0) from costo_del_progetto()) then
      raise exception 'Con due fonti il dettaglio somma % e l''aggregato %.',
        v_tot, (select coalesce(sum(totale), 0) from costo_del_progetto());
    end if;
    -- E le due fonti sono davvero tutt'e due rappresentate: se una sparisse,
    -- i controlli qui sopra tornerebbero lo stesso.
    if (select count(distinct fonte) from righe_costo_del_progetto()) <> 2 then
      raise exception 'Nel dettaglio manca una delle due fonti: %.',
        (select string_agg(distinct fonte, ', ') from righe_costo_del_progetto());
    end if;

    -- -------------------------------------------------------------
    -- (9) IL PORTIERE RIFIUTA, non risponde vuoto.
    -- -------------------------------------------------------------
    -- ⚠️ Chi non deve vedere riceve un RIFIUTO, non un elenco vuoto: un
    --    elenco vuoto si leggerebbe «non e' stato speso niente» (13/08).
    perform set_config('request.jwt.claims', null, true);
    v_preso := false;
    begin
      perform count(*) from costo_del_progetto();
    exception when others then
      v_preso := true;
      if sqlerrm not like '%riservato al titolare%' then
        raise exception 'Il rifiuto del portiere ha il messaggio sbagliato: %', sqlerrm;
      end if;
    end;
    if not v_preso then
      raise exception 'Il costo del progetto si e'' lasciato leggere senza titolare.';
    end if;
    v_preso := false;
    begin
      perform count(*) from righe_costo_del_progetto();
    exception when others then
      v_preso := true;
    end;
    if not v_preso then raise exception 'Il dettaglio si e'' lasciato leggere senza titolare.'; end if;

    raise exception 'ZZ_ANNULLA';  -- <<< qui la sotto-transazione rientra
  exception when others then
    -- ⚠️ Il `raise` qui sotto non e' un dettaglio: senza, una verifica
    --    FALLITA verrebbe inghiottita dallo stesso meccanismo che serve ad
    --    annullare, e la migrazione passerebbe verde con la verifica rotta.
    if sqlerrm <> 'ZZ_ANNULLA' then raise; end if;
  end;

  perform set_config('request.jwt.claims', null, true);

  -- Dopo l'annullamento non deve restare niente, e le lapidi devono essere
  -- le stesse: se qualcosa fosse stato cancellato invece che annullato, il
  -- registro lo direbbe.
  perform pretendi_nessun_residuo(v_foto, 'la verifica dell''etichetta investimento');

  raise notice 'Fatto: l''etichetta esiste e nasce spenta, un''entrata non la puo'' portare (nemmeno dopo), una riga scritta dal gestionale nemmeno, marcare e smarcare non tocca nessun altro dato, e i tre soggetti restano separati col dettaglio che compone i totali. Provato nei due versi e annullato: zero residui.';
end $verifica$;

-- ---------------------------------------------------------------------
-- La migrazione si registra da sé
-- ---------------------------------------------------------------------
insert into applied_migrations (version, name)
values ('20260921000003', 'l_etichetta_investimento')
on conflict (version) do nothing;
