# Lo SdI risponde alla fattura (13/11/2026) — pezzo 4 di 5

Commit sotto questa consegna: `7090ad37`. Migrazione `20261113000006_lo_sdi_risponde_alla_fattura`. Funzione da reinstallare: `posta-leggi`.

Piano approvato da Alessio il 13/11 (PIANO_fatture_emesse_13-11.md). Via al pezzo 4 dato da Alessio («Parti col pezzo 4»). Turno di Prova dato dalla chat madre.

## Cosa entra
- **Le risposte dello SdI** alle fatture mandate dalla PEC (pezzo 3) si leggono **senza modello**, in `_shared/ricevuteSdi.js`. Il tipo si legge dal contenuto, non dal nome del file:
  - **RC** (ricevuta di consegna) → la fattura diventa «consegnata»;
  - **MC** (mancata consegna) → «messa a disposizione»: è nel cassetto fiscale del cliente e per il fisco è emessa. Conviene mandargli una copia;
  - **NS** (scarto) → «scartata», con l'elenco degli errori come li scrive lo SdI e il gesto da fare: «correggila e premi Rimanda allo SdI».
  - AT, NE e DT (fatture alla Pubblica Amministrazione) si registrano e non cambiano niente.
- **`posta-leggi`** ha un ramo nuovo, **prima del modello**, subito dopo quello delle ricevute della PEC. Scatta solo se valgono insieme tre cose:
  - la mail viene **davvero** dallo SdI (`vieneDalloSdi`: la busta del gestore, «Per conto di: sdiNN», `daticert.xml` e `smime.p7s`);
  - tutti i file che non sono della busta sono ricevute;
  - ogni ricevuta si legge ed è di una fattura nostra.

  Altrimenti la mail si legge come sempre e niente si perde. Le fatture dei fornitori (col loro `_MT_`) non sono toccate.
- **`registra_ricevuta_sdi()`** (solo service_role, security definer) lega la ricevuta all'invio **per nome del file** e porta la fattura allo stato giusto.
  - **Conta solo l'ultimo invio partito**: una ricevuta in ritardo di un invio vecchio non cambia la fattura.
  - **Chi è arrivato resta arrivato**: «consegnata» non cambia più, e «messa a disposizione» cambia solo in «consegnata».
  - **Un invio rimasto a metà** (esito incerto, pezzo 3) si chiude da sé con la ricevuta.
  - **Un invio sbloccato come «non partito»** che invece era partito si riapre. Se intanto ne è partito un altro, lo dice: **possibile doppione**, e arriva un avviso.
  - **L'indirizzo `sdiNN`** da cui lo SdI risponde diventa quello a cui scrivere d'ora in poi, ma solo da una ricevuta vera di un invio partito e solo nella forma esatta `sdiNN@pec.fatturapa.it`.
  - **Una ricevuta già vista** non si conta due volte. Se la mail viene riletta dopo un guasto, l'avviso però si rifà.
- **Avvisi su Telegram** («da fare»): fattura scartata, fattura messa a disposizione, possibile doppione. Per la consegna non arriva niente: si vede nella pagina.
- **La pagina**: nell'elenco una scartata o una messa a disposizione dice perché. Aprendo una scartata il motivo sta in cima, sopra «Rimanda allo SdI».

## Revisione (ecc:security-reviewer)
Niente di grave. Corretti:
1. una ricevuta per un invio sbloccato come «non partito» andava persa in silenzio → ora riapre l'invio e avvisa del possibile doppione;
2. uno scarto dopo una consegna cambiava lo stato → «consegnata» resta;
3. una ricevuta già vista non rifaceva l'avviso perso → ora sì;
4. un guasto dell'archivio mandava la ricevuta al modello → ora la mail resta da leggere e si riprova;
5. una data che non si legge bloccava la mail → si usa l'ora di adesso;
6. l'indirizzo sdiNN cambiava anche da ricevute che non contano → solo da ricevute vere di invii partiti.

Resta, detto: tutto si regge sul fatto che la mail venga davvero dal gestore. La firma `smime.p7s` della busta non si verifica, come per le fatture dei fornitori. La porta d'ingresso (`posta-in-arrivo`) verifica la firma del servizio di posta.

**Trovato dalla prova a secco su Prova**: due invii nella stessa transazione hanno la stessa ora. A parità di ora decide il progressivo, che cresce sempre.

## Verifica dentro la migrazione (annullata, zero residui)
1. File sconosciuto: non tocca niente.
2. Consegna: «consegnata», con identificativo, ora e sdiNN nuovo.
3. La stessa ricevuta due volte viene registrata una volta sola.
4. Scarto: «scartata» con la nota, e poi un rinvio parte.
5. Una ricevuta in ritardo dell'invio vecchio non tocca la fattura; la consegna del rinvio sì.
6. Un invio a metà si chiude da sé con la ricevuta.
7. Mancata consegna: «messa a disposizione».
8. Da fuori non si chiama, e ogni vincolo ha la sua frase.
9. «Consegnata» resta tale dopo uno scarto, e un mittente falso (`sdi1@`) non cambia l'indirizzo.
10. Un invio sbloccato come «non partito» si riapre con la ricevuta. Con un rinvio già partito dice «doppio».

## Su Prova (13/11)
- Prima a secco tre volte, poi `prova:migra`: 484 migrazioni.
- `posta-leggi` è installata su Prova; legge solo la posta di Prova.
- Nessuna ricevuta di prova lasciata.
- ⚠️ **Non provato dal vivo**: una mail vera dello SdI che arriva. Su Prova non ne arrivano, e fingerla vorrebbe dire costruire una busta PEC intera. Il ramo è provato sul testo (prima del modello, solo con `vieneDalloSdi`), il lettore sulle ricevute finte che passano lo schema ufficiale, e il database nella verifica. **La prima prova vera sarà la prima fattura vera.**

## Prove
- `tests/unita/ricevute-sdi.test.js` (7):
  - il riconoscimento dal nome;
  - consegna, scarto con tutti gli errori e mancata consegna;
  - un file che non è una ricevuta;
  - le ricevute finte che passano lo schema ufficiale `MessaggiTypes_v1.1.xsd` (in `tests/dati/fatturapa/`, scaricato da fatturapa.gov.it);
  - il ramo di `posta-leggi` prima del modello e solo con `vieneDalloSdi`.
- `tests/schermate/fatture-clienti.test.jsx` (12): la scartata dice perché, nell'elenco e aperta.

## Cosa abbiamo rovesciato
Niente di nuovo. Il rovesciamento della decisione del 14/08 (Fatture in Cloud) è già dichiarato con il pezzo 1, voce 110.

## Rilascio su work (solo col sì di Alessio)
1. Le migrazioni `20261113000002`-`06`.
2. Le funzioni `operazioni-atomiche`, `fattura-spedisci` e **`posta-leggi`** (`--conferma`; su work oggi `posta-leggi` è alla v27).
3. Approve and deploy.
4. I Secrets della PEC li mette Alessio, poi «Prova la PEC».
