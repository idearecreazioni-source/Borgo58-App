# Il backup, la regola sulle pulizie, e le due correzioni

**23/08/2026 — seconda consegna della sessione**, dopo il mandato degli
otto blocchi (`a5a85c8`). Ordine chiesto da Alessio: backup, poi la
regola, poi le correzioni.

| | |
|---|---|
| HEAD dichiarato | `398b30a` |
| working tree | pulito (solo file `*.local.*`, ignorati) |
| migrazioni nuove | **nessuna** |
| produzione | **172 migrazioni, invariata** — nessuna scrittura |
| prova | 193 migrazioni |
| prove | 324 pure, tutte verdi |

---

## 1 — La copia del gestionale vero

**Fatta e verificata.** In un file solo:

```
C:\Users\User\Desktop\Backup Borgo 58\Borgo58_backup_2026-08-23_2120.zip
247,3 KB
```

Dentro: la forma del database, il contenuto di tutte le tabelle, gli
utenti che entrano nell'app, l'elenco dell'archivio documenti, e il
conteggio riga per riga del momento della copia. **103 tabelle, 564
righe.**

⚠️ **«0 documenti» è vero, non un buco della copia**: misurato in
produzione, `documents` ha **0 righe** e lo spazio dei file **0 oggetti**.
Non c'era niente da salvare.

### La verifica

Nuovo comando `npm run backup:verifica` — perché «esiste il file» non è
una verifica, e il modo in cui un backup fallisce è quello del §8: **più
corto, con l'aria di essere intero**.

Controlla quattro cose: che i file finiscano dove devono, quante righe
contengono **davvero** (contate una per una), che quel numero coincida con
quello dichiarato al momento della copia, e — con `--adesso` — con quello
che il database vero dice adesso. Esito sulla copia di stasera: **564 =
564 = 564**, e lo zip riaperto dà gli stessi numeri.

🔴 **Il primo tentativo del controllo ha gridato su una copia sanissima**:
pretendeva che il file *finisse* col marcatore «dump complete», e
`pg_dump` 17 dopo quello scrive ancora una riga `\unrestrict`. Trovato
guardando la coda del file vero. *Un guardiano che grida su una copia
buona si impara a spegnere.*

✅ **Provato rompendo**, nei due modi in cui una copia si rompe: accorciata
al 60% → si ferma e dice che è interrotta; tolte 3 righe da dentro un
blocco lasciando la coda intatta → si ferma e **nomina la tabella**
(«dining_tables: nel file 10, dichiarate 13»). Il secondo è il caso che il
solo controllo sulla coda non prenderebbe.

### 🔴 Il ripristino vero NON è stato fatto, e la ragione è una misura

L'unica procedura di ripristino provata di questo progetto è
`npm run prova:ripristina`, e **svuota il progetto di prova**. Oggi lì
dentro c'è lo scenario di collaudo:

| | |
|---|---|
| conti | 348 |
| righe di conto | 4.564 |
| prodotti | 129 |
| ricette | 116 |
| prenotazioni | 262 |
| lotti | 497 |
| movimenti di cassa | 57 |

Più il fatto che la prova è a **193** migrazioni e la produzione a **172**:
un ripristino la porterebbe **indietro**, togliendole anche l'ambiente su
cui il collaudo sta girando.

Alessio aveva scritto: *«se lo fai sul progetto di prova, avvisami di cosa
sovrascrivi PRIMA di farlo, e se non è sicuro non farlo»*. Non è
raggiungibile, quindi non è stato fatto. **Non c'è nessun PostgreSQL
locale** su questa macchina (solo gli strumenti a riga di comando), quindi
la terza strada — un database usa-e-getta qui — non esiste.

⚠️ **Cosa resta quindi non dimostrato, detto per intero**: che quel file
**giri** dentro un database. È dimostrato che è completo e allineato al
vero; non che l'esecuzione fili. Con un suo ok è un comando solo, e il
costo è quello scritto qui sopra.

### Cosa NON c'è dentro la copia

- **I file caricati nell'Archivio Documenti** stanno fuori dal database.
  Oggi sono **zero**, quindi la copia è completa lo stesso — ma il giorno
  che ce ne saranno, `npm run backup` li scarica dentro `file/` e vanno
  nello zip con tutto il resto.
- **Le funzioni online** (il corridoio, le notifiche, la posta) vivono nel
  repository, non nel database: la loro copia è GitHub.
