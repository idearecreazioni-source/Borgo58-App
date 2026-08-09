# Prove automatiche — come funzionano

Due livelli, due comandi:

| Comando | Cosa prova | Serve la rete? |
|---|---|---|
| `npm run test` | Le regole pure: date del locale, calcolo del conto | No — gira anche a ogni commit (gancio pre-commit) |
| `npm run test:app` | Il database vero: permessi per ruolo, corridoio, giro comanda completo | Sì — Supabase di produzione, con utenti di PROVA |

## Utenti di prova (una tantum)

Le prove entrano come i tablet: con **utenti dedicati**, mai coi PIN reali.

1. Dashboard Supabase → **Authentication → Users → Add user** → creare:
   - `test-titolare@borgo58.app`
   - `test-staff@borgo58.app`
   (stessa password per entrambi va bene: vivono nello stesso file locale)
2. Assegnare i ruoli: eseguire `supabase/diagnostica/20260809_setup_utenti_di_prova.sql` nell'SQL Editor.
3. Copiare `.env.test.example` in `.env.test` e scrivere la password.
   `.env.test` è escluso dal repository (`.gitignore`): **non va mai committato**.

## Regole di comportamento delle prove sull'app

- Lettura libera; scritture SOLO su dati di prova marcati (`TEST-AUTO`, `__PROVA__`), sempre ripulite alla fine — anche se un giro precedente è morto a metà.
- **Mai** creare-e-cancellare righe nelle tabelle sorvegliate da `deleted_records` (soldi/fisco/personale/documenti): lascerebbero lapidi di prova nel registro delle cancellazioni. Quei percorsi sono già provati dentro le migrazioni, che girano da amministratore e ripuliscono anche il registro.
- L'utente `test-titolare` è un titolare a tutti gli effetti: la password va trattata come una chiave vera.
- **I file di prova girano in fila, non insieme** (`--no-file-parallelism`): il database è uno solo, e in parallelo si pestano i piedi in modi che sembrano guasti veri. Successo due volte il 10/08/2026 — un file che aggiungeva un tavolo mentre un altro contava i coperti liberi, e un `signOut()` globale che buttava fuori l'utente all'altro file a metà corsa. In fila costano qualche secondo in più e non mentono.
- `signOut()` è **globale**: nelle prove va sempre `signOut({ scope: "local" })`.
