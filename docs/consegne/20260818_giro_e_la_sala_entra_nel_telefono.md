# Giro E — la sala entra nel telefono, e i tavoli si trovano da soli

**Consegna del 18/08/2026.** Mandato [«La sala e le prenotazioni»](../mandati/20260818_la_sala_e_le_prenotazioni.md),
punto **7** più il **4-bis**. Anticipato al giro D per decisione di Alessio:
ogni sua prova dal telefono inciampava nella pianta troppo grande **prima** di
arrivare a ciò che stava provando.

- **HEAD dichiarato**: `a0601b7`
- **Working tree**: pulito
- **Migrazione**: `20260818000007_il_formato_arriva_al_disegno.sql`
- **Prove**: **85** pure (erano 67) + **163** sul progetto di prova (erano 157)
- **Lint**: zero avvisi · **Build**: ok
- **In produzione**: **applicata** — 136 migrazioni
- **Contratto**: non toccato

---

## ⚠️ Cosa NON è verificato

1. **Il ridimensionamento e l'aggancio li può giudicare solo la mano di
   Alessio dal telefono.** I quadrati diventano **un quinto più piccoli sotto
   il dito** — da circa 6,6 a circa 5,3 millimetri — e nessuno ha provato se
   restano comodi da prendere. Da qui si misura, non si tocca.
2. **Nessuna mano ha toccato il giro C**: le tre fasce, la nota del turno e la
   sala di Comande dopo mezzanotte non sono mai state usate da una persona.
3. **La mezzanotte in servizio non è mai capitata dal vivo.** Provata ai bordi
   (00:30, 04:59, 05:00, 05:01), mai da un tablet acceso all'una di notte.
4. **La domenica a pranzo non ha prenotazioni vere** in produzione.
5. **La guardia di `--azzera` non è mai scattata in una ricostruzione vera.**
6. **I due rami di `DB_URL_PRODUZIONE`** — mancante, o che punta altrove —
   **non sono mai stati esercitati.**
7. **Il messaggio con le date degli scostamenti non è mai comparso a schermo.**
8. **Il disegno non è mai stato guardato da un occhio umano.** In questo
   progetto le prove non hanno un ambiente DOM, quindi la linea di giunzione,
   la cornice tratteggiata del magnete e i due tavoli girati sono verificati
   **per aritmetica e per geometria**, mai visti. Aggiungere jsdom sarebbe una
   dipendenza nuova, e non è lavoro di questo giro.

---

## Cosa abbiamo rovesciato

### «Il tavolo più piccolo non scende mai sotto 1,05 cm reali» (14/08)

**Cosa era stato deciso, e quando.** Il 14/08, con la pianta viva: la
larghezza minima del disegno è quella che tiene il tavolo da 90 cm a **1,05 cm
reali**, il bersaglio di tocco del progetto (§3.2.1). *«Non si rimpicciolisce
sotto quella soglia: un tavolo che non si riesce a toccare durante un servizio
non è una pianta, è un disegno.»*

**La ragione di allora.** Un bersaglio troppo piccolo non si prende, e in
servizio prendere il tavolo sbagliato costa.

**Cosa si decide adesso.** La soglia scende a **tre quarti**: il tavolo più
piccolo misura poco più di 0,78 cm reali. La sala entra nello schermo del
telefono, che è dove si prendono le prenotazioni.

**Vale ancora nel principio — ed è il NUMERO a non aver mai avuto una misura
dietro. Questo è il prezzo che accettiamo.** 1,05 cm è una convenzione presa
da fuori, non qualcosa che qualcuno abbia misurato su questa app: e la realtà
l'ha già smentita, perché **Alessio oggi trascina i tavoli col dito a 6,6 mm
senza inciampare** — cioè sta già sotto la soglia da giorni, e la soglia non
se n'è accorta. Il prezzo dichiarato è che si scende a un valore che **nessuno
ha ancora provato**, e l'unico modo di sapere se regge è la sua mano: per
questo la prova del dito sta al **punto 1** di ciò che non è verificato, non
in fondo.

