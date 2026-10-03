# L'identità di sola lettura del preflight — proposta

**03/10/2026** · mandato M23-A (+ integrazione M23-A-1) · ramo
`claude/identita-sola-lettura-preflight` · base `slave` `bd73059` ·
**solo documento**: nessuna migrazione, nessun ruolo, nessuna password,
nessuna connessione.

> 🔴 **Questa è una proposta, non un'identità.** Niente è stato creato,
> configurato o provato su nessun database. Il documento dice **cosa**
> servirebbe e **in che ordine**, e dichiara apertamente il punto in cui
> oggi **non esiste un percorso conforme** alle regole del progetto (§ 5.3).
> Il preflight resta NON PRONTO.

Riferimenti già uniti in `slave` e letti per scrivere questo documento:

- `docs/consegne/20261002_disegno_adattatore_protetto_preflight.md` — il
  disegno dell'adattatore; questo documento sviluppa i suoi §§ 5 e 12
  («se si può creare un'identità dedicata in sola lettura, e chi la crea e
  la custodisce»);
- `scripts/preflight-produzione-sanitizzato.mjs` — i 20 campi di `CAMPI`;
- `scripts/esegui-preflight-produzione.mjs` — l'orchestratore;
- `supabase/migrations/20260805000001_registro_migrazioni.sql` — la
  definizione di `applied_migrations`, della sua RLS e dei suoi permessi;
- il catalogo offline delle 20 misure (mandato M22-D, **fuori dal
  repository**): ne usa soltanto la classificazione — 3 misure con
  interrogazione fissa sul database, 17 a `null`.

---

## 1. Lo scopo, ristretto

L'identità serve **soltanto** alle tre misure del catalogo che il database
può dare da sé:

| Misura (`CAMPI`) | Tipo | Cosa dice |
|---|---|---|
| `produzione_ultima_registrata` | versione | la versione più alta registrata |
| `produzione_versioni_mancanti` | versioni | quali delle 17 versioni del contratto non risultano registrate |
| `produzione_versioni_estranee` | conteggio | quante versioni registrate non stanno nell'elenco del repository |

Le altre 17 misure **non** la riguardano: nel catalogo sono `null` (fonte
esterna, cassaforte dei valori riservati, o non misurabile con certezza),
e questa proposta non le rende ottenibili. In particolare **le quattro
misure sul Vault restano fuori**: l'identità non deve poterle leggere
nemmeno in forma ridotta.

## 2. Gli oggetti che le tre interrogazioni leggono

Ricavati dal testo delle tre interrogazioni fisse del catalogo, senza
riportarle:

| Oggetto | Dove | Cosa ne leggono |
|---|---|---|
| tabella `applied_migrations` | schema `public` | **la sola colonna `version`** |
| funzioni di aggregazione e di elenco integrate (`max`, `count`, `array_agg`, `coalesce`, `unnest`) | catalogo di sistema | niente: sono funzioni integrate di PostgreSQL |

Nessuna delle tre legge `name`, `applied_at` o `note`, nessuna tocca un'altra
tabella, una vista, una funzione dell'applicazione o lo schema del Vault.

⚠️ **Il fatto che decide la forma dei permessi**: su `applied_migrations` la
**RLS è accesa** e l'unica policy è
`applied_migrations_select_titolare … for select to authenticated using ((select is_titolare()))`
(migrazione `20260805000001`, righe 44-47). Un'identità nuova, **senza**
`BYPASSRLS` — che è vietato — **vedrebbe zero righe**, senza nessun errore:
`max` risponderebbe vuoto, le «mancanti» sarebbero tutte e 17, le
«estranee» zero. È la forma che questo progetto conosce bene: *una risposta
più corta che ha l'aria di essere intera* (CLAUDE.md § 8). Quindi il solo
`GRANT SELECT` **non basta**: serve anche una policy dedicata (§ 3).

## 3. La matrice dei privilegi minimi

