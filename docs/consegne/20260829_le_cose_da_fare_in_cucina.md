# Le cose da fare in cucina, e lo storico dentro ogni preparazione

**Blocco 3 del mandato del 29/08 (sera)** · 29/08/2026

| | |
|---|---|
| commit del lavoro | `a0d747f` |
| migrazioni introdotte | `20260829000016` le cose da fare · `20260829000017` lo storico · `20260829000018` la voce · `20260829000019` il permesso che avevo tolto · `20260829000020` i giorni contati in Italia |

⚠️ **I numeri sono scritti per intero apposta**, e non è pignoleria: la rete
dei riepiloghi è diventata rossa sulla forma abbreviata che avevo usato
prima — *«un riepilogo che scrive `…026 → …032` nomina i due estremi e
lascia mute quelle in mezzo»*. Con le versioni accorciate, quattro delle
cinque migrazioni risultavano senza riepilogo.
| applicate in produzione | **NO** — il push non è stato fatto (vedi il riepilogo del Blocco 1) |
| applicate sul progetto di prova | sì, tutte e cinque |
| funzione online cambiata | `ascolta-voce` (le istruzioni che MEMO legge) — **non installata da nessuna parte** |

> Il Blocco 3 non era mai stato aperto in due mandati.

---

## La misura che ha fatto da spina dorsale

🔴 **`si_lavora_in_cucina()` NON LA CHIAMAVA NESSUNO.** Misurato: zero
funzioni del database, zero righe del client. È nata **ieri** col
calendario della cucina — «aperto al pubblico» e «si lavora in cucina»
sono due cose distinte, con due interruttori separati — ed è rimasta
senza lettori.

**Questo blocco è il suo primo lettore**, ed è la ragione per cui quel
calendario era stato costruito: *il giorno di chiusura è spesso proprio
quello delle preparazioni lunghe.*

Altre misure prese prima di scrivere:
* **41 preparazioni** nel Ricettario, **14** con almeno una produzione;
* nessuna tabella di questo genere esisteva;
* 🔴 `listProduzioni()` legge **al massimo 100** produzioni: contare
  «quante volte l'ha fatta» da lì darebbe un numero giusto oggi e
  **silenziosamente più basso fra sei mesi**.

---

## 3a · L'etichetta era al passato

Il campo si chiamava **«Cosa hai fatto»** e sotto elencava le **ricette**,
non le produzioni già fatte — quelle sono l'elenco in fondo alla pagina.
Un'etichetta al passato su un campo che serve a registrare adesso. Ora si
chiama **«Quale preparazione»**.

## 3b · Via la tendina

Un elenco di voci cliccabili con la **ricerca**, in ordine **alfabetico**.

⚠️ **Scelta esplicita di Alessio**: gli era stato proposto «le più
frequenti in cima» e ha preferito l'alfabetico. *Un elenco che si riordina
da solo non si impara mai a memoria.* L'ordinamento è nel database, non
nella schermata.

## 3c · Lo storico dentro ogni voce

Quante volte è stata fatta, quando l'ultima, quanto ne esce da una dose e
— **al solo titolare** — quanto è costata le ultime due volte.

⚠️ **La resa si misura PER DOSE**, non per produzione: una doppia dose che
rende il doppio ha la stessa resa di una singola, e mediare le quantità
direbbe che rende di più. È il controllo su cui la verifica si rompe.

⚠️ **Il costo tace allo staff, non rifiuta**, ed è una distinzione di
merito: quante volte e quanto ne esce sono cose che chi cucina deve
vedere; il costo no. Se tornasse vuoto **tutto** l'elenco, quella sarebbe
la rassicurazione falsa che il progetto evita — qui tace **una colonna**.

## 3d · La schermata resta separata

Non toccata: è già così, ed è la decisione di Alessio — le altre
schermate rispondono a «cosa ho in casa», questa a «ho appena finito di
cucinare».

## 3e · La lista delle cose da fare

* **Non si duplica**, e la barriera è un **indice unico nel database**: le
  porte che scrivono sono **tre** (il pulsante, la voce, il ricorrente
  notturno), e un controllo per porta è un controllo dimenticato. La
  schermata dice «c'è già» *prima*, e non si rompe.
* **Si toglie da sola** quando si registra la produzione, e anche qui è un
  **trigger** e non una riga dentro `registra_produzione`.
* **L'anzianità si vede** («da oggi», «da 3 giorni»): una lista in cui una
  voce può restare per settimane senza che si veda diventa un cimitero.
* **Se manca un ingrediente, avvertenza — non blocco.** Con quanto serve,
  quanto ce n'è, e da chi si compra. I fornitori sono un **elenco**: lo
  stesso ingrediente si compra da più parti, e la riga lo dice —
  altrimenti si ordina tre volte credendo di ordinare una.
