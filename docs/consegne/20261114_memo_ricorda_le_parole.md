# MEMO ricorda le parole dopo «Correggi» (14/11/2026)

Migrazione `20261114000001_memo_ricorda_le_parole`. Nessun commit creato, come richiesto.

## Cosa c'è

- `azioni_dettate` conserva `corretta_il` e `parole_dette`.
  - `corretta_il` fa leggere «L'hai corretta tu: se va bene, di' sì.» invece del falso «Non ero sicuro». Arriva sia nell'elenco degli appunti sia nel riscontro subito dopo la dettatura.
  - `parole_dette` è il pezzo originale se MEMO era sicuro; altrimenti è l'intera dettatura. Dopo «Correggi», la frase dice quelle parole. Le righe precedenti usano ancora `dettature.testo`.
  - Una seconda correzione cambia i dati ma non raddoppia «Corretto a mano».
- `ascolta-voce` porta `parole_dette` nel JSON delle azioni senza cambiare la firma di `registra_dettatura`.
- La riga dei dati dell'appunto è leggibile: `1.500 €`, `IVA 22%` e, per una modifica, `da 1.500 € a 800 €`. Identificativi, campi di servizio e vecchie etichette tecniche non compaiono.
- Il ritorno da MEMO resta solo in cima alla pagina, solo quando esiste una pagina di partenza, con il nome che `ritornoDaMemo` ricava dal modulo. Dopo il riscontro non viene ripetuto.

## Controlli

- La verifica nella migrazione crea una dettatura finta, corregge una prima volta e controlla `corretta_il`, la frase con le parole dette e le due letture; corregge una seconda volta e controlla che la frase non cambi. Poi annulla tutto e pretende zero residui.
- La migrazione conserva le porte: `correggi_elemento_appunto`, `appunti_da_approvare` e la lettura del riscontro restano accessibili al solo utente autenticato; il loro portiere resta nella funzione.
- `tests/unita/appunti-correggi.test.js` controlla la frase dopo la correzione.
- `tests/unita/appunti-in-chiaro.test.js` controlla euro, IVA, cambiamenti e campi di servizio nascosti.
- `tests/schermate/appunto-correggi.test.jsx` controlla la frase vista nella scheda.
- `tests/schermate/memo-lanciatore.test.jsx` controlla che il ritorno sia uno solo, in testa.
- `tests/app/appunti-vocali.test.js` è aggiornato per parole dette, ora della correzione e seconda correzione; non viene eseguito perché parla al database.

## Cosa abbiamo rovesciato

1. **Cosa era stato deciso e quando**: l'11/09/2026 il `pezzo` della dettatura serviva dentro `ascolta-voce` per distinguere azioni di Agenda, ma non veniva scritto nel database.
2. **La ragione di allora**: era trattato come dato tecnico di passaggio, senza lettura a schermo.
3. **Cosa si decide adesso**: dal 14/11 MEMO conserva le parole dette per azione e le usa nella firma dopo «Correggi».
4. **Perché la ragione non vale più**: la correzione rende quelle parole necessarie a distinguere l'originale dall'interpretazione del modello. Il prezzo è una colonna in più su ogni azione. È la voce 111 in `docs/decisioni_rovesciate.md`.

## Applicazione su work

1. Applicare `20261114000001_memo_ricorda_le_parole` dopo aver confrontato il corpo vivo di `correggi_elemento_appunto` con quello dichiarato in testa alla migrazione.
2. Pubblicare `ascolta-voce` insieme alla migrazione: senza la funzione nuova, le azioni future usano comunque il ripiego della dettatura intera, ma non il loro pezzo preciso.
3. Pubblicare la pagina con gli altri file del frontend.

## Richieste di Alessio

La prova MEMO del 13/11 è chiusa da questa consegna. Non c'è una riga distinta da aggiornare in `docs/RICHIESTE.md`.
