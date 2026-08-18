# Giro D3 — la sala si tocca in un gesto solo, e le prenotazioni si leggono

**Consegna del 18/08/2026.** Mandato [«La sala e le prenotazioni»](../mandati/20260818_la_sala_e_le_prenotazioni.md),
**punti 5 e 6** più i punti **3 e 4** del perimetro deciso per il giro D.
È **l'ultimo giro del mandato**: A, B, C, E, D1 e D2 sono chiusi e validati.

- **HEAD dichiarato**: `af29bc7` — il giro è in **tre commit di codice** (`8222222`, `28d20dc`, `af29bc7`) perché il collaudo di Alessio è passato **due volte** in mezzo alla consegna
- **Working tree**: pulito
- **Migrazione**: **nessuna** — nessun dato nuovo, solo dati già scritti che
  arrivano dove non arrivavano
- **Prove**: **111** pure (erano 102) + **174** sul progetto di prova (erano 172)
- **Lint**: zero avvisi · **Build**: ok
- **In produzione**: **niente da applicare**
- **Contratto**: non toccato · **Corridoio**: non ridistribuito

---

## ⚠️ Cosa NON è verificato

1. 🟡 **Nessuna mano ha toccato il giro C in condizioni di servizio vero** —
   le tre fasce e «da liberare entro le…» sono state guardate ferme, mai
   durante un servizio.
2. 🟡 **La mezzanotte in servizio non è mai capitata dal vivo.**
3. 🟡 **La domenica a pranzo non ha prenotazioni vere**, quindi le fasce
   calcolate sugli orari del pranzo non sono mai state guardate su dati veri.
4. 🟡 **Una sala con più conti aperti insieme non è mai esistita**, ed è la
   condizione normale di un servizio: tutto quello che si è visto finora è
   sempre stato **un conto per volta**.
5. 🟡 **La guardia di `--azzera` non è mai scattata in una ricostruzione vera.**
6. 🟡 **I due rami di `DB_URL_PRODUZIONE` non sono mai stati esercitati** —
   con la precisazione del giro D2: il ramo di **lettura** è stato usato per
   misurare il canarino, quello della **guardia** no.
7. 🟡 **Il messaggio con le date degli scostamenti non è mai comparso a
   schermo.**

E quelle che apre questo giro:

8. 🟡 **IL RIQUADRO È STATO PROVATO A METÀ.** Alessio l'ha guardato ed è da lì
   che nascono le due richieste della seconda metà di questo giro. ⚠️ Ma
   **quello che ha guardato non c'è più nella stessa forma**: sul tavolo
   libero il riquadro adesso non compare affatto, e **quella versione lì non
   l'ha ancora vista nessuno**. Resta vero il limite generale: **nessuna prova
   automatica di questo progetto guarda una schermata**.
   ⚠️ **E il tocco in più è sparito solo su metà dei casi**: su un tavolo
   libero si va dritti ai campi, su un tavolo con **una sola** prenotazione ci
   vuole ancora un tocco in più rispetto a prima del giro D3.
8-bis. 🔴 **UN FALSO ALLARME, e vale la pena scriverlo.** Le prime fotografie
   del collaudo mostravano ancora l'elenco dei tavoli sotto la pianta: Alessio
   stava guardando la versione **prima del push**. Nessun difetto — ma è la
   seconda volta in due giorni che una **lettura** viene scambiata per una
   **misura**, e la prima l'aveva rilevata lui su sé stesso (T8 «non
   sbarrato»). *Guardare una schermata non dice quale versione si sta
   guardando.*
9. 🔴 **L'EVIDENZIAZIONE E LO SCORRIMENTO NON SONO PROVATI DA NIENTE.** Lo
   scorrimento fino alla riga esiste proprio perché sul telefono la pianta e
   l'elenco non stanno insieme — cioè **il caso in cui serve è quello che qui
   non si può riprodurre**. Va guardato da un occhio, su un telefono vero.
10. 🟡 **I blocchetti del Calendario Eventi sono stati visti solo compilando**:
    la soglia fra telefono e computer è quella che il progetto già usa per il
    menu principale, ma **nessuno ha guardato la pagina stretta**.
11. 🟡 **Il riquadro non è mai stato aperto su un tavolo con DUE turni** — il
    caso che il giro C ha reso possibile. I dati per farlo esistono (elenca
    tutte le prenotazioni di quel tavolo), ma non è mai successo.
