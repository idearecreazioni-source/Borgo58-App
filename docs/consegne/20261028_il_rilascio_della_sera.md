# Il rilascio della sera: promemoria per luogo, conferma che va a capo, «Segnala» con l'immagine — 28/10/2026

**HEAD dichiarato sotto questo riepilogo:** master `8035511` (unione di #259). Questo file contiene solo documentazione: riporta i numeri dell'applicazione in produzione, come chiede §2 di CLAUDE.md («glielo riporto DOPO, con i numeri»).

## Cosa è stato rilasciato
Alessio lo ha autorizzato il 28/10 sera, dopo averlo provato su Prova: «porta queste funzioni in produzione».
- **#258:** i promemoria per luogo, cioè «Ricordamelo quando arrivo» a casa o al ristorante. Comprende:
  - le migrazioni `20261028000001_un_promemoria_aspetta_che_arrivo_a_casa`, `20261028000002_la_voce_sa_dire_dove` e `20261028000003_la_chiave_del_luogo`;
  - la funzione nuova `promemoria-luogo`;
  - `ascolta-voce` aggiornata.
- **#260:** la scheda dell'impegno rifinita: giorno e ora allineati, e la ruota dell'ora che sceglie da sola. Nessuna migrazione.
- **#261:** la notte dei difetti, circa 50 correzioni in tutto il gestionale. Nessuna migrazione.
- **#262:** la conferma «Elimina» che al telefono va a capo. Nessuna migrazione.
- **#263:** «Segnala» allega l'immagine della pagina, con la migrazione `20261028000004_la_segnalazione_porta_la_sua_immagine`.

## Numeri, misurati
- **Copia di sicurezza nuova:** `2026-10-28_1948`. La precedente aveva 27,5 ore e `migra` si è fermato, come deve. Il controllo della copia ha dato 144 tabelle su 144 e 1.749 righe su 1.749.
- **`npm run migra` in sola lettura:** 446 nel repository e 442 in produzione. Da applicare esattamente le quattro attese.
- **`npm run migra -- --conferma`:** applicate e registrate 4 su 4. In produzione adesso sono **446**.
  - La verifica di `…000003` in produzione ha dato «Provato e annullato: zero residui».
  - Anche la verifica di `…000004` ha dato «Provato e annullato: zero residui».
- **`npm run funzione promemoria-luogo -- --conferma`:** installata in produzione per la prima volta, versione 1. Al suo ingresso il controllo del token è spento: la barriera è la chiave del luogo.
- **`npm run funzione ascolta-voce -- --conferma`:** produzione dalla versione 15 alla 16.
- **`npm run consegne`:** nessun arretrato. Ogni migrazione recente è nominata da un riepilogo.

## Non verificato
- **Un promemoria per luogo arrivato davvero in produzione.** Serve l'automazione «quando arrivo a…» sull'iPhone, che non è ancora preparata. Serve anche una chiave del luogo creata dal titolare in produzione. Per ora nessuna delle due esiste.
- **«Segnala» con l'immagine e la conferma che va a capo su un iPhone vero, in produzione.** Alessio le ha guardate su Prova dal computer.

## Dato per fatto senza misurarlo
- Nulla.

## Affermazioni diventate false durante il lavoro
- Nessuna.

## Cosa abbiamo rovesciato
In questo rilascio non è stata rovesciata nessuna decisione. Quelle di #263 sono già scritte nel suo riepilogo.
