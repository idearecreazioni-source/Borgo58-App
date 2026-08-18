# La sala e le prenotazioni

**Mandato del 18/08/2026**, nato dalla **serata recitata** provata da Alessio
col telefono in mano. Non è un elenco di difetti: è un pezzo di disegno, e va
spezzato in più giri.

---

## Da dove nasce

Quella schermata fa **due mestieri diversi e li fa nello stesso modo**:

- **in servizio** la sala la usa per accompagnare i clienti al tavolo — e la
  deve **toccare**, non solo leggere;
- **fuori servizio** serve a prendere e sistemare prenotazioni, e questo lo
  fanno **tutti**, non solo Alessio, per lo più **dal telefono**.

⚠️ **Quindi il telefono non è il caso secondario: è la strada maestra.** E
oggi il gesto più frequente — prendere una prenotazione — passa per forza dal
gesto più difficile: una pianta larga che sullo schermo non entra.

---

## 0. La misura, fatta prima di tutto il resto

**La domanda**: `prova:scenario` sovrascrive la disposizione che Alessio
aveva salvato come «di sempre»? Se sì va dichiarato — *un comando che riporta
indietro una scelta senza dirlo è una piccola trappola.* Se no, il difetto è
un altro e va trovato.

### 🔴 Misurato: **non è lo scenario. Sono io.**

`scripts/prova-base.mjs` **legge** `dining_tables` e non ci scrive mai: nessun
`update` sulle posizioni, nessuna riga in `disposizioni_giornaliere`. La
demolizione tocca `order_tables` e `prenotazione_tavoli`, entrambi marcati
`BASE-`, e non la pianta.

**La causa è un'altra**: la sera del 17/08 ho eseguito
`npm run prova:ricostruisci -- --azzera` per riparare due funzioni rotte in
memoria del database. Quel comando **svuota il progetto e riapplica le
migrazioni**, e le sagome della sala tornano alle posizioni scritte in
`20260804000008_dining_tables.sql`.

⚠️ **E qui c'è la trappola vera, che il mandato ha fatto emergere chiedendo
una misura invece di una correzione**: dal 14/08 «questa diventa la base»
scrive lo scostamento **dentro `dining_tables`**. Quindi la disposizione «di
sempre» di Alessio **non è un dato di una migrazione: è un dato suo**, e
`--azzera` la butta via senza dirlo, insieme a tutto il resto.

**Stato misurato adesso sul progetto di prova**: 13 sagome (quelle della
migrazione), 4 scostamenti in `disposizioni_giornaliere` — creati da Alessio
durante la serata recitata, dopo la ricostruzione.

### Cosa ne consegue, e non è il punto 1

Due cose, entrambe **da fare**, e nessuna delle due è «correggere lo
scenario»:

1. **`prova:ricostruisci --azzera` deve dire cosa sta per buttare via**, e
   nominare le cose che sono *di Alessio* e che nessuna migrazione rimetterà
   — a partire dalla pianta della sala. Oggi elenca i prerequisiti e non le
   perdite.
2. **La disposizione «di sempre» si prende dalla PRODUZIONE** — decisione del
   18/08, e ha scartato le due strade che avevo proposto perché *avevano lo
   stesso difetto in due versi*:
   - **congelarla nello stato di partenza** la renderebbe *una sala decisa una
     volta*: il giorno che Alessio la cambia, la ricostruzione successiva
     gliela riporta indietro — **lo stesso difetto di oggi, solo più difficile
     da vedere perché sembra voluto**;
   - **esportarla a mano** è un gesto che ci si ricorda di fare *solo dopo*
     aver perso il lavoro.

   **La sala vera vive in produzione.** Se `prova:ricostruisci` se la va a
   prendere da lì, **non invecchia mai e resta di Alessio senza che lui faccia
   niente** — ed è lo stesso criterio con cui si è deciso cosa deve esistere
   sul progetto di prova: *la lista non la scegliamo noi, la leggiamo dal
   locale vero* (`prova:stato`, 16/08).

   ### Misurato: è praticabile

   | | |
   |---|---|
   | Gli script leggono già la produzione | **sì** — `prova-stato.mjs` usa `DB_URL_PRODUZIONE`, con la guardia che punti davvero al progetto del locale |
   | La sala vera in produzione | **13 sagome**, 2 ruotate |
   | Scostamenti giornalieri in produzione | **0** |

   ⚠️ **Si copia solo `dining_tables`, non `disposizioni_giornaliere`**: i
   secondi sono lo scostamento *di una giornata*, non la sala di sempre.
   Copiarli porterebbe sul progetto di prova la disposizione di un martedì.

   ⚠️ **E la lettura della produzione resta in SOLA LETTURA**, con la stessa
   guardia di `prova:stato`: un comando che ricostruisce il progetto di prova
   non deve poter scrivere una riga sul locale vero.

   *Se un giorno quella lettura non fosse praticabile, si ripiega
   sull'esportazione a mano — **non** sul congelamento: meglio un gesto in più
   che una sala che torna indietro da sola.*

