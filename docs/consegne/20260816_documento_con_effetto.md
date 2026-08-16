# Consegna del 16/08/2026 (quinta) — Blocco 1 del mandato di correzione

**Commit della consegna: `ec55d36`.** Questo riepilogo è il commit
immediatamente sopra, sola documentazione. Working tree pulito.

| Commit | Cosa |
|---|---|
| `e0918ab` | un documento che ha generato un effetto non si cancella e basta — migrazione `20260816000005` |
| `ec55d36` | `CLAUDE.md`: la regola fra i pattern, il Blocco 1 chiuso, la trappola di `now()` in transazione |

⚠️ **Ordine seguito** (CLAUDE.md §2, regola 4): commit → push di Alessio →
`npm run migra -- --conferma` → questo riepilogo → secondo push. La
migrazione **`20260816000005` è già applicata in produzione**: i numeri
veri dell'applicazione sono in §7.

⚠️ La Edge Function `operazioni-atomiche` (4 operazioni nuove) **non era
installabile prima di questo riepilogo**: `npm run funzione` si è rifiutato
di toccare la produzione con la migrazione ancora non documentata. È la
rete del 16/08 che ha funzionato per la prima volta su un caso vero, ed è
il motivo per cui l'installazione è dichiarata in §7 e non prima.

⚠️ Questa consegna **non modifica** `docs/CONTRATTO.md`.

È il **Blocco 1 del mandato di correzione**
([`docs/mandati/MANDATO_CORREZIONE.md`](../mandati/MANDATO_CORREZIONE.md)).
Il Blocco 0 era già chiuso (`20260816_i_riepiloghi_arretrati.md` e la rete
in `scripts/migra.mjs`).

---

## 1. Il difetto, e perché i tre esemplari sono lo stesso difetto

| Cosa si cancellava | Cosa restava |
|---|---|
| Fattura fornitore **già pagata** | L'uscita in prima nota, senza più il documento che la giustifica |
| Nota «di tasca mia» **già rimborsata** | Il rimborso in prima nota, senza più il perché |
| Cessione intercompany col **costo aggiornato** | L'ingrediente valorizzato al prezzo di trasferimento, più la sua riga nello storico prezzi |

Le tre porte erano diverse — `delete_supplier_invoice` era una funzione
del database che semplicemente non sapeva del movimento nato quattro
giorni dopo di lei; `deleteAnticipazione` e `deleteCession` erano due
`delete` diretti dal browser — ma il difetto è uno solo, ed è la forma che
il mandato descrive: **una promessa scritta in un posto e non mantenuta in
un altro.**

**La regola, scritta una volta sola:**

> Un documento che ha generato un effetto altrove o è **respinto**, con un
> messaggio che dice cosa lo impedisce e cosa fare prima, oppure **storna
> anche l'effetto nella stessa transazione**. Non esiste il terzo caso.

---

## 2. Quale delle due strade, caso per caso — e perché

**Fattura pagata → RESPINGI.** Il denaro è uscito davvero. «Ho sbagliato a
registrare la fattura» e «ho sbagliato a segnarla pagata» sono due
decisioni diverse, e farle prendere insieme a un pulsante «Rimuovi»
significa cancellare un'uscita di cassa per sbaglio. Il messaggio porta
**importo e data** del movimento, non un generico «questa fattura ha un
movimento»: senza i numeri, chi legge non sa quanto denaro resterebbe
senza giustificazione.

**Nota rimborsata → RESPINGI**, stesso motivo: il rimborso è denaro uscito
dal cassetto.

**Cessione col costo aggiornato → STORNA.** Qui non si muove nessun euro:
l'effetto è un numero derivato (il costo dell'ingrediente) più una riga di
un registro. Respingere avrebbe creato un **vicolo cieco senza gesto di
uscita** — non esiste un «annulla l'aggiornamento del costo» — e l'unica
alternativa sarebbe stata chiedere ad Alessio di ridigitare a mano il
prezzo di prima, cioè di **inventare un numero**.

⚠️ **Entrambi i rifiuti hanno la loro via di ritorno, e non è un di più:**
un rifiuto senza gesto d'uscita è precisamente il difetto n. 8 del
mandato (Blocco 5.2). `annulla_pagamento_fattura` riporta la fattura a
«da pagare», **riapre il promemoria in Agenda** e toglie l'uscita;
`annulla_pareggio_anticipazione` riapre la nota e toglie il rimborso.

