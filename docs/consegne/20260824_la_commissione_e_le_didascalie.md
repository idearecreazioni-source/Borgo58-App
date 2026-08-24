# La commissione POS, le didascalie, e il segno che col mouse non si apriva

**24/08/2026 · riepilogo di consegna per il validatore**

| | |
|---|---|
| **HEAD dichiarato** | `68b68b4` |
| **Working tree** | pulito |
| **Commit di questa consegna** | `6b61403`, `986f8e0`, `6b62e88`, `77c7c05`, `d2d760a`, `68b68b4` |
| **Migrazioni nel repository** | 212 |
| **Migrazioni in produzione** | **210** — le due nuove aspettano il push |
| **Migrazioni sul progetto di prova** | 212 |
| **Prove** | **384 pure · 358 sul database**, tutte verdi |
| **Contratto architetturale** | **non toccato** |

---

## 1 · Cosa è stato chiesto

Tre risposte confermate da Alessio, più due lavori nuovi:

1. **Applicare le migrazioni** (aveva pushato) — fatto prima di iniziare:
   da 207 a **210**. Le tre applicate, **nominate per intero** come pretende
   la regola del 16/08:
   - `20260824000012_un_rifiuto_si_legge_in_italiano` — la traduzione dei
     rifiuti dei vincoli in italiano, presa dal commento del vincolo;
   - `20260824000013_la_spiegazione_e_per_chi_lavora` — il portiere su
     quella traduzione: niente chiave pubblica, staff compreso;
   - `20260824000014_la_verifica_che_ora_ha_bisogno_dei_claims` — la
     verifica della 012 rifatta coi claims, perché la 013 l'aveva resa
     fragile.

   🔴 **E LE AVEVO SCRITTE «da 207 a 210», SENZA I NUMERI.** Il blocco che
   protegge la produzione mi si è messo davanti al primo comando di questo
   turno: *«queste migrazioni sono già in produzione e nessun riepilogo le
   nomina»*. Aveva ragione, ed è la **seconda volta** che ci cado nello
   stesso modo — la prima era ieri notte, con sei versioni scritte in
   forma abbreviata. ⚠️ *Non è una svista: è un'abitudine di scrittura, e
   l'unica cosa che la corregge è una rete che si mette di mezzo.*
2. **Provare il segno delle didascalie col mouse e con la tastiera**, di
   persona: *«non deve restare una cosa scritta e mai esercitata»*.
3. **L'ordine dei lavori**: prima le didascalie sulle schermate, poi le
   cinque aree scoperte dei vincoli — **ma prima di tutto** la
   commissione POS.
4. **`commissione_pos_percento`**: due tabelle, due unità. *«Uniforma le
   due colonne su UNA sola convenzione, con il vincolo che la protegge e
   la prova al contrario. Se altre coppie hanno lo stesso problema, chiudile
   insieme a questa.»*
5. **Due conti correnti**: *«Non costruire il multi-conto adesso: misura
   invece COSA COMPORTEREBBE e scrivilo… Riportamelo come valutazione,
   non come lavoro fatto.»*

---

## 2 · La commissione POS — migrazioni `20260824000015` e `20260824000016`

### Il caso, misurato

```
scenari_proiezione.commissione_pos_percento      numeric(6,4)  FRAZIONE  0,015 = 1,5%
impostazioni_tesoreria.commissione_pos_percento  numeric(5,2)  PUNTI     1,5   = 1,5%
```

⚠️ **Ciascuna metà era coerente con sé stessa**, ed è questo che la
rendeva pericolosa: nelle due schermate si digita «1,5» e si legge
«1,5%», quindi **l'utente non poteva sbagliare**. A sbagliare sarebbe
stato chi scrive codice o semina dati — esattamente come sono nate le
aliquote a 0,24.

🔴 **Il giorno in cui morde si sapeva qual è**: la commissione è **un solo
fatto del mondo** — quanto trattiene la banca — e prima o poi qualcuno la
legge da un posto solo. Copiare il valore da una tabella all'altra lo
sbaglia **di cento volte**, e il risultato resta plausibile: l'1,5%
diventa 0,015% o 150%. La seconda si nota, la prima sparisce
nell'arrotondamento.

