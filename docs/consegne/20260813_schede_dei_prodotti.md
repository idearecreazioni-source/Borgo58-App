# Consegna del 13/08/2026 (terza) — le schede dei prodotti

**Commit della consegna: `73b6426`** (questo riepilogo è il commit
immediatamente sopra, sola documentazione). Working tree pulito.

| Commit | Cosa |
|---|---|
| `98bbb9a` | l'assistente compila le schede — migrazione `20260813000005` |
| `5f23564` | «può contenere tracce», conferma in blocco, due correzioni — `…06` |
| `73b6426` | zero è una risposta, non una casella vuota — `…07` |

**Applicate in produzione da me**: `…05`, `…06`, `…07`. **79 migrazioni**.
Funzione nuova `schede-prodotto` (**v2**).

---

## 1. Cosa fa, e perché quei campi non sono decorativi

Un prodotto nato da una fattura ha nome, unità e categoria — e basta.
Ora l'assistente compila conservazione, durata, temperatura di
ricevimento, stagionalità e **percentuale di scarto**, e propone gli
allergeni. Una chiamata sola per tutti i prodotti, col **modello
piccolo**: sono conoscenze di cucina standard, e il modello grande
costerebbe di più senza sapere meglio quanto scarta un carciofo.

Con lo scarto a zero un piatto **sembra costare meno di quanto costa**
(la ricetta dice 200 g puliti, ma per averli se ne comprano 235). Senza
conservazione e durata lo scadenziario di stamattina proponeva 14 giorni
di preavviso anche al basilico.

**Provato dal vivo da Alessio su 8 prodotti veri** (quelli di collaudo):

| Prodotto | Conservazione | Durata | Scarto | Allergeni |
|---|---|---|---|---|
| Basilico fresco | ambiente\* | 3 gg | 5% | — |
| Detergente sgrassante | dispensa | 730 gg | 0% | — |
| Mandorle sgusciate | dispensa | 180 gg | 0% | **frutta a guscio** |
| Melanzana | ambiente | 5 gg | 12% | — |
| Olio extravergine | dispensa | 365 gg | 0% | — |
| Pomodoro ciliegino | ambiente | 7 gg | 5% | — |
| Ricotta di pecora | frigo 0-4\* | 5 gg | 0% | **latte** |
| Semola rimacinata | dispensa | 365 gg | 0% | **glutine** |

**Gli allergeni sono giusti 8 su 8.** Nessun falso allarme, nessuna
dimenticanza.

\* corretti da me: vedi §4.

**La conseguenza a valle, verificata**: lo scadenziario è passato da 4
prodotti segnalati a **zero** — non perché si sia rotto, ma perché adesso
sa che il basilico dura 3 giorni e va avvisato 2 giorni prima, non 14.
Prima gridava per roba che non era in scadenza.

---

## 2. Gli allergeni sono diversi da tutto il resto

`ingredients.origine_allergeni`: **`stimati` / `etichetta` /
`confermati`**. Solo gli ultimi due valgono per la stampa del menu.

**Lo stato `etichetta` è un'idea di Alessio, e ha battuto la mia
obiezione.** Gli avevo detto che sui prodotti lavorati l'allergene sta
nell'etichetta e non nel nome, quindi serviva il suo controllo manuale.
Lui ha risposto che la scansione del ricevimento merci — quella che
leggerà lotto e scadenza — può fare **una foto in più della lista
ingredienti**. Ha ragione: l'etichetta è la fonte legale, il nome è un
indizio.

La mia seconda obiezione (quel modulo non esiste ancora) è caduta anche
lei, e la caduta è istruttiva: *«l'app servirà solo a ridosso
dell'apertura fra molti mesi, quando sarà completa»*. Non c'è niente in
servizio, quindi «non esiste ancora» non è un problema — è solo un ordine
di costruzione. E *«quello che conta è quando il prodotto entra
materialmente in cucina: in quel momento viene scansionato e il sistema
può aggiornare il prodotto creato in precedenza»*.

Oggi si riempiono `stimati` e `confermati`. Quando ci sarà la fotocamera,
quella scansione scriverà `etichetta` su un prodotto già esistente e
**non ci sarà niente da rifare**.

### «Può contenere tracce» non è «contiene»

Seconda richiesta di Alessio, e sono due informazioni diverse:
**contiene** si legge nella lista ingredienti, **tracce** dipende da cosa
lavora la fabbrica. Sommarle le rovinerebbe entrambe — un piatto marcato
«frutta a guscio» che ha solo una possibile traccia è un piatto che non
si vende, e un elenco dove tutto è possibile è un elenco che non si
legge.

Colonna `allergeni_tracce`, colonna a sé nella vista, riga a sé sul menu
e sulla scheda del cuoco.

⚠️ **Regola che nasce con quella colonna: le tracce non si stimano mai.**
Un allergene contenuto si deduce dal nome (la ricotta contiene latte);
una traccia no — esiste solo sull'etichetta. Un modello che le
indovinasse produrrebbe la peggior specie di dato: **prudente, plausibile
e inventato**. Le istruzioni dell'assistente glielo vietano, e la
verifica prova che **se le propone lo stesso non vengono scritte**.

---

## 3. La vista degli allergeni diceva mezze verità

Trovato collegando il menu, ed è il difetto più serio di questa consegna:

> Un piatto fatto di ingredienti che **nessuno aveva mai compilato**
> stampava un elenco allergeni **vuoto**. Chi legge lo intende come «non
> contiene allergeni»; voleva dire «non lo ha mai guardato nessuno».

