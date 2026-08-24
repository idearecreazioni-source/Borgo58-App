# I vincoli parlano italiano, le didascalie si aprono — 24/08/2026

**Commit dichiarato:** `3e5dc47`
**Working tree:** pulito
**Migrazioni:** 210 nel repository e sul progetto di prova, **207 in
produzione** (le tre nuove aspettano il push).

Terza consegna della giornata. Segue
[«le reti sui numeri assurdi»](20260824_le_reti_sui_numeri_assurdi.md).

---

## PRIMA: le sei migrazioni applicate in produzione

🔴 **Il comando si è rifiutato di partire**, e aveva ragione: la
`20260824000004` era già in produzione e nessun riepilogo la nominava per
intero. L'arretrato è chiuso nel riepilogo precedente. *La rete ha fatto
il suo lavoro: il debito non ha potuto accumularsi.*

| | prima | dopo |
|---|---|---|
| migrazioni | 201 | **207** |
| vincoli `check` | 162 | **188** |
| tracce nel registro cancellazioni | 0 | **0** |
| ricette · causali · impegni | 14 · 17 · 8 | **14 · 17 · 8** |
| disposizioni della sala · scenari · piatti in menu | 14 · 1 · 14 | **14 · 1 · 14** |

✅ **`npm run numeri` sulla produzione: «Niente fuori dall'ordinario.»**

---

## 1 · Il messaggio dei vincoli — una regola sola

**Fatto come deciso**: traduzione al momento del rifiuto, nel punto unico
da cui passa **ogni** richiesta del gestionale (`src/lib/supabase.js`).
Niente doppio controllo nelle schermate.

🔴 **Misurato prima di scrivere: le porte sono DUE, e rispondono in due
forme diverse.**

| porta | forma della risposta |
|---|---|
| PostgREST (scritture dirette) | `{ code, message, details, hint }` |
| il corridoio (scritture multi-tabella) | `{ errore: { codice, messaggio } }` |

La mia prima versione guardava solo `message`: **metà dei rifiuti sarebbe
rimasta in inglese**, e sarebbe stata la metà delle scritture importanti.

**Visto a schermo, da tutte e due le porte:**

> *«In questa tabella le percentuali si scrivono in FRAZIONE (0,25 = 25%),
> non in punti: la schermata divide per cento prima di salvare…»*

> *«Lo scarto è una percentuale in PUNTI e sta sotto 100: il lordo si
> ricava dividendo per (1 − scarto/100), quindi a 100 è una divisione per
> zero…»*

⚠️ **L'originale non si butta**: viaggia accanto. Una traduzione che
cancella la fonte è una traduzione di cui non ci si può fidare.

### 🔴 Due difetti trovati per strada, e nessuno rileggendo

**Il primo, dalla verifica della migrazione stessa**: il vincolo delle
aliquote era **muto** sul progetto di prova. Provandolo al contrario
stamattina l'avevo tolto e rimesso *a mano*, senza rimettere il suo
commento — in produzione c'era ancora. È la regola del 14/08 in forma
nuova: *quello che si rimette a mano si rimette a metà*. Rimesso, e da
oggi si ripara da sé.

**Il secondo, dalle reti dei permessi**: `spiega_vincolo` era comparsa in
tutti e due gli elenchi sorvegliati — funzioni eseguibili con la sola
chiave pubblica (10 → 11) e funzioni senza portiere (19 → 20).

⚠️ **Non era una scelta nascosta**: la migrazione la dichiarava. Ma **una
dichiarazione dentro un file non è la stessa cosa di un numero aggiornato
in una prova che qualcuno legge**. La rete mi ha costretto a *rispondere*,
non a *dichiarare* — e riesaminandola la scelta era sbagliata: `anon` non
serve (il form pubblico non passa da lì e ha già le sue frasi) e un
portiere ci vuole.
⚠️ Il portiere è **«utente autenticato», non «titolare»**: la traduzione
serve anche allo staff, che scrive temperature, pulizie e comande — cioè
proprio dove i vincoli nuovi scattano.

### Il quarto, dopo aver scritto questo riepilogo

