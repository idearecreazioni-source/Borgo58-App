# Il rilascio della notte: permessi di anon e voce in una transazione — 27/10/2026

**HEAD dichiarato sotto questo riepilogo:** `eeb08ba` (slave), con master `b56ac88` (unione di #240). Solo documentazione: i numeri dell'applicazione in produzione, come chiede §2 di CLAUDE.md («glielo riporto DOPO, con i numeri»).

## Cosa è stato rilasciato, autorizzato da Alessio il 26/10 sera («Stanotte»)
- **#238:** `20261026000001_chi_non_e_entrato_non_eredita_niente`.
- **#239:** `20261026000002_la_voce_si_chiude_insieme_al_dato`, più `operazioni-atomiche` con `registra_movimento_cassa` e `aggiungi_spesa_spicciola`.
- **Prima** era stato necessario il rientro di master in slave (#242), perché il cancello della filiera fermava il rilascio.

## Numeri, misurati
- **`npm run migra` in sola lettura:**
  - nel repository 440, in produzione 438;
  - da applicare esattamente le due attese;
  - copia di sicurezza del 26/10 alle 11:57.
- **`npm run migra -- --conferma`:** applicate e registrate 2 su 2. Totale in produzione: **440**.
  - La verifica della `…000002` in produzione: «Provato e annullato: zero residui».
- **Audit dei permessi rilanciato in produzione dopo**, in sola lettura: **8** funzioni eseguibili da anon (le stesse di prima, tutte volute) e **12** privilegi predefiniti, tutti del ruolo `supabase_admin`.
  - Prima erano 16: i **4** del ruolo `postgres` non ci sono più.
  - I 12 di `supabase_admin` non si possono togliere dal ruolo delle migrazioni, misurato il 26/10 sulla prova.
- **`npm run funzione operazioni-atomiche -- --conferma`:** produzione versione 41 → 42. Riscaricata la funzione installata: contiene le due operazioni nuove.

## Non verificato
- Una cosa detta a MEMO e finita a mano in Prima nota sul gestionale vero. Le prove automatiche e la verifica della migrazione l'hanno provata sul progetto di prova e, nella migrazione, anche sul vero, con tutto annullato. Una prova a mano spetta ad Alessio.

## Dato per fatto senza misurarlo
- Nulla.

## Affermazioni diventate false durante il lavoro
- Nessuna.

## Cosa abbiamo rovesciato
Nessuna decisione rovesciata in questo rilascio. Quella sulla spesa spicciola è già registrata, voce 109.
