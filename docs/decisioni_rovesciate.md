# Decisioni rovesciate

L'elenco di ogni decisione **motivata** che è stata poi cambiata, in un posto
solo e in una forma sola.

⚠️ **Perché esiste.** Un rovesciamento non dichiarato è la forma di deriva che
**nessun controllo automatico può prendere**: il codice nuovo è coerente con
sé stesso, e l'unica traccia è che qualcuno aveva deciso diversamente e aveva
una ragione. Se i rovesciamenti restano dentro il testo dei riepiloghi, la
domanda che conta fra sei mesi — *«questa decisione l'abbiamo già rovesciata
prima?»* — richiede di aprirli tutti.

**Due posti, due domande diverse.** Il **racconto** sta nel riepilogo del giro,
in una sezione fissa; il **conteggio** sta qui, una riga per rovesciamento.

## La forma, sempre la stessa — quattro righe

1. **cosa era stato deciso, e quando**
2. **la ragione di allora**
3. **cosa si decide adesso**
4. **perché la ragione di allora non vale più** — *oppure*: **vale ancora, e
   questo è il prezzo che accettiamo**

⚠️ **La quarta riga è quella che serve davvero**: distingue «la ragione era
sbagliata» da «la ragione era giusta e abbiamo scelto lo stesso», che sono due
cose diverse quando qualcuno rilegge.

⚠️ **E la sezione nel riepilogo c'è anche quando è vuota** — «nessun
rovesciamento in questo giro». È il precedente del riepilogo del Magazzino: un
riquadro che compare solo nei guai fa dubitare, quando manca, di non averlo
visto. *L'assenza non è un'informazione; «niente da segnalare» sì.*

---

## L'elenco

| # | data | decisione rovesciata | dove è raccontato |
|---|---|---|---|
| 1 | 14/08/2026 | *Una richiesta in attesa occupa il posto* (10/08) | [la pianta viva](consegne/20260814_la_pianta_viva.md) |
| 2 | 18/08/2026 | *Nel sistema non esiste una capacità per tavolo* (14/08) | [giro B, i coperti dentro il tavolo](consegne/20260818_giro_b_i_coperti_dentro_il_tavolo.md) |
| 3 | 18/08/2026 | *Dentro la sagoma ci sta il suo nome e basta* (14/08) | [giro B, i coperti dentro il tavolo](consegne/20260818_giro_b_i_coperti_dentro_il_tavolo.md) |
| 4 | 18/08/2026 | *Il tavolo più piccolo non scende mai sotto 1,05 cm reali* (14/08) | [giro E, la sala entra nel telefono](consegne/20260818_giro_e_la_sala_entra_nel_telefono.md) |
| 5 | 18/08/2026 | *Il ritardo prende tutto il tavolo al posto del colore della fascia* (18/08) | [giro D2, il ritardo e le prenotazioni in Comande](consegne/20260818_giro_d2_il_ritardo_e_le_prenotazioni.md) |
| 6 | 18/08/2026 | *In Comande il tavolo con un conto aperto è dorato* (08/08) | [giro D2, il ritardo e le prenotazioni in Comande](consegne/20260818_giro_d2_il_ritardo_e_le_prenotazioni.md) |
| 7 | 18/08/2026 | *Le due legende dichiarano la precedenza dei colori* (18/08) | [giro D2, il ritardo e le prenotazioni in Comande](consegne/20260818_giro_d2_il_ritardo_e_le_prenotazioni.md) |
| 8 | 18/08/2026 | *Chi ha corretto i coperti, e quando, si vede a schermo* (18/08) | [giro D3, la sala si tocca in un gesto](consegne/20260818_giro_d3_la_sala_si_tocca_in_un_gesto.md) |
| 9 | 18/08/2026 | *Un tocco sulla sagoma vuol dire tre cose diverse* (14/08) | [giro D3, la sala si tocca in un gesto](consegne/20260818_giro_d3_la_sala_si_tocca_in_un_gesto.md) |
| 10 | 18/08/2026 | *Un tocco fa sempre la stessa cosa: apre il riquadro* (18/08, rovescia il n. 9) | [giro D3, la sala si tocca in un gesto](consegne/20260818_giro_d3_la_sala_si_tocca_in_un_gesto.md) |
| 11 | 18/08/2026 | *La riga «è lo stesso locale girato» sta su entrambe le schermate* (17/08) | [giro D3, la sala si tocca in un gesto](consegne/20260818_giro_d3_la_sala_si_tocca_in_un_gesto.md) |
| 12 | 18/08/2026 | *Il riquadro del sold out, la scomposizione dei posti, un comando per ogni tavolo spostato* | [giro D3, la sala si tocca in un gesto](consegne/20260818_giro_d3_la_sala_si_tocca_in_un_gesto.md) |

