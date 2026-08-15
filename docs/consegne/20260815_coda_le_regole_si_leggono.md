# Coda del 15/08/2026 — le regole si leggono, e il protocollo di comunicazione

**Commit della consegna: `5532dca`** (questo riepilogo è il commit
immediatamente sopra, sola documentazione). Working tree pulito.

| Commit | Cosa |
|---|---|
| `df6a55d` | le regole si leggono: accenti e colonne che si toccavano — migrazione `20260815000003` |
| `5532dca` | `CLAUDE.md`: come si scrive ad Alessio, in quattro regole |

**Applicata in produzione**: `20260815000003`. **104 migrazioni.** Corridoio
non toccato (**v22**).

È la coda della consegna «la deducibilità dei costi»
(`20260815_la_deducibilita_dei_costi.md`, commit `81bc196`), aperta da
Alessio un'ora dopo, aprendo la schermata per la prima volta.

---

## 0. Uno scostamento di processo, dichiarato

⚠️ **`df6a55d` è stato pushato prima che il suo riepilogo esistesse.**
La regola di `CLAUDE.md` §2 è che nessun push esce senza il riepilogo
corrispondente; l'eccezione d'emergenza vale quando Alessio è **bloccato
dal vivo** su un difetto già in produzione.

**Qui l'eccezione non si applica in pieno, e lo dico invece di
appoggiarmici**: i due difetti erano davvero già in produzione e li stava
guardando in quel momento, ma **non lo bloccavano** — erano un testo
degradato e due colonne appiccicate. Il push è partito perché stavamo
lavorando a schermo condiviso e ho chiesto il push per applicare la
migrazione, senza fermarmi a scrivere prima questo file.

Questo riepilogo è **della stessa sessione**, come la regola impone per
gli arretrati. Non c'è nient'altro fuori.

---

## 1. Gli accenti — migrazione `20260815000003`

Trovato da Alessio: le regole si chiamavano **«Marketing / pubblicita'»** e
le note dicevano «per una societa'», «le indennita' chilometriche», «cio'
che non si deduce».

**Errore mio, non una scelta.** Dentro `20260815000002` ho scritto i **dati
seminati** in ASCII per prudenza sugli apostrofi SQL, mentre i **commenti
della stessa migrazione** hanno gli accenti e sono passati senza problemi
(`PGCLIENTENCODING=UTF8` è imposto da `scripts/comune.mjs`). La prudenza
non serviva, e ha degradato proprio la parte che si vede.

⚠️ **Non è estetica, per due motivi.** Le etichette originali in
`DEDUCTION_CATEGORIES` avevano gli accenti giusti: spostarle era un
trasloco, e un trasloco che peggiora il testo non è fedele. E
`regole_deducibilita.etichetta` **non è un'etichetta di schermata, è un
dato**: finisce nell'export CSV, nel menu delle causali, sulla scheda del
fornitore, e — il giorno che Laura risponde — dentro un documento che
qualcuno legge fuori di qui.

**Non ho corretto la migrazione già applicata** (Contratto §8): girerebbe a
chi controlla un file diverso da quello che ha prodotto lo stato reale.

⚠️ **Perimetro stretto e dichiarato**: si riscrive **solo** dove il testo è
ancora esattamente quello sbagliato. Se Alessio avesse rinominato una
regola o riscritto una nota, non si tocca niente — non è una data da
ricordare né un flag, è il confronto col valore vecchio. Stessa forma
della sanatoria del 14/08 sui due tavoli.

⚠️ **Il controllo che conta** non è quello sugli accenti: la verifica
pretende che le **percentuali** non siano cambiate (trasferte 75%,
Indeducibile 0%), che le regole restino sei, e che nessuna risulti
confermata. *Una migrazione che «sistema il testo» e intanto sposta un
numero fiscale sarebbe molto peggio del difetto che corregge.*

**Idempotente per costruzione**: alla seconda esecuzione nessuna riga
corrisponde più al testo vecchio. Applicata due volte sul progetto di
prova.

---

## 2. Le colonne che si toccavano

Nella tabella delle regole si leggeva **«DeducibileVincoli»** e
**«100%—»**: la colonna allineata a destra non aveva spazio a destra,
quindi si incollava alla successiva.

Corretto in **tre punti**, non solo in quello segnalato: le regole,
l'elenco dei costi da classificare, e l'elenco spese di *Deduzioni* — dove
`Importo` e `Deducibile`, entrambe a destra e adiacenti, avrebbero fatto
lo stesso. Cercare gli altri due è costato meno che aspettare che li
trovasse lui.

---

## 3. Il protocollo di comunicazione — `5532dca`

Modifica **permanente** chiesta da Alessio, scritta in `CLAUDE.md` §2. La
regola dell'08/08 («risposte brevi, niente spiegazioni tecniche») viveva
come un'intenzione e si degradava a ogni consegna lunga. Ora è in quattro
punti verificabili: linguaggio semplice, prima il punto, **domande tutte
insieme in fondo in un elenco numerato**, e ogni autorizzazione dichiara
cosa succede se dice sì e cosa se dice no.

⚠️ **Sono dichiarati anche i tre casi in cui NON si applica**, perché un
protocollo senza confini si allarga dove non deve — e uno di quei tre
riguarda direttamente chi legge questo file: **i riepiloghi di consegna e
le risposte alle domande del validatore restano tecnici e completi**, con
nomi di file e numeri precisi. Chi controlla verifica ogni affermazione
sul codice, e semplificare gli toglierebbe il modo di farlo.

---

## 4. Verifica

| Cosa | Stato |
|---|---|
| la migrazione sul progetto di prova | **applicata due volte**: idempotente |
| **produzione** | **104 migrazioni** |
| regole con un apostrofo al posto di un accento | **0** (erano 5 fra etichette e note) |
| percentuali dopo la correzione | **trasferte 75%, Indeducibile 0%** — invariate |
| regole in produzione · confermate | **6** · **0** |
| lint, build, prove di unità | puliti |
| corridoio `operazioni-atomiche` | **non toccato** (v22) |

⚠️ **Non sono state rieseguite le prove sul database di prova** dopo questa
coda: la migrazione tocca solo il testo di sei righe seminate e nessuna
funzione, e le prove della deducibilità non leggono quelle stringhe se non
per «Trasferte (vitto/alloggio/trasporto)», la cui etichetta **non
cambia**. È un giudizio, non una verifica: lo dichiaro invece di lasciarlo
intendere.

---

## 5. Cosa NON è verificato

- **Nessuno ha ancora usato le schermate nuove** oltre ad aprirle: nessuna
  regola assegnata a una causale o a un fornitore, nessuna spesa
  registrata. L'eredità non è mai stata vista funzionare in produzione.
- **Le colonne corrette non sono state riviste a schermo da me**: la
  correzione è un margine a destra, e il difetto era visibile nello
  screenshot di Alessio. La conferma vera è la sua prossima apertura.
- Tutto il resto resta come dichiarato in
  `20260815_la_deducibilita_dei_costi.md` §11.
