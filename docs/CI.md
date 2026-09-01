# I controlli automatici su GitHub, e come si blocca `master`

**Scritto il 31/08/2026.** Guida per Alessio: cosa deve fare lui, click per
click, e cosa fa il gestionale da sé.

---

## 1 · A cosa serve, in una frase

Fino a oggi le prove giravano **solo sul computer di Alessio**, dentro un
controllo che parte prima di ogni commit. Da adesso girano **anche su
GitHub**, dove nessuno le può saltare — e una modifica che rompe qualcosa
non arriva su `borgo58.it`.

---

## 2 · 🔴 Come va live una modifica, oggi

Serve saperlo per capire dove si inserisce il controllo.

1. Alessio fa `git push` su `master`.
2. **Cloudflare Pages se ne accorge da solo** — è collegato al repository — e
   lancia `npm run build`.
3. I file compilati finiscono sulla rete di Cloudflare, e `borgo58.it` li
   serve. Ci vuole circa un minuto.

⚠️ **Non c'è nessun server acceso**: il gestionale è un pacchetto di file che
il browser scarica e che parla direttamente con Supabase.

⚠️ **E qui sta il buco che questa pagina chiude**: fra il push e il sito
online **non c'era nessun controllo**. Cloudflare compila e pubblica anche
codice che non passa le prove.

---

## 3 · Cosa deve fare Alessio, una volta sola

### 3a · Mettere i tre segreti del progetto di prova su GitHub

Servono perché le 459 prove parlano col database di prova. **Non finiscono
nel codice**: GitHub le tiene cifrate e non le mostra a nessuno.

1. Vai su **https://github.com/idearecreazioni-source/Borgo58-App**
2. In alto, la linguetta **Settings**
3. Nella colonna a sinistra: **Secrets and variables** → **Actions**
4. Pulsante verde **New repository secret**
5. Aggiungine **tre**, uno alla volta. Nome esatto a sinistra, valore preso
   dalla riga **con lo stesso nome** nel file `.env` sul computer:

   | Nome del segreto | Riga da copiare dal file `.env` | Cos'è |
   |---|---|---|
   | `PROVA_SUPABASE_ANON_KEY` | `PROVA_SUPABASE_ANON_KEY` | una chiave |
   | `TEST_TITOLARE_PASSWORD` | `TEST_TITOLARE_PASSWORD` | un PIN |
   | `TEST_STAFF_PASSWORD` | `TEST_STAFF_PASSWORD` | un PIN |

   **Il nome del segreto e il nome della riga sono lo stesso, tutte e tre le
   volte.** Se ti trovi a copiare una riga che si chiama diversamente, è
   quella sbagliata.

🔴 **ERANO SEI, E TRE NON DOVEVANO ESSERCI — corretto il 01/09/2026.**
L'indirizzo del progetto di prova e le due caselle di posta degli utenti di
collaudo **sono già scritte in chiaro nel repository** (`REF_PROVA` in
`scripts/comune.mjs`, e le due righe di `.env.example`). Metterle in un
segreto non le nascondeva a nessuno, e in cambio le rendeva **impossibili da
rileggere**: è esattamente così che due sono rimaste vuote e nella terza è
finita la riga sbagliata, **senza che nessuno potesse accorgersene
guardando**. *Una casella che non si può rileggere non si può nemmeno
correggere a vista.* Da oggi il giro le prende dal repository, e i tre
segreti rimasti sono le sole cose che un segreto deve contenere: una chiave
e due PIN.

⚠️ **E il bersaglio delle prove non PUÒ più essere il locale vero**: prima
era un controllo che lo verificava, adesso l'indirizzo è ricavato da
`REF_PROVA`. *Un vincolo batte un controllo.* Se qualcuno passa a mano un
indirizzo `https://` diverso — cosa che si può ancora fare, per puntare le
prove a un terzo progetto — il rifiuto sulla produzione scatta come prima.

⚠️ **Prima di far partire qualunque prova**, il giro lancia
`node scripts/chiavi-di-prova.mjs`, che si ferma se uno dei tre segreti
manca e se l'indirizzo è quello del gestionale vero, e **dice** (senza
fermarsi) se in `PROVA_SUPABASE_URL` c'è rimasta la riga sbagliata. Nel
registro finiscono **solo i nomi** delle caselle, mai i valori. Lo stesso
controllo gira sul computer di Alessio: `npm run test:app` lo lancia per
primo.

### 3b · Bloccare `master`

Da qui in avanti nessuno — nemmeno Alessio — potrà scrivere direttamente su
`master`: ogni modifica passa da una **proposta**, i cui controlli devono
essere verdi.

