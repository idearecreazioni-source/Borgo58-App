# La Posta dice cosa sta succedendo

**28/08/2026** · L'unico lavoro del mandato, e il quinto in cui era stato
rimandato. **Aperto e chiuso.**

| | |
|---|---|
| **HEAD dichiarato** | `245ab71` — *La Posta dice cosa sta succedendo* |
| **Working tree** | pulito al momento del commit |
| **Migrazioni introdotte** | `20260828000009` |
| **In produzione** | 🔴 **no** — applicata solo al progetto di prova, aspetta il push |
| **Sul progetto di prova** | **313** migrazioni; `posta-leggi` installata (versione 3 → 4) |
| **Prove** | 549 di calcolo · 454 sull'app — verdi (letto il codice d'uscita del processo) |

**Prima di tutto**, le due migrazioni che aspettavano sono state applicate:
**la produzione è passata da 309 a 312**, e la `20260827000018` è finalmente
registrata. Rimisurato il preavviso come chiesto: **tutte e 5 le conservazioni
ripiegano su 14, zero sotto soglia**, e un numero scritto a mano vince ancora.
⚠️ In produzione ci sono **0 ingredienti**, quindi la prova per prodotto è un
caso vuoto: la proprietà è dimostrata sull'elenco delle conservazioni.

---

## Come ho lavorato: ho aperto la schermata

Con dentro **dei dati costruiti da me** (marcatore `MANDATO28`), fra cui il
caso che non esisteva: una mail che il lettore ha abbandonato. Tutto ciò che
segue l'ho **visto**, non dedotto.

---

## I tre difetti riferiti da Alessio. C'erano tutti e tre

### 1. «Le mail non si aprono» — il gesto non esiste

Non è che il gesto non funziona: **non c'è**.

| misura | |
|---|---|
| mail con un testo nel database | **18 su 18** |
| mail con allegati | **0** |
| gesti per leggere il testo | **0** — il soggetto non è cliccabile |

Il corpo della mail **arrivava già nel browser** (la lettura chiede `*`) e non
si vedeva da nessuna parte. L'unica cosa apribile erano gli allegati, cioè
l'unica cosa che non c'era mai.

✅ Ora c'è **«Leggi la mail»**. Provato sul listino: prima invisibile, dopo un
tocco ci sono i prezzi e gli a capo come li ha messi chi scriveva.

⚠️ E quando non c'è **niente** da leggere lo si dice: *«non si apre perché non
c'è niente»* e *«non si apre perché il gesto manca»* sono due difetti diversi
con due cure diverse, e un elenco che non dice quale dei due sta capitando è
esso stesso il difetto.

### 2. «Conferma» non dice cosa conferma — misurato il telaio

**10 pulsanti a schermo, 5 senza oggetto**: «Conferma» ×2, «No» ×2,
«modifica». Sono quelli che decidono se un documento entra in archivio o se
della merce entra in magazzino.

Ora: «Metti 2 righe in magazzino», «Archivia «Intervento del 12/07 - rapp…»»,
«Non caricare», «Non archiviare», «Correggi i dati». ⚠️ Il nome **si
accorcia, non si taglia via**: un pulsante che manda a capo tre volte su un
telefono è illeggibile quanto uno che non dice niente.

### 3. Il carico senza fornitore — entrava

Misurato cosa faceva **prima** di scegliere la cura: **entrava**, col fornitore
vuoto. E la conseguenza, misurata e non dedotta:

> La stessa dicitura, scritta una volta **senza** fornitore e una volta **con**,
> produce **DUE righe** in `articoli_fornitore` — l'indice unico ha per chiave
> (fornitore, dicitura). Lo storico prezzi si spacca in due e **la sorveglianza
> dei rincari resta muta** su quei prodotti. Nessun errore.

🔴 **Le conseguenze erano già scritte** in un commento della schermata da una
sessione precedente — **scritte, e non impedite**: l'opzione «— nessuno —»
restava scegliibile e «Conferma» funzionava. *Un difetto descritto non è un
difetto chiuso.*

✅ Ora il **database** rifiuta (non la schermata: quella è una porta sola, la
funzione le copre tutte), con un messaggio che dice cosa fare, e il pulsante è
**spento con la ragione** invece di essere premibile per essere rifiutato.

---

## Quello che ho trovato guardando, e che nessuno aveva riferito

### 4. Le righe senza uscita — e la frase falsa tre volte

Su una mail abbandonata dal lettore, la schermata diceva, una riga sotto
l'altra:

| frase a schermo | verità |
|---|---|
| «la lettura parte da sola entro un quarto d'ora» | 🔴 non partirà **mai più** |
| «Ho letto questa mail **solo in parte**» | 🔴 non l'ha letta **affatto** |
| «**Apri l'allegato** e controlla i dati a mano» | 🔴 quella mail **non ha allegati** |

E l'unico gesto offerto era **buttare via la mail**. Su una diffida.

🔴 **`riprova_lettura_posta` esisteva nel database dal 12/08 e nessuna
schermata la chiamava** — stessa famiglia della soglia di magazzino del 13/08:
tutto acceso, e muto.

