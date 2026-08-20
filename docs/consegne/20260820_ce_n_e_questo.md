# «Ce n'è questo» — l'allineamento del magazzino e il food cost reale

**20/08/2026** · Code → validatore · blocco B del mandato della serata

- **HEAD dichiarato**: `f572c3f680dd79e3c2dce40ba877f7344d3ae3aa`
- **Working tree**: pulito
- **Mandato**: [`docs/mandati/20260820_l_allineamento_del_magazzino.md`](../mandati/20260820_l_allineamento_del_magazzino.md) — **tutti e tre i blocchi**
- **Migrazione**: `20260820000010_ce_n_e_questo.sql` — **non applicata in
  produzione** (stasera non si tocca il database vero)
- **Corridoio**: `operazioni-atomiche` **v18 sul progetto di prova**, da
  installare in produzione (`allinea_giacenza` è un'operazione nuova)

---

## Cosa abbiamo rovesciato

**Niente.** Nessuna decisione presa prima è stata ribaltata.

Il riquadro c'è lo stesso anche quando è vuoto, per il precedente del
riepilogo del Magazzino: *un riquadro che compare solo nei guai fa dubitare,
quando manca, di non averlo visto.*

⚠️ Una cosa **si avvicina** a un rovesciamento e va dichiarata: il mandato
lasciava aperta la possibilità di allineare **dalla lista della spesa**, e
**non è stato fatto** — comprare si fa col telefono davanti al fornitore,
allineare si fa in dispensa. Il mandato chiedeva di dirlo se misurando fosse
saltata fuori una ragione forte per il contrario: **non è saltata**.

---

## La parola, prima di tutto

In Magazzino la colonna non si chiama più «Giacenza» ma **«Dovrebbe
esserci»**. Costa una riga e va fatta subito: *il giorno che lo si chiama
giacenza si smette di controllarlo*. È una stima presentata come dato — la
stessa famiglia della sala disegnata vuota e del manuale HACCP che stampava
«conforme».

---

## Il gesto: si scrive quanto c'è, non quanto togliere

`allinea_giacenza(prodotto, quanto_ce)`. La differenza la calcola il
database — *davanti allo scaffale non si fanno conti, e chiedere «quanto
togli» sposterebbe l'aritmetica su chi ha in mano il barattolo*.

- **niente causale**, decisione di Alessio contro la proposta del validatore:
  *le cause possono essere ignote, e un elenco che si riempie di «non so»
  produce righe che sembrano informazione e non lo sono*;
- **la fa chiunque**, anche dalla sala;
- il campo si apre **col numero che il gestionale dice**: chi deve solo
  confermare non riscrive niente;
- **scrivere lo stesso numero non registra niente** — distingue «registro le
  differenze» da «registro i salvataggi». Con la seconda, il trend si
  riempirebbe di zeri e la media direbbe che va tutto bene.

### 🔴 La misura chiesta dal mandato: da quale partita si toglie

Il mandato chiedeva di misurarlo su due partite a prezzi diversi e di
**dichiarare il numero**. Fatto:

| 2 kg a 2,00 € (scadono prima) + 10 kg a 5,00 €, ne mancano 3 | vale |
|---|---|
| **FEFO — quella che scade prima** ✅ | **9,00 €** |
| dalla più cara | 15,00 € |
| a un prezzo medio | 13,50 € |

**La differenza è del 67%**, quindi il mandato aveva ragione a chiedere che
fosse detta e non nascosta in una scelta di implementazione. Si usa **la
stessa regola FEFO dello scarico vero**, non una seconda.

### 🔴 La correzione in aumento — «è il caso che si dimentica sempre»

Uno scarico può solo **togliere** (`quantity > 0` è un vincolo), quindi
l'aumento non poteva starci: le correzioni vivono in una tabella loro
(`rettifiche_giacenza`) e la merce trovata entra come partita nuova.

⚠️ **A che costo entra, ed è una decisione**: all'**ultimo prezzo pagato**
(`ingredients.current_price`), che è la regola che il progetto ha già scelto
il 13/08 per il food cost. Non è un costo inventato: quasi sempre la merce in
più **è** quella che il gestionale aveva scaricato di troppo.

⚠️ E se non c'è né listino né partite, la correzione in aumento **si rifiuta
dicendo perché**: un costo inventato sporcherebbe proprio il numero che questo
mandato costruisce.

---

## 🔴 Un difetto vero, trovato dalla prova e non rileggendo

La prima versione prendeva il costo **«dell'ultima partita»**, ordinando per
data. **Un carico da fattura scrive tutte le sue partite in UNA transazione**,
quindi hanno lo stesso `received_at`: l'ordinamento ne sceglieva una **a
caso**, e il valore della merce trovata cambiava da un'esecuzione all'altra.

⚠️ **È la trappola del 16/08 — *dentro una transazione `now()` è un istante
solo* — alla terza ricomparsa**, e stavolta nel caso più normale che ci sia
(il carico da fattura). La cura non è stata un ordinamento più furbo: è stata
**usare la regola che il progetto aveva già deciso**, che vive in un posto
solo. *Una trappola scritta non è una trappola chiusa.*

---

## 🔴 E un secondo, dello stesso tipo: la somma moltiplicata

`da_allineare()` univa lotti e correzioni con due `left join`, e **la somma
delle partite veniva moltiplicata per il numero di correzioni**: un prodotto
con 6 kg e 12 correzioni ne dichiarava **72**.

⚠️ **Non dava nessun errore**: era un numero plausibile, **più alto del vero**,
esattamente sulla schermata che serve a correggere i numeri più alti del vero.
Trovato da una prova, non leggendo.

---

## I due numeri del food cost

🔴 **Restano distinti e riconoscibili, mai fusi in uno «aggiornato»**: lo
**stimato** è quello con cui Alessio decide i prezzi del menu, il **reale** è
quello che sta vivendo. *Fusi, i prezzi si farebbero su un numero che si muove
da sé.*

- lo stimato **non si ricalcola dalle ricette di oggi**: viene dal costo
  **fotografato** al momento di ogni scarico. Le ricette cambiano, e un
  confronto fra il consuntivo di marzo e le ricette di agosto non è uno
  scostamento — sono due cose diverse messe accanto;
- la percentuale è **vuota**, non zero, quando non ci sono piatti venduti: uno
  zero si legge «in linea col piano»;
- **l'avvertenza esce dal database insieme ai numeri**, come per
  `calcola_imposte()`.

⚠️ **Il food cost è titolare-only, e si RIFIUTA invece di tornare vuoto**: la
correzione la fa tutta la sala (decisione di Alessio), ma *quanto è costata*
è un dato economico (§3.5). Una schermata vuota è una rassicurazione falsa.

---

## Le due reti del progetto che hanno fatto il loro lavoro

Non le ho invocate io: sono diventate rosse da sole mentre finivo.

1. **Il Contratto B4** — `allinea_giacenza` scrive **due tabelle** (la
   correzione e le partite), quindi **deve passare dal corridoio**. A metà
   resterebbe una partita scaricata che nessuna correzione spiega, o una
   correzione che non ha tolto niente: *nessuna delle due sembrerebbe
   sbagliata guardando la schermata*.
2. **L'elenco delle funzioni senza portiere** — è salito, e la misura ha
   corretto la mia previsione: sono **18**, non 19. `allinea_giacenza` un
   portiere ce l'ha (pretende un accesso) e la rete lo riconosce; l'unica
   davvero aperta è `da_allineare`, dichiarata per nome.

---

## Le prove, e come sono state rese rosse

**Tre rotture, tre rossi col messaggio giusto:**

| rottura | cosa è diventato rosso |
|---|---|
| il food cost reale ignora gli scostamenti | *«lo scostamento è passato da 0 a 0: la rettifica da 20,00 non è entrata»* |
| si toglie dalla partita più cara invece che da quella che scade prima | *«vale −15,00 invece di −9,00»* |
| (la prima volta) — | 🔴 **niente**, vedi sotto |

🔴 **E la prima rottura è la cosa più istruttiva della consegna.** Fatta come
il mandato chiedeva — *«fai calcolare il food cost reale ignorando gli
scostamenti»* — **nessuna prova è diventata rossa**. La mia verifica diceva
solo «lo scostamento non è vuoto», e con la rottura valeva `0`, che non è
vuoto. *Non misurava niente.* Riscritta per misurare una **differenza che la
verifica produce lei**: legge, fa una rettifica di valore noto, rilegge, e
pretende il numero esatto — più che lo stimato **non si muova** e che i due
numeri **siano diversi**.

### 🔴 E ho riprodotto, un'ora dopo averlo chiuso, il difetto del blocco A

`rettifiche_giacenza` ha **solo le policy di lettura e scrittura**, non quella
di cancellazione — voluto: *una correzione è un fatto avvenuto*. Prezzo: dal
client quelle righe non si tolgono, e con un vincolo `restrict` trattengono
l'ingrediente. **La prova non riusciva a ripulirsi**, esattamente come
`scarico-magazzino` che avevo appena sistemato.

⚠️ **La cura non è stata aprire la policy** — *una prova che allarga un
permesso per potersi ripulire è il primo passo verso una che lo lascia
aperto*. Ci si è girati attorno: l'ingrediente si riusa, i lotti si rifanno.

**Otto prove sui dati veri**, che entrano dal collegamento dell'app e passano
dal corridoio. Una di loro esiste solo lì: *in sala si corregge, ma il food
cost non si vede* — dentro una migrazione tutto gira come proprietario e un
difetto di permessi non si vedrebbe mai (lezione del 16/08).

---

## I numeri

| | |
|---|---|
| prove pure | **168 passate**, 0 saltate |
| prove sui dati veri | **281 passate**, **0 saltate** |
| lint | zero avvisi |
| migrazioni sul progetto di prova | **160** |
| migrazioni in produzione | **158**, invariate |

---

## Cosa NON è verificato

- 🔴 **Nessuna mano ha visto la schermata.** Non c'è ambiente DOM per le prove
  (vedi il riepilogo del blocco A): l'elenco che si apre sui prodotti in
  esaurimento, il campo che si apre col numero già dentro, il trend che si
  apre invece di comparire — **non li ha guardati nessuno**.
- 🔴 **Il food cost reale non ha ancora niente di vero da dire**: il Ricettario
  è vuoto, quindi `stock_consumptions` con un conto dietro è a zero. Il numero
  «stimato» resterà 0,00 finché non ci saranno ricette e conti veri. *Le prove
  misurano che i due numeri si muovono in modo diverso, non che siano giusti
  su dati veri — perché dati veri non ce ne sono.*
- **La migrazione non è in produzione** e il corridoio v18 nemmeno: senza,
  il pulsante «È questo» risponde 404.

---

## DA CONFERMARE AD ALESSIO

1. **A che prezzo entra la merce trovata in più.** Ho scelto l'**ultimo prezzo
   pagato**, perché è già la regola del progetto dal 13/08 e perché quella
   merce quasi sempre *è* quella scaricata di troppo. *Se va bene*: niente da
   fare. *Se preferissi il costo della partita da cui era stata tolta*, si può
   fare ma serve sapere quale — e in una correzione a mano quel legame non
   c'è.
2. **Il periodo che il trend guarda quando si apre.** Ho messo **dal primo del
   mese a oggi**, che è il taglio già usato in Cassa. *Se preferisci* un altro
   periodo di partenza (ultimi 30 giorni, ultima settimana) è un numero solo
   da cambiare.
