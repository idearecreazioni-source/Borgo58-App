# Consegna del 17/08/2026 (seconda) — la nota di credito

**Commit della consegna: `d9875fa`** (`Togliere una nota di credito storna un
numero: va detto, non subito`). Working tree pulito prima di questo
riepilogo. Questa consegna **non modifica** `docs/CONTRATTO.md`.

Chiude il **n. 8 del secondo blocco del collaudo** — note di credito e
documenti collegati — e con lui il secondo giro (n. 6, 7, 8, 9).

Due commit di lavoro:

| commit | cosa |
|---|---|
| `9ff198d` | la migrazione `20260817000002`, le schermate, la prova dal client |
| `d9875fa` | lo storno che si annuncia, e il difetto che ha scoperto |

Più il corridoio `operazioni-atomiche` (**produzione: versione 28 → 29**,
progetto di prova 11 → 12) con due operazioni nuove.

---

## 1. La regola, come l'ha decisa Alessio (strada A)

- **La nota di credito riduce il pagamento.** Fattura 250 con nota 40 → si
  paga 210, e il movimento in prima nota è di **210**.
- **Ogni schermata dice tutti e tre i numeri**: «fattura 250 · nota −40 · da
  pagare 210». Mostrarne uno solo farebbe sembrare che manchino 40 euro.
- **Se la nota arriva dopo il pagamento diventa un credito** da usare sulla
  fattura successiva di quel fornitore, mostrato accanto al «da pagare» e
  proposto quando si paga.

