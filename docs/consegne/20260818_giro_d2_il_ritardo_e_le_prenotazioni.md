# Giro D2 — il ritardo, e le prenotazioni in Comande

**Consegna del 18/08/2026.** Mandato [«La sala e le prenotazioni»](../mandati/20260818_la_sala_e_le_prenotazioni.md),
**punto 1 del perimetro del giro D** (il ritardo dedotto) più la parte di
**punto 5 e 6** che riguarda la sala in servizio. Segue il giro
[D1](20260818_giro_d1_il_conto_sa_da_dove_nasce.md), che ha scritto il legame
che qui si comincia a vedere. Resta il **D3**, le schermate.

- **HEAD dichiarato**: `d0b0b32` (il primo riepilogo di questo giro dichiarava `2d9f4e0`, prima del collaudo di Alessio: le sue due decisioni sono i commit `d0b0b32` e questo)
- **Working tree**: pulito
- **Migrazione**: **nessuna** — al database non serviva niente (vedi sotto:
  *la colonna c'era già e nessuno la leggeva*)
- **Prove**: **102** pure (erano 78) + **172** sul progetto di prova (erano 167)
- **Lint**: zero avvisi · **Build**: ok
- **In produzione**: **niente da applicare**
- **Contratto**: non toccato · **Corridoio**: non ridistribuito (nessuna
  operazione nuova; `apri_conto` è quella del D1)

---

## ⚠️ Cosa NON è verificato

Le prime sette voci arrivano dal giro precedente e **restano aperte**: si
riportano per intero, perché una voce che sparisce senza risposta si legge
come una voce chiusa.

1. 🟡 **Il legame è scritto e ora si vede solo in DUE punti.** Il D1 lo aveva
   lasciato invisibile del tutto; qui compare **sulla scheda del conto aperto
   in Comande** (nome, persone, ora prenotata, note) e **nell'elenco della
   serata**. ⚠️ **Non compare ancora nel preconto, nel ticket di cucina, né
   nella lista prenotazioni del Calendario Eventi**: è il D3.
2. 🟡 **Nessuna mano vera ha toccato il giro C** — le tre fasce e «da liberare
   entro le…» restano provate solo da prove automatiche. Questo giro **ci
   costruisce sopra** (le fasce arrivano in Comande, la precedenza le mette
   sotto il conto aperto), quindi il debito non è diminuito: è aumentato.
3. 🟡 **La mezzanotte in servizio non è mai capitata dal vivo.** Qui c'è un
   pezzo nuovo che dipende da quel confine — `istanteDellaSerata()` — provato
   ai bordi (00:30, 22:30 letta alle 00:15) **solo da prove pure**.
4. 🟡 **La domenica a pranzo non ha prenotazioni vere**, quindi le fasce del
   pranzo non sono mai state guardate su dati veri, né dal D2.
5. 🟡 **La guardia di `--azzera` non è mai scattata in una ricostruzione vera.**
6. 🟡 **I due rami di `DB_URL_PRODUZIONE` non sono mai stati esercitati.**
   ⚠️ **Parzialmente smentito da questo giro**: il ramo di **lettura** è stato
   esercitato oggi, per misurare il canarino in produzione con `psql` in sola
   lettura (`set default_transaction_read_only = on`). Il ramo della **guardia**
   — quello che si rifiuta di scrivere — resta non esercitato.
7. 🟡 **Il messaggio con le date degli scostamenti non è mai comparso a
   schermo.**

E quelle che apre questo giro:

8. ✅ **LA SBARRATURA È STATA VISTA, e si vede** — la voce resta con la sua
   risposta invece di sparire. Alessio l'ha guardata dal telefono la sera
   stessa: *«si vede, va bene così»*, **anche su T8, che sta dentro un
   tavolone**. Il rischio dichiarato — un tratteggio su un tavolo di 90 cm
   ridotto al 75% che si legge come una sfumatura invece che come una
   sbarratura — **non si è avverato**. Resta vero che **nessuna prova
   automatica guarda il disegno**: a guardarlo è stato un occhio, e la
   prossima volta servirà di nuovo.
   ⚠️ **E c'è una correzione di Alessio su sé stesso, che vale più della
   conferma**: aveva prima segnalato T8 come *non* sbarrato, leggendolo dalla
   propria fotografia. Era sbarrato, solo poco marcato. *Ha dedotto da
   un'immagine invece di misurare* — nessun difetto nel programma, e la stessa
   forma dell'errore che questo progetto insegue nel codice: **una lettura non
   è una misura**.
9. 🟡 **LE COMANDE PIENE SONO STATE VISTE IN PARTE.** Alessio ha guardato la
   schermata: **nell'elenco «Stasera» ci sta tutto** — la paura del 14/08 (le
   scritte che non entrano su un tablet verticale) non si è avverata. Restano
   non guardati: **la domenica a pranzo**, **un tavolo con due turni**, e la
   sala con **più conti aperti insieme**, che è la condizione normale di un
   servizio vero e non è mai esistita.
