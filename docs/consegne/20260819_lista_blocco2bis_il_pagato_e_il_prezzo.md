# Lista della spesa — blocco 2-bis: quello che hai pagato diventa il prezzo

**Mandato**: [`20260817_la_lista_non_scrive_uscite.md`](../mandati/20260817_la_lista_non_scrive_uscite.md).
Coda del [blocco 2](20260819_lista_blocco2_i_tre_esiti.md), dopo le due
risposte di Alessio del 19/08.
**Migrazione**: `20260819000004_il_pagato_diventa_il_prezzo.sql` — **applicata
sul progetto di prova, NON in produzione**.

---

## ⚠️ Cosa NON è verificato

1. 🔴 **Nessuna mano ha toccato la schermata**, e adesso c'è un menu in più
   (la causale proposta). Nessuna prova di questo progetto guarda una
   schermata.
2. 🔴 **Il prezzo non è mai stato scritto da una spesa vera**: in produzione
   zero movimenti, zero righe chiuse. Le 26 righe di storico prezzi vengono
   tutte dalle fatture di collaudo del 12-13/08.
3. ⚠️ **Non c'è nessun ingrediente con uno storico misto** — un prezzo da
   fattura e uno da spesa — quindi nessuno ha ancora visto i due numeri uno
   accanto all'altro nella scheda del prodotto. È esattamente ciò di cui il
   commento nel codice avverte, e resta da guardare.
4. ⚠️ **La sorveglianza dei rincari non scatta su questa strada.** Il
   confronto dei prezzi (`variazione_prezzo`) lavora sulle *versioni* di un
   fornitore (`articoli_fornitore`), e una spesa al mercato non ne ha una:
   comprando il doppio del solito, **nessun avviso parte**. Non è una
   regressione — prima questa strada non scriveva affatto il prezzo — ma
   adesso che lo scrive, il buco è visibile.
5. ⚠️ **La causale proposta si cerca per nome** («Spesa alimentare»): se
   Alessio la rinomina, la proposta sparisce e il menu si apre su «Senza
   causale». È voluto — meglio nessuna proposta che una sbagliata — ma va
   saputo.

---

## Cosa abbiamo rovesciato

**Nessun rovesciamento.** La regola del mandato — *il regalo vale zero per
quella volta, non per sempre* — è intatta e adesso è provata da due lati: il
regalo non tocca né il listino né lo storico, l'acquisto sì.

---

## 🔴 La domanda che era stata posta era sbagliata, e l'ha detto Alessio

La validazione aveva rilevato che `ingredients.current_price` è dichiarato
«per unità, **IVA esclusa**» (30/07) mentre una spesa in contanti è un
importo **pagato**, e proponeva di **chiedere** se l'importo fosse con o
senza IVA. Alessio ha scartato la domanda, perché la risposta esiste già:

> «esistono solo due tipi di acquisti, con documento e senza. Quelli con
> documento deducono da esso se c'è l'IVA e a quanto ammonta; quelli senza,
> per forza di cose, non hanno IVA.»

Quindi la base del prezzo si **deriva dal tipo di acquisto**, non da una
domanda a chi sta comprando:

| acquisto | da dove viene il costo |
|---|---|
| **con documento** | imponibile e IVA dal documento — la strada del carico da fattura, invariata |
| **senza documento** | l'importo pagato **è** il costo, e non c'è niente da scorporare |

⚠️ **E da oggi in `current_price` convivono due numeri formati in modo
diverso** — un imponibile da fattura e un pagato al mercato — **ed è giusto
così**: tutti e due sono il costo vero per il locale. *Chi li «uniformasse»
scorporando un'IVA che non c'è mai stata abbasserebbe il food cost di circa
un quinto, in silenzio, su tutte le ricette che usano quel prodotto.*

**L'avvertenza è scritta accanto al codice**, non solo qui: è il genere di
cosa che fra sei mesi sembra una svista da correggere, e chi passa di lì deve
trovarla dove sta il dubbio.

---

## La prova che può fallire

40 € per 10 kg fanno **4,00 al chilo, tali e quali**. Con uno scorporo
dell'IVA al 22% verrebbero 3,28.

**Controprova fatta**: infilato lo scorporo nella funzione viva sul progetto
di prova → **una prova rossa**, quella giusta. Poi rimessa a posto.

Il controllo esiste in due posti che si rompono in modo diverso: dentro la
migrazione (con i numeri) e in `tests/app/tre-esiti-lista.test.js` (dal
client, attraverso il corridoio).

---

## 🔴 La trappola del 16/08 ha morso di nuovo — dentro la verifica

Il controllo che legge lo storico dei prezzi cercava «l'ultima riga» con
`order by recorded_at desc`. **Dentro una transazione `now()` è un istante
solo**, quindi le due righe scritte dalla stessa verifica hanno lo stesso
`recorded_at` e «l'ultima» la sceglie l'ordinamento a caso: al primo colpo
ha pescato quella sbagliata e la migrazione si è fermata.

⚠️ **È la stessa trappola del 16/08**, quella che allora aveva rischiato di
far cancellare la riga sbagliata a uno storno. *Una riga appena scritta si
riconosce dalla sua firma, non dalla sua posizione in un ordinamento
temporale.* Corretta cercando per prezzo.

⚠️ **E l'ha trovata la verifica stessa**, non una rilettura: è il terzo caso
in tre giorni in cui un controllo scritto male si scopre facendolo girare.

---

## La causale: proposta e visibile

«Spesa alimentare» viene **proposta** nel menu accanto al mezzo, e si cambia
lì. Condizione posta da Alessio — *che le causali restino gestibili dal
gestionale* — già soddisfatta: stanno in *Cassa → Causali*, e «Spesa
alimentare» è una sua causale d'uscita, non di sistema.

⚠️ **Proposta, mai scritta di nascosto.** La causale decide dove quel costo
finisce nei conti: nessun percorso rapido la scrive senza mostrarla.

⚠️ **Si cerca per nome, e se non c'è non se ne inventa nessuna**: le causali
sono dati suoi, e il giorno che la rinominasse è meglio nessuna proposta che
una scelta sbagliata fatta in silenzio.

---

## Una domanda che NON abbiamo risolto da soli

Nuovo quesito **L17** in [`docs/quesiti/QUESITI_CONSULENTI.md`](../quesiti/QUESITI_CONSULENTI.md):
*su quali acquisti l'IVA è davvero recuperabile, e quando non lo è, il costo
da usare per il food cost è l'importo pieno?*

⚠️ **Il caso è il terzo**, quello che le due strade non coprono: un acquisto
con **scontrino**. Lì l'IVA c'è scritta ma non si recupera, e seguendo il
documento il gestionale userebbe l'imponibile — **sottostimando il food
cost**.

⚠️ **Quanto è grande oggi, misurato e non stimato** (produzione, 19/08):

| | |
|---|---|
| fatture fornitori registrate | **0** |
| movimenti di prima nota | **0** |
| movimenti con scontrino | **0** |
| righe di storico prezzi | **26**, tutte dalle fatture di collaudo |

**È una possibilità teorica, non un problema vivo** — ed è il momento giusto
per deciderlo, perché ogni riga scritta prima della risposta è una riga da
rivedere dopo. **Fino alla risposta non si tocca niente.**

---

## Per Alessio, in una riga

Comprando 10 kg a 40 € al mercato, adesso il prodotto costa 4 €/kg anche nel
Ricettario — **il prezzo che hai pagato, senza toglierci nessuna IVA**,
perché senza documento l'IVA non c'è.

---

**Commit**: dichiarato al momento del commit finale di questa consegna.
