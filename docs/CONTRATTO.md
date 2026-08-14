# Borgo 58 — Contratto architetturale vincolante (v2)

**Scopo di questo documento**: fissare, in modo non ambiguo e senza margine di interpretazione, dove deve vivere ogni pezzo di logica dell'app — e chi ha il potere di deciderlo. Non è un elenco di opzioni possibili: ogni riga è una regola, non un'ipotesi.

**Status**: v2, sostituisce integralmente la v1 del 05/08/2026. **Vincolante da quando Alessio lo conferma.** Finché non è confermato, nessuna sessione (Cowork o Code) può trattarlo come già in vigore, ma nessuna sessione può nemmeno dichiarare un'architettura alternativa come definitiva senza passare da qui.

**Metodo di stesura**: a differenza della v1 (scritta senza accesso al codice), questa versione è stata verificata riga per riga sul repository reale `Borgo58-App`, commit `48638d7f` (08/08/2026) — clonato e letto direttamente, non dedotto dal brief. Dove il documento descrive lo stato attuale, è perché è stato controllato con `grep`, lettura diretta dei file e conteggio delle migrazioni — non per fiducia in ciò che qualcun altro ha scritto a riguardo.

---

## 0. Perché questa versione esiste — la cosa da correggere non è il codice

Il codice reale, verificato in questa sessione, **non contiene** un server Node.js, **non contiene** occorrenze della chiave `service_role`, **non contiene** segreti hardcoded. Ogni segreto reale del progetto (token Telegram) vive in una variabile d'ambiente di una Supabase Edge Function, mai nel bundle frontend. Le migrazioni SQL seguono in modo sistematico i pattern del §7 del brief (verifica con `raise exception`, idempotenza, auto-registrazione in `applied_migrations`) — e da agosto 2026 questi controlli sono anche automatici, applicati da un git hook (`.githooks/pre-commit`) che blocca il commit se mancano.

**Il problema non è tecnico. È di autorità.** Il file `CLAUDE.md` del repository dichiara, come principio permanente: *"Backend: nessuno. L'app è una SPA statica che parla direttamente con Supabase."* Questa è una decisione architetturale strutturale — non una convenzione di stile — e **è stata scritta unilateralmente da Code, senza passare da una conferma esplicita di Alessio.** Che sia oggi compatibile con le regole della Sezione 2 di questo documento (lo è: si veda §0.1) non la rende una decisione legittima nel processo — la rende una decisione fortunata.

### 0.1 — Compatibilità tecnica di "Backend: nessuno" con questo contratto

Verificato punto per punto:

- **B1 (hardware)**: non ancora rilevante — il mini-PC non esiste, la stampa oggi passa dal dialogo di stampa del browser (`window.print()` su viste con classe `.stampa-ticket`), esplicitamente documentato in `CLAUDE.md` come "ponte... finché non c'è il mini-PC". Non è una violazione: è un caso non ancora raggiunto. **Diventerà una violazione nel momento in cui verrà costruito il mini-PC e la stampa reale (ESC/POS) o il collegamento al Registratore Telematico verranno implementati senza un processo Node standalone locale.**
- **B2, B3, B5**: coerenti con la regola. L'unica istanza reale (notifica Telegram, `supabase/functions/notify-telegram-reservation`) è un'Edge Function, triggerata da un trigger su INSERT e da un job `pg_cron`, con i segreti in `Deno.env`.
- **B4**: **qui la violazione è reale, non solo di principio.** `closeOrderAsDiscountGift` (vedi Sezione 5) scrive su due tabelle direttamente dal client, senza passare da nessun server e senza che le due scritture siano un'unica transazione Postgres. "Backend: nessuno" descrive esattamente questa scelta come normale — mentre la Sezione 2 di questo documento la vieta.

