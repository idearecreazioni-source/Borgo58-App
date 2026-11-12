# Gli avvisi della banca si raccolgono (12/11/2026)

Migrazione `20261112000008_gli_avvisi_della_banca_si_raccolgono`. PR **B1** del piano «avvisi banca e posta» del 12/11, approvato da Alessio con tutte le scelte consigliate.

## Cosa c'è
- **Le mail alla casella della banca non passano da MEMO.**
  - La casella è `banca@…resend.app`, dove dall'11/11 Credem manda gli avvisi dei movimenti.
  - Nascono già «scartate», con la nota «Avviso della banca: va in Banca, non in MEMO…».
  - `posta-leggi` legge solo le «da leggere»: niente modello, niente spesa, niente Telegram.
  - Nella Posta stanno fra le «Sistemate» col bollino «Filtrata», e la nota si legge intera.
- **La casella si sceglie nelle impostazioni.** Colonna nuova `service_settings.casella_avvisi_banca`, valore di partenza «banca».
  - È solo la parte prima della chiocciola: Prova e work ricevono a indirizzi tecnici diversi.
  - NULL (non una stringa vuota) vuol dire nessuna casella degli avvisi: la deviazione si spegne.
- **Il ramo della banca viene prima delle regole della Posta.** È nella stessa funzione del filtro (`posta_filtra_in_arrivo`, rifatta con `create or replace`). Un avviso preso anche da una regola direbbe la regola sbagliata.
- **La copia di ogni avviso va in una tabella nuova, `avvisi_banca`.**
  - Dentro: mittente, mittente com'è arrivato, oggetto, testo, data, stato «raccolto».
  - Gli stati possibili sono quattro, quelli del piano: raccolto, registrato, non capito, ignorato. Oggi si usa solo il primo.
  - La scrive un trigger **dopo** il salvataggio, non prima (trappola 1 del piano): Resend riconsegna le mail, e la consegna doppia scartata non deve fare una seconda copia. In più l'identificativo della mail è unico anche qui.
  - Se la pulizia della posta cancella la mail (dopo 3 mesi), l'avviso resta: il legame si svuota.
  - La legge solo il titolare, dal browser in sola lettura. La chiave pubblica e la chiave di servizio non la leggono.
- **Le mail di banca@ già arrivate sono recuperate.** Si copiano tutte; quelle ancora da decidere vanno fra le scartate e le loro proposte aperte diventano «no», come fa «Ignora le mail come questa».
- **La PEC dello SdI e il gestore PEC non si deviano mai**, nemmeno se arrivassero a banca@.
- **In Banca, un riquadro piccolo** sopra i movimenti: «Avvisi della banca ricevuti: N — il lettore arriva quando conosciamo il formato».
  - Si apre, e mostra gli ultimi 30 avvisi; ognuno si apre per leggerne il testo così com'è arrivato.
  - Se non si legge, una riga lo dice e il resto della pagina funziona.
- **Nessun movimento entra in Banca dalle mail.** Il lettore (B2) si scrive dopo una o due settimane di mail vere.

## Cosa NON c'è, e perché
- **Le intestazioni della mail** (List-Unsubscribe, List-Id, Precedence, Authentication-Results, la firma DKIM).
  - La colonna `avvisi_banca.intestazioni` c'è, ma resta vuota.
  - Il webhook di Resend porta solo i dati di testa che `posta-in-arrivo` già usa, e nel codice di oggi niente dice che la lettura della mail da Resend porti anche le intestazioni. Non si inventa un campo.
  - **Da verificare dal vivo** (vedi sotto). Se ci sono, si scrivono con la PR P2, che ne ha bisogno anche per la pubblicità.
- **`posta-in-arrivo` non è cambiata**: tutto il lavoro lo fanno i trigger nel database.
- **`etichettaCasella` non è cambiata**: «banca@…resend.app» si mostra già come «banca@». C'è una prova che lo dice.

