# La notte del backup, del freno e delle otto sezioni — 30/08/2026

**Commit che sta sotto**: `ececaa80bb4a40b752d5ceeaccac828ba40520fe`
(«L archivio a sezioni, e il vocabolario che arriva anche al modello»).
**Working tree pulito** a meno di questo documento.

**Quattro commit**, in ordine:

| | |
|---|---|
| `afa6520` | Il sesto freno: niente migrazioni su un backup vecchio (blocchi 0-4) |
| `8d33da9` | Il telaio dell'orologio, e il vino che torna nell'elenco (blocchi 5-6) |
| `b568c86` | La tasca di Alessio (blocco 7) |
| `ececaa8` | L'archivio a sezioni (blocco 8) |

**Migrazioni nuove**: `20260830000012` (la tasca) e `20260830000013`
(l'archivio a sezioni). Applicate al progetto di prova, che ha **356**
migrazioni registrate. Nel gestionale vero, misurato alle 22:05 del 30/08:
**354 migrazioni, ultima `20260830000011`**, e le due nuove non ci sono.

⚠️ **I riepiloghi di dettaglio sono file loro**, e questo li elenca invece di
ripeterli:
[le tre versioni scritte per intero](20260830_le_tre_versioni_scritte_per_intero.md) ·
[la tasca di Alessio](20260830_la_tasca_di_alessio.md) ·
[l'archivio a sezioni](20260830_l_archivio_a_sezioni.md).

---

## Blocco 0 — Il backup, poi le migrazioni

**Prima cosa fatta della notte, prima di toccare qualunque cosa**: il push è
stato **verificato con una misura**, non creduto — `git fetch` e poi
`origin/master` confrontato con `HEAD` (uguali, `9e345b4`), working tree
vuoto.

**Il backup del gestionale vero**: 126 tabelle, **979 righe**, 4 utenti,
`Borgo58_backup_2026-08-30_2059.zip` (342 KB).

🔴 **E poi è stato DIMOSTRATO che si ricarica**, che è la parte che il
mandato chiedeva: rimesso su dentro un database **usa-e-getta** creato per
l'occasione e poi buttato — **126 tabelle su 126**, **979 righe su 979**, **4
utenti con la password e 4 col ruolo ritrovato**, zero errori non previsti.
Né la produzione né il progetto di prova sono stati toccati.
⚠️ *Un file generato non è un backup: è un file.*

🔴 **LA RETE DEI RIEPILOGHI HA FERMATO L'APPLICAZIONE**, nominando tre
migrazioni scoperte. Non erano dimenticate: il riepilogo dei sette blocchi le
nomina in forma **abbreviata** («…009, …010, …011»), che è precisamente la
forma che quella rete avverte di non usare. Scritto un riepilogo arretrato che
le nomina per intero — **senza riscrivere** quello già su GitHub.

**Poi le quattro migrazioni in attesa sono entrate in produzione**: da 350 a
**354**, ultima `20260830000011`. Letto dal database, non dal messaggio del
comando. Residui misurati subito dopo: **0 lapidi, 0 conti, 0 movimenti, 0
documenti**.

## Blocco 4 — Il sesto freno

`npm run migra` **si rifiuta di toccare il gestionale vero se l'ultimo backup
ha più di 24 ore**. La decisione del 23/08 esisteva come regola scritta ed è
stata scavalcata proprio il 30/08.

⚠️ **Il limite è dichiarato dentro il rifiuto stesso**: il comando sa
**quando** è stata fatta la copia. **Non sa** che sia stata portata fuori dal
computer, **né** che il ripristino sia stato provato. Due metà su tre restano
di Alessio, e il rifiuto lo dice a voce alta invece di lasciarlo sottinteso.

⚠️ Una copia **recente ma incompleta non vale**, e il *quando* si legge dal
**nome** della cartella — che resta vero su una chiavetta, mentre la data del
file no. **Il freno viene prima degli altri cinque**: protegge i dati ed è il
più rapido da soddisfare.

✅ **Provato con due rotture su controlli diversi** (una prova rossa contro
due, e nessuna delle due è la prima), **più il freno esercitato dentro `npm
run migra`** e non solo nelle sue funzioni.
🔴 **Ed esercitarlo ha trovato un difetto che rileggerlo non aveva trovato**:
la riga di riscontro stampava «`undefined` ore fa».

## Blocchi 1, 2, 3 — Le decisioni, le richieste, i quesiti

**Sette decisioni** di oggi scritte in `DECISIONI.md`: la copia vero → prova a
**direzione unica** e impedita nell'altro verso, l'allineamento **come prova
del backup**, il reset di tutti e due a fine collaudo, il volume che una prova
**si costruisce e butta**, la verifica che **annulla invece di cancellare**, la
tasca come terzo soggetto, e le nove schermate larghe **col loro perché
accanto**.

⚠️ **Sull'ultima il mandato diceva «sette non sono guarite» e la fonte ne dice
SEI**: il censimento del 30/08 nomina sette sparite di cui **una curata
davvero** (il Magazzino). Scritto sei, perché è quello che la misura dice.

**Sette richieste nuove** in `RICHIESTE.md` (il pulsante «fattura» in Comande,
la chiusura dell'anno, il pacchetto per la commercialista, il caricamento dei
soli ricavi, il registratore telematico che sale di priorità, l'archivio a
sezioni, la tasca), più **G8 chiusa con la diagnosi accanto** invece che
cancellata. Il conteggio è rigenerato: **71 richieste, 26 aperte**.

**Quattro quesiti** per la commercialista (`L19`-`L22`), senza importi. Laura
passa da 18 a **22** domande.

🔴 **`conti_senza_documento`: la premessa reggeva a metà, e la metà che cade
cambia la cura.** Non ha il portiere nel corpo — vero, misurato. **Ma non è
scoperta**: nessun ruolo la può eseguire (`anon` no, `authenticated` no,
`service_role` no), e le due sole funzioni che la chiamano hanno **entrambe**
il portiere. È la cura (a) della regola del 27/08: *nessun utente → si chiude
la porta, e non serve nessun portiere*. **La porta era già chiusa: nessuna
modifica.**

## Blocco 5 — Il telaio dell'orologio

Sbloccato dalla sua risposta: apre **dall'icona**. ⚠️ **Il difetto era
doppio**, e la seconda metà era invisibile: lo stacco che la barra del pollice
metteva in fondo con `env(safe-area-inset-bottom)` valeva **zero**, perché
mancava `viewport-fit=cover`.

**Cercato il telaio, non i due casi**: sta su `#root`, non sul `Layout` —
altrimenti resterebbero fuori le tre schermate che si vedono per prime
aprendo dall'icona. E la misura **non si sceglie**: è quella che dichiara il
sistema, quindi vale **zero** dove non c'è niente da evitare.

✅ **Misurato a 390 punti su due gusci diversi**, con un orologio finto da 47
punti: il titolo passa da **160 a 207** (47 esatti), il logo comincia a **87**
— 40 punti sotto la fine dell'orologio — il guscio da **844 a 797**, e senza
orologio finto **padding zero e nessuno scorrimento in più**.

## Blocco 6 — Il vino negli scarichi mancati

Le bevande **collegate** entrano nell'elenco come tutto il resto, quelle **non
collegate** restano fuori. ✅ **Misurato dentro una transazione annullata**: la
collegata senza giacenza produce **1** riga di anomalia col nome del prodotto,
la non collegata **0**, e dopo l'annullamento **zero** residui.

⚠️ **Il codice era già così** dalla migrazione `20260830000002`: a restare
indietro era **la frase**. Riscritta **senza cancellare la vecchia**, col
[rovesciamento n. 73](../decisioni_rovesciate.md) accanto.

## Blocchi 7 e 8

Nei loro riepiloghi. In breve: **la tasca** è un terzo soggetto che registra
**solo uscite**, è **sempre indeducibile** e sta **fuori dalla proiezione per
costruzione** — tre regole nel database, non nella schermata. **L'archivio**
ha otto sezioni e un vocabolario chiuso, e chiuderlo ha richiesto di chiudere
**anche la porta della posta**, che avrebbe smesso di funzionare.

---

## Cosa abbiamo rovesciato

**Due cose, e nessuna delle due è una decisione di Alessio.**

**1. Il vino negli scarichi mancati** — è la sua, ed è nel rovesciamento n. 73
con la ragione: *è cambiato il mondo, non l'opinione*. Per le bevande non
collegate la ragione del 23/08 **vale intera, ed è il prezzo che accettiamo**.

**2. Una mia deviazione, rientrata.** Avevo cominciato a costruire nella rete
delle frasi una via d'uscita — «se la riga porta una data, lasciala stare» —
e **l'ho tolta**: quella rete ha già una prova che dice il contrario, e per
una migrazione che si può *nominare* il gestionale una risposta ce l'ha.
La cura è stata **togliere la frase**, non zittire la rete.
⚠️ *Vale anche quando la strada che si sta prendendo sembra più prudente —
anzi soprattutto allora.*

---

## LA RILETTURA

### Cosa NON ho verificato con gli occhi

* 🔴 **NESSUNA SCHERMATA CHE RICHIEDE DI ENTRARE È STATA APERTA.** Per aprirle
  serve un PIN, e ho scelto di non digitarne nessuno: quello di collaudo
  finirebbe scritto nel resoconto. Quindi **non li ha guardati nessuno**: il
  menu a tre soggetti della Prima nota, la frase che spiega la tasca,
  l'archivio diviso in sezioni, il menu a otto voci, la riga «(non si usa
  più)», e il menu delle sezioni nella posta.
* **Il riquadro del browser rende la pagina quadruplicata**: lo screenshot
  *funziona* in questo ambiente (CLAUDE.md dice il contrario per le sessioni
  passate, e su questo è **superato**), ma non è un misuratore affidabile per
  la disposizione. Tutte le misure del blocco 5 vengono **dal DOM**.
* **Il telaio non è mai stato visto su un telefono vero**, che è l'unico posto
  dove esiste un orologio da evitare. L'orologio della misura è **finto**.

### Cosa ho contato senza leggerlo

* **Le 47 funzioni che filtrano per soggetto**: contate cercando `p_entity`
  nei corpi vivi, non lette una per una. Serviva a sapere se un impianto
  parallelo fosse evitabile, e per quello basta.
* **Le 19 schermate che chiamano `getEntities`**: contate da un elenco di
  file, non aperte. L'affermazione che ne discende — che non possono offrire
  la tasca — regge però su una **proprietà del codice** (i soggetti si
  chiedono per nome), non sul conteggio.
* **Le 9 sezioni conservate spente**: le ha contate la migrazione e le ha
  dichiarate; non le ho lette una per una.

### Quali mie affermazioni sono diventate false mentre lavoravo

* 🔴 **«I fine riga misti hanno fatto fallire la sostituzione»** — falso, e
  l'ho scritto prima di misurarlo. Il file aveva **CRLF = 0**: la causa vera
  era l'**escaping della shell** su `\n` dentro la stringa che cercavo. La
  cura ha funzionato lo stesso, ma per un'altra ragione.
* 🔴 **«Le tre rotture del blocco 8 hanno provato tre controlli»** — falso al
  primo giro: due cadevano sul **primo** guardiano, perché non avevo rimesso
  il legame. Tre errori identici che sembravano tre conferme. Rifatte.
* **«`e_una_tasca` va concessa alle schermate del titolare»**: scritto nella
  migrazione e diventato falso mezz'ora dopo — nessuna schermata la chiama, e
  la rete dei permessi l'ha nominata. La porta è stata chiusa.
* **«Il riepilogo di C10 dice che la migrazione non è ancora in produzione»**:
  vero quando l'ho scritto, e tolto perché quella frase **non si scrive a
  mano**.

### Quali blocchi non ho aperto

**Nessuno: tutti e otto sono stati aperti e chiusi.**

### Quali conteggi sono pavimenti e non censimenti

* **Le 71 richieste**: sono quelle **scritte**. Quelle dette solo a voce non
  ci sono, e non c'è modo di sapere quante siano.
* **Le 9 sezioni spente**: sono i valori presenti **sul progetto di prova**.
  In produzione i documenti sono zero, quindi lì la sanatoria non conserverà
  niente — e se un giorno l'archivio vero avesse valori diversi, ne
  conserverebbe altri.
* **Le 22 domande per Laura**: quelle raccolte nel file, non tutte quelle che
  un commercialista potrebbe volersi sentire fare.
* **Le 6 schermate che misurano zero su dati magri**: contate dal censimento
  del 30/08, che a sua volta guarda le **71 rotte senza parametri** — le
  schermate che si aprono solo con qualcosa dentro non sono state aperte.

### Il backup è stato portato fuori dal computer?

🔴 **No, e non posso saperlo: quella metà resta ad Alessio.** Il file è
`C:\Users\User\Desktop\Backup Borgo 58\Borgo58_backup_2026-08-30_2059.zip`
(342 KB) e va copiato su una chiavetta, un disco esterno o un cloud personale.
**Quello che ho potuto fare l'ho fatto e l'ho misurato**: generarlo e
dimostrare che si ricarica. **Quello che non posso fare non lo dichiaro
fatto** — ed è per questo che il freno nuovo, nel suo rifiuto, dice a voce
alta che sa solo *quando* è stata fatta la copia.
