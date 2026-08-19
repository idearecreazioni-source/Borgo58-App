# Le letture annidate misurate, e i due conti annullati in produzione

**Migrazione applicata**: `20260819000011` — i due conti di prova rimasti
aperti su T1 e T6 sono **annullati**. **148 migrazioni in produzione.**
**Misura, nessuna correzione** sulle letture annidate: decisione di Alessio.

---

## ⚠️ Cosa NON è verificato

1. 🔴 **Il segnale delle letture tagliate NON copre le letture annidate**, ed
   è la cosa più importante di questa consegna: fino a stanotte sembrava
   coperto. Vedi il punto 1.
2. ⚠️ **La misura del tetto per riga padre è stata fatta con due padri**: non
   è provato che regga con centinaia di padri che superano il tetto insieme.
3. ⚠️ **Non copre le Edge Function**: se una di loro facesse una lettura
   annidata, non passerebbe né dal segnale né dal censimento.
4. ⚠️ **Il «nessuna può arrivarci» è un giudizio sul locale**, non una regola
   del programma: nessun vincolo impedisce a un conto di avere mille righe —
   è la realtà di un'osteria da 34 coperti a impedirlo.
5. 🔴 **Nessuna mano ha guardato la sala dopo l'annullamento dei due conti**:
   è misurato dal database (0 conti aperti), non visto su un tablet.

---

## Cosa abbiamo rovesciato

**Nessun rovesciamento.** Ma una cosa scritta poche ore prima si scopre
**incompleta**: la consegna della sera dichiarava le letture annidate come
«non coperte, mai misurate». Adesso sono misurate, e la parte da correggere
non è la dichiarazione — è che *sembrava una voce di coda e invece era la
domanda che decideva l'ordine delle cose*.

---

## 1 · 🔴 Il segnale non vede le letture annidate — risposto per primo

Alessio aveva chiesto di rispondere a questa **prima** delle altre, perché
cambierebbe l'ordine dei lavori. La risposta è **no**, e la misura è questa:
costruiti sul progetto di prova due conti — uno con **1200 righe**, uno con
**5** — e letti in un colpo solo, come fa la sala.

| lettura | cosa è tornato | il gestionale se n'è accorto? |
|---|---|---|
| `orders` con dentro `order_items` | il grande con **1000 righe**, il piccolo con 5 | 🔴 **NO — nessun avviso** |
| le stesse 1200 righe chieste da sole | 1000 | ✅ sì, «1000 su 1200» |

**Perché**: il confronto fra righe consegnate e righe dichiarate si legge da
`Content-Range`, e quell'intestazione parla **solo delle righe padre**. Nella
prova i padri erano 2 su 2 — nessuna bugia — mentre il figlio grande perdeva
200 righe in silenzio.

---

## 2 · Il tetto è PER RIGA PADRE, e questo cambia la priorità

Misurato invece che dedotto, com'era stato chiesto: nella **stessa** richiesta
il conto grande ha ricevuto **1000** righe e il piccolo le sue **5**. Se il
tetto fosse per interrogazione, il piccolo sarebbe rimasto senza.

⚠️ **La conseguenza è che il rischio si restringe molto**: non conta il numero
complessivo di righe figlie, ma **quante ne ha un singolo padre**. Un elenco
di mille conti con tre righe l'uno non tocca il tetto.

**Le letture annidate dell'app sono sette**, e **nessuna** può avere mille
figli sotto un padre solo: le righe di un conto, i tavoli di un conto, i
tavoli di una prenotazione, gli allegati e le azioni di una mail, le righe di
una distribuzione di mance, le note e i DDT di una fattura.

⚠️ **E i tre casi che Alessio aveva nominato come pericolosi non sono letture
annidate**: un fornitore con tutte le sue fatture, un ingrediente con tutto lo
storico prezzi e un registro HACCP intero si leggono **piatti** — quindi sono
già coperti dal segnale, e due dei tre hanno pure un limite esplicito.

---

## 3 · Quello che resta, ed è strutturale

**Una lettura annidata alimenta un calcolo**: `orders → order_items` alimenta
`orderTotals()`, cioè il totale del conto sul preconto e alla chiusura. Se un
conto avesse più di mille righe, il totale sarebbe **più basso del vero e
tornerebbe con quello che si vede a schermo**.