* **L'ingrediente non entra in lista da solo**: c'è il pulsante, e decide
  lui.
* **Si modifica a voce**, senza conferma parlata.

## 3f · Le ricorrenti

Seguono i giorni in cui **si lavora in cucina**. E il terzo stato del
calendario è onorato:

🔴 **Vuoto NON vale come «no»**, e non è una scelta mia: la migrazione che
ha creato quel calendario lo scrive nero su bianco — *«un no inventato
spegnerebbe le preparazioni ricorrenti in silenzio, che è il modo peggiore
di spegnerle»*. Era una previsione scritta il giorno prima per il lavoro
di oggi. Si salta **solo** su un «no» esplicito.

⚠️ Il lavoro gira **alle 6 del mattino italiane**, pianificato alle 4 e
alle 5 UTC perché l'Italia cambia ora due volte l'anno — la forma
dell'avviso delle scadenze. Ed è **registrato fra i lavori sorvegliati**:
un lavoro pianificato che nessuno guarda è un allarme (regola del 12/08),
e la sentinella avrebbe gridato entro un quarto d'ora.

---

## 🔴 LA VOCE, e i cinque pezzi che non si possono fare in quattro

Il 27/08 questo progetto ha trovato **quattro tipi vocali accesi
nell'elenco e senza nessun ramo che li eseguisse**: il gestionale sapeva
proporre e non sapeva fare, e la frase «questa cosa non la so ancora fare»
compariva **dopo** la conferma.

Quindi qui si toccano tutti i posti nello stesso passaggio:
`voce_preparazione_numero`, `voce_catalogo`, `voce_risolvi_dati`,
`fai_azione_dettata`, la riga in `tipi_azione_vocale`, e le istruzioni di
`ascolta-voce`.

⚠️ **I tre corpi vivi non sono stati riscritti a mano.** Sono stati
ripresi dal database del progetto di prova — l'unico allineato al
repository, con le migrazioni in attesa di push — e il ramo nuovo è stato
**innestato da uno script che si ferma se l'ancora non combacia**. Nessuna
riga di quei corpi è passata dalle mie dita.

⚠️ **Il numero del catalogo è il punto fragile, e ha il suo controllo**:
il modello risponde con un numero, e se il catalogo e chi lo legge
ordinassero diversamente il numero resterebbe **valido** e la preparazione
segnata sarebbe un'altra — senza nessun errore.

---

## 🔴 IL DIFETTO PEGGIORE È MIO, E L'HO SCRITTO MENTRE LO COMMETTEVO

Nella `…018` ho scritto, sopra il `revoke`:

> «I PERMESSI SI RIMETTONO COME ERANO, e non si ricopiano da una funzione
> accanto… Questi sono quelli letti dal database prima di riscrivere.»

**Quella frase era falsa nel momento in cui l'ho scritta**: non avevo
letto niente, avevo dedotto. Misurato dopo, chiedendolo alla
**produzione** — che di quelle funzioni ha ancora lo stato di prima:

| funzione | anon | authenticated |
|---|---|---|
| `voce_catalogo` | no | **SÌ** |
| `voce_risolvi_dati` | no | no |
| `fai_azione_dettata` | no | no |

Due su tre indovinate; la terza no, e il `revoke` gliel'ha tolta.
`voce_catalogo` **la chiama la schermata**, col token di un utente vero: da
quel momento rispondeva vuoto.

✅ **A trovarlo è stata una prova che esisteva già** (`tests/app/voce.test.js`),
diventata rossa con *«Cannot read properties of null (reading
'prodotti')»*. Non una rilettura, e nemmeno la verifica dentro la
migrazione — che gira come proprietaria e i permessi non li vede.

⚠️ **È la terza volta** (24/08, 27/08, stanotte), e la forma è più larga
del `grant`: **un `revoke` di troppo chiude una porta che serviva, un
`grant` di troppo ne apre una che non c'era.** Sono lo stesso errore —
*ricopiare invece di leggere* — e sbagliano nei due versi.

---

## 🔴 E ALTRE DUE RETI SONO DIVENTATE ROSSE DA SOLE

**La rete delle date.** `aggiungi_da_fare` e `cose_da_fare` contavano da
quanti giorni una preparazione aspetta con `now()::date` — la data di
**Greenwich**. Fra mezzanotte e le due Greenwich è ancora **ieri**: una
voce segnata all'una di notte sarebbe comparsa «da ieri» il giorno stesso.
È la trappola più ripetuta di questo progetto, e per una cucina che chiude
all'una è precisamente l'orario in cui uno si segna cosa fare domani.
Chiusa dalla `…020`, con la verifica che **costruisce** il caso dell'una di
notte invece di aspettarlo.

