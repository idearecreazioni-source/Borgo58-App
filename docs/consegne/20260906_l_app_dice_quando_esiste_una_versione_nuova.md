# L'app dice quando esiste una versione nuova

**06/09/2026.** Riepilogo per il validatore.

🔴 **QUESTO DOCUMENTO È UN'INTEGRAZIONE SUCCESSIVA, e va letto sapendolo.**
La convenzione del progetto vuole il riepilogo come **ultimo commit della
consegna**, prima del push. Qui non è andata così: il lavoro è stato
committato, spinto, unito a `master` e **pubblicato in produzione** senza
riepilogo, e questo file arriva **dopo**, su una proposta separata, su
richiesta di Alessio del 06/09 quando gliel'ho segnalato.

* **Quinta violazione della stessa regola** (le prime quattro il 15/08,
  rilevate dal validatore). L'eccezione d'emergenza **non si applica**: era
  lavoro nuovo, e una funzionalità che non esiste ancora non blocca nessuno.
* **Nessuna rete l'ha fermata, ed è la parte che conta.** Il freno che esiste
  (`npm run consegne`, e il rifiuto di `npm run migra` / `npm run funzione`)
  guarda le **migrazioni applicate senza riepilogo**. Questa consegna non ha
  migrazioni — quindi la rete non aveva niente da guardare, e la regola è
  tornata a essere quello che era prima del 16/08: **un proposito**.
* ⚠️ **Il buco è dichiarato e non chiuso**: una consegna di solo codice, che
  passa da un merge e da una pubblicazione, oggi non incontra nessun
  controllo che pretenda il suo riepilogo. Chiuderlo è un lavoro a sé —
  starebbe nei controlli di GitHub, non nella memoria di chi consegna.

---

* **HEAD dichiarato**: `89625a4` — il merge della proposta #31 su `master`,
  cioè lo stato **già pubblicato**. Questo file non sta sopra di lui: sta su
  un ramo separato che non tocca nessun file di codice.
* **I commit della consegna**: `8ea22d2` (il lavoro) e `b35ae20` (le prove si
  costruiscono il pacchetto invece di aprire `dist/`).
* **Ramo di questo documento**: `riepilogo-avviso-aggiornamento`, aperto da
  `89625a4`. **Solo documentazione**: nessun file di `src/`, `tests/`,
  `scripts/`, `supabase/` o `.github/`.
* **Migrazioni**: **nessuna**. Niente tocca il database, né vero né di prova.
* **In produzione**: sì, giro `34038254158`, approvato da Alessio. Il sito è
  passato da `/assets/index-DlocbrVZ.js` a `/assets/index-aFqV5Pn4.js`.
* **Working tree**: pulito dopo questo commit, nella copia separata da cui è
  stato scritto.

---

## Cosa abbiamo rovesciato

**Niente.** Nessuna decisione presa in passato è stata ribaltata.

L'unica che è stata **toccata senza essere rovesciata** è la regola del 19/08
sulle tre risposte (*«non vuol dire che è vuota: vuol dire che non lo so»*):
qui non viene cambiata, viene **applicata a un caso nuovo** — e la revisione
ha mostrato che la prima stesura la applicava a metà (§ 4).

---

## 1 · La causa, misurata e non dedotta

Il difetto riferito: un dispositivo che aveva già aperto il gestionale poteva
continuare a mostrare un'interfaccia precedente.

**L'ipotesi ovvia era la memoria del browser, ed è falsa.** Chieste le
intestazioni vere a `borgo58.it` il 06/09:

| cosa | intestazione servita |
|---|---|
| `index.html` | `Cache-Control: public, max-age=0, must-revalidate` |
| `/assets/index-*.js` | nome con l'impronta del contenuto, `max-age=14400` |

Cioè **una ricarica prende sempre la versione nuova**: `index.html` si
rivalida a ogni apertura e gli asset cambiano nome a ogni costruzione.