Quindi, a differenza della prima stesura di questa sezione: **il codice di oggi contraddice già la Sezione 2 di questo documento su B4, non solo su un caso futuro (B1).** "Backend: nessuno" non è un'affermazione innocua compatibile per ora — è la descrizione di un'architettura che ha già prodotto almeno un punto non conforme.

**Azione richiesta, non facoltativa:**
1. Alessio conferma questo documento (Sezione 2) come autorità architetturale.
2. `CLAUDE.md` viene corretto per non affermare più un principio assoluto proprio, ma per rimandare a questo documento: *"Architettura del backend: vedi `Borgo58_Contratto_Architetturale.md` — oggi nessun processo server perché nessun caso B1-B5 lo richiede ancora; il mini-PC per le comande sarà un processo Node standalone quando costruito, non un'eccezione."*
3. D'ora in avanti, **nessuna sessione IA (Cowork o Code) può scrivere in un file di progetto un principio architetturale strutturale e permanente** (es. "non useremo mai X", "il backend è sempre/mai Y") senza che sia prima scritto in questo documento e confermato da Alessio. Un file operativo come `CLAUDE.md` descrive convenzioni e stato corrente; non genera regole nuove. Se un file di progetto contraddice questo documento, questo documento vince, e il file va corretto — non il contrario.

---

## 1. Principio cardine

**Il permesso vive nel database (RLS). La necessità di un server vive nella capacità, non nella comodità. L'integrità dei dati vive nella transazione, non nella disciplina di chi scrive il codice chiamante. L'autorità sull'architettura vive in questo documento, non in un file scritto da chi implementa.**

**Vincolo di integrità, senza eccezioni**: ogni operazione che scrive su più tabelle e deve riuscire o fallire per intero — mai a metà — **passa sempre da un server (Edge Function o Node, mai dal client direttamente)** e, dentro quel server, è eseguita come **una singola funzione Postgres** (B4, Sezione 2). I due livelli hanno ruoli diversi e non sostituibili: il server è il punto unico dove si vede, si logga e si ritenta un'operazione fallita; la funzione Postgres è ciò che rende quell'operazione atomica — un server che internamente esegue più scritture separate non risolve nulla, sposta solo il problema di un livello. Questo vale per ogni modulo del progetto, non solo per cassa/comande. Il client non scrive mai direttamente su più tabelle per un'operazione che deve riuscire o fallire insieme — la invoca sempre attraverso il server.

Non esiste una terza via "perché è più comodo così" o "perché lo si è già fatto altrove nel codice". Ogni processo dell'app appartiene a una, e una sola, delle categorie della Sezione 2. Se un processo sembra stare a cavallo tra due categorie, va scomposto in passi più piccoli finché ciascun passo non ricade chiaramente in una sola.

---

## 2. Regola di decisione — dove vive ogni processo

### Categoria A — Client Supabase diretto (React → PostgREST, RLS come unica barriera)

**Condizione di appartenenza**: il processo è un CRUD su una o più tabelle la cui unica logica di autorizzazione è "chi, in base al ruolo, può leggere/scrivere questa riga" — nessuna delle condizioni della Categoria B è presente.

**Vincoli obbligatori, senza eccezioni:**
- Nessuna chiamata usa mai la chiave `service_role` — solo `anon` + JWT utente. Verificato oggi: zero occorrenze nel repository. Deve restare zero.
- La barriera di sicurezza è **sempre e solo** la policy RLS sulla tabella coinvolta — mai un controllo `if (ruolo === 'titolare')` nel frontend come unica protezione.
- Se il processo scrive su più tabelle collegate da un vincolo che Postgres non gestisce da solo, non è mai Categoria A, nemmeno se ogni singola chiamata è di per sé lecita secondo RLS: è Categoria B4, senza eccezioni.

### Categoria B — server obbligatorio (Node standalone o Supabase Edge Function)

**Condizione di appartenenza**: almeno una di queste cinque condizioni è vera.

