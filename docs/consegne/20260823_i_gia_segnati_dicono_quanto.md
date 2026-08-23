# I «già segnati» dicono quanto, e chi c'era

**23/08/2026 — Blocco 5** del mandato «l'unità in grammi, l'avviso sul
prodotto fermo, e due schermate». L'ultimo.

| | |
|---|---|
| migrazioni | `20260823000016_i_gia_segnati_dicono_quanto.sql`, `20260823000017_il_fermo_si_conta_in_italia.sql` |
| applicate | ✅ progetto di prova — ❌ **non** in produzione |
| schermata | `/cassa/scontrinato` — riquadro *Già segnati* |

---

## Il difetto, misurato

L'elenco mostrava **data, tavolo e tipo di documento**, e basta. Sui dati
veri: **15 gruppi di righe indistinguibili fra loro**.

Con l'importo diventano una riga sola ciascuno — e quel numero il
gestionale ce l'aveva già.

✅ **Misurato dopo, dentro la verifica**, non promesso:

> *Righe indistinguibili: **15 gruppi** con data+tavolo+tipo, **0**
> aggiungendo importo e nome.*

---

## Il nome del cliente: dove il legame del 18/08 diventa visibile

Ce l'hanno **176 conti su 329**, e viene dalla prenotazione. Fino a oggi
quel dato era **scritto e non lo mostrava nessuna schermata** — che per
chi usa l'app è indistinguibile da un dato non scritto.

⚠️ **Vuoto è normale e non è un difetto**: chi entra senza prenotare non
ha un nome, e inventarlo sarebbe peggio. La verifica lo controlla nei due
versi — c'è dove c'è una prenotazione, e **non c'è** dove non ce n'è.

✅ A schermo: **153 righe senza nome**, cioè esattamente 329 − 176.

---

## ⚠️ Il caso che resta, dichiarato e lasciato lì

Due conti **sullo stesso tavolo, chiusi nello stesso minuto, per lo stesso
importo, senza nome** restano indistinguibili. Non si costruisce niente:
l'unica cura sarebbe mostrare l'identificativo del conto, cioè un numero
che non dice niente a nessuno.

🔴 *«Non può succedere» non è una proprietà del programma, è del locale*
(regola del 19/08): nessun vincolo lo impedisce, lo impedisce un'osteria
da 34 coperti. Scritto perché chi legge fra un anno non si fermi lì.

---

## Perché una funzione e non un `select` più largo

L'importo di un conto **non è una colonna**: è `totale_conto()`, che dal
15/08 è l'unico posto dove si calcola il totale di un conto. Leggerlo da
PostgREST vorrebbe dire ricalcolarlo nella schermata — il quarto posto che
dice quanto vale un conto.

La verifica lo tiene fermo con una **proprietà**: la somma dei «già
segnati» con documento deve fare esattamente il totale «con documento»
della quadratura. ✅ Controllato anche a schermo: **61.352,00 €** da
entrambe le parti.

### E passando dal database sono cadute due cose che nessuno aveva chiesto

- ⚠️ **Il filtro tagliava a `closed_at`**, cioè a mezzanotte di
  calendario: un conto chiuso all'una finiva nel giorno dopo, mentre i
  totali in cima alla **stessa schermata** lo contavano nella sera prima.
  Ora passa dalla serata, come tutto il resto del riquadro.
- ⚠️ **C'era un `.limit(50)`**. Un elenco di conti che si ferma a 50
  sembra completo senza esserlo — la famiglia del taglio a mille righe.

---

## 🔴 La rete del fuso ha trovato quattro funzioni del blocco 3

`tests/app/giornata-operativa.test.js` è diventata rossa nominandole:

> `partite_ferme` · `abbatti_partita` · `rimanda_partita` · `sprechi_e_resi`

