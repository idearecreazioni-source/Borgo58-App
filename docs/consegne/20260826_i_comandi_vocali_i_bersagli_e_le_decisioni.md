# I comandi vocali, i bersagli fra 5 e 8 mm, le decisioni del 14-21 agosto

**26/08/2026** · consegna di tre blocchi · HEAD dichiarato: **`ef759a3`**
(l'ultimo commit di lavoro; sopra di lui sta solo questo riepilogo) ·
working tree **pulito**.

🔴 **E QUESTA RIGA È STATA GIÀ UNA VOLTA FALSA**, il che la dice lunga sul
perché la regola esiste: la prima stesura dichiarava `90ee532`, e poi sono
arrivati due commit — questo riepilogo e la voce nel menu. Un hash
dichiarato che non è quello pushato manda chi controlla a leggere un
codice diverso da quello che sta guardando.

⚠️ **E la correzione è arrivata DOPO il push, non prima** — anche questo
va detto invece che lasciato intendere: il primo push è uscito con l'hash
vecchio scritto qui dentro, e questo riepilogo lo corregge nel push
successivo. Nessun codice è cambiato in mezzo: quello che era sbagliato
era solo la riga che dice dove guardare.

I commit della consegna, in ordine:

| commit | cosa |
|---|---|
| `db83e7f` | La voce capisce una filza intera, e fa quello di cui è sicuro |
| `57fea27` | I bersagli fra 5 e 8 mm: censiti tutti, e chiusi con quattro classi |
| `90ee532` | Le decisioni del 14-21 agosto tornano a dire cosa vale adesso |
| `ce88063` | questo riepilogo (prima stesura) |
| `ef759a3` | «Parla e basta» nel menu, e la Dashboard non grida se la voce non c'è |

---

## RILETTURA PRIMA DELLA CONSEGNA

*Regola fissa di Alessio, 24/08. Sta in cima perché è la parte che si
salta per prima.*

### Quali voci di `docs/DECISIONI.md` ho toccato

**Aggiunte** (non ne ho contraddetta nessuna):
- sezione **Assistente — voce**: nove voci nuove (le otto del mandato più
  «quando non trova il prodotto mette quella riga da parte»);
- sezione **Sorvegliante notturno**: nuova, tre voci dal mandato;
- sezione **Allergeni**: due voci dal mandato;
- sezione **Sala e pianta**: nuova, diciassette voci **recuperate**;
- sezioni *Magazzino e scarico*, *Ricette e menu*, *Cassa*, *Schermate*,
  *Comande e sala*, *Fatture*: una voce recuperata ciascuna;
- sezione **Preventivi ed eventi**: nuova, una voce recuperata;
- sezione **Copertura**: riscritta (vedi «affermazioni diventate false»).

**Voci in vigore che ho seguito e che avrei potuto contraddire:**
- *«Si preme per accendere e si riprende per spegnere, mai tenere
  premuto»* — rispettata, e c'è il segno che sta ascoltando.
- *«Gli allergeni dedotti valgono come confermati»* — non toccata.
- *«In produzione non deve nascere nessun conto bancario inventato»* — non
  toccata: questa consegna non applica niente in produzione.
- *«I bersagli fra 5 e 8 mm sono lasciati apposta e si affrontano tutti
  insieme in un giro loro»* — è il blocco 2, fatto come dice.

### Cosa NON ho verificato con gli occhi

- 🔴 **Nessuno ha parlato al microfono.** Il riconoscimento vocale del
  browser non si può azionare da qui: **la trascrizione non è mai stata
  esercitata in questa sessione**. Quello che è stato provato è tutto ciò
  che sta *dopo* — il testo che arriva, l'interpretazione, l'esecuzione.
  Alessio la trascrizione l'ha già provata il 12/08 e funziona bene, ma
  **non dentro questa schermata**.
- 🔴 **La Scorciatoia dell'iPhone non esiste ancora**, e la parte
  dell'Apple Watch nessuno l'ha vista. Il punto che riceve è provato
  (chiave, freno, impersonazione, revoca) dalla verifica della migrazione
  e dalle prove sul database; il pezzo che va dal polso al gestionale no.
- **Nessuna immagine guardata**: lo screenshot non funziona in questo
  ambiente. Tutto ciò che è «visto» delle schermate è **misurato dal DOM**.
  Colori, contrasto e leggibilità con la luce della cucina non li ha visti
  nessuno.
- **Niente è stato applicato in produzione**: cinque migrazioni aspettano
  il via libera di Alessio (vedi in fondo).

### Cosa ho contato senza leggerlo

- **Le 48 sezioni di `decisioni_rovesciate.md`**: ho letto per intero le
  24 del 14-21 agosto e **quattro** delle altre (nn. 6, 20, 22 e la 4, per
  decidere se erano decisioni di Alessio). Le rimanenti venti le ho solo
  contate, e da lì viene il rilievo sull'indice — che è un conteggio, non
  una lettura.
- **Le 73 schermate del censimento**: misurate dal DOM, non guardate una
  per una. Il misuratore dice quanto è alto un bersaglio, non se quel
  bersaglio ha senso dov'è.

### Quali mie affermazioni sono diventate false mentre lavoravo

1. 🔴 **La sezione «Copertura» di `DECISIONI.md`** diceva *«il recupero è
   in coda e va fatto in una sessione sua»*. È diventata falsa nel momento
   in cui il recupero l'ho fatto. Riscritta.
2. 🔴 **La riga «Denso dal 22/08 in poi, più rado prima»**: falsa dopo il
   blocco 3. Ora dice 14/08.
3. 🔴 **Il commento di `.tocco-inline`** diceva *«misurato: da 3,97 a 8,50
   mm»* con un padding di 0,227. Alla densità del tablet dava **8,40**, non
   8,50: il numero era calcolato su una sola densità. Corretto a 0,25 e il
   commento lo dichiara.
4. **Il mio primo censimento diceva 3437 bersagli fuori norma.** Era falso:
   il misuratore convertiva in centimetri e confrontava con una soglia in
   millimetri.
5. 🔴 **E IL «598» CHE L HA SOSTITUITO E FALSO A SUA VOLTA — rilievo di
   Alessio, 26/08.** Non nel conteggio: nella SCALA. Quel censimento gira a
   densita **stimata** (37,8, il valore di un monitor), e solo dopo ho
   misurato alla densita vera del tablet trovando bersagli che a 37,8
   risultavano sopra soglia. **Il 598 e un pavimento preso col metro
   sbagliato**, e non l ho mai rimisurato con quello giusto: il numero vero
   era piu alto, e quanto non si sa.
   ⚠️ **Lo zero finale invece vale**, perche e verificato a tutte e tre le
   densita. Ma i due numeri **non stanno sulla stessa scala**, e questo
   riepilogo li presentava come un prima-e-dopo. Corretto ovunque, perche
   e esattamente il tipo di numero che fra tre mesi qualcuno rilegge
   credendoci.
6. **La prima diagnosi del collaudo vocale** — «non ho trovato questo
   prodotto in magazzino» su cinque prodotti riconosciuti benissimo — era
   una **frase falsa prodotta dal gestionale**, non da me, ma l'avrei
   riportata come vera se non avessi guardato i permessi.

### Conteggi che sono pavimenti

- «almeno 20 decisioni recuperate»: sono quelle che
  `decisioni_rovesciate.md` racconta. Una decisione di quei giorni **mai
  rovesciata** non compare lì e non è stata contata.
- «almeno 2526 bersagli guardati»: sono quelli che il setaccio riconosce
  (`button, a, input, select, textarea, [role=button], summary`). Un
  elemento reso toccabile con un `onClick` su un `div` non è contato.
- «almeno 73 schermate»: le rotte senza parametro. Le schermate di
  dettaglio (`/ricettario/ricette/:id`, `/personale/:id`…) non sono state
  aperte.

---

## BLOCCO 1 — I comandi vocali

### Che cosa fa

Alessio preme una volta, dice una filza intera, ripreme. Il gestionale ne
ricava un elenco di azioni: quelle di cui è sicuro le fa, le altre le
mette davanti a lui.

**Provato con l'API vera sul progetto di prova**, non simulato:

| detto | esito |
|---|---|
| «di bottarga di tonno ce ne sono ottocento grammi, la crema di pistacchio di Bronte due chili e mezzo, il caciocavallo ragusano quattro chili, aggiungi alla lista le busiate trafilate e buttane mezzo chilo di ricotta di pecora» | **5 azioni, 5 fatte**, tutti i nomi abbinati al prodotto giusto · 12,7 s · 0,035 € |
| «di pomodoro ce ne sono dieci chili e di olio cinque litri» | **2 azioni, 0 fatte**: *«in catalogo ci sono Pomodoro ciliegino, Pomodoro da salsa, pomodoro picadillo e Pomodoro secco di Pachino. Quale intendi?»* |
| «segna tre gradi» | **non scrive niente**: *«Non hai detto quale frigo»* |
| «la cella del pesce è a un grado e mezzo, e l'abbattitore a meno diciannove» | **2 fatte**, frigoriferi giusti |
| «poi domani bisogna vedere quella cosa là del coso con Turiddu» | promemoria per domani + *«non ho capito a cosa si riferisce "quella cosa là del coso"»* |
| «segna un'uscita di cassa di cinquanta euro per il gasolio» | **in attesa**, benché sicurissimo |

### Il criterio salva-da-sé è un PRINCIPIO, non un elenco di rami

Vive in `tipi_azione_vocale.natura` — `misura` oppure `creazione` — e la
regola che decide sta in **una** funzione, `azione_si_esegue_da_se`.
Aggiungere un'azione è una **riga**, non un ramo di programma.

- **misura** = un fatto già avvenuto che Alessio registra, e che sbagliato
  si corregge rifacendo il gesto. Sono sette.
- **creazione** = fa nascere qualcosa o tocca i soldi. Lì l'errore non si
  vede rifacendo il gesto: si vede fra tre mesi in un food cost storto.
  Sono quattro.

Il controllo che vale di più nella verifica è il terzo dei quattro
incroci: **creazione + sicuro = non si esegue**. È il caso in cui il
criterio sembra un di più e invece è tutto.

### L'audio non lascia mai il dispositivo

La trascrizione avviene nel browser (riconoscimento vocale di sistema) o,
dal telefono, nell'azione «Detta testo» della Scorciatoia. Quello che
viaggia verso il gestionale è **già testo**. Non c'è nessuna registrazione
da conservare né da cancellare — stessa forma della foto del 25/08.

⚠️ **Il mandato dice «una Scorciatoia registra e manda l'audio».** La
Scorciatoia registra e trascrive **sul telefono**, e manda il testo: il
punto sostanziale della decisione — niente Memo Vocali, innesco
dall'Apple Watch, il gestionale deve solo saper ricevere — è rispettato.
La ragione tecnica è nella domanda n. 2 in fondo.

### La chiave, dal primo giorno

`chiavi_voce` conserva **l'impronta**, mai la chiave: si vede una volta
sola quando nasce. `voce_apri_sessione` e `registra_dettatura_da_chiave`
sono aperte al ruolo anonimo **per forza** — una Scorciatoia non ha un
accesso al gestionale — e per questo:

- il portiere è la chiave stessa, confrontata per impronta;
- il **freno anti-abuso** che il Contratto §4 pretende sta in
  `voce_apri_sessione`: 60 dettature all'ora da quella strada, poi si
  ferma e dice perché;
- riconosciuta la chiave, la funzione **impersona** l'utente per la sola
  durata della transazione, così i controlli sottostanti guardano il ruolo
  vero invece che un anonimo. **Chi ha la chiave può fare quello che fa
  Alessio dalla voce**: scritto in maiuscolo nella migrazione.

**L'elenco delle funzioni aperte ad `anon` sale da 10 a 12**, dichiarato
nella prova che lo sorveglia. **Quello delle `security definer` senza
portiere da 22 a 23** (`azione_si_esegue_da_se`, che legge un catalogo già
aperto in lettura a tutto lo staff).

### I difetti trovati, e come

🔴 **Tre difetti miei, tutti trovati ESEGUENDO, nessuno rileggendo.**

**(a) Le tre funzioni che traducono un numero del catalogo erano rimaste
senza permesso** — `revoke` senza il `grant` accanto. Misurato:
`has_function_privilege` diceva `false` per `authenticated` e per `anon`.

⚠️ **E il difetto che conta non è quello: il rifiuto veniva INGHIOTTITO.**
Chi chiamava leggeva l'errore e restituiva «non ho trovato». A schermo,
cinque prodotti riconosciuti benissimo — bottarga di tonno, caciocavallo
ragusano, busiate trafilate — comparivano tutti con la frase *«Non ho
trovato questo prodotto in magazzino»*. Un permesso mancante travestito da
magazzino vuoto: la famiglia di *«non vuol dire che è vuota, vuol dire che
non lo so»*.

**La cura non è il `grant`.** Quel giro era sbagliato più a fondo: il
database NUMERAVA e chi stava fuori chiedeva la TRADUZIONE, con un giro di
rete per ogni cosa detta — e ogni giro era un posto dove un rifiuto poteva
travestirsi da risposta. Ora la traduzione avviene **dentro** la funzione
che registra: chi numera e chi ritraduce sono lo stesso codice nella
stessa transazione, e le tre traduttrici restano private.

**(b) `record_stock_consumption` restituisce `void`**, e buttare la merce
falliva con *«invalid input syntax for type json»* — un errore che parla
di JSON per una funzione che di JSON non ne ha mai visto.

🔴 **E LA VERIFICA CHE LO PROVAVA ERA VERDE.** Provava quel ramo — «butta
due chili di una cosa che non c'è» — e controllava che fallisse. Falliva.
Ma **per la ragione sbagliata**: non perché il prodotto non esisteva, ma
per il tipo di ritorno. *Le due cause producono lo stesso rosso.*

⚠️ **La regola che ne esce, e vale oltre questo caso: quando una prova si
aspetta un rifiuto, deve guardare CHE COSA dice il rifiuto.** Altrimenti
qualunque rottura estranea la fa passare. È la trappola del caso vuoto
(17/08) in una forma nuova.

**(c) Confermare una cosa rimasta in attesa sarebbe fallito SEMPRE.** Chi
risolveva cercava il numero del catalogo dove ormai c'era già
l'identificativo, e rispondeva «non ho capito di quale prodotto stavi
parlando» su un'azione in cui il prodotto era scritto per esteso.
⚠️ Trovato dalla verifica del punto (b), che si aspettava «fallita» e ha
ottenuto «in attesa»: due esiti diversi che una prova distratta avrebbe
letto entrambi come «non è andata».

### Le prove, e come sanno fallire

- **20 prove pure** (`tests/unita/voce.test.js`) sulle regole di lettura
  del riscontro. Rotte apposta: incollando le frasi senza spazio, **3
  diventano rosse**.
- **17 prove sul database vero** (`tests/app/voce.test.js`), col token di
  un utente vero — l'unico modo di prendere un difetto che vive nei
  permessi. Rotta apposta la natura del movimento di cassa, **2 diventano
  rosse**, e sono quelle giuste.
- **Le verifiche dentro le cinque migrazioni**: rotto il criterio, la
  `…0002` si ferma con *«Il movimento di cassa non è rimasto in attesa: è
  il caso che il criterio esiste per fermare»*.
- 🔴 **E una rottura ha misurato che la difesa è doppia**: tolto il
  controllo sul frigo dalla funzione, **il vincolo del database ferma
  comunque** la temperatura senza frigo. Provato chiamando davvero, non
  dedotto.
- ⚠️ **Una rottura non è riuscita, e il perché è un risultato**: provando
  a rompere il file di una migrazione, **la rete delle guardie l'ha
  bloccata** — il corpo vivo non combaciava più col file. Ha funzionato
  come deve.

### Senza rete

Provato **rompendo apposta il modello** e reinstallando la funzione. Esito:

> *«L'assistente non ha risposto. Quello che hai detto è stato messo da
> parte: lo trovi nelle cose da guardare.»*

E la dettatura **è stata registrata col suo testo**, con una nota fra le
cose in attesa. La frase non si perde: è la condizione perché uno continui
a usarla.

### Niente scade da solo

Un'azione non confermata resta `in_attesa` **per sempre**.
`azioni_dettate_in_attesa()` dice da quanti giorni aspetta, e in Dashboard
compare un riquadro — «3 cose che hai detto aspettano che tu le guardi —
la più vecchia da ieri». Compare **solo se c'è qualcosa**, come i due
riquadri accanto.

### La misura della schermata

**390 punti**, densità `--pxcm` **37,8 / 59,5 / 64**:

| | |
|---|---|
| sbordo | **0** a tutte e tre |
| bersagli guardati | 28 |
| sotto 8,50 mm | **0** |
| pulsante del microfono | **12,00 mm** (il bersaglio più usato, misurato per primo) |
| testi sotto 3,20 mm | **0** su 51 |
| distanza fra «Sì, fallo» e «Lascia perdere» | **28,46 mm** |

🔴 **Un difetto trovato misurando**: il gesto che apre la guida stava a
**7,87 mm**. Corretto a 10,50.

---

## BLOCCO 2 — I bersagli fra 5 e 8 mm

### Il censimento, prima della cura

**73 schermate a 390 punti: almeno 598 bersagli sotto gli 8,50 mm, in almeno
54 forme distinte.** Di questi **178 sotto i 5 mm**, che è la fascia peggiore.

🔴 **«ALMENO», E NON È UNA CAUTELA DI FORMA: QUEL NUMERO È PRESO COL METRO
SBAGLIATO.** Il censimento gira a densità **stimata** — 37,8 punti per
centimetro, il valore di un monitor — e più avanti, misurando alla densità
vera di un mini tablet, sono comparsi bersagli che a 37,8 risultavano sopra
soglia. **Non ho mai rifatto il censimento iniziale con la scala giusta.**
Quindi il numero vero era più alto, e di quanto non si sa.

⚠️ **Lo ZERO finale vale**, perché è verificato a **tutte e tre** le densità.
Ma i due numeri **non stanno sulla stessa scala**: il 598 è un pavimento
misurato male, lo zero è una proprietà misurata bene. Presentarli come un
prima-e-dopo — che è quello che questo riepilogo faceva — fa credere a un
conto che non torna. *Rilievo di Alessio, 26/08.*

🔴 **IL MIO MISURATORE SBAGLIAVA, e la prima passata diceva 3437.**
Convertiva in **centimetri** e confrontava con una soglia in
**millimetri**: «Agenda completa →», che avevo misurato a mano a 10,5 mm,
risultava 1,05 e finiva fra i colpevoli. E misurava il **quadratino** di
una casella invece dell'etichetta che si tocca — la lezione del 25/08,
ripetuta. Corretti tutti e due, i colpevoli scesero a 598 — che però resta
un pavimento preso alla densità sbagliata, vedi sopra.

### La cura è una classe, non 54 correzioni

Quelle occorrenze non erano altrettanti difetti: erano **poche forme
ripetute**.
La più diffusa — un gesto scritto a parole, alto 4,00 mm — compariva in
otto schermate e cinquantaquattro volte, **con cinque varianti di
scrittura** perché ogni volta era stata scritta a mano. Correggerle una
per una avrebbe voluto dire trovarle tutte, oggi e la prossima volta.

Quattro classi in `index.css`:

| classe | per | come |
|---|---|---|
| `.tocco-testo` | il gesto scritto a parole («Rimuovi», «spegni») | padding + margine negativo: il gesto resta dov'è nella disposizione |
| `.tocco-campo` | campi e menu in cui si scrive col dito | altezza minima |
| `.tocco-inline` | il collegamento **dentro una frase** | resta in linea, cresce solo il rettangolo cliccabile |

**Nessuna cambia la dimensione del testo.** Un «Rimuovi» in fondo a una
riga non è il gesto principale di quella riga: ingrandirlo lo farebbe
sembrare tale.

### Misurare solo a 37,8 nasconde difetti

🔴 Alla densità vera di un mini tablet — **59,5 e 64** — sono comparsi
**undici bersagli** che a densità da monitor erano sopra soglia: i padding
in pixel valgono meno millimetri dove lo schermo è più fitto. È la regola
del 21/08 in CLAUDE.md, verificata invece che ricordata.

E **due sbordi**, visibili solo lì:
- `/documenti/posta`: un indirizzo di posta lungo che non andava a capo —
  **107 punti su 390**;
- `/fiscale/previsioni`: il campo per scegliere il foglio — **59 punti**.

### La misura finale

| | prima | dopo |
|---|---|---|
| bersagli sotto 8,50 mm | ≥ 598 (≥ 54 forme) ⚠️ a densità stimata | **0** a 37,8 · 59,5 · 64 |
| di cui sotto 5 mm | ≥ 178 ⚠️ stessa scala | **0** |
| sbordi | 2 | **0** |
| bersagli guardati | — | **2526** |
| schermate | 73 | 73 |
| densità provate | — | 37,8 · 59,5 · 64 |

⚠️ **E fuori dalle schermate: zero.** Il censimento del 22/08 aveva
trovato lì il pulsante del menu e le voci della barra — «in nessuna
schermata e in tutte». Ho cercato di nuovo: sono già a norma da allora.
Lo zero è una risposta, non un buco: il setaccio guardava anche fuori da
`<main>` e ha misurato 0 elementi sotto soglia.

---

## BLOCCO 3 — Le decisioni del 14-21 agosto

### La premessa del validatore, verificata

Il mandato dichiarava MISURATO: *24 voci in quel periodo, di cui 22
nominano Alessio*. **Regge**, e va precisata: le **sezioni** sono 24, ma
la tabella dell'elenco in cima al file ne conta solo 18 — le altre sei
hanno il racconto e non l'indice.

### Contare non è leggere

🔴 **«Nomina Alessio» non voleva dire «è una sua decisione».** Lette una
per una: **20 delle 24** lo erano.

Le altre quattro **restano dove stanno**, e il perché è di merito:
- **n. 6** — il conto aperto in Comande passa da dorato a scuro: è una
  correzione tecnica di un'ambiguità (il dorato voleva già dire «primo
  giro»), non una scelta sua;
