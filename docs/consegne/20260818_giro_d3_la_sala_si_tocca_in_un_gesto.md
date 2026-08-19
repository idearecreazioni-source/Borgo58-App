# Giro D3 — la sala si tocca in un gesto solo, e le prenotazioni si leggono

**Consegna del 18/08/2026.** Mandato [«La sala e le prenotazioni»](../mandati/20260818_la_sala_e_le_prenotazioni.md),
**punti 5 e 6** più i punti **3 e 4** del perimetro deciso per il giro D.
È **l'ultimo giro del mandato**: A, B, C, E, D1 e D2 sono chiusi e validati.

- **HEAD dichiarato**: `713d973` — il giro è in **otto commit di codice** perché il collaudo di Alessio è passato **sette volte** in mezzo alla consegna
- **Working tree**: pulito
- **Migrazione**: **nessuna** — nessun dato nuovo, solo dati già scritti che
  arrivano dove non arrivavano
- **Prove**: **120** pure (erano 102) + **174** sul progetto di prova (erano 172)
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

8. ✅ **IL RIQUADRO, IL PANNELLO E I BLOCCHETTI SONO STATI PROVATI DA UNA MANO.**
   Alessio li ha guardati in cinque passaggi, e da lì nascono quasi tutte le
   correzioni di questa consegna. In particolare: **il pannello dentro la
   pianta esce e torna sotto quando gli si sposta un tavolo sopra** — è la
   cura di un costo che il giorno prima era solo *dichiarato*, ed è una delle
   poche cose di oggi che una mano ha davvero toccato.
   ⚠️ Resta vero il limite generale: **nessuna prova automatica di questo
   progetto guarda una schermata**. Quello che è provato è che i dati
   arrivano.
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
   non si può riprodurre**. ✅ Quello verso i campi è stato visto funzionare;
   quello verso la riga della prenotazione no.
10. 🟡 **Il tocco su un tavolo libero non è mai stato provato su un tavolo che
    fa parte di un TAVOLONE**, e ora quel caso ha una forma nuova: il titolo
    del pannello mostra tutti i tavoli del gruppo col toccato in grassetto.
    **Non è stato guardato da nessuno.**
11. 🟡 **Il riquadro non è mai stato aperto su un tavolo con DUE turni** — il
    caso che il giro C ha reso possibile. I dati per farlo esistono, ma non è
    mai successo.
12. 🔴 **«Chi ha corretto e quando» non si legge più da nessuna schermata**
    (rovesciamento n. 8): il dato continua a essere **scritto** dal trigger, e
    la metà che sparisce è quella visibile. ⚠️ Il giorno che ci saranno accessi
    **per persona** quella riga va rimessa a schermo — e diventerà leggibile
    all'indietro, perché nel frattempo è stata scritta lo stesso.
13. 🟡 **LO ZOOM DELLA TASTIERA su iPhone resta**, per decisione di Alessio
    (*«non è un grosso problema, lo restringo io»*). ⚠️ Non è un capriccio del
    telefono: iOS ingrandisce da solo quando il testo di un campo è sotto una
    certa dimensione. **Il giorno che una mano diversa dalla sua userà quella
    schermata in servizio, «lo restringo io» non sarà più una risposta.**
14. 🔴 **Sul computer, da oggi, il Calendario mostra la sala sdraiata e le
    Comande in piedi senza niente che lo spieghi** (rovesciamento n. 11). Il
    fatto resta vero — le due schermate chiedono la pianta alla stessa
    funzione — ma **la frase che lo diceva è stata tolta da tutte e due**. Sul
    telefono non serviva più (lì la pianta si gira da sola e le due schermate
    sono identiche); sul computer serviva, e il prezzo è dichiarato.
