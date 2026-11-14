# Le fondamenta della chat di MEMO (14/11/2026)

Migrazione `20261114000011_le_fondamenta_della_chat_di_memo`. Nessun commit creato, come richiesto.

## Cosa c'e'

- Le tre tabelle della chat, tutte con RLS del solo titolare:
  - `memo_conversazioni` conserva il percorso e il modulo da cui la chat e' stata aperta;
  - `memo_messaggi` conserva testo, strumenti, risultati ridotti, eventuale dettatura, token, modello, stato e costo;
  - `memo_riferimenti` associa i riferimenti brevi della conversazione alle righe vere del gestionale, senza mostrare gli identificativi nella chat.
- Il testo di un messaggio deve essere vero e lungo al massimo 4.000 caratteri. Il costo resta fra 0 e 1 euro; token negativi, ruoli e stati inventati sono respinti dal database.
- Anche `dettature.provenienza` conosce `chat`. Il catalogo `tipi_azione_vocale` ha `in_chat`, per ora falso per tutti: la PR 8 decidera' quali proposte potranno arrivare nella chat e chiedera' sempre il si' di Alessio.
- `consumi_ai()` conta la nuova fonte `chat`; quindi `spesa_ai_del_mese()` la comprende senza cambiare firma, portiere o permessi. `fonti_ai_scoperte()` resta una rete chiusa all'app e torna vuota quando ogni fonte e' nel conto.
- `claude-opus-5` entra nel listino. Il prezzo e' provvisorio: 15 euro per milione di token in ingresso e 75 in uscita, da confermare con la prima fattura.
- `memo_limite_messaggi(uuid)` ferma il sessantunesimo messaggio di Alessio nell'ultima ora. Conta le domande di Alessio, non i passaggi tecnici di MEMO: una domanda con strumenti resta un solo gesto ai fini del freno.

## Reti e permessi

- Le conversazioni, i messaggi e i riferimenti sono invisibili e non scrivibili da staff e anon.
- `consumi_ai()` e `fonti_ai_scoperte()` restano chiuse a `authenticated`, come dalla migrazione `20260829000004`; le usa soltanto il database dall'interno.
- `memo_limite_messaggi()` ha il portiere del titolare ed e' dichiarata in `tests/app/orfane.js` come funzione pianificata della migrazione: la sua ragione e' `chat di MEMO, PR 4-5`.

## Verifica dentro la migrazione

La verifica si presenta come utente autentico, non come proprietaria del database; poi si annulla e chiama `pretendi_nessun_residuo`.

1. Crea una conversazione, un riferimento e un messaggio finti; controlla che 0,12345 euro di chat entrino in `spesa_ai_del_mese()`.
2. Prova un costo oltre 1 euro e controlla il rifiuto del vincolo.
3. Controlla che `fonti_ai_scoperte()` sia vuota.
4. Cambia identita' allo staff: non legge conversazione, messaggi o riferimenti e non riesce a scrivere un messaggio.
5. Inserisce 60 messaggi di Alessio nell'ora e controlla che il freno risponda che il sessantunesimo deve fermarsi.

## Applicazione su work

1. Prima di applicare, confrontare `consumi_ai()` e `fonti_ai_scoperte()` con i corpi vivi indicati nell'intestazione della migrazione.
2. Applicare dopo le PR 1 e 2 del 14/11/2026.
3. Non ci sono funzioni online ne' pagine da pubblicare: motore e pannello arrivano nelle PR 4-5.

## Scelta da confermare

Nel repository non c'era un prezzo per `claude-opus-5`, pur essendo gia' usato da Archivio e Posta. Ho scelto il valore prudenziale 15/75 euro per milione di token in/out, esplicitamente marcato nella riga del listino come **da confermare con la prima fattura**.

## Revisione (Claude, 14/11)

Codice di ChatGPT, rivisto da Claude. Ritocco: `memo_messaggi.costo_euro` ora può restare vuoto (costo non conosciuto), come chiede la PR 4. Corpi vivi di `consumi_ai`, `fonti_ai_scoperte` e il vincolo `dettatura_provenienza_nota` confrontati: uguali su Prova e work. Applicata su Prova (492).

Dalla revisione del database, da decidere (migrazione a parte, prima della PR 5): (1) i messaggi senza modello contano come «costo non noto»; (2) il titolare può modificare/cancellare lo storico dei costi (policy `for all`); (3) il tetto di 1 € per messaggio rifiuta una riga di spesa già fatta; (4) il freno orario non è atomico; (5) il freno conta per `creata_da` e passa un utente libero; (7) mancano indici su `dettatura_id` e `creato_il`.