- **n. 20** — il preventivo senza allegato: rovescia una cosa che Alessio
  *voleva*, perché in questo gestionale non esiste una libreria per
  produrre PDF;
- **n. 22** — il file orfano nel deposito: correzione tecnica;
- **n. 4** — portata su la **sola parte** che ha misurato lui: i 5,3 mm
  provati con le mani. Il 75% del disegno è implementazione.

### Cosa è stato scritto

**17 voci** nella sezione nuova *Sala e pianta*, **1** in *Preventivi ed
eventi* (nuova), **4** distribuite in *Magazzino e scarico*, *Ricette e
menu*, *Cassa*, *Schermate*; **2** recuperate dalle annotazioni di
collaudo.

Una è marcata **SUPERATA** con il rimando: *«un tocco sulla sagoma apre
sempre il riquadro»* (18/08), rovesciata poche ore dopo da *«su un tavolo
libero si va dritti ai campi»*. Alessio ha chiesto che le superate
restino, così nessuno le ripropone come nuove.

### Il difetto trovato cercando

🔴 **`decisioni_rovesciate.md` ha 48 sezioni e un indice di 18.** Trenta
rovesciamenti hanno il racconto e non compaiono nell'elenco — e
quell'elenco esiste per rispondere **contando** a *«questa decisione
l'abbiamo già rovesciata prima?»*. Un indice che ne conta 18 su 48 dà a
quella domanda una risposta tranquilla e sbagliata.

