# Lo scarto, le fonti, e la spunta che non arrivava

**Blocco 4 del mandato del 23/08** — le altre cose delle schede. Migrazioni
**`20260823000007`**, **`20260823000008`** e
**`20260823000009`**, più la funzione online
`schede-prodotto` (versione 2 → 3). Tutto **solo sul progetto di prova**.

---

## 1 · Le sei voci del mandato, una per una

| voce | esito |
|---|---|
| lo scarto diventa opzionale e l'assistente non lo indovina | ✅ |
| la stagionalità da fonte certa, e l'assistente dice da dove viene | ✅ |
| la shelf life dichiarata con la fonte | ✅ |
| il pulsante mente: dice «una chiamata sola» e ne compila 25 | ✅ |
| i non alimenti nascono con la spunta accesa | ✅ **e sotto c'era un difetto più grosso** |
| «BASE-Pomodoro di prova» è ancora col prefisso | ✅ |

---

## 2 · 🔴 Il difetto che nessuno cercava: la spunta che non arrivava

Il mandato diceva che i quattro non alimenti nascono con la spunta «è un
alimento» accesa. Ma il comando che costruisce lo scenario **la passa già
spenta** (`alimentare: categoria !== "altro"`), e quei quattro hanno
categoria «altro». Avrebbero dovuto nascere giusti.

Misurato: **4 su 4 accesi**. E la causa non era lo scenario:

> **`create_ingredient` non ha mai avuto il parametro `alimentare`.**

⚠️ Quindi la casella «È un alimento» — che sta sulla scheda dal 12/08 — **si
vede, si toglie, si salva senza errore, e non arriva al database**. In
creazione il valore viene ignorato in silenzio; in modifica funziona, perché
quella passa da un `update` diretto. **Undici giorni, e nessuno se n'era
accorto**: un campo che non arriva non fa rumore.

🔴 **È la trappola del 16/08 alla terza ricomparsa** — *«un valore che si
vede nella schermata non è un valore che arriva al database»*, quella delle
mance su carta che finivano nel contante.

⚠️ **E senza questa correzione, `tenuto_in_magazzino` — la spunta scritta
stamattina nel blocco 2 — avrebbe avuto lo stesso destino.**

### La rete, e perché guarda tutti i campi insieme

`tests/app/campi-che-arrivano.test.js` scrive una scheda con **quattordici
campi tutti diversi dal predefinito**, la rilegge, e restituisce l'elenco di
ciò che non torna.

⚠️ **Tutti diversi dal predefinito, e non è un dettaglio**: con i valori di
partenza la prova sarebbe verde anche col filo staccato — che è esattamente
il motivo per cui questo difetto è vissuto undici giorni. ⚠️ E un **elenco**
invece di un'asserzione per campo: quando si rompe dice *tutto* quello che
non arriva, non solo il primo.

**Provata rompendola**: tolto il parametro, diventa rossa dicendo
*«alimentare: scritto false, riletto true»*.

---

## 3 · Lo scarto esce dalle mani dell'assistente

La ragione è di Alessio: *il dato vero emerge dalla **preparazione** — un
chilo di alici che diventa un chilo di sugo — e lo stesso ingrediente ha
rese diverse a seconda di dove finisce. Un 35% inventato entra nel costo di
ogni piatto e nessuno lo verifica mai.*

⚠️ **È lo stesso ragionamento del Blocco 5 del mandato cumulativo** (14/08):
*lo scarto è una proprietà della coppia ingrediente × preparazione*. Quel
blocco toglierà il campo del tutto; questo intanto smette di **riempirlo con
un numero inventato**.

Cosa cambia:

- il prompt dell'assistente **non lo chiede più**, con la ragione scritta
  dentro (regola 2-bis);
- ⚠️ **e `applica_scheda_prodotto` smette di scriverlo comunque**: togliere
  un campo dalle istruzioni del modello non basta — se un giorno lo
  rimandasse, verrebbe scritto lo stesso e nessuno se ne accorgerebbe. Ora
  viene **dichiarato fra gli scartati**;