---

## 1 · 14/08/2026 — «una richiesta in attesa occupa il posto»

**Cosa era stato deciso, e quando.** Il 10/08: una richiesta di prenotazione
ancora da confermare **tiene occupati i posti**, così due clienti non possono
prenotare lo stesso tavolo mentre Alessio decide.

**La ragione di allora.** Esisteva un calcolo dei posti liberi, e senza quella
regola il conteggio avrebbe mostrato come disponibili dei posti che qualcuno
stava già chiedendo.

**Cosa si decide adesso.** Una richiesta in attesa **non tiene niente**. Il
tavolo lo dà Alessio dalla pianta.

**Perché la ragione di allora non vale più.** Perché **il calcolo dei posti
non esiste più**: il 14/08 è stato rimosso — non spento — insieme a
`dining_tables.seats`, `posti_liberi()`, la durata del tavolo e il tetto dei
coperti. La regola aveva senso *solo* finché esisteva il conteggio che la
rendeva necessaria; tolto quello, difendeva un numero che nessuno calcolava
più.

*Dichiarato a suo tempo nel briefing del mandato Sala: non è un arretrato
nascosto, è riportato qui nella forma nuova.*

---

## 2 · 18/08/2026 — «nel sistema non esiste una capacità per tavolo»

**Cosa era stato deciso, e quando.** Il 14/08: nessun numero di coperti su un
tavolo. `dining_tables_sagoma_check` **rifiuta** un `tavolo` con
`posti_fissi`; i posti li hanno solo divani e Chef Table, che sono arredi
fissi e non entrano in nessun calcolo.

**La ragione di allora.** *«La capienza varia con la disposizione»*: con i
tavoli veri, contare un secchio di posti e sottrarre le persone prenotate è
sbagliato **per costruzione** — due persone a un tavolo da sei lasciano quattro
posti che non esistono.

**Cosa si decide adesso.** Sul tavolo si legge quanti ne tiene: 90×90 = 4,
180×90 = 6. Accostandone due o più, il numero si aggiorna con la regola *somma
meno due per ogni giunzione*.

⚠️ **Come è stato fatto, perché cambia cosa si è tolto** *(precisato il 18/08,
costruendo)*. Il numero **non** sta su `dining_tables`: sta su una tabella dei
**formati** (`formati_tavolo`), a cui ogni tavolo punta. Quindi
`dining_tables_sagoma_check` **non è stato toccato** — un `tavolo` con
`posti_fissi` viene rifiutato oggi come il 14/08.
**Questo non annulla il rovesciamento**, ed è il punto: l'invariante di allora
diceva *«nessun numero di coperti è associato a un tavolo»*, e metterlo sul
formato a cui il tavolo punta è associarcelo a **un passo di distanza**. Il
vincolo sopravvive alla lettera e non alla sostanza, e dirlo così è l'unico
modo perché fra sei mesi la riga si legga per quello che è.
*La ragione per cui la capacità sta sul formato non è però l'aggiramento: è
che Alessio non ha detto «i 180 non si accostano perché sono larghi», ha detto
«perché sono di uno stile diverso» — e lo stile è una proprietà del formato.*