⚠️ **E la soglia che GIRA la sala non scende insieme.** Erano lo stesso
numero; da oggi sono due, perché rispondono a due domande — *quanto piccolo
può diventare il disegno* e *quando la sala sta male sdraiata*. Se fossero
scese insieme, un tablet in verticale (768 punti) avrebbe smesso di girare la
sala e avrebbe mostrato una pianta **sdraiata** dove le Comande, sullo stesso
tablet, la mostrano in piedi: si sarebbe allargata la differenza fra le due
schermate proprio nel giro che la deve chiudere. **Nessuno schermo cambia
orientamento per via di questo giro**, cambia solo quanto è grande il disegno.

---

## 🔴 Il difetto trovato per strada, e la sua famiglia — TERZA VOLTA IN TRE GIORNI

**Il caso.** `dining_tables.ruotato` era onorato dal **conteggio** —
`coperti_del_giorno()` scambia larghezza e profondità di una sagoma girata — e
**ignorato dal disegno**, che leggeva `larghezza_cm` così com'era. **T1 e T2,
due tavoli veri della sala di Alessio**, erano disegnati sdraiati 180×90 e
contati in piedi 90×180. La sala che si guardava non era la sala che il
gestionale contava.

**La famiglia, che conta più del caso.** *Due parti dello stesso programma che
raccontano cose diverse dello stesso fatto*, e non è una coincidenza che siano
tre in tre giorni:

| quando | dove | chi diceva una cosa | chi ne diceva un'altra |
|---|---|---|---|
| 16/08 | manuale HACCP | il documento stampava «conforme» | il database apriva una non conformità |
| 18/08 | coperti corretti a mano | la schermata diceva «decade» | il numero tornava rifacendo l'accostamento |
| 18/08 | verso del tavolo | il disegno lo mostrava sdraiato | il conteggio lo contava in piedi |

⚠️ **La differenza col difetto «normale»**: qui nessuna delle due parti è
rotta. Prese singolarmente, il disegno è coerente e il conteggio è corretto —
**il difetto vive nello spazio fra le due**, che è precisamente il posto dove
nessuna verifica guarda se non ce la si manda apposta.

**Chi comanda, e perché non è una gerarchia.** Comanda il conteggio, perché la
decisione del 14/08 dice *«il disegno gira mentre la misura del mobile resta
180×90»*: l'ingombro ruota, la scheda del mobile no. Quindi si corregge il
disegno.

### La domanda che ne discende: uno o due posti?

**Due.** Il verso del tavolo lo legge `misureSagoma()` in JavaScript **e** il
`case when p.ruotato` dentro `coperti_del_giorno()` in SQL.

Col discriminante del 17/08 — *direbbero esattamente la stessa cosa?* — la
risposta è **sì**: «una sagoma girata occupa profondità × larghezza» non ha
sfumature. Quindi non è un caso da rete, **è un doppione da togliere**, e la
strada è già visibile: `pianta_del_giorno()` potrebbe restituire l'ingombro
già girato, e disegno e conteggio leggerebbero lo stesso numero invece di
ricavarlo ciascuno per conto proprio.

⚠️ **Non si fa qui**: è il lavoro vero, tocca la funzione che sta sotto a
tutte le schermate della sala, e questo giro deve chiudere il telefono. **Va
in coda.** Nel frattempo il doppione **non resta scoperto**: la prova
`tests/app/aggancio-sala.test.js` confronta l'ingombro calcolato in JavaScript
coi tavoloni che conta il database, sui dati veri — se i due versi tornassero
a divergere, diventa rossa da sola.

---

## Cosa è stato costruito

### 1. La riduzione — misurata, non a occhio

| | |
|---|---|
| La pianta in piedi pretendeva | (1030 / 90) × 1,05 = 12,02 cm reali = **454 punti** |
| Sul telefono di Alessio ce ne sono | 390 meno i 16+16 di margine della pagina = **358** |
| Il minimo esatto sarebbe | **0,788** |
| Si prende | **0,75** |