- non fa più comparire un prodotto fra le schede incomplete;
- **i valori esistenti non si toccano**: sparirebbe il costo di ogni ricetta
  che li usa.

---

## 4 · «Due giorni» e «due giorni secondo questa tabella»

Sono due affermazioni diverse: la prima non si può contestare, la seconda
sì. La ricerca del validatore lo dice per le durate — *stabilire una data di
scadenza è responsabilità diretta di Alessio e deve basarsi su linee guida
consolidate* — e il mandato lo chiede anche per la stagionalità.

`ingredients.fonti_campi`, una mappa: ⚠️ **una colonna sola e non due**
(`fonte_stagionalita`, `fonte_durata`, e domani una terza), stessa scelta
fatta il 23/08 per `campi_da_confermare` — una mappa regge il campo che
nascerà domani.

A schermo, sotto il campo: *«secondo: …»*.

### ✅ Provato dal vivo, con l'assistente vero

Mandati tre prodotti alla funzione online sul progetto di prova. Cosa ha
risposto:

| prodotto | fonte della stagionalità | fonte della durata |
|---|---|---|
| Alici fresche | calendario ittico nazionale e stagionalità del Tirreno | linee guida di conservazione del pesce fresco |
| Arancia tarocco | calendario ortofrutticolo Sicilia, varietà Tarocco | conservazione tipica degli agrumi a temperatura ambiente |
| Detergente per superfici | prodotto non stagionale | durata tipica di detergenti chimici confezionati |

E **lo scarto è rimasto quello di prima su tutti e tre** (35, 12, 3): il
modello non l'ha mandato. Costo del giro: 1.412 + 524 token.

---

## 5 · Il pulsante dice la verità

Diceva *«Una chiamata sola per tutti»* con il totale accanto — e ne
compilava 25, perché oltre quel numero la risposta del modello si
troncherebbe e non sarebbe più JSON. **Il tetto c'è per una ragione; a
mancare era che nessuno lo sapesse prima di premere.**

⚠️ **Il numero resta in un posto solo.** Il tetto vive nella funzione
online, quindi la schermata **glielo chiede** (`{ quanti: true }`) invece di
ricopiarlo nel client, dove divergerebbe al primo cambiamento. Non costa
niente: si risponde senza chiamare il modello.

**Visto a schermo**: *«Compila con l'assistente (25)»* e *«Ne compila 25 per
volta: dopo questo giro ne restano 102, e si preme di nuovo.»* — dove prima
c'era «(127)».

---

## 6 · I non alimenti, e chi decide

⚠️ **Non lo indovina il gestionale da una lista di parole.** Sarebbe una
regola scritta da noi sulle sue cose, e il giorno che comprasse un prodotto
con un nome inatteso finirebbe dalla parte sbagliata **in silenzio** — la
stessa ragione per cui le causali dei costi fissi le spunta lui.

Lo propone l'**assistente**, che il nome ce l'ha davanti. Con due limiti:

- ⚠️ **solo in una direzione**: quando dice «non è un alimento». Marcare
  «alimento» non fa niente — è già il predefinito — mentre marcare «non
  alimento» toglie il prodotto dal Ricettario, e **quello si vede**.
  Nell'altro verso un errore del modello sarebbe silenzioso;
- resta fra i **campi da confermare**: è scritto che l'ha deciso una
  macchina finché Alessio non lo guarda.

### ✅ Provato dal vivo sul caso vero

Rimessa la spunta sullo **Sgrassatore per cucina** — non un ingrediente
costruito apposta — e richiamato l'assistente: è tornata **spenta da sola**,
con `alimentare` fra i campi da confermare. Gli altri tre erano già stati
rimessi a posto da una sanatoria con perimetro dichiarato (4 righe).

---

## 7 · Il prefisso nei nomi

«BASE-Pomodoro di prova» e «BASE-Piatto di prova» perdono il prefisso: era
un nome tecnico in mezzo ai prodotti veri, e **in una schermata di collaudo
un nome tecnico si legge come un errore del gestionale**.

