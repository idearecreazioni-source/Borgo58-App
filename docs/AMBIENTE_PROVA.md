# Il database di prova — guida operativa

**A chi serve**: ad Alessio. Documento del 10/08/2026.

---

## 0. Perché serve un secondo database

Oggi c'è un database solo, ed è quello del locale. Vuol dire due cose:

- le **prove automatiche** (`npm run test:app`) scrivono e cancellano nel
  database vero. Finora sono state pulite perché scritte con attenzione —
  cioè per disciplina, non per costruzione;
- ogni **migrazione** viene provata per la prima volta direttamente in
  produzione. Se fa un danno, lo fa sui dati veri.

Il progetto di prova è la rete sotto il filo: un secondo database, vuoto,
ricostruibile da zero in pochi minuti, dove si può anche rompere tutto.

**Costa zero**: il piano gratuito di Supabase permette **2 progetti
attivi** per organizzazione. Attenzione a una cosa sola: un progetto
gratuito **va in pausa dopo una settimana** che non lo si usa — se un
giorno le prove non partono, è probabile che vada semplicemente riavviato
dal pannello.

---

## 1. Creare il progetto (una volta sola)

1. Vai su **supabase.com**, entra nel tuo account e clicca **New project**.
2. Nome: **`Borgo58-Prova`**.
3. **Database Password**: clicca *Generate a password*, poi **copiala
   subito nel tuo gestore di password**. Serve ai comandi di prova.
4. **Region**: la stessa del progetto vero — **EU (Ireland)**.
5. Plan: **Free**. Clicca **Create new project** e aspetta qualche minuto.

---

## 2. Creare i quattro utenti

Il database di prova deve avere le stesse persone del vero, altrimenti le
migrazioni non possono verificarsi: molte si controllano da sole
impersonando un titolare e un membro dello staff.

Nel progetto **Borgo58-Prova**: **Authentication → Users → Add user →
Create new user**, quattro volte, con questi indirizzi:

| Indirizzo | A cosa serve |
|---|---|
| `alessio@borgo58.app` | il titolare |
| `staff@borgo58.app` | lo staff |
| `test-titolare@borgo58.app` | il titolare delle prove automatiche |
| `test-staff@borgo58.app` | lo staff delle prove automatiche |

Le password le scegli tu e **non devono essere quelle vere**: questo è un
database usa-e-getta. Quelle dei due utenti `test-` vanno scritte nel file
`.env` (punto 3).

Spunta **Auto Confirm User** su tutti e quattro.

---

## 3. Completare le chiavi

Fai una copia di `.env.example` chiamata **`.env`** e riempi le righe del
progetto di prova. Sono **tre**, e le prime due non vanno confuse con la
terza:

- **`PROVA_SUPABASE_URL`** — **Settings → Data API → Project URL**. È un
  indirizzo, comincia per `https://`.
- **`PROVA_SUPABASE_ANON_KEY`** — **Settings → API Keys** → la chiave
  **`anon`**.
- **`DB_URL_PROVA`** — **Connect → Session pooler**: copia la riga
  `postgresql://...` e sostituisci `[YOUR-PASSWORD]` con la password del
  punto 1.

Più le password dei due utenti `test-` del punto 2.

🔴 **`PROVA_SUPABASE_URL` e `DB_URL_PROVA` descrivono lo stesso progetto e
non sono la stessa cosa** — il primo è la porta da cui entra il gestionale,
il secondo è il collegamento diretto al database e **contiene una
password**. Da fuori si somigliano: portano tutti e due il riferimento del
progetto. Il 31/08/2026 la seconda è finita al posto della prima nei
segreti di GitHub, e il giro dei controlli è morto sei minuti dopo con
sessantasette file falliti e un messaggio che non nominava la causa.

