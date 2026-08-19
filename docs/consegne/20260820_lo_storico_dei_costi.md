# Lo storico dei costi — blocco 3, e il mandato dei finger food è chiuso

**Migrazione**: `20260820000003_lo_storico_dei_costi.sql`
— applicata sul progetto di prova, **NON ancora in produzione**.
**Mandato**: [`20260819_i_finger_food_e_lo_storico_dei_costi.md`](../mandati/20260819_i_finger_food_e_lo_storico_dei_costi.md).
Con questo i **tre blocchi sono chiusi**.

---

## ⚠️ Cosa NON è verificato

1. 🔴 **Nessuna mano ha visto il riquadro «Com'è cambiato»**, e nessuna prova
   di questo progetto guarda una schermata.
2. 🔴 **Il Ricettario vero è vuoto** (0 ricette): il registro non ha mai
   incontrato un dato di Alessio, e la misura della condizione (b) è fatta su
   un albero **costruito da me** sul progetto di prova — realistico, ma non
   suo.
3. ⚠️ **Nessuna fattura vera è mai stata caricata con questi trigger accesi**:
   il tempo che ci mette una fattura da venti righe non è stato misurato, solo
   il numero di righe che scriverebbe.
4. ⚠️ **Il registro non si può ripulire da nessuno**, ed è voluto — ma vuol
   dire che le voci scritte durante il collaudo resteranno lì.
5. ⚠️ **`ingredients.current_price` resta `not null default 0`**: il registro
   *dichiara* quando un costo è parziale, ma il food cost mostrato altrove nel
   gestionale continua a contare a zero un ingrediente mai comprato. Vedi
   sotto — è una decisione di Alessio, non mia.

---

## Cosa abbiamo rovesciato

**Nessun rovesciamento.**

---

## 🔴 La misura della condizione (b), fatta PRIMA di scegliere

Il mandato chiedeva: *«se la misura dice che una fattura normale scriverebbe
migliaia di righe, fermati e dillo»*.

Il Ricettario vero è vuoto, quindi ho costruito sul progetto di prova un
albero della **profondità che Alessio descrive** (*«scompone sempre»*:
ingrediente → preparazione → preparazione → finger → selezione) e della
**taglia che ha annunciato** (*«decine di ricette»*): 60 ingredienti, 20
preparazioni su due livelli, 40 piatti, 12 finger, 4 selezioni = **76
ricette**. Poi ho cambiato 20 prezzi, cioè una fattura da venti righe. Tutto
dentro una transazione finita in `rollback`: non è rimasto niente.

| | |
|---|---|
| ricette il cui costo cambia | **51 su 76** |
| coppie (ricetta, ingrediente cambiato) | **233** |
| se cambiassero tutti e 60 i prezzi insieme | **76 su 76** |

✅ **Niente migliaia di righe, e il disegno non cambia.** Il ventaglio è
limitato dal **numero di ricette**, non dal prodotto delle due cose: con due
fatture a settimana si sta sotto le 25.000 voci l'anno nel caso peggiore.

⚠️ **Ma la misura ha deciso la grana**: una voce per **(ricetta, causa)**, non
una per ricetta per fattura. Costa 4,5 volte tanto ed è il numero giusto,
perché **ogni voce porta una sola ragione** — che è precisamente quello che
Alessio ha chiesto: sapere *perché* un piatto costa di più, non solo che costa
di più.

⚠️ **E una conseguenza che vale la pena sapere**: una fattura normale tocca il
**67%** del Ricettario. Non è un problema, ma spiega perché il registro
crescerà in fretta e perché «solo i cambiamenti veri» non è una rifinitura.

---

## 🔴 Le strade sono SEI, non quattro

Il mandato ne nominava quattro — prezzo, composizione, quantità, scarto.
Guardando **il calcolo del costo** invece dell'elenco, ne sono uscite altre
due:

| strada | cosa muove |
|---|---|
| **la resa** di una preparazione | il costo del componente si divide per la resa: cambiarla cambia il costo di **tutto ciò che la usa**, e non della preparazione stessa |
| **le porzioni** | non cambiano il costo della ricetta base, cambiano il **costo per porzione** — cioè il numero con cui Alessio decide i prezzi del menu |

⚠️ **Coprendone quattro, il registro avrebbe avuto due buchi silenziosi
esattamente della forma che questo blocco esiste per evitare.** E nessuno se
ne sarebbe accorto da un errore: il registro sarebbe sembrato completo.

⚠️ Ce n'è anche una settima piccola, coperta nello stesso ramo: marcare una
riga **«opzionale»** la toglie dal costo. È composizione a tutti gli effetti.

---

## 🔴 Il difetto trovato applicando, che nessuna rilettura avrebbe visto

La regola «scrivi solo se è cambiato» ha bisogno di sapere **qual è l'ultima
voce**. La cercavo ordinando per ora e poi per identificativo.

**Misurato**: dentro una transazione `now()` **non avanza**
(`clock_timestamp()` sì). E il carico di una fattura **è una transazione
sola**: tutte le voci di quella fattura avrebbero avuto la **stessa ora**, e
l'identificativo è un numero **casuale** — quindi «l'ultima voce» ne sarebbe
stata scelta una a caso, e la regola avrebbe **scritto o saltato a caso**.

