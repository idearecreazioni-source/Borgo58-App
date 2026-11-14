# Il pannello della chat di MEMO (14/11/2026)

Nessuna migrazione, nessuna funzione Supabase modificata, nessun commit creato.

## Cosa c'e'

- Il titolare trova «Chat» nella testata del telefono e nella barra superiore
  del computer. Lo staff non vede il pulsante.
- Il pannello e' una finestra a lato su schermo largo e prende tutta la
  larghezza utile sul telefono. Il campo riceve il fuoco all'apertura; Esc e
  «Chiudi» chiudono il pannello e riportano il fuoco al pulsante che l'ha
  aperto.
- Ogni nuova apertura parte da una conversazione locale nuova e conserva il
  percorso e il nome leggibile del modulo da cui e' stata aperta.
- Durante l'attesa MEMO spiega che sta cercando e leggendo i dati. La risposta
  separa «Dove l'ho letto» e «Controllalo»; mostra soltanto riferimenti brevi
  P, C, F, A e M, mai nomi di tabelle o identificativi tecnici.
- Il tetto, il freno e gli errori hanno una frase italiana a schermo. Le
  eventuali proposte restano testo della risposta: in questa PR non c'e' alcun
  pulsante che scrive o approva.
- `MEMO voce` continua a portare a `/detta`: microfono e appunti non sono
  stati toccati. La chat si puo' aprire anche mentre quella schermata e'
  visibile.

## Chiarimento del contratto con `memo-chat`

Il browser manda **solo** `testo`, l'eventuale `conversazione_id` e il
contesto dell'apertura (`aperta_da_percorso`, `aperta_da_modulo`). Non manda
mai lo storico. La funzione ricostruisce la conversazione dal server.

L'esito normale contiene `risposta`, `conversazione_id` e `riferimenti`; il
tetto puo' arrivare come `esito: "tetto"` con `messaggio`, anche con stato
HTTP 429. Gli altri rifiuti arrivano come `errore.codice` e
`errore.messaggio`. Questo e' il solo chiarimento usato dal frontend: non e'
stata cambiata la funzione online.

## Prove

- `tests/unita/chat-memo.test.js`: corpo inviato, nessuno storico, tetto,
  freno, contesto, fonti e avviso.
- `tests/schermate/memo-chat.test.jsx`: fuoco, invio, fonti, tetto, assenza di
  azioni di scrittura e chiusura da tastiera.
- Le prove gia' presenti di `memo-lanciatore` continuano a proteggere
  l'apertura della voce e il ritorno alla schermata di partenza.

## Decisioni rovesciate

Nessun rovesciamento: la voce resta separata dalla chat, come previsto dal
piano Jarvis. Il contesto del modulo vale soltanto per la chat e non cambia
il significato della dettatura.
