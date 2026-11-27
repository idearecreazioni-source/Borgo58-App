# Ripristino e ricostruzione di Prova — consegna del 27/11/2026

Solo strumenti e documentazione: **nessuna migrazione, nessun dato, nessun cambiamento al sito.** Non tocca work.

## Che cosa si è corretto (dalla prova di ripristino del 25/11)
1. **Ruolo `manifest_ro`.** `npm run prova:ripristina` ora crea il ruolo vuoto (senza accesso) prima di rimettere la copia: senza, `01_schema.sql` si fermava su «role does not exist».
2. **Solo cartelle.** Lo stesso comando, senza argomento, sceglie l'ultima *cartella* di copia e ignora i file sciolti (il 25/11 aveva preso uno script `.ps1`). Il messaggio finale indica la strada provata (`prova:rimetti` + `prova:migra`) e ricorda che i lavori pianificati (cron) non tornano da soli.
3. **Ricostruzione da zero.** `npm run prova:ricostruisci` applica le migrazioni con le stesse regole della prova di ricarica (`ricostruzione:verifica`): le fermate vecchie e note, dichiarate una per una col loro messaggio, non lo bloccano più; una fermata non dichiarata lo ferma come prima. Alla fine controlla il registro.
   - Nuova preparazione di prova per la `20260829000007` (a-capo di Windows nel corpo di `registra_produzione`): da sola trascinava altre 16 fermate.
   - Nuova eccezione dichiarata per la `20261115000017` (la sua verifica pretende 10 letture, su un database vuoto sono 9).
   - **I file delle migrazioni non sono stati toccati.**

## Misurato
Prova di ricarica (database usa-e-getta): fermate impreviste da **15 a 0**. Restano 3 migrazioni dichiarate senza riga nel registro (`20260917000001`, `20260920000001`, `20261115000017`) e 34 differenze di schema che ne derivano: limiti già noti, non nuovi.

## Non provato
`prova:ricostruisci -- --azzera` **non** è stato lanciato su Prova (ha Vault, cron e accessi veri): la strada provata resta `prova:rimetti` + `prova:migra`. Va provato in un turno di Prova, con il via della chat madre.