10. 🟡 **Il colore del «conto aperto» è comparso, ma non nella condizione che
    conta.** Alessio prima non vedeva nessun tavolo scuro — ⚠️ **e non era un
    difetto: in quel momento non c'era nessun conto aperto in produzione**,
    quindi quel colore non aveva casi. Aprendone uno è comparso. Quindi **il
    segno esiste e si vede**; se in sala, **con le luci basse**, si confonda
    col fondo scuro della pianta resta da provare in una serata vera.
11. 🟡 **L'orologio che fa scattare la sbarratura batte ogni minuto e non è
    stato visto scattare.** Quello che è provato è il calcolo a un istante
    dato; che il tablet lasciato acceso sul tavolino aggiorni davvero il
    disegno **non è provato da niente**.
12. 🟡 **La serata NON si aggiorna da sola alle 5 del mattino** in Comande, ed
    è invariato rispetto a prima: l'orologio nuovo fa battere il ritardo, non
    la scelta della serata. Un tablet acceso tutta la notte continua a mostrare
    la sala di ieri finché non si ricarica la pagina. **Dichiarato, non
    corretto**: cambiarlo vorrebbe dire far cambiare la sala sotto le mani di
    chi sta ancora chiudendo, e la decisione è di Alessio.
13. 🟡 **Il caso «due turni sullo stesso tavolo» non è stato provato sul
    ritardo.** È provato sul *legame* (giro D1) e sulle *fasce* (giro C), ma
    non c'è una prova che, col primo turno seduto e il secondo che tarda, il
    tavolo si sbarri. ⚠️ **E c'è un limite di merito, dichiarato**: in quel
    caso il tavolo **si sbarra**, anche se il secondo cliente non può sedersi
    perché il primo è ancora lì. La sbarratura dice «questa gente non è
    arrivata», che è vero; non dice «il tavolo è libero», che non lo è.
14. 🔴 **DA OGGI LA PRECEDENZA DEI COLORI NON È DICHIARATA IN NESSUNA
    SCHERMATA.** Le legende sono state tolte (rovesciamento n. 7, deciso da
    Alessio); la regola resta intera, la **spiegazione** vive solo nel codice
    (`segnoDelTavolo`) e in questo documento. ⚠️ Per Alessio non è un problema
    — i colori li ha scelti lui — ma **il giorno che entrerà personale nuovo
    quella spiegazione va rimessa**, ed è lo stesso giorno in cui l'accesso
    condiviso dello staff (§10 di `CLAUDE.md`) smetterà di bastare. Non è
    codice perso: è codice tolto con la sua ragione scritta accanto.
15. 🟡 **Il tavolone colorato intero non è stato visto**: la propagazione è
    arrivata **dopo** il collaudo di Alessio. Quello che ha guardato lui è la
    sbarratura su T8; che T7 e T9 si colorino con lui **è provato solo dalle
    prove pure**.

---

## Cosa abbiamo rovesciato

**Tre rovesciamenti**, tutti nell'elenco
([`decisioni_rovesciate.md`](../decisioni_rovesciate.md), nn. **5**, **6** e
**7**), dove stanno per esteso con le quattro righe.

### 5 · «il ritardo prende tutto il tavolo al posto del colore della fascia»

- **Cosa era stato deciso, e quando.** Il 18/08, aprendo il giro D: *«il rosso
  prende tutto il tavolo al posto del colore della fascia, non si aggiunge come
  bordo»*. Decisione di Alessio.
