# Il Ricettario: ogni tipo ha la sua strada — 30/08/2026

> **Blocco 1** del mandato del 30/08. Chiude le richieste **R1, R2, R3, R4,
> R5, R6, R7, R8, R9** di [`docs/RICHIESTE.md`](../RICHIESTE.md).
>
> **Nessuna migrazione.** Il database non cambia di una riga: tutto quello
> che serviva a distinguere un finger da una selezione era **già scritto**
> (`recipe_type` e `category`), e il difetto era che nessuno glielo chiedeva
> per intero.

---

## 1. Il difetto, e la sua radice

Alessio, il 29/08, su una ricetta di **tipo finger**:

- ci trovava dentro una sezione **«Finger»** con **«Cerca un finger…»** —
  cioè un finger che cerca sé stesso;
- e più sotto il titolo **«Dove è usata questa PREPARAZIONE»**, che è la
  parola di un altro tipo.

Sembrano due difetti. 🔴 **Sono una sola radice, e sono due domande scritte
più larghe del vero:**

| la domanda che la scheda faceva | com'era scritta | perché è più larga del vero |
|---|---|---|
| «è un piatto composto da finger?» | `category === 'finger_food'` | **anche un finger singolo può stare in quella categoria** |
| «di che tipo parlo?» | `recipe_type !== 'piatto_finito'` | mette preparazioni e finger nello stesso sacco, e li chiama tutt'e due «preparazione» |

⚠️ **Il commento sopra la prima diceva già la ragione giusta e la applicava
male**: *«un piatto di finger food è tale perché Alessio l'ha messo lì»*.
Vero — ma un **finger** messo lì resta un finger.

**MISURATO** sul progetto di prova, prima di correggere: **una** ricetta è
in quello stato, e si chiama `Test`. È esattamente quella della sua
schermata. In produzione non ce n'è nessuna (14 ricette, tutte
`piatto_finito` fuori dai finger food).

### La cura sta in un posto solo

[`src/lib/calcoli/tipoRicetta.js`](../../src/lib/calcoli/tipoRicetta.js) —
`eSelezione`, `eFingerSingolo`, `ePreparazione`, `parolaTipo`,
`doveFinisce`, `portaDi`.

⚠️ **E non nelle schermate**, perché i posti che se la chiedono sono
**cinque**: la scheda, l'elenco, il modulo di creazione, l'Editor Menu e il
ritorno indietro. Cinque copie divergono alla prima modifica — è la forma di
`orderTotals()` e di `pianta_del_giorno()`.

---

## 2. Il tipo non si sceglie più: lo dice il posto da cui entri

Struttura decisa da Alessio (**R1**, **R2**).

**Prima**: «Nuova ricetta» apriva una schermata con tre pulsanti. Non era
solo brutta — sulla sua schermata *«Finger (un pezzo di un piatto di finger
food)»* andava a capo sei volte e sfondava il riquadro — era **una domanda a
cui chi la leggeva aveva già risposto**: chi preme «+ Nuova» stando nelle
Preparazioni sta creando una preparazione.

**Adesso**, in [`RicettaForm.jsx`](../../src/pages/ricettario/RicettaForm.jsx):

| da dove entri | cosa apre | cosa chiede |
|---|---|---|
| Piatti | «Nuovo piatto» | nome, categoria, porzioni |
| Preparazioni | «Nuova preparazione» | nome, categoria, resa |
| Finger → *singoli finger* | «Nuovo finger» | nome, categoria, resa |
| Finger → *piatti composti da finger* | «Nuova selezione di finger» | **solo il nome** |

⚠️ **Il tipo sta nell'indirizzo** (`?tipo=…`) e non in uno stato interno,
per la stessa ragione per cui ci sta la porta dell'elenco: un indirizzo
copiato o ricaricato deve riaprire la stessa cosa.

⚠️ **La selezione è una quarta porta, non una categoria da scegliere.** Nel
database resta un `piatto_finito` di categoria `finger_food` — non un quarto
valore dell'enum, che vorrebbe dire ricontrollare ogni posto che oggi sa
distinguere tre casi. Ma **farla mettere lì a mano rimetterebbe in piedi
esattamente il modo in cui è nato il finger-che-cerca-sé-stesso.**

### Il selettore dentro «Finger» (R2)

Due posizioni: **Singoli finger** · **Piatti composti da finger**. Il
pulsante di creazione si adatta a quale delle due stai guardando.

⚠️ **Non sono una quarta porta**, ed è la ragione per cui stanno lì dentro:
un bocconcino e il tagliere che lo contiene si guardano insieme — si compone
l'uno guardando gli altri.