**Perché la ragione di allora non vale più — anzi: vale ancora, ed è per
questo che la forma nuova è diversa.** La ragione del 14/08 **non era che i
posti non esistono**: era che *un totale di sala fisso non descrive la sala*.
E infatti il giro B **non ripristina il secchio unico**: i posti tornano a
esistere **dentro il tavolo**, il totale della serata si ricalcola **sulla
disposizione di quel giorno**, e un accostamento **abbassa** il totale invece
di lasciarlo fermo.

> **La decisione del 14/08 non viene smentita: viene resa più precisa.**
> Quello che cade è «non esiste capacità per tavolo»; quello che resta — e
> diventa più forte — è «non esiste una capienza della sala indipendente da
> come è messa».

⚠️ **E resta un prezzo, accettato**: il vincolo che vietava i coperti sui
tavoli era anche una difesa contro il ritorno del secchio unico. Anche se la
lettera del vincolo resta, quella difesa **non copre più il caso**: da oggi la
fa il **disegno** e non più il database. La prova che deve tenerla ferma è
dichiarata nel mandato ed è stata scritta: *stessa sera, stesse prenotazioni,
due disposizioni diverse, due totali diversi* — e verificata **al contrario**,
rompendo apposta la regola delle giunzioni sul progetto di prova per vedere le
prove diventare rosse.

---

## 3 · 18/08/2026 — «dentro la sagoma ci sta il suo nome e basta»

**Cosa era stato deciso, e quando.** Il 14/08, e non a tavolino: Alessio l'ha
deciso **dopo averlo visto**. Sulla sagoma resta il solo nome; chi c'è e a che
ora si legge nell'elenco sotto la pianta.

**La ragione di allora.** In un quadrato di 90 cm non entrano due righe a una
dimensione leggibile: sul telefono le righe di un divano si accavallavano, sul
computer l'ora usciva tagliata («0:00 · 2»).

**Cosa si decide adesso.** Nella sagoma torna una seconda riga: **il numero
dei coperti**, col punto che segna «corretto a mano». Lo chiede il mandato del
18/08 — *«sul tavolo si legge quanti ne tiene»* — ed è su quella cifra che si
decide se accettare una prenotazione.

**Perché la ragione di allora non vale più — anzi: vale ancora, ed è per
questo che quello che entra è una cifra.** Il problema del 14/08 non era «una
seconda riga», era **una seconda riga lunga**: `20:00 · 2` sono sei caratteri
che in 90 cm non stanno. Un numero di una o due cifre sì.
⚠️ **Il prezzo accettato è che nella sagoma non entra nient'altro**: non «4
posti», non l'ora, non la ragione della correzione. Le parole stanno
nell'elenco sotto, dove lo spazio c'è — sulla sagoma il segno, sotto la
spiegazione. Se durante il collaudo dovesse risultare illeggibile anche così,
cade il numero e non l'elenco.

---

## 5 · 18/08/2026 — «il ritardo prende tutto il tavolo al posto del colore della fascia»

**Cosa era stato deciso, e quando.** Il **18/08/2026**, aprendo il giro D:
*«il rosso prende tutto il tavolo al posto del colore della fascia, non si
aggiunge come bordo»*. Decisione di Alessio, con la sua ragione accanto.

**La ragione di allora.** *Il ritardo è l'unica delle due informazioni su cui
deve agire subito*: se fosse un segno più debole della fascia — un bordo, un
pallino — chi guarda la sala leggerebbe prima l'ora di arrivo e poi, forse, il
ritardo. Il rosso doveva **vincere**.