E **un numero è usato due volte**: il 18 è sia «un predefinito sbagliato
si corregge» (19/08) sia «menu e pianta su due colonne» (21/08).

⚠️ **NON l'ho ricostruito**, e la ragione è la stessa per cui il recupero
è stato fatto leggendo: trenta righe di indice rifatte a colpo d'occhio
darebbero un indice **plausibile**, che è peggio di uno dichiaratamente
monco. C'è una nota in cima al file che dice a chi legge di non fidarsi
del conteggio finché non è fatto. **In coda.**

---

## COSA ABBIAMO ROVESCIATO

**Niente.** Nessuna decisione in vigore di `docs/DECISIONI.md` è stata
contraddetta da questa consegna, e nessuna riga di
`decisioni_rovesciate.md` è stata aggiunta.

⚠️ **Il caso che ci è andato più vicino, e perché non lo è:** la decisione
del 25/08 dice *«una Scorciatoia iOS registra e manda l'AUDIO
direttamente al gestionale»*. Il ricevitore costruito accetta **testo**,
perché la Scorciatoia trascrive sul telefono. Non è un rovesciamento: il
punto della decisione — niente Memo Vocali, innesco dall'Apple Watch, il
gestionale deve solo saper ricevere — è rispettato intero, e il mezzo
cambia per una ragione tecnica (nel progetto non esiste nessun servizio
che trascriva audio, e Claude non lo fa). **Se Alessio ritiene che il
mezzo fosse la sostanza, è la domanda n. 2 e diventa un rovesciamento da
registrare.**

