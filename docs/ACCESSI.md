# Igiene degli accessi — lista eseguita, e mappa delle chiavi

**A chi serve**: ad Alessio. Blocco 4 del Mandato strutturale.
Scritto ed **eseguito insieme il 10/08/2026**.

⚠️ **In questo file non c'è nessuna password, nessun codice, nessun token —
e non ce ne devono finire mai.** Solo dove stanno le cose. Il file è su
GitHub: un segreto committato resta nella storia del repository anche dopo
essere stato cancellato.

---

## 0. Perché

Chi entra nei conti online del locale può fare più danni di chi entra in
cucina: cancellare la contabilità, leggere i dati dei clienti, spegnere il
sito, mandare messaggi a nome tuo. E il conto più importante non è nessuno
di quelli del gestionale: è **l'email**, perché da lì si riprendono tutti
gli altri con «password dimenticata».

---

## 1. La mappa — dove sta cosa

*(la parte da rileggere fra sei mesi, o il giorno storto)*

| Conto | Si entra con | Dove sta la password | Secondo passaggio | Se perdo tutto |
|---|---|---|---|---|
| **Google** `borgo58.gestionale@gmail.com` — la chiave di casa | l'indirizzo stesso | Bitwarden | app Authenticator sul telefono + SMS | **codici di backup su carta**, cassetto chiuso a chiave |
| **Google** `idearecreazioni@gmail.com` — vecchia, tenuta come riserva | l'indirizzo stesso | Bitwarden | — | recupero via `alessio.schillaci@icloud.com` |
| **GitHub** — dove vive il codice | utente `idearecreazioni-source`, email `borgo58.gestionale@gmail.com` (la vecchia resta come seconda) | Bitwarden | app Authenticator | **codici di recupero**: nelle note della voce GitHub + su carta |
| **Supabase** — dove vivono i dati del locale | **si entra con GitHub**: non ha password propria | — | quello di GitHub | si rientra rientrando in GitHub |
| **Cloudflare** — dove vive il sito | `borgo58.gestionale@gmail.com` | Bitwarden (password rifatta il 10/08) | app Authenticator | codici di recupero nelle note della voce Cloudflare |
| **Telegram** — dove arrivano prenotazioni e allarmi | numero di telefono | Bitwarden (password della verifica in due passaggi + **token del bot**) | verifica in due passaggi dell'app | email di recupero `borgo58.gestionale@gmail.com` |
| **Anthropic** — l'account dell'intelligenza artificiale (`platform.claude.com`) | **si entra con Google**: nessuna password propria | Bitwarden tiene la **chiave dell'API** (la password non esiste) | quello di Google | si rientra rientrando in Google |
| **Aruba — l'account** (apre `admin.aruba.it`, `managehosting.aruba.it` e `areaclienti.pec.it`) | l'account storico delle due PEC — **non esiste nessun `postmaster@`** | Bitwarden, una voce sola con i tre indirizzi | da attivare | domini, caselle, DNS, rinnovi, PEC |
| **Casella `info@borgo58.it`** (`webmail.aruba.it`) | l'indirizzo stesso | Bitwarden | — | la posta dei clienti |
| **Bitwarden** — la cassaforte stessa (server **EU**, `vault.bitwarden.eu`) | `borgo58.gestionale@gmail.com` | **solo nella tua testa e sul foglio nel cassetto** | app Authenticator | **codice di recupero di Bitwarden, su carta** — mai dentro la cassaforte che serve a recuperare |

**Aruba sono due mondi separati — dominio e PEC — e cinque indirizzi, ma
la regola è una sola** (ricostruita sul campo l'11/08/2026): **un solo
account apre tutti i pannelli** (`admin.aruba.it`, `managehosting.aruba.it`,
`areaclienti.pec.it`), **ogni casella ha la sua password** per leggere la
posta. Dall'area PEC non si arriva a `info@borgo58.it` e viceversa: non è
un permesso mancante, è un altro sistema. Sbagliare porta dà «nessun
dominio associato a questa login» o «la login inserita non è valida», che
sembrano guasti e non lo sono. **Nessun `postmaster@borgo58.it`**: non
esiste su questa configurazione, e cercare di recuperarne la password è
un vicolo cieco. Mappa pratica in [`POSTA.md`](POSTA.md).

**Come si apre ogni casella, senza sbagliare porta**: la mappa pratica
delle quattro porte di Aruba, gli indirizzi dei server e le due regole
sulle PEC stanno in [`POSTA.md`](POSTA.md).

**La posta del locale sta in un'app sua** (scelta dell'11/08): niente
inoltro verso la Gmail personale — sull'iPhone l'app Gmail tiene insieme
`borgo58.gestionale@gmail.com` e `info@borgo58.it` (IMAP `imaps.aruba.it`
993 SSL, SMTP `smtps.aruba.it` 465 SSL), mentre Apple Mail resta la posta
personale. Così suona solo il locale.

**Due portachiavi, divisi per argomento** (scelta del 10/08/2026): tutto
ciò che riguarda **il locale sta in Bitwarden**; le password personali e
degli altri progetti restano nel gestore di Chrome. Così sai sempre dove
cercare. Unica accortezza: quando cambi una password del locale, entrambe
le estensioni chiederanno di salvarla — si dice **sì a Bitwarden e no a
Chrome**, altrimenti fra sei mesi non si sa più quale delle due è buona.

