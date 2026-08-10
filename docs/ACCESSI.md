# Igiene degli accessi — lista da eseguire e spuntare

**A chi serve**: ad Alessio, da solo, senza nessuna competenza tecnica.
Blocco 4 del Mandato strutturale. Documento del 10/08/2026.

**Come si usa**: si eseguono le voci in ordine e si mette una `x` dentro le
parentesi quadre man mano (`- [x]`). Serve mezz'ora scarsa.

⚠️ **In questo file non va scritta nessuna password, nessun codice, nessun
token.** Solo le caselle. Il file finisce su GitHub: se ci finisse un
segreto, sarebbe pubblico per sempre — cancellarlo non basta, resta nella
storia del repository.

---

## 0. Perché, in due righe

Chi entra nei conti online del locale può fare più danni di chi entra in
cucina: cancellare la contabilità, leggere i dati dei clienti, spegnere il
sito, mandare messaggi a nome tuo. Nessuno di questi conti è protetto da una
serratura — sono protetti da una password e, se lo attivi, da un secondo
passaggio sul telefono.

Il conto più importante non è nessuno di quelli del gestionale: è **la tua
email**. Chi entra lì dentro si riprende tutti gli altri con "password
dimenticata".

---

## 1. Prima di tutto: un gestore di password

Senza, tutto il resto non regge: si finisce con la stessa password
dappertutto, e basta che UN sito qualunque venga bucato.

- [ ] Ho installato un gestore di password (va bene **Bitwarden**, gratuito,
      su computer e telefono; se preferisci pagare, 1Password è ottimo).
- [ ] La password principale del gestore è **lunga** (una frase di quattro
      parole che ricordi, tipo `cucinaOrtoBorgoMarzo`) e non è usata da
      nessun'altra parte.
- [ ] La password principale è **anche scritta su carta**, in un posto
      chiuso a chiave in casa. Se la dimentichi non la recupera nessuno:
      nemmeno chi ti ha venduto il servizio.

---

## 2. L'email — il conto che regge tutti gli altri

Account: `idearecreazioni@gmail.com`

- [ ] Password unica, generata dal gestore.
- [ ] **Verifica in due passaggi attiva** (Google → Gestisci account →
      Sicurezza → Verifica in due passaggi).
- [ ] **Codici di recupero** scaricati e messi nel gestore di password
      *(non nella stessa casella email: se perdi l'email perdi anche loro)*.
- [ ] Ho guardato l'elenco dei dispositivi collegati e non ce n'è nessuno
      che non riconosco.

---

## 3. I quattro conti del gestionale

Per ognuno: password unica dal gestore, secondo passaggio attivo, codici di
recupero al sicuro, e **nessun altro** con accesso.

### GitHub (dove vive il codice)
- [ ] Password unica.
- [ ] Autenticazione a due fattori attiva (Settings → Password and
      authentication → Two-factor authentication).
- [ ] Codici di recupero salvati nel gestore.
- [ ] In Settings → Collaborators non c'è nessuno oltre a me.

### Supabase (dove vivono i dati del locale)
- [ ] Ho controllato **come entro**: se entro con Google o con GitHub, la
      sicurezza è quella di quel conto lì — quindi contano i punti sopra.
- [ ] Autenticazione a due fattori attiva (Account → Security), se entro
      con email e password.
- [ ] In Organization → Team non c'è nessun altro membro.
- [ ] Vale per **entrambi** i progetti: `borgo58` e `Borgo58-Prova`.

### Cloudflare (dove vive il sito)
- [ ] Password unica.
- [ ] Two-Factor Authentication attiva (My Profile → Authentication).
- [ ] Codici di recupero salvati.
- [ ] In Manage Account → Members non c'è nessun altro.

### Telegram (dove arrivano prenotazioni e allarmi)
- [ ] Sul mio account Telegram è attiva la **verifica in due passaggi**
      (Impostazioni → Privacy e sicurezza → Verifica in due passaggi):
      senza, chi clona la scheda SIM legge le prenotazioni del locale.
- [ ] Il codice del bot (quello dato da BotFather) è nel gestore di
      password, e **non** è scritto in nessun altro posto: non in una chat,
      non in un file sul Desktop, non in una email.

---

## 4. Il computer dove lavoro

Sul PC ci sono file di chiavi che aprono il database vero (`.env.db`,
`.env.local`, `.env.test`). Non sono un problema finché il computer è tuo e
solo tuo — lo diventano se il computer sparisce.

- [ ] Windows chiede una password (o il PIN) all'accensione, e lo schermo si
      blocca da solo dopo qualche minuto.
- [ ] Il disco è cifrato con **BitLocker** *(Impostazioni → Privacy e
      sicurezza → Crittografia dispositivo)*. Se non è disponibile, almeno la
      casella qui sopra deve essere vera.
- [ ] La cartella `Backup Borgo 58` che porti fuori (chiavetta o cloud) è
      trattata come i soldi in cassa: chi ce l'ha, ha tutto il gestionale.

---

## 5. Quando arriverà personale

Da fare **prima** dell'apertura, non dopo:

- [ ] I PIN dello staff sono più lunghi di quelli di prova
      *(rinviato consapevolmente il 06/08/2026, ma non va dimenticato)*.
- [ ] Nessuno dello staff conosce il mio PIN da titolare.
- [ ] Nessun conto online del locale è condiviso: chi entra nel gestionale
      entra con il proprio accesso, non con il mio.

---

## 6. Ogni sei mesi, e comunque prima dell'apertura

- [ ] Ripasso questa lista dall'inizio.
- [ ] Controllo che non sia comparso nessun accesso di persone che non
      lavorano più con me.
- [ ] Controllo che i codici di recupero siano ancora dove credo.

---

*Chi ha eseguito e quando — da riempire a mano:*

| Data | Note |
|---|---|
|  |  |