- **La ragione di allora.** *Il ritardo è l'unica delle due informazioni su cui
  deve agire subito*: non doveva essere un segno subordinato.
- **Cosa si decide adesso.** Il tavolo in ritardo si **sbarra** — un tratteggio
  che passa **sopra** il riempimento invece di sostituirlo.
- **Perché la ragione di allora non vale più — anzi: vale ancora, ed è lei a
  chiedere il cambio.** Quello che è caduto non è il principio ma **il colore
  disponibile**: il terracotta è già la fascia «ultimo giro» **ed è anche il
  tavolo selezionato**. Un terzo rosso avrebbe reso il ritardo *meno*
  riconoscibile, non di più. E la sbarratura soddisfa la ragione **meglio**:
  non è subordinata a niente e **non cancella l'informazione che copre** — un
  tavolo in ritardo continua a dire a che ora doveva arrivare quella gente.

### 6 · «in Comande il tavolo con un conto aperto è dorato»

- **Cosa era stato deciso, e quando.** Dall'08/08, da quando la schermata Sala
  esiste.
- **La ragione di allora.** ⚠️ **Non ce n'è una scritta**, e vale la pena
  registrarlo invece di inventarne una: quella schermata mostrava **due soli**
  stati, e due colori qualsiasi bastavano.
- **Cosa si decide adesso.** Il conto aperto diventa **scuro**; il dorato resta
  al «primo giro», che è il significato che ha nel Calendario dal 14/08.
- **Perché la ragione di allora non vale più.** Perché la premessa è cambiata:
  le fasce arrivano in Comande, e sulla stessa schermata lo stesso quadratino
  avrebbe detto «sono seduti» su un tavolo e «arriveranno fra poco» su quello
  accanto. **Nessuna legenda può sciogliere un'ambiguità così**: chi guarda non
  ha modo di sapere quale dei due sta guardando.
  ⚠️ **Il terracotta resta doppio ed è una scelta**: lì l'ambiguità si scioglie
  da sé, perché il tavolo selezionato è al massimo uno ed è quello che si è
  appena toccato.

**I tre colori delle Comande, PRIMA e DOPO** — scritti per esteso perché è un
cambio di convenzione su una schermata che si userà in servizio, e perché la
percezione di Alessio («mi sembrava già scuro») **era giusta a metà**: il
terracotta c'era davvero, ma voleva dire un'altra cosa.

| | prima del D2 | dopo il D2 |
|---|---|---|
| **dorato** (`b58-gold`) | il tavolo ha un **conto aperto** | **primo giro** — arriva presto, il tavolo può servire due volte |
| **terracotta** (`b58-terracotta`) | il **conto che stai servendo** | invariato per la selezione · e in più: **ultimo giro** (la fascia, dal giro C) |
| **scuro** (`b58-charcoal-soft`) | non esisteva | il tavolo ha un **conto aperto** |
| **verde** (`b58-olive`) | non esisteva in Comande | **occupa la serata** |
| **tratteggio** | non esisteva | **in ritardo**, sopra qualunque colore |

### 7 · «le due legende dichiarano la precedenza dei colori»

- **Cosa era stato deciso, e quando.** Il **18/08**, poche ore prima, dentro il
  perimetro stesso di questo giro.
- **La ragione di allora.** Il rilievo del mandato: *un colore che ne
  sovrascrive altri, senza che la legenda lo dica, si legge come un colore che
  non esiste da nessuna parte*.
- **Cosa si decide adesso.** **Le legende si tolgono del tutto**, deciso da
  Alessio guardando la schermata: le considera superflue. Gli era stata
  proposta anche la via di mezzo — nasconderle dietro un tocco, per chi
  lavorerà in sala e non conosce i colori a memoria — e ha scelto di toglierle.
- **Perché la ragione di allora non vale più — anzi: vale ancora, e questo è il
  prezzo che accettiamo.** La ragione non è caduta: **è cambiato il lettore**.
  Oggi in sala c'è Alessio, che quei colori li ha scelti lui. Il prezzo è
  scritto nella voce 14 di *Cosa NON è verificato*, ed è preciso: **la
  precedenza resta dichiarata solo nel codice e in questo documento**.
