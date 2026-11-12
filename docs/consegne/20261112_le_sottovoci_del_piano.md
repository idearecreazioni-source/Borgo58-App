# Le sottovoci del Piano dell'investimento (12/11/2026)

Migrazione `20261112000002_le_sottovoci_del_piano`. Secondo passo del modello approvato da Alessio l'11/11 (https://claude.ai/artifact/ARhaRmdURjj5SnnPm3KiVD); il primo erano i riquadri (#360).

## Cosa c'è
- **Ogni voce si divide in sottovoci.** Una sottovoce è una voce con `madre_id`: ha cifra, stato, IVA, rate e spese sue.
  - Così rate, collegamenti, speso, previsione e MEMO funzionano senza essere riscritti.
- **La madre la calcola il database.**
  - La cifra è la somma delle sottovoci vive.
  - Lo stato è «confermato» solo se lo sono tutte, «stimato» se almeno una è stimata, altrimenti «preventivato».
  - Cambiare a mano cifra o stato di una madre si rifiuta con la ragione, anche se lo chiede MEMO.
- **Regole.**
  - Un livello solo.
  - La sottovoce prende il gruppo della madre.
  - Niente rate né spese sulla madre.
  - La prima sottovoce non si aggiunge a una voce che ha già rate o spese: vanno tolte prima. Il piano di Alessio si ricarica da capo, quindi non si spostano da sole.
  - Archiviare la madre archivia le sottovoci; riprenderla le riprende.
- **Pagina.**
  - «Dividi in sottovoci», «Apri le N sottovoci», «+ Aggiungi una sottovoce».
  - La madre mostra la somma dei netti e l'IVA «mista» quando le aliquote sono diverse.
  - Il totale dice «Totale stimato · di cui confermato X».
  - Un avviso se una sottovoce è sforata.
  - Il modulo della madre non chiede cifra, stato né rate.
- **Totali.** La madre non si conta due volte.
- **Scelta della voce per una spesa** (spunta «investimento»): la madre non si sceglie; la sottovoce si legge «Madre › Sottovoce».

## Controlli
- **Verifica dentro la migrazione** (si annulla da sola):
  - la somma e lo stato della madre;
  - il gruppo preso dalla madre;
  - la cifra della madre a mano rifiutata;
  - la rata sulla madre rifiutata;
  - un secondo livello rifiutato;
  - la prima sottovoce su una voce con rate rifiutata;
  - l'archivio a cascata e il ritorno;
  - la sottovoce archiviata fuori dalla somma.
- **Provata su Prova** in transazione annullata.
- **Prove pure:** tests/unita/piano-sottovoci.test.js.
- **Prove della schermata:** tests/schermate/piano-investimento.test.jsx (sottovoci).

## Applicazione su work
- La migrazione;
- la pagina.

Nessuna funzione online da pubblicare.
