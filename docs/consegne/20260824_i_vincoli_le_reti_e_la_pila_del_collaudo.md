# I vincoli, il conto bancario, e le sei cose del collaudo

**24/08/2026 · riepilogo di consegna per il validatore**

| | |
|---|---|
| **HEAD dichiarato** | `dffa003` |
| **Working tree** | pulito |
| **Migrazioni nel repository** | 219 |
| **Migrazioni in produzione** | **212** — le sette nuove aspettano il push |
| **Migrazioni sul progetto di prova** | 219 |
| **Vincoli `check` con la frase in italiano** | 35 su 205 |
| **Contratto architetturale** | **non toccato** |

---

## 1 · Le due migrazioni della commissione POS, applicate

Fatto per primo, come chiesto. Da **210 a 212**, misurato prima e dopo:

| | prima | dopo |
|---|---|---|
| tipo della colonna | `numeric(5,2)` (punti) | **`numeric(6,4)` (frazione)** |
| righe in `impostazioni_tesoreria` | 0 | 0 |
| lapidi nel registro | 0 | **0** |
| numeri fuori dall'ordinario | nessuno | **nessuno** |

🔴 **E la rete dei riepiloghi mi si è messa davanti al primo comando**:
`20260824000013` e `…14` erano in produzione e nessun riepilogo le
nominava. Il mio diceva «da 207 a 210» **senza i numeri di versione** —
ed è la **seconda volta** che ci cado nello stesso modo, dopo le sei
versioni abbreviate di ieri notte. ⚠️ *Non è una svista che capita: è
un'abitudine di scrittura, e l'unica cosa che la corregge è una rete che
si mette di mezzo.*

---

## 2 · 🔴 Il buco dei vincoli che Alessio ha trovato col gestionale in mano

Ha scritto **−100** come temperatura attesa alla consegna di un
ingrediente e il gestionale l'ha accettata senza dire niente, mentre lo
scarto al 100% — stessa schermata — veniva respinto con la sua frase in
italiano.

**La ragione è strutturale, e vale oltre le temperature**: il giro del
mattino cercava fra le colonne **numeriche**, e quella è una colonna di
**testo** — deve poter contenere «0-4 °C», «−18 °C» e «ambiente».
**Un numero scritto in una colonna di testo non compare in un censimento
dei numeri.** È la stessa forma del difetto del 22/08 — un censimento
«per posti» tace su ciò che non è un posto — letta sui tipi invece che
sulle schermate.

⚠️ **E morde perché è una colonna dell'HACCP**: dice a che temperatura la
merce *dovrebbe* arrivare, e serve a confrontarla con quella misurata col
termometro. Un'aspettativa a −100 rende quel confronto **inservibile** —
qualunque misura vera risulta «più calda del previsto».

### Il censimento rifatto: `npm run numeri:censimento`

Due elenchi, e il secondo è quello che mancava:

| | |
|---|---|
| colonne numeriche | 221 · **76 senza nessun vincolo** |
| colonne di testo **che contengono numeri** | **59** |

⚠️ **È un setaccio, non un elenco di lavori.** Delle 76 la maggioranza
sono legittime: progressivi, posizioni, e i **risultati fotografati** di
un calcolo — un limite lì rifiuterebbe una previsione brutta invece di un
dato sbagliato. Delle 59 testuali, **due** sono numeri con un limite
naturale; le altre sono nomi, telefoni, note e riferimenti.

### Le due soglie, che sono di Alessio

- **consegna −40…60 °C**: «sotto e sopra non esiste consegna vera»;
- **fase di cottura −40…300 °C**: «lì si cuoce».

⚠️ Provate contro i **casi legittimi** prima di sceglierle: −18 freezer,
−25 surgelato, 0-4 pesce, 250 forno — passano tutti. *Un limite che
rifiuta anche i casi buoni è peggio di nessun limite.*

### 🔴 E la funzione era rotta, con la spia in vista

`regexp_matches` restituisce **i gruppi di cattura**, non la
corrispondenza intera: su un numero intero tornava `null`. **La sanatoria
ha stampato «temperature fuori scala svuotate: 0»** mentre di righe fuori
scala ce n'erano due. *Uno zero che sembra «niente da fare» e invece è
«non ho guardato».* Si è visto per la stessa ragione del 17/08: ogni
sanatoria dichiara quante righe ha toccato.

