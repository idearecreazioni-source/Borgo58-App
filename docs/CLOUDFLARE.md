# Cloudflare, spiegato e configurato

**Scritto il 31/08/2026.** Guida per Alessio: cosa deve fare lui, click per
click, e cosa fa il gestionale da sé.

---

## 1 · Il quadro, in tre frasi

`borgo58.it` non è un programma acceso da qualche parte: è **un pacchetto di
file** che Cloudflare ricostruisce ogni volta che qualcosa cambia nel
progetto.

E Cloudflare non ricostruisce solo la versione ufficiale: **costruisce anche
ogni ramo di lavoro**, e a ognuno dà un indirizzo internet suo — così si può
guardare un lavoro *prima* di approvarlo.

⚠️ **Quelle costruzioni non se ne vanno mai da sole.** Cloudflare non ha
nessuna impostazione di conservazione, e dal pannello si cancella una riga
alla volta. Questa pagina serve a mettere ordine in tutte e due le cose: **a
quale database parlano** e **quante ne restano**.

---

## 2 · 🔴 Il problema che ha fatto nascere questa pagina

Misurato il 31/08/2026 scaricando davvero il pacchetto servito
dall'indirizzo di un ramo:

```
$ grep -oE 'https://[a-z0-9-]+\.supabase\.co' index-C49JFs-d.js | sort | uniq -c
      3 https://oudjuqbqszisdtwzbxdo.supabase.co
```

Quel riferimento è **il gestionale vero**. Cioè: esisteva un indirizzo
pubblico del gestionale collegato ai dati veri del locale.

**Cosa NON era**, perché non si scambi per più grave di quello che è: non era
una fuga di chiavi. Quel collegamento è lo stesso che sta già dentro
`borgo58.it`, è pubblico per come è fatto il sistema, e a proteggere i dati è
la RLS. E chi apre quell'indirizzo trova la richiesta del PIN.

**Cosa era davvero.** Il rischio non è uno sconosciuto: è **chi ha il PIN**.
Dal 31/08 ogni lavoro sta su un ramo, e ogni ramo ha il suo indirizzo. Aprire
l'indirizzo di un lavoro **non finito** e provarci due gesti — un conto, una
spesa — scrive nel gestionale **vero**. La striscia «DATI VERI» avvisa; il
meccanismo non lo impedisce.

**La cura è la sezione 4**, e toglie il problema alla radice invece di
appoggiarsi al fatto che qualcuno legga un avviso.

---

## 3 · Parte A · La produzione è agganciata a `master`?

⚠️ **«Workers & Pages» NON è una voce della barra laterale** — misurato il
31/08 su una fotografia del pannello vero. La barra ha *Account home ·
Recents · Domains · Observe · Build · Protect & connect · Manage account*, e
il progetto sta dentro **Build → Compute → Workers & Pages**.
*Cloudflare rinomina le sue voci: se un giorno non si trova, si cerca il nome
del progetto invece del nome del menu.*

1. Vai su **dash.cloudflare.com** ed entra
2. Colonna a sinistra, sezione **Build** → **Compute** → **Workers & Pages**
3. Clicca sul progetto **borgo58-app**
4. In alto, linguetta **Settings**
5. Sezione **Builds & deployments** (*Compilazioni e distribuzioni*)
6. Voce **Production branch** (*Ramo di produzione*)

**Deve dire `master`.** Se lo dice già, non toccare niente.

---

## 4 · Parte B · Le due famiglie di variabili ← **la parte che conta**

Cloudflare tiene **due elenchi separati** di variabili, e li usa in due
momenti diversi:

| elenco | quando lo usa |
|---|---|
| **Production** | solo quando costruisce `master`, cioè `borgo58.it` |
| **Preview** | per **tutti gli altri rami** |

Il secondo oggi è vuoto o uguale al primo, ed è **esattamente per questo** che
l'anteprima di un ramo parlava col gestionale vero.

### Come si fa

