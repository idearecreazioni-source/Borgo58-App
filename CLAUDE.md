# Borgo 58 — Gestionale · istruzioni per Claude Code

Documento letto automaticamente all'avvio di ogni sessione. Aggiornato il **06/08/2026**.

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

---

## 7. Stato dei moduli

**Tutti i 15 moduli del brief hanno un'implementazione funzionante.** Ricettario, Agenda, Fatture Fornitori (manuale), Magazzino, Cassa/Prima Nota, Calendario Eventi, HACCP, Agricolo, Proiezione Fiscale, Ricerca Ricorrente (placeholder), Personale, Monitoraggio Social (placeholder), Editor Menu, Assistente AI (placeholder), Archivio Documenti.

**Chiuso di recente:**
- **§3.18 permessi trasversali** — tutti e tre i casi risolti e verificati dal vivo: 🔴 Agenda/tasks (era una fuga di dati **attiva**: nomi e documenti dei dipendenti visibili allo staff), 🟡 scheda cliente a due livelli, 🟢 Anagrafica Fornitori (era un modulo intero mai costruito, non solo una vista).
- **Audit di robustezza (05/08)** — registro migrazioni, 5 indici mancanti, lint a zero.

**Comande — funzionante ma interfaccia da RIFARE (terza volta):**
- Costruito e verificato: apertura tavolo da griglia, piatti dal menu o "voce libera", invio con instradamento cucina/bar, "pronto", chiusura pagato/annullato/sconto/omaggio (scrive su `discounts_gifts` esistente, nessun registro parallelo).
- ⚠️ **L'interfaccia attuale è superata** dalle decisioni hardware prese con Cowork il 05/08 (§3.2.1 del brief): Sala = tablet 8,7" **verticale**; Cucina = **solo stampante, nessuno schermo**; Bar = stampante + tablet 11" **orizzontale**. Lo schermo unico a tre colonne che c'è ora non regge questo disegno.
- **Da costruire, emerso dal simulatore di Cowork** (`_scambio_cowork_code\Borgo58_Simulatore_Comande_Tablet.html` — **leggerlo prima di ricostruire**): contatore coperti, nota per singolo piatto, preconto con dicitura "DOCUMENTO NON FISCALE", carta dei vini in schermata separata, **target di tocco dimensionati in cm reali** (regola valida per tutta l'app).

---

## 8. Trappole già scoperte — NON ricaderci

- ⚠️ **Non aggiungere `.limit()` alle liste HACCP o di prima nota.** `ManualeCompleto.jsx` (il PDF per l'ispettore ASL) e l'export CSV di `PrimaNota.jsx` usano **le stesse funzioni** delle liste a schermo: un limite produrrebbe documenti che sembrano completi ma non lo sono. Avvertenze scritte in testa a `src/lib/api/haccp.js` e `cash.js`. Il modo giusto di contenerli è un **filtro di periodo** (item aperto sul manuale HACCP).
- ⚠️ **Un trigger `BEFORE` può annullare la sanatoria della sua stessa migrazione** — successo il 04/08.
- ⚠️ **`listStockConsumptions`** in `stock.js` è codice morto, nessuna pagina la usa.
- ⚠️ **Non fermare mai il dev server** dopo una verifica (`preview_stop`): è condiviso con Alessio.

---

## 9. Metodo di verifica che funziona su questa macchina

Il **Browser pane** è inaffidabile qui (spesso chiuso lato Alessio, sessione separata dal suo Chrome). **Usare i tool `mcp__claude-in-chrome__*` sul suo Chrome reale**, dove la sessione di login è già attiva.

Tre accorgimenti appresi sul campo:
1. **I click via `computer`+`ref` NON funzionano** su questa app React → usare `javascript_tool` con `element.click()`.
2. Per i campi controllati da React serve il **native setter**:
   `Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(el, v)` + dispatch di `input`/`change`.
3. Per verificare la **RLS vera** (non solo la UI): interrogare PostgREST direttamente col token da `localStorage` (chiave che contiene `auth-token`) + anon key.

---

## 10. Cosa resta da fare

**In capo a Claude Code:**
- Ricostruire l'interfaccia Comande sul disegno di §3.2.1 (leggere prima il simulatore)
- Filtro di periodo sul manuale HACCP (§3.19 punto 5)
- Casi limite di sala non ancora specificati: **conto diviso, tavoli uniti, storni, asporto** (§3.2.2) — servono le risposte di Alessio dalla sua esperienza in sala

**In capo ad Alessio:**
- **4 commit da pushare** (`git push` da `Borgo58-App`)
- **Pubblicazione su Cloudflare Pages** — in corso, vedi §11
- Piano Supabase a pagamento (~25€/mese): sul Free i progetti inattivi vanno in pausa e **i promemoria Telegram smettono in silenzio**
- Backup cifrato fuori sede, con Alessandro (fornitore hardware)
- **Allungare i PIN prima dell'apertura** (rinviato consapevolmente il 06/08)
- Con Laura: TD27 sugli omaggi sistematici, scadenza dati clienti (GDPR), verifica che le date degli adempimenti societari (oggi sul 2027) siano corrette ora che la S.r.l.s. esiste da agosto 2026
- Con Tiziana (biologa): validazione piano HACCP

**Bloccati su attivazione AI** (serve account Anthropic API di Alessio): Assistente AI, Ricerca Ricorrente, Monitoraggio Social, Consulente culinario, estrazione da documenti/buste paga, ricevimento merci con fotocamera.

---

## 11. Pubblicazione — stato al 06/08/2026

**Servizio scelto: Cloudflare Pages** (il piano gratuito di Vercel è per usi non commerciali; questo è un gestionale aziendale).

Preparato lato codice: `public/_redirects` con `/*  /index.html  200` — necessario perché l'app usa `BrowserRouter` e senza quella regola ricaricare `/comande` darebbe 404.

Configurazione da usare:

| Campo | Valore |
|---|---|
| Framework preset | Vite |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Env: `VITE_SUPABASE_URL` | `https://oudjuqbqszisdtwzbxdo.supabase.co` |
| Env: `VITE_SUPABASE_ANON_KEY` | chiave anon (da `.env.local`) |
| Env: `NODE_VERSION` | `20` |

**Da verificare appena pubblicato**: (a) che il login funzioni davvero — se una variabile è sbagliata la schermata appare ma il PIN non entra; (b) che un indirizzo diretto tipo `/comande` non dia 404.

---

## 12. Dati reali già nel database (non cancellare)

- **14 tavoli** in `dining_tables`: T1-T10, Chef Table, D1-D3
- **2 device** in `pos_devices`: **`tablet cucina` = quello di Alessio** (`is_owner_device = true`), `tablet sala` = no
- **7 adempimenti societari** in `tasks`, riservati al titolare, con importi e codici F24 reali
- **1 menu attivo** "estivo" con 2 piatti, 1 fornitore reale ("Mililli") con storico prezzi
- **35 migrazioni** registrate in `applied_migrations`
