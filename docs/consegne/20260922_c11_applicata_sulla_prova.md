# C11 applicata sul progetto di prova — 22/09/2026

| | |
|---|---|
| **Richiesta** | C11 — l'etichetta «investimento» e il costo del progetto |
| **Proposta** | [#121](https://github.com/idearecreazioni-source/Borgo58-App/pull/121), **unita in `slave`** (commit di unione `15de9fd`) |
| **Migrazione** | `20260921000003_l_etichetta_investimento` |
| **Applicata su** | **solo `Borgo58-Prova`** |
| **Produzione** | **esclusa** — non toccata, e dove sia arrivata la migrazione lo dice `npm run migra` |

---

## Come è stata applicata

Con il comando protetto del progetto, nominando la migrazione:

```
npm run prova:migra -- 20260921000003
```

Nessun SQL scritto a mano. Prima di lanciarlo sono state controllate quattro
cose, tutte in sola lettura:

* il collegamento nomina **Borgo58-Prova** e **non** il gestionale vero — la
  guardia `soloProva()` del progetto, più il confronto col riferimento del
  progetto di prova;
* l'**unica** migrazione pendente era `20260921000003`;
* nessun altro lavoro in corso sul progetto di prova;
* cartella pulita, `slave` locale e remoto sul commit di unione di #121.

⚠️ Nessuna credenziale e nessun valore di configurazione è stato aperto,
stampato o copiato.

---

## Cosa ha detto la migrazione applicandosi

La sua verifica interna è passata per intero, e la riga che stampa lo dice:

> *l'etichetta esiste e nasce spenta, un'entrata non la può portare (nemmeno
> dopo), una riga scritta dal gestionale nemmeno, marcare e smarcare non tocca
> nessun altro dato, e i tre soggetti restano separati col dettaglio che
> compone i totali. Provato nei due versi e annullato: zero residui.*

⚠️ **È la prima volta che quelle regole toccano un database.** Fino a ieri
erano scritte e rilette, non provate: i due vincoli, i tre trigger e le due
funzioni non avevano mai risposto a nessuno.

---

## Le verifiche dopo, in sola lettura

| cosa | esito |
|---|---|
| `20260921000003` registrata | sì, ed è l'ultima del registro |
| migrazioni pendenti sulla prova | **nessuna** |
| file di migrazione e registrate | **stesso numero** |
| `cash_movements.e_investimento` | `boolean`, `not null`, predefinito `false` |
| `anticipazioni_socio.e_investimento` | **stessa forma**, identica |
| righe preesistenti marcate | **nessuna**, su tutt'e due le tabelle |
| vincolo `investimento_solo_su_uscita` | presente e **validato**, con la sua frase italiana |
| `trg_guardia_investimento` | presente, **attivo**, `before insert or update`, **senza filtro di colonna** |
| `trg_guardia_investimento_anticipazione` | presente, **attivo**, stessa forma |
| `costo_del_progetto` · `righe_costo_del_progetto` | presenti, `security definer`, **chiuse ad `anon`**, aperte ad `authenticated`, col portiere dentro |
| `guardia_investimento` · `guardia_investimento_anticipazione` | `security definer`, **porta chiusa**: non eseguibili né da `anon` né da `authenticated` |
| residui delle verifiche interne | **nessuno** — zero righe, zero motivi, zero fornitori, zero fatture di prova |
| altre migrazioni applicate | **nessuna** |

### Le due proprietà di merito, lette dal corpo vivo

* **Il rimborso non aggiunge e non toglie costo**: `costo_del_progetto`
  **non nomina `pareggiata_il`** nel proprio codice. È così che «prima e dopo
  il rimborso» è lo stesso numero per costruzione, invece che per una regola
  da ricordare. ⚠️ `righe_costo_del_progetto` invece lo nomina, ed è giusto:
  è la colonna che **mostra** lo stato del rimborso nel dettaglio.
* **La stessa fattura non si conta due volte**: le due guardie si guardano a
  vicenda sullo stesso `supplier_invoice_id` — `guardia_investimento` cerca
  fra le anticipazioni, `guardia_investimento_anticipazione` fra i movimenti.

---

## 🔴 Un misuratore che ha mentito, e la correzione

Il primo controllo su «il rimborso non muove il costo» ha risposto **che
`costo_del_progetto` nomina `pareggiata_il`** — cioè il contrario del vero.

Il difetto era **nel metro**: cercava la parola nel testo intero della
funzione, e la trovava **dentro il commento che spiega perché non c'è**. È la
trappola del 27/08 — *un setaccio che cerca una forma nel testo trova anche
chi la nomina per spiegarla*.

Rimisurato togliendo i commenti, come fa la prova pura, la risposta è
**false**. ⚠️ E il metro corretto è stato provato su due casi di risposta
nota prima di fidarsene: una parola inventata → `false`, `e_investimento` →
`true`. *Un misuratore nuovo si prova su un caso di cui si conosce già la
risposta.*

---

## Cosa NON è stato fatto

* 🔴 **Nessun collaudo con le mani, e nessun dato creato per guardare.** Non
  sono stati registrati movimenti, note o fatture sul progetto di prova: tutto
  ciò che è provato lo è dalla verifica della migrazione — che vive in una
  sotto-transazione annullata — e dalle prove automatiche.
* 🔴 **La pagina «Quanto è costato il progetto» non è stata aperta in un
  browser.** Entrarci vuol dire fare l'accesso, e l'accesso vuol dire aprire
  le credenziali del progetto di prova, che questo mandato vieta. Al posto suo
  c'è la prova che *la causa dell'errore di schema è sparita*: le due funzioni
  esistono, sono eseguibili da `authenticated`, e **la suite che entra dal
  collegamento vero dell'app** contro il progetto di prova — quella che si
  autentica col ruolo del titolare e parla col database come parla una
  schermata — è stata rilanciata **dopo** l'applicazione ed è tutta verde
  (81 file, 571 prove, il 22/09; è una fotografia, e il numero invecchia).
  ⚠️ **Non è la stessa cosa che vederla**: se quella pagina sia leggibile, e
  se il segno «anticipo» si distingua da quello «investimento» con la luce del
  locale, resta un giudizio di Alessio.
* **Niente in produzione**: nessuna lettura, nessuna scrittura, nessuna
  migrazione.

---

## Cosa resta

L'applicazione in **produzione**, col giro di sempre — e **non è una
formalità**: è il momento in cui l'etichetta comincia a valere sui dati veri.
Prima di allora, quello che Alessio vede sul gestionale vero non è cambiato.
