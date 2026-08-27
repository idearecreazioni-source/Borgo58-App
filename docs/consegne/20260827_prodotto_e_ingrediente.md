# Il prodotto è una cosa, l'ingrediente un'altra

**27/08/2026** · Blocco 1 del mandato sulla separazione prodotto / ingrediente.

| | |
|---|---|
| **HEAD dichiarato** | `ff75a19` — *Il prodotto e' una cosa, l'ingrediente un'altra* |
| **Working tree** | pulito al momento del commit; questo riepilogo è il commit successivo e sola documentazione |
| **Migrazioni** | `20260827000018` → `20260827000025` — **nessuna in produzione**, aspettano il push e il via libera di Alessio |
| **Funzioni online** | `operazioni-atomiche` **v30** e `leggi-foto` **v4** installate **solo sul progetto di prova**; in produzione restano v29 e v3 |
| **Blocchi aperti** | 2, 3, 4, 5 del mandato: **non aperti** |

⚠️ **Niente è stato applicato al gestionale vero.** Alessio non era al
computer, e il mandato dice di lasciare le migrazioni in attesa.

---

## Le fasi, e a che punto si è arrivati

Il mandato chiedeva quattro fasi. **Sono tutte e quattro chiuse.** La misura e
il disegno stanno per intero in
[`docs/referti/20260827_prodotto_e_ingrediente.md`](../referti/20260827_prodotto_e_ingrediente.md);
qui c'è la sostanza.

---

## FASE A — la misura

### Le righe, nei due gestionali (misurato)

| | prova | VERO |
|---|---|---|
| `ingredients` | **133** (20 in «altro») | **0** |
| `articoli_fornitore` | **0** | **0** |
| `price_history` | 115, di cui **0** con `articolo_id` | 0 |
| `stock_lots` | 499 | 0 |
| `recipes` / `recipe_ingredients` | 116 / 319 | **14 / 0** |
| `suppliers` | 11 | 0 |

🔴 **Nel gestionale vero i prodotti sono zero e le 14 ricette non hanno
nemmeno una riga di ingredienti.** La separazione là non sposta niente: si
poteva sbagliare sulla prova senza pagare.

### La radice, misurata

`articoli_fornitore` **esiste dal 12/08 e non è mai stata usata**. Il perché è
in una funzione: **`trova_o_crea_ingrediente`** — la porta dell'assistente —
cerca fra gli **ingredienti** e, non trovando, **crea un ingrediente**. Quindi
«MAIONESE HELLMANN'S 500 ml» non diventava un prodotto della maionese:
diventava **un ingrediente a sé**.

### Dove passa il food cost — un punto solo

```
v_recipe_costs -> v_recipe_row_costs -> espansione_costo_ricetta
                                     -> ingredients.current_price
```

🔴 **E `register_stock_delivery` NON scriveva `current_price`** (letto dal
corpo vivo): far entrare merce a un prezzo nuovo **non muoveva il food cost**,
cioè il contrario di quello che la decisione del 25/08 pretende.

Altri numeri: **24 funzioni** scrivono nelle quattro tabelle, **29 schermate**
le nominano, **21 tabelle** hanno un `ingredient_id`/`articolo_id`,
`ingredient_category` è un **enum di 15 valori** (è il vincolo del Blocco 2).

---

## FASE B — il disegno

**`articoli_fornitore` diventa il PRODOTTO**, e non nasce una tabella nuova:
col discriminante del 17/08 le due direbbero *esattamente* la stessa cosa, e
una seconda tabella sarebbe un doppione. Il prodotto acquista **marca**,
**formato** e **nome per esteso**; il lotto acquista **quale versione è
entrata**; **`ingredients.current_price` diventa un RIFLESSO** del prezzo
dell'ultima versione entrata, scritto **solo da un trigger**, con
`prezzo_da` che dice da dove viene.

**Il FEFO non è toccato**, quindi «scende la versione più vecchia ancora
buona» resta vero per costruzione invece di essere una regola nuova.

---

## FASE C — la costruzione

