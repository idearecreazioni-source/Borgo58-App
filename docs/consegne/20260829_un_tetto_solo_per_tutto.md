# Un tetto solo per tutto l'assistente, e le mail illeggibili si dicono

**Blocco 4 del mandato del 29/08/2026 — le tre cose approvate e mai fatte.**
**Commit dichiarato: `f9765a8`** — working tree pulito al momento del commit.
**Migrazione introdotta: `20260829000003`.**
⚠️ **Applicata al progetto di prova, NON in produzione**: aspetta il push.

---

## Cosa abbiamo rovesciato

*Niente.* Tre decisioni di Alessio sono state **attuate**: il tetto unico da
dieci euro, l'avviso raggruppato una volta al giorno, la riaccensione del
lettore sulla prova. Nessuna voce in vigore è stata contraddetta.

---

## 4a — il tetto dei tentativi: era già fatto

Il mandato lo dava per aperto («il programma che legge la posta vera ce l'ha
ancora scritto dentro»). **Misurato: non è così.** `posta-leggi` chiama
`caricaTettoTentativi()` prima di usare il numero, e lo legge dal database.
Il 3 che sta nel codice è **il ripiego dichiarato** per il caso in cui
l'impostazione non si legga — cioè esattamente la garanzia che il mandato
chiedeva di mantenere.

⚠️ **Resta però vero a metà**, e la distinzione conta: il codice nel
repository non è quello che gira. La versione installata era **la 4**, di
ieri. Ora è **la 5** sul progetto di prova; in produzione va installata dopo
il push.

---

## 4b — un tetto solo, e la misura ha allargato il difetto

Le chiamate al modello si registrano in **quattro posti con tre forme
diverse**, e il tetto ne vedeva **due**:

| dove | cosa conserva | contata? |
|---|---|---|
| `letture_foto` | modello, token in, token out, **costo** | ✅ |
| `dettature` | modello, token in, token out, **costo** | ✅ |
| `domande_archivio` | modello, token in, token out, **nessun costo** | ❌ |
| `posta_ricevuta` | modello, **un solo numero di token** | ❌ |

🔴 **Quindi non era scoperta solo la posta**, che è ciò che il mandato
nominava: **anche l'archivio**. Due fonti su quattro spendevano senza che
nessuno le contasse e senza che niente le fermasse.

### «Senza che qualcuno debba ricordarsene»

È la parte che Alessio ha chiesto per nome, e non si ottiene sommando una
quarta riga — *è così che la posta è nata scoperta*. Sono due cose:

1. **`consumi_ai()`** — un posto solo dove si chiede quanto si è speso, che
   unisce le quattro fonti e calcola il costo dove manca;
2. **`fonti_ai_scoperte()`** — una rete che **legge il catalogo** e nomina
   qualunque tabella con modello e token che il conto non comprende. Non
   impedisce di dimenticare: **lo dice**, e basta perché non passino altri
   sei giorni in silenzio.

⚠️ **Un costo che non si sa non diventa zero.** Il listino conosce due
modelli e la posta usa `claude-opus-5`, che non c'è: quella spesa **non è
calcolabile**, e il totale **dichiara quante chiamate non ha potuto
valutare**. Uno zero lì si leggerebbe «non abbiamo speso niente», che su un
tetto di spesa è la bugia peggiore.

⚠️ **I due numeri, non la loro somma.** La posta conservava i token sommati:
domanda e risposta non costano uguale, quindi il costo non si poteva
ricostruire. Ora si conservano separati; la somma resta per le righe già
scritte, e per quelle il costo **resta dichiarato ignoto** invece di essere
inventato.

⚠️ **E il tetto lo guarda una funzione fatta apposta per chi non è un
utente.** `spesa_ai_del_mese` ha il portiere del titolare, e le funzioni
online girano senza utente: chiamandola avrebbero ricevuto un rifiuto, e chi
avesse scritto quel codice avrebbe concluso che il tetto non si può
guardare. È la trappola del 27/08. `tetto_ai_raggiunto()` risponde sì/no
senza dire nessun importo, ed è aperta al **solo ruolo di servizio**.
⚠️ E se la domanda non riesce, **la posta va avanti**: un tetto illeggibile
non deve spegnere il gestionale.

---

## 4c — le mail illeggibili, una volta al giorno

La condizione di Alessio: **un messaggio che le raggruppa tutte**, mai uno
per mail — *una raffica di notifiche è il modo più rapido per farsi
disattivare l'avviso*.

⚠️ Il freno generale degli allarmi è «uno per tipo **all'ora**», che qui
darebbe ventiquattro messaggi al giorno. Il tipo porta dentro la data — come
fa già l'avviso delle scadenze — e prima di mandarlo si guarda se per quel
giorno è già uscito.

