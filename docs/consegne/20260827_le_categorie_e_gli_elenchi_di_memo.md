# Le categorie diventano dati, e MEMO impara gli elenchi

**27/08/2026** · Blocco 2 del mandato sulla separazione prodotto / ingrediente.

| | |
|---|---|
| **HEAD dichiarato** | `74854a6` — *Il campo della categoria nuova non compariva mai* (sotto: `d037ade`, *Le categorie diventano dati, e MEMO impara gli elenchi*) |
| **Working tree** | pulito; questo riepilogo è il commit successivo e sola documentazione |
| **Migrazioni** | `20260827000026`, `20260827000027`, `20260827000028`, `20260827000029`, `20260827000030`, `20260827000031`, `20260827000032` — **nessuna in produzione** |
| **Numeri per intero** | i sette sopra erano scritti come intervallo `…026 → …032`: la forma abbreviata nomina i **due estremi** e lascia muti i cinque in mezzo. Espansi il 28/08 **prima** di applicarli, perché la regola del 16/08 pretende il numero completo ed è quello che la rete dei riepiloghi cerca. Nessuna parola del riepilogo è stata cambiata. |
| **Funzioni online** | `leggi-foto` **v5**, `ascolta-voce` **v11**, `posta-leggi` **v3**, `schede-prodotto` **v4**, `operazioni-atomiche` **v30**: tutte **solo sulla prova** |
| **Blocchi aperti** | 3, 4, 5 del mandato: **non aperti** |

⚠️ **Niente è stato applicato al gestionale vero.** Con il Blocco 1 le
migrazioni in attesa sono **15** (`…018` → `…032`).

---

## Le due metà, e perché sono una cosa sola

**Decisione di Alessio**: dalla schermata degli Ingredienti le categorie non
si possono aggiungere né modificare, e serve poterlo fare **mentre si
inserisce un prodotto**.

E il mandato aggiunge la seconda metà con parole che vale la pena ripetere:
*«se le categorie diventano modificabili, MEMO deve riceverle dall'elenco
VERO, altrimenti continua a proporre le vecchie e sbaglia senza dirlo. Quindi
il lavoro non è il pulsante: è il modo in cui MEMO impara le liste.»*

---

## 2a — LE CATEGORIE DIVENTANO DATI

### La misura che lo motiva

**20 prodotti su 133 in «altro»** (15,0%, prova), e `ingredient_category` era
un **enum di 15 valori**. Un enum non si allunga da una schermata: `alter type
… add value` è una modifica dello schema, il valore aggiunto non è usabile
nella stessa transazione, e non sa né rinominare né togliere.

### Il raggio, misurato prima di toccare

| cosa | quanti |
|---|---|
| colonne di quel tipo | **2** (`ingredients.category` e la colonna derivata della vista) |
| funzioni col tipo nella **FIRMA** → da ricreare | **2** (`create_ingredient`, `trova_o_crea_ingrediente`) |
| funzioni che lo nominano nel **corpo** | **3** |
| viste | **1**, senza nessun dipendente |

### 🔴 E LA RETE DEI VOCABOLARI VA INSEGNATA NELLA STESSA MIGRAZIONE

`vocabolari_chiusi()` conosceva **due** sorgenti: gli `enum` e i vincoli
`check` su una colonna sola. Una categoria che diventa **una tabella con una
chiave esterna** non è nessuna delle due: **sarebbe sparita dalla rete in
silenzio.**

🔴 **E non è un problema di conteggio.** `valore_del_vocabolario()` — nata la
notte prima con la `…015`, per impedire che un valore fuori elenco diventi la
prima opzione di un menu — **legge quella rete**. Uscendone, la categoria
sarebbe tornata a **passare qualunque valore**: il difetto chiuso il giorno
prima, riaperto senza che niente diventasse rosso.

⚠️ **La terza sorgente si DICHIARA** in un registro (`cataloghi_vocabolario`):
la regola «ogni chiave esterna è un vocabolario» segnalerebbe **ogni** legame
del database, e una rete che grida sempre viene spenta. **Il prezzo è
dichiarato**: chi costruirà un catalogo nuovo e si dimenticherà di
registrarlo avrà una colonna che la rete non vede — lo stesso silenzio, spostato
di un passo, accettato perché l'alternativa è peggiore.

### Legale e proponibile sono due cose diverse

Una categoria **spenta** resta **legale** (gli ingredienti che la portano non
diventano illegali) e **non si propone più**. La rete riporta tutti i codici —
descrive la legalità; gli elenchi da riempire passano da
`categorie_proponibili()`.

### Il lato applicazione