---

## 1. Prendere una prenotazione dal telefono, senza pianta

Squilla il telefono: «siamo in sei, sabato alle 20». La domanda è **«c'è
posto?»**, non «quale tavolo».

Serve vedere **quanti posti restano a quell'ora** e **quali tavoli sono
liberi** — perché capita che il cliente chieda una postazione precisa. Il
tavolo si può assegnare dopo, con calma.

⚠️ **L'app avvisa, non impedisce.** Se i posti sono finiti lo dice; decide
Alessio.

⚠️ **Nota di contesto, da tenere presente prima di scrivere codice**: il
14/08 il calcolo dei posti liberi è stato **rimosso** — `dining_tables.seats`,
`posti_liberi()`, la durata del tavolo e il tetto dei coperti non esistono
più, e la rimozione fu una decisione motivata (*«due persone a un tavolo da
sei lasciano quattro posti che non esistono»*). Questo punto **non è un
ripristino**: i posti tornano a esistere, ma **dentro il tavolo** (punto 2) e
non come un secchio unico. Va scritto nel riepilogo, o fra sei mesi sembrerà
che si sia tornati indietro.

## 2. I coperti dentro il tavolo

Sul tavolo si legge **quanti ne tiene**. Accostandone due o più, diventano un
rettangolo unico col numero aggiornato.

**La regola va scritta, non dedotta dalla geometria**: somma dei posti **meno
due per ogni giunzione** (due tavoli da 4 fanno 6, perché si perdono i posti
dove si toccano). Un tavolo contro il muro perde un posto, quindi **la
capienza è quella in questa disposizione**, e va detto.

⚠️ **Il numero resta correggibile a mano, e quando è stato corretto si vede**:
su quella cifra si decide se accettare una prenotazione, quindi deve poter
essere **quella vera** e non quella calcolata.

⚠️ **Il vincolo del 14/08 va rivisto, non aggirato**: `dining_tables_sagoma_check`
**rifiuta** un `tavolo` con `posti_fissi` — i posti li hanno solo divani e
Chef Table, che sono arredi fissi. Questo punto cambia quella decisione, e il
cambiamento va **dichiarato**, non fatto scivolare dentro una migrazione.

### I numeri veri di Alessio — al posto di qualunque esempio (18/08)

| sagoma | coperti |
|---|---|
| tavolo 90×90 | **4** |
| tavolo 180×90 | **6** da solo |
| Chef Table | 4 |
| divano | 6 (×3) |

⚠️ **CORRETTO IL 18/08, su domanda del validatore.** Il testo originale di
questa avvertenza diceva: *«i due tavoli da 180 NON sono accostabili: la
regola dell'accostamento vale solo fra i 90×90, e i 180 restano 6 fissi»*.
Resta qui come origine della decisione, ma **non è quello che ha detto
Alessio**. La sua regola è **lo stile**, non la misura: i due da 180 sono
accostabili **fra loro** (stesso stile) e non lo sono **verso i 90×90**.

Quindi: **il gesto resta acceso dentro ciascun formato e si spegne solo fra i
due gruppi**, e la regola «somma meno due per giunzione» vale su entrambi.
Due 180 accostati fanno **10**; tre 90×90 in fila fanno **8**.

*Non è un vincolo di calcolo, è un fatto della sala*: il gestionale **non deve
nemmeno offrire** l'accostamento fra un 180 e un 90×90.

⚠️ **Chef Table e divani restano FUORI dal conteggio di «c'è posto?»**, e la
ragione è che sono **due formule diverse**: chi chiama per cenare vuole un
tavolo, chi chiama per l'aperitivo può scegliere fra tavolo e divano. Il
conteggio dei coperti della cena guarda **i 9 tavoli**.

⚠️ **Il posto perso contro il muro NON è una proprietà del tavolo**: dipende
da come Alessio lo mette **quel giorno**. Quindi è una correzione della
**disposizione del giorno**, non un attributo della sagoma — scriverlo su
`dining_tables` se lo porterebbe dietro anche i giorni in cui quel tavolo sta
in mezzo alla sala.