La causa era una join interna: un ingrediente **senza** allergeni
spariva dal calcolo — cioè proprio il caso pericoloso, perché «nessun
allergene» è la risposta di cui un celiaco si fida.

Ora la vista dichiara `allergeni_da_verificare`, e **quei piatti non
stampano l'elenco**. L'avviso sta sullo schermo e **non sul menu del
cliente** (`print:hidden`): un menu in mano a chi mangia non è il posto
dove scrivere che i nostri dati interni non sono verificati.

**Stesso avviso sulla scheda ricetta dello staff**, che è la schermata
che un cuoco apre quando un cliente chiede di un'allergia — e dove un
elenco vuoto non verificato è più pericoloso che sul menu stampato.

---

## 4. Due valori proposti male, e la correzione sta in due posti

- Il **basilico** era finito in frigo. In frigo annerisce: il modello ha
  applicato «erbe fresche → frigo», che per il basilico è proprio la
  regola sbagliata.
- La **ricotta** a 4-8 °C invece che 0-4, che è la soglia che finisce nel
  registro HACCP al ricevimento merci.

Corretti nelle due righe già scritte (**solo se ancora com'erano uscite
dal modello**: se Alessio le avesse cambiate, decide lui) **e nelle
istruzioni dell'assistente** — perché altrimenti il prossimo basilico
rifarebbe la stessa strada. Il secondo posto conta più del primo.

---

## 5. 🔴 Il difetto che ha trovato Alessio, e nessun controllo automatico

Dieci minuti dopo aver messo in funzione le schede: preme «Compila con
l'assistente», il giro va a buon fine — e i cinque prodotti restano
nell'elenco «schede incomplete», tutti con *manca: percentuale di
scarto*.

**Consideravo incompleto un prodotto con scarto 0. Ma zero è la risposta
giusta** per un detergente, per l'olio, per le mandorle già sgusciate,
per la semola: non si scarta niente. Il modello rispondeva 0
correttamente, la funzione riscriveva 0, il prodotto restava incompleto.

**Per sempre — e a pagamento.** Ogni pressione del pulsante avrebbe
ripagato una chiamata all'AI per riscrivere zero sopra zero. È la stessa
forma del difetto del 12/08 (la mail riletta ogni quarto d'ora) con
un'aggravante: **quello falliva, questo "riesce"**. Nessun errore, nessun
allarme, nessun controllo automatico che lo veda — perché dal punto di
vista del sistema stava andando tutto bene. L'ha visto lui guardando la
schermata.

La correzione non è una soglia: il gestionale **si segna che la scheda è
stata compilata** invece di dedurlo dal valore. `campi_compilati_il`
esisteva già dalla migrazione precedente e serviva esattamente a questo —
non lo stavo usando.

**Regola generale, già scritta altrove in questo progetto**: un valore
non può dire da solo se è «vuoto» o «deciso». 0 kg di scarto e 0 gradi
sono numeri veri. È la stessa trappola per cui la temperatura HACCP del
carico da fattura non passa da `numeroValido` — 0 °C è la temperatura del
pesce fresco, non l'assenza di un dato.

---

## 6. Verifica

| Cosa | Stato |
|---|---|
| le tre migrazioni sul progetto di prova | **applicate due volte**: idempotenti |
| la scheda si scrive per intero | **provato** |
| valori inventati (allergene inesistente, scarto 99%) scartati e dichiarati | **provato** |
| una seconda passata non riscrive ciò che c'è già | **provato** |
| una stima non sovrascrive allergeni confermati | **provato** |
| le tracce proposte dal modello **non** vengono scritte | **provato** |
| conferma in blocco: con un id falso non ne resta confermato nessuno | **provato** |
| zero già compilato non è un campo mancante | **provato**, e **al contrario** |
| basilico e ricotta corretti | **provato**, e riletto in produzione |
| **compilazione dal vivo su 8 prodotti veri** | **fatta da Alessio**: allergeni **8 su 8 giusti** |
| **conferma in blocco dal vivo** | **fatta**: elenco a zero |
| lo scadenziario dopo le schede | **da 4 segnalati a 0**, ed è giusto così |
| prove automatiche | **30 verdi** |
| lint, build | puliti |
| **produzione** | **79 migrazioni**, `schede-prodotto` v2 |

---

## 7. Cosa NON è verificato, e lo dico chiaro

- **Il messaggio delle 10:00 dello scadenziario non è ancora mai
  partito**: il primo è atteso domani mattina. Resta l'ultima cosa non
  vista dal vivo delle consegne di oggi. E dopo le schede compilate
  quel messaggio sarà **vuoto** — cioè non arriverà affatto, che è il
  comportamento giusto ma rende la prova meno informativa: per vederlo
  servirà un prodotto davvero vicino alla scadenza.
- **Nessun prodotto lavorato è passato di qui.** Gli 8 di collaudo sono
  tutti ingredienti crudi o quasi, cioè il caso facile. Il caso difficile
  — il ragù pronto col sedano dentro — non è stato provato, e per
  costruzione non lo sarà finché non c'è la foto dell'etichetta.
- **I dati di collaudo sono ancora in produzione**, per scelta di Alessio
  di oggi («per ora non cancelliamo niente»). Deroga consapevole al §5
  punto 8.
- **`/prova-voce` è ancora lì**, usa-e-getta e ormai servita.
