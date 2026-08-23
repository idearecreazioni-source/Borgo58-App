# Gli otto blocchi dal collaudo del 23/08

**23/08/2026 — mandato di otto blocchi**, aperto da Alessio dopo il
collaudo. Eseguito dopo la consegna precedente (`e6b2d6f`), in una
sessione nuova.

| | |
|---|---|
| HEAD dichiarato | `19f5572` |
| working tree | pulito (solo file `*.local.*`, ignorati) |
| migrazioni nuove | `20260823000020_il_cliente_del_tavolo.sql`, `20260823000021_la_spesa_spicciola.sql` |
| applicate | ✅ progetto di prova (193) — ❌ **non** in produzione (172, invariata) |
| funzione online | corridoio `operazioni-atomiche` **v22 solo sulla prova** |
| blocchi fatti | **7 su 8** |
| blocchi saltati | **1** (il 7, per la ragione scritta sotto) |
| prove | 315 pure · 356 sul progetto di prova, tutte verdi |

⚠️ **Nessuna delle due migrazioni cancella o modifica dati esistenti.**
La prima aggiunge una colonna che nasce **vuota** su tutte le 348 righe
già scritte; la seconda crea una tabella nuova. Le uniche cancellazioni
sono dentro i blocchi di verifica, che ripuliscono ciò che hanno creato
loro — controllato contando le lapidi prima e dopo.

---

## Blocco 1 — La rete contro la funzione riscritta a memoria

**Fatto.** `scripts/guardie.mjs`, agganciato a `npm run prova:migra` e a
`npm run migra` — i due punti da cui una migrazione passa per forza.

Prima di applicare, ogni funzione che una migrazione ridefinisce viene
confrontata col **corpo vivo del database in quel momento**, e il
programma si ferma se il corpo nuovo ha perso qualcosa.

⚠️ **Non è un confronto testuale**: griderebbe a ogni modifica legittima,
e un guardiano che grida sempre si impara a spegnere. Guarda **cinque
impronte** — i messaggi di `raise exception`, i portieri (`auth.uid()`,
`is_titolare()`, `security definer`, `set search_path`), le parole-chiave
scritte nelle stringhe (il patto con la schermata, `'righe_non_scaricate'`),
le colonne di un `returns table`, e le chiamate ad altre funzioni del
progetto — e **solo nel verso della perdita**. Aggiungere non fa scattare
niente.

**Misurato prima di scegliere la forma**, su tutta la storia: applicata
all'indietro griderebbe su **23 ridefinizioni su 163**. Da qui la soglia
dichiarata `PRIMA_CON_RETE = 20260823000020`, stessa forma di
`PRIMA_CON_RIEPILOGO`: una rete nuova non può pretendere una
dichiarazione da file scritti prima che esistesse, e quei file sono
committati e su GitHub.

**Due falsi allarmi sistematici trovati e chiusi misurando**, non
rileggendo:
- il database scrive sempre `SET search_path TO 'public'` con gli apici e
  le migrazioni senza: **ogni** ridefinizione sembrava aver perso la
  parola «public»;
- la stessa frase scritta `e''` o `è` sembrava un messaggio sparito —
  successo su `quadratura_fiscale`, dove **il portiere era intatto**. I
  messaggi ora si confrontano senza accenti né apostrofi.

✅ **Provata rompendo, nei due versi.** Una migrazione costruita dal corpo
vivo vero togliendogli il portiere viene **respinta prima di essere
applicata**, nominando le tre cose perse; la stessa con una riga in più e
nulla di meno passa. Rompendo la rete stessa, **7 delle 17 prove pure
diventano rosse**.

✅ **E il caso vero del 23/08 lo prende**: puntata alla produzione (ferma a
prima del difetto), la rete nomina esattamente ciò che
`20260823000002` stava per perdere — il messaggio del portiere e
`righe_non_scaricate`, il campo che la schermata Produzioni legge.

