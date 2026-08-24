# La Dashboard, il Ricettario, la spesa spicciola e le sei linee

**HEAD dichiarato**: `867c57e` — *«🔴 Una linea di ricavo spariva salvando, e
l'ha trovata il gesto vero»*.
**Working tree**: pulito al momento della scrittura (questo file è l'unico
commit successivo, ed è sola documentazione).

**Mandato**: quattro blocchi del collaudo generale, più il blocco 0.
Il disegno del blocco 4 è chiuso in
[`docs/mandati/20260824_le_linee_della_previsione.md`](../mandati/20260824_le_linee_della_previsione.md).

---

## Le migrazioni

### Applicate in PRODUZIONE oggi (blocco 0a) — 219 in tutto

Sette, dopo il push di Alessio, con `npm run migra -- --conferma`:

| versione | cosa fa |
|---|---|
| `20260824000017_i_numeri_dentro_il_testo` | i numeri dentro colonne di testo (temperature): vincoli + sanatoria |
| `20260824000018_le_cinque_aree_scoperte` | limiti su agenda, personale, sala, comande, preventivi, agricolo |
| `20260824000019_il_posto_dove_sta_il_conto` | `conti_bancari`: la struttura, senza il multi-conto |
| `20260824000020_un_ingrediente_si_puo_togliere` | disattivare/eliminare un ingrediente, col perché quando non si può |
| `20260824000021_lo_storico_prezzi_non_e_un_uso` | correzione della `…020`: lo storico non conta come uso |
| `20260824000022_il_ricevimento_di_oggi` | ricevimento merci: oggi in evidenza, il resto in archivio |
| `20260824000023_la_funzione_che_esisteva_gia` | correzione della `…019`: `set_aggiornato_il` esisteva già |

**Misurato dopo l'applicazione, col connettore in sola lettura:**
- **219** migrazioni registrate in `applied_migrations`
- **205** vincoli `check` in `public` (erano 188)
- **0** temperature attese scritte, **0** temperature di fase scritte
- **0** righe in `conti_bancari`
- ⚠️ **La sanatoria della `…017` ha toccato zero righe in produzione**, e
  non è cecità: `ingredients` in produzione ha **0 righe attive**. Il
  Ricettario vero è vuoto — Alessio ha ripulito il gestionale, e il
  collaudo vive sul progetto di prova.

### Scritte oggi, applicate SOLO al progetto di prova — 227 lì, 8 in attesa

| versione | blocco |
|---|---|
| `20260824000024_gli_avvisi_del_gestionale` | 1(b) |
| `20260824000025_i_quattro_stati_e_il_finger_food` | 2(c) e 2(e) |
| `20260824000026_il_bis_e_il_prezzo_del_finger` | 2(e) |
| `20260824000027_la_sezione_segue_il_piatto` | coda della `…025` |
| `20260824000028_il_bis_scarica_il_magazzino` | coda della `…026` |
| `20260824000029_le_sei_linee_e_il_pareggio_in_euro` | 4 |
| `20260824000030_i_diciassette_confronti_reggono` | coda della `…029` |
| `20260824000031_il_portiere_sulle_linee` | coda della `…029` |

**Nessuna cancella o modifica dati veri in produzione.** Le due sanatorie
(`…025` sulla categoria delle ricette, `…027` sulla sezione dei menu)
toccano righe che in produzione **non esistono**: zero ricette, zero menu.
Sulla prova hanno toccato 4 righe ciascuna, dichiarate nei loro `notice`.

---

## Cosa abbiamo rovesciato

**Un rovesciamento, e due decisioni che NON sono rovesciamenti benché lo
sembrino.**

### Il rovesciamento: il pareggio non si dice più in coperti

- **Cosa era stato deciso, e quando**: 15/08/2026, `riepilogo_calcolato`
  restituisce `bep_solo_sala` e `bep_con_accessorie`, **in coperti**.
- **La ragione di allora**: con una linea sola — la sala — il pareggio in
  coperti è il numero più concreto che esista. «Servono 2915 coperti» si
  traduce in «servono 8 coperti al giorno», che è una frase con cui si
  decide.
