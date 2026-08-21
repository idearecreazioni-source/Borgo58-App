# Blocco A — da un conto aperto si può uscire

**21/08/2026** · **nessuna migrazione**: il difetto era tutto nella schermata.

---

## 1 · Il difetto, e perché non era quello che sembrava

Il sintomo era *«il tavolo col conto aperto non si spegne»*. La misura ha
spostato il centro:

🔴 **Non esisteva nessuna uscita da un conto aperto.** Il conto lasciava lo
schermo in **due soli punti**, entrambi definitivi:

| | |
|---|---|
| **Chiudi conto** | incassa |
| **Annulla conto** | e **solo se non è stato inviato niente in cucina** |

⚠️ **Quindi in servizio, dopo la prima comanda mandata, l'unica via per
togliersi dallo schermo un tavolo aperto per sbaglio era incassarlo.**

Il tavolo che non si spegneva era il sintomo: si vedeva acceso perché il suo
**conto** era aperto, non perché fosse selezionato — e il tocco sul vuoto
agisce sulla selezione, che lì era già vuota.

⚠️ **Colorare i due stati in modo diverso non l'avrebbe curato**: il tavolo
si sarebbe visto di un altro colore e sarebbe rimasto ugualmente inchiodato
lì. *«L'ho scelto» sa annullarsi; «ci sto lavorando dentro» non aveva proprio
un modo di finire.*

---

## 2 · Le tre decisioni di Alessio, e come sono state costruite

### La riga in cima, non il tocco sul pavimento

```
‹ Lascia T6 aperto
```

⚠️ **La parola conta più della posizione**: in sala «chiudere» vuol dire
incassare, e quella parola su quel pulsante costerebbe un incasso. La riga
dice **«Lascia … aperto»** e nomina il tavolo, così chi legge sa da cosa sta
uscendo.

⚠️ **Perché non il pavimento**: tenendo il tablet con due mani il pavimento
della sala è a portata di gomito, e un'uscita accidentale da un conto in
corso costa più di un gesto in più.

### La modalità veloce

Toccando un altro tavolo mentre un conto è aperto, il conto **si lascia e si
passa al nuovo in un gesto solo** — sia che il tavolo abbia già un conto, sia
che sia libero.

### 🔴 I due pannelli non possono più convivere — ed è la parte strutturale

Alessio se li è visti insieme sul tablet: **«Divano 3 · Apri il tavolo»**
sopra e **«COMANDA IN CORSO — T3»** col totale e *Chiudi conto* sotto.

La causa: le due parti comparivano per conto proprio — una se c'era una
selezione, l'altra se c'era un conto — e **nessuna sapeva dell'altra**.

Adesso decide **una risposta sola** (`cosaSiVede`): *conto*, *selezione*, o
*sala*. ⚠️ **Non è una regola da rispettare: è un caso che non esiste più.**
Due `if` coordinati si scoordinano; una risposta sola no.

⚠️ **E il conto si lascia PRIMA, mai dopo**: il pannello vecchio sparisce
prima che il nuovo compaia. Due comande davanti agli occhi in servizio sono
il modo più diretto per mandare i piatti di un tavolo a un altro — **un
errore che si scopre dalla cucina, non dallo schermo**.

---

## 3 · Due casi che il mandato non nominava, decisi e dichiarati

- **Toccare il tavolo del conto che si sta già guardando: non fa niente.**
  L'uscita è la riga, non il tocco — stessa ragione del pavimento.
- 🔴 **Mentre si SPOSTA un conto su altri tavoli, il conto NON si lascia
  mai.** Lì la selezione serve a dire *dove* lo si sposta: lasciarlo a metà
  del gesto perderebbe proprio la cosa che si sta spostando. **Senza questa
  eccezione la modalità veloce avrebbe rotto lo spostamento**, che è un gesto
  che funzionava.

---

## 4 · Dove vive la regola

Tutto in **`src/lib/calcoli/selezione.js`**, accanto al blocco 1:
`cosaSiVede` e `esitoDelTocco`. **17 prove** in tutto (8 del blocco 1, 9
nuove).

⚠️ **Ci stava**, ed è la risposta alla domanda del mandato: la regola non è
sul conto — è su **quale dei due pannelli si vede** e su **cosa fa un tocco**.
Sono decisioni di gesto, e il gesto è ciò che `selezione.js` già governa.

### Rotte apposta, due volte

| rottura | cosa dice il rosso |
|---|---|
| i pannelli tornano a convivere | *expected 'selezione' to be 'conto'* |
| il conto si lascia anche spostando | *expected true to be false* |

**Una prova ciascuna**, ed è la prova giusta: non cadono a grappolo, quindi
ognuna misura una cosa sola.

---

## 5 · Cosa non è verificato

- 🔴 **Nessuna mano ha ancora toccato la riga d'uscita.** Le 17 prove
  misurano la regola, non il gesto: quello che *non* è provato è che la riga
  si veda, che si prema con un dito, e che il pannello vecchio sparisca
  davvero prima del nuovo.
- ⚠️ **Lo spostamento di un conto non è stato riprovato a mano** dopo la
  modifica — è il gesto che l'eccezione protegge, e l'eccezione è nuova.
- ⚠️ **I colori sono ancora quelli vecchi.** Il terracotta al posto del
  marrone è atteso: la tavolozza è il blocco B, e non l'ho anticipata.

---

## 6 · Cosa abbiamo rovesciato

**Niente.**

⚠️ La convivenza dei due pannelli non era una decisione: era il risultato di
due condizioni indipendenti scritte in momenti diversi, nessuna delle quali
sapeva dell'altra. **Non si rovescia una scelta — si chiude un caso che
nessuno aveva mai considerato.**

⚠️ E la mancanza dell'uscita **nemmeno**: non è che qualcuno avesse deciso
che da un conto non si esce. È che il gesto non è mai stato scritto, e per
tre settimane nessuno l'ha cercato perché nessuno aveva mai aperto il tavolo
sbagliato. *Il buco l'ha trovato il primo collaudo con le mani in servizio.*