12. 🔴 **«Chi ha corretto e quando» non si legge più da nessuna schermata**
    (rovesciamento n. 8): il dato continua a essere **scritto** dal trigger, e
    la metà che sparisce è quella visibile. ⚠️ Il giorno che ci saranno accessi
    **per persona** quella riga va rimessa a schermo — e diventerà leggibile
    all'indietro, perché nel frattempo è stata scritta lo stesso.
13. 🟡 **Restano senza risposta due domande poste ad Alessio**: se il riquadro
    sul tavolo **occupato** ci sta nello schermo senza scorrere, e se i
    blocchetti del Calendario Eventi si leggono meglio della tabella. Si è
    fermato sui difetti prima di arrivarci. ✅ **La terza ha risposta**:
    toccando un tavolo bianco **la pagina scorre da sola fino ai campi**.
13-bis. 🟡 **La cura del difetto (b) non è stata vista da nessuno.** Il tocco su
    un tavolo di un tavolone prenotato adesso apre il riquadro invece di
    andare ai campi, e l'avviso compare da qualunque tavolo del gruppo: è
    provato dalle prove pure sulla mappa dei gruppi, **mai da un dito**.
14. 🔴 **Sul computer, da oggi, il Calendario mostra la sala sdraiata e le
    Comande in piedi senza niente che lo spieghi** (rovesciamento n. 11). Il
    fatto resta vero — le due schermate chiedono la pianta alla stessa
    funzione — ma **la frase che lo diceva è stata tolta da tutte e due**. Sul
    telefono non serviva più (lì la pianta si gira da sola e le due schermate
    sono identiche); sul computer serviva, e il prezzo è dichiarato.
15. 🟡 **Il tocco su un tavolo libero non è mai stato provato su un tavolo che
    fa parte di un TAVOLONE.** Lì il modulo mostra i coperti del gruppo, e la
    frase che distingue tavolo e tavolone **non compare** (compare solo nel
    riquadro): sul modulo il numero è etichettato con le etichette del gruppo,
    che è un'altra forma di dirlo. **Non è stato guardato da nessuno.**

---

## Cosa abbiamo rovesciato

**Cinque rovesciamenti**, tutti nell'elenco
([`decisioni_rovesciate.md`](../decisioni_rovesciate.md), nn. da **8** a **12**),
dove stanno per esteso con le quattro righe.

⚠️ **Sono tanti, e la ragione è una sola**: il collaudo di Alessio è passato
**in mezzo** a questo giro. Il n. 10 rovescia il n. 9 di poche ore prima — non
è confusione, è che il n. 9 è stato messo nelle sue mani e ha risposto. *Un
rovesciamento a poche ore di distanza è il segno che la cosa è stata provata
davvero, non che era stata decisa male* — a patto che sia scritto, che è
esattamente perché questo elenco esiste.

### 8 · «chi ha corretto i coperti, e quando, si vede a schermo»

⚠️ **Va guardato con attenzione perché non l'avevamo deciso noi**: è la
**condizione posta dal validatore** nel giro B per lasciare la correzione dei
coperti a tutto lo staff invece che al solo titolare — *«Con una condizione:
registra chi e quando, e si vede»*.

- **La ragione di allora.** *Una correzione senza autore è un numero che
  nessuno può spiegare tre giorni dopo* — e quel numero decide se si accetta
  gente.
- **Cosa si decide adesso.** Quella riga **esce dalla schermata**. Restano la
  ragione scritta a mano e il numero calcolato accanto a quello corretto.
- **Perché — anzi: la ragione vale ancora per intero, e questo è il prezzo.**
  ⚠️ **La condizione era doppia** (*registrare* e *far vedere*) e **la metà
  che pesa di più resta intatta**: il trigger continua a scrivere chi e
  quando, e nessuna schermata può impedirglielo. Cambia **dove si legge**.
  ⚠️ E il caso in cui quella riga serviva **non è oggi**: si entra per
  **ruolo** e non per persona, quindi a schermo poteva dire soltanto «l'hai
  messo tu» oppure «da un altro accesso» — che con un accesso condiviso per
  tutto lo staff non identifica nessuno.

### 9 · «un tocco sulla sagoma vuol dire tre cose diverse»

- **Cosa era stato deciso.** Il 14/08, con la pianta viva: il tocco significa
  una cosa diversa a seconda di cosa c'è sotto il dito.