- **Cosa si decide adesso**: il pareggio si dice **in euro di ricavo
  totale**, e i coperti restano sotto come numero **condizionato**.
- **Perché la ragione di allora non vale più**: perché le linee sono sei e
  gli scontrini sono diversi. Parole di Alessio: *«con sei linee a
  scontrini diversi quel numero non vuol dire niente»*. Un euro di
  barattoli e un euro di coperti non lasciano lo stesso margine, e sommare
  linee diverse in coperti è sommare cose diverse. ⚠️ Il numero vecchio non
  è stato buttato: è diventato la riga sotto, con la frase che dichiara la
  condizione.

Registrato in [`docs/decisioni_rovesciate.md`](../decisioni_rovesciate.md).

### Le due che NON sono rovesciamenti

1. **`RECIPE_STATI` non rispecchia nessuna colonna.** Sembra un'eccezione
   alla rete dei vocabolari (17/08) e non lo è: quell'elenco è **derivato**
   da tre cose diverse — un booleano, un riflesso, una data — e non c'è
   nessuna colonna con cui possa divergere. Nasce `SPECCHI_ESENTI`, sullo
   stampo di `GUARDIE_ESENTI`: l'eccezione esiste, con la ragione scritta
   accanto e una controprova che la rete non si è spenta.
2. **I vincoli sulle linee nascono `not valid`.** Sembra un cedimento sul
   principio «gli invarianti sono vincoli del database» e non lo è: valgono
   pieni sulle righe nuove, e lasciano stare quelle di una previsione
   **congelata**. Sanarle avrebbe richiesto di spegnere il sigillo — cioè
   di decidere al posto di Alessio che una previsione chiusa si riscrive.

---

## Blocco 0

**(a) Le sette migrazioni**: sopra.

**(b) Il nome sul tavolo**: **era già così**. `RiquadroDelTavolo.jsx:59` —
`const nome = nomePagante ?? prima?.nome` — mostra il pagante quando c'è,
altrimenti quello della prenotazione. ✅ Verificato anche a schermo: su T4,
col pagante impostato, il tavolo mostra **«Alessio»** con **«paga»** sotto.
Nessuna riga toccata.

---

## Blocco 1 — La Dashboard (migrazione `20260824000024`)

### (b) Gli avvisi: la regola ha deciso la forma

Alessio: *«un avviso sparisce DA SOLO quando la cosa è risolta»*. Da lì
discende tutto: un avviso non è una **riga** con uno stato, è una
**condizione calcolata** a ogni apertura — la stessa scelta del ritardo dei
tavoli (18/08). E l'altra regola («Telegram è solo un'uscita») viene gratis
da questa forma: Telegram legge le stesse condizioni e non le tocca.

🔴 **La misura ha cambiato il disegno.** Contate sul progetto di prova:
**65** scadenze da segnalare, **131** prodotti con la scheda incompleta,
**55** ingredienti sotto soglia, **3** conti da fiscalizzare, **6** numeri
sospetti, **1** non conformità aperta, **0** partite ferme, **0** anomalie
di quadratura. Un riquadro che elencasse i FATTI sarebbe stato una lista di
261 righe sulla prima schermata della mattina. Elenca gli **avvisi**: una
riga per famiglia, col numero e dove si va a risolverli.

**Tre fonti restano fuori, dichiarate nella migrazione:**
- *prodotti da compilare* (131) e *sotto soglia* (55): lavoro arretrato che
  non finirà mai a zero, e un avviso che c'è sempre si impara a non
  leggere;
- *numeri sospetti* (6): meriterebbero di starci, ma `numeri_sospetti()`
  **non ha una schermata** — si legge solo da `npm run numeri`. Un avviso
  che non ha dove mandare chi lo legge è un vicolo cieco.

L'unico gesto è «Non adesso» (rimanda di un giorno), che si disfa con
«Rimettilo». ✅ Provati tutti e due col mouse: l'avviso scende in fondo con
la data, e riprendendolo torna in cima.