---

## STATO DELLE MIGRAZIONI

**Cinque migrazioni nuove, TUTTE applicate al solo progetto di prova, in
attesa del via libera di Alessio per la produzione:**

| versione | cosa |
|---|---|
| `20260826000001` | il magazzino della voce: azioni, natura, registro, chiavi; la spesa del mese conta foto e voce insieme |
| `20260826000002` | i gesti: registrare, eseguire, annullare, le due porte |
| `20260826000003` | il riscontro si legge alla fine |
| `20260826000004` | il numero del catalogo diventa il prodotto giusto |
| `20260826000005` | buttare la merce non restituisce niente |

Prova: **259 migrazioni registrate**. Produzione: **non toccata**.

⚠️ **La `20260826000002` si è fermata due volte** nel suo blocco di
verifica mentre la scrivevo (una colonna, un nome di tabella), lasciando
le funzioni già create — è il caso di §8, «una migrazione che fallisce
dopo le DDL». Non era ancora registrata da nessuna parte, quindi il file è
stato corretto invece di aggiungerne uno accanto; le successive
(`…0004`, `…0005`) invece **aggiungono** perché la `…0002` era già
applicata.

**Funzioni online**: `ascolta-voce` (nuova) e `operazioni-atomiche` (due
operazioni in più) installate **sul solo progetto di prova**. In
produzione vanno installate dopo il push.

