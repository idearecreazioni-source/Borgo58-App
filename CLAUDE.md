# Borgo 58 — Gestionale · istruzioni per Claude Code

Documento letto automaticamente all'avvio di ogni sessione. Aggiornato il **08/08/2026**.

---

## 1. Il progetto

Gestionale su misura per **Borgo 58 — Osteria Contemporanea**, osteria a Piazza Armerina (EN), **apertura prevista marzo 2027**. Sviluppato da **Alessio Schillaci** (titolare) insieme a Claude — nessun team esterno, nessun altro sviluppatore.

**Alessio non è un programmatore.** Va guidato passo-passo per qualsiasi operazione nel suo terminale o browser: comandi spiegati per intero, click-by-click quando serve. Non dare per scontato nulla sull'ambiente.

**Vincolo architetturale portante**: due entità fiscali distinte fin dal data model — **S.r.l.s.** (costituita il 03/08/2026, gestisce il ristorante) e **azienda agricola** separata per l'orto (non ancora costituita, ma prevista nello schema). Collegate da cessione intercompany. Ogni tabella economicamente rilevante ha `entity_id`.

---

## 2. Chi fa cosa — divisione dei ruoli (IMPORTANTE)

| | |
|---|---|
| **Questo terminale (Claude Code)** | scrive il codice nel repo `Borgo58-App` |
| **"Cowork"** — altra sessione Claude | tiene il **brief tecnico** e la memoria di progetto, fa le ricerche normative/fiscali, prepara le domande ai consulenti |
| **Alessio** | applica le migrazioni, fa i `git push`, decide, parla coi consulenti |

Le due sessioni **non comunicano in tempo reale**. Il canale è una cartella di scambio (§3).

**Regole non derogabili:**
- **Le migrazioni le applica sempre Alessio** copiando l'SQL nell'SQL Editor della dashboard Supabase (MCP/CLI non funzionanti su questa macchina). Mai eseguirle io.
- **Il `git push` lo fa sempre Alessio.** Io creo i commit, non pusho mai.
- **Non inserisco mai PIN o password**, nemmeno per test. Se serve provare da loggati, il login lo fa lui.
- **Non cambio modello da solo**: segnalo quando un task è ad alto rischio e lascio decidere.

---

## 3. Percorsi importanti

```
Codice:        C:\Users\User\Desktop\Claude code\Borgo58-App
Brief tecnico: C:\Users\User\Desktop\Claude cowork\Borgo 58 - Osteria Contemporanea\
               06_App_Borgo58\APP_Borgo58_Brief_Tecnico_v2.md
Scambio:       C:\Users\User\Desktop\Claude cowork\Borgo 58 - Osteria Contemporanea\_scambio_cowork_code\
```

⚠️ **Il brief è stato spostato più volte** (05-06/08 e di nuovo il 07/08/2026, quando è stata eliminata la doppia cartella annidata ed è nata "Claude cowork"). Cowork riorganizza le cartelle: se il percorso non risponde, cercalo con Glob invece di assumere.

⚠️ **Il brief va riletto** se la sessione dura a lungo: viene modificato in-place da Cowork anche a metà sessione, senza segnali.

⚠️ La cartella `Borgo 58 - Osteria Contemporanea` contiene documenti finanziari/legali sensibili — **mai metterci codice**.

**Convenzione per i messaggi a Cowork**: file in `_scambio_cowork_code\` con nome `AAAAMMGG_code_<oggetto>.md`.

---

## 4. Stack e infrastruttura

- **Frontend**: Vite + React 19 (JSX) + Tailwind CSS v4 (config `@theme` in CSS, **non** `tailwind.config.js`) + React Router v7 (`BrowserRouter`)
- **Backend**: nessuno. L'app è una SPA statica che parla direttamente con Supabase.
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
```

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
7. **Modello per materia, non per sezione del brief**: Opus per multi-entità, fiscale/API, RLS e prima nota nuove, registratore telematico. La verifica dal vivo però non è negoziabile con nessun modello.

---

## 6. Pattern architetturali consolidati

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

---

## 7. Stato dei moduli

**Tutti i 15 moduli del brief hanno un'implementazione funzionante.** Ricettario, Agenda, Fatture Fornitori (manuale), Magazzino, Cassa/Prima Nota, Calendario Eventi, HACCP, Agricolo, Proiezione Fiscale, Ricerca Ricorrente (placeholder), Personale, Monitoraggio Social (placeholder), Editor Menu, Assistente AI (placeholder), Archivio Documenti.

**Chiuso di recente:**
- **§3.18 permessi trasversali** — tutti e tre i casi risolti e verificati dal vivo: 🔴 Agenda/tasks (era una fuga di dati **attiva**: nomi e documenti dei dipendenti visibili allo staff), 🟡 scheda cliente a due livelli, 🟢 Anagrafica Fornitori (era un modulo intero mai costruito, non solo una vista).
- **Audit di robustezza (05/08)** — registro migrazioni, 5 indici mancanti, lint a zero.