**Cosa si decide adesso.** Il tavolo in ritardo si **sbarra**: un tratteggio
scuro che passa **sopra** il riempimento, invece di sostituirlo. Il colore
sotto resta quello che dice la precedenza — la fascia, il conto aperto, o il
tavolo che si sta toccando.

**Perché la ragione di allora non vale più — anzi: vale ancora, ed è proprio
lei a chiedere il cambio di segno.** Quello che è caduto non è il principio ma
**il colore disponibile**: il rosso era già preso due volte. Il terracotta è
la fascia «ultimo giro» **ed è anche il tavolo selezionato**, e un terzo rosso
avrebbe fatto dire tre cose diverse allo stesso segno — cioè avrebbe reso il
ritardo *meno* visibile, non di più.
⚠️ E la sbarratura soddisfa la ragione **meglio** del rosso pieno: non è
subordinata a niente (passa sopra qualunque colore, compreso il selezionato) e
**non toglie l'informazione che copriva**. Un tavolo in ritardo continua a
dire a che ora doveva arrivare quella gente, che è il dato con cui si decide
se telefonare o se ridarlo via.
⚠️ **Il prezzo accettato**: un tratteggio è un segno di *texture*, e su uno
schermo piccolo si riconosce peggio di un colore pieno. Se al collaudo non si
distinguerà a colpo d'occhio, si ispessisce il tratteggio — non si torna al
terzo rosso, che il problema ce l'ha per costruzione.

---

## 6 · 18/08/2026 — «in Comande il tavolo con un conto aperto è dorato»

**Cosa era stato deciso, e quando.** Dall'**08/08/2026**, da quando la
schermata Sala esiste: nella pianta delle Comande il dorato vuol dire «questo
tavolo ha già un conto aperto», e la legenda lo dichiarava.

**La ragione di allora.** ⚠️ **Non ce n'è una scritta**, ed è un fatto che
vale la pena registrare invece di inventarne una a posteriori: quella
schermata mostrava **due soli** stati — occupato e «lo sto servendo» — e due
colori qualsiasi bastavano. Il dorato non fu scelto contro qualcosa.

**Cosa si decide adesso.** Il tavolo con un conto aperto diventa **scuro**
(`charcoal-soft`). Il dorato resta al «primo giro», che è il significato che
ha nel Calendario dal 14/08.

**Perché la ragione di allora non vale più.** Perché la premessa è cambiata:
da questo giro le **fasce orarie arrivano anche in Comande**, e lì il dorato
vuol già dire «arriva presto». Sulla stessa schermata lo stesso quadratino
avrebbe detto «sono seduti» su un tavolo e «arriveranno fra poco» su quello
accanto — e **nessuna legenda può sciogliere un'ambiguità così**: chi guarda
non ha modo di sapere quale dei due sta guardando.
⚠️ **Il terracotta resta doppio** (fascia «ultimo giro» e tavolo selezionato)
ed è una scelta, non una dimenticanza: lì l'ambiguità si scioglie da sé,
perché il tavolo selezionato è al massimo uno ed è quello che si è appena
toccato. La legenda lo dichiara nell'ordine di precedenza.

---

## 7 · 18/08/2026 — «le due legende dichiarano la precedenza dei colori»

**Cosa era stato deciso, e quando.** Il **18/08**, poche ore prima, dentro il
perimetro stesso del giro D2: *«le due legende che DICHIARANO la precedenza,
non che aggiungono una riga»*. Erano state costruite, e generate dallo stesso
dato con cui il colore veniva deciso — così la spiegazione non poteva
raccontare un ordine diverso da quello applicato.

**La ragione di allora.** Il rilievo del mandato: *un colore che ne sovrascrive
altri, senza che la legenda lo dica, si legge come un colore che non esiste da
nessuna parte*. Chi cerca il verde su un tavolo diventato scuro conclude che il
gestionale ha sbagliato.