## Ordine di rilascio — tutto col sì di Alessio
1. **Su Prova: `prova:migra` PRIMA dei Controlli**, non dopo (i Controlli non migrano Prova).
2. Controlli verdi sulla PR, compresi `vocabolari`, `permessi` e `vincoli-che-parlano`.
3. **Su work: `migra`**, solo col sì di Alessio.
4. **Il sito** (riquadro in Banca, bollino nella Posta): col clic «Approve and deploy» di Alessio.
5. **Nessuna funzione online da reinstallare**: `posta-in-arrivo` e `posta-leggi` non sono cambiate.

## Da verificare dal vivo
- **Le notifiche Credem verso banca@ sono già attive?** Se sì, la migrazione su work recupera quelle arrivate: il numero si legge nel messaggio finale («N avvisi già arrivati recuperati») e nel riquadro in Banca.
- **La prima mail vera di Credem dopo il rilascio:**
  - nella Posta deve stare fra le Sistemate, «Filtrata», con la nota della banca;
  - in Banca il numero del riquadro deve salire di uno, e il testo deve essere leggibile;
  - nessun messaggio su Telegram, nessuna spesa di MEMO per quella mail.
- **La casella com'è scritta davvero.** La deviazione guarda il primo destinatario della mail (`casella`). Se Credem scrive a banca@ in copia e a un'altra casella come primo destinatario, la mail non viene riconosciuta: controllare `casella` sulla prima mail vera.
- **Le intestazioni.** Sulla prima mail vera, guardare la risposta di `GET emails/receiving/{id}` di Resend: se c'è un campo con le intestazioni, la PR P2 le salva.

## Rischi e dubbi che restano
1. **Chiunque può scrivere a banca@.** Oggi non succede niente (la mail si raccoglie e basta). Diventa un rischio con B2: per questo l'abbinamento automatico chiederà la firma verificata (domanda 6 del piano).
2. **Gli avvisi non si cancellano mai da soli.** Sono pezzi dell'estratto conto, ma dentro ci possono essere nomi di chi paga o riceve. Se Alessio vuole un tempo di conservazione, si aggiunge.
3. **La chiave di servizio non legge `avvisi_banca`.** B2 (la funzione `avvisi-banca`) dovrà ricevere il permesso apposta.
4. **«Non era da filtrare: falla leggere»** nella Posta funziona anche sull'avviso della banca: lo manda a MEMO, che lo paga. È la via d'uscita se la deviazione sbagliasse.

## Controlli
- **Verifica dentro la migrazione** (si annulla da sola, zero residui):
  - nessuna funzione nuova è aperta al browser; `avvisi_banca` non si scrive dal browser e non la legge la chiave pubblica;
  - dopo il recupero, nessuna mail della banca resta da decidere, e ognuna ha la sua copia;
  - la casella si riconosce anche scritta «Banca <BANCA@…>», non si confonde con «bancaria@», e non prende la PEC dello SdI;
  - come la chiave di servizio: una mail a banca@ nasce scartata con la nota, la stessa consegnata due volte fa **una** copia sola, con stato «raccolto»;
  - una mail di Credem a info@ non è toccata e non si copia;
  - un avviso che una regola di partenza prenderebbe dice «avviso della banca», non la regola;
  - la PEC dello SdI arrivata a banca@ resta da leggere;
  - il titolare vede l'avviso ma non lo scrive; lo staff ne vede zero; la chiave pubblica è respinta;
  - con la casella NULL nelle impostazioni la deviazione si spegne;
  - le prove usano «banca» qualunque sia il valore vivo (impostato e annullato dentro la verifica).
- **Non ancora provata su Prova.**
- **Prove pure:** tests/unita/pec.test.js (banca@), tests/unita/posta-da-decidere.test.js (l'avviso è «Filtrata» e non da decidere).
- **Prova di schermata:** tests/schermate/avvisi-banca.test.jsx (il numero, l'avviso che si apre, l'elenco tagliato, nessun avviso, l'errore di lettura).
