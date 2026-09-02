# Gli indirizzi di accesso escono dal codice — proposta, NON implementata

*Scritta il 02/09/2026, dopo quattro giri di correzioni del validatore.
**Nessuna riga di questo documento è stata realizzata.** Prima di toccare il
codice serve un via esplicito di Alessio.*

---

## Cosa abbiamo rovesciato

- **Cosa era stato deciso e quando**: dal 02/08 gli indirizzi dei due account
  vivono come costanti in `src/context/AuthContext.jsx`, con accanto scritto
  *«gli account vanno creati dalla dashboard Supabase; Claude non gestisce
  credenziali»*.
- **La ragione di allora**: due account e basta, un solo database, nessun
  ambiente separato. Due costanti erano la cosa più semplice che potesse
  funzionare, e ha funzionato per un mese.
- **Cosa si decide adesso**: gli indirizzi diventano configurabili per
  ambiente, con i valori di oggi come predefiniti.
- **Perché la ragione di allora non vale più**: **gli ambienti sono due.**
  Dal 01/09 esiste un'anteprima costruita da GitHub e collegata al progetto
  di prova, e **lo stesso pacchetto** serve l'anteprima e `borgo58.it`.
  Cambiare l'indirizzo per entrare nell'uno cambierebbe anche l'altro.

---

## 1 · Il fatto che la giustifica, misurato

Il 01/09 Alessio ha aperto l'anteprima `prova-di-rilascio.borgo58-app.pages.dev`
e non è potuto entrare. Misurato leggendo il codice, non supposto:

- `src/context/AuthContext.jsx` righe 10-11 hanno **due indirizzi scritti
  dentro**: `alessio@borgo58.app` e `staff@borgo58.app`;
- la schermata prova **solo quei due**, in quell'ordine: il PIN è la password,
  e l'indirizzo non si digita;
- un utente con un indirizzo diverso esisterebbe su Supabase e **la schermata
  non lo chiamerebbe mai**;
- la password di `alessio@borgo58.app` sul progetto di prova **non è scritta
  in nessun file** — `docs/AMBIENTE_PROVA.md` § 2 dice che nel file vanno solo
  le due `test-*` — quindi non esiste un percorso di recupero, solo di
  reimpostazione dal pannello;
- e il pannello Supabase, sulla riga di quell'utente, offre **Send password
  recovery**, che manda un messaggio a una casella che nessuno controlla.

⚠️ **La strada «cambia solo la password dal pannello» è quindi chiusa**, e non
per una scelta: per come è fatta la schermata Users.

---

## 2 · Cosa questa proposta NON fa

| | |
|---|---|
| migrazioni SQL | **nessuna** |
| `auth.users`, `user_roles`, identificativi | **non toccati** |
| password | **mai** — né lette, né scritte, né generate |
| creazione di utenti | **non automatizzata**: resta un gesto dal pannello |
| comportamento della produzione | **invariato senza variabili** — vedi § 3 |

⚠️ **«Invariato» riguarda il COMPORTAMENTO, non i byte.** Il pacchetto
compilato cambia — c'è codice nuovo, gli hash dei file cambiano. Quello che
non cambia è cosa fa la schermata: stessi due indirizzi, stesso ordine, stesso
esito. *Una prima stesura diceva «identico bit per bit», ed era
un'affermazione che nessuno aveva misurato e che è falsa.*

---

## 3 · Il disegno: una sorgente sola, per costruzione

Il difetto della prima stesura era che **validava una cosa e l'app ne leggeva
un'altra**: `vite.config.js` gira in Node e vede `process.env` e i file `.env`;
l'app vede `import.meta.env`, che Vite risolve per conto suo. Due letture che
*dovrebbero* coincidere — e «dovrebbero» è la forma che questo progetto
insegue da settimane.

**La cura non è una prova che confronti le due letture: è togliere la
seconda.**