**Cosa si decide adesso.** **Le legende si tolgono del tutto.** Deciso da
Alessio guardando la schermata: le considera superflue. Gli era stata proposta
anche la via di mezzo — nasconderle dietro un tocco, per chi lavorerà in sala e
non conosce i colori a memoria — e ha scelto di toglierle.

**Perché la ragione di allora non vale più — anzi: vale ancora, e questo è il
prezzo che accettiamo.** La ragione non è caduta: è **cambiato il lettore**.
Oggi in sala c'è Alessio, che quei colori li ha scelti lui, e per lui la
legenda è ingombro. Il prezzo è preciso e va scritto perché fra sei mesi si
sappia dove ripescare la cosa: **da oggi la precedenza dei segni è dichiarata
solo in due posti — il codice (`segnoDelTavolo` in `lib/calcoli/ritardo.js`) e
il riepilogo del giro D2 — e in nessun punto della schermata.** ⚠️ Il giorno
che entrerà personale nuovo, che è anche il giorno in cui l'accesso condiviso
dello staff diventerà un problema (§10), la legenda va rimessa: non è codice
perso, è codice tolto con la sua ragione accanto.
⚠️ **E quello che resta è la regola, non la spiegazione**: togliere la legenda
non tocca la precedenza, che continua a decidere i colori esattamente come
prima.

---

## 8 · 18/08/2026 — «chi ha corretto i coperti, e quando, si vede a schermo»

**Cosa era stato deciso, e quando.** Il **18/08**, nel giro B, e non da noi: è
la **condizione posta dal validatore** per lasciare la correzione dei coperti a
tutto lo staff invece che al solo titolare. Testuale: *«Con una condizione:
registra chi e quando, e si vede»*.

**La ragione di allora.** *Una correzione senza autore è un numero che nessuno
può spiegare tre giorni dopo* — e quel numero decide se si accetta gente.

**Cosa si decide adesso.** «Chi ha corretto e quando» **esce dalla schermata**.
Resta la ragione scritta a mano («uno contro il muro»), resta il numero
calcolato accanto a quello corretto. Deciso da Alessio costruendo il riquadro
del tavolo: fra le cose dell'elenco vecchio, considera superflue **a schermo**
proprio quella e «quali tavoli sono accostati».

**Perché la ragione di allora non vale più — anzi: vale ancora per intero, e
questo è il prezzo che accettiamo.** ⚠️ **La condizione del validatore era
doppia** — *registrare* e *far vedere* — e **la metà che conta di più resta
intatta**: il trigger continua a scrivere chi e quando su ogni correzione, e
nessuno può toglierlo dalla schermata. Quello che cambia è **dove si legge**:
non più accanto al numero, ma nel database.
⚠️ **E il caso in cui serviva non è oggi**: si entra per **ruolo e non per
persona**, quindi a schermo quella riga poteva dire soltanto «l'hai messo tu»
oppure «da un altro accesso» — con un accesso condiviso per tutto lo staff,
la seconda frase non identifica nessuno. Il giorno che ci saranno accessi per
persona quel dato diventerà leggibile **all'indietro**, perché è stato scritto
lo stesso, e **quello è il giorno in cui la riga va rimessa a schermo**.

---

## 9 · 18/08/2026 — «un tocco sulla sagoma vuol dire tre cose diverse»

**Cosa era stato deciso, e quando.** Il **14/08**, con la pianta viva: un tocco
significa una cosa diversa a seconda di cosa c'è sotto il dito — lavoro in
corso → aggiunge o toglie il tavolo; tavolo libero → comincia una prenotazione
nuova; tavolo già promesso → apre *quella* prenotazione.

**La ragione di allora.** Le tre cose *«non possono essere ambigue»*: ogni
situazione doveva avere una risposta sola e prevedibile.

**Cosa si decide adesso.** Il tocco fa **sempre la stessa cosa**: apre il
**riquadro di quel tavolo**, che contiene i coperti con la loro casella, le
prenotazioni che ci sono sopra e il pulsante per prenderne una. Richiesta di
Alessio, che ha chiesto anche di far sparire l'elenco dei tavoli sotto la
pianta — assorbito dallo stesso riquadro.