- 🔴 **`INGREDIENT_CATEGORIES` è stato TOLTO da `constants.js`** e **non
  sostituito**: uno specchio di una *tabella* è una seconda verità che resta
  indietro appena Alessio ne aggiunge una — cioè un valore legittimo che non
  si può scegliere, che fra i due modi di sbagliare è quello **silenzioso**.
- 🔴 **La riga di `SPECCHIATI` è stata TOLTA**, e va detto perché togliere una
  riga da una rete somiglia a indebolirla: il disaccordo che sorvegliava **non
  può più esistere**, e lasciarla lì avrebbe fatto diventare rossa una prova
  **il primo giorno in cui Alessio aggiunge una categoria** — un allarme
  falso, cioè il modo in cui una rete viene spenta.
- **Al loro posto ci sono due guardiani nuovi** (`tests/unita/vocabolari.test.js`):
  «`constants.js` non esporta più un elenco di categorie» e «nessuno
  rispecchia più `ingredients.category`». Il primo passa da una funzione pura
  (`elenchiDiCategorieNelCodice`) **provata al contrario su un modulo
  inventato**, per non rompere `constants.js` mentre il gestionale gira dalla
  stessa cartella.
- **La categoria si aggiunge da sotto il campo**, dove sta il dubbio, non in
  un'altra schermata. Si **seleziona da sé** dopo essere stata creata, e se
  esiste già **lo dice e la seleziona comunque** invece di fingere.

---

## 2b — MEMO IMPARA GLI ELENCHI

### 🔴 Dove vivevano, misurato: QUATTRO posti dentro le funzioni online

| dove | cosa faceva |
|---|---|
| `leggi-foto`, nel prompt | proponeva |
| `ascolta-voce`, nel prompt | proponeva |
| `posta-leggi`, nel prompt | proponeva |
| **`posta-leggi`, in un insieme** | 🔴 **VALIDAVA** |

🔴 **Il quarto è il peggiore, e non somiglia agli altri tre.**

```
categoria: CATEGORIE_VALIDE.has(categoria) ? categoria : "altro"
```

Una categoria appena aggiunta da Alessio, **letta correttamente da MEMO su
una fattura**, sarebbe stata **scambiata con «altro»** — nessun errore,
nessun avviso, e il prodotto in una categoria che nessuno ha scelto. È la
stessa forma del difetto del menu a tendina del 27/08, spostata nella
funzione online.

### La cura: gli elenchi si chiedono

`vocabolari_per_assistente()` **non contiene nessun elenco**: li ricava da
`vocabolari_chiusi()`, cioè dal catalogo del database. Non può divergere per
costruzione. Otto elenchi: categorie dei prodotti (solo le **accese**), unità,
allergeni, conservazione, categorie delle ricette, verso di un movimento,
mezzi di cassa, tipi di documento.

⚠️ **E se un elenco non arriva non si ripiega su uno scritto a mano**: sarebbe
di nuovo una seconda verità, e una che entra in gioco **proprio quando il
database non risponde**, cioè quando nessuno la sta guardando. Si dice a MEMO
che l'elenco non c'è, e MEMO lascia il campo vuoto.

### 🔴 Alla voce arrivano DENTRO il catalogo, e la ragione è una porta

`ascolta-voce` ha **due porte**: l'app col token di Alessio, e la
**Scorciatoia dell'orologio** che parla con la chiave anonima. Una seconda RPC
concessa a `authenticated` avrebbe risposto **no** alla Scorciatoia: MEMO
sarebbe rimasto senza elenchi **esattamente dove Alessio detta con le mani
occupate**. Gli elenchi entrano in `voce_catalogo()`, che passa da entrambe le
porte e gira come proprietaria — **senza un giro di rete in più**.

⚠️ È la famiglia del 26/08 (*«due porte che portano allo stesso posto, e il
controllo su quella che non agisce»*) letta al contrario: qui il dato va messo
dove passano **tutt'e due**.

### La rete che impedisce il ritorno

`tests/unita/elenchi-di-memo.test.js`: nessuna funzione online contiene un
elenco di categorie scritto a mano, **e almeno due li chiedono al database** —
la seconda metà serve perché una rete che pretende «nessun elenco scritto»
passerebbe anche su un gestionale dove nessuno li chiede più.
⚠️ **La spia è provata su casi di risposta nota** (regola del 26/08) e il suo
limite è dichiarato: riconosce la forma che c'era, non ogni forma possibile.

---

## 🔴 IL FOOD COST, DOPO I DUE BLOCCHI

