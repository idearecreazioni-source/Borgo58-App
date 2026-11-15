# Collegare una spesa a una rata blocca la rata (15/11/2026)

## Cosa cambia
`segna_investimento` ora, quando il collegamento è a una rata, blocca prima la voce e poi la rata (stesso ordine di `fai_piano_memo`). Prima un collegamento fatto nello stesso istante in cui MEMO ricalcolava le rate poteva finire su una rata appena riscritta.

## Perché
Lo ha trovato la revisione del database della Jarvis PR 2 (rate che si propongono). Il corpo della funzione è ripreso dal vivo, uguale su Prova e su work; cambia una sola ancora, controllata.

## Come si è provato
Prova a secco e applicazione su Prova; la verifica collega davvero una fattura a una rata e controlla che il collegamento esista, poi annulla tutto (zero residui).

## Su work
Migrazione `20261115000012`, nessuna funzione online da reinstallare.