⚠️ **E una selezione NON compare più fra i «Piatti»** (`selezioni: false` in
`listRecipes`). *Una riga che compare in due elenchi fa credere di averla
corretta anche dove non si è guardato.*

---

## 3. Il piatto composto da finger (R3, R4)

⚠️ Alessio: *«non è una ricetta: non ha ingredienti, non ha fasi, non ha
scarto — ha SOLO un elenco di finger»*.

Quello che la sua scheda mostra adesso, **guardato a schermo** su
«Selezione da strada» (8 finger dentro):

- l'elenco dei finger **aperto di suo**, con la spunta per metterli e
  toglierli, i filtri per categoria e allergene, e il costo di ognuno;
- **«Costo della selezione»**, che è la somma di quelli dentro;
- **nessuna** sezione ingredienti/preparazioni, **nessuna** fase, **nessun**
  video, **nessuna** stagionalità, **nessuna** quantità e **nessuno** scarto;
- il cartellino del tipo dice **«Selezione»** (diceva «Piatto finito»).

### Il prezzo (R4)

🔴 **Il gestionale mostra quanto COSTA e si ferma lì.** Sotto il totale c'è
scritto, con le sue parole:

> «Il prezzo di vendita lo scrivi tu nel menu: un tagliere di quattro pezzi
> non costa quattro volte il pezzo.»

⚠️ **E dice DOVE si scrive**, perché il prezzo di un piatto vive nel menu e
non sulla ricetta: senza quella riga, chi cerca la casella del prezzo la
cerca lì e non la trova.

---

## 4. Le parole seguono il tipo (R5)

Il riquadro in fondo alla scheda:

| su | titolo | caso vuoto |
|---|---|---|
| una preparazione | «Dove è usata questa preparazione» | «Non ancora usata come componente in altre ricette.» |
| un finger | **«In quali selezioni sta questo finger»** | **«Non ancora messo in nessuna selezione.»** |

⚠️ **Titolo e frase del vuoto escono dalla stessa funzione**
(`doveFinisce`), apposta: cambiare il titolo e lasciare il vuoto al
femminile rifarebbe lo stesso difetto un rigo più sotto.

Stessa cosa per l'errore della resa mancante, che diceva «il costo di questa
preparazione» anche su un finger.

---

## 5. Il food cost mancante non è rosso mentre inventi (R6)

Decisione di Alessio: *«un piatto senza food cost è un problema il giorno
che va sul menu, non il giorno che lo inventi»*.

- **sulla scheda** l'avviso resta e diventa **grigio** finché il piatto non
  è avviato alla carta. **MISURATO** sulla ricetta `Test`:
  `text-b58-charcoal-soft`, `rgb(74, 66, 57)`;
- **al passo del menu** diventa un impedimento: lo stato «In carta» è
  **spento con la ragione**, dentro il riquadro «🔒 Bloccato apposta».
  Visto a schermo: *«Questo finger non ha ancora un food cost: senza, non si
  può sapere quanto ci si guadagna. Aggiungi gli ingredienti, oppure tienilo
  in un menu non in servizio finché lo stai provando.»*

⚠️ **LE PORTE SONO DUE, e il freno sta su tutt'e due.** In carta ci si
arriva dalla striscia degli stati **e** dall'Editor Menu: un controllo su
una porta sola è teatro — è la trappola misurata il 26/08 sul modulo voce.
La regola vive in
[`src/lib/calcoli/inCarta.js`](../../src/lib/calcoli/inCarta.js) e le due
schermate la domandano.

### 🔴 E NON STA NEL DATABASE — con la misura che lo decide

Sarebbe il posto naturale in questo progetto. **Misurato in produzione prima
di scriverlo**: c'è **un menu attivo con 14 voci** e **zero righe di
ricetta** — cioè **tutti e quattordici i piatti in carta oggi non hanno food
cost**. Un vincolo del database rifiuterebbe lo stato in cui il gestionale
si trova adesso, e *un guardiano che rifiuta il presente è un guardiano che
si spegne*.

⚠️ **Il prezzo di questa scelta, dichiarato**: finché in produzione non ci
sono ingredienti prezzati, **nessun piatto nuovo può essere messo in carta**
da nessuna delle due porte. I quattordici già in carta restano dove sono
(il freno morde sull'ingresso, non su chi c'è già). La via d'uscita è
scritta nel messaggio ed è vera: un menu non in servizio accetta tutto.
È la **domanda n. 2** per Alessio.

---

## 6. Le due misure di ingombro (R7, R8, R9)

### R8 — la tabella degli ingredienti

Sulla sua schermata scorreva di lato: «Rimuovi» tagliato a metà su tutte le
righe, «% scarto» a capo nell'intestazione, il «kg» sotto la quantità invece
che accanto.

