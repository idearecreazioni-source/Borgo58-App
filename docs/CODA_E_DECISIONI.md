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
5. **La regola delle 5 del mattino su cassa e conti** — 18 punti SQL, oggi a
   costo zero perché in produzione non c'è nessun movimento.
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
