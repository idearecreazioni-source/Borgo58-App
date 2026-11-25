# La stessa fattura non entra due volte (25/11/2026)

Revisione dell'11/11, punto 32.

## Migrazione
- `20261125000003` (`la_stessa_fattura_non_entra_due_volte`): stesso fornitore, stessa data e stesso numero (confrontato senza spazi, trattini e maiuscole) non si registrano due volte, da qualunque strada (a mano, file elettronico, PEC).
  - un indice unico sul database, la barriera vera anche se due richieste arrivano insieme;
  - un controllo prima della scrittura che dice una frase chiara invece di un errore tecnico;
  - le fatture senza numero non sono toccate.
- Prima di creare l'indice la migrazione controlla che non ci siano già doppioni; se ce ne sono si ferma e lo dice. Su work il 25/11 non ce n'erano (0 gruppi).
- Termina con una verifica annullata (doppione fermato, altra data o altro numero entrano, senza numero entrano) e si registra in `applied_migrations`.
- Provata il 25/11 su Prova: verifica passata, `permessi.test.js` e `ordini-fornitori.test.js` verdi.

## Su work, ognuno col sì scritto di Alessio
Copia di sicurezza → migrazione `20261125000003` → nessuna funzione online da pubblicare → «Approve and deploy» (il sito non cambia).
