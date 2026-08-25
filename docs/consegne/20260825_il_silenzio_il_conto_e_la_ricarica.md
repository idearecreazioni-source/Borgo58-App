# Il silenzio sulle preparazioni, il conto della banca, e la prova di ricarica

**Consegna del 25/08/2026** · tre blocchi del mandato del validatore, tutti e tre aperti e chiusi.

- **I commit della consegna, in ordine:**
  - `2358dbe` — la preparazione che ha le partite in cella e il magazzino non segue
  - `e758ac0` — un movimento di banca ha il suo conto, e i conti si registrano da una schermata
  - `10eaab1` — la prova di ricarica: le migrazioni in ordine di numero arrivano in fondo
  - `0af9d05` — appunti: il conteggio delle migrazioni e il comando della prova di ricarica
  - *questo riepilogo, che è l'ultimo.*
- **Working tree al momento della scrittura:** pulito.
- ⚠️ **Uno scarto dichiarato**: la prima versione di questo riepilogo era stata scritta prima del commit degli appunti, e dichiarava `10eaab1` come HEAD. Corretto elencando tutti i commit invece di un hash solo — *un riepilogo che dichiara un hash superato è la stessa forma della frase diventata falsa che questa consegna insegue in tre posti.*
- **Migrazioni nuove:** `20260825000007`, `20260825000008`, `20260825000009`, `20260825000010`.
- **In produzione: nessuna delle quattro.** Applicate solo al progetto di prova, che passa da 241 a **245** registrate. Il repository ne ha **245**.
- **Comando nuovo:** `npm run ricostruzione:verifica`.

---

## LA RILETTURA, in cima e non in fondo

### Cosa NON ho verificato con gli occhi

- **Nessuna immagine.** In questo ambiente lo screenshot non funziona: tutto ciò che è «visto» è **misurato dal DOM** del browser vero, a 390 punti di larghezza con `--pxcm = 64`.
- **La schermata Magazzino con un'anomalia vera nata da uno scarico vero**: quella che ho guardato è nata da un `insert` mio nella tabella delle anomalie. Il giro completo (conto → scarico → anomalia → schermata) è provato **dentro la migrazione**, non a schermo.
- **La schermata Produzioni** non è stata aperta: `registra_produzione` è stata corretta ma il suo avviso «righe non scaricate» non l'ha visto nessuno.
- **Nessun dispositivo vero.** Né telefono né tablet: le misure vengono da una finestra ridimensionata.
- **La produzione.** Non ho letto il database vero: i fatti su di esso vengono dal mandato del validatore, che li ha misurati oggi.

### Cosa ho dato per fatto senza misurarlo

- **I quattro casi di migrazioni fuori ordine in produzione**: presi dal mandato, non rimisurati. La loro *conseguenza* invece l'ho misurata (blocco 3).
- **Che le tre migrazioni che si fermano nella ricostruzione lascino comunque lo schema completo**: lo deduco dal fatto che si fermano nel blocco di verifica *e* che il confronto finale dà zero differenze. Non ho ispezionato una per una le loro DDL.

### Cosa ho contato senza leggerlo

- **Le 33 migrazioni che interrogano il catalogo delle funzioni**: contate col setaccio `pg_get_functiondef`, non aperte una per una. Non so se tutte e 33 avrebbero fallito senza `enable_seqscan = off` — so che **una** falliva e che con quell'impostazione passano tutte.
- **Le 1.909 lapidi** nel registro delle cancellazioni: contate, non lette. Quello che ho verificato è che il numero **non è cambiato** prima e dopo ogni verifica.

### Quali mie affermazioni sono diventate false mentre lavoravo

1. **«Nel Blocco 2 il conto obbligatorio non esiste»** — falso. Scoperto **applicando**: `trg_conto_quando_serve` c'era già e faceva tre quarti del lavoro. Ho buttato la funzione che avevo scritto e ho esteso quella.
2. **«La descrizione dell'anomalia dice il nome e la spiegazione»** — l'ho scritto nella `…007` e due ore dopo, **guardando la schermata**, ho visto che ripeteva il motivo che la schermata scrive già davanti. Corretto dalla `…008`.
3. **«Un `analyze` cura l'array_agg»** — non è una mia affermazione ma una nota del 23/08 che avevo preso per buona e messa nello script. Misurata: **falsa**.
4. **«Il primo tentativo del Blocco 2 non ha lasciato niente»** — falso: aveva lasciato colonna, indice, vincolo, un trigger e un conto bancario, senza registrarsi. Constatati dal catalogo prima di andare avanti.

