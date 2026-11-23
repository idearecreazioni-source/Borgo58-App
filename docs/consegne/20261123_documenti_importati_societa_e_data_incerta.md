# I documenti importati: la società e la «data da verificare» (23/11/2026)

Revisione generale di work del 23/11, punti 1 e 3. Già in slave con la PR #450.

## Migrazione
- `20261123000001` (`documenti_importati_societa_e_data_incerta`): colonna `documents.data_incerta` (booleana, spenta di partenza); un trigger che la spegne da solo quando cambia la data del documento (lo stesso aggiornamento può anche scriverla apertamente); `memo_leggi_documenti` restituisce `data_incerta` (corpo identico a quello di `20261122000001`, più il campo); due aggiornamenti dei documenti GIÀ importati: la società (Borgo 58 S.r.l.s.) a chi ha un lotto d'import e nessuna società, e il segno `data_incerta` a chi ha un lotto d'import e la data del 10/10/2026 o del 17/05/2026 (date di modifica del file, trovate dalla revisione). Termina con una verifica che si annulla da sola (zero residui) e si registra in `applied_migrations`.
- Il nome della colonna NON contiene «verifica» di proposito: le prove cercano le lapidi di verifica con `record::text ilike '%verifica%'`, e il nome di una colonna finisce in ogni lapide di documento cancellato.

## Il sito
- `importaDocumento` scrive `entity_id` (la società, letta da `getEntities().srls`) e `data_incerta`; se la società non si trova la pagina Importa non apre nessun carico.
- La scheda del documento mostra «Data da verificare» col pulsante «La data è giusta»; la lista dell'Archivio scrive «(da verificare)» accanto alla data.

## Funzione online
- `memo-chat`: il testo e la descrizione di `leggi_documenti` dicono che `data_incerta` = vera significa «data non sicura».

## Su work, ognuno col sì scritto di Alessio (dato il 23/11)
Copia di sicurezza → migrazione → scadenze dei documenti (aggiornamento a parte, annullabile) → funzione `memo-chat` → «Approve and deploy».

## Cosa NON è verificato
- La scheda e la lista non sono state viste in un browser vero con documenti veri: solo prove di schermata e prove su Prova.
- `assistente-archivio` («Chiedi all'archivio») non legge ancora `data_incerta`: passa dalla funzione `documenti_per_domanda`, il cui risultato non cambia in questo giro.