### Le cinque aree scoperte — 14 vincoli

Agenda e personale, ricettario, preventivi, magazzino e comande,
proiezione e privacy.

⚠️ **Soglie tarate sui dati veri, contati prima**: ferie 1-8 giorni,
redditi 12.900-24.800, durate 3-1440 minuti, quantità 0,0001-8,11, food
cost 0,065-31,4. **Nessuna delle 14 segnalerebbe una riga esistente** —
un vincolo che rifiuta i dati già in casa non è una rete, è un blocco.

### Le controprove: 12 rotture

| | |
|---|---|
| temperature | 5 rotture, **5 rosse** |
| cinque aree | 4 rotture, 3 rosse subito |
| conto bancario | 5 rotture, 4 rosse subito |

🔴 **E le due verdi erano difetti veri, non prove sbagliate:**

1. **Il vincolo dell'aliquota del foglio non era esercitato da niente** —
   quella colonna è vuota. **Trappola del caso vuoto**, chiusa: ora la
   verifica ci scrive dentro.
2. **La rottura del legame `restrict` non rompeva niente**: `add column
   if not exists` non ha effetto su una colonna che esiste già. Rifatta
   cambiando il legame **sul database**: rossa, col messaggio giusto.

---

## 3 · La struttura per il secondo conto corrente

Come chiesto: **solo il posto dove il conto viene registrato**, nessuna
schermata.

🔴 **La parte che fa funzionare «la struttura c'è e tace»**: il conto non
è obbligatorio adesso. Con **un** conto solo si riempie da sé — chiederlo
sarebbe una domanda con una risposta sola — e diventa obbligatorio **da
solo** il giorno in cui i conti attivi diventano due. È il momento esatto
in cui «banca» smette di essere un posto e diventa una categoria.

⚠️ Così i movimenti di oggi nascono **già attribuiti**, e il giorno del
secondo conto non c'è nessuno storico da ricostruire: che è precisamente
il motivo per cui questa migrazione si fa ora.

**Cosa non si fa**, e sta scritto nel file: nessuna riga di partenza (un
conto «principale» sarebbe un nome scelto da me al posto suo), nessuna
schermata, e `v_cash_balance` non si tocca.

⚠️ **La trappola del 12/08 si è ripresentata**, già scritta negli
appunti: `set_updated_at()` non si riusa su una colonna che si chiama
`aggiornato_il`, e l'errore arriva al primo aggiornamento — non creando
il trigger. Scritta la gemella. **E guardando ho trovato che
`formati_tavolo` e `impostazioni_tesoreria` hanno quella colonna e nessun
trigger**: lì `aggiornato_il` è fermo al giorno della creazione, cioè
dice una cosa falsa. *Non corretto: è un lavoro a sé.*

---

## 4 · Le sei cose del collaudo

### (a) Un ingrediente si può togliere

Le due strade come le hai chieste. ⚠️ E `ingredients.active` **era in
tabella dal primo giorno**: tutto acceso, e muto — la stessa forma della
soglia di magazzino del 13/08.

🔴 **Trovato dalla prova sui dati veri**: creare un ingrediente **scrive
subito una riga nello storico prezzi**, quindi il controllo ne trovava
sempre uno e rifiutava *qualunque* cancellazione. La strada che avevi
chiesto non esisteva in pratica — c'era il pulsante e non funzionava mai.
⚠️ **La verifica dentro la migrazione non poteva prenderlo**: lì
l'ingrediente si crea senza prezzo. Il difetto vive nel tratto fra
schermata e database.

⚠️ **La distinzione la dice lo schema**, non un elenco a mano: delle 13
tabelle che puntano a un ingrediente, due lo seguono nella tomba — non
sono usi, sono appendici.

🔴 **E uno spavento**: lo script che doveva cancellare il tuo «test 1»
**puntava alla produzione**. Non ha fatto danni solo perché lì
`ingredients` è vuota: ha letto zero righe e ha risposto «non c'è più»,
che era una risposta giusta sul database sbagliato. Rifatto con la
barriera di `dev:prova`: **119 ingredienti visti, «test 1» cancellato**,
661 lapidi prima e dopo.

### (b) 🔴 Il riquadro del tavolo scorreva già prima

