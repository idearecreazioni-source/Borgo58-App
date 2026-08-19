# Lista della spesa — blocco 2-ter: l'avviso di rincaro vale anche sulle spese

**Mandato**: [`20260817_la_lista_non_scrive_uscite.md`](../mandati/20260817_la_lista_non_scrive_uscite.md).
Ultima coda del blocco 2, dopo la risposta di Alessio del 19/08.
**Migrazione**: `20260819000005_il_rincaro_vale_anche_sulle_spese.sql` —
**applicata sul progetto di prova, NON in produzione**.

---

## ⚠️ Cosa NON è verificato

1. 🔴 **Nessun avviso è mai partito da questa strada.** Le prove guardano la
   **decisione** (`da_segnalare`), non l'invio — separati apposta dal 13/08,
   così una prova non fa suonare il telefono di Alessio. Che l'avviso parta
   davvero è controllato **leggendo il corpo** della funzione, non facendolo
   partire.
2. 🔴 **Nessuna mano ha visto il riquadro giallo** che compare nella
   schermata prima di confermare.
3. ⚠️ **Il freno anti-tempesta non è stato provato su questa strada**: due
   spese identiche a venti minuti di distanza produrrebbero **un solo**
   avviso, perché il tipo comprende il prezzo e il prezzo è lo stesso. È il
   comportamento voluto dal 13/08, ma qui non è stato esercitato.
4. ⚠️ **Il prezzo è ancora annegato dentro il tipo dell'allarme**
   (`tipo_allarme_rincaro`), che è il punto 3 della coda. Non è stato toccato:
   la strada per far scattare l'avviso sulle spese **non passa da lì**, e
   allargare il lavoro avrebbe mescolato due cose.

---

## Cosa abbiamo rovesciato

**Nessun rovesciamento.** Le due regole che si sarebbero potute rovesciare
restano in piedi entrambe, e la consegna è costruita per non toccarle:

- **il confronto per versione sulle fatture** (12/08): invariato;
- **il confronto prima della scrittura** (12/08): rispettato anche qui, e
  adesso c'è un controllo che lo pretende.

---

## 🔴 L'obiezione era mia, e Alessio l'ha smontata

Avevo sollevato che confrontare una spesa al mercato con un prezzo da fattura
avrebbe fatto suonare l'avviso su un salto che non è un rincaro, perché i due
numeri sono formati in modo diverso (uno pagato, uno imponibile).

**La sua risposta**, che è quella giusta:

> il confronto si fa sul prodotto e sul prezzo **al netto dell'IVA
> recuperabile**; un acquisto con IVA comporta sì un esborso momentaneo
> maggiore, **ma quell'IVA si recupera**.

Quindi i due numeri **sono** confrontabili — sono tutti e due il costo vero
per il locale — e quando una spesa senza documento risulta più cara, quella
differenza è **reale**, non un artificio della contabilità.

---

## Un confronto solo, con il gruppo come parametro

`variazione_prezzo_su(prodotto, versione, prezzo)` è adesso **l'unico posto**
dove si decide se un prezzo è un rincaro. Cambia solo **da dove prende le
righe con cui confrontare**:

| strada | gruppo di confronto | perché |
|---|---|---|
| **carico da fattura** | la **versione** del fornitore (`articoli_fornitore`) | decisione del 12/08: una cassa da 5 L e una bottiglia da 1 L non sono lo stesso acquisto, e metterle in fila farebbe gridare a ogni cambio di formato |
| **spesa dalla lista** | il **prodotto** | una spesa al mercato non ha nessuna dicitura di fornitore — parole di Alessio: *«il confronto si fa sul prodotto»* |

⚠️ **La vecchia `variazione_prezzo` non è stata cancellata**: la chiamano il
carico da fattura e la schermata della posta. È diventata un **guscio** che
delega, e **non contiene più nessuna regola** — se la regola cambia, cambia
in un posto solo.

⚠️ **La soglia, l'interruttore per prodotto e il «primo prezzo»** (il più
vecchio, non il minimo — 12/08) non sono stati toccati: sono passati di peso
nella funzione generale, e la verifica controlla che l'interruttore
`avvisa_rincari` valga anche su questa strada.

---

## Il confronto viene PRIMA della scrittura, e adesso c'è chi lo pretende

⚠️ Scrivendo il prezzo per primo, la funzione troverebbe **se stessa**: zero
rincari, sempre, e nessuna traccia dell'errore. È la trappola del 12/08.

**La verifica lo controlla leggendo il corpo della funzione** e confrontando
la posizione delle due chiamate: se il confronto finisse dopo la scrittura,
la migrazione si ferma. Non è un commento che chiede di ricordarsene.

---

## L'avviso si vede in due posti

Come per le fatture (12/08, decisione di Alessio):

- **nella schermata, prima di confermare** — un riquadro dice cosa si pagava
  prima, di quanto si sale adesso, e di quanto si è saliti *da quando compri
  quel prodotto*. Se il prezzo è sbagliato, ci si accorge **mentre non
  registrarlo è ancora gratis**;
- **su Telegram, dopo** — l'avviso vero.

⚠️ **Il prezzo di prima è un di più e non blocca niente**: se la lettura
fallisce, il riquadro non compare e la conferma funziona lo stesso.

---

## 🔴 Un difetto trovato dalla prova del regalo

Alla prima applicazione, chiudere una riga come **«me l'hanno regalato»**
falliva con un errore 500 dal corridoio: il controllo dell'avviso leggeva un
record che, su quella strada, **non era mai stato assegnato** — e in plpgsql
un record non assegnato non si può nemmeno interrogare.

⚠️ **L'ha preso la prova del regalo**, non una rilettura: il difetto stava
sul ramo che *non* fa la cosa nuova, che è il ramo che si guarda meno. Curato
con un flag assegnato sempre, invece di un campo letto a volte.

---

## Le prove, e la controprova

**2 prove nuove sui dati veri** (13 in tutto nel file), più 8 controlli dentro
la migrazione.

⚠️ **Le due prove sono una coppia, e la seconda è quella che conta**: la
prima verifica che una spesa al doppio faccia scattare l'avviso, la seconda
che una spesa **allo stesso prezzo lo faccia tacere**. *Un avviso che non sa
tacere non sta misurando niente.*

### La controprova — due rotture

| rottura | prove rosse |
|---|---|
| la decisione dice **sempre no** | **1** — quella del doppio |
| la decisione dice **sempre sì** | **1** — quella del silenzio |

⚠️ Sono le due metà della stessa regola, e ognuna rompe **solo** la sua: se
una rottura avesse reso rosse tutte e due, le prove non starebbero misurando
due cose diverse.

---

## Per Alessio, in una riga

Se al mercato paghi un prodotto più caro dell'ultima volta, adesso te lo dice
**mentre stai registrando** e ti arriva l'avviso su Telegram — come già
succede con le fatture.

---

**Commit**: dichiarato al momento del commit finale di questa consegna.