### (a) e (c)

Le prenotazioni del giorno — orario, nome, coperti, tavolo — con
l'etichetta **fotografata** sulla prenotazione e «da assegnare» detto in
terracotta. ⚠️ E se la lettura fallisce si **dichiara**, col pulsante per
riprovare: le cinque letture sono indipendenti apposta, e una mattina che
dicesse con calma «nessuna prenotazione oggi» avendone otto è il difetto
peggiore di quella schermata, perché è plausibile.
La scorciatoia alle richieste è **un richiamo, non una copia**: conta le
prenotazioni da confermare e la posta in attesa, e compare solo se c'è
qualcosa. ✅ Vista con 21 (13 + 8).

### 🔴 Due difetti di misura, nessuno visibile dal monitor

1. «La sala →», «Agenda completa →», le righe degli impegni e le loro
   caselle stavano a **5,3 / 3,4 mm** contro gli 8,5 della soglia. Il
   secondo era lì da prima.
2. ⚠️ **Alla calibrazione del tablet il testo scendeva a 2,2 mm**: le
   taglie in PIXEL (`text-sm`, `text-xs`) non scalano coi centimetri veri.
   Tutta la schermata è passata a `testo-sala`.

✅ **Rimisurata a 37,8 · 59,5 · 64 punti/cm e a 768 di larghezza: zero
testi sotto 3,2 mm, zero bersagli sotto 8,5, nessuno scorrimento
orizzontale.** 28 elementi controllati.

### 🔴 E la prova non discriminava

Scritta come «lo staff riceve un errore», restava **verde col portiere
tolto**: lo staff veniva fermato lo stesso, ma da `conti_da_fiscalizzare`,
che ha il portiere suo. Dimostrava che una difesa esiste, non che esiste
QUESTA. È la trappola del 24/08 in forma nuova — non «non c'era niente da
fare», ma **«c'era già qualcun altro che lo faceva»**. Ora guarda **quale**
rifiuto risponde: rossa col portiere rotto, verde rimettendolo, provato in
quest'ordine.

---

## Blocco 2 — Il Ricettario (migrazioni `…025`, `…026`, `…027`, `…028`)

### (a) Il ritorno indietro

⚠️ **Non `navigate(-1)`**, che sarebbe stata una riga: il tasto indietro
non sa **dire** dove torna. «← Ragù alla siciliana» è un'informazione, «←»
è una scommessa. La regola sta in `src/lib/calcoli/percorso.js` perché i
punti da cui si scende sono tre.
⚠️ E il percorso si **accorcia** tornando su un passo già fatto: ogni
ricetta elenca sia i componenti sia le ricette che la usano, quindi il giro
A → B → A → B si fa senza accorgersene. Provato rompendolo: senza il
taglio, la prova diventa rossa.

✅ **Provato con le mani a tre livelli**: dentro «Panatura al pistacchio» si
legge «← Bocconcino di tonno», poi «← Selezione di mare», poi «← Ricette».

### (b) Tre porte

Piatti · Preparazioni · Finger. ⚠️ **Sono tre e non due**, ed è l'unico
punto in cui la consegna si allontana dalla lettera della richiesta: i tipi
che il database distingue sono tre, e metterne due insieme rifarebbe in
piccolo il problema che si toglie. La porta sta nell'indirizzo. **Se le
porte giuste sono due, si toglie una riga di `PORTE`.**

### (c) Quattro stati

Le «due file che dicono cose simili» erano **tre**: una pastiglia
premibile, una non premibile, e un'etichetta di testo che ripeteva la
stessa cosa in terza forma.
- Il quarto stato — **ritirata** — è una colonna nuova, ed è una **data**
  (`ritirata_il`), non un interruttore: un booleano tacerebbe su «da
  quando». È il debito dichiarato il 14/08 su `tasks`, scritto giusto
  subito.
- ⚠️ **«In carta» non è un interruttore**: è il riflesso del menu (16/08).
  Toccarlo non lo accende — porta dove si accende.