**La correzione del 23/08 era stata verificata alla calibrazione
sbagliata.** Rimisurato col valore del tablet: il contenuto chiedeva
**111 punti su 84** — scorreva ancora, col nome alla taglia normale.
*Trappola del 21/08: i due effetti vanno nella stessa direzione.*

⚠️ **E ingrandire il nome non si può**, misurato: 16 lettere chiedono 213
punti a 4 mm e **331 a 6,2**, e la riga ne ha 205. Provato: a 6,2 si
troncava a «Ales…» — peggio di piccolo. La taglia che fa stare **nove
nomi su dieci** (novantesimo percentile dei nomi veri: 15 lettere) è
quella normale.

🔴 **E ci sta un nome solo**: due nomi leggibili chiedono 112 punti su 95
e scorrono a qualunque taglia. Se ne mostra **quello che serve adesso** —
la prenotazione finché è sola, il pagante appena c'è.

⚠️ **Scelta interpretata, non misurata**: quale dei due nomi conta di più
non me l'ha detto nessuno. L'ho dedotta dalla tua regola del 23/08 —
«pagante, orario e coperti visibili subito». **Da confermare.**

Adesso: **95 punti su 95 in tutt'e due i casi**.

### (c) Il filtro «Beverage»

Le due condizioni rispettate: i sottogruppi restano, ed è un modo di
guardare — nessun prodotto cambia categoria.

🔴 **E ho rotto la schermata per dieci minuti senza che nessun controllo
se ne accorgesse**: spostando il calcolo delle bevande sopra la funzione
che le raggruppa, pagina **bianca**. ⚠️ Lint pulito, build riuscita, 384
prove verdi — è un errore di **ordine**, che nessun controllo statico
vede. L'ha trovato l'averla aperta.

Provato contando le voci: **Tutte 27 · Primo 4 · Beverage 10 in 5
sottogruppi**.

### (d) Un tasto per ogni turno

⚠️ **È la correzione di una decisione mia**: il 21/08 avevo scritto nel
codice «non c'è un torna indietro». Quella frase descriveva un gesto che
in sala non esiste, e **descriveva il caso sbagliato**: il cliente non ha
sbagliato, ha cambiato idea.

🔴 **E provandolo ho trovato un difetto mio**: aprendo il 3° turno e
tornando al 1°, **il 2° e il 3° sparivano** — erano vuoti, quindi nessuna
riga li nominava. *Un turno aperto e ancora vuoto esiste lo stesso.*

### (e) «Chef Table» non sfora più

Tre difetti uno dentro l'altro: la stima usava le taglie **di prima del
21/08** (36 invece di 44), decideva **solo se girare**, e guardava **la
sala invece della sagoma**.

⚠️ **E la prima cura era peggiore del male**: `textLength` avrebbe
compresso il nome del **62%**. Sostituita col carattere che si
rimpicciolisce, mai sotto 3,2 mm.

Misurato dopo su **tutte e 26 le etichette e in tutt'e due le piante**:
nessuna sfora.

### (f) Il ricevimento merci

L'ultima delle quattro schermate HACCP con l'elenco infinito. Adesso
«arrivato oggi» + archivio mensile scaricabile e stampabile, sulla
**serata di servizio**.

⚠️ **Misurato provando**: `haccp_goods_receiving` **non è fra le tabelle
tracciate** — scoperto perché spegnere il trigger delle lapidi falliva.

---

## 4-bis · 🔴 Una funzione che esisteva gia', riscritta a memoria

**Trovato da due reti del progetto in dieci minuti**, non rileggendo.

Scrivendo la struttura del conto bancario ho creato `set_aggiornato_il()`
con un commento che diceva «la funzione va scritta, non evitata». **Quella
funzione esiste dal 12/08**, e la usa anche `articoli_fornitore`.

⚠️ **E' la regola del 18/08 violata nel file che la cita**: *una funzione
si riscrive prendendo il corpo VIVO dal database, mai a memoria*. Cosi' ho
cambiato in silenzio due cose che nessuno mi aveva chiesto di cambiare —
da `security invoker` a `security definer`, e i permessi.

⚠️ **E non era innocuo per una terza tabella**: `articoli_fornitore` usa
quella funzione da agosto, e renderla `definer` cambia sotto quali
permessi si aggiorna una colonna su una tabella che non stavo nemmeno
guardando.

