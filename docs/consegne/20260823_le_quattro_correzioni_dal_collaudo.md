# Le quattro correzioni dal collaudo

**23/08/2026 — mandato accodato**, quattro blocchi. Eseguito dopo la
consegna del mandato precedente (`8319a20`), nella stessa sessione.

| | |
|---|---|
| migrazioni | `20260823000018_una_riga_sola_per_prodotto.sql`, `20260823000019_l_ordine_dice_l_unita.sql` |
| applicate | ✅ progetto di prova — ❌ **non** in produzione |
| blocchi fatti | **4 su 4** |
| blocchi saltati | nessuno |

---

## Blocco 1 — La tracciabilità è passata in HACCP

Decisione di Alessio del 15/08. La pagina si è **spostata**, non
duplicata: `src/pages/haccp/Tracciabilita.jsx`, raggiungibile da
`/haccp/tracciabilita`.

**Misurato prima di muovere niente**: la sezione legge `listStockLots()` e
`listStockLotsDisplay()` (la seconda per lo staff, senza i costi), e
**nessun'altra schermata la referenzia** — un solo file la importava.
Nessuna funzione la scrive: è di sola lettura.

- la scheda sta **subito dopo «Ricevimento merci»**, e non è un ordine a
  caso: i lotti nascono lì;
- **il vecchio indirizzo rimanda al nuovo** invece di sparire — chi ha il
  collegamento salvato sul tablet non trova una pagina morta;
- il collegamento nel Magazzino è stato tolto, con scritto il perché.

⚠️ **Nessuna scelta di disegno da indovinare**: la home HACCP è un elenco
di schede uniformi, aggiungerne una è meccanico.

✅ **Guardato**: la scheda compare al posto giusto, `/magazzino/tracciabilita`
porta a `/haccp/tracciabilita`, la tabella si vede e il ritorno va a HACCP.

---

## Blocco 2 — L'allineamento: il campo c'era, ma non si vedeva

🔴 **Il reperto è vero nell'esperienza e falso alla lettera**, e la
differenza cambia la cura.

**Misurato aprendo la schermata**: la pagina si carica con **zero campi
visibili**. Ma il campo *esiste* — è dentro la riga, che si apre toccandola:
«Quanto ce n'è (kg)», il pulsante «È questo», e la frase *«Scrivi quanto
ce n'è, non quanto togliere: la differenza la faccio io»*. E chiama
`allineaGiacenza()`, cioè **il percorso di rettifica che il progetto ha
già** — quello provato da `allineamento-magazzino.test.js`.

⚠️ Quindi **non è stato costruito nessun secondo percorso**: sarebbe stato
un doppione di un meccanismo funzionante.

