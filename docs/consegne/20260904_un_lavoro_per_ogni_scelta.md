# Un lavoro per ogni scelta — il nome dice cosa sta facendo

**04/09/2026.** Riepilogo per il validatore.

* **Commit descritto**: `c6ae726`, unito su `master` con `baa8f53` (proposta
  **#21**, unita da Alessio il 04/09 alle 14:46).
* **Ramo**: `claude/borgo58-secret-scanning-proposal-0jtd6i`, ripartito da
  `1c7b644` (master).
* **File toccati**: **uno**, `.github/workflows/pulizia-cloudflare.yml`
  (+91 −48). Nessun codice dell'applicazione, nessuna impostazione.
* **Migrazioni**: **nessuna**. Niente tocca il database, né vero né di prova.
* **Prove sul commit di merge** (`baa8f53`, coda di GitHub): **830 pure**
  verdi (68 file) · **12 sulle schermate** verdi (2 file) · **459 contro il
  progetto di prova** verdi (67 file) · CodeQL verde su tutt'e due le lingue.

🔴 **ANCHE QUESTO RIEPILOGO È ARRETRATO**, come quello del giorno prima: è
scritto dopo che il lavoro era già unito. Stessa regola non rispettata, stessa
ragione per dirlo invece di nasconderlo.

---

## Cosa abbiamo rovesciato

* **Cosa era stato deciso e quando** — 03/09/2026, poche ore prima: un lavoro
  solo copriva le scelte `produzione` e `orfani`, con la condizione
  `inputs.cosa != 'ramo'`.
* **La ragione di allora**: erano due varianti dello stesso comando
  (`cloudflare.mjs` con o senza `--orfani`), quindi sembrava un lavoro solo con
  un parametro.
* **Cosa si decide adesso**: tre lavori distinti, uno per scelta, ciascuno col
  suo nome — più un quarto che rifiuta una scelta che nessun lavoro esegue.
* **Perché la ragione di allora non vale più**: 🔴 **era sbagliata, e si è vista
  solo usandola.** *Due varianti dello stesso comando non sono la stessa cosa
  se producono due effetti diversi*: una tiene le ultime dieci versioni del
  sito, l'altra toglie anteprime di rami morti. Chi guarda la schermata legge
  **il nome del lavoro**, non il parametro — e il nome poteva descriverne solo
  una.

---

## 1 · Il difetto, visto usando il pulsante

Alessio ha lanciato la pulizia con la scelta `orfani`. Nella schermata Actions
è comparso questo (giro `33855017584` del 04/09, ore 08:45):

```
Conservazione, e la pulizia una volta sola     success     ← ha fatto il lavoro
Cosa c'e' su Cloudflare (sola lettura)         skipped
Via le anteprime di un ramo                    skipped
```

e il suo log finisce con **«Tolte 19 su 19»**, tutte righe `preview`,
**nessuna `production`**. Cioè: **la cosa fatta era giusta, il nome era
sbagliato.**

### La causa

Un lavoro solo ne faceva due: la sua condizione era `inputs.cosa != 'ramo'` —
*«tutto tranne ramo»* — e il suo nome nominava **una sola** delle due cose che
sapeva fare.

🔴 **E la condizione larga non era solo un nome sbagliato.** Essendo un
raccoglitore, una voce nuova aggiunta al menu sarebbe finita lì dentro e
avrebbe eseguito **la conservazione**, cioè avrebbe cancellato versioni di
produzione al posto di quello che era stato chiesto.

---

## 2 · La cura: una scelta, un lavoro, un nome

Tabella calcolata **valutando le condizioni** del file, prima e dopo:

| scelta dal menu | prima | dopo |
|---|---|---|
| `produzione` | Conservazione, e la pulizia una volta sola | **Conserva le ultime versioni di produzione** |
| `orfani` | 🔴 Conservazione, e la pulizia una volta sola | **Rimuovi anteprime orfane** |
| `ramo` | Via le anteprime di un ramo | **Rimuovi anteprime del ramo indicato** |
| una voce nuova | 🔴 Conservazione *(cancellava produzioni)* | **Scelta non riconosciuta** → rosso |
| su una proposta | Cosa c'è su Cloudflare (sola lettura) | invariato |

Il nome diventa **vero per costruzione** invece che per convenzione: nessun
lavoro può più eseguire qualcosa di diverso da quello che dichiara.

⚠️ **Il quarto lavoro è un'aggiunta oltre la richiesta letterale, ed è stata
dichiarata nella proposta.** Chiude un buco che la divisione stessa apre: con
le condizioni strette, una voce aggiunta al menu senza il suo lavoro farebbe
un giro **verde che non ha fatto niente**.

⚠️ **Prezzo dichiarato**: il controllo sulle credenziali è ora ripetuto in tre
lavori invece di due. Si toglierebbe con un'azione composita, che aggiunge un
file e un livello — non fatto, e messo a decisione di Alessio.

---

## 3 · Cosa è stato verificato, e come

Nessuna prova ha toccato Cloudflare.

1. **La tabella «scelta → lavoro»** qui sopra, calcolata valutando le
   condizioni del file su entrambe le versioni.
2. **YAML valido**, `bash -n` su tutti i blocchi di comandi: nessuno rotto.
3. **I quattro blocchi eseguiti con un `node` finto**: senza credenziali
   escono con **1** nominandole tutt'e due; con le credenziali chiamano il
   comando giusto (`--orfani --conferma`, `--conferma`, `--ramo "<nome>"
   --conferma`); il ramo vuoto viene rifiutato; la scelta sconosciuta esce
   con 1.
4. 🔴 **Prova per rottura**: rimessa la condizione larga su un lavoro, la
   tabella segnala **«2 lavori»** sulla scelta `orfani`. Quindi discrimina.
5. **Il lavoro di sola lettura è identico a quello su `master`** — confrontati
   i due oggetti YAML, non letti a occhio.
6. **Gli eventi**: zero `push`, zero `delete`; le pulizie restano solo dal
   pulsante.

### ✅ E la prova sul campo è stata fatta, senza cancellare niente

Il 04/09 alle 14:59, sul commit di merge, è stato lanciato il pulsante con la
scelta **`ramo`** e un nome di ramo mai esistito (giro `33886855211`):

```
Rimuovi anteprime del ramo indicato        success   ← il nome giusto
Rimuovi anteprime orfane                   skipped
Conserva le ultime versioni di produzione  skipped
Scelta non riconosciuta                    skipped
Cosa c'e' su Cloudflare (sola lettura)     skipped
```

e il log dice **«Niente da togliere.»** — nessuna cancellazione.

⚠️ **Perché è sicuro per costruzione, non per fortuna**: `anteprimeDelRamo`
filtra le anteprime con **uguaglianza esatta** sul nome del ramo; con un nome
mai esistito l'elenco è vuoto, e lo script **esce prima** di qualunque
cancellazione.

---

## 4 · Cosa NON è verificato

* 🔴 **Due nomi su quattro non sono mai stati visti girare.**
  «Conserva le ultime versioni di produzione» non è provabile senza cancellare
  (quel lavoro passa sempre `--conferma`, e ci sono costruzioni da togliere);
  «Scelta non riconosciuta» non è raggiungibile dal menu, che offre solo tre
  voci. Di entrambi si vede il nome **fra i saltati** sulle proposte.
* **L'alternativa esiste e non è stata costruita**: una voce «guarda e basta»
  nel menu, che lanci lo stesso comando **senza `--conferma`**, renderebbe ogni
  nome dimostrabile senza cancellare mai. È una modifica, quindi una proposta
  a sé e una decisione di Alessio.

---

## 5 · Una frase del lavoro è falsa — misurata, e NON corretta

Nel lavoro di sola lettura, accanto a `fetch-depth: 0`, c'è scritto:

> *«SERVE LA STORIA INTERA: `--orfani` chiede a git quali rami esistono
> davvero su GitHub, e con un solo commit scaricato non può saperlo.»*

**È falsa, e la misura è di oggi.** Fatto un clone con `--depth 1` di questo
repository:

```
commit scaricati in locale: 1
clone superficiale:         true
rami che il locale conosce: 2
git ls-remote --heads origin → 13 rami
```

⚠️ **La ragione sta nel codice**: `ramiVivi()` chiama `git ls-remote --heads
origin`, che **interroga il server**, non la storia locale. Un clone
superficiale risponde con tutti i rami esattamente come uno intero.

✅ **E c'è una seconda prova, sul campo**: il giro di pulizia vero del 04/09
alle 08:45 girava nel lavoro `produzione`, che fa `actions/checkout@v4`
**senza** `fetch-depth` — quindi con un clone superficiale — e ha tolto
correttamente **19 anteprime orfane**, dopo aver letto «rami vivi: 13».

🔴 **NON è stata corretta**, e la ragione è di mandato, non di merito: questa
consegna è **solo documentale**, e la frase vive dentro
`.github/workflows/pulizia-cloudflare.yml`, che qui non si tocca. Va corretta
in una proposta a sé, insieme alla decisione se togliere anche il
`fetch-depth: 0` (che oggi non fa danno: costa solo un clone più lungo).

---

## 6 · Cosa resta ad Alessio

* La **conservazione** delle costruzioni oltre le soglie: sua decisione, non
  proposta qui.
* Se togliere la **ripetizione** del controllo sulle credenziali.
* Se aggiungere la voce **«guarda e basta»** al menu.

Co-autore del lavoro: Claude Code. La segnalazione del difetto e la decisione
sui nomi sono di Alessio.