Il fuso del database è **UTC**: fra mezzanotte e le due `current_date`
risponde **ieri**. In un locale che chiude all'una vuol dire una partita
ferma da **un giorno in meno** del vero, «ricordamelo fra 7 giorni» che ne
conta **6**, e un abbattimento con scadenza «domani» **rifiutato** perché
per il database domani è oggi.

⚠️ **È la quinta ricomparsa della stessa famiglia**, e stavolta in codice
scritto **oggi**, con la regola già negli appunti.

⚠️ **E il giorno giusto qui è il CALENDARIO, non la serata**: *«questa
partita è ferma da 25 giorni»* è una durata fisica, e vale uguale che il
prodotto sia in cella dalle 19 o dalle 3 di notte. Il calendario però
dev'essere quello **italiano**. Corretto in `20260823000017`.

### 🔴 E perché mi era sfuggito, che è la parte utile

Dopo il blocco 3 avevo fatto girare **solo le prove che ritenevo
pertinenti** — prodotto fermo, permessi, vocabolari, lista spesa, vitto —
e `giornata-operativa` non era fra quelle. *Un sottoinsieme di prove
scelto da chi ha appena scritto il codice è scelto dalle stesse
convinzioni che hanno prodotto il difetto.* La suite intera va girata
prima del commit, non le prove che sembrano attinenti.

---

## ⚠️ Un limite della schermata, preesistente e non toccato

Misurata col valore del tablet (64, viewport 768): la pagina **non
sborda**, la tabella del blocco 4 scorre nel suo contenitore, ma il testo
delle righe è **2,50 mm**, sotto la soglia di 3,20.

⚠️ **È preesistente e già censito**: il referto del 22/08 misura
`/cassa/scontrinato` con testo minimo **1,49 mm** e bersaglio 2,70. La
riga che ho toccato usava già `text-sm` prima. **Non l'ho corretto**:
portarla in soglia vuol dire ridisegnare la schermata intera, che è un
lavoro suo e non una riga di questo blocco.

---

## ⚠️ Cosa abbiamo rovesciato

**Niente.** Il riquadro faceva già quello che deve fare — permettere di
disfare un segno messo per sbaglio (Blocco 5.2 del mandato di correzione,
16/08). Qui cambia solo **quanto dice ogni riga**.

---

## ⚠️ Cosa questo blocco NON verifica

1. **Nessuna mano diversa dalla mia** ha usato il riquadro.
2. **Zero fatture vere nei dati** (319 scontrini, 10 da emettere, 0
   fatture): il ramo che scrive «fattura n. …» non è mai stato visto.
3. **Il caso indistinguibile residuo** è dichiarato e non provato: non
   esiste nei dati e non è stato costruito.
4. **Non è in produzione.**

---

## 🔴 Contando i residui è saltato fuori il difetto peggiore della giornata

A blocchi finiti ho contato cosa restava sul progetto di prova. C'erano
**cinque «TEST-AUTO prodotto fermo»**, uno per ogni esecuzione della prova
del blocco 3.

