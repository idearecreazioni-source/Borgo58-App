# La notte dei difetti — 28/10/2026

**HEAD dichiarato sotto questo riepilogo:** il commit che contiene questa riga (il secondo «Riepilogo» corregge il primo: il peso finale), sul ramo `claude/notte-difetti`. Il ramo è aperto da `origin/slave` `36cdcbb6` e contiene già la #260 (`claude/scheda-ora-rifinita`). Working tree pulito.
**Nessun database e nessuna funzione online toccati.**

## Origine
Alessio, la sera del 28/10, prima di dormire: *«puoi approfittare della notte per scandagliare scrupolosamente tutto il gestionale alla ricerca di difetti di varia natura?»*

## Come
Sette revisori ECC in parallelo, in sola lettura, su una copia di `slave`, ognuno su una zona:
- `ecc:code-reviewer` per cassa, fatture e fisco;
- `ecc:code-reviewer` per magazzino, ricette, HACCP e agricolo;
- `ecc:code-reviewer` per agenda, voce, documenti e personale;
- `ecc:react-reviewer` per sala, comande e prenotazioni;
- `ecc:security-reviewer` per sicurezza e funzioni online;
- `ecc:silent-failure-hunter` per gli errori ingoiati;
- un revisore generale per l'impaginazione al telefono e il tema scuro.

Hanno trovato circa 100 rilievi. Ogni rilievo corretto qui l'ho prima riletto nel codice. Sulle correzioni ha lavorato poi un ultimo revisore, `ecc:react-reviewer`: ha trovato due piccoli difetti miei, già corretti. Se il salvataggio dei coperti fallisce, il campo torna al numero vero; uscendo dal Bar non resta acceso nessun controllo.

## Corretti (ramo `claude/notte-difetti`)

**Sala e Bar (servizio)**
- **Le azioni fallite non vengono più annunciate come riuscite** (`withBusy` dice se è andata):
  - «Mandato in cucina» compare solo se il biglietto è partito;
  - «Annulla tavolo» chiude il pannello solo se il tavolo è chiuso davvero;
  - il piatto libero non si svuota se non è stato aggiunto.
- **Coperti:** si salvano a campo finito e solo come numero intero. Prima ogni tasto era una scrittura, e due scritture potevano arrivare al contrario.
- **Il tavolo giusto:** la rilettura di un tavolo non torna più sopra il tavolo toccato dopo.
- **Righe della comanda:** la «✕» ha un bersaglio vero (era larga 16 punti). «+», «−» e «✕» sono spenti mentre un'azione è in corso.
- **Bar:** senza il prezzo del coperto non si chiude il conto. Prima un conto poteva chiudersi con coperto zero, senza avviso. Ora il Bar riprova da solo e lo dice.
- **Chiusura del conto:** le causali di sconto e omaggio che non si leggono vengono dette, invece di lasciare un menu vuoto.

**Accesso**
- **Il ruolo non sparisce per la rete:** se la lettura del ruolo fallisce, il ruolo già noto resta. In alto compare «Non riesco a verificare il tuo accesso», con il pulsante Riprova. Prima il titolare si ritrovava senza permessi e senza nessun messaggio.
- **Niente «Caricamento…» infinito** se l'accesso iniziale fallisce.

**Cassa e fisco**
- **Simulatore fiscale:** salva solo i parametri che ha letto. Prima, dopo una lettura fallita, «Salva» poteva scrivere sul soggetto sbagliato le aliquote dell'altro, o quelle di partenza.
- **Niente «Caricamento…» infinito** in otto pagine di cassa e fisco quando la prima lettura fallisce.
- **Date proposte:** prima nota, sconti e omaggi, previsione, prestiti, sezione personale e deduzioni (più cessioni e raccolta propria) propongono la data di oggi. Prima proponevano quella del giorno in cui il gestionale era stato aperto, che su un tablet acceso da giorni è sbagliata. «Da dire alla commercialista» ora usa il mese giusto.
- **Uscite del mese:** «Questo mese: usciti» non conta più i pagamenti postdatati, che non sono ancora avvenuti.
- **Percentuale omaggi:** se l'incassato del mese non si è letto, la scheda dice «non letto» invece di «non è stato servito niente».
- **Selettore anni delle deduzioni:** offre di nuovo gli anni passati. Prima proponeva solo l'anno in corso.
- **Scadenze fisse:** svuotare l'importo non scrive più zero.
- **Previsione:** una previsione non letta non si spaccia per «Non trovata».
- **Scontrinato:** la notte del primo del mese il periodo non è più al rovescio.
- **CSV (prima nota, deduzioni):** una nota che comincia con «=», «+», «-» o «@» non diventa più una formula di Excel. Gli importi negativi restano numeri.

**HACCP e magazzino**
- **Non conformità, ricevimento merci e attrezzature delle temperature:** se la lettura fallisce dicono «non lo so», con il pulsante Riprova. Prima dicevano «niente».
- **Il numero dettato a voce non si perde** aprendo la riga in allineamento, temperature e consumi. In allineamento era il caso peggiore: il numero veniva sostituito dalla giacenza attesa.
- **Rimuovere una coltura** ed **eliminare un giorno dei piatti del giorno** chiedono conferma. Prima partivano con un tocco.
- **Cantina:** «Butta il fondo» non registra zero calici a campo vuoto.
- **Scheda ingrediente:** una resa fuori misura blocca il salvataggio. Prima cancellava in silenzio quella salvata.