15. 🔴 **LA CASELLA DELL'ORA E LE ALTRE QUATTRO COSE DEL 19/08 non le ha
    ancora guardate nessuno**: la cura della larghezza è una cura di
    meccanismo (`min-w-0` e `appearance-none`), non una misura — a misurare
    sarà la prossima fotografia. Con lei restano non viste: la striscia
    sopra la pianta, il telefono cliccabile, la sala senza didascalie e
    l'ordine nuovo del titolo.
16. 🟡 **In Comande `handleSend` non ha un `catch`**: se l'invio riesce ma la
    rilettura fallisce, non compare nessun avviso e resta a schermo la
    situazione di prima. Stessa famiglia della sala disegnata vuota, **molto
    meno grave** — i dati sono di pochi secondi prima e l'invio è avvenuto
    davvero. **Annotato, non fatto.**
17. 🟡 **Quante altre schermate fanno più letture insieme** (Magazzino,
    Cassa, Proiezione): Alessio ha deciso di **non misurarlo adesso**. La
    voce resta in coda, ed è quella che decide se è una cosa piccola o un
    lavoro a sé.
---

## Cosa abbiamo rovesciato

**Sei rovesciamenti**, tutti nell'elenco
([`decisioni_rovesciate.md`](../decisioni_rovesciate.md), nn. da **8** a **13**),
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

---

## 🔴 Il terzo giro di collaudo — l'errore che nessuno aveva segnalato

Alle **23:55**, sulla schermata «La sala», una banda rossa **«TypeError: Load
failed»** e **la pianta vuota**: nessun tavolo, solo le zone. Una volta sola;
riaprendo la pagina era tornato tutto. Alessio non l'ha segnalato — l'ha visto
il validatore nelle sue fotografie.

**Misurato invece di archiviarlo come intermittenza di rete.** Quella schermata
fa **nove letture in blocco**, e sono avviate insieme: se **una sola** fallisce,
**nessuna** delle altre viene applicata. La schermata mostrava la striscia
rossa e **sotto continuava a disegnare** — la sala, con dentro zero tavoli.

⚠️ **E una sala vuota è un'informazione, non l'assenza di un'informazione.**
Chi guarda legge *«stasera non ha prenotato nessuno»*, e in quel momento era
falso. È la stessa famiglia dell'elenco allergeni vuoto che si legge «non
contiene allergeni» (13/08): **il caso in cui il gestionale non sa deve dirlo**,
non disegnare il contenitore.

