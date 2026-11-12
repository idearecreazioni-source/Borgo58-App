# MEMO si corregge: «Correggi» sugli appunti (12/11/2026)

Migrazione `20261112000001_memo_si_corregge`. Richiesta di Alessio dalla prova di MEMO sul piano (11/11): se MEMO capisce male un pezzo, si cambia quel pezzo invece di buttare l'appunto e ridire la frase.

## Cosa c'è
- **Tasto «Correggi»** su ogni elemento di un appunto ancora da approvare, in MEMO e nella Dashboard.
  - Apre un modulo con i campi che si possono cambiare: testi, numeri, date, ore, sì/no.
  - Per il piano ci sono menu per gruppo, stato, IVA e la voce del piano.
  - Non si correggono quello che calcola il database (nome della voce o della spesa, «adesso è», avviso sulle rate), gli identificativi e i numeri di catalogo.
  - Collegando una spesa, l'importo resta quello che dice il database: quanto ne resta da assegnare.
- **Correggere non approva.** I dati si ritraducono subito e l'appunto resta aperto: il sì resta un gesto a parte.
- **La frase.** Dopo una correzione il titolo dell'elemento diventa «Corretto a mano. Avevi detto: «…»», così sopra e sotto non dicono due cose diverse. Una seconda correzione non lo raddoppia.
  - È l'unica cosa che cambia nel database: il corpo di `correggi_elemento_appunto` (20260906000001) aggiorna anche `frase`. Il resto è uguale.

## Controlli
- **Verifica dentro la migrazione** (si annulla da sola):
  - prima correzione: dati nuovi, frase «Corretto a mano…», riga ancora `in_attesa`;
  - seconda correzione: la frase non cambia più.
- **Provata su Prova** in transazione annullata.
- **Prove pure**: tests/unita/appunti-correggi.test.js.
- **Prove della scheda**: tests/schermate/appunto-correggi.test.jsx.
- **Prova contro il database**: tests/app/appunti-vocali.test.js, che controlla anche la frase.

## Applicazione su work
- La migrazione;
- la pagina.

Nessuna funzione online da pubblicare: `operazioni-atomiche` ha già `correggi_elemento_appunto` fra le operazioni permesse.
