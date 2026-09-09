# MEMO operativo — Agenda: scegliere col dito quale impegno

**09/09/2026.** Riepilogo di consegna.

* **HEAD dichiarato**: `27db928` — l'unico commit di lavoro (questo riepilogo e' il commit sopra, ed e' sola documentazione).
* **Ramo**: `agenda-scelta-candidato`, che parte dalla cima della **#45**
  (`agenda-riconosce-impegno`, `4fd6ce1`) e quindi contiene anche la **#42**,
  la **#43** e la **#44**. ⚠️ **Nessuna delle quattro è stata toccata, unita
  o pubblicata.**
* **Migrazioni**: **una**, `20260909000004_agenda_scegliere_il_candidato`.
  **Applicata solo a Borgo58-Prova** (384 migrazioni registrate lì).
  In produzione non è stato applicato niente.
* **Funzioni online**: **nessuna installata.** Questo lavoro non tocca
  `ascolta-voce`: tutto vive nel database e nella schermata.
* **Chiamate live al modello**: **ZERO**, e la rete che le tiene fuori dai
  controlli automatici è quella costruita nella #45.

## Dov'era il vicolo cieco

La #45 fa la cosa giusta: con due impegni ugualmente plausibili non sceglie,
non si approva, e l'appunto **dice quali sono** col loro giorno. Ma restavano
**una cosa da leggere**, e l'unica via d'uscita era **ridire la frase più
precisa**.

🔴 **Davanti a due righe sullo schermo, il gesto naturale è toccarne una** — ed
era proprio quello che non funzionava. *Una schermata che mostra una scelta e
non la fa fare è un vicolo cieco con le indicazioni scritte bene.*

## La regola che non si tocca

🔴 **Il tocco SCEGLIE e basta: non scrive, non chiude, non sposta.** Fra il
dito e l'Agenda c'è sempre «Approva», e solo «Approva» esegue.

Non è una precauzione in più: è la regola di SPEC-0013, e vale già per
prodotti, frigoriferi e pulizie. *Una firma su una cosa che si è appena
toccata non è una firma.*

| stato | cosa si vede |
|---|---|
| due o più candidati | i pulsanti, **niente «Approva»** |
| toccato uno | «Hai scelto: «X»» e **compare «Approva»** |
| approvato | solo quell'impegno cambia; gli altri restano aperti |
| un candidato solo | **identico alla #45** — nessun pulsante, «Approva» subito |
| nessun candidato | **identico alla #45** — non approvabile |

## Non si costruisce una strada nuova

⚠️ Il meccanismo «questa riga non sa QUALE cosa sia, ecco i candidati da
toccare» **esiste da SPEC-0013**: `azione_scelte` produce i pulsanti,
`scegli_per_azione_dettata` riempie il campo e lascia lì l'appunto. L'Agenda
ci entra dentro. Una seconda strada per la stessa cosa sono due definizioni
che un giorno diranno l'una il contrario dell'altra.

Le tre cose che cambiano, tutte nel database:

1. **i candidati portano il loro identificativo** — senza, non c'è niente da
   toccare, e la sua assenza non darebbe nessun errore: darebbe un elenco che
   non risponde al dito;
2. **`azione_scelte` sa costruire i pulsanti per l'Agenda**, e **non offre un
   impegno che nel frattempo è stato chiuso** — fra l'appunto e il dito
   passano ore, e proporre una cosa che l'approvazione poi rifiuta sarebbe un
   vicolo cieco costruito da noi;
3. **scegliere riporta la riga a essere il gesto che era.** 🔴 Senza questa
   riga si sarebbe scelto l'impegno giusto e **«Approva» non sarebbe comparso
   mai**: un impegno ambiguo era diventato `agenda_quale_impegno`, che nel
   catalogo non c'è, cioè non approvabile *per costruzione*. Era una strada a
   senso unico.

## Il difetto silenzioso che stava in mezzo

