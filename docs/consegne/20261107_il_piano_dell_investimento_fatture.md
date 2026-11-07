# Il piano dell'investimento — 6: le fatture e la voce obbligatoria (07/11/2026)

La migrazione è `20261107000003_le_fatture_dell_investimento`. Sono le richieste B e C di Alessio del 07/11.

## B. La spunta «investimento» sulle fatture da pagare
- C'è una colonna nuova, `supplier_invoices.e_investimento`. La spunta si mette solo sulle fatture di Borgo 58 e della tasca, mai su quelle dell'orto.
- Nella pagina Fatture, sotto ogni fattura da pagare di Borgo 58, c'è la spunta con la scelta della voce. Una fattura spuntata conta come «da pagare» (impegnata) su quella voce.
- **Al pagamento** la spunta e i collegamenti passano da soli al movimento o all'anticipo che paga la fattura:
  - dalla cassa e dalla banca, cioè `pay_supplier_invoice`;
  - con un anticipo, cioè `registra_anticipazione`.
- I collegamenti passati al pagamento non superano mai l'importo pagato: con una nota di credito si paga meno della fattura. Si riempiono in ordine, prima il più grande.
- La spesa conta una volta sola. Quando la fattura è pagata non è più impegnata, e conta come speso attraverso il suo pagamento (parte 5).
- Le fatture che erano già collegate al piano prendono la spunta da sole.

## C. Spuntando «investimento» la voce è obbligatoria
- Vale in Prima nota, negli Anticipi e nelle Fatture.
  - **Su una riga già salvata:** spuntando si apre la scelta della voce, ed è il pulsante «Segna investimento» che salva. Togliendo la spunta si tolgono anche i collegamenti al piano.
  - **Su una riga nuova:** il modulo chiede la voce e senza voce non salva. La riga si scrive senza spunta, poi `segna_investimento()` mette spunta e voce insieme. Se questo secondo passo si ferma, l'errore dice che la riga è salvata senza spunta.
- Il database lo pretende con dei trigger controllati a fine transazione, `piano_voce_obbligatoria_*`.
- **Solo per le spunte nuove**: l'obbligo scatta quando una riga nasce segnata o passa da non segnata a segnata.
  - Su work ci sono 10 righe segnate prima di oggi senza voce: 4 movimenti e 6 anticipi, contati dalla chat madre in sola lettura. Restano come sono e si modificano come sempre.
  - Si trovano in «Spese da assegnare» nella pagina del piano, e Alessio le collega a mano.
- `segna_investimento` e `togli_investimento` girano con i permessi di chi le chiama. I collegamenti sono del solo titolare, quindi chi non lo è non segna niente.

## Controlli
- **Revisione `ecc:database-reviewer`:**
  - corretto il HIGH: l'ordine dei collegamenti passati al pagamento dipendeva dal caso;
  - corretti i MEDIUM: le fatture già collegate prendono la spunta, e una voce scelta su una spesa già assegnata tutta ad altre voci dà un messaggio invece di essere ignorata;
  - pagine e migrazione vanno insieme nello stesso rilascio.
- **Revisione `ecc:react-reviewer`:** nessun CRITICAL o HIGH. Corretti i MEDIUM:
  - se il salvataggio fallisce, la scelta della voce resta aperta;
  - l'errore vero non si perde dietro una rilettura;
  - una rilettura fallita dopo un gesto riuscito non sembra un errore;
  - la spiegazione non sta più dentro l'etichetta;
  - il fuoco torna sulla casella e il tasto Esc chiude la scelta.
- **Prove:**
  - la verifica dentro la migrazione, che si annulla da sola;
  - `tests/schermate/scelta-voce.test.jsx`, con 7 prove;
  - le prove della spunta aggiornate: `investimento.test.jsx` e `anticipo-paga-fattura.test.js`.