```js
// vite.config.js
import { defineConfig, loadEnv } from "vite";
import { indirizziDiAccesso, marcatore } from "./scripts/indirizzi-accesso.mjs";

export default defineConfig(({ mode }) => {
  // La stessa fusione che fa Vite: prima i file .env del progetto, poi
  // l'ambiente del processo — che e' da dove arrivano i valori su GitHub.
  const ambiente = { ...loadEnv(mode, process.cwd(), "VITE_"), ...process.env };

  // ⚠️ Si ferma QUI se un valore e' storto: la costruzione fallisce e il
  //    pacchetto rotto non nasce. A runtime vorrebbe dire scoprirlo davanti
  //    alla schermata di accesso, cioe' chiusi fuori.
  const indirizzi = indirizziDiAccesso(ambiente);

  return {
    define: {
      // 🔴 L'app riceve UNA STRINGA GIA' VALIDATA, non la variabile. Non
      //    esiste una seconda lettura che possa divergere: c'e' una sorgente
      //    sola perche' ce n'e' una sola.
      __INDIRIZZI_ACCESSO__: JSON.stringify(marcatore(indirizzi)),
    },
    // …resto invariato
  };
});
```

⚠️ **Un fatto già misurato che regge questo disegno**: una variabile `VITE_*`
passata come `env:` di un passo su GitHub **arriva davvero nel pacchetto**.
Il 01/09 il lavoro `prova_di_rilascio` ha compilato con
`VITE_SUPABASE_URL: ${{ vars.SUPABASE_URL }}` e il pacchetto **servito** su
`prova-di-rilascio.borgo58-app.pages.dev` puntava al progetto di prova,
verificato scaricandolo.

---

## 4 · 🔴 IL CONFINE FRA I MODULI — la parte che va rispettata alla lettera

**Due mondi, e non si toccano.**

### `scripts/indirizzi-accesso.mjs` — **solo Node**

Ci vivono, e **solo** ci vivono:

- `indirizziDiAccesso(env)` — la validazione;
- `marcatore({titolare, staff})` — la codifica;
- `problemaDegliIndirizzi(cartella, attesi)` — **il controllo del pacchetto**,
  che legge `dist/` dal disco con `node:fs`;
- qualunque funzione futura che usi `Buffer`, `node:fs`, `node:path` o
  qualunque altra API di Node.

Lo importano **`vite.config.js`** e **`scripts/rilascio.mjs`**. Nient'altro.

### `src/context/AuthContext.jsx` — **solo browser**

Riceve **soltanto la stringa validata iniettata da `define`**
(`__INDIRIZZI_ACCESSO__`) e la spezza con `decodeURIComponent`, che è una
funzione del linguaggio.

🔴 **`AuthContext.jsx` NON importa `scripts/indirizzi-accesso.mjs`, né oggi né
mai.** Se lo facesse, `node:fs` e `Buffer` finirebbero nel grafo del pacchetto
del browser: nel migliore dei casi la compilazione fallisce, nel peggiore
entra un riempitivo che gonfia il pacchetto e non serve a niente.

⚠️ **E il confine è una PROPRIETÀ da sorvegliare, non una buona intenzione**:
una prova pura legge `AuthContext.jsx` e pretende che non nomini quel modulo.
Diventa rossa il giorno che qualcuno lo importa «solo per riusare una
funzione» — che è esattamente come succederebbe.

### Perché il browser non ha bisogno di nessuna API di Node

**Misurato il 02/09**, non dedotto: `encodeURIComponent` e `decodeURIComponent`
esistono **identiche in Node e nel browser**, e il giro d'andata e ritorno è
esatto anche sui caratteri riservati.

```
alessio@borgo58.app  →  alessio%40borgo58.app   virgola? no   torna uguale? sì
a|b@x.it             →  a%7Cb%40x.it            virgola? no   torna uguale? sì
a:b@x.it             →  a%3Ab%40x.it            virgola? no   torna uguale? sì
a,b@x.it             →  a%2Cb%40x.it            virgola? no   torna uguale? sì
a b@x.it             →  a%20b%40x.it            virgola? no   torna uguale? sì
```