- **La ragione di allora.** Le tre cose *«non possono essere ambigue»*.
- **Cosa si decide adesso.** Il tocco fa sempre la stessa cosa: apre il
  **riquadro di quel tavolo**.
- **Perché — anzi: la ragione vale ancora, e la forma nuova la serve meglio.**
  Il problema del 14/08 non era «tre gesti», era **l'ambiguità** — e tre esiti
  diversi per lo stesso gesto sono ambigui *per costruzione*, perché chi tocca
  deve ricordarsi cosa c'era sotto. Un esito solo la toglie alla radice.

### 10 · «un tocco fa sempre la stessa cosa: apre il riquadro»

⚠️ **Rovescia il n. 9, poche ore dopo, e va letto insieme a quello.**

- **Cosa si decide adesso.** Su un tavolo **libero** il tocco porta **dritto ai
  campi della prenotazione**, saltando il riquadro. Richiesta di Alessio dopo
  averlo provato: *«l'ideale sarebbe che si arrivasse direttamente ai campi da
  compilare per effettuare una prenotazione non appena si tocca un tavolo»*.
  Sul tavolo occupato il riquadro resta. Gli esiti tornano **due**.
- **Perché — anzi: la ragione del n. 9 regge lo stesso.** Su un tavolo libero
  il riquadro **non faceva scegliere niente**: era una tappa fra il dito e i
  campi. E l'ambiguità che il n. 9 voleva togliere non torna, per una ragione
  che il 14/08 non era mai stata scritta: **la condizione si vede prima di
  toccare** — un tavolo bianco è libero, uno colorato ha qualcuno, e il colore
  è il segno più leggibile di quella schermata.
- ⚠️ **IL PREZZO, MISURATO PRIMA DI ACCETTARLO.** Il validatore ha sospettato
  che si spostasse sul caso *«tavolo libero ma volevo solo correggere i
  coperti»*, ed era **giusto**: senza cura, il numero di un tavolo libero non
  si sarebbe più potuto correggere da nessuna parte, perché il gesto che lo
  faceva — l'elenco sotto la pianta — questo giro l'ha tolto.
  **Curato insieme alla richiesta**: la casella dei coperti sta **anche nel
  modulo della prenotazione**, quindi il numero si corregge ancora in **un
  tocco** e si vede proprio mentre si decide se accettare. ⚠️ **La casella è
  una sola componente usata dai due posti**: due copie della stessa casella
  sono due posti che divergono.
  **Quello che resta da pagare, detto**: chi tocca un tavolo libero *solo* per
  correggerne il numero si trova dentro un modulo intitolato «Prenotazione su
  T3» e deve premere «Annulla» per uscirne. Non perde niente e non scrive
  niente, ma **il gesto si chiama diversamente da quello che voleva fare**.

### 11 · «la riga "è lo stesso locale girato" sta su entrambe le schermate»

- **Cosa era stato deciso.** Il **17/08**, da Alessio: quella frase va messa
  sia in Comande sia nel Calendario, e anzi soprattutto nel Calendario.
- **La ragione di allora.** Chi si accorge della discrepanza parte dalla
  schermata dove si sta seduti a ragionare: *dirlo solo di là servirebbe a chi
  ha già capito*. Senza la riga, chi confronta le due sale sospetta **due
  disposizioni diverse**.
- **Cosa si decide adesso.** **Si toglie da tutte e due.** Gli era stato fatto
  notare che sul telefono non spiega più niente — dal giro E la pianta del
  Calendario si gira da sola, quindi le due schermate mostrano la stessa cosa
  — mentre **sul computer resta vera**, ed era stata proposta la via di mezzo
  di tenerla solo lì. Ha deciso di toglierla ovunque.
- **Perché — sul telefono la ragione è caduta da sola; sul computer vale
  ancora, e questo è il prezzo.** Da oggi chi apre le due schermate su un
  monitor largo vede due sale girate diversamente **senza niente che glielo
  spieghi**. Il fatto resta vero — le due schermate chiedono la pianta alla
  stessa funzione e ricevono le stesse coordinate — sparisce la frase.

---

### 12 · il riquadro del sold out, la scomposizione dei posti, un comando per tavolo

⚠️ **Quarto rovesciamento della giornata sullo stesso tema** (coi nn. 7, 8 e
11): cambia il **peso** delle cose a schermo, non le regole.

