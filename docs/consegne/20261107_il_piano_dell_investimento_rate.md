# Il piano dell'investimento — 7: le rate nella previsione di cassa (07/11/2026)

Migrazione `20261107000004_le_rate_del_piano_nella_previsione`. È la richiesta A di Alessio del 07/11.

## Cosa c'è
- **`piano_rate_aperte()`**, riservata al titolare: per ogni rata dice quanto resta ancora da pagare.
  - Toglie i pagamenti collegati, cioè prima nota e anticipi.
  - Toglie le fatture collegate, solo per la parte che i pagamenti della stessa voce non coprono già.
  - Un collegamento che nomina la rata copre quella rata.
  - Un collegamento che dice solo la voce copre le rate della voce in ordine, dall'acconto in poi.
- **`movimenti_attesi`**: è identica a prima, con in più un ramo `rata_piano`.
  - Il ramo vale solo per Borgo 58.
  - Una rata scaduta e non pagata compare con la data di oggi.
  - Le voci stimate portano la scritta «(stimata)».
  - `previsione_cassa` la somma, quindi la previsione di cassa vede le rate.
- **Date delle rate:**
  - l'acconto scade l'ultimo giorno prima dell'apertura;
  - il mese N scade il primo giorno di quel mese.
- **La pagina «Previsione»** chiama queste righe «rata del piano dell'investimento».
- **La pagina del piano**, in «Quanto paghi ogni mese», dice quanto resta da pagare di ogni mese.

## Mai due volte
- Una rata coperta da una fattura da pagare non compare: compare la fattura, con la sua scadenza.
- Una rata coperta da un pagamento non compare.
- Una fattura pagata, i cui collegamenti sono passati al pagamento (parte 6), copre una volta sola, non due.
- Una rata pagata dalla tasca è pagata: esce dalla previsione di Borgo 58.

## Controlli
- **Revisione `ecc:database-reviewer`:** nessun CRITICAL o HIGH.
  - Corretto: la verifica non scade più dopo l'apertura.
  - Aggiunta la prova della fattura pagata con i collegamenti passati al pagamento.
  - Aggiunta la scritta «(stimata)».
- **Prove:**
  - la verifica dentro la migrazione, che si annulla da sola;
  - una prova nuova della schermata, sullo scadenziario.
