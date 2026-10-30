# Il collaudo delle stampanti col portatile

Il collaudo si fa **dal fornitore**, sulle sue stampanti e sul suo registratore di prova. Il mini-PC non c'è ancora: al suo posto c'è il tuo portatile.

Il ponte è lo stesso che girerà sul mini-PC ([la guida del ponte](PONTE.md)), con tre differenze:
- **si accende a mano**, con un doppio clic, e si spegne chiudendo la finestra;
- **non si installa** come servizio di Windows: niente `installa.ps1`;
- **parla con Prova**, mai col gestionale vero.

Quattro parti:
- **A.** Si prepara una volta, a casa.
- **B.** Prova generale a casa con l'apparecchio finto, circa 20 minuti.
- **C.** Il giorno in negozio.
- **D.** Come togliere tutto dal portatile.

**Parole che tornano:**
- **Node** è il programma che fa girare il ponte.
- **Indirizzo IP** e **porta** sono il «numero di casa» di una stampante nella rete del negozio, per esempio `192.168.1.50` e `9100`.
- **ESC/POS**, **ePOS** e **FPMate** sono le tre «lingue» con cui si parla alle stampanti Epson e al registratore.

---

## A · Preparare il portatile (una volta)

### A0 · Che cosa ti do io prima
Il file **`ponte-collaudo.zip`**, in una chiavetta o per mail. Dentro c'è la cartella del ponte, e c'è già il file di configurazione con l'indirizzo e la chiave pubblica di Prova. Manca solo la chiave del ponte, che crei tu al passo A4. La chiave pubblica non è segreta: è quella che ha anche il sito.

### A1 · Il portatile resta sveglio
In **Impostazioni → Sistema → Alimentazione** (su alcuni portatili: «Alimentazione e batteria»):
- **Schermo e sospensione:** «Quando collegato all'alimentazione, metti il dispositivo in sospensione dopo» → **Mai**.

Poi, il giorno del collaudo:
- tieni il portatile **attaccato alla corrente** e **col coperchio aperto**;
- se Windows propone aggiornamenti o un riavvio, scegli **più tardi**.

Se il portatile si addormenta, il ponte si ferma senza avvisare e le prove restano «Aspetta il ponte».

### A2 · Node
1. Apri https://nodejs.org e scarica la versione **LTS** (il pulsante verde: LTS vuol dire «la versione stabile»).
2. Apri il file scaricato e premi sempre **Avanti**, lasciando le scelte già proposte. Alla fine premi **Fine**.
3. **Riavvia il portatile.** Senza riavvio i file del passo A5 possono non trovare Node, e dire che non è installato anche se lo è.
4. Per controllare:
   - nel menu Start cerca **Prompt dei comandi** e aprilo;
   - scrivi `node --version` e premi Invio;
   - deve rispondere con un numero che comincia per **v22** o più alto (per esempio `v24.11.0`).

### A3 · La cartella del ponte
1. Copia `ponte-collaudo.zip` sul Desktop.
2. Tasto destro sul file → **Estrai tutto…** → nella casella scrivi **`C:\Borgo58`** → **Estrai**.
   - ⚠️ Estrai sempre prima: un doppio clic su un file *dentro* lo zip non funziona.
3. Fai vedere a Windows le estensioni dei file, così i nomi si leggono interi: in una cartella qualsiasi apri **Visualizza → Mostra → Estensioni nomi file**.
4. In **`C:\Borgo58\ponte`** devono esserci, fra gli altri:
   - `ponte.mjs`;
   - `simulatore.mjs`;
   - **`config.json`**;
   - la cartella **`portatile`**, con tre file di comando: `1-verifica.cmd`, `2-accendi-il-ponte.cmd` e `3-apparecchio-finto.cmd`.