### Quali blocchi non ho aperto

Nessuno: tutti e tre aperti e chiusi.

### Quali conteggi sono PAVIMENTI e non totali

- **«33 file interrogano il catalogo»** — è un pavimento: il setaccio cerca `pg_get_functiondef`, e una query che chiedesse il catalogo in un altro modo non comparirebbe.
- **«3 migrazioni si fermano»** — **non** è un pavimento: lo strumento cammina tutte e 245 e le raccoglie tutte. È un totale.
- **«2701 elementi di forma»** — è un totale di *ciò che il confronto guarda* (colonne, vincoli, indici, funzioni, trigger, policy). Non guarda i commenti, i permessi, i valori predefiniti delle sequenze.
- **«14 preparazioni tutte già seguite dal magazzino»** — è un totale sul progetto di prova, letto dal database.

---

## BLOCCO 1 — il silenzio sulle preparazioni non seguite

### La misura, prima

Sul progetto di prova, prima di scrivere una riga:

| domanda | risposta |
|---|---|
| ingredienti con `preparazione_id` non nullo | **14** |
| di cui con almeno un lotto | **14** |
| di cui con `tenuto_in_magazzino = false` | **0** |
| **nella condizione di rischio** | **0** |

Lo zero **è misurato**, non dedotto. Il buco non morde oggi: è armato in avanti, dal giorno in cui qualcuno toglie quella spunta a una preparazione che ha delle partite in cella.

### Il difetto

`scarica_magazzino_conto` cammina sul fabbisogno e taglia via tutto ciò che ha `tenuto_in_magazzino = false`. Per i prodotti ordinari **è voluto** ed è scritto accanto a quella riga dal 23/08 (le bevande erano 1.840 righe che seppellivano le venti che contano). Per una preparazione **con dei lotti** no: avere lotti significa che il magazzino la segue di fatto, e lì il silenzio nasconde merce che entra e non esce mai.

### La famiglia

Cercata subito altrove: lo stesso filtro sta in `fabbisogno_preparazione_seguito`, che alimenta `registra_produzione`. Curati tutt'e due, o la correzione varrebbe per la sala e non per la cucina.

### Cosa fa e cosa non fa

Dichiara, **non scarica**. Forzare lo scarico scavalcherebbe una scelta scritta sulla scheda del prodotto.

- Vocabolario `anomalie_scarico.tipo` allargato con `preparazione_non_seguita`, e il vincolo **ricreato con la frase italiana** — usciva dai 156 «muti noti» congelati stamattina dalla `20260825000002`.
- Corpi ripresi **vivi** dal database con `pg_get_functiondef`.

### La controprova, che sa diventare rossa

Tolto il blocco nuovo dalla funzione e rieseguita la stessa verifica:

```
ERROR:  Il silenzio non e' stato dichiarato: 0 anomalie invece di 1
```

