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

1. Vai su **dash.cloudflare.com** ed entra
2. Colonna a sinistra: **Workers & Pages**
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

Serve per le due pulizie automatiche della sezione 6. La crea Alessio, una
volta sola.

1. In alto a destra nel pannello: **My Profile**
2. Linguetta **API Tokens** → **Create Token**
3. In fondo: **Create Custom Token** → **Get started**
4. Nome: `pulizia deployment`
5. Sotto **Permissions**, dai tre menu a tendina: **Account** ·
   **Cloudflare Pages** · **Edit**
6. Sotto **Account Resources**: il proprio account
7. **Continue to summary** → **Create Token**

🔴 **La chiave compare UNA VOLTA SOLA.** Chiusa la pagina è persa e ne va
fatta un'altra. Va messa subito in Bitwarden.

### Dove va

**Su GitHub**, perché le pulizie automatiche girano lì:
**Settings → Secrets and variables → Actions → New repository secret**, due
segreti:

| Nome | Valore |
|---|---|
| `CLOUDFLARE_API_TOKEN` | la chiave appena creata |
| `CLOUDFLARE_ACCOUNT_ID` | `124e479908976a117d12b1daadde0d97` |

**Sul computer**, se si vuole lanciare la pulizia a mano: si copia
`.env.cloudflare.example` in `.env.cloudflare` e si completa. Quel file è
git-ignored e non entra mai nel repository.

⚠️ **È una chiave che sa cancellare siti**, e ha il solo permesso che le
serve. Vale la regola delle altre: mai nel progetto, mai in chat.

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

Il comando in sola lettura — **non tocca niente**, dice solo cosa c'è:

```bash
npm run cloudflare
```

Stampa quante costruzioni ci sono, quante di produzione, quante anteprime, e
quali toglierebbe. Poi, quando i numeri convincono:

```bash
npm run cloudflare -- --conferma              # tiene le ultime 10 di produzione
npm run cloudflare -- --orfani                # anteprime di rami che non esistono più
npm run cloudflare -- --orfani --conferma     # e le toglie
```

⚠️ **Senza `--conferma` non tocca niente**, come `npm run migra`. Un comando
che cancella non lo fa perché è stato lanciato: lo fa perché qualcuno ha
visto i numeri e ha confermato.

⚠️ **Un'anteprima di cui Cloudflare non sa dire il ramo NON viene toccata**:
«non so da dove viene» non è «viene da un ramo morto». Nel dubbio resta.

---

## 8 · Cosa NON è verificato

🔴 **Nel pannello Cloudflare di Alessio non è mai entrato nessuno da qui.** I
nomi delle voci delle sezioni 3, 4 e 5 sono scritti **come dovrebbero
essere**, non come li ha visti qualcuno: le etichette cambiano ogni tanto e
possono comparire in italiano. Se una voce non si trova, si guarda cosa c'è
davvero invece di cercarla mezz'ora.

🔴 **Le due pulizie automatiche non hanno mai girato per davvero.** La parte
che decide *quali* costruzioni si tolgono è provata da 11 prove automatiche,
e le due protezioni più importanti — non toccare il sito vivo, non
scambiare la produzione per un'anteprima — sono state provate **rompendole
apposta**: tolte, diventa rossa esattamente la prova che le sorveglia. Ma la
telefonata che le cancella davvero **non l'ha mai fatta nessuno**, perché la
chiave non esiste ancora.

✅ **Quello che invece è misurato**: il numero dell'account
(`124e479908976a117d12b1daadde0d97`) e il nome del progetto (`borgo58-app`)
vengono dal collegamento che Cloudflare scrive da sé sulle proposte di
modifica.