🟢 Oggi irraggiungibile — mille righe su un tavolo solo. 🔴 **Ma è la ragione
per cui la voce non si archivia**: il giorno che una lettura annidata nuova
pescasse da una tabella che cresce, il difetto sarebbe **già armato e muto**.

⚠️ **E per le righe figlie il trucco della sera non esiste**: `Content-Range`
porta un totale solo. Le strade restano due, entrambe diverse da quella già
fatta — **l'indizio** (una lista figlia con *esattamente* mille elementi è
quasi certamente tagliata: costa zero, ma è un sospetto) e **la domanda in
più** al database quando l'indizio scatta. Non costruito: oggi non c'è nessun
punto raggiungibile da proteggere, e la decisione è di Alessio.

Tutto in [`referti/20260819_il_taglio_a_mille_righe.md`](../referti/20260819_il_taglio_a_mille_righe.md),
addendum in fondo.

---

## 4 · I due conti annullati

Migrazione `20260819000011`, applicata dopo il push. Ha nominato quello che
toccava prima di toccarlo:

> *Conti di prova rimasti aperti: 2 (T1 del 18/08 alle 22:04, T6 del 18/08
> alle 22:21).*

**Numeri veri dopo**, letti dalla produzione:

| | |
|---|---|
| migrazioni in produzione | **148** |
| conti | **8**, di cui **0 aperti** |
| movimenti di cassa | **0** — invariati, ed è il punto |
| scarichi di magazzino | **9** — invariati |
| tracce di cancellazione | **26** — invariate |

⚠️ **Annullati e non chiusi**: chiudere avrebbe scritto un incasso, e *zero
movimenti di cassa* è la proprietà che ha reso questi lavori a costo zero. La
migrazione lo controlla invece di sperarlo — se un euro fosse entrato, si
sarebbe fermata.

---

## Per Alessio, in una riga

I due conti aperti non ci sono più e non è entrato nessun euro; e sulle
letture annidate la risposta è che il gestionale **non** le vede, ma oggi non
c'è nessun punto in cui possa succedere davvero.

---

## 5 · Le due precisazioni di Alessio, aggiunte a chiusura

**"Non può succedere" non è una proprietà del programma.** Quello che è
scritto sulle letture annidate ora dice **quando smetterebbe di valere**:
nessun vincolo impedisce a un conto di avere mille righe, lo impedisce
un'osteria da 34 coperti — e la risposta cambia il giorno in cui una lettura
annidata nuova pesca da una tabella che **cresce nel tempo sotto un solo
padre**. ⚠️ *Chi legge «non può succedere» fra un anno si ferma lì.* Riscritto
in tutti e tre i posti: nel codice accanto al confronto che non le vede, nel
referto e nella coda.

**L'indizio non si costruisce** (decisione sua, e la ragione vale altrove):
una protezione per un caso irraggiungibile è **un avviso che non scatta mai**,
e un avviso che non scatta mai nessuno sa interpretarlo il giorno che scatta.

**Le tre cose mai viste entrano nel collaudo generale con la RICETTA**
([annotazioni](../collaudo/annotazioni.md), ultima sezione), perché sono tutte
e tre invisibili nelle condizioni normali. ✅ **La prima ricetta è stata
provata dal vivo**: milleduecento clienti finti sul progetto di prova, aperto
Clienti, i due avvisi comparivano davvero (1000 su 1211). Righe poi tolte.
⚠️ Per la riga del tablet **non si sposta l'orologio del computer** — si
sposta l'ora di fine serata di due minuti e la si lascia scattare **senza
toccare niente**, perché è quello il caso che deve coprire.

---

**Commit del lavoro**: `02ce387` e `7cd076f` (le due precisazioni); — «Le letture annidate misurate: il segnale
non le vede, e il tetto è per riga padre». ⚠️ Quel commit porta **anche questo
file** e l'addendum al referto: la consegna è fatta di una misura e di
correzioni a documenti, e spezzarla avrebbe prodotto un commit di lavoro con
dentro una riga di commento.
**Working tree**: pulito.
**Migrazione**: `20260819000011` — **applicata in produzione** (148 in totale),
con la migrazione committata in `d4bab12` del giro precedente.
