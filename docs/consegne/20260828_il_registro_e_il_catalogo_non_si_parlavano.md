# Blocco 1 — il registro diceva 289 e il catalogo diceva un'altra cosa

**28/08/2026** · Blocco 1 del mandato. È il blocco più delicato: il gestionale
vero era **a metà**, e nessuno dei due posti che avrebbero dovuto dirlo lo
diceva.

| | |
|---|---|
| **HEAD dichiarato** | `733ed25` — *Il registro diceva 289 e il catalogo diceva un'altra cosa* |
| **Working tree** | pulito al momento del commit |
| **Migrazioni introdotte** | `20260828000007` |
| **In produzione** | 🔴 **nessuna** al momento della scrittura — aspetta il push di Alessio |
| **Sul progetto di prova** | applicata: **311** migrazioni registrate |
| **Prove** | 525 di calcolo — verdi; build pulita; lint a zero |

---

## Cosa ho misurato, prima di toccare qualunque cosa

**Non ho creduto al nome dei file: ho chiesto al catalogo, oggetto per oggetto.**

| migrazione | stato in produzione | come l'ho stabilito |
|---|---|---|
| `20260827000018` | 🔴 **DDL completa, non registrata** | 13 oggetti su 13 presenti: 3 colonne di `articoli_fornitore`, 2 di `stock_lots`, l'indice, `ingredients.prezzo_da`, il suo vincolo, 4 funzioni, 1 trigger |
| `20260827000019` → `20260828000006` (20) | **assenti per intero** | ogni oggetto DDL di ognuna cercato nel catalogo: zero |

E **nessun residuo di dati**: zero ingredienti, zero fornitori, zero lotti,
zero righe di storico prezzi. Il blocco di verifica della `…018` si è
annullato per intero, come doveva.

`applied_migrations`: **289 righe, ultima `20260827000017`, ultima scrittura
27/08 alle 18:43:48** — cioè *identico a ieri sera*. Il registro non ha
registrato niente, e intanto lo schema era cambiato.

---

## Le due cause. Tutt'e due misurate, nessuna dedotta

### 1. La verifica della `…018` è SCADUTA

Al passo 4 scrive due lotti con un istante **scritto a mano** — il 27 agosto
alle 9 del mattino — e li confronta con altri due scritti a `now()` meno un
giorno.

Il 27 agosto quell'ora era la più recente, e la verifica passava. **Dalle 9 del
mattino del 28 agosto `now()` meno un giorno la scavalca**, e la verifica
pretende 21,00 dove il gestionale risponde — giustamente — 12,00. Alessio ha
lanciato il comando dopo quell'ora.

🔴 **NON è una differenza fra il gestionale vero e il progetto di prova**, che
è la spiegazione che veniva per prima. L'ho messa alla prova nel modo che la
discrimina: **lo stesso blocco, lanciato oggi sulla prova, fallisce identico**.
È il calendario.

> È una **data diventata falsa da sola**, cioè la stessa famiglia delle frasi
> diventate false che questo progetto insegue da settimane — stavolta **dentro
> un controllo**, che è il posto dove nessuno la cercava.

⚠️ **Ho cercato il telaio, non il caso.** Su 310 migrazioni, **11** contengono
una data del 2026 scritta a mano e **7** nominano anche `now()`. Guardate una
per una: **la `…018` è l'unica** che confronta *per ordine* un istante assoluto
con uno relativo. Le altre sei confrontano assoluto con assoluto — sono
deterministiche e non scadranno mai. **Famiglia di uno**, e il metro è provato
nei due versi: trova la `…018`, e correttamente non segnala le sei sane.

### 2. Lo strumento non poteva dirlo — ed è il difetto di telaio

`npm run migra` applicava con `psql -v ON_ERROR_STOP=1 -f file.sql`, **senza
`--single-transaction`**. Quindi psql chiude **una transazione per ogni
istruzione**: le DDL restano committate, il blocco di verifica fallisce e si
annulla da solo, e la registrazione — che è l'**ultima riga del file** — non
viene mai raggiunta.

🔴 E sopra a quel comando c'era scritto:

> «Una migrazione che fallisce non lascia niente a meta'.»

**Era falso**, ed è quello che ha reso l'incidente invisibile. Il difetto vero
non è lo stato a metà: è che **nessuno poteva saperlo**. Il registro diceva 289
e il catalogo diceva un'altra cosa, e nessuno dei due dichiarava di essere in
disaccordo con l'altro.

---

## La cura del telaio, in un posto solo

`argomentiMigrazione()` in [`scripts/comune.mjs`](../../scripts/comune.mjs),
usata da **tutt'e quattro** i comandi che applicano migrazioni: `migra`,
`prova:migra`, `prova:ricostruisci`, `ricostruzione:verifica`. Erano quattro
copie della stessa riga; adesso è una regola sola.

- **Atomica per impostazione predefinita**: `--single-transaction`. O entra
  tutta, registrazione compresa, o non entra niente.
- **L'eccezione si riconosce DAL FILE, non si ricorda**: un valore aggiunto a
  un enum non è usabile finché quella transazione non è chiusa. Quelle
  migrazioni girano per istruzioni, come prima — **e lo dicono**, invece di
  farlo in silenzio.
- **Il messaggio di errore dice il vero**, e dice due cose diverse a seconda di
  come la migrazione stava girando.

### Provata in quattro modi, non in uno

| prova | risultato |
|---|---|
| vecchio modo, file che fallisce dopo la DDL | 🔴 la tabella **sopravvive** — l'incidente riprodotto |
| nuovo modo, stesso file, stesso errore | ✅ la tabella **non c'è** |
| controprova: stesso file **senza** l'errore | ✅ la tabella **c'è** — la prova discrimina |
| l'eccezione è necessaria? | ✅ dentro una transazione Postgres risponde *«unsafe use of new value»*; per istruzioni funziona |

