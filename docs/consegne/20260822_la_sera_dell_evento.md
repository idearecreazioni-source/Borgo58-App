# La sera dell'evento — il magazzino scarica le porzioni concordate

**Mandato**: blocco 5 dei preventivi, l'ultimo
([`20260820_i_preventivi_per_gli_eventi.md`](../mandati/20260820_i_preventivi_per_gli_eventi.md),
decisione n. 2).
**Migrazione**: `20260822000001_la_sera_dell_evento.sql` — **applicata al solo
progetto di prova**, non in produzione: aspetta il push.

---

## 1 · La misura, prima di costruire

### a) Il legame arriva fino al conto? — **sì, e non ne mancava nessun anello**

```
preventivo  --reservation_id-->  prenotazione  <--reservation_id--  conto
```

- `preventivi.reservation_id` lo scrive **`accetta_preventivo`** (blocco 4,
  20/08): se il preventivo è una versione di uno già accettato, **riusa la
  prenotazione dell'antenato** invece di crearne una seconda;
- `orders.reservation_id` esiste dal **giro D1 del 18/08** — nato per tutt'altro
  (far sapere al conto da quale prenotazione arriva) e qui serve intero.

⚠️ **Non ho costruito nessun legame nuovo**: il lavoro vero che il mandato
temeva non c'era.

### b) Dove sta la porzione modificata

`preventivo_righe.porzioni_per_persona`, `numeric not null default 1`, con
`check (porzioni_per_persona > 0)`. **È un moltiplicatore, non dei grammi**:
1 = come in carta, 0,5 = mezza porzione. Solo sulle righe `natura = 'cibo'`.

### c) Come funziona lo scarico, e dove prende le quantità

`scarica_magazzino_conto` **non calcola niente**: chiede tutto a
**`fabbisogno_conto(p_order_id)`**, che espande le ricette (preparazioni
comprese, scarto compreso) partendo da `oi.quantity` — cioè **le porzioni
della carta**. E scrive in `anomalie_scarico` due cose: le **voci libere**
(nessuna ricetta, non si inventa cosa togliere) e le **ricette incomplete**
(vuote, soli ingredienti facoltativi, o senza porzioni dichiarate).

🔴 **Quindi il punto da toccare era uno solo, e non è lo scarico**: è
`fabbisogno_conto`, l'unico posto dove si decide quanta materia prima serve.
Tutte le reti dello scarico restano intatte — non scarica due volte
(`magazzino_scaricato_il`), non tocca un conto annullato, dichiara le
anomalie. **Cambia da dove arrivano le quantità.**

⚠️ **E cambia anche la stima, non solo lo scarico**: la schermata del
fabbisogno e lo scarico vero sono la stessa funzione. Era già così, ed è il
motivo per cui il mandato diceva che «la strada esiste già».

---

## 2 · 🔴 Quale versione — e la prima stesura sbagliava

Il mandato chiedeva di verificarlo. **Verificato, e la prima versione del
codice prendeva quella sbagliata.**

Misurato leggendo `accetta_preventivo` viva: accettando una seconda versione,
**la prima resta `accettato`** — nessuno la retrocede. Quindi sulla stessa
prenotazione possono esserci **più preventivi accettati**, e «il preventivo
di questo evento» è ambiguo.

La prima stesura sceglieva **il più recente per `accettato_il`**. La verifica
l'ha bocciata:

```
ERROR: Lo scarico non segue l'ULTIMA versione: atteso 0,100 kg, trovato 0,200
```

🔴 **La causa è la trappola del 16/08, per la terza volta**: accettando le due
versioni **nella stessa transazione**, `now()` è un istante solo — le due date
pareggiano e l'ordinamento ne sceglie una a caso. Ha scelto la prima, cioè
esattamente il difetto che il mandato temeva: *«se trova la prima, è un
difetto che si vede solo mesi dopo, sul food cost»*.

⚠️ **La cura non è un ordinamento migliore, è una FIRMA**: l'ultima versione
accettata è **quella che non ha discendenti accettati** (`versione_di`). È una
proprietà della genealogia, non dell'orologio, e regge anche se due
accettazioni cadono nello stesso millesimo di secondo. La data resta solo
come ultima spiaggia, per il caso — che non dovrebbe esistere — di due catene
accettate sulla stessa prenotazione.

---

## 3 · Cosa cambia, in una riga

In `fabbisogno_conto`, le porzioni di una riga di conto diventano

```
oi.quantity × coalesce(porzioni concordate per quel piatto, 1)
```

⚠️ **`coalesce` a 1 e non a zero**, ed è una decisione: un piatto ordinato
quella sera ma **non previsto dal preventivo** si scarica come in carta — è
un fuori-menu, non un piatto da non scaricare. Con lo zero sparirebbe dal
magazzino senza che nessuno lo dicesse.

⚠️ **Se lo stesso piatto compare su più righe del preventivo le porzioni si
SOMMANO**: due righe da mezza porzione dello stesso piatto sono una porzione
intera. Prenderne una a caso darebbe un numero plausibile e sbagliato.

**La ricetta in carta non viene toccata da nessuna parte**: non c'è nessuna
scrittura su `recipes` né su `recipe_ingredients` in tutto il blocco.

---

## 4 · Le prove, e le due rotture

**Nella migrazione**, cinque controlli in fila su un evento costruito
chiamando le funzioni vere (`accetta_preventivo`, `scarica_magazzino_conto`):