⚠️ **Limite dichiarato**: la via d'uscita (`-- rete-guardie: nome — perché`)
vale per **tutta la funzione**, non per la singola riga. Chi dichiara di
togliere un messaggio e nello stesso passaggio perde un portiere non
viene fermato — ma l'elenco intero di ciò che si perde viene stampato
comunque.

⚠️ **E le 19 migrazioni in attesa sono state guardate, non saltate.**
Confrontando il corpo vivo della produzione con quello della prova —
l'effetto netto di tutte e diciannove — le cose perse sono **tre, tutte
volute**: il messaggio di `chiudi_partita`, allargato per far entrare
«resa al fornitore», e la parola `scarto` in `prodotti_da_compilare` e
`applica_scheda_prodotto`, tolta col Blocco 5 di ieri.
**`registra_produzione` arriva intera.**

---

## Blocco 2 — Il vincolo sulla lista della spesa

**Fatto, nessuna migrazione: non c'era niente da correggere.**

Il vincolo nato ieri **non impedisce** il caso legittimo. Provato con le
mani sul progetto di prova, **dal client col token di un utente vero** —
l'unico strato dove il difetto si vedrebbe:

- comprati 3 kg su una soglia di 10, la riga si chiude e il prodotto
  **rientra da solo** al controllo successivo;
- a mano si può riaggiungere sempre, anche mentre la riga automatica è
  aperta;
- una riga tolta libera **subito** il posto.

🔴 **La prima versione della controprova non discriminava.** Lanciava tre
chiamate insieme e contava le righe: tolto il vincolo dal database, la
prova restava **verde** — le tre chiamate non si erano davvero pestate i
piedi e il `not exists` era bastato. Riscritta per pretendere il rifiuto
del database (`23505`): tolto il vincolo diventa rossa, rimesso torna
verde. **Le due prove restano tutt'e due**: una copre la corsa, l'altra
il gesto normale, e sono difese diverse.

⚠️ **Trovato provando, e vale scriverlo**: finché una riga scritta **a
mano** è aperta, quella automatica non ricompare. Non è il vincolo nuovo,
è la regola del 13/08 — non si aggiunge niente se il prodotto è già in
lista in qualunque forma. I due comportamenti si somigliano, e chi un
giorno indagherà su una lista che non si riempie deve sapere che le porte
sono due.

---

## Blocco 3 — Cassa: quattro riquadri e gli omaggi «Altro»

**Fatto.** I tre riquadri diventano quattro (in cassa · in banca · questo
mese · omaggi «Altro»), su due colonne fino al computer — quattro in fila
su un mini tablet darebbero colonne da meno di due centimetri.

**La percentuale**, con la formula di Alessio: omaggi «Altro» ÷
(incassato + tutti gli omaggi a listino).

⚠️ **Il denominatore è la roba servita, non l'incasso**, e c'è una prova
che lo difende: un conto omaggiato incassa zero, quindi dividere per il
solo incassato direbbe che si è regalato più del 100% le sere in cui si è
regalato tanto. Coi suoi numeri (90 incassati, 10 di omaggi) la regola
giusta fa **10%** e quella sbagliata 11,1%.

⚠️ **Zero servito non fa zero per cento: fa «non lo so»**, e si dice. Uno
0,0% si legge «non abbiamo regalato niente», che è un'altra cosa.

✅ **Verificato su un caso che DISCRIMINA.** Col mese di agosto com'era
(**116,00 €** incassati, **nessun** omaggio) il riquadro avrebbe detto 0%
e non avrebbe dimostrato niente — è la trappola del caso vuoto del 17/08.
Messo un omaggio «Altro» da **84,00 €** e guardata la schermata vera:
**84,00 € e 42%**, che è esattamente 84 ÷ (116 + 84). L'omaggio di prova
è stato tolto, e con lui la lapide che la sua cancellazione aveva
lasciato nel registro.

