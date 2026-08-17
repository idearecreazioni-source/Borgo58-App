# Consegna del 17/08/2026 (prima) — l'uscita ha la sua data, e i filtri

**Commit della consegna: `2af0fb5`** (`I filtri sulle fatture, e un totale
che nessun filtro rimpicciolisce`). Working tree pulito prima di questo
riepilogo. Questa consegna **non modifica** `docs/CONTRATTO.md`.

Copre il **secondo giro del collaudo**, cioè le mancanze sui pagamenti
(n. 6-7-9 del secondo blocco di annotazioni). Il n. 8 — note di credito e
documenti collegati — **non** è in questa consegna: è il lavoro
successivo.

Quattro commit:

| commit | cosa |
|---|---|
| `081b46d` | la migrazione `20260817000001` |
| `77776cb` | i campi in schermata, e la correzione del rifiuto di troppo |
| `9315833` | la prova forte nella verifica della migrazione |
| `2af0fb5` | i filtri sulle fatture (n. 9) |

---

## 0. ⚠️ Perché questo riepilogo arriva in ritardo

La migrazione è stata **applicata in produzione il 17/08 alle 13:11 UTC** e
questo riepilogo è scritto dopo, in una sessione nuova: la precedente si è
saturata prima di scriverlo. È **la stessa violazione del 15/08** (§2 di
`CLAUDE.md`), ed è la rete a rilevarla — `npm run consegne` elencava
`20260817000001` come scoperta, e `migra.mjs` si sarebbe rifiutato di
toccare la produzione al giro successivo.

**Conseguenza sui numeri di questo riepilogo, dichiarata:** l'output della
console di `npm run migra -- --conferma` non è disponibile. I numeri della
tabella §2 sono **riletti adesso dal connettore in sola lettura**, non
copiati da quell'output. Dicono lo stato vero della produzione; non dicono
cosa la migrazione ha stampato mentre girava.

---

## 1. Il difetto, e perché non bastava scrivere la data

🔴 Pagando una fattura con un **assegno a 30 giorni** l'uscita in prima
nota nasceva **oggi**: la cassa scendeva un mese prima che i soldi
uscissero. Alessio conta di usarne una trentina prima dell'apertura —
trenta saldi sbagliati, non un caso di scuola.

⚠️ E la data futura da sola non bastava: `v_cash_balance` sommava **tutti**
i movimenti senza guardarla, quindi un'uscita datata al mese prossimo
avrebbe abbassato il saldo comunque. La data non poteva diventare un dato
a sé senza decidere **cosa conta un saldo**.

**Decisione di Alessio (17/08):** «un saldo risponde a *quanti soldi ho
adesso*, e un assegno che uscirà fra un mese non è ancora uscito». È lo
stesso principio che il gestionale usa dal 15/08 per gli stipendi: **il
costo sta quando nasce, l'uscita quando i soldi escono.**

⚠️ **La strada scartata, agli atti**: scrivere il movimento solo
all'incasso dell'assegno. Non tocca i saldi, ma per un mese la fattura
risulterebbe «pagata» senza nessuna uscita in prima nota — e quello
romperebbe la regola del 16/08 (pagare una fattura *scrive* in prima nota),
che è anche ciò che oggi impedisce di cancellare una fattura pagata. Si
comprerebbe un problema per risolverne un altro.

### Le due condizioni poste da Alessio, entrambe soddisfatte

1. **«Ce la faccio?» legge i movimenti futuri.** Appena si consegna
   l'assegno la fattura risulta pagata e sparisce dalle uscite attese: senza
   quel ramo l'uscita sarebbe invisibile **in tutti e due i posti**, e il
   gestionale direbbe di stare più larghi di quanto si sta.
   ⚠️ **Niente doppio conteggio, per costruzione e non per filtro furbo**:
   un'uscita con `supplier_invoice_id` esiste solo *dopo* che la fattura è
   passata a «pagata», e il primo ramo prende solo le «da_pagare» — i due
   insiemi non possono intersecarsi. La verifica lo controlla **contando le
   righe nei due versi**, non fidandosi di questo ragionamento.
2. **Il saldo che cambia da solo alla mezzanotte va spiegato**, nei due
   versi: `uscite_future()` dice quante uscite non sono ancora nel saldo
   *e* quante ci sono entrate oggi. Senza, la prima volta che succede
   sembra un errore del gestionale.

⚠️ **La condizione sta nel `join`, non in un `where`.** Con un `where` le
entità senza nessun movimento passato **sparirebbero** dalla vista invece
di comparire a zero — e un'entità che scompare è peggio di un saldo a
zero, perché non si vede.

---

## 2. Cosa contiene la migrazione `20260817000001`