| Privilegio | Oggetto | Motivo | Cosa resta vietato |
|---|---|---|---|
| `LOGIN` | l'identità stessa | per collegarsi | `SUPERUSER`, `CREATEDB`, `CREATEROLE`, `REPLICATION`, `BYPASSRLS` — tutti espliciti a `NO…` |
| `CONNECT` | il database | per aprire la sessione | ogni altro database del cluster |
| `USAGE` | schema `public` | per risolvere il nome della tabella | `CREATE` su `public`, e qualunque permesso sugli **altri** oggetti dello schema |
| `SELECT (version)` — permesso **di colonna** | `applied_migrations` | è l'unica colonna letta | `name`, `applied_at`, `note`; `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `REFERENCES`, `TRIGGER` |
| policy `FOR SELECT TO <identità> USING (true)` | `applied_migrations` | senza, la RLS restituisce zero righe in silenzio (§ 2) | nessuna policy su nessun'altra tabella |
| impostazioni dell'identità: `default_transaction_read_only = on`, un `statement_timeout`, un `idle_in_transaction_session_timeout`, `CONNECTION LIMIT` basso, una scadenza `VALID UNTIL` | l'identità stessa | primo livello di sola lettura e di tempo limite, prima ancora dell'adattatore (disegno § 5) | — |

**Nessun permesso** su: le altre tabelle e viste di `public`, le funzioni
dell'applicazione, lo schema `vault`, `auth`, `storage`, `cron`, `net`,
`supabase_migrations`.

### Due punti da dimostrare, non già dimostrati

- ⚠️ **`count(*)` con il solo permesso di colonna**: la terza misura conta
  righe filtrando su `version`. Che il permesso sulla sola colonna `version`
  basti va **dimostrato su Prova** (§ 7). Se non bastasse, la misura resta
  `null` — non si allarga il permesso a tutta la tabella senza una nuova
  decisione.
- ⚠️ **Ciò che l'identità eredita da `PUBLIC`**: ogni ruolo nuovo riceve i
  permessi concessi a `PUBLIC`. Questo progetto sa che una funzione nasce
  eseguibile da `PUBLIC` se non viene revocata (CLAUDE.md § 8), e la prova
  `tests/app/permessi.test.js` elenca **13 funzioni** eseguibili con la
  sola chiave pubblica — fra cui tre che scrivono
  (`submit_public_reservation`, `registra_dettatura_da_chiave`,
  `voce_apri_sessione`). **Da qui non so** se quelle 13 sono concesse a
  `anon` o a `PUBLIC`, e quindi se la nuova identità le erediterebbe. La
  sessione in sola lettura respingerebbe le scritture, ma non le letture.
  Va **misurato su Prova** prima di tutto il resto (§ 7, passo 2), ed è una
  condizione di stop (§ 9).

## 4. Cosa NON serve, detto esplicitamente

- **Nessun privilegio sui dati dell'applicazione**: le tre misure leggono un
  registro di servizio, non ricette, conti, clienti, documenti o movimenti.
- **Nessun privilegio sul Vault**: nessuna delle tre misure lo nomina. Le
  misure sul Vault restano `null` e fuori da questa identità.
- **Nessun privilegio sulle funzioni dell'applicazione**: nessuna `EXECUTE`
  su funzioni di `public`. Le funzioni integrate usate dalle interrogazioni
  non richiedono permessi concessi apposta.

## 5. Il percorso di creazione

Diviso in tre parti, perché le regole del progetto le trattano in modo
diverso.

### 5.1 La parte strutturale — c'è un percorso conforme

Ruolo **senza login**, permessi della § 3 e policy dedicata **possono**
nascere da **una migrazione del repository**, col percorso normale:
committata → passata dal progetto di prova e verificata lì → su GitHub →
applicata in produzione con `npm run migra -- --conferma`, con riepilogo
(CLAUDE.md § 2, regole 1-5). La migrazione:

- crea l'identità con `NOLOGIN` e tutti gli attributi vietati a `NO…`;
- concede **solo** quanto in § 3;
- termina con un **blocco di verifica** che solleva eccezione se l'identità
  ha un attributo vietato, un permesso su un oggetto diverso da quelli della
  § 3, o se la policy manca;
- si auto-registra in `applied_migrations`.

