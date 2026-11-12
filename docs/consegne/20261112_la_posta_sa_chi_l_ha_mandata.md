# La posta sa chi l'ha mandata (12/11/2026)

Migrazione `20261112000005_la_posta_sa_chi_l_ha_mandata`. Revisione generale dell'11/11, punto 3 («arrivata dallo SdI» anche se l'ha mandata chiunque) e punto 1, la parte nel codice (il modello caro per qualunque mail con un file-fattura).

## Cosa c'è
- **«Registra la fattura» solo se la mail viene davvero dallo SdI.** Servono tutte e tre:
  - l'ha consegnata il gestore PEC: il mittente com'è arrivato è `posta-certificata@pec.aruba.it`;
  - la busta dice una sola volta chi l'ha mandata, ed è esattamente «Per conto di: sdiNN@pec.fatturapa.it»;
  - fra gli allegati ci sono `daticert.xml` e `smime.p7s`.
- **Altrimenti «da fare a mano».**
  - Il titolo dice «Mittente NON verificato: controlla la fattura n. X di Y», e la riga dice chi l'ha mandata.
  - I passi: chiedere al fornitore con un numero già noto, oppure aspettare la copia dello SdI; se è vera, registrarla da Fatture → Importa fattura elettronica.
- **L'IBAN nuovo si dice sempre, anche dallo SdI.**
  - La frase è «IBAN nuovo per questo fornitore (…): controllalo col fornitore prima di pagare.».
  - Nuovo vuol dire mai comparso nelle fatture già registrate di quel fornitore (per partita IVA).
  - Se il database non risponde, gli IBAN si danno tutti per nuovi.
- **Il mittente com'è arrivato si conserva.** Colonna nuova `posta_ricevuta.mittente_busta`, scritta da `posta-in-arrivo`. Prima si salvava solo il mittente ripulito, e da quello una PEC vera dello SdI non si distingue da una mail qualunque con scritto «sdi01@pec.fatturapa.it».
- **Funzione nuova `iban_nuovi_per_la_posta`.**
  - Solo la chiave di servizio la può chiamare.
  - La chiave di servizio resta senza accesso alle fatture.
  - Un «IBAN» sotto i 15 caratteri è sempre nuovo.
- **Il modello caro solo per chi conosciamo.**
  - Prima bastava allegare un file-fattura. Adesso solo lo SdI verificato o un fornitore in anagrafica; tutti gli altri passano dal modello piccolo.
  - Un indirizzo con «fatturapa.it» o «posta-certificata@» non verificato non conta come conosciuto.
  - Il tetto di spesa in Impostazioni è di Alessio: non toccato.
- **Il log.** Se l'elenco delle mail da leggere non si legge, `posta-leggi` lo scrive nel log invece di fermarsi in silenzio.

## Ordine di rilascio (Prova, poi work)
1. **La migrazione.** Va per prima: senza la colonna, `posta-in-arrivo` non salverebbe più le mail.
2. **La funzione online `posta-in-arrivo`.**
3. **La funzione online `posta-leggi`.**

Le PEC dello SdI già «da leggere» al momento del rilascio non hanno il mittente com'è arrivato: usciranno «da fare a mano», cioè dal lato sicuro.

## Controllo alla prima PEC vera dello SdI
- Dopo il rilascio, la prima fattura vera dello SdI deve mostrare «Registra la fattura», non «Mittente NON verificato».
- Se esce «non verificato»: guardare `mittente_busta` di quella mail e il testo della busta.
  - Il mittente deve essere il gestore.
  - La riga deve essere «Per conto di: sdiNN@pec.fatturapa.it».
  - Gli allegati devono comprendere `daticert` e `smime`.
- La forma della busta è ricavata dalle PEC vere del 07/11 descritte nel codice, non provata su una PEC vera dopo questa modifica.

## Rischi che restano
1. **Chi conosce l'indirizzo tecnico di ricezione** (`…@….resend.app`) può scriverci direttamente fingendo tutto: mittente del gestore, busta e i due file. In quel caso passa per SdI.
   - Si chiude davvero solo verificando la firma della busta (`smime.p7s`), oppure con l'esito DKIM/SPF se il servizio di ricezione lo fornisce (non verificato).
   - Intanto quell'indirizzo va tenuto riservato. Le ultime difese sono l'avviso sull'IBAN nuovo e la conferma di Alessio.
2. **La busta non provata su una PEC vera** dopo la modifica: vedi il controllo qui sopra.
3. **Altri tre limiti:**
   - un mittente «fornitore in anagrafica» si può ancora scrivere a mano: costa solo il modello caro, e lo ferma il tetto;
   - il mittente mostrato nella Posta si può ancora ingannare con una busta costruita apposta, ma non decide più il pulsante;
   - un IBAN truffaldino registrato a mano in passato risulta «noto».

## Controlli
- **Verifica dentro la migrazione** (si annulla da sola):
  - la colonna c'è e la chiave di servizio la può scrivere;
  - la funzione è aperta solo al servizio;
  - la chiave di servizio non legge le fatture;
  - un IBAN già visto, scritto in qualunque modo, non è nuovo; l'altro sì;
  - un fornitore mai visto, o senza partita IVA: IBAN tutti nuovi;
  - un pezzo corto non diventa «noto»;
  - senza IBAN la risposta è vuota.
- **Non ancora provata su Prova.**
- **Prove pure:** tests/unita/pec.test.js (SdI vero e finto), tests/unita/fattura-dalla-pec.test.js (proposta non verificata, IBAN nuovo, controlli sul codice di `posta-leggi` e `posta-in-arrivo`).

## Applicazione su work
- La migrazione;
- le funzioni online `posta-in-arrivo` e `posta-leggi`, in quest'ordine.

Nessuna modifica alla pagina.