---

## LO STATO DEL PROGETTO DI PROVA

Il collaudo con l'API vera ha toccato dati veri della prova. Ripulito e
misurato dopo:

| | |
|---|---|
| dettature / azioni / chiavi | **0** |
| task nati dalla voce | **0** |
| righe di lista, temperature, sprechi recenti | **0** |
| ingredienti | **133**, come prima |
| lotti orfani | **0** |

⚠️ **Quello che NON posso affermare**: le giacenze di sei prodotti sono
state allineate dal collaudo, e **non le avevo misurate prima**. Ho tolto
le rettifiche e le partite create allora, ma non posso dire che siano
tornate esattamente al valore di partenza. È il progetto di prova, che si
rifà da zero con un comando — ma va detto invece che sottinteso.

---

## COSA RESTA APERTO

1. 🔴 **La catena a mani libere non è mai stata percorsa**: Scorciatoia,
   Apple Watch, schermo spento. La guida c'è (dentro la schermata e in
   `docs/guide/SCORCIATOIA_VOCE.md`), il ricevitore è provato, il pezzo in
   mezzo no.
2. 🔴 **Nessuno ha parlato al microfono dentro questa schermata.**
3. **L'indice di `decisioni_rovesciate.md`**: 30 righe da ricostruire
   rileggendo, più il numero 18 usato due volte.
