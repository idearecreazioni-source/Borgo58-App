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

## 5 · La chiave per la pulizia

**✅ Questa sezione è scritta su una fotografia della pagina vera** (31/08/2026),
non su come dovrebbe essere. Le altre no — vedi la sezione 9.

Serve per le pulizie automatiche (sezione 6) e per il pulsante (7a). Si fa una
volta sola.

### 5a · Dove si arriva

⚠️ **Non è sotto «My Profile».** È una chiave dell'**account**, non della
persona, e sta in un posto suo:

1. **dash.cloudflare.com** → colonna a sinistra, in fondo: **Manage account**
2. Sotto, la voce **Account API tokens**
3. Pulsante **Create Token**

Indirizzo diretto, se è più comodo:
`https://dash.cloudflare.com/124e479908976a117d12b1daadde0d97/api-tokens/create`

### 5b · 🔴 La pagina si apre con dei permessi GIÀ DENTRO, e sono troppi

Questa è la parte che conta, e non è un dettaglio di forma.

Sotto **Permission policies** compaiono già due riquadri, e nella pagina vera
del 31/08 contenevano:

| riquadro | quanti permessi |
|---|---|
| *All zones in …'s Account* | «AI Audit Read, Access: Apps and Policies Read, Analytics Read» **+41 altri** |
| *Entire …'s Account account* | «AI Gateway Metadata Read, AI Gateway Read, AI Search Metadata Read» **+143 altri** |

Sono **circa 190 permessi di lettura su tutto l'account**. Salvando così, si
crea una chiave che può leggere quasi tutto — domini, sicurezza, analisi,
fatturazione — per fare un lavoro che ha bisogno di **una cosa sola**:
cancellare vecchie costruzioni del sito.

⚠️ **Vanno tolti tutti e due.** Su ogni riquadro c'è il modo di rimuoverlo (un
cestino, una X o un menu sul riquadro stesso). Se un riquadro non si riesce a
togliere, si **modifica** finché non resta solo il permesso qui sotto.

### 5c · L'unico permesso che deve restare

Con **+ Add policy** (o modificando un riquadro esistente), la chiave deve
finire con **una sola** riga:

| campo | valore |
|---|---|
| Ambito (*resource*) | **Entire account** — il proprio account |
| Gruppo | **Cloudflare Pages** |
| Livello | **Edit** |

⚠️ **`Edit` e non `Read`**: la chiave deve poter *cancellare*. Con `Read` la
pulizia leggerebbe l'elenco e fallirebbe al primo tentativo di togliere
qualcosa — e fallirebbe in modo poco chiaro, con un rifiuto di permessi.

### 5d · La scadenza — una scelta, non un dettaglio

Sotto **Token expiration** ci sono: *No expiration · 7 days · 30 days ·
90 days · 1 year · Custom*.

**Consiglio: 1 year.**

- *No expiration* è comodo e crea **una chiave che sa cancellare e non muore
  mai**: se un giorno finisce nel posto sbagliato, non c'è niente che la
  fermi da sé.
- *1 year* costa un gesto fra un anno. ⚠️ **E quando scadrà si farà notare in
  modo rumoroso**, non in silenzio: la pulizia diventerà un riquadro rosso su
  GitHub che dice che la chiave non vale più. Un guasto che si vede è
  accettabile; una chiave eterna no.

Conviene mettersi il promemoria in Agenda lo stesso giorno.

### 5e · Il filtro sugli indirizzi

Sotto **Client IP address filtering**: **lasciare vuoto**.

⚠️ Le pulizie automatiche girano **dai server di GitHub**, che cambiano
indirizzo di continuo. Un filtro le farebbe smettere di funzionare, e il
motivo non sarebbe evidente da nessuna parte.

### 5f · Creare e copiare

