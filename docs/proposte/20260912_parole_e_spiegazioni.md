# Una parola per una cosa, e le spiegazioni fisse — documento per decidere, 12/09/2026

Mandato esteso del 12/09, priorità 3. **Nessun testo è cambiato**: questo
documento prepara decisioni. Le parole «task» → «impegno» le cambia già la
PR #60, e qui non si toccano.

Come è stato fatto:
- due censimenti in sola lettura sul codice di master (`59f4d2d`), uno per le
  parole e uno per le spiegazioni sempre visibili. Per ogni gruppo di parole
  è indicata la ricerca usata;
- per ogni riga è controllato se una PR aperta (#57, #58, #60, #63, #65) la
  cambia già;
- i punti citati come difetti (§3) li ho ricontrollati io sul codice e, dove
  serve, sul database in sola lettura.

Le proposte sono mie; la scelta è di Alessio. Nessuna proposta tocca testi
economici, fiscali, legali o su gesti irreversibili senza dirlo.

---

## 1. Le parole

| Parola oggi | Dove compare | Proposta unica | Motivo e impatto |
|---|---|---|---|
| **task** / impegno | «task» in 9 righe: Dashboard, Agenda, scheda impegno, pagina dei moduli. «impegno» in 9 righe (Agenda, MEMO voce) | **impegno** | **Già fatto dalla PR #60**, tutte e 9 le righe. Niente da decidere. |
| **partita** / lotto | «partita» in 18 righe: Scadenze, Fermi, Produzioni, scheda ingrediente, MEMO voce. «lotto» in 10: HACCP, Tracciabilità, Posta, Scadenze, Produzioni | **Due parole per due cose**: «partita» = quello che hai in magazzino; «lotto» = il numero di lotto del fornitore (HACCP) | Oggi «lotto» vuol dire quasi sempre il numero del fornitore, che è la parola della legge. Sono due i punti che mescolano: `Produzioni.jsx:552` («lotti» nel senso di partite) e `Scadenze.jsx:140` («lotto X» accanto a «partite»). Impatto: 2 righe. La #63 aggiunge «partite in magazzino», coerente. |
| **coperti** / persone / ospiti | «coperti» in 23 righe (sala, prenotazioni, cassa, Proiezione); «persone» in 25 (pianta, preventivi, prenotazione, modulo pubblico, MEMO); «ospiti» in 2 (scheda prenotazione) | **«persone»** dove parla o scrive il cliente (modulo pubblico, prenotazione, preventivo); **«coperti»** dove conta la sala o il conto (pianta, comande, cassa, Proiezione). «ospiti» sparisce | «coperto» è anche un prezzo («prezzo del coperto»): va bene dove si conta per il conto, non dove si parla col cliente. Oggi la scheda della prenotazione ha tutte e tre le parole (`ReservationForm.jsx` 457, 485-486, 603, 617). Impatto: circa 6 righe, nessun dato. |
| **soglia** / scorta minima | «soglia» in 7 righe (Magazzino, Lista della spesa, Allineamento); «scorta minima» in 11 (scheda ingrediente, Magazzino, Lista, MEMO) | **scorta minima** («sotto scorta minima») | Il campo che scrivi si chiama «Scorta minima» (`IngredienteForm.jsx:1200`), ma le righe dicono «sotto soglia». Stessa schermata, due parole: `/magazzino` (181, 544, 569 contro 186, 189) e Lista della spesa (458 contro 477). Impatto: 7 righe. Nessuna PR le tocca. |
| **categorie tecniche** della Dashboard | `Dashboard.jsx:609` scrive `{t.category}` così com'è: «· fisco_scadenze», «· haccp_locale» | Le etichette che esistono già in `TASK_CATEGORIES` (`constants.js:464-471`): «Fisco e scadenze», «HACCP e locale», … | Oggi quell'elenco non lo usa nessuna schermata. **Il file è toccato dalla #58 e dalla #60**: si fa dopo le loro unioni. Impatto: 1 riga. |
| **promemoria** (tre sensi) | a) l'avviso Telegram di un impegno (scheda impegno, 3 righe); b) l'impegno che nasce da solo in Agenda da una scadenza (Documenti, Fatture, Strumenti, Personale, 8 righe); c) «una traccia da ricordare» (Previsione, Sezione personale, MEMO, 3 righe) | **«promemoria» solo per a)**, l'avviso a un'ora. Per b) «impegno in Agenda»; per c) la frase si riscrive caso per caso | Nel senso b) è proprio un impegno: chiamarlo «promemoria» fa credere a un avviso sul telefono che non arriva. Impatto: circa 11 righe. |
| **appunto** / «le cose che hai dettato» / «in sospeso» | «appunto» in 9 righe (MEMO voce, Dashboard); «le cose che hai dettato» in 1 (`Dashboard.jsx:219`); «in sospeso» in 1 (la striscia «dalla voce», in 11 schermate) | **appunto** | Dopo la #58 la Dashboard avrebbe due frasi d'errore diverse per la stessa lettura («le cose che hai dettato» alla riga 219, «Non sono riuscito a leggere gli appunti» nel riquadro nuovo). E il verbo cambia: «approvi» (Dashboard) contro «guardi» (MEMO voce). **File della #58**: dopo la sua unione. |
| **Laura** / la commercialista | «Laura» in 9 righe (Adempimenti, Cessioni, Sconti, Deducibilità, Deduzioni, Simulatore); «commercialista» in 5 (Sezione personale, Deducibilità, Deduzioni, Proiezione) | **Da scegliere.** Proposta: **«la commercialista»** | Tutte e due sulla stessa schermata in Deducibilità e Deduzioni. Il ruolo resta vero anche se un giorno cambia la persona, e alcune schermate possono essere viste da altri. Impatto: 9 righe. |
| **giro** / turno / ultimo ingresso / ultimi arrivi | Sala e orari, legenda della pianta, MEMO | **«giro»** per le fasce della sala (primo giro, ultimo giro); **«turno»** solo in cucina (l'uscita dei piatti: «Avanti col prossimo turno»); «ultimo ingresso» e «ultimi arrivi» restano, sono due ore diverse (decisione del 18/08) | Nella legenda la stessa fascia si chiama «Primo giro» nel titolo e «primo turno» nella spiegazione (`src/lib/calcoli/ritardo.js:267-268`), e l'ultima si chiama «Ultimo turno» (277). Impatto: 3 righe in `ritardo.js` (nessuna PR lo tocca) e 1 in Sala e orari (file della #57). |
| **Caricamento…** / Sto guardando… / Carico… | «Caricamento…» in 59 righe; «Sto guardando…» in 6; «Carico…» in 4; altre 9 forme («Sto leggendo il documento…», «Calcolo…») | **«Caricamento…»** quando non c'è niente da dire; **«Sto leggendo …»** quando dice cosa. «Carico…» e «Sto guardando…» spariscono | «Carico…» si legge anche «carico di merce» in Magazzino e Scadenze, cioè proprio dove si caricano le partite. Impatto: 10 righe. |
| **(opzionale)** / (opz.) / (facoltativo) | 22 + 35 + 6 occorrenze | **Da scegliere.** Proposta: **«(facoltativo)»** | «(opz.)» è un'abbreviazione: su un campo da riempire con le mani occupate si legge peggio di una parola intera. Due forme sulla stessa schermata in Ricevimento merci e Lista della spesa. Impatto: 57 etichette, solo testo. |

---

## 2. Le spiegazioni sempre visibili

Il criterio è quello scritto da Alessio il 18/08: una spiegazione a schermo
si legge una volta e poi diventa arredamento. Quindi:
- **resta visibile** solo se riguarda soldi, fisco, legge, un gesto che non
  si può annullare, o un dubbio vero;
- **passa nel «?»** se spiega come funziona una cosa che Alessio ormai sa;
- **viene rimossa** se ripete una frase che sta già sulla stessa schermata.

⚠️ **Sala e orari, Previsione e Mance sono file della PR #57**, che li
tocca solo nell'impaginazione e non sposta nessuna di queste spiegazioni.
Qualunque scelta si fa **dopo l'unione della #57**, anche perché la #57 cambia
il componente del «?» (`Didascalia.jsx`).

### Sala e orari — `/calendario-eventi/sala-e-orari`

| Riga | Testo (in breve) | Proposta | Perché |
|---|---|---|---|
| 135-138 | Prenotazioni online accese/spente… «In tutti e due i casi confermi sempre tu.» | **«?»** | Spiega un interruttore che Alessio ha deciso lui. |
| 147-155 | «Oggi la sala ha N posizioni… apri la pianta.» | **via**, resta solo il collegamento «apri la pianta» | È una descrizione ovvia; il collegamento serve. |
| 174-177 | Email di conferma: «Parte solo alla conferma, mai da sola.» | **resta** (solo quella frase) | È un messaggio che parte verso un cliente: un gesto che non si ritira. |
| 186-188 | L'ultimo ingresso non è l'ora in cui chiudi | **«?»** accanto al campo | È un dubbio vero, ma solo quando si scrive l'ora. |
| 269-276 | Coperti per formato; accostandone due scende di due | **«?»** | Regola nota; sta dove uno se lo chiede. |
| 297-300 | Si accostano solo tavoli dello stesso formato | **«?»** | Il commento dice «va detto qui perché è dove uno se lo chiede»: il «?» sta lì. |
| 307-313 | Solo il nome… un tavolo si spegne, non si cancella | **resta** «si spegne, non si cancella»; il resto nel **«?»** | La prima parte è su un gesto che non si torna indietro. |
| 351-355 | Primo giro giallo / dopo verde | **via insieme al campo** — vedi §3, il campo non funziona | Il campo scrive una colonna che non esiste più; l'ora del primo giro sta già su ogni servizio (riga 248). |
| 370-372 | Un conto chiuso all'una appartiene alla sera prima | **resta** | Decide in quale giorno finiscono i soldi. |
| 385-387 | Passo degli orari: esempio con 15 | **«?»** | Operativa. |
| 398-400 | Minuti fra i turni | **«?»** | Operativa. |
| 418-420 | Soglia dei coperti: avvisa soltanto | **«?»** | Operativa. |
| 439-443 | Tolleranza del ritardo: sbarrato, avvisa soltanto | **«?»** | Operativa. |
| 454-455 | Sotto questa soglia gli orari non compaiono | **«?»** | Operativa. |
| 476-479 | Giorno di cucina ≠ aperto al pubblico | **«?»** | Dubbio vero, ma una volta. |
| 527-535 | Chiusure: «Non è "siamo pieni"» | **«?»** | Distinzione nota; il motivo al cliente lo scrivi tu nel campo. |

### Previsione («Ce la faccio?») — `/cassa/previsione`

| Riga | Testo (in breve) | Proposta | Perché |
|---|---|---|---|
| 221-225 | «Sapere se guadagni è una domanda…» | **«?»** | Spiega il concetto; Alessio lo sa. |
| 272-274 | Avvertenza dal database: non comprende gli stipendi; carta al lordo | **resta** | È il limite del numero: il numero e il suo limite viaggiano insieme (regola del progetto). |
| 280-283 | «Fatture e imposte non le scrivi tu… sparisce da sola» | **via** | La seconda frase è già nell'avvertenza qui sopra. |
| 337-346 | (se c'è) Uscite oltre l'orizzonte, non nel saldo | **resta** | È il taglio dichiarato (17/08): senza, il saldo sembra completo. |
| 353-356 | «Non scriverci le fatture dei fornitori… contate due volte» | **resta** | Evita di contare due volte un'uscita. |
| 376-379 | «tolta il …, non entra nella previsione» | **resta** | Dice lo stato di quella riga. |
| 489-492 | Il POS non è in banca stasera | **«?»** | Spiega come funziona la banca. |
| 515-517 | Avvertenza POS dal database: lordo, giorni non noti | **resta** | Limite del numero. |
| 554-557 | «Lasciali vuoti finché non te lo dice la banca…» | **via** | La dice già l'avvertenza del POS. |

### Mance — `/personale/mance`

| Riga | Testo (in breve) | Proposta | Perché |
|---|---|---|---|
| 235-238 | Le verifiche sul regime agevolato sono un aiuto, non un verdetto | **resta** | Fiscale. |
| 320-322 | (se c'è un totale) Queste somme non sono ricavi del locale | **resta**, e si toglie il doppione nel «?» del titolo (229-233) | Viene dal database insieme al numero; il «?» dice la stessa cosa. |

### Le altre schermate — 73 righe

Sono le righe della tabella del censimento, contate qui una per una (il
riepilogo del censimento ne diceva 70). Una è il «?» vuoto di MEMO voce, che
la #57 corregge già (§3); le altre 72 sono divise così.

**Restano visibili (economici, fiscali, legali, irreversibili, o con una
decisione scritta nel codice)**, 39:
- Cessioni 113 (fiscale), Cliente 499 (decisione scritta), Preventivo 398
  (la mail parte davvero), Cassa 338 e 528 (differenze e cassetto),
  Causali 101 (deducibilità), Sconti e omaggi 202 (TD27, decisione scritta),
  Scontrinato 155 e 259 (fiscale), Sezione personale 190, 231, 424, 517,
  Prestiti 176 (decisione scritta), Scontrini 117 e 162 (fiscale), Archivio
  305 (decisione scritta), Andamento 290, Deducibilità 138, 153, 234,
  Deduzioni 217, Previsioni 159 (decisione del 24/08), Proiezione 91,
  Simulatore 130, 191, 296, 349, Raccolta propria 90 (legale), giornata di
  servizio HACCP (decisione del 24/08), Cantina 306, Fornitore 159 (azzera
  due campi), Magazzino 334, Dipendente 409 (decisione del 15/08),
  Informativa privacy 69 (legale), Menu 406, Ricetta 862 (decisione del
  30/08) e 1000, Staff ricetta 243 (tracce, legale).

**Passano nel «?» (spiegano come funziona una cosa)**, 26:
- AgricoloHome 151, Comunicazioni 108, Prenotazione 613, Elenco
  prenotazioni 120, Causali 96 e 106, Conti correnti 81, Calibrazione del
  tocco 43, Posta in arrivo 919, Andamento 395, Deducibilità 194, Deduzioni
  454, Previsione dettaglio 406, Previsioni 176, Allineamento 106, Magazzino
  349 e 450, Fornitore 418, Lista della spesa 389, Spesa spicciola 208,
  Scadenze 323, Bevande 328, Ingrediente 1212, 1339, 1533/1591, Ricetta 1962.

**Via (ovvie, o già dette altrove sulla stessa schermata)**, 5:
- Cliente 427 («visibile solo a te»: lo staff non vede nemmeno la sezione),
  Chiedi all'archivio 75, Materiali 64, Ricettario 42 (il file lo tocca la
  #65, in un'altra riga: si fa dopo),
  Schede prodotti 153 (seconda metà: «riempie solo i campi vuoti» resta,
  perché è il limite di un gesto in blocco).

**Da non toccare senza Alessio anche se sembrano operative**, 2:
- Schede prodotti 113 (scarto: decisione scritta, «resta»), Schede prodotti
  209 («quello che MEMO deduce vale»: è la regola del 25/08, e toglierla da
  un posto solo è già successo due volte).

Il conto: 39 + 26 + 5 + 2 = 72, più il «?» di MEMO voce = 73. Schede
prodotti 153 è contata una volta sola, fra quelle da togliere, anche se
solo la sua prima metà va via.

---

## 3. Difetti trovati facendo il censimento — non corretti

| Dove | Cosa | Verificato come | Chi lo tocca |
|---|---|---|---|
| **Sala e orari**, «Fin quando è "primo giro"» (`SalaEOrari.jsx:344-355`) | Il campo **non funziona in nessuno dei due versi**: la lettura delle regole (`getRegolePrenotazione`, `src/lib/api/sala.js:343-357`) non chiede `ora_primo_turno`, quindi il campo è sempre vuoto; salvarlo scrive `service_settings.ora_primo_turno`, colonna che **in produzione non esiste** (catalogo letto il 12/09: `ora_primo_turno` c'è solo in `service_hours`). La colonna è stata spostata sui servizi il 18/08. | codice + catalogo di produzione in sola lettura; non premuto | file della **#57** |
| **MEMO voce**, il «?» accanto al titolo (`Detta.jsx:530`) | Su master **si apre vuoto**: la schermata passa il testo come `testo="…"`, e `Didascalia` legge solo il contenuto fra i tag (`children`). | codice | **già corretto dalla #57** |
| **Dashboard**, riga di un impegno (`Dashboard.jsx:609`) | La categoria esce come codice («· fisco_scadenze»). | codice | file della **#58** e della **#60** |
| **Legenda della sala** (`ritardo.js:267-268`) | La stessa fascia è «Primo giro» nel titolo e «primo turno» nella spiegazione. | codice | libero |

---

## 4. Ordine proposto, quando Alessio avrà scelto

1. Dopo la **#60**: niente, «impegno» è fatto.
2. Dopo la **#57**: le spiegazioni di Sala e orari, Previsione e Mance, e il
   campo rotto del primo giro. Una PR sola per schermata.
3. Dopo la **#58**: categorie leggibili in Dashboard, «appunto» al posto di
   «le cose che hai dettato».
4. Quando vuole, in file liberi: scorta minima, coperti/persone, partita/lotto,
   promemoria, giro/turno, caricamento, facoltativo — **una parola per PR**,
   così una scelta si può rivedere senza toccare le altre.

## 5. Cosa NON è verificato

- I numeri di riga e le occorrenze vengono dai due censimenti in sola
  lettura. Ho ricontrollato io i punti del §3 e un campione di sei righe; le
  altre sono come le hanno lette i censimenti.
- Una parola spezzata fra due righe di codice non viene trovata (controllato
  per «scorta», «ultimo», «ultimi»: zero casi).
- Nessuna schermata è stata aperta per questo documento.