| pezzo | cosa |
|---|---|
| `cash_movements.riferimento_pagamento` | il n. dell'assegno, il riferimento del bonifico (n. 6). Distinto da `document_reference`, che identifica il **documento** e non il **pagamento**: servono insieme — la fattura 114 pagata con l'assegno 0004521 |
| vincolo su `supplier_invoices` | l'**assegno** entra fra i metodi ammessi |
| `v_cash_balance` | conta solo i movimenti fino a oggi |
| `uscite_future(entity)` | quante non sono ancora nel saldo, e quante ci sono entrate oggi |
| `movimenti_attesi()` | il ramo delle uscite già registrate e non ancora avvenute |
| `pay_supplier_invoice()` | due parametri nuovi: `p_data_uscita`, `p_riferimento` |

### Stato in produzione, riletto dal connettore

| controllo | valore |
|---|---|
| Migrazioni in produzione | **125** |
| `20260817000001` registrata | sì, 17/08 13:11 UTC |
| Vincolo dei metodi di pagamento | `contante, bonifico, carta, assegno` |
| `cash_movements.riferimento_pagamento` | presente |
| `v_cash_balance` | presente, con la condizione sulla data |
| Movimenti in prima nota | **0** |
| Fatture fornitori | **0** |
| Fornitori `__VERIFICA__` rimasti | **0** |
| Funzioni raggiungibili con la sola chiave pubblica | **10**, invariato |
| Policy dello schema `public` intestate al ruolo `public` | **0** |

⚠️ **Zero movimenti e zero fatture**: la verifica si è ripulita per intero,
e il saldo banca è tornato al valore di partenza (la migrazione lo
controlla come ultima cosa, prima di registrarsi). Ma vuol dire anche che
**niente di tutto questo è mai stato esercitato su dati veri** — vedi §6.

---

## 3. 🔴 Il rifiuto di troppo, tolto su rilievo di Alessio

La prima versione della migrazione **rifiutava** una data di uscita
anteriore alla data della fattura, ragionando che un'uscita precedente al
documento che la giustifica fosse un errore di digitazione.

**È un caso vero**: l'acconto e la caparra si pagano *prima* che la
fattura arrivi, e coi fornitori nuovi non è nemmeno raro. Quel vincolo
avrebbe bloccato un gesto legittimo.

⚠️ E al suo posto **non** c'è una soglia («non oltre N giorni prima»): un
errore di digitazione e un acconto sono indistinguibili da dentro il
database, e una soglia inventata sarebbe una regola scritta da me sui suoi
soldi. Il database rifiuta dove c'è un **invariante**; qui non ce n'è
nessuno — prima è un acconto, dopo è un assegno postdatato, sono entrambe
cose vere. L'avvertenza vive nella **schermata**, che può dire «esce prima
della data della fattura: è un acconto?» e lasciar decidere: informazione,
non divieto.

La verifica ora **prova che l'acconto passa** (controllo n. 7), così
nessuno richiude quel varco domani credendo di correggere un difetto.

---

## 4. La prova forte (commit `9315833`)

La verifica dimostrava che il saldo **non si muove** quando l'uscita è
datata al futuro. ⚠️ Da sola è una prova **debole**: dimostra che la regola
non rompe niente, non che funziona — e coinciderebbe anche se la vista
ignorasse la data del tutto.

La prova forte è quella che produce **lei** la differenza: **lo stesso
movimento**, spostato da domani a ieri, deve entrare nel saldo di
**esattamente** il suo importo (250,00), e rimesso a domani deve
riuscirne. Due numeri che devono divergere di una cifra nota, non due che
devono coincidere.

È la lezione delle mance applicata qui: si misura la differenza che si
produce, non il totale del mondo.

I dieci controlli della verifica, in fila: l'uscita scritta con la sua
data e il suo riferimento · il saldo fermo · **il saldo che si muove di
250 spostando la data** · e di nuovo fermo tornando indietro · l'uscita
futura fra le attese **una volta sola** · la fattura pagata **non** più fra
le attese · `uscite_future()` che la vede · **l'acconto che passa** · il
metodo inventato che si rifiuta · le tre funzioni non raggiungibili da
`anon`.

---

## 5. Le tre schermate toccate

**Fatture Fornitori — il modulo del pagamento** (`77776cb`): tre campi con
la loro etichetta (che prima non c'era, ed era una delle piccolezze in
coda): *come paghi*, *quando escono i soldi*, e il riferimento — che
diventa «N. assegno» quando il metodo è l'assegno. Più le due avvertenze
del §3, che sono informazione e non divieti.

**Cassa — il saldo che cambia da solo** (`77776cb`), nei due versi:
«un'uscita per X non è ancora nel saldo, la prima esce il …» e «oggi sono
entrate nel saldo N uscite per Y: erano state registrate prima».