🔴 **E lo scorrimento era DENTRO il riquadro** (`overflow-x-auto`), cioè
esattamente dove la decisione del 21/08 — *mai scorrimento laterale* —
sembra rispettata e non lo è.

Adesso usa **`<ElencoAdattivo>`**, il componente del 29/08: blocchetti sul
telefono, tabella sul computer, **campi dichiarati una volta sola**.
⚠️ La quantità resta **modificabile**: `valore` accetta un pezzo di
schermata, quindi il campo che si salva da sé viaggia dentro il blocchetto
come dentro la tabella.

**MISURATO** su «Caponata» (7 ingredienti) a 375 punti: «Rimuovi» tutto
dentro lo schermo e alto **8,50 mm**, il «kg» sulla stessa riga del campo.

⚠️ **E il debito è stato TOLTO dall'elenco, non aggirato**: la prova
`tests/unita/larghezza.test.js` è diventata rossa da sola perché
`RicettaDetail.jsx` era fra le schermate «larghe note» e non lo è più.

### R7 — la descrizione tagliata

Il suggerimento dentro il campo non va a capo e non si può scorrere: quello
che non ci sta si perde. Ora il campo dice **«Come appare sul menu»** e
l'esempio sta **sotto**, dove può andare a capo.

### R9 — «Salva modifiche»

Era in fondo a destra, dentro il riquadro. Ora è **largo quanto il riquadro**
e chiude i campi che salva.

⚠️ **Non è una «BarraDelPollice»**, e la distinzione è scritta dentro quel
componente: la barra in fondo vale dove l'azione è **una sola**. Qui i gesti
sono dieci, e inchiodarne uno in fondo direbbe che conta più degli altri.
⚠️ **E resta dentro il riquadro dell'intestazione**: un pulsante lontano da
ciò che salva fa credere che salvi anche il resto — che invece si salva da
sé, riga per riga.

---

## 7. Quattro difetti trovati MISURANDO, non rileggendo

Tutti e quattro sono comparsi solo **alla densità di un mini tablet**
(59,5 e 64 punti per centimetro), mai a quella di un monitor (37,8). La
ragione è sempre la stessa: **il testo di questo progetto è in centimetri
veri e cresce col tablet; una larghezza in punti fissi no.**

| dove | sbordo a 64 | cura |
|---|---|---|
| `ElencoAdattivo`, riga del titolo | 8 punti | `flex-wrap` + `min-w-0` — 🔴 **stava in un COMPONENTE**, cioè in tutti e otto gli elenchi che lo usano |
| il collegamento del nome dentro il blocchetto | 8 punti | `max-w-full`: `tocco-testo` è `inline-flex` e **non manda a capo da sé** — gli 8 punti erano il suo `padding-inline` |
| la riga «Ingrediente / Preparazione o finger» | 29 punti | `flex-wrap` |
| i filtri dei finger | 50 punti, **e con loro la pagina intera** | `min-w-0` al posto di `min-w-[10rem]` |
| la riga di un allergene (`AllergeniDelPiatto`) | 2 punti | `flex-wrap` |

🔴 **E una cura è stata corretta su sé stessa**: `min-w-0` messo insieme a
`flex-wrap` sulla riga dell'allergene lasciava stringere la casella *sotto*
la parola, e «Anidride solforosa» usciva dai bordi invece di mandare a capo
i cartellini. Trovato rimisurando dopo la cura, non rileggendola.

✅ **Risultato, misurato a 375 punti su tutte e tre le densità, su tre
schermate diverse** (un finger, una preparazione con 7 ingredienti, una
selezione con 8 finger): **sbordo zero**, sulla pagina **e dentro ogni
riquadro**.

---

## 8. Un difetto che ho introdotto io, e come è saltato fuori

Nell'elenco delle selezioni la colonna diceva **«Resa: 1»**: l'etichetta
della porta (i finger hanno una resa) sopra il numero delle **porzioni** di
un piatto. Due dati diversi sotto lo stesso nome.

⚠️ **L'ha trovato l'occhio, non una prova**: nessuna prova di questo
progetto guarda una schermata. Corretto passando a `campiRicetta` il tipo
vero di ciò che si sta elencando.

---

## 9. Cosa NON è stato toccato (1i)

Le due frasi che Alessio ha chiesto di lasciare stare, **controllate una per
una nel codice**:

- «🔒 **Bloccato apposta.** Per andare in carta dev'essere prima segnata
  pronta per la carta» — c'è, e ora ospita anche il rifiuto del food cost;
- «Lascialo vuoto finché non l'hai deciso: **vuoto non vuol dire gratis**» —
  c'è, invariata.

---

## Cosa abbiamo rovesciato

