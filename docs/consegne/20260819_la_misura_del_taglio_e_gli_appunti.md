# La misura del taglio a mille righe, e l'elenco dei dati di collaudo rimisurato

**Nessun codice e nessuna migrazione.** Sono due misure e la correzione degli
appunti che ne è uscita — entrambe chieste da Alessio, entrambe **senza
correzione** per sua decisione esplicita.

Contiene anche il resoconto dell'**applicazione in produzione** delle due
migrazioni della sera (`…009` e `…010`).

---

## ⚠️ Cosa NON è verificato

1. ⚠️ **Il taglio a mille righe non è mai stato visto accadere nell'app**:
   nessuna tabella di produzione ci arriva (la più popolata ne ha 26). È stato
   riprodotto su una tabella del progetto di prova.
2. ⚠️ **Le stime dei volumi sono stime**, ricavate dai numeri di Alessio (6
   servizi a settimana, ~25 coperti) e non da consumi veri.
3. ⚠️ **La misura non copre le Edge Function né le letture annidate**
   (`select("*, righe(*)")`), che potrebbero essere tagliate **nelle righe
   figlie** senza che il numero di righe padre lo mostri. È la forma più
   silenziosa, e nessuno l'ha guardata.
4. ⚠️ **L'elenco dei dati di collaudo è una fotografia del 19/08 sera**, e
   invecchierà al primo gesto di Alessio nell'app — vedi la diagnosi in fondo.
5. 🔴 **Nessuna mano ha chiuso un conto in sala** dopo la modifica applicata
   stasera, e in produzione ci sono **due conti aperti** dal 18/08.

---

## Cosa abbiamo rovesciato

**Nessun rovesciamento.**

---

## 1 · Le due migrazioni sono in produzione

Applicate dopo il push, con l'autorizzazione di Alessio (*applica pure
subito: in produzione non c'è nessun movimento e nessun incasso, quindi oggi
costa meno di qualunque altro giorno*). **2 su 2.**

Numeri veri misurati dopo, non previsti:

| | |
|---|---|
| migrazioni in produzione | **147** |
| riempimenti automatici di date rimasti | **0** |
| righe di prova nel registro delle cancellazioni | **0** (le 5 tolte) |
| lapidi totali | **26**, tornate a quelle legittime |
| funzioni che decidono la data a Greenwich | **0** |
| funzioni senza portiere | **16** (l'elenco congelato) |

---

## 2 · Il taglio a mille righe — la misura

Referto per intero:
[`referti/20260819_il_taglio_a_mille_righe.md`](../referti/20260819_il_taglio_a_mille_righe.md).
Qui le cose che contano.

**Il fatto**: chiedendo un elenco senza dire quante righe si vogliono, ne
tornano **al massimo mille**, **senza nessun errore**. Chiedere esplicitamente
più righe non serve: il tetto vince. Non è scritto nel nostro codice — è
l'impostazione **Max rows** del progetto Supabase, di fabbrica 1000. ⚠️ *Un
tetto che non sta nel codice non si vede leggendo il codice.*

**Quante letture**: **144 nell'app**, 174 nelle prove, 4 nei comandi di
servizio. La maggioranza è innocua (cataloghi che non crescono); quelle a
rischio sono elencate nel referto per tabella e per schermata.

**Quando morde**: oggi nessuna tabella ci arriva — la più popolata ne ha
**26**. Ma `order_items` passa mille in **2-3 settimane di servizio**,
`orders` e `reservations` in **3-4 mesi**, i registri HACCP in **4-6 mesi**.

🔴 **I due punti che fanno male, e non sono i più veloci a crescere**:

- **Prima nota**: i campi «dal» e «al» partono **vuoti**, quindi la schermata
  chiede *tutti* i movimenti — e sullo stesso elenco calcola **entrate del
  periodo, uscite del periodo e il file CSV**. ⚠️ La beffa è che in cima a
  `cash.js` c'è dall'08/08 un'avvertenza che dice *«niente `.limit()` qui,
  produrrebbe un export fiscale incompleto ma dall'aspetto normale»*: **il
  limite ce lo mette il gateway al posto nostro**, e quell'avvertenza non
  poteva vederlo.
- **Manuale HACCP**: di partenza guarda gli ultimi 30 giorni ed è al sicuro,
  ma con l'interruttore **«tutto»** ogni registro viene chiesto per intero.
  *Un documento esibibile che dichiara «tutto» e ne mostra mille.*

⚠️ **La distinzione che Alessio ha chiesto di isolare** — quali letture
alimentano un **conto** invece di riempire un elenco — è quella giusta: delle
9 somme trovate, **7 sono protette** da un filtro di periodo o da una tabella
che non cresce; le 2 scoperte sono quelle qui sopra.

**I controlli automatici**: solo **uno** era cieco, ed è quello trovato oggi.
🔴 **E il motivo non è fortuna, è una proprietà del disegno**: le reti di
questo progetto sono funzioni del database che restituiscono **soltanto i
colpevoli** — se i colpevoli sono zero la risposta è vuota, e il taglio non
può nascondere niente. Quella cieca era l'unica scritta al contrario: *leggi
tutto e cerca il colpevole qui*.

> **La regola che ne esce**: un controllo chiede al database **la risposta**,
> non i dati su cui calcolarla.

### ⚠️ E si può far dire al programma che la risposta era tagliata

È la parte che Alessio ha indicato come quella che vale di più, e **la
risposta è sì**. Misurato:

| come si chiede | righe ricevute | quante ce n'erano |
|---|---|---|
| `.select("id")` | 1000 | 1930 |
| `.select("id").range(0, 99999)` | 1000 | 1930 |
| `.select("id", { count: "exact" })` | 1000 | ✅ **1930, dichiarate** |

Quindi **righe ricevute < righe dichiarate ⟹ tagliata**, e il confronto può
stare in **un posto solo** (un involucro attorno alla lettura). Da lì una
lettura tagliata **si accorge da sola**, e si può decidere caso per caso:
un avviso dove è un elenco da guardare, un **rifiuto** dove alimenta un
totale o un documento esibibile.

⚠️ **Alzare il tetto dal pannello non è la cura**: sposta il precipizio senza
toglierlo, e lo sposta dove nessuno leggendo il codice può vederlo.

---

## 3 · L'elenco dei dati di collaudo, rimisurato per intero

Richiesta di Alessio: *rimisuralo contro la produzione e riallinealo, invece
di correggere la riga che sappiamo sbagliata.* Fatto: **tredici voci
misurate, tre disallineate e una scritta in modo fuorviante.**

- **conti**: scritti 5 e nessuno aperto → sono **8**, e **due sono aperti**;
- **prenotazioni**: scritte 6 → sono **16** (8 confermate);
- **ingredienti e fornitori**: un'altra riga diceva «Ricettario e fornitori
  vuoti» → sono **8** e **2** (vero il 12/08, falso da quando è stato
  collaudato il carico da fattura);
- 🔴 **«le sei fatture di collaudo»**: le fatture registrate
  (`supplier_invoices`) sono **zero**. Quelle sei sono **documenti in
  archivio**, e ciò che resta in giro sono i loro *effetti* — 8 ingredienti,
  12 diciture, 26 lotti, 26 righe di storico prezzi. *La voce faceva cercare
  una cosa che non c'è e non nominava quelle che ci sono.*

**Due cose che l'elenco non diceva, ed è dove fallirebbe il giorno della
pulizia**: (a) i 10 documenti sono una **tabella tracciata**, quindi
cancellarli lascerà **10 lapidi** che nessuno può ripulire dall'app — la
pulizia *non* riporterà il registro a 26; (b) **5 dei 12 allarmi non sono
dati di collaudo**: sono avvisi veri dei lavori pianificati, e toglierli
cancellerebbe la storia di ciò che ha funzionato.

### 🔴 E il problema non è la riga: è il modo in cui l'elenco viene tenuto

È un paragrafo scritto a mano, quindi **ogni voce è una fotografia che
invecchia al primo gesto di Alessio nell'app** — e ha sbagliato **tre volte
in sei giorni**, sempre sulle stesse voci (conti e prenotazioni), sempre
perché lui aveva continuato a provare.

⚠️ *Un elenco di cose da togliere che si fida della memoria di chi l'ha
scritto fallisce nel solo giorno in cui serve davvero.*

La forma giusta esiste già altrove in questo progetto: `npm run prova:stato`
**ricava l'elenco dal database a ogni esecuzione invece di contenerlo**. La
stessa cosa qui sarebbe un comando che legge la produzione e stampa cosa c'è.
**Non è stato costruito**: Alessio ha chiesto di sistemare gli appunti, non
il codice. Resta come voce di coda, dentro «i conteggi scritti negli appunti
che nessuna verifica controlla».

---

## Per Alessio, in una riga

Le ultime due modifiche sono nel gestionale vero; ho misurato il difetto delle
mille righe senza toccarlo (oggi non morde, fra qualche settimana sì, e si può
far accorgere il gestionale da solo); e ho ricontato uno per uno i dati di
prova che restano in produzione, perché l'elenco era vecchio in tre punti.

---

**Migrazioni**: nessuna in questo blocco. `20260819000009` e `…010`
**applicate in produzione** (147 in totale).