| # | Condizione | Dove vive nel progetto | Come deve essere implementata |
|---|---|---|---|
| B1 | Comunicazione con hardware fisico | Stampa ESC/POS reparti; protocollo Registratore Telematico | **Node standalone sul mini-PC locale.** Nessuna eccezione, nessuna delega a Edge Function: un dispositivo fisico ha bisogno di un processo sempre attivo sulla stessa rete locale del dispositivo. |
| B2 | Segreto che non può mai arrivare al client | Token bot Telegram (già in produzione); futuro: client secret OAuth Fatture in Cloud, API key modelli AI | **Edge Function Supabase**, secrets in `Deno.env`. Node standalone solo se una ragione tecnica documentata nel file lo impone (es. libreria incompatibile col runtime Deno). |
| B3 | Ricezione di una chiamata esterna in ingresso | Futuro: webhook Fatture in Cloud | **Edge Function Supabase**, esposta come endpoint pubblico verificato (firma/secret del mittente). |
| B4 | Scrittura su più tabelle che deve riuscire o fallire per intero (con o senza un effetto fuori da Postgres nella stessa operazione) | Chiusura comanda con sconto/omaggio (`orders` + `discounts_gifts`); cessione intercompany orto→S.r.l.s.; futuro: sincronizzazione con Fatture in Cloud | **Sempre attraverso un server — Edge Function di default, Node standalone solo con ragione tecnica documentata (regola B2-B5 sotto)** — e quel server esegue la scrittura come **una singola funzione Postgres `security definer`** (mai come chiamate `.from(...)` separate al suo interno, nemmeno lato server: sposterebbe il bug senza risolverlo). Se l'operazione include anche un effetto fuori da Postgres (API esterna), il server aggiunge la logica di compensazione attorno alla chiamata RPC atomica; la parte di database resta comunque un'unica transazione. |
| B5 | Job pianificato, non innescato da un'azione utente | Promemoria Agenda (`pg_cron` ogni 5 min → Edge Function, già in produzione); futuro: backup notturno, scansioni periodiche | **`pg_cron` + Edge Function Supabase** di default, come già avviene per i promemoria. Node standalone solo con ragione tecnica documentata. |

**Regola di sotto-decisione, senza eccezioni:**
- **B1 è sempre e solo Node standalone.** Non è negoziabile, non è delegabile a un'Edge Function: un'Edge Function non ha accesso alla rete locale dove vive una stampante o il Registratore Telematico.
- **B2, B3, B4, B5 sono di default Edge Function Supabase.** Un processo Node standalone per uno di questi casi è ammesso solo se il file contiene un commento che dichiara esplicitamente la ragione tecnica (es. "libreria X non disponibile su Deno/Edge Runtime"). L'assenza di questo commento, in presenza di un processo Node per B2-B5, è di per sé un'anomalia da riportare.
- **Per B4 in particolare**: l'Edge Function (o il Node, se giustificato) non è un passacarte che inoltra le stesse chiamate del client una per una — è il punto che chiama **una** funzione Postgres che fa tutto in una transazione. Un'Edge Function di chiusura conto che al suo interno fa `insert` su `discounts_gifts` e poi `update` su `orders` come due comandi separati **non rispetta questa regola**, anche se ha risolto il problema di "il client non tocca più due tabelle direttamente" — l'atomicità va verificata dentro la funzione Postgres, non assunta perché "ora c'è un server in mezzo".

**Vincoli obbligatori per ogni processo di Categoria B:**
- Verifica del JWT Supabase in ingresso con un'unica implementazione riusata su tutti gli endpoint dello stesso tipo — mai reimplementata endpoint per endpoint.
- Formato di errore uniforme su tutti gli endpoint Node/Edge Function del progetto.
- Nessun segreto in chiaro nel codice sorgente — solo variabili d'ambiente (Node) o secrets Supabase (Edge Function). Verificato oggi: rispettato nell'unica Edge Function esistente.
- Se il processo scrive su tabelle protette da RLS, passa sempre il JWT dell'utente reale a valle — mai `service_role` per comodità, salvo un job di sistema che deve esplicitamente bypassare la RLS per una ragione documentata (es. un backup che deve leggere tutto).