**Il difetto vero era un altro**: *un gesto che esiste e non si annuncia è
un gesto che nessuno fa*. La promessa in cima alla pagina («scrivi qui
quanto ce n'è davvero») non aveva niente su cui posarsi.

**Cura**: il segno che la riga si apre — `▸` chiusa, `▾` aperta.
⚠️ **Non inventato qui**: è la stessa coppia che l'Agenda e la Posta in
arrivo usano già. Se il progetto non avesse avuto una convenzione mi
sarei fermato, perché sceglierne una sarebbe stata una decisione di
disegno non specificata.

✅ **Guardato**: `dovrebbe essercene 1,37 l ▸` e, sulla riga aperta,
`0 kg ▾` col campo sotto.

---

## Blocco 3 — Le righe doppie: la causa non era quella che sembrava

**Prima ipotesi, smentita dalla misura**: un join che moltiplica.
`v_stock_levels` ha **129 righe e 129 ingredienti distinti**, e i join di
`lista_spesa()` sono tutti su chiavi uniche.

### 🔴 La causa vera: due righe nate a 160 microsecondi di distanza

| prodotto | stato | nato alle |
|---|---|---|
| Agnello | da_comprare | 14:45:18.**516942** |
| Agnello | da_comprare | 14:45:18.**517102** |
| Arancia tarocco | da_comprare | 14:45:18.516942 |
| Arancia tarocco | ordinata | 14:45:18.517102 |

È una **corsa**: `add_below_threshold_items()` è partita due volte quasi
insieme. Si difendeva con un `not exists`, ma **due transazioni
concorrenti non si vedono a vicenda** — entrambe leggono «non c'è nessuna
riga», entrambe inseriscono.

**Da dove**: la lista lancia il controllo del sotto-soglia all'apertura
della pagina (decisione del 13/08), e `StrictMode` di React esegue gli
effetti **due volte** in sviluppo. ⚠️ **Ma non è un problema del solo
sviluppo**: due tablet aperti insieme, o un doppio tocco, fanno la stessa
cosa in servizio.

### La cura è un vincolo, non un filtro

Deduplicare in lettura avrebbe **nascosto il sintomo** — e il mandato lo
vieta. La regola del progetto è *prevenire invece di segnalare*, la stessa
forma con cui è impossibile pagare due volte una fattura.

⚠️ **Solo le righe automatiche**: se Alessio scrive due volte lo stesso
prodotto a mano è una sua scelta, e il vincolo non gliela tocca. La
verifica lo controlla, insieme al fatto che una riga già acquistata non
impedisce di riaggiungere il prodotto.

**Sanatoria**: 3 doppioni tolti, tenendo quello con lo stato più avanzato —
una riga `ordinata` rappresenta un ordine **già mandato a un fornitore**.

✅ **Il controllo che il mandato chiede, misurato dopo**: `lista_spesa()`
restituisce **54 righe per 54 prodotti distinti, zero doppioni**.

⚠️ **E una lettura sbagliata mia, da non ripetere**: contando le
occorrenze del nome nel testo della pagina ne trovavo ancora due — ma la
seconda era **dentro il menu a tendina** per aggiungere prodotti. *Contare
le parole su una schermata non è contare le righe.*

---

## Blocco 4 — L'unità nel messaggio ai fornitori

🔴 **Non era «manca l'unità»: era «manca A VOLTE»**, ed è quello che
rendeva il difetto silenzioso.

L'unità c'era già nel codice, ma era `unita_fattura` — **quella del
fornitore** («cassa da 6 kg»), che esiste solo se qualcuno ha già
registrato una dicitura per quel prodotto presso quel fornitore. Quindi la
riga era completa per i prodotti già comprati, monca per gli altri.

**Cura**: si ripiega sull'unità del prodotto. E i due numeri restano
coerenti, che è la parte da non sbagliare — **la condizione che sceglie
l'unità è la stessa che sceglie il numero**:

- con la dicitura, la quantità è in confezioni → «1 casse da 6 kg»;
- senza, è quella di partenza → «2 kg».

🔴 Se si scegliessero con due regole diverse, prima o poi comparirebbe **il
numero delle casse con l'etichetta dei chili**: un ordine sbagliato di sei
volte, scritto in una riga che sembra giusta. La verifica prova anche
questo.

✅ **Guardato sul messaggio vero**, preparando una bozza nuova:

> • Agnello — **2 kg**
> • Coniglio — **0,339 kg**

Sono i due esempi del mandato, con l'unità.

⚠️ **Gli ordini già registrati non cambiano**, ed è giusto: il loro testo è
fotografato al momento dell'invio. Quello che si è mandato a un fornitore
resta quello che si è mandato.

---

## 🔴 Un difetto mio, e la trappola in cui il progetto era già caduto tre volte

Scrivendo il blocco 4 ho riscritto `bozza_ordine` **ricopiandola a mano**
dopo averne letto il corpo vivo con un filtro. Nel ricopiare ho perso dei
pezzi: usavo `v_forn.phone` dove la colonna è `contact_phone`, avevo
sostituito il calcolo del telefono con una funzione diversa, e mancavano
due campi della risposta.

⚠️ **Non l'ho scoperto rileggendo**: l'ha fermato il database al primo
tentativo. Ma se avessi scritto un nome di colonna *esistente* sarebbe
passata, portandosi via in silenzio la regola dello zero del prefisso —
quella che il 14/08 ha impedito di mandare ordini a sconosciuti.

**La regola dice «corpo vivo, mai a memoria e mai dal file», e leggerlo
non basta: va PRESO.** Rifatto salvando il corpo intero in un file e
applicando due modifiche chirurgiche, controllate con un confronto riga
per riga: **due differenze, nient'altro toccato**.

---

## Come sono state giudicate le prove: rompendo

| cosa è stato rotto | cosa è diventato rosso |
|---|---|
| tolto il vincolo di unicità | ✅ *«Il vincolo non impedisce due righe automatiche aperte per lo stesso prodotto»* |
| l'unità torna a quella del solo fornitore | ✅ *«Senza la dicitura del fornitore la riga non dice l'unità»* |
| l'unità del prodotto messa accanto al numero di confezioni | ✅ *«Con la dicitura del fornitore la riga non dice le sue confezioni»* |

---

## ⚠️ Cosa abbiamo rovesciato

**Niente.** Lo spostamento della Tracciabilità **esegue** una decisione di
Alessio del 15/08, non la ribalta; gli altri tre blocchi correggono difetti,
non scelte.

---

## ⚠️ Cosa NON è stato fatto, e cosa resta da guardare

1. **Non è in produzione**: le due migrazioni aspettano il push e l'ok
   esplicito di Alessio, come dice il mandato.
2. **Non so se i doppioni esistono anche in produzione.** La sanatoria ne
   ha tolti 3 sul progetto di prova; sul database vero girerà quando la
   migrazione verrà applicata, e **dichiarerà quante righe ha tolto**.
   ⚠️ Se lì dentro ci fossero righe `ordinata` doppie, la sanatoria terrebbe
   quella ordinata — ma è una **cancellazione di dati veri**, e va guardata
   prima di applicare.
3. **La causa a monte resta**: il controllo del sotto-soglia parte due
   volte perché `StrictMode` duplica gli effetti. Ora non fa più danno — il
   vincolo lo impedisce — ma la chiamata doppia c'è ancora. Toglierla
   vorrebbe dire cambiare come la pagina si carica, che è una scelta di
   disegno non chiesta da questo mandato.
4. **La tracciabilità non ha imparato la direzione a valle** (dato un
   lotto, in quali piatti è finito): è il Blocco 6 del mandato cumulativo
   del 14/08, e questo mandato chiedeva solo lo spostamento.
5. **Nessuna mano diversa dalla mia** ha usato le schermate toccate.

---

## ✅ Suite intera

**630 prove su 630 verdi, 75 file su 75, zero saltate** — lo stesso
risultato con cui si era chiuso il mandato precedente, quindi nessuno di
questi quattro blocchi ha rotto niente.