**Perché non il minimo esatto.** Lascia zero margine: basta un punto di
differenza per tornare a scorrere di lato.

**Perché il margine non costa niente**, ed è la ragione per cui si può essere
generosi: a 0,75 il pavimento è 341 punti, che sta **sotto** 358 — quindi sul
suo telefono comanda la larghezza del contenitore e la pianta si disegna a 358
punti **con qualunque fattore sotto 0,788**. Il pavimento morde solo su uno
schermo più stretto (un telefono da 375 punti), e lì il margine è tutto ciò
che separa «entra» da «scorre».

⚠️ **Sdraiata il taglio necessario sarebbe stato di quasi due terzi.** Il conto
torna solo con la pianta in piedi — che sul telefono **era già così**: si gira
da sola sotto una soglia misurata in centimetri veri, e il telefono ci sta
abbondantemente sotto da giorni. Per questo la pianta del **computer** resta
sdraiata: girarla non cambierebbe niente sul telefono e sul monitor darebbe
una striscia stretta con due fasce vuote — cioè lo svantaggio senza il
vantaggio. ✅ **Confermato da Alessio**, con le due colonne rimandate al giro D.

### 2. Il magnete — non esisteva

Quello che c'era era **la griglia da 10 cm**, non un aggancio: due tavoli si
uniscono solo se il dito li lascia esattamente al posto giusto, e sul telefono
quel «esattamente» vale **due punti di schermo**. I tavoli a distanza zero
della sala vera ci sono arrivati per precisione, non per calamita.

- **Il raggio si misura in dito reale**, mai in unità del disegno: altrimenti
  si accorcerebbe da sé al prossimo ridimensionamento — cioè il giro E avrebbe
  peggiorato l'aggancio proprio mentre migliorava il resto. Un quinto di un
  bersaglio di tocco: sul telefono di Alessio circa **8 punti di schermo**,
  cioè circa **22 cm di sala**.
- **Porta la distanza a zero esatto**, non «vicino»: zero sta dentro qualunque
  tolleranza, e la prova lo verifica contro `TOLLERANZA_CONTATTO_CM` vera, non
  contro un numero ricopiato.
- **Pareggia i bordi**, e non è estetica: un tavolone con uno scalino di 10 cm
  non sembra un tavolone, cioè disferebbe con una mano quello che la linea di
  giunzione fa con l'altra. Il pareggio **aumenta** la sovrapposizione, quindi
  non può far contare un tavolone che il database non conterebbe.
- **Solo dentro lo stesso formato**: la regola di Alessio è lo *stile*, non la
  misura, e il gestionale non deve nemmeno **offrire** l'accostamento fra un
  180 e un 90×90.
- **Si vede mentre sta per prendere**, non dopo: una cornice tratteggiata
  attorno ai tavoli che stanno per diventare uno. Un aggancio che si scopre al
  rilascio è una sorpresa, e la volta dopo si trascina piano per paura.

⚠️ **Il prezzo, dichiarato e accettato da Alessio**: due tavoli dello stesso
formato non si possono più lasciare **vicini ma staccati** sotto i ~22 cm — il
magnete li unisce. In una sala vera è un passaggio in cui non ci si passa
comunque, e la via d'uscita esiste: si scostano di lato finché la
sovrapposizione scende sotto i 30 cm del contatto minimo.

⚠️ **Aggancio e tolleranza vengono dallo stesso file** (`src/lib/calcoli/sala.js`),
dove già vivevano il passo della griglia, la tolleranza di contatto e la
sovrapposizione minima col rapporto che le lega. Ma **la prova non guarda dove
stanno le costanti: guarda il comportamento** sui dati veri.

### 3. La linea di giunzione (4-bis)