- **Cosa si decide adesso.** «Siamo al completo» diventa un **interruttore
  piccolo sulla riga della data**; la scomposizione dei posti («31 in questa
  disposizione · 6 prenotati») **sparisce** e resta il numero grande; dei
  tavoli spostati resta **un comando solo**, «rimetti tutti a posto».
- **Perché — le ragioni di allora valgono ancora, e il prezzo è dichiarato.**
  ⚠️ **Nessuna delle tre regole è toccata**: il sold out frena come prima (e il
  rifiuto sta dentro la funzione pubblica, non nella casella); il numero dei
  posti è lo stesso; un tavolo si rimette a posto da solo **trascinandolo**,
  che è come lo si è mosso.
  ⚠️ **Il prezzo sta sui posti liberi**: quel numero conta i **soli tavoli** e
  lascia fuori divani e Chef Table — sono due formule diverse, chi chiama per
  cenare vuole un tavolo. Finché lo legge Alessio va bene, perché la regola
  l'ha decisa lui; **per chi verrà dopo è un numero che sembra dire «la sala
  tiene 25» e non lo dice**, e ora non c'è più niente a schermo che lo spieghi.

---

## 🔴 I due difetti trovati provando, e cosa hanno mostrato

### (a) Il modulo che non se ne andava

Togliendo l'ultimo tavolo, il modulo restava a schermo intitolato
**«Prenotazione su nessun tavolo»**. *«Mi sembra poco sensato»* — ed è giusto:
quel modulo esiste **perché** si è toccato un tavolo, e senza tavolo non ha più
oggetto. È la famiglia della schermata che continua a proporre un gesto che non
ha più senso.

⚠️ **Ma la cura ovvia sarebbe stata peggiore del difetto**, e la misura è stata
fatta prima di scrivere: far sparire un modulo con dentro **un nome e un
telefono già digitati** è la perdita silenziosa del 12/08. Quindi il modulo se
ne va **solo se non ci si è ancora scritto niente**; se c'è del lavoro dentro
resta, e dice che manca il tavolo (il pulsante di conferma era già spento da
sé).
⚠️ **E «scritto» si misura sullo stato di partenza per intero**, non sul solo
nome: chi ha già messo «6 persone alle 21» ha scritto qualcosa, anche senza
aver digitato una lettera.

### (b) L'avviso che compariva su un tavolo solo del tavolone

Toccando T8 (prenotato) compariva *«su questi tavoli c'è già…»*; toccando T7 —
**lo stesso tavolone** — non compariva.

🔴 **Misurando, il difetto era più largo del messaggio: erano TRE i posti** che
chiedevano «chi c'è su questo **tavolo**» invece che «su questo **tavolone**» —
l'avviso, il riquadro, e **il tocco**.

⚠️ **E il terzo era il peggiore**, perché non sbagliava un messaggio: **faceva
contraddire il tocco col colore**. T7 si vede colorato — dal giro D2 il
tavolone si colora intero — e si comportava da libero, andando dritto ai campi
di una prenotazione nuova. Tutto il disegno del giro D3 poggia su *«bianco è
libero, colorato ha qualcuno»* (è la ragione per cui il n. 10 può reggere due
esiti), e lì quella regola **era falsa**.

**La cura è una strada sola**, come chiesto: gli insiemi li conta già
`insiemiDiTavoli`, che è quello che colora la sala. `insiemiPerTavolo` è **la
stessa mappa girata** — da un tavolo al suo insieme — e una prova pura tiene
ferma proprio quella proprietà: *il colore e il tocco devono raggruppare allo
stesso modo*.

---

## ⚠️ La documentazione a schermo ha un destinatario, e il destinatario cambia

Rilievo del validatore, e vale più delle cinque righe che l'hanno prodotto.
In tre giorni erano state aggiunte molte spiegazioni; **oggi Alessio ne ha
tolte SETTE in tre passaggi** — le due legende dei colori, il paragrafo che
spiegava il tocco, quello del «siamo al completo» e la riga sulla sala girata.

⚠️ **Non erano sbagliate**: erano rivolte a chi non sa, e lui ormai sa — quelle
regole le ha decise lui. Quindi il criterio non è «una spiegazione in più non
fa male»: una spiegazione che il lettore ha già in testa **è ingombro**, e
l'ingombro su una schermata che si usa in servizio si paga in secondi.