⚠️ **Taceva solo perché la colonna è vuota**: zero righe in
`impostazioni_tesoreria`, in produzione **e** sulla prova. Alessio la
riempirà quando sceglie la banca. Oggi la conversione non tocca nessun
dato; fra un mese sarebbe una migrazione con dentro una decisione su un
numero vero.

### Quale convenzione, e perché non la maggioritaria

I punti sono maggioritari (13 colonne contro 9) e «1,5» si scrive come lo
dice la banca. **Si è scelta la frazione lo stesso**, per due ragioni
che si vedono solo guardando le schermate:

- in `PrevisioneForm` **tutte** le percentuali passano dalla stessa
  conversione. Portare la sola commissione in punti farebbe di quel campo
  **un'eccezione dentro la stessa schermata**: un difetto peggiore di
  quello che si chiude;
- la tesoreria è **vuota**: cambiarla costa zero righe e due punti di
  codice.

Chi usa il gestionale continua a digitare «1,5» e a leggere «1,5%».

### Cosa è cambiato

- `impostazioni_tesoreria.commissione_pos_percento` → `numeric(6,4)`;
- vincolo `tesoreria_commissione_e_una_frazione` (0..1) **col suo commento
  in italiano**, come pretende la regola del 24/08;
- `pos_in_transito()` riscritta **dal corpo vivo del database** — non dal
  file che l'ha creata: fra il 15/08 e oggi quella funzione era stata
  toccata;
- la conversione esce da `PrevisioneForm.jsx` e va in
  `src/lib/calcoli/percentuali.js` — `inFrazione`/`inPunti`, nomi che
  dicono **l'unità** invece della direzione;
- la commissione **vera** entra in `numeri_sospetti()` accanto a quella
  prevista, stessa soglia del 5%.

⚠️ **Il vincolo vecchio faceva due lavori in uno** (`0..10` in punti):
metteva insieme il limite certo e quello sospetto. Togliendolo si perdeva
il secondo — e la distinzione fra «rifiuta» e «mostra» è la regola di
Alessio del 24/08, non una raffinatezza.

### Le altre otto coppie: guardate, e **non sono** ambiguità di unità

Il setaccio ha trovato nove nomi ripetuti fra tabelle diverse. Otto non
sono il problema:

- `importo`, `total_amount`, `unit_price`, `price` — tutti **euro**,
  cambia solo la capienza o i decimali;
- `coperti` — numeri di persone dappertutto;
- `differenza`, `quantita`, `quantity` — ⚠️ nomi uguali su **concetti
  diversi**: euro di cassa contro chili di giacenza, porzioni ordinate
  contro chili di ricetta. È un problema di *leggibilità*, non di unità:
  nessuno può prendere l'una per l'altra, perché non rispondono alla
  stessa domanda. **Annotati nel commento della migrazione, non toccati.**

### La controprova: sette rotture, sette rosse

| cosa ho rotto | esito |
|---|---|
| il vincolo torna largo come prima (accetta i punti) | ROSSA |
| il vincolo diventa così stretto da rifiutare l'1,5% legittimo | ROSSA |
| la frase resta in frazione (numero giusto, didascalia falsa) | ROSSA |
| il calcolo continua a dividere per cento | ROSSA |
| il registro delle cancellazioni resta spento | ROSSA |
| la tesoreria esce dai numeri sospetti | ROSSA |
| l'elenco dei sospetti segnala anche le commissioni normali | ROSSA |

### 🔴 E la controprova ha trovato due difetti miei

Nessuno dei due si vedeva rileggendo.

1. **La migrazione non era idempotente.** `drop constraint if exists`
   toglieva il vincolo *vecchio*, non il *proprio*: riapplicandola si
   fermava su «è già lì». Le prime due rotture sono risultate rosse
   **prima di arrivare alla verifica**, quindi quel rosso non provava
   niente. È §5.3 — riapplicare a mano è normale in questo progetto.