Dentro un tavolone i lati **non spariscono, si assottigliano**: bordo interno
sottile e poco visibile, perimetro esterno unico e pieno. Dice tutte e due le
cose — *«questo è un tavolone»* e *«è fatto di tre»* — e la seconda serve
quando lo si smonta e serve alla **correzione a mano, che ha per chiave
proprio l'insieme dei tavoli**.

⚠️ **Chi sta con chi lo dice il database**, mai un secondo calcolo nel disegno:
una regola in JavaScript accanto a `coperti_del_giorno()` finirebbe per
disegnare un tavolone dove il numero non ne vede nessuno — cioè la famiglia di
difetti di cui sopra, aggiunta apposta.

⚠️ **Il limite, dichiarato**: il perimetro unico si disegna **solo** quando i
pezzi riempiono esattamente il loro ingombro (una fila o un blocco pieno). Tre
tavoli a **L** formano un gruppo vero ma il loro ingombro comprende un angolo
vuoto, e un perimetro tirato lì attorno disegnerebbe un tavolo dove non c'è
niente. In quel caso i pezzi restano col bordo pieno: meno bello, **mai falso**.

⚠️ **In Comande i tavoloni non arrivavano affatto.** Senza, la stessa sala si
disegnava in due modi nelle due schermate — che è il rilievo che Alessio aveva
già fatto il 17/08. E la riga che spiegava la differenza **diceva una cosa
falsa dal telefono** («in Calendario la vedi sdraiata»): corretta.

### 4. L'app si aggiunge alla schermata iniziale

Era un **segnalibro**: aperta dall'icona restava dentro Safari, con le barre
che si mangiano **145 punti degli 844** — misurati da Alessio, non presi da un
listino.

⚠️ **iOS non legge il manifest per l'icona**: guarda `apple-touch-icon` e la
vuole PNG. Un manifest perfetto e quel tag mancante darebbero l'icona giusta
su Android e **una fotografia della pagina su iPhone**, cioè proprio sul
telefono per cui il giro E esiste.

⚠️ **Le icone sono una conseguenza del logo vero, non tre file incollati**:
`node scripts/icone-app.mjs` le rifà. Un'immagine binaria committata è una
cosa che fra sei mesi nessuno sa da dove viene né come rifare. Il logo non è
quadrato (780 × 382), quindi si centra su fondo crema dentro l'80% del lato —
il margine che i sistemi si tengono per arrotondare senza mangiare il nome.

### 5. La misura, e il righello

La riga di `?misura=1` riportava l'**altezza** mentre il problema della pianta
è la **larghezza**: ora dice anche quella e **quanto misura davvero il tavolo
più piccolo** su quello schermo. È la difesa per il giorno in cui la pianta
tornasse a sbordare.

⚠️ **L'avvertenza sul righello sta nel programma, non in un messaggio.** Su un
telefono il righello di fabbrica **sbaglia per difetto** (disegna tutto più
piccolo del vero): calibrandolo lì la pianta **cresce fino a sbordare**,
peggio di prima del giro E. La schermata della calibrazione ora fa **il conto
vero, con la stessa misura che usa la pianta**, e lo dice mentre si sposta il
righello — «con questa misura la pianta chiede N punti e qui ce ne sono M».
Non una soglia di schermo scelta a occhio, e non un avviso che vive in una
chat: *un'avvertenza che non sta dove sta il gesto è persa.*

---

## Le prove, e la controprova

**Sette rotture apposta, e ogni volta è diventata rossa esattamente la prova
giusta** — nessun risultato è arrivato rileggendo il codice appena scritto.

| cosa ho rotto | cosa è diventato rosso |
|---|---|
| il magnete ignora il formato | «non aggancia fra formati diversi» |
| via la sovrapposizione minima | «non trasforma uno spigolo in un tavolone» |
| il raggio in unità del disegno | «è lo stesso dito anche quando la pianta si rimpicciolisce» |
| il disegno ignora il verso | «un tavolo girato ingombra al contrario» |
| nessuna riduzione | le due prove sull'entrare nello schermo |
| il manifest dichiara una misura falsa | «ogni icona esiste, e della misura che dichiara» |
| via il tag di iOS | «iOS trova la sua icona» |