⚠️ **Lo storno CANCELLA la riga dello storico prezzi, non ne aggiunge una
di segno opposto.** La sorveglianza dei rincari (12/08) confronta l'ultimo
prezzo col precedente: un prezzo di trasferimento lasciato in storico da
una cessione che non esiste più avrebbe fatto segnalare, al primo acquisto
vero, **un rincaro mai avvenuto** — cioè un allarme che grida per una cosa
normale, che è il modo in cui si smette di leggere gli allarmi.

⚠️ **E il costo torna all'ULTIMA RIGA RIMASTA nello storico**, con una
regola sola che copre i due casi senza distinguerli: se dopo la cessione
era arrivato un acquisto vero, quell'acquisto è ancora l'ultima riga e il
costo **non si muove**; se non era arrivato niente, si torna al prezzo di
prima. Se non resta nessuna riga — cioè se quella cessione era l'unica
cosa che avesse mai detto quanto costa quell'ingrediente — la
cancellazione **è respinta** dicendo di scrivere prima il prezzo a mano:
mettere zero direbbe «gratis», ed è lo scarto a zero un'altra volta.

---

## 3. Il difetto era anche nello schema, non solo nelle funzioni

I due legami verso `supplier_invoices` erano **`on delete set null`**:
cancellare la fattura non falliva, **scollegava**. Il difetto era scritto
nello schema, e nessuna funzione del database può curarlo da sola finché
lo schema dice il contrario. Ora sono **`restrict`**:

| Vincolo | Prima | Ora |
|---|---|---|
| `cash_movements_supplier_invoice_id_fkey` | `set null` | `restrict` |
| `anticipazioni_socio_supplier_invoice_id_fkey` | `set null` | `restrict` |

Il secondo non era nell'elenco del mandato ed è la stessa regola: finché
la nota punta alla fattura vale **solo come debito** verso il titolare;
scollegata diventa **anche un costo**, e la stessa spesa risulterebbe
contata due volte senza che niente lo segnali. `delete_supplier_invoice`
respinge anche questo caso, con la sua frase.

---

## 4. La stessa regola allo specchio — trovata guardando, non nel mandato

Da **Prima Nota** si cancellava il **movimento**, lasciando la fattura a
dichiarare «pagata» senza un euro uscito e il saldo di tesoreria sbagliato.
È l'inverso esatto del difetto n. 10, e la revisione non lo nominava.

Il trigger `trg_movimento_con_documento` (before delete su
`cash_movements`) rifiuta la cancellazione di un movimento a cui un
documento punta, **e dice quale gesto usare al suo posto**. Sul rimborso
di un'anticipazione quel rifiuto esisteva già — ma come violazione del
vincolo `anticipazione_pareggio_coerente`, cioè un errore illeggibile per
chi lo riceveva.

⚠️ **Come fanno a passare i due gesti di storno**, che devono cancellare
proprio quei movimenti: **scollegano prima e cancellano dopo**. Non c'è
nessuna scappatoia nel trigger — una scappatoia sarebbe anche la strada
per aggirarlo. Sull'anticipazione l'ordine è **costretto da due vincoli
che tirano in direzioni opposte**: il `check` pretende che `pareggiata_il`
e `movimento_id` nascano e muoiano insieme, il trigger rifiuta finché la
nota punta al movimento. Quindi prima si riapre la nota, poi si toglie
l'uscita, e non c'è un altro ordine possibile.

⚠️ **Fuori perimetro, dichiarato:** il movimento della **differenza di un
conteggio di cassa** (`conteggi_cassa.movimento_id`) resta cancellabile.
Bloccarlo senza dare un «annulla il conteggio» avrebbe creato un vicolo
cieco nuovo, ed è materia del Blocco 5.2 — dove l'elenco dei vicoli
ciechi va chiuso dando la via di ritorno, non l'avviso.

---

## 5. Il difetto mio, trovato applicando e non leggendo

`create_intercompany_cession` deve annotare **quale** riga dello storico
ha scritto (colonna nuova `intercompany_cessions.price_history_id`), e
`update_ingredient_price` restituisce `void` — resta l'unico posto che
scrive un prezzo (regola 6 del mandato), quindi la riga si **rilegge**
invece di duplicarne la `insert`.

La prima versione rileggeva «l'ultima riga di questo ingrediente». **È
sbagliato**, e la prova sul progetto di prova si è fermata da sola:
`price_history.recorded_at` vale `now()`, che **dentro una transazione è
un istante solo**. Due righe scritte insieme pareggiano, l'ordinamento ne
sceglie una a caso, e lo storno avrebbe cancellato la riga sbagliata
lasciando in piedi il prezzo di trasferimento — cioè **la correzione
avrebbe riprodotto il difetto che chiude**. Ora la riga si riconosce dalla
firma esatta (ingrediente + `cessione_interna` + prezzo + nota con la
data).