La verifica prova **tre casi**: preparazione con lotti fuori magazzino (l'anomalia compare, la giacenza non scende, la quantità è 0,3000 e il prodotto è nominato); la stessa dentro il magazzino (nessuna anomalia, il lotto scende di 0,3000); un prodotto ordinario fuori magazzino (**nessuna** anomalia — il silenzio voluto resta).

⚠️ **Un caso l'ho dovuto riscrivere**: avevo provato a togliere la preparazione «dalla cella» azzerando la giacenza del lotto, ma dal 25/08 `preparazione_in_cella` guarda `received_at`, non la quantità. Il caso 3 usa ora un piatto con dentro la sola materia prima.

### Due difetti miei, trovati GUARDANDO

La riga a schermo, misurata a **390 punti**, usciva così:

> `24 ago 2026 · ZZ T4 · preparazione con partite in cella, ma segnata da non seguire: ZZ occhi ragu di maiale: ha delle partite in cella, ma la sua scheda dice di non seguirla in magazzino — la giacenza non scende — mancano 0.9 kg`

1. **Diceva due volte la stessa cosa.** Il patto era già scritto nelle altre righe dell'elenco: la descrizione è **solo il nome** («Mascarpone»), il motivo lo scrive la schermata. L'avevo rotto io. → `20260825000008`.
2. **«mancano 0,9 kg» era falso**: in cella quei chili ci sono ancora — è la giacenza che non è scesa. Detto col verbo sbagliato si legge come un ammanco, e si va a cercare merce sparita. → il verbo cambia col motivo.

Dopo, a 390 punti, testo minimo **3,20 mm**, nessuno scorrimento laterale:

> `24 ago 2026 · ZZ T4 · in cella ce n'è, ma la sua scheda dice di non seguirla: ZZ occhi ragu di maiale — non sono scesi 0.9 kg — non è sceso nient'altro`

⚠️ **La `…007` non è stata riscritta**: era già applicata sulla prova, e un file applicato racconta cosa è successo quel giorno.

⚠️ **Un dettaglio non corretto, dichiarato**: il numero si scrive `0.9` col punto invece che `0,9`. È **preesistente** e vale per tutte le righe dell'elenco (`0.309`, `0.0002`), non introdotto qui. Fuori mandato.

---

## BLOCCO 2 — il conto corrente sui movimenti di banca

### La misura, prima

| dove | cosa |
|---|---|
| produzione (dal mandato) | 0 conti registrati, 0 movimenti di prima nota |
| progetto di prova | `mezzo` assume **due soli** valori: `cassa` (37) e `banca` (20) |
| progetto di prova | **tutti e 20** i movimenti di banca senza conto, tutti della stessa società |
| progetto di prova | `conti_bancari` **vuota** |
| entrambi | **nessuna** delle 7 funzioni che scrivono in `cash_movements` nomina `conto_id` |

### 🔴 Il lavoro era già fatto per tre quarti

Scoperto **applicando**, non leggendo. Su `cash_movements` c'era già `trg_conto_quando_serve` (`pretendi_il_conto_quando_servono`): con **un conto solo** lo riempie da sé, con **più d'uno** rifiuta.

Il mandato lo dava per inesistente perché erano stati letti i **vincoli** della colonna, e lì non c'è che la chiave esterna. *Contare non è leggere, e i trigger non sono vincoli.*

**Il buco vero era uno solo**: con **zero** conti quella funzione non faceva niente e il movimento passava orfano — cioè esattamente il caso di oggi in produzione.

Ho **buttato la funzione che avevo scritto** ed esteso quella che c'era: due trigger che decidono lo stesso fatto prima o poi ne dicono due versioni, e a quel punto vince chi si chiama prima in ordine alfabetico, che non è un criterio.

### Cosa è entrato

1. **`conti_bancari.predefinito`** più un indice unico parziale `(entity_id) where predefinito and attivo`. Serve perché il rifiuto con più conti diventi superabile: fino a oggi due conti attivi respingevano **ogni** movimento nato dentro una funzione, senza modo di dire «di solito è questo».
2. **Sanatoria idempotente.** Il ciclo gira **solo** sulle società che hanno già movimenti di banca orfani: sulla prova **1 conto creato, 20 movimenti assegnati**; rieseguita, **0 e 0**. In produzione non gira e **nessun conto nasce** — il vincolo assoluto del mandato.
3. **Il caso zero nel trigger**, con un messaggio in italiano che nomina la via d'uscita.
4. **Un vincolo `check`** `mezzo = 'cassa' or conto_id is not null`, con la frase italiana. Il trigger **riempie**, il vincolo **garantisce**: un trigger si spegne, un `check` no.
5. **`imposta_conto_predefinito()`** (`20260825000010`): togliere il segno agli altri e metterlo a questo sono due scritture che devono riuscire insieme. Fatte in fila dal browser, se la seconda non parte si resta **senza conto principale** e da lì ogni pagamento di fattura viene respinto. Tabella sola → RPC diretta, come `collega_articoli` e `rimanda_avviso`.

### 🔴 La via d'uscita che mancava

Il rifiuto manda a «Cassa → Conti correnti», e **quella schermata non esisteva**: misurato, in tutto `src/` **nessun file nominava `conti_bancari`** — la tabella c'era dal 15/08 e non la leggeva né scriveva nessuno. Un rifiuto senza gesto d'uscita è un vicolo cieco, ed è un difetto a sé in questo progetto.

Costruita `/cassa/conti-correnti` (elenco, aggiungi con IBAN, «usa questo di solito», spegni/riaccendi) con la porta da CassaHome.

⚠️ **I conti spenti non si cancellano**: i movimenti registrati ci sono attaccati sopra.

### Provato con le mani, sul progetto di prova, a 390 punti

- secondo conto aggiunto dalla schermata → nasce, e l'avviso **giustamente non compare** (uno dei due è già il principale);
- **«Usa questo di solito» → il segno si sposta in un gesto solo**, e il vecchio lo perde. Fatto **dal client col token vero**: è l'unico modo di esercitare il tratto fra schermata e database (lezione del 16/08);
- tolto il segno a entrambi → **l'avviso compare**, a **4 mm**, senza scorrimenti;
- testo minimo **3,20 mm**, bersagli **8,50 mm**.

Poi tutto ripulito: 1 conto, predefinito, 0 movimenti orfani, 0 righe `ZZ`.

### La controprova discrimina

| cosa tolgo | esito |
|---|---|
| il caso zero dal trigger | il **vincolo** respinge — la verifica si ferma, ma per l'altra rete |
| il caso zero **e** il vincolo | il movimento **passa**, e la verifica lo denuncia |

Il secondo verso è quello che dimostra che il caso zero conta.

⚠️ **Un messaggio cambiato apposta**, dichiarato alla rete anti-riscrittura con la riga `-- rete-guardie:`: il rifiuto con più conti diceva solo «disattiva quelli che non usi», e da oggi c'è una seconda via — segnare il conto di sempre. Un messaggio che non nomina la via d'uscita nuova manda a disattivare un conto vero per far passare un movimento.

---

## BLOCCO 3 — le migrazioni fuori ordine e la prova di ricarica

### Lo script esisteva? Sì e no

Il validatore credeva ne esistesse uno dal 23/08 e **non l'aveva verificato**. Esiste `npm run backup:ripristina`, che crea un **database usa e getta** sullo stesso motore della prova e ci rimette un **backup**. Non applica le migrazioni in ordine. Ho **riusato la sua strada** (il database usa e getta) e scritto il comando che mancava.

### `npm run ricostruzione:verifica`

Crea `ricostruzione_prova`, prepara i prerequisiti, applica **tutte e 245 le migrazioni in ordine di numero**, confronta lo schema, butta il database. Né la produzione né il progetto di prova vengono toccati.

### ✅ La risposta al mandato

```
ricostruito da zero:   2701 elementi di forma
progetto di prova:     2701 elementi di forma

✅ LA RICOSTRUZIONE IN ORDINE DI NUMERO PRODUCE LO STESSO SCHEMA.
```

**Non è un conteggio: è una proprietà** — nessun elemento di forma sta da una parte e non dall'altra. **I quattro casi fuori ordine non hanno lasciato danni allo schema.**

### 🔴 Ma tre migrazioni si fermano

| n. | file | motivo |
|---|---|---|
| 170ª | `20260822000003` | `item_has_source` violato: cerca una ricetta qualsiasi e non ne trova nessuna |
| 196ª | `20260823000024` | «sono sparite le ricette: la pulizia è andata troppo in là» |
| 229ª | `20260824000033` | «nessuna previsione libera» — **già noto**, va saltata anche in produzione |

Tutte e tre **nel blocco di verifica**, cioè dopo aver fatto il loro lavoro — ed è il motivo per cui lo schema torna lo stesso. Tutte e tre presumono **dati preesistenti**: è la regola del 16/08 (*il perimetro di una prova dev'essere fatto di roba che la prova ha creato*) vista dal lato della ricostruzione. **Nessuna si ferma per l'ordine.**

⚠️ **Non riscritti.** E una migrazione nuova non può sanarli: arriverebbe *dopo* il punto in cui la ricostruzione si ferma.

⚠️ **Lo strumento non si ferma al primo**: cammina tutte e 245 e le raccoglie. Fermarsi darebbe una risposta più corta con l'aria di essere intera — si saprebbe di **un** punto rotto e niente sugli altri duecento.

### 🔴 La cura dell'«array_agg» del 23/08 è falsa

Misurata sul database ricostruito, con **247** funzioni in `public`:

| cosa | esito |
|---|---|
| così com'è | si ferma |
| dopo `analyze pg_proc; analyze pg_namespace` | **si ferma lo stesso** |
| dopo `vacuum analyze` | **si ferma lo stesso** |
| con `enable_seqscan = off` | passa |
| con `and p.prokind = 'f'` nella query | passa |

La nota del 23/08 («si rilancia dopo un `analyze`») descriveva *quello che era bastato quel giorno*, non una cura. ⚠️ **Riguarda 33 file**, non uno, e **`scripts/prova-ricostruisci.mjs` fa ancora l'`analyze` una volta sola all'inizio**: su una ricostruzione completa si fermerebbe allo stesso punto. In coda.

Lo strumento usa `enable_seqscan = off`, ed è **un aggiramento del piano, non la cura**: la cura vera è `prokind = 'f'` dentro query che stanno in file già applicati.

### Il confronto ignora SOLO le parentesi

Tre `check` identici uscivano diversi:

```
((A AND B) AND (C AND D))     dal ricostruito
(A AND B AND (C AND D))       dalla prova
```

È come il motore ha memorizzato l'albero, non una regola diversa. `formaDelDatabase()` in `comune.mjs` toglie le parentesi — **e nient'altro**. Sette prove pure (`tests/unita/forma-database.test.js`) dimostrano che un **numero**, un **operatore**, una **colonna**, un **AND diventato OR** e una **colonna che manca** restano differenze.

### Cosa NON prova, dichiarato nel file

Un database creato con `create database` non è un progetto Supabase. `auth`, `cron`, `storage` e il Vault sono **monconi**: i lavori pianificati **non vengono programmati**, il Vault **non conserva**. `pg_net` invece si installa davvero (provato). `auth.uid()` **non** è un moncone che risponde null — legge i claims come Supabase, altrimenti tutte le verifiche che impersonano un titolare girerebbero come «nessuno», passando per la ragione sbagliata.

⚠️ **`pg_cron` non si può creare** fuori dal database `postgres`: in **1** file quella riga viene neutralizzata nel testo applicato. Il file non si tocca.

---

## Cosa abbiamo rovesciato

**Nessuna decisione rovesciata**, e le tre cose che ci somigliano sono di natura diversa:

1. **La cura dell'«array_agg» del 23/08 dichiarata falsa.** Non è un rovesciamento: nessuno aveva *deciso* che un `analyze` bastasse — si era osservato che quel giorno era bastato, e la frase è stata scritta più larga del vero. È la famiglia delle **frasi diventate false**, non quella dei rovesciamenti. Registrata nella coda, non in `decisioni_rovesciate.md`.
2. **La descrizione dell'anomalia cambiata fra la `…007` e la `…008`.** È una correzione **dentro la stessa consegna**, di poche ore: il patto («descrizione = solo il nome») esisteva già ed ero io ad averlo rotto. Non c'era una decisione precedente da rovesciare.
3. **Il messaggio di rifiuto di `pretendi_il_conto_quando_servono`.** Cambiato perché **la via d'uscita è cambiata**, non perché la frase fosse sbagliata: prima non esisteva il conto di sempre. Dichiarato alla rete guardie.

**E il silenzio sui prodotti fuori magazzino (23/08) non è stato rovesciato**: vale ancora intero per i prodotti ordinari, e la verifica ha un caso apposta che lo dimostra. Quello che cambia è che una preparazione con partite in cella **non era un prodotto ordinario**, e nessuno l'aveva distinta.

---

## I numeri veri, dopo

Letti dal progetto di prova a lavoro finito:

| cosa | valore |
|---|---|
| migrazioni registrate sulla prova | **245** (erano 241) |
| migrazioni nel repository | **245** |
| migrazioni in produzione | **241** — nessuna delle quattro nuove |
| conti bancari sulla prova | **1**, ed è quello di sempre |
| movimenti di banca senza conto | **0** |
| anomalie `preparazione_non_seguita` | **0** (nessun caso vero) |
| righe di prova rimaste (`ZZ …`) | **0** |
| trigger lasciati spenti | **0** |
| lapidi lasciate dalle verifiche | **0** |
| prove pure | **435** (erano 428) |
| prove sul database | **386** |
| arretrati di riepilogo | **nessuno** |