4. **Le schermate di dettaglio** (`/…/:id`) non sono entrate nel
   censimento dei bersagli.
5. **`azioni_della_dettatura` non restituisce il risultato** di un'azione
   eseguita. Nessuna schermata lo usa oggi, quindi non è stata aggiunta
   una colonna per una cosa che nessuno chiama.

---

# ADDENDUM — l'applicazione in produzione (26/08, pomeriggio)

Alessio ha dato il via libera **dopo** aver letto la parte qui sopra. Questa
sezione è scritta dopo l'applicazione e riporta i numeri veri.

## Non erano cinque: erano dodici

🔴 **La premessa del via libera non reggeva, e l'ho detto invece di
allargarmi il permesso.** Il riepilogo qui sopra diceva «cinque migrazioni in
attesa», ed era vero — cinque sono mie. Ma davanti a quelle ce n'erano
**sette di ieri** mai applicate: l'assistente che legge le etichette, gli
allergeni, le linee dei coperti.

⚠️ **E le mie cinque non stavano in piedi da sole.** Misurato in produzione,
non dedotto: `letture_foto`, `impostazioni_ai`, `costo_modello_ai` e
`spesa_ai_del_mese` **non esistevano**. La mia prima migrazione *riscrive*
`spesa_ai_del_mese` per farle contare anche la voce: senza le sette sotto,
riscriveva una funzione inesistente leggendo tabelle inesistenti. **O dodici,
o zero.**

