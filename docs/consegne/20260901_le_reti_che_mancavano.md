# Le reti che mancavano attorno alla CI — il P0, le migrazioni, le schermate, il peso

**01/09/2026.** Riepilogo per il validatore.

* **HEAD dichiarato**: `e2472954` — il commit che sta sotto questo file
  (`quanto pesa il gestionale, e quanto ne e' provato`).
* **Ramo**: `claude/code-review-remediation-f7o4xj`, aperto da `797262b` (master).
* **Prove**: **697 pure** verdi (61 file) · **12 sulle schermate** verdi
  (2 file, strato nuovo) · **459 contro il progetto di prova** verdi
  (67 file, lanciate da qui, uscita 0) · lint pulito · build pulita ·
  peso sotto il tetto.
* **Migrazioni**: **nessuna**. Niente tocca il database, né vero né di prova.
* **Working tree**: pulito dopo questo commit.

Origine del lavoro: una revisione esterna commissionata da Alessio, che
dichiara «implementazione disastrosa» e «copertura ridicola, appena il 9%».
Questo documento riporta **cosa di quel referto è vero misurandolo**, cosa
non lo è, e cosa è stato costruito di conseguenza.

---

## Cosa abbiamo rovesciato

**Niente.** Nessuna decisione presa in passato è stata ribaltata, e vale la
pena dire qual era il candidato più vicino, perché *non* lo è.

Il file dei controlli dichiarava, dal 31/08: *«nessuna prova di questo
progetto guarda una schermata»*. Da oggi ce ne sono dodici che ne montano
una. **Non era una decisione: era un limite dichiarato** — nato dal fatto
che le prove giravano in `node`, senza nessun ambiente di schermo. Non è
stato rovesciato niente: è stato tolto un impedimento, e la frase è stata
**riscritta invece di lasciarla lì a invecchiare**, dichiarando cosa quelle
dodici prove continuano a NON fare.

La ragione di allora resta intera e sta scritta nella forma nuova: *una
schermata che sborda, un testo sotto i tre millimetri, un colore che non si
distingue con le luci basse, li trova solo un occhio*.

---

## 1 · Il P0 è vero, e la sua conclusione no

**Vero, misurato sul registro di GitHub.** Il giro dei controlli sull'ultimo
commit di `master` (`797262b`, 31/08 ore 23:11) è **rosso**: il lavoro sul
codice passa, quello contro il database muore con **67 file falliti e 146
prove saltate**, fra «Invalid supabaseUrl» e credenziali mancanti.

**Non vero: che questo dica qualcosa sul gestionale.** Dieci minuti prima,
sullo **stesso identico contenuto** (il giro della proposta delle 22:55,
commit `31b66e7`), le stesse prove erano passate **459 su 459 in 391
secondi**. Il referto esterno lo nota lealmente e non ne trae la
conclusione; il primo giudizio («implementazione disastrosa») sì, e su
questo punto è **contraddetto dalla misura**.

**E la misura è stata rifatta oggi, da qui**, non citata: lanciando
`npm run test:app` contro il progetto di prova, sull'albero di `master`,
**67 file su 67, 459 prove su 459, uscita 0, 480 secondi**. Rifatta una
seconda volta dopo tutte le modifiche di questa consegna
(§ *Cosa è stato verificato*).

### La causa, letta riga per riga

Nel registro del giro rosso, il blocco `env` del passo che fallisce dice:

```
VITE_SUPABASE_URL: ***      <- c'era, ma non era un indirizzo
TEST_TITOLARE_EMAIL:        <- VUOTA
TEST_STAFF_EMAIL:           <- VUOTA
```

Due segreti mai creati, e nel terzo un valore che non è un indirizzo API.

### La radice sta nella guida, e nessun controllo poteva prenderla

`docs/CI.md` §3a diceva di riempire il segreto `PROVA_SUPABASE_URL`
copiando la riga **`VITE_SUPABASE_URL`** di `.env`. In `.env`, **dal
31/08**, quella riga è il **locale vero**.