- **Due porte sbagliate chiuse**, e servivano entrambe: non si ritira una
  ricetta in carta (e il rifiuto **nomina il menu**), e non si mette in
  carta una ritirata.
- Il pannello **«Nei menu»**, che mancava: prima c'era una strada sola.

✅ **Provato con le mani**: messa nel menu in servizio lo stato è passato a
«In carta» **da solo**; tolta è tornato «Pronta per la carta»; ritirata
(«Ritirata il 24 ago 2026. Resta qui con la sua storia») e rimessa in giro.
**Zero residui misurati** dopo.

### (d) I filtri

Categoria, stato, stagionalità, allergeni.
🔴 **«Chi non si sa non è senza»**: una ricetta i cui allergeni nessuno ha
confermato **non compare** fra le «senza glutine». ✅ Misurato: su **51**
piatti ne resta **1**, e la schermata dichiara che **49 restano fuori
perché i loro allergeni non sono confermati**.
⚠️ E l'avvertenza è stata **tolta dalle righe** dopo averla vista: compariva
su quasi tutte, e un'avvertenza che sta dappertutto non distingue niente.

### (e) Il finger food

- «Bocconcino» sparito da tutto il codice. ⚠️ **Ma non dai NOMI delle
  ricette**: la rinomina aveva cambiato anche «Bocconcino di tonno», che è
  un nome dello scenario — rimesso com'era.
- «Finger food» è una **categoria**. La sanatoria riclassifica solo ciò che
  è deducibile senza ambiguità (una ricetta composta di finger **è** finger
  food): 4 righe sulla prova, 0 in produzione.
- **Gli allergeni si sommano già** — `v_recipe_allergens` è ricorsiva a 10
  livelli. ⚠️ Non era **mai stato misurato** su una ricetta fatta di
  ricette (dichiarato non verificato il 19/08): ora la verifica della
  `…026` costruisce il caso con un allergene confermato e controlla che
  risalga.
- **Il bis**: 🔴 la misura dice che **non ha bisogno di niente di nuovo**.
  È una riga di `order_items` che punta a un finger. Nessuna tabella,
  nessuna colonna. ⚠️ E «è un bis» non si scrive, si **riconosce**: una
  colonna «è_un_bis» direbbe la stessa cosa del tipo della ricetta.
- **Il prezzo si propone**, non arrotondato (il taglio dei prezzi è una
  decisione commerciale), e accanto c'è la domanda vera: *«su questo sto
  perdendo margine?»*.

✅ **Provato in sala con le mani**: aggiunta una «Selezione di mare»,
compare «+ bis di un finger» **solo su quella riga**; aprendolo, i **sei
finger di quel piatto col loro prezzo**; scelto uno, in comanda compare
«1× bis di Tartare di gambero» accanto al piatto, che resta quello che era.

🔴 **Il magazzino: provato, non dedotto** (`…028`). Era la promessa che non
si vede a schermo, e la deduzione poteva essere sbagliata:
`fabbisogno_conto` divide per `portions_yield`, che su un finger non
descrive niente — se fosse zero, `nullif` darebbe null e **la merce del bis
sparirebbe senza errore**. Misurato: **0,1 kg** col piatto da solo, **0,5**
col bis, **0,1** togliendolo. I numeri sono scelti perché le risposte
sbagliate diano numeri diversi. Più la **proprietà**: nessun finger può
avere porzioni a zero.

---

## Blocco 3 — La spesa spicciola: **era già fatta**, e aveva un difetto

La tabella, l'API, la schermata e la rotta esistevano già (23/08). ✅
Verificata contro i requisiti aggiungendo quattro articoli: divisa per
categorie (**Dispensa 1 · Pulizia 2 · Senza categoria 1**), articoli
liberi, tocco per mettere nel carrello e nome per rimettere in lista,
raggiungibile dal Magazzino, categorie sue.