### A4 · La chiave del ponte, su Prova
1. Apri **il sito di Prova**, lo stesso che usi per provare le novità e non il gestionale di tutti i giorni, ed entra da titolare.
2. Vai in **Comande → Stampanti**. Nel riquadro «1 · Il ponte» la frase colorata deve dire che la chiave fa entrare il ponte in **«il database di prova»**. Se dice **«il locale vero»**, fermati: sei sul gestionale di tutti i giorni.
3. Premi **Crea la chiave del ponte**.
4. Compare una riga lunga di lettere, numeri e trattini. **Fai tre clic veloci sulla riga** (così si seleziona tutta, anche dopo i trattini) e premi **Ctrl+C**. Non si vedrà più.
   - Se la perdi, premi **Togli** accanto alla chiave e creane un'altra.
5. Apri `C:\Borgo58\ponte\config.json` col **Blocco note** (tasto destro → Apri con → Blocco note). Trovi:

   ```json
   {
     "indirizzo": "https://bnwqgpuyzmzujxfbtyvs.supabase.co",
     "chiavePubblica": "…già scritta…",
     "chiavePonte": "INCOLLA-QUI-LA-CHIAVE-DEL-PONTE",
     "simulatore": true
   }
   ```

6. Seleziona **solo** `INCOLLA-QUI-LA-CHIAVE-DEL-PONTE` (senza le virgolette) e premi **Ctrl+V**.
   - Le virgolette devono restare, una prima e una dopo la chiave.
   - Non ci devono essere spazi né a capo dentro.
7. **File → Salva** e chiudi.

Le altre righe non si toccano:
- **`indirizzo`** è quello del progetto di prova. La chiave del passo 3 vale solo lì.
- **`simulatore: true`** resta anche in negozio. Permette in più solo l'apparecchio finto, che sta dentro il portatile, e con gli apparecchi veri non cambia niente. Sul mini-PC, più avanti, sarà `false`.

### A5 · La verifica
1. Apri la cartella `C:\Borgo58\ponte\portatile` e fai doppio clic su **`1-verifica.cmd`**.
2. Deve comparire **«Il gestionale risponde. Apparecchi attivi: 0.»** (o il numero di apparecchi che hai già messo). Poi premi un tasto per chiudere.
3. Se invece compare:
   - **«Il gestionale ha risposto di no…»**: la chiave è sbagliata o è stata tolta. Rifai A4;
   - **«config.json non è scritto bene…»**: manca una virgoletta o una virgola. Riapri il file e confrontalo con l'esempio di A4;
   - **«Non trovo la configurazione…»**: la cartella non è `C:\Borgo58\ponte`, oppure il file non si chiama proprio `config.json`;
   - **«Node non e' installato»**: hai riavviato dopo A2? Se sì, rifai A2.

**Se compare un avviso:**
- **«Windows ha protetto il PC»** (finestra blu): premi **Ulteriori informazioni → Esegui comunque**.
- **«Aprire il file?»**: premi **Esegui**.
- **Il firewall chiede se Node può usare la rete:** premi **Annulla**. Il ponte esce lo stesso; l'apparecchio finto resta dentro il portatile.

I file `.cmd` sono di testo, scritti da noi: puoi aprirli col Blocco note e leggerli.

---

## B · La prova generale a casa, con l'apparecchio finto

L'apparecchio finto è una stampante e un registratore che vivono dentro il portatile, all'indirizzo `127.0.0.1` («questo stesso computer»). Quello che «stampano» finisce come testo nella cartella `C:\Borgo58\ponte\uscita`.

Ci sono due finestre nere:
- la **finestra del ponte**, che apre `2-accendi-il-ponte.cmd`;
- la **finestra dell'apparecchio finto**, che apre `3-apparecchio-finto.cmd`.

Si spengono chiudendole con la **X** in alto a destra.