2. **La verifica del calcolo girava sul CASO VUOTO.** Senza incassi con
   carta il risultato è zero con e senza il difetto. Rimessa a posto con
   cento euro di mance su carta, che separano 1,50 da 0,02.
   ⚠️ E si misura la **differenza** prodotta dalla prova, non il totale:
   pretendendo «1,50» era rossa per lo stato di partenza (2,27) invece che
   per il difetto.

⚠️ **Una terza cosa, sulla controprova stessa**: le prime due rotture
usavano `String.replace`, che sostituisce la **prima** occorrenza — e la
prima stava nel *commento* che spiega la correzione. Il codice restava
intatto e il verde sembrava un difetto della verifica.

### Provato dal vivo, non solo nelle migrazioni

Sul progetto di prova, con la schermata vera: scritto **1,5**, in tabella
c'è **0,0150**, riletto torna **1,5** e la frase dice «al netto della
commissione del 1,5%». Svuotato il campo, torna vuoto — **non zero** — e
l'avvertenza torna a dire che l'importo è lordo. Stato di partenza
rimesso: zero righe, **551 lapidi prima e dopo**.

---

## 3 · Le didascalie — 84 schermate

### Il criterio, che il mandato non specificava

I destini sono tre, ma la regola per sceglierli è **una domanda sola**:
*la riga spiega COME FUNZIONA, o dichiara un LIMITE di quello che le sta
sopra?*

| | |
|---|---|
| spiega come funziona | va dietro il segno «?» |
| **dichiara un limite** | **resta visibile**, accorciata |
| ripete il titolo | sparisce |

⚠️ **È più largo di «avvertimento = rosso/ambra»**: i limiti scritti in
grigio sono la maggioranza, e sono quelli che ingannano — un avviso
colorato lo si legge come un avviso, una riga grigia sotto un totale no.
Nascondere un limite renderebbe un numero parziale indistinguibile da uno
completo: il difetto che questo progetto insegue da un mese.

⚠️ **E le note sotto un campo non si toccano — 43 su 182.** Una nota sotto
un campo **è** dentro il gesto, che è dove Alessio il 18/08 ha detto che
una spiegazione deve stare. Metterle dietro un segno vorrebbe dire 182
punti interrogativi sparsi: peggiorare, non alleggerire.

### I numeri, letti dal censimento e non a memoria

| | |
|---|---|
| testi trovati all'inizio | **182** in 67 file |
| testi rimasti | **154** in 63 file |
| segni «?» messi | **33** in 26 schermate |
| note sotto un campo, non toccate | **43** |
| rimandi al brief tolti dallo schermo | **9** |
| doppioni unificati | **5** (2 + 3) |

⚠️ **Il censimento è un setaccio, non un verdetto** (lezione del 22/08):
delle 111 voci che ancora classifica «sotto un titolo», la maggioranza
sono **stati** («Questo mese non è ancora stato servito niente»),
**etichette** («Punti Critici di Controllo», «Margine sopra il
pareggio»), **istruzioni dentro un gesto** («Tocca sulla pianta i tavoli
dove li fai sedere») e **limiti** tenuti apposta. Il setaccio le conta
per forma; io le ho lette una per una.

⚠️ **E guarda anche `components/`**, non solo `pages/`: il buco del 22/08
era che un censimento «per posti» tace su tutto ciò che vive **fra** i
posti — ed è lì che stavano i due doppioni.

### 🔴 Due frasi diventate false

Le ha trovate il censimento, non una rilettura.

1. **Scheda cliente**: *«La spesa media non è ancora calcolabile… servono
   le comande, previste dopo l'acquisto dell'hardware in autunno 2026»*.
   Le comande esistono dall'8-9 agosto e quell'autunno è passato.
   ⚠️ **E la ragione vera è un'altra, misurata**: la colonna che lega il
   conto al cliente **c'è** — sul progetto di prova un conto su 349 sa chi
   era il cliente. Non manca un pezzo al gestionale: manca un gesto in
   sala. Riscritta con la ragione vera.