- **I segreti** (parole d'ordine delle notifiche, chiavi) stanno nel Vault
  di Supabase e nelle impostazioni delle funzioni: **non sono nel backup**,
  ed è giusto — ma vanno saputi ricreare.
- **Le impostazioni del progetto Supabase** (piano, regione, autenticazione,
  DNS) non sono dati: si rifanno a mano.

### E i backup automatici

**Non ce n'è nessuno.** Il piano gratuito di Supabase non fa backup —
verificato sulla loro documentazione il 10/08 e ancora vero. L'unica copia
che esiste è quella che si lancia a mano con `npm run backup`. Sul piano
a pagamento (~25 €/mese, già in elenco fra le cose da fare prima
dell'apertura) i backup giornalieri sono automatici.

---

## 2 — La regola sulle pulizie

Scritta nel **§8 di CLAUDE.md**, dove stanno le altre trappole, con le
parole di Alessio. Nata dal danno di stasera: uno script di prova ha
cancellato «l'ultima riga di `discounts_gifts`» invece della propria, e se
n'è andato uno **sconto vero** dello scenario (112,83 €, 25 luglio),
rimesso dalla copia conservata nel registro delle cancellazioni.

**Resa automatica in due modi, non uno.**

1. **Una strada**: `righeMie()` in `tests/app/aiuto.js` segna gli
   identificativi mentre si creano e cancella solo quelli, in ordine
   inverso (le figlie prima delle madri, o le chiavi esterne respingono);
   se una cancellazione fallisce **non tace**. *La cosa giusta dev'essere
   anche la più comoda: è l'unico modo in cui una regola sopravvive a una
   giornata lunga.*
2. **Un setaccio** che gira a ogni `npm run test` e a ogni commit
   (`scripts/pulizie.mjs` + `tests/unita/pulizie.test.js`).

🔴 **E il setaccio guarda anche gli script usa-e-getta** (`_*.local.mjs`),
che stanno fuori dal repository e non passano da lint né da build: **è lì
che il danno è successo**. Un controllo sul solo codice committato avrebbe
risposto «zero», e avrebbe avuto ragione sul posto sbagliato.

⚠️ **La misura ha corretto il setaccio due volte**, guardando i casi uno
per uno invece di fidarsi del conteggio:

- leggendo le catene **intere** (non riga per riga) sono comparsi **4**
  allarmi «senza filtro» che erano pulizie per intervallo di date:
  `gte`/`lte` **sono** filtri, e mancavano dall'elenco;
- e **3** allarmi «per recenza» su letture innocue
  (`select("id").limit(1)` per pescare un soggetto qualunque su cui
  provare).

Forma finale: «la più recente» vuole **tutti e due** i segni — ordinamento
all'indietro *e* taglio — **e nessun filtro**. Prende «la più recente FRA
TUTTE» (lo script che ha fatto il danno, ricopiato nella prova) e lascia
stare «la più recente FRA LE MIE», che è legittimo.

⚠️ **Limite dichiarato**: è un setaccio sul testo, non sa da dove viene un
identificativo passato dentro una variabile. Per quello c'è `righeMie()`.

---

## 3 — Il riquadro del cliente pagante (sua risposta 2)

Resta **dentro la pianta**, dove arriva il pollice, e **non scorre più**. A
riposo ci sta ciò che si legge mentre si serve; ciò che si scrive si apre
al tocco in un pannello che prende spazio.

⚠️ **Espandere dentro il riquadro rimetterebbe lo scorrimento da cui si
scappa**: lì ci sono 25 mm d'altezza.

🔴 **Misurato senza fidarsi del numero facile**: `scrollHeight` con
`overflow-hidden` può dire che tutto sta anche quando taglia. Ho misurato
**dove finisce l'ultimo testo** rispetto al fondo del riquadro.

| calibrazione | riquadro | avanza |
|---|---|---|
| mini tablet 7,9" (64) | 53,8 × 25,1 mm | 18 pt (2,8 mm) |
| mini tablet 8,3" (59,5) | 57,9 × 27,0 mm | 22 pt (3,7 mm) |
| monitor (37,8) | 91,1 × 42,5 mm | 42 pt (11 mm) |

Provato in **tutti e tre gli stati**: col pagante ereditato dalla
prenotazione, senza pagante («Chi paga? →»), e col pagante appena
registrato dal pannello. Nessuno taglia.

Il pannello che si apre è **70 × 49,9 mm**, entra nello schermo, e non ha
nessun elemento sotto i **3,20 mm** di testo o gli **8,50 mm** di
bersaglio.

⚠️ **Più di una prenotazione non sfonda**: se ne mostra una e si dice
quante altre («+1»); i nomi sono troncati coi puntini, così un nome lungo
non manda a capo — ed è la ragione per cui la misura tiene.

---

## 4 — I pulsanti delle Scadenze (sua risposta 4)

«Finita» è bianco con bordo e ombra, «Buttata» rosso pieno con testo
bianco; tutti e due si abbassano sotto il dito. **8,5 mm** d'altezza, 34,6
e 38,9 mm di larghezza, **5 mm** di distanza fra loro — la distanza dei
gesti pericolosi, invariata.

⚠️ **Rispondevano già**, misurato: abilitati, col tocco attivo. Il difetto
era nell'aspetto — due rettangoli col bordo grigio chiaro in una schermata
fatta di rettangoli col bordo grigio chiaro — **ed è un difetto lo
stesso**: *«io stesso avevo creduto che non funzionassero»*.

✅ **Il numero delle risposte non è stato toccato**: due qui e sei in
«Fermi da troppo», com'era deciso ieri.

---

## Cosa abbiamo rovesciato

**Niente.** Nessuna decisione presa prima è stata cambiata in questa
consegna. Le due correzioni rifiniscono lavoro di stasera; la regola sulle
pulizie è nuova e non ne sostituisce nessuna.

---

## Cosa NON è verificato

- **Il ripristino vero della copia**, per la ragione e col costo scritti
  sopra.
- **Nessuna mano vera**: le misure e le prove sono state fatte guidando il
  browser sul progetto di prova. Il tablet vero non ha visto niente.
- **Il pannello «Chi paga» con la tastiera aperta** su un telefono: la
  tastiera copre parte dello schermo e non è stata simulata.
- **Il setaccio delle pulizie non ha ancora fermato nessuno**: ha preso
  solo i casi rotti apposta e lo script del danno, ricopiato.
- **Le lapidi sulla prova sono 412** e crescono a ogni giro della suite
  automatica: è la traccia normale delle prove su un database usa-e-getta,
  non un residuo di stasera (il mio ha lasciato **zero**).

---

## Cosa aspetta il via libera di Alessio

Invariato rispetto alla consegna precedente, e **fermo per sua decisione**
finché la copia non è fuori dal computer:

1. le **19 migrazioni del 23/08** già in attesa;
2. `20260823000020_il_cliente_del_tavolo.sql`;
3. `20260823000021_la_spesa_spicciola.sql`;
4. l'installazione del corridoio `operazioni-atomiche` in produzione,
   **insieme** alla `…020`.