### B1 · Accendere tutto
1. Doppio clic su **`2-accendi-il-ponte.cmd`**. Si apre la finestra del ponte, che dice «ponte 0.2.0 acceso». **Lasciala aperta**: il ponte vive finché la finestra è aperta.
2. Doppio clic su **`3-apparecchio-finto.cmd`**, scrivi **1** (normale) e premi Invio. Lascia aperta anche questa.
3. Nel sito di Prova, in **Comande → Stampanti**, entro mezzo minuto il riquadro del ponte deve dire **● Acceso — «Mini-PC ristorante» su …**, seguito dal nome del tuo portatile. «Mini-PC ristorante» è il nome della chiave, ed è giusto anche se è un portatile.

### B2 · I due apparecchi finti
In **Comande → Stampanti → Aggiungi un apparecchio**, due volte:

| | Nome | Che cos'è | Modello | Indirizzo IP | Porta | Stampa i biglietti di |
|---|---|---|---|---|---|---|
| 1 | Stampante finta | Stampante delle comande | Apparecchio finto, per le prove | `127.0.0.1` | `19100` | Bar |
| 2 | Registratore finto | Registratore telematico | Apparecchio finto, per le prove | `127.0.0.1` | `18080` | — |

### B3 · Le prove, e cosa devi vedere

Le prove si leggono in **«3 · Le ultime prove»**. Lo stato dell'apparecchio si legge nella sua riga, in «2 · Gli apparecchi».

⚠️ **«Leggi lo stato» dice quasi sempre «Fatto»**: vuol dire che la *domanda* è arrivata. La *risposta* (Pronto, Carta finita, Coperchio aperto) si legge nella riga dell'apparecchio, non nelle «Ultime prove».

Per cambiare comportamento all'apparecchio finto: chiudi la sua finestra, riapri `3-apparecchio-finto.cmd` e scrivi il numero nuovo.

| # | Apparecchio finto | Premi | Cosa devi vedere |
|---|---|---|---|
| 1 | **1** normale | Prova di stampa, su tutti e due | **Fatto**. In `C:\Borgo58\ponte\uscita` compaiono due file: dentro, una riga «PROVA DI STAMPA» e più sotto «Documento non fiscale» |
| 2 | **1** normale | Leggi lo stato, sulla stampante | Prova **Fatto**, e l'apparecchio dice **Pronto** |
| 3 | **2** carta finita | Leggi lo stato, sulla stampante | Prova **Fatto**, e l'apparecchio dice **Carta finita** |
| 4 | **2** carta finita | Prova di stampa, su tutti e due | **Non riuscito**, con «…dice che la carta è finita: cambia il rotolo e riprova.» Nessun file nuovo in `uscita` |
| 5 | **3** coperchio aperto | Leggi lo stato, poi Prova di stampa | Lo stato dice **Coperchio aperto**. La prova dice **Non riuscito**, con «Il coperchio… è aperto: chiudilo e riprova.» |
| 6 | **nessuno**: chiudi la finestra dell'apparecchio finto (è come spegnerlo) | Prova di stampa, su tutti e due | **Non riuscito**, con «L'apparecchio non risponde (ECONNREFUSED).» (ECONNREFUSED vuol dire «non c'è nessuno a quell'indirizzo».) La riga dell'apparecchio dice **Non risponde** |
| 7 | **4** muto | Prova di stampa sul registratore | Dopo circa 15 secondi: **Non si sa se è uscito**, con «…Forse il foglio è uscito, forse no: guarda la stampante.» Compare il pulsante **Ho guardato, chiudi**: premilo |
| 8 | **1** normale, poi chiudi la **finestra del ponte** | Prova di stampa sulla stampante | Resta **Aspetta il ponte**. Entro due minuti il riquadro del ponte dice **● Spento**. Riapri `2-accendi-il-ponte.cmd`: la prova parte da sola e diventa **Fatto** |

Se tutte e otto vanno come scritto, il portatile è pronto per il negozio.

### B4 · Una comanda dal tablet, a casa
È il giro che si proverà al collaudo, con l'apparecchio finto al posto della stampante. Ponte e apparecchio finto accesi (**1** normale).

