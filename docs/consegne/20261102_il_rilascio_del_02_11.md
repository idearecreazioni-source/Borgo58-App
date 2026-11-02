# Il rilascio del 02/11: anticipi che pagano la fattura, XML delle fatture, BPER, riquadro del progetto

Questo file nomina la migrazione che entra in produzione con questo rilascio, come chiede `npm run migra`. I numeri dell'applicazione si aggiungono dopo, in una PR a parte.

## Cosa entra
Alessio lo ha autorizzato il 02/11:
- con «sì, rilascio in produzione dalla #304 alla #316»;
- con «Sì, tutte insieme» ha aggiunto le sei PR più vecchie già su slave e mai rilasciate.

Le PR:
- **#291:** Casa, la copia di sicurezza giornaliera si riapre prima di dirla buona.
- **#299:** Stampanti e chiave del luogo: errori che spariscono, doppio tocco e conferma.
- **#300:** la pagina Stampanti segue il profilo Computer.
- **#301:** funzioni online con firma a tempo costante, errori non più silenziosi e indirizzi dell'anteprima.
- **#302:** su Prova nessun indirizzo del cloud scritto a mano nelle migrazioni.
- **#303:** Casa, gli scontrini «da collocare» anche senza rete.
- **#304:** contabilità gruppo A, i ritocchi dalla prova in produzione.
- **#305:** senza rete il riquadro d'accesso lo dice, e al ritorno ricontrolla da solo.
- **#306:** su Casa è accesa solo la funzione operazioni-atomiche.
- **#307:** il CSV di BPER entra come quello di Credem.
- **#308:** contabilità gruppo B, causali da riaccendere e movimenti da Da collocare.
- **#309:** Casa, `npm run casa:aggiorna`.
- **#310:** il file XML della fattura elettronica resta collegato alla fattura.
- **#311:** un anticipo collegato a una fattura la segna pagata (anticipo).
  - Migrazione **`20261101000001`** (`l_anticipo_paga_la_fattura`).
  - Passo unico sulle note già esistenti: segna pagate le fatture ancora da pagare con una sola nota collegata che vale esattamente quanto resta. Riguarda la fattura Aruba (1,22 €) e la 330/F del notaio, se soddisfano le condizioni; le altre restano come sono e se ne dice il numero.
- **#312:** prove, il vocabolario dei pagamenti dopo «anticipo».
- **#313:** avviso sull'anticipo se manca il riferimento al documento.
- **#314:** Cassa, il riquadro «Il progetto finora» fino al primo scontrino.
- **#315:** Casa, MEMO su home con la stessa AI di work.
- **#316:** la verifica della migrazione anticipo non dipende più dal saldo vero del cassetto.

Funzioni online da installare in produzione, con `npm run funzione <nome> -- --conferma`:
- `ascolta-voce`
- `email-cliente`
- `notify-telegram-reservation`
- `operazioni-atomiche`
- `posta-in-arrivo`, l'unica senza verifica del token
- `posta-leggi`

`_shared/uguali.ts` entra con email-cliente, notify-telegram-reservation, posta-in-arrivo e posta-leggi.

## Ordine
1. Questo riepilogo su slave, poi slave → master.
2. Copia di sicurezza della produzione (`npm run backup`).
3. `npm run migra`, prima in sola lettura e poi con `--conferma`.
4. Le sei funzioni online.
5. Approvazione del lavoro «Manda in produzione» per il sito.

La migrazione va prima del sito perché il sito nuovo chiama la funzione del database che la migrazione crea.

## Cosa si controlla dopo
- `npm run migra` in sola lettura: nessuna migrazione mancante.
- L'avviso della migrazione: quante fatture sono state segnate pagate (anticipo) e quante restano da guardare a mano.
- In produzione, in sola lettura: Aruba e 330/F risultano «pagata (anticipo)» e gli anticipi da rimborsare restano invariati.
- Il sito di produzione risponde con la versione nuova.
- Le funzioni online rispondono, e la posta in arrivo resta raggiungibile senza token.