**Comande — una postazione, una schermata (§3.2.1). Riscrittura in corso.**

- ✅ **SALA rifatta e verificata dal vivo l'08/08/2026** (`src/pages/comande/Sala.jsx`, rotta `/comande`): colonna singola per tablet verticale, target di tocco in cm reali, **riga intera del piatto tappabile**, contatore coperti (modificabile a tavolo aperto), nota per singolo piatto, preconto con dicitura "DOCUMENTO NON FISCALE" e coperti come voce a sé, stampa del solo ticket. Verificata con **entrambi i ruoli**: lo staff vede il prezzo del coperto ma non il pulsante Impostazioni.
- ⏳ **Bar** (tablet 11" orizzontale, doppio ruolo preparazione + cassa) e **Cucina** (solo stampa, nessuno schermo) **non ancora rifatte**. Il vecchio schermo a tre colonne resta su **`/comande/reparti`** finché non lo sono: spegnerlo prima toglierebbe a cucina e bar l'unico modo che hanno oggi di vedere le comande.
- ⏳ **Carta dei vini**: schermata separata prevista da §3.2.1, non costruita perché **non ha ancora una fonte dati**. Deciso l'08/08 che vini e bevande vivranno nell'**Editor Menu come categorie "bar"** — il Ricettario non le modella e `menu_items.recipe_id` è obbligatorio, quindi serve una tabella dedicata (non forzare le bevande dentro le ricette). Nel frattempo si ordinano con "Voce libera".
- **Coperto: 5,00 € a persona**, deciso l'08/08. Sta in `service_settings` (una riga, titolare-only in scrittura), **non nel codice**; il conto chiuso conserva il prezzo di allora in `orders.coperto_unit_price`.
- **Cucina senza stampante fino al mini-PC**: deciso di NON costruire una schermata Cucina temporanea (§3.2.1 la esclude per scelta), ma un'**anteprima stampabile dal browser** già impaginata come uscirà dalla termica.
- Riferimento di disegno: `_scambio_cowork_code\Borgo58_Simulatore_Comande_Tablet.html` — **rileggerlo prima di fare Bar e Cucina**.

---

## 8. Trappole già scoperte — NON ricaderci

- ⚠️ **Non aggiungere `.limit()` alle liste HACCP o di prima nota.** `ManualeCompleto.jsx` (il PDF per l'ispettore ASL) e l'export CSV di `PrimaNota.jsx` usano **le stesse funzioni** delle liste a schermo: un limite produrrebbe documenti che sembrano completi ma non lo sono. Avvertenze scritte in testa a `src/lib/api/haccp.js` e `cash.js`. Il modo giusto di contenerli è un **filtro di periodo** (item aperto sul manuale HACCP).
- ⚠️ **Un trigger `BEFORE` può annullare la sanatoria della sua stessa migrazione** — successo il 04/08.
- ⚠️ **`listStockConsumptions`** in `stock.js` è codice morto, nessuna pagina la usa.
- ⚠️ **Non fermare mai il dev server** dopo una verifica (`preview_stop`): è condiviso con Alessio.
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

**In capo a Claude Code:**
- Comande: **Bar** (tablet orizzontale, anche cassa) e **Cucina** (ticket stampabile), poi la **carta dei vini** — che però dipende dalla sezione bevande nell'Editor Menu
- Filtro di periodo sul manuale HACCP (§3.19 punto 5)
- Casi limite di sala non ancora specificati: **conto diviso, tavoli uniti, storni, asporto** (§3.2.2) — servono le risposte di Alessio dalla sua esperienza in sala

**In capo ad Alessio:**
- Piano Supabase a pagamento (~25€/mese): sul Free i progetti inattivi vanno in pausa e **i promemoria Telegram smettono in silenzio**
- Backup cifrato fuori sede, con Alessandro (fornitore hardware)
- **Allungare i PIN prima dell'apertura** (rinviato consapevolmente il 06/08)
- Con Laura: TD27 sugli omaggi sistematici, scadenza dati clienti (GDPR), verifica che le date degli adempimenti societari (oggi sul 2027) siano corrette ora che la S.r.l.s. esiste da agosto 2026
- Con Tiziana (biologa): validazione piano HACCP

**Bloccati su attivazione AI** (serve account Anthropic API di Alessio): Assistente AI, Ricerca Ricorrente, Monitoraggio Social, Consulente culinario, estrazione da documenti/buste paga, ricevimento merci con fotocamera.

---

## 11. Pubblicazione — FATTA l'08/08/2026

**L'app è online su https://borgo58-app.pages.dev** (Cloudflare Pages, progetto `borgo58-app`, account `idearecreazioni@gmail.com`). Scelto Cloudflare perché il piano gratuito di Vercel è per usi non commerciali e questo è un gestionale aziendale.

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
- **36 migrazioni** registrate in `applied_migrations` (l'ultima: `20260808000001_sala_coperti`)
- **1 riga in `service_settings`**: prezzo del coperto = 5,00 €