1. In **Comande → Stampanti**, sulla riga di **Stampante finta** premi **Modifica**, cambia **Stampa i biglietti di** in **Cucina** e premi **Salva le modifiche**.
2. Sul tablet (o sul computer), nel sito di **Prova**: **Comande → Sala**, apri un tavolo, aggiungi un piatto della cucina e premi **Invia**.
3. Apri **Comande → Cucina**. Entro pochi secondi il foglio passa in **Già stampati**. In `C:\Borgo58\ponte\uscita` c'è un file nuovo: dentro, «CUCINA - » con il tavolo, il turno, il piatto.
4. **Il ponte spento:** chiudi la finestra del ponte e manda un altro piatto. In **Cucina** il foglio dice «In coda: aspetta il ponte», ed entro due minuti compare l'avviso rosso **«Il ponte è spento o senza rete»**. Riapri `2-accendi-il-ponte.cmd`: il foglio esce da solo.
5. **La carta finita:** riapri l'apparecchio finto con **2** e manda un piatto. In **Cucina** il foglio dice **«Non è uscito: la carta è finita»**. Riapri l'apparecchio finto con **1** e premi **Riprova sulla stampante**: esce.
6. **Il bar:** rimetti **Stampante finta** su **Bar** e manda una bevanda. Esce un foglio «BAR - » con il tavolo. La pagina **Bar** resta quella di sempre: il giro si segna pronto a mano, come oggi.
7. Chiudi il conto del tavolo di prova.

**Alla fine della prova generale:**
- chiudi le due finestre nere;
- in «2 · Gli apparecchi» togli **Stampante finta** e **Registratore finto** (pulsante **Togli**, poi **Sì, togli**);
- **lascia la chiave del ponte**: serve in negozio.

> L'ho già fatta io il 29/10, col ponte vero acceso come lo accenderai tu, contro Prova e l'apparecchio finto: è andata come nella tabella. La rifai a casa per controllare il tuo portatile, il tuo `config.json` e la tua mano.

---

## C · Il giorno in negozio

### C1 · Già confermato, e da chiedere al fornitore PRIMA

**Già confermato:**
- al collaudo ci sono il registratore **Epson FP-81 II RT** e **una sola** stampante delle comande **Epson TM** (nel locale saranno due);
- in negozio il portatile si collega alla rete del fornitore, la stessa delle stampanti e del registratore di prova;
- quella rete esce anche su internet, che al ponte serve per parlare con Prova.

**Come collegarsi**, in uno dei due modi:
- **Col cavo (meglio):** un cavo di rete dal portatile a una presa libera del **router o dello switch** del negozio, cioè la scatola con le lucine dove arrivano gli altri cavi. Mai direttamente all'apparecchio (vedi C2). Windows si collega da solo.
- **Col Wi-Fi:** clic sull'icona del Wi-Fi in basso a destra, scegli la rete del negozio e scrivi la password che ti dà il fornitore. Se Windows chiede «Vuoi che il PC sia individuabile…?», rispondi **No**: non serve.

**Da chiedere ancora** (per telefono o per messaggio), tre cose:
1. **Gli indirizzi IP** del registratore e di ogni stampante. Sono fissi?
2. **Le porte** di ognuno. Per le stampanti: parlano **ESC/POS sulla porta 9100** oppure **ePOS**?
3. **Il servizio FPMate del registratore** è acceso? Risponde su `/cgi-bin/fpmate.cgi`, con «devid» `local_printer`? Basta che gli giri la domanda così com'è.

Se ce l'ha, chiedigli anche il manuale «Fiscal ePOS-Print / FPMate» in PDF. Non è indispensabile.

Mandami le risposte appena le hai: le controllo con le regole di C2 prima del giorno.

### C2 · I limiti da controllare con le sue risposte
Il gestionale e il ponte accettano **solo** questi apparecchi. È voluto, perché il ponte non deve mai chiamare fuori dal locale.

- **Indirizzo IP:**
  - va bene se comincia per **`192.168.`**, **`10.`** oppure da **`172.16.`** a **`172.31.`**. Quasi tutti i negozi usano `192.168.x.x`;
  - non va bene se **l'ultimo numero** è **0** o **255** (`192.168.1.0`, `192.168.1.255`).
