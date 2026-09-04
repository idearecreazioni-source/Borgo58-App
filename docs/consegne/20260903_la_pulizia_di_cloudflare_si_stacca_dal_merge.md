# La pulizia di Cloudflare si stacca dal merge — l'account, gli eventi, il rosso

**03/09/2026, sera.** Riepilogo per il validatore.

* **Commit descritti**: `849aa70`, `2875c47`, `e976235`, uniti su `master` con
  `1c7b644` (proposta **#20**, unita da Alessio il 03/09 alle 20:37).
* **Ramo**: `claude/borgo58-secret-scanning-proposal-0jtd6i`, aperto da
  `af6450d` (master).
* **File toccati**: **uno**, `.github/workflows/pulizia-cloudflare.yml`.
  Nessun codice dell'applicazione, nessuna migrazione, nessuna impostazione.
* **Migrazioni**: **nessuna**. Niente tocca il database, né vero né di prova.
* **Prove**: la coda di GitHub sul commit in cima era verde — 6 controlli
  passati, 4 saltati, nessuno rosso.

🔴 **QUESTO RIEPILOGO È ARRETRATO, e va detto prima di tutto il resto.** È
scritto il **04/09**, cioè *dopo* che il lavoro era già stato unito su
`master`. La regola di casa dice *«nessun push senza il riepilogo
corrispondente»* e **non è stata rispettata**: i tre commit sopra sono usciti
senza. Non ricade nell'eccezione d'emergenza (che vale solo quando Alessio è
bloccato dal vivo su un difetto già in produzione): era lavoro nuovo, e il
riepilogo andava scritto prima. Autorizzato a colmarlo il 04/09.

---

## Cosa abbiamo rovesciato

* **Cosa era stato deciso e quando** — 31/08/2026, nascendo questo file: due
  pulizie **automatiche**, una sull'evento «ramo cancellato» e una a ogni
  `push` su `master`.
* **La ragione di allora**: *quello che Cloudflare costruisce non se ne va
  mai da solo*, e un lavoro a orario fisso girerebbe a vuoto — mentre gli
  eventi «ramo cancellato» e «pubblicazione nuova» sono esattamente i momenti
  in cui nasce qualcosa da togliere.
* **Cosa si decide adesso**: nessun evento di GitHub cancella più niente. La
  pulizia si chiede dal pulsante, ed è l'unica strada.
* **Perché la ragione di allora non vale più — o vale ancora e questo è il
  prezzo**: 🔴 **la ragione era giusta sul QUANDO e sbagliata sul CHI.** Gli
  eventi scelti erano davvero i momenti giusti; il difetto è che legavano una
  **cancellazione irreversibile** a un gesto che nessuno aveva fatto con
  quell'intenzione — **unire una proposta**. **Il prezzo che accettiamo** è
  scritto nel file: se nessuno preme il pulsante, le costruzioni si accumulano
  di nuovo. *Cancellare per errore costa più che accumulare.*

Secondo rovesciamento, dentro la stessa proposta e **rovesciato di nuovo
prima della fine**: il 31/08 il file diceva *«un verde che non ha fatto niente
è peggio di un rosso»*. Il commit `849aa70` lo ha sostituito con un avviso
giallo; su rilievo di Alessio, `e976235` è **tornato al rosso** sui soli
percorsi che cancellano. Lo stato finale coincide con la decisione del 31/08:
**non c'è nessun rovesciamento netto su questo punto.**

---

## 1 · La causa, misurata

Il lavoro «ramo cancellato» falliva **sempre**, e la causa non era una
configurazione mancante: era una fonte sbagliata scritta nel file.

| file | da dove prendeva l'account |
|---|---|
| `anteprima.yml` (righe 79, 105) | `vars.CLOUDFLARE_ACCOUNT_ID` |
| `controlli.yml` (363, 379, 431, 450) | `vars.CLOUDFLARE_ACCOUNT_ID` |
| **`pulizia-cloudflare.yml` (105, 121, 152, 190, 201)** | 🔴 `secrets.CLOUDFLARE_ACCOUNT_ID` |

Era **l'unico dei quattro** a cercarlo fra i segreti, dove non c'è e non deve
esserci: un identificativo di account non è una credenziale, e tenerlo fra i
segreti fa credere che nasconderlo protegga qualcosa.

⚠️ **E il rifiuto mandava fuori strada in due modi**: diceva *«Mancano
CLOUDFLARE_API_TOKEN o CLOUDFLARE_ACCOUNT_ID fra i Secrets»* — nominava due
cose quando ne mancava una, e mandava a cercare nei segreti una cosa che nei
segreti non deve stare. È la regola del 27/08: *ogni rifiuto che ha più di una
causa le elenca, o manda a cercare nella prima che viene in mente*.

🔴 **La conseguenza grossa è emersa correggendo la piccola.** Con l'account
finalmente leggibile, il lavoro `produzione` avrebbe funzionato **al primo
push su `master`** — cioè il merge stesso avrebbe cancellato. Misurato dal
giro di sola lettura sulla proposta: **35 costruzioni** sarebbero sparite
(12 di produzione dal 31/08 al 01/09, 23 anteprime di rami).

---

## 2 · Cosa cambia

| | prima | dopo |
|---|---|---|
| Merge / `push` su `master` | 🔴 cancellava (conservazione) | non fa niente |
| Ramo cancellato su GitHub | 🔴 cancellava le sue anteprime | non fa niente |
| Pulsante *Run workflow* | 2 voci | **3**: `produzione` · `orfani` · `ramo` |
| Nome del ramo vuoto | — | **rifiutato** con uscita 1 |
| Credenziale mancante, percorsi che cancellano | avviso, uscita 0 | 🔴 **rosso, uscita 1** |
| Lettura su ogni proposta | legge e basta | **identica** |

⚠️ **L'evento `delete` è stato tolto anche se la richiesta nominava il merge**,
e la ragione è che era **l'ultima cancellazione che avveniva senza che nessuno
l'avesse chiesta** — e sarebbe scattata proprio alla cancellazione di quel
ramo dopo il merge.

⚠️ **La terza voce del pulsante non è un'aggiunta: è una necessità.** Tolto
`delete`, togliere le anteprime di un ramo non si potrebbe più fare da nessuna
parte.

⚠️ **Il lavoro di sola lettura NON è stato toccato**: lì non si cancella, e un
rosso su ogni proposta sarebbe un guardiano che grida sempre.

### Due frasi diventate false, corrette invece che lasciate

* *«la conservazione parte a ogni push su `master`»* — non parte più.
* *«nessuna delle due pulisce il passato: valgono da quando esistono»* — era
  vero **solo perché** partivano da sole; lanciandole a mano guardano tutto,
  vecchio compreso.

---

## 3 · Cosa è stato verificato, e come

Nessuna prova ha toccato Cloudflare.

1. **Le fonti**: `secrets.CLOUDFLARE_ACCOUNT_ID` nel file → **0** (erano 5);
   le 4 righe `env` usano `vars`; il token resta un segreto in tutti e 4 i
   punti.
2. **Gli eventi**: rimasti `pull_request` e `workflow_dispatch`; zero `push`,
   zero `delete`. **Entrambi i lavori che cancellano richiedono
   `workflow_dispatch`** — è questa la proprietà che dimostra che il merge non
   può più cancellare.
3. **YAML valido** e `bash -n` su tutti i blocchi di comandi: nessuno rotto.
4. **I blocchi eseguiti con un `node` finto sul PATH**, in tutti i loro casi:
   ramo vuoto → 1 · manca il token → 1 · manca la variabile → 1 · mancano
   tutt'e due → 1 **con due messaggi** · tutto a posto → il comando giusto,
   uscita 0.
5. **Regressione sul lavoro di sola lettura**: senza credenziali i suoi due
   passi escono con **0**, invariati. *È la prova che la modifica non ha
   debordato.*
6. 🔴 **Prova per rottura su entrambi i percorsi distruttivi**: tolto il punto
   in cui si ferma, `node` viene chiamato **senza token**. Quindi la fermata
   discrimina invece di limitarsi a passare.
7. ✅ **La variabile `CLOUDFLARE_ACCOUNT_ID` esiste ed è giusta** — dimostrato
   dal lavoro di sola lettura della proposta, che ha parlato con Cloudflare e
   riportato i conteggi (70 costruzioni, 23 di produzione, 47 anteprime su 15
   rami). ⚠️ Il log è stato **letto**: quel lavoro esce verde anche quando
   salta, quindi un verde da solo avrebbe voluto dire «non ho guardato».
8. ✅ **Dopo il merge, «Pulizia Cloudflare» NON è partita**: sul push a
   `master` sono partiti solo `Controlli` e `CodeQL`.

### Un tentativo di prova che non provava niente

⚠️ La **prima** prova per rottura non si è applicata (un `sed` con
l'indentazione sbagliata) e ha fatto girare un file di una prova precedente:
quel risultato **non dimostrava nulla**, ed è stato rifatto con un controllo
che si ferma se la rottura non cambia il testo. *Una rottura che non morde
non è una prova debole: è un'altra cosa.*

---

## 4 · Cosa NON è verificato

* 🔴 **Il caso «ramo cancellato» non è stato messo alla prova sul campo**: dopo
  il merge il ramo non è stato cancellato. Che non faccia più niente si vede
  **dal file** (l'evento non c'è più), non da un fatto accaduto.
* **Nessuna pulizia vera è stata lanciata** da questa sessione.
* ⚠️ **Il commento accanto a `fetch-depth: 0`** nel lavoro di sola lettura
  dichiara che `--orfani` ha bisogno della storia intera. **Non era stato
  misurato** quando questo lavoro è stato fatto; lo è stato il 04/09 — vedi il
  riepilogo del giorno dopo.

---

## 5 · Cosa resta ad Alessio

* Su Cloudflare restano le costruzioni oltre le soglie: si tolgono da
  *Actions → Pulizia Cloudflare → Run workflow*. **È una sua decisione**, e
  toglie versioni che sono anche la via per tornare indietro.
* ⚠️ **Cancellare un ramo non toglie più le sue anteprime**: da oggi è un
  gesto in due tempi.

---

## 6 · Un errore mio, dichiarato

Nella prima stesura avevo scritto nella descrizione della proposta che le 35
costruzioni erano **tutte di produzione**. **Falso**: la conservazione applica
due regole insieme — produzione oltre le ultime 10 **e** anteprime oltre le
ultime 2 di ogni ramo — e la composizione vera era **12 di produzione e 23
anteprime**. L'ho corretto leggendo il codice invece di dedurlo dal numero,
prima che Alessio decidesse.

Co-autore del lavoro: Claude Code. Le decisioni di merito (staccare la pulizia
dal merge, il rosso sui percorsi distruttivi) sono di Alessio.
