# Lo scenario di collaudo su scala vera

**Blocco 2 del mandato del 22/08** (reperto di Alessio dal collaudo).
**Nessuna migrazione** — ⚠️ tutto sul **solo progetto di prova**.

---

## 1 · La scala non è stata scelta: è stata misurata

Il mandato chiedeva di misurare **prima**, e di giustificare i numeri.

Sul tablet vero (768 punti, `--pxcm` a 74), nella schermata degli
ingredienti:

| | prima | dopo |
|---|---|---|
| ingredienti | 15 | **110** |
| altezza di una riga | 70,3 px | **56,5 px** |
| righe visibili senza scorrere | 11 | **14** |
| lunghezza della pagina | 1,3 schermate | **6,4 schermate** |
| nomi che vanno a capo | **87%** (13 su 15) | **25%** (28 su 110) |

**11 righe è la soglia in cui una schermata cambia mestiere**: sotto si
guarda, sopra si cerca. Con 15 ingredienti si era appena sopra — *sembrava*
di provare lo scorrimento e non si provava niente.

⚠️ **E la riga si è abbassata di 14 px** perché meno nomi vanno a capo: è un
effetto che non avevo previsto e che si vede solo misurando dopo. Togliere il
prefisso non ha solo raddrizzato le misure — ha fatto entrare **il 27% di
righe in più** in una schermata.

## Da cosa nasce il numero

Dalla carta che Alessio ha descritto: **20 finger e 12-15 piatti**. Ogni
piatto composto passa da due o tre preparazioni, e ogni preparazione da
quattro o cinque materie prime, con molto riuso. Il conto torna al centinaio
che aveva detto lui, ed è quello che c'è:

| | |
|---|---|
| materie prime | **109** (105 alimentari + 4 di pulizia) |
| preparazioni | **41** |
| bocconcini | **24** |
| piatti | **28** |
| selezioni | **4** |
| **ricette in tutto** | **97** |
| **di cui in carta** | **17** (4 selezioni + 13 piatti) |

⚠️ **Il ricettario è più grande della carta, come in una cucina vera.** Nello
scenario vecchio **tutte e 35 le ricette erano «pronte per carta»**: adesso ce
ne sono **12 bozze** e 48 pronte ma fuori carta.

---

## 2 · 🔴 Il prefisso è uscito dai nomi

`BASE-` mangiava **5 dei 16 caratteri** che stanno nella colonna del nome —
il **31%**. Il 21/08 un disegno è stato scartato per un vincolo gonfiato così.

I nomi adesso sono quelli veri: *Astice*, *Pistacchio di Bronte*, *Pomodoro
secco di Pachino sott'olio*. Vanno da **4 a 35 caratteri**, e metà stanno su
una riga: servono **entrambi i casi**, perché nomi tutti uguali non
distinguono più dei numeri tutti tondi.

**Come si ripulisce, allora**: dagli **elenchi** di
[`scripts/scenario/carta.mjs`](../../scripts/scenario/carta.mjs). Costruzione
e pulizia leggono lo stesso file, quindi non possono divergere.

⚠️ **Dove il prefisso resta, dichiarato**: conti, movimenti, prenotazioni,
clienti, dipendenti, attrezzature. Lì nessuna misura di questo mandato è
stata falsata, e il marchio serve. Toglierlo anche di là è una coda.

### 🔴 E il passaggio ha aperto un buco, misurato

Dopo il primo giro col catalogo nuovo la dispensa aveva **122 prodotti invece
di 109**: tredici col vecchio prefisso, **orfani per sempre** perché nessun
elenco li nominava.

⚠️ **La forma generale, che vale oltre questo caso**: *quando si cambia il
modo di riconoscere una cosa, il modo vecchio va tenuto in vita dalla parte
che **pulisce**, non da quella che scrive.* Altrimenti il passaggio lascia
dietro di sé esattamente le righe che doveva togliere — e non lo dice.

---

## 3 · 🔴 «TEST-AUTO scarico» a 0,00 €/kg: non era un residuo

Alessio pensava fosse rimasto lì da vecchie prove. **Misurato: è una prova
automatica che lo ricrea a ogni esecuzione**, e nel suo codice c'è scritto che
resta apposta — cancellarlo cambierebbe il suo identificativo ogni volta.

⚠️ **Ma il reperto regge lo stesso, e il difetto è un altro**: non l'esistenza,
il **costo zero**. Quell'ingrediente sta in mezzo ai cento veri, e un
ingrediente che costa zero fa un food cost sbagliato **senza dire niente**.

**Cura**: ha un prezzo (8,40 €/kg). Il costo dello scarico si prende dai
**lotti**, quindi la prova misura esattamente quello di prima.

🔴 **E metterlo alla creazione non bastava**: l'ingrediente esiste già da
giorni, quindi quel ramo non veniva mai percorso e il prezzo restava zero. È
la trappola del 12/08 — *seminare senza aggiornare non fa nulla sulla riga che
c'è già* — vista da questa parte. Misurato dopo: **zero ingredienti a costo
zero**.