1. Dentro **borgo58-app** → **Settings**
2. Sezione **Variables and Secrets** (o **Environment variables**)
3. Ci sono due riquadri, o un interruttore fra **Production** e **Preview**

**Production** — guarda e basta, non toccare:

| Nome | Valore |
|---|---|
| `VITE_SUPABASE_URL` | l'indirizzo del **locale vero** |
| `VITE_SUPABASE_ANON_KEY` | la chiave del **locale vero** |
| `NODE_VERSION` | `22.16.0` |

**Preview** — aggiungi queste tre col pulsante **Add variable**:

| Nome | Valore |
|---|---|
| `VITE_SUPABASE_URL` | l'indirizzo del **progetto di prova** |
| `VITE_SUPABASE_ANON_KEY` | la chiave del **progetto di prova** |
| `NODE_VERSION` | `22.16.0` |

4. **Save** in fondo

I due valori di prova sono gli stessi che stanno in `.env.test` sul computer
di Alessio, righe `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.

### ⚠️ Tre avvertenze, e la terza è quella che frega

1. **`NODE_VERSION` va messa anche in Preview.** Non è un doppione: le due
   famiglie non si passano niente. Se manca, i rami vengono costruiti con una
   versione di Node più vecchia e **la compilazione fallisce** (Vite 8
   pretende `^20.19 || >=22.12`).

2. **I nomi sono identici nei due riquadri**, cambia solo il valore. Nessun
   `PROVA_` davanti: quello serve sui segreti di GitHub, qui no.

3. 🔴 **Le anteprime già costruite NON cambiano.** Quelle variabili valgono da
   lì in avanti: un sito già costruito ha l'indirizzo vecchio cotto dentro.
   Un ramo continua a parlare col gestionale vero **finché non viene
   ricostruito o cancellato**. Per ricostruirlo basta un commit nuovo sul
   ramo.

---

## 5 · La chiave per la pulizia — passo per passo

**✅ Scritto su due fotografie del pannello vero** (31/08/2026). Le voci qui
sotto sono **copiate letteralmente** dallo schermo, in inglese come compaiono.
Dove una schermata non è stata vista, è detto — e non è stata indovinata.

### Passo 1 · Arrivare alla pagina giusta

⚠️ **Non è sotto «My Profile».** È una chiave dell'**account**:

1. **dash.cloudflare.com**
2. Colonna a sinistra, **in fondo**: la sezione **Manage account**
3. Dentro, la voce **Account API tokens**
4. Il pulsante **Create Token**

In cima alla pagina si legge il percorso: **Account API tokens › Create a token**.

Indirizzo diretto, se è più comodo:
`https://dash.cloudflare.com/124e479908976a117d12b1daadde0d97/api-tokens/create`

### Passo 2 · Il nome

Nel riquadro **Token name**, scrivere:

```
pulizia deployment
```

### Passo 3 · 🔴 I permessi — il passo dove si sbaglia

Sotto **Permission policies** compare una griglia di **modelli**. Questi, con
i loro numeri esatti:

| colonna sinistra | | colonna destra | |
|---|---|---|---|
| Create Account Tokens | 1 | Developer Services | 19 |
| Edit Cloudflare Workers | 11 | Edit load balancers | 2 |
| Edit zone DNS | 1 | Network Services | 5 |
| **Read all resources** | **190** | Read analytics | 4 |
| Read billing | 1 | Read Radar | 1 |
| Security | 5 | Stream and Images | 5 |
| WordPress | 6 | Workers AI | 2 |
| **Write all resources** | **166** | Zero Trust | 5 |
| Zone Administration | 6 | **Start from scratch** | *Build a custom permission policy* |

🔴 **Nessuno di questi modelli è quello giusto.** Non esiste un modello
«Cloudflare Pages»: il più vicino, *Edit Cloudflare Workers*, dà 11 permessi
che non c'entrano.