1. Sempre in **Settings**, colonna a sinistra: **Rules** → **Rulesets**
   *(sui repository più vecchi si chiama «Branches» → «Add branch protection
   rule»: fa la stessa cosa)*
2. **New ruleset** → **New branch ruleset**
3. Nome: `master protetto`
4. **Enforcement status**: metti **Active**
5. In **Target branches** → **Add target** → **Include default branch**
6. Nell'elenco **Rules**, spunta queste quattro:
   - ☑ **Restrict deletions** — nessuno può cancellare il ramo
   - ☑ **Require a pull request before merging** — niente scritture dirette
     - 🔴 **dentro, lascia `Required approvals` a `0`.** Vedi l'avvertenza
       qui sotto: mettere `1` **blocca tutto**.
   - ☑ **Require status checks to pass**
     - **Add checks** e cerca questi due nomi, uno per volta — sono
       esattamente questi, copiati dai controlli veri:
       - `Codice, prove pure e compilazione`
       - `Prove contro il progetto di prova`
   - ☑ **Block force pushes** — nessuno può riscrivere la storia
7. **Create**

### 🔴 `Required approvals: 1` ti bloccherebbe fuori — correzione del 31/08

**Questa pagina diceva di metterlo a `1`, ed era un consiglio che rende il
repository inutilizzabile.**

Il motivo: **GitHub non permette a chi apre una proposta di approvarla da
sé.** Qui le proposte le apre l'account di Alessio, ed è l'unica persona nel
repository. Con una approvazione richiesta, **nessuna proposta potrebbe mai
essere unita** — né da lui né da me — se non scavalcando la regola. E una
protezione che si scavalca a ogni giro smette di proteggere dopo la seconda
volta.

⚠️ **Con `0` non si perde niente di quello che conta.** La protezione vera
sono le altre tre righe: niente scritture dirette su `master`, i controlli
devono essere verdi, e la storia non si riscrive. L'approvazione, con una
persona sola, sarebbe stata un timbro che si mette da sé.

⚠️ **Il giorno che entrerà qualcun altro**, `Required approvals: 1` torna
sensato — e da quel momento vuol dire davvero *«qualcun altro ha guardato»*.

### ⚠️ Due cose da sapere prima di premere Create

**I due controlli compaiono nell'elenco solo dopo che sono girati almeno una
volta.** Al 31/08 sono girati, quindi ci sono.

🔴 **Il punto 6 è quello che conta.** Senza «Require status checks», una
proposta si può unire anche con i controlli rossi — e tutta la rete diventa
una formalità.

---

## 4 · 🔴 Come cambia il lavoro di tutti i giorni

**Questo è il prezzo, e va saputo prima di decidere.** Oggi il giro è:

> Claude committa → Alessio pusha su `master` → il sito va online

Con `master` bloccato diventa:

> Claude committa su un **ramo** → Alessio pusha il ramo → apre la
> **proposta** su GitHub → i controlli girano (circa 10 minuti) → Alessio
> approva e unisce → il sito va online

⚠️ **Sono due passaggi in più per Alessio**, e uno è un'attesa di dieci
minuti. In cambio: niente arriva sul sito senza che 1.116 prove siano
passate.

⚠️ **E cambia una regola in vigore**: *«il push lo fa sempre Alessio»* resta
vera e anzi si rafforza — ma adesso lui deve pushare **un ramo**, non
`master`. Il comando è:

```bash
git -C "C:\Users\User\Desktop\Claude code\Borgo58-App" push -u origin HEAD
```

GitHub risponde con un indirizzo da aprire per creare la proposta.

🔴 **E i controlli partono quando la proposta viene APERTA, non quando il
ramo viene spinto.** È una precisazione del 31/08, arrivata correggendo un
difetto: prima partivano in tutte e due le occasioni, e lo stesso commit
finiva giudicato **due volte** — con la possibilità concreta, capitata
davvero, che un giro dicesse «non passa» e l'altro «459 prove su 459».
⚠️ *Un rosso che non corrisponde a niente di rotto insegna a non guardare i
rossi*, quindi la regola adesso è: **un commit, un verdetto**.
⚠️ **Il prezzo, dichiarato**: un ramo spinto e lasciato lì **senza aprire la
proposta** non viene controllato da nessuno. Aprire la proposta non è un
passaggio burocratico — è il gesto che accende i controlli.

⚠️ **E il freno delle migrazioni continua a funzionare, anzi meglio**: il
controllo `nonAncoraSuGitHub` guarda `origin/master`. Una migrazione che sta
su un ramo non ancora unito **non è su `master`**, quindi non si può
applicare al gestionale vero finché la proposta non è approvata. È
esattamente ciò che quel freno esiste per fare.

