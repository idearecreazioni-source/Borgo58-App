# Il rilascio del 05/11: scontrino dal conto, chiusura giornaliera, stampanti controllate, Agenda

Questo file nomina le migrazioni che entrano in produzione con questo rilascio, come chiede `npm run migra`.

## Cosa entra
Le PR unite su slave dopo il rilascio del 02/11 (#318):
- **#243:** il gestionale si carica a pezzi; Bar e Cucina rileggono solo quando sono sullo schermo.
- **#245:** accessibilità di base: il fuoco si vede, c'è «Vai al contenuto», finestre e campi hanno un nome.
- **#321:** lo scontrino fiscale dalla chiusura del conto, provato al collaudo del 04/11 con il registratore vero.
  - Uno scontrino per conto, mandato dal ponte al registratore Epson.
  - La chiusura giornaliera (Z) dalla pagina Stampanti.
  - La matricola del registratore si scrive e resta con ogni scontrino.
  - Le comande che la stampante non ha ricevuto escono da sole alla riaccensione, con l'avviso in Sala, Cucina e Bar.
  - Il controllo regolare delle stampanti, con la striscia rossa in cima al gestionale.
  - L'annullo dello scontrino è **sospeso**, nel gestionale, nel ponte e nel database. Si riaccende quando Alessio avrà il suo registratore.
- **#322:** Agenda, la vista scelta non ha più il bordo rosso. Chiude le segnalazioni 38135fbf e c70ed0c1; la seconda era già risolta da 6718733c il 28/10.

Le migrazioni, tutte della #321, in quest'ordine:
- **`20261104000001`** (`lo_scontrino_dalla_chiusura`)
- **`20261104000002`** (`l_annullo_e_la_chiusura_giornaliera`)
- **`20261104000003`** (`la_matricola_resta_con_lo_scontrino`)
- **`20261104000004`** (`la_comanda_esce_alla_riaccensione`)
- **`20261104000005`** (`il_controllo_delle_stampanti`)
- **`20261104000006`** (`l_annullo_e_sospeso`)
- **`20261104000007`** (`i_vincoli_dello_scontrino_parlano`)

Nessun dato del collaudo entra in produzione. Il collaudo è stato fatto su Prova, e la matricola del registratore di prova compare solo in un commento.

Funzioni online: nessuna cambiata.

Il ponte che gira sul PC del locale si aggiorna a parte, quando Borgo58 avrà le sue stampanti.

## Ordine
1. Questo riepilogo su slave, poi slave → master.
2. Copia di sicurezza della produzione (`npm run backup`).
3. Prima delle migrazioni, in sola lettura: in produzione ci sono almeno un `titolare` e uno `staff` in `user_roles`, e almeno una riga in `entities`. Le verifiche delle migrazioni li usano; se mancano, il file si ferma e si annulla da solo, senza danni.
4. `npm run migra`, prima in sola lettura e poi con `--conferma`. Ogni migrazione è una transazione sola, e le verifiche lasciano il database come l'hanno trovato (controllo `ecc:database-reviewer` del 05/11: pronte, nessun dato del collaudo).
5. Approvazione del lavoro «Manda in produzione» per il sito.

Le migrazioni vanno prima del sito, perché il sito nuovo chiama le funzioni del database che creano (`stato_scontrino`, `avvisi_stampa`, `allarmi_apparecchi`).

## Cosa si controlla dopo
- `npm run migra` in sola lettura: nessuna migrazione mancante.
- Il sito di produzione risponde con la versione nuova.
- La pagina Stampanti si apre, e l'annullo dice che è sospeso.
- In produzione le due segnalazioni dell'Agenda si segnano come risolte.
