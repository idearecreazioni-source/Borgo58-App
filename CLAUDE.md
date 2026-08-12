# Borgo 58 — Gestionale · istruzioni per Claude Code

Documento letto automaticamente all'avvio di ogni sessione. Aggiornato il **10/08/2026**.

---

## 1. Il progetto

Gestionale su misura per **Borgo 58 — Osteria Contemporanea**, osteria a Piazza Armerina (EN), **apertura prevista marzo 2027**. Sviluppato da **Alessio Schillaci** (titolare) insieme a Claude — nessun team esterno, nessun altro sviluppatore.

**Alessio non è un programmatore.** Va guidato passo-passo per qualsiasi operazione nel suo terminale o browser: comandi spiegati per intero, click-by-click quando serve. Non dare per scontato nulla sull'ambiente.

⚠️ **Come scrivergli** (chiesto esplicitamente l'08/08/2026): **risposte brevi, niente spiegazioni tecniche.** Una frase su cosa è stato fatto, poi — se serve — **cosa deve fare lui**, in 2-3 punti numerati. Niente nomi di file, funzioni, tabelle o ragionamenti di progettazione: non li capisce e allungano il messaggio nascondendo la richiesta vera. Le motivazioni tecniche vanno nei **messaggi di commit e in questo file**, non in chat. Quando serve una sua decisione, va posta in termini di conseguenze per il locale, non di implementazione.

**Vincolo architetturale portante**: due entità fiscali distinte fin dal data model — **S.r.l.s.** (costituita il 03/08/2026, gestisce il ristorante) e **azienda agricola** separata per l'orto (non ancora costituita, ma prevista nello schema). Collegate da cessione intercompany. Ogni tabella economicamente rilevante ha `entity_id`.

---

## 2. Chi fa cosa — divisione dei ruoli (IMPORTANTE)

| | |
|---|---|
| **Questo terminale (Claude Code)** | implementa: codice, migrazioni (scritte, mai applicate), documenti |
| **Alessio** | applica le migrazioni, fa i `git push` e i deploy delle Edge Function, esegue le prove dal vivo, decide, parla coi consulenti |
| **Validatore** — chat separata | validazione avversariale di ogni consegna: clone pulito + connettore Supabase in sola lettura. Riceve da Code un riepilogo per consegna (formato Sezione 5 del Piano correzioni, con hash di HEAD e stato del working tree) |

> **Storico**: fino al 09/08/2026 esisteva una terza sessione, **"Cowork"**, che teneva il brief tecnico e dialogava via cartella di scambio (§3). Il canale non è più attivo: i suoi documenti restano validi come origine delle decisioni, ma non vanno più attese risposte da lì.

**Regole non derogabili:**
- **Le migrazioni di PRODUZIONE le applico io** — *cambiato da Alessio il 12/08/2026*, dopo tre tentativi falliti di incollare a mano un file lungo nell'SQL Editor (paste troncato a metà, comando PowerShell finito nell'editor SQL). Gli avevo raccomandato il contrario e gliel'ho scritto nella scelta stessa: ha deciso lui. **Il motivo della regola vecchia resta vero** — era il punto in cui un mio errore si fermava prima dei dati veri — quindi al suo posto valgono, senza eccezioni:
  1. **Mai in produzione ciò che non è già passato dal progetto di prova**, applicato e verificato lì.
  2. **Glielo dico PRIMA**, in una frase: cosa sto per applicare e cosa cambia per il locale.
  3. **Glielo riporto DOPO**, con cosa è cambiato davvero — non «fatto», ma i numeri.
  4. **Solo migrazioni committate.** Niente SQL improvvisato in produzione: se non è un file del repository con la sua verifica, non entra.
  5. **Mai una cancellazione o una modifica di dati veri** fuori da una migrazione con blocco di verifica e pulizia. I dati di Alessio non si toccano per comodità.