⚠️ **Le due cose sono diverse solo per QUANDO la nota arriva**, e il
gestionale fa l'una o l'altra da sé: su una fattura ancora da pagare la
scala subito (chiedere un secondo gesto vorrebbe dire che prima o poi
qualcuno pagherebbe l'importo pieno con la nota registrata accanto); su una
già pagata non riscrive nulla.

### Perché due tabelle e non una

`note_credito.fattura_id` è **la fattura che la nota corregge** — il
documento. `note_credito_utilizzi` è **dove la nota si scala davvero**.

Sono due domande diverse, e la seconda ha più di una risposta possibile: una
nota da 100 su una fattura da 60 lascia **40 da usare altrove**. Con una
colonna sola quei 40 sparirebbero in silenzio, e perdere soldi in silenzio è
la classe di difetto che questo progetto insegue da giorni.

---

## 2. 🔴 Il difetto più grosso non era in elenco

**Una fattura pagata era contata DUE VOLTE fra i costi dell'anno.**

`rettifiche_fiscali` e `costi_da_classificare` sommano le uscite di prima
nota **e** le fatture fornitori. Ma dal 13/08 pagare una fattura **scrive**
un'uscita in prima nota; quell'uscita non ha causale, quindi il filtro sulle
causali di sistema non la toccava, e nessun altro filtro la escludeva.

⚠️ **La guardia esisteva per le anticipazioni** («con fattura è già contata
lì») **e non per il caso più comune di tutti.** In produzione non c'è ancora
nessuna fattura pagata: sarebbe comparso col **primo pagamento vero**, e
sarebbe comparso nel modo peggiore — non come un errore visibile, ma come
una stima delle imposte più bassa del dovuto.

⚠️ **E la cura non è solo anti-doppione: è la COMPETENZA.** Il costo sta alla
data della fattura, l'uscita quando i soldi escono — lo stesso principio
degli stipendi (15/08) e degli assegni postdatati (ieri). Una fattura di
dicembre pagata a gennaio è un costo di dicembre, e contando il movimento
sarebbe finita nell'anno dopo.

⚠️ **La nota di credito entra come costo NEGATIVO con la sua data**, non
abbassando l'importo della fattura: se lo abbassasse, una nota arrivata
l'anno dopo cambierebbe i costi di un anno già chiuso. Ed eredita
`in_contante` dalla fattura corretta — senza, una regola che vieta il
contante azzererebbe la quota della fattura e la nota sottrarrebbe da zero,
lasciando un **deducibile negativo**.

### La prova che misura una differenza

Togliendo il filtro sul progetto di prova, la verifica si è fermata da sola:

```
ERROR: Pagare una fattura ha cambiato i costi dell'anno da 220.00 a 430.00:
       il costo e' contato due volte.
```

e la prova dal client è diventata rossa con una differenza di **esattamente
128,44** — l'importo della fattura pagata dello scenario. Rimesso il filtro,
verdi tutte e due. Non è un controllo che «passa»: è un controllo che
produce lui la differenza e la misura.

---

## 3. Il taglio a cascata vive in un posto solo

`crediti_da_applicare(fattura, note[])` decide quanto di ogni credito si
usa. `anteprima_pagamento` e `pay_supplier_invoice` chiamano **quella**, e
la schermata non fa nessun conto.

⚠️ **Perché non è un dettaglio**: due crediti da 30 su una fattura da 40 si
applicano per **40** in tutto — il secondo prende solo quello che il primo
ha lasciato. Una somma fatta in JavaScript direbbe «usciranno −20», cioè
mentirebbe **proprio nel momento in cui uno guarda prima di confermare**.

L'ordine di applicazione è dichiarato e stabile (la nota più vecchia per
prima, a parità di data l'identificativo): senza un ordine, la stessa scelta
darebbe risultati diversi da un giro all'altro.

---

## 4. Le altre decisioni, e i loro prezzi dichiarati

**Netto zero → nessun movimento in prima nota.** Una fattura coperta per
intero da una nota non fa uscire un euro, e una riga da 0,00 sarebbe
un'uscita che non è avvenuta. ⚠️ **Il prezzo**: `quadratura_pagamenti`
avrebbe segnalato «pagata senza movimento» per sempre. Corretta **nella
stessa migrazione** — un allarme permanente su un caso normale è un allarme
che si impara a spegnere. *(È la regola del 15/08: quando una tabella smette
di contenere una cosa sola, chi la legge si corregge lì dentro.)*

**Annullare il pagamento libera i crediti PRESI IN PRESTITO** da altre
fatture e **lascia scalata la nota che corregge quella fattura**. Regola
confermata da Alessio con la sua ragione: *lo storno del fornitore è un
fatto vero e annullare il pagamento non lo cancella; il credito preso in
prestito invece non è stato consumato, perché il pagamento non è avvenuto.*

**«Ce la faccio?» aspetta il netto**, e una fattura coperta per intero non
compare affatto: aspettarsi 250 quando ne usciranno 210 fa stare più
stretti del necessario, e una previsione che sbaglia sempre nella stessa
direzione si smette di guardare.

**Il DDT è meccanica**: `documents.supplier_invoice_id`, un collegamento e
basta. ⚠️ **`on delete set null` qui è giusto**, e la distinzione va scritta
perché il 16/08 lo stesso `set null` **era** il difetto: là erano l'uscita
in prima nota e la nota «di tasca mia», cioè righe che **contano** nei
conti, e scollegarle cambiava i numeri in silenzio. Un DDT non partecipa a
nessun calcolo.

**La lapide sta su `note_credito` e non sugli utilizzi**: una nota di
credito è un documento fiscale; un utilizzo è la meccanica
dell'applicazione, e annullare un pagamento ne cancella. Una lapide per ogni
annullamento riempirebbe il registro di righe normali, che è il modo in cui
un registro smette di essere letto.

---

## 5. 🔴 Il difetto trovato applicando, e il motivo per cui nessuna prova lo vedeva

**Togliere una nota scalata su una fattura ancora da pagare falliva.**

La cancellazione della nota porta via l'utilizzo **in cascata**; quando il
trigger di controllo girava, la nota non c'era più, e il gesto si fermava
con *«Nota di credito inesistente»*. Era **il primo gesto che si fa dalla
schermata** — il pulsante «togli».

⚠️ **E la prova sulla cancellazione esisteva.** Girava sul caso di una nota
**non ancora scalata**, dove non c'è nessun utilizzo da portare via: quindi
passava, e passava per il motivo sbagliato.

> **Lezione, nelle parole di Alessio (17/08)**: *una prova che gira sul caso
> vuoto dimostra che il codice non esplode, non che funziona. È la stessa
> forma di «misurare una coincidenza invece di una differenza», solo dal
> lato dei dati invece che dei numeri. Il caso da provare è quello che ha
> qualcosa da fare.*

È il **terzo caso in due giorni**, dopo il confronto dei saldi senza
movimenti futuri (ieri) e la prova delle mance che pretendeva 40 e 60 su un
database vuoto. Scritto in `CLAUDE.md` §8 accanto all'altra.

**La cura**: su una cancellazione il trigger non cerca più la nota — i suoi
controlli riguardano ciò che si sta **scrivendo** — ma continua a guardare
lo stato della fattura, che è il caso che protegge i soldi già usciti.

⚠️ **E quel divieto sta nel TRIGGER, non solo nella funzione**: la RLS lascia
al titolare la cancellazione diretta dalla tabella, e da lì il controllo di
`elimina_nota_credito` non passerebbe da nessuno. La verifica lo prova
scrivendo dritto in tabella (controllo 6c).

### E lo storno non è più muto

`elimina_nota_credito` **restituisce cosa ha stornato** — «la fattura
BASE-058 torna a 195,69 euro da pagare» — e la schermata lo mostra in un
avviso a parte, non nel rosso: leggere il rosso su una cosa andata bene
insegna a ignorare il rosso vero. Prima della cancellazione c'è una conferma
che nomina la cifra di cui il «da pagare» risale.

⚠️ Il perché è quello del saldo di mezzanotte: **un effetto stornato che
nessuno annuncia è indistinguibile da un numero che cambia da solo.** La
frase la compone il database **prima** di cancellare, perché dopo la cascata
se l'è portata via.

⚠️ Il tipo di ritorno cambia da `void` a `text`, quindi serve un `drop`:
`create or replace` rifiuta un tipo di ritorno diverso.

---

## 6. E un altro difetto mio, nella verifica

La verifica **lasciava cinque lapidi per applicazione** nel registro delle
cancellazioni. La pulizia cercava `__VERIFICA__` nel jsonb delle righe
cancellate, e nelle note di credito quella stringa non c'era: il marcatore
stava nel **nome del fornitore**, non nella nota. Cinque righe finte per
giro, invisibili, in un registro che **nessuno può ripulire dall'app**.

Ora ci sono due cose, e la seconda conta più della prima:
1. le note di prova portano il marcatore, e la pulizia toglie anche tutto
   ciò che apparteneva al fornitore di prova (per **appartenenza**, non per
   marcatore: un marcatore si può dimenticare in una chiamata);
2. **un guardiano che esprime una proprietà**: le lapidi prima e dopo la
   verifica devono essere le stesse. Non «zero», non un numero scritto a
   mano — la proprietà è *«una verifica non allarga il registro delle
   cancellazioni»* (lezione del 16/08).

Le dieci lapidi già lasciate sul **progetto di prova** sono state tolte da
SQL. In produzione non ne è mai arrivata nessuna: vedi la tabella qui sotto.

---

## 7. Numeri veri dell'applicazione in produzione

```
── Com'e' andata
  applicate e registrate: 1 su 1
    · 20260817000002_la_nota_di_credito.sql
  totale migrazioni in produzione: 126

Note di credito: se arriva prima si paga la differenza, se arriva dopo resta
credito. E una fattura pagata conta UNA volta fra i costi.
Note di credito rimaste: 0.

 note_di_credito | applicazioni | documenti_collegati | fatture
               0 |            0 |                   0 |       0
```

Applicata il **17/08/2026 alle 14:21:49 UTC**. Corridoio installato **prima**
della migrazione (28 → 29): un nome in elenco senza la funzione nel database
è inerte, e quell'ordine tiene la rete dei riepiloghi libera.

**Nessuna sanatoria**: la migrazione non tocca righe esistenti — le due
tabelle nascono vuote e la colonna sui documenti nasce `null` per tutti e
dieci. Dichiarato perché uno zero va detto (regola del 16/08).

### Controlli dal connettore in sola lettura, dopo l'applicazione

| Controllo | Valore |
|---|---|
| Migrazioni in produzione | **126** |
| Note di credito · applicazioni | 0 · 0 |
| Fatture · movimenti di prima nota | 0 · 0 |
| Documenti in archivio · collegati a una fattura | 10 · **0** |
| Fornitori `__VERIFICA__` rimasti | **0** |
| **Lapidi in `deleted_records`** | **25 — invariato** |
| Funzioni raggiungibili con la sola chiave pubblica | **10, invariato** |
| Policy dello schema `public` intestate al ruolo `public` | **0** |
| Policy totali dello schema `public` | 172 (erano 170: +2, le due tabelle nuove) |
| Trigger nuovi accesi | **6 su 6** |
| `pay_supplier_invoice` — quante versioni | **1** (`uuid, text, date, text, uuid[]`) |
| Legame `note_credito_utilizzi → supplier_invoices` | `ON DELETE RESTRICT` |
| Le due funzioni trigger eseguibili da qualcuno | **no, da nessuno** |
| `rettifiche_fiscali` e `costi_da_classificare` col filtro del §2 | **2 su 2** |
| L'avvertenza «l'uscita che la paga non è un secondo costo» | presente nel corpo |

⚠️ **Le lapidi invariate a 25 sono il controllo che vale più degli altri**:
la verifica crea e cancella fatture, movimenti e note di credito, e nessuna
di quelle cancellazioni ha lasciato traccia in un registro che nessuno
potrebbe distinguere da quelle vere.

---

## 8. Le prove

**Dentro la migrazione** (gira coi ruoli veri impersonati, si ripulisce per
intero): i due casi di Alessio · l'anteprima che dice lo stesso numero del
pagamento · **due crediti da 30 su una fattura da 40** · l'avanzo che resta
spendibile · la fattura coperta per intero che non scrive nessun movimento e
non viene segnalata dalla quadratura · annullare che libera il prestito e
lascia lo storno · **lo storno che dice quale fattura torna a quanto** · sei
rifiuti (credito speso due volte, fattura coperta oltre il suo importo,
importo abbassato sotto le note, cancellazione della fattura, cancellazione
della nota su fattura pagata **dalla funzione e scrivendo dritto in
tabella**) · «Ce la faccio?» al netto · il documento collegato · le funzioni
non raggiungibili da `anon`.

**Dal client** (`tests/app/note-di-credito.test.js`, 9 controlli col token di
un utente vero), e solo per ciò che da dentro una migrazione **è invisibile**:

- che `da_pagare`, `note_scalate` e `credito_residuo` **arrivino al
  browser**. Sono colonne calcolate: nel database funzionano sempre, ma se
  PostgREST non le esponesse la schermata mostrerebbe il lordo — cioè un «da
  pagare» che mente, senza nessun errore da nessuna parte;
- che il **corridoio** conosca le due operazioni nuove (un nome fuori
  dall'elenco risponde 404, e nessuna prova sul database se ne accorge);
- che la **frase dello storno faccia tutto il tragitto** fino al browser;
- che **lo staff non veda nessuna nota di credito**, con righe vere dentro
  (§5 punto 2).

⚠️ **La stringa del `select` è UNA sola** (`src/lib/calcoli/selectFatture.js`)
e la prova usa **quella**, non una copia: se domani `da_pagare` cadesse
dalla schermata, la prova diventerebbe rossa. Con una copia resterebbe verde
mentre la schermata mostra il lordo — è la forma del campo dimenticato delle
mance (16/08), un difetto che sbaglia in silenzio invece di dare errore.

⚠️ **E la prova non crea né cancella niente** nelle tabelle sorvegliate dal
registro delle cancellazioni (`tests/app/LEGGIMI.md`). Le righe su cui
lavora stanno nello **stato di partenza del progetto di prova**, che si
demolisce da SQL coi trigger spenti: due note di credito vere — una scalata
(BASE-058: 195,69 → **170,00**) e una che resta **credito di 30,00** con
Ortofrutta — più un DDT collegato alla fattura scaduta. È anche l'unico modo
di provare la RLS su una tabella non vuota.

Suite: **39 prove pure + 138 sul progetto di prova**, verdi.

---

## 9. Cosa NON è verificato

- **Nessuna mano vera ha aperto la schermata.** Il riquadro dei crediti, la
  riga coi tre numeri, la proposta al pagamento, la conferma prima di
  togliere una nota e l'avviso dello storno non sono mai stati letti da
  Alessio.
- **In produzione non c'è nessuna fattura e nessuna nota di credito**: tutto
  ciò che è provato sta nella migrazione e nelle prove sul progetto di
  prova. Il primo esercizio vero sarà la prima fattura vera di un fornitore
  vero — che è anche il momento in cui va fatta la pulizia dei dati di
  collaudo (§10 di `CLAUDE.md`).
- **Il caso «due crediti sulla stessa fattura» non è mai stato fatto a
  mano**: sta nella verifica (controllo 4b) e non nello scenario, dove c'è
  un credito solo.
- **Il collegamento di un documento non è stato provato dal browser**: lo
  scenario lo costruisce chiamando la funzione vera dell'app, e la prova dal
  client legge il collegamento — nessuno ha usato il menu a tendina.
- **La deducibilità di una nota di credito non è stata vista su costi
  veri**: zero movimenti, zero fatture, e **nessuna regola di deducibilità è
  ancora confermata da Laura**. Il segno negativo è provato dentro la
  migrazione su numeri inventati apposta.
- **Il plafond della rappresentanza con note negative** non è esercitato da
  nessuna prova: la stima dei ricavi annui c'è, ma nessun costo è
  classificato con una regola soggetta a plafond.

---

## 10. Stato finale

| | |
|---|---|
| Migrazioni in produzione | **126** |
| Migrazioni nel repository / sul progetto di prova | 126 / 126 |
| Corridoio `operazioni-atomiche` | produzione **v29**, prova **v12** |
| Prove automatiche | 39 pure + 138 sul progetto di prova |
| Collaudo, primo giro | chiuso |
| **Collaudo, secondo giro (pagamenti: n. 6, 7, 8, 9)** | **chiuso** |
| Prossimo | il giro delle piccolezze (D), tutte insieme |
