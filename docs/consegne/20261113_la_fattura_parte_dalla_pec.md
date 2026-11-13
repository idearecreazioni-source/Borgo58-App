# La fattura ai clienti parte dalla PEC verso lo SdI (13/11/2026) — pezzo 3 di 5

Commit sotto questa consegna: `64961c34`. Migrazione `20261113000005_la_fattura_parte_dalla_pec`. Funzione nuova `fattura-spedisci`; `operazioni-atomiche` ha la voce nuova `sblocca_invio_fattura`.

Piano approvato da Alessio il 13/11 (PIANO_fatture_emesse_13-11.md). Via al pezzo 3 dato da Alessio («Si parti»). Turno di Prova dato dalla chat madre.

## Cosa entra
- **«Emetti e manda»** nella bozza, dopo una conferma:
  1. salva quello che si vede;
  2. la funzione `fattura-spedisci` fa il file **prima** di dare il numero: se manca un dato si ferma, e il numero non si consuma;
  3. su work controlla, sempre prima del numero, che la password della PEC ci sia;
  4. `prepara_invio_fattura()` dà il numero (con `emetti_fattura`) e apre l'invio con un **progressivo nuovo** (base 36, 5 caratteri, da una sequenza). Lo SdI scarta un nome di file che ha già visto, anche nel rinvio di una scartata;
  5. rifà il file col numero vero e lo spedisce dalla PEC (SMTPS, porta 465, `smtps.pec.aruba.it`) a `service_settings.sdi_pec`, che la prima volta è `sdi01@pec.fatturapa.it`;
  6. `chiudi_invio_fattura()`: se è partita la fattura diventa «inviata» col nome del file, e l'XML esatto resta nell'invio.
- **«Rimanda allo SdI»** per una scartata corretta: i totali si rifanno, il numero resta, il progressivo è nuovo.
- **«Manda»** nell'elenco per una «da inviare», cioè numerata ma non partita (per esempio la PEC non rispondeva). Riparte con lo stesso numero.
- **«Prova la PEC»**: prova utente e password senza mandare niente. È il primo gesto dopo aver messo i Secrets.
- **Il dialogo con la PEC è scritto qui**, in `_shared/smtp.js`, senza librerie: le librerie di posta di Node non sono garantite sulle funzioni di Supabase. Si prova tutto in Node contro un server finto. Solo il tubo cifrato (`Deno.connectTls`) sta nella funzione.

## ⚠️ Su Prova e a casa non parte niente
- La funzione spedisce **solo** quando `SUPABASE_URL` è esattamente quello di work (`fattura-spedisci/ambiente.js`). Prova, home e qualunque altro indirizzo **simulano**: la fattura prende il numero e il file, l'invio è «simulato» e la pagina dice «PROVA: qui non parte davvero».
- La simulazione è la regola di partenza e non dipende da un segreto che manca. Il codice che spedisce non viene nemmeno raggiunto.
- Se i segreti della PEC ci fossero su un progetto che non sembra work, la funzione **si ferma** invece di simulare. Così una fattura vera non può risultare «inviata» senza essere partita (revisione).
- Su Prova non c'è nessun segreto della PEC.

## Revisione (ecc:security-reviewer)
Corretti tutti i rilievi:
1. **(alta) Doppione allo SdI.** Se la PEC si interrompe *dopo* aver ricevuto il messaggio, l'esito è **incerto**, non «fallito». L'invio resta «in partenza» e blocca il rinvio, e il titolare riceve un avviso. Solo un rifiuto esplicito del server, o un errore prima del messaggio, chiude come fallito.
2. **(alta) Invio appeso senza uscita.** Ogni passo dopo il numero è protetto: un imprevisto chiude l'invio come fallito, o come incerto se il messaggio era già scritto. Per l'incerto c'è **`sblocca_invio_fattura()`**: dopo 10 minuti, in «Le fatture», compaiono «C'è: è partita» e «Non c'è», dopo aver guardato nella posta inviata della PEC.
3. **(media) Pagina vecchia dopo un errore.** Se la spedizione non riesce, la bozza si chiude, la lista si rilegge e l'errore resta in cima. Un secondo «Emetti e manda» non crea più una bozza doppia.
4. **(media) Simulato su work.** I segreti presenti fuori da work fermano tutto (vedi sopra).