⚠️ **CAMBIO DICHIARATO RISPETTO ALLA VERSIONE PRECEDENTE.** La stesura di ieri
usava `Buffer` e base64url. Con la percentuale non serve **nessun `Buffer`**:
la codifica e la decodifica sono **la stessa funzione** dalle due parti, e il
confine del § 4 diventa più netto invece che più fragile. Il controllo del
pacchetto resta comunque solo-Node, perché legge il disco. *Se preferisci
base64url, il disegno regge lo stesso: cambia una riga e il browser deve
allora convertire a mano `-`/`_` e rimettere il riempimento.*

---

## 5 · La validazione: il vuoto non è l'assenza, e i riservati si rifiutano

```js
// ⚠️ `??` DA SOLO E' SBAGLIATO: `""` non e' nullish, quindi una variabile
//    impostata per sbaglio a vuoto produrrebbe signInWithPassword({email:""}),
//    cioe' un accesso che fallisce sempre senza che nessun errore dica perche'.
export const INDIRIZZI_PREDEFINITI = {
  titolare: "alessio@borgo58.app",
  staff: "staff@borgo58.app",
};

// Allowlist conservativa: niente `|`, `:`, `,`, virgolette, spazi, barre
// rovesce. ⚠️ E' PIU' STRETTA della RFC, apposta: rifiuta qualche indirizzo
// teoricamente legale che nessun sistema vero usa. Il prezzo e' un rifiuto
// visibile a tempo di costruzione; il prezzo opposto sarebbe un marcatore
// spezzato che nessuno vede.
const FORMA = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

export function indirizziDiAccesso(env = {}) {
  const scelto = (v, predefinito, nome) => {
    const t = (v ?? "").trim();
    if (t === "") return predefinito;                       // vuoto = non impostato
    if (!FORMA.test(t))
      throw new Error(`${nome}: «${t}» non e' un indirizzo accettabile. Correggilo o togli la variabile.`);
    return t;
  };
  const titolare = scelto(env.VITE_EMAIL_TITOLARE, INDIRIZZI_PREDEFINITI.titolare, "VITE_EMAIL_TITOLARE");
  const staff = scelto(env.VITE_EMAIL_STAFF, INDIRIZZI_PREDEFINITI.staff, "VITE_EMAIL_STAFF");
  // 🔴 Uguali = il ruolo diventa indecidibile: la schermata prova il primo,
  //    riesce, e chi entra come sala si ritrova titolare.
  if (titolare === staff)
    throw new Error("I due indirizzi non possono coincidere: il PIN non distinguerebbe piu' i ruoli.");
  return { titolare, staff };
}
```

**Due difese indipendenti, e servono entrambe** perché rispondono a domande
diverse: la validazione impedisce **il dato cattivo**, la codifica impedisce
che **un dato qualunque rompa la struttura**. La prima da sola legherebbe la
correttezza del marcatore a una regexp che qualcuno domani potrebbe allargare
per far entrare un indirizzo legittimo — e la romperebbe senza accorgersene.

---

## 6 · Il marcatore, e il controllo del pacchetto

```js
export const MARCA_INDIRIZZI = "borgo58-indirizzi-accesso-v1";

export const marcatore = ({ titolare, staff }) =>
  `${MARCA_INDIRIZZI},${encodeURIComponent(titolare)},${encodeURIComponent(staff)}`;
