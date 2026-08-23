# Le spezie e il vino

**Blocco 2 del mandato del 23/08.** Migrazioni **`20260823000003`**,
**`…04`** e **`…05`**, applicate **solo sul progetto di prova**. In
produzione non è entrato niente: aspetta il push di Alessio.

---

## 1 · Cosa aveva deciso Alessio

> · le **spezie a pizzico escono dal magazzino** — *«possiamo anche
>   trascurare roba del genere che ha costi irrilevanti. La cannella
>   comprata resta comprata, e la lista della spesa non la chiede»*;
> · il **vino esce dall'elenco** delle cose non scese: 1.844 righe tutte
>   uguali seppelliscono le venti che contano.

Con una condizione: *misura prima quanto pesano davvero sul food cost le
spezie escluse — se fosse più dell'1%, dillo.*

---

## 2 · La misura, e ha cambiato il perimetro

**Le spezie pesano lo 0,73%** del costo di tutti i piatti del ricettario.
Sotto l'1%: la decisione regge.

🔴 **Ma «le spezie» non sono la categoria `spezie_aromi`, e prenderla per
tale sarebbe stato un errore grosso.** In quella categoria ci sono
**basilico, prezzemolo, sale, menta**, che scendono benissimo — misurate
**804 righe di consumo** già scritte. Su una busiata il basilico vale
0,17 €, il **14% del costo di quel piatto**.

I prodotti che il magazzino **non sa** scaricare sono **quattro**, e non si
riconoscono dalla categoria ma dal fatto che in almeno un piatto la loro
quantità arrotonda a zero sui quattro decimali della colonna:

| prodotto | in piatti | impieghi ciechi | max €/porzione |
|---|---|---|---|
| Cannella in stecche | 6 | 5 | 0,0015 |
| Alloro | 5 | 2 | 0,0152 |
| Pepe nero in grani | 2 | 2 | 0,0009 |
| Zafferano in pistilli | 1 | 1 | 0,0160 |

⚠️ **Quindi l'interruttore sta sul PRODOTTO** (`ingredients.tenuto_in_magazzino`),
e la sanatoria lo spegne solo dove il gestionale è **già cieco** — una
proprietà che si rimisura, non un elenco di nomi che invecchia al primo
prodotto nuovo. In produzione non ha toccato niente: il Ricettario è vuoto.

### Il prezzo, misurato e non stimato

Alloro e cannella smetteranno di scendere **anche nei quattro impieghi in
cui oggi scendono**. Su due mesi di servizio già registrati quei quattro
prodotti valgono **3,39 € di merce** — lo **0,031%** del costo totale.
Sono centesimi, ed è la ragione per cui la scelta è accettabile; non è
zero, ed è la ragione per cui sta scritto qui.

---

## 3 · Cosa cambia, quando un prodotto è fuori magazzino

| | |
|---|---|
| chiusura di un conto | non lo scarica, **e non lascia nessuna anomalia** |
| produzione | idem — altrimenti un ragù scaricherebbe la cannella che la sala non scarica |
| lista della spesa | non lo chiede più da sola |
| schermata Magazzino | al posto della giacenza scrive **«fuori magazzino»**, e la soglia sparisce |
| carico da fattura | **funziona come prima**: si compra, il costo resta sulla fattura |

⚠️ **Il numero fermo non si mostra come giacenza**: per un prodotto che non
scende mai, quel valore è quello dell'ultimo carico — informazione di
assenza spacciata per misura.

### E chi glielo dice, il giorno che nasce una spezia nuova?

Un riquadro nuovo in Magazzino, **che compare solo quando ha qualcosa da
dire**: *«Il magazzino non riesce a seguirli»*, con l'elenco e in quanti
piatti. Serve perché dal blocco 1 un pizzico non fa più fallire lo scarico —
ed è la cura giusta — ma **«non fallisce» e «funziona» sono due cose
diverse**: senza quel riquadro, un prodotto uscito dal conteggio sarebbe
silenzioso, e la decisione di spegnerlo non la prenderebbe mai nessuno.

---

## 4 · Il vino: perché `destination`, e non il nome

Misurato: **non esiste un listino bevande.** Ogni bevanda entra in comanda
come testo libero, ed è quello che fa la sala. Ma **tutte** le righe senza
ricetta hanno `destination = 'bar'` — quindi il criterio è un **dato del
gestionale**, non un'euristica sul nome del prodotto.

⚠️ **Una voce libera in cucina resta dichiarata**: quello è un piatto
scritto a mano, ed è un buco vero del magazzino. La prova automatica ne
ordina uno apposta — senza, non distinguerebbe «le bevande non si
dichiarano» da «le voci libere non si dichiarano più».

⚠️ **E il taglio si dichiara a schermo**: *«Le bevande non compaiono: il
magazzino non le segue»*, dentro il riquadro, dove sta il dubbio.

