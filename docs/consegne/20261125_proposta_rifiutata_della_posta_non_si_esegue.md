# Una proposta rifiutata della posta non si esegue più (25/11/2026)

Revisione dell'11/11, punto 21.

## Migrazione
- `20261125000002` (`una_proposta_rifiutata_non_si_esegue`): `esegui_azione_posta` accetta solo lo stato «proposta». Una proposta già rifiutata, ancora aperta su un altro apparecchio, non si esegue più dal «Conferma» di quell'apparecchio: dà un errore chiaro. Una già «fatta» continua a rispondere «già fatta». Il corpo vivo si cambia in un punto solo (controllato: la riga deve comparire una volta sola).
- Termina con una verifica annullata (rifiutata, aperta, già fatta) e si registra in `applied_migrations`.
- Provata il 25/11 su Prova: verifica passata, `posta.test.js` e `permessi.test.js` verdi (28 test).
- Chi riscrive la funzione riparte da `npm run funzione:viva`, non da una migrazione vecchia.

## Su work, ognuno col sì scritto di Alessio
Copia di sicurezza → migrazione `20261125000002` → nessuna funzione online da pubblicare → «Approve and deploy» (il sito non cambia).