Curato con un **progressivo** che cresce da sé, e con `clock_timestamp()` al
posto di `now()`: due voci della stessa fattura sono due fatti in due momenti,
non uno.

⚠️ **È la trappola già scritta in CLAUDE.md §8 il 16/08** — *«una riga appena
scritta si riconosce dalla sua firma, non dalla sua posizione in un
ordinamento temporale»* — ricomparsa in un posto nuovo. *Una trappola scritta
non è una trappola chiusa.*

---

## 🔴 E un secondo orologio, trovato da una prova diventata rossa

La prova «il costo di prima resta quello di prima» chiedeva *«quanto costava
a questo istante»* passando `new Date()` — **l'orologio del browser**. È
diventata rossa dicendo **12,00 invece di 18,00**: i due orologi non sono lo
stesso orologio, e bastano pochi millisecondi di scarto perché il confronto
scelga la voce di prima.

⚠️ **La regola generale**: *un istante si chiede al database, come un numero.*
Scritta accanto alla funzione che legge, perché è lì che qualcuno rifarà lo
stesso gesto.

---

## 🔴 Zero non vuol dire gratis, e oggi il gestionale non lo distingue

`ingredients.current_price` è **`not null default 0`**: un ingrediente
inserito a mano e mai comprato **vale zero**, e abbassa in silenzio il food
cost di ogni ricetta che lo usa.

⚠️ **Non l'ho toccato**: cambiare quella colonna è una decisione che riguarda
tutto il gestionale, e la prende Alessio. Ma **il registro lo dichiara**: ogni
voce porta quante righe erano senza prezzo, e la schermata scrive «parziale:
N ingredienti senza prezzo» invece di mostrare un numero che sembra un costo.

✅ **Misurato in produzione il 20/08: 0 ingredienti su 8 sono a zero** — il
difetto è **armato e non ancora vivo**. Lo diventa il primo giorno che Alessio
scrive un ingrediente a mano senza comprarlo.

---

## Le prove, e le sei rotture

**Otto controlli dentro la migrazione** (la catena a quattro livelli, il
salvataggio a vuoto, il costo di ieri, resa, porzioni, costo parziale, «tolto»,
scarto) e **7 prove col token di un utente vero** — 152 pure + **236**
sull'app in tutto.

🔴 **La rottura chiesta dal mandato, fatta su TUTTE e sei le strade una per
volta.** Ognuna è diventata rossa, e con un messaggio diverso:

| strada tolta | cosa è diventato rosso |
|---|---|
| prezzo | *«Il rincaro dell'ingrediente non è arrivato in cima alla catena (costo fermo a 12,0000)»* |
| composizione (tolto) | *«La voce della cancellazione non dice cosa è stato tolto»* |
| quantità | *«Il costo di adesso è 18,0000 invece di 9,0000»* |
| scarto | *«Cambiare lo scarto non ha scritto niente, e il costo è cambiato»* |
| resa | *«Cambiare la resa di una preparazione non ha scritto niente sulla selezione che la usa»* |
| porzioni | *«Cambiare le porzioni non ha scritto niente»* |

⚠️ **E i numeri delle prove sono scelti per distinguere**: la selezione porta
**sei** bocconcini, non due. Con due, una catena che perde un livello e un
moltiplicatore ignorato darebbero **lo stesso numero** della risposta giusta;
con sei si separano — 12,00 contro 2,00 contro 4,00. È la lezione del 19/08.

⚠️ **E la prova «non succede niente» c'è**: salvare una composizione senza
cambiare nulla **non scrive nessuna voce**. È quella che distingue «registra i
cambiamenti» da «registra i salvataggi» — senza, il registro si riempirebbe di
righe identiche e la domanda «quanto costava a ottobre» affogherebbe.

---

## Dove si legge

Nella scheda della ricetta, sotto il costo: **«Com'è cambiato»**, che compare
**solo se c'è una storia da raccontare** — una ricetta appena nata non ne ha,
e un riquadro vuoto sarebbe ingombro su una schermata che si usa a lungo.
Ogni riga porta la ragione in parole («È salita la melanzana: 2,00 € → 3,00 €
al kg»), la data e il costo di allora.

⚠️ **Solo il titolare**: dentro ci sono i costi. Una prova controlla che lo
staff riceva **un rifiuto**, non un elenco vuoto — una schermata vuota è una
rassicurazione falsa.

⚠️ **Il registro non ha nessuna policy di scrittura, per nessuno**: le voci le
scrivono solo i trigger. *Un registro che qualcuno può riscrivere non è un
registro.*

---

## Per Alessio, in una riga

Da adesso, ogni volta che il costo di una ricetta cambia davvero il gestionale
se lo segna con la ragione — «è salita la melanzana», «tolta la crocchetta» —
e sulla scheda del piatto puoi vedere quanto costava prima.

---

**Migrazione**: `20260820000003` — sul progetto di prova sì, in produzione
**no**, in attesa del `git push`.