**Cosa è cambiato.** La pianta si disegna **solo se è stata letta davvero**;
altrimenti al suo posto c'è *«non sono riuscito a leggere la sala — non vuol
dire che è vuota, vuol dire che non lo so»*, con il gesto per **riprovare**
(un rifiuto senza via d'uscita è un vicolo cieco, regola del 16/08, e
quell'errore è passeggero).

⚠️ **E lo stesso segno copre un caso più insidioso che nella foto non si
vedeva**: cambiando giorno, se la lettura fallisce, senza di esso resterebbero
a schermo **i tavoli di ieri sotto la data di oggi** — una sala vera, per il
giorno sbagliato.

### ⚠️ La stessa forma esisteva in Comande, ed è dove morderebbe davvero

Misurato su richiesta: **cinque letture in blocco**, stesso comportamento. Ma lì
la frase era peggiore — **«Nessun tavolo configurato»**, cioè una frase *sicura
di sé* e falsa, letta di sera con la rete del locale mentre si serve. Corretta
con lo stesso rimedio.

---

## La misura sullo spazio dentro la pianta (proposta di Alessio, non costruita)

*«Potremmo sfruttare lo spazio utilizzato dentro la pianta per cucina e servizi
inutilmente per far comparire le info sui tavoli.»* L'idea risolve alla radice
il problema rincorso tutta la sera — il modulo che spinge la pianta in basso e
obbliga a scorrere. **Misurato prima di decidere, come chiesto**, dalle costanti
vere del disegno:

| | pianta | area libera (Servizi + Cucina) |
|---|---|---|
| telefono di Alessio (390 pt) | 358 pt | **179 × 487 pt** |
| telefono stretto (375 pt) | 343 pt | 172 × 466 pt |
| tablet delle Comande (768 pt) | 736 pt | **368 × 1000 pt** |
| computer (max-w-5xl) | 1024 pt | **693 × 255 pt** |

*(l'area libera è 1400 × 515 cm di sala; il bersaglio di tocco del progetto è
40 pt, un bottone 32 pt)*

**Il sospetto del validatore è confermato dai numeri.**
- **Sul telefono l'area è alta ma STRETTA: 179 pt, cioè metà schermo.** Ci sta
  benissimo la **scheda di chi c'è** (nome, ora, quante persone, note). **Non**
  ci sta il modulo intero: cinque campi su 179 pt di larghezza vogliono dire
  caselle da ~163 pt utili, dove un nome lungo e la riga delle note stanno
  strette — e la larghezza non si recupera, perché quell'area è larga quanto è
  profonda la sala.
- **Sul tablet e sul computer ci sta tutto**: 368 × 1000 pt e 693 × 255 pt (sul
  computer i campi vanno su due colonne, che nei 693 pt entrano comode).

⚠️ **Quindi due comportamenti diversi, e a deciderli è lo SPAZIO, non il tipo di
dispositivo** — che è la condizione posta. La stessa misura che gira la pianta
in piedi decide anche questo.

⚠️ **E il vincolo del trascinamento, misurato.** Il trascinamento di una sagoma
usa la *cattura del puntatore*: una volta cominciato, tutti gli eventi restano
alla sagoma **anche passando sopra un pannello**. Quindi trascinare un tavolo
*dentro* la cucina continuerebbe a funzionare. Quello che si perde è **afferrare
un tavolo che sta già sotto il pannello**: oggi non ce n'è nessuno lì, ma è uno
spazio libero sul disegno e **non vietato**, e Alessio i tavoli li sposta.

**COSTRUITO il 19/08**, dopo che Alessio ha risposto alla misura con una
soluzione invece che con una rinuncia — vedi la sezione qui sotto.

---

## Il pannello dentro la pianta — la misura scavalcata, e come

I numeri dicevano che **sul telefono il modulo non ci stava**: 179 punti di
larghezza, metà schermo. Alessio ha risposto con una soluzione:

> *«Facciamoci entrare tutto, basterà fare i riquadri da compilare più alti in
> modo che siano più facili da toccare con il dito. A quel punto si aprirà la
> tastiera dell'iPhone e la dimensione del riquadro non conterà più, anche
> perché se ci scrivo dentro del testo che non entra in un'unica riga potrà
> sempre andare a capo.»*

⚠️ **Il ragionamento regge, e va scritto perché è il metodo, non la
soluzione.** Il vincolo misurato era la **larghezza**; lui ha **spostato la
spesa sull'altezza**, che in quell'area ce n'è 487 punti. Una casella alta si
prende col dito anche se è stretta, e appena la si tocca la tastiera copre lo
schermo — da quel momento la larghezza non conta più. *Una misura dice dove sta
il vincolo, non che il problema è insolubile.*

Quindi **un comportamento solo** — niente doppio comportamento telefono/computer
— coi campi **in colonna e più alti**. ⚠️ E **sopra** la soglia toccabile: si
allargano le caselle in altezza, non si stringono per farcele stare. Quella
soglia è già stata sfondata una volta nel giro E, e a salvarla è stata la sua
mano, non un ragionamento.

### ✅ Il costo dichiarato ieri non si paga più

Ieri era stato scritto che **un tavolo finito sotto il pannello non si potrebbe
più afferrare**. Non è stato dichiarato a schermo e lasciato succedere: **il
conflitto non si fa esistere**. Se c'è un tavolo sopra la cucina, il pannello
**esce dalla pianta e torna sotto**. Si perde una comodità, non un gesto.

*Quello spazio è vuoto sul disegno ma non è vietato, ed è esattamente il genere
di cosa che Alessio fa: i tavoli li muove lui.*

### La tastiera

Il pannello sta in fondo alla pianta, e su iPhone la tastiera copre metà
schermo: il campo su cui si sta scrivendo **si porta in vista** appena riceve il
fuoco, chiedendo la **distanza minima** — così dove la tastiera non c'è non si
muove niente. ⚠️ **Non verificato su un iPhone vero**: è la voce più esposta di
questa consegna.

### ⚠️ Quali zone è una scelta, la geometria no

Le due zone — Servizi e Cucina — sono **nominate** nel codice, perché quali
siano è una decisione (sono quelle in cui non c'è mai niente da guardare). Dove
stanno e quanto sono grandi **lo dice il fondale**: se la cucina cambia misura
il pannello la segue. E se una delle due venisse rinominata, il pannello **non
si disegna** e il modulo torna sotto: si perde una comodità, **non si disegna
un pannello sopra il pavimento della sala**.

### 🔴 Una prova che non discriminava, trovata dalla rottura

Rompendo apposta la lettura del **verso** della sagoma — misure sulla carta
invece del verso vero — **nessuna prova è diventata rossa**. La ragione:
l'area del pannello parte dall'**angolo** (0,0), quindi una sagoma la tocca se
e solo se il suo spigolo in alto a sinistra ci cade dentro, e **quanto è grande
non conta**.

Il verso resta letto — è giusto in generale, e il fondale può cambiare — ma la
prova che *fingeva* di provarlo è stata **tolta** e sostituita con una che
dichiara il fatto. ⚠️ *È la stessa regola applicata a sé stessa: una prova che
passa anche sul codice rotto non prova niente, e vale anche quando è nostra e
appena scritta.*

---

## ⚠️ Voce di coda, da MISURARE e non da fare adesso

**Quante altre schermate fanno più letture insieme e disegnano lo stesso se una
fallisce?** Rilievo del validatore, e nasce da un conto semplice: **due ne sono
saltate fuori in un pomeriggio senza cercarle** (la sala del Calendario e quella
delle Comande).

Magazzino, Cassa e Proiezione fanno tutte più letture, e lì il fallimento si
legge nello stesso modo: **un elenco vuoto si legge «non c'è niente», un saldo
mancante si legge «zero»**. È la stessa confusione fra *assenza di informazione*
e *informazione di assenza* — che in tre giorni questo progetto ha commesso tre
volte: la sala vuota, «Nessun tavolo configurato», e il manuale HACCP che
stampava «conforme».

**Il numero che esce da quella misura decide se è una voce piccola o un lavoro a
sé**, e per questo si misura prima di aprirlo.

---

## ✅ Il quinto collaudo — il pannello provato con le mani

**Verificato dal vivo da Alessio**: il pannello dentro la pianta funziona, i
campi ci sono, e **spostando un tavolo sopra la cucina il pannello esce dalla
pianta e torna sotto**. ⚠️ È una delle poche cose di questa consegna che una
mano ha davvero toccato — ed è proprio la cura del costo che il giorno prima
era stato solo *dichiarato*.

E quattro cose corrette:

### Il titolo diventa l'elenco dei tavoli

Il pannello **sforava in altezza** e l'ora finiva fuori dal contenitore. La
riga da togliere era «T5 · T6: Ci stanno 6» — ⚠️ **ma era l'unico posto dove si
vedeva che quel tavolo fa parte di un tavolone**, e sotto c'è «Correggi il
numero», che corregge il numero del **gruppo**.

L'informazione non si è persa: è passata **nel titolo**, che adesso è l'elenco
dei tavoli col toccato in grassetto — «T7 · T8 · **T9**». Sta su un rigo, è
**più corto** di «Prenotazione su T9», e resta **dove sta il dubbio**.

### Le prenotazioni senza tavolo vanno in cima

Il bordo colorato non basta se la riga sta in fondo: *la ragione per cui devono
farsi notare è che rischiano di restare senza tavolo*, e in fondo all'elenco si
guardano per ultime. Dentro i due gruppi l'ordine resta per ora — è come si
legge una serata.

### La data non si ripete

Compariva nel selettore **e** riscritta accanto. Al suo posto è salito
l'interruttore «al completo», che stava sulla riga sotto.

### Il tavolo che sfora la pianta torna dov'era

Prima si fermava **appoggiato al bordo**. ⚠️ I due esiti dicono cose diverse:
*fermarsi al bordo somiglia a «l'ho messo lì»*, tornare indietro dice «quel
gesto non si poteva fare» — e una posizione contro il muro che nessuno ha
scelto resta scritta come se qualcuno l'avesse scelta.

⚠️ **E torna esattamente da dov'era partito, non in un posto calcolato**: basta
**non salvare**. Così non può finire sopra un altro tavolo né dentro il
pannello — la posizione di partenza era valida per definizione. Era la domanda
posta prima di costruirlo, e la risposta è che il caso non si presenta.

⚠️ **E si vede prima di lasciare**: mentre il dito è fuori la sagoma si fa
trasparente e prende il bordo del rifiuto. Un gesto che si annulla solo al
rilascio è una sorpresa, e la volta dopo si trascina piano per paura — è la
stessa ragione per cui il segno del magnete si vede *mentre* prende.

---

## ⚠️ La tastiera: deciso di non correggere, e perché va scritto

*«La tastiera copre un po' il campo ma non è un problema, semmai quando la
tastiera si apre zooma sul campo da compilare e quando smetto di scrivere resta
zoomato. Non è un grosso problema, lo restringo io.»*

**Non è stato corretto: ha deciso lui.** Ma va annotato, perché **lo zoom che
resta dopo la scrittura non è un capriccio del telefono**: iOS ingrandisce da
solo quando il testo di un campo è sotto una certa dimensione, e si evita
alzando quella dimensione. Oggi «lo restringo io» è una risposta;
⚠️ **il giorno che una mano diversa dalla sua userà quella schermata in
servizio, non lo sarà più** — chi serve non restringe niente con due dita
mentre accompagna qualcuno al tavolo. Voce di coda, non lavoro adesso.

---

## Il sesto collaudo — e due rilievi che la misura ha cambiato

✅ **Verificato da Alessio**: il titolo «T5 · **T6**» *«si capisce, riguarda il
tavolone e non sembra che stia prenotando tre tavoli»*; e il tavolo che si fa
trasparente uscendo dalla sala è *«perfetto»*. ⚠️ Quest'ultimo era stato
**aggiunto di iniziativa**, non richiesto: senza un segno, il ritorno alla
posizione di partenza si legge come un errore, e la volta dopo si trascina
piano per paura.

### Il pannello: si stringe fra le cose, non dentro le caselle

*«Basta stringere leggermente gli spazi tra una cosa e l'altra e ci siamo.»*
Tolti **circa 108 punti** di altezza su 487 **senza toccare l'altezza dei
campi** — che è la soglia toccabile, già sfondata una volta nel giro E:

| cosa | prima | dopo |
|---|---|---|
| il riquadro dentro il riquadro (il pannello aveva bordo e sfondo sotto un altro riquadro) | 24 pt | 0 |
| bordo interno del pannello | 20 pt | 8 pt |
| spazio fra un campo e l'altro | 12 pt | 4 pt |
| spazio sotto ogni etichetta | 6 pt | 2 pt |
| «Note (allergie, occasione…)» che andava a capo | 2 righe | «Note» |

⚠️ **Contato sul CASO PIÙ LUNGO e non su quello di stasera**, che era il
rilievo: modulo intero, titolo di tre tavoli, tutte le etichette → **≈ 356
punti su 487**. Se il titolo va a capo restano ancora un centinaio di punti di
margine.
⚠️ **Ma sono stime lette dal codice, non misure**: a misurare sarà il suo
occhio. E se anche il caso più lungo sforasse, il pannello **scorre dentro di
sé** — non si perde niente, si perde comodità.

### Il buco nel registro dei rovesciamenti

Trovato dalla validazione **contando**: la tabella andava da 1 a 13 e i
racconti erano dodici. **Misurato: non mancava un rovesciamento** — mancava la
**sezione** del n. 4, perché il suo racconto stava solo nel riepilogo del giro
E. Scritta.

⚠️ *Un elenco che esiste per far **contare** i rovesciamenti non può avere un
buco*: chi lo legge fra sei mesi non sa se ne manca uno o se è un numero
saltato. Da qui in avanti ogni riga della tabella ha la sua sezione, anche
quando il racconto lungo vive altrove.

### 🔴 Il segno «letta» in Comande — e la misura che ha cambiato la risposta

Il rilievo: in Comande manca lo spegnimento del segno al cambio di serata,
quindi alle 5 del mattino una lettura fallita lascerebbe **la sala di ieri
sotto la serata di oggi**.

**Misurato prima di correggere**: in Comande la serata si decide **una volta
sola**, all'apertura della schermata, e **non cambia più** (è una voce già
dichiarata nel riepilogo del giro D2). Quindi **oggi quel caso non può
presentarsi**, e il rilievo cade nella sua forma.

**Corretto lo stesso**, e la ragione è che la trappola è **latente, non
inesistente**: il giorno che la serata si aggiornerà da sola — voce aperta —
sarebbe armata, e sarebbe **la peggiore delle due**: non una sala vuota, che si
nota, ma una sala vera per il giorno sbagliato, che è plausibile. Costa una
riga chiuderla adesso.

⚠️ **E perché era rimasta aperta, che è la parte che tornerà.** La cura è nata
nella schermata dove il difetto è stato **visto** — il Calendario, in una
fotografia mandata per altro — non in quella dove morde di più. *Un difetto
curato dove lo si è visto lascia scoperto lo stesso difetto dove nessuno ha
guardato.*
⚠️ **La prova che discriminerebbe** — cambiare serata con una lettura che
fallisce, nei due versi — **non esiste**: in questo progetto nessuna prova
automatica guarda una schermata, e questo vive in uno stato della schermata.

---

## Come sono stati trovati i difetti di questo giro — il risultato del metodo

Vale la pena contarli, perché dice più del codice:

| difetto | chi l'ha trovato |
|---|---|
| il modulo che restava senza tavoli | **la mano** di Alessio |
| il tocco che trattava da libero un tavolo colorato | **la mano** di Alessio (dall'avviso mancante) |
| la sala disegnata vuota quando una lettura fallisce | **una sua fotografia**, mandata per altro |
| il nome di campo sbagliato nel ritardo (giro D2) | **una prova sui dati veri** |
| la prova sul verso della sagoma che non discriminava | **una rottura fatta apposta** |
| il buco nel registro dei rovesciamenti | **la validazione, contando** |

⚠️ **I tre difetti grossi li ha trovati una mano o un occhio.** Le prove
automatiche hanno fatto il loro lavoro — tengono ferme le regole, e due volte
hanno trovato cose che nessuna rilettura avrebbe visto — ma **nessuna di loro
guarda una schermata**, e i difetti di questo giro vivevano quasi tutti lì.
*Il collaudo con le mani non è la conferma finale di un lavoro finito: è lo
strumento che ha trovato di più.*

---

## Il settimo collaudo (19/08, foto delle 01:48) — cinque cose

### La casella dell'ora sforava, e la causa era il meccanismo

Nella fotografia il campo ORA esce dal bordo del pannello e i suoi due angoli
destri sono **squadrati** — tagliati dal ritaglio del contenitore, non disegnati
così. **L'ipotesi posta dalla validazione era giusta**: le celle di una griglia
hanno `min-width: auto`, quindi non scendono sotto la larghezza **minima
intrinseca** del contenuto, e un campo `type="time"` ne porta una sua più
grande di metà pannello (~179 punti). La colonna si allargava, il pannello no.

Cura: `min-w-0` sulle celle **e** sul campo, `appearance-none` sull'ora.
⚠️ **Non verificata da un occhio**: è una cura di meccanismo, e a misurare sarà
la prossima fotografia. Il criterio è scritto: stessa larghezza di PERSONE,
dentro il bordo, quattro angoli arrotondati.

### Note e telefono, in tutti e due i posti

Nel riquadro del tavolo e nell'elenco sotto la pianta, **col numero
cliccabile** — chi guarda quelle righe sta decidendo se telefonare a chi non è
arrivato. ⚠️ **Compaiono solo se ci sono**: una riga con l'etichetta e niente
dentro è arredamento.

⚠️ **E stanno FUORI dal bottone della riga**, non dentro: un collegamento
dentro un bottone non è HTML valido, e sul telefono il tocco finisce a chi
capita. Era il modo più naturale di scriverlo ed è quello sbagliato.

### Le prenotazioni senza tavolo salgono SOPRA la pianta

🔴 **Metterle in cima all'elenco non bastava**, ed è un difetto della cura
precedente: l'elenco sta **sotto la pianta**, e sul telefono resta fuori
schermo — cioè *esattamente il problema che dovevano risolvere*. Finché non
hanno un tavolo stanno in una striscia sopra la pianta; appena ce l'hanno
tornano nell'elenco con le altre.

⚠️ **In un posto solo per volta**, mai in due: una riga che compare due volte fa
contare due prenotazioni dove ce n'è una. ⚠️ E la striscia **non esiste** quando
non c'è nessuno — una striscia che dice «nessuna» è arredamento, e questa deve
farsi notare proprio perché compare di rado.

### Via le didascalie del fondale — e la trappola non presa

Tolti dal disegno i nomi delle zone e l'ingresso per intero (parola e segno
della porta). Con le sagome, i colori, i coperti e il pannello, quelle scritte
erano diventate rumore — e una si sovrapponeva all'etichetta NOTE del modulo.

🔴 **La trappola era segnalata, e non è stata presa**: `riquadroDelPannello()`
filtra le zone **per nome**. I nomi **restano nei dati** — si è tolto solo il
`<text>` che li disegna — e adesso c'è una **prova che dichiara il fatto**,
perché togliendoli il pannello dentro la pianta smetterebbe di comparire
**senza nessun errore**: si limiterebbe a non succedere.

⚠️ **Per poter scrivere quella prova, il fondale si è spostato** da
`api/sala.js` a `calcoli/sala.js`: non è un accesso al database, è un dato del
disegno, e lì si prova senza collegarsi a niente. **Controprova fatta**: tolti i
nomi dai dati, due prove diventano rosse.

### L'ordine del titolo segue la sala, non il raggruppamento

Rilievo della validazione sulla stessa fotografia: la pianta mostrava «T9 T8
T7» e il titolo scriveva «T8 · T7 · T9», perché l'ordine veniva dal
raggruppamento del database. ⚠️ *Il titolo esiste per dire quale tavolone si sta
guardando: se le due letture non coincidono, chi legge deve ricostruirle.*
Adesso le etichette si ordinano per **posizione nella sala** — prima per
profondità, poi per larghezza, cioè la sala letta come una pagina. Con la sala
in piedi (il telefono) quella profondità è la sinistra-destra dello schermo,
che è il caso della fotografia.

---

## ⚠️ In coda, annotato e non fatto

- **In Comande `handleSend` non ha un `catch`**: se l'invio riesce ma la
  rilettura fallisce, non compare nessun avviso e resta a schermo la situazione
  di prima. Stessa famiglia della sala disegnata vuota, **molto meno grave** —
  i dati sono di pochi secondi prima, e l'invio è avvenuto davvero.
- **Quante altre schermate fanno più letture insieme** (Magazzino, Cassa,
  Proiezione): Alessio ha deciso di **non misurarlo adesso**. La voce resta.