⚠️ **E il criterio più preciso, che vale oltre questo giro** (rilievo del
validatore): *una spiegazione a schermo la si legge una volta e poi diventa
arredamento*. Quindi va **dove sta il dubbio** — dentro il gesto, come
l'avvertenza del righello che compare mentre si sposta il cursore — e **non
sopra la schermata**, dove la si legge il primo giorno e mai più.
⚠️ Alessio l'ha detto anche in forma generale, e sta in  §6 perché
si legga **prima** di costruire: *«in generale preferisco una linea essenziale
e minimal»*. Non è un commento su questa schermata: è il criterio con cui
giudicherà tutte le altre.

⚠️ **E il problema tornerà, non nella stessa forma.** Il giorno che entrerà
personale nuovo servirà di nuovo dire cosa fa un tocco e cosa vuol dire un
colore — ma a gente che non ha mai visto quella sala, quindi **con parole
diverse da quelle tolte oggi**. Per questo ogni riga è stata tolta
**dichiarando dove quella regola resta scritta** (il codice, questo riepilogo)
invece di essere cancellata e basta. La regola generale è finita in
`CLAUDE.md` §6.

---

## ⚠️ Le due cose di natura diversa dentro lo stesso riquadro

È il rilievo posto dal validatore **prima** che il riquadro esistesse, ed è la
cosa più delicata di questa consegna:

- **il TOCCO è del tavolo** — hai toccato T8;
- **il NUMERO DEI COPERTI è del TAVOLONE** — la correzione ha per chiave
  l'**insieme** di tavoli, dal giro B.

Sono due cose che stanno nello stesso riquadro e si somigliano abbastanza da
confondersi. **Correggere il numero di un tavolone credendo di correggere un
tavolo** è un errore che poi decide se si accetta gente — e non darebbe nessun
segnale, perché il numero cambierebbe come atteso.

**Come è chiusa**: quando il gruppo è di più di un tavolo il riquadro lo dice
in chiaro, due volte e con parole diverse — nell'intestazione (*«T8 — accostato
a T7 · T9»*) e accanto alla casella (*«È il numero di T7 · T8 · T9 insieme, non
del solo T8: correggendolo cambi il tavolone»*). ⚠️ Su un tavolo singolo quelle
frasi **non compaiono**: una spiegazione che c'è sempre si smette di leggere, e
questa deve farsi notare proprio nel caso in cui serve.

---

## Cosa è stato costruito

### 1. Il riquadro del tavolo — sui tavoli che hanno qualcuno