---

## 4 · Due cose che ha insegnato il database, non io

### 🔴 I finger non vanno in carta

Mettendoceli, il database ha risposto: *«In un menu ci vanno solo i piatti:
"Cannolo salato di ricotta" è un bocconcino.»*

**Ha ragione** — è la decisione del 20/08. Quello che si vende è una
**selezione**, un piatto finito fatto di bocconcini. Senza quel rifiuto lo
scenario avrebbe collaudato un modello che il gestionale non ammette.

### ⚠️ Un finger vuole la sua resa

`componente_richiede_resa` pretende una resa su tutto ciò che non è un piatto
finito. Anche qui il vincolo ha ragione: un finger produce **pezzi**, e senza
saperlo non se ne può calcolare il costo.

---

## 5 · Due frasi diventate false, corrette

1. Il comando stampava *«Tutto è marcato BASE-»* — non più vero per
   ingredienti, ricette e menu.
2. Nel mio codice nuovo avevo scritto *«non tutti hanno giacenza: alcuni
   restano a zero apposta»*, e **nessuno era a zero**. Corretto **il dato,
   non la frase**: quindici prodotti hanno giacenza zero — i cari usati di
   rado e i deperibili — e sono la ragione per cui la lista della spesa ha
   qualcosa dentro.

### E la lista della spesa era corta perché girava troppo presto

**20 ingredienti sotto scorta minima e 3 righe in lista.** Il riempimento
girava **prima** che lo scenario creasse i cento ingredienti, quindi trovava
solo gli otto dello stato di partenza. Spostato in fondo: adesso sono **20**.

⚠️ *Una lista corta che sembra completa* — la famiglia della risposta più
breve che ha l'aria di essere intera.

---

## 6 · Resta rigenerabile con un comando

```
npm run prova:scenario
```

Rifà tutto da zero: pulisce (elenchi **e** vecchio prefisso) e ricostruisce.
Provato **quattro volte di fila** durante questo blocco, ed è così che sono
saltati fuori gli accumuli.

⚠️ **Il catalogo ha le sue prove** ([`tests/unita/scenario-carta.test.js`](../../tests/unita/scenario-carta.test.js),
10 controlli): componenti che esistono, niente cicli fra preparazioni, niente
doppioni, nessun marchio nei nomi, lunghezze varie, nessuna bozza in carta.
*Un catalogo incoerente farebbe fallire lo scenario a metà, lasciando il
database costruito per metà* — un errore così si vede in un secondo qui, e
dopo dieci minuti di esecuzione là.

**Rotto apposta**: rimesso `BASE-` su un nome → **3 prove rosse**, fra cui
quella giusta.

---

## ⚠️ Cosa NON è verificato

1. 🔴 **In produzione non è entrato niente**, e non c'era niente da
   applicare: nessuna migrazione.
2. ⚠️ **Alessio non ha ancora guardato lo scenario nuovo.** Le misure a
   schermo sono state fatte da qui, sul tablet simulato a 768 punti.
3. ⚠️ **I nomi dei piatti sono plausibili, non sono i suoi.** La carta
   somiglia alla sua — siciliana, finger, basi e preparazioni — ma i piatti
   veri li deciderà lui.
4. ⚠️ **Un ingrediente porta ancora il prefisso**: `BASE-Pomodoro di prova`,
   che nasce fuori dal blocco dello scenario. È nominato nella pulizia.
5. ⚠️ **Il food cost dei nuovi piatti non è stato guardato uno per uno**: le
   quantità sono plausibili, ma nessuno ha controllato che ogni piatto abbia
   un margine sensato.

---

## Cosa abbiamo rovesciato

**Una cosa, ed era una decisione scritta**: *«tutto quello che lo scenario
crea si chiama BASE-…, si riconosce a colpo d'occhio, si cancella senza
pensarci»* (10/08).

**La ragione di allora era buona** — un marchio visibile è il modo più
semplice per non lasciare dati finti in mezzo ai veri, ed è la regola di
Alessio del 12/08.

**Perché non vale più**: quel marchio è finito **dentro le misure**. Il 21/08
un disegno è stato scartato per un vincolo che il prefisso gonfiava del 28%, e
la stessa colonna oggi mostra 25% di nomi a capo invece di 87%. *Un marchio di
servizio che finisce sotto gli occhi non sporca i dati: sporca le misure*, e
le misure sono ciò su cui si decide.

⚠️ **E il prezzo si paga, dichiarato**: adesso «si riconosce a colpo d'occhio»
non è più vero per ingredienti, ricette e menu. Chi guarda la dispensa del
progetto di prova **non distingue** un prodotto dello scenario da uno che
avesse creato lui. La contropartita è che la pulizia non dipende più
dall'occhio ma da un elenco, ed è più precisa di prima — ma **il giorno che
Alessio crea a mano un ingrediente con lo stesso nome di uno del catalogo,
la pulizia se lo porta via.**