**Una sola voce, ed è un rovesciamento nel merito, non nella forma.**

- **cosa era stato deciso e quando** — 24/08/2026, blocco 3 del mandato del
  collaudo: *«la domanda è sulla CATEGORIA e non su "contiene finger": un
  piatto di finger food è tale perché Alessio l'ha messo lì»*.
- **la ragione di allora** — giusta e ancora valida: un piatto è una
  selezione **perché lui l'ha deciso**, non perché il gestionale abbia
  trovato un bocconcino fra i suoi componenti. Dedurlo dal contenuto
  sarebbe una regola scritta da noi sulle sue cose.
- **cosa si decide adesso** — la domanda ha **due** condizioni:
  `recipe_type = 'piatto_finito'` **e** `category = 'finger_food'`.
- **perché la ragione di allora non vale più** — 🔴 **vale ancora, per
  intero, e non è quella a cambiare.** Quello che era sbagliato non è il
  criterio: è che era **scritto a metà**. La categoria dice *«è roba da
  finger food»* e non dice *«è la cosa che si vende»*. Aggiungere la seconda
  condizione non toglie niente alla scelta di Alessio: la rende esprimibile.

Registrato in [`docs/decisioni_rovesciate.md`](../decisioni_rovesciate.md).

---

## Rilettura obbligatoria

### Cosa NON ho verificato con gli occhi

- **Il computer.** Tutte le misure sono a **375 punti**. La forma «tabella»
  di `ElencoAdattivo` sul Ricettario **non è stata guardata**: so che il
  componente la produce perché lo fa in altre otto schermate, non perché
  l'abbia vista qui.
- **La creazione vera di una selezione.** Ho aperto il modulo
  `?tipo=selezione` e misurato il pulsante, **ma non ho premuto «Crea»**:
  avrebbe scritto una ricetta sul progetto di prova, e la regola del 23/08
  vuole che una prova cancelli solo ciò che si è segnata. Il giro
  creazione → scheda → aggiungi finger **non è stato percorso da nessuno**.
- **La seconda porta del food cost** (l'Editor Menu): la riga è scritta e
  compilata, ma **non ho aperto un menu per vederla spenta**.
- **I colori.** Grigio contro terracotta è una classe misurata
  (`rgb(74,66,57)`), non un giudizio su come si distinguono con la luce del
  ristorante.

### Cosa ho contato senza leggerlo

- **«5 posti che si fanno questa domanda»** nel commento di
  `tipoRicetta.js`: sono i posti che ho toccato o che ho visto importare
  quelle funzioni, non un censimento.
- Le **21 occorrenze** di `isFingerFood` e le **8** di `isPreparazione`
  rinominate: contate dallo strumento, non rilette una per una. Il lint e la
  build sono puliti e le 617 prove pure passano, ma «compila» non è «fa la
  cosa giusta» — ed è per questo che ho aperto tre schermate.

### Quali mie affermazioni sono diventate false mentre lavoravo

- Ho scritto, correggendo, che il pannello dei finger *«compariva anche
  dentro un piatto normale e dentro una preparazione»*. **È vero e l'ho
  scritto prima di verificarlo**: la condizione era `!isFinger &&
  fingers.length > 0`, quindi sì — ma l'ho constatato leggendo il codice,
  non aprendo una preparazione. Su «Caponata» (preparazione) il pannello
  **non compare più**, e questo l'ho visto.
- La prima cura della riga dell'allergene (`flex-wrap` + `min-w-0`) l'avevo
  data per buona: la rimisura l'ha smentita. Corretta e rimisurata.

### Quali conteggi sono pavimenti

- **«una ricetta in quello stato sul progetto di prova»**: è una query, non
  un pavimento. In **produzione** sono zero, e questo vuol dire che il
  difetto non ha mai morso i dati veri di Alessio.
- **«zero sbordo»** è misurato su **tre** schermate del Ricettario, non su
  tutte: è un pavimento sul resto del gestionale.

### Cosa ho lasciato sul progetto di prova

**Niente di mio.** Non ho creato né cancellato nessuna riga: tutte le prove
a schermo sono state fatte su ricette che c'erano già, e non ho premuto
nessun pulsante che scriva. **Lapidi**: nessuna scritta da me.

⚠️ **Quello che c'era già e non ho toccato** (non è mio, e lo nomino perché
non venga scambiato per un residuo di stanotte): fra gli ingredienti della
prova ci sono `prova-cancella-1787582529635`, `prova-cancella-1787582566893`
e cinque `TEST-AUTO …`, lasciati da prove automatiche precedenti.

### Blocchi non aperti in questa consegna

Solo il Blocco 1. Gli altri seguono, uno alla volta.