---

## 3. Segreti e chiavi — mappa vincolante

| Segreto | Può stare in Categoria A (client)? | Dove deve stare | Stato verificato oggi |
|---|---|---|---|
| Chiave `anon` Supabase | Sì | Bundle frontend (`VITE_SUPABASE_ANON_KEY`) | ✅ Corretto — è pubblica per progettazione, la RLS è la protezione reale |
| JWT utente (dopo login) | Sì | Bundle frontend, gestito da Supabase Auth client | ✅ Corretto |
| Chiave `service_role` Supabase | **Mai** | Solo Edge Function/Node, mai loggata, mai committata | ✅ Verificato: zero occorrenze nel repository |
| Token bot Telegram | **Mai** in client | `Deno.env` dell'Edge Function `notify-telegram-reservation` | ✅ Corretto |
| Client secret OAuth2 Fatture in Cloud | **Mai** | Edge Function, variabile d'ambiente | Non ancora implementato — regola da rispettare quando si costruisce |
| API key modelli AI | **Mai** | Edge Function, variabile d'ambiente | Non ancora implementato — regola da rispettare quando si costruisce |
| Credenziali database dirette (connection string) | **Mai** in client | Solo se un processo bypassa PostgREST, da giustificare esplicitamente | Non presente nel progetto |

Qualunque occorrenza di una riga della colonna "Mai" trovata in un file che finisce nel bundle frontend è un'**anomalia critica (🔴)**, da riportare per prima in qualunque audit futuro.

---

## 4. Contratto RLS / Postgres — pattern verificati e vincolanti

Questi non sono suggerimenti: sono i pattern già in uso nel codice reale, e ogni nuova tabella/funzione deve seguirli senza variazioni.

- **RLS abilitata su ogni tabella, nessuna eccezione "temporanea".** Verificato oggi: zero tabelle senza RLS nel progetto (confermato dall'audit dell'08/08/2026 citato in CLAUDE.md).
- **Funzione `is_titolare()`** come unico punto di verifica del ruolo owner. Tabelle titolare-only: singola policy `for all ... using ((select is_titolare())) with check ((select is_titolare()))`.
- **Tabelle condivise fra ruoli**: policy separate per operazione — `select`/`insert` aperti allo staff, `update`/`delete` riservati al titolare dove previsto. Una restrizione va sempre replicata su `insert`/`update`/`delete`, non solo su `select` (sono policy indipendenti in Postgres — bug reale già trovato e corretto nel progetto).
- **Ogni funzione `security definer` ha `set search_path = public` esplicito.** Verificato oggi: 28 occorrenze nelle migrazioni, pattern rispettato.
- **Viste `_display` SECURITY DEFINER** (senza `security_invoker`) per nascondere colonne economiche allo staff pur mantenendo l'accesso — verificato oggi: 9 viste di questo tipo nel progetto, espongono solo colonne operative.
- **Ogni migrazione**: termina con un blocco `raise exception` che verifica l'effetto dichiarato, è idempotente (`if not exists`/`or replace`/`on conflict do nothing`), e si auto-registra in `applied_migrations`. Da agosto 2026 questi tre vincoli sono verificati automaticamente da un git hook (`.githooks/pre-commit`) che blocca il commit se mancano — non sono più affidati alla disciplina di chi scrive il codice.
- **Cancellazioni su tabelle economicamente/legalmente rilevanti**: mai un flag "cancellato", sempre un trigger che copia la riga in `deleted_records` prima della cancellazione reale. La cancellazione visibile all'app resta invariata; il registro esiste solo per ricostruibilità, non è consultabile dallo staff.
- **Ogni funzione esposta al ruolo `anon`** (form pubblico) deve avere un freno anti-abuso esplicito (limite per contatto, no-doppioni, tetto orario) — un indirizzo pubblico riceve invii automatici come norma, non come eccezione.