**Agenda, documenti, personale**
- **Posta in arrivo:** dopo una conferma il menu dei fornitori si legge di nuovo (mancava la società).
- **Archivio:** scegliendo due file uno dopo l'altro, il testo del primo non finisce più sul secondo.
- **Scheda documento:** non rilegge le sezioni a ogni lettera scritta.
- **Giorni alla scadenza** (personale, archivio, agricolo): contati sul calendario italiano. Prima, dal pomeriggio, una scadenza di oggi risultava «scaduta».
- **Impegno non letto per la rete:** mostra l'errore e Riprova, non il modulo vuoto. Salvare quel modulo avrebbe sovrascritto l'impegno vero.
- **«Rimanda» al computer:** non salva l'anno a metà mentre lo si scrive.
- **Agenda:** se la rilettura dopo «fatto» fallisce, lo dice.
- **Dashboard:** dopo Riprova toglie l'errore vecchio.
- **Prenotazioni:**
  - se la caparra fallisce dopo la creazione, porta alla prenotazione nata invece di farne un doppione;
  - la ricerca mostra solo l'ultima risposta;
  - la pianta del giorno disegna solo il giorno a schermo.

**Al telefono e al buio**
- **Pulsanti accanto ai campi** (nove righe: Conferma, Aggiungi, È questo…) alti come i campi. Misurato a 390 punti: prima 32 punti con testo a 12, adesso 38 con testo a 16, come il campo.
- **Date intere al telefono** in sette moduli: prima si tagliavano in caselle troppo strette.
- **Taratura del tocco:** il righello è visibile al buio. Prima le tacche scure sparivano.
- **Colori del tema** in Scadenze (scelta evidenziata, bordo del «Buttata») e nel campo della chiave della voce.
- **Chiaro/Scuro:** è una scelta sola per i due menu, quello del telefono e quello del computer.
- **Non conformità:** il pulsante è allineato al campo, non alla riga d'aiuto.

## Verificato
- **Prove delle schermate:** 464 su 464 verdi. Prove nuove:
  - `tema-una-scelta-sola`;
  - `csv-formule`;
  - la ruota dell'ora, nella #260.
- **Prove pure:** 2396 verdi. Ne falliscono 3, `bozze-col-lordo` e `indirizzo-funzioni-vault` (2): falliscono anche su `slave` in questa copia, per gli a capo di Windows di due migrazioni che non ho toccato. Su GitHub passano.
- **Lint pulito, compilazione riuscita.**
- **Pulsanti accanto ai campi:** misurati in Chrome a 390 punti (vedi sopra).

## Non verificato
- **Le schermate vere con un accesso:** non le ho aperte, perché non uso il PIN di Alessio. Sono provate dalle prove automatiche e, per i pulsanti, dalla misura.
- **Le prove contro il progetto di prova:** le fanno girare i controlli della PR.

## Da decidere con Alessio (non toccato)
1. **La posta accetta qualunque mittente** (`posta-in-arrivo`). Un estraneo che manda 30 PDF può esaurire il tetto mensile dell'assistente, lo stesso della voce e delle foto. E se il controllo del tetto fallisce, la lettura continua lo stesso. Proposta:
   - un elenco di mittenti conosciuti, oppure, per gli sconosciuti, lettura senza allegati;
   - un tetto solo per la posta;
   - controllo per ogni mail, che si ferma se non riesce a leggere il tetto.
2. **PIN corti su indirizzi noti.** Proposta:
   - una lunghezza minima nelle impostazioni di Supabase;
   - una frase lunga per il titolare;
   - il captcha di Cloudflare all'accesso.
3. **I pagamenti dei conti li può cancellare anche lo staff:** la regola su `order_payments` è «per tutti», mentre il commento dice «la cancellazione resta al titolare». Va verificata sul progetto di prova e chiusa con una migrazione.
4. **Un allegato «bomba»** (un file compresso piccolo che diventa enorme) potrebbe fermare la lettura della posta a ogni giro. È una correzione nelle funzioni `posta-leggi` e `documento-leggi`, da installare.
5. **Il CSV per la commercialista** usa la virgola come separatore: Excel in italiano lo apre tutto in una colonna. Si può passare al punto e virgola, se la commercialista lo apre con Excel.
6. **Il tetto del peso del gestionale** è salito da 440 a 450 kB: con queste correzioni il gestionale pesa 441,24 kB. Le misure sono scritte in `scripts/peso-pacchetto.mjs`.
7. **Fattura elettronica con più fatture nello stesso file:** si registra solo la prima. Serve una migrazione.

## Rimasti (minori, per un altro giro)
- **Sala:** «Riprova» non rilegge le impostazioni della serata.
- **Coltivazioni:** i raccolti già scaduti stanno ancora sotto «in arrivo».
- **Lista della spesa:** «Rimuovi» sulle righe già ordinate non fa niente, e quelle sotto soglia ritornano subito.
- **Produzioni:** cambiando le dosi non si ricalcola la resa proposta.
- **Tracciabilità lotti:** si leggono al massimo 1.000 righe.
- **Campo che si salva da solo:** dopo un salvataggio fallito mostra un valore non salvato.
- **Voce:** una dettatura fallita non si può rimandare.
- **Chiusura dell'anno:** l'anno viene letto a ogni tasto.
- **Da collocare:** «1.250» viene letto come 1,25.
- **Etichette:** in due moduli non sono legate al loro campo.
- **Tabelle dei documenti da stampa:** al telefono non scorrono.

## Dato per fatto senza misurarlo
- Nulla.

## Affermazioni diventate false durante il lavoro
- Nessuna.

## Cosa abbiamo rovesciato
- **Il tetto del peso del gestionale (440 kB, 25/10):** c'era per accorgersi di un modulo nuovo. Adesso è 450, e la ragione vale ancora. Il prezzo è un margine un po' più largo, ed è dichiarato nella storia del tetto con le misure.
