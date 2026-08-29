# Il magazzino davanti allo scaffale

**Blocco 2 del mandato del 29/08/2026 (pomeriggio).**
**Commit dichiarati: `841b4cd` e `60c340f`** (più `6125440` e `151bccb`, due
correzioni di processo).
**Migrazioni introdotte: `20260829000006` e `20260829000007`.**
⚠️ Applicate al progetto di prova, **non in produzione**: aspettano il push.

---

## Cosa abbiamo rovesciato

*Niente.* Nessuna decisione in vigore contraddetta.

Una decisione del 23/08 **non è stata toccata**, e va detto perché sembrava:
«l'avviso sul prodotto fermo ha quattro risposte, fra cui *trasformato*».
Quell'avviso è **già morto** il 27/08 con la shelf life; qui è sparito il
pulsante omonimo dentro un'altra schermata, che è un'altra cosa. Le altre
tre risposte — buttato, reso al fornitore, abbattuto — **restano tutte**.

---

## 🔴 La misura ha spostato i difetti di schermata

Il mandato colloca tre difetti nel Magazzino e nella scheda
dell'ingrediente. Aperte le schermate a 375 punti coi dati veri del progetto
di prova (**133 ingredienti, 204 lotti attivi, 140 scaduti, 14
preparazioni**), stanno altrove:

| il mandato dice | misurato |
|---|---|
| «ogni lotto è una riga a sé» nel Magazzino | il Magazzino ha **133 righe su 133 ingredienti**: era già per ingrediente |
| — | le righe ripetute sono in **Scadenze** (201 righe: «Sarde» 13 volte, «Carota» 12, «Caciocavallo» 9) e in **«Da quanto è ferma»** (altri 201, gli stessi lotti) |
| «scade il» nella scheda dell'ingrediente | vive in **`Fermi.jsx`**, cioè «Da quanto è ferma» |
| la sezione «l'ho trasformato» nella scheda | **stessa schermata**, non la scheda |
| la frase della biologa nella scheda | **stessa schermata**, dentro il pannello dell'abbattimento |

⚠️ **Non cambia cosa c'era da fare: cambia dove.** Se avessi corretto dove
il mandato diceva, avrei toccato una schermata sana e lasciato intatte le
due malate.

---

## Scadenze: da 201 righe a 65

Una riga per **ingrediente**, col totale e la prima scadenza; i lotti si
aprono toccandola. La Carota che occupava 12 righe è **una riga con «12
partite» dentro**, ognuna con la sua data e i suoi due gesti.

⚠️ **I lotti restano separati nel database**: si raggruppa solo ciò che si
guarda. La rintracciabilità di un richiamo vive sul lotto, e i gesti restano
per partita — si butta una cassa, non «il caciocavallo».

Più: **tre posizioni** (tutti / comprati / preparati da me — il filtro dà
**14 righe**, esattamente le 14 preparazioni del database) e l'**ordinamento
«più fermo prima»**, che prima era una schermata a sé.

**Lo scaduto si dice al passato**, in rosso e in cima: «SCADUTO il 10 giu
2026». Provato **nei due versi**: zero date passate che dicono «scade il»,
zero date future che dicono «SCADUTO», e i **140 scaduti** corrispondono al
numero nel database.

## «Da quanto è ferma»: fuori dal menu, non cancellata

Mostrava **gli stessi identici 201 lotti** delle Scadenze, con un taglio
diverso. Due voci di menu per lo stesso elenco insegnano che una è inutile —
e prima o poi si smette di aprire anche quella che serve.

⚠️ **Ma non è stata cancellata**, ed è la parte da non perdere: è l'unica
strada per le risposte che le Scadenze non danno — **abbattuto, reso al
fornitore** — e ci si arriva dal pulsante «Altre risposte…». Toglierla del
tutto riaprirebbe **la porta mancante del 23/08**.

Lì dentro: «SCADUTO il» in rosso, via la sezione «l'ho trasformato» (il suo
stesso pulsante ammetteva di non fare niente: *«la giacenza non cambia:
scende quando registri la preparazione»*) sostituita da un **collegamento**,
e via la frase sulla tabella della biologa, **diventata falsa il 27/08**.

Tolto anche il codice rimasto orfano: quattro campi, una lettura delle
ricette a ogni apertura, tre import.

## Allineamento

- **«dovrebbe essercene» era su ogni riga — 121 volte, misurate.** Tre
  parole ripetute centoventun volte non informano: riempiono. Il nome
  diventa grosso, perché davanti allo scaffale si cerca quello.
- **Via «in esaurimento»**, richiesta esplicita di Alessio. Compariva
  sull'agnello a **0 kg** — zero non è in esaurimento, è finito — e sul
  basilico che ne ha 5,79. E la frase «in cima ci sono i 55 prodotti in
  esaurimento» prometteva un ordine che non c'era: l'elenco è **alfabetico**.
  ⚠️ Il dato `sotto_soglia` **non è stato tolto**: lo guarda la Lista della
  spesa, che è dove serve a decidere cosa ordinare.
- **Il numero proposto si arrotonda**: due decimali per chili e litri,
  interi per pezzi e mazzi — un mezzo mazzo non esiste. Proponeva 0,4218 kg
  di amido di mais e 5,79 mazzo di basilico.
  ⚠️ **Difetto mio preso da una prova**: `Number(null)` non è un errore, è
  **zero** — quindi un valore mancante sarebbe diventato «0», che davanti
  allo scaffale si legge «non ce n'è».
