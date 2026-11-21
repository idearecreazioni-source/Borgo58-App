# Le letture dei documenti dentro al tetto di spesa (21/11/2026, pezzo C0)

Parte del piano della Scheda di memoria approvato da Alessio il 20/11. Questo documento esiste prima del rilascio: **la migrazione NON è ancora su work**. Su work va solo col sì scritto di Alessio e con il suo «Approve and deploy».

## Migrazione
- 20261121000001 (le letture dei documenti nel tetto): crea la tabella `letture_documento`, aggiunge la fonte «documento» a `consumi_ai()` (dal corpo vivo), aggiunge a `memo_messaggi` i token di cache (`token_cache_lettura`, `token_cache_scrittura`) e li protegge nello storico dei costi.

## Funzioni da aggiornare al rilascio (dopo la migrazione, mai prima)
- `documento-leggi`: guarda il tetto prima di ogni chiamata al modello e registra i token (trascrizione e proposta). Un file `.odt`/`.docx`, che si legge senza modello, non passa dal freno.
- `assistente-archivio`: guarda il tetto prima della domanda. La sua spesa si contava già, ma nessuno la fermava.
- `memo-chat`: conta i token di cache e li scrive nel messaggio.
- ⚠️ Ordine obbligato: prima la migrazione, poi le tre funzioni. `memo-chat` scrive le due colonne nuove; se andasse online prima, il salvataggio del messaggio fallirebbe.

## Perché
Il tetto dei 30 € somma quello che `consumi_ai()` elenca. Le letture dei documenti con Opus 5 (fino a 16.000 token di uscita) non lasciavano nessuna traccia e non erano fermate dal tetto: la fonte che costa di più per chiamata era l'unica fuori dal conto. Per `memo-chat` la cache dei prompt non era contata: con la cache accesa (pezzo S2) il costo sarebbe stato sottostimato.

## Cosa abbiamo rovesciato
Niente: non c'era una decisione precedente su queste fonti, solo una dimenticanza.

## Cosa NON deve cambiare (da ricontrollare dopo il rilascio)
- I costi già scritti nelle righe di chat, voce, foto, ricetta e le righe già presenti di archivio e posta.
- Il totale della spesa del mese non cambia da solo: le nuove righe esistono solo da quando le funzioni nuove sono online. Subito dopo la migrazione `letture_documento` è vuota e il totale resta uguale.
- `consumi_ai()` resta chiusa da fuori (nessun permesso a `authenticated` o `anon`).
- Nessun'altra tabella.

## Scelta di progetto da conoscere
Le letture di documento fatte da MEMO non si sommano anche a `costo_euro` del messaggio: le registra `documento-leggi` in `letture_documento`. Sommarle due volte le avrebbe contate due volte nel tetto (fonte «documento» e fonte «chat»). Il costo mostrato per un messaggio di chat quindi non comprende il documento aperto.

## Prove
- Prova (progetto di prova): migrazione applicata due volte (idempotente), verifica interna superata; 6 prove su Prova nuove (`tests/app/letture-documento.test.js`: la lettura entra nella spesa con il prezzo del listino, un modello fuori listino non costa zero in silenzio, gesto e token negativi respinti, sala e anonimi esclusi, `consumi_ai` chiusa da fuori, colonne di cache presenti) e prove sul codice delle tre funzioni (`tests/unita/letture-nel-tetto.test.js`: il freno sta prima della chiamata al modello, il registro dopo).
- ⚠️ Le tre funzioni non sono state eseguite con una chiamata vera al modello su Prova (si pagano): su Prova si installano solo con il turno e il via. Il comportamento reale (freno che ferma, registro che si scrive) si vede alla prima lettura dopo il rilascio.