🔴 **DIFETTO TROVATO MISURANDO**: fra il pulsante che **rimette in lista** e
quello che **cancella per sempre** c'erano **2,1 mm**, contro i 5 della
soglia — e questa schermata si guarda in piedi davanti a uno scaffale, con
una mano occupata. Più «Togli» era **ambiguo**: in un elenco di cose già
prese si legge «togli dal carrello», cioè il contrario di quel che fa.
Corretto con `.gesti-pericolosi` e rinominato **«Cancella»**. ✅ Rimisurato:
**5,0 mm** a entrambe le calibrazioni.

---

## Blocco 4 — Le sei linee (migrazioni `…029`, `…030`, `…031`)

### Due misure hanno cambiato il lavoro prima di cominciare

1. Il mandato temeva **dieci** funzioni. Chiesto al database chi tocca
   davvero `scenario_linee_accessorie`: **tre**.
2. E ne ha trovata una che il mandato non nominava: in produzione c'è **una
   previsione CONGELATA** (2027) con 12 mesi, 12 risultati fotografati e 4
   linee, sigillata da un trigger.

⚠️ **Quindi le righe vecchie non si toccano** e i vincoli nascono `not
valid`. Il prezzo è dichiarato: per un anno il gestionale legge due forme,
e la conversione sta in **un posto solo** (`forma_della_linea`).

### Il pareggio

✅ Visto a schermo: **«130.987,05 € di ricavo · margine 79,5% dei ricavi»**,
e sotto, più piccolo, *«Sono 2343 coperti di sala se le altre linee vanno
come previsto»*. ⚠️ La frase esce dal database **insieme** al numero.

### Il lettore del foglio

✅ **Provato sul foglio VERO** (`esempio x claude.xlsx`, fuori dal
repository): tutte e quattro le righe riconosciute con la forma giusta —
lounge e chef table `a_coperto`, barattoli `a_pezzo`, eventi `a_forfait`.
Zero problemi. ⚠️ Controprova: una riga «Gelateria estiva» viene **fermata**
col messaggio che dice cosa fare. Indovinare farebbe entrare un numero
plausibile e falso.

### I 17 confronti

Sono **17** (contati dalle chiavi di `scenari_proiezione.controlli`) e sono
ancora quelli. ⚠️ **Il caso si costruisce**: sulla prova nessuna previsione
viene dal foglio, e senza costruirlo il controllo che conta girerebbe per la
prima volta sui dati veri. Con la controprova: cambiando la forma di tutte
le linee, **3** confronti smettono di tornare.

### 🔴 Una rete ha trovato un difetto mio

`linee_della_previsione` è nata **senza portiere** e la prova dei permessi è
diventata rossa da sola. Il verdetto giusto non era dichiararla: espone
**prezzi medi e costi percentuali**. La differenza con `finger_bissabili`,
che resta aperta alla sala, è il contenuto — là un prezzo di vendita che il
cameriere legge sul menu, qui un margine.

### 🔴 E una linea di ricavo spariva salvando

Trovato **nella rilettura prima della consegna**, chiedendomi quale gesto
avessi scritto senza provarlo. Il filtro teneva solo le righe col
**codice**, e le linee vecchie non ce l'hanno:
`aggiorna_scenario_proiezione` rifà le righe da capo, quindi correggendo
una previsione vecchia le sue linee **sparivano**. ✅ Misurato: la riga
«Aperitivi» se n'è andata davvero. Lint pulito, build riuscita, 394 prove
verdi — l'ha trovata solo il salvataggio fatto con le mani.
La regola è passata in una funzione pura (`righeDaSalvare`), come
`payloadMancia` e per la stessa ragione. ✅ Controprova nei due versi.

---

## Cosa NON è verificato

### Non l'ha visto nessun occhio

1. 🔴 **Nessuna delle otto migrazioni di oggi è in produzione.** Sono sul
   progetto di prova. Aspettano il push di Alessio e poi
   `npm run migra -- --conferma`.
2. 🔴 **Tutte le schermate sono state guardate su un monitor a 1568 punti**,
   non su un tablet vero. Le misure in millimetri sono state fatte
   simulando `--pxcm` a 59,5 e 64 e la larghezza a 768 — che è il metodo
   giusto, ma **non è una mano su un tablet**.