- ⚠️ **E quello che resta è la regola, non la spiegazione**: togliere la
  legenda non tocca la precedenza, che continua a decidere i colori
  esattamente come prima.

---

## Il tavolone si colora intero — richiesta di Alessio

*«Non possiamo far sì che i tavoli uniti prenotati o con comande aperte
cambino tutti di colore?»* — guardando la sua fotografia: T7·T8·T9 sono un
tavolone, la prenotazione è agganciata a **T8**, e T7 e T9 restavano bianchi.

⚠️ **Non è una rifinitura: è lo stesso principio del giro B.** Lì un tavolone
ha **un** numero di coperti e non tre, perché l'unità con cui si decide è il
gruppo. Se l'unità è il gruppo per il conteggio, deve esserlo anche per il
colore — altrimenti la stessa sala dice «qui c'è posto per otto» e «due di
questi tre tavoli sono liberi», che non possono essere vere insieme.

**Misurato prima di costruire, come chiesto**: la pianta accetta uno stato
**per sagoma** (`stato[sagoma.id]`), quindi la strada è **propagare al gruppo
prima di disegnare** — e sta in un posto solo, `segniDellaSala()`, chiamata
dalle due schermate. Non è un colore ripetuto tre volte dalle schermate.

⚠️ **E il conto aperto già si comportava così**, misurato invece che supposto:
un conto sta su un **insieme** di tavoli (`order_tables` ha una riga per
ciascuno), quindi tutte e tre le sagome trovavano il proprio conto e si
coloravano. A restare indietro era **solo la prenotazione**, che è agganciata
ai soli tavoli che Alessio ha scelto.

### Il caso incrociato, dichiarato invece che lasciato al caso

Dal giro C sullo stesso tavolone possono esserci **due prenotazioni in due
fasce diverse** — un giallo alle 19:30 su T7, un arancio alle 22:30 su T9.

**Il gruppo non sceglie fra le due e non prende «la più importante»**: le fasce
si **uniscono**, e due fasce diverse fanno **«misto»** (il tavolo mezzo giallo
e mezzo verde). ⚠️ È esattamente la regola che valeva già per due prenotazioni
sullo **stesso tavolo singolo**: nessuna precedenza nuova inventata da chi
scrive il codice, e una prova pura la tiene ferma.

### L'unica cosa che NON si propaga: la selezione

Toccare un tavolo per aggiungerlo a un conto riguarda **quel** tavolo:
colorando tutto il gruppo, lo schermo prometterebbe di aprirne tre mentre ne
apre uno. **La selezione risponde al dito, e il dito ne ha toccato uno solo.**
⚠️ La sbarratura invece passa **anche** sopra il tavolo selezionato, ed è
coerente con la sua natura di secondo canale.

---

## 🔴 Il difetto trovato, e come è stato trovato

**Non rileggendo il codice: chiedendosi come far fallire una prova sui dati
veri.** È la terza volta in due giorni che il risultato arriva da lì.

`ritardiDellaSerata()` cercava le prenotazioni già arrivate confrontando
`p.id`, mentre `turni_del_giorno()` restituisce **`reservation_id`**. Quindi
l'insieme dei «già arrivati» non conteneva mai nessuno.

⚠️ **L'effetto era muto e totale**: ogni tavolo prenotato restava **sbarrato
anche col conto aperto davanti**, per tutta la sera. Nessun errore, nessuna
riga rossa — solo un allarme che non si spegne mai, cioè **quello che si impara
a ignorare**. Il progetto conosce già l'allarme che tace quando dovrebbe
parlare (13/08) e quello che parla quando non dovrebbe (18/08, il battito della
sentinella): questo è il secondo tipo, nella forma peggiore, perché non
sbaglia *qualche volta*.

⚠️ **E la prova pura passava.** I dati se li inventa, e li inventava **della
forma che il codice si aspettava** — cioè la prova confermava una convenzione
che il database non rispetta. *Una prova pura non può accorgersi che si sta
parlando la lingua sbagliata: sa solo se il ragionamento è coerente con sé
stesso.* È la ragione per cui questa consegna ha una prova sul database anche
per una funzione che non tocca il database.