In fondo alla pagina: **Continue to summary** → si rilegge il riepilogo (deve
nominare *Cloudflare Pages* e nient'altro) → **Create Token**.

🔴 **LA CHIAVE COMPARE UNA VOLTA SOLA.** Chiusa la pagina è persa e ne va
fatta un'altra. Va messa **subito** in Bitwarden.

### 5g · Dove va la chiave

**Su GitHub**, perché le pulizie automatiche e il pulsante girano lì:
**Settings → Secrets and variables → Actions → New repository secret**. Due
segreti:

| Nome | Valore |
|---|---|
| `CLOUDFLARE_API_TOKEN` | la chiave appena creata |
| `CLOUDFLARE_ACCOUNT_ID` | `124e479908976a117d12b1daadde0d97` |

**Sul computer**, solo se si vuole lanciare la pulizia dal terminale: si copia
`.env.cloudflare.example` in `.env.cloudflare` e si completa. Quel file è
git-ignored e non entra mai nel repository.

⚠️ **È una chiave che sa cancellare siti.** Vale la regola delle altre: mai
nel progetto, mai in chat, sempre in Bitwarden.

### 5h · Come si controlla che sia venuta bene

Torna su **Account API tokens**: la riga `pulizia deployment` deve dire
**Cloudflare Pages: Edit** e nient'altro. Se dice «41 permissions» o simili,
è rimasto dentro uno dei due riquadri di partenza: si modifica il token e si
tolgono.

---

## 6 · Le due pulizie automatiche

Vivono in [`.github/workflows/pulizia-cloudflare.yml`](../.github/workflows/pulizia-cloudflare.yml)
e non chiedono niente a nessuno.

| quando | cosa fa |
|---|---|
| **cancelli un ramo su GitHub** | toglie da Cloudflare le anteprime di quel ramo |
| **una pubblicazione nuova su `master`** | lascia **le ultime 10** versioni di produzione |

⚠️ **Perché serviva costruirle**: nessuna delle due esiste come impostazione
di Cloudflare. Non è un limite del piano — quelle manopole non ci sono per
nessuno.

⚠️ **La pulizia dei rami comincia a funzionare solo DOPO che il file è stato
unito a `master`**: GitHub fa girare l'evento «ramo cancellato» dalla copia
che sta sul ramo principale, e non potrebbe fare altrimenti — il ramo, in
quel momento, non c'è più.

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

## 7 · La pulizia del passato, una volta sola

🔴 **Nessuna delle due pulizie automatiche tocca quello che c'è già**:
valgono da quando esistono. *Chiudere il rubinetto non svuota il secchio.*

Tre strade, dalla più comoda alla più faticosa. **Fanno la stessa cosa.**

### 7a · Il pulsante su GitHub — senza terminale

Funziona appena la chiave della sezione 5 è fra i segreti del repository, e
appena questo lavoro è stato unito a `master`.

1. Vai su **https://github.com/idearecreazioni-source/Borgo58-App/actions**
2. Nella colonna a sinistra clicca **Pulizia Cloudflare**
3. A destra compare il pulsante **Run workflow**
4. Si apre un menu a tendina, **Che cosa togliere**:
   - **produzione** → tiene le ultime 10 versioni di `borgo58.it`
   - **orfani** → toglie le anteprime dei rami che su GitHub non esistono più
5. **Run workflow**, e in un minuto è fatto

⚠️ Lanciale **una per volta**: sono due pulizie diverse.

### 7b · Il comando, dal computer di Alessio

Serve `.env.cloudflare` completato (sezione 5). Il comando **in sola lettura**
non tocca niente e dice solo cosa c'è:

```bash
npm run cloudflare
```

Stampa quante costruzioni ci sono, quante di produzione, quante anteprime, e
quali toglierebbe. Poi, quando i numeri convincono:

```bash
npm run cloudflare -- --conferma              # tiene le ultime 10 di produzione
npm run cloudflare -- --orfani                # cosa toglierebbe fra le anteprime
npm run cloudflare -- --orfani --conferma     # e le toglie
```

⚠️ **Senza `--conferma` non tocca niente**, come `npm run migra`. Un comando
che cancella non lo fa perché è stato lanciato: lo fa perché qualcuno ha
visto i numeri e ha confermato.

### 7c · A mano dal pannello — se la chiave non c'è ancora

È l'unica strada che non richiede nessuna chiave, e va bene finché le righe
sono poche.

1. **dash.cloudflare.com** → **Compute** → **Workers & Pages** → **borgo58-app**
2. Linguetta **Deployments** (*Distribuzioni*)
3. Ogni riga è una costruzione, con accanto il ramo da cui è nata e
   un'etichetta: **Production** oppure **Preview**
4. 🔴 **Le righe Production NON si toccano**: sono `borgo58.it`, presente e
   passato
5. Sulle righe **Preview**, il pulsante coi **tre puntini** a fine riga →
   **Delete deployment**

⚠️ **Non c'è nessun pulsante «cancellale tutte»**: si fa una riga per volta.
Con quattro o cinque righe sono due minuti; è esattamente il motivo per cui
esistono la 7a e la 7b.

⚠️ **Un'anteprima di cui Cloudflare non sa dire il ramo non viene toccata**
dalle strade automatiche: «non so da dove viene» non è «viene da un ramo
morto». Nel dubbio resta, e si guarda a mano.

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
