# La Posta conosce le sezioni, la testata delle fatture, l'avviso sulle rate (11/11/2026)

Migrazione `20261111000003_la_posta_conosce_le_sezioni`. È la PR8b: i tre difetti della Posta visti da Alessio l'11/11 e due rifiniture dalla prova di MEMO.

## Cosa c'è
- **Sezione inesistente.** La causa: `posta-leggi` chiedeva gli elenchi chiusi a `vocabolari_per_assistente()`, che alla chiave di servizio non risponde. Il modello non vedeva le sezioni e ne inventava; il filtro lasciava passare tutto.
  - Una porta sola, `vocabolari_per_la_posta()`, solo per la chiave di servizio.
  - In pagina «Archivia» si spegne, con la ragione, se la sezione non è fra quelle vere.
- **Fattura già registrata.** Non si propone più di archiviare il suo file né i file della busta (daticert, smime, metadati SdI). Il testo della mail e gli altri allegati veri restano proposti.
- **Testata delle fatture SdI.** Nella riga della Posta compaiono il fornitore, «fatt. N» e il totale, al posto di «borgo58@pec.it / Invio File …».
- **MEMO avvisa sulle rate.** Se cambia il previsto di una voce con rate, l'appunto dice quanto fanno le rate e di sistemarle da «Modifica». Non blocca.
- **MEMO dopo «Butta l'appunto».** Il titolo diventa «Appunto buttato: non ho scritto niente.»

## Controlli
- **Verifica dentro la migrazione** (si annulla da sola):
  - con la chiave di servizio arrivano le sezioni;
  - l'avviso sulle rate c'è quando non tornano, non c'è quando tornano, e non blocca il sì.
- **Provata su Prova** in transazione annullata.
- **Prove pure** in tests/unita/posta-a-righe.test.js:
  - sezione inesistente;
  - archiviazioni tolte;
  - testata.

## Applicazione su work
- La migrazione;
- la funzione `posta-leggi`;
- la pagina.

I numeri si aggiungono dopo.