2. **Modulo di prenotazione**: *«quel controllo arriverà con il modulo
   Magazzino»*. Il Magazzino c'è dal 13 agosto e scarica da solo.
   ⚠️ Ma il limite **vero** resta ed è un altro — quel conto è un
   fabbisogno teorico e nessuno lo confronta con quello che c'è in cella.
   **Cambiata la ragione, non cancellata la riga.**

⚠️ **Le due hanno la stessa forma**: promettevano un pezzo che nel
frattempo è arrivato. Sono i «previsto per» che invecchiano da soli —
nessuno li rilegge, perché il giorno che quel pezzo arriva si lavora sul
pezzo, non sulle frasi che lo aspettavano.

### 🔴 Le note ripetute — quattro trovate, tre esiti diversi

1. **Due copie a mano di `DatoNonLetto`.** «Non riesco a leggere la sala»
   era scritto per esteso in Calendario e in Comande, e il componente
   comune fa esattamente quello **dal 20 agosto** — le copie sono nate il
   18/08, il componente il 20/08, e nessuno le ha portate dentro.
   ⚠️ **E si erano già separate**: una diceva «Non sono riuscito» e
   nominava la connessione, l'altra «Non riesco» e taceva.
2. **La stessa nota HACCP in tre registri**, già divergente per una parola
   — «una lettura», «una pulizia». Ora è `<GiornataDiServizio>`, che
   riceve la parola. ⚠️ **Senza `print:hidden`**: il destinatario di quel
   foglio è chi viene a controllare.
3. **«Punti Critici di Controllo»** è un titolo, e i due «tocca sulla
   pianta» stanno in stati mutuamente esclusivi con testi diversi apposta:
   **non sono difetti e restano**.

🔴 **E unificandole ho trovato una cosa mia, di un'ora prima**: nelle non
conformità avevo messo una didascalia che spiegava la serata, e sotto
c'era già la riga che la dice. **Due volte la stessa cosa a due
centimetri.** Non l'avevo vista rileggendo: l'ha trovata il confronto fra
i testi.

---

## 4 · 🔴 Il segno col mouse non si apriva

Alessio aveva chiesto di provarlo. Provato, **e col mouse non
funzionava**.

**La sequenza vera di un mouse**: il cursore entra — e il passaggio apre —
e solo dopo arriva il clic, che faceva toggle e **richiudeva**. Quindi
cliccando col mouse la didascalia si chiudeva sempre, e chi clicca lo fa
proprio perché la vuole aperta.

⚠️ **Non l'aveva visto niente.** Non la rilettura: ogni gestore, letto da
solo, fa una cosa sensata. Non le prove con eventi finti: `pointerenter`
sintetico non arriva a React — che lo simula da `pointerover` — quindi il
clic partiva da una didascalia chiusa e il toggle sembrava giusto.

⚠️ **E il primo clic aveva mancato il bersaglio**: le coordinate dello
screenshot sono in scala rispetto a quelle della pagina (1568 contro
2133). Il primo tentativo ha dato «non si apre» per la ragione sbagliata,
e per un minuto ho creduto a un difetto che non c'era mentre quello vero
era lì accanto. *Una misura sbagliata può dare la risposta giusta.*

**La cura**: col mouse il clic non fa niente. Aprire e chiudere è già
compito del passaggio, e uscire col cursore è il gesto naturale.

🔴 **E la regola esce dal componente.** In due giorni questo segno si è
rotto **due volte**, sempre perché i tre modi di arrivarci producono
sequenze di eventi diverse e una cura fatta per uno rompeva un altro. In
questo progetto le prove non hanno un ambiente DOM, quindi il componente
non si può provare — **ma la decisione sì, se sta fuori**. Ora vive in
`src/lib/calcoli/didascalia.js` con **11 prove** (contate, non stimate) che tengono ferme tutte e
tre le strade, comprese le due sequenze che si erano rotte davvero.