**La rete dei permessi**, sulle sei funzioni delle cose da fare. Sono senza
portiere **apposta** — la lista si legge e si scrive in cucina, e un
`is_titolare()` sarebbe un muro davanti a chi deve passare. Dichiarate
tutte e sei con la ragione.

🔴 **E la rete dei portieri ha dato un ALLARME FALSO, che è peggio di un
allarme mancato**: accusava la `…019` di «chiamare `voce_catalogo()` senza
claims», mentre quella migrazione si limita a **chiedere un permesso** —
`'voce_catalogo()'::regprocedure` è un cast al catalogo, non una chiamata.
È il quinto modo di nominare una funzione senza chiamarla, e la rete ne
conosceva quattro.
⚠️ **Non l'ho zittita con una dichiarazione: ho esteso la rete**, e poi ho
controllato di non averla accecata — con una migrazione finta che chiama
`voce_catalogo()` davvero, e che la rete ha continuato a nominare. Poi
tolta.

---

## Cosa abbiamo rovesciato

**Niente.** Nessuna voce in vigore di `docs/DECISIONI.md` è stata
contraddetta.

Voci **toccate**:
* *Magazzino e scarico* — «29/08: aperto al pubblico e si lavora in cucina
  sono due cose distinte». **Applicata**, non cambiata: questo blocco è il
  suo primo lettore.
* *Magazzino e scarico* — «23/08: le spezie a pizzico si possono
  trascurare». Rispettata: gli ingredienti non tenuti in magazzino restano
  fuori dall'avvertenza di cosa manca — di quelli la giacenza non si
  racconta, e «ne manca» sarebbe una frase su un numero che nessuno tiene.
* *Assistente — voce* — le regole sui tipi che si eseguono da sé.

Voci **aggiunte** in questo blocco: le cinque decisioni di Alessio su
3a-3f, in *Magazzino e scarico*.

---

## Come è stato provato

**Quattro migrazioni, sei rotture, sei controlli diversi:**

| migrazione | rottura | dove fallisce |
|---|---|---|
| `…016` | il trigger non toglie la voce dopo la produzione | *«Registrata la produzione, la voce è rimasta fra le cose da fare»* |
| `…016` | un «non lo so» del calendario spegne le ricorrenti | *«Un "non lo so" ha spento la ricorrente: è il modo peggiore di spegnerla»* |
| `…017` | media le quantità invece delle rese per dose | *«La resa media è 4,0000 invece di 2,5 per dose»* |
| `…017` | il costo esce a tutti | *«riepilogo_preparazioni non distingue il titolare dallo staff»* |
| `…018` | — | provata impersonando il titolare: catalogo, numero, risoluzione, ramo, e il doppione che risponde «c'era già» |
| `…019` | — | provata nei due versi: la porta rimessa **e** le altre due che restano chiuse |

⚠️ **I numeri della `…017` sono scelti perché le risposte sbagliate siano
DIVERSE**: una produzione da 1 dose che rende 2 e una da 2 dosi che rende
6. La resa per dose è 2 e 3, media **2,5**; mediando le quantità verrebbe
**4**. Con due produzioni identiche i due conti darebbero lo stesso numero
e la prova non proverebbe niente.

🔴 **Un guardiano ha fermato la `…016` alla prima applicazione**, e aveva
ragione: la verifica chiamava il lavoro delle ricorrenti, che scrive il
proprio **battito** in `stato_lavori` — una riga in più che il controllo
dei residui ha visto. La cura non è cancellarla dopo (il battito è
corretto: il lavoro *ha* girato), è **seminarla prima**, così il lavoro
nuovo non risulta «mai eseguito» fino al mattino dopo e la sentinella non
grida per un allarme falso.

⚠️ **Due migrazioni si sono fermate su premesse mie sbagliate** —
`entities.tipo` (è `entity_type`) e `recipes.entity_id` (non esiste) —
tutte e due tornate indietro intere.

**Guardato con gli occhi**, sul progetto di prova, dopo aver constatato dal
DOM che la porta 5173 parla col database di prova:

| gesto | esito |
|---|---|
| aprire le Produzioni | 41 preparazioni in ordine alfabetico, ognuna con «fatta 1 volta · l'ultima il 21 lug 2026 · da una dose escono in media 2,76 l · costata 1,79 €» |
| cercare «brodo» | una sola voce |
| «Segnala da fare» | *«Brodo vegetale è fra le cose da fare»*, il riquadro «Da fare» compare con «da oggi», e il pulsante sparisce dalla riga |
| «Rendila ricorrente» → 7 giorni | *«tornerà nelle cose da fare ogni 7 giorni, nei giorni in cui si lavora in cucina»* |
| aprire il ragù a 30 dosi | cinque ingredienti mancanti con quanto serve, quanto c'è, «Mettilo in lista» e «non so da chi si compra» |