**Il difetto è che non ricarica nessuno.** Non c'è service worker (verificato:
zero riferimenti in `src/`, `public/`, `scripts/`), e una pagina rimasta
aperta — o l'app aggiunta alla schermata iniziale, ripresa dalla memoria di
iOS — continua a far girare il pacchetto scaricato quel giorno, per sempre.
*Il pacchetto non è vecchio perché è conservato male: è vecchio perché
nessuno gli ha mai detto che ne esiste un altro.*

## 2 · La forma scelta, e la seconda risposta che non si è costruita

L'impronta di una versione **è l'elenco dei file che `index.html` carica**.
Non un numero di versione scritto al momento della costruzione.

⚠️ **La ragione è già scritta in `vite.config.js`** e vale identica qui: un
marcatore a parte sarebbe una **seconda risposta** alla domanda «quale
versione è questa», accanto a quella che il browser usa davvero per decidere
cosa caricare. Due risposte che *dovrebbero* coincidere sono il difetto che
quel file ha già chiuso una volta — «due strade per la stessa risposta sono un
doppione da togliere, non una difesa in più».

**Una regola sola, due ingressi**: la stessa funzione legge la testa della
pagina che sta girando e l'`index.html` chiesto al sito con `cache: "no-store"`.

## 3 · Nessuna ricarica automatica, e non è una cautela

Il mandato chiedeva di non ricaricare mai mentre qualcuno sta compilando un
modulo. **Non c'è nessun caso da elencare, perché non esiste codice che
ricarichi da solo**: l'unica strada che ricarica è il pulsante.

⚠️ E premendo il pulsante si chiama `fotografa()` **prima** di ricaricare — la
stessa e unica funzione che già conserva le bozze, chiamata da un innesco in
più. Non è un secondo meccanismo: è che così *«premere Aggiorna non porta via
niente»* diventa una **proprietà provabile di questo codice**, invece di una
fiducia in ciò che il browser manda prima di lasciare la pagina.

## 4 · Il difetto trovato dalla revisione, e corretto

La revisione (Codex, un solo giro sul diff) ha trovato un difetto vero,
**verificato con la misura prima di accettarlo**:

> La prima stesura cercava la parola `/assets/` nel **testo** della risposta.
> Una pagina estranea che risponde «va tutto bene» e nomina un proprio file —
> il portale di una rete wifi, la pagina d'errore di un altro sito —
> produceva un'impronta valida, quindi «diversa», quindi **un aggiornamento
> annunciato che non esiste**.

Misurato: con `<script src="/assets/portale.js">`, `ceUnAggiornamento` **dava
`true`**. Ed è il falso allarme che il terzo stato esiste per evitare, entrato
dalla porta di fianco: non «non ho letto la risposta», ma **«ho letto la
risposta sbagliata credendo che fosse la mia»**.

🔴 **E la prova che copriva quel caso era più debole del caso.** Usava un
portale **senza** file in `/assets/`, cioè l'unica versione del problema che
passa da sola. *Una prova costruita sul caso comodo dice che il codice regge
il caso comodo.*

**Due difese, perché i portali sono di due tipi**, e nessuna sostituisce
l'altra:

| difesa | prende |
|---|---|
| si leggono gli attributi `src`/`href` dei **tag**, e dev'esserci il pezzo principale (lo script di modulo sotto `/assets/`) | il portale che risponde **al posto nostro** |
| si scarta la risposta arrivata da un **indirizzo diverso** dal nostro | il portale che **dirotta** altrove |

⚠️ **Limite dichiarato**: una pagina che imitasse esattamente questa forma *e*
rispondesse dal nostro indirizzo resterebbe indistinguibile. Non è una svista
— non esiste niente da guardare che la distinguerebbe.

⚠️ **E si sbaglia nel verso rumoroso**: se Vite cambiasse la forma dei suoi
tag, la funzione direbbe «non lo so» e il gestionale smetterebbe di annunciare
gli aggiornamenti **in silenzio** — il difetto di partenza tornato. A impedirlo
c'è una prova che **compila davvero** e pretende che l'impronta esista:
diventa rossa da sola.

## 5 · Quando si guarda

