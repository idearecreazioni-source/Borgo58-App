# Le cinque cose viste col telefono — 27/08/2026

**HEAD dichiarato**: `09c05cf` — «Le cinque cose viste col telefono: lo stato,
la tabella, i limiti inventati». Questo riepilogo è l'ultimo commit della
consegna e sta sopra di lui.

**(vero)** = misurato sul gestionale di Alessio · **(prova)** = sul progetto
di prova.

---

## Prima: le due decisioni erano già lo stato attuale

- **La chiave sul progetto di prova**: l'unica che esiste è già lì (prova —
  «iPhone di Alessio», creata il 26/08 alle 23:44). Nel gestionale vero le
  chiavi sono **zero**. Nessun lavoro.
- **Il pulsante largo quanto lo schermo**: già così — misurato **375 su 375**
  punti. Nessun lavoro.

---

## 1 e 2 · LO STATO CHE SEMBRAVA CONTRADDIRSI

Su «Agnello con carciofi»: lo stato diceva «Pronta per la carta» e il
lucchetto «È in carta».

### 🔴 Il gestionale non si contraddiceva — e la mia prima lettura era sbagliata

**Misurato** (prova):

| | |
|---|---|
| `in_carta` sul piatto | **true** |
| sta in un menu attivo | sì, «Carta dei due mesi» |
| ricette con `in_carta` in disaccordo col menu | **zero, in tutte e due le direzioni** |
| la striscia mostrava | **«✓ In carta» acceso**, verde pieno |

Il riflesso del 16/08 funziona. E **anche il mio primo setaccio sbagliava**:
cercava un pulsante di testo «In carta» e non trovava **«✓ In carta»**, per
via della spunta davanti — falso allarme mio, il quarto della giornata.

### Il difetto era DOVE, non COSA

**Misurato a 375 punti** (prova): i quattro stati vanno su **due righe**.

| riga | pulsanti |
|---|---|
| y=515 | In sviluppo · **Pronta per la carta** |
| y=563 | **✓ In carta** (acceso) · Ritirata |

«Pronta per la carta» sta sulla **prima** riga, sopra quello vero, ed è la
pillola più larga. Chi guarda in fretta legge la prima.

### La cura non tocca la striscia

Quattro stati in fila sono una **decisione di Alessio del 24/08**, e l'ordine
è il percorso di un piatto: non si rovescia. Quello che cambia è che
**l'etichetta dice il valore**: «STATO: In carta» (prova, visto a schermo).

⚠️ *Dire con le parole quello che oggi dice solo un colore* — la stessa
lezione della chiave della Scorciatoia, imparata poche ore prima.

⚠️ **E risolve anche il punto 2**: i quattro pulsanti sono **tutti spenti**
(misurato), e premendo quello in cui si è già non succede niente — **ed è
giusto**. Ma finché l'etichetta non lo diceva, sembrava un guasto. La
spiegazione col lucchetto **c'era già**, a **16 punti** sotto i pulsanti, col
pulsante «Togli da "Carta dei due mesi" e sblocca».

---

## 3 · LA TABELLA DEI MENU

**Misurato a 375 punti, prima** (prova): sei colonne (non cinque — c'è anche
quella dei comandi), tabelle larghe **347-356 punti** dentro un contenitore
da **295**: sbordo di **52-61**.

⚠️ Il riquadro aveva `overflow-x: auto`, quindi **la pagina intera non
scorreva**: la regola del 21/08 non era violata alla lettera. Ma il margine
bisognava andarselo a cercare trascinando, ed è quello che Alessio ha visto.

**Rifatta** con la forma già usata il 18/08 e il 25/08: sul telefono un
elenco, un piatto per riquadro coi suoi numeri sotto; sul computer resta la
tabella.

**Misurato dopo** (prova):

| | telefono (375) | computer (1265) |
|---|---|---|
| tabelle visibili | **0** | **4** |
| riquadri per piatto | **14** | 0 |
| elementi che sbordano | **0** | 0 |
| pagina scorre di lato | no | no |

🔴 **I campi stanno in un posto solo** (`VOCI`): è la lezione del 18/08 sulle
prenotazioni — due elenchi di colonne divergono in silenzio, e a restare
indietro è sempre quello che si guarda di meno, cioè il telefono.

---

## 4 · IL «(5/4)» — e la domanda di Alessio era quella giusta

