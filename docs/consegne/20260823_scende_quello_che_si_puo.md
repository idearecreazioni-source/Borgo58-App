# Scende quello che si può

**Blocco 1 del mandato del 23/08** — *«lo scarico parziale, è il difetto
grosso»*. Migrazione **`20260823000002`**, applicata **solo sul progetto di
prova**. In produzione non è entrato niente: aspetta il push di Alessio.

---

## 1 · Cosa aveva deciso Alessio

> **Scende quello che si può**, e viene detto cosa non è sceso. Niente più
> rifiuto totale.

Con due condizioni scritte nel mandato, e sono la parte che ha guidato il
lavoro:

> ⚠️ *La cura non basta che funzioni: chi guarda deve **sapere** che quel
> conto è sceso a metà. Un magazzino che scende parzialmente in silenzio è
> lo stesso difetto di adesso, solo più difficile da vedere.*

---

## 2 · Il difetto, ripreso dal referto della notte

[`referti/20260823_un_pizzico_di_cannella.md`](../referti/20260823_un_pizzico_di_cannella.md).

Un ingrediente che vale **trentasette milligrammi** — la cannella che tocca
a 18 g di frolla, divisa per le porzioni — non è rappresentabile in una
colonna `numeric(12,4)`. Il vincolo `quantity > 0` respinge la riga, e il
rifiuto arriva dentro l'unico `begin … exception` che avvolgeva **tutti** gli
ingredienti del conto: annullato il pizzico, annullato anche il pesce, la
carne, il costo della cena.

**Misurato a scala vera, prima di toccare niente**: 148 conti chiusi su 346
senza una sola riga di consumo. Il 43%.

---

## 3 · Le due cure, e sono due cose diverse

### a. Il pizzico non fa più fallire niente

Non è «arrotondare per non far fallire»: è che il gestionale **non sa dire
trentasette milligrammi**, e il lotto non si muoveva comunque — togliere
0,000037 a una colonna con quattro decimali la lascia dov'era. Quindi non si
perde nessuna scrittura che prima avveniva: **si smette di provare a farne
una impossibile**.

La soglia sta in **un posto solo**, `pizzico_trascurabile()`, e questo è il
punto: il 23/08 quella soglia era già scritta due righe sotto il punto che
falliva (`if v_da_togliere > 0.00005`) — ma guardava solo il verso di ciò che
**manca**, mai quello di ciò che si **scrive**. *Chi ha scritto quella
funzione sapeva dell'arrotondamento, e il difetto viveva nello spazio fra le
due righe.*

⚠️ **Stessa riga curata in `registra_produzione`**, che aveva la forma
identica. Lì oggi non morde (si produce a dosi intere), ma il giorno che
mordesse farebbe fallire **tutta** la produzione.

### b. Ogni ingrediente sta nel suo blocco

Il cuore della decisione di Alessio. Lo scarico di ogni ingrediente ha ora un
proprio blocco protetto: quello che non riesce si ferma da solo, viene
dichiarato **col suo nome** in `anomalie_scarico`, e il resto del conto
scende.

⚠️ **Questo cambia il patto**, ed è dichiarato: prima era *«tutto o niente, e
si riproverà»*; ora è *«quello che si può scende, e ti dico cosa manca»*.

🔴 **E la prima metà del vecchio patto era già una frase diventata falsa.**
Nel codice c'era scritto *«così si potrà riprovare»* — misurato:
`scarica_magazzino_conto` la chiamano solo le chiusure del conto, e un conto
chiuso non si richiude. **Nessuno poteva riprovare.** Quei 148 conti non
scaricheranno mai.

---

## 4 · Chi guarda sa che il conto è sceso a metà

Era la condizione del mandato, e senza sarebbe stata una cura peggiore del
male.

`scarichi_non_riusciti` porta da oggi tre cose in più: il **conto**, la
**serata** (non il giorno di calendario: un conto chiuso all'una di notte
appartiene alla sera prima) e **quanti ingredienti di quel conto sono scesi
lo stesso**. In *Magazzino → «Cosa non è sceso dal magazzino»* ogni riga
finisce con una delle due frasi:

- «il resto di questo conto è sceso (N ingredienti)»
- «di questo conto non è sceso niente»