⚠️ **Conseguenza sulla verifica**, dichiarata perché è una scelta e non
una svista: dentro il blocco di verifica i prezzi vengono **datati
indietro a mano**, altrimenti pareggiano tutti e non sarebbe lo storno a
essere provato ma il caso in cui l'ordinamento indovina. Nella vita vera i
prezzi arrivano in transazioni diverse e si ordinano da soli.

⚠️ **Limite che resta, e che questa migrazione non introduce**:
l'ambiguità di due prezzi dello stesso ingrediente scritti nella stessa
transazione (una fattura che porta due volte lo stesso prodotto) esiste
già in tutto il progetto — `variazione_prezzo()` ordina anch'essa per
`recorded_at`. Qui è chiusa solo dove conta per lo storno.

---

## 6. Cosa è stato verificato, e come

**Dentro la migrazione, col ruolo vero del titolare** (`set_config` su
`request.jwt.claims`), tutti e tre i casi nei due versi:

| # | Cosa | Esito |
|---|---|---|
| 1a | Fattura pagata: `delete_supplier_invoice` | respinta, e il movimento non è stato toccato |
| 1b | Il suo movimento cancellato da Prima Nota | respinto dal trigger |
| 1c | `annulla_pagamento_fattura` | fattura a «da pagare», uscita sparita, **promemoria tornato «da fare»**, movimento nel registro delle cancellazioni |
| 1d | Fattura non più pagata: cancellazione | riuscita |
| 2a | Nota rimborsata: `delete_anticipazione` | respinta |
| 2b | Il rimborso cancellato da Prima Nota | respinto dal trigger, **con il messaggio nostro e non con la violazione grezza del `check`** |
| 2c | `annulla_pareggio_anticipazione` | nota riaperta, uscita sparita |
| 2d | Nota aperta: cancellazione | riuscita |
| 3a | Cessione cancellata | riga di storico sparita, costo tornato da 9,00 a 2,00 |
| 3b | Cessione cancellata **dopo** un acquisto più recente | costo fermo a 3,30 — lo storno non calpesta l'acquisto |

Il caso **3b** è quello che uno storno ingenuo sbaglierebbe **senza che
nessuno se ne accorga**, ed è il motivo per cui è provato.

⚠️ **Ogni rifiuto atteso è provato in un `begin…exception` annidato, e il
blocco esterno non ha nessun gestore**: uno intorno a tutto inghiottirebbe
anche il fallimento delle proprie assertion, e la migrazione passerebbe
verde con la verifica rotta (lezione del 15/08).

⚠️ **Il perimetro della verifica è fatto solo di roba che la verifica ha
creato** — ingrediente proprio compreso, non «uno qualunque se ce n'è»
(lezione del 16/08 mattina, dove FEFO prese dal lotto vero e la giacenza
vera restò corta di 2). E si ripulisce anche `deleted_records`: girando
come proprietaria, le sue lapidi non devono restare nel registro.

**Prove automatiche:** 3 nuove in `tests/app/documento-con-effetto.test.js`,
che esercitano il giro **attraverso il corridoio** — quello che le prove
sul database non coprono: un'operazione non ammessa nell'elenco del
corridoio risponde 404 e nessuna prova SQL se ne accorge. Suite intera:
**18 pure + 101 sul progetto di prova, tutte verdi.** Lint a zero, build ok.

⚠️ **Perché fatture e cessioni non sono nella suite automatica**: provarle
da lì vorrebbe dire creare e poi cancellare fatture e cessioni, cioè
lasciare **lapidi di prova in `deleted_records`**, che è la cosa che
`tests/app/LEGGIMI.md` vieta. Stanno solo dentro la migrazione, che gira
come proprietaria e quel registro se lo ripulisce.

**Idempotenza:** la migrazione è stata applicata **due volte di fila** sul
progetto di prova (§5 punto 3), la seconda senza errori.

---

## 7. I numeri veri dell'applicazione in produzione

Applicata il 16/08/2026 con `npm run migra -- --conferma`, dopo il push di
Alessio del commit `e0918ab`.

```
applicate e registrate: 1 su 1
totale migrazioni in produzione: 112
```

Stato letto **col connettore in sola lettura, dopo**:

| Controllo | Valore |
|---|---|
| `cash_movements → supplier_invoices` | `r` (restrict) |
| `anticipazioni_socio → supplier_invoices` | `r` (restrict) |
| Trigger `trg_movimento_con_documento` | 1, presente |
| Ingredienti/fornitori residui della prova | 0 / 0 |
| Righe di storico prezzi | **26, invariate** |
| Movimenti di cassa | 0 |
| Funzioni di `public` eseguibili col solo `anon` | **12, invariate** |
| Cessioni con il filo allo storico | 0 (non ce n'è nessuna) |

**Nessun dato di Alessio è cambiato**, e non poteva: prima
dell'applicazione la produzione aveva **0 cessioni, 0 anticipazioni, 0
fatture e 0 movimenti di cassa** — letto col connettore *prima* di
scrivere la migrazione, non dopo. È anche il motivo per cui la colonna
nuova `price_history_id` non ha risposto al posto di nessuno (lezione del
14/08): non c'era nessuna riga su cui rispondere.

**Edge Function:** `operazioni-atomiche` installata in produzione dopo
questo riepilogo, con le 4 operazioni nuove (`delete_anticipazione`,
`annulla_pareggio_anticipazione`, `annulla_pagamento_fattura`,
`delete_intercompany_cession`). Prima installata sul progetto di prova
(versione 7 → 8) e provata lì.

⚠️ **`delete_anticipazione` tocca una tabella sola e passa comunque dal
corridoio**: il mandato chiede che il controllo stia nella funzione e che
la funzione si chiami dal corridoio, perché è la forma che rende l'elenco
delle cancellazioni controllabile. Dichiarato qui perché non sembri una
svista.

---

## 8. Cosa NON è verificato

- **Niente è stato toccato da una mano vera.** Non esistono fatture, note
  «di tasca mia» né cessioni nel database del locale: i tre pulsanti nuovi
  («Annulla il pagamento», «Annulla il rimborso», e il rifiuto con la sua
  frase) non sono mai comparsi su uno schermo.
- **Il caso «l'unica riga di storico»** (cancellare una cessione che è
  l'unica cosa che abbia mai valorizzato quell'ingrediente) è scritto e
  non provato: `create_ingredient` scrive sempre una riga iniziale, quindi
  nella verifica quel ramo non si raggiunge. È una guardia contro un
  ingrediente arrivato da un percorso più vecchio.
- **La strada di riserva per le cessioni anteriori a questa migrazione**
  (riconoscere la riga di storico dalla firma quando `price_history_id` è
  nullo) non è provata, perché in produzione di cessioni anteriori non ce
  n'è nessuna. Esiste per un ripristino da una copia vecchia.

---

## 9. Osservazione fuori consegna, per chi controlla

Nel registro delle cancellazioni di produzione ci sono **3 righe lasciate
dalla verifica di `20260816000003`** (`tips_collected` ×2,
`tip_distributions` ×1, tutte delle 11:41 del 16/08). Non sono di questa
consegna e non le ho toccate: sono lapidi di prova in un registro che
nessuno può ripulire dall'app. Vale la pena decidere se ripulirle con una
migrazione, perché un registro delle cancellazioni con dentro roba finta è
lo stesso problema di una riga finta in prima nota — solo più difficile da
notare.

---

## 10. Criteri di accettazione del Blocco 1

> *«Dopo la correzione non deve esistere nessun percorso, in nessuna
> schermata, che lasci un movimento di cassa o un costo aggiornato senza
> il documento che lo giustifica.»*

Censimento delle porte di cancellazione su queste tabelle, fatto a mano
sul codice client (`grep` di `.delete()` su `src/lib/api/`):

| Porta | Stato |
|---|---|
| `deleteSupplierInvoice` | passa da `delete_supplier_invoice`, che respinge |
| `deleteAnticipazione` | ora passa da `delete_anticipazione`, che respinge |
| `deleteCession` | ora passa da `delete_intercompany_cession`, che storna |
| `deleteCashMovement` (Prima Nota) | scrittura diretta, ma il **trigger** la respinge quando un documento punta al movimento; l'errore è già mostrato in schermata |
| Cancellazione dell'ingrediente | `price_history` va in cascata, e con essa il costo; **fuori perimetro**, e nessuna schermata cancella ingredienti con cessioni collegate perché di cessioni non ce n'è |

Nessun'altra porta esiste: `.delete()` su tabelle di soldi compare solo in
`cash.js` (sopra) e su `recipe_ingredients`, che non è una tabella di
soldi.