🔴 **Il primo tentativo di provare l'eccezione misurava un'altra cosa**: creava
il tipo nella stessa transazione, che è **il caso esente** di Postgres. Rifatto
col tipo creato prima, e allora l'errore è comparso. *Un misuratore nuovo si
prova su un caso di cui si conosce già la risposta* — e questo affina la nota
del 19/08: la restrizione **non** vale se il tipo nasce nella stessa
transazione.

⚠️ **Il setaccio toglie i commenti prima di guardare.** Nel testo grezzo il
conto diceva **11** migrazioni con un valore aggiunto a un enum; sono **8**, e
fra i tre falsi c'era **`…026`, una delle migrazioni in attesa** — cioè il
setaccio grezzo avrebbe tolto l'atomicità proprio a chi ne aveva bisogno oggi.

---

## Come si è riportato il vero in uno stato coerente

**La `…018` non si riscrive**: è registrata sul progetto di prova dal 27/08,
quindi è una migrazione applicata. Si è fatto come la `…023` con la `…012` e la
`…032` con la `…030`: **una migrazione nuova che rifà il controllo con roba
propria e registra ciò che risulta già applicato.**

`20260828000007` fa due cose:

1. **È completa?** Chiede al catalogo tutti e tredici gli oggetti della `…018`,
   uno per uno. Non deduce da «la migrazione è girata»: guarda.
2. **Funziona?** Esercita il riflesso del prezzo con roba costruita da sé —
   **nessun istante assoluto**. Il pareggio, che è il punto del `progressivo`,
   si costruisce mettendo due lotti sullo **stesso istante preso da una
   variabile**, invece di sperare che una data scritta a mano resti la più
   recente. È il più recente per costruzione: oggi, e fra un anno.

Le risposte sbagliate danno **numeri diversi fra loro** — 20,00 se
l'ordinamento sceglie a caso, 12,00 se il pareggio non è rotto affatto — quindi
il controllo dice *quale* difetto ha trovato.

### Rotta in due modi diversi, e ne è uscito un difetto mio

| rottura | messaggio |
|---|---|
| il pareggio ordinato al contrario | *«Il pareggio di istante sceglie a caso: 20,00 invece di 21,00»* |
| tolta una colonna dei tredici oggetti | *«La 20260827000018 è in produzione solo a metà. Manca: articoli_fornitore.marca»* |
| tolti **due** oggetti | li nomina **tutti e due** |
| nessuna rottura | il racconto di cosa ha controllato |

🔴 **La seconda rottura ha trovato un difetto nel mio guardiano**: concatenando
un letterale a un array di testo senza cast, Postgres lo legge come un array e
il controllo moriva con *«malformed array literal»* — cioè avrebbe gridato una
cosa incomprensibile invece di **nominare** ciò che manca. Corretto con
`::text` su tutte e tredici. *È esattamente il motivo per cui si rompe in due
modi invece che in uno.*

🔴 **E provando sulla prova è emerso un secondo caso**: dalla `…023`,
`andamento_prezzo` ha un portiere, e **dentro una migrazione `is_titolare()` è
falso**. Il controllo impersona quindi un titolare vero. In produzione oggi
sarebbe passato — il portiere non c'è ancora — **e sarebbe fallito domani**,
appena applicata la `…023`.

---

## Cosa abbiamo rovesciato

**Una cosa, ed è di metodo.**

- **Cosa era stato deciso e quando**: le migrazioni si applicano con `psql -f`
  e basta, per istruzioni. È così dal primo giorno del comando `migra`.
- **La ragione di allora**: un valore aggiunto a un enum non è usabile nella
  stessa transazione (misurato il 19/08). Applicare per istruzioni fa
  funzionare quelle migrazioni senza spezzarle in due file.
- **Cosa si decide adesso**: atomica per impostazione predefinita, per
  istruzioni **solo** dove il file contiene davvero quel caso, riconosciuto dal
  file e dichiarato a voce alta.
- **Perché la ragione di allora non vale più**: non è caduta — **vale ancora,
  per otto migrazioni su 310**. Quello che era sbagliato era **applicarla a
  tutte e 310** per comodità di scrittura, pagando su ogni altra migrazione il
  rischio di uno stato a metà che nessuno può vedere. La ragione non era falsa:
  era **troppo larga**.

Una riga aggiunta in [`docs/decisioni_rovesciate.md`](../decisioni_rovesciate.md).

---

## Cosa NON è verificato

- 🔴 **Niente di tutto questo è in produzione** al momento in cui scrivo: la
  `20260828000007` e la correzione dello strumento **aspettano il push di
  Alessio**. Il controllo che lo impedisce è quello giusto e non si aggira.
- ⚠️ **Nessuna schermata è stata aperta** in questo blocco: è tutto database e
  strumenti a riga di comando.
- ⚠️ **Le prove sull'app (`npm run test:app`) non sono state lanciate** in
  questo blocco: quelle di calcolo sì (525, verdi). Il gancio pre-commit lancia
  lint, prove di calcolo e build, e sono passati tutti e tre.
- ⚠️ **La ricostruzione da zero non è stata rilanciata** dopo la modifica dei
  quattro comandi. Il cambiamento la tocca, e va rifatta.

---

## Da ricordare, perché tornerà

🔴 **La `20260827000018` va SALTATA PER SEMPRE**, anche in una ricostruzione da
zero: la data che contiene non tornerà mai più vera. Come la `…030` e la
`…033`:

```
npm run migra -- --salta 20260827000018 --conferma
```

Nessuna rete lo impedisce, ed è scritto qui perché fra sei mesi nessuno debba
rifare l'indagine.