| | prima del Blocco 1 | dopo il Blocco 1 | dopo il Blocco 2 |
|---|---|---|---|
| ricette con righe (prova) | **106** | **106** | **106** |
| somma dei `food_cost_base` | **481,7078** | **481,7078** | **481,7078** |
| somma dei `food_cost_portion` | **481,2458** | **481,2458** | **481,2458** |
| a costo zero | **0** | **0** | **0** |

Nessun numero si è mosso attraverso un cambio di tipo di colonna, due funzioni
ricreate e una vista rifatta. **`v_recipe_costs`, `v_recipe_row_costs` ed
`espansione_costo_ricetta` non sono state toccate da nessuna delle quindici
migrazioni.**

---

## 🔴 CINQUE RETI DIVENTATE ROSSE DA SOLE — e due volte il portiere era la cura sbagliata

| rete | cosa ha preso |
|---|---|
| `permessi.test.js` | `trova_o_crea_ingrediente` — **un `grant` che ho scritto a memoria** ricreandola |
| `permessi.test.js` | `categorie_proponibili` — `security definer` per abitudine |
| `permessi.test.js` | `vocabolari_per_assistente` — idem |
| `migrazioni-senza-portieri.test.js` | la verifica della `…018` che chiama un portiere nato dopo |
| **`npm run prova:migra`** | si è **rifiutato di applicare** una migrazione che toglieva un `security definer`, chiedendo di dichiararlo |

🔴 **E LA LEZIONE PIÙ UTILE È CHE IL PORTIERE È LA CURA SBAGLIATA IN DUE CASI
SU CINQUE**, e in silenzio:

- **`prezzo_ultima_versione`** la chiama un **trigger** su un carico che può
  fare lo staff. Dentro un `security definer` `auth.uid()` resta quello di
  **chi chiama**: `is_titolare()` sarebbe falso, e **un carico fatto in cucina
  non avrebbe mosso il prezzo**. → si **chiude la porta**.
- **`vocabolari_per_assistente`** la chiama anche `posta-leggi` con la
  **chiave di servizio**, dove `auth.uid()` è vuoto: gli elenchi sarebbero
  spariti e MEMO avrebbe lasciato la categoria vuota su ogni prodotto letto
  da una fattura. → si toglie `security definer` e **decide la RLS**.

⚠️ **La domanda che distingue le tre cure è «CHI la chiama»**, ed è finita nel
file delle trappole: nessun utente → si chiude; solo il titolare → portiere
che **rifiuta** (mai un filtro nella `where`); identità diverse fra cui un
servizio → decide la RLS.

⚠️ **E «togliere il motivo per cui compare» batte «dichiarare l'eccezione»**:
un elenco di eccezioni cresce, un caso che non esiste no.

### 🔴 Il `grant` scritto a memoria — la stessa trappola del 24/08, poche ore dopo averla riletta

Ricreando `trova_o_crea_ingrediente` ho preso il **corpo** dal database, come
vuole la regola del 18/08, e i **permessi** dal modello delle funzioni
accanto. Misurato: la migrazione del 12/08 faceva `revoke all … from public,
anon, authenticated` e **nessun grant**. Quel `grant` non ha ripristinato
niente — **ha aperto una porta che non c'era.**

*Una trappola scritta non è una trappola chiusa, nemmeno per chi l'ha appena
riletta.* A prenderla è stata la rete, non la memoria.

### 🔴 Togliere un enum non rompe niente finché nessuno esegue

`drop type ingredient_category` è passato: Postgres controlla le **firme**,
non i **cast dentro i corpi**. Tre funzioni lo nominavano e si sarebbero
fermate **al primo prodotto** creato da una foto, da una mail o da una frase
detta a voce. ⚠️ Lezione del 17/08 — *«un corpo che si crea non è un corpo che
funziona»* — e la cura è la stessa: **la verifica le CHIAMA**.

---

## Le prove, giudicate dai fallimenti

- **unità**: 45 file, **511** prove (erano 505), verdi.
- **sull'app**: 63 file, **444** prove, verdi — dopo cinque correzioni, ognuna
  nata da una rete rossa.
- **verifiche dentro le migrazioni**: 7 su 7, e ognuna **costruisce tutto
  quello che le serve**.

### Le rotture fatte apposta

| rottura | esito |
|---|---|
| un elenco di categorie rimesso in un modulo | 🔴 la prova pura lo nomina |
| un modulo sano | ✅ tace — un guardiano che segnala sempre si impara a spegnere |
| una riga di prompt che nomina UNA categoria | ✅ non è un elenco: tace |
| il `security definer` toltto a `categorie_proponibili` | 🔴 `prova:migra` si rifiuta di applicare, e chiede di dichiararlo |

---