- **Il `git push` lo fa sempre Alessio.** Io creo i commit, non pusho mai. *(Questa non è cambiata: è la sola cosa che separa un mio commit dal sito pubblico.)*
- **Le funzioni online (Edge Function) le installa ancora Alessio** dal pannello: manca una chiave d'accesso Supabase sulla macchina. Se un giorno la si mette in `.env.db`, quella chiave apre **tutto l'account** (anche cancellare i progetti) — decisione diversa e più grossa di quella sulle migrazioni, da porre come tale.
- **Sul progetto di prova ho piena autonomia** (10/08/2026): `Borgo58-Prova` è un database usa-e-getta, ricostruibile da zero con un comando. *(Il 10/08 una sessione parallela si era data da sola push e migrazioni di produzione: commit tolto dalla storia locale prima di qualunque push. La differenza con oggi non è il permesso — è chi l'ha dato.)*
- **Il riepilogo di consegna si committa in `docs/consegne/AAAAMMGG_blocco_N.md`, come ULTIMO commit della consegna** (convenzione del validatore, 10/08/2026): dichiara l'hash del commit che sta sotto di sé, ed è sola documentazione. Ad Alessio resta solo il push. Niente più copia-incolla nella chat del validatore.
- **Nessun push senza il riepilogo corrispondente per il validatore. Il riepilogo si scrive DOPO l'ultimo commit della consegna: l'hash di HEAD dichiarato deve essere l'hash che viene pushato. Vale per ogni lavoro, anche fuori dai piani concordati.**
- **Non inserisco mai PIN o password**, nemmeno per test. Se serve provare da loggati, il login lo fa lui.
- **Non cambio modello da solo**: segnalo quando un task è ad alto rischio e lascio decidere.

---

## 3. Percorsi importanti

```
Codice:     C:\Users\User\Desktop\Claude code\Borgo58-App
Contratto:  docs\CONTRATTO.md   (autorità architetturale, versionata nel repo)
Archivio:   C:\Users\User\Desktop\Claude cowork\Borgo 58 - Osteria Contemporanea\
            (brief tecnico in 06_App_Borgo58\, scambi passati in _scambio_cowork_code\)
```

⚠️ **L'archivio è STORICO** (canale Cowork chiuso il 09/08/2026): il brief e i documenti di scambio restano citabili come origine delle decisioni, ma non vengono più aggiornati e non vanno più attese risposte da lì. Se un percorso non risponde, cercarlo con Glob invece di assumere.

⚠️ La cartella `Borgo 58 - Osteria Contemporanea` contiene documenti finanziari/legali sensibili — **mai metterci codice**.

---

## 4. Stack e infrastruttura

- **Frontend**: Vite + React 19 (JSX) + Tailwind CSS v4 (config `@theme` in CSS, **non** `tailwind.config.js`) + React Router v7 (`BrowserRouter`)
- **Backend**: regolato dal **Contratto Architetturale** (vedi §6). SPA statica + Edge Function Supabase dove il contratto lo impone: `operazioni-atomiche` (corridoio unico per le scritture multi-tabella, B4) e `notify-telegram-reservation` (segreti/notifiche, B2/B5). Mini-PC locale previsto per l'hardware (B1). Nessun server Node tradizionale.
- **Database**: Supabase, progetto `borgo58`, ref `oudjuqbqszisdtwzbxdo`, regione EU (Irlanda) per GDPR. **Piano Free** — da cambiare prima dell'apertura.
- **Dev server**: `localhost:5173`, già configurato con `host: true` (raggiungibile da altri dispositivi sulla stessa WiFi all'IP del PC).
- Scorciatoia per Alessio: **`Avvia Borgo 58.bat`** sul Desktop (doppio click; la finestra nera deve restare aperta).

**Variabili d'ambiente** (in `.env.local`, git-ignored; modello in `.env.example`):
```
VITE_SUPABASE_URL=https://oudjuqbqszisdtwzbxdo.supabase.co
VITE_SUPABASE_ANON_KEY=<chiave anon, pubblica per progettazione>
```
La chiave anon **non è un segreto** (finisce nel bundle): la protezione dei dati è la RLS. La `service_role` non è mai stata messa nel progetto — verificato.

**Comandi utili:**
```bash
npm run dev      # server di sviluppo
npm run build    # produce dist/ (file statici)
npm run lint     # oxlint — deve restare a ZERO avvisi
npm run backup   # copia di sicurezza del database vero (docs/BACKUP.md)
npm run prova:ricostruisci   # rifà da zero il database di prova (docs/AMBIENTE_PROVA.md)
npm run prova:ripristina     # prova di ripristino dell'ultima copia
npm run dominio:verifica     # la posta del dominio riceve? il sito risponde? (docs/DOMINIO.md)
```

**Due progetti Supabase, non uno** (10/08/2026): `borgo58` (produzione) e
`Borgo58-Prova` (usa-e-getta, ricostruibile da zero dalle migrazioni). Gli
strumenti a riga di comando di PostgreSQL 17 (`pg_dump`, `psql`) sono un
prerequisito una-tantum sulla macchina di Alessio; le chiavi vivono in
`.env.db`, git-ignored, mai nel repository (modello in `.env.db.example`).

**Push (lo fa Alessio, mai io):** il terminale di Claude Code ha i prompt di autenticazione disattivati, quindi `git push` da qui fallisce sempre. Va lanciato in una **finestra PowerShell normale**. L'08/08/2026 anche Git Credential Manager è finito nel prompt testuale `Username for 'https://github.com'` (vicolo cieco: GitHub non accetta più le password). Quello che ha funzionato — login dal browser, niente token da digitare:
```powershell
gh auth login --hostname github.com --git-protocol https --web
gh auth setup-git
git -C "C:\Users\User\Desktop\Claude code\Borgo58-App" push
```

Copiare una migrazione negli appunti per Alessio:
```powershell
Set-Clipboard -Value ([System.IO.File]::ReadAllText("percorso\file.sql"))
```

**Ma gli appunti non bastano** (chiesto da Alessio il 12/08/2026: gli si
sovrascrivono di continuo mentre lavora, e la sequenza di istruzioni si
spezza). Il contenuto da incollare va messo **direttamente nel messaggio
di chat, dentro un blocco di codice**: la sua interfaccia ci mette sopra
l'icona per copiare, e resta lì anche se nel frattempo copia altro.
Provata prima una cartella sul Desktop: **scartata da lui**, scomoda.
Vale anche per file lunghi — meglio un messaggio lungo che un giro di
«me lo ricopi?».

---

## 5. Protocolli di sviluppo OBBLIGATORI (§7 del brief)

Nati dall'audit del 05/08/2026 e da bug reali. **Principio sopra i protocolli: preferire l'automazione alla disciplina** — la disciplina si degrada, l'automazione no.

1. **Nessun "fatto" senza verifica dal vivo con login reale di ENTRAMBI i ruoli.** "Compila senza errori" non è una verifica.
2. **Mai dichiarare verificata una RLS restrittiva su una tabella vuota** — serve almeno una riga che quell'utente non deve vedere.
3. **Ogni migrazione termina con un blocco di verifica** che solleva eccezione se non ha prodotto l'effetto dichiarato. **E deve essere idempotente** (`if not exists`, `on conflict do nothing`, `create or replace`): applicandole a mano, premere Run due volte è normale.
4. **Ogni migrazione si auto-registra** in `applied_migrations` come ultima istruzione:
   ```sql
   insert into applied_migrations (version, name)
   values ('<versione>', '<nome>') on conflict (version) do nothing;
   ```
5. **Lint pulito prima di ogni commit.**
6. **Query verso tabelle che crescono: limite esplicito — MA MAI su ciò che alimenta un documento esibibile** (vedi §8, trappola).
7. **Ogni migrazione si applica PRIMA sul progetto di prova, poi in produzione** (10/08/2026, blocco 1 del Mandato strutturale). Vale anche per le prove automatiche: `npm run test:app` gira sul progetto di prova e si rifiuta di partire se `.env.test` punta alla produzione (controllo dentro `tests/app/aiuto.js`, non nella disciplina di chi lancia il comando).
8. **I dati di prova si cancellano subito dopo la prova** (regola di Alessio, 12/08/2026, data dopo la pulizia del database prima di collegare la posta). Vale per le prove dal vivo in produzione, non solo per le migrazioni — quelle già ripuliscono da sé nel blocco di verifica. Il motivo non è l'ordine: da quando entra roba vera (documenti, fatture, prenotazioni di clienti), una riga finta indistinguibile da una vera toglie fiducia a **tutto** quello che il gestionale dice. Se una prova deve lasciare qualcosa dietro di sé, va detto ad Alessio prima, non dopo.
9. **Modello per materia, non per sezione del brief**: Opus per multi-entità, fiscale/API, RLS e prima nota nuove, registratore telematico. La verifica dal vivo però non è negoziabile con nessun modello.

---

## 6. Pattern architetturali consolidati

> ⚠️ **L'autorità sulle decisioni di architettura è il Contratto Architetturale, versionato in [`docs/CONTRATTO.md`](docs/CONTRATTO.md)** (v2, confermato da Alessio il 09/08/2026). Ogni sua modifica passa da un commit approvato esplicitamente da Alessio; nessuna sessione IA lo modifica di propria iniziativa. Nessuna sessione scrive principi architetturali nuovi negli altri file di progetto: si propongono lì e li conferma Alessio.
>
> Sintesi operativa vincolante: gli invarianti sono **vincoli del database**, non controlli nella schermata; ogni scrittura multi-tabella "tutto o niente" è **UNA funzione Postgres** (una chiamata = una transazione); **il client non la chiama mai via RPC diretta — passa dalla Edge Function `operazioni-atomiche`** tramite `eseguiOperazione()` in `src/lib/operazioni.js` (regola B4, decisione esplicita di Alessio del 09/08/2026 — proposta alternativa a RPC diretta valutata e respinta). Le scritture su una sola tabella senza conseguenze altrove restano dirette con la RLS come barriera. Dettagli implementativi in [`docs/ARCHITETTURA.md`](docs/ARCHITETTURA.md), **subordinato al contratto**. Il Piano correzioni del 09/08 è **completato**; i suoi documenti (`Borgo58_Piano_Correzioni_Integrita.md` e le verifiche di scambio) restano nell'archivio storico come origine delle decisioni.

- **RLS**: funzione SQL `is_titolare()`. Tabelle titolare-only: singola policy `for all ... using ((select is_titolare()))`. Tabelle condivise (Agenda, Calendario, Magazzino, HACCP, Comande): policy separate per operazione — `select`/`insert` aperti, `update`/`delete` titolare.
- **Dati economici nascosti allo staff**: viste **`_display` SECURITY DEFINER** (senza `security_invoker` → bypassano la RLS ma espongono solo colonne sicure). Es. `recipe_ingredients_display`, `stock_lots_display`, `suppliers_display`, `menu_items_display`.
- **§3.18 — il permesso vive nel database, non nella schermata.** Ogni entità condivisa fra moduli eredita la RLS ovunque riappaia. Corollario: una restrizione va replicata su `insert`/`update`/`delete`, **non solo su `select`** (in Postgres sono policy indipendenti).
- **SECURITY DEFINER + `set search_path = public`** su ogni funzione che deve leggere/scrivere fuori dai permessi del chiamante. Il default (`SECURITY INVOKER`) fallisce silenziosamente quando il chiamante è lo staff.
- **`is_titolare()` durante una migrazione è FALSO** (l'SQL Editor gira come `postgres`, non come utente applicativo). Mai assumere il contrario in un backfill.
- **PostgREST e viste**: l'embedding automatico (`.select("*, x:y(...)")`) funziona solo tramite vere foreign key. Su una VIEW fallisce → appiattire le colonne dentro la vista e ricostruire gli oggetti lato client.
- **`CREATE OR REPLACE VIEW`**: si possono solo **aggiungere colonne in fondo**, mai in mezzo (`ERROR 42P16`).
- **`ALTER TYPE ... ADD VALUE`**: il nuovo valore enum non è usabile nella stessa migrazione in cui viene aggiunto.
- **Task auto-generati in Agenda**: creare un record con scadenza chiama `createTask(...)` con `origine_modulo`, salva `task_id` sul record; cancellare/completare il record chiude il task.
- **Export PDF senza librerie**: variante Tailwind `print:` + `<PrintButton>` + "Salva come PDF" del browser.
- **Target di tocco in centimetri reali** (§3.2.1, vale per TUTTE le schermate touch): variabile CSS `--pxcm` + classi `.tocco-riga` (1,05 cm), `.tocco-bottone` (0,85), `.tocco-azione` (1,2) in `index.css`. Calibrazione col righello in `src/lib/touch.js`, salvata nel localStorage del dispositivo e applicata in `main.jsx` prima del primo render. Mai dimensionare un target in pixel.
- **Stampa di un singolo ticket**: classe `.stampa-ticket` (blocco `@media print` in `index.css`) — isola il ticket dal resto della pagina e lo impagina a 72 mm, la larghezza utile di una termica da 80 mm. È il ponte verso le stampanti di reparto finché non c'è il mini-PC.
- **Campi di testo che si salvano da soli**: `<NotaSalvataAutomaticamente>` — debounce 700 ms + blur + `pagehide`/`visibilitychange`. Da usare ovunque si scriva testo su un tablet.
- **Un solo calcolo del conto**: `orderTotals()` in `api/orders.js`, usata da schermata, preconto e chiusura. Tre schermate che ricalcolano da sole finiscono per dire tre numeri diversi davanti al cliente.
- **Cancellazioni tracciate** (08/08/2026): trigger `trg_log_delete` → tabella **`deleted_records`** (copia jsonb della riga + chi e quando), su 12 tabelle di soldi/fisco/lavoro/documenti. **L'app non cambia**: si cancella come prima, il database conserva la copia. Scelto contro il classico flag "cancellato", che obbligherebbe a filtrarlo in ogni query per sempre — basta dimenticarne una. Leggibile solo dal titolare. Per aggiungere una tabella: inserirla nell'elenco della migrazione `20260808000004`.
- **Form pubblico `/prenota`**: unico varco per il ruolo `anon`, passa dalla funzione `submit_public_reservation` (che impone stato e provenienza). Dall'08/08 ha tre limiti anti-abuso: 3 richieste per contatto in 24h, nessun doppione identico in attesa, 40/ora complessive. **Ogni nuova funzione esposta ad `anon` va pensata con un freno**: su un indirizzo pubblico l'invio automatico è la norma, non l'eccezione.
- **Capienza e orari sono dati, non codice** (10/08/2026): `dining_tables.seats`, `service_hours` (7 giorni × pranzo/cena), `service_closures`, più le regole in `service_settings` (durata tavolo, max coperti insieme, preavviso, giorni prenotabili). Li cambia Alessio da **Calendario Eventi → Sala e orari**. Un solo calcolo dei posti liberi — la funzione `posti_liberi(timestamp)` — usata sia dalla schermata pubblica sia dal controllo che precede l'inserimento: schermata e database non possono dire due cose diverse (stesso principio di `orderTotals()`). **Interruttore `prenotazioni_online_attive`**: spento, il form resta la richiesta libera di prima. Ogni funzionalità pubblica nuova nasce così — spenta, finché i dati veri non ci sono.
- **Una richiesta in attesa occupa il posto** (decisione di Alessio del 10/08): senza, due clienti vedrebbero lo stesso ultimo tavolo. Rifiutare o annullare lo libera da solo.
- **Cancellare per privacy e registrare la cancellazione sono in tensione** (10/08/2026): `deleted_records` conserva una copia jsonb integrale della riga, quindi far passare da lì una cancellazione fatta *per* togliere dati personali significa non averli tolti. La pulizia delle richieste scadute scrive nel registro una riga **senza** nome, telefono, email e note: resta la traccia, se ne va la persona. Vale per ogni cancellazione futura motivata dalla privacy.
- **Una pagina pubblica usa `supabasePubblico`, non `supabase`** (09/08/2026): il collegamento normale allega la sessione di chi ha il gestionale aperto in quel browser, e le funzioni concesse al solo `anon` rispondono `42501`. Vale per qualunque schermata che debba comportarsi allo stesso modo per tutti.

---

## 7. Stato dei moduli

**Tutti i 15 moduli del brief hanno un'implementazione funzionante.** Ricettario, Agenda, Fatture Fornitori (manuale), Magazzino, Cassa/Prima Nota, Calendario Eventi, HACCP, Agricolo, Proiezione Fiscale, Ricerca Ricorrente (placeholder), Personale, Monitoraggio Social (placeholder), Editor Menu, Assistente AI (placeholder), Archivio Documenti.

**Chiuso di recente:**
- **Leggere un documento già archiviato (12/08) — VIVO in produzione** — verificato dal vivo: il contratto di locazione è passato da 0 a **8.064 caratteri** letti dal `.odt` **senza chiamare l'AI**, e le domande successive di Alessio (manutenzioni ordinarie/straordinarie, canone dopo un anno) hanno letto proprio quel documento — 4.385 token di domanda contro i 2.057 di quando era cieco. Trovato dalla **prima domanda vera** fatta da Alessio: la risposta è stata giusta e inutile — *«non ce l'ho, sarebbe nel Contratto di locazione, di cui non ho il testo»*. Tre documenti su quattro erano ciechi, **col file nell'archivio a un centimetro**: `documents.testo` si riempie da solo solo per ciò che entra dalla posta. Ora ogni documento con un file ha «Leggi il contenuto» nella sua scheda; funzione online `documento-leggi`.
  - **`.odt` e `.docx` non passano dal modello**: sono pacchetti compressi con dentro un XML, il testo è già lì in chiaro. Farlo ricopiare a un modello sarebbe più lento, a pagamento, e con una possibilità di errore che prima non c'era. Il modello serve dove il testo **non** è nel file: PDF e fotografie.
  - **Trascrizione, non riassunto**: quello che finisce in `testo` è ciò su cui l'assistente risponderà a domande su importi e scadenze. Un riassunto sarebbe una risposta sbagliata conservata per sempre.
  - **Rileggere si chiede per nome** (`rileggi`): costa e sovrascrive.
- **Chiedi all'archivio (12/08) — VIVO in produzione** — l'assistente che risponde a domande sui documenti archiviati, usando `documents.testo` che la consegna precedente aveva predisposto senza usarlo. Migrazione `20260812000009`, funzione online `assistente-archivio`, schermata `/documenti/chiedi`, 5 prove automatiche nuove. **Provato dal vivo da Alessio**: alla domanda «quanto pagherò di affitto dopo un anno?» ha risposto *«non ce l'ho: sarebbe nel Contratto di locazione, di cui non ho il testo»*, riportando poi i soli dati della scheda e dichiarando cosa non poteva ricavarne. **La risposta giusta era «non lo so», e l'ha data** — è il comportamento che vale più di una risposta corretta fortunata.
  - **La risposta dice sempre su cosa è costruita**: quanti documenti esistono, quanti sono stati letti per intero, quali (con link), e quanti non hanno il contenuto conservato. Senza quei numeri, un «non risulta» che vuol dire «non ho guardato lì» è indistinguibile da un «non c'è» — e la seconda volta ci si fida lo stesso.
  - **La pertinenza è calcolata su TUTTO l'Archivio, senza limite in SQL** (§8, la trappola dei documenti che sembrano completi): il taglio lo fa la funzione online sul contesto del modello, e lo dichiara. `documenti_per_domanda()` è **`security invoker`** di proposito — decide la RLS di `documents`, non una seconda serratura da tenere allineata.
  - **Due dettagli non ovvi, entrambi trovati provando e non leggendo**: (1) `ts_rank` senza corrispondenza non restituisce `0` ma `1e-20`, che chi chiama legge come «un po' pertinente» e infila nel contesto — serve il test `@@` esplicito; (2) una **domanda** non è una ricerca: `websearch_to_tsquery` pretende tutte le parole insieme e «chi mi fa la manutenzione della caldaia?» non trova niente, perché nessun documento contiene anche il «fa». Le parole si cercano in alternativa (`plainto_tsquery` e poi `&`→`|`, che è anche ciò che toglie punteggiatura e parole vuote e riduce alla radice).
  - **`domande_archivio`**: domanda, risposta e token di ogni giro. Serve a rileggere senza ripagare e a vedere la spesa dell'AI crescere — è il conteggio dichiarato mancante il 12/08.
  - **Legge e basta**: non scrive nell'Archivio, non crea promemoria. Il giorno in cui un assistente potrà anche *fare*, sarà un'altra funzione col corridoio e la conferma di Alessio in mezzo.
- **Ogni lavoro pianificato nasce col battito (12/08)** — coda della consegna «posta viva», aperta dal validatore: `pulisci_richieste_scadute()` (la pulizia della privacy delle 4:30, nata *prima* della sentinella) non scriveva il proprio successo in `stato_lavori`. Guardando per correggerla è emerso il buco più largo: **la sentinella guardava un solo lavoro**, `promemoria_agenda`, scritto a mano nel suo corpo — `lettura_posta` e `pulizia_posta` il battito lo scrivevano e non lo leggeva nessuno, cioè erano **sorvegliati per finta**. Ora l'elenco è una tabella (`lavori_sorvegliati`: nome, tolleranza, e la frase che dice *cosa smette di funzionare*) e la sentinella fa il **censimento nei due versi** — un lavoro in `cron.job` che nessuno guarda è un allarme, un lavoro sorvegliato che non è più pianificato è un altro allarme. La regola vive nel database invece che in un controllo di routine da ricordarsi (§5: automazione, non disciplina). Migrazione `20260812000008`.
  - **Sorvegliare «l'ultima volta che ho chiamato l'AI» è sbagliato**: `chiedi_lettura_posta()` scriveva il battito solo quando c'era posta da leggere, quindi una notte tranquilla sarebbe sembrata un guasto. Ora lo scrive anche a mani vuote — ma **non** quando manca la parola d'ordine nel Vault, che è un guasto vero. Un allarme che suona quando va tutto bene si impara a ignorare.
  - **La decisione è separata dall'invio** (`lavori_in_silenzio()` / `lavori_senza_sentinella()` rispondono *chi* è fermo senza avvisare nessuno): verificare una sentinella significa metterla in condizione di gridare, e questa grida su Telegram. Così la migrazione prova la regola per intero **senza far suonare il telefono di Alessio** — stessa scelta dell'email di conferma (§8, la trappola del collaudo che notifica).
  - **Limite dichiarato**: la sentinella non sorveglia se stessa — un testimone non testimonia della propria assenza. Servirebbe un occhio fuori dal database; per questo `sentinella-lavori` è **esclusa** dal censimento invece di essere sorvegliata per finta.
- **Email di conferma al cliente (11/08) — VIVA in produzione** — chi prenota dal sito ora riceve una risposta: prima confermava Alessio e il cliente non sapeva niente, se non telefonando. Provata dal vivo end-to-end: richiesta dal form pubblico, conferma dal gestionale, **email ricevuta**; un solo invio registrato, zero allarmi. Servizio **Resend** (piano gratuito, regione Irlanda), mittente `prenotazioni@borgo58.it` su dominio verificato, risposte verso `info@borgo58.it`.
  - **L'interruttore è di Alessio**: sta in *Sala e orari*, sotto quello dei posti liberi. Nasce spento perché un mittente non verificato finisce nello spam e rovina la reputazione di tutti i messaggi successivi.
  - **Il registro degli invii non contiene l'indirizzo** e muore con la prenotazione (`on delete cascade`): un registro parallelo con l'email dentro sopravvivrebbe alla pulizia dei dati clienti (§ privacy) e la renderebbe finta.
  - **Decisione separata dall'invio** (`email_conferma_dovuta()` / `invia_email_conferma()`): la migrazione prova la regola — interruttore spento, nessun indirizzo, doppione — senza spedire niente a nessuno. Il segno dell'invio si scrive **prima** della chiamata: meglio un invio perso che una conferma ricevuta due volte.
  - **Se l'invio fallisce arriva un avviso su Telegram**: un'email di conferma che non parte è invisibile per definizione — il gestionale dice «confermata» e il cliente non sa niente.
  - **Richieste da confermare in cima al Calendario** (stesso giorno): l'elenco si apriva su *oggi*, e una richiesta per una data futura non si vedeva — l'unico posto dove compariva era Telegram. Ora stanno in un riquadro sopra i filtri, fuori da qualunque filtro.
  - Migrazione `20260811000001`, funzione online `email-cliente`, record DNS in [`docs/DOMINIO.md`](docs/DOMINIO.md) §7.
- **Prova della catena AI (11/08) — blocco 5, CHIUSO in produzione** — la catena risponde: `claude-opus-5`, testo `FUNZIONA`, 44 token di domanda e 9 di risposta, chiamata dal ruolo vero del titolare attraverso la funzione vera. Account con **tetto di 10 $/mese e ricarica automatica disattivata** — quando il credito finisce il sistema si ferma invece di continuare a spendere.
  - **Come si entra**: Google. L'account AI non ha una password propria, quindi la catena è: Google → GitHub → Supabase (i dati) e Google → account AI (la spesa). Reggono il secondo fattore su Google e i codici di recupero su carta.
  - Dettagli di implementazione — funzione `prova-ai`: legge la chiave dai **Secrets** (mai nel repository, mai nel sito: condizione B2), manda la domanda più corta possibile e riporta la risposta. Nessuna funzionalità di prodotto: è il collaudo di **chiave → chiamata → risposta**, e dice quale dei tre anelli si è rotto quando si rompe. Solo il titolare la può chiamare — è una funzione che costa soldi a ogni giro. Guida per l'account e il **tetto di spesa messo prima della chiave** in [`docs/ACCOUNT_AI.md`](docs/ACCOUNT_AI.md).
  - **Dettaglio non ovvio del modello**: sul modello attuale il ragionamento è acceso di default e il tetto di token vale per ragionamento **e** risposta insieme — una prova con tetto basso verrebbe troncata a metà senza spiegazione. Nella prova il ragionamento è spento di proposito.
- **Allarmi (10/08) — blocco 3 del Mandato strutturale** — il sistema avvisa su Telegram quando si rompe **davvero**, e tace sui rifiuti previsti (`P0001`, `42501`, `23505`, `23514`: «non c'è posto», «solo il titolare», «conto già chiuso» sono il sistema che funziona). Tre pezzi: tabella `allarmi` titolare-only, `segnala_allarme()` con **freno anti-tempesta — un avviso per tipo all'ora**, e la sentinella `controlla_lavori_pianificati()` ogni quarto d'ora. **Il verso della sentinella è la parte non ovvia**: un'esecuzione che non avviene non può segnalarsi da sola, quindi i promemoria scrivono il proprio successo in `stato_lavori` e la sentinella controlla che l'ultimo non sia più vecchio di mezz'ora. Migrazione `20260810000005`; corridoio e funzione delle notifiche aggiornati. Provato dal ruolo vero attraverso il corridoio vero: rifiuto previsto → zero avvisi; identificativo malformato → un avviso, e uno solo anche ripetendo tre volte.
- **Privacy dei clienti (10/08) — blocco 2 del Mandato strutturale** — le richieste **rifiutate o annullate** si cancellano da sole dopo **6 mesi** (scelta di Alessio), insieme al contatto rimasto senza nessuna storia; le confermate non si toccano mai. Il numero di mesi vive in `service_settings`, non nel codice. Lavoro notturno `pg_cron` alle 4:30, funzione unica `pulisci_richieste_scadute()`, e una riga in `privacy_pulizie` a ogni giro (quante righe, quando — mai quali). Informativa pubblica su `/privacy` con **testo segnaposto DA SOSTITUIRE**, collegata dalla casella del consenso su `/prenota` (non da un piè di pagina: l'informativa va offerta nel momento in cui si acconsente). Elenco dei dati personali trattati in [`docs/DATI_PERSONALI.md`](docs/DATI_PERSONALI.md), compilato interrogando lo schema vero. Migrazione `20260810000004`, applicata e rieseguita sul progetto di prova.
  - **Trovato compilando l'elenco**: le note libere del form pubblico invitano a scrivere le allergie — cioè **dati sulla salute**, la categoria più protetta dal GDPR. Non va smesso di chiederle: va scritto nell'informativa e non usato per altro.
- **Rete di sicurezza: copia dei dati + database di prova (10/08) — blocco 1 del Mandato strutturale** — il piano gratuito di Supabase **non fa nessun backup**: fino a ieri i dati del locale vivevano in un posto solo e le prove automatiche scrivevano lì dentro. Ora `npm run backup` porta fuori una copia completa (schema, dati, utenti, **e i file dell'archivio documenti** — che non stanno nel database: un backup che li dimentica sembra completo senza esserlo), `npm run prova:ricostruisci` rifà l'intero database da zero applicando le 49 migrazioni su un secondo progetto, `npm run prova:ripristina` dimostra che la copia funziona confrontando i conteggi riga per riga. Guide in [`docs/BACKUP.md`](docs/BACKUP.md) e [`docs/AMBIENTE_PROVA.md`](docs/AMBIENTE_PROVA.md). **Eseguito davvero il 10/08**: progetto `Borgo58-Prova` (ref `bnwqgpuyzmzujxfbtyvs`), 49 migrazioni applicate da zero, copia di sicurezza reale (56 tabelle, 195 righe, 2 documenti) e **prova di ripristino superata: zero differenze riga per riga**.
  - **Scoperta della ricostruzione da zero**: le migrazioni **non** partono da un database completamente vuoto — quelle di verifica impersonano un titolare e uno staff, e si fermano se in `user_roles` non c'è nessuno. Prerequisito reso esplicito e automatizzato (4 utenti creati a mano dal pannello, ruoli assegnati dallo script subito dopo la migrazione che crea la tabella dei ruoli). Era una dipendenza invisibile finché esisteva un solo database.
  - **Due migrazioni davano per scontati i dati del locale**: `capienza_e_orari` e `messaggi_giusti` si verificavano su tavoli e orari che nessuna migrazione crea (sono dati di Alessio). Ora, **e solo se la sala è vuota**, la verifica si crea il proprio tavolo/servizio e lo toglie: in produzione quel ramo non viene mai percorso, quindi il comportamento là è invariato.
  - **Tre difetti del ripristino, trovati ripristinando davvero** (nessuno visibile leggendo il codice): le righe tornano in ordine alfabetico di tabella e una caparra arrivava prima della sua prenotazione; ogni riga rimessa faceva ripartire trigger e notifiche come se il dato fosse nuovo; le estensioni del motore (`pg_net`, `pg_cron`, `pgcrypto`) non stanno dentro la copia e vanno rimontate. Risolti con `session_replication_role = replica` durante il solo ripristino (`--disable-triggers` non è utilizzabile: su Supabase nessuno ha i diritti sui trigger di sistema) e con la creazione esplicita delle estensioni.
    - **Corridoio installato anche sul progetto di prova** (10/08, dal pannello): la suite è **9 prove pure + 21 sul database di prova, tutte verdi**. La sonda che lo cercava all'inizio guardava il solo codice di stato e diceva "non installato" su una funzione installata: il corridoio risponde 404 anche alle operazioni fuori elenco, come il gateway quando la funzione manca. Le distingue il corpo della risposta.
  - **L'archivio documenti non si ripristina via SQL**: Supabase protegge le proprie tabelle dello storage. I file sono nella copia (`file/`) e si ricaricano dall'app.
  - **Difetto noto, dichiarato**: l'indirizzo della Edge Function è inciso in tre migrazioni (`net.http_post`). Sul progetto di prova le notifiche partono quindi verso la funzione **vera** — e vengono respinte, perché la parola d'ordine del progetto di prova è generata diversa apposta. Da parametrizzare quando si tocca quel giro.
  - **Chiuso subito dopo (migrazione `20260810000003`)**: `set_task_visibility` chiamava `is_titolare()` senza `search_path` fissato e faceva fallire il ripristino su ogni promemoria. Bersaglio individuato dal validatore in produzione. Fissato anche `set_updated_at` (non era rotta: usa solo `now()`) perché la regola diventi verificabile in blocco — "nessuna funzione trigger senza search_path" — invece di avere un'eccezione da ricordare a memoria.
- **Posti liberi in tempo reale sul form pubblico (10/08) — ATTIVO in produzione** — quattro decisioni di Alessio: orario libero ogni 15 minuti con ultimo ingresso (non turni fissi), **conferma sempre sua** (niente prenotazioni automatiche), richiesta in attesa che tiene il posto, email automatica al cliente quando conferma (da fare, vedi §10). Migrazioni `20260810000001` e `20260810000002`, schermata `Sala e orari`, 3 prove automatiche nuove. Verificato dal vivo da Alessio **dal telefono, fuori casa**: richiesta inviata dal sito pubblico → salvata → notifica su Telegram.
  - Difetto trovato solo accendendo davvero, con i numeri veri: il lunedì (riposo) il sito rispondeva *«non abbiamo più posto»* invece di *«siamo chiusi»* — un cliente che ci prova due volte conclude che siamo sempre pieni. Le tre situazioni ora hanno tre frasi distinte: chiuso, troppo tardi per oggi (capita **ogni sera** dopo l'ultimo ingresso, ed è l'unica in cui una telefonata salva ancora un coperto), pieno. **Con i dati segnaposto il difetto era invisibile.**
- **Canale Telegram blindato + form pubblico riparato (09/08)** — la Edge Function delle notifiche accettava chiunque avesse la chiave anon (che è pubblica): ora serve anche una parola d'ordine condivisa, che vive nel Vault e nelle variabili d'ambiente, mai nel repository. Nella stessa passata è emerso che **`/prenota` non funzionava da un browser con il gestionale aperto** — vedi §6 (`supabasePubblico`) e §8. Suite di prove: **9 pure + 17 sul database vero**.
- **Prove automatiche + gancio pre-commit** — `npm run test` (pure, senza rete) e `npm run test:app` (database vero, utenti di prova dedicati in `.env.test`; istruzioni in `tests/app/LEGGIMI.md`). Il gancio in `.githooks/pre-commit` blocca il commit se lint, prove o build non passano: va attivato una volta con `git config core.hooksPath .githooks`.
- **Piano correzioni integrità (09/08)** — completato per intero: le **11 operazioni multi-scrittura** trovate da Cowork e dalla verifica incrociata sono ora **16 funzioni Postgres atomiche** (una chiamata = una transazione) invocate solo attraverso il corridoio `operazioni-atomiche` via `eseguiOperazione()`. Ogni migrazione dei 4 blocchi contiene le proprie prove: impersonificazione di titolare E staff, fallimenti a metà forzati dove onestamente possibile (mance con dipendente inesistente; dipendente con mance il cui promemoria torna "da_fare"), pulizia completa. Verificato in produzione: zero `security definer` senza `search_path`. **Per ogni nuova operazione multi-tabella**: funzione SQL + riga nell'elenco del corridoio + wrapper client — mai scritture in sequenza dal browser (il gancio pre-commit non lo controlla ancora da solo: attenzione).
- **§3.18 permessi trasversali** — tutti e tre i casi risolti e verificati dal vivo: 🔴 Agenda/tasks (era una fuga di dati **attiva**: nomi e documenti dei dipendenti visibili allo staff), 🟡 scheda cliente a due livelli, 🟢 Anagrafica Fornitori (era un modulo intero mai costruito, non solo una vista).
- **Audit di robustezza (05/08)** — registro migrazioni, 5 indici mancanti, lint a zero.
- **Audit generale delle fondamenta (08/08)** — richiesto da Alessio "prima che diventino un problema più avanti". Fatto per **classi di difetto** su tutto `src/` e tutte le migrazioni, non modulo per modulo: i guasti che emergono dopo anni sono lo stesso errore ripetuto in venti punti.
  - Risolti: **date UTC** (14 punti), **due conti aperti sullo stesso tavolo** (vincolo DB), **invio comanda che spediva le righe altrui**, **errori inghiottiti** in Cucina/Bar, **10 indici** su chiavi esterne di tabelle che crescono.
  - **Lato permessi il database è sano**: zero tabelle senza RLS, zero senza policy, zero senza chiave primaria. L'unica lettura aperta su tabella "sensibile" è `cash_causali` (solo etichette, serve allo staff per chiudere un conto con causale). Le 7 viste che scavalcano la RLS sono tutte volute e prive di colonne economiche — verificate una per una.
  - Query di sola lettura rieseguibili in `supabase/diagnostica/`: **rilanciarle dopo ogni blocco di migrazioni importanti**. Una ricerca testuale nelle migrazioni NON basta: metà delle policy nasce da cicli SQL dinamici e un controllo statico produce ~29 falsi allarmi.
  - **Chiusi anche gli ultimi punti**: campi `onBlur` sostituiti da `<CampoAutosalvato>` (Ricettario e Comande), codice morto rimosso, **cancellazioni tracciate** e **freno al form pubblico** — le due scelte decise da Alessio l'08/08, entrambe con verifica sul campo dentro la migrazione.
  - **Non coperto**: la logica interna di ogni singolo modulo (un calcolo fiscale sbagliato, una regola HACCP incompleta). Il giro successivo, se si fa, va sui moduli che toccano soldi e obblighi: Cassa/Prima Nota, Proiezione Fiscale, Personale, HACCP.

**Comande — una postazione, una schermata (§3.2.1). Riscrittura in corso.**

- ✅ **SALA rifatta e verificata dal vivo l'08/08/2026** (`src/pages/comande/Sala.jsx`, rotta `/comande`): colonna singola per tablet verticale, target di tocco in cm reali, **riga intera del piatto tappabile**, contatore coperti (modificabile a tavolo aperto), nota per singolo piatto, preconto con dicitura "DOCUMENTO NON FISCALE" e coperti come voce a sé, stampa del solo ticket. Verificata con **entrambi i ruoli**: lo staff vede il prezzo del coperto ma non il pulsante Impostazioni.
- ✅ **BAR fatto e verificato dal vivo l'08/08** (`/comande/bar`): due colonne — ticket da evadere per invio (non per riga) + cassa di qualunque tavolo con preconto e chiusura.
- ✅ **CUCINA fatta il 09/08** (`/comande/cucina`): **postazione di stampa, non schermata di lavoro** — la cucina lavora solo di carta per scelta (§3.2.1). Ogni invio compare come ticket a 72 mm e si stampa dal browser con un tocco; `prepared_at` sulle righe cucina significa "ticket uscito dalla stampante" (non "piatto pronto"). Col mini-PC diventerà la coda di stampa (ARCHITETTURA §4.2) senza cambiare il ticket. **Il vecchio schermo a tre colonne è stato spento e rimosso** (`/comande/reparti` reindirizza a `/comande/cucina`).
- ⏳ **Carta dei vini**: schermata separata prevista da §3.2.1, non costruita perché **non ha ancora una fonte dati**. Deciso l'08/08 che vini e bevande vivranno nell'**Editor Menu come categorie "bar"** — il Ricettario non le modella e `menu_items.recipe_id` è obbligatorio, quindi serve una tabella dedicata (non forzare le bevande dentro le ricette). Nel frattempo si ordinano con "Voce libera".
- **Coperto: 5,00 € a persona**, deciso l'08/08. Sta in `service_settings` (una riga, titolare-only in scrittura), **non nel codice**; il conto chiuso conserva il prezzo di allora in `orders.coperto_unit_price`.
- **Cucina senza stampante fino al mini-PC**: deciso di NON costruire una schermata Cucina temporanea (§3.2.1 la esclude per scelta), ma un'**anteprima stampabile dal browser** già impaginata come uscirà dalla termica.
- ✅ **Casi limite di sala (§3.2.2) decisi da Alessio il 09/08 dalla sua esperienza** — e costruiti lo stesso giorno:
  - **Alla romana con arrotondamento** (nella chiusura conto, Sala e Bar): propone la cifra tonda a testa (25 € in 2 → 12), la differenza si chiude come **cortesia = sconto** sul meccanismo atomico esistente, con causale annotata. La cifra sopra il conto è bloccata: gli spicci in più sono mance e vanno nel modulo Mance. Il preconto mostra "a testa" informativo.
  - **Sposta conto** su un altro tavolo ("sposta" accanto al nome del tavolo in Sala): una scrittura su una riga (categoria A, niente corridoio), destinazione protetta dal vincolo un-conto-per-tavolo.
  - **Storni**: a voce — deciso di NON stampare ticket di storno; resta la registrazione con motivo obbligatorio.
  - **Asporto**: rinviato ma previsto — `table_label` è testo libero, "Asporto 1" entrerà senza toccare lo schema.
- Riferimento di disegno: `_scambio_cowork_code\Borgo58_Simulatore_Comande_Tablet.html`.

---

## 8. Trappole già scoperte — NON ricaderci

- ⚠️ **Non aggiungere `.limit()` alle liste HACCP o di prima nota.** `ManualeCompleto.jsx` (il PDF per l'ispettore ASL) e l'export CSV di `PrimaNota.jsx` usano **le stesse funzioni** delle liste a schermo: un limite produrrebbe documenti che sembrano completi ma non lo sono. Avvertenze scritte in testa a `src/lib/api/haccp.js` e `cash.js`. Il modo giusto di contenerli è un **filtro di periodo** (item aperto sul manuale HACCP).
- ⚠️ **Un trigger `BEFORE` può annullare la sanatoria della sua stessa migrazione** — successo il 04/08.
- ⚠️ **`listStockConsumptions`** in `stock.js` è codice morto, nessuna pagina la usa.
- ⚠️ **Non fermare mai il dev server** dopo una verifica (`preview_stop`): è condiviso con Alessio.
- ⚠️ **Mai `new Date().toISOString().slice(0, 10)` per sapere che giorno è** — è la data UTC, e fra mezzanotte e le 02:00 restituisce IERI. Per un'osteria che chiude all'una significa prima nota, registrazioni HACCP e mance datate al giorno prima. Usare `oggiLocale()` / `meseLocale()` / `primoDelMeseLocale()` / `traGiorniLocale()` da `constants.js`. Trovato in 14 punti nell'audit dell'08/08.
- ⚠️ **Il form pubblico va provato da sloggati** — trovato dal vivo il 09/08/2026: da un browser con il gestionale aperto `/prenota` rispondeva sempre "Non è stato possibile inviare la richiesta". Difetto invisibile a chi lo prova, perché chi lo prova è dentro. Coperto ora da `tests/app/prenotazione-pubblica.test.js`.
- ⚠️ **Le prove sull'app girano in fila, mai in parallelo** (`--no-file-parallelism` in `package.json`): il database è uno solo. Il 10/08 un file che aggiungeva un tavolo di prova ha fatto fallire un altro file che contava i coperti liberi — l'errore sembrava un difetto del calcolo, e non lo era.
- ⚠️ **`signOut()` nelle prove è GLOBALE** — revoca l'utente su tutti i dispositivi, e con i file di prova che girano in parallelo butta fuori l'altro file a metà corsa: l'errore che si vede è un finto guasto del corridoio ("Sessione non valida"). Usare sempre `signOut({ scope: "local" })`.
- ⚠️ **Non nascondere il messaggio del database dietro un errore generico**: `submit_public_reservation` scrive frasi pensate per l'ospite (il codice `P0001` le riconosce). Un catch che le sostituisce toglie l'informazione all'ospite E a noi in diagnosi.
- ⚠️ **Una funzione appena creata è eseguibile da chiunque abbia la chiave anon** — che è **pubblica**, sta nel bundle del sito. Postgres concede l'esecuzione a `public` per impostazione predefinita, e Supabase espone via PostgREST tutto ciò che `anon` può eseguire: una funzione `security definer` senza revoca è una porta aperta sul database, perché dentro la funzione la RLS non protegge più. Trovato dal validatore l'11/08 su due funzioni dell'email e allargato all'intero schema: **35 funzioni** erano in quello stato (fra cui fondere clienti e movimentare il magazzino). Regola da qui in avanti: **ogni funzione nuova finisce con `revoke all on function … from public, anon, authenticated;`** e poi il `grant` esplicito a chi serve davvero. Due dettagli non ovvi: (1) `revoke … from public` **non basta** se qualcuno ha concesso il permesso a `anon` esplicitamente — vanno nominati tutti e tre; (2) **`authenticated` va conservato** dove il gestionale chiama la funzione, perché il corridoio `operazioni-atomiche` la invoca col token dell'utente vero, non con una chiave di servizio.
- ⚠️ **Il collaudo di una migrazione può far suonare il telefono di Alessio** — successo l'11/08/2026: la verifica dell'email di conferma inseriva una prenotazione finta con `source = 'form_pubblico'`, e il trigger delle notifiche l'ha mandata su Telegram come fosse un cliente vero (poi cancellata dalla verifica stessa: nel gestionale non compariva, e sembrava un guasto). **Ogni migrazione che scrive righe finte in una tabella con trigger di notifica deve spegnere quel trigger** — `alter table X disable trigger <nome>` e riaccenderlo alla fine, **non** `session_replication_role = replica` quando la migrazione deve provare un altro trigger sulla stessa tabella (li fermerebbe tutti, e la verifica passerebbe senza aver verificato niente). Riaccenderlo va **verificato**: lasciarlo spento significa richieste dei clienti che non arrivano più, in silenzio.
- ⚠️ **Se una migrazione cambia il SIGNIFICATO di un valore, il valore vecchio non deve sopravviverle** — successo in produzione il 12/08/2026, mezz'ora dopo aver applicato `20260812000008`: Telegram ha annunciato *«la posta non viene più letta da 170 minuti»* mentre la posta veniva letta regolarmente. La migrazione cambia cosa misura il battito di `lettura_posta` (da «l'ultima volta che ho chiamato l'AI» a «l'ultima volta che ho fatto il giro») e poi lo semina con `on conflict do nothing` — che sulla riga già esistente **non fa nulla**, lasciando in piedi una misura della cosa vecchia letta col metro nuovo. Regola: seminare `do nothing` va bene solo se il valore vecchio significa ancora la stessa cosa; altrimenti serve `do update set … = now()`, e va detto perché.
  - **La ragione per cui il progetto di prova non l'ha intercettato è la parte che conta**: lì la riga `lettura_posta` non esisteva ancora (quel lavoro non aveva mai avuto posta da leggere), quindi il `do nothing` non aveva niente da non-fare e la verifica passava. **La prova non era falsa: era su uno stato di partenza diverso da quello vero, esattamente nel punto rilevante.** Quando una migrazione tocca dati già esistenti, guardare col connettore in sola lettura *cosa c'è davvero in produzione* prima di scrivere il blocco di semina — non solo cosa produrrebbe una ricostruzione da zero.
- ⚠️ **Un campo che salva solo `onBlur` perde i dati** — trovato dal vivo l'08/08 sulle note della comanda: si scrive la nota, si preme F5 (o si blocca lo schermo del tablet) col cursore ancora dentro, e il salvataggio non parte mai. Nessun errore, nessun avviso. Usare `<NotaSalvataAutomaticamente>`, non `onBlur` da solo.

---

## 9. Metodo di verifica che funziona su questa macchina

Il **Browser pane** è inaffidabile qui (spesso chiuso lato Alessio, sessione separata dal suo Chrome). **Usare i tool `mcp__claude-in-chrome__*` sul suo Chrome reale**, dove la sessione di login è già attiva.

Tre accorgimenti appresi sul campo:
1. **I click via `computer`+`ref` NON funzionano** su questa app React → usare `javascript_tool` con `element.click()`.
2. Per i campi controllati da React serve il **native setter**:
   `Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(el, v)` + dispatch di `input`/`change`.
3. Per verificare la **RLS vera** (non solo la UI): interrogare PostgREST direttamente col token da `localStorage` (chiave che contiene `auth-token`) + anon key.
4. ⚠️ **Chrome traduce in automatico i pannelli in inglese** (successo l'08/08 sulla dashboard Cloudflare) e traduce anche i nomi propri: il repository `Borgo58-App` compariva come "App Borgo58", il framework "Eleventy" come "Undici". Non fidarsi delle etichette lette a schermo su pagine tradotte — verificare i valori veri con `javascript_tool` leggendo `input.value` / `input.name`.
5. La traduzione **rimonta il DOM di continuo**: i click a coordinate si spostano fra uno screenshot e l'altro. Rifare lo screenshot subito prima di ogni click, oppure lavorare con i `ref`.

---

## 10. Cosa resta da fare

**Mandato strutturale del validatore (10/08/2026) — COMPLETO su tutti e cinque i blocchi l'11/08/2026.** Restano solo code personali di Alessio (promemoria settimanale del backup, dossier privacy per Laura) e due scelte consapevoli con appuntamento prima dell'apertura (PIN del computer, PIN dello staff). Documento su `Desktop\Borgo58_Mandato_Strutturale.md`. Un riepilogo per blocco, un blocco alla volta.
1. ✅ **Backup + ambiente di prova** — fatto ed eseguito il 10/08: copia reale, ricostruzione da zero delle 49 migrazioni, prova di ripristino superata. Copia portata fuori dal computer l'11/08; resta solo il promemoria settimanale in calendario
2. 🔄 **Privacy dei clienti** — fatto il 10/08: conservazione 6 mesi applicata dal database, informativa collegata al form, elenco dei dati trattati. **Chiuso quando** Alessio applica la migrazione in produzione e sostituisce il testo dell'informativa con quello verificato da Laura
3. 🔄 **Allarmi** — fatto il 10/08 e provato sul progetto di prova. **Chiuso quando** Alessio applica la migrazione e rideploya le due funzioni in produzione
4. ✅ **Igiene degli accessi** — eseguita insieme il 10-11/08: casella dedicata al locale, secondo fattore su tutti e cinque i conti, cassaforte Bitwarden, codici di recupero su carta, nessun altro membro nei tre pannelli. Il file è diventato la **mappa delle chiavi** ([`docs/ACCESSI.md`](docs/ACCESSI.md)). Restano due scelte consapevoli con appuntamento prima dell'apertura: niente PIN sul computer, PIN dello staff corti
5. ✅ **Account AI con tetto di spesa** — account creato l'11/08 (si entra con Google), **tetto 10 $/mese e ricarica automatica spenta**, chiave nei Secrets, funzione `prova-ai` installata. **Provata dal vivo in produzione dal ruolo del titolare: risposta `FUNZIONA`, 44+9 token.** Il cancello dei moduli AI è aperto.

**In capo a Claude Code, fuori dal mandato:**
- ✅ **Email automatica al cliente quando Alessio conferma** — **viva in produzione dall'11/08/2026**: richiesta vera dal sito, confermata da Alessio, email arrivata in casella. Vedi «Chiuso di recente».
- **Posta in ingresso → Archivio Documenti, letta dall'AI** (idea di Alessio, 11/08/2026; primo modulo AI con un valore vero). **Sua decisione**: entra **automaticamente tutto** ciò che arriva su `info@borgo58.it` **e sulle due PEC**; resta fuori solo `borgo58.gestionale@gmail.com`. Io avevo proposto la corsia stretta (solo ciò che inoltra lui) — respinta. Tre conseguenze da progettare, non da dimenticare: (1) **la PEC ha valore legale nell'originale, non nella copia** — ciò che entra nel gestionale è un duplicato per comodità, la ricevuta di consegna resta nella PEC e nessuna cancellazione qui la sostituisce; (2) entrando tutto, entrano anche pubblicità e messaggi personali: servono un filtro a monte, un tetto di spesa per l'AI e **una regola di conservazione** come quella delle richieste dei clienti (§ privacy); (3) resta ferma la regola **il sistema propone, Alessio conferma** — un importo letto male in una fattura è peggio di nessuna automazione, perché ci si fida e non si ricontrolla. Da costruire dopo l'email di conferma.
- ✅ **Chiedi all'archivio** — **vivo in produzione dal 12/08** (vedi «Chiuso di recente»). Resta a lui installare `documento-leggi` e premere «Leggi il contenuto» sui tre documenti vecchi: finché non lo fa, l'assistente ne conosce solo la scheda.
- **Il carico da fattura** (magazzino + HACCP) — ordine di Alessio del 12/08. Oggi la lettura della posta lo propone come «cose da fare a mano»; quando esisterà diventerà un'azione automatica di quell'elenco. Il primo banco di prova vero è una fattura di Mililli.
- Poi: **la logica interna dei moduli che toccano soldi e obblighi** — Cassa/Prima Nota, Proiezione Fiscale, Personale, HACCP (un calcolo fiscale sbagliato o una regola HACCP incompleta non li trova nessun controllo per classi di difetto).

**In capo ad Alessio:**
- **Promemoria settimanale del backup** in calendario (la copia fuori sede è fatta)
- ✅ **Dominio `borgo58.it` comprato l'11/08/2026** su Aruba, pacchetto *Dominio con Email* (~20 € IVA inclusa l'anno, 5 caselle da 1 GB, rinnovo automatico attivo, scadenza 11/08/2027). Sta nello stesso account Aruba delle due PEC. **Intestato ad Alessio come persona fisica, non alla S.r.l.s.** — scelta consapevole dell'11/08 (costo irrisorio, nessun vantaggio fiscale cercato); la *modifica intestatario* è gratuita e resta da rivalutare **prima dell'apertura**, perché il nome del locale (sito, QR, email dei clienti) oggi poggia su un bene personale. Promemoria lasciato in Agenda per sua richiesta.
- ✅ **Dominio in funzione dall'11/08/2026**: `borgo58.it` e `www.borgo58.it` aprono il gestionale (Cloudflare Pages), **e la posta continua ad arrivare** su `info@borgo58.it`. I server DNS sono passati da Aruba a Cloudflare ricopiando prima tutta la zona: il difetto trovato in tempo è che l'importazione automatica aveva messo **33 righe su "proxied"**, comprese quelle della posta — con quelle accese la casella sarebbe diventata cieca lo stesso giorno, senza avviso per nessuno. Sorvegliato da `npm run dominio:verifica` (separa «la posta riceve» da «il sito risponde», esce in errore solo sulla prima); guida e tabella dei record veri in [`docs/DOMINIO.md`](docs/DOMINIO.md).
- Piano Supabase a pagamento (~25€/mese): sul Free i progetti inattivi vanno in pausa e **i promemoria Telegram smettono in silenzio** — e **non esiste alcun backup automatico** (verificato il 10/08 sulla documentazione Supabase)
- Backup cifrato fuori sede, con Alessandro (fornitore hardware)
- **Allungare i PIN prima dell'apertura** (rinviato consapevolmente il 06/08)
- Con Laura: TD27 sugli omaggi sistematici, scadenza dati clienti (GDPR), verifica che le date degli adempimenti societari (oggi sul 2027) siano corrette ora che la S.r.l.s. esiste da agosto 2026
- Con Tiziana (biologa): validazione piano HACCP

**Bloccati su attivazione AI** (serve account Anthropic API di Alessio): Assistente AI, Ricerca Ricorrente, Monitoraggio Social, Consulente culinario, estrazione da documenti/buste paga, ricevimento merci con fotocamera.

---

## 11. Pubblicazione — FATTA l'08/08/2026

**L'app è online su https://borgo58.it** — e sempre anche su https://borgo58-app.pages.dev, che resta l'indirizzo tecnico (Cloudflare Pages, progetto `borgo58-app`, account `idearecreazioni@gmail.com`). Dominio agganciato l'11/08/2026: sono lo stesso sito, non due copie. Scelto Cloudflare perché il piano gratuito di Vercel è per usi non commerciali e questo è un gestionale aziendale.

**Ogni `git push` su `master` ripubblica il sito da solo** — non serve nessuna azione sul pannello Cloudflare. Corollario: da adesso un commit sbagliato pushato finisce in produzione, non solo sul PC.

Configurazione effettiva del progetto:

| Campo | Valore |
|---|---|
| Framework preset | **Nessuno** (non "Vite": vedi nota sotto) |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Env: `VITE_SUPABASE_URL` | `https://oudjuqbqszisdtwzbxdo.supabase.co` |
| Env: `VITE_SUPABASE_ANON_KEY` | chiave anon (da `.env.local`) |
| Env: `NODE_VERSION` | `22.16.0` |

- Il preset "Vite" non fa altro che riempire build command e output directory: compilarli a mano dà lo stesso risultato.
- `NODE_VERSION` **non** va lasciato a `20` come previsto in origine: Vite 8 pretende `^20.19 || >=22.12` e un "20" generico può risolversi in una minor più vecchia. Versione esatta, non maggiore.
- `public/_redirects` (`/*  /index.html  200`) è ciò che evita il 404 su `/comande` con `BrowserRouter`. **Non rimuoverlo mai.**

**Verificato dal vivo l'08/08/2026**: `/comande` chiesto direttamente risponde 200 con l'app (non 404); il bundle pubblicato contiene davvero URL e chiave anon (se una variabile mancasse ci sarebbe `undefined`) ed è lo stesso file prodotto dalla build locale; **login col PIN reale del titolare riuscito sul sito pubblico**.

Come verificare una pubblicazione senza aprire il browser:
```powershell
(Invoke-WebRequest "https://borgo58-app.pages.dev/comande" -UseBasicParsing).StatusCode   # deve essere 200
```

---

## 12. Dati reali già nel database (non cancellare)

- **14 tavoli** in `dining_tables`: T1-T10, Chef Table, D1-D3
- **2 device** in `pos_devices`: **`tablet cucina` = quello di Alessio** (`is_owner_device = true`), `tablet sala` = no
- **7 adempimenti societari** in `tasks`, riservati al titolare, con importi e codici F24 reali
- **1 menu attivo** "estivo" con 2 piatti, 1 fornitore reale ("Mililli") con storico prezzi
- **Progetto di prova** `Borgo58-Prova` (ref `bnwqgpuyzmzujxfbtyvs`, EU Irlanda, piano Free): usa-e-getta, ricostruibile con un comando. Ci girano le prove automatiche.
- **61 migrazioni** registrate in `applied_migrations` (le ultime del 12/08, la posta in arrivo: da `posta_in_arrivo` a `azioni_in_parole`). Verificato in produzione dopo ognuna, dal connettore in sola lettura.
- **Orari e capienza VERI, compilati da Alessio il 10/08**: 60 coperti su 14 tavoli, cena martedì-sabato 19:00 → 22:00 (ultimo ingresso), pranzo la domenica 12:00 → 14:00, **lunedì di riposo**. `prenotazioni_online_attive = true`: il form pubblico mostra i posti liberi ai clienti veri. Cambiarli è affare suo da "Sala e orari" — non vanno toccati da qui.
- **1 riga in `service_settings`**: prezzo del coperto = 5,00 €
- **5 lavori pianificati** in `cron.job`: promemoria Agenda (ogni 5 min), lettura della posta (ogni 15 min), sentinella dei lavori (ogni 15 min), pulizia dati clienti scaduti (4:30), pulizia posta scaduta (4:45). **I quattro sorvegliati sono righe di `lavori_sorvegliati`**: aggiungerne uno a `cron.job` senza aggiungerlo lì produce un allarme entro un quarto d'ora — è voluto.
- **2 valori nel Vault** (`vault.secrets`): `notifiche_firma` (parola d'ordine delle notifiche, esiste solo lì e nelle variabili d'ambiente della funzione) e `chiave_anon`. **Rigenerare la firma senza aggiornare anche i Secrets della Edge Function spegne le notifiche.**