3. ⚠️ **Il bis non è mai stato INVIATO in cucina né chiuso in un conto**:
   provato come bozza in sala e come fabbisogno dentro la migrazione. Il
   giro «invia → cucina stampa → conto chiuso → magazzino scende» non
   l'ha fatto nessuno.
4. ⚠️ **La spesa spicciola: i 5 mm sono misurati, non toccati con un dito.**
5. ⚠️ **Il pannello dei menu di una ricetta non è stato provato con più di
   un menu attivo**, perché il menu attivo è uno solo per costruzione.
6. ⚠️ **Il filtro allergeni non è stato provato su una ricetta con allergeni
   CONFERMATI e senza glutine**: sulla prova ce n'è una sola, ed è quella
   che resta. Il caso «confermata e con glutine» non è stato costruito.

### Dato per fatto senza misurarlo

7. ⚠️ **Che i 17 confronti in produzione tornino ancora dopo l'applicazione.**
   Il connettore in sola lettura **non ha il permesso** di eseguire
   `confronto_col_foglio` (`42501`), quindi non ho potuto misurarli lì. La
   verifica della `…030` li controlla al momento dell'applicazione e si
   **ferma** se anche uno solo non torna: è una rete, non una misura fatta.
8. ⚠️ **Che la previsione congelata di produzione non si muova di un
   centesimo.** La verifica della `…029` lo controlla contro i risultati
   fotografati, ma sulla prova quel controllo **non ha misurato niente**
   (nessun risultato fotografato lì) — e lo dichiara con un `notice`. Al
   suo posto ho costruito il caso dell'equivalenza fra forma dedotta e
   forma scritta.
9. ⚠️ **Che il consuntivo non segnali una linea a zero come scostamento
   negativo.** Misurato che `andamento_anno` confronta **sei indicatori di
   sala** e le linee non ci entrano: quella metà della regola oggi **non ha
   dove mordere**, ed è una conseguenza della dipendenza pranzo/cena che
   Alessio ha esplicitamente rinviato.

### Affermazioni diventate false mentre lavoravo

10. **«Le linee accessorie sono quattro righe di testo libero»** — vera
    stamattina, falsa da `…029`: ora hanno un codice e una forma.
11. **«Il pareggio si legge in coperti»** — era la descrizione della scheda
    della previsione fino a stasera.
12. **«`RECIPE_STATI` è un elenco come gli altri»** — l'ho scritto nel
    primo giro e la rete dei vocabolari l'ha smentito nello stesso giro.
13. 🔴 **«Il filtro delle linee tiene le righe col codice»** — l'ho scritto
    io poche ore fa nel commento del form, ed era il difetto: quella frase
    descriveva esattamente il comportamento che faceva sparire una linea.

---

## Le prove

- **399** prove pure (erano 384): +7 sul percorso inverso, +3 sugli elenchi
  esenti, +5 sulle righe da salvare.
- **372** prove sul progetto di prova (erano 367): +5 sugli avvisi, +5
  sulle linee della previsione, meno due file riorganizzati.
- **Rotture fatte apposta, e cosa hanno trovato**: il portiere degli avvisi
  (→ la prova non discriminava, difetto vero), il taglio dei cicli nel
  percorso (→ rossa, corretto), la forma delle linee (→ i confronti si
  rompono, quindi il calcolo la guarda).

## Cosa resta aperto

- **Il consuntivo per linea**, che dipende dal fatto che il gestionale
  distingua pranzo e cena. Rinviato da Alessio nel mandato stesso.
- **La schermata dei numeri sospetti**, senza la quale quell'avviso non può
  entrare nel riquadro della Dashboard.
- **`bep_solo_sala` e `bep_con_accessorie`** restano in
  `riepilogo_calcolato` e non sono più mostrati: sono i due numeri vecchi,
  e il giorno che nessuno li legge si tolgono.
- **La colonna `base` di `scenario_linee_accessorie`**, che vive solo
  finché esiste la previsione congelata scritta prima di oggi.
