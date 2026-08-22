# La pulizia che si controlla da sola

**Blocco 1 del mandato notturno del 23/08.** **Nessuna migrazione** — solo i
comandi, e **solo sul progetto di prova**. Il gestionale vero non è stato
toccato in nessun modo, nemmeno in lettura.

**Perché viene prima della scala.** Il mandato chiede due mesi veri, a
dimensione piena: 300-400 conti invece di 52. Ma una pulizia che dimentica
delle righe, moltiplicata per una scala sette volte più grande, non lascia
qualche doppione — riempie il database di roba che nessuno può più togliere.
*Prima si aggiusta il secchio, poi si porta l'acqua.*

---

## 1 · Il fatto: il comando diceva «rifallo» e invece accumulava

Misurato prima di scrivere una riga, sul progetto di prova com'era:

| cosa | trovato | quanti avrebbero dovuto essere |
|---|---|---|
| preventivi | **15** — cinque copie identiche dello stesso battesimo | 3 |
| conteggi del cassetto | 6 | 2 |
| promemoria «Scadenza documento: BASE-…» | **36** | 2 |
| righe che puntano a cose cancellate | **2.233** | 0 |
| lapidi nel registro delle cancellazioni | **2.924** | poche |

⚠️ **E l'accumulo è peggio di una pulizia che non c'è**: quella si vede.
Questa lasciava il comando dire «tolte N righe» e sembrare a posto.

---

## 2 · 🔴 Le 2.233 righe che puntano al vuoto, e perché esistevano

Lo schema del database dice che una riga non può puntare a una cosa che non
c'è: sono le chiavi esterne, e su `rettifiche_giacenza` c'è perfino un
`restrict`, che esiste apposta per **gridare** quando qualcuno se ne
dimentica.

La pulizia però gira con `session_replication_role = replica`, che spegne i
trigger — **e con loro le chiavi esterne**. Quindi cancellando una ricetta,
le sue 2.010 righe di storico costi restavano lì a puntare al niente, e
nessuno lo diceva.

> ⚠️ **Il verso è la lezione**: la regola che avrebbe segnalato la
> dimenticanza è esattamente quella che la pulizia doveva spegnere per poter
> lavorare.

Le sei famiglie trovate:

| righe | tabella | puntavano a |
|---|---|---|
| 2.010 | `storico_costi_ricetta` | ricette |
| 144 | `rettifiche_giacenza` | ingredienti |
| 60 | `preventivo_righe` | ricette |
| 13 | `order_items` | ricette |
| 4 | `menu_items` | ricette |
| 2 | `orders` | prenotazioni |

---

## 3 · La cura: due guardiani che non contengono nessun elenco

Allungare l'elenco della pulizia non chiude il buco — **lo sposta alla
prossima tabella**. Era già successo ai conti il 22/08 (220 invece di 55), e
la cura di allora era stata una riga in più nell'elenco. Un mese così e
l'elenco diventa un documento che nessuno rilegge.

Quindi la pulizia si è presa due controlli **generici**, che si costruiscono
dal database e non possono invecchiare.

### A · Nessuna riga punta al vuoto

Dopo aver ripulito, il comando **spazza** le righe rimaste orfane — girando
il catalogo delle chiavi esterne, non un elenco scritto — e poi **controlla**
che non ce ne siano più, fermandosi se ne trova.

⚠️ Spazzare e controllare sono due gesti diversi, e servono tutti e due: *un
divieto che non si può ricontrollare dopo non è un divieto.*

### B · Niente cresce fra un giro e l'altro

Dopo la pulizia, il database deve tornare com'era **dopo la pulizia
precedente**. Il comando conta tutte le tabelle, si ricorda i numeri
(`conteggi-scenario.local`, fuori dal repository) e al giro dopo dice quali
sono cresciute.

⚠️ **Non ferma il comando: grida.** Una tabella può crescere per una ragione
buona — una migrazione nuova, una riga scritta da Alessio fra i due giri — e
un comando che si rifiuta di partire per questo verrebbe aggirato al secondo
giorno.

### E ha parlato subito, la prima volta che è girato

Tre tabelle crescevano, e **nessuna delle tre era nell'elenco**:

| tabella | cosa era |
|---|---|
| `tasks` | i promemoria che un documento con scadenza genera da solo. I documenti si cancellavano, i promemoria no |
| `cash_movements` | il movimento che nasce dalla differenza fra cassetto contato e teorico |
| `allarmi` | la traccia dei guasti incontrati costruendo lo scenario |

*Un guardiano scritto stanotte ha trovato in trenta secondi tre cose che
l'elenco non aveva visto in due settimane.*

---

## 4 · 🔴 Il difetto che si è presentato mentre lo cercavo

Ho lanciato due costruzioni dello scenario **insieme**, per sbaglio, sullo
stesso database. La seconda si è fermata dicendo:

> «Questi tavoli hanno già un conto aperto: T1. Chiudilo prima, oppure apri
> quello.»