### 🔴 E una rottura ha trovato un buco nella PROVA, non nel codice

Allargando il raggio del magnete **di dieci volte**, la prova sui gruppi della
sala vera restava **verde**. Il motivo: un tavolo già attaccato a un vicino è
**ancorato** — l'aggancio a distanza zero vince su qualunque altro, quindi non
si muove e i gruppi non cambiano. Il difetto ci sarebbe eccome, e si vedrebbe
**al primo trascinamento**, cioè quando nessuna prova sta guardando.

La seconda prova chiude il buco con la proprietà giusta: *ogni coppia che il
conteggio tiene separata e che potrebbe unirsi deve stare più lontana del
raggio del magnete.* Rotta di nuovo allo stesso modo, e **diventa rossa**.

### Le prove discriminanti solo INSIEME

- **Il verso**: una mette due tavoli girati dove si toccano **solo se il verso
  conta**, l'altra dove si toccherebbero **solo se non contasse**. Una sola
  delle due passerebbe anche con la convenzione rovesciata.
- **Il magnete sulla sala vera**: *fermi dove sono, i tavoli non si muovono e
  i contatti che il magnete dichiara ricostruiscono esattamente i tavoloni che
  conta il database.* Non è il totale — **un totale uguale può nascondere due
  gruppi diversi che si compensano.** Prende il tranello naturale della sala:
  T5-T8 e T6-T7 stanno a **distanza zero su un asse** ma senza sovrapporsi, e
  il conto correttamente **non** li unisce.
- ⚠️ Ed entrambe dichiarano la **condizione d'ingresso** invece di saltare in
  silenzio: se non ci fosse nessun tavolone da riconoscere, o nessuna coppia
  separata da guardare, passerebbero senza aver provato niente — il caso vuoto
  del 17/08.

---

## L'applicazione in produzione — i numeri

**Prima**: 135 migrazioni. **Dopo**: 136. La migrazione **aggiunge una colonna
in coda** a `pianta_del_giorno()` e non tocca nessun dato.

Riletto dal collegamento in sola lettura **dopo** l'applicazione:

| | |
|---|---|
| sagome | **13**, nessuna con `updated_at` valorizzato → **nessuna posizione toccata** |
| T1 | 6 coperti, **0 giunzioni** (solo) |
| T2 | 6 coperti, **0 giunzioni** (solo) |
| T3 · T4 | 4 e 4, sole |
| T5+T6 | **6** coperti (calcolati 6, **1 giunzione**) |
| T7+T8+T9 | **8** coperti (calcolati 8, **2 giunzioni**) |
| **totale** | **34** coperti in **6 tavoloni** |

⚠️ **Guardati i gruppi, non la somma**: il ridimensionamento è **solo
disegno**, e infatti nessun accostamento è cambiato. Un totale uguale, da
solo, non lo avrebbe dimostrato.

⚠️ **Il canarino si stampa, non si pretende.** La verifica della migrazione
riporta il numero come notizia e non come vincolo: 34 è una **disposizione di
Alessio**, non una regola, e scriverlo come `raise exception` farebbe fallire
la migrazione il giorno che lui sposta un tavolo — un guardiano che dice
com'era il mondo quando l'ho guardato invece di come dev'essere fatto.

⚠️ **Una finestra dichiarata**: fra il push del sito e l'applicazione della
migrazione il magnete è rimasto **inerte** (senza il formato non aggancia
niente) invece di comportarsi male. Degrada al comportamento di ieri, non a
uno sbagliato.

---

## Per Alessio, in una riga

La sala entra nello schermo del telefono, i tavoli si agganciano da soli e si
vede quando stanno per prendersi, i tavoli accostati si vedono come un tavolone
solo, e l'app si aggiunge davvero alla schermata iniziale — **poi tocca a lui
togliere l'icona vecchia, rifarla, e leggere la riga della misura: è la terza
lettura, quella da installata.**
