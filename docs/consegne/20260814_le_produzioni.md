# Consegna del 14/08/2026 (quinta) — le Produzioni

**Commit della consegna: `6f51e0c`** (questo riepilogo è il commit
immediatamente sopra, sola documentazione). Working tree pulito.

| Commit | Cosa |
|---|---|
| `96a7c01` | le Produzioni — migrazione `20260814000004` |
| `6f51e0c` | stato della produzione dopo l'applicazione |

**Applicata in produzione**: `20260814000004`. **90 migrazioni**.
`operazioni-atomiche` reinstallata (**v17 → v18**).

È il **Blocco 2 del mandato «dal magazzino che scende alla rotta
economica»**. Resta il Blocco 3, la Proiezione economico-fiscale.

---

## 1. Dove sta un ragù in magazzino

Una preparazione è una **ricetta**, e i lotti stanno sugli
**ingredienti**: finora un semilavorato non poteva esistere in cella.

Ogni preparazione prodotta riceve un ingrediente proprio
(`ingredients.preparazione_id`), che nasce da solo alla prima
produzione. **Non è un doppione dell'anagrafica**: è il posto dove
mettere i lotti, e fa funzionare senza modifiche tutto ciò che già
guarda il magazzino — giacenza, scadenziario, FEFO, rintracciabilità.

⚠️ **Non deve inquinare ciò che si compra.** Un ragù non si ordina a un
fornitore: nasce senza scorta minima (quindi **mai** in lista della
spesa), senza fornitore, con gli avvisi di rincaro spenti. Sono
conseguenze di un fatto solo, e ognuna è verificata — compreso il caso
diretto: si lancia `add_below_threshold_items()` e si pretende che i
semilavorati non entrino.

⚠️ **Non è marcato `produzione_interna`, e me l'ha detto il database.**
Applicando la prima volta, il vincolo `ingredient_source_coherence` ha
rifiutato la riga: in questo progetto `produzione_interna` non vuol dire
«fatto in casa», vuol dire **«prodotto dall'azienda agricola»**, e
pretende l'entità produttrice perché da lì passa la cessione
intercompany. Un soffritto non c'entra niente con l'orto: usare quel
valore lo avrebbe fatto entrare in una contabilità che non è la sua.
Ciò che distingue un semilavorato è `preparazione_id`, esplicito e senza
altri significati.

---

## 2. I due numeri, che sono il cuore del blocco

La versione minima sono **due numeri, non uno**: quante dosi e quanto ne
è uscito.

⚠️ Con un numero solo non si distingue **il calo dalla mezza dose**: 4 kg
di ragù possono essere una dose andata male o mezza dose venuta
benissimo, e sono due fatti opposti. Distinguere è tutto il valore del
blocco — da lì nasce la resa vera, e dalla resa vera il food cost vero.

Il database li pretende entrambi: dosi a zero e quantità a zero sono
rifiutate, con un messaggio scritto per chi è in cucina («*Quante dosi
hai fatto? senza, un calo e mezza dose sono la stessa cosa*»).

**La resa la scopre il sistema** (`rese_preparazione`): quanto esce
davvero da una dose, in media, contro quanto dice la ricetta. Alla
produzione successiva il numero si **propone precompilato**, dicendo su
quante produzioni si basa — mai scritto da solo senza dire su cosa si
appoggia.

---

## 3. L'interruttore, e vale in due posti

**Se un semilavorato ha lotti, non si esplode: si consuma**, al costo
che aveva quel giorno. È così che un calo di resa a un livello basso
arriva fino al piatto invece di sparire.

**Se non ne ha, si esplode fino alla materia prima** come faceva il
Blocco 1 — così una cucina che non registra ogni passaggio continua a
funzionare, invece di bloccarsi su un semilavorato che non esiste in
cella.

⚠️ **Lo stesso interruttore è entrato in `fabbisogno_conto`**, ed era
dichiarato nel riepilogo del Blocco 1 come l'aggancio da fare qui. Senza,
servire un piatto col ragù scaricherebbe **due volte** le stesse verdure
— una alla produzione e una alla vendita — e **nessuna delle due
scritture sembrerebbe sbagliata**. La giacenza sarebbe scesa il doppio
senza che niente lo segnalasse.

---

## 4. Il costo si congela

