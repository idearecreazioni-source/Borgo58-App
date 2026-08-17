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
| **A** | Il punto 0: `--azzera` dichiara cosa butta via, e la sala «di sempre» può tornare | è un difetto che **agisce adesso** — ogni ricostruzione del progetto di prova costa ad Alessio il lavoro di ridisegnare la sala |
| **B** | I punti **2 + 1**: i coperti dentro il tavolo, poi «c'è posto a quell'ora?» | il secondo **non esiste senza il primo**: senza i posti sul tavolo non c'è niente da contare. E il 2 tocca un vincolo del database, quindi va da solo |
| **C** | I punti **3 + 4**: le tre fasce e «da liberare entro le…» | ⚠️ **non si separano**: il 3 senza il 4 è una regola che vale solo sulla carta, perché in servizio nessuno la vede |
| **D** | I punti **5 + 6**: evidenziazione incrociata e lista riordinata | sono la stessa fatica vista da due lati, e toccano le stesse due schermate |
| **E** | Il punto **7**: la pianta nello schermo | va misurato per ultimo, perché B e C cambiano cosa c'è **dentro** una sagoma — e quindi quanto spazio serve |

⚠️ **Il punto 0 non è un preliminare da sbrigare**: è l'unico che oggi fa
perdere lavoro vero a ogni ricostruzione.