**Chiuso così**: la forma delle righe è **una**, ed è quella che il database
restituisce; le prove pure sono state riscritte con quella forma, e la prova
sui dati veri contiene la riga che ha trovato il difetto, con scritto sopra
cosa dimostra.

---

## Cosa è stato costruito

### 1. La funzione del ritardo — `src/lib/calcoli/ritardo.js`

Pura, senza database, **chiamata dalle due schermate**. Contiene tre cose che
stanno insieme perché sono la stessa domanda vista da due lati:

- **quale conto prova un arrivo** (`ARRIVO_PER_STATO`, `contoProvaArrivo`);
- **quando una prenotazione è in ritardo** (`ritardoPrenotazione`,
  `ritardiDellaSerata`);
- **la precedenza dei segni** (`PRECEDENZA`, `segnoDelTavolo`, `vociLegenda`).

⚠️ **La precedenza è un DATO, non una catena di `if`**, e la legenda si
costruisce da lì. Fino a oggi le due legende elencavano dei quadratini senza
dire che uno copre l'altro — che è il rilievo del mandato: *un colore che ne
sovrascrive altri, senza che la legenda lo dica, si legge come un colore che
non esiste da nessuna parte*. Ora la spiegazione **non può** raccontare un
ordine diverso da quello applicato, perché è lo stesso elenco.

L'ordine: **selezionato** → **conto aperto** → **fascia oraria** → **libero**.
La **sbarratura non è in gara**: si aggiunge sopra qualunque colore.

### 2. «Esiste un conto in questa serata?», e non «c'è un conto aperto?»

La domanda è quella del mandato, e la differenza è tutta:

- con «c'è un conto aperto», un tavolo che ha cenato e pagato **tornerebbe
  rosso alla chiusura del conto** — ogni sera, su ogni tavolo, dopo che è
  andato tutto bene;
- ⚠️ e si passa dal **legame del giro D1** (`orders.reservation_id`), non da
  «un conto su quel tavolo stasera»: un tavolo con due turni porta addosso il
  conto del turno precedente, e contarlo per tavolo direbbe **«arrivato» a chi
  non è ancora entrato**.

⚠️ **Un conto ANNULLATO non prova niente**, ed è una decisione dichiarata: per
tutto il resto del gestionale un conto annullato è **un conto che non è mai
esistito** — non scarica il magazzino (13/08), non entra in nessun incasso, e
l'annullamento è ammesso solo finché la cucina non ha prodotto niente
(decisione di Alessio, 13/08). Farlo valere come prova d'arrivo zittirebbe
l'avviso proprio quando qualcuno ha corretto un tavolo aperto per sbaglio.
✅ **Il caso vero era già in casa**: T3, prenotazione «prova» delle 20:00,
conto aperto alle 21:06 e **annullato alle 21:07**. Con questa regola T3
risulta in ritardo, ed è la risposta giusta — lì non c'è nessuno.

⚠️ **Uno stato di conto sconosciuto NON accende l'allarme**, ed è la direzione
scelta: *un allarme falso ripetuto è peggio di nessun allarme, perché addestra
a ignorarlo*. Il caso non resta scoperto — una prova sui dati veri legge i
valori di `order_status` da **`vocabolari_chiusi()`** (la rete del 17/08) e
diventa rossa se ne compare uno che il file non classifica.

### 3. Comande smette di essere bianca

Prima quella schermata sapeva solo quali tavoli avessero un conto aperto. La
foto di Alessio del 18/08 lo mostra: sala tutta bianca, un solo tavolo
colorato. Ora carica **prenotazioni, coperti, fasce e tavoloni**, e mostra:

- la **cifra dei coperti** dentro la sagoma, col punto della correzione a mano
  (lo stesso stato che riceve il Calendario — non un secondo calcolo);
- i **colori delle fasce** sui tavoli che aspettano qualcuno;
- l'elenco **«Stasera»**, in ordine di ora: ora, nome, quante persone, **su
  quale tavolo**, cosa dice la fascia, «da liberare entro le…» e, se tarda, di
  quanti minuti;