**Non contiene nessuna password**, e per costruzione non dà a nessuno la
possibilità di collegarsi: in produzione l'identità esisterebbe ma resterebbe
chiusa. Questa migrazione **non è scritta qui**: la scrive un mandato
successivo, se Alessio lo decide.

⚠️ Che `postgres` possa creare un ruolo **sul progetto di produzione** non
l'ho misurato. Il repository lo fa già sul solo progetto di prova
(`scripts/backup-ripristina.mjs:86`, `scripts/ricostruzione-verifica.mjs:100`,
`create role … nologin`): è un indizio, non una prova per la produzione.

### 5.2 La password — oggi NON esiste un percorso conforme

Dare la password all'identità e aprirle il login **non può** stare in una
migrazione: la password finirebbe nel repository. E **non può** essere SQL
scritto a mano in produzione: CLAUDE.md § 2, regola 4 — *«se non è un file
del repository con la sua verifica, non entra»*.

Le regole del progetto, così come sono scritte, **non prevedono un passo
manuale ammesso** per mettere un segreto in produzione. Lo dichiaro invece di
inventarne uno.

Per arrivarci serve **una decisione di Alessio** su un'eccezione scritta.
Una forma candidata, da valutare e **non** già verificata:

- lo fa **Alessio**, non Claude Code, da una sessione interattiva come
  proprietario del database;
- con un comando che **chiede la password a tastiera** invece di riceverla
  come argomento (il candidato è `\password` di `psql`), così non passa da
  argomenti di processo, file, `.env` o cronologia;
- ⚠️ se quel comando invii al server la password già cifrata, e se la
  password possa finire nei log del database, **non lo so**: va dimostrato
  sul progetto di prova (§ 7) prima di usarlo in produzione;
- la stessa sessione apre il login (`LOGIN`) e fissa la scadenza
  (`VALID UNTIL`) — due attributi senza segreti, che potrebbero invece stare
  in una seconda migrazione se si preferisce.