* **Al ritorno della visibilità** — il tablet in carica sul bancone, ripreso in
  mano. È lo stesso appiglio dell'avviso di fine serata in Comande: se
  aspettasse un gesto, coprirebbe tutti i casi tranne quello per cui esiste.
* **Ogni 30 minuti** mentre la schermata è sotto gli occhi, per il tablet che
  nessuno posa mai. Non è il meccanismo principale, ed è per questo che può
  essere così largo.
* **Non all'avvio**: la pagina è appena stata servita dal sito, quindi per
  costruzione è quella di adesso. Una richiesta lì sarebbe buttata via a ogni
  apertura. ⚠️ Il caso che resta scoperto è chi ricarica **da offline** con una
  copia vecchia in memoria: lo prende il battito entro mezz'ora.
* **Una volta trovato non si chiede più niente**: non c'è altro da sapere.

## 6 · Due difetti di processo trovati dai controlli, non da una rilettura

🔴 **Il primo giro di CI è stato rosso, per un difetto mio.** Le prove aprivano
`dist/index.html`, ma **nei controlli le prove girano PRIMA della
compilazione** (`controlli.yml`: `npm run test` alla riga 149, `npm run build`
alla 167). In locale `dist/` c'è quasi sempre: **passava dove non conta e
falliva dove conta.**

⚠️ **La cura non è spostare la compilazione prima delle prove**: sarebbe
mettere in un file di configurazione una condizione che appartiene a una
prova, dove nessuno la vedrebbe. *Una prova che ha bisogno di qualcosa se lo
procura* — `tests/pacchetto.mjs`.

🔴 **E la prima correzione ne ha causato un'altra, misurata nei due versi.**
Facendo compilare anche le prove di schermata dentro un `beforeAll`, **tre
prove degli altri due file della stessa cartella diventavano rosse** per
scadenza di tempo: la compilazione le affamava. Togliendo il file tornavano
verdi tutte e 12. Quindi le prove di schermata **non compilano**: usano la
forma vera dell'`index.html` come costante, e che quella forma sia ancora
giusta lo sorveglia la prova pura, che compila davvero.

⚠️ *Una prova che affama le vicine le rende rosse per una ragione che non
c'entra con loro*, e una prova intermittente è peggio di una rossa — insegna a
rilanciare invece che a guardare.

⚠️ **E ho sbagliato la diagnosi due volte prima di misurarla**: quelle tre
rosse le avevo dichiarate ad Alessio prima come «preesistenti», poi come
«intermittenti». Erano **mie**. A stabilirlo è stato togliere il mio file e
contare, non ragionarci sopra.

## 7 · Il collaudo con le mani NON è avvenuto, ed è un difetto del piano

🔴 **Il collaudo che avevo disegnato era impossibile per costruzione.** Avevo
fatto lasciare ad Alessio l'app aperta *prima* del merge, dicendogli che
l'avviso sarebbe comparso da solo al ritorno. **Non poteva**: l'avviso lo
mostra la versione **che sta girando**, e quella sul telefono precedeva la
pubblicazione.

**Misurato sui due pacchetti serviti da `borgo58.it`:**

| | `index-DlocbrVZ.js` (vecchio, sul telefono) | `index-aFqV5Pn4.js` (nuovo) |
|---|---|---|
| la frase «Aggiornamento disponibile» | **0** | 1 |
| il codice che interroga il sito (`no-store`) | **0** | 1 |

⚠️ **Quindi nessun occhio ha mai visto questo avviso**, e in particolare resta
non verificato **se su iPhone, riprendendo l'app dall'icona della schermata
Home, il controllo parta davvero al ritorno della visibilità** — che è
precisamente la cosa che il collaudo doveva dire.

**Deciso con Alessio**: si aspetta la prossima pubblicazione vera invece di
costruire un'anteprima apposta. Il collaudo si prepara aprendo l'app **prima**
del merge, su una versione che contiene già il controllo.

---

## 8 · Cosa è stato verificato, e come