- sul conto aperto, **chi ci sta**: nome, persone, ora prenotata e le note
  della prenotazione (allergie, occasione).

⚠️ **I nomi si leggono dalle prenotazioni e i tavoli dai turni**, non
dall'elenco dei tavoli prenotati: una confermata a cui Alessio non ha ancora
assegnato un tavolo **arriva lo stesso**, e chiedendo l'elenco per tavolo
sarebbe sparita dalla lista senza che niente lo dicesse. In elenco compare con
«tavolo da assegnare».

⚠️ **Dentro la sagoma non entra nessun nome**, e la decisione del 14/08 non è
toccata: chi c'è si legge sotto, dove lo spazio c'è.

### 4. I 30 minuti diventano un parametro vero

🔴 **La colonna `service_settings.minuti_tolleranza_ritardo` esisteva dal giro
D1 e NESSUNA riga di programma la leggeva**: il valore era quello di Alessio
(30), e da nessuna schermata si poteva né vedere né cambiare. È la famiglia
della soglia di magazzino del 13/08 — *tutto acceso, e muto*.

Ora la leggono **le due schermate dallo stesso posto** (una prova sui dati
veri controlla che i due numeri coincidano) e si cambia da *Sala e orari*.
⚠️ Se una delle due `select` la perdesse, la tolleranza diventerebbe **zero** e
ogni tavolo si sbarrerebbe all'ora esatta: la prova esiste per quello.

### 5. Il ritardo si calcola solo sulla serata in corso

Nel Calendario, che visita **qualunque data** — è il suo mestiere: alle 00:30
si prepara domani. ⚠️ Ma «in ritardo» è un'affermazione **sull'adesso**: su una
sera di tre settimane fa nessuno può più arrivare, e ogni prenotazione senza
conto risulterebbe in ritardo per sempre — un allarme che grida su tutto lo
storico. Quindi la sbarratura compare solo se la data guardata **è** la serata
in corso, e la serata in corso si chiede a `serataDiServizio()`, non a
`oggiLocale()` (che alle 00:30 dice già domani). La legenda dichiara la
sbarratura **solo quando può comparire**.

### 6. `istanteDellaSerata()` — l'inverso di `serataDiServizio()`

Sta **nello stesso file**, ed è il motivo per cui non diventa un dodicesimo
orologio: *«sono passati più di 30 minuti dalle 22:30?»* non si risponde con un
orario. Alle 00:15 la sottrazione fra due orologi darebbe **meno ventidue ore**
— «arriva domani» — e un tavolo lasciato vuoto tutta la notte non si
sbarrerebbe mai. Il locale chiude all'una: è un'ora che capita ogni sera.
La prova che le tiene incollate è il **giro d'andata e ritorno**:
`serataDiServizio(istanteDellaSerata(s, o, f), f) === s`.

### 7. I colori in un file solo — `src/lib/coloriSala.js`

La pianta è un disegno SVG, la legenda è testo HTML: non possono condividere
una riga di codice, ma condividono il file dove i colori sono scritti. Scritti
in due posti, a divergere sarebbe **la spiegazione** — quella che nessuno
riesegue.

---

## Le prove, e la controprova

**102 pure** (erano 78: +24) e **172 sul progetto di prova** (erano 167: +5).

Le pure girano **ai bordi e nei due versi**: al minuto esatto della tolleranza
non è in ritardo e al minuto dopo sì; la tolleranza cambiata cambia il
risultato (altrimenti passerebbe anche con 30 scritto dentro la funzione);
dopo mezzanotte i minuti sono 105 e non meno ventidue ore.

Le cinque sui dati veri **entrano come STAFF** — l'accesso che sta in mano a
chi serve — e costruiscono lo stato dalle **porte vere**: prenotazione dal
corridoio, conto dal corridoio, annullamento dalla funzione dell'app.
⚠️ **L'orologio lo mette la prova**, e non è una scorciatoia: il tempo non si
può aspettare, e una prenotazione nel passato la porta vera la rifiuta
(misurato dal giro D1). Il database dà i fatti — chi ha prenotato, chi ha un
conto, quanti minuti di tolleranza — e l'istante lo sceglie la prova. È la
stessa divisione con cui il ritardo è calcolato e non scritto.