---

## 5. Stato reale per modulo (verificato sul codice, non atteso)

A differenza della v1, questa sezione non è una griglia di ipotesi: riporta lo stato effettivo trovato nel repository l'08/08/2026, commit `48638d7f`.

| Modulo | Stato | Categoria osservata |
|---|---|---|
| Ricettario | Costruito | A |
| Agenda / promemoria | Costruito, notifica Telegram in produzione | A + B2/B5 (Edge Function + pg_cron) |
| Fatture fornitori | Costruito (manuale, senza sincronizzazione automatica) | A — B2/B3 non ancora rilevanti (integrazione Fatture in Cloud non implementata) |
| Magazzino | Costruito | A |
| Cassa / Prima Nota | Costruito | A |
| Comande | **Parziale**: Sala rifatta e verificata dal vivo (08/08); Bar e Cucina rifatte (08-09/08); carta dei vini non costruita (manca la fonte dati) | A per lettura/presa ordini; **B1 obbligatorio quando arriva il mini-PC**; **B4 rispettato: il difetto sotto è stato corretto il 09/08** |

**✅ Difetto CORRETTO il 09/08/2026** — *riga aggiornata il 14/08/2026 su autorizzazione esplicita di Alessio (Sezione 0), perché il documento era rimasto indietro rispetto al codice: rilievo del validatore del 14/08. Il testo originale resta qui sotto come origine della decisione.*

> **Difetto reale trovato, non ipotetico**: `closeOrderAsDiscountGift` in `src/lib/api/orders.js` (righe 321-347) chiude un conto con sconto/omaggio con **due chiamate sequenziali separate dal client** — prima `createDiscountGift` (insert su `discounts_gifts`), poi un `update` su `orders`. Se la seconda fallisce dopo che la prima è riuscita, resta un record di sconto/omaggio senza il conto corrispondente chiuso: un'incoerenza contabile silenziosa. Correzione richiesta in due passi, non uno solo: (1) spostare l'operazione dietro un'Edge Function — il client non chiama più direttamente `orders`/`discounts_gifts`, chiama l'Edge Function; (2) dentro l'Edge Function, le due scritture diventano **una** funzione Postgres `security definer` chiamata via RPC, sul modello di `submit_public_reservation` — non due chiamate reincollate lato server, che lascerebbero il difetto identico. **Gravità 🟠** (violazione della regola B4, nessun segreto esposto, ma rischio concreto di incoerenza dei dati economici) — da correggere prima che il modulo Comande venga considerato chiuso, non solo segnalato.

**Come è stata fatta la correzione, ed entrambi i passi ci sono**: il client chiama `eseguiOperazione()` → Edge Function `operazioni-atomiche` → **una sola** funzione Postgres `close_order_as_discount_gift`, dove le due scritture avvengono nella stessa transazione. Non due chiamate reincollate lato server, che è il modo in cui questa correzione poteva fallire restando formalmente conforme. Verificato dal validatore il 14/08/2026.

⚠️ **La stessa forma di difetto si ripresenterà nella Sala** (rilievo del validatore, 14/08/2026): assegnare una prenotazione tocca la prenotazione **e** le righe dei tavoli, cioè due tabelle — quindi il corridoio è **obbligatorio**, non facoltativo. Per contro, un'operazione che scrive più righe su **una sola** tabella (come `completa_task`/`riapri_task` in Agenda) resta Categoria A e la chiamata diretta via RPC è corretta: a rendere necessario il corridoio è la seconda tabella, non il numero di righe.
| Calendario eventi / clienti | Costruito, form pubblico con freno anti-abuso | A + B2/B3 (Edge Function per notifica) |
| HACCP | Costruito; manca filtro di periodo sul manuale esportabile (§3.19 punto 5) | A |
| Agricolo | Costruito | A |
| Proiezione fiscale | Costruito | A |
| Ricerca ricorrente | Placeholder, non attivato | Non ancora costruito — bloccato su account AI di Alessio |
| Personale | Costruito | A |
| Monitoraggio social | Placeholder, non attivato | Non ancora costruito — bloccato su account AI |
| Editor menu | Costruito | A |
| Assistente AI | Placeholder, non attivato | Non ancora costruito — bloccato su account AI |
| Archivio documenti | Costruito | A |

