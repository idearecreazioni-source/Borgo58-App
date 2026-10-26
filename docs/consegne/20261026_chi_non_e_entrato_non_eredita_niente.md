# Chi non è entrato non eredita niente — 26/10/2026

**HEAD dichiarato sotto questo riepilogo:** `cbf3898`, sul ramo `claude/permessi-predefiniti-anon` aperto da `origin/slave` `4a2716c`. Tre commit: `4f90da6` (migrazione), `97dae3e` (verifica più stretta, dalla revisione ECC) e `cbf3898` (i nomi delle funzioni scritti in modo che la rete dei portieri non li scambi per chiamate: falso allarme della CI su #238). Working tree pulito.
**Migrazione `20261026000001_chi_non_e_entrato_non_eredita_niente`: applicata SOLO al progetto di prova**, non alla produzione. Nessuna funzione online, nessun dato toccato.

## Origine
L'audit dei permessi (`supabase/diagnostica/20261026_audit_permessi.sql`) è stato lanciato sul gestionale vero da Alessio la sera del 26/10, e ha dato 24 righe:
- le 8 funzioni eseguibili da anon, le stesse della prova e tutte attese;
- 16 privilegi predefiniti per anon nello schema `public`, che sulla prova non ci sono:
  - ruolo `postgres`, tabelle: MAINTAIN, TRUNCATE, REFERENCES, TRIGGER;
  - ruolo `supabase_admin`: tutto su tabelle, sequenze e funzioni.

Alessio ha deciso di farli togliere dopo il rilascio della sicurezza P0, provando la modifica sul database di prova e fermandosi alla copia di prova.

## Cosa cambia
- Via i predefiniti di `postgres` per anon su tabelle e sequenze di `public`.
- Via TRUNCATE, TRIGGER, REFERENCES e MAINTAIN per anon da tutte le tabelle esistenti di `public`, e ogni privilegio di anon dalle sequenze.
- Tentativo sui predefiniti di `supabase_admin`, dentro un blocco che se manca il permesso lo dice e va avanti.
- **Le funzioni non si toccano.** La verifica pretende che le 8 funzioni pubbliche restino eseguibili da anon:
  - il modulo di prenotazione: `submit_public_reservation`, `public_reservation_options`, `giorni_chiusi_prenotabili`;
  - la chiave della voce: `voce_apri_sessione`, `registra_dettatura_da_chiave`;
  - le funzioni di servizio: `is_titolare`, `normalize_phone`, `task_origin_visible_to_staff`.

## Verificato
- Progetto di prova, prima applicazione e poi riapplicazione per nome: verifica superata tutte e due le volte, quindi idempotente. Il primo lancio si era fermato per un mio errore nel controllo delle sequenze («saml_providers_pkey is not a sequence»): la migrazione era stata annullata intera (`applied_migrations` senza la versione) e poi corretta.
- Audit dei permessi rilanciato sulla prova dopo la migrazione: le stesse 8 righe attese, nient'altro.
- **Misurato:** il ruolo che applica le migrazioni non può cambiare i predefiniti di `supabase_admin` («permission denied to change default privileges»).
- Revisione `ecc:database-reviewer`: nessun errore bloccante. Accolti tre rilievi:
  - messaggio finale onesto su quanto resta di `supabase_admin`;
  - privilegi di colonna;
  - verifica di tutte e 8 le funzioni.

## Non verificato
- **La produzione.** Lì la migrazione toglierà i 4 predefiniti di `postgres` e lascerà i 12 di `supabase_admin`, che sono della piattaforma: il messaggio finale li conterà. Che sia così sul vero lo dirà la migrazione stessa quando verrà applicata.
- Il modulo pubblico di prenotazione provato dal vivo dopo la migrazione: la verifica controlla i permessi delle funzioni, ma non ho compilato una prenotazione.

## Dato per fatto senza misurarlo
- Nulla.

## Affermazioni diventate false durante il lavoro
- Nel resoconto della sera ho detto che la pulizia avrebbe tolto le 16 impostazioni. Ne toglie 4: le altre 12 non si possono cambiare dal nostro ruolo.

## Cosa abbiamo rovesciato
Nessuna decisione rovesciata. La concessione del 31/07 (`20260731000001_grants_authenticated.sql`) riguarda `authenticated` e resta intatta: la verifica (5) lo controlla.