Dentro c'è tutto quello che riguarda quel tavolo: **i coperti** con la casella
per correggerli e la ragione, **le prenotazioni** che ci stanno sopra (con
l'ora, il nome, quanti sono e se sono arrivati) da aprire con un tocco, e
**«Prendi una prenotazione qui»**.

⚠️ **Assorbe, non si affianca**: l'elenco dei tavoli sotto la pianta è
**sparito**, e con lui la seconda strada per correggere i coperti. Era già la
regola del progetto — due strade per lo stesso numero vogliono una precedenza
inventata da chi scrive il codice.

⚠️ **Sul tavolo LIBERO il riquadro non compare** (rovesciamento n. 10,
richiesta di Alessio dopo averlo provato): lì non c'era niente da scegliere, e
il tocco porta dritto ai campi della prenotazione. **La casella dei coperti lo
segue nel modulo**, ed è la stessa componente — non una seconda copia.

### 2. L'evidenziazione incrociata, nei due versi

Tocchi un tavolo → la sua prenotazione si accende nell'elenco **e la pagina ci
scorre**. Tocchi una prenotazione → si accende il suo tavolo **e la pagina
torna alla pianta**.

⚠️ **Lo scorrimento non è un di più**: sul telefono la pianta e l'elenco non
stanno sullo stesso schermo, e *accendere una riga che sta fuori schermo non è
evidenziare — è nascondere meglio*.
⚠️ **E sul computer non si muove niente**: lo scorrimento chiede la distanza
*minima*, quindi se la riga è già visibile la pagina resta ferma. Una pagina
che salta a ogni tocco sarebbe un difetto introdotto per curare un problema
che lì non esiste.

⚠️ **Si riusa il segno che c'è già** invece di inventarne uno: «selezionato»
significa, nella precedenza dei colori del giro D2, *la risposta al tuo tocco*
— che è esattamente cosa fa l'evidenziazione. Un colore nuovo apposta avrebbe
detto una quarta cosa con un quarto segno, su una schermata che ne ha già
cinque.

### 3. La lista prenotazioni, riordinata

L'informazione in prima riga — **ora, nome, quanti, dove** — e i comandi
(«Cambia tavolo», «togli il tavolo») **solo sulla riga accesa**, cioè dopo un
tocco. Prima «Cambia tavolo» era un riquadro grande ripetuto su ogni riga: *i
comandi pesavano quanto le informazioni*.

⚠️ **E c'è lo stato che mancava**: *arrivati · attesi · in ritardo di N
minuti*. È il dato del giro D2 — calcolato, mai scritto da nessuno — e
nell'elenco non compariva. Il mandato lo diceva: *«alle 21:15, con due tavoli
liberi e uno che tarda, è la prima domanda che ci si fa»*.

### 4. Calendario Eventi: il telefono legge, il computer tabella

Sul telefono ogni prenotazione è un **blocchetto coi dati a capo**; sul
computer la **tabella resta** — lì funziona, e *si cura dove fa male*, che è la
stessa distinzione con cui le due colonne sono state rimandate.

🔴 **E il tavolo entra fra le informazioni. Prima non c'era affatto, e non per
una dimenticanza della schermata: il dato non veniva chiesto al database.**
Adesso arriva **insieme** alle prenotazioni, senza una seconda interrogazione,
perché il legame è una vera chiave esterna.

⚠️ **I campi vivono in un posto solo** (`src/lib/calcoli/prenotazioni.js`), e
non è pignoleria: due elenchi di colonne — uno per la tabella, uno per i
blocchetti — sono due posti che divergono in silenzio. Si aggiunge un dato alla
tabella, ci si dimentica dei blocchetti, e **il telefono resta indietro senza
che niente lo dica** — proprio il telefono, che per le prenotazioni è la strada
maestra.

⚠️ **Il campo vuoto ha una parola sua**: «da assegnare», non un trattino.
Nessuno gliel'ha ancora dato, ed è un fatto — non un dato che non esiste.

---

## Le prove, e la controprova

**107 pure** (+5) e **174 sul progetto di prova** (+2).

La prova sui dati veri esiste per **un modo preciso di fallire**: i tavoli
arrivano alle prenotazioni con un *incorporamento*, e il database può smettere
di concederlo senza che nessuno se ne accorga (una regola di permessi diversa,
una chiave esterna rinominata). ⚠️ **E il modo in cui fallirebbe non è un
errore rosso: è «da assegnare» su ogni riga**, cioè una schermata che dice con
calma che nessuna prenotazione ha un tavolo. È la forma del difetto del 16/08
letta al contrario — lì un campo non arrivava al database, qui non arriva alla
schermata.

### La controprova, fatta e non promessa

| rottura | prove rosse |
|---|---|
| i tavoli non si chiedono più al database (com'era stamattina) | 1 — *«una prenotazione su DUE tavoli li porta tutti e due fino alla schermata»* |
| il campo vuoto perde la sua parola | 1 — *«senza tavolo il campo resta VUOTO, e ha una parola sua»* |

⚠️ **E nella prima rottura la gemella al contrario è rimasta verde**, che è la
metà che conta: dimostra che *«senza tavolo dice da assegnare»* non dipende
dall'incorporamento, quindi le due prove misurano cose diverse. Se fossero
diventate rosse tutte e due, una delle due non starebbe provando niente.

Poi tutto rimesso a posto: **107 verdi**.

---

## Il canarino, e una cosa che ha detto da sé

Misurato in **produzione** con `psql` in sola lettura, a giro finito:

| gruppo | calcolati | veri |
|---|---|---|
| T1 | 6 | **5** (corretto a mano, «Contro il muro») |
| T2 | 6 | 6 |
| T3 · T4 | 6 | 6 |
| T5 · T6 | 6 | 6 |
| T7 · T8 · T9 | 8 | 8 |
| **totale** | **32** | **31** |

⚠️ **Stamattina erano 34 e 33 su 6 gruppi.** Non è un guasto: Alessio ha
**accostato T3 e T4** durante il collaudo del D2, e due tavoli da 4 accostati
fanno 6. È la proprietà che il giro B doveva garantire — *stessa sera,
disposizione diversa, totale diverso* — vista funzionare **senza che nessuno
l'avesse apparecchiata**.

---

## Per Alessio, in una riga

Tocca un tavolo **bianco** e sei già nei campi della prenotazione, col numero
dei coperti lì accanto; tocca un tavolo **colorato** — anche se è colorato
perché il suo vicino accostato è prenotato — e si apre chi c'è già.
