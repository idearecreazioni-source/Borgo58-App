# La regola della stima, e un lavoro riportato indietro

**31/08/2026, tardo pomeriggio.** Riepilogo per il validatore.

* **HEAD dichiarato**: `a23270e17f115f15f37a827f99dc2e0d834b07d1` — il commit che sta sotto questo file.
* **Nessuna migrazione nuova.** Il repository, il progetto di prova e la
  produzione sono tutti e tre a **367**, ultima `20260831000011`.

---

## Cosa abbiamo rovesciato

**Niente.**

---

## 1 · La migrazione del menu è in produzione

**Letto dalla produzione, non dedotto:**

| | |
|---|---|
| migrazioni | **367** |
| ultima | **`20260831000011`** |

---

## 2 · La regola nuova: la stima, e il confronto che la tiene onesta

Scritta in [`DECISIONI.md`](../DECISIONI.md), in una sezione sua **prima**
di «Come si usa», perché vale su ogni mandato e non solo su quello in cui è
nata.

* **Quando**: subito dopo il blocco 0 — *appena si è misurato lo stato e
  verificate le premesse*, mai prima. Una stima fatta senza aver misurato non
  è una stima: è una rassicurazione.
* **Cosa**: quanto ci vuole per il **mandato intero**.
* **E poi il confronto**, come riga di chiusura: stimato · effettivo ·
  differenza.

⚠️ **Il confronto è la regola, non un di più**: senza, sbagliare la stima non
costa niente e la volta dopo si sbaglia uguale. È la stessa forma per cui in
questo progetto un conteggio scritto a mano invecchia finché nessuno lo
rimisura. E **la differenza si scrive anche quando è brutta**: una stima
sbagliata del doppio, dichiarata, insegna qualcosa; una aggiustata dopo, no.

---

## 3 · 🔴 L'etichetta «investimento»: cominciata e RIPORTATA INDIETRO

Alessio ha chiesto di fermarsi al primo punto pulito. L'etichetta era
**cominciata**, quindi è stata riportata com'era.

**Cosa c'era arrivato a essere, prima di tornare indietro:**
* la migrazione `20260831000012` — scritta per intero, applicata al **solo**
  progetto di prova e **provata con due rotture** su controlli diversi (un
  entrata marcata come investimento; il totale che somma i soggetti invece di
  dividerli);
* le due funzioni di lettura nell'api del client;
* la casella nella Prima nota — **questa no**: lo script si è fermato, ed è il
  pezzo che rendeva il lavoro «a metà».

**Cosa è stato riportato indietro, e misurato dopo:**

| | |
|---|---|
| file della migrazione nel repository | **tolto** |
| colonna `e_investimento` sulla prova | **0** |
| funzioni `investimenti*` sulla prova | **0** |
| migrazioni registrate sulla prova | **367** — uguale al repository |
| in **produzione**: colonna e funzioni | **0 e 0** — non c'era mai arrivato niente |
| rotture lasciate in piedi | **nessuna** — le due erano già state rimesse e riverificate prima di fermarmi |

⚠️ **E l'api è stata tolta apposta, non dimenticata**: due funzioni di
lettura che nessuna schermata chiama sarebbero state **esattamente il difetto
che questa giornata ha passato a curare** — *costruito e senza una porta*. La
rete di stamattina le avrebbe nominate al primo giro.

⚠️ **Quello che resta del lavoro non è niente**, ed è voluto: il disegno era
in testa e nei due riepiloghi di oggi, non nel codice. Chi riprende riparte
dalla decisione, non da un mezzo lavoro da capire.

---

## 4 · Le risposte di Alessio, registrate

* Il collegamento «Quanto ce n'è davvero?» **resta com'è**: lo prova lui col
  dito e decide.
* Le porte del Magazzino **continuano a contare i prodotti**, non le
  categorie. Va bene così.
* Si riparte **dall'etichetta «investimento»**.

---

## COME LASCIO LE COSE

* **Working tree**: pulito, tutto committato.
* **Migrazioni**: repository **367** · prova **367** · produzione **367**.
  **Nessuna in attesa di applicazione.**
* **Push**: resta da fare — è il comando in fondo.
* **Server accesi da me**: uno solo, il gestionale puntato al **progetto di
  prova** sulla porta **5199**. ⚠️ Quello sulla **5173** non l'ho acceso io ed
  è di Alessio: non l'ho toccato, come vuole la regola. Spegnendo il computer
  spariscono tutti e due.