⚠️ **Su GitHub `PROVA_SUPABASE_URL` non serve**: il giro dei controlli
ricava l'indirizzo del progetto di prova da `REF_PROVA` in
`scripts/comune.mjs`, che è già in chiaro. Nei Secrets vanno solo la chiave
`anon` e i due PIN degli utenti di collaudo — vedi `docs/CI.md` §3a. Qui in
`.env` la riga serve invece a `npm run dev:prova` e agli altri comandi, e va
compilata.

⚠️ **Adesso c'è un controllo che lo dice subito**: `npm run test:app` (e la
pipeline) lanciano `node scripts/chiavi-di-prova.mjs` prima di far partire
qualunque prova. Si ferma se una delle sei caselle manca, se l'indirizzo non
comincia per `https://`, se è una stringa `postgresql://` e se è il progetto
del **locale vero**. Nel messaggio finisce il **nome** della casella, mai il
valore.

---

## 4. Ricostruire il database da zero

```bash
npm run prova:ricostruisci
```

Il comando applica, in ordine di data, **tutte le migrazioni del
progetto** — le stesse 49 che hanno costruito il database vero. Ci mette
qualche minuto e stampa una riga per migrazione.

Se una si ferma, il comando si ferma con lei, scrive un file
`ricostruzione_<data>.log` nella cartella del progetto e te lo dice:
**manda quel file a Claude Code così com'è**. Non è un guasto del tuo
computer: vuol dire che quella migrazione dava per scontato qualcosa che
esisteva solo nel database vero, ed è esattamente la cosa che questo
esercizio serve a scoprire.

Alla fine deve dire quante tabelle ha creato, quante migrazioni ha
registrato e quanti ruoli ha assegnato.

Per rifarlo da capo su un progetto non più vuoto:
`npm run prova:ricostruisci -- --azzera` (svuota e ricomincia).

---

## 4bis. Lo stato di partenza (dal 16/08/2026)

Un database di prova **vuoto** è un database che dice sempre di sì. Tre
difetti veri di agosto hanno avuto tutti la stessa forma: la prova girava
su uno stato di partenza diverso da quello vero *esattamente nel punto
rilevante*, quindi passava verde — il valore predefinito che rispondeva al
posto dell'utente (14/08), la colonna nuova senza righe da sanare (15/08),
la verifica del vitto che saltava proprio la parte che in produzione
sarebbe scattata (16/08).

```bash
npm run prova:base
```

Costruisce poche righe vere: un fornitore, un ingrediente con giacenza e
storico prezzi, una ricetta, un menu attivo, **un conto aperto → mandato in
cucina → chiuso e pagato**, un movimento di prima nota, una fattura da
pagare, un ricevimento non conforme, una prenotazione.

Tre cose da sapere:

1. **È costruito chiamando le funzioni vere dell'app**, non con `insert`
   scritti a mano. Se domani un'operazione cambia, questo comando o si
   aggiorna da solo o **smette di funzionare e lo si vede subito**. È anche
   una prova: se un giorno fallisce, la prima ipotesi non è che sia rotto
   lui. *(Ha già trovato un difetto vero il giorno stesso: nessuno poteva
   marcare una ricetta «pronta per carta».)*
2. **Tutto si chiama `BASE-…`** e si butta senza pensarci:
   `npm run prova:base -- --rifai`. `npm run prova:ricostruisci` lo rimette
   da sé alla fine.
3. **Non copre tutto**, e non finge di farlo:

   ```bash
   npm run prova:stato
   ```

   elenca le tabelle che nel locale vero hanno dei dati e sulla prova sono
   ancora vuote. L'elenco **si ricava dal locale vero a ogni esecuzione**:
   man mano che il locale si riempie, chiede di più da solo.

---

## 4ter. Aprire il gestionale sul progetto di prova

```bash
npm run dev:prova
```

Apre lo stesso gestionale collegato al progetto di prova. `.env` non
si tocca: `npm run dev` continua ad aprire il locale vero, e non c'è niente
da rimettere a posto dopo.

⚠️ **Come si capisce dove si sta scrivendo**, senza aprire nessun file:

- sul **progetto di prova** c'è una **fascia rossa in cima a ogni
  schermata**: «DATABASE DI PROVA — quello che scrivi qui non è vero»;
- sul **locale vero** c'è una **targhetta grigia in basso a sinistra**:
  «dati veri».

Si dichiara in tutte e due le direzioni apposta. Un avviso che comparisse
solo sulla prova proteggerebbe soltanto chi si ricorda che quell'avviso
esiste — e il caso pericoloso è l'altro: **stare sul locale vero credendo
di stare sulla prova** e riempirlo di dati finti. Una riga finta
indistinguibile da una vera toglie fiducia a tutto quello che il gestionale
dice.

---

## 5. Da adesso in poi: due regole

1. **Le prove automatiche girano qui.** `npm run test:app` usa
   `.env`, che punta al progetto di prova. Se qualcuno ci rimettesse
   l'indirizzo del database vero, le prove **si rifiutano di partire**: il
   controllo è dentro il codice, non affidato alla memoria.
2. **Ogni migrazione si applica prima qui, poi in produzione.**

   ```bash
   npm run prova:migra
   ```

   Applica quelle che mancano. Con un nome (`npm run prova:migra --
   20260815000002`) ne riapplica una sola anche se è già passata: è così
   che si dimostra che è **idempotente**, cioè che premere Run due volte
   non fa danni.

   Solo dopo, in produzione: `npm run migra -- --conferma`, che si rifiuta
   di partire se non ha visto la migrazione passare **prima** da qui.

   *Fino al 15/08/2026 questo paragrafo diceva di incollare il file
   nell'SQL Editor del progetto di prova. Era rimasto l'unico anello
   manuale della catena — ed era anche il più ripetuto, perché una
   migrazione si applica alla prova molte volte. È lo stesso gesto che il
   12/08 è arrivato troncato a metà e ha fatto cambiare la regola su chi
   applica le migrazioni: la rete di sicurezza serve solo se usarla non
   costa più di saltarla.*

---

## 6. Cosa il progetto di prova NON riproduce

Onesto elenco, per non dare per verificato ciò che non lo è:

- **Le funzioni online (Edge Function) non sono installate qui**, e finché
  restano fuori **tre prove automatiche non girano**: quelle sul corridoio,
  la strada obbligata di ogni operazione che tocca più tabelle insieme. Non
  vengono nascoste: `npm run test:app` le salta e una riga resta **rossa**
  apposta, così nessuno dimentica che quella parte non è coperta.
  Come chiudere il buco, dal pannello del progetto di prova:
  1. **Edge Functions → Deploy a new function → Via Editor**;
  2. nome esatto: `operazioni-atomiche`;
  3. incolla il contenuto di `supabase/functions/operazioni-atomiche/index.ts`
     e premi **Deploy**. Non servono chiavi: usa quelle che Supabase dà da sé.
- Le notifiche Telegram partite per sbaglio dal progetto di prova finiscono
  contro la funzione vera e vengono **respinte**: la parola d'ordine del
  progetto di prova è generata diversa apposta. Nessuna notifica di prova
  arriva sul telefono.
- **L'archivio documenti nasce vuoto**: i file caricati vivono fuori dal
  database e si recuperano solo da una copia di sicurezza.
- **I dati del locale non ci sono** (orari, tavoli, menù): le migrazioni
  creano le tabelle, non i tuoi numeri. Se una prova ha bisogno di orari,
  se li crea da sola e li ripulisce. Dal 16/08 `npm run prova:base` mette
  uno **stato di partenza minimo**, che non è la stessa cosa dei tuoi dati:
  `npm run prova:stato` dice sempre cosa manca ancora.
- **La posta, l'assistente e le previsioni non ci sono**: `posta_ricevuta`,
  `posta_azioni`, `documents`, `domande_archivio` e le tabelle degli
  scenari restano vuote. Sono i **dati di collaudo**, che si preparano a
  parte — lo stato di partenza è un'altra cosa e più piccola.