**Provato dal vivo, tutti e tre i modi, dopo la cura**: il passaggio apre,
il clic la lascia aperta, uscendo si chiude; col dito il tocco apre e il
secondo chiude; con **Tab** si apre da sola arrivandoci, ed **Escape** la
chiude lasciando il fuoco dov'era. Bersaglio misurato: **8,5 mm** per
lato, sopra i 5,3 mm provati con le mani il 18/08.

---

## 5 · La valutazione sui due conti correnti

Richiesta come **valutazione, non lavoro fatto**: nessuna migrazione,
nessuna colonna. Il documento è
[`docs/valutazioni/20260824_due_conti_correnti.md`](../valutazioni/20260824_due_conti_correnti.md).

In breve, con i numeri misurati sul database vero:

- **zero movimenti di prima nota in produzione**, zero righe in
  `impostazioni_tesoreria`: la finestra per predisporre è aperta **adesso**
  e si chiude **al primo bonifico registrato**, non a marzo;
- i punti che toccherebbe: **7** colonne che dicono «dove stanno i soldi»,
  **1** vista, **3** funzioni, **5** file del sito;
- 🔴 **il difetto che non si vedrebbe**: con due conti e un gestionale che
  ne conosce uno, il saldo banca **continuerebbe a comparire e sarebbe
  sbagliato** — la somma di due conti in un numero che non corrisponde a
  nessuno dei due estratti conto. Nessun errore, solo una riconciliazione
  che non torna mai;
- **raccomandazione: sì, conviene predisporre adesso** — una colonna oggi
  contro una colonna più una decisione su ogni riga già scritta domani. E
  quella decisione il gestionale non può prenderla: nei dati c'è scritto
  «banca», non quale;
- ⚠️ **le schermate no**: vogliono decisioni che oggi non si possono
  prendere. La forma minima proposta tace finché il conto è uno.

---

## 6 · Cosa abbiamo rovesciato

**Una voce.**

- **Cosa era stato deciso e quando** — il 15/08, con la migrazione della
  tesoreria: `impostazioni_tesoreria.commissione_pos_percento` in **punti**,
  con vincolo `0..10`.
- **La ragione di allora** — la schermata chiede «Commissione %» e il
  calcolo divide per cento: dentro quella tabella era tutto coerente, e
  «1,5» è come la banca dichiara una commissione.
- **Cosa si decide adesso** — la colonna passa a **frazione** (0,015), col
  vincolo 0..1, e la schermata converte come fa già la Proiezione.
- **Perché la ragione di allora non vale più** — ⚠️ **vale ancora, presa da
  sola**: quella tabella era coerente. Quello che è cambiato è che il
  15/08 nessuno aveva guardato **l'altra** tabella, dove la stessa cosa è
  conservata diversamente. La coerenza locale non basta quando il fatto
  del mondo è uno solo.

Registrato in [`docs/decisioni_rovesciate.md`](../decisioni_rovesciate.md)
al n. 42.

---

## 7 · Cosa NON è verificato

Dichiarato per intero, come pretende la regola della rilettura.

### Non l'ha visto nessun occhio

- 🔴 **QUESTA RIGA L'AVEVO SCRITTA PIU' LARGA DEL VERO, l'ha corretta la
  rilettura, e poi ho rifatto la misura per davvero.** Avevo scritto «le
  26 schermate coi segni sono state aperte tutte»: in realtà avevo aperto
  26 rotte **scritte a memoria**, e **cinque erano sbagliate** —
  `/fatture` invece di `/fatture-fornitori`, e altre quattro — quindi il
  gestionale mi rimandava alla schermata iniziale e io contavo un
  successo. *Un giro automatico che non controlla di essere arrivato dove
  voleva conta come riuscito ogni viaggio finito da un'altra parte.*
- ✅ **RIFATTO CON LE ROTTE PRESE DA `App.jsx`, e controllando l'arrivo**:
  **26 su 26 raggiunte**, nessuna schermata rotta, nessuna vuota, **26
  segni contati**. ⚠️ E il setaccio delle rotte ha sbagliato **due volte
  prima di darmi un elenco buono** — la prima leggendo «le quattro righe
  dopo il path», che pescava il componente della rotta accanto e produceva
  un elenco **sfalsato ma dall'aria giusta**.