⚠️ **Il numero arriva dal database, non da un conto rifatto nella
schermata**: due posti che contano la stessa cosa divergono, e a divergere
sarebbe quello che si vede.

---

## 5 · Come è stata provata, e come è stata fatta fallire

La verifica dentro la migrazione costruisce **ingredienti propri** (regola
del 16/08: mai un ingrediente vero, o il FEFO prende dal lotto sbagliato) e
una ricetta che rende **100 porzioni**, così il millesimo nasce da una
**divisione** e non da un numero scritto piccolo apposta. Poi:

1. **controlla che il caso si sia formato** — `round(pizzico, 4) = 0` e
   `round(normale, 4) > 0`. Senza questo controllo il blocco passerebbe
   verde senza provare niente (regola del caso vuoto), e **ha discriminato
   davvero**: la prima esecuzione si è fermata lì, perché la riga non era
   marcata come inviata in cucina e il fabbisogno era vuoto;
2. **la controprova**: prova a inserire a mano quella quantità e pretende il
   rifiuto `23514` — è ciò che dimostra che l'arrotondamento è un fatto e
   non un sospetto;
3. **lo scarico**: nessuna anomalia di errore, il pesce sceso di 0,0500 kg,
   **nessuna riga** per il pizzico, **il lotto del pizzico fermo**, il conto
   che risulta scaricato;
4. **l'indipendenza**: un guardiano temporaneo fa fallire **un solo**
   ingrediente, e si pretende che gli altri scendano lo stesso, che quello
   guasto sia dichiarato col suo nome, e che il conto risulti scaricato;
5. **l'elenco lo dice**: `altri_scesi` maggiore di zero su quel conto.

### Le due rotture, fatte e non promesse

| cosa ho rotto | cosa è diventato rosso |
|---|---|
| rimesso `if v_tolto > 0` al posto della soglia | *«Il pizzico fa ancora fallire lo scarico: 1 anomalie di errore»* |
| tolto il blocco per-ingrediente (`raise` invece di proseguire) | *«Un guasto su un ingrediente si è portato via lo scarico degli altri: il pesce vale NULL»* |

Poi rimessa la versione buona: verifica verde, **zero residui** (nessun
ingrediente, ricetta o conto `ZZ verifica`, nessun trigger rimasto spento,
nessuna lapide in più nel registro delle cancellazioni).

### E una prova automatica che sorveglia dall'app

`tests/app/scarico-magazzino.test.js` ha ora un **ingrediente da pizzico**
nella ricetta: la stessa prova che dal 13/08 controlla che la giacenza
scenda diventa rossa in tre punti se la cura viene tolta. Serve perché la
verifica della migrazione gira **come proprietaria del database**, mentre
qui il conto lo chiude il ruolo vero della sala.

---

## 6 · 🔴 Un difetto trovato per strada, e non era del gestionale

Misurando lo stato di partenza è saltata fuori una contraddizione: **tutti e
346 i conti chiusi portavano il segno `magazzino_scaricato_il`**, compresi i
148 che non avevano tolto un grammo dalla cella. Leggendo il codice del
gestionale è impossibile: il rifiuto annulla anche quel segno.

Lo scriveva **il comando che costruisce lo scenario di collaudo**, che nel
ridatare i conti nei due mesi accendeva quella colonna su tutti.

⚠️ **Lo scenario nascondeva il difetto che doveva far vedere**, e l'unico
modo di accorgersene era **contare le righe di consumo invece di fidarsi del
segno**. Corretto: ora il segno si **sposta** dove c'è, non si accende dove
manca.

---

## 7 · La misura che dimostra che la cura ha funzionato

Lo scenario è stato **ricostruito da zero** con la cura applicata — non
rattoppato: i 148 conti vecchi non si possono riscaricare, ed è esattamente
il motivo per cui il vecchio patto era falso.

| | prima | dopo |
|---|---|---|
| conti chiusi | 346 | 346 |
| **senza nessuna riga di consumo** | **148 (43%)** | **0** |
| anomalie di tipo `errore` | **148** | **0** |
| costo della merce registrato | 5.986,20 € | **10.717,37 €** |
| food cost su **tutti** i conti | **9,3%** | **16,6%** |
| food cost sui soli conti che scaricano | 16,6% | 16,6% (sono tutti) |