| migrazione | cosa fa |
|---|---|
| **20260827000018** | Le colonne del prodotto (`marca`, `nome_esteso`, `formato`), `stock_lots.articolo_id` (`restrict`), `stock_lots.progressivo`, `ingredients.prezzo_da`, `prezzo_ultima_versione()`, il trigger del riflesso, `andamento_prezzo()` |
| **20260827000019** | Il controllo che mancava: una consegna senza costo non azzera un prezzo scritto a mano |
| **20260827000020** | `registra_prodotto_letto()` — una foto fa nascere **un prodotto**, non un ingrediente. Nel corridoio (B4) |
| **20260827000021** | 🔴 Il regalo vale zero per quella volta: `unit_cost > 0` |
| **20260827000022** | Marca e formato arrivano in `varianti_ingrediente()`, con quante volte quella versione è entrata |
| **20260827000023** | I portieri delle due funzioni nuove |
| **20260827000024** | Il prodotto si appende all'ingrediente **indicato** dalla schermata |
| **20260827000025** | La dichiarazione alla rete dei portieri, e i tre fatti su cui poggia |

Lato applicazione: `registraProdottoLetto()` e `andamentoPrezzo()` nell'API,
il salvataggio della scheda che fa nascere il prodotto, marca/formato/«entrata
N volte» nella tabella delle versioni, e **la riga che dice da dove viene il
prezzo**. Il prompt di `leggi-foto` distingue `ingrediente` da `prodotto`, con
l'esempio e la ragione scritti dentro.

---

## 🔴 IL FOOD COST, PRIMA E DOPO — la cosa che il mandato chiedeva

| | prima | dopo |
|---|---|---|
| ricette con almeno una riga (prova) | **106** | **106** |
| somma dei `food_cost_base` | **481,7078** | **481,7078** |
| somma dei `food_cost_portion` | **481,2458** | **481,2458** |
| ricette a costo zero | **0** | **0** |
| le 14 ricette del gestionale VERO | **0,00** | **0,00** |

**Nessun numero si è mosso, e non è fortuna: è una proprietà del disegno.**
`v_recipe_costs`, `v_recipe_row_costs` ed `espansione_costo_ricetta` **non sono
toccate**, e non c'è **nessuna sanatoria** (decisione del 25/08), quindi le 491
righe di costo dei lotti già presenti non sono state ripassate.
`prezzo_da` resta **vuoto su tutti e 133** gli ingredienti preesistenti: è il
terzo stato, «non l'ha ancora detto nessuno».

⚠️ **Le 14 ricette vere valgono zero prima e dopo perché non hanno righe di
ingredienti** — non perché il calcolo si sia rotto. Coerente con la decisione
del 26/08 («le 14 ricette senza ingredienti sono normali e non si toccano»).

⚠️ **Cinque ingredienti hanno `prezzo_da` valorizzato** dopo il giro delle
prove: sono i cinque attrezzi `TEST-AUTO` della suite automatica, e sono in
**zero ricette** — controllato uno per uno, non dedotto dal totale invariato.

---

## FASE D — le prove, giudicate dai fallimenti

### Le tre reti che sono diventate rosse DA SOLE, e hanno preso tre cose diverse

🔴 **1. `tests/app/tre-esiti-lista.test.js` — il regalo che azzerava un
prezzo.** Il riflesso contraddiceva una **decisione in vigore del 17/08**: *un
regalo non deve far scendere a zero il prezzo dell'ingrediente*. Misurato col
riflesso rotto: un prezzo di 7,50 diventa **0,0000** e la colonna dichiara di
venire **da un prodotto**. ⚠️ Il danno è peggiore dello zero: `prezzo_da =
'prodotto'` **rassicura**, dice che qualcuno l'ha misurato. Curato con
`unit_cost > 0` (`…021`), che copre anche la raccolta propria.

🔴 **2. `tests/app/permessi.test.js` — due funzioni senza portiere.** 23
attese, **25 trovate**. Due cure diverse:
- `prezzo_ultima_versione` **si CHIUDE**. E un portiere lì avrebbe **rotto il
  gestionale in cucina**: dentro un `security definer` `auth.uid()` resta
  quello di chi chiama, quindi `is_titolare()` sarebbe falso per lo staff e il
  riflesso avrebbe rifiutato. **Provato**: la verifica della `…023` inserisce
  un lotto **coi claims dello staff** e controlla che il riflesso funzioni.
- `andamento_prezzo` riceve un portiere che **RIFIUTA, non filtra** — la
  lezione della stessa mattina su `caparre_trattenute`.

🔴 **3. `tests/app/migrazioni-senza-portieri.test.js`** — la verifica della
`…018` chiama `andamento_prezzo`, che il portiere l'ha acquistato **dopo**, con
la `…023`. Su una ricostruzione da zero funziona (è la `…018` stessa a creare
la funzione senza portiere); quello che **non si può più fare è rieseguire la
`…018` da sola oggi**. Dichiarato nella `…025` invece di riscrivere una
migrazione applicata (regola del 23/08). ⚠️ La forma della dichiarazione
sbagliata alla prima volta — **col nome intero del file invece del numero di
versione** — e la rete è rimasta rossa: la lezione del 26/08, ripagata.