La tabella era giusta finché i file erano tre e in `.env.test` quel nome
voleva dire il progetto di prova. È diventata falsa il giorno in cui i tre
file sono diventati uno — **lo stesso giorno in cui è stata scritta** — e
non se n'è accorto nessuno perché descrive un gesto che si fa una volta
sola.

⚠️ **Chi l'avesse seguita alla lettera avrebbe puntato le 459 prove — che
SCRIVONO — al database del locale.** Non è successo: `tests/app/aiuto.js`
rifiuta l'indirizzo di produzione, e la rete ha retto. Ma la guida
mandava lì.

⚠️ **E la casella non è ambigua per caso**: in `.env` il progetto di prova
ha *due* righe che lo descrivono — `PROVA_SUPABASE_URL` (l'API, `https://`)
e `DB_URL_PROVA` (il collegamento diretto, `postgresql://`, **con dentro una
password**). Da fuori si somigliano: portano tutte e due il riferimento del
progetto.

### Cosa era rotto nel repository, e non solo nel pannello

Il passo «Le chiavi ci sono?» guardava **una casella sola** e solo se
vuota. Quella c'era, quindi ha detto di sì. Il costo non sono i sei minuti:
è che **il rosso non nomina la causa**, e chi lo legge va a cercare il
guasto nel codice.

E la validazione era **divisa in tre file che divergevano**: la forma
dell'indirizzo in `vitest.config.js`, il rifiuto della produzione in
`tests/app/aiuto.js`, la presenza nel workflow. **Nessuno dei tre guardava
le quattro credenziali degli utenti** — cioè esattamente da dove è arrivato
il guasto. Peggio: la validazione della forma viveva nel ramo che legge
`.env`, cioè **l'unico ramo che nella pipeline non viene mai percorso**.

### Cosa c'è adesso

Una regola sola in `scripts/chiavi.mjs`, tre lettori: il preflight
(`scripts/chiavi-di-prova.mjs`), `vitest.app.config.js`, `tests/app/aiuto.js`.
Rifiuta, **nominandoli tutti insieme**: una qualunque delle sei caselle
vuota · un indirizzo che non comincia per `https://` · una stringa
`postgresql://` (nominando la confusione vera, `DB_URL_PROVA`) · l'indirizzo
del gestionale vero.

⚠️ **Non ripete mai il valore.** Dentro quella stringa c'è una password in
chiaro: un messaggio che la ristampa la porta nel registro della pipeline e
nella prima segnalazione che qualcuno incolla in chat.

⚠️ **Vale anche in locale**: `npm run test:app` lancia lo stesso comando
prima di vitest. *Un controllo che vale solo in un posto è il difetto del
31/08.*

✅ **Visto funzionare su un caso vero, non costruito**: in questo ambiente
`VITE_SUPABASE_URL` punta al **locale vero**, e il preflight lo dice e si
ferma.

### E le prove pure non dipendono più dal database

`vitest.config.js` leggeva `.env` e infilava le chiavi in `test.env`, che
vitest applica a **tutte** le prove: un valore storto lì dentro faceva
fallire `npm run test` con «Invalid supabaseUrl» su prove che non aprono
nessun collegamento. **Era già successo il 31/08.** La configurazione del
progetto di prova vive ora in `vitest.app.config.js`.

La **precedenza** fra ambiente e file non era scritta da nessuna parte e i
due documenti ne dicevano due versioni opposte. Ora è dichiarata —
*l'ambiente vince* — e provata nei due versi.

---

## 2 · Il P1 sulle migrazioni è vero

Il workflow non guarda le migrazioni. `versioniDoppie()` esiste dal 22/08 ma
vive dentro `npm run migra` e `npm run prova:migra`: comandi che girano sul
computer di Alessio.

Sei prove pure sulla cartella **vera**. Il difetto che chiudono è già
successo il 22/08 — due file con lo stesso numero, uno applicato e l'altro
dato per applicato — e quel giorno **in sala aggiungere un piatto a una
comanda falliva**.

Misurato oggi: **367 file, 367 versioni distinte, zero doppie**; 33 senza
auto-registrazione e 26 senza blocco di verifica, **tutte e trentatré
precedenti a `20260805000001`**, che è la migrazione che *crea*
`applied_migrations`. La soglia non è scelta: è quel fatto.

⚠️ **Quello che queste prove NON fanno**: non applicano niente. Che le 367
migrazioni girino davvero in ordine su un database vuoto lo dice
`npm run ricostruzione:verifica`, che ha bisogno di un motore Postgres e
resta fuori dalla pipeline.

---

## 3 · Il P1 sulle schermate è vero, e il «9%» va letto diviso

**Misurato**, non discusso: delle 13.241 istruzioni di `src/`, le prove pure
ne toccavano **1.310 — il 9,89%**. Il numero del referto è giusto. Il
giudizio che ci si appoggia sopra, no, perché il totale mette insieme cose
che si provano in tre modi diversi:

| cartella | file | istruzioni | prima | dopo |
|---|---|---|---|---|
| `src/lib/calcoli` | 40 | 1.097 | **91,9%** | 92,0% |
| `src/lib` (radice) | 19 | 666 | 44,3% | 46,1% |
| `src/lib/api` | 41 | 2.058 | 0,3% | 1,7% |
| `src/pages` | 89 | 8.731 | **0,0%** | **2,1%** |
| `src/components` | 25 | 627 | 0,0% | 3,0% |
| `src/context` | 1 | 33 | 0,0% | **66,7%** |
| **in tutto** | | 13.241 | **9,89%** | **11,96%** |

⚠️ **`src/lib/api` è esercitata dalle 459 prove contro il database**, che
questo strumento non vede: quel «1,7%» non è la sua copertura vera.

⚠️ **`src/pages` è i due terzi del gestionale**, ed era a zero. Non per
dimenticanza: le prove giravano in `node`, e montare un componente non era
possibile.

Dodici prove nuove: tre sulla pagina che vede un cliente (compresa la
sorveglianza del difetto del 09/08 — `/prenota` deve parlare **solo** dal
collegamento anonimo) e nove sulle porte chiuse a chi non è entrato.

🔴 **E la prima prova che ha montato una schermata ha trovato un difetto**:
cercava i campi per etichetta, come li cerca un lettore di schermo, e non ne
trovava **nessuno**. Nel modulo pubblico nessuna etichetta era legata al suo
campo. Su un telefono l'etichetta è un bersaglio grande sopra un campo
piccolo, e toccarla non faceva niente — sull'unica pagina dove chi sbaglia
il bersaglio non ha nessuno a cui chiedere. Otto campi legati.

---

## 4 · Il peso del pacchetto — vero, misurato, non risolto

Un solo file di codice: **1.488,89 kB, 351,24 compressi**, 91 `import`
statici in `src/App.jsx`. La compilazione un avviso lo dava già e **non
fermava niente**.

⚠️ **Chi lo paga non è chi si crede**: il tablet di sala lo scarica una
volta; **chi apre `/prenota` dal telefono scarica tutto il gestionale** —
magazzino, prima nota, proiezione fiscale — per compilare quattro caselle.

`npm run peso` misura e si ferma sopra il tetto dichiarato (400 kB
compressi). **Non divide il pacchetto**: caricare le schermate a pezzi
cambia cosa succede *in servizio* quando un pezzo non arriva, ed è una
decisione di Alessio, posta in chat con le due strade.

---

## 5 · Cosa è stato verificato, e come

| | |
|---|---|
| lint | pulito (`oxlint`, zero avvisi) |
| prove pure | **697 su 697**, 61 file |
| prove sulle schermate | **12 su 12**, 2 file |
| prove contro il progetto di prova | **459 su 459**, 67 file, uscita 0 |
| build | pulita |
| peso | 351,35 kB compressi, tetto 400 |

**Controprove fatte, non promesse** — ogni rete è stata rotta apposta e
guardata diventare rossa, poi rimessa a posto:

| rete rotta | esito |
|---|---|
| il controllo delle chiavi guarda una casella sola | 3 prove rosse su 18 |
| un doppione di versione + una migrazione senza niente dentro | 3 prove rosse su 6 |
| `RequireAuth` lascia passare tutti | 6 prove rosse su 12 |

🔴 **E il misuratore della copertura ha mentito alla prima versione**: v8
riscrive il riassunto a ogni giro, quindi l'unione leggeva due volte lo
stesso file e dichiarava `src/lib/calcoli` al **5,1%**. L'ha preso la regola
del 26/08 — *un misuratore nuovo si prova su un caso di cui si conosce già
la risposta*: quella cartella era stata misurata al 91,9% dieci minuti
prima. **Senza quel numero noto davanti, il 5,1% sarebbe finito in questo
riepilogo.**

---

## 6 · Cosa NON è stato verificato, e cosa resta ad Alessio

⚠️ **Nessuna immagine è stata guardata.** Le dodici prove nuove montano le
schermate in un ambiente finto (`jsdom`) e leggono il DOM: dicono che una
schermata **si apre** e **cosa contiene**, non come si vede.

⚠️ **Il modulo pubblico non è stato aperto da un telefono vero** dopo aver
legato le etichette ai campi.

⚠️ **La pipeline corretta non è ancora girata**: questo ramo non è stato
spinto quando il documento è stato scritto. Che il preflight fermi il giro
con un messaggio giusto è provato **da qui**, non su GitHub.

🔴 **CORRETTO POCHE ORE DOPO: le due cose che «poteva fare solo Alessio»
erano una sola, ed era mia.**

Questo documento diceva, alle 15:26: *«`PROVA_SUPABASE_URL` va rimesso» e
«`TEST_TITOLARE_EMAIL` e `TEST_STAFF_EMAIL` non esistono come segreti:
vanno creati»*. Alessio ha risposto che gli stavo chiedendo di rimettere a
posto a mano un lavoro che dovevo finire io. **Aveva ragione, misurato:**

| casella | è un segreto? | dove sta già scritta in chiaro |
|---|---|---|
| `PROVA_SUPABASE_ANON_KEY` | **sì**, è una chiave | — |
| `TEST_TITOLARE_PASSWORD` | **sì**, è un PIN | — |
| `TEST_STAFF_PASSWORD` | **sì**, è un PIN | — |
| l'indirizzo del progetto di prova | **no** | `REF_PROVA` in `scripts/comune.mjs`, e una dozzina di riepiloghi |
| `TEST_TITOLARE_EMAIL` | **no** | `.env.example`, riga 99 |
| `TEST_STAFF_EMAIL` | **no** | `.env.example`, riga 101 |

⚠️ **E il danno del segreto di troppo non è teorico: è il difetto stesso.**
Chiudere in un segreto un valore che il repository conosce non lo nasconde a
nessuno — lo rende **irrileggibile**. È per questo che due caselle sono
rimaste vuote e nella terza è finita la riga sbagliata *senza che nessuno
potesse accorgersene guardando*. **Una casella che non si può rileggere non
si può correggere a vista.**

Quindi le tre caselle pubbliche **non passano più dai Secrets**: il giro le
prende dal repository. I segreti restano tre — una chiave e due PIN — e sono
già a posto.

⚠️ **La rete sulla produzione non si è allentata, si è irrigidita**: prima
era un controllo che verificava il bersaglio, adesso l'indirizzo è **ricavato
da `REF_PROVA`**, quindi non può *essere* la produzione. Un indirizzo
`https://` passato a mano continua a vincere — così si possono ancora
puntare le prove a un terzo progetto — ed è il caso in cui il rifiuto scatta
come prima. Provato nei due versi.

⚠️ **La casella storta viene comunque DETTA, non nascosta**: il preflight
stampa una riga («in `PROVA_SUPABASE_URL` c'è `DB_URL_PROVA`, l'ho ignorata,
va comunque messa a posto») senza fermare il lavoro. *Una configurazione
sbagliata che smette di fare danno resta una configurazione sbagliata.*

### Quindi cosa resta ad Alessio

**Per la CI: niente.** Il giro deve diventare verde da solo, coi segreti
com'erano stamattina. ⚠️ *Che poi lo sia diventato non lo chiude: vedi
§ 11.*

**Fuori dalla CI, e resta la cosa più urgente di tutte**: rigenerare le
chiavi finite nella storia pubblica (§ sopra). Quella nessun codice la
chiude.


---

## 7 · Un errore mio, dichiarato

Alle 15:47 ho lanciato le 459 prove contro il progetto di prova **mentre il
giro dei controlli su GitHub stava lanciando le stesse prove sullo stesso
database**. Due scrittori sulla stessa dispensa: la mia esecuzione locale ha
riportato una prova rossa (`coperti-sala`, «c'è posto?»), e non era un
difetto del codice.

🔴 **La regola era già scritta e l'ho violata io**: *«le prove sull'app
girano in fila, mai in parallelo — il database è uno solo»* (CLAUDE.md §8,
lezione del 10/08). Il file dei controlli tiene una serratura fra i rami; non
può sapere che qualcuno sta lanciando le stesse prove da un'altra macchina.

Ho fermato la mia esecuzione per lasciare il campo al giro di GitHub, che è
quello che conta. ⚠️ **E fermarla a metà lascia righe indietro**: se il giro
di GitHub dovesse risultare rosso su una prova di sala, la prima ipotesi da
verificare è questa, non una regressione.

⚠️ **Le due esecuzioni complete citate al § 5 non sono toccate**: sono
finite alle 15:16 e alle 15:32, quando il lavoro «Prove contro il progetto
di prova» su GitHub si fermava al preflight in zero secondi senza aprire
nessun collegamento.


---

## 8 · Le prove non si cancellano più le righe a vicenda

Il rosso del giro `035038b` (66 file su 67, 457 prove su 459) non era una
regressione: era la **classe di difetto** che l'incidente ha scoperto.
Corretta qui dentro, per intero.

**Il fatto, misurato.** `beforeAll` di `tesoreria.test.js` cancellava
`like("note", "TEST-AUTO fisc%")` — cioè *tutti* i conti che somigliano a
una prova. Con due esecuzioni insieme, una portava via i conti che l'altra
aveva appena creato: `expected +0 to be 100`, `expected [] to have a length
of 1`.

⚠️ **Il filtro c'era: era largo quanto tutti.** Per questo il setaccio del
23/08 (`pulizieACaso()`) non poteva vederlo — per lui un `like` è un filtro
come gli altri.

**La misura della classe intera**, non del solo file segnalato: **43 punti
in 22 file**, tutti con una costante fissa (`const MARCA = "TEST-AUTO …"`)
usata sia per scrivere sia come modello `like`.

**Le due metà della cura**, perché una sola non basta:

1. **Il marchio del giro** (`marchio()`, `soloMiei()` in `tests/app/aiuto.js`):
   ogni esecuzione ha un identificatore proprio, e i modelli `like` prendono
   solo le proprie righe. Le 22 costanti sono state convertite.
2. **Le date di fantasia per giro** (`NUMERO_CORSA`, `giornoDiProva()`):
   dove la prova conta **un totale di giornata o di anno**
   (`quadratura_fiscale`, `ricavi_non_fiscalizzati`, i saldi) il marchio non
   serve a niente — due giri sullo stesso giorno si sommano e «100» diventa
   «200». Le fasce scelte (1800-1889, 2100-2189) sono vuote per costruzione:
   il locale apre nel 2027.

⚠️ **E un giro ucciso a metà non lascia più righe di nessuno**: quelle di
un'esecuzione abbandonata si tolgono comunque, ma **solo dopo mezz'ora**
(`MINUTI_DI_GRAZIA`), che è quattro volte il giro più lungo misurato (8
minuti su GitHub). Nessuna esecuzione viva può finirci dentro.

**Le reti che lo tengono fermo:**

| | |
|---|---|
| `tests/unita/isolamento-prove.test.js` | 10 prove pure: due giri diversi hanno marchi e date che non si toccano, e il modello dell'uno non prende le righe dell'altro |
| `pulizieDiTutti()` in `scripts/pulizie.mjs` | setaccio su **tutti** i file, script usa-e-getta compresi, dentro `npm run test` |

**Controprova fatta**: rimessa fissa una sola costante, il setaccio torna a
segnalare 2 righe; rimessa a posto, **0**.

⚠️ **E il setaccio ha dovuto imparare a riconoscere la cura**: alla prima
versione segnalava tutte e 43 le righe *già corrette*, perché guardava la
riga del `like` e non **come è definita la costante**. È la lezione del
22/08 — *un censimento automatico dice dove guardare, non cosa è vero*.

---

## 9 · Correzioni al linguaggio di questo riepilogo

Scritte perché le affermazioni precedenti erano più larghe di quello che le
misure sostengono.

| dove | come va detto |
|---|---|
| il P0 della CI | **non è chiuso.** Il preflight e la traduzione dei nomi sono corretti, e la suite risulta sana quando la configurazione è valida; ma il P0 si chiude **solo con un giro GitHub verde sul commit da rilasciare**, con le prove realmente eseguite. Un verde locale non lo sostituisce. |
| le 12 prove sulle schermate | sono **prove di componenti in `jsdom`**: montano l'albero React e leggono il DOM. **Non** sono un browser vero, **non** sono verifica visiva, **non** coprono navigazione completa, autenticazione reale, RLS attraverso l'interfaccia, telefono, doppio invio, rete interrotta o concorrenza. |
| i controlli sulle migrazioni | sono **statici**: leggono i file. Non applicano niente, non provano l'idempotenza, non ricostruiscono da zero. Quello lo fa `npm run ricostruzione:verifica`, che vuole un motore Postgres e resta fuori dalla pipeline. |
| Cloudflare | è **dimostrato** che le anteprime non aspettano i controlli: il 01/09 alle 15:48:53 l'anteprima del ramo era pubblicata mentre le prove sul database non erano partite. Sulla **produzione** l'affermazione poggia su `docs/CI.md` e sull'assenza di un lavoro di pubblicazione vincolato ai controlli, **non** su un'osservazione diretta. |
| il peso del pacchetto | è un rilievo **prestazionale**. Non è un P0 di sicurezza né di coerenza dei dati. |

### E la formula sui segreti esposti

Va detta così, e non «non sono state cambiate»:

> Al confronto eseguito il **01/09/2026 verso le 15:20**, con i valori che
> questa sessione ha ricevuto al proprio avvio, le categorie *collegamento
> al database di produzione*, *chiave di servizio di produzione*,
> *collegamento e chiave del progetto di prova* e *password degli utenti di
> collaudo* risultavano **invariate** rispetto a quelle esposte nel commit
> `30cfab9`. `PASSWORD_PROVA` e `PIN_COLLAUDO` sono **non verificabili** da
> qui. Token Cloudflare, chiave dell'assistente e firme dei webhook **non
> compaiono** in quei file. Il proprietario dichiara una rotazione
> successiva o diversa: **senza un nuovo confronto non è possibile
> affermare lo stato attuale.**

Il confronto è stato solo booleano: nessuna impronta, nessun prefisso,
nessun valore è stato stampato, scritto o committato.

---

## 10 · Azione del proprietario

Due sole cose non stanno nel repository e nessuna riga di codice le
sostituisce.

1. **Rigenerare le chiavi esposte** nel commit `30cfab9`, che resta
   leggibile nella storia pubblica: password del database di produzione,
   chiave di servizio, password del database di prova, password degli utenti
   di collaudo. ⚠️ Cambiando la chiave del gestionale va aggiornata anche
   Cloudflare, o il sito smette di funzionare: va fatto in quest'ordine.
2. **Decidere se la pubblicazione deve aspettare i controlli.** Oggi
   Cloudflare compila e pubblica per conto suo. Si chiude spegnendo la
   pubblicazione automatica del ramo principale e facendola partire dai
   controlli — cambia come va online `borgo58.it`, quindi è una decisione
   sua, non un lavoro rinviato.


---

## 11 · L'invariante della bonifica, e cosa NON chiude il P0

### L'invariante, per esteso

> **Una riga è bonificabile dopo 45 minuti soltanto perché ogni esecuzione
> supportata passa da un limite forzato inferiore: 30 minuti in GitHub
> (`timeout-minutes`) e 40 minuti nel comando locale canonico
> (`npm run test:app`).**

45 > 40 > 30. Se uno dei tre numeri si muove nel verso sbagliato, la
bonifica può cancellare le righe di un giro ancora vivo. Nessuno dei tre è
ricopiato: il tetto di GitHub si **legge** dal file dei controlli, quello
locale dal comando, e una prova pura li confronta
(`tests/unita/isolamento-prove.test.js`, `tests/unita/tetto-del-giro.test.js`).

### Il limite, dichiarato

> **Un invio diretto di Vitest che aggiri il comando canonico non è
> protetto dal limite locale.**

Poiché quell'aggiramento è possibile nella normale operatività — basta
`npx vitest run tests/app --config vitest.app.config.js` — **non è stato
solo documentato: è stato reso impossibile**. La configurazione delle prove
sul database si rifiuta di partire senza il segno che il comando canonico
mette (`BORGO58_CON_TETTO`), e lo dice:

```
Le prove contro il database si lanciano con `npm run test:app`, non
chiamando vitest a mano: è quel comando a imporre il tetto di tempo
(40 minuti) senza il quale la bonifica delle righe abbandonate
potrebbe cancellare le righe di un giro ancora vivo.
Per un file solo: npm run test:app -- tests/app/quello.test.js
```

⚠️ È un **rifiuto** e non un avviso: un avviso lo si legge una volta e poi
diventa arredamento, e qui in gioco ci sono le righe di un altro giro.
⚠️ E non toglie niente a chi deve provare un file solo: il comando canonico
inoltra i filtri.

### Il caso «giro ancora attivo», al confine

Una riga appena creata non dimostra niente: dimostra il caso facile. Il caso
che conta è **un giro che ha superato la vecchia soglia (30 minuti) ed è
ancora vivo**. È provato in modo deterministico, con orologio finto e senza
far girare niente (`tests/unita/tetto-del-giro.test.js`):

- a **35 minuti** il giro è ancora vivo (nessun segnale inviato) e le sue
  righe più vecchie hanno 35 minuti, cioè **sotto la grazia**: nessuna
  bonifica le può toccare;
- a **40 minuti** arriva `SIGTERM`, e 15 secondi dopo `SIGKILL`;
- quindi **nessun entrypoint supportato può restare vivo fino ai 45**.

Non esiste un lease con battito: al suo posto c'è questo — un limite
forzato su ogni via supportata, più il rifiuto di quelle non supportate.

### Cosa NON chiude il P0 della CI

Va detto perché in questo documento c'erano frasi più larghe del vero:

| fatto | cosa vale |
|---|---|
| il giro **40** (`7a3535f`, entrambi i lavori verdi) | **niente**: la mia esecuzione locale gli si è sovrapposta per 65 secondi. È un **esperimento concorrente**, non una misura. |
| il giro **39** (`a1f4432`, 67/67 file e 459/459 prove) | è un giro verde su un commit **superato**: non chiude il P0 per il codice che si sta proponendo. |
| le mie esecuzioni locali verdi | **niente**: un verde locale non sostituisce il lavoro su GitHub. |
| le due esecuzioni che ho interrotto per errore | **niente**, e sono dichiarate: hanno lasciato **zero** residui (censimento fatto). |

**Il P0 della CI si chiude con una cosa sola**: un giro su GitHub, sul
commit che si propone, con **entrambi** i lavori verdi, **67 file su 67 e
459 prove su 459**, nessuna prova saltata, e **nessun altro scrittore** sul
progetto di prova durante quel giro. Finché quel giro non esiste, il P0
resta **aperto**.
