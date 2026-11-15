# MEMO legge tutto (15/11/2026)

Nessuna migrazione e nessuna funzione sono state applicate o distribuite. Nessun commit creato.

## Cosa c'e'

- MEMO legge, con strumenti separati e limitati a 50 righe, movimenti e
  saldi della banca, prenotazioni, registri HACCP, costo dei piatti,
  metadati dell'Archivio e fatture ai clienti.
- Ogni funzione `memo_leggi_*` e' stabile, chiusa a `public` e `anon`,
  protetta dal titolare e restituisce conteggio e totale insieme alle righe.
  I soldi restano dietro `is_titolare()`; anche gli altri strumenti sono
  chiusi allo staff perche' la chat e' del solo titolare.
- Banca, HACCP e food cost riusano le fonti della schermata: rispettivamente
  i movimenti caricati, `v_haccp_temperature_logs` e `v_recipe_costs`.
  Le prove di parita' dichiarano anche le fonti dirette delle altre pagine.
- L'Archivio offre gratis l'elenco e i metadati. Per il contenuto MEMO prima
  chiede esattamente «Lo apro? costa circa 0,20 €.». Solo un si' esplicito
  immediatamente successivo rende disponibile lo strumento; la lettura passa
  a `documento-leggi` in modalita' `solo_lettura`, quindi non aggiorna il
  documento ne' scrive nell'Archivio.
- Date diverse restano nominate una per una: l'Archivio espone data del
  documento e scadenza; le fatture ai clienti espongono data fattura,
  emissione, invio ed esito. Le istruzioni vietano a MEMO di sceglierne una
  in silenzio.
- Nuovi riferimenti brevi nel pannello: B (banca), R (prenotazioni), H
  (HACCP), I (ricette), D (documenti), E (fatture ai clienti).

## Verifica nella migrazione

La migrazione `20261115000010_memo_legge_tutto.sql` porta in testa la nota
di confronto con il database vivo. La sua verifica interna, annullata da
sola, impersona il titolare, controlla limite, conteggio e totale dei sei
elenchi, prova il rifiuto dello staff e infine controlla che non restino
residui. Le nuove funzioni senza schermata sono dichiarate nelle reti di
`tests/app/` con ragione «chat di MEMO, PR 4-7».

## Prove eseguite

- `npm run lint` — passato.
- `npx vitest run tests/unita` — 207 file, 3.181 prove passate.
- `npx vitest run -c vitest.schermate.config.js tests/schermate` — 86 file,
  674 prove passate.
- `npm run build` — passato.

## Da verificare su Prova

- Applicare la migrazione e confrontare le fonti riusate con il database
  vivo, come richiesto dalla nota iniziale.
- Provare con Alessio la domanda sull'estratto conto di settembre: MEMO deve
  distinguere, per esempio, «fine periodo 30/09» da «data di emissione
  06/10».
- Provare l'intera conversazione dell'Archivio su un PDF reale: metadati,
  domanda del costo, si' esplicito, lettura senza modificare la riga.

## Scelte fatte qui

- La stima chiesta prima di aprire un documento e' 0,20 euro: e' il centro
  prudente dell'intervallo concordato di 10-30 centesimi.
- Il saldo banca e' dichiarato come saldo dei movimenti caricati per quel
  conto: la tabella non conserva un saldo iniziale della banca e non viene
  inventato.
- HACCP e' un unico strumento per temperatura, non conformita', ricevimento,
  pulizie e disinfestazione, cosi' una domanda libera non deve conoscere il
  nome del registro.

## Revisione (Claude, 15/11)

Codice di ChatGPT, rivisto da Claude. Provata su Prova (migrazioni `20261115000010` e `20261115000011`, 497; `memo-chat` e `documento-leggi` installate; quattro domande vere con risposta). Corretti prima della PR: conteggi e totali su tutte le righe (non sulle prime 50); colonna `totale` ambigua nelle fatture ai clienti (la funzione non girava); prenotazioni senza telefono, email e note (resta «ha_note») e con le future per prime; totale delle fatture senza bozze e scartate; costo piatti senza totale; un «sì» apre un solo documento, il testo è tagliato a 40.000 caratteri e racchiuso come non fidato; il «sì» vale solo se breve; `solo_lettura` vale solo se vero (`=== true`). `documento-leggi` resta identica senza il flag. Restano non urgenti: la spesa della lettura del documento (modello di `documento-leggi`) non entra in `costo_euro`; ricerca con `%` e `_` letterali; HACCP cerca anche nei nomi dei campi; banca: saldo per riga e movimenti ignorati nel totale.