**La catena da tenere a mente**: chi entra in **GitHub** entra anche in
**Supabase**, cioè nei dati del locale. GitHub è protetto dall'app sul
telefono; se perdi il telefono, si rientra solo con i codici di recupero
su carta. Sono quei due fogli nel cassetto a reggere tutto.

**Su GitHub, da questo computer**, è stata aggiunta anche una *chiave di
accesso* (passkey): da qui si entra senza digitare la password, con lo
sblocco di Windows. Vale **solo su questo computer** — da telefono o da
un altro PC servono password e codice a sei cifre.

⚠️ **Regola imparata sul campo la sera stessa**: non uscire mai da un
conto prima di aver verificato che la password è dentro la cassaforte.
È successo con GitHub — la password non era in nessun gestore, e per
rientrare è servita la procedura di recupero. Nessun danno, ma mezz'ora
buttata e un attimo di panico evitabile.

**Sul computer** vivono i file `.env`, `.env`, `.env`: sono
chiavi del database vero, non password di siti. Non si copiano, non si
mandano, non si mettono in cloud.

**La cartella `Backup Borgo 58`** portata fuori dal computer vale quanto
tutto il gestionale: chi ce l'ha, ha i dati.

---

## 2. Cosa è stato fatto il 10/08/2026

- [x] Creata `borgo58.gestionale@gmail.com`, dedicata al locale, con la
      vecchia casella e un indirizzo iCloud come vie di recupero.
- [x] **Verifica in due passaggi su Google** attiva (app + SMS) e **codici
      di backup** generati e messi su carta.
- [x] **GitHub**: indirizzo principale spostato sulla casella nuova (la
      vecchia resta come seconda strada), **verifica in due passaggi**
      attiva con app di autenticazione, **codici di recupero** salvati.
- [x] **Cloudflare**: password rifatta e indirizzo spostato sulla casella
      nuova (verificato: il pannello mostra la nuova).
- [x] **Supabase**: controllato *come* si entra — si entra con GitHub,
      quindi non ha una serratura propria da rinforzare. L'indirizzo per
      gli avvisi è stato allineato alla casella nuova.
- [x] Password diverse per ogni conto, e una cassaforte sola dove tenerle
      (vedi sotto).

- [x] **Telegram**: verifica in due passaggi attiva con email di recupero,
      e **token del bot** messo al sicuro nella cassaforte.
- [x] **Cloudflare**: verifica in due passaggi con app di autenticazione e
      codici di recupero salvati.
- [x] **Bitwarden**: verifica in due passaggi attiva, e il suo codice di
      recupero scritto su carta — non dentro sé stesso.

**Creata la cassaforte Bitwarden** sui server europei (`vault.bitwarden.eu`),
con le voci dei conti e, nelle note sicure, i codici di recupero di GitHub
e i codici di backup di Google.

**Perché una cassaforte separata e non il gestore di Chrome**: perché
serviva *un posto solo*, aggiornabile e consultabile da computer e
telefono, che tenesse password **e** codici **e** note — cioè esattamente
un gestore di password. E perché le password di Chrome vivono dentro lo
stesso account Google da cui si recupera tutto il resto: tenerci dentro i
codici per recuperare Google sarebbe come chiudere le chiavi in macchina.

**Server europei** scelti di proposito, coerenti col resto del progetto
(database in Irlanda). Due avvertenze: la scelta è **definitiva**, e
l'app sul telefono va impostata su **EU** — altrimenti dice che l'account
non esiste, pur avendolo appena creato.

---

## 3. Cosa resta

- [x] **GitHub**: verificato dal terminale il 11/08/2026 — un solo accesso
      (`idearecreazioni-source`, admin), zero inviti in sospeso, zero chiavi
      di deploy.
- [x] **Supabase → Organization → Team** e **Cloudflare → Members**:
      verificati l'11/08/2026, nessun altro membro.
- [x] Cartella `Backup Borgo 58` portata **fuori dal computer** l'11/08/2026.
- [ ] **Account AI**: creazione, tetto di spesa e chiave — `docs/ACCOUNT_AI.md`.

---

## 4. Scelte consapevoli, non dimenticanze

**Nessun PIN all'avvio del computer** — deciso il 10/08/2026: il portatile
sta in casa e lo usa solo Alessio. Da rimettere in discussione **prima
dell'apertura del locale**, insieme alla cifratura del disco: le due cose
vanno insieme, perché la cifratura si sblocca proprio con quella password.
Il giorno in cui il computer entra in un locale con altre persone — o
esce di casa — questa riga va riaperta.

**PIN dello staff ancora corti** — rinviato il 06/08/2026, stesso
appuntamento: prima dell'apertura.

---

## 5. Prima dell'apertura, e poi ogni sei mesi

- [ ] Riprendere il §3 e il §4 e chiuderli.
- [ ] Nessuno dello staff conosce il PIN da titolare; nessun conto online
      è condiviso.
- [ ] Controllare che i codici di recupero siano ancora dove dice la mappa.
- [ ] Controllare che non sia comparso nessun accesso di persone che non
      lavorano più con me.

---

*Eseguito da Alessio, con Claude Code, il 10/08/2026.*