**Effetto misurato**: l'elenco «Cosa non è sceso dal magazzino» è passato da
**1.843 righe a 3** — e le 3 sono giacenze che davvero non bastavano.

---

## 5 · 🔴 Il difetto trovato aprendo la schermata

Fatto il blocco 2, quelle 3 righe rimaste dicevano tutte:

> «— · non ce n'era abbastanza: Mascarpone — **di questo conto non è sceso
> niente**»

Misurato: **non sono conti, sono produzioni.** Da quelle produzioni erano
scesi 3, 7 e 2 ingredienti. La riga sbagliava **due volte**: chiamava conto
una produzione, e diceva «non è sceso niente» dove era sceso quasi tutto.

⚠️ **Metà difetto era lì da prima e non l'aveva visto nessuno**: dal 14/08
`registra_produzione` scrive in `anomalie_scarico`, ma `scarichi_non_riusciti`
faceva `left join orders` e basta — le produzioni comparivano col tavolo
vuoto, in un riquadro intitolato «righe di conti chiusi». **Erano invisibili
perché sepolte sotto 1.840 bevande.**

⚠️ **E l'altra metà l'ho aggiunta io stamattina**: la frase «di questo conto
non è sceso niente» è nata col blocco 1, per non lasciare silenzioso uno
scarico parziale. Su una produzione afferma una cosa falsa con calma — che è
peggio del silenzio che voleva togliere.

> *Una cura che non guarda tutti i casi che il suo dato può avere diventa una
> bugia sui casi che non ha guardato.*

Chiuso da `20260823000004`: l'elenco distingue conto e produzione, nomina la
preparazione, e conta quanto è sceso **dall'uno o dall'altra**.

---

## 6 · 🔴 Difetto mio: una funzione riscritta a memoria

Ed è **la trappola del 18/08 ripetuta tale e quale** — *«una funzione si
riscrive dal database, mai dal file che l'ha creata»*. Curando il pizzico
nelle produzioni ho letto **solo il pezzo di corpo che mi serviva** e ho
ricostruito il resto.

Quattro cose sparite in silenzio:

| | cosa sarebbe successo |
|---|---|
| 🔴 il **portiere** (`auth.uid() is null`) | `registra_produzione` è `security definer`: senza, chiunque avesse la chiave pubblica del sito poteva muovere il magazzino |
| 🔴 il nome del campo `righe_non_scaricate` | la schermata Produzioni legge `r?.righe_non_scaricate ?? 0`: l'avviso «N ingredienti non scaricati» avrebbe detto **zero per sempre** |
| il campo `quantita` nella risposta | idem, senza errore |
| due messaggi d'errore | riscritti peggio: quello vecchio spiegava *perché* serve il numero delle dosi |

⚠️ **Una sola delle quattro l'ha presa una rete**: la prova sui permessi, che
è diventata rossa da sola. Le altre tre sarebbero passate verdi.

⚠️ **E la verifica del blocco 1 non poteva accorgersene**: gira come
proprietaria del database, dove `auth.uid()` non c'entra. *Un difetto che
vive nei permessi si prova solo dal client, col token di un utente vero.*

Chiuso da `20260823000005`, ripartendo dal corpo vivo di prima dell'errore.
La verifica **legge il corpo** e pretende di ritrovarci il portiere e i nomi
dei campi — non si fida di averli riscritti.

---

## 7 · Tre prove rosse che non erano nostre, e cosa dicevano

Facendo girare la suite intera sono uscite tre prove rosse **che il blocco
non ha causato**: le ha svegliate lo scenario a scala vera, che ha riempito
tabelle prima quasi vuote.

| prova | perché era rossa | cura |
|---|---|---|
| tesoreria | `toBe(1893.49)` contro `1893.4899999999998`: virgola mobile | `toBeCloseTo` — *passava perché i numeri erano fortunati* |
| anticipazioni | pretendeva `ti_deve = 40` su un database che ora ne ha 459,50 | misura la **differenza**, non il valore assoluto |
| form pubblico | rifiuto `P0001` | vedi sotto — ed è la più istruttiva |

### 🔴 Lo scenario rendeva il sito cieco per un'ora

Il form pubblico ha dall'08/08 un freno anti-abuso: **40 richieste all'ora
complessive**. Lo scenario crea **262 prenotazioni tutte nella stessa ora**,
quindi dopo ogni ricostruzione **il sito rifiutava ogni prenotazione vera**,
con un messaggio giusto e una causa invisibile.

⚠️ **Non è un difetto del gestionale: il freno funziona.** È lo scenario che
raccontava una cosa impossibile — nessuno riceve due mesi di prenotazioni in
sessanta secondi. Ora le prenotazioni si ridatano **anche nel «quando sono
arrivate»**, mai nel futuro e mai in questa stessa ora: è la stessa famiglia
delle quote di pagamento che restavano a oggi.

