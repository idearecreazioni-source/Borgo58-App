# Consegna del 17/08/2026 (sesta) — le ultime due piccolezze

**Commit della consegna: `d05f49a`** (`La stampa parla di stampa, e «Rimuovi»
resta un'altra cosa`). Working tree pulito prima di questo riepilogo. Questa
consegna **non modifica** `docs/CONTRATTO.md` e **non contiene migrazioni**:
è tutta in schermata.

Chiude le piccolezze del primo blocco del collaudo: **10 su 10**. Con questa,
**il primo blocco è chiuso per intero.**

---

## 1. Il riepilogo in cima al Magazzino

Prima c'era «Giacenze, soglie minime, scadenze» — che **descrive la
schermata** e non dice niente: per sapere se c'era qualcosa da fare bisognava
scorrere l'elenco riga per riga. Adesso: *«3 sotto scorta minima · 1 scade
entro tre giorni — su 8 ingredienti»*.

⚠️ **I due numeri si contano dalle stesse righe che si vedono sotto**, non da
una seconda interrogazione: un totale che non si può ricontrollare riga per
riga è un totale **diverso**, non uno **più vero** (è la regola del 16/08 sui
due totali del «da pagare»). E «sotto soglia» lo decide la **vista**, non un
secondo confronto scritto nella schermata: due posti che rispondono alla
stessa domanda finirebbero per dire due numeri diversi.

⚠️ **E quando non c'è niente da fare lo dice**, invece di sparire: un riquadro
che compare solo nei guai fa dubitare, quando manca, di non averlo visto.

---

## 2. Le spunte dell'Editor Menu — ridisegnata, non ritoccata

Erano **dieci caselle tutte accese**: togliendone una si escludeva quel piatto
da *quella* stampa. Ma una casella spuntata è il segno universale di una
scelta **salvata** — le togli, esci, rientri, e sono tornate tutte. La riga
che lo spiegava c'era, sopra e in piccolo: *quello che si vede è il
comportamento, non la nota.*

**Il criterio, dato dal validatore**: la spunta deve somigliare a ciò che fa.
Aveva la **forma di uno stato** («questo piatto è escluso») e la **sostanza di
un'opzione di stampa** che vive un istante. Delle due l'una: o diventa uno
stato per davvero e si salva, o **smette di sembrarlo**.

**Presa la seconda strada**, perché quella scelta *non è* uno stato del menu:
vale per un foglio che si sta per stampare, e salvarla vorrebbe dire inventare
un secondo concetto — «piatti che esistono nel menu ma non si stampano» — che
nessuno ha chiesto e che poi andrebbe tenuto d'accordo col menu vero.

Come si presenta adesso:

- **niente di spuntato**: lo stato di partenza è «tutti dentro», che è la
  verità;
- si preme **«non stampare»** e il piatto **si vede tolto** — barrato,
  sbiadito, con «rimetti nella stampa» accanto;
- l'intestazione dice in ogni momento **quanti se ne stampano su quanti**, e
  che valgono **solo per questa stampa**;
- c'è **«Rimettili tutti»**, che prima non esisteva.

⚠️ È la stessa forma della striscia del database (16/08): **due stati dello
stesso segno, non due segni.**

### E la confusione con l'altro gesto, che il validatore ha chiesto di guardare

Nel menu esiste già **«Rimuovi»**, che toglie il piatto dalla carta **per
davvero**. Se i due si somigliassero, qualcuno userebbe il primo credendo di
fare il secondo — *il difetto di oggi visto dall'altro lato.* Tre cose per
tenerli distinti:

1. il blocco si chiama col gesto a cui appartiene: **«Cosa lascio fuori da
   questa stampa»**;
2. i verbi sono **di stampa e mai «togli»**: «non stampare», «rimetti nella
   stampa»;
3. la riga di testa **nomina l'altro gesto** per distinguerlo: *«per togliere
   un piatto dalla carta per davvero si usa "Rimuovi", nel menu»*.

---

## 3. 🔴 E un rilievo arrivato dopo, provando la stampa