```

⚠️ **La virgola e' sempre codificata dentro i valori** (misurato sopra):
nessun indirizzo puo' produrre un separatore, qualunque cosa la validazione
lasci passare.

```js
export function problemaDegliIndirizzi(cartella, attesi, leggi = leggiIlCompilato) {
  const testo = leggi(cartella);
  if (testo === null) return "Non c'e' niente di compilato: non c'e' nulla da controllare.";
  const trovati = [...new Set(
    [...testo.matchAll(new RegExp(`${MARCA_INDIRIZZI},([A-Za-z0-9._%~!*'()-]+),([A-Za-z0-9._%~!*'()-]+)`, "g"))]
      .map((m) => `${m[1]},${m[2]}`),
  )];
  if (trovati.length === 0) return "Nel pacchetto non c'e' il marcatore degli indirizzi di accesso: o non e' stato compilato da questa configurazione, o qualcuno ha tolto il `define`.";
  if (trovati.length > 1) return `Nel pacchetto ci sono ${trovati.length} marcatori diversi.`;
  const [t, s] = trovati[0].split(",").map(decodeURIComponent);
  if (t !== attesi.titolare) return `Titolare nel pacchetto «${t}», atteso «${attesi.titolare}».`;
  if (s !== attesi.staff) return `Staff nel pacchetto «${s}», atteso «${attesi.staff}».`;
  return null;
}
```

**Confronta valori esatti, non forme**, e non sa niente di domini — la stesura
di ieri cercava `@borgo58.app` nel pacchetto, quindi un indirizzo su un dominio
diverso sarebbe stato **invisibile al controllo**, che avrebbe approvato senza
aver guardato.

Nel lavoro `pubblica` gli attesi sono i **due predefiniti**: una variabile
impostata per sbaglio sull'ambiente `produzione` **ferma la pubblicazione
prima di Wrangler**. Nel lavoro `anteprima` sono quelli configurati.

🔴 **Limite dichiarato**: che il marcatore sopravviva intatto alla
minificazione di questo progetto **non e' stato misurato** — e' parte della
realizzazione, e le prove **a** e **b** del § 8 sono cio' che lo
dimostrerebbe. Se non sopravvivesse, il controllo direbbe «marcatore assente»
e **fermerebbe**: fallisce chiuso anche sbagliando.

---

## 7 · Provisioning: idempotente, ricostruibile, e senza credenziali

Oggi i quattro utenti sono un elenco fisso in `scripts/prova-ricostruisci.mjs`
e in `docs/AMBIENTE_PROVA.md` § 2. Diventano **derivati dalla
configurazione**:

```js
const { titolare, staff } = indirizziDiAccesso(config);
const UTENTI_RICHIESTI = [titolare, staff, "test-titolare@borgo58.app", "test-staff@borgo58.app"];
```

e l'assegnazione dei ruoli resta della forma che c'e' gia' — **rieseguibile
senza danni**, `on conflict (user_id) do update set role = excluded.role`.

⚠️ **Con una guardia che oggi manca**: se uno degli indirizzi configurati non
esiste in `auth.users`, il comando si ferma **nominando quale**. Senza,
assegnerebbe tre ruoli su quattro e andrebbe avanti: l'utente entrerebbe e il
gestionale non lo riconoscerebbe — il modo silenzioso in cui questo lavoro
fallirebbe.

🔴 **Cosa NON fa, e va detto**: **non crea utenti e non imposta password.**
Creare una riga in `auth.users` significa maneggiare una credenziale, e in
questo progetto non si fa. La creazione resta un gesto di Alessio dal
pannello; lo script **verifica e assegna**.

---

## 8 · Le prove

### Che costruzione e validazione usino la stessa sorgente

Non una prova strutturale sul testo di `vite.config.js` — la forma non e' il
comportamento. **Tre compilazioni vere:**

| | cosa fa | cosa dimostra |
|---|---|---|
| **a** | compila con `VITE_EMAIL_TITOLARE` a un valore valido, legge il marcatore dal pacchetto | il valore nel pacchetto e' **esattamente** quello che `indirizziDiAccesso()` restituisce per quello stesso ambiente |
| **b** | compila di nuovo con un valore **diverso** | il marcatore cambia di conseguenza — se la costruzione leggesse un'altra sorgente, resterebbe fermo |
| **c** | compila con un valore **malformato** | **la costruzione fallisce**, nessun pacchetto prodotto |

⚠️ La **b** e' quella che discrimina: senza, una costruzione che ignorasse le
variabili e scrivesse sempre i predefiniti passerebbe la **a** ogni volta che
il valore configurato coincide col predefinito.

### Sui caratteri riservati

| | valore | atteso |
|---|---|---|
| pura | `a\|b@x.it`, `a:b@x.it`, `a,b@x.it`, `a b@x.it`, `a"b@x.it` | **eccezione** |
| **costruzione vera** | `VITE_EMAIL_TITOLARE="a\|b@x.it"` | **la costruzione FALLISCE** |
| pura | `marcatore()` di un indirizzo con caratteri riservati → riletto → **identico** | la codifica regge **anche su cio' che la validazione respingerebbe** |