🔴 **La fotografia del titolo si riconosce da `data_precedente`, non da
`task_id`.** Scegliendo col dito, `task_id` arriva **prima** che il titolo
vero sia stato fotografato: con la condizione di prima (*«non c'è ancora un
task_id»*) la riga scelta sarebbe rimasta col titolo **sentito**
(«commercialista»), e l'esecuzione l'avrebbe respinta dicendo che l'impegno
*«adesso si chiama Andare dal commercialista»*.

⚠️ **Un rifiuto giusto su un fatto falso**, cioè il modo peggiore di
fallire: il messaggio accusa un cambiamento che non c'è stato, e chi lo legge
va a cercare in Agenda una modifica che nessuno ha fatto. `data_precedente` è
la firma della fotografia — la scrive solo quel ramo, e la scrive **sempre**,
anche vuota quando l'impegno non ha scadenza.

## Quando due candidati si leggerebbero uguali

⚠️ Stesso nome e stesso giorno: due righe gemelle offerte come una scelta
fanno **tirare a sorte credendo di decidere**. Si cerca allora il **primo
campo che li distingue davvero** e lo si mostra accanto, uno solo per tutti:

| ordine | campo | perché lì |
|---|---|---|
| 1 | descrizione | dice **cos'è** |
| 2 | ora | dice **quando** |
| 3 | categoria | dice **dove sta** |
| 4 | «aggiunto il …» | distingue sempre, e spiega poco: è l'ultima spiaggia |

🔴 **E se nessuno li distingue, si dichiara**: «Da qui non riesco a
distinguerli… se non sei sicuro, aprili in Agenda prima di scegliere». I
pulsanti restano — lui può saperlo — ma non si finge che l'elenco basti. È la
famiglia dell'elenco vuoto che si legge «non c'è niente».

## Il bersaglio del dito, misurato

Il mandato chiede almeno **44×44 punti**. Misurato nel browser sul server di
prova, alla larghezza vera di un telefono (390 punti), a tre densità:

| densità | altezza | in millimetri | sbordo |
|---|---|---|---|
| monitor (37,8) | **76 × 226 pt** | 20,1 mm | 0 |
| tablet 7,9" (64) | **76 × 226 pt** | 11,9 mm | 0 |
| tablet 8,3" (59,5) | **76 × 226 pt** | 12,8 mm | 0 |

⚠️ **Qui, unico posto del progetto, accanto alla misura in centimetri veri c'è
un pavimento in PUNTI** (`.tocco-scelta`: `max(44px, 1,05cm)`). Non è un
ripensamento sulla regola *«mai dimensionare un target in pixel»*: 1,05 cm su
un monitor fanno **39,7 punti**, cioè sotto la soglia del tocco, mentre su un
telefono la stessa classe ne fa già 67. Il centimetro resta l'unità del
disegno; il punto è solo il fondo sotto cui non si scende.

## Guardato con gli occhi, non solo misurato

✅ **Aperto nel browser sul progetto di prova, col caso vero del mandato**
(«Segna come fatto il commercialista», due impegni aperti in Agenda):

* i due pulsanti compaiono con **titolo e giorno** — «Andare dal
  commercialista — 28/08/2026», «Passare dal commercialista — 28/08/2026»;
* prima del tocco: **«Non c'è niente da approvare»**;
* toccato «Andare dal commercialista»: compare **«Hai scelto: Andare dal
  commercialista»**, compare **«Approva»**, e i due pulsanti spariscono;
* 🔴 **e in Agenda non è cambiato niente**: constatato nel database subito
  dopo il tocco, tutti e due gli impegni ancora `da_fare`.

⚠️ **«Approva» non è stato premuto**: avrebbe chiuso un impegno vero del
progetto di prova, che è precisamente il gesto lasciato al collaudo di
Alessio.

## Cosa abbiamo rovesciato

**Uno, ed è registrato**: [n. 83](../decisioni_rovesciate.md) — *«i candidati
si mostrano, e non si toccano»*, deciso nella #45 poche ore prima.