---

## 5 · Cosa controlla la pipeline, e cosa NON controlla

**Controlla**, in due lavori:

| lavoro | cosa fa | quanto ci mette |
|---|---|---|
| **Codice, prove pure e compilazione** | il codice non ha avvisi · 697 prove che non toccano il database · 12 prove che montano una schermata · l'app si compila · quanto pesa il pacchetto | ~4 minuti |
| **Prove contro il progetto di prova** | 459 prove contro il database vero di prova | ~7 minuti |

Il secondo parte **solo se il primo è verde**: far scrivere righe di prova da
un ramo che non compila nemmeno è sporcare per niente.

🔴 **NON controlla — e va detto perché non si scambi per una garanzia
intera:**

* **Quasi nessuna prova guarda una schermata**, e quelle che lo fanno non
  guardano *come si vede*. Dal 01/09/2026 ce ne sono 12 che **montano** una
  schermata: provano che si apre, che chi non è entrato non ne vede una, che
  la pagina del cliente parla dal collegamento anonimo. Ma **una schermata
  che sborda, un testo troppo piccolo, un colore che non si distingue con le
  luci basse, un pulsante sparito: quelli li trova solo un occhio.** Il 31/08
  i tre difetti più grossi li ha trovati Alessio in dieci minuti, non le
  1.116 prove.
  ⚠️ E il conto di quanto è coperto si chiede a `npm run copertura`, che lo
  dice **cartella per cartella**: le regole pure stanno al 92%, le schermate
  al 2%. Un totale unico su questo progetto non vuol dire niente.
* **Non controlla il database vero.** Le migrazioni restano un gesto
  separato (`npm run migra`), coi suoi sei freni.
* **Non impedisce a Cloudflare di pubblicare.** Cloudflare compila per conto
  suo, e sono due cose parallele: se un giorno servisse *bloccare* anche la
  pubblicazione, è un lavoro a sé.

---

## 6 · Tre trappole chiuse, che vale la pena conoscere

1. **Un giro alla volta sul database di prova.** Le prove sull'app scrivono
   tutte sullo stesso progetto: due giri insieme si pestano i piedi. È già
   successo il 10/08 in locale — un file che aggiungeva un tavolo faceva
   fallire un altro file che contava i coperti, e l'errore *sembrava* un
   difetto del calcolo. Il file lo impedisce (`concurrency`).
2. **Se le chiavi non arrivano, la pipeline si ferma e lo dice.** Una
   proposta che arriva da un repository forestiero non riceve i segreti — lo
   impedisce GitHub, ed è giusto. Senza il controllo, quel lavoro finirebbe
   **verde senza aver provato niente**: e un verde che non ha provato niente è
   peggio di un rosso. È la regola del 19/08 — *una risposta più corta che ha
   l'aria di essere intera*.
3. 🔴 **E il controllo guardava una casella sola, fino al 01/09/2026.**
   Chiedeva che `PROVA_SUPABASE_URL` non fosse vuota, e quella c'era: ha
   detto di sì, e sei minuti dopo il giro è morto con 67 file falliti e un
   messaggio che **non nominava la causa** (mancavano due segreti e il terzo
   non era un indirizzo). Il danno non era il rosso: era che chi lo leggeva
   andava a cercare il guasto nel codice — che era sano, tanto che dieci
   minuti prima, sullo **stesso identico contenuto**, erano passate 459 prove
   su 459.
   Adesso il controllo guarda tutte e sei le caselle e la forma
   dell'indirizzo, in un posto solo (`scripts/chiavi.mjs`) usato dalla
   pipeline, da `vitest` e dalle prove. Prima erano tre condizioni sparse in
   tre file, e **nessuna delle tre guardava le credenziali degli utenti**.

---

## 7 · Come si verifica che funzioni davvero

⚠️ **La prima volta la deve vedere Alessio**, perché la pipeline gira su
GitHub e da qui non si può provare.

Dopo il primo push:

1. Vai su **https://github.com/idearecreazioni-source/Borgo58-App/actions**
2. Deve comparire un giro chiamato **Controlli**
3. Aprilo: devono esserci **due riquadri verdi**
4. Se il secondo è rosso con scritto *«Le chiavi del progetto di prova non
   sono arrivate»*, mancano i segreti del punto 3a

🔴 **E poi la prova che conta**, quella che dimostra che il guardiano
discrimina invece di limitarsi a passare: fai una proposta che **rompe
qualcosa apposta** — cambia un numero in una prova — e guarda che diventi
rossa. Un controllo che non si è mai visto fallire non è ancora un controllo.
