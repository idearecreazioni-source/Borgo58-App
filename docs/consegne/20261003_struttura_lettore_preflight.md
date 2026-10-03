# La struttura del lettore del preflight — proposta NON applicata

**03/10/2026** · mandato M23-C (+ integrazione M23-C-1) · ramo
`claude/struttura-lettore-preflight` · base `slave` `303bee8`.

> 🔴 **Migrazione proposta, NON applicata** a Prova né alla produzione.
> - È una **preparazione autonoma del preflight**.
> - **Non fa parte del piano delle 17 migrazioni mancanti** e non va inclusa
>   in quel rilascio (`20261003000001` non è in `VERSIONI_DA_REGISTRARE`, e
>   una prova lo pretende).
> - Prima di qualunque applicazione richiede **prove controllate su Prova**.
> - **Password e login** richiedono una **decisione separata**: questa
>   migrazione non li tocca.

## Cosa contiene

- `supabase/migrations/20261003000001_il_lettore_del_preflight_senza_chiavi.sql`
- `tests/unita/lettore-preflight.test.js` — prove pure sul testo, 49
- `docs/decisioni_rovesciate.md` — la voce n. 97 e l’indice rigenerato
- questo documento

## Privilegi concessi

| Privilegio | Oggetto |
|---|---|
| ruolo `borgo58_preflight_reader`, `NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT` | — |
| `USAGE` | schema `public` |
| `SELECT (version)` — solo la colonna | `public.applied_migrations` |
| policy `applied_migrations_select_preflight`, `permissive`, `for select`, `to borgo58_preflight_reader`, `using (true)` | `public.applied_migrations` |

Le tre misure del catalogo leggono soltanto `applied_migrations.version`.
La policy serve perché la RLS del registro ammette il solo titolare: senza,
il lettore vedrebbe zero righe senza nessun errore.

## Privilegi esplicitamente negati

Login e password; `SUPERUSER`, `CREATEDB`, `CREATEROLE`, `REPLICATION`,
`BYPASSRLS`; appartenenze; ogni privilegio su altri schemi, tabelle intere,
viste, sequenze, altre colonne, funzioni, database, Vault; privilegi
predefiniti; `GRANT ALL`; ogni modifica ai privilegi di `PUBLIC`; ogni
`REVOKE`, `ALTER ROLE`, `ALTER DEFAULT PRIVILEGES`.

## Il ruolo già esistente (decisione 1 di M23-C-1)

- **assente** → lo crea;
- **esiste ed è una scatola vuota** → gli ridà soltanto i privilegi qui sopra;
- **esiste e non è vuoto** → si ferma con l'elenco dei motivi, **prima** di
  concedere, revocare o modificare alcunché.

I controlli della scatola vuota: login, password (solo «c'è o non c'è», mai il
valore; se il catalogo delle password non è leggibile, si ferma), i cinque
attributi amministrativi, appartenenza come membro e come contenitore,
oggetti posseduti, qualunque dipendenza registrata sul server, privilegi su
database, schemi, tabelle/viste/sequenze, colonne, funzioni, privilegi
predefiniti, regole di riga. I privilegi di `PUBLIC` non contano.

**Rilancio dello stesso file** (regola di idempotenza, CLAUDE.md § 5.3): se la
versione è già registrata e il ruolo esiste, il blocco non fa niente e passa
alla verifica. ⚠️ È un terzo ramo che l'integrazione non nomina: non
concede, non revoca e non modifica.

**Verifica finale**: pretende lo stato esatto — nessun attributo, nessuna
appartenenza come membro, nessun oggetto posseduto, nessuna dipendenza in
altri database, un solo privilegio di schema (`USAGE` su `public`), nessun
privilegio su tabelle intere, un solo privilegio di colonna
(`SELECT` su `version`), nessuna funzione, nessun privilegio predefinito, una
sola regola di riga ed è quella prevista, la regola del titolare ancora lì.

## Cosa non è verificato

Tutto ciò che segue si scopre solo nelle prove controllate su Prova:

- ⚠️ **L'appartenenza automatica del creatore.** Il server di Prova è
  PostgreSQL 17.6 (`docs/consegne/20260928_le_verifiche_trovate_da_un_indice.md`).
  Da PostgreSQL 16, se chi crea un ruolo non è superutente, diventa
  automaticamente membro del ruolo nuovo, con l'opzione di amministrarlo. Se
  `postgres` su Supabase non è superutente — **da qui non lo so** — il ruolo
  «contiene» `postgres`, e **la ricostruzione successiva di Prova si
  fermerà** sul controllo «contiene altri ruoli». Si ferma nel verso sicuro,
  ma va saputo prima. La verifica finale non controlla quel lato, per non
  far fallire la prima applicazione per una cosa che il creatore non sceglie.
- ⚠️ **`npm run ricostruzione:verifica`** crea un database usa-e-getta **sullo
  stesso server** di Prova: lì il ruolo avrebbe ancora i privilegi del
  database di Prova, registrati sul server, e il controllo della scatola vuota
  — che guarda tutto il server — **lo fermerebbe**. `npm run prova:ricostruisci`
  invece svuota lo schema del database stesso, e lì la scatola torna vuota.
- Se il catalogo delle password (`pg_authid`) è leggibile da chi applica. Se
  non lo è, il ramo «ruolo già esistente» si ferma sempre.
- Se `count(*)` funziona col solo permesso di colonna.
- Cosa il ruolo eredita da `PUBLIC`.
- Che il SQL giri: le prove sono sul **testo**. Ogni rottura delle regole
  è stata applicata e presa per il motivo giusto (40 rotture), ma nessuna
  istruzione è stata eseguita su un database.

## Cosa abbiamo rovesciato

- **Era stato deciso** (mandato M23-C, 03/10): se il ruolo esiste già, la
  migrazione si ferma.
- **La ragione di allora**: non modificare in silenzio i privilegi di un ruolo
  che qualcuno potrebbe aver toccato.
- **Cosa si decide adesso** (M23-C-1, Alessio): si accetta il ruolo
  esistente solo se è una scatola vuota, e si ferma in ogni altro caso.
- **Perché**: la ragione vale ancora, ed è rispettata per tutto ciò che non è
  vuoto; il prezzo accettato è un'eccezione scritta per il ruolo che non può
  fare niente, così che le ricostruzioni di Prova ripartano.
