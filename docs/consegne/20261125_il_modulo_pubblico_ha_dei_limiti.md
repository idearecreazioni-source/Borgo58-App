# Il modulo pubblico delle prenotazioni ha dei limiti (25/11/2026)

Revisione dell'11/11, punto 15.

## Migrazione
- `20261125000005` (`il_modulo_pubblico_ha_dei_limiti`): `submit_public_reservation` rifiuta nome oltre 100 caratteri, telefono oltre 30, email oltre 200, note oltre 1.000 e date oltre i 12 mesi da oggi (data locale di Roma). Prima un testo lunghissimo faceva perdere l'avviso su Telegram e una data lontana restava in attesa per sempre.
- Il corpo vivo si cambia in un punto solo (controllato: la riga deve comparire una volta sola). I freni di prima (40 richieste all'ora, 3 per contatto) restano.
- Termina con una verifica che prova solo i rifiuti (nessuna scrittura) e si registra in `applied_migrations`.
- Provata il 25/11 su Prova: verifica passata, `prenotazione-pubblica.test.js` e `permessi.test.js` verdi.

## Da fare a mano (non nel codice)
Il freno **per indirizzo di rete** non sta nel database (la funzione non vede l'indirizzo): va messo davanti, in Cloudflare, con una regola di limitazione sulla pagina `/prenota`. Lo fa Alessio (o lo guidiamo noi passo per passo).

## Su work, ognuno col sì scritto di Alessio
Copia di sicurezza → migrazione `20261125000005` → nessuna funzione online → «Approve and deploy» (il sito non cambia).