* **Dati lasciati in giro**: sul progetto di prova resta **un conto chiuso di
  collaudo** (T5 · T6, marcato «fattura promessa»), creato stanotte per
  provare la spunta della fattura. **Non si può cancellare**: un vincolo lo
  impedisce — *«un conto già chiuso non si tocca»* — ed è la stessa guardia
  che protegge i soldi veri. Sparirà col reset prima dell'apertura.
* **In produzione non ho lasciato niente**: zero movimenti, zero conti, zero
  ingredienti, zero lapidi nuove.

---

## COSA DEVE SAPERE CHI RIPRENDE

Potrebbe non essere questa sessione, quindi qui c'è tutto quello che serve.

1. **Si riparte dall'etichetta «investimento»**, e la decisione è scritta per
   intero nel [riepilogo di stanotte](20260831_i_sette_mondi_e_le_schermate_cieche.md)
   e nel mandato: **un'ETICHETTA su un'uscita di cassa**, non una sezione
   separata — una sezione creerebbe due verità sulla stessa spesa e andrebbe
   smontata dopo l'apertura, un'etichetta si smette solo di usare. La
   schermata è una **vista**: quanto ha messo, in cosa, con quali soldi.
   ⚠️ **Serve fino a marzo 2027 e poi decade**: non costruirci intorno niente
   di permanente.
2. **Misurato oggi, utile a chi ricomincia**: `cash_movements` ha 26 colonne e
   **nessuna** per le etichette; `tag_anticipazioni` esiste ma è **un'altra
   cosa** — sono le etichette delle spese che la società *rimborsa*, e un
   investimento non è un rimborso. Attaccarlo lì darebbe due significati alla
   stessa tabella.
3. **«In cosa» e «con quali soldi» non vogliono campi nuovi**: la causale e la
   nota dicono già in cosa; il mezzo e il soggetto dicono già con quali soldi.
4. **Il totale va diviso per soggetto**, non sommato: un investimento dalla
   **tasca** e uno da **Borgo 58** sono due fatti diversi, e un numero solo
   direbbe quanto è costato aprire **nascondendo chi l'ha pagato**.
5. **La rete nuova di stamattina** (`tests/app/funzioni-senza-schermata.test.js`)
   diventa rossa se si costruisce una funzione senza una schermata che ci
   arrivi. Chi riprende la troverà sulla sua strada, ed è voluto.
6. **Restano non aperti**: la chiusura dell'anno fiscale, il pacchetto per la
   commercialista (aspetta le risposte di Laura), la coda di
   [`RICHIESTE.md`](../RICHIESTE.md).

---

## RILETTURA

### Schermate aperte e guardate
**Nessuna.** Questa consegna scrive una regola in un documento e riporta
indietro un lavoro: non tocca nessuna schermata.

### Cosa ho contato senza leggerlo
Niente: i tre conteggi delle migrazioni e lo stato dell'investimento sono
letti dai due database con una query.

### Mie affermazioni diventate false mentre lavoravo
**Nessuna**, ma una **stima** è diventata inutile a metà: avevo stimato
un'ora e quaranta per il mandato intero, e il mandato è stato interrotto.

### Blocchi non aperti
L'etichetta «investimento» — cominciata e riportata indietro. Più quelli di
stanotte mai aperti: chiusura dell'anno fiscale, pacchetto per la
commercialista, coda delle richieste.

### Conteggi che sono pavimenti
Nessuno.

---

## 🔴 Stimato · effettivo · differenza

**Stimato: 1h 40m** (dato alle 15:16, dopo il blocco 0, per il mandato
intero: regola 5′ · migrazione 25′ · schermata 25′ · guardarla 15′ · prove,
riepilogo e commit 30′).

**Effettivo: 30 minuti** — dalle 15:12 alle 15:42.

**Differenza: −1h 10m, e NON è una stima azzeccata: è un mandato
interrotto.** Di quello che avevo stimato ho fatto la regola (5′ stimati) e
la migrazione (25′ stimati), poi Alessio mi ha fermato e la migrazione è
stata **riportata indietro** — quindi dei 30 minuti spesi, **25 non hanno
lasciato niente**.

⚠️ **La stima non è verificata da questo confronto**, ed è la cosa onesta da
scrivere: sui due pezzi che ho toccato ero in linea (30′ stimati, ~28
spesi), ma i tre pezzi più incerti — la schermata, il guardarla, le prove —
**non sono stati messi alla prova**. Quelli erano il grosso del numero, e
restano da verificare la prossima volta.
