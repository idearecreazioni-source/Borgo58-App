# Il piano dell'investimento — 5: lo speso voce per voce (07/11/2026)

Migrazione `20261107000002_il_piano_speso_e_collegamenti`: due funzioni nuove, che solo leggono. Nessuna tabella e nessuna colonna nuova.

## Cosa c'è
- **`piano_speso_per_voce()`**: per ogni voce dà lo speso (pagamenti collegati), l'impegnato (fatture collegate ancora da pagare), quanti collegamenti ha, e quante fatture collegate sono già pagate senza che il pagamento sia collegato.
- **`piano_spese_del_progetto()`**: le spese segnate «investimento» di Borgo 58 e della tasca, cioè le stesse righe di `righe_costo_del_progetto()` senza l'orto, con quanto è già assegnato alle voci.
- Tutte e due sono riservate al titolare: chi non lo è riceve un rifiuto, non un elenco vuoto.

## La pagina
- In alto ci sono tre riquadri:
  - lo speso sulle voci, archiviate comprese, con la loro parte a parte;
  - le voci sopra il budget, contando solo gli sforamenti;
  - le spese da assegnare.
- Ogni voce mostra quanto è stato speso e come sta rispetto al previsto:
  - sforato;
  - a rischio, cioè con le fatture da pagare supera il previsto;
  - restano, cioè quanto c'è ancora di budget.
- Nella voce aperta compaiono le spese collegate, con il pulsante «Togli».
- Per collegarne una nuova si sceglie la spesa, la parte che va su quella voce (proposta: quello che resta) e, se si vuole, la rata.
- La sezione «Spese da assegnare» elenca le spese segnate «investimento» non ancora collegate, anche quelle collegate solo in parte.
- **Controllo**: «speso + da assegnare» deve fare il totale di `costo_del_progetto()` (Borgo 58 + tasca). Se non torna, compare un avviso.

## Regole sul conteggio
- **Una fattura conta tramite il suo pagamento.**
  - Collegata e da pagare: è impegnata, meno quanto ne pagano i pagamenti collegati alla stessa voce.
  - Pagata: non conta più come fattura.
- **Caso storto**: fattura su una voce e pagamento su un'altra. Si conta per eccesso, quindi può comparire un «a rischio» in più, ma nessuno sforamento resta nascosto.
- Il **risparmio** non c'è ancora: serve sapere che le rate sono chiuse, e arriva con la parte 7.
- **Collegare le fatture** dalla pagina non si può ancora: arriva con la parte 6, con la spunta «investimento» sulle fatture.

## Controlli
- Revisione `ecc:database-reviewer`: nessun punto CRITICAL o HIGH. Corretti i 3 MEDIUM: il pagamento parziale, la fattura pagata non collegata, la verifica dell'80 €.
- Revisione `ecc:react-reviewer`: corretto il HIGH, cioè lo speso delle voci archiviate fuori dal totale. Corretti anche i MEDIUM:
  - una spesa assegnata oltre il suo importo;
  - un blocco solo per tutta la voce aperta;
  - i pulsanti fermi fino alla rilettura;
  - campi ed errori collegati.
- Prove: la verifica dentro la migrazione (si annulla da sola), 12 prove nuove della schermata e 7 prove nuove dei calcoli.