⚠️ **PRECISATO IL 18/08, rilievo del validatore: la collocazione era giusta,
il meccanismo separato no.** Alessio ha già chiesto che il numero sia
**sempre correggibile a mano**; costruire *accanto* un meccanismo «contro il
muro» darebbe **due strade per lo stesso numero** — e il flag saprebbe solo
sottrarre, cioè sarebbe strettamente meno espressivo. Peggio del doppione:
potendo contraddirsi, servirebbe una regola di precedenza inventata da chi
scrive il codice.

**Quindi il «contro il muro» non si costruisce**: c'è **una sola correzione a
mano**, con la ragione scritta accanto se serve — «uno contro il muro» è una
di quelle ragioni, non un meccanismo.

⚠️ **E la chiave è l'INSIEME di tavoli di quel giorno**, non il singolo
tavolo: Alessio corregge il numero che *guarda*, che è quello del rettangolo.
Un tavolo singolo è un insieme di uno. Conseguenza decisa da lui: **sciogliendo
un tavolone la correzione decade** e il numero torna a quello calcolato — e lo
schermo lo dice.

**Soglia di avviso: 25 coperti** prenotati per la serata. La cucina regge 30,
la sala ne fa 40 sulla carta: la soglia è **più bassa di proposito** per il
rodaggio, quindi è un **parametro modificabile da Alessio**, non un numero nel
codice. **Avvisa, mai impedisce.**

### Le tre cose da tenere ferme

1. **La capacità base per formato di sagoma è un dato di Alessio**,
   modificabile senza migrazione — non una costante nel codice. Stessa forma
   dei parametri del simulatore assunzioni e delle causali.
2. **Il rovesciamento della decisione del 14/08 va dichiarato nel riepilogo,
   con la vecchia ragione accanto alla nuova.** Il giro B non la smentisce: la
   rende più precisa. ⚠️ Ed è il **secondo rovesciamento** di una decisione
   motivata in questo mandato, dopo quello sul calcolo dei posti.
3. **Il numero calcolato e il numero corretto a mano devono restare
   distinguibili**: se Alessio scrive 7 dove la regola dice 6, quel 7 **non
   deve sparire alla prima ricostruzione dell'accostamento né essere
   ricalcolato sopra in silenzio** — è il caso «campo svuotato che diventa
   zero» del 17/08 in un'altra veste. E **in sala deve vedersi quale dei due
   si sta guardando**.

### Due avvertenze operative

⚠️ **Se si allarga `dining_tables_sagoma_check`**: i vocabolari chiusi di
questo progetto hanno già mostrato **tre volte** di stare in più posti di
quanti sembra (database, funzione, elenco della schermata). La rete del 17/08
dovrebbe accorgersene — **va verificato che scatti davvero**, non dato per
fatto.

⚠️ **E la misura che dimostra il conteggio non è «25 su una sala ferma».** Un
accostamento **abbassa** il totale (due tavoli da 4 accostati fanno 6, non 8),
quindi la capienza della serata **non è una costante: dipende dalla
disposizione di quel giorno**. La prova che vale è quella che produce la
differenza: **stessa sera, stesse prenotazioni, due disposizioni diverse, due
totali diversi.**

---

## 3. Tre fasce di colore

**Giallo** entro le 20 · **verde** dalle 20 alle 22 · **arancio** dopo le 22.

E **la regola dei turni discende dall'ora**: giallo e arancio stanno insieme
sullo stesso tavolo, il verde occupa la serata. **Vale nei due sensi** — un
tavolo già prenotato alle 22:30 può accogliere qualcuno alle 19:30, purché
liberi in tempo.

*Contesto*: oggi ci sono **due** colori (giallo/verde) sulla soglia di
`service_settings.ora_primo_turno`. Questo punto ne aggiunge un terzo e rende
la regola bidirezionale.

## 4. «Da liberare entro le…» deve arrivare in sala

⚠️ **È la condizione perché il punto 3 valga soldi.** Se accetti gente alle
19:30 «purché liberi per le 22» e quella nota resta nella scheda della
prenotazione, **in servizio nessuno la vede**: il tavolo non si libera e il
secondo turno salta.

Va scritta **sul tavolo, nella pianta, e sulla comanda** — è chi serve che
deve sapere quando portare il conto.

## 4-bis. I tavoli accostati si vedano come un tavolone (18/08, dopo il giro B)

Rilievo di **disegno** di Alessio guardando il giro B dal telefono — **non un
difetto**: i numeri sono giusti e il tavolone mostra il numero del gruppo. Ma
lui si aspettava che le sagome **si fondessero in un rettangolo unico**, e
invece vede ancora quadrati accostati con un numero solo sopra.