⚠️ **Questo pezzo è stato aggiunto al riepilogo dopo che era già scritto**, su
richiesta del validatore: la correzione era già fatta e il riepilogo no, ed è
esattamente la situazione che la rete dei riepiloghi esiste per impedire — un
blocco che *sembra* chiuso senza esserlo.

**Il rilievo, e va scritto perché fra sei mesi sarà meno ovvio della cura.**
Accendendo «Mostra allergeni», i Ravioli mostravano l'elenco vero — «Glutine ·
Latte» — e sotto **tutti gli altri sette piatti** compariva *«per gli allergeni
chiedi al personale»*. La distinzione funzionava: il piatto non confermato non
stampava un elenco che sembrava controllato. Ma la stessa frase ripetuta sotto
sette piatti su otto è **rumore**, e contraddiceva una decisione già presa —
sul menu resta solo la dicitura in fondo, l'elenco vive nella schermata per lo
staff.

⚠️ **La cura non era togliere e basta.** Se un piatto non confermato diventa
identico a uno che non contiene allergeni, torna il difetto di partenza:
**l'assenza in mezzo a delle presenze si legge come una rassicurazione.** È lo
stesso difetto, visto dall'altro lato.

**La cura**: un **asterisco** accanto al nome del piatto, e **una** nota in
fondo alla pagina che lo spiega — «i piatti con * non hanno ancora l'elenco
completo: per quelli chiedi sempre al personale». La nota compare solo se c'è
almeno un piatto asteriscato, e il conto si fa sugli stessi piatti che
finiscono sul foglio.

⚠️ **Quando tutti gli ingredienti saranno confermati l'asterisco sparisce da
solo**: non è un interruttore da ricordarsi di spegnere — e questo progetto ha
già visto cosa succede a una cosa che va spenta a mano.

**E la casella dice a cosa serve** (seconda metà del rilievo, decisione di
Alessio): sul menu definitivo **non vanno elenchi sotto i piatti**, quindi
«Mostra allergeni» serve a stampare una copia per la sala. Accanto c'è scritto
**«copia per uso interno, non la carta»**. Senza dirlo, fra sei mesi qualcuno
la accende credendo che sia il modo previsto di stampare la carta.

---

## 4. Cosa NON è verificato

- **Nessuna mano vera ha aperto le due schermate** dopo la modifica. L'Editor
  Menu in particolare: Alessio lo userà sul serio a breve, quando comincerà a
  costruire il menu vero, ed è per questo che il validatore ha chiesto di
  farla prima della lista della spesa — *un buco che aspetta contro un difetto
  che agisce.*
- **Il riepilogo del Magazzino non è mai stato visto coi numeri veri in
  produzione**: lì gli ingredienti sono 12 e nessuno ha una giacenza. Sul
  progetto di prova lo scenario ha 3 sotto scorta minima.
- **Nessuna prova automatica copre le due schermate**: sono presentazione, e
  nessun numero dipende da loro. I due contatori del Magazzino leggono
  `below_threshold` dalla vista, che è già provata altrove.
- **Non c'è nessuna migrazione**, quindi niente da applicare e niente da
  verificare sul database.
- **Il menu con l'asterisco non è mai stato stampato**: si vede in anteprima,
  ma nessuno ha mandato il foglio alla stampante né guardato come cade
  l'asterisco su una riga lunga.

## 5. Stato finale

| | |
|---|---|
| Migrazioni in produzione | **129**, invariate |
| Prove automatiche | 49 pure + 144 sul progetto di prova, verdi |
| **Piccolezze del collaudo** | **10 su 10** |
| **Primo blocco del collaudo** | **chiuso per intero** |
| Prossimo | la lista della spesa ([mandato](../mandati/20260817_la_lista_non_scrive_uscite.md)) |

⚠️ **Perché chiudere il blocco prima di aprire la lista della spesa** (ragione
del validatore, messa agli atti): *ogni volta che abbiamo lasciato una coda
aperta, è tornata a farsi sentire dentro il lavoro successivo.*
