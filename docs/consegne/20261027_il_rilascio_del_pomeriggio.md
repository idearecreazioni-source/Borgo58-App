# Il rilascio del pomeriggio: voce lotto 2, spesa detta finita a mano, restyling — 27/10/2026

**HEAD dichiarato sotto questo riepilogo:** `223242e` (slave, dopo il rientro #251), con master `4a8c574` (unione di #249). Solo documentazione: i numeri dell'applicazione in produzione, come chiede §2 di CLAUDE.md («glielo riporto DOPO, con i numeri»).

## Cosa è stato rilasciato, autorizzato da Alessio il 27/10 («Unisci pure, procedi»)
- **#246:** `20261027000001_la_voce_si_chiude_col_dato_magazzino_e_haccp`, più le sei operazioni nel corridoio `operazioni-atomiche`.
- **#247:** `20261027000002_la_spesa_da_collocare_si_finisce_a_mano`, più `annota_spesa_dettata_a_mano` nel corridoio.
- **#248:** restyling «Osteria raffinata», primo passo: titoli in Bricolage Grotesque e tema Chiaro/Scuro/Come il telefono. Nessun database.
- **Prima** è servito il rientro di master in slave (#250), perché il cancello della filiera fermava il rilascio. Dopo ce n'è stato un altro (#251), per il prossimo.
- Il cancello è stato rilanciato una volta: aveva controllato prima che Prova finisse di pubblicare il commit.

## Numeri, misurati
- **Copia di sicurezza:** la più recente aveva 28,4 ore, e `migra` si è fermato (limite 24).
  - `npm run backup`: `Borgo58_backup_2026-10-27_1621.zip`, 787 KB.
  - Controllata: 144 tabelle su 144, 1736 righe su 1736, 4 utenti e 4 identità.
- **`npm run migra` in sola lettura:** nel repository 442, in produzione 440. Da applicare esattamente le due attese.
- **`npm run migra -- --conferma`:** applicate e registrate 2 su 2. Totale in produzione: **442**.
  - Entrambe le verifiche in produzione: «Provato e annullato: zero residui».
- **`npm run funzione operazioni-atomiche -- --conferma`:** produzione versione 42 → 43.
  - Riscaricata la funzione installata: contiene `annota_spesa_dettata_a_mano`.
  - `annota_spesa_dettata_a_mano` esiste nel database vero (`funzione:viva`).
- **Sito in produzione:** «Manda in produzione» verde sul commit `4a8c574`. La pagina pubblicata carica `/tema.js` e Bricolage Grotesque.
- La copia temporanea di `.env` è stata cancellata.

## Non verificato
- Sul gestionale vero:
  - una spesa detta a MEMO e finita a mano;
  - il tema scuro dopo l'accesso.
- Spettano ad Alessio: il PIN non lo uso.
- Che la copia di sicurezza sia portata fuori dal computer: spetta ad Alessio.

## Dato per fatto senza misurarlo
- Nulla.

## Affermazioni diventate false durante il lavoro
- Nessuna.

## Cosa abbiamo rovesciato
Nessuna decisione rovesciata in questo rilascio. Il carattere dei titoli è già registrato nel riepilogo del restyling.