Restano, detti:
- il titolare può chiamare `chiudi_invio_fattura` a mano: è la parte fidata;
- un ripristino da copia riporterebbe indietro la sequenza dei progressivi. Va ricordato nella prova di ripristino (H).

## Verifica dentro la migrazione (annullata, zero residui)
1. Una bozza con la data nel futuro non parte e non prende il numero.
2. La bozza prende il numero; l'invio prende progressivo, nome `IT01343950869_xxxxx.xml` e indirizzo sdi01.
3. Due «Manda» insieme: il secondo è rifiutato. Un invio fermo da più di 10 minuti blocca il rinvio. Lo sblocco «non c'è» lo chiude come fallito, e un invio concluso non si sblocca due volte.
4. Dopo un fallito la fattura resta da inviare col suo numero, e riparte con un progressivo nuovo.
5. Partita: «inviata» col nome del file, e non riparte né si richiude.
6. Scartata e corretta: riparte coi totali rifatti (2 × 60,50 IVA inclusa = 110 + 11) e un progressivo nuovo.
7. Da fuori non si scrive negli invii, e lo staff non prepara.
8. Il progressivo in base 36 è giusto, e ogni vincolo nuovo ha la sua frase.

## Su Prova (13/11, turno della chat madre)
- Prima a secco due volte (eseguita e annullata), poi `prova:migra`: ci sono 483 migrazioni.
- Su Prova sono installate `fattura-spedisci` e `operazioni-atomiche`.
- **Giro vero nella pagina, con l'accesso di collaudo**:
  - «Prova la PEC» risponde «Qui siamo su Prova o a casa: la PEC non si usa»;
  - con i dati della società di prova, un cliente «ZZ» e una bozza da 4 × 27,50 con la carta, «Emetti e manda» dà «Fattura 1/2026 pronta (IT01343950869_00004.xml). PROVA: qui non parte davvero»;
  - nell'elenco la fattura risulta «inviata, in attesa dello SDI».
- **L'XML salvato nell'invio passa lo schema ufficiale 1.2.3.**
- Dati di prova cancellati subito dopo: 0 fatture, 0 clienti, 0 invii, e la società è tornata com'era.

## Prove
- `tests/unita/smtp.test.js` (14), contro un server finto:
  - la mail con l'allegato intatto;
  - niente intestazioni iniettate;
  - il dialogo completo, i punti a inizio riga e AUTH LOGIN;
  - la password sbagliata detta in italiano e mai ripetuta;
  - il destinatario rifiutato;
  - il «Prova la PEC»;
  - l'esito incerto dopo il messaggio;
  - «parte solo da work», e la funzione decide dall'ambiente e controlla il file prima del numero.
- `tests/schermate/fatture-clienti.test.jsx` (11):
  - «Emetti e manda» con la conferma, salva e poi manda, e dice «PROVA»;
  - l'errore in cima dopo una spedizione non riuscita;
  - «Manda» su una da inviare;
  - lo sblocco di un invio fermo;
  - «Prova la PEC».
- `tests/app/orfane.js`: `prepara_invio_fattura` e `chiudi_invio_fattura` sono chiamate dalla funzione online, non da una schermata.

## Cosa abbiamo rovesciato
Niente di nuovo. Il rovesciamento della decisione del 14/08 (Fatture in Cloud) è già dichiarato con il pezzo 1, voce 110.

## Rilascio su work (solo col sì di Alessio), in quest'ordine
1. Le migrazioni `20261113000002`, `03`, `04` e `05`.
2. `npm run funzione -- operazioni-atomiche --conferma` e `npm run funzione -- fattura-spedisci --conferma`.
3. Approve and deploy.
4. **Alessio** mette nei Secrets di Supabase (work) `PEC_UTENTE` (borgo58@pec.it) e `PEC_PASSWORD`: io non la vedo mai. Poi preme «Prova la PEC».
5. Prima fattura vera solo dopo le risposte di Laura (aliquote, scontrino e fattura, regime RF01). Le ricevute dello SdI le leggerà il pezzo 4.