**Tolti come chiesto**: il paragrafo lungo sotto il saldo e «Movimenti
recenti». ⚠️ L'ultimo conteggio del cassetto **non è sparito**: sta già
dentro «Il cassetto», che resta. Restano anche le due righe che non sono
spiegazioni ma **avvisi** — «di cui non sono tuoi» e le uscite non ancora
nel saldo — perché senza, il numero grande avrebbe l'aria di essere
completo senza esserlo.

⚠️ **Una frase è diventata falsa nello stesso momento**: il paragrafo in
cima rimandava a «la scomposizione qui sotto», che non c'è più. Corretta.
*Chi toglie un pezzo di schermata cerca chi lo nomina.*

**Misure alle tre calibrazioni** (mini tablet 7,9" e 8,3", monitor): testo
3,20 mm ovunque, nessun numero che va a capo, nessuno scorrimento
orizzontale, riquadri da 52,6 / 56,6 / 91 mm.

⚠️ **Nessun dato degli sconti è stato toccato**: sconti e omaggi restano
distinti dappertutto, cambia solo cosa si vede in evidenza qui.

---

## Blocco 4 — Chiusura conto: via «device» e «cliente»

**Fatto, nessuna migrazione.** Le due caselle facoltative spariscono dalla
finestra di chiusura in Comande. «Perché?» resta, e resta obbligatorio.

⚠️ **Le due colonne del database non sono state toccate**:
`discounts_gifts.device_id` e `customer_id` esistono ancora, restano
compilabili dal registro manuale in Cassa (che il mandato non nomina, e
infatti è invariato), e da qui arrivano **vuote** — che è ciò che
succedeva ogni volta che nessuno le sceglieva.

✅ **Provato col payload che la finestra manda adesso**, passando dal
corridoio: conto aperto su T1, riga aggiunta, chiuso come omaggio con
causale «Cortesia». Il conto è passato a `omaggiato`, la riga in
`discounts_gifts` è stata scritta con la sua causale, e `customer_id` e
`device_id` sono nulli.

🔴 **E in quella pulizia ho fatto un danno, riparato.** Il mio comando
cancellava «l'ultima riga di `discounts_gifts`» invece di **quella che
aveva creato lui**: ha tolto uno sconto vero dello scenario
(`BASE-registrato a mano in cassa`, 112,83 → 83,94 del 25/07). Rimesso
identico dalla copia conservata nel registro delle cancellazioni, e la
lapide tolta. Controllato dopo: **10 sconti/omaggi**, luglio **2 sconti
per 159,02**, esattamente com'era. ⚠️ Nessun conto lo nominava, quindi
nessun altro numero si è mosso — ma la chiave esterna è `on delete set
null`, quindi se uno l'avesse nominato il collegamento sarebbe sparito in
silenzio. *È la regola del 16/08 letta al contrario: il perimetro di una
prova dev'essere fatto di roba che la prova ha creato.*

---

## Blocco 5 — Il cliente pagante associato al tavolo

**Fatto.** Migrazione `20260823000020`, operazione nuova nel corridoio,
`orders.customer_id`.

**La regola, nel verso in cui l'ha data Alessio**: il tavolo si associa al
cliente **pagante**, che sia quello della prenotazione o no. Prenota
Tizio e paga Caio: il tavolo va a Caio, la prenotazione resta quello che
era.

⚠️ **Non è un riflesso**, e il discriminante del 17/08 dice perché: un
riflesso è una colonna che direbbe *esattamente* la stessa cosa di
un'altra. Qui «chi ha prenotato» e «chi paga» sono due domande con due
risposte. Il cliente della prenotazione è solo il valore di **partenza**,
messo dal database quando il conto si apre.

⚠️ **Le 348 righe già scritte restano vuote.** Riempirle dalla
prenotazione sarebbe una risposta data da me al posto di chi era in sala
(lezione del 14/08).

