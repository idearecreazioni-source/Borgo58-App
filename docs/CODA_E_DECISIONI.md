# La coda dei lavori e le decisioni ancora aperte

> ⚠️ **Questo elenco non è un promemoria di comodo: è l'unico posto dove queste
> voci esistono, e una voce tolta di qui è una voce persa. Chi chiude una voce
> la sposta con la data e la ragione, non la cancella.**

**Perché esiste.** Il repository conserva già le consegne, i mandati, il
[registro dei rovesciamenti](decisioni_rovesciate.md), gli appunti di progetto,
il [Contratto](CONTRATTO.md), le [annotazioni del collaudo](collaudo/annotazioni.md)
e i [quesiti per i consulenti](quesiti/). Due cose invece vivevano **solo nelle
chat**, e con la loro cancellazione sarebbero sparite: la coda dei lavori e le
decisioni di Alessio ancora aperte.

**Il suo compito.** Questo file è il posto dove la coda vive, e **va aggiornato
alla fine di ogni giro** — non ci sarà più una chat da rileggere.

---

## La coda dei lavori, nell'ordine deciso

1. **La colonna «arrivati N di M» sulla lista della spesa** — comportamento già
   deciso, resta da fare.
2. **La lista della spesa** — mandato
   [`20260817_la_lista_non_scrive_uscite.md`](mandati/20260817_la_lista_non_scrive_uscite.md).
3. **Il controllo che guarda la forma invece del comportamento**: funzioni
   riscritte mai chiamate da una verifica, i 33 posti dove un campo dimenticato
   sbaglia in silenzio, il prezzo dentro `tipo_allarme_rincaro`, lo scorporo
   del vincolo composito `dining_tables_sagoma_check` nei suoi tre vocabolari,
   il ternario di `SalaEOrari`, i conteggi scritti negli appunti che nessuna
   verifica controlla.
4. **Il n. 12 del collaudo: la serata sulla Dashboard**
   ([annotazioni del collaudo](collaudo/annotazioni.md)).
5. **La regola delle 5 del mattino su cassa e conti** — ✅ **misurata il
   19/08**: il censimento è in
   [`docs/referti/20260819_censimento_giornata_operativa.md`](referti/20260819_censimento_giornata_operativa.md).
   I punti sono **32** e non 18 (9 funzioni in UTC, 15 già in ora di Roma,
   8 predefiniti di colonna), più 35 punti nel client. **Nessuna correzione
   fatta**: la prossima passata è scrivere la funzione SQL gemella di
   `serataDiServizio()` e farla chiamare dai punti che riguardano soldi e
   conti. ⚠️ Oggi costa zero perché in produzione non c'è nessun movimento
   di cassa e nessun conto chiuso; dopo il collaudo generale ce ne saranno.
6. **Finire la serata recitata**: restano comande, storni, conto diviso,
   omaggio, chiusura, conteggio del cassetto.
7. **Quante altre schermate fanno più letture insieme e disegnano lo stesso se
   una fallisce** — Magazzino, Cassa e Proiezione ne fanno tutte più d'una.
   ⚠️ Alessio ha deciso il 19/08 di **NON misurarle ora**. La voce resta aperta
   e **non è stata chiusa da una misura**: nessuno sa quanto è grande.
8. *(minore)* **In Comande `handleSend` fa `withBusy(...).then(loadBoard)` senza
   `catch`**: se l'invio riesce ma la rilettura fallisce, nessun avviso e resta
   a schermo la situazione di prima. Stessa famiglia della sala disegnata
   vuota, molto meno grave.

---

## Le decisioni di Alessio ancora aperte

- **Simulatore col registratore fiscale virtuale** (nato dalla casella del
  documento fiscale scrivibile da tutto lo staff: prima si guarda cosa
  succede, poi si decide).
- **Finger food**: piatti composti da più ricette.
- **Estrazione ricette** col pulsante «estrapola» e aiuto alla lista della
  spesa.
- **Casella dedicata e mail dei clienti** dentro il gestionale.
- **Finanziamenti da terzi** dentro «Ce la faccio?».
- **Autoprodotti in magazzino** — rimandati all'apertura dell'azienda agricola.
- **Sito web**: dopo l'app, col gestionale spostato su un sottodominio.
- **Le due colonne sul computer** nella schermata della sala.