Un messaggio giusto, che però fa cercare il difetto nel gestionale invece che
nel modo in cui è stato lanciato il comando. E ha lasciato dietro di sé
**32 conti senza marca**, che nessuna pulizia poteva più riconoscere.

Due cure, tutte e due nel programma e non nella disciplina:

1. **Un lucchetto.** Il comando si rifiuta di partire se un altro sta
   girando. ⚠️ È la stessa regola che le prove automatiche hanno già
   (`--no-file-parallelism`, «il database è uno solo»): là era scritta, qui
   no — e infatti la disciplina non è bastata.
2. **La marca si scrive alla nascita del conto**, non in un aggiornamento
   successivo. ⚠️ *Ciò che nasce senza il segno con cui verrà cercato è già
   orfano nel momento in cui nasce* — è la stessa forma dei tredici
   ingredienti col vecchio prefisso (22/08), vista da un altro lato.

---

## 5 · Lo strumento corretto invece che aggirato

Scrivendo i controlli nuovi, `psql` ha risposto:

```
ERROR: invalid byte sequence for encoding "UTF8": 0xab
```

`0xab` è una virgoletta «. La causa: `interroga()` passava la SQL **dalla
riga di comando** (`psql -c`), dove tutto ciò che non è ASCII arriva storto.

⚠️ **Era già scritto negli appunti dal 18/08** — *«la SQL con gli accenti si
applica da file, mai come argomento»* — ed era rimasta **una regola da
ricordare** invece di una proprietà dello strumento. La strada giusta
esisteva pure: è quella con cui si applicano le 172 migrazioni.

Adesso `interroga()` scrive la SQL in un file e usa `-f`. Provato con una
riga piena di accenti, virgolette e frecce: passa.

---

## 6 · Cosa cancella in più, dichiarato

Tre tabelle si svuotano **del tutto**, perché non hanno nessuna colonna dove
scrivere una marca. Il prezzo si paga e va detto:

| tabella | cosa sparisce |
|---|---|
| `conteggi_cassa`, `correzioni_coperti`, `disposizioni_giornaliere`, `domande_archivio` | se Alessio conta il cassetto o sposta un tavolo durante il collaudo, al «--rifai» successivo quel gesto se ne va |
| `allarmi` | gli avvisi veri di quella sera spariscono insieme a quelli vecchi |
| `deleted_records` | **2.924 lapidi**, di cui 1.605 che non si possono attribuire a nessuno |

⚠️ **Su `deleted_records` la ragione è che è una schermata**: il titolare la
apre per vedere cosa è stato cancellato, e con duemilanovecento righe finte
dentro non risponde più a nessuna domanda. Durante il collaudo, se Alessio
cancella qualcosa e va a controllare che sia rimasto scritto, non lo trova.

⚠️ Sul **database vero** quel registro resta di sola lettura per tutti, e
nessuno lo tocca: questo vale solo sul progetto di prova.

---

## ⚠️ Cosa NON è verificato

1. 🔴 **La verifica finale dei due giri di fila non è stata rifatta dopo le
   ultime correzioni.** Il guardiano è stato visto parlare (tre tabelle
   trovate) e poi le tre tabelle sono state chiuse, ma il giro
   «costruisci → ripulisci → costruisci → nessuna cresce» **non è stato
   completato**: la sessione si è interrotta prima. È la prima cosa da
   rifare quando si riparte, e finché non è fatta il blocco è **provato a
   metà**.
2. ⚠️ **Il tempo del comando è cresciuto**: 3'34" contro i 2'19" dichiarati
   il 22/08, e ancora con lo scenario piccolo. Il ripristino da copia — la
   cura chiesta dal mandato — è il blocco successivo.
3. ⚠️ **Le righe orfane si riformano a ogni giro** (misurate: 319 e poi 445
   per esecuzione) perché la pulizia continua a girare con le chiavi esterne
   spente. Vengono spazzate e controllate, quindi il risultato è pulito, ma
   *la causa non è tolta*: si potrebbe cancellare nell'ordine giusto senza
   spegnere niente. Non fatto — è un lavoro a sé, e il guardiano rende il
   danno visibile invece che silenzioso.
4. ⚠️ **Nessuna mano ha guardato una schermata**: tutto misurato dal
   database.

---

## Cosa abbiamo rovesciato

**Una cosa, ed è piccola ma va scritta.**

**Cosa era stato deciso, e quando.** Il 22/08, correggendo l'accumulo dei
conti: *«la marca ora si scrive dentro l'aggiornamento che già ridata i
conti — zero chiamate in più»*.

**La ragione di allora.** Buona: risparmiare una chiamata al database per
ognuno dei conti, che a quella scala erano già cinquantadue.

**Cosa si decide adesso.** La marca si scrive **all'apertura del conto**,
cioè prima di qualunque altra cosa.

**Perché la ragione di allora non vale più.** Perché il risparmio c'è ancora
— non è una chiamata in più, è un campo in più sulla stessa — mentre il
prezzo si è visto stanotte: una costruzione interrotta a metà lascia conti
che nessuna pulizia riconosce, per sempre. *Il risparmio era vero; il rischio
non era stato contato.*