🔴 **La trappola che la chiave esterna apriva, chiusa nella stessa
migrazione.** `pulisci_richieste_scadute()` gira alle 4:30 e cancella i
clienti rimasti senza storia: guardava `reservations` e
`discounts_gifts`. Con `on delete restrict`, **il primo cliente che avesse
pagato un conto avrebbe fatto fallire il lavoro intero**, portandosi via
anche le cancellazioni legittime — e per sei mesi non l'avrebbe visto
nessuno. È la stessa forma del 18/08, e la regola generale è: *ogni chiave
esterna nuova verso una tabella che qualcuno ripulisce è un potenziale
blocco di quella pulizia.*

⚠️ **Un numero già in anagrafica riusa la scheda**, non ne crea una
seconda — e il nome scritto di fretta stasera non sovrascrive quello
scritto a giugno. **In una sola istruzione**, perché il telefono è unico
e fra una lettura e una scrittura ci stanno i millisecondi in cui l'altro
tablet arriva primo (la stessa corsa che ha prodotto i doppioni della
lista della spesa).

**I due corpi di funzione sono presi vivi dal database**, montati da un
comando invece che ricopiati a mano. È la prima migrazione che passa
sotto la rete del Blocco 1, e non ha perso niente.

✅ **Provato con le mani sulla sala vera**: T1 aperto con la prenotazione
«19:30 · 4 · BASE-Famiglia Grasso», agganciato un cliente **diverso**
cercandolo per nome, staccato, poi registrato uno nuovo con nome e
numero. Il riquadro accanto al tavolo ha mostrato tutte e tre le volte
**chi ha prenotato e chi paga**.

🔴 **E il riquadro, col conto aperto, prima spariva** — misurato: l'unico
posto dove restava il nome era un paragrafo a **3136 punti dall'alto**,
cioè sotto tutto il menu. Stessa forma del difetto del 21/08.

⚠️ **Misura che resta una decisione di Alessio**: sul mini tablet quel
riquadro è **53,8 × 25,1 mm** e il contenuto ne chiede di più — **scorre**.
Tutto il testo sta a 3,20 mm e i bersagli a 8,50, ma non si vede tutto
insieme. Allargarlo davvero vuol dire portarlo **fuori dalla pianta**, e
quella è una scelta sua: il riquadro sta lì perché la sua geometria è la
zona «Bancone» del fondale (240 × 515 cm), scelta il 21/08 perché è dove
il pollice arriva senza spostare la presa.

⚠️ **Due reti già in casa hanno fermato il commit**: la ricerca dei
suggerimenti ingoiava un guasto senza dirlo, e l'elenco dei silenzi
dichiarati è chiuso apposta — uno nuovo si aggiunge a mano, con la
ragione scritta.

