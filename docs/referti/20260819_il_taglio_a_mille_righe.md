# Il taglio a mille righe — misura, e nessuna correzione

**Misurato il 19/08/2026 sera, in sola lettura**, sul codice e sui due
database. **Decisione di Alessio: solo la misura in questa passata**, perché
serve a lui per decidere se è una cosa da mezz'ora o un giro a sé.

---

## 0 · Il fatto, misurato e non dedotto

Chiedendo un elenco al database senza dire quante righe si vogliono, ne
tornano **al massimo mille**. Misurato sul progetto di prova con una tabella
che ne ha di più:

| come si chiede | righe ricevute | quante ce n'erano |
|---|---|---|
| `.select("id")` | **1000** | 1930 |
| `.select("id").range(0, 99999)` | **1000** | 1930 |
| `.select("id", { count: "exact" })` | **1000** | ✅ **1930, dichiarate** |

⚠️ **Chiedere più righe non serve**: il tetto vince anche su una richiesta
esplicita più grande. Non è una scelta scritta nel nostro codice — è
l'impostazione **Max rows** del progetto Supabase, che di fabbrica vale 1000
e si cambia dal pannello. *Un tetto che non sta nel codice non si vede
leggendo il codice.*

🔴 **E non dà nessun errore.** La risposta arriva più corta e sembra intera.
È la famiglia della sala che si disegnava vuota — con la differenza che lì
mancava tutto e si vedeva, qui **manca solo la coda**.

---

## 1 · Quante letture chiedono un elenco senza dire quante righe

Contate sul codice, escludendo le scritture, le letture di **una riga sola**
(`.single()`), quelle già **limitate** (`.limit()`/`.range()`), quelle **per
chiave** e le chiamate a funzioni che **non restituiscono un insieme** —
quest'ultimo elenco (78 funzioni) è stato chiesto al database, non scritto a
mano.

| dove | letture senza limite |
|---|---|
| **l'app** (`src/`) | **144** |
| le prove automatiche (`tests/`) | 174 |
| i comandi di servizio (`scripts/`) | 4 |

Delle 144 dell'app: **83 leggono una tabella o una vista**, **61 chiamano una
funzione del database** che restituisce un insieme.

⚠️ **La stragrande maggioranza non è un problema**, ed è giusto dirlo prima
dell'elenco: leggono cataloghi che non cresceranno mai oltre poche centinaia
di righe — i formati dei tavoli, le causali, le regole di deducibilità, le
sagome della sala, i passi di una ricetta. Il tetto morde solo dove il numero
di righe cresce col tempo.

### Le letture a rischio, per tabella e per schermata