⚠️ **E il collegamento di quella sessione è a sua volta un punto aperto**:
oggi gli strumenti del repository passano l'indirizzo del database a `psql`
come argomento (`scripts/comune.mjs`, l'opzione `-d` alla riga 283), cioè
nella forma che il disegno dell'adattatore (§ 4) vieta per una credenziale.
Questa proposta non lo cambia; segnala che **nemmeno il passo della
password può riusarla così com'è**.

### 5.3 In sintesi

| Parte | Percorso conforme oggi? |
|---|---|
| ruolo `NOLOGIN`, permessi, policy, verifica | **sì**: una migrazione col percorso normale |
| password e apertura del login | **no**: serve un'eccezione decisa da Alessio |
| collegamento dell'adattatore con la password | **no**: il disegno lo lascia aperto (§ 12 del disegno) |

## 6. La custodia

- **Gestione credenziali di Windows**, sul computer di Alessio, in una
  **voce nuova e dedicata**, una per ambiente (Prova e produzione **mai** la
  stessa voce).
- **La crea Alessio**, a mano. Claude Code non la crea, non la legge, non la
  elenca.
- **Il nome della voce non entra nel repository**: lo sceglie lui, e lo
  ricevono solo l'adattatore e la persona che lo lancia.
- **Mai Gestore password di Google come fonte automatica**: si può tenere
  lì una copia per il recupero, se Alessio lo decide, ma nessun programma ci
  attinge.
- I passi a schermo per creare la voce **non sono scritti qui**: quella
  finestra da qui non si può aprire, e si descrive guardandola, al momento.
- ⚠️ Come l'adattatore leggerà quella voce **senza** farla passare da
  argomenti, file o output è una decisione **del mandato dell'adattatore**,
  non di questo: qui si sceglie solo **dove sta**.

## 7. Il piano di prova, prima su Prova

L'identità di Prova è **distinta** da quella di produzione: database diverso,
password diversa, voce di custodia diversa. Si revoca da sola senza toccare
la produzione.

Nell'ordine, ogni passo condizione del successivo:

1. la migrazione della § 5.1 applicata **solo** sul progetto di prova, col
   suo blocco di verifica verde;
2. **misura dell'eredità da `PUBLIC`**: quali funzioni di `public`
   l'identità di Prova può eseguire, e quali tabelle o viste può leggere,
   chiesto al catalogo del database. Atteso: **nessuna** oltre a
   `applied_migrations` (colonna `version`). Se ne compare anche una sola,
   **stop** (§ 9);
3. il passo della password (§ 5.2) fatto da Alessio su Prova, dimostrando
   che la password **non compare** nei log del database, negli argomenti dei
   processi, nella cronologia del terminale;
4. collegamento come identità di Prova, e controllo che la sessione risulti
   **in sola lettura** senza averlo chiesto;
5. le tre interrogazioni del catalogo danno risposte **dei tipi attesi** e
   **non vuote per errore** (la versione più alta registrata su Prova deve
   coincidere con quella che il proprietario legge dallo stesso registro);
6. **rotture apposta**, che devono essere tutte respinte dal database:
   un `INSERT` su `applied_migrations`; un `SELECT` sulla colonna `name`; un
   `SELECT` su una tabella dell'applicazione; un `SELECT` sullo schema del
   Vault; l'esecuzione di una funzione dell'applicazione;
7. revoca di prova (§ 8) e controllo che il collegamento successivo venga
   rifiutato.

Solo dopo, **un mandato separato** per la produzione.

## 8. Rotazione e revoca

- **Scadenza**: l'identità nasce con una `VALID UNTIL` vicina. Scaduta, non
  si collega più senza che nessuno debba ricordarsene.
- **Rotazione**: password nuova con lo stesso passo della § 5.2, voce di
  custodia aggiornata da Alessio, vecchia password inutilizzabile
  dall'istante del cambio. Nessuna sovrapposizione di due password valide.
- **Revoca immediata** (sospetto di fuga, fine del bisogno): `NOLOGIN` sul
  ruolo — un attributo senza segreti, che può stare in una migrazione — e
  cancellazione della voce di custodia da parte di Alessio.
- **Rimozione definitiva**: una migrazione che toglie prima la policy, poi i
  permessi, poi il ruolo (un ruolo nominato da una policy non si può
  togliere finché la policy esiste).
- Ogni rotazione o revoca si dichiara nel riepilogo della consegna in cui
  avviene.

## 9. Condizioni di stop prima di qualunque accesso reale

Ci si ferma, senza correggere e senza riprovare, se:

- l'identità risulta avere anche uno solo degli attributi vietati;
- l'identità può leggere qualcosa oltre la colonna `version` di
  `applied_migrations`, o eseguire una funzione dell'applicazione, anche
  per eredità da `PUBLIC`;
- l'identità può vedere lo schema del Vault;
- il passo della password non ha un percorso deciso e scritto da Alessio
  (§ 5.2);
- la password compare in un comando, un argomento di processo, un output,
  un log, un file, il repository, `.env` o GitHub;
- la sessione non risulta in sola lettura;
- una delle tre misure su Prova restituisce un risultato vuoto che il
  proprietario sa non essere vuoto (il caso della RLS, § 2);
- una rottura della § 7 passo 6 **non** viene respinta;
- si dovrebbe agire sulla produzione senza un mandato separato.

## Cosa non è verificato

- Che `postgres` possa creare ruoli sul progetto di produzione (§ 5.1).
- Che `count(*)` funzioni col solo permesso di colonna (§ 3).
- Cosa l'identità erediterebbe da `PUBLIC` (§ 3, § 7 passo 2).
- Che `\password` non esponga la password nei log o in rete (§ 5.2).
- Che il collegamento al database funzioni con un ruolo personalizzato
  attraverso l'infrastruttura di Supabase.
- Ogni proprietà di questo documento: sono requisiti, non misure.

## Cosa abbiamo rovesciato

Niente. La proposta sviluppa il disegno del 02/10 (§§ 5 e 12): identità
dedicata, sola lettura su due livelli, prova su Prova con identità distinta.
Non tocca la regola del § 2 di CLAUDE.md sullo «SQL improvvisato in
produzione»: dichiara invece che il passo della password oggi **non** ha un
percorso conforme a quella regola.