Alessio ha confermato la diagnosi e allargato il via libera: *«il mio via
libera a cinque era sbagliato perché quel numero l'avevo letto in un
riepilogo senza contarlo»*.

## Quali toccano dati esistenti

**Nessuna delle dodici.** Tutte aggiungono soltanto: tabelle nuove, colonne
nuove, funzioni nuove.

⚠️ **Verificato leggendo, non contando.** Un setaccio sui file segnalava
`update` e `delete` in tre migrazioni (la `…013`, la `…014` e la `…0002`):
aperte e lette, **tutte quelle righe stanno dentro corpi di funzione** — sono
il codice che gira quando qualcuno usa il gestionale, non sanatorie che
riscrivono righe già presenti. Le uniche scritture vere sono i **semi** di
tabelle nuove: il listino dei modelli, la riga unica delle impostazioni, gli
undici tipi di azione vocale.

⚠️ **E due colonne nuove nascono su tabelle che potevano avere righe** —
`orders.linea` dalla `…019`. In produzione i conti sono **zero**, quindi non
c'era nessuna riga a cui rispondere al posto di Alessio; e la colonna nasce
senza valore predefinito, che è la regola del 14/08.

## Prima e dopo, misurato

| | prima | dopo |
|---|---|---|
| migrazioni | 247 (ultima `20260825000012`) | **260** (ultima `20260826000006`) |
| **conti bancari** | 0 | **0** ✅ |
| **«Previsione di partenza» congelata il** | `2026-08-15 20:29:38.087382+00` | **identico** ✅ |
| previsioni | 1 | 1 |
| lapidi (`deleted_records`) | 0 | 0 |
| ingredienti · ricette · menu | 0 · 14 · 1 | invariati |
| conti · prenotazioni · movimenti di cassa | 0 · 0 · 0 | invariati |
| documenti · impegni · sagome · fornitori | 0 · 8 · 13 · 0 | invariati |
| partite di magazzino · scarichi · rettifiche | 0 · 0 · 0 | invariati |
| ruoli | 4 | 4 |