La produzione scarica gli ingredienti dai lotti (FEFO) e crea **un lotto
del semilavorato col suo costo**, che è la somma di ciò che è uscito
davvero dalla cella. Quel costo è fermo: i rincari di domani toccano le
produzioni future, mai il ragù già in frigo. Stesso principio del prezzo
del coperto fotografato sul conto e del costo degli omaggi.

**Non si inventa e non si blocca**: se la giacenza non basta si toglie
quello che c'è e si dichiara il mancante in `anomalie_scarico` (che ora
accetta come origine un conto **oppure** una produzione, mai tutti e
due). Il semilavorato è già sul fuoco: fermarlo non lo fa tornare
indietro.

---

## 5. Verifica — il ragù a tre livelli, coi numeri a mano

Dentro la migrazione, con i ruoli veri (la produzione la registra lo
**staff**, il costo lo legge il **titolare**):

| Cosa | Stato |
|---|---|
| la migrazione sul progetto di prova | **applicata due volte**: idempotente |
| senza soffritto in cella, il ragù esplode fino alla cipolla | **provato** |
| produzione del soffritto: 2 kg di cipolla → **1,4 kg** invece di 1,5 | **provato** |
| la cipolla scende di 2 kg; il soffritto costa **4,00 €** | **provato** |
| il costo al chilo usa la **resa vera** (4,00/1,4), non quella in ricetta | **provato** |
| col soffritto in cella, il ragù **non riesplode** la cipolla | **provato** |
| il ragù consuma **0,5 kg di soffritto** | **provato** |
| **la cascata**: ragù = 0,5 × (4,00/1,4) + 2 × 8,00 = **17,4286 €** | **provato a mano** |
| la resa media (1,4) e lo scostamento dalla ricetta (**−6,7%**) | **provato** |
| un piatto col ragù consuma **il ragù**, non la carne | **provato** |
| un semilavorato non entra nella lista della spesa | **provato** |
| dosi a zero, quantità a zero | **rifiutate** |
| un **piatto finito** non si «produce» | **rifiutato** |
| giacenza insufficiente: non blocca e dichiara il mancante | **provato** |
| la cucina vede l'elenco delle produzioni, **senza costi** | **provato** |
| elenco anonimi | **12**, controllato dentro la migrazione |
| prove automatiche | **46 verdi** |
| lint, build | puliti |
| **produzione** | **90 migrazioni**, corridoio **v18** |
| `security definer` senza portiere | **14**, invariato |
| residui della verifica in produzione | **zero** |

`registra_produzione` non entra nell'elenco dei «senza portiere» perché
il controllo sull'utente ce l'ha dentro, come `close_order_paid`.

---

## 6. Cosa NON è verificato, e lo dico chiaro

- **Nessuna preparazione esiste nel Ricettario** (0 ricette in
  produzione). La schermata delle Produzioni oggi dice «nessuna
  preparazione» ed è il comportamento giusto: **non si è mai vista
  funzionare con una ricetta vera**. Tutto ciò che è provato sta dentro
  la migrazione.
- **Il caso peggiore non è stato visto**: un albero profondo con
  semilavorati prodotti in momenti diversi e prezzi cambiati in mezzo. La
  verifica ne prova tre livelli in un istante solo.
- **Manca la sorveglianza delle rese** (punto 4 del Blocco 2): oggi lo
  scostamento si vede in schermata quando si registra, ma **nessun avviso
  parte** se una resa esce dalla media. Dichiarato, non fatto.
- **Manca la catena in un gesto solo** (punto 5): soffritto → macinato →
  ragù si registrano oggi come tre produzioni separate. Il risultato nel
  database è lo stesso; il gesto in cucina no.
- **Un semilavorato non ha una scadenza proposta**: si scrive a mano, e
  se si lascia vuota il lotto entra senza scadenza — quindi fuori dallo
  scadenziario. Non è un difetto (i vegetali sfusi stanno lì per scelta
  di Alessio), ma per un ragù in frigo è una dimenticanza facile.
- **`produzioni_display` non è mai stata letta da uno staff vero**: nella
  migrazione si controlla che risponda, non come appare.
- **I dati di collaudo restano in produzione**, `/prova-voce` è ancora
  lì, e il messaggio delle 10:00 dello scadenziario non l'ha ancora visto
  partire nessuno.
