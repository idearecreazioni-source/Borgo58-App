# Un movimento della banca non rientra se ne cambia la descrizione (25/11/2026)

Revisione dell'11/11, punto 30 (CSV Credem). Verificato il 25/11 su un file vero di Alessio (che resta sul suo Desktop, mai copiato): 29 movimenti, nessun doppione; i 25 già su work coincidono tutti col file.

## Migrazione
- `20261125000006`: `carica_movimenti_banca` riconosce come già presente un movimento con «rif. banca» (i bonifici) quando coincidono conto, data contabile, data valuta, importo, causale e rif. banca, anche se la banca ha cambiato descrizione o note. Si conta, non si cancella: due bonifici uguali davvero restano due, e due bonifici dello stesso giorno con lo stesso rif. ma importo diverso restano entrambi. La schermata lo dice: «N con la descrizione cambiata dalla banca: non rientrano».
- L'impronta di oggi non cambia e nessun dato esistente si tocca (nessun update/delete).
- Limite dichiarato: commissioni, bolli e canoni non portano il rif. banca, quindi per loro vale solo l'impronta.
- Rilievo della revisione ECC corretto prima di unire: un gemello vero con impronta nuova scritto prima della riga già presente non viene più perso (caso aggiunto alla verifica).
- Provata il 25/11 su Prova (verifica annullata, 80 test su banca/permessi). Test su CSV inventato con la stessa forma del vero.

## Su work, ognuno col sì scritto di Alessio
Copia di sicurezza → migrazione `20261125000006` → nessuna funzione online → «Approve and deploy» (il sito cambia: riga dell'esito del caricamento).
