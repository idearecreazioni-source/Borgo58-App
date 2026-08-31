# Prove automatiche — come funzionano

Due livelli, due comandi:

| Comando | Cosa prova | Serve la rete? |
|---|---|---|
| `npm run test` | Le regole pure: date del locale, calcolo del conto | No — gira anche a ogni commit (gancio pre-commit) |
| `npm run test:app` | Un database vero: permessi per ruolo, corridoio, giro comanda completo | Sì — il **progetto di prova**, con utenti di PROVA |

## Dove girano (cambiato il 10/08/2026)

Fino al 10/08 le prove scrivevano nel database del locale. Adesso girano
sul **progetto di prova** (`docs/AMBIENTE_PROVA.md`): un database
usa-e-getta, ricostruibile da zero con un comando. Se `.env`
contenesse l'indirizzo del progetto vero, le prove **non partono**: il
controllo è in `aiuto.js`, non nella buona memoria di chi le lancia.

## Utenti di prova (una tantum)

Le prove entrano come i tablet: con **utenti dedicati**, mai coi PIN reali.

1. Dashboard Supabase, **progetto Borgo58-Prova** → **Authentication →
   Users → Add user** → creare `test-titolare@borgo58.app` e
   `test-staff@borgo58.app` (stessa password va bene: è un database di
   prova, e vivono nello stesso file locale).
2. I ruoli li assegna già `npm run prova:ricostruisci`. Se servisse
   rifarlo a mano: `supabase/diagnostica/20260809_setup_utenti_di_prova.sql`
   nell'SQL Editor **del progetto di prova**.
3. Copiare `.env.example` in `.env` e completarlo (indirizzo del
   progetto di prova, chiave anon, password).
   `.env` è escluso dal repository (`.gitignore`): **non va mai committato**.

## Regole di comportamento delle prove sull'app

- Lettura libera; scritture SOLO su dati di prova marcati (`TEST-AUTO`, `__PROVA__`), sempre ripulite alla fine — anche se un giro precedente è morto a metà.
- **Una prova su una tabella vuota non dimostra niente** (protocollo §7 punto 2): sul progetto di prova le tabelle nascono vuote, e "lo staff non vede gli ingredienti" passerebbe identico a RLS spenta. Gli aiuti `almenoUnaRiga()` e `almenoUnTavolo()` creano la riga che serve e la tolgono alla fine.
- **Niente prove saltate in silenzio**: se il corridoio non è installato sul progetto di prova, le sue tre prove vengono saltate e una riga resta rossa a dirlo. Un buco di copertura muto, dopo un mese, è un buco che nessuno sa di avere.
- **Mai** creare-e-cancellare righe nelle tabelle sorvegliate da `deleted_records` (soldi/fisco/personale/documenti): lascerebbero lapidi di prova nel registro delle cancellazioni. Quei percorsi sono già provati dentro le migrazioni, che girano da amministratore e ripuliscono anche il registro.
- L'utente `test-titolare` è un titolare a tutti gli effetti: la password va trattata come una chiave vera.
- **I file di prova girano in fila, non insieme** (`--no-file-parallelism`): il database è uno solo, e in parallelo si pestano i piedi in modi che sembrano guasti veri. Successo due volte il 10/08/2026 — un file che aggiungeva un tavolo mentre un altro contava i coperti liberi, e un `signOut()` globale che buttava fuori l'utente all'altro file a metà corsa. In fila costano qualche secondo in più e non mentono.
- `signOut()` è **globale**: nelle prove va sempre `signOut({ scope: "local" })`.