**Aperto, non "non conforme"**: conto diviso, storni post-invio, asporto (§3.2.2) restano da specificare con l'esperienza diretta di Alessio in sala — non sono un difetto architetturale, sono una decisione di prodotto non ancora presa.

*Riga aggiornata il 14/08/2026 su autorizzazione esplicita di Alessio (Sezione 0), e **dichiarata al validatore** nel riepilogo della consegna che la contiene — condizione che lui stesso ha posto autorizzando la prima modifica di questo documento. **Il testo originale elencava anche i «tavoli uniti»**, e resta qui come origine della decisione.*

✅ **I TAVOLI UNITI NON SONO PIÙ UNA DECISIONE DA PRENDERE**: sono stati decisi il 14/08/2026 (mandato «Blocco Sala: la pianta viva») e sono in produzione dallo stesso giorno. La decisione, per esteso, perché una riga cancellata senza spiegazione non dice niente a chi controlla:

- **Un conto si aggancia a un INSIEME di tavoli**, con una chiave esterna (`order_tables`), non alla stringa `table_label`. **Tre tavoli accostati sono una comanda sola, non tre.**
- `orders.table_label` **resta ma cambia significato**: non è più l'aggancio, è **ciò che si stampa** sul ticket di cucina e sul preconto, fotografato all'apertura del conto. Un conto di ieri continua a dire i tavoli che aveva anche se la sala viene rinumerata — stesso principio del prezzo del coperto.
- ⚠️ **L'invariante «un tavolo non può stare su due conti aperti insieme» è un vincolo del database** (indice unico parziale su `order_tables`), non un controllo nel codice chiamante. Per esprimerlo serve una proiezione dello stato del conto sulla riga di collegamento — in Postgres un indice parziale vede solo le colonne della propria tabella — **scritta da un trigger e mai dall'applicazione**. Senza quella copia l'invariante non sarebbe esprimibile come vincolo, e sarebbe restato un `if` nel codice: cioè esattamente ciò che questo documento vieta.
- **Aprire, spostare e chiudere un conto su più tavoli passano dal corridoio** `operazioni-atomiche` (B4), ognuno come **una** funzione Postgres.
- **Nessuna entità «gruppo di tavoli»**: l'accostamento è dove Alessio ha messo le sagome sulla pianta, e non ha bisogno di essere rappresentato.

⚠️ **Conto diviso, storni post-invio e asporto NON sono stati toccati** dal blocco Sala, e restano aperti esattamente come prima.

---

## 6. Contratto di stile per il layer Edge Function / Node

Ogni processo di Categoria B, oggi o in futuro, rispetta senza eccezioni:

1. **Stesso middleware di autenticazione** — verifica del JWT Supabase, un'unica implementazione riusata.
2. **Stesso formato di risposta d'errore** in tutto il progetto.
3. **Nessuna logica di autorizzazione duplicata**: se la RLS decide già chi può fare cosa, l'endpoint non reimplementa lo stesso controllo con un `if` — passa il JWT dell'utente reale a valle, mai `service_role` per comodità.
4. **Idempotenza anche per i job pianificati (B5)** — non solo le migrazioni SQL.
5. **Nessun segreto letto da un file diverso da una variabile d'ambiente / secret store.**
6. **Ogni Edge Function nuova documenta nel proprio file, in testa, quale condizione B1-B5 la giustifica** — sul modello già in uso in `notify-telegram-reservation/index.ts`. Un'Edge Function senza questa dichiarazione è un'anomalia di stile da riportare (🟡).