- ⚠️ **Tre schermate mostrano zero segni, e non è un difetto**: in
  `PreventivoDetail`, `ReservationForm` e `AndamentoMensile` i segni
  stanno in rami condizionali che quel giro non ha attivato (un
  preventivo già confermato mostra il foglio per il cliente, non il modulo
  di modifica). **Guardato uno per uno, non dedotto.**
- **Il segno l'ho aperto e chiuso in UNA schermata sola** — Fatture
  Fornitori. Sulle altre è la stessa componente, ma **questa è una
  deduzione e non una misura**.
- **Il tablet non è stato toccato.** La misura del bersaglio (8,5 mm) è
  fatta col `--pxcm` di questo monitor: la classe dimensiona *in* `--pxcm`,
  quindi resta 8,5 mm su ogni schermo **calibrato** — ma un tablet che non
  è stato calibrato usa 37,8 e il segno diventa più piccolo del vero. È il
  rischio noto e dichiarato del progetto.
- **La stampa non è stata guardata**: `<GiornataDiServizio>` compare in
  tre fogli esibibili e nessuno ha aperto l'anteprima di stampa dopo il
  cambiamento.

### Dato per fatto senza misurarlo

- **Le due migrazioni non sono in produzione**: 210 contro 212. Aspettano
  il push di Alessio, e la rete di `npm run migra` non le farebbe passare
  prima.
- 🔴 **E c'è un ordine che conta**: il codice del sito ora **converte** la
  commissione, ma la produzione ha ancora la colonna vecchia. Se il push
  arrivasse **prima** dell'applicazione e nel frattempo Alessio
  configurasse il POS, scriverebbe 0,015 in una colonna che arrotonda a
  due decimali → **0,02, cioè il 2% invece dell'1,5%**. Oggi non morde
  perché la colonna è vuota e la banca non è scelta, ma **la migrazione va
  applicata insieme al push, non dopo**.
- **Il criterio delle didascalie l'ho applicato io**, leggendo una per
  una: dove una riga era al confine fra «spiegazione» e «limite» ho scelto
  di lasciarla visibile. È una scelta, non una misura.

### Affermazioni diventate false mentre lavoravo

- Nel commento della migrazione `…015` avevo scritto che le altre coppie
  di nomi erano **nove**: contandole per bene, quelle *ambigue* sono
  **una** e le altre otto sono euro con capienze diverse o concetti
  diversi. Il commento è stato corretto prima del commit.
- Nel primo giro delle didascalie avevo dichiarato «8 schermate fatte»:
  una di quelle (`HaccpHome`) non aveva mai avuto un segno — ne aveva solo
  un avviso. Il numero vero di partenza era **7**.
- ⚠️ E in Sconti e omaggi ho scritto un commento che descriveva tre
  destini diversi per tre frasi, poi ne ho cambiato uno e il commento è
  rimasto indietro per una decina di minuti. Corretto prima del commit.

---

## 8 · Le prove

- **384 prove pure** (erano 373: +11 sulla regola della didascalia).
- **358 prove sul database di prova**, tutte verdi (52 file). Girate a
  consegna finita, non a metà: le due migrazioni nuove erano già
  applicate lì.
- **Lint a zero**, build pulita, gancio pre-commit passato su tutti e
  cinque i commit.

---

## 9 · Cosa resta aperto

1. **Le cinque aree scoperte dei vincoli**: agenda e personale, sala e
   prenotazioni, comande, preventivi, agricolo. Erano il secondo punto
   dell'ordine di Alessio e **non sono state toccate**.
2. **Il debito «percento» nel suo insieme**: la coppia che mordeva è
   chiusa, ma le 13 colonne in punti e le 9 in frazione convivono ancora.
   È scritto in §8 di `CLAUDE.md` come debito dichiarato, **da fare prima
   dei dati veri**.
3. **La struttura per il secondo conto corrente**, se Alessio la vuole.