### Le rotture fatte apposta

| rottura | esito |
|---|---|
| `prezzo_ultima_versione` ordina dal **più vecchio** | 🔴 rossa: *«Non comanda l'ultima versione entrata: 8.5000 (media 10,25, minima 8,50)»* |
| il riflesso **azzera** quando non trova un costo | ✅ **rimasta VERDE** — e da lì è nata la `…019` |
| il riflesso azzera, sul caso vero (solo prezzo a mano) | 🔴 rossa: *«Una consegna senza costo ha cambiato il prezzo: 0.0000 invece di 7,50 — l'ingrediente diventa gratis in ogni ricetta che lo usa»* |
| ogni foto crea un ingrediente nuovo | 🔴 rossa: *«la seconda marca ha fatto nascere un SECONDO ingrediente»* |
| il portiere dell'andamento **filtra** invece di rifiutare | 🔴 rossa: *«lo staff ha ottenuto l'andamento dei prezzi»* |

🔴 **La seconda riga è il risultato più utile del giro.** Il controllo
intitolato «un lotto senza costo non azzera il prezzo» faceva entrare quel
lotto su un ingrediente che **aveva già due lotti prezzati**: quindi la
guardia non veniva mai raggiunta, e provava il filtro dentro la funzione
invece della guardia dentro il trigger. *Un esempio costruito prova solo i
casi che gli hai messo dentro.*

⚠️ **E una rottura ha lasciato un residuo che la pulizia non poteva
conoscere**: `righeMie()` cancella ciò che le si è segnato, e la prova segna
l'ingrediente che **si aspetta condiviso** — rompendo il codice perché ne crei
due, il secondo non lo segna nessuno. Al giro dopo la prima prova è diventata
rossa **per il residuo, non per la rottura**. Diagnosticato guardando il corpo
vivo della funzione e contando i residui (**zero**), non fidandosi dello
schermo.

### I quattro casi che il mandato voleva vedere fallire

| caso | dove è provato |
|---|---|
| una ricetta con un ingrediente di cui esistono **due versioni a prezzi diversi** | `…018` controllo 3 e `prodotto-e-ingrediente.test.js`: **12,00**, non 10,25 (media) né 8,50 (minima) — tre risposte separate |
| un carico che arriva a un **prezzo diverso** dall'ultimo | `…018` controllo 2: il carico muove il prezzo, cosa che prima **non faceva** |
| una **giacenza che non basta** | invariato e coperto da `scarico-magazzino.test.js` e `allineamento-magazzino.test.js`, che restano verdi: il FEFO non è toccato |
| un **prodotto senza prezzo** che entra in un food cost | `…018` controllo 7: il totale **non cambia** e non scende; `…019` prova il caso in cui azzererebbe |

### Le prove, tutte

- **unità**: 44 file, **505** prove, verdi.
- **sull'app**: 63 file, **444** prove — verdi dopo le tre correzioni. Il file
  nuovo `tests/app/prodotto-e-ingrediente.test.js` ha **6** prove e **entra dal
  collegamento dell'app**, perché è l'unico modo di sapere che
  `registra_prodotto_letto` è nell'elenco del corridoio (fuori elenco
  risponde 404, e nessuna prova SQL se ne accorge).
- **verifiche dentro le migrazioni**: 8 su 8 passate, e ognuna **costruisce
  tutto quello che le serve** — girano su un gestionale vuoto.

---

## Le verifiche funzionano su un gestionale vuoto?

**Otto su otto**, e nessuna prende in prestito un ingrediente, un prodotto, un
lotto o una ricetta: se li costruisce e se li riporta via per identificativo,
tenuto in un **array** e non in una variabile riusata (lezione del 26/08).

⚠️ **Restano tre prestiti, e sono prerequisiti strutturali dichiarati**:
`entities` (la società), `user_roles` (il titolare) e — nella `…023` — un
utente non titolare per provare il rifiuto. Sono gli stessi che ogni
migrazione di questo progetto presume dal 10/08, ed esistono in produzione
(misurato: **2 entità, 2 titolari**). Il caso «non c'è» è comunque nominato:
tutte si fermano con un messaggio invece di procedere.

---

## Cosa abbiamo rovesciato

**Una cosa, e la ragione di allora vale ancora.**

