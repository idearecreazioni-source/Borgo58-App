# Ritenuta, fattura rotta nello zip, pagamento di fattura fermo e piano con le note di credito (24/11/2026)

Revisione dell'11/11 (punti 13, 14, 18, 19). Già in slave con le PR #473, #474, #475 e #476.

## Migrazioni
- `20261124000002` (`l_importo_di_un_pagamento_di_fattura_non_si_cambia`), punto 19: un trigger vieta di cambiare l'IMPORTO di un movimento di prima nota già legato a una fattura (`cash_movements.supplier_invoice_id`), con un messaggio che dice di annullare il pagamento della fattura e rifarlo; nota, data, mezzo e riferimento si correggono ancora, un movimento senza fattura cambia come sempre. Non tocca i dati che ci sono. Limite accettato: scollegare il movimento e POI cambiare l'importo (due gesti) resta possibile, perché è lo scollegamento che fanno apposta l'annullo del pagamento, la nota di credito e l'anticipo. La verifica si annulla da sola (zero residui).
- `20261124000003` (`il_piano_impegnato_toglie_le_note_di_credito`), punto 18: l'«impegnato» del piano dell'investimento per una fattura ancora da pagare si riduce in proporzione alle note di credito già scalate: quota × `da_pagare` / importo della fattura, arrotondato al centesimo. Stessa regola per le rate aperte della previsione di cassa (`piano_rate_aperte`). Cambia il corpo vivo di `piano_speso_per_voce` e `piano_rate_aperte` in un punto solo ciascuna (controllato). Senza note di credito il rapporto è 1: non cambia niente. La verifica si annulla da sola.

## Sito e lettore delle fatture
- Punto 14: una fattura con ritenuta d'acconto (`DatiRitenuta/ImportoRitenuta` > 0, o illeggibile) è un ERRORE del lettore: la PEC la mette fra le cose da fare a mano con scritto quanto si paga davvero, la pagina «Importa fattura elettronica» la blocca. Se la ritenuta è più grande del totale lo dice senza un «si paga» negativo.
- Punto 13: nello zip dello scarico si tacciono (e si contano) solo i messaggi dello SdI (metadati, ricevute, notifiche, SubmissionAcceptance); un file che non si apre compare come riga d'errore con il suo nome; un file tagliato dice «rovinato o incompleto».
- Il lettore è condiviso con la posta: le due modifiche vanno anche nella funzione online `posta-leggi`.

## Su work, ognuno col sì scritto di Alessio (dato il 24/11)
Copia di sicurezza → migrazioni `20261124000002` e `20261124000003` → funzione `posta-leggi` → «Approve and deploy» (il sito cambia: pagina Importa fattura elettronica).

## Cosa NON è verificato
- Il blocco del punto 19 si prova con la verifica della migrazione (annullata): una prova su Prova con righe vere le lascerebbe, perché un movimento legato a una fattura non si cancella.
- La proporzione del punto 18 sulle rate aperte non ha una prova con dati veri: la verifica prova la voce, e il corpo vivo delle rate si controlla leggendolo.
- La pagina Importa non è stata vista in un browser con uno zip vero: solo prove di schermata con il lettore dello zip finto.