---

## Cosa il disegno della sala NON dice, per scelta (19/08/2026)

⚠️ **Non è una coda e non è un difetto: sono due bugie volute**, e stanno qui
perché fra sei mesi somiglieranno a errori da correggere. Chi le tocca deve
sapere che erano decisioni, con la loro ragione e il loro prezzo.

**1 · Le sagome sono disegnate più grandi del vero.** Ogni sagoma cresce fino
a **3 mm sullo schermo** perché si possa afferrare col dito (rovesciamento
n. 14, deciso da Alessio il 19/08 dopo aver rifiutato le tre strade che
conservavano la proporzione). **Il disegno quindi non è in scala**, e lo spazio
fra i tavoli si vede **più stretto di com'è**: chi guarda la pianta per capire
se in un corridoio ci si passa, sbaglia in difetto — mai il contrario.

⚠️ **Il varco misurato, e la storia dei due numeri sbagliati.** Il minimo vero,
rimisurato in produzione il **19/08/2026** sulla pianta base **e** su tutte e
tre le giornate esistenti, è **80 cm** — fra i divani, identico in ogni
disposizione. Prima era stato scritto che 80 valeva solo per la pianta base e
che il minimo vero era 40 (T5/T6 e T7/T8): **falso**, quelle coppie stanno a
**distanza zero**, sono tavoloni. *Un numero si chiede al database, anche
quando arriva da chi controlla.*

⚠️ **E NESSUNO DEI DUE NUMERI È LA RAGIONE DELLA REGOLA** — è per questo che
l'errore non è costato niente. La griglia di aggancio è a passi di 10 cm,
quindi qualunque sera si possono mettere due tavoli a 20 cm: **nessuna misura
di oggi può garantire le disposizioni di domani.** Al posto del numero
c'è una regola — *la sagoma cresce fino a 3 mm ma si ferma prima del vicino, e
fra due sagome separate resta sempre una riga visibile* (`VARCO_MINIMO_MM` in
`src/lib/calcoli/sala.js`), provata a 40, a 20 e a 10 cm di varco vero.
**Da qui in avanti la misura della sala non è più una condizione**: se entra
un mobile nuovo, il disegno si stringe da sé.

**2 · La Chef Table è disegnata dove non sta.** In sala è accanto alla cucina;
sulla pianta compare **sotto i divani, in orizzontale** (rovesciamento n. 15,
deciso da Alessio il 19/08: in pianta accanto alla cucina gli dà fastidio, e
la postazione è una sola e inconfondibile). ⚠️ **Solo il disegno**: la
posizione vera resta nel database, e coperti, accostamento, tavoloni,
prenotazioni **e i gesti** continuano a usare quella. L'elenco delle sagome
spostate è `SPOSTATE_NEL_DISEGNO`, e oggi contiene una riga sola.

⚠️ **«Sotto» e «orizzontale» sono quelli del telefono**: lì la pianta si mette
in piedi e gli assi si scambiano, quindi nel codice i numeri sembrano dire
un'altra cosa. **Sul computer la stessa sagoma si vede a sinistra dei divani e
in piedi.** Due prove sui dati veri la sorvegliano: che il nome esista ancora
(se il tavolo venisse rinominato l'elenco smetterebbe di riconoscerlo, senza
nessun errore) e che la posizione finta **non finisca sopra un altro mobile**
il giorno che la sala intorno cambia.

**3 · I tavoli non possono più stare in cucina.** Dal 19/08 (idea di Alessio)
l'area di cucina e servizi è **vietata ai mobili**: la sala dei tavoli è una
**L capovolta**. Vale nel trascinamento e nel magnete. ⚠️ Misurato prima di
scriverlo: nessuna sagoma è mai stata là dentro, né nella pianta base né nelle
tre giornate esistenti. È anche la ragione per cui il **margine di sicurezza**
del pannello è stato tolto — difendeva un caso che ora non può accadere, e nel
frattempo faceva sparire il pannello tutti i giorni per colpa della Chef
Table. ⚠️ Il controllo resta come rete: si è tolto il numero, non la regola.