1. il fabbisogno usa le porzioni **dell'evento**: **0,200 kg**, non 0,800;
2. **la ricetta in carta è intatta**: 0,100 kg per porzione, come prima —
   ⚠️ *due asserzioni, non una, come chiedeva il mandato*;
3. lo scarico vero fa scendere il lotto di **0,200**;
4. un **secondo scarico** non muove più niente;
5. accettata una **seconda versione** a 0,125, il fabbisogno la segue:
   **0,100**.

⚠️ **I numeri sono scelti perché DISTINGUANO** (lezione del 19/08): porzioni
**0,25** su **8 piatti** — in carta 0,800 kg, all'evento 0,200. Un fattore di
quattro: nessun errore di segno o di arrotondamento li fa coincidere. Con
porzioni 1 la verifica sarebbe passata **senza misurare niente**, e c'è un
controllo apposta che si ferma se i due numeri coincidono.

**Le due rotture, fatte e poi rimesse a posto:**

| cosa ho rotto | cosa è diventato rosso |
|---|---|
| il fabbisogno torna a usare le porzioni della **carta** | *«Le porzioni dell'evento non sono arrivate allo scarico: atteso 0,200, trovato 0,800»* |
| la versione si sceglie per **data** invece che per genealogia | *«Lo scarico non segue l'ULTIMA versione: atteso 0,100, trovato 0,200»* |

**Sui dati veri** (`tests/app/preventivi.test.js`), 2 prove nuove: né il
titolare né lo staff possono chiedere `porzioni_evento_del_conto` o
`fabbisogno_conto`. ⚠️ **Non è un doppione della migrazione**: quella gira
come proprietaria del database, dove i permessi non esistono (§8). Se un
domani qualcuno concedesse quelle funzioni, dal browser si leggerebbero **le
porzioni concordate di una trattativa**, e nessuna verifica dentro una
migrazione se ne accorgerebbe.

---

## 5 · Cosa ho guardato

Apparecchiato un evento vero sul progetto di prova e **chiuso il conto col
gesto vero** (`close_order_paid`, che è quello che parte dalla schermata):

- **matrimonio da 10 persone**, un piatto a **0,5 porzioni** concordate,
  ricetta in carta **0,2 kg** per porzione, 10 piatti ordinati;
- in carta sarebbero **2 kg**, all'evento **1 kg**;
- **il lotto è sceso da 20 a 19**: 1 kg, le porzioni dell'evento;
- `stock_consumptions` ha registrato **quantità 1, costo 3,00 €**.

**Poi ho aperto la schermata del Magazzino**, che è quello che il mandato
chiedeva di guardare:

```
Ingrediente               Dovrebbe esserci   Soglia minima   Scade prima
__PROVA__farina evento    19 kg              —               —
```

**19 kg** — se avesse scaricato le porzioni della carta direbbe 18. E la
ricetta in carta, riletta al momento della pulizia, era ancora **0,2 kg**.

**Ripulito**: evento, preventivo, prenotazione, conto, lotto, ricetta e
ingrediente. ⚠️ **Un residuo non si è tolto dall'app e va detto**: cancellato
il conto, la riga di `stock_consumptions` resta con `order_id` vuoto e **non
è cancellabile dal client** — quella tabella è titolare-only in lettura e
nessuno può toglierne righe. È il registro di ciò che è stato consumato, ed è
giusto così; l'ho tolta con lo strumento che applica le migrazioni.
Ricontrollato dopo: **0 ingredienti, 0 ricette, 0 preventivi, 0 conti** di
prova.

---

## ⚠️ Cosa NON è verificato

1. 🔴 **Nessun evento vero è mai passato di qui**: in produzione ci sono
   **0 preventivi** e 0 righe. Tutto quello che dico è misurato sul progetto
   di prova.
2. ⚠️ **La schermata del preventivo non è cambiata**, e non doveva: questo
   blocco tocca solo cosa succede la sera. Chi guarda un preventivo non vede
   nessuna differenza.
3. ⚠️ **Il caso «due catene accettate sulla stessa prenotazione» non è
   provato**: non dovrebbe potersi formare, e la genealogia lo gestirebbe
   solo per ultima spiaggia con la data. Se un domani `accetta_preventivo`
   cambiasse, quel ramo andrebbe guardato.
4. ⚠️ **Non ho toccato le anomalie**: un piatto dell'evento la cui ricetta è
   incompleta finisce in `anomalie_scarico` come prima. Le porzioni
   concordate non cambiano quel comportamento.

---

## Cosa abbiamo rovesciato

**Niente.** La decisione n. 2 del mandato viene **applicata**, non cambiata:
le porzioni modificate valgono solo per quell'evento e la ricetta in carta
resta intatta.

⚠️ **E una cosa che il mandato originale non diceva è stata decisa qui e va
dichiarata**: quale versione comanda quando il preventivo si corregge dopo
l'accettazione. La risposta — **l'ultima accettata** — non rovescia niente,
perché nessuno l'aveva mai scritta; ma è una scelta, e il difetto opposto
sarebbe stato invisibile per mesi.

---

## 6 · Cosa serve da Alessio

1. **Il push**, e poi applico la migrazione in produzione: crea una funzione
   nuova e ne riscrive una esistente, **non tocca nessun dato**.
2. Quando ci sarà un evento vero: guardare il magazzino la mattina dopo. È
   l'unica prova che il numero sceso è quello giusto **con dati suoi**.