**Perché la ragione di allora non vale più — anzi: vale ancora, e la forma
nuova la serve meglio.** Il problema del 14/08 non era «tre gesti», era
**l'ambiguità**: e tre esiti diversi per lo stesso gesto sono ambigui *per
costruzione*, perché chi tocca deve ricordarsi cosa c'era sotto. Un esito solo
la toglie alla radice.
⚠️ **Il prezzo, misurato e accettato**: su un tavolo con una prenotazione sola
ci vuole **un tocco in più** per arrivare alla sua scheda (prima si apriva
diretta). In cambio, i coperti si correggono **da dove si è toccato il
tavolo** invece che da una seconda lista in cui cercare la riga giusta — ed è
il gesto che il mandato descrive come quello che «pesava» di più.
⚠️ L'unica eccezione resta il **lavoro in corso**: mentre si sceglie dove far
sedere qualcuno il tocco aggiunge e toglie, e lì il gesto è già dichiarato da
un riquadro aperto sopra la pianta.

---

## 10 · 18/08/2026 — «un tocco fa sempre la stessa cosa: apre il riquadro»

⚠️ **Rovescia il n. 9, poche ore dopo**, e va letto insieme a quello.

**Cosa era stato deciso, e quando.** Il **18/08**, nel giro D3 di poche ore
prima: il tocco su una sagoma apre **sempre** il riquadro di quel tavolo, e le
strade stanno lì dentro.

**La ragione di allora.** Togliere l'ambiguità alla radice: *tre esiti diversi
per lo stesso gesto sono ambigui per costruzione*, perché chi tocca deve
ricordarsi cosa c'era sotto il dito.

**Cosa si decide adesso.** Su un tavolo **libero** il tocco porta **dritto ai
campi della prenotazione**, saltando il riquadro. Richiesta di Alessio dopo
averlo provato: *«l'ideale sarebbe che si arrivasse direttamente ai campi da
compilare per effettuare una prenotazione non appena si tocca un tavolo»*.
Sul tavolo **occupato** il riquadro resta. Quindi gli esiti tornano **due**.

**Perché la ragione di allora non vale più — anzi: vale ancora, e regge lo
stesso.** Su un tavolo libero il riquadro **non faceva scegliere niente**: non
c'erano prenotazioni da aprire, quindi era una tappa fra il dito e i campi. E
l'ambiguità che il n. 9 voleva togliere si regge lo stesso, per una ragione
che il 14/08 non era mai stata scritta: **la condizione si vede prima di
toccare**. Un tavolo bianco è libero, uno colorato ha qualcuno — e il colore è
il segno più leggibile di quella schermata. Il modulo lo dichiara comunque a
parole, una volta, nel posto dove la regola agisce.

⚠️ **IL PREZZO, MISURATO PRIMA DI ACCETTARLO** (rilievo del validatore: *«il
mio sospetto è che si sposti sul caso tavolo libero ma volevo solo correggere
i coperti»*). Il sospetto era **giusto**, e la cura è stata costruita insieme
alla richiesta: la casella dei coperti **è nel modulo della prenotazione**, non
solo nel riquadro. Quindi il numero di un tavolo libero si corregge ancora in
**un tocco**, e per giunta si vede proprio mentre si decide se accettare quella
prenotazione.
Quello che resta da pagare, e va detto: chi tocca un tavolo libero **solo** per
correggerne il numero si trova dentro un modulo intitolato «Prenotazione su
T3», e per uscirne deve premere «Annulla». Non perde niente e non scrive
niente, ma **il gesto si chiama diversamente da quello che voleva fare**.

---

## 11 · 18/08/2026 — «la riga che spiega perché in Comande la sala è girata sta su ENTRAMBE le schermate»