### La controprova, fatta e non promessa

Rotte apposta **tre** regole, una alla volta, e ogni volta è diventata rossa
**la prova giusta, e solo quella**:

| rottura | prove rosse |
|---|---|
| la fascia oraria copre il conto aperto | 1 — *«il conto aperto copre la fascia oraria»* |
| un conto **chiuso** non prova l'arrivo | 2 — *«un conto CHIUSO conta»* e *«su una serata intera, il conto chiuso spegne il rosso»* |
| la sbarratura **sostituisce** il colore | 1 — *«LA SBARRATURA NON È IN GARA»* |
| il colore **non si propaga** al tavolone | 5 — tutte quelle del tavolone, ed è giusto: la rottura spegne il meccanismo intero |
| **anche la selezione** si propaga al gruppo | 1 — *«LA SELEZIONE NON SI PROPAGA»* |
| sul tavolone **vince una fascia** invece di «misto» | 1 — *«IL CASO INCROCIATO»* |

Poi tutto rimesso a posto: **102 verdi**.

⚠️ **E la quarta rottura non è stata fatta apposta: è successa.** È il difetto
del nome di campo, ed è la sola che ha trovato qualcosa che nessuno cercava.

---

## Il canarino

Misurato in **produzione**, con `psql` in sola lettura
(`set default_transaction_read_only = on`), perché il connettore di sola
lettura del validatore **non ha il permesso di eseguire** `coperti_del_giorno()`
(risponde `42501`) — vale la pena saperlo, perché è una misura che da lì non si
può rifare.

| | calcolati | veri | gruppi |
|---|---|---|---|
| **produzione** | **34** | **33** | 6 |
| progetto di prova | 34 | 34 | 6 |

**34 calcolati** è il numero che dipende dal codice, ed è quello che si legge:
T1 6 · T2 6 · T3 4 · T4 4 · T5·T6 6 · T7·T8·T9 8. **33 veri** perché Alessio ha
corretto T1 a 5 («Contro il muro»), che è una sua scelta legittima: leggere il
numero vero scambierebbe una sua decisione per un guasto. Sul progetto di prova
quella correzione non c'è, ed è il motivo per cui lì i due numeri coincidono.

---

## ⚠️ Un caso vero era vivo mentre si costruiva

Misurato in produzione alle **21:19 del 18/08**: due prenotazioni confermate
per stasera — **«prova» alle 20:00 su T3** e **«mario» alle 21:00 su T8, otto
persone** — e **nessun conto aperto** (Alessio ha annullato quello su T5 e
quello su T3).

Quindi, con la regola di questa consegna e i 30 minuti di tolleranza:

- **T3 è sbarrato** dalle 20:31, perché il suo unico conto è **annullato**;
- **T8 si sbarra alle 21:31**, e alle 21:19 mancavano dodici minuti.

⚠️ **Non è una verifica**: è la stessa aritmetica del codice applicata a mano
sugli stessi dati, quindi non dimostra che il programma la esegue. Vale come
prova che **il caso su cui questa consegna lavora esiste stasera**, e che il
primo tavolo davvero in ritardo del gestionale è a portata di collaudo.

---

## ✅ Cosa ha guardato Alessio, la sera stessa

Il collaudo è avvenuto **fra la prima e la seconda metà di questa consegna**, e
tre delle quattro domande hanno avuto risposta:

- **il tratteggio del ritardo si vede**, *«va bene così»*, anche su T8 che sta
  dentro un tavolone;
- **i 30 minuti vanno bene**;
- **nell'elenco «Stasera» ci sta tutto**;
- il **tavolo scuro** è comparso solo quando ha aperto un conto — prima non
  c'era nessun conto aperto, quindi quel colore non aveva casi. Resta da
  guardarlo **con le luci basse** (voce 10).

E da lì è nata la richiesta del **tavolone colorato intero**, che è la seconda
metà della consegna.

---

## Per Alessio, in una riga

Il tratteggio e l'elenco li hai già visti e vanno bene. **Quello che resta da
guardare è una cosa sola**: quando accosti dei tavoli, adesso si colorano
*tutti e tre insieme* — prima si colorava solo quello a cui era attaccata la
prenotazione.
