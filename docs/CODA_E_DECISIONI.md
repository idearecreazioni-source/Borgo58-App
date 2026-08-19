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
   ⚠️ **Una voce aggiunta il 19/08 (sera)**, trovata usandola:
   `migrazioni-senza-portieri` guarda **se** i claims compaiono, non
   **quando** — e ogni verifica finisce con un `set_config(…, null, …)` per
   ripulirsi, che da solo basta a zittire il guardiano. Una migrazione che
   chiamasse una funzione col portiere *prima* di impostare i claims
   passerebbe. *(La seconda voce di quella coppia — la rete che cercava la
   parola `is_titolare()` invece del gesto — è stata **chiusa lo stesso
   giorno** con `20260819000007`: cercando il gesto sono comparse due
   funzioni che c'erano già e non si vedevano, e `promuovi_disposizione`,
   che scrive `not (select is_titolare())`, ha smesso di essere invisibile a
   tutte e due le reti.)*
4. **Il n. 12 del collaudo: la serata sulla Dashboard**
   ([annotazioni del collaudo](collaudo/annotazioni.md)).
5. **La regola delle 5 del mattino su cassa e conti** — ✅ **misurata e
   fatta il 19/08**: censimento in
   [`referti/20260819_censimento_giornata_operativa.md`](referti/20260819_censimento_giornata_operativa.md),
   consegna in
   [`consegne/20260819_la_giornata_operativa.md`](consegne/20260819_la_giornata_operativa.md).
   Il perimetro l'ha deciso Alessio: seguono la serata **due gesti soli** —
   il conto incassato dopo mezzanotte e il conteggio del cassetto; tutto il
   resto segue il calendario.
   ✅ **E la seconda metà è chiusa il 19/08 (sera)**:
   [`consegne/20260819_la_giornata_proposta.md`](consegne/20260819_la_giornata_proposta.md).
   Le schermate della cassa e dei conti propongono la serata e **la
   mostrano**; le altre restano sul calendario, e adesso è **scritto dove**
   (in `constants.js`, accanto a `oggiLocale()`), perché il prossimo che
   passa non le «uniformi» credendo di sistemare una dimenticanza. In
   Comande la sala **continua a non cambiare da sola** — decisione di
   Alessio — ma alle 5 compare una riga che lo dice, e il passaggio lo
   decide chi ha il tablet in mano.
   ⚠️ **Cosa resta aperto qui**: nessuna prova automatica guarda una
   schermata (in questo progetto non c'è un ambiente DOM), quindi che
   l'avviso di Comande **si veda** non l'ha verificato nessuno.
   ✅ **E la domanda sul predefinito ha avuto risposta la sera stessa**: non
   si allinea, **si toglie** — insieme agli altri sette (rovesciamento n. 18,
   [consegna](consegne/20260819_niente_date_riempite_da_sole.md)). Un
   predefinito allineato sarebbe stato *meno sbagliato*, non giusto.
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

## ⚠️ Cosa resta da guardare dopo il 19/08 sera

1. ✅ **Le due migrazioni sono state applicate** dopo il push: **147 migrazioni in
   produzione**, 26 lapidi, **zero** righe di prova nel registro, **zero**
   riempimenti automatici di date.
2. 🔴 **Nessuno ha chiuso un conto in sala dopo la modifica di
   `close_order_as_discount_gift`.** È provato dentro la migrazione — che apre un
   conto vero e lo omaggia — ma con i claims impostati, non con un tablet in mano.
   ⚠️ E il comportamento **cambia fra mezzanotte e le 5**: quell'omaggio prima
   prendeva il giorno di calendario, adesso prende la serata.
3. ⚠️ **Le prove automatiche lasciano lapidi sul progetto di prova** (marcate
   `TEST-AUTO` e `__PROVA__`, oltre milleottocento): là è un database usa-e-getta e
   non è un problema, ma vuol dire che il numero delle lapidi su quel database non
   dice niente — e che una prova che le contasse invece di guardare una proprietà
   sarebbe inutile.
4. 🔴 **IL TAGLIO A MILLE RIGHE — misurato il 19/08 sera, NON corretto** (decisione
   di Alessio: prima la misura, poi lui decide se è mezz'ora o un giro a sé).
   Referto: [`referti/20260819_il_taglio_a_mille_righe.md`](referti/20260819_il_taglio_a_mille_righe.md).
   In breve: **144 letture dell'app** chiedono un elenco senza dire quante righe.
   Oggi nessuna tabella ci arriva — la più popolata ne ha **26** — ma
   **`order_items` passa mille in 2-3 settimane di servizio**, e `orders` e
   `reservations` in 3-4 mesi. I due punti che fanno male non sono quelli: sono
   **i totali della Prima nota con l'esportazione CSV** (elenco non filtrato:
   i campi «dal» e «al» partono vuoti) e **il Manuale HACCP con l'interruttore
   «tutto»** — un documento esibibile che dichiara «tutto» e ne mostra mille.
   ⚠️ **E la cosa che vale di più è che si può sapere**: chiedendo l'elenco con
   `{ count: "exact" }` il database dichiara **quante righe c'erano davvero**
   (misurato: 1000 consegnate, **1930 dichiarate**). Il confronto starebbe in un
   posto solo, e trasformerebbe la correzione futura da «cercarli tutti» a «se ne
   accorge da solo».

---

## ⚠️ Una lezione di ORDINE, imparata sbagliandolo il 19/08

`npm run migra` applica **tutte** le migrazioni mancanti o **nessuna**, e si
ferma se anche una sola non è ancora su GitHub. Quel rifiuto è giusto — la
produzione non deve mai correre avanti al repository — ma ha una conseguenza
sull'ordine dei gesti, che il 19/08 è costata l'applicazione di sei migrazioni
già pronte:

> **Le migrazioni già su GitHub si applicano PRIMA di committarne di nuove.**

La sera del 19/08 le sei del mattino erano pushate e documentate, quindi
applicabili; committando le due nuove **prima** di applicarle, la rete le ha
bloccate tutte e otto insieme, e per sbloccarle serve comunque il push di
Alessio. Nessun danno — solo un giro in più.

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