⚠️ **Ma la pulizia continua a riconoscerli**, e li riconosce per nome
esatto: nell'elenco ci sono ora **tutte e due le forme**, quella nuova e
quella vecchia — che resta viva finché esiste anche un solo database dove il
prefisso è stato scritto. È la regola già scritta in quel file: *quando si
cambia il modo di riconoscere una cosa, il modo vecchio va tenuto in vita
dalla parte che **pulisce**, non da quella che scrive.*

---

## 7-bis · 🔴 Una rete del progetto ha bloccato il commit, e aveva ragione

Il gancio pre-commit si è rifiutato di far passare il lavoro: la prova
«nessuna lettura resta muta» ha visto il  con cui la schermata
ignora un conteggio che non risponde.

⚠️ **Non è stato aggirato.** Il silenzio è stato **dichiarato col suo
motivo** nel codice e nell'elenco dei silenzi ammessi — che è la forma che
quella rete pretende: *un elenco che cresce in silenzio non è più un
controllo*. Il motivo, in una riga: qui non manca un dato, manca una
precisazione su un numero che c'è già, e senza di essa il pulsante mostra
quello che mostrava fino a stamattina.

⚠️ E il discriminante è scritto lì: **la lettura dell'elenco non ha nessun
** — se fallisce quella, si vede.

---

## 8 · Cosa abbiamo rovesciato

**Cosa era stato deciso e quando** — 13/08/2026: l'assistente compila anche
la **percentuale di scarto**, ed era una delle tre cose che Alessio aveva
chiesto quel giorno, con la sua motivazione: *«con lo scarto a zero un
piatto sembra costare meno di quanto costa, e su carciofi o pesce l'errore è
enorme. Sono percentuali standard di cucina, il modello le sa»*.

**La ragione di allora** — vera a metà, ed è la metà che è caduta: le
percentuali standard esistono, ma sono standard **di una lavorazione**, non
di un ingrediente.

**Cosa si decide adesso** — l'assistente non lo propone più; il campo resta,
opzionale, e lo scrive Alessio quando lo sa.

**Perché la ragione di allora non vale più** — perché il problema che
risolveva («con lo scarto a zero un piatto sembra costare meno») **non si
risolve con un numero inventato**: si sposta. Un 35% plausibile e sbagliato
entra nel costo di ogni piatto che usa quel prodotto, sempre nella stessa
direzione, e nessuno lo mette mai in dubbio — mentre uno zero almeno si
vede. ⚠️ La cura vera è il Blocco 5 del mandato cumulativo: la resa sulla
**riga di ricetta**, misurata dalle produzioni.

Registrato in [`docs/decisioni_rovesciate.md`](../decisioni_rovesciate.md).

---

## ⚠️ Cosa NON è verificato

1. 🔴 **Niente in produzione**: tre migrazioni e una funzione online, tutte
   solo sul progetto di prova.
2. ⚠️ **La riga «secondo: …» non è stata vista su una scheda aperta**: le
   fonti esistono su quattro prodotti (Alici, Arancia, Detergente,
   Sgrassatore), ma la scheda di uno di loro non è stata aperta a schermo.
3. ⚠️ **Il pulsante non è stato premuto dalla schermata**: la funzione
   online è stata provata chiamandola direttamente, con l'accesso di
   collaudo. Quello che si è visto a schermo è il **testo** del pulsante,
   non il giro completo.
4. ⚠️ **Quattro prodotti dello scenario ora hanno i campi compilati
   dall'assistente vero** (e uno la spunta tolta): sono dati di collaudo sul
   progetto di prova, e cambieranno alla prossima ricostruzione.
5. 🟡 **Una prova è fallita una volta su tre esecuzioni della suite, e non
   si è ripresentata.** Le due esecuzioni successive sono verdi (48 file,
   327 prove). Non so quale fosse — l'esecuzione che l'ha mostrata non ne ha
   stampato il nome — e va detto invece di essere archiviato come rumore:
   *una prova che fallisce a intermittenza o dipende da uno stato condiviso,
   o misura qualcosa che cambia sotto.*
