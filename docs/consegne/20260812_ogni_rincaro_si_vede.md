# Consegna del 12/08/2026 — ogni rincaro si vede

**Commit della consegna: `f261f3f`** (questo riepilogo è il commit
immediatamente sopra, sola documentazione). Working tree pulito.

**Migrazione `20260812000015` già applicata in produzione** (69
registrate). Corregge una decisione presa un'ora prima, in
`20260812000013`.

---

## 1. Alessio si è corretto, e aveva ragione a farlo

Un'ora dopo aver scelto la soglia del 10% fra le tre opzioni che gli
avevo proposto:

> *«Togliamo il limite del 10% mantenendo l'on/off sugli avvisi per tutti
> i prodotti. Riflettendoci meglio: se un fornitore applicasse piccoli ma
> costanti rincari non me ne accorgerei. Sui prodotti che variano spesso o
> regolarmente tolgo gli avvisi.»*

Il caso che descrive è quello che **una soglia non prende per
costruzione**:

> Dodici aumenti del 3% fanno **+42%** in un anno e non superano **mai**
> il 10%.

Una soglia protegge dal rumore e lascia passare esattamente la cosa
peggiore — l'aumento che non si vede. Gliel'avevo proposta io come
opzione consigliata, e la sua obiezione la smonta.

---

## 2. Cosa cambia

**La soglia va a zero.** Qualunque aumento produce un avviso. Il numero
resta in `service_settings` — rialzarlo un giorno non deve costare una
migrazione — ma il valore di partenza è 0.

**`prezzo_stagionale` diventa `avvisa_rincari`, e il verso si inverte.**
Il nome vecchio descriveva un solo caso; questo descrive la decisione. Gli
avvisi nascono **accesi** e si spengono sul singolo prodotto, per
qualunque motivo. Interruttore nella scheda dell'ingrediente, accanto a
«è un alimento».

---

## 3. La cosa che nessuno dei due aveva chiesto

L'avviso ora dice **anche da dove si è partiti**:

> *«+3,1% rispetto all'ultima volta, +9,3% da quando lo compri»*

Nasce dalla sua osservazione, ed è la risposta strutturale al rincaro
strisciante: il singolo passo può essere innocuo, la somma no. **E la
somma è l'unico argomento con cui si telefona a un fornitore.**

⚠️ **Il prezzo di partenza è il più vecchio registrato per quel
fornitore, non il minimo storico.** Il minimo darebbe la variazione più
spettacolare invece di quella vera, e un numero scelto per fare effetto è
un numero di cui poi non ci si fida — che è il modo in cui un cruscotto
smette di servire a qualcosa.

---

## 4. Verifica

La verifica **ricostruisce il caso di Alessio riga per riga**: tre
acquisti allo stesso fornitore a 3,00 → 3,09 → 3,18, poi una fattura a
3,28.

| Cosa | Stato |
|---|---|
| col vecchio 10%, nessuno di quei passi avrebbe detto niente | è il motivo della consegna |
| adesso il quarto segnala **+3,1%** sull'ultimo | **provato** |
| e **+9,3%** dall'inizio | **provato** |
| il prezzo di partenza è il più vecchio, non il minimo | **provato** |
| un prezzo in calo non segnala niente | **provato** |
| interruttore spento → tace, **ma non smette di calcolare** | **provato** |
| la colonna vecchia non esiste più, la nuova nasce accesa | **provato** |
| progetto di prova | **applicata due volte**: idempotente |
| prove automatiche | **29 verdi** |
| **produzione** | **applicata**: 69 migrazioni, soglia 0, zero residui |
| lint, build | puliti |

**Non verificato, e dichiarato**: nessuna fattura vera è ancora passata
di qui, quindi nessun avviso di rincaro è mai partito davvero. La prima
prova con un documento vero resta il passo successivo — e il rincaro non
si potrà vedere prima della **seconda** fattura dello stesso fornitore,
perché al primo acquisto non c'è niente da confrontare.