**La causa, misurata**: `stock_consumptions` ha **solo una policy di
lettura** — scelta deliberata del 16/08 («ricrearla `for all` per
uniformità avrebbe aperto una porta che non c'era»). Quindi dal client i
suoi movimenti non si possono togliere, e la cancellazione
dell'ingrediente viene respinta dalla chiave esterna.

⚠️ **E la prova non se ne accorgeva**, perché cancellava **senza guardare
l'esito**: PostgREST non si lamenta quando la RLS filtra via le righe da
cancellare — ne toglie zero e risponde di sì. *Una pulizia che non si
controlla è una pulizia che non è avvenuta.*

### E rigirandola una seconda volta diventava rossa

Il reso scrive uno **scarico**, e uno scarico è un movimento: al giro
dopo `partite_ferme()` vedeva il prodotto «toccato oggi» e non lo diceva
più fermo. *Una prova che passa solo la prima volta è una prova che
domani si dà la colpa da sola.*

**Curata in tre modi**, tutti misurati e non supposti:
- l'ingrediente **si riusa** invece di essere ricreato, come fa già
  `allineamento-magazzino.test.js`;
- il **reso ha un prodotto suo**, così quello principale non riceve mai
  scarichi e resta fermo a ogni giro;
- una prova nuova **conta i residui** e diventa rossa se i prodotti di
  prova passano da due a tre.

✅ **Girata tre volte di fila: 9 verdi, 9 verdi, 9 verdi.**

I quattro doppioni e i tre scarichi rimasti sono stati **tolti dal
database** — dal client non si poteva — controllando che le lapidi
restassero le stesse (121 prima, 121 dopo).

---

## Una prova esistente rotta dalla correzione del singolare

`tesoreria.test.js` cercava la frase *«non spariscono da soli»*, e col
singolare del blocco 4 la frase dice *«non sparisce da solo»*. Corretta la
**prova**, non la frase: ora guarda la **promessa** e non la sua forma
grammaticale.

---

## 🔴 La suite intera ha trovato l'ultima cosa, ed è una buona notizia

Girata su tutto il gestionale, **cinque prove rosse in due file**. La
diagnosi ha smentito la prima ipotesi (residui accumulati) e ne ha
trovata una migliore.

### Una era una conseguenza del blocco 2, e dimostra che funziona

`scarico-magazzino.test.js` costruiva apposta una riga di ricetta da
**0,00002 kg** — venti milligrammi — per dimostrare il difetto del
pizzico che fermava lo scarico di tutto il tavolo. Da oggi il database
**la rifiuta**, col messaggio del blocco 2:

> *La quantità di TEST-AUTO pizzico non può essere zero. E se hai scritto
> un numero più piccolo di 0,0001 kg… cambia l'unità del prodotto in
> grammi.*

⚠️ **Il difetto non è più producibile dall'app**, ed è esattamente ciò che
il blocco 2 doveva ottenere. Ma il caso da sorvegliare non è sparito: è
quello **vero** della cannella, dove il fabbisogno scende sotto soglia
perché si **divide per le porzioni**. La prova ora lo costruisce così —
riga legale da 0,0002 kg su una ricetta che rende 20 porzioni, fabbisogno
di una porzione 0,00001 kg — e l'ingrediente principale è compensato
(15 kg su 20 porzioni = 0,75 a porzione, identico a prima), così tutto il
resto della prova misura le stesse cose di ieri.

### E le altre quattro erano il residuo di quella

`scarico-magazzino` moriva nel `beforeAll` e lasciava i suoi conti in
piedi; `tesoreria.test.js`, che gira dopo sullo stesso database, ne
contava **125 invece di 100** e **500 invece di 250**.

⚠️ È la regola già scritta negli appunti: *«in una catena di prove che
condividono lo stato, la prima che fallisce può far cadere le successive
per il RESIDUO che lascia, non per il difetto»*. Chi conta i rossi conta i
difetti solo se le prove sono indipendenti — qui i difetti erano **uno**,
i rossi cinque.

✅ Corretta la costruzione del pizzico: **scarico-magazzino 7 verdi,
tesoreria 19 verdi**, senza toccare nient'altro.

### ⚠️ E due volte ho falsato la misura da solo

Ho lanciato la suite in background e poi **ho lavorato sullo stesso
database mentre girava** — una volta modificando i file di prova, una
volta girando `tesoreria` da sola in parallelo. La seconda mi ha dato un
`500 invece di 250` che non esisteva: *una misura presa mentre qualcun
altro scrive non è una misura*. Le due volte in cui la suite ha detto il
vero sono quelle in cui non ho toccato niente.

### ✅ Suite intera, a mandato finito

**630 prove su 630 verdi, 75 file su 75, zero saltate.** (Prima di questo
blocco erano 621 su 630, con 7 saltate — le sette di `scarico-magazzino`,
che saltavano perché il file moriva nel `beforeAll`.)