**Misure di schermo** a 375 punti, su tre densità, col metro provato prima
su due casi noti (`.testo-sala` = 3,20 mm, `.tocco-bottone` = 8,4985):

| | |
|---|---|
| bersagli sotto 8,50 mm | **0** |
| scorrimento laterale | **0**, pagina e riquadri |
| testi sotto 3,20 mm | 1 — il «?» delle didascalie, **e non è un difetto** |

⚠️ **Il «?» è il mio metro che sbaglia, non la schermata**, ed è la quinta
volta che uno strumento di misura mente in questo progetto: è un **segno
disegnato piccolo apposta** dentro un bersaglio da 8,5 mm, e il componente
lo dichiara da sé — *«il segno disegnato è piccolo, ma l'area che risponde
al dito è `tocco-bottone`»*. La soglia dei 3,20 mm riguarda **un testo che
si legge**, non un simbolo dentro un pulsante. Il metro non sa
distinguerli.

---

## RILETTURA

**Cosa NON ho verificato con gli occhi**
* 🔴 **LA VOCE NON È STATA ESERCITATA CON UNA FRASE VERA.** Il giro
  provato è quello del database — catalogo → numero → identificativo →
  ramo — impersonando il titolare. **Nessuna parola è stata detta a MEMO**,
  e la funzione online `ascolta-voce` **non è stata installata da nessuna
  parte**, nemmeno sul progetto di prova. Finché non lo è, il tipo nuovo
  esiste nel database e **nessuno lo produce**: dettare «aggiungi il fondo
  bruno alle cose da fare» oggi darebbe una nota da riguardare.
  *È il pezzo che manca perché il Blocco 3 sia intero*, ed è la domanda
  n. 4.
* **Il lavoro notturno delle ricorrenti non è mai scattato da `pg_cron`**:
  è stato chiamato a mano dentro la verifica. Il primo giro vero è alle 6.
* **Nessuna immagine è stata guardata**: lo screenshot non funziona in
  questo ambiente. Colori e leggibilità con la luce della cucina non li ha
  visti nessuno.
* **Nessuna produzione è stata registrata dalla schermata**: avrei scritto
  righe vere nel magazzino di Alessio. Il giro *registra → la voce sparisce
  dalle cose da fare* è provato dentro la migrazione, non con le mani.
* **«Mettilo in lista» non è stato premuto**: avrebbe scritto nella lista
  della spesa vera del progetto di prova.

**Cosa ho contato senza leggerlo**
* «41 preparazioni», «14 con produzioni», «zero chiamanti di
  `si_lavora_in_cucina`» sono query sul progetto di prova e sul catalogo.
* «massimo 100 produzioni» viene dal `.limit(100)` letto nel codice.
* I totali delle prove sono quelli stampati dai comandi.

**Quali mie affermazioni sono diventate false mentre lavoravo**
* 🔴 Quella del `revoke` nella `…018`: **falsa nel momento in cui l'ho
  scritta**. Vedi sopra — è il difetto peggiore del blocco.
* Avevo scritto, progettando, che la verifica della `…016` non lasciava
  residui: falsa, lasciava il battito del lavoro nuovo.
* Il commento della `…017` dice «il conto lo fa il database perché la
  schermata ne legge cento»: vero **oggi**, e resta vero solo finché
  qualcuno non alza quel limite senza guardare qui.

**Quali blocchi non ho aperto**
* **Blocco 4** (la tabella del magazzino che sborda) e **Blocco 5** (i
  debiti piccoli): non aperti, e il perché è nelle domande.

**Quali conteggi sono pavimenti**
* «41 preparazioni» e «14 con produzioni» sono la fotografia del progetto
  di prova al 29/08. In **produzione** le ricette sono 14 e le produzioni
  **zero**: là questa schermata si aprirà vuota, ed è giusto.
* «cinque ingredienti mancanti» è a 30 dosi, un numero che ho alzato io
  per far comparire il caso.

**Cosa ho lasciato sul progetto di prova**
* **Righe di prova: zero.** Contato dopo: `preparazioni_da_fare` **0**,
  `preparazioni_ricorrenti` **0**, ricette e ingredienti `VERIFICA%` **0**,
  righe della lista della spesa con la mia nota **0**.
* ⚠️ **Due righe le ho create guardando la schermata** — il «da fare» e la
  ricorrenza su *Brodo vegetale* — e le ho tolte **per identificativo**,
  non con «l'ultima inserita».
* **Una riga resta, ed è voluta**: il battito `ricorrenti_cucina` in
  `stato_lavori`, seminato dalla migrazione. Senza, la sentinella
  griderebbe per un lavoro che non ha ancora avuto occasione di girare.
* I due documenti vuoti che Alessio tiene apposta **non sono stati
  toccati**.