- **Porta:**
  - per le stampanti ESC/POS solo **9100**;
  - per il registratore e per ePOS solo **80, 443, 8008 o 8043**.
- ⚠️ **Mai il portatile attaccato col cavo direttamente all'apparecchio**, senza router in mezzo. In quel caso Windows si dà un indirizzo che comincia per **`169.254.`**, e il ponte non lo accetta. Collegati sempre alla rete del negozio.
- Se il fornitore dice un indirizzo o una porta fuori da queste regole, il gestionale non salva l'apparecchio e lo dice. Non è un guasto. **Scrivimelo**: si allarga la regola prima, con calma.

### C3 · In negozio, nell'ordine
1. Collega il portatile alla rete del negozio, col cavo o col Wi-Fi (C1), e alla corrente.
2. Doppio clic su **`1-verifica.cmd`**: deve dire «Il gestionale risponde». Se non lo dice, il portatile non è davvero collegato. Controlla il cavo o il Wi-Fi, e se continua chiedi al fornitore prima di andare avanti.
3. Doppio clic su **`2-accendi-il-ponte.cmd`**. La finestra resta aperta.
   - **Non** accendere l'apparecchio finto.
4. Nel sito di Prova, **Comande → Stampanti**: ponte **● Acceso**.
5. **Aggiungi un apparecchio** per ognuno, con gli indirizzi del fornitore:
   - **Registratore:** «Registratore telematico», modello «Epson FP-81 II RT (FPMate)», porta di solito 80.
   - **Stampanti:** «Stampante delle comande», modello «Epson TM in rete (ESC/POS)» (oppure ePOS, se lo dice lui), porta 9100, cucina o bar.
6. **Le prove, davanti all'apparecchio:**

| # | Fai | Premi | Deve succedere |
|---|---|---|---|
| 1 | niente | **Prova di stampa** | Esce un foglio con «PROVA DI STAMPA» in cima e «Documento non fiscale» più sotto, e la prova dice **Fatto** |
| 2 | niente | **Leggi lo stato** | L'apparecchio dice **Pronto** |
| 3 | apri il coperchio | **Leggi lo stato**, poi **Prova di stampa** | **Coperchio aperto**, e la prova **Non riuscito**, senza foglio |
| 4 | togli la carta | **Leggi lo stato**, poi **Prova di stampa** | **Carta finita**, e la prova **Non riuscito** |
| 5 | spegni l'apparecchio | **Prova di stampa** | **Non riuscito**: «non risponde», oppure «non ha aperto la connessione in tempo» |
| 6 | riaccendi | **Prova di stampa** | Di nuovo **Fatto** |

7. **Una sola stampante TM, due giri.** Al collaudo c'è una sola stampante delle comande; nel locale saranno due. Provale tutte e due con la stessa:
   1. aggiungila con **Stampa i biglietti di: Cucina** e premi **Prova di stampa**: deve dire **Fatto**;
   2. premi **Modifica**, cambia in **Bar**, premi **Salva le modifiche** e rifai **Prova di stampa**: di nuovo **Fatto**.

   ⚠️ La prova di stampa va **dritta all'apparecchio** che hai scelto. Che una comanda di cucina esca sulla stampante della cucina e una del bar su quella del bar lo controlla il punto 9.
8. ⚠️ **Il registratore stampa solo il foglio non fiscale.** Non è uno scontrino e non va all'Agenzia delle Entrate. Se il display del registratore resta con un documento aperto, chiedi al fornitore di chiuderlo.
9. **Il tablet, con la stampante vera.** Come in B4, ma con la TM del fornitore. Sul tablet, nel sito di **Prova**:

| # | Stampante TM su | Fai | Deve succedere |
|---|---|---|---|
| 1 | **Cucina** | apri un tavolo, segna due piatti in due turni diversi, **Invia** | Esce **un** foglio: «CUCINA - » e il tavolo, l'ora, «1o turno» e «2o turno» con i loro piatti. In **Comande → Cucina** il foglio passa in **Già stampati** |
| 2 | **Cucina** | un piatto con una sostituzione per allergene, **Invia** | Sul foglio, sotto il piatto, **SENZA** e l'allergene in grande, poi la frase della sostituzione |
| 3 | **Cucina** | **Avanti prossimo turno** sullo stesso tavolo | Esce il biglietto con il tavolo e «AVANTI COL PROSSIMO TURNO» |
| 4 | **Cucina** | togli la carta, manda un piatto | Non esce niente. In **Cucina**: «Non è uscito: la carta è finita». Rimetti la carta e premi **Riprova sulla stampante**: esce **una volta** |
| 5 | **Bar** (Modifica → Bar → Salva le modifiche) | una bevanda, **Invia** | Esce un foglio «BAR - » e il tavolo, senza turni. Nella pagina **Bar** il giro resta da preparare, come sempre |
| 6 | **Bar** | un piatto della cucina, **Invia** | **Non** esce niente: la cucina non ha più una stampante. In **Cucina** il foglio è da stampare a mano, come oggi |

   Alla fine chiudi il conto del tavolo di prova. Gli scontrini restano fuori: questi sono tutti fogli **non fiscali**.
10. Per ogni prova che va **diversa** dalla tabella:
    - scrivi a mano quale apparecchio, quale prova e che cosa è uscito (anche niente);
    - **non rifarla dieci volte**: una o due bastano.

**Se la rete del negozio cade a metà:** non fare niente al portatile. Il ponte riprova da solo ogni 15 secondi, e le prove restano «Aspetta il ponte» finché la rete torna. Se resta «Non si sa se è uscito», guarda la stampante e premi «Ho guardato, chiudi». Per una comanda, in **Cucina**: **È uscito** se il foglio c'è, **Ristampa** se non c'è. Il gestionale non la ristampa mai da solo.

### C4 · Dove resta la risposta dell'apparecchio
Quando un apparecchio **risponde**, il ponte tiene quello che ha detto, parola per parola. Serve a me per sistemare il ponte se il registratore o le stampanti parlano in modo un po' diverso dal previsto. Resta in due posti:
- **Sul portatile**, nel file **`C:\Borgo58\ponte\ponte.log`** (si apre col Blocco note).
  - Ogni prova ha una riga col risultato.
  - Quando l'apparecchio ha risposto, c'è sotto una seconda riga «risposta dell'apparecchio: …»:
    - per il registratore è un testo lungo;
    - per le stampanti ESC/POS sono due numeri, i «byte di stato».
  - Se l'apparecchio era spento o muto, la seconda riga non c'è: è giusto così, perché non ha detto niente.
  - La chiave del ponte non ci finisce mai.
- **Su Prova**, insieme a ogni prova. Quella la leggo io dopo, senza che tu faccia niente.

A fine giornata **mandami `ponte.log` per mail**, come allegato.

---

## D · A fine collaudo: togliere tutto dal portatile
1. **Chiudi la finestra del ponte.** Il ponte è spento: non c'è nessun servizio che riparte da solo.
2. Nel sito di Prova, **Comande → Stampanti**:
   - premi **Togli** accanto alla chiave del ponte: da quel momento la chiave scritta nel portatile non apre più niente;
   - togli anche gli apparecchi del fornitore, se non servono più.
3. **Mandami `C:\Borgo58\ponte\ponte.log`** (vedi C4).
4. Cancella la cartella **`C:\Borgo58`** e il file `ponte-collaudo.zip`. Dentro c'era la chiave, anche se ormai tolta.
5. Node può restare: non gira da solo e non dà fastidio. Se vuoi toglierlo, vai in **Impostazioni → App → App installate → Node.js → Disinstalla**.
6. Se vuoi, rimetti la sospensione del passo A1 com'era.