**Cosa era stato deciso, e quando.** Il **17/08**, da Alessio: la frase *«è lo
stesso locale girato — non un'altra disposizione»* va messa **sia** in Comande
**sia** nel Calendario. Anzi, soprattutto nel Calendario.

**La ragione di allora.** Chi si accorge della discrepanza parte dalla
schermata dove si sta seduti a ragionare, non da quella del servizio: *dirlo
solo di là servirebbe a chi ha già capito*. Senza la riga, chi confronta le
due sale sospetta **due disposizioni diverse** — che sarebbe un difetto grave,
perché la sala è una.

**Cosa si decide adesso.** **Si toglie da tutte e due.** Gli era stato fatto
notare che sul telefono quella riga non spiega più niente — lì la pianta del
Calendario si gira da sola, e le due schermate mostrano la stessa cosa —
mentre **sul computer resta vera**, ed era stata proposta la via di mezzo:
tenerla solo lì. Ha deciso di toglierla ovunque.

**Perché la ragione di allora non vale più — anzi: sul computer vale ancora, e
questo è il prezzo che accettiamo.** Sul telefono la ragione **è caduta da
sola**: dal giro E la pianta si gira quando lo schermo è stretto, quindi le due
schermate sono identiche e non c'è nessuna discrepanza da spiegare. Sul
computer no: lì il Calendario mostra la sala sdraiata e le Comande in piedi, e
**da oggi chi apre le due schermate su un monitor largo vede due sale girate
diversamente senza niente che glielo spieghi**. Il fatto resta vero — le due
schermate chiedono la pianta alla stessa funzione e ricevono le stesse
coordinate — sparisce la frase che lo diceva.

---

## 12 · 18/08/2026 — «il riquadro del sold out, e l'elenco dei tavoli rimessi a posto uno per uno»

⚠️ **È il quarto rovesciamento della stessa giornata sullo stesso tema**, e va
letto insieme ai nn. 7, 8 e 11: cambia il **peso** delle cose a schermo, non le
regole.

**Cosa era stato deciso, e quando.** Nei giri precedenti: «Per questa sera
siamo al completo» era un **riquadro** con la sua spiegazione sotto, i posti
liberi portavano la loro **scomposizione** («31 in questa disposizione · 6
prenotati») e i tavoli spostati avevano **un collegamento per ciascuno**
(«rimetti T5 a posto»).

**La ragione di allora.** Ogni pezzo aveva la sua: il sold out è l'unico freno
alle richieste dal sito e sembrava meritare spazio; la scomposizione spiega da
dove viene il numero; il collegamento per tavolo permette di rimetterne a posto
uno solo.

**Cosa si decide adesso.** Il sold out diventa **un interruttore piccolo sulla
riga della data**; la scomposizione **sparisce** e resta il numero grande; dei
tavoli spostati resta **un comando solo**, «rimetti tutti a posto».

**Perché le ragioni di allora non valgono più — anzi: valgono ancora, e il
prezzo è dichiarato.** ⚠️ **Nessuna delle tre regole è toccata**: il sold out
frena esattamente come prima (e il rifiuto sta dentro la funzione pubblica, non
nella casella); il numero dei posti è lo stesso; un tavolo si rimette a posto
da solo **trascinandolo**, che è come lo si è mosso. Quello che cambia è quanto
spazio si prendono.
⚠️ **E un prezzo c'è, sui posti liberi**: quel numero conta i **soli tavoli** e
lascia fuori divani e Chef Table — sono due formule diverse, chi chiama per
cenare vuole un tavolo. Finché lo legge Alessio va bene, perché la regola l'ha
decisa lui; **per chi verrà dopo è un numero che sembra dire «la sala tiene 25»
e non lo dice**, e ora non c'è più niente a schermo che lo spieghi. Sta
nell'elenco delle sette spiegazioni tolte, che è lo stesso elenco.
