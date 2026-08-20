# L'allineamento del magazzino e il food cost reale

**Il problema l'ha posto Alessio, e la forma della soluzione è sua.**
20/08/2026.

---

## 🔴 Il problema, nelle sue parole

> *«È quasi impossibile che il gestionale mostri un magazzino allineato con la
> realtà, banalmente perché le quantità che scarica sono solo stimate a monte
> e sicuramente saranno variabili nella realtà.»*

Ha ragione, e la conseguenza è più grossa del magazzino: **quel numero non è
una giacenza, è una previsione** — quanto ci sarebbe se ogni ricetta fosse
rispettata al grammo.

⚠️ **E va CHIAMATO così a schermo.** Il giorno che lo si chiama «giacenza» si
smette di controllarlo. È la differenza fra un dato e **una stima presentata
come dato** — la stessa famiglia della sala disegnata vuota e del manuale
HACCP che stampava «conforme»: *assenza di informazione e informazione di
assenza sono due cose diverse.*

---

## 🔴 Prima la misura: cosa esiste già

Chiesto al database prima di progettare.

| pezzo | stato |
|---|---|
| le **partite** (`stock_lots`) | ✅ con `quantity_remaining`, `expiry_date`, `unit_cost` **per partita** |
| il conteggio di quanto c'è (`v_stock_levels`) | ✅ somma le partite, e sa già dire chi è **sotto scorta** |
| gli **scarichi** (`stock_consumptions`) | ✅ con `quantity`, `quantita_richiesta`, `costo` **fotografato**, e un vocabolario di quattro `reason`: `consumo`, `spreco`, `rettifica`, `vitto_personale` |
| lo scarico a mano | ✅ `record_stock_consumption`, che toglie **FEFO** e fotografa il costo dai lotti toccati |
| il **food cost stimato** | ✅ `v_recipe_costs` — dalle ricette |
| lo **storico dei costi** | ✅ in produzione dal 20/08 |
| **la correzione «ce n'è 4, non 5»** | 🔴 non esiste: si può solo *togliere* una quantità, non *dichiarare quanto c'è* |
| **il food cost REALE** | 🔴 non esiste |
| **il trend** | 🔴 non esiste |

