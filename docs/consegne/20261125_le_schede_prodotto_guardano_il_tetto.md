# Le schede prodotto guardano il tetto di spesa (25/11/2026)

Revisione dell'11/11, punto 38.

## Funzione online
- `schede-prodotto`: prima di chiamare il modello chiede `spesa_ai_del_mese` (riservata al titolare) e, se il tetto del mese è raggiunto, si ferma con la frase chiara; la scheda si compila a mano come sempre. Prima il tetto non era guardato.
- `leggi-foto`: il controllo del ruolo e del tetto c'era già (`spesa_ai_del_mese` prima di spendere); ho solo aggiunto un test che lo tiene fermo.
- Limite noto: la spesa di `schede-prodotto` non è tra quelle che il tetto conta (`consumi_ai` somma foto, voce, archivio e posta). Se serve contarla, è un lavoro a parte (una tabella dei consumi).

## Su work, ognuno col sì scritto di Alessio
Nessuna migrazione → funzione `schede-prodotto` → «Approve and deploy» (il sito non cambia).