---

## 7. Protocollo per l'agente validatore

Per ogni file di codice letto:

1. Identifica ogni funzione/endpoint che compie un'operazione sui dati (lettura o scrittura) o comunica con l'esterno.
2. Classificala secondo la Sezione 2 (A o B, e se B quale sotto-condizione B1-B5).
3. Confronta la classificazione reale con lo stato atteso in Sezione 5.
4. Verifica i vincoli obbligatori della categoria (Sezione 2) e, se Categoria B, il contratto di stile (Sezione 6).
5. Verifica esplicitamente la Sezione 3 (segreti) su ogni file che tocca `service_role`, API key, client secret, credenziali, o compare in `supabase/functions/`.
6. Verifica esplicitamente se un file di progetto (`CLAUDE.md` o altro) dichiara un principio architetturale strutturale non presente in questo documento — se sì, è una violazione della Sezione 0, da riportare indipendentemente dal fatto che il codice sia tecnicamente conforme.
7. Riporta ogni scostamento nel formato:

```
[GRAVITÀ] File:riga — Processo — Categoria attesa vs Categoria reale — Perché è un problema
```

Gravità: 🔴 (segreto esposto, RLS bypassata, o B1 delegato a Edge Function/client), 🟠 (violazione della regola A/B senza esposizione diretta, o principio architetturale dichiarato senza autorità), 🟡 (incoerenza di stile, nessun rischio di sicurezza).

**Non applicare correzioni — solo report.** Le correzioni si decidono con Alessio dopo la lettura del report.

---

## 8. Specifica di repository — vincolante

Non solo l'architettura del codice: anche dove e come vive il repository è fissato, verificato sul repository reale (commit `48638d7f`), non su ciò che un file di progetto *dice* di sé.

- **Repository unico**: `https://github.com/idearecreazioni-source/Borgo58-App.git`, un solo remote (`origin`), un solo branch di produzione: `master`. Nessun altro branch, nessun fork, nessun mirror — se ne comparisse uno, è un'anomalia da riportare, non una possibilità da assumere legittima.
- **Pubblicazione**: ogni push su `master` ripubblica automaticamente su Cloudflare Pages (`https://borgo58-app.pages.dev`) — non esiste uno stato "in prova" tra commit e produzione. Build command `npm run build`, output `dist`, `NODE_VERSION=22.16.0` esatto (non un maggiore generico — verificato che una versione generica può risolvere a una minor più vecchia incompatibile con Vite 8).
- **Chi fa cosa sul repository — vincolo di processo, non di codice**: **solo Alessio esegue `git push`.** Nessuna sessione IA esegue mai un push al posto suo, indipendentemente da quanto la sessione sia sicura che il codice sia corretto: è il solo passaggio che separa un commit dal sito pubblico.
  - **Modificato da Alessio il 12/08/2026 — applicazione delle migrazioni.** La versione precedente di questa riga imponeva che *anche* le migrazioni SQL le applicasse solo lui, copiandole a mano nell'SQL Editor, «MCP/CLI non funzionanti sulla sua macchina». **La premessa tecnica è scaduta** (PostgreSQL 17 è installato dal 10/08 per la copia di sicurezza e per il progetto di prova) e la pratica si è rotta sul campo: un file di 270 righe incollato nell'SQL Editor è arrivato troncato, e in un altro tentativo un comando PowerShell è finito dentro l'editor SQL. Alessio ha quindi deciso che **le migrazioni di produzione le applica la sessione Code**. La raccomandazione contraria gli è stata posta esplicitamente, dentro la scelta, e respinta.
  - **Cosa si è perso, detto per intero**: la vecchia regola non era una formalità — era il punto in cui un errore della sessione IA si fermava davanti a un essere umano prima di toccare i dati veri. Quel punto non esiste più. Al suo posto valgono cinque vincoli, elencati in `CLAUDE.md` §2 e riassunti qui perché sono ora parte del processo, non una convenzione: (1) niente in produzione che non sia già stato applicato e verificato sul progetto di prova; (2) annuncio ad Alessio *prima*; (3) resoconto dei numeri reali *dopo*; (4) solo migrazioni committate, con blocco di verifica — mai SQL improvvisato; (5) mai una modifica o cancellazione di dati veri fuori da una migrazione che si pulisce da sé.
  - **Resta ad Alessio**, e non è cambiato: il `git push`, l'installazione delle Edge Function (manca una chiave d'accesso Supabase sulla macchina — e quella chiave aprirebbe l'intero account, quindi è una decisione separata e più grossa), e l'inserimento di PIN e password.