**Via di mezzo proposta da lui, e va bene**: i lati di giunzione resi come
**una linea unica, sottile e poco visibile**, invece della fusione completa.

⚠️ **Ed è probabilmente meglio della fusione** (osservazione del validatore):
un rettangolo unico **perde l'informazione di quanti tavoli lo compongono** —
che serve nel momento in cui si smonta, e serve alla **correzione a mano, che
ha per chiave proprio l'insieme dei tavoli**. La linea sottile dice tutte e
due le cose: *«questo è un tavolone»* e *«è fatto di tre»*.

⚠️ **Non va nel giro C.** È lavoro di disegno, e sta con la **stessa mano**
che tocca la pianta. ✅ **Deciso il 18/08 dopo il giro C: va col giro E**, che
è il prossimo — la pianta che entra nello schermo del telefono e i lati di
giunzione sottili sono la stessa mano sullo stesso disegno.

## 5. Evidenziazione incrociata

Tocchi un tavolo prenotato → compare vicino ed **evidenziata** la scheda di
chi ci siede. Tocchi la prenotazione → si evidenzia il tavolo.

Oggi per accompagnare qualcuno bisogna **incrociare due elenchi con gli
occhi**: è la causa principale della fatica che Alessio ha descritto.

## 6. La lista prenotazioni, riordinata per il telefono

Oggi è piatta: **i comandi pesano quanto le informazioni**. «Cambia tavolo» è
un riquadro grande ripetuto sette volte, mentre quello che si legge mille
volte è **ora → nome → quanti → dove**.

Informazione in primo piano, comandi discreti o dietro un tocco.

⚠️ **E manca lo stato: chi è già arrivato e chi no.** Alle 21:15, con due
tavoli liberi e uno che tarda, è la prima domanda che ci si fa.

## 7. La pianta deve entrare nello schermo

Sul telefono resta **più larga del display** e si legge tagliata. Alessio userà
un mini tablet in sala, ma **il telefono è quello che si ha in tasca quando il
tablet è occupato**.

*Contesto*: dal 14/08 la pianta si mette in piedi da sola sotto una soglia
misurata in **centimetri veri** (`inPiedi = "auto"`), e la larghezza minima
non è arbitraria — il tavolo più piccolo è 90 cm e il target di tocco è
1,05 cm reali, quindi ≈24 cm. Sotto quella soglia **non si rimpicciolisce** e
la sala scorre. Questo punto chiede di rivedere quella scelta: va misurato
cosa succede davvero su uno schermo da telefono prima di cambiarla.

---

## Come lo spezzo — proposta, da confermare

| giro | cosa | perché in quest'ordine |
|---|---|---|
| **A** | ✅ **FATTO il 18/08** ([riepilogo](../consegne/20260818_giro_a_la_sala_non_si_perde.md)). Il punto 0: `--azzera` dichiara cosa butta via, e la sala «di sempre» può tornare | è un difetto che **agisce adesso** — ogni ricostruzione del progetto di prova costa ad Alessio il lavoro di ridisegnare la sala |
| **B** | ✅ **FATTO il 18/08** ([riepilogo](../consegne/20260818_giro_b_i_coperti_dentro_il_tavolo.md)). I punti **2 + 1**: i coperti dentro il tavolo, poi «c'è posto?» | il secondo **non esiste senza il primo**: senza i posti sul tavolo non c'è niente da contare. E il 2 tocca un vincolo del database, quindi va da solo |
| **C** | ✅ **FATTO il 18/08** ([riepilogo](../consegne/20260818_giro_c_le_tre_fasce_e_il_turno.md)). I punti **3 + 4**: le tre fasce e «da liberare entro le…» | ⚠️ **non si separano**: il 3 senza il 4 è una regola che vale solo sulla carta, perché in servizio nessuno la vede |
| **D** | ⏭️ **IL PROSSIMO.** I punti **5 + 6** (il 4-bis è andato col giro E): evidenziazione incrociata, lista riordinata e i lati di giunzione come linea sottile | sono la stessa fatica vista da due lati, e toccano le stesse due schermate. ⚠️ **Tre cose decise il 18/08 dopo il giro E**, sotto |
| **E** | ⏭️ **IL PROSSIMO** (deciso da Alessio il 18/08, dopo il giro C), insieme alla **linea di giunzione sottile** del 4-bis. Il punto **7**: la pianta nello schermo | ⚠️ **Non è una rifinitura: è ciò che sblocca il collaudo di tutto il resto.** Ogni prova che Alessio fa dal telefono — e le prenotazioni si prendono per lo più da lì — **inciampa nella pianta troppo grande prima ancora di arrivare a ciò che stava provando**. Ed è la seconda volta che ci inciampa. Va con la linea di giunzione perché sono la stessa mano sulla stessa pianta |