⚠️ **Era giusta sul pericolo e sbagliata sul rimedio.** Il pericolo — *nessuno
deve poter approvare un'ambiguità* — è vero e resta chiuso. Ma legava due
cose diverse: «non approvabile» e «non toccabile». Scegliendo, l'ambiguità
**smette di esistere**. Il pericolo si chiude dove sta davvero — *il tocco non
scrive* — invece che togliendo il gesto.

## Le prove, e cosa dimostrano

* **Contro il progetto di prova** (`tests/app/agenda-scelta-candidato.test.js`,
  9): **il caso del mandato per intero** (due candidati → tocco → solo quello
  diventa approvabile → dopo «Approva» solo quello è fatto, l'altro resta
  aperto); senza scegliere non si approva e in Agenda non cambia niente; **non
  si può far scegliere un impegno che non era stato proposto** (senza quel
  controllo si chiuderebbe qualsiasi riga passandone l'identificativo dal
  browser); chiuso o rinominato fra la scelta e il sì → rifiuto senza
  scrivere; due gemelli → dichiarati, e nessuno sceglie da solo; candidato
  unico e nessun candidato → invariati; **spostare** → la data nuova arriva
  solo dopo il sì, e solo a quello scelto.
* **Sulla schermata** (`tests/schermate/appunto-agenda.test.jsx`, 8 nuove su
  26): ogni candidato è un pulsante col titolo e il giorno; finché non si
  sceglie «Approva» non c'è; **toccare chiama chi sceglie, non chi approva**;
  con più di due non dice «dei due»; i gemelli si dichiarano; dopo la scelta
  si vede quale; **sul candidato unico «hai scelto» non compare** — nessuno ha
  scelto.
* **Pure** (`tests/unita/appunti-scelta.test.js`, 9): le due dichiarazioni si
  leggono, non compaiono fra i dati che verrebbero scritti, e **il segno della
  scelta dev'essere proprio `true`** — non «qualcosa di vero».
* **Dentro la migrazione** (9 controlli): i candidati portano
  l'identificativo, il dettaglio compare **solo quando serve** ed è il primo
  che distingue davvero, i gemelli si dichiarano, scegliere riporta il gesto e
  fotografa titolo e giorno di partenza, un candidato chiuso non si offre più,
  e **una riga che non sa nemmeno che gesto sia non si tocca**.

## Un errore mio, trovato dalle prove

⚠️ I titoli dei primi dati di prova mettevano il marchio **davanti** e le
parole cercate **in mezzo**: «marchio commercialistax» non è contenuto in
«marchio andarex dal commercialistax», perché il confronto guarda una porzione
**contigua**. Sette prove su nove sono partite rosse per un difetto dei dati,
non del codice. *Un dato di prova costruito male somiglia in tutto a un
difetto vero.*

## Cosa NON è verificato

* 🔴 **Nessuna frase è stata dettata davvero.** Il mandato vieta le chiamate al
  modello: la classificazione è esercitata con `destinazioneAgenda`, che è
  codice nostro e deterministico. Il pezzo scoperto resta lo stesso della
  #45 — che il modello, sentendo la frase, metta in `impegno` il nome nudo.
* ⚠️ **Gli appunti nati PRIMA di questa migrazione non hanno i pulsanti.** I
  loro candidati sono stati scritti dalla #45, che non metteva
  l'identificativo: la schermata torna a mostrarli **in sola lettura**, con la
  via d'uscita di prima. È il ripiego voluto — visto succedere sul progetto di
  prova — e si risolve buttando l'appunto e ridicendo la frase.
* ⚠️ **Il nome sul pulsante è quello fotografato quando l'appunto è nato**: se
  l'impegno viene rinominato dopo, il pulsante mostra il nome vecchio. Toccarlo
  sceglie comunque la riga giusta, e l'esecuzione confronta il nome **di
  adesso** — quindi il rischio è di leggibilità, non di scrittura.
* ⚠️ **Colori e contrasto con le luci del locale** non li ha visti nessuno: le
  misure vengono dal DOM.
* ⚠️ **Niente è stato applicato alla produzione.**