## 🔴 LA SCHERMATA È STATA APERTA, E IL GESTO PERCORSO

⚠️ Il database dietro la porta si è **constatato dal DOM** (riferimento
`bnwqgpuyzmzujxfbtyvs`, la prova), non dedotto dal numero di porta.

🔴 **Difetto trovato aprendola, non rileggendola**: il campo per aggiungere una
categoria **non compariva mai**. La condizione era `!nuovaCategoria`, e gli
stati sono **tre** — chiuso (`null`), aperto e vuoto (`""`), scritto — quindi
la stringa vuota, che è falsa, schiacciava i primi due.
⚠️ **È la famiglia del terzo stato che sparisce, vista al contrario rispetto a
ieri**: in SQL sparisce dai **confronti** (`null <> 'x'` non scatta), in
JavaScript sparisce nei **controlli di verità**.

### Il giro, visto a schermo

1. il menu mostra **15 categorie lette dal database**;
2. scrivendo «Conserve MIS20260827» e premendo Aggiungi, il menu passa a **17
   voci** (Seleziona… + 16), la categoria nuova è **già scelta**, il campo si
   richiude, e la riga dice *«…aggiunta, ed è già scelta qui sopra.»*;
3. riscrivendo lo **stesso nome** con altre maiuscole e spazi in più, il menu
   **resta a 17** e dice *«c'era già: l'ho scelta qui sopra invece di crearne
   una seconda.»*
4. la categoria di prova è stata **ripulita**: 15 come prima, zero residui col
   marcatore, 133 ingredienti e 0 prodotti invariati.

### Le misure, a tre densità

| | computer (37,8) | tablet 8,3" (59,5) | tablet 7,9" (64) |
|---|---|---|---|
| il gesto «Manca la categoria giusta?» | **8,99 mm** | 9,00 | 9,00 |
| il campo | 9,76 | **8,50** | **8,50** |
| «Aggiungi» | **8,50** | **8,50** | **8,50** |
| «lascia stare» | 8,99 | 9,00 | 9,00 |
| sbordo dentro la pagina | **0** | **0** | **0** |
| scorrimento laterale | **0** | **0** | **0** |

---

## Cosa abbiamo rovesciato

**Due cose, e nessuna delle due è un cambio di idea di Alessio.**

**1. `INGREDIENT_CATEGORIES` in `constants.js` e la sua riga in `SPECCHIATI`.**
- *Cosa era stato deciso e quando* — 17/08/2026: un vocabolario chiuso vive in
  **tre posti** e una rete li tiene d'accordo, perché i tre **non dicono la
  stessa cosa** (il database dice quali valori sono legali, il JavaScript come
  si scrivono in italiano).
- *La ragione di allora* — fra il database e il JavaScript, se il secondo è più
  stretto un valore legittimo non si può scegliere e nessuno lo scopre.
- *Cosa si decide adesso* — per **questa colonna** il gestionale non ridice più
  niente: **legge**. Non ci sono due elenchi da tenere d'accordo, ce n'è uno.
- *Perché la ragione di allora non vale più* — **vale ancora per tutte le altre
  ventinove righe di `SPECCHIATI`, che non sono state toccate.** Quella regola
  presuppone un vocabolario che **il gestionale ridice**; qui il gestionale ha
  smesso di ridirlo, quindi il disaccordo non può esistere. ⚠️ E il prezzo si
  paga: **al posto della riga tolta ci sono due guardiani nuovi**, perché
  altrimenti fra sei mesi qualcuno riscrive l'elenco credendo di sistemare
  qualcosa.

**2. Gli elenchi scritti nei prompt delle funzioni online.**
- *Cosa era stato deciso e quando* — mai deciso esplicitamente: erano scritti
  lì da quando ogni funzione è nata, e le istruzioni di un modello si scrivono
  come un testo.
- *La ragione di allora* — un prompt è un testo, e un elenco dentro un testo si
  legge meglio di un segnaposto.
- *Cosa si decide adesso* — gli elenchi si **chiedono al database**.
- *Perché la ragione di allora non vale più* — perché le categorie hanno smesso
  di essere codice: un elenco scritto nel prompt sarebbe rimasto quello di
  ieri. ⚠️ **E dove la ragione vale ancora è stata rispettata**: in
  `schede-prodotto` gli elenchi restano scritti *anche* nelle istruzioni,
  perché lì servono a **spiegare quando usare quale valore** («frigo_0_4 per
  carne, pesce, freschissimi») — e quella parte è sapere di cucina, non un
  vocabolario del database.

Le due righe sono in [`docs/decisioni_rovesciate.md`](../decisioni_rovesciate.md).

---

## Cosa NON è verificato con gli occhi