✅ Ora c'è **«Fai riprovare a leggerla»**, provato da capo a fondo: i tentativi
tornano a zero, la nota sparisce, e la frase cambia da sola.

⚠️ **Il tetto dei tentativi è uscito dal codice**: stava scritto dentro la
funzione online, e la schermata non poteva saperlo — quindi non poteva
distinguere «sta per essere letta» da «non lo sarà mai più». Adesso vive in
`service_settings` e lo leggono **tutti e due**, `posta-leggi` compresa.

### 5. I rifiuti arrivavano nel posto sbagliato

Arrivavano — ma **in cima alla pagina**. Su un elenco di mail, un rifiuto sulla
terza compare fuori dallo schermo, e chi non vede succedere niente **ripreme**.
È il difetto già curato in Cassa il 17/08 e **mai curato qui**.

✅ Provato **provocandolo davvero**: cambiato lo stato della mail alle spalle
della schermata, il rifiuto del database — *«Questa mail non è in uno stato da
cui si possa riprovare»* — compare **sulla riga toccata**, in italiano.

---

## Due difetti miei, trovati aprendo e non rileggendo

1. **Su una proposta con zero righe dicevo «scegli il fornitore».** Uno lo
   sceglie e non cambia niente, perché il problema era un altro. Ora si nomina
   per prima **la causa che l'altra non può risolvere**.
2. **Il tetto illeggibile veniva ripiegato su tre in silenzio.** Sembra
   prudente e non lo è: col numero vero a due, una mail ferma a due tornerebbe
   «in coda» — cioè **la frase falsa rientrata da un'altra porta**. Ora la
   schermata dice che non lo sa, e offre lo stesso la via d'uscita.

---

## Due reti di casa hanno preso il mio lavoro

E avevano ragione tutt'e due:

- il guardiano dei `catch` muti — ed è da lì che è nata la terza risposta;
- il guardiano delle **sentinelle senza niente da sorvegliare**: usavo
  `it.runIf(CORRIDOIO)` dove la casa usa `it.skipIf(!CORRIDOIO)`, quindi la mia
  sentinella non contava nulla.

---

## Le misure della schermata

375 punti, tutte e tre le densità (37,8 · 59,5 · 64):

| | |
|---|---|
| testo più piccolo | **3,20 mm** — zero sotto soglia |
| bersaglio più piccolo | **8,50 mm** — zero sotto soglia |
| scorrimento laterale | **zero** |

🔴 **Il primo giro dava 19 bersagli fuori norma, ed era il metro a sbagliare**:
misuravo il quadratino della casella invece dell'etichetta che si tocca — il
falso allarme documentato il 25/08. *Un misuratore si prova su un caso di cui
si conosce già la risposta.*

---

## Le reti, rotte in due modi diversi

| rottura | esito |
|---|---|
| tolta la guardia del fornitore | rossa quella del rifiuto |
| tolto l'azzeramento dei tentativi | rossa quella della via d'uscita (*«expected 3 to be +0»*) |
| verifica della migrazione: guardia assente | *«un carico senza fornitore è stato accettato»* |
| verifica della migrazione: guardia sempre accesa | *«il carico CON il fornitore è stato rifiutato»* — cioè **non è un muro** |

Tutte ripristinate e ricontrollate **sul corpo vivo**, non sulla parola.

---

## Cosa abbiamo rovesciato

**Niente.** Nessuna voce in vigore di `docs/DECISIONI.md` è stata contraddetta.
La forma decisa da Alessio il 12/08 — *il gestionale propone, lui conferma una
cosa alla volta* — è intatta: quello che cambia è che adesso i pulsanti dicono
**cosa** stanno per fare.

**Voci di `DECISIONI.md` toccate**: nessuna modificata. Il blocco tocca il
modulo della Posta, che lì non ha una voce propria.

---

## Cosa NON è verificato

- 🔴 **La migrazione non è in produzione**: aspetta il push.
- 🔴 **`posta-leggi` in produzione ha ancora il tetto scritto dentro.** Finché
  non viene installata anche lì, cambiare il numero dal gestionale **non
  cambierebbe niente** per chi legge la posta vera. È la domanda 2.
- 🔴 **Nessuna mail vera è passata da questo giro.** Tutto è stato provato su
  mail costruite da me e sulle mail di collaudo del progetto di prova: in
  produzione la Posta è **vuota** (0 righe).
- ⚠️ **Il controllo di tipo di Deno non gira in questo ambiente** (una
  dipendenza npm non risolvibile). Che la funzione online compili lo dimostra
  l'installazione riuscita sul progetto di prova, non un controllo statico.
- ⚠️ **Nessuno ha guardato la schermata da un telefono vero**: le misure sono
  prese dal DOM a 375 punti, non da una mano.
- ⚠️ **Il carico col fornitore l'ho fatto passare da una prova automatica, non
  dalla schermata**: a schermo ho visto il pulsante spento con la ragione, non
  un carico confermato con le mani.