🔴 **I due numeri si sono riuniti**, ed è la prova che la cura ha funzionato:
prima il gestionale ne diceva due — uno assurdo su tutti i conti e uno
normale sui conti sani — e la differenza *era* il difetto.

### E il 23% del mandato

Il mandato chiedeva: *«dopo la cura, il food cost dello scenario torna al
23%?»*. **Sì, con la definizione giusta**, e vale la pena scrivere quale:

| definizione | valore |
|---|---|
| costo merce ÷ **incasso totale** dei conti (coperti e bevande compresi) | 16,6% |
| costo merce ÷ **ricavo del solo cibo** (le righe con una ricetta) | **22,9%** |

⚠️ Le bevande valgono 11.279 € di ricavo e **zero** di costo registrato — il
magazzino non le segue (blocco 2) — quindi mescolarle abbassa il rapporto
senza che nessun piatto costi meno. *Il numero da guardare per decidere i
prezzi del menu è il secondo.*

---

## 8 · Cosa abbiamo rovesciato

**Cosa era stato deciso e quando** — 13/08/2026, migrazione
`20260813000013`: lo scarico di un conto è **tutto o niente**. Se qualcosa va
storto si annulla l'intero blocco, «il conto resta chiuso e non segnato come
scaricato — così si potrà riprovare».

**La ragione di allora** — una giacenza scesa a metà è una giacenza sbagliata
che ha l'aria di essere giusta; meglio non toccarla e rifare tutto dopo.

**Cosa si decide adesso** — scende quello che si può, e ciò che non scende è
dichiarato ingrediente per ingrediente, col conto e con la frase che dice se
il resto è sceso.

**Perché la ragione di allora non vale più** — perché poggiava su una
seconda metà che **non esisteva**: nessuna schermata, nessun pulsante,
nessun lavoro notturno può richiamare lo scarico di un conto chiuso. Il
«tutto o niente» non era «niente adesso e tutto dopo»: era **niente e
basta**, per sempre, su 4 conti su 10. ⚠️ La ragione del 13/08 resterebbe
valida il giorno in cui esistesse un modo di riprovare — e quel giorno la
scelta andrà riguardata, non ereditata.

Registrato anche in [`docs/decisioni_rovesciate.md`](../decisioni_rovesciate.md).

---

## ⚠️ Cosa NON è verificato

1. 🔴 **Niente in produzione.** La migrazione è solo sul progetto di prova.
   In produzione il difetto **non può ancora mordere** (il Ricettario vero è
   vuoto), ma morderà **il giorno in cui Alessio scriverà la prima ricetta
   con una spezia dentro**.
2. ⚠️ **Nessuna mano ha guardato la schermata** con le frasi nuove: il
   riquadro «Cosa non è sceso» è stato letto nel codice e nei dati, non
   aperto.
3. ⚠️ **L'allarme su Telegram non è stato fatto suonare.** Ora parte anche
   per uno scarico *parziale* (prima solo per il guasto totale), con lo
   stesso freno di un avviso all'ora. Provato che non fa fallire la
   chiusura, mai visto arrivare.
4. ⚠️ **Le spezie continuano a non scendere mai**, ed è il blocco 2: la
   cannella comprata resta comprata. Da oggi in silenzio invece che
   rumorosamente — che è il motivo per cui il blocco 2 viene subito dopo.
5. 🔴 **E l'elenco delle voci libere è PEGGIORATO, per costruzione**: da
   1.033 righe a **1.840**. Non è un difetto nuovo — prima i 148 conti che
   fallivano non arrivavano nemmeno a dichiarare le proprie bevande, perché
   l'annullamento si portava via anche quelle. Ora che scaricano, le
   dichiarano tutte. *La cura ha reso visibile il rumore che il difetto
   nascondeva*, ed è esattamente il blocco 2.
5. ⚠️ **`record_stock_consumption`** (lo scarico a mano) riceve la quantità
   da chi chiama e non è stata toccata: lì un numero sotto il decimo di
   grammo dà ancora un errore, ma è un numero digitato da una persona, non
   il risultato di una divisione.