- **Cosa era stato deciso e quando** — 17/08/2026, mandato «la lista non
  scrive uscite»: *un regalo non deve far scendere a zero il prezzo
  dell'ingrediente*.
- **La ragione di allora** — il food cost di ogni ricetta che usa quell'
  ingrediente risulterebbe più basso del vero, ed è da lì che Alessio decide i
  prezzi del menu.
- **Cosa si decide adesso** — **niente**: la decisione **non è rovesciata**. Il
  riflesso del prezzo l'aveva contraddetta per qualche ora, e la correzione la
  ripristina intera.
- **Perché la ragione di allora non vale più** — **vale ancora, per intero.**
  Non c'è nessun prezzo da pagare: quello che si è pagato è il tempo di
  scoprirlo, e a scoprirlo è stata una prova scritta dieci giorni prima.

⚠️ **E la decisione è stata AGGIUNTA a `docs/DECISIONI.md`**, dove non c'era:
viveva solo nel mandato del 17/08 e in `CLAUDE.md`. Nessuna riga di
`decisioni_rovesciate.md` è stata aggiunta, perché non c'è nessun
rovesciamento.

---

## Le decisioni del file, voce per voce

| decisione | onorata |
|---|---|
| 25/08 reset prima dell'uso vero, nessuna conversione | ✅ nessuna sanatoria |
| 25/08 prima le ricette, poi i prodotti | ✅ il prezzo `a_mano` resta la strada per un ingrediente senza prodotti |
| 25/08 separare PRODOTTO da INGREDIENTE unico | ✅ `articoli_fornitore` + `marca`, `formato`, `nome_esteso` |
| 25/08 la giacenza segue l'INGREDIENTE | ✅ era già vero, non toccato |
| 25/08 scende la versione più vecchia ancora buona | ✅ FEFO non toccato; il lotto sa quale versione è |
| 25/08 l'assistente PROPONE l'ingrediente se non esiste | ✅ `registra_prodotto_letto` lo trova o lo crea, e la scheda si vede prima di salvare |
| 25/08 l'assistente decide se accorpare | ✅ resta sua: due prodotti su un ingrediente, o due ingredienti |
| 25/08 food cost sull'ULTIMA versione **+** media e trend | ✅ il riflesso; `andamento_prezzo()` |
| 25/08 il prezzo di vendita NON si muove da solo | ✅ nessun prezzo di menu toccato |
| 25/08 il campo % scarto standard RESTA | ✅ non toccato |
| 23/08 lo scarto non sostituisce la resa vera | ✅ non toccato |
| 17/08 il regalo vale zero per quella volta | ✅ `unit_cost > 0` (`…021`) |
| 25/08 shelf life ≠ scadenza | 🟡 **ambigua — vedi domanda 1** |
| 25/08 shelf life di una PREPARAZIONE | 🟡 **non costruita — vedi domanda 2** |
| 25/08 spesa multi-foto | ⏳ fuori da questo blocco; il prodotto senza fornitore ci sta già |

### Le due che mi sono sembrate ambigue

1. **La shelf life.** La decisione dice «quanto dura una volta APERTO», e oggi
   `shelf_life_days` vive su **`ingredients`** — cioè sull'ingrediente e non
   sulla confezione, mentre «una volta aperto» è una proprietà della
   confezione. Spostarla sul prodotto è coerente ma **cambia dove vive un dato
   che lo scadenziario già legge**. **Non spostata.**
2. **La shelf life di una preparazione.** «Si calcola da variabili interne —
   abbattimento, sottovuoto, bassa temperatura»: quelle variabili **non
   esistono** nel gestionale e la formula non è scritta. **Non inventata.**

---

## Quanti posti raccontavano la stessa cosa

**Due, e uno era falso dalla nascita.**

1. 🔴 Il commento sopra la tabella delle versioni in `IngredienteForm.jsx`:
   *«Le versioni comprate davvero: marca, formato, fornitore, prezzo»*. La
   tabella non li mostrava e **non poteva: quelle colonne non esistevano.**
   ⚠️ Non è invecchiato — **è nato descrivendo una cosa che non c'era**, come
   la frase sulle lapidi del 26/08. **Reso vero, non cancellato**: era il
   disegno voluto da Alessio il 12/08.
2. La decisione del regalo viveva in **due posti** (mandato del 17/08 e
   `CLAUDE.md`) e **non** in `docs/DECISIONI.md`, che è il posto dove
   dovrebbe stare. Aggiunta.

---

## Cosa NON è verificato con gli occhi