### Sul resto

| | cosa prova |
|---|---|
| pura | senza variabili → **esattamente** i due indirizzi di oggi (rossa se qualcuno tocca i predefiniti) |
| pura | variabile a `""` o a soli spazi → **predefinito**, non stringa vuota |
| pura | due indirizzi uguali → eccezione |
| pura | `problemaDegliIndirizzi`: marcatore assente · due marcatori diversi · niente compilato · titolare diverso · staff diverso · caso buono di produzione · caso buono di anteprima |
| **pura, sul confine** | `AuthContext.jsx` **non nomina** `scripts/indirizzi-accesso.mjs` |
| **pura, sul confine** | il modulo solo-Node si carica in un contesto **senza DOM** e risponde |
| sul progetto di prova | accesso riuscito con l'indirizzo configurato **e ruolo letto da `user_roles`** |
| rottura | indirizzo inesistente → «PIN non corretto», non schermata bianca |

---

## 9 · Migrazione e rollback

**Nessuna migrazione SQL.** La «migrazione» e' di sola configurazione:

| ambiente | cosa si imposta | risultato |
|---|---|---|
| **produzione** | **niente** | invariato: `alessio@` / `staff@` |
| **anteprima** | `VITE_EMAIL_TITOLARE`, `VITE_EMAIL_STAFF` | si entra con utenti che Alessio controlla |
| computer locale | facoltativo, in `.env` | come preferisce |

**Rollback**: togliere le due variabili dall'ambiente `anteprima`. Si torna al
comportamento di oggi **senza toccare il codice**, perche' il codice *e'* il
comportamento di oggi quando le variabili non ci sono. Per annullare tutto, un
`revert` del commit: nessun effetto sul database, perche' non ne ha toccato
nessuno.

---

## 10 · Il rischio, e cosa lo chiude

⚠️ **Il rischio e' l'accesso al gestionale vero.** Se qualcuno impostasse
quelle variabili sull'ambiente `produzione` con indirizzi che su quel progetto
non esistono, **Alessio non entrerebbe piu' in `borgo58.it`**.

**Il controllo del § 6 lo chiude**: nel lavoro `pubblica` gli attesi sono i due
predefiniti, quindi la pubblicazione si ferma **prima di Wrangler**. Resta
scoperto solo chi compilasse e caricasse a mano scavalcando la filiera — e per
quello la difesa e' che **la filiera e' una sola**.

Piu' una riga in `docs/CI.md` che dica perche' quelle due caselle, sull'ambiente
`produzione`, devono restare vuote.

---

## 11 · Cosa resta non misurato

- **La sopravvivenza del marcatore alla minificazione** (§ 6).
- **Che `define` si comporti come atteso in questo progetto**: nessun `define`
  personalizzato esiste oggi in `vite.config.js`.
- **Che `vite.config.js` possa importare un modulo del repository**: oggi
  importa solo `node:os`, `vite` e i due plugin — **sarebbe il primo import
  del genere in questo progetto**. Il progetto e' `"type": "module"`, quindi
  l'import ESM dovrebbe funzionare senza artifici, ma **dovrebbe** non e'
  **e' stato provato**.
- **Nessun occhio ha visto** una schermata di accesso costruita cosi'.