- **Attivazione del controllo automatico pre-commit — verificato oggi, gap reale**: il git hook `.githooks/pre-commit` (lint zero, build, verifica migrazioni) **non si attiva da solo su un clone nuovo**. Richiede `git config core.hooksPath .githooks` eseguito una volta sulla macchina locale. Questo passo **non è documentato né in `README.md` né in `CLAUDE.md`** — verificato con una ricerca testuale su entrambi, nessun risultato. Finché non è documentato ed eseguito, un clone nuovo (una macchina sostituita, un secondo PC) perde silenziosamente tutti i controlli automatici del protocollo §7, tornando alla disciplina manuale che quei controlli dovevano sostituire. **Azione richiesta**: aggiungere il comando a `README.md` come passo di setup obbligatorio, e verificare che sia già impostato sulla macchina di Alessio.
- **`README.md` è disallineato con lo stato reale del progetto** — verificato oggi: descrive 11 moduli (i reali sono 15), login "mock" (il login reale con RLS è in produzione da mesi), e "nessuna logica dei moduli implementata" (falso: tutti i 15 moduli hanno un'implementazione funzionante secondo `CLAUDE.md` §7). Un repository il cui README pubblico contraddice lo stato reale è un rischio per chiunque lo apra senza il contesto di `CLAUDE.md` — un futuro sviluppatore, un consulente, lo stesso Alessio fra un anno. **Il README descrive lo stato del progetto per chi apre il repository dall'esterno; `CLAUDE.md` descrive le convenzioni operative per chi ci lavora dentro — sono due documenti diversi con scopi diversi, e vanno tenuti aggiornati entrambi, non solo il secondo.**
- **Convenzioni di struttura, già in uso e vincolanti d'ora in avanti**:
  - Migrazioni: `supabase/migrations/AAAAMMGGNNNNNN_nome-descrittivo.sql`, ordine cronologico, mai rinominate dopo l'applicazione.
  - Edge Function: `supabase/functions/<nome-funzione>/index.ts`, con commento in testa che dichiara quale condizione B1-B5 la giustifica (Sezione 6).
  - Funzioni client per dominio: `src/lib/api/<dominio>.js` — un file per modulo/entità, mai una funzione di un dominio scritta in un file di un altro.
  - Scambio con Cowork (storico — canale chiuso il 09/08/2026, i file restano come archivio): `_scambio_cowork_code/AAAAMMGG_mittente_oggetto.md`.
- **MCP `supabase-lettura`** (`.mcp.json`) è configurato **esplicitamente `read_only=true`**. Resta così: un cambio a lettura/scrittura è una decisione architetturale (dà a una sessione Code la capacità di scrivere sul database di produzione fuori da una migrazione revisionata da Alessio) e passa da qui, non da una modifica silenziosa del file.

---

*Documento preparato da Cowork il 09/08/2026. v2 sostituisce integralmente la v1 del 05/08/2026, questa volta verificata sul codice reale del repository `Borgo58-App`, commit `48638d7f`. Confermato da Alessio il 09/08/2026. Vive in `docs/CONTRATTO.md`. Ogni modifica passa da un commit approvato esplicitamente da Alessio; nessuna sessione IA lo modifica di propria iniziativa (Sezione 0).*