- 🔴 **Nessuna foto vera, nessuna frase vera detta a voce, nessuna mail vera è
  passata dai prompt nuovi.** Le quattro funzioni online sono installate
  **solo sulla prova** e **nessuna chiamata all'API vera le ha esercitate**:
  non si sa se MEMO usa gli elenchi come chiesto. **È la voce più esposta di
  tutta la consegna**, come nel Blocco 1.
- 🔴 **L'elenco ingredienti non è stato aperto.** Ho cambiato la firma di
  `campiIngrediente` (ora riceve le categorie) e collegato il filtro: **nessuno
  ha guardato quella schermata**. Se il caricamento fallisse, il campo
  «Categoria» mostrerebbe il **codice** invece dell'etichetta — è la strada
  scelta apposta, ma non è stata vista.
- **La schermata delle schede prodotto e quella della posta** non sono state
  aperte.
- **Nessuna prova automatica guarda un prompt in funzione**: la rete nuova
  legge il **testo dei file**, non cosa MEMO risponde.

## Cosa ho contato senza leggerlo

- **I quattro posti** dove vivevano gli elenchi: trovati con un setaccio sui
  file e poi **letti uno per uno** — il quarto (quello che validava) è stato
  letto per intero, ed è il motivo per cui questa consegna esiste nella forma
  in cui è.
- **106 vocabolari chiusi** e **1 da catalogo**: contati, non guardati uno per
  uno. ⚠️ Erano **82** il 17/08: il numero è cresciuto coi blocchi di questi
  dieci giorni, e non è stato indagato in questa consegna.
- **511 e 444 prove**: letti dal totale dei comandi, non voce per voce.

## Quali mie affermazioni sono diventate false mentre lavoravo

1. La `20260827000030` diceva che `vocabolari_per_assistente` è aperta a tutto
   lo staff «perché MEMO lo usa oggi solo Alessio ma le foto della merce le
   farà chi riceve» — **una mia supposizione, non una decisione di Alessio**
   (la sua, del 25/08, è *«per ora l'assistente lo usa SOLO ALESSIO»*). La
   `…032` ha riscritto quella funzione e il commento nuovo poggia sul motivo
   **misurato**: la chiama la lettura della posta con la chiave di servizio.
   ⚠️ Il file della `…030` **è rimasto com'era**, come vuole la regola del
   23/08.
2. La `…030` creava `elenco_vocabolario` col suo commento; la `…032` **l'ha
   tolta**, e il commento è sparito con lei.
3. Il commento di `categorie_proponibili` nella `…026` non diceva niente sul
   `security definer`; la `…029` l'ha riscritto per dire che **non** ne ha uno
   e perché.

---

## Cosa resta in mano ad Alessio

1. **Il push** — quindici migrazioni e il codice dei due blocchi.
2. **Il via libera all'applicazione** in produzione.
3. **L'installazione in produzione delle cinque funzioni online**, che oggi
   sono aggiornate **solo sulla prova**.

### L'ordine dei comandi

Prima il push, poi le migrazioni **tutte insieme e in ordine di numero**:

```bash
npm run migra -- --conferma
```

Poi le funzioni online, in quest'ordine:

```bash
npm run funzione operazioni-atomiche -- --conferma
```

```bash
npm run funzione leggi-foto -- --conferma
```

```bash
npm run funzione ascolta-voce -- --conferma
```

```bash
npm run funzione posta-leggi -- --conferma
```

```bash
npm run funzione schede-prodotto -- --conferma
```

⚠️ **Le migrazioni vanno PRIMA delle funzioni online**: i quattro prompt nuovi
chiedono `vocabolari_per_assistente()`, che nasce con la `…030`. Installandoli
prima, ogni chiamata ricadrebbe sul ramo «gli elenchi non sono disponibili» —
non un guasto, ma MEMO lascerebbe la categoria vuota.

⚠️ **E `operazioni-atomiche` è la prima perché senza di lei
`registra_prodotto_letto` risponde 404**: una foto non farebbe nascere nessun
prodotto.

---

## I blocchi non aperti

**3** (MEMO guarda quello che salvi), **4** (la posta in arrivo: le mail che
non si aprono, «Conferma» che non dice cosa conferma, il carico con «Fornitore:
nessuno», la riga che dice dove è finita la cosa), **5** (il rifiuto muto).
Nessuno dei tre è stato toccato.

⚠️ **Del Blocco 4 è già stato misurato un pezzo per strada**: `posta-leggi`
sostituiva in silenzio le categorie, e quella è la prima delle cose che
Alessio ha visto storte in quella schermata. Le altre quattro restano intere.