**Cose nuove, tutte a zero come devono:** dettature 0, azioni dettate 0,
chiavi della Scorciatoia 0, letture foto 0, allergeni per prodotto 0.
**Il catalogo delle azioni vocali: 11 — sette che si salvano da sé, quattro
che passano dai suoi occhi.** Listino dei modelli: 2.

**Tetto di spesa dell'assistente: 10,00 €**, messo il 26/08 su decisione di
Alessio, passando dalla funzione del gestionale (`imposta_tetto_ai`) e non da
una scrittura a mano — così vale il vincolo che rifiuta lo zero, ed è lo
stesso identico gesto che farebbe la schermata.

## 🔴 UN RESIDUO, TROVATO MISURANDO E NON FIDANDOSI

Dopo l'applicazione, in `dettature` è rimasta **una riga** creata dalla
verifica della `20260826000005`, con la sua azione. Il messaggio della
migrazione diceva che si era ripulita.

**La causa vale più del residuo.** La verifica si segnava l'identificativo di
ciò che creava — come vuole la regola del 23/08 — ma **nella stessa
variabile, tre volte**:

```
v_dett := (v_ris->>'dettatura_id')::uuid;   -- caso (A)
…
v_dett := (v_ris->>'dettatura_id')::uuid;   -- caso (C), la sovrascrive
…
delete from dettature where id = v_dett;    -- cancella (C)
delete from dettature where id = v_dett;    -- cancella (C) di nuovo
```

⚠️ **La regola era rispettata alla lettera e tradita nella sostanza**:
l'identificativo me l'ero segnato, in un posto che poi ho sovrascritto. *Una
variabile riusata non è un promemoria: è l'ultimo valore che ci è passato
dentro.*

⚠️ **E IL GUARDIANO C'ERA, MA GUARDAVA ALTROVE.** Il controllo finale conta
le **lapidi**, e `dettature` non è una tabella tracciata: zero lapidi prima,
zero dopo, e una riga di prova in mezzo ai dati veri.

**Chiuso dalla `20260826000006`**, con un perimetro che è una **proprietà** e
non una fotografia — il testo fra quelli scritti nelle verifiche, provenienza
`app`, nata prima dell'istante in cui la migrazione è stata scritta — e
**provata sul progetto di prova costruendo il residuo apposta**, con accanto
una dettatura vera: toglie il primo, lascia la seconda. In produzione:
*«Dettature prima: 1, tolte: 1, rimaste: 0»*.

**Verificato dopo, dal connettore in sola lettura: dettature 0, azioni 0,
scarichi 0, rettifiche 0, partite 0, lapidi 0.**

## Le due lezioni scritte in CLAUDE.md §8

1. **Una variabile riusata non è un promemoria.** La forma giusta è un
   **array** — `v_miei := v_miei || v_dett;` — che è quello che `righeMie()`
   fa già per le prove dal client: la stessa regola mancava alle verifiche
   delle migrazioni. E: *dopo ogni applicazione in produzione si contano le
   righe delle tabelle toccate, non si legge il messaggio della migrazione*
   — è la terza volta (14/08 i due tavoli rimasti spostati, 16/08 la giacenza
   corta di due, oggi questa).
2. **Un misuratore nuovo si prova prima su un caso di cui si conosce già la
   risposta**, altrimenti misura e non si sa cosa. Regola di Alessio, nata
   dalla terza volta in due giorni che uno strumento di misura ha mentito qui
   dentro.

## Il «598» era preso col metro sbagliato

🔴 **Rilievo di Alessio, e ha ragione.** Il censimento dei bersagli è partito
a densità **stimata** (37,8) ed è finito a densità **vera** del tablet, dove
sono comparsi bersagli che a 37,8 risultavano sopra soglia. Quindi il 598
iniziale e lo zero finale **non stanno sulla stessa scala**: il primo è un
pavimento misurato male e non è mai stato rifatto col metro giusto, il
secondo è una proprietà verificata a tre densità.

Corretto ovunque fosse scritto come un fatto — nel commento della classe in
`index.css` e in quattro punti di questo riepilogo. Il numero resta, con
«almeno» e con la scala accanto.

## Cosa resta aperto, aggiornato

1. 🔴 **Nessuno ha ancora parlato al microfono**, e la Scorciatoia
   dell'orologio non esiste. Le istruzioni sono dentro la schermata.
2. **L'indice di `decisioni_rovesciate.md`**: 30 righe da ricostruire
   rileggendo, più il numero 18 usato due volte.
3. **Le schermate di dettaglio** (`/…/:id`) non sono entrate nel censimento
   dei bersagli.