- 🔴 **Nessuna schermata è stata aperta.** La riga che dice da dove viene il
  prezzo, le colonne marca/formato, «entrata N volte»: **nessuno le ha viste**.
  Sono provate dai dati che le alimentano, non dal disegno.
- 🔴 **Nessuna misura di larghezza o di taglia del testo.** Ho aggiunto righe
  di testo alla scheda di un ingrediente — che è **una delle due schermate
  dichiarate illeggibili sul telefono il 25/08** — e **non ho misurato niente
  a 375 punti**. Il rischio è concreto: le tre righe nuove nella colonna
  «Versione» possono allungare una tabella che era già stretta.
- 🔴 **Nessuna foto vera è passata dal prompt nuovo.** Il testo che distingue
  `ingrediente` da `prodotto` è installato **solo sulla prova** e **nessuna
  chiamata all'API vera l'ha esercitato**: non si sa se MEMO risponde coi due
  nomi separati come chiesto. È la voce più esposta di tutta la consegna.
- **Nessun carico vero, nessuna fattura vera**: tutto passa dalle verifiche e
  dalle prove.
- **Il giro dalla Dashboard** (fotografa → «apri la scheda di un prodotto
  nuovo» → salva → nasce il prodotto) **non è stato percorso da una mano**.

## Cosa ho contato senza leggerlo

- **Le 24 funzioni** che scrivono nelle quattro tabelle e le **29 schermate**
  che le nominano: contate con un setaccio, **non lette una per una**. Il
  numero dice l'ampiezza, non che ognuna sia giusta.
- **I 20 su 133 in «altro»**: contati, non guardati uno per uno.
- **Le cinque migrazioni dell'arretrato**: descritte **dalle loro
  intestazioni**, che sono quello che il file dice di sé — non una verifica
  indipendente.

## Quali mie affermazioni sono diventate false mentre lavoravo

1. Il referto della Fase B diceva che il riflesso prende *«l'`unit_cost` del
   lotto entrato per ultimo fra quelli con un costo»*. **Falsa dopo la
   `…021`**: fra quelli con un costo **maggiore di zero**. Il referto è stato
   scritto prima ed **è rimasto com'era**, perché racconta il disegno di quel
   momento; la versione vera vive nel commento della funzione e nella `…021`.
2. Il commento della `…018` su `prezzo_ultima_versione` diceva «vuoto se
   nessun lotto porta un costo». **Corretto nella `…021` e nella `…023`.**
3. Ho scritto nel corpo della `…018` che la strada a mano «non è una
   scappatoia» e che *«il verso opposto è la parte da provare rompendola»* —
   e **non l'ho provata lì**: quel controllo è nella `…019`, nata dopo.

---

## Cosa resta in mano ad Alessio

1. **Il push** — otto migrazioni e il codice.
2. **Il via libera all'applicazione** in produzione, con l'ordine sotto.
3. **L'installazione in produzione** delle due funzioni online, che oggi sono
   aggiornate **solo sulla prova**.

### L'ordine dei comandi

Prima il push, poi:

```bash
npm run migra -- --conferma
```

⚠️ **Le otto migrazioni vanno tutte insieme e in ordine di numero.** La
`…018` da sola lascerebbe il riflesso che azzera un prezzo su un regalo — cioè
il difetto che la `…021` chiude.

Poi le due funzioni online:

```bash
npm run funzione operazioni-atomiche -- --conferma
```

```bash
npm run funzione leggi-foto -- --conferma
```

⚠️ **Senza la prima, `registra_prodotto_letto` risponde 404** e una foto non
fa nascere nessun prodotto.

---

## L'arretrato trovato per strada

`npm run migra` si è **rifiutato di guardare la produzione**: cinque
migrazioni della sessione precedente (`…013`→`…017`) erano applicate e nessun
riepilogo le nominava. Chiuso con
[l'arretrato](20260827_arretrato_le_cinque_migrazioni_senza_riepilogo.md), che
dichiara per intero **cosa non si può più ricostruire**: i numeri veri del
momento in cui sono entrate.

---

## I blocchi non aperti

**2** (le categorie e come MEMO impara gli elenchi), **3** (MEMO guarda quello
che salvi), **4** (la posta in arrivo), **5** (il rifiuto muto). Nessuno dei
quattro è stato toccato.

⚠️ **Del Blocco 2 è però già misurato il vincolo**, e conviene saperlo prima
di aprirlo: `ingredient_category` è un **enum di 15 valori**, e un enum non si
allunga da una schermata. Il lavoro non è il pulsante — è portare le categorie
da un enum a una tabella, e poi far leggere a MEMO l'elenco vero.