| | |
|---|---|
| lint | pulito (`oxlint --max-warnings=0`, zero avvisi) |
| prove pure | **841 su 841**, 69 file — **11 nuove** |
| prove sulle schermate | **21 su 21**, 3 file — **9 nuove** |
| prove contro il progetto di prova | **459 su 459** nei controlli di GitHub |
| compilazione | pulita |
| controlli su GitHub (proposta #31) | tutti verdi |
| controlli su GitHub (dopo il merge su `master`) | tutti verdi |

⚠️ **In locale le prove contro il progetto di prova danno 458 su 459**, e la
differenza è informativa: la rossa è
`tests/app/funzioni-senza-schermata.test.js` su `viste_che_scavalcano_rls`,
una funzione che **esiste nel database di prova locale e in nessuna migrazione
del repository** (cercata in tutto il repository: zero riscontri). Su GitHub il
database di prova si ricostruisce dalle migrazioni, quindi lì non esiste e la
prova passa. **È un residuo del database locale**, fuori dal perimetro di
questa consegna per decisione di Alessio.

**Controprove fatte, non promesse** — ogni regola è stata rotta apposta e si è
guardato *quali* prove diventavano rosse:

| rottura | pure (11) | schermate (9) |
|---|---|---|
| non annuncia mai un aggiornamento | 2 rosse | 4 rosse |
| «non lo so» trattato come «è cambiata» | 2 rosse | 4 rosse |
| impronta costante | 3 rosse | 4 rosse |
| non si pretende il pezzo principale | 4 rosse | **1 rossa**, quella del portale |
| non si guarda da dove arriva la risposta | **0 rosse** | **1 rossa**, quella del dirottamento |

⚠️ **Lo zero dell'ultima riga è dichiarato e corretto**: quella difesa vive
nella metà che parla col sito (`improntaServita`), che le prove pure non
esercitano — le pure provano la regola, non la richiesta. È l'unica delle
cinque rotture che **una sola** delle due famiglie di prove può vedere, e
saperlo conta: se un giorno le prove di schermata venissero tolte, quella
difesa resterebbe **senza nessun guardiano** senza che niente diventi rosso.

🔴 **E la prima tornata di controprove ha trovato un buco nelle prove stesse**:
rotto il terzo stato, restavano **tutte verdi**. Le tre prove «NON compare»
guardavano lo schermo *prima* che React lo aggiornasse, quindi sarebbero
passate anche se l'avviso fosse comparso un istante dopo. Ora chiedono anche
cosa ha **deciso** il controllo, che è un'affermazione diversa da cosa mostra
lo schermo.

⚠️ **La prova pura compila davvero, due volte**, e le due metà si tengono: una
ricostruzione che non cambia niente **non** annuncia un aggiornamento
(misurato: stessa impronta), una con codice diverso **sì**. Senza la seconda,
un'impronta sempre uguale a sé stessa passerebbe la prima.

🔴 **Una misura mi ha mentito, ed è annotata nel file di prova**: due
costruzioni identiche davano impronte **diverse**, e sembrava
non-determinismo di Vite. Non lo era: Tailwind legge i file del progetto per
decidere quali stili servono e **rispetta `.gitignore`** — una cartella di
costruzione con un nome non ignorato viene letta dalla costruzione successiva,
che ci trova dentro il pacchetto di prima. Da lì il nome `dist-prova-…`, che
`.gitignore` copre già.

## 9 · Cosa NON è stato verificato

- **Nessuna mano ha visto l'avviso** (§ 7). Non è stato guardato da nessuno
  schermo vero, mai.
- **Se su iPhone il controllo parte riprendendo l'app dall'icona**: è il caso
  per cui l'intero lavoro esiste, ed è quello non provato.
- **Se il verde si distingue con la luce del locale**, e se la riga dà fastidio
  durante il servizio. Sono giudizi di Alessio, non misure.
- **Il comportamento dietro un portale wifi vero**: le due difese sono provate
  su risposte costruite, non su una rete che intercetta davvero.
- **Il battito dei 30 minuti non è mai stato osservato scattare**: le prove
  chiamano il controllo direttamente.