🔴 **E «Read all resources» è la trappola in cui si è già caduti**: applicato,
riempie la pagina con **190 permessi** divisi in due riquadri — uno da 44 sui
domini («All zones in …'s Account») e uno da 146 sull'account intero
(«Entire …'s Account account»). 44 + 146 = 190. Salvando così si crea una
chiave che legge quasi tutto l'account per fare un lavoro che ha bisogno di
**una cosa sola**.

**Va scelta l'ultima voce in basso a destra, quella col segno +:**

> **Start from scratch** — *Build a custom permission policy*

⚠️ **Se nella pagina ci sono già dei riquadri di permessi** (perché un modello
era stato applicato prima), il modo sicuro di ripartire puliti è **ricaricare
la pagina di creazione** dall'indirizzo qui sopra: il modulo torna vuoto e non
serve sapere come si toglie un riquadro.

### Passo 4 · Il permesso — **uno solo, ed è questo**

Dopo **Start from scratch** compare l'elenco dei permessi, diviso in gruppi
(*Developer Platform · AI & Machine Learning · DNS & Zones · App Security ·
Rules & Configuration · Cloudflare One / Zero Trust · Analytics & Logs ·
Network Services · Media · Email & Messaging · Cache & Performance ·
Account & Billing · Other*), ognuno con un contatore tipo `0/51`.

**Nel gruppo `Developer Platform`, la voce da accendere è:**

> **Pages** — *«Grants write access to Cloudflare Pages»*
> livelli: **Read** · **Edit** → **scegliere `Edit`**

**E basta. Tutti gli altri gruppi restano a `0`.**

⚠️ **`Edit` e non `Read`**: la chiave deve poter *cancellare*. Con `Read` la
pulizia leggerebbe l'elenco e fallirebbe al primo tentativo di togliere
qualcosa.

⚠️ **La voce si chiama `Pages`, non «Cloudflare Pages»**, ed è dentro
*Developer Platform*. Nello stesso gruppo ci sono **Workers Scripts**,
**Workers CI**, **Workers Containers**, **Workers KV Storage** e altre due
dozzine di voci che le somigliano e **non c'entrano niente**.

⚠️ **Se il contatore di `Developer Platform` dice più di quanto ti aspetti**,
è probabile che siano accesi sia *Read* sia *Edit* sulla stessa voce: non è
un errore, ma `Edit` da solo basta.

### Passo 5 · La scadenza

Sotto **Token expiration** ci sono, esattamente: **No expiration · 7 days ·
30 days · 90 days · 1 year · Custom**.

**Scegliere `1 year`.**

- *No expiration* crea **una chiave che sa cancellare e non muore mai**: se un
  giorno finisce nel posto sbagliato, niente la ferma da sé.
- *1 year* costa un gesto fra un anno, ⚠️ **e quando scadrà si farà notare in
  modo rumoroso**: la pulizia diventerà un riquadro rosso su GitHub che dice
  che la chiave non vale più. Un guasto che si vede è accettabile; una chiave
  eterna no.

Conviene metterselo in Agenda lo stesso giorno.

### Passo 6 · Il filtro sugli indirizzi

Sotto **Client IP address filtering** c'è un menu **Allow** e un campo
*«Enter an IP address or CIDR range…»*.

**Lasciare tutto vuoto.** ⚠️ Le pulizie automatiche girano **dai server di
GitHub**, che cambiano indirizzo di continuo: un filtro le farebbe smettere di
funzionare, e il motivo non si vedrebbe da nessuna parte.

### Passo 7 · Creare, e copiare subito

In fondo alla pagina: **Continue to summary** → si rilegge il riepilogo, che
deve nominare **Cloudflare Pages** e nient'altro → **Create Token**.

🔴 **LA CHIAVE COMPARE UNA VOLTA SOLA.** Chiusa la pagina è persa e ne va
fatta un'altra. **Va messa subito in Bitwarden.**

### Passo 8 · Controllare che sia venuta bene

Tornare su **Account API tokens**: la riga `pulizia deployment` deve dire
**Cloudflare Pages** e basta. Se dice *190 permissions*, o nomina zone,
analytics o billing, è rimasto dentro un modello: si cancella il token e si
rifà dal passo 1.

### Passo 9 · Dove va la chiave

**Su GitHub**, perché le pulizie automatiche e il pulsante girano lì:
**Settings → Secrets and variables → Actions → New repository secret**. Due
segreti:

| Nome | Valore |
|---|---|
| `CLOUDFLARE_API_TOKEN` | la chiave appena creata |
| `CLOUDFLARE_ACCOUNT_ID` | `124e479908976a117d12b1daadde0d97` |

**Sul computer**, solo per lanciare la pulizia dal terminale: si copia
`.env.cloudflare.example` in `.env.cloudflare` e si completa. Quel file è
git-ignored e non entra mai nel repository.

⚠️ **È una chiave che sa cancellare siti.** Mai nel progetto, mai in chat,
sempre in Bitwarden.

---

## 6 · Le due pulizie automatiche

Vivono in [`.github/workflows/pulizia-cloudflare.yml`](../.github/workflows/pulizia-cloudflare.yml)
e non chiedono niente a nessuno.

| quando | cosa fa |
|---|---|
| **cancelli un ramo su GitHub** | toglie da Cloudflare le anteprime di quel ramo |
| **una pubblicazione nuova su `master`** | lascia **le ultime 10** versioni di produzione **e le ultime 2 anteprime di ogni ramo** |

⚠️ **Perché serviva costruirle**: nessuna delle due esiste come impostazione
di Cloudflare. Non è un limite del piano — quelle manopole non ci sono per
nessuno.

⚠️ **La pulizia dei rami comincia a funzionare solo DOPO che il file è stato
unito a `master`**: GitHub fa girare l'evento «ramo cancellato» dalla copia
che sta sul ramo principale, e non potrebbe fare altrimenti — il ramo, in
quel momento, non c'è più.

⚠️ **Due anteprime per ramo, e «per ramo» è la parte che conta** (deciso da
Alessio il 31/08). Un tetto complessivo farebbe sparire l'anteprima di un ramo
poco toccato solo perché su un altro si è lavorato molto; due per ramo vuol
dire *quella di adesso, e quella di prima per confronto*. Il numero vive in
`scripts/cloudflare.mjs` (`ANTEPRIME_PER_RAMO`), con una prova che diventa
rossa se qualcuno contasse tutte insieme invece che per ramo.

⚠️ **Dieci versioni di produzione è una decisione, non un numero tecnico**: le
versioni vecchie sono anche il modo di **tornare indietro** se una
pubblicazione va male. Il numero vive in `scripts/cloudflare.mjs`
(`PRODUZIONI_DA_TENERE`), in un posto solo, con una prova che lo congela.

⚠️ **La versione che in questo momento serve `borgo58.it` non viene mai
toccata**, e non perché «di solito è la più recente» — che è un'ipotesi
sull'ordinamento, non una garanzia. Si chiede a Cloudflare quale sia, e la si
esclude prima di qualunque conto. Il caso in cui le due cose non coincidono
esiste davvero: dopo un ritorno indietro a una versione precedente.

---

## 7 · La pulizia del passato

### 🔴 I numeri veri, letti da dentro GitHub il 31/08/2026

```
costruzioni in tutto     381
di produzione            369
anteprime dei rami       12  (su 2 rami)
quella che serve il sito a4b20e70

Da togliere: 367
```

**Le costruzioni che si accumulano sono quelle di PRODUZIONE**, una per ogni
push su `master` dall'8 agosto. Le anteprime dei rami sono **12**, su due soli
rami — le due proposte aperte.

⚠️ **Questa pagina ha detto due cose sbagliate su questo numero, in ordine.**
Prima «circa 7 anteprime», stimate su quello che si era visto passare in una
sessione. Poi «375 anteprime», che era il totale letto a occhio dal pannello
**senza distinguere produzione da anteprima**. Il numero giusto lo ha detto la
macchina, interrogata: *l'unico modo di sapere quante sono è chiederlo, e
finché non lo si chiede ogni risposta è un'opinione.*

### 🔴 E la pulizia dei rami spariti non toglie NIENTE

Misurato nello stesso giro: **«Niente da togliere»**, rami vivi 3.

Era la domanda aperta di questa pagina — *«se quelle righe portano il nome di
un ramo ancora vivo, `--orfani` non ne toglie nessuna»* — e la risposta è
esattamente quella. Non è un difetto: è la regola applicata a dati diversi da
quelli che ci si aspettava.

**A fare il lavoro è la conservazione**, e l'aritmetica torna:
369 − 10 = **359** di produzione, più 12 − (2 rami × 2) = **8** anteprime →
**367**.

⚠️ **E qui c'è una conseguenza da guardare in faccia**: togliere 359
costruzioni di produzione vuol dire **rinunciare a 359 punti di ritorno**. Le
ultime 10 restano, e per come si lavora qui sono molte — ma è una scelta, non
un'operazione di ordine.

### 7a · Il pulsante su GitHub — la strada normale

Funziona appena la chiave della sezione 5 è fra i segreti del repository, e
appena questo lavoro è stato unito a `master`.

1. **https://github.com/idearecreazioni-source/Borgo58-App/actions**
2. Colonna a sinistra: **Pulizia Cloudflare**
3. Pulsante **Run workflow**
4. Menu **Che cosa togliere**:
   - **orfani** → le anteprime dei rami che su GitHub non esistono più
   - **produzione** → tiene le ultime 10 versioni di `borgo58.it`
5. **Run workflow**

⚠️ Una per volta: sono due pulizie diverse.

### 7b · Il comando, dal computer

Serve `.env.cloudflare` completato. **In sola lettura non tocca niente** ed è
il modo giusto di cominciare, perché stampa i numeri veri prima di qualunque
gesto:

```bash
npm run cloudflare                            # quante ce ne sono, e quali toglierebbe
npm run cloudflare -- --orfani                # cosa toglierebbe fra le anteprime
npm run cloudflare -- --orfani --conferma     # e le toglie
npm run cloudflare -- --conferma              # tiene le ultime 10 di produzione
```

### 7c · Cosa succede davvero su centinaia di righe

Tre cose sono state messe **per quel numero**, non in generale:

- **Non stampa 375 righe**: ne mostra 15 come campione e scrive il totale in
  fondo. *Un elenco che non entra nello schermo è rumore in cui il numero che
  conta si perde.*
- **Riprova sul limite di Cloudflare.** Centinaia di chiamate di fila fanno
  scattare il «troppe richieste» (429): senza, la pulizia si fermerebbe a
  metà. Riprova aspettando, fino a cinque volte. ⚠️ Solo su 429 e sui guasti
  del server: un «non hai il permesso» si dichiara subito, perché riprovarlo
  dieci volte non lo fa diventare vero.
- **Dice a che punto è**, ogni 25 righe, invece di elencarle una per una.
- ⚠️ **Si può interrompere e rilanciare**: riparte da quello che resta.

### 7d · 🔴 Una domanda ancora senza risposta

**Non è ancora chiaro da dove vengano 375 anteprime**, e la cosa non è
oziosa: fino al 31/08 il lavoro andava tutto su `master`, che è la
*produzione* — quindi dei rami di lavoro non dovrebbero esserci quasi
tracce.

⚠️ **E la risposta decide se la pulizia funziona.** Il comando `--orfani`
toglie le anteprime dei **rami che su GitHub non esistono più**. Se quelle
375 righe portano il nome di rami spariti, le prende tutte. Se invece
portano un nome che esiste ancora — `master` compreso — **non ne toglie
nessuna, e non sarebbe un difetto: sarebbe la regola che fa il suo lavoro su
dati diversi da quelli previsti.**

**Prima di lanciare la pulizia va guardato che nome portano quelle righe.**
Lo dice `npm run cloudflare` in sola lettura, o si legge nella colonna del
ramo nella pagina **Deployments**.

---

## 8 · 🔴 Cosa è misurato e cosa no — sezione per sezione

Questa pagina è nata scritta **su come il pannello dovrebbe essere**, e
Alessio l'ha smentita in due punti nel giro di un'ora. Da qui in avanti ogni
sezione dichiara su cosa poggia, perché *una guida che sbaglia un nome fa
perdere mezz'ora a cercare una voce che non esiste*.

| sezione | su cosa poggia |
|---|---|
| 1-2 · il quadro e il problema | ✅ **misurato**: pacchetto scaricato dall'anteprima, riferimento del gestionale vero trovato dentro |
| 3-4 · produzione e variabili | 🟡 **il percorso sì** (fotografia della barra laterale), **i nomi dentro le pagine no** |
| 5 · la chiave | ✅ **misurato**: scritto su una fotografia della pagina vera del 31/08 |
| 6 · le pulizie automatiche | ✅ il codice e le prove · ❌ **non hanno mai girato per davvero** |
| 7a-7b · pulsante e comando | ✅ esistono e rispondono · ❌ **non hanno mai cancellato niente** |
| 7c · a mano dal pannello | 🟡 **il percorso sì**, l'interno della pagina **Deployments** no |

### I due errori già trovati, tenuti scritti

*Si tengono invece di cancellarli: sono la prova che questa pagina va
verificata sul pannello, non citata.*

1. **«My Profile → API Tokens»** — falso. La chiave è dell'**account** e sta
   in **Manage account → Account API tokens**.
2. **«Workers & Pages» nella barra laterale** — falso. Sta dentro **Build →
   Compute**.
3. **Il passo dei permessi lasciato «non visto» per tre giri.** Non era un
   nome sbagliato: era che *si poteva chiedere la fotografia di quella
   schermata e non è stato fatto*, continuando invece a descrivere un pannello
   mai aperto. La lista dei permessi l'ha dovuta recuperare Alessio.
   ⚠️ **La regola che ne esce**: quando una guida dipende da una schermata che
   chi la scrive non può aprire, la cosa da fare non è scriverla lo stesso con
   un'avvertenza — è **chiedere quella schermata**. Un'avvertenza non rende
   utilizzabile un passo che non si può seguire.
4. **«La pulizia a mano sono due minuti»** — falso, e il peggiore dei tre
   perché era un **consiglio**, non un nome. Le anteprime sono **375**: a
   mano non si fa. La stima era costruita su quello che si era visto passare
   in una sessione, ed è finita in una raccomandazione operativa. *Un numero
   che nessuno ha contato non diventa innocuo perché lo si chiama stima.*

### Cosa resta non verificato, per intero

🔴 **Le due pulizie automatiche non hanno mai girato.** La parte che decide
*quali* costruzioni si tolgono è provata da 11 prove, e le due protezioni più
importanti — non toccare il sito vivo, non scambiare la produzione per
un'anteprima — sono state provate **rompendole apposta**: tolte, diventa rossa
esattamente la prova che le sorveglia. Ma **la telefonata che cancella davvero
non l'ha mai fatta nessuno**, perché la chiave non esiste ancora.

🔴 **Dentro le pagine delle sezioni 3, 4 e 7c non è mai entrato nessuno da
qui.** I nomi dei campi sono quelli attesi. Se non combaciano, **si guarda
cosa c'è davvero e si corregge questa pagina** — non si cerca la voce
mancante per mezz'ora.

✅ **Quello che è misurato con certezza**: il numero dell'account
(`124e479908976a117d12b1daadde0d97`) e il nome del progetto (`borgo58-app`),
che vengono dal collegamento che Cloudflare scrive da sé sulle proposte di
modifica.
