# Il piano dell'investimento — 4: il punto di partenza (07/11/2026)

`npm run piano:carica -- <file.json> [--prova] [--conferma]` carica in una volta sola le voci e le rate del piano. Nessuna migrazione: usa le tabelle di `20261107000001`.

## Cosa fa
- **Senza `--conferma`** non scrive e non legge niente sul database: controlla il file e mostra il riepilogo, cioè voci, rate, totali per gruppo e per mese.
- **Con `--conferma`** carica in una transazione sola.
  - Prima blocca le tabelle del piano.
  - Si rifiuta se il piano ha già voci.
  - Alla fine verifica conteggi, totali e data di apertura.
- **Su work** (`DB_URL_PRODUZIONE`):
  - controlla chi si collega e dove, come `comune.mjs`;
  - pretende una copia di sicurezza recente, come `npm run migra`;
  - carica solo un file che sta **fuori dal repository**, perché sono i conti veri di Alessio.
- **Su Prova** (`--prova`): passa la barriera `soloProva` e accetta solo un file con `"finto": true`. Per esempio `scripts/dati/piano-finto.json`: 6 voci inventate.

## Il file vero
`piano-investimento-partenza.json`, fuori dal repository. Alessio l'ha confermato il 07/11:
- 37 voci, 80.210 € IVA inclusa;
- per gruppo: A 17.500, B 30.000, C 8.000, D 8.100, E 16.610;
- per mese: acconto 51.785, aprile 8.825, maggio 8.825, giugno 6.275, luglio 1.000, settembre 3.500.

Si carica su work solo dopo il rilascio delle parti 1–3 e di questa, e con il sì di Alessio.

## Controlli
- Revisione `ecc:security-reviewer`, corretti tutti i punti segnalati:
  - testi senza `$`, barra rovesciata o caratteri di controllo, con una lunghezza massima;
  - tabelle bloccate e `found` controllato;
  - barriera di work come `problemiDiProgetto`, senza `?host=` né `?user=`;
  - opzioni sconosciute rifiutate;
  - file temporaneo in una cartella sua, tolto sempre;
  - tipi controllati;
  - copia di sicurezza e file fuori dal repository;
  - messaggi di psql senza credenziali;
  - verifica anche della data di apertura.
- `tests/unita/piano-carica.test.js`: 16 prove.