🔴 **La rete `migrazioni-senza-portieri` ha preso un caso in più**, e non
l'avrei visto rileggendo: la `20260824000012` chiama `spiega_vincolo()`
in un blocco di verifica **senza impostare i claims**. Quando è stata
scritta era corretta — quella funzione non aveva ancora il portiere —
e **l'ha resa fragile la migrazione che le sta accanto**, poche ore dopo.

⚠️ Dove morde, misurato: girando le migrazioni in ordine da zero la 012
passa; il caso vero è la **riapplicazione singola**, quella che si fa con
`npm run prova:migra <nome>` ed è successa più volte stanotte.

La verifica buona sta nella `…014`, e la dichiarazione che chiude il caso
presso la rete sta **lì**, non nel file che l'ha causato: le migrazioni
già applicate non si riscrivono. ⚠️ E non spegne la rete — tace solo su
quella coppia, e togliendo la dichiarazione la prova torna rossa.

**Il terzo, subito dopo, provando**: messo il portiere, **la traduzione è
diventata muta**. Il giro per la spiegazione usava la chiave pubblica, che
il portiere nuovo respinge, e a schermo tornava la frase generica. *Il
portiere rendeva inutile la funzione proprio nel momento in cui serviva.*
Ora usa il token di chi ha appena ricevuto il rifiuto. **Visibile solo
provando**: leggendo il codice sembrava giusto.

---

## 2 · Il debito del «percento» — scritto nel §8

Con l'elenco completo, misurato sui **valori veri** e non sui nomi.

- **In punti (0-100), tredici colonne** — `fiscal_settings` (sei),
  `ingredients.waste_percentage_default`,
  `recipe_ingredients.waste_percentage`,
  `intercompany_cessions.vat_rate`,
  `preventivi.food_cost_obiettivo_percento`,
  `service_settings.food_cost_obiettivo_percento`,
  `service_settings.soglia_rincaro_percento`,
  `regole_deducibilita.percentuale_deducibile`.
- **In frazione (0-1), nove colonne** — tutte nella Proiezione.

🔴 **E il caso peggiore è già in casa, ancora silenzioso**:
`commissione_pos_percento` esiste in **due tabelle con due unità diverse**
— `numeric(6,4)` in frazione nella Proiezione, `numeric(5,2)` con vincolo
`0..10` (cioè punti) nella tesoreria. **Stesso nome, stesso concetto, due
significati.** Non morde solo perché quella colonna è **vuota**: la banca
non è ancora scelta. Il giorno che qualcuno ci scrive un numero, sarà
giusto in una schermata e sbagliato di cento volte nell'altra.

---

## 3 · Le linee della previsione — disegno chiuso, nessun codice

Le tue decisioni sono in
[`docs/mandati/20260824_le_linee_della_previsione.md`](../mandati/20260824_le_linee_della_previsione.md):
cinque linee, tre forme (a coperto, a forfait, a pezzo), le regole comuni,
e la dipendenza da pranzo/cena.

