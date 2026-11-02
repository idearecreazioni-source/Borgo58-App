# Il rilascio del 30/10: Impostazioni, cantina, stampanti e comande dal ponte

**HEAD dichiarato sotto questo riepilogo:** master `3c51c6c`, cioè l'unione di #276. Questo file è solo documentazione: riporta i numeri dell'applicazione in produzione, come chiede §2 di CLAUDE.md («glielo riporto DOPO, con i numeri»).

## Cosa è stato rilasciato
Alessio lo ha autorizzato il 30/10 in due passi:
- alla domanda «Preparo il rilascio in produzione?» ha risposto «Sì, preparalo»;
- alla domanda «Quando faccio il rilascio in produzione?» ha risposto «adesso».

Il locale aprirà fra qualche mese, quindi non c'era nessun servizio in corso da evitare.

Le PR rilasciate:
- **#265 e #266:** stampanti, coda dei lavori e ponte. Migrazione `20261028000005_le_stampanti_e_la_coda`.
- **#267:** il ristorante diventa cantina. Migrazione `20261028000006_il_ristorante_diventa_cantina`, con `ascolta-voce` e `promemoria-luogo` aggiornate.
- **#269:** lo schermo per apparecchio.
- **#270:** la guida del ponte sul portatile.
- **#271:** le comande escono dal ponte. Migrazione `20261029000001_le_comande_escono_dal_ponte`.
- **#272–#275:** la pagina Impostazioni, «Il locale», la voce vestita come «Esci» e la sua prova.

## Numeri, misurati
- **Copia di sicurezza nuova:** `2026-10-30_2225`. Quella precedente aveva 50,6 ore, e `migra` si era fermato, come deve. Il controllo della copia ha dato 145 tabelle su 145, 1.811 righe su 1.811, 4 utenti e 4 identità.
- **`npm run migra` in sola lettura:** 449 migrazioni nel repository e 446 in produzione.
- **`npm run migra -- --conferma`:** 3 migrazioni su 3 applicate e registrate. In produzione adesso sono **449**.
  - La verifica di `…20261029000001` ha dato «Fatto: … senza stampante tutto come oggi; un conto chiuso non stampa. Provato e annullato: zero residui».
- **`npm run funzione ascolta-voce -- --conferma`:** la produzione passa dalla versione 16 alla 17.
- **`npm run funzione promemoria-luogo -- --conferma`:** dalla versione 1 alla 2.
- **Pubblicazione:** l'esecuzione «Controlli» 41130842856 su `3c51c6c` è tutta verde, compreso «Manda in produzione», finito alle 21:42 UTC.
  - Sul sito di produzione il pacchetto `App-DthOPqaQ.js` carica la pagina Impostazioni, che contiene «Questo apparecchio», «Il locale» e «Stampanti e registratore».
- **`npm run consegne`:** nessun arretrato.

## Prima dell'unione
- **Il cancello della filiera era caduto alle 20:54:** Prova pubblicò `762fa36` solo alle 21:01. L'ho rilanciato e al secondo giro è passato.
- **CodeQL ha segnalato `ponte/rete.mjs:155`** (`rejectUnauthorized: false`).
  - La scelta è voluta: stampanti e registratore hanno certificati fatti da sé. La protezione è che il ponte chiama solo indirizzi della rete del locale (`ponte/sicurezza.mjs`).
  - Alessio ha detto «Sì, chiudilo». L'avviso n. 18 è chiuso come «won't fix», con la spiegazione scritta accanto.

## Non verificato
- **Nessuno ha ancora aperto la produzione a mano dopo il rilascio.** Ho controllato il pacchetto pubblicato, non lo schermo.
- **Stampanti e ponte in produzione:** non c'è nessun apparecchio registrato, quindi quella parte è spenta. Si prova al collaudo.

## Dato per fatto senza misurarlo
- Nulla.

## Affermazioni diventate false durante il lavoro
- **«Il servizio potrebbe essere aperto alle 22:20».** L'ho detto per consigliare di aspettare, ed era falso: il locale aprirà fra qualche mese. Alessio mi ha corretto.

## Cosa abbiamo rovesciato
- **La produzione dopo il collaudo.** Il 29/10 si era detto di rilasciare solo dopo il collaudo delle stampanti. Il 30/10 Alessio ha chiesto se ci fosse un motivo per aspettare. La risposta è stata no, perché senza un apparecchio registrato la parte stampanti non cambia niente, e ha scelto di rilasciare subito.