**Fatture Fornitori — i filtri** (`2af0fb5`, n. 9): fornitore + periodo
**sulla data della fattura**, che è quella che si legge sul documento e
quella che si ricorda («la fattura di marzo»); la scadenza serve a
ordinare, non a cercarci dentro. Governano **entrambe** le liste.

⚠️ **La decisione che conta di tutto il n. 9 non è il filtro: i totali in
alto NON si filtrano.** Un «da pagare» che si rimpicciolisce perché si è
scelto un fornitore somiglia in tutto a un debito più piccolo — e quello è
un numero su cui si decide se pagare o aspettare. Il filtro cambia cosa si
**guarda**, non quanto si **deve**: il debito si chiede a parte, con una
terza interrogazione senza filtri. E la schermata lo **dichiara** («3 di 12
da pagare — i totali in alto restano quelli interi»): senza quella riga, un
elenco corto accanto a un totale grande sembra un errore di somma.

---

## 6. Cosa NON è verificato

- **Nessun assegno vero, nessuna fattura vera.** In produzione ci sono
  **zero fatture e zero movimenti di prima nota**: tutto ciò che è provato
  sta nella verifica della migrazione (10 controlli, coi ruoli veri
  impersonati) e nelle 129 prove automatiche sul progetto di prova.
- **Nessuna mano vera ha aperto le schermate** toccate da questa consegna.
  Il modulo del pagamento coi tre campi, le due avvertenze e la spiegazione
  del saldo in Cassa non sono mai stati letti da Alessio.
- **I filtri non sono stati provati su un elenco lungo**: con zero fatture
  in produzione, la schermata li mostra ma non c'è niente da filtrare. Il
  caso che li giustifica — duecento fatture — è per definizione lontano.
- **Il saldo che cambia alla mezzanotte non è mai stato visto cambiare**:
  richiede un'uscita futura registrata e il passaggio di un giorno vero.
- **`uscite_future()` non è provata dal client** con il token di un utente
  vero: sta nella verifica della migrazione, che gira come proprietaria
  (⚠️ e la lezione del 16/08 dice che un difetto di permessi lì dentro non
  si vedrebbe). `pay_supplier_invoice` invece passa dal corridoio ed è
  esercitata dalle prove sul progetto di prova.

---

## 7. Tre inciampi trovati applicando, nessuno visibile leggendo

- ⚠️ **Il vocabolario dei metodi di pagamento era chiuso in due posti** —
  la funzione e un vincolo su `supplier_invoices`. **Terza ricomparsa**
  della stessa trappola (dopo gli scarichi del 16/08): allargando solo la
  funzione, il primo assegno sarebbe fallito con un errore incomprensibile
  del database. Quello sulla **tabella** è il più importante dei due:
  vale anche per chi scrive dal browser, che la funzione non la passa.
  *Questa ricomparsa è il motivo per cui «la rete sui vocabolari chiusi in
  due posti» è in coda ai lavori del collaudo.*
- ⚠️ `create function` invece di `create or replace` rendeva la migrazione
  **non rieseguibile** (§5 punto 3). Trovato riapplicandola.
- ⚠️ La pulizia della verifica è stata **fermata dal trigger del Blocco 1**,
  e ha fatto bene: un movimento non si toglie finché la fattura dichiara
  «pagata». Si **scollega prima e si cancella dopo**, come i due storni del
  16/08 — nessuna scappatoia nel trigger, che sarebbe anche la strada per
  aggirarlo.

## 8. E due prove corrette, non aggirate

- **`migrazioni-senza-portieri`** accusava questa migrazione di chiamare
  `movimenti_attesi()` al primo livello: erano la sua **intestazione**, il
  suo `drop function if exists` e il suo `grant`. Tre modi di *nominare*
  una funzione senza chiamarla, tutti obbligatori in una migrazione che ne
  scrive una. Un guardiano che grida sul gesto obbligatorio viene spento al
  secondo allarme falso.
- **`tesoreria` e `anticipazioni`** mettevano i movimenti di prova negli
  anni **2095** e **2093** — un marcatore innocuo fino al giorno prima, che
  da questa migrazione in poi li fa **sparire dai saldi**. Spostati nel
  passato (1995, 1993). ⚠️ La lezione generale è in `CLAUDE.md` §8: *in un
  gestionale le date non sono mai un posto neutro dove nascondere qualcosa*
  — prima di usare un valore come etichetta, chiedersi cosa succede il
  giorno in cui qualcuno comincia a interrogare quella colonna.

---

## 9. Stato finale

| | |
|---|---|
| Migrazioni in produzione | **125** |
| Migrazioni nel repository / sul progetto di prova | 125 / 125 |
| Prove automatiche | 39 pure + 129 sul progetto di prova |
| Collaudo, primo giro | chiuso |
| Collaudo, secondo giro (pagamenti) | **n. 6, 7 e 9 fatti; n. 8 aperto** |