**Le due reti, in fila:**
1. la prova dei permessi ha visto la funzione **sparire** dall'elenco
   delle dieci aperte con la chiave pubblica;
2. il controllo delle guardie ha visto il corpo **perdere il definer**
   mentre gia' correggevo — e mi ha costretto a **dichiararlo** invece di
   tirare dritto.

⚠️ **La cura e' rimetterla com'era, non tenersi il «miglioramento»**:
chiuderla ai permessi puo' anche essere giusto, ma e' una decisione a se'
che riguarda due tabelle e va presa guardandole.

🔴 **E la trappola del 16/08 mi ha morso dentro questa correzione**:
`now()` in una transazione e' un istante solo, e `pg_sleep` non lo muove.
La verifica confrontava due letture identiche e diceva «il trigger non
scrive piu'» su un trigger che scriveva benissimo.

---

## 5 · Cosa abbiamo rovesciato

**Due voci.**

**1 · «Un turno sbagliato si corregge togliendo la riga e rimettendola»**
(21/08, scritto da me nel codice). *La ragione di allora* era che
aggiungere un «torna indietro» non era stato chiesto. *Adesso* c'è un
tasto per turno. *Perché non vale più*: quella frase descriveva un gesto
che in sala non esiste — chi serve non cancella tre piatti per spostarne
uno — e soprattutto **descriveva il caso sbagliato**.

**2 · «Il nome del cliente sul tavolo si vede sempre insieme alla
prenotazione»** (23/08). *La ragione di allora* — chi arriva dice «ho
prenotato a nome tale», e quel nome serve prima di sapere chi paga —
**vale ancora**. Quello che è cambiato è la misura: in 205 × 95 punti due
nomi leggibili non ci stanno, a nessuna taglia. **Questo è il prezzo che
accettiamo**, e il nome che esce sta per intero nel pannello.

---

## 6 · Cosa NON è verificato

### Non l'ha visto nessun occhio

- **Le sei migrazioni non sono in produzione**: 212 contro 218. Aspettano
  il push.
- **Il tablet non è stato toccato.** Le misure del riquadro sono fatte
  imponendo le condizioni del tablet (pianta 409 punti, `--pxcm` 64) su
  questo schermo: è una simulazione fedele nei numeri, non un tablet.
- **La stampa dell'archivio del ricevimento non è stata guardata**: c'è
  il pulsante, nessuno ha aperto l'anteprima.
- **Il rifiuto dei nuovi vincoli non è stato visto in italiano a
  schermo**: la traduzione c'è ed è provata nel database, ma nessuno ha
  provocato un rifiuto dall'app.

### Dato per fatto senza misurarlo

- **La scelta di quale nome mostrare sul tavolo** (punto b) è
  interpretata da una tua regola, non misurata.
- **Il criterio con cui ho scartato 74 delle 76 colonne senza vincolo**:
  le ho lette una per una, ma è un giudizio.

### Affermazioni diventate false mentre lavoravo

- Nel commento della migrazione dei conti avevo scritto che
  `haccp_goods_receiving` è tracciata: **non lo è**, l'ho scoperto dopo,
  provando. Corretto prima del commit.
- Avevo scritto che il riquadro del tavolo misura «53,8 × 25,1 mm»: la
  prima misura di stanotte aveva preso **il contenitore sbagliato** e
  dava 101,6 × 47,3. Il valore vero è **47,9 × 22,3 mm** su questo
  schermo, ~32 × 15 sul tablet.

---

## 7 · Le prove

- **384 prove pure** e **362 sul database di prova**, tutte verdi.
- ⚠️ E la prima esecuzione era rossa su 42 file: **avevo lanciato due
  giri insieme**, e le prove sul database non vanno in parallelo — il
  database e' uno solo (§8). Rilanciate da sole: verdi.
- **Lint a zero**, build pulita, gancio pre-commit passato su tutti e 18
  i commit della notte.

---

## 8 · Cosa resta aperto

1. **`aggiornato_il` che mente** su `formati_tavolo` e
   `impostazioni_tesoreria`: la colonna c'è, il trigger no.
2. **Il debito «percento» nel suo insieme**: 13 colonne in punti e 9 in
   frazione convivono ancora.
3. **Le schermate del multi-conto**, se e quando aprirai il secondo.