| tabella o funzione | lettura | schermate |
|---|---|---|
| `cash_movements` | `listCashMovements` | Cassa · **Prima nota** |
| `orders` | `listOpenOrders`, `listContiPerPrenotazioni` | Sala · Bar |
| `order_items` | `listRepartoTickets` | Bar · Cucina |
| `reservations` | `listReservations`, `listCustomerReservations` | Calendario · Elenco prenotazioni · Sala |
| `stock_lots` | `listStockLots` | Tracciabilità |
| `v_haccp_temperature_logs` | `listTemperatureLogs` | HACCP · **Manuale completo** |
| `haccp_goods_receiving` | `listGoodsReceiving` | Ricevimento merci · **Manuale completo** |
| `haccp_cleaning_logs` | `listCleaningLogs` | Pulizie · **Manuale completo** |
| `documents` | `listDocuments` | Archivio documenti · Fatture |
| `supplier_invoices` | `listSupplierInvoices` | Fatture fornitori |
| `discounts_gifts` | `listDiscountsGifts` | Cassa · Sconti e omaggi |
| `customers` | `listCustomers` | Clienti · Chiusura conto |
| `tasks` | `listTasks` | Agenda · Stampa adempimenti |
| `deleted_records` | *(nessuna dall'app)* | — |

---

## 2 · Quali tabelle arrivano a mille righe, e in quanto tempo

**Oggi nessuna ci arriva**, ed è il motivo per cui il difetto non morde:
misurato in produzione, la tabella più popolata ne ha **26**.

| tabella | righe oggi |
|---|---|
| `deleted_records`, `price_history`, `stock_lots` | 26 |
| `tasks` | 20 · `reservations` 16 · `documents` 10 |
| `orders` 8 · `stock_consumptions` 9 · `order_items` 3 |
| `cash_movements`, `discounts_gifts`, i registri HACCP | **0** |

### La stima, dai numeri del locale

⚠️ **Sono stime, non misure**, e i numeri di partenza sono di Alessio:
**6 servizi a settimana** (cena martedì-sabato, pranzo domenica — letto dagli
orari veri) e **~25 coperti a servizio** (la sua soglia di avviso per il
rodaggio; la sala ne tiene 34).

| tabella | quanto cresce | quando passa mille |
|---|---|---|
| **`order_items`** (righe di comanda) | ~3 righe a coperto → **~450 a settimana** | 🔴 **2-3 settimane** |
| **`haccp_temperature_logs`** | 2 letture al giorno × attrezzature | 🔴 **~4-6 mesi** |
| **`reservations`** | ~10 a servizio → ~60 a settimana | 🔴 **~4 mesi** |
| **`orders`** (conti) | ~12 a servizio → ~70 a settimana | 🔴 **~3-4 mesi** |
| **`stock_lots`** | ~10 righe per fattura, 2-3 fatture a settimana | 🟠 **~1 anno** |
| **`cash_movements`** | prima nota + pagamenti: ~10-15 a settimana | 🟠 **~1,5 anni** |
| `haccp_cleaning_logs`, `haccp_goods_receiving` | dipende da quante voci di pulizia | 🟠 **~1 anno** |
| `documents`, `customers`, `supplier_invoices`, `tasks` | qualche centinaio all'anno | 🟢 **oltre 2 anni** |

⚠️ **Il primo a mordere è `order_items`, e morde in poche settimane** — ma è
anche il caso meno grave, perché quelle letture sono **già ristrette al
servizio in corso** (i ticket da evadere, i conti aperti). Le due che
preoccupano davvero sono più lente e più silenziose: vedi il punto 3.

---

## 3 · Quali di quelle letture alimentano un CONTO

È la distinzione che Alessio ha chiesto di isolare, ed è quella giusta: *un
elenco tagliato si nota, una somma calcolata su un elenco tagliato è un
numero credibile e falso, e nessuno la rilegge.*

Trovate **9 somme** nell'app che girano su una lettura senza limite. Due sono
gravi, le altre sette sono protette da un filtro di periodo o da una tabella
che non cresce.

### 🔴 Prima nota — due totali e l'esportazione, sullo stesso elenco tagliato

`PrimaNota.jsx` legge **tutti** i movimenti (i campi «dal» e «al» partono
**vuoti**), e su quell'array calcola **entrate del periodo**, **uscite del
periodo** e **il file CSV**.

⚠️ **La beffa è scritta in questo repository dall'08/08**: in cima a
`cash.js` c'è un'avvertenza che dice *«niente `.limit()` qui: alimenta anche
l'export CSV della prima nota, quindi un limite produrrebbe un export fiscale
incompleto ma dall'aspetto normale»*. **Il limite ce lo mette il gateway al
posto nostro**, e l'avvertenza non poteva vederlo.

### 🔴 Manuale HACCP completo — il documento che si esibisce

`ManualeCompleto.jsx` ha un filtro di periodo, e **di partenza sono gli
ultimi 30 giorni**: lì è al sicuro. Ma ha anche l'interruttore **«tutto»**,
e con quello acceso ogni registro viene chiesto per intero → **mille righe
per registro**, in un documento che dichiara in testa il periodo che copre.
*Un documento esibibile che dice «tutto» e mostra mille righe.*

### 🟢 Le altre sette, e perché reggono

| somma | perché regge |
|---|---|
| Cassa — entrate/uscite del mese | filtrata dal primo del mese |
| Deduzioni fiscali — totale spese e quote | filtrata per anno |
| Scheda cliente — totale sconti | righe di un cliente solo |
| Elenco prenotazioni e pianta — coperti | filtrate per data |
| Scheda menu — food cost e margine medi | tante quante i piatti in carta |
| Posta in arrivo — totale importi | solo la posta in attesa |
| Andamento mensile — scostamento | dodici mesi |

⚠️ **«Regge» vuol dire «oggi il filtro tiene sotto mille»**, non «è
impossibile». Il totale della Cassa su un mese pieno di attività resterà
lontano dal tetto; ma è la stessa forma, e se un domani qualcuno togliesse
il filtro di periodo non ci sarebbe nessun avviso.

---

## 4 · Quali controlli e prove si appoggiano a una lettura così

Le prove automatiche con una lettura senza limite sono **174**, ma la domanda
vera è più stretta: *quali potrebbero passare VERDI per colpa del taglio?*

Sono quelle che leggono tutto, filtrano dalla parte del programma e poi
pretendono zero. Cercate una per una: **ne restano quattro**, e nessuna è
oggi in pericolo.

| prova | cosa legge | rischio |
|---|---|---|
| `registri-esibibili` — le lapidi di prova | ⚠️ **era esattamente questo difetto**, trovato e corretto oggi | ✅ corretta: chiede al database, che restituisce solo le righe colpevoli |
| `giornata-operativa` — funzioni a Greenwich | una funzione che torna solo i colpevoli | 🟢 servirebbero mille funzioni colpevoli |
| `prenotazione-pubblica` — opzioni e etichette | insiemi di poche righe | 🟢 |
| `permessi` — i due elenchi congelati | funzioni che tornano 10 e 16 righe | 🟢 |

🔴 **E il motivo per cui una sola era cieca è una proprietà del disegno, non
fortuna**: le reti di questo progetto (`funzioni_aperte_ad_anon`,
`funzioni_senza_portiere`, `funzioni_con_data_utc`, `vocabolari_chiusi`) sono
**funzioni del database che restituiscono soltanto i colpevoli** — se i
colpevoli sono zero, la risposta è vuota, e il taglio non può nascondere
niente. Quella cieca era l'unica scritta al contrario: *leggi tutto e cerca
il colpevole qui*.

> **La regola che ne esce**: un controllo chiede al database **la risposta**,
> non i dati su cui calcolarla.

---

## 5 · ⚠️ Si può far dire al programma «la risposta era tagliata» — sì

È la parte che Alessio ha indicato come quella che vale di più, e la risposta
è **sì, e costa un'opzione**.

Chiedendo l'elenco con `{ count: "exact" }`, il database **restituisce anche
quante righe c'erano davvero**. Misurato sopra: 1000 righe consegnate,
**1930 dichiarate**. Quindi:

```
righe ricevute < righe dichiarate  ⟹  la risposta era tagliata
```

**Cosa cambierebbe.** Il confronto può stare in **un posto solo** — un
involucro attorno alla lettura, dentro `src/lib/supabase.js` o accanto ad
esso — e da lì:

- una lettura tagliata **si accorge da sola**, invece di essere cercata;
- la correzione futura smette di essere *«trovarli tutti e mettere un
  filtro»* e diventa *«il programma dice dove»*;
- si può decidere **caso per caso** cosa fare quando succede: un avviso a
  schermo dove è un elenco da guardare, un **rifiuto** dove alimenta un
  totale o un documento esibibile — che è la stessa regola già usata per lo
  scarto a zero e per gli allergeni non verificati: *un buco dichiarato, mai
  uno zero che sembra un dato*.

⚠️ **Il costo, dichiarato**: `count: "exact"` fa contare le righe al
database, cioè una lettura in più su ogni elenco. Su queste dimensioni non si
vede; su una tabella grande e senza filtro sì. La via di mezzo — contare solo
quando le righe ricevute sono **esattamente** mille — costa **zero** nella
quasi totalità dei casi e chiede la conferma solo nel caso sospetto.

⚠️ **E alzare il tetto dal pannello non è la cura**: sposta il precipizio
senza toglierlo, e lo sposta in un posto che nessuno leggendo il codice può
vedere.

---

## Cosa questa misura NON dice

1. ⚠️ **Non ha provato nessuna schermata sul campo.** Nessuna tabella di
   produzione arriva a mille righe, quindi il taglio **non è mai stato visto
   accadere nell'app** — è stato riprodotto su una tabella del progetto di
   prova.
2. ⚠️ **Le stime dei volumi sono stime**, ricavate dai numeri di Alessio (6
   servizi, ~25 coperti) e non da consumi veri. L'ordine di grandezza è
   quello; il mese esatto no.
3. ⚠️ **Non copre le Edge Function**: `posta-leggi`, `assistente-archivio`,
   `documento-leggi` e `operazioni-atomiche` leggono anche loro dal database.
   Girano con un'altra chiave e **potrebbero avere un tetto diverso**: non è
   stato misurato.
4. ⚠️ **Non copre le letture annidate.** Una lettura che porta con sé le
   righe collegate (`select("*, righe(*)")`) può essere tagliata **nelle
   righe figlie** senza che il numero di righe padre lo mostri. Nessuno l'ha
   misurato, e sarebbe la forma più silenziosa di tutte.
5. ⚠️ **Non dice se le 144 letture dell'app siano tutte legittime nel
   merito**: dice che non chiedono un numero di righe. Un elenco senza filtro
   di periodo che *dovrebbe* averne uno è un altro difetto, e questa misura
   non lo distingue.
6. ⚠️ **Il conteggio delle letture è fatto sul testo del codice**, con una
   ricerca che riconosce le catene `.from(...)` e `.rpc(...)`. Una lettura
   scritta in un modo che quella ricerca non riconosce non è in elenco.

---

# ADDENDUM — le letture annidate (19/08/2026, notte)

**Misurato dopo la correzione della sera**, su richiesta di Alessio, e con la
sua istruzione di rispondere **prima** alla domanda che decide l'ordine delle
cose: *il segnale appena fatto le vede?*

## 🔴 1 · No, il segnale NON le vede

Costruiti sul progetto di prova due conti — uno con **1200 righe**, uno con
**5** — e letti in un colpo solo, come fa la sala:

| lettura | cosa è tornato | il gestionale se n'è accorto? |
|---|---|---|
| `orders` con dentro `order_items` | il conto grande con **1000 righe**, il piccolo con 5 | 🔴 **NO — nessun avviso** |
| le stesse 1200 righe chieste da sole | 1000 | ✅ sì, «1000 su 1200» |

**Perché**: il confronto fra righe consegnate e righe dichiarate si legge
dall'intestazione `Content-Range`, e quell'intestazione parla **solo delle
righe padre**. Nella prova i padri erano 2 su 2 — nessuna bugia — mentre il
figlio grande era tagliato di 200 righe senza che niente lo dicesse.

⚠️ **Va detto chiaro perché oggi sembra coperto e non lo è**: la protezione
della sera copre le letture semplici e **lascia scoperto esattamente il caso
peggiore**.

## 2 · Il tetto è PER RIGA PADRE, non per interrogazione

Misurato, non dedotto, ed è la domanda che Alessio ha chiesto di non dare per
scontata: nella **stessa** richiesta il conto grande ha ricevuto **1000**
righe e il piccolo le sue **5**. Se il tetto fosse per interrogazione, il
piccolo sarebbe rimasto senza.

⚠️ **La conseguenza cambia il quadro, e in meglio**: non è il *numero
complessivo* di righe figlie a contare, ma quante ne ha **una singola riga
padre**. Un elenco di mille conti con tre righe l'uno non tocca il tetto.

## 3 · Quali letture annidate esistono, e quali possono arrivarci

Sono **sette**, tutte nel livello che parla col database:

| padre → figli | dove | può superare mille **per padre**? |
|---|---|---|
| `orders` → `order_items` | `listOpenOrders`, `getOrder`, `listContiPerPrenotazioni` | 🟢 no: un conto con più di mille righe non esiste |
| `orders` → `order_tables` | idem | 🟢 no: i tavoli di un conto sono una manciata |
| `reservations` → `prenotazione_tavoli` | `listReservations` | 🟢 no |
| `posta_ricevuta` → `posta_allegati` | `listPostaInAttesa` | 🟢 no: gli allegati di una mail |
| `posta_ricevuta` → `posta_azioni` | idem | 🟢 no |
| `tip_distributions` → `tip_distribution_lines` | `listTipDistributions` | 🟢 no: una riga per dipendente |
| `supplier_invoices` → `note_credito_utilizzi` e `documents` | `listSupplierInvoices` | 🟢 no: le note e i DDT di **una** fattura |

🟢 **Nessuna delle sette può arrivarci**, ed è la parte tranquillizzante
della misura: il tetto morde su quante righe ha **un singolo padre**, e in
questo gestionale nessun padre ne ha mille.

⚠️ **E i tre casi che Alessio ha nominato come pericolosi non sono letture
annidate** — sono letture piatte, quindi **già coperte dal segnale**:

- un **fornitore con tutte le sue fatture**: le fatture si leggono da
  `supplier_invoices` filtrando per fornitore, col fornitore incorporato al
  contrario (uno solo);
- un **ingrediente con tutto il suo storico prezzi**: `listPriceHistory` ha
  già un `.limit(100)` esplicito, e quello del fornitore un `.limit(50)`;
- un **registro HACCP con tutte le sue voci**: si legge piatto, ed è il
  punto già sistemato col filtro di periodo e la dichiarazione stampata.

## 4 · Quali alimentano un calcolo

Una sola, e va nominata: **`orders` → `order_items` alimenta `orderTotals()`**,
cioè il totale del conto che si legge sul preconto e alla chiusura. Se un
conto avesse più di mille righe, il totale sarebbe più basso del vero **e
tornerebbe con quello che si vede a schermo** — nessuno avrebbe modo di
accorgersene.

🟢 Oggi non è raggiungibile: mille righe su un conto solo vorrebbero dire
mille piatti a un tavolo. **Ma è la ragione per cui questa voce non si
archivia**: il giorno che una lettura annidata nuova pescasse da una tabella
che cresce, il difetto sarebbe già armato e silenzioso.

## 5 · ⚠️ E il segnale, per le righe figlie, non si può fare allo stesso modo

Il trucco della sera — farsi dichiarare dal database quante righe c'erano —
**non esiste per gli incorporamenti**: l'intestazione `Content-Range` porta un
totale solo, quello dei padri. Le strade possibili sono due, e sono entrambe
diverse da quella già fatta:

1. **l'indizio**: una lista figlia con **esattamente** mille elementi è quasi
   certamente tagliata. Costa zero, ma è un sospetto, non una certezza;
2. **la domanda in più**: quando l'indizio scatta, chiedere al database
   quante righe figlie ci sono per quel padre. Costa una lettura, e solo nel
   caso sospetto.

⚠️ **Non è stato costruito niente**: la decisione è di Alessio, e oggi non
c'è nessun punto raggiungibile da proteggere.

## Cosa questa misura NON dice

1. ⚠️ **Non copre le Edge Function**, che leggono con una loro chiave: se una
   di loro facesse una lettura annidata, non passerebbe né dal segnale né da
   questo censimento.
2. ⚠️ **Le sette letture sono quelle scritte nel livello che parla col
   database**: una lettura annidata scritta dentro una schermata, o
   costruita a pezzi, non sarebbe in elenco.
3. ⚠️ **Il «non può arrivarci» è un giudizio sul locale**, non una regola del
   programma: nessun vincolo impedisce a un conto di avere mille righe — è la
   realtà di un'osteria da 34 coperti a impedirlo.
4. ⚠️ **La misura del tetto per riga padre è stata fatta con due padri**: non
   è stato provato che regga con centinaia di padri che superano il tetto
   insieme.
