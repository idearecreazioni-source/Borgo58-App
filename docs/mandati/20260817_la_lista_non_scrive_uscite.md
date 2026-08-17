# La lista della spesa non scrive mai un'uscita

**Impostazione decisa da Alessio il 17/08/2026**, dopo la misura che ha
trovato il buco (vedi [`20260817_la_rete_sui_vocabolari.md`](../consegne/20260817_la_rete_sui_vocabolari.md)
§4). Scritta subito perché non si perda: **il lavoro non va fatto adesso** —
prima le piccolezze del collaudo.

---

## Il principio

> **La lista non scrive mai un'uscita. Il costo nasce solo dal documento, o
> da una registrazione che Alessio fa esplicitamente.**

Da cui, subito e senza aspettare il resto: **la casella «come hai pagato» va
tolta da quella schermata**, perché oggi promette una cosa che non fa —
registra il mezzo e non ne consegue niente.

⚠️ **Togliere quella casella è la parte facile e va fatta col resto, non
prima**: da sola lascerebbe la schermata senza nessun modo di dire «l'ho
pagato», che è la via normale (vedi «il buco» in fondo).

---

## Come si chiude una riga

### 1. Arriva il documento — la riga si chiude da sé

Quando il carico da fattura abbina quell'ingrediente, la riga della lista si
chiude senza che nessuno la tocchi.

⚠️ **Ma non alla cieca sulle quantità.** Se in lista c'erano 20 kg di
pomodoro e la fattura ne porta 5, la riga **non deve sparire**: ce ne sono
ancora 15 da comprare. Si segnala come **arrivata in parte** e si **propone**
la chiusura, invece di deciderlo da soli.

*Nota di implementazione, non una decisione*: oggi `shopping_list_items` non
conserva quanto è arrivato — `close_shopping_list_item` riceve
`p_quantity_received` e lo usa solo per il lotto. Per dire «arrivata in
parte» serve tenerne traccia.

### 2. Chiusura a mano — tre esiti, e vanno tenuti distinti tutti e tre

| esito | cosa succede |
|---|---|
| **L'ho comprato e pagato** | Alessio scrive il costo, e quello diventa l'uscita in prima nota |
| **L'ho avuto gratis** (omaggio del fornitore, erba spontanea) | nessun costo — **ma la merce entra lo stesso** |
| **Non l'ho preso** | la riga sparisce e basta |

⚠️ **Il terzo sembra ovvio, ma confonderlo col secondo significa avere in
magazzino merce che non è mai arrivata.**

### Con che mezzo esce il denaro — deciso da Alessio il 17/08

**Contante di partenza.** Il caso normale è il mercato, e chiedere ogni volta
aggiungerebbe un gesto a un'operazione che ne ha già tre.

⚠️ **A una condizione, e non è una sfumatura**: il mezzo si **vede nel momento
della conferma** e si cambia lì. *Un predefinito che si vede è una comodità;
uno che riempie un campo che nessuno guarda è la famiglia dei 33 posti
silenziosi censiti il 17/08* — dove dimenticare un campo non dà errore, scrive
il predefinito, e sbaglia in silenzio. È esattamente così che si è perso il
`mezzo` delle mance.

---

## Due avvertenze sul caso «gratis»

⚠️ **Un ingrediente ricevuto in regalo non deve far scendere a zero il suo
prezzo.** Se quel carico entra a costo zero e il prezzo di listino si
aggiorna, tutte le ricette che lo usano avrebbero un food cost **falsato al
ribasso** — e da lì Alessio decide i prezzi del menu. *Il regalo vale zero
per quella volta, non per sempre.*

Tradotto in termini di schema, per chi lo costruirà: il **lotto** può nascere
con `unit_cost = 0` (quella partita è costata davvero zero, ed è giusto che
il food cost di ciò che si consuma da lì sia zero), ma **non si scrive niente
in `price_history` e non si tocca `ingredients.current_price`**. Sono due cose
diverse e finora nessuno le ha dovute distinguere.

⚠️ **L'erba spontanea ha già la sua strada**: il registro della raccolta
propria (`foraged_items`), che esiste per l'HACCP e conserva specie, data,
luogo, chi ha raccolto, metodo di identificazione e rischio di
contaminazione. Chiudere quella riga deve **portare lì**, non creare un carico
a costo zero — altrimenti la stessa cosa finisce registrata in due posti, che
è la famiglia di difetti che questo progetto passa il tempo a togliere.

---

## Il buco che questa impostazione lascia scoperto

⚠️ **La cassa.** Se Alessio paga 40 € in contanti al contadino e chiude la
riga senza scrivere niente, quei soldi sono usciti e nessuno li ha
registrati: la sera il conteggio del cassetto mostra un **ammanco di 40 €**, e
la differenza finisce in prima nota come rettifica di un errore che non
esiste.

**È lo stesso meccanismo delle mance su carta** (16/08): un movimento vero
che nessuna schermata registra, e un conteggio che poi accusa il cassetto.

Per questo il primo esito — «l'ho comprato e pagato» — **non è un di più: è
la via normale**, e chiudendo a mano va **proposta**, non imposta.

---

## Stato di partenza, misurato oggi

| | |
|---|---|
| Righe in lista in produzione | **2**, nessuna chiusa |
| Righe con un mezzo di pagamento scritto | **0** |
| Righe in `foraged_items` | **0** |

⚠️ **Nessun dato da preservare**: togliere la casella e la colonna non perde
niente di nessuno. Se la colonna `shopping_list_items.payment_method`
sparisce, sparisce anche un vocabolario che la rete del 17/08 sorveglia — va
tolta la dichiarazione di `PAYMENT_METHODS_SPESA` in
`src/lib/calcoli/vocabolari.js`, e la prova diventa rossa se qualcuno se ne
dimentica. È voluto.

## E cosa diventa possibile dopo

L'**unificazione del vocabolario dei mezzi di pagamento**, che il 17/08 è
stata rimandata proprio perché quella schermata non sapeva cosa farne. Con
l'esito «l'ho comprato e pagato» che scrive un'uscita vera — e quindi deve
sapere da dove escono i soldi, e con l'assegno anche quando — il vocabolario
può tornare uno solo, e la rete resta a sorvegliare che non si separi più.
