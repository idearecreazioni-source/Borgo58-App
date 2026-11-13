# L'anticipo eredita senza chiedere la direzione (13/11/2026)

Migrazione `20261113000001_l_anticipo_eredita_senza_direzione`. Difetto trovato da Alessio la notte del 13/11 (00:49). Stava registrando l'anticipo di 235 € per la fattura 1992/2026 di Fabio Lorito, da «Ho pagato io» in /cassa/personale. È stato rifiutato con `record "new" has no field "direction"`, con la spunta «Investimento» (voce Affitto) e anche senza.

## La causa
- `piano_pagamento_eredita_spunta()` è il trigger «before insert» che passa la spunta dalla fattura al pagamento. Sta sia su `cash_movements` sia su `anticipazioni_socio`.
- In `20261107000003_le_fatture_dell_investimento.sql:241` chiedeva:
  `if tg_table_name = 'cash_movements' and new.direction is distinct from 'uscita'`
- PL/pgSQL prepara l'espressione intera prima di valutarla, quindi l'`and` non protegge. Su `anticipazioni_socio` la colonna `direction` non c'è, e l'errore scatta comunque.
- Il primo `if` faceva uscire subito le righe già segnate. Ma la spunta non salvava lo stesso: `createAnticipazione` scrive **sempre** la nota senza spunta e la segna dopo con `segna_investimento`. Così, dal 07/11, **nessun** anticipo collegato a una fattura passava.

## La correzione
- Le due domande ora sono due `if` annidati. `new.direction` si chiede solo nel ramo `cash_movements`, ed è la stessa forma che `piano_pagamento_eredita_collegamenti()` usava già.
- Il corpo è ripreso da `20261107000003`, l'ultima migrazione che definisce la funzione, con quel solo cambio.
- I due trigger sono ricreati uguali a prima.
- Ho controllato tutti i trigger di `anticipazioni_socio` all'insert (`trg_guardia_anticipo_su_fattura`, `trg_guardia_investimento_anticipazione`, `piano_pagamento_eredita_collegamenti`, `piano_voce_obbligatoria_nuova`, quelli generici). Nessun altro legge un campo che lì non esiste.

## Verifica dentro la migrazione (annullata, zero residui)
1. Fattura senza spunta, anticipo senza spunta: accettato. La fattura risulta «pagata (anticipo)», senza nessun movimento di cassa e senza spunta.
2. Fattura segnata con una voce (affitto di prova): l'anticipo eredita spunta e voce (235 €).
3. Fattura senza spunta, anticipo segnato dopo con la voce (il percorso dello schermo): accettato e segnato.
4. Un'uscita di cassa che paga una fattura segnata eredita ancora.
5. La forma `'cash_movements' and new.direction` non c'è più nel corpo vivo.

**Non ancora provata su Prova.**

## Prove pure
- `tests/unita/anticipo-eredita-senza-direzione.test.js`. Controlla che:
  - la definizione viva sia quella del 13/11, senza la forma rotta;
  - non abbia perso niente del corpo di prima;
  - la verifica copra i casi 1-4;
  - la migrazione si auto-registri;
  - nessuna migrazione nuova rimetta la forma rotta.

## Rilascio (Prova, poi work)
1. **Prova**: `prova:migra` **prima** del giro dei Controlli, non dopo.
2. **work**: la migrazione, **solo col sì di Alessio**. Non serve aspettare il sito, perché la correzione è tutta nel database. Dopo, Alessio può rifare l'anticipo di Fabio Lorito da «Ho pagato io».
3. Nessuna funzione online da reinstallare.