⚠️ **E vale per il collaudo**: se Alessio avesse provato a prenotare dal sito
subito dopo `npm run prova:scenario`, avrebbe cercato un difetto che non
c'era.

### E una funzione non dichiarata, di ieri

`campi_da_confermare` è nata il 23/08 col blocco dei campi messi dalla
macchina e **non era stata dichiarata** nell'elenco delle funzioni che
scavalcano la RLS. La rete l'ha trovata il giorno dopo — che è precisamente
il lavoro per cui esiste. Resta senza portiere, con la ragione scritta: dice
quali campi nessuno ha guardato e su quanti prodotti, roba che in cucina si
vede comunque aprendo il Ricettario.

---

## 8 · Come è stato provato, e come è stato fatto fallire

Quattro rotture, tutte diventate rosse sulla verifica giusta:

| rottura | errore |
|---|---|
| tolto il filtro dei prodotti fuori magazzino dallo scarico | *«Un prodotto fuori magazzino ha scritto 1 righe di consumo»* |
| tolto il filtro delle bevande | *«La bevanda compare ancora fra le cose non scese»* |
| tolto il filtro dalla lista della spesa | *«La lista della spesa chiede un prodotto che il magazzino non segue»* |
| tornato a contare solo i conti | *«La riga dice che non è sceso niente, e invece era sceso qualcosa (0)»* |

⚠️ **La verifica non gira sul caso vuoto**: la produzione di prova ha
**due** ingredienti — uno che abbonda e uno che non basta — così scarica
qualcosa **e** lascia un'anomalia. Con un ingrediente solo non si potrebbe
distinguere «non è sceso niente» da «è sceso il resto».

⚠️ E il prodotto fuori magazzino della verifica ne usa **200 grammi**, non un
pizzico: altrimenti la prova non distinguerebbe «non scende perché è fuori
magazzino» da «non scende perché è troppo piccolo».

### Guardato con gli occhi

Aperta la schermata Magazzino sul progetto di prova, con l'accesso di
collaudo. Visto: l'elenco a **3 righe** con la frase sulle bevande, le tre
righe che ora dicono «produzione Crema al mascarpone … il resto è sceso (2
ingredienti)», e nella tabella **Alloro, Cannella, Pepe nero e Zafferano con
«fuori magazzino»** mentre il Basilico resta seguito e sotto soglia.

**Suite**: 289 prove pure e 324 sul progetto di prova, tutte verdi.

---

## 9 · Cosa abbiamo rovesciato

**Cosa era stato deciso e quando** — 13/08/2026, migrazione
`20260813000013`: *«non si inventa mai uno scarico: voce libera, ricetta
vuota, resa non indicata → non si toglie niente e lo si dichiara»*. Tutte le
voci libere, senza distinzione.

**La ragione di allora** — un buco dichiarato è onesto e uno zero silenzioso
no. Vale ancora, parola per parola.

**Cosa si decide adesso** — le righe destinate al **bar** non si dichiarano
più, e il fatto che siano escluse si scrive nella schermata.

**Perché la ragione di allora non vale più** — ⚠️ **vale ancora, e questo è
il prezzo che accettiamo.** Una bevanda *è* una riga che il magazzino non ha
scaricato, e non dichiararla è esattamente ciò che quella regola vietava. Ma
con una sola bevanda in due mesi non si poteva vedere quello che si vede
adesso: **1.840 righe identiche** che rendono l'elenco illeggibile, e *un
guardiano che grida sempre si impara a spegnere*. Il prezzo si paga in un
posto solo — una frase in schermata invece di mille righe — e il caso che la
regola proteggeva davvero, il piatto scritto a mano in cucina, **resta
dichiarato**.

Registrato in [`docs/decisioni_rovesciate.md`](../decisioni_rovesciate.md).

---

## ⚠️ Cosa NON è verificato

1. 🔴 **Niente in produzione.** Tutte e tre le migrazioni sono solo sul
   progetto di prova. Lì la sanatoria non toccherà nessun prodotto: il
   Ricettario vero è vuoto.
2. ⚠️ **Nessuna mano ha spento l'interruttore dalla scheda di un
   ingrediente**: il campo nuovo è stato provato dal database e dalla suite,
   non premuto.
3. ⚠️ **Nessuno ha registrato una produzione dopo la correzione del
   portiere.** La verifica legge il corpo della funzione e la rete dei
   permessi la conferma, ma il gesto vero — la cucina che registra un ragù —
   non è stato fatto.
4. ⚠️ **Il carico di un prodotto fuori magazzino non è stato provato**:
   continua a creare il lotto come prima, per scelta (la merce che arriva è
   un fatto), e quel lotto resterà fermo. È il motivo per cui la schermata
   smette di chiamarlo giacenza.
5. ⚠️ **Lo scenario con le prenotazioni ridatate non è stato ricostruito da
   capo**: la correzione è stata applicata alle righe esistenti con la
   stessa regola, e il codice gira alla prossima ricostruzione.