**Prove**: 7 sul progetto di prova che entrano **dal corridoio** (una
dimenticanza nell'elenco risponde 404 e nessuna prova SQL se ne accorge).
Rotta apposta la regola dei doppioni, 4 diventano rosse; rimessa,
tornano verdi.

---

## Blocco 6 — Dalla scheda del fornitore alle sue fatture

**Fatto, nessuna migrazione.** Accanto a «Consegne recenti» c'è «Le sue
fatture →», che porta all'elenco già filtrato su di lui.

⚠️ **L'elenco non si rifà**: esiste già in Fatture Fornitori coi suoi
totali, le note di credito e i pagamenti. Mancava **la porta** — e una
porta mancante è il difetto che il 20/08 ha tenuto i Preventivi
irraggiungibili per giorni. «Consegne recenti» resta dov'è: risponde a
un'altra domanda.

⚠️ Il filtro arriva dall'indirizzo e si legge **solo all'apertura**: dopo
comanda chi tocca i filtri.

✅ **Provato** sulla scheda di BASE-Ittica dello Stretto: il collegamento
porta all'elenco col fornitore già scelto, e la schermata **dichiara da
sé** di essere parziale — «4 di 11 da pagare — i totali in alto restano
quelli interi» — col pulsante per togliere il filtro. Bersaglio 24,5 ×
8,5 mm, testo 3,20 mm.

---

## Blocco 7 — SALTATO (con la ragione), meno la porta che mancava

**La schermata Scadenze NON è rimasta indietro.** La differenza è una
**decisione presa ieri**, scritta in cima a `Fermi.jsx`:

> «pagina sua e non una sezione dello scadenziario: lì le risposte sono
> due e stanno in una riga; qui sono sei, e tre chiedono qualcosa. Sei
> pulsanti su ogni riga di un elenco sono un elenco che non si legge più.»

Sulla prova le righe da guardare in Scadenze sono **65**: è esattamente il
caso che quella decisione difende. Portare le sei risposte lì
**rovescerebbe** una decisione di ieri, e non è una scelta da prendere
senza Alessio. Quindi: **non allineata**.

🔴 **E i pulsanti rispondono** — misurato, non dedotto: «Finita» e
«Buttata» sono **abilitati**, 38,3 e 43,1 mm di larghezza per 9,1 di
altezza, con il tocco attivo. *Non sembrano* cliccabili, ma lo sono: è un
giudizio sull'aspetto, e quello resta suo.

**Fatta invece la porta che mancava.** Chi arriva alle Scadenze con in
mano una partita che non è né finita né buttata — l'ha abbattuta,
trasformata, la rende al fornitore — non aveva **nessuna** strada: «Fermi
da troppo» rimandava alle scadenze, e le scadenze non rimandavano niente.
Collegamento nuovo, 93,2 × 8,5 mm.

---

## Blocco 8 — La spesa spicciola

**Fatto.** Migrazione `20260823000021`, tabella `spesa_spicciola`,
schermata `/magazzino/spesa-spicciola`, raggiungibile dal Magazzino
accanto alla Lista della spesa.

⚠️ **Non si collega a niente**, come chiesto: niente soglie, niente
ordini, niente giacenze, nessun costo, nessun totale. **Solo testo**:
nessun riferimento al catalogo degli ingredienti, perché un collegamento
sarebbe la prima crepa da cui torna il magazzino.

⚠️ **E niente `entity_id`**, che qui è una scelta: ogni tabella
economicamente rilevante ne ha uno, e qui non passa un euro. Metterlo
sarebbe un campo che nessun calcolo legge.

🔴 **Le categorie sono sue, non mie**: testo libero, con quelle già usate
proposte accanto. Un elenco chiuso scritto da me — «pulizia»,
«cancelleria» — sarebbe una regola scritta sulle sue cose, e il giorno che
ne servisse una nuova vorrebbe una migrazione per aggiungere una parola.
Stessa forma delle causali di cassa.

⚠️ **«Sparisce dall'elenco» non vuol dire cancellato**: l'articolo toccato
passa fra le cose prese, e da lì torna in lista con un tocco. Davanti allo
scaffale si tocca per sbaglio, e un gesto che si può solo fare e mai
disfare è un vicolo cieco.

✅ **Provato con le mani**: quattro articoli in tre categorie, il
raggruppamento tiene, «Senza categoria» va in fondo, la categoria resta
scritta fra un articolo e l'altro. Toccato «Sacchetti spazzatura»: sparito
dall'elenco, comparso in «Nel carrello (1)», il conteggio della sua
categoria sceso da 2 a 1. Ritoccato: tornato al suo posto. Righe di prova
cancellate, ne restano **zero**.

**Misure** alla calibrazione del mini tablet: nessun elemento sotto i 3,20
mm di testo o gli 8,50 di bersaglio, riga da 177,8 × 10,5 mm, nessuno
scorrimento orizzontale.

🔴 **La prova sui permessi è diventata rossa da sola** nominando
`spesa_spicciola_preso_il`: anche una funzione **trigger** nasce
eseguibile da chiunque abbia la chiave pubblica. Fuori da un trigger non
girerebbe comunque, quindi non usciva nessun dato — ma l'elenco di chi può
bussare da fuori non deve crescere in silenzio. Curata con la **revoca**,
non aggiungendola all'elenco atteso, e la verifica della migrazione ora lo
controlla da sé.

---

## Cosa abbiamo rovesciato

**Una cosa sola.**

- **Cosa era stato deciso e quando**: il paragrafo sotto il saldo in Cassa
  (cosa comprende il contante atteso, quanto è mancia, quando è stato
  contato il cassetto l'ultima volta), e la sezione «Movimenti recenti».
- **La ragione di allora**: un numero che si spiega da sé vale più di un
  numero nudo, e la scomposizione era nata il 16/08 proprio perché senza
  una voce (le mance) il totale **smetteva di sommare** — un numero e la
  sua spiegazione che non tornano sono la famiglia di difetti che questo
  progetto combatte apposta.
- **Cosa si decide adesso**: tolti tutti e due, per decisione esplicita di
  Alessio.
- **Perché la ragione di allora non vale più — oppure vale e questo è il
  prezzo**: ⚠️ **vale ancora, e il prezzo lo accettiamo**. Quelle righe
  erano rivolte a chi non sapeva, e chi guarda questa schermata oggi è chi
  ha scritto quelle regole. Il prezzo è dichiarato: il giorno in cui la
  Cassa la guarderà una persona diversa da lui, la scomposizione va
  rimessa. **Non è sparita del tutto**: l'ultimo conteggio del cassetto sta
  in «Il cassetto», e le due righe che sono **avvisi** e non spiegazioni —
  «di cui non sono tuoi» e le uscite non ancora nel saldo — sono rimaste,
  perché senza di quelle il numero grande avrebbe l'aria di essere completo
  senza esserlo.

Registrato anche in [`docs/decisioni_rovesciate.md`](../decisioni_rovesciate.md).

---

## Cosa NON è verificato

- **Nessuna mano vera ha toccato niente**: tutto ciò che è marcato
  «provato con le mani» è stato fatto **da qui**, guidando il browser sul
  progetto di prova. Il tablet vero non ha visto nessuna di queste
  schermate.
- **Il riquadro del cliente pagante non è mai stato guardato da un occhio
  umano su uno schermo da 8 pollici**: le misure dicono che scorre, non
  dicono se in servizio è comodo.
- **La produzione non ha niente di tutto questo** e non è stata toccata:
  172 migrazioni, nessuna colonna `orders.customer_id`, nessuna tabella
  `spesa_spicciola`.
- **La rete del Blocco 1 non ha ancora fermato nessuna migrazione vera**
  scritta da qualcun altro: l'ha fermata solo quando le si è messo davanti
  un caso rotto apposta e il caso storico del 23/08.
- **Il corridoio v22 è solo sulla prova**: in produzione va installato
  insieme alla migrazione `…020`, altrimenti l'operazione nuova risponde
  404 e il riquadro del cliente non scrive niente.

---

## Cosa aspetta il via libera di Alessio

1. **`20260823000020_il_cliente_del_tavolo.sql`** — aggiunge
   `orders.customer_id` (vuota su tutte le righe esistenti), riscrive
   `apri_conto` e `pulisci_richieste_scadute`, crea
   `assegna_cliente_conto`. **Non cancella e non modifica nessun dato.**
2. **`20260823000021_la_spesa_spicciola.sql`** — crea la tabella nuova.
   **Non tocca niente di esistente.**
3. **L'installazione del corridoio `operazioni-atomiche` in produzione**,
   che va fatta **insieme** alla prima migrazione.
4. Più le **19 migrazioni del 23/08 già in attesa** dalla sessione
   precedente, che restano dove sono.
