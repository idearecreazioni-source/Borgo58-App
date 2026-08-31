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

### 3a · Mettere le chiavi del progetto di prova su GitHub

Servono perché le 459 prove parlano col database di prova. **Non finiscono
nel codice**: GitHub le tiene cifrate e non le mostra a nessuno.

1. Vai su **https://github.com/idearecreazioni-source/Borgo58-App**
2. In alto, la linguetta **Settings**
3. Nella colonna a sinistra: **Secrets and variables** → **Actions**
4. Pulsante verde **New repository secret**
5. Aggiungine **sei**, uno alla volta. Nome esatto a sinistra, valore preso
   dal file `.env` sul computer:

   | Nome del segreto | Da dove prendere il valore |
   |---|---|
   | `PROVA_SUPABASE_URL` | riga `VITE_SUPABASE_URL` |
   | `PROVA_SUPABASE_ANON_KEY` | riga `VITE_SUPABASE_ANON_KEY` |
   | `TEST_TITOLARE_EMAIL` | riga omonima |
   | `TEST_TITOLARE_PASSWORD` | riga omonima |
   | `TEST_STAFF_EMAIL` | riga omonima |
   | `TEST_STAFF_PASSWORD` | riga omonima |

⚠️ **Sono le chiavi del progetto di PROVA, mai quelle del locale vero.** E
non è solo una raccomandazione: le prove hanno un controllo dentro
(`tests/app/aiuto.js`) che **si rifiuta di partire** se l'indirizzo è quello
del gestionale vero.

### 3b · Bloccare `master`

Da qui in avanti nessuno — nemmeno Alessio — potrà scrivere direttamente su
`master`: ogni modifica passa da una **proposta** (una *pull request*) che
deve essere approvata e i cui controlli devono essere verdi.

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
     - dentro, metti **Required approvals: 1**
   - ☑ **Require status checks to pass**
     - **Add checks** e cerca questi due nomi, uno per volta:
       - `Codice, prove pure e compilazione`
       - `Prove contro il progetto di prova`
     - ⚠️ **Compaiono nell'elenco solo dopo che la pipeline è girata almeno
       una volta.** Quindi: prima si pubblica questo lavoro, si aspetta che
       giri, e **poi** si torna qui ad aggiungerli.
   - ☑ **Block force pushes** — nessuno può riscrivere la storia
7. **Create**

⚠️ **Il punto 6 è quello che conta.** Senza «Require status checks», la
proposta si può approvare anche con i controlli rossi — e la protezione
diventa una formalità.

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
| **Codice, prove pure e compilazione** | il codice non ha avvisi · 657 prove che non toccano il database · l'app si compila | ~3 minuti |
| **Prove contro il progetto di prova** | 459 prove contro il database vero di prova | ~7 minuti |

Il secondo parte **solo se il primo è verde**: far scrivere righe di prova da
un ramo che non compila nemmeno è sporcare per niente.

🔴 **NON controlla — e va detto perché non si scambi per una garanzia
intera:**

* **Nessuna prova guarda una schermata.** Una schermata che sborda, un
  pulsante sparito, un menu che offre la voce sbagliata: quelle le trova solo
  un occhio. Il 31/08 i tre difetti più grossi li ha trovati Alessio in dieci
  minuti, non le 1.116 prove.
* **Non controlla il database vero.** Le migrazioni restano un gesto
  separato (`npm run migra`), coi suoi sei freni.
* **Non impedisce a Cloudflare di pubblicare.** Cloudflare compila per conto
  suo, e sono due cose parallele: se un giorno servisse *bloccare* anche la
  pubblicazione, è un lavoro a sé.

---

## 6 · Due trappole chiuse nel file, che vale la pena conoscere

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