- **La tabella della riga 294** — quella che la rete aveva trovato il 28/08 e
  che a schermo dava zero solo perché l'elenco era vuoto — è chiusa col
  componente adattivo. Verificato **chiedendolo alla rete**, non a occhio.

## La soglia sugli scarti, e la soglia che non era una soglia

La ragione è di Alessio: **venti grammi di pinoli sono rumore, venti di
zafferano sono un mese di scorta**. Quindi in percentuale della dose
prevista: sotto l'1%, la ricetta è stata seguita.

🔴 **E la soglia che sembrava esserci non era una soglia.** Nei quattro punti
dove nasce un'anomalia c'era già `pizzico_trascurabile`, e sembrava il posto
giusto. Letto il corpo vivo: è vera **solo quando la quantità è zero** — è
la taglia della colonna, non una misura di rilevanza. **Non è stata
toccata**: risponde a un'altra domanda.

⚠️ **Senza la dose prevista si SEGNALA.** Tacere perché non si sa quanto pesa
sarebbe nascondere. Le tre righe già scritte non hanno il denominatore e non
si riempiono a indovinare — e **in produzione le anomalie sono zero**,
quindi col gestionale vero la soglia vale dal primo scarico.

⚠️ La migrazione riscrive due funzioni dal corpo vivo e **controlla che la
sostituzione sia avvenuta**: poche ore prima una riscrittura di questo tipo
non ha attecchito e la migrazione è passata lo stesso. E si è scoperta **non
idempotente rilanciandola**, non rileggendola.

## La fascia «cosa non è sceso»

La data una volta sola come titoletto, e una linea fra i messaggi. Tre righe
di fila ripetevano «23 ago 2026», e la ripetizione occupava il posto dove si
cerca **cosa** non è sceso. Il testo della fascia — che il mandato indicava
come modello — **non è stato toccato**.

---

## Due correzioni di processo, e una regola scritta stretta

`q.local.sql`, uno script usa-e-getta, è **finito in un commit**. Il
`.gitignore` copriva `*.local.mjs` (solo i `.mjs`) e `_*.local.*` (solo
quelli con l'underscore): il mio file non era né l'uno né l'altro.

⚠️ **E non era la prima volta**: il commento che sta lì racconta già di due
file finiti in un commit, e **la cura di allora fu scritta sui nomi di
allora**. Ora la regola è larga quanto la convenzione, e l'ho provata
creando un file nuovo e chiedendo a git se lo ignora.

⚠️ E il mio controllo aveva detto «c'è già» cercando la stringa in tutto il
file invece che come riga a sé: la trovava dentro `_*.local.*`.

---

## Rilettura

**Cosa NON ho verificato con gli occhi.** Nessuna immagine. Nessun gesto
distruttivo provato: non ho premuto «Buttata» né «Abbattuto» su una partita
vera, quindi so che i pulsanti ci sono e **non** che facciano ancora quello
che promettono. La soglia sugli scarti non l'ha vista nessuno all'opera su
un'anomalia nuova: è provata sulla regola, non su uno scarico vero.

**Cosa ho contato senza leggerlo.** I 133 ingredienti, i 204 lotti e i 140
scaduti vengono da una query, non dall'aver guardato le righe. I «121
dovrebbe essercene» e i «56 in esaurimento» vengono dal testo della pagina.

**Quali mie affermazioni sono diventate false mentre lavoravo.** La nota nel
registro dei debiti diceva che il Magazzino «va rifatto come elenco unico
per ingrediente»: misurato, **lo era già** — corretta. E il messaggio della
verifica del calendario, nell'altro riepilogo.

**Quali conteggi sono pavimenti.** Le «tre anomalie»: sono quelle del
progetto di prova, e in produzione sono zero. La soglia si vedrà lavorare
solo col primo scarico vero.

**Cosa ho lasciato sul progetto di prova.** Le due migrazioni applicate.
Niente dati: le prove di questo blocco hanno solo letto. Il fornitore toccato
per il Blocco 4 è stato rimesso e ricontato (11 su 11 vuoti).

---

## 🔴 Due punti del Blocco 2 NON fatti, e perché

**2g — «la scheda dell'ingrediente diventa il posto unico».** Non aperto.
È l'unico punto del blocco senza una misura sotto: gli altri nominano un
numero o una frase che ho potuto verificare, questo descrive un assetto.
E la misura di stanotte ha spostato tre difetti su quattro **fuori** da
quella scheda: prima di riorganizzarla andrebbe deciso cosa ci finisce
davvero dentro, e quella è una decisione di Alessio. È fra le domande.

**2n — l'allineamento a voce con la conferma parlata.** Fatto a metà, e la
metà che manca è dichiarata:
- ✅ **dettare una giacenza funziona già**: il tipo `giacenza` è acceso e
  l'Allineamento apre la riga col numero detto. Non l'ho costruito io: c'era.
- 🔴 **la conferma PARLATA no.** Misurato: in tutto il gestionale non esiste
  nessuna sintesi vocale — MEMO oggi risponde a schermo, mai a voce.
  Costruirla è un lavoro a sé, e soprattutto **non potrei provarla**: che una
  voce si senta, si capisca e non arrivi in ritardo lo dice un orecchio, e
  qui non c'è. Farla e dichiararla «fatta» senza averla sentita sarebbe la
  cosa peggiore su un gesto che scrive un numero di giacenza.

⚠️ La decisione del 14/08 la permette («la voce risponde e conferma, non
annuncia mai di sua iniziativa»), quindi non è bloccata da niente: è solo un
lavoro che vuole una prova che io non posso fare.