⚠️ **Conseguenza sul disegno**: `rettifica` **c'è già** come motivo di
scarico, e la meccanica FEFO pure. Questo mandato **non crea un magazzino
parallelo**: aggiunge il gesto che manca (dichiarare quanto c'è) e i due
numeri che oggi non esistono.

⚠️ **E `rettifica` è un motivo TECNICO, non una causale da scegliere**: è la
riga che dice «questo scarico viene da un allineamento». Non chiede niente ad
Alessio — vedi sotto.

---

## Come si corregge — la forma è di Alessio

### 1 · Niente sessioni di conta programmate

Si corregge **man mano, quando quel numero serve per decidere**:

> *«Devo ordinare gli spaghetti, il gestionale dice 5 kg e invece ne ho 4.
> Quello è il momento in cui aggiorno.»*

### 2 · 🔴 Niente causale

Il validatore proponeva di chiedere il perché. **Alessio l'ha scartata, e ha
ragione**: le cause possono essere ignote, e *un elenco che si riempie di «non
so» produce righe che sembrano informazione e non lo sono*.

> *«Quello che conta davvero è il trend.»*

⚠️ Sul motivo tecnico resta `rettifica`, che il gestionale scrive da sé.

### 3 · Si scrive quanto c'è DAVVERO, non quanto togliere

Il gestionale calcola la differenza. ⚠️ **Davanti allo scaffale non si fanno
conti** — e chiedere «quanto togli» sposterebbe l'aritmetica su chi ha in mano
il barattolo, cioè dove sbaglia.

### 4 · La correzione la può fare chiunque

Anche dall'accesso della sala. ⚠️ Chi si accorge che ne manca è chi sta
guardando lo scaffale, non chi ha il gestionale aperto in ufficio.

### 5 · La differenza si associa al prodotto e toglie dalla partita più vecchia

Quella che scade prima — **la stessa regola FEFO dello scarico vero**, non una
seconda.

🔴 **E qui c'è una misura da fare prima di costruire**: partite diverse dello
stesso prodotto possono avere **prezzi diversi** (`stock_lots.unit_cost` è per
partita), quindi **da quale si toglie cambia il valore dello scostamento**.
⚠️ Va **misurato su un caso a due partite con prezzi diversi e dichiarato nel
riepilogo**: se la differenza fra togliere dalla più vecchia e dalla più cara
è grande, quel numero va detto, non nascosto in una scelta di implementazione.

---

## Dove si fa

- 🔴 **Una sezione nuova, «Allineamento magazzino»**: aprendola si vede
  **prima l'elenco delle cose da allineare**, a partire dai prodotti in
  esaurimento; **poi** il trend. ⚠️ L'ordine è quello: si entra per fare una
  cosa, non per leggere un rapporto.
- **Ma anche dalla scheda del prodotto, in un tocco**: il momento in cui uno
  se ne accorge è **mentre guarda quel prodotto**.
- ⚠️ **NON nella lista della spesa**: comprare si fa col telefono davanti al
  fornitore, allineare si fa in dispensa. Alessio l'ha lasciata come
  possibilità, ma mescolarli riempirebbe di numeri da correggere **la
  schermata in cui si decide cosa ordinare**.
  ⚠️ *Se misurando salta fuori una ragione forte per il contrario, va detta* —
  non decisa in silenzio.

---

## 🔴 Il trend — la parte che dà senso al resto

**Alessio non vuole avvisi**: *«mi rendo conto da solo man mano che aggiorno
le giacenze»*. Vuole **una sezione da aprire liberamente**:

- **in cima il food cost globale**: quello **stimato** dalle ricette e quello
  **reale** che tiene conto degli scostamenti, la **percentuale di scarto** fra
  i due e **quanto vale in euro** — perdita o guadagno;
- **sotto il dettaglio** di cosa concorre allo scostamento, **prodotto per
  prodotto**, così si vede quale scappa.

🔴 **I due numeri restano distinti e riconoscibili, mai fusi in uno
«aggiornato»**: lo **stimato** è quello con cui Alessio **decide i prezzi del
menu**, il **reale** è quello che sta vivendo. Fusi, i prezzi si farebbero su
un numero che si muove da sé.

⚠️ È la stessa forma della decisione dei preventivi: *due numeri diversi
tenuti separati fin dall'inizio*, perché rispondono a due domande diverse.

---

## I blocchi, in ordine di dipendenza

### Blocco 1 — la correzione

Il gesto «ce n'è questo», con la differenza calcolata dal gestionale, la
scrittura FEFO, e la misura dichiarata sulle partite a prezzi diversi.
Aperta a tutto lo staff, e raggiungibile dalla scheda del prodotto.

### Blocco 2 — la sezione «Allineamento magazzino»

L'elenco delle cose da allineare, a partire dai prodotti in esaurimento.

### Blocco 3 — il food cost reale e il trend

I due numeri, lo scarto in percentuale e in euro, e il dettaglio prodotto per
prodotto.

⚠️ **Va per ultimo perché senza correzioni non ha niente da dire**, e perché
è il pezzo dove un numero sbagliato somiglia di più a un numero giusto.

### E prima di tutti: la parola

⚠️ **Cambiare il nome di quel numero a schermo** — da «giacenza» a quello che
è — **costa poco e va fatto subito**, prima che qualcuno ci prenda una
decisione credendolo un dato.

---

## Prove che possono fallire

- corretto un prodotto da 5 a 4, la differenza risulta **sul prodotto
  giusto**, tolta dalla **partita più vecchia**, e il **food cost reale si
  muove mentre lo stimato resta fermo**: ⚠️ **due asserzioni, non una**;
- ⚠️ una correzione **IN AUMENTO** (ne trovo più del previsto) funziona come
  quella in diminuzione: *è il caso che si dimentica sempre*, e succede — una
  consegna registrata male, un conteggio precedente sbagliato;
- **scrivere lo stesso numero** che il gestionale già mostra **non produce
  nessuno scostamento**: distingue «registro le differenze» da «registro i
  salvataggi»;
- la correzione fatta **con l'accesso della sala** riesce;
- 🔴 **e la rottura**: fai calcolare il food cost reale **ignorando gli
  scostamenti** e verifica che una prova diventi rossa. *Se non diventa rossa,
  i due numeri possono già essere lo stesso senza che nessuno lo veda.*

⚠️ **E i numeri delle prove vanno scelti perché distinguano** (lezione del
19/08): con una sola partita, «la più vecchia» e «l'unica» sono lo stesso
lotto, e la regola FEFO non verrebbe misurata.

---

## Cosa questo mandato NON copre

- gli **avvisi**: Alessio non li vuole, se ne accorge aggiornando;
- una **causale** dello scostamento (scartata da lui, con la ragione);
- l'**inventario fisico periodico** con verbale: qui si corregge man mano;
- il collegamento fra scostamenti e **prezzi del menu**: lo stimato resta il
  numero con cui si decidono, e questo mandato non lo tocca.