Lui ha chiesto: *«prima dimmi cosa contava quel 4: se è un limite che
qualcuno ha deciso, sparire il numero cancella l'avviso invece del
problema»*.

**Misurato: non l'ha deciso nessuno.**

- il **4** era `target: 4`, un **numero fisso nel codice** — non leggeva
  niente, non impediva niente, nessuno poteva cambiarlo;
- ed era scritto in un **secondo posto**: «Struttura 4-4-4-2», che viene da
  `menus.structure`, un **predefinito del database** che **nessuna schermata
  permette di cambiare** — uguale su tutti e quattro i menu (prova).

⚠️ È la famiglia di `RAPPRESENTANZA_PER_PERSON_THRESHOLD` (15/08): *un numero
che vive nel testo di una schermata e che nessun calcolo usa* — una regola
promessa e mai applicata.

**Tolti tutti e due insieme** (regola dei cinque posti): togliendone uno
solo, l'altro avrebbe continuato a raccontare lo stesso limite inventato.
Quanti piatti ci sono resta scritto — «Secondi (5)» — perché quello è un
fatto.

⚠️ **La colonna resta nel database**: toglierla è una migrazione che nessuno
ha chiesto, e un dato inerte non fa danno. A farlo era **mostrarlo come se
fosse una regola**.

---

## 5 · LO STORICO DEL COSTO

Tolto dalla scheda ricetta, come deciso. Con lui se ne va anche **la lettura
che lo caricava a ogni apertura**: una lettura che nessuno guarda è un giro
di rete per niente.

⚠️ **Lo storico resta nel database e continua a riempirsi**: a sparire è solo
la schermata che lo mostrava. Se un giorno servisse, i dati ci sono.

⚠️ E le righe si leggevano davvero al contrario — «Aggiunto Caponata —
6,12 €» dove 6,12 era il totale del **piatto** dopo l'aggiunta. Ma la
decisione è toglierlo, non riscriverlo: *un dato che non serve non migliora
diventando corretto*.

---

## Cosa abbiamo rovesciato

**Niente.** Nessuna decisione in vigore è stata cambiata — anzi, due sono
state **rispettate invece che scavalcate**: la striscia coi quattro stati
(24/08) non è stata toccata, e l'ordine del percorso di un piatto nemmeno.

Voci di `docs/DECISIONI.md`: **quattro aggiunte**, in una sezione nuova
«Ricettario e menu».

---

## RILETTURA

**Cosa NON ho verificato con gli occhi**
- **Nessuna immagine**: tutto è **letto dal DOM**.
- **Niente da un telefono vero**: larghezza emulata a 375 punti.
- **I riquadri del menu non li ha guardati nessuno con gli occhi**: so che
  sono 14, che non sbordano e cosa contengono — non se sono **belli**.
- **Non ho premuto «Rimuovi» né cambiato un prezzo** dai riquadri nuovi: ho
  misurato che i campi ci sono, non che funzionano da lì.

**Cosa ho contato senza leggerlo**
- Le **438 prove sull'app** e le **505 pure**: ho letto il totale.

**Quali mie affermazioni sono diventate false mentre lavoravo**
- 🔴 *«La striscia mostra tre stati e manca "In carta"»*: **falso** — c'era,
  acceso; il mio filtro non prendeva la spunta davanti al nome.
- 🔴 *«Il 4 è solo un numero nel codice»*: **incompleto** — era anche una
  colonna del database, scritta in un secondo posto.
- 🔴 *«`false &&` basta per togliere lo storico»*: **falso**, il lint l'ha
  respinto come codice morto. Tolto per davvero.

**Quali blocchi non ho aperto**
- **Blocco 3 — MEMO.** Non aperto: è lavoro di sole parole ed è l'ultimo per
  priorità.

**Prove**: app **62 file / 438 prove** (uscita 0), pure **44 / 505**, lint
**zero avvisi**, build verde.

**Migrazioni**: repository **288**, produzione **270**, prova **288**.
**Diciotto in attesa del push** — nessuna nuova in questo giro: le cinque
cose erano tutte di schermata. Ordine: `git push` di Alessio →
`npm run migra -- --conferma` → riepilogo → secondo push.

**Trappole nuove**: nessuna scritta in questo giro. Le due della consegna
precedente (l'identificativo dentro un'istruzione, il metro che classifica
per la parola) coprono già la forma incontrata qui.
