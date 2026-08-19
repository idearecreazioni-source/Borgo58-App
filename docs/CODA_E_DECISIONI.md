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
4. ✅ **IL TAGLIO A MILLE RIGHE — misurato e SISTEMATO il 19/08 notte**:
   referto in [`referti/20260819_il_taglio_a_mille_righe.md`](referti/20260819_il_taglio_a_mille_righe.md),
   consegna in [`consegne/20260819_una_lettura_tagliata_si_denuncia.md`](consegne/20260819_una_lettura_tagliata_si_denuncia.md).
   Il segnale vive nel punto unico da cui passano le letture; la prima nota parte
   dal mese in corso e **rifiuta l'export** se la lettura è tagliata; il manuale
   HACCP **dichiara stampato** di essere incompleto.
   ⚠️ **Restano scoperte le Edge Function**, che leggono con una loro chiave e
   non passano di lì. E **nessuna mano ha visto l'avviso a schermo**: le prove
   di questo progetto non guardano una schermata.
   🔴 **LE LETTURE ANNIDATE SONO STATE MISURATE la notte del 19/08**, e la
   risposta alla domanda che contava è **no: il segnale NON le vede** — il
   confronto legge un'intestazione che parla solo delle righe padre. Addendum
   in [`referti/20260819_il_taglio_a_mille_righe.md`](referti/20260819_il_taglio_a_mille_righe.md).
   ⚠️ **Ma il rischio oggi non è raggiungibile**, ed è la parte che cambia la
   priorità: il tetto è **per riga padre** (misurato: nella stessa richiesta un
   conto ha ricevuto 1000 righe e un altro le sue 5), e delle **sette** letture
   annidate dell'app **nessuna** può avere mille figli sotto un solo padre — un
   conto con mille righe non esiste. I tre casi temuti (un fornitore con tutte
   le sue fatture, un ingrediente con tutto lo storico prezzi, un registro
   HACCP intero) **non sono letture annidate**: sono piatte, quindi già coperte
   dal segnale, e due hanno già un limite esplicito.
   🔴 **Quello che resta è strutturale, e «non può succedere» NON è una
   proprietà del programma: è una proprietà del locale.** Nessun vincolo
   impedisce a un conto di avere mille righe — lo impedisce un'osteria da 34
   coperti. `orders → order_items` alimenta il totale del conto, e **la
   risposta cambia il giorno in cui una lettura annidata nuova pesca da una
   tabella che cresce nel tempo sotto un solo padre** (lo storico prezzi di un
   ingrediente, le voci di un registro, le fatture di un fornitore): quel
   giorno il difetto è già lì e muto.
   ⚠️ **La domanda da farsi scrivendo una lettura annidata nuova** non è
   «capiterà mai mille righe?» ma *questa tabella figlia cresce col tempo sotto
   un solo padre?*
   ⚠️ **L'indizio NON si costruisce** (decisione di Alessio del 19/08): una
   protezione per un caso irraggiungibile è **un avviso che non scatta mai**, e
   un avviso che non scatta mai nessuno saprà interpretarlo il giorno che
   scatta. Resta scritto dove serve — in `supabase.js`, accanto al confronto
   che non le vede.
5. 🔴 **TRE COSE NON LE HA MAI VISTE NESSUN OCCHIO**, e sono nell'elenco del
   collaudo generale **con la ricetta per farle comparire**
   ([annotazioni del collaudo](collaudo/annotazioni.md), ultima sezione):
   l'**avviso «quello che vedi è incompleto»** (serve una tabella con più di
   mille righe: la ricetta le costruisce sul progetto di prova, ed è stata
   provata dal vivo il 19/08), la **riga sul tablet delle comande** quando la
   serata è finita (si sposta **l'ora di fine serata** di due minuti, non
   l'orologio del computer), e la **sala dopo l'annullamento dei due conti**
   — l'unica che si guarda sul gestionale vero.
   ⚠️ *Una voce di collaudo che nessuno sa come far scattare è una voce che al
   collaudo verrà saltata*: è il motivo per cui la ricetta sta scritta accanto
   a ognuna, e non basta l'elenco.
6. **La sera prima dell'apertura**: `npm run collaudo:stato` dice cosa c'è ancora
   di prova nel gestionale vero. ⚠️ Il paragrafo scritto a mano **non esiste più**,
   e non deve tornare: aveva sbagliato tre volte in sei giorni.