⚠️ **Una voce ancora aperta, segnalata e non decisa**: il lunch si separa
dal reale per *servizio*, ma **lounge e chef table sono anch'esse linee a
coperto** che il consuntivo dovrà distinguere dalla sala — probabilmente
per altra via (un'etichetta sul conto, o il tavolo). Va deciso prima di
costruire il consuntivo, non prima della previsione.

---

## 4 · Le didascalie — primo giro, sulle schermate già chiuse

### Il segno

Un pallino con «?» accanto al titolo. Risponde a **mouse, dito e
tastiera**.

⚠️ **Non `onMouseEnter`, ma `pointerType === "mouse"`**: sui browser dei
tablet il tocco emette *anche* gli eventi del mouse, quindi un dito
aprirebbe col passaggio e richiuderebbe col clic — cioè non si aprirebbe
mai.

⚠️ **Il bersaglio è il segno, non il titolo**: durante il servizio si
tocca per sbaglio. Il segno *disegnato* è piccolo, l'area che risponde è
`tocco-bottone`. **Misurato a schermo: 8,50 × 8,50 mm**, la soglia del
progetto.

### Il conteggio

| | |
|---|---|
| **cancellate** | **1** |
| **nascoste dietro il segno** | **8** |
| schermate toccate | 8 su 84 |

**La cancellata**: «Piano di autocontrollo» sotto il titolo «HACCP» —
HACCP *è* il piano di autocontrollo. ⚠️ Cancellata e non nascosta: *un
segno che apre un sinonimo promette una spiegazione e non ne dà una*.

**Le nascoste**: come funziona la Cassa · cosa contiene una previsione ·
i dodici mesi e la stagionalità · com'è fatto il catalogo strumenti e che
crea promemoria · quali partite compaiono in Scadenze · la differenza fra
Fermi e Scadenze · cosa mostra la tabella dell'andamento · la spiegazione
di ognuna delle sei voci di quella tabella.

### 🔴 Gli avvertimenti rimasti visibili — l'elenco da controllare

| dove | testo |
|---|---|
| Cassa | «di cui … sono mance del personale, **non tuoi**» |
| Cassa | «N uscite già registrate … **non è ancora nel saldo**: la prima esce il …» |
| Cassa | «Contare il cassetto **non corregge di nascosto**…» |
| Cassa | «**Non è un'uscita**: il cassetto cala e la banca sale dello stesso importo.» |
| Cassa | «Stai chiudendo la serata di … Fino alle 05:00 è ancora la sera prima.» |
| Le previsioni | «Una previsione chiusa **non si ritocca mai più**…» |
| Costruisci una previsione | «Quello che scrivi qui entra nel gestionale quando premi …: prima di allora **non è ancora salvato**.» |
| Costruisci una previsione | «**Non ancora salvata.**» / «Non la chiude: resta modificabile finché non lo decidi tu.» |
| Costruisci una previsione | «…lascia in bianco quelle che non ti riguardano — **le vuote non finiscono nella previsione**.» |
| Scadenze | «Ogni mattina alle 10:00 le stesse cose **arrivano su Telegram**.» |
| Scadenze | «**Non si chiede conferma e non si torna indietro.**» |
| Fermi | «Consumato / **esce e basta**» · «Buttato / **va nel registro HACCP**» · «Reso al fornitore / non è uno spreco» |
| Fermi | «ferma da N giorni · **durata non dichiarata**» |
| HACCP | «…vanno impostate — e validate con un consulente — **prima di affidarcisi in produzione**.» |
| Temperature | «Fuori range: ho aperto una non conformità. **Resta aperta finché non scrivi cosa hai fatto**.» |
| Non conformità | «**Obbligatorio**: finisce nel manuale che si mostra a un controllo.» |
| I tre archivi HACCP | «La giornata è quella di servizio… **Formato provvisorio, da rivedere con la biologa.**» |
| «Come sta andando» | «Non misurato vuol dire che quel numero non c'è ancora — **non che è zero**.» |
| «Come sta andando» | «**Attenzione**: stai guardando il {anno} confrontato con una previsione del {altro}.» |

🔴 **E la rilettura ha preso un mio errore prima che entrasse**: avevo
messo fra le cancellazioni «esce e basta» sotto «Consumato». Ma quella
dice **cosa succede se premi** — esce dal magazzino *senza* finire nel
registro HACCP, al contrario di «Buttato». È un avvertimento.

⚠️ **Le descrizioni delle sei card di HACCP restano**, per decisione: non
sono didascalie sotto un titolo, sono **l'unico modo di distinguere due
destinazioni prima di premerle**. Nasconderle vorrebbe dire aprire sei
pannelli per scegliere dove andare.

### La nota ripetuta

**Misurato prima di correggere**: su «Come sta andando» la frase sull'IRAP
compariva **due volte** (non tre: nello stato di oggi sono due). E non per
una svista — arriva dal database dentro avvertenze **diverse**, perché
`calcola_imposte()` restituisce il numero **e** la frase che ne dichiara
il limite. Scelta del 15/08, ed è giusta: *un avviso che vive nel testo di
una schermata non protegge la seconda che mostra lo stesso numero*. Il
difetto nasce quando le due schermate sono la stessa.

⚠️ Quindi non si confrontano le avvertenze intere ma le **frasi**, e **la
prima resta intera**: toglierla a tutte e due lascerebbe quel numero senza
il suo limite dichiarato in nessun punto della pagina.

**Visto a schermo: da due a una.**

---

## LA RILETTURA PRIMA DELLA CONSEGNA

### Cosa NON ho verificato con gli occhi

- 🔴 **Il segno col MOUSE e con la TASTIERA.** L'ho aperto col clic e
  richiuso col clic; il ramo `pointerType === "mouse"` e quello del focus
  **non sono stati esercitati**. È il ramo che ho scritto con più cura, e
  l'unico che non ho provato.
- **Le due migrazioni nuove non sono in produzione**: aspettano il push.
- **Il messaggio tradotto dentro una schermata vera**: l'ho misurato
  chiamando le funzioni dell'app dalla console, non premendo un pulsante.
  Quindi so che il *messaggio* arriva tradotto, non che la schermata lo
  *mostri* dove serve.
- **76 schermate su 84** non sono state guardate per le didascalie.
- **La stampa** delle schermate con didascalie: il segno è `print:hidden`,
  ⚠️ e con lui **sparisce dal foglio anche il testo che contiene**. Sulle
  otto schermate toccate nessuna ha una stampa, quindi oggi non morde —
  ma è una trappola per il prossimo giro, e vale la pena scriverla:
  **una didascalia su una schermata stampabile va valutata due volte.**

### Cosa ho dato per fatto senza misurarlo

- **Che le otto schermate toccate non abbiano altre didascalie oltre
  quelle trattate.** Ho guardato i testi principali, non ogni riga di ogni
  riquadro.
- **Che `pointerType` si comporti sul tablet di Alessio come sui browser
  che conosco.** È un ragionamento, non una misura sul suo dispositivo.

### Affermazioni del riepilogo precedente diventate false mentre lavoravo

1. 🔴 **«Un vincolo che scatta parla in inglese»** — scritto stamattina
   come cosa non fatta. **Ora è falso**: è la prima voce di questa
   consegna.
2. **«Le sei migrazioni nuove aspettano il push»** — ora sono applicate,
   e ne aspettano altre due.
3. **«`spiega_vincolo` non ha portiere, ed è voluto»** — scritto in una
   migrazione di poche ore fa. **Ora è falso**, ed è stata una rete del
   progetto a farmelo rivedere.

---

## Cosa abbiamo rovesciato

**Un rovesciamento**, e di una mia decisione di poche ore prima:
`spiega_vincolo` doveva essere aperta a chiunque e senza portiere.

- **Cosa era stato deciso**: il 24/08, poche ore fa, con la motivazione
  che «chi ha appena ricevuto un rifiuto ha già visto il nome tecnico del
  vincolo: negargli la spiegazione non protegge niente».
- **La ragione di allora**: vera per il *contenuto* di una singola
  spiegazione.
- **Cosa si decide adesso**: portiere «utente autenticato», niente `anon`.
- **Perché la ragione di allora non vale più**: guardava **una**
  spiegazione, non **l'elenco**. Chi ha la chiave pubblica non ha ricevuto
  nessun rifiuto: può leggerle tutte, e dentro ci sono ragioni di merito
  sul locale. *Il permesso non si giudica sul caso che si aveva in mente.*

Registrato come **n. 41** in
[`docs/decisioni_rovesciate.md`](../decisioni_rovesciate.md).

---

## Poscritto: cosa è cambiato dopo aver scritto questo riepilogo

⚠️ **La regola della rilettura chiede di dichiarare le affermazioni
diventate false mentre si lavorava. Ne sono nate tre in questo stesso
documento**, e la cosa più onesta è scriverle qui invece di correggere il
testo sopra come se non fosse successo niente.

1. **«Migrazioni: 209 … le due nuove aspettano il push»** → sono **210**,
   e ne aspettano **tre**: la `…014` è nata dopo, chiudendo il caso preso
   dalla rete dei portieri.
2. **Il commit dichiarato** era `52374bd`; ora è `3e5dc47`.
3. **«Due difetti trovati per strada»** nella sezione dei vincoli → sono
   diventati **quattro**, contando quello preso dalla rete dei portieri.

🔴 **E il conto vero della serata è questo**: dei quattro difetti chiusi
nella parte dei vincoli, **nessuno l'ho trovato rileggendo il codice**.
Uno l'ha preso la verifica di una migrazione, due le reti automatiche del
progetto, uno l'ho visto provando a schermo. *Le reti hanno lavorato più
di me.*

**Prove finali: 366 pure e 358 sul database, tutte verdi.**