⚠️ **Il punto 0 non è un preliminare da sbrigare**: è l'unico che oggi fa
perdere lavoro vero a ogni ricostruzione.


---

## Il giro D — cosa è già deciso, prima di cominciare (18/08, dopo il giro E)

### 1. «Arrivato» non si segna: si deduce. Terza strada, di Alessio

*«Il tavolo si presume arrivato quando viene aperta la comanda e, se dopo 30
minuti non viene ancora aperta, il tavolo diventa rosso — così vediamo a colpo
d'occhio se un cliente ha sforato l'orario utile per conservargli il tavolo e
poterlo eventualmente riassegnare.»*

⚠️ **Batte tutte e due le strade che avevo proposto** (un quinto stato,
oppure un orario di arrivo) per una ragione sola: **non chiede a nessuno di
segnare niente.** L'arrivo si deduce da un gesto che in sala si fa comunque,
quindi non esiste il caso «arrivato ma nessuno l'ha segnato» — che è il modo in
cui questi campi muoiono. E risponde alla domanda operativa vera, che non è
*«è arrivato?»* ma **«posso ridare via questo tavolo?»**.

- **I 30 minuti sono un parametro di Alessio**, in *Sala e orari*, come la
  soglia dei 25 coperti. Non un numero nel codice.
- **Il rosso prende tutto il tavolo** al posto del colore della fascia, non si
  aggiunge come bordo. Sua decisione, con la ragione: *il ritardo è l'unica
  delle due informazioni su cui deve agire subito.*
- ⚠️ **Il rosso è CALCOLATO, mai scritto**: nasce dal confronto fra l'ora
  della prenotazione, i minuti di tolleranza e l'esistenza del conto. Nessuna
  colonna «in ritardo» — sarebbe un dato che invecchia da solo.
- ⚠️ **La legenda deve dichiarare la precedenza.** Oggi elenca quattro voci; un
  colore che ne sovrascrive altri, senza che la legenda lo dica, si legge come
  un colore che non esiste da nessuna parte.

### 2. Le due colonne sul computer — RIMANDATE, con la ragione

Deciso da Alessio dopo la misura: per farcele stare la pianta dovrebbe girare
in piedi anche sul monitor, cioè **rovesciare la decisione della mattina** — e
il computer non è mai stato il problema. Con l'elenco dei tavoli che sparisce
(punto 4 qui sotto) c'è anche **meno da mettere di fianco**. Si riprendono
quando si lavorerà sul computer sul serio.

### 3. La seconda lista — dentro il giro D, e la cura è sua

*«Nella schermata eventi bisogna scorrere verso destra per vedere tutti i
dettagli delle prenotazioni, mentre basterebbe fare come è dentro la sala dove
i dati vanno a capo.»*

Sul telefono ogni prenotazione diventa **un blocchetto con le informazioni a
capo**, non una riga di tabella che scorre di lato. Sul computer la tabella
resta: lì funziona, ed è la stessa distinzione del punto 2 — *si cura dove fa
male.* ⚠️ **E il tavolo entra fra le informazioni**: oggi non c'è, ed è il
dato che serve di più a chi guarda dal telefono. ⚠️ **I due mestieri restano
separati**: quella schermata cerca fra tutte le date, l'altra governa una
giornata. Non si fondono.

### 4. Il riquadro del tavolo — richiesta di Alessio

Sparisce l'elenco dei tavoli sotto la pianta coi pulsanti «Correggi il
numero». Toccando un tavolo si apre **un riquadro con tutto**: prendere o
aprire la prenotazione **e** la casella dei coperti insieme, non due gesti
diversi. Le altre due informazioni dell'elenco — quali tavoli sono accostati,
chi ha corretto e quando — le considera superflue **a schermo**.

⚠️ **Non si tolgono dal DATABASE**: «chi ha corretto e quando» lo scrive il
trigger da sé, ed è ciò che permette di spiegare un numero tre giorni dopo. Se
il riquadro ha spazio, una riga piccola in fondo costa poco.

⚠️ **Il riquadro ASSORBE il tocco che oggi apre la prenotazione, non gli si
affianca**: due strade per lo stesso gesto è il doppione che questo progetto
continua a togliere.