⚠️ **Si guarda a ogni giro, anche quando non c'è niente da leggere**: le mail
su cui MEMO si è arreso restano ferme proprio quando la coda è vuota, ed è lì
che nessuno le guarderebbe più.

---

## 4d — il lettore riacceso sulla prova, e la diagnosi che l'ha sbloccato

Misurato: sul progetto di prova i lavori pianificati erano **zero**, e la
posta era ferma dal 22-23 agosto.

Riaccenderli non bastava, e la ragione è stata **letta nelle risposte HTTP
che il database aveva ricevuto**, non dedotta:

1. Prima: `{"code":"UNAUTHORIZED_LEGACY_JWT"}` — l'indirizzo delle funzioni
   mancava nel Vault della prova, quindi il ripiego puntava alla
   **produzione**, e la chiave della prova veniva respinta dal cancello.
   *È il difetto dichiarato il 10/08 e mai chiuso.*
2. Dopo aver messo l'indirizzo: `{"errore":"Chiamante non riconosciuto"}` —
   **401 in italiano**. ⚠️ E la lingua è il discriminante scritto in
   `CLAUDE.md`: *una risposta in inglese viene dal cancello, una in italiano
   dal gestionale*. Quindi la richiesta arrivava alla funzione giusta ed era
   la **parola d'ordine** a non corrispondere.
3. Allineata la parola d'ordine: **202, presa in carico**.

🔴 **E ho sbagliato il nome del segreto al primo colpo**: avevo dedotto
`BORGO58_FIRMA` e la funzione legge `NOTIFICHE_FIRMA`. Trovato **aprendo il
file**, non ragionandoci. Il segreto sbagliato è stato tolto.

✅ **Provato dal vivo, catena intera**: le tre mail ferme dal 23 agosto sono
state lette. E i **due token sono conservati separati** — 2961/95, 2959/93,
2959/65 — quindi la correzione del 4b funziona davvero, non solo nella
verifica. La spesa della posta ora entra nel totale del mese: **3 letture,
zero non calcolabili**, dove prima non compariva affatto.

⚠️ **Un effetto collaterale buono, e va detto perché non era cercato**:
finché l'indirizzo mancava, **gli allarmi del progetto di prova partivano
verso la produzione**. Ora restano dentro la prova — dove la funzione delle
notifiche non è nemmeno installata, quindi non raggiungono il telefono di
Alessio. Verificato leggendo quale funzione chiama `segnala_allarme` e
l'elenco di quelle installate, non dedotto.

---

## Rilettura

**Cosa NON ho verificato con gli occhi.** Nessuna immagine. **Nessun
messaggio Telegram è mai partito**: l'avviso delle mail illeggibili è provato
guardando la riga che nasce nella tabella degli allarmi, non un telefono che
squilla. **Il blocco per tetto raggiunto non l'ha visto nessun utente**: è
provato dentro la migrazione e chiamando la funzione, non aprendo la
schermata a tetto pieno.

**Cosa ho contato senza leggerlo.** Le quattro fonti di spesa vengono da un
setaccio sulle colonne (`modello`, `token`, `costo`): ho aperto le quattro
che sono uscite, non ho riletto tutte le tabelle. Il listino dei modelli l'ho
contato (due righe) senza giudicare se i prezzi siano aggiornati.

**Quali mie affermazioni sono diventate false mentre lavoravo.** Il messaggio
della verifica diceva «copre 2 fonti» e contava quelle **con righe** invece di
quelle **comprese** — cioè una fonte vuota sarebbe risultata coperta e una
dimenticata identica a una senza dati. Corretto, e il controllo ora conta le
fonti nominate nel corpo. E ho scritto che il 4a era «da fare» prima di
misurarlo: era già fatto nel codice.

**Quali conteggi sono pavimenti.** «Quattro fonti» è un pavimento: sono le
tabelle che oggi portano un modello e dei token. Una funzione online nuova
che spendesse senza registrare niente **non comparirebbe in nessun conto** —
la rete vede le tabelle, non le chiamate.

**Cosa ho lasciato sul progetto di prova.** La migrazione applicata; la
funzione `posta-leggi` alla versione 5; **l'indirizzo delle funzioni nel
Vault**, i **sei lavori pianificati accesi** e la **parola d'ordine allineata
nei Secrets** — tutte e tre volute, sono il punto 4d. Le tre mail lette
restano lette: sono dati di collaudo di Alessio, non miei. La mail di
verifica creata dalla migrazione è stata tolta con le sue lapidi.
