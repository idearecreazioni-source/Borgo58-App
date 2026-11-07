# Il piano dell'investimento — 1: la struttura (07/11/2026)

Prima delle 6 PR del piano dell'investimento, come da piano approvato da Alessio il 07/11. Non c'è ancora nessuna schermata: arriva con la PR 2.

## Cosa entra
- Migrazione **`20261107000001`** (`il_piano_dell_investimento`), con quattro tabelle riservate al titolare:
  - `piano_impostazioni`: una riga sola, con il mese dell'apertura. Parte da aprile 2027.
  - `piano_voci`: gruppo da A a E, importo IVA inclusa, IVA della voce, netto calcolato dal database, stato e dilazione.
  - `piano_rate`: il mese 0 è l'acconto, poi i mesi dall'apertura, fino al 12.
  - `piano_collegamenti`: lega una voce a una spesa vera. La spesa è una riga di prima nota, un anticipo o una fattura, con l'importo assegnato alla voce.
- Due portieri nel database:
  - un collegamento accetta solo spese segnate «investimento» di Borgo 58 o della tasca, e mai oltre il loro importo;
  - una spesa collegata non perde l'etichetta «investimento» finché il collegamento c'è.
- Le regole di calcolo in `src/lib/calcoli/pianoInvestimento.js`: il ✓, il netto, il mese di una rata, l'esito di una voce, i totali e il fabbisogno mese per mese. Le provano `tests/unita/piano-investimento.test.js`.
- La prova che solo il titolare vede il piano: `tests/app/piano-investimento.test.js`.
- La decisione del 07/11 è scritta in `docs/DECISIONI.md`, sotto «Quanto è costato il progetto».

## Cosa NON entra
- Nessuna voce. Il foglio del 21/05 entra con la PR 6, su work, dopo il sì di Alessio.
- Nessuna funzione chiamabile dall'app. Le funzioni nuove sono solo quelle dei due trigger, chiuse a tutti.

## Ordine
1. `prova:migra` su Prova, con il turno della chat madre.
2. I Controlli della PR verso slave.
