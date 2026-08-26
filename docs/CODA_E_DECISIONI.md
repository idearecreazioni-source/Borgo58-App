# La coda dei lavori e le decisioni ancora aperte

> ⚠️ **Questo elenco non è un promemoria di comodo: è l'unico posto dove queste
> voci esistono, e una voce tolta di qui è una voce persa. Chi chiude una voce
> la sposta con la data e la ragione, non la cancella.**

**Perché esiste.** Il repository conserva già le consegne, i mandati, il
[registro dei rovesciamenti](decisioni_rovesciate.md), gli appunti di progetto,
il [Contratto](CONTRATTO.md), le [annotazioni del collaudo](collaudo/annotazioni.md)
e i [quesiti per i consulenti](quesiti/). Due cose invece vivevano **solo nelle
chat**, e con la loro cancellazione sarebbero sparite: la coda dei lavori e le
decisioni di Alessio ancora aperte.

**Il suo compito.** Questo file è il posto dove la coda vive, e **va aggiornato
alla fine di ogni giro** — non ci sarà più una chat da rileggere.

> 🔴 **COME SI AGGIORNA QUESTO FILE, e non è un dettaglio di stile.** Il
> 19/08/2026 **tre sezioni intere sono sparite** — la lezione sull'ordine
> delle migrazioni, le decisioni di Alessio ancora aperte, e cosa il disegno
> della sala non dice — perché un comando che riscriveva una voce cercava un
> punto di riferimento nel testo, **non lo trovava**, e invece di fermarsi
> tagliava tutto quello che veniva dopo. Nessun errore, nessun avviso: il
> file era più corto e sembrava intero. *È la stessa forma della lettura
> tagliata misurata la stessa notte.*
>
> Quindi: **questo file si modifica a mano, o con un comando che si FERMA se
> non trova il punto che cerca.** Un aggiornamento che non trova il suo posto
> deve fallire rumorosamente, mai proseguire.

---

## La coda dei lavori, nell'ordine deciso

0-caparra. 🔴 **UNA CAPARRA INCASSATA NON ARRIVA MAI IN CASSA — misurato il
   26/08/2026, NON corretto** (il mandato chiedeva di misurare, non di
   riparare).

   **Il percorso, guardato dalla schermata al database e non dedotto dai
   nomi.** Il campo «Caparra €» in *Calendario Eventi → scheda prenotazione*
   (solo titolare, solo eventi) chiama `setReservationDeposit()`, che fa un
   `upsert` diretto su `reservation_deposits`. Punto. Sulla tabella ci sono
   **zero trigger**, e in tutto il database **zero funzioni la nominano** —
   contro le 18 che nominano `cash_movements` e le 18 che nominano
   `reservations`, quindi lo zero non è dello strumento.

   **Quanto è grande, misurato sul gestionale di prova** (due mesi di vita
   finta a scala vera): **3 caparre su 3 senza movimento — 245,00 € in
   tutto**, e nessun movimento di cassa con quegli importi. Nel gestionale
   vero le caparre sono **zero**: oggi non morde, e il giorno del primo
   evento vero sì.

   ⚠️ **E non è che il movimento sia scritto con la causale sbagliata: non
   c'è nessuna causale per una caparra.** Le entrate disponibili sono
   *Incasso giornaliero*, *Altro incasso*, e due di sistema. Il buco è
   completo — non si scrive niente, e non c'è dove scriverlo.

   🔴 **E CI SONO ALTRI DUE BUCHI NELLO STESSO PUNTO, trovati guardando chi
   legge quel numero.**
   - `getReservationDeposit` è chiamata **da un solo posto**: la scheda che
     l'ha scritta. Nessun conto la scala, nessun saldo la vede, «Ce la
     faccio?» non la conosce. Il cliente versa 80 € di caparra e alla serata
     paga il conto pieno: **il gestionale non toglie niente**.
   - `reservation_deposits.reservation_id` è `on delete cascade` su
     `reservations`, e `pulisci_richieste_scadute()` cancella le prenotazioni
     rifiutate o annullate dopo sei mesi. Una caparra su una richiesta
     rifiutata **sparisce da sola**, senza lasciare traccia da nessuna parte.
     Sul progetto di prova una delle tre è proprio su una
     `richiesta_in_attesa`, da 85 €.

   ⚠️ **La classificazione delle caparre nel registro delle cancellazioni
   dipende da qui**, ed è per questo che è rimasta vuota: finché il denaro
   non ha una strada, decidere se conservarne la lapide è rispondere alla
   domanda sbagliata. ⚠️ E la tabella **non ha una colonna `id`** (è
   `reservation_id`, `amount`, `created_at`): messa dentro così com'è, la
   lapide nascerebbe senza il riferimento.

0-zero-bis. 🔴 **DEBITO DICHIARATO — L'AGGIRAMENTO DEL PIANO NELLA PROVA
   DI RICARICA** (25/08/2026, deciso da Alessio: si dichiara, non si cura
   adesso).

   `npm run ricostruzione:verifica` applica **33 file** con
   `set enable_seqscan = off`. **Non è una cura: è un aggiramento.** Senza,
   quei file si fermano con *«array_agg is an aggregate function»* — col
   piano sbagliato il motore calcola `pg_get_functiondef()` di **ogni**
   funzione del catalogo, aggregate di `pg_catalog` comprese, prima di
   filtrare lo schema.

   🔴 **E LA CURA SCRITTA IL 23/08 ERA DIVENTATA FALSA.** Quella nota dice
   *«si rilancia dopo un `analyze`»*. Misurato il 25/08 sul database
   ricostruito, con **247** funzioni in `public`:

   | cosa | esito |
   |---|---|
   | così com'è | si ferma |
   | dopo `analyze pg_proc; analyze pg_namespace` | **si ferma lo stesso** |
   | dopo `vacuum analyze` | **si ferma lo stesso** |
   | con `set enable_seqscan = off` | passa |
   | con `and p.prokind = 'f'` nella query | passa |

   La nota di allora descriveva **quello che era bastato quel giorno**, non
   una cura — e col catalogo pieno non basta più. *È scritto qui perché non
   ricapiti a chi legge fra tre mesi: una nota che dice il contrario del
   vero costa più di una nota che manca.*

   ⚠️ **La cura vera è `and p.prokind = 'f'`** dentro quelle query. Ma
   stanno in migrazioni **già applicate**, che non si riscrivono, e una
   migrazione nuova non può sanarle perché arriverebbe dopo il punto in cui
   la ricostruzione si ferma. Finché resta così, chi ricostruisce deve
   saperlo prima.

   ⚠️ **E `scripts/prova-ricostruisci.mjs` fa ancora l'`analyze` una volta
   sola all'inizio**: su una ricostruzione completa si fermerebbe allo
   stesso punto. Da correggere quando si tocca quel comando.

0-zero. ✅ **CHIUSO IL 25/08 SERA** — le tre migrazioni che non reggevano
   una ricostruzione da zero sono state rimesse a posto dalla
   `20260825000012`, che **rifà i loro tre controlli con roba creata da
   lei** e poi registra le tre versioni. I file non sono stati toccati.
   Cosa presumeva ognuna: la `20260822000003` una **ricetta** qualsiasi; la
   `20260823000024` che restassero **ricette, tavoli e impegni** dopo una
   pulizia che su un database vuoto non aveva niente da pulire; la
   `20260824000033` una **previsione non congelata con una linea**.
   ⚠️ Il caso (B) ora **distingue** «non c'è niente da controllare» da «il
   controllo è fallito», che era il punto. Il testo qui sotto resta come
   origine della decisione.

0-zero-storico. 🔴 **TRE MIGRAZIONI NON REGGONO UNA RICOSTRUZIONE DA ZERO, e la cura
   dell'«array_agg» scritta il 23/08 NON FUNZIONA** — misurato il 25/08 con
   `npm run ricostruzione:verifica`, il comando nato in quel giro.

   ✅ **La buona notizia, che è anche la risposta al mandato**: applicando
   tutte le migrazioni **in ordine di numero** su un database vuoto, lo
   schema che ne esce è **identico** a quello del progetto di prova — 2701
   elementi di forma da una parte e 2701 dall'altra, e nessuno che stia da
   una parte sola. I quattro casi in cui una migrazione è stata applicata
   fuori ordine **non hanno lasciato danni allo schema**.

   🔴 **Ma tre migrazioni si fermano**, e tutte e tre nel blocco di
   *verifica* — cioè dopo aver fatto il loro lavoro, il che è il motivo per
   cui lo schema torna lo stesso. Tutte e tre per la stessa ragione: la
   verifica **presume dei dati che su un database ricostruito non ci sono**.
   - `20260822000003` — cerca una ricetta qualsiasi, non ne trova nessuna, e
     scrive una riga d'ordine senza piatto: il vincolo la respinge.
   - `20260823000024` — la sua guardia dice «sono sparite le ricette: la
     pulizia è andata troppo in là», e ha ragione: non ce n'era nessuna.
   - `20260824000033` — «nessuna previsione libera». Era **già noto** e già
     scritto: va saltata anche in produzione.

   ⚠️ **Non si riscrivono quei tre file** (regola del 23/08). E una
   migrazione nuova non può sanarli, perché arriverebbe *dopo* il punto in
   cui la ricostruzione si ferma. La cura vive nello strumento, oppure —
   il giorno che serva davvero — si saltano dichiarandolo.

   🔴 **E LA CURA SCRITTA IL 23/08 PER «array_agg is an aggregate function»
   È FALSA**, misurato sul database ricostruito con 247 funzioni:
   | cosa | esito |
   |---|---|
   | così com'è | si ferma |
   | dopo `analyze` | **si ferma lo stesso** |
   | dopo `vacuum analyze` | **si ferma lo stesso** |
   | con `enable_seqscan = off` | passa |
   | con `and p.prokind = 'f'` nella query | passa |

   La nota di allora («si rilancia dopo un `analyze`») descriveva *quello che
   era bastato quel giorno*, non una cura — e col catalogo pieno non basta
   più. ⚠️ **Riguarda 33 file**, non uno. `scripts/prova-ricostruisci.mjs`
   fa ancora l'`analyze` una volta sola all'inizio: **su una ricostruzione
   completa si fermerebbe allo stesso punto.** Da correggere quando si tocca
   quel comando.

   ⚠️ **E `pg_cron` non si può creare** fuori dal database `postgres`: su
   una ricostruzione fuori da Supabase quella riga va neutralizzata, e i
   lavori pianificati **non risultano programmati**. Non è un difetto del
   repository, è un limite del posto — ma chi ricarica deve saperlo prima.

0-ter. ✅ **CHIUSO IL 23/08** — [scende quello che si puo'](consegne/20260823_scende_quello_che_si_puo.md),
   migrazione `20260823000002`, solo sul progetto di prova. **Misurato dopo:
   346 conti su 346 scaricano** (erano 198), **zero** anomalie di guasto
   (erano 148), food cost sul cibo **22,9%**. Le due domande per Alessio
   hanno avuto risposta nel mandato del 23/08: *scende quello che si puo'*
   (rovesciamento n. 33) e *le spezie a pizzico escono dal magazzino*
   (blocco 2). Il testo qui sotto resta come origine della decisione.

0-ter-bis. 🔴 **UN PIZZICO DI CANNELLA FERMA LO SCARICO DI TUTTO IL TAVOLO** —
   misurato la notte del 23/08, **non corretto per decisione di Alessio**
   («è un difetto del gestionale, e serio: scrivilo in un referto e
   lascialo lì per domani»).
   Referto: [`referti/20260823_un_pizzico_di_cannella.md`](referti/20260823_un_pizzico_di_cannella.md).

   **Quanto è grosso**: a scala vera, **149 conti chiusi su 346 — il 43% —
   non fanno scendere il magazzino di un grammo**. Un ingrediente che vale
   trentasette milligrammi (la cannella che tocca a 18 g di frolla) non è
   rappresentabile in una colonna a quattro decimali, il vincolo
   `quantity > 0` respinge la riga, e il rifiuto si porta via **tutto** lo
   scarico del conto: il pesce, la carne, il costo della cena.

   ⚠️ **E rende illeggibile il numero più importante del collaudo**: il food
   cost calcolato su tutti i conti è **9,3%**, quello sui conti che hanno
   scaricato è **22,6%**. Il primo è assurdo, il secondo è normale.

   **La cura è scritta nel referto e non applicata.** Restano **due domande
   per Alessio**, e sono decisioni di prodotto:
   1. se il magazzino non scende per un tavolo, vuoi che **non scenda
      niente** e resti da rifare, o che **scenda quello che si può** e ti
      venga detto cosa manca? (oggi è la prima, ma *nessuna schermata offre
      di riprovare* — misurato);
   2. **le spezie a pizzico le vuoi in magazzino?** Se sì, la strada è
      portare le quantità al milligrammo su tutta la catena.

0-quater. ✅ **CHIUSO IL 23/08** — [le spezie e il vino](consegne/20260823_le_spezie_e_il_vino.md),
   migrazioni `20260823000003`, `…04` e `…05`, solo sul progetto di prova.
   Alessio ha deciso di sì: le bevande escono dall'elenco. **Misurato dopo:
   da 1.843 righe a 3**, e sotto quelle mille righe era nascosto un difetto
   di due settimane — le anomalie delle **produzioni** comparivano come se
   fossero conti. Anche le **spezie a pizzico** sono uscite dal magazzino
   (rovesciamento n. 34). Il testo qui sotto resta come origine della
   decisione.

0-quater-bis. 🔵 **UN BICCHIERE DI VINO NON È UNA VOCE LIBERA SCONOSCIUTA** —
   trovato costruendo lo scenario a scala vera, **domanda per Alessio**.

   Ogni bevanda entra in comanda come **testo** — è quello che fa la sala,
   che scrive «Grillo · calice» — e una riga senza ricetta il
   magazzino non la sa scaricare. Risultato misurato su due mesi veri:
   **1.031 righe** in *Magazzino → «Cosa non è sceso dal magazzino»*, tutte
   «voce libera», tutte bevande.

   ⚠️ **Non è un difetto dello scenario: è come si comporta il gestionale**,
   e con una sola bevanda in due mesi non si poteva vedere. Ma un elenco di
   mille righe che dicono tutte la stessa cosa **è un guardiano che grida
   sempre**, e quelli si imparano a spegnere — insieme alle righe che invece
   contano (le ricette incomplete, le giacenze che non bastavano).

   La domanda: un vino è una riga del **listino bevande**, non una voce
   sconosciuta scritta a mano. Vuoi che smetta di comparire lì?

0-sei. 🔵 **GLI INCASSI GIORNO PER GIORNO, E LE RIGHE CHE NON SI DISTINGUONO**
   — due cose viste da Alessio nel collaudo del 23/08, misurate e **non
   costruite**. Referto: [gli incassi del giorno](referti/20260823_gli_incassi_del_giorno.md).

   **L'elenco degli incassi giorno per giorno NON ESISTE da nessuna parte**:
   la quadratura fiscale da' un totale del periodo, l'Andamento e' per mese,
   la prima nota non contiene gli incassi di sala per scelta (04/08). Fra il
   mese e il singolo conto non c'e' niente. ⚠️ **I dati ci sono gia' tutti** —
   costruito l'elenco per prova: 25 serate a giugno, e il 02/06 mostra da
   solo perche' serve (338,00 incassati contro 189,50 scontrinati).
   **Dove**: in «Incassato e scontrinato», per tre ragioni misurate — e' la
   scomposizione di un numero che quella schermata gia' mostra, conta gia' a
   SERATE (verificato sul corpo vivo), e la Cassa e' dove stanno i soldi, non
   quanto si e' venduto (decisione del 15/08 su chi comanda sui ricavi).

   **Le righe «Gia' segnati»**: la schermata legge sei campi e ne mostra tre.
   Il gestionale sa gia' **l'importo** (dalla stessa funzione del preconto,
   su tutti i conti) e
   **il cliente** (dal legame del 18/08, su 176 conti su 329). Contato:
   con quello che si vede oggi restano **15 gruppi di righe indistinguibili**,
   aggiungendo l'importo scendono a **1**. ⚠️ E quell'uno sono due conti
   chiusi allo stesso minuto per lo stesso importo: li distingue solo il nome
   del cliente. ⚠️ Sarebbe anche il **primo posto** dove il legame
   conto-prenotazione diventa visibile — scritto dal 18/08 e mai mostrato.

0-cinque. 🔵 **L'AVVISO SUL PRODOTTO FERMO, E LE ETICHETTE** — misurati il
   23/08 e **non costruiti**, come chiedeva il mandato.
   Referto: [il prodotto fermo e le etichette](referti/20260823_il_prodotto_fermo_e_le_etichette.md).

   **Il prodotto fermo**: cottura e abbattimento **non esistono** (le tabelle
   HACCP sono sette e nessuna li registra), e soprattutto lo scarico
   **non ha nessun legame col lotto** — lo scarico e' per ingrediente. E' il
   pezzo che decide se il lavoro e' **un giorno** (l'avviso guarda
   l'ingrediente: i dati ci sono tutti) o **una settimana** (guarda il lotto:
   serve il legame, e va messo prima che si accumulino altri due mesi di
   scarichi senza).
   ⚠️ **E oggi l'avviso sarebbe quasi muto per la ragione sbagliata**: solo
   **4 prodotti su 127** hanno una durata dichiarata. Non si costruisce prima
   che le durate siano compilate — e' la forma del difetto del 13/08, tutto
   acceso e muto.
   🔵 **Domanda aperta**: un prodotto aperto e usato a meta' conta come mosso
   per sempre, o l'orologio riparte a ogni movimento?

   **Le etichette**: delle sei voci che ci vanno sopra, due ci sono per
   intero (nome, data di produzione), la scadenza c'e' ma il campo e'
   facoltativo, il lotto e' un identificativo da 36 caratteri, «chi l'ha
   preparata» dice sempre lo stesso nome (accesso condiviso), e la
   **conservazione manca su 123 prodotti su 127**.
   🔴 **E la scelta dell'apparecchio decide il disegno**: con una
   etichettatrice **a USB** stampa solo il computer a cui e' attaccata —
   quindi «chi prepara» dovrebbe andare al computer, cioe' esattamente il
   passaggio che il gestionale toglie ovunque. **Da chiedere al fornitore
   PRIMA di comprare**: *«si collega alla rete e accetta un lavoro di stampa
   da un indirizzo IP senza driver su un computer? Con quale linguaggio?»*

0-bis. 🔴 **IL CENSIMENTO DI QUELLO CHE STA FUORI DALLE SCHERMATE** — deciso
   da Alessio il 22/08/2026, **da fare appena la sessione parallela chiude**.

   **Cosa**: misurare, con lo stesso criterio del censimento del 22/08
   (testo ≥ 3,20 mm, bersagli ≥ 8,50 mm, gesti pericolosi distanti ≥ 5 mm),
   tutto ciò che **non appartiene a nessuna schermata**: la barra in alto,
   il menu laterale, gli avvisi che compaiono sopra qualunque pagina
   (`AvvisoLettureTagliate`, `DatoNonLetto`), il segno del database
   (`SegnaleDatabase`), le finestre condivise.

   🔴 **PERCHÉ ESISTE QUESTA VOCE, e la frase va tenuta com'è**:

   > **Un difetto che sta dappertutto non compare in un elenco fatto per
   > posti.**

   Il censimento del 22/08 ha aperto **67 schermate una per una** e ha
   guardato dentro `<main>` — cioè *la schermata*. Il pulsante «Apri menu»
   (**5,14 × 5,14 mm**) e le 17 voci della barra (**5,07 mm**, testo 1,89)
   stavano **fuori**, e quindi non sono comparsi in nessuna delle 67 righe:
   non erano in nessuna schermata, ed erano in tutte. Li ha visti una
   sessione parallela, e Alessio il pulsante l'aveva notato in due secondi.

   ⚠️ **La forma vale oltre le misure**: ogni volta che si costruisce un
   elenco «per posto» — schermate, tabelle, moduli, migrazioni — quello che
   vive *fra* i posti non ci finisce dentro. Vale per gli avvisi condivisi,
   per i componenti riusati, e per qualunque regola che il codice applica
   in un punto solo e mostra in cinquanta.

   **Già fatti** (22/08, commit `8dfd653`): il pulsante del menu e le 17
   voci della barra, tutti a 8,50 mm con testo 3,20. **Il resto è da
   censire**, e il censimento viene prima di qualunque correzione.
0. 🔴 **I FINGER FOOD E LO STORICO DEI COSTI — mandato del 19/08, e viene
   PRIMA di tutto il resto**:
   [`mandati/20260819_i_finger_food_e_lo_storico_dei_costi.md`](mandati/20260819_i_finger_food_e_lo_storico_dei_costi.md).
   ⚠️ **La ragione della priorità non è l'importanza, è il costo del ritardo**:
   il Ricettario è **vuoto** (0 ricette, 0 piatti in menu, misurato), questo
   lavoro ne cambia la forma, e le ricette le inserirà Alessio **a mano, a
   decine**. Farlo dopo significa fargliele rifare.
   ✅ **BLOCCO 1 FATTO il 19/08** — [consegna](consegne/20260819_i_finger_si_compongono.md),
   migrazione `20260819000012`: i finger sono un tipo a sé, entrano nelle
   selezioni, non si ripetono, e un piatto finito resta fuori.
   🔄 **BLOCCO 2 A METÀ il 19/08** — [consegna](consegne/20260819_il_prezzo_al_pezzo.md),
   migrazione `20260819000013`: il **prezzo a pezzo** sta sulla ricetta del
   finger, un piatto finito non lo accetta, e vuoto vuol dire «non l'ho ancora
   deciso».
   ✅ **BLOCCO 2 CHIUSO il 20/08** — [consegna](consegne/20260820_la_selezione_si_compone_in_un_tocco.md),
   migrazione `20260820000001`, corridoio **v14 sulla prova**. Le tre scelte
   sulla schermata le ha fatte **Alessio**, perché è quella su cui passerà ore
   inserendo decine di ricette: **un tocco per bocconcino** (la quantità non si
   chiede), **la spunta salva e il costo si rilegge dal gestionale** (l'unica
   strada che non calcola lo stesso numero in due posti), e **«Fai una copia»**
   per farne una variante. ⚠️ **Nessuna mano ha toccato una spunta**: in questo
   progetto nessuna prova guarda una schermata, ed è il limite che qui pesa di
   più.
   ✅ **APPLICATO IN PRODUZIONE il 20/08** — [consegna](consegne/20260820_applicato_e_le_due_verifiche.md):
   **151 migrazioni**, corridoio **v30**, e nessun numero del locale mosso (26
   tracce, 0 movimenti, 8 conti di cui 0 aperti, tutte le reti ferme).
   🔴 **Le due verifiche hanno trovato un difetto silenzioso**: nell'elenco
   delle ricette un bocconcino era **indistinguibile da un piatto** e mostrava
   «1 porzione» invece della sua resa. Corretto passando da `eComponente()`,
   così un tipo nuovo domani entra da solo.
   🟡 **E una decisione da prendere, dichiarata e non presa**: gli elenchi del
   menu offrono **tutte** le ricette, preparazioni comprese — da sempre, non
   per colpa dei finger. Filtrare i bocconcini vorrebbe dire **rispondere di
   nascosto** alla domanda lasciata aperta («un bocconcino può andare in carta
   da solo?», che se accade dà due prezzi per la stessa cosa); filtrare le
   preparazioni è una decisione ancora diversa (una conserva in vasetto è un
   caso vero). ✅ **Deciso la sera del 20/08 e chiuso**: negli elenchi restano
   **solo i piatti pronti per la carta** — via preparazioni e bocconcini
   ([lavoro](consegne/20260820_in_menu_solo_i_piatti.md),
   [applicazione](consegne/20260820_applicato_in_menu_solo_i_piatti.md),
   migrazione `20260820000002`, **152 in produzione**). ⚠️ Il criterio chiede
   una **proprietà**, non elenca i tipi: un tipo nuovo domani non ricompare lì
   da sé.
   ✅ **E il caso dei due prezzi non si presenterà** (rovesciamento n. 19):
   *«semmai un bocconcino dovesse diventare un piatto a sé, creerò una ricetta
   nuova con un nome diverso»*.
   ✅ **BLOCCO 3 CHIUSO il 20/08 — IL MANDATO È COMPLETO** su tutti e tre i
   blocchi: [consegna](consegne/20260820_lo_storico_dei_costi.md), migrazione
   `20260820000003`, **non ancora in produzione**.
   ✅ **La misura della condizione (b), fatta prima di scegliere**: su un
   albero di **76 ricette** con la profondità che Alessio descrive, una
   fattura da venti righe fa cambiare il costo a **51 ricette** (233 se si
   contano le coppie ricetta-ingrediente). **Niente migliaia di righe**: il
   ventaglio è limitato dal numero di ricette, non dal prodotto. Il disegno
   non cambia.
   🔴 **Le strade sono SEI, non quattro**: oltre a prezzo, composizione,
   quantità e scarto ci sono **la resa** di una preparazione e **le porzioni**.
   Coprendone quattro il registro avrebbe avuto due buchi silenziosi.
   🔴 **Un difetto trovato applicando**: dentro una transazione `now()` non
   avanza, quindi «l'ultima voce» sarebbe stata scelta a caso fra quelle di
   una stessa fattura. Curato con un progressivo. ⚠️ Era **già scritto** in
   CLAUDE.md §8 dal 16/08: *una trappola scritta non è una trappola chiusa*.
   ⚠️ **Zero non vuol dire gratis, e resta una decisione di Alessio**:
   `ingredients.current_price` è `not null default 0`, quindi un ingrediente
   mai comprato abbassa in silenzio il food cost. Il registro lo **dichiara**
   («parziale: N ingredienti senza prezzo»), il resto del gestionale no.
   Misurato: **0 su 8** oggi — armato, non vivo.
   ✅ **APPLICATO IN PRODUZIONE il 20/08** — [consegna](consegne/20260820_applicato_lo_storico_dei_costi.md):
   **153 migrazioni**, e nessun numero del locale mosso. ⚠️ In produzione il
   Ricettario è vuoto, quindi applicare **non ha scritto nemmeno una voce**:
   «tutto invariato» lì è vero e non dimostra niente. Verificato su tre
   livelli — il **catalogo** dice dove sono attaccate le registrazioni (e le
   colonne sorvegliate: `current_price`; tutte su `recipe_ingredients`;
   `portions_yield` **e** `yield_quantity`), le **sei strade** risultano
   collegate ognuna alla sua funzione, e il **blocco di verifica le ha
   esercitate sui dati veri**. 🔴 Il primo controllo sul catalogo era
   sbagliato — leggevo il bit «per riga» come «AFTER» — e rifatto sul bit
   giusto dice AFTER su tutti e tre.
   ⚠️ **Il mandato dei finger food è ora in produzione per intero.**
   ✅ **La misura è già fatta e sta nel mandato**: la struttura esistente
   copre food cost, scarico di magazzino («due porzioni, due pezzi per tipo»:
   misurato, 0,040 kg) e comanda a riga sola. **Non serve una tabella nuova**.
   Mancano tre cose: il rifiuto di comporre un piatto con un altro piatto, il
   prezzo a pezzo, e lo storico dei costi.
1. **La colonna «arrivati N di M» sulla lista della spesa** — comportamento già
   deciso, resta da fare.
2. **La lista della spesa** — mandato
   [`20260817_la_lista_non_scrive_uscite.md`](mandati/20260817_la_lista_non_scrive_uscite.md).
3. **Il controllo che guarda la forma invece del comportamento**: funzioni
   riscritte mai chiamate da una verifica, i 33 posti dove un campo dimenticato
   sbaglia in silenzio, il prezzo dentro `tipo_allarme_rincaro`, lo scorporo
   del vincolo composito `dining_tables_sagoma_check` nei suoi tre vocabolari,
   il ternario di `SalaEOrari`, i conteggi scritti negli appunti che nessuna
   verifica controlla.
   ⚠️ **Una voce aggiunta il 19/08 (sera)**, trovata usandola:
   `migrazioni-senza-portieri` guarda **se** i claims compaiono, non
   **quando** — e ogni verifica finisce con un `set_config(…, null, …)` per
   ripulirsi, che da solo basta a zittire il guardiano. Una migrazione che
   chiamasse una funzione col portiere *prima* di impostare i claims
   passerebbe. *(La seconda voce di quella coppia — la rete che cercava la
   parola `is_titolare()` invece del gesto — è stata **chiusa lo stesso
   giorno** con `20260819000007`: cercando il gesto sono comparse due
   funzioni che c'erano già e non si vedevano, e `promuovi_disposizione`,
   che scrive `not (select is_titolare())`, ha smesso di essere invisibile a
   tutte e due le reti.)*
4. **Il n. 12 del collaudo: la serata sulla Dashboard**
   ([annotazioni del collaudo](collaudo/annotazioni.md)).
5. **La regola delle 5 del mattino su cassa e conti** — ✅ **misurata e
   fatta il 19/08**: censimento in
   [`referti/20260819_censimento_giornata_operativa.md`](referti/20260819_censimento_giornata_operativa.md),
   consegna in
   [`consegne/20260819_la_giornata_operativa.md`](consegne/20260819_la_giornata_operativa.md).
   Il perimetro l'ha deciso Alessio: seguono la serata **due gesti soli** —
   il conto incassato dopo mezzanotte e il conteggio del cassetto; tutto il
   resto segue il calendario.
   ✅ **E la seconda metà è chiusa il 19/08 (sera)**:
   [`consegne/20260819_la_giornata_proposta.md`](consegne/20260819_la_giornata_proposta.md).
   Le schermate della cassa e dei conti propongono la serata e **la
   mostrano**; le altre restano sul calendario, e adesso è **scritto dove**
   (in `constants.js`, accanto a `oggiLocale()`), perché il prossimo che
   passa non le «uniformi» credendo di sistemare una dimenticanza. In
   Comande la sala **continua a non cambiare da sola** — decisione di
   Alessio — ma alle 5 compare una riga che lo dice, e il passaggio lo
   decide chi ha il tablet in mano.
   ⚠️ **Cosa resta aperto qui**: nessuna prova automatica guarda una
   schermata (in questo progetto non c'è un ambiente DOM), quindi che
   l'avviso di Comande **si veda** non l'ha verificato nessuno.
   ✅ **E la domanda sul predefinito ha avuto risposta la sera stessa**: non
   si allinea, **si toglie** — insieme agli altri sette (rovesciamento n. 18,
   [consegna](consegne/20260819_niente_date_riempite_da_sole.md)). Un
   predefinito allineato sarebbe stato *meno sbagliato*, non giusto.
6. **Finire la serata recitata**: restano comande, storni, conto diviso,
   omaggio, chiusura, conteggio del cassetto.
7. **Quante altre schermate fanno più letture insieme e disegnano lo stesso se
   una fallisce** — Magazzino, Cassa e Proiezione ne fanno tutte più d'una.
   ⚠️ Alessio ha deciso il 19/08 di **NON misurarle ora**. La voce resta aperta
   e **non è stata chiusa da una misura**: nessuno sa quanto è grande.
8. *(minore)* **In Comande `handleSend` fa `withBusy(...).then(loadBoard)` senza
   `catch`**: se l'invio riesce ma la rilettura fallisce, nessun avviso e resta
   a schermo la situazione di prima. Stessa famiglia della sala disegnata
   vuota, molto meno grave.
9. 🔴 **IL REGISTRATORE TELEMATICO — mandato del 20/08**, deciso da Alessio la
   sera del 20/08: [`mandati/20260820_il_registratore_telematico.md`](mandati/20260820_il_registratore_telematico.md).
   **Da fare quando tocca**, non è il prossimo lavoro.
   ⚠️ **Metà esiste già ed è misurata**: `orders.documento_fiscale`,
   `documento_numero`, `documento_emesso_il`, `conti_da_fiscalizzare()` e
   `quadratura_fiscale()` sono in produzione. **Mancano tre cose**: il
   simulatore, l'avviso che si fa notare a fine giornata, e la segnalazione
   manuale di sala.
   🔴 **Il pezzo che vale è il simulatore che SI RIFIUTA DI STAMPARE**: il caso
   che fa male non è quello in cui i totali coincidono, è il conto chiuso e lo
   scontrino non uscito — l'incasso c'è, fiscalmente non esiste, e il cliente è
   già fuori. ⚠️ E il buco che nessun protocollo copre: la stampante che
   risponde «fatto» e stampa **una pagina bianca**.
   ⚠️ **Il blocco 1 non ha bisogno di nessun hardware** ed è utile dal primo
   giorno: se una fattura resta da emettere, quell'elenco deve parlare da sé.
   ✅ **BLOCCO 1 FATTO il 20/08** — [consegna](consegne/20260820_l_elenco_che_si_fa_notare.md),
   migrazione `20260820000004`, corridoio **v15 sulla prova**, **non ancora in
   produzione**. La chiusura della giornata **si rifiuta** se restano conti
   incassati senza documento, si può chiudere prendendone atto e **il permesso
   resta scritto**; la sala segnala da `/comande/scontrini`; lo scarto fra le
   due giornate si dichiara.
   🔴 **Un difetto trovato misurando**: la data del documento si scriveva solo
   sulle fatture, quindi lo scarto **non era nemmeno rappresentabile**.
   ⚠️ **Restano i blocchi 2 (il simulatore), 3 (la ristampa) e 4 (l'apparecchio
   vero)**. Il punto di contatto col registratore è preparato in un posto solo
   (`src/lib/registratore.js`) — ma **non è mai stato sostituito da niente**,
   quindi che sia sostituibile è un'affermazione, non una misura.
   ✅ **APPLICATO IN PRODUZIONE il 20/08** — [consegna](consegne/20260820_applicato_l_elenco_che_si_fa_notare.md):
   **154 migrazioni**, corridoio **v31**, nessun numero del locale mosso.
   🔴 **E LA RETE È GIÀ ARMATA**: misurato subito dopo, **un conto** la farebbe
   scattare oggi — «Divano 3» del 15/08, incassato e senza documento. Alla
   prima chiusura di cassa Alessio verrà fermato. **Non l'ho sistemato io**:
   è un dato vero e la scelta fra segnarlo scontrinato o prenderne atto è sua.
10. 🔴 **I PREVENTIVI PER GLI EVENTI — mandato del 20/08**:
    [`mandati/20260820_i_preventivi_per_gli_eventi.md`](mandati/20260820_i_preventivi_per_gli_eventi.md).
    Deciso da Alessio in due giri di domande il 19 e il 20/08. Usa il **prezzo
    a pezzo dei bocconcini**, già in produzione.
    ⚠️ **Un preventivo è il posto dove Alessio promette un prezzo PRIMA di
    conoscere il costo**: è l'unico punto del gestionale dove questo succede,
    ed è da lì che discendono quasi tutte le sue decisioni.
    🔴 **La misura ha trovato un difetto VIVO**: `computeEventIngredientNeeds`
    stima il fabbisogno di un evento **nel browser**, guarda solo gli
    ingredienti diretti e ignora lo scarto. Su un menu che contenga una
    preparazione — cioè quasi ogni menu vero, perché Alessio *«scompone
    sempre»* — **non dà un numero sbagliato: si rompe**. Per questo il
    **blocco 0 è la riparazione**, e quella funzione **si toglie** invece di
    restare accanto.
    🔴 **Il cuore è la schermata che commuta** fra «il costo per me» e «il
    prezzo per il cliente», una sola schermata, **col passaggio protetto**:
    un tocco sbagliato davanti a un ospite gli mostra il food cost.
    ⚠️ **E la trappola da scrivere dove si legge**: il ricarico si applica al
    **solo cibo**, quindi un preventivo può risultare in linea sul cibo e in
    perdita sulla serata.
    ✅ **BLOCCO 0 FATTO il 20/08** — [consegna](consegne/20260820_il_fabbisogno_di_un_evento.md),
    migrazione `20260820000005`, **non ancora in produzione**. La prova è stata
    scritta **prima** e vista diventare rossa con l'errore vero
    (*«Cannot read properties of null»*, 3 su 3), poi la riparazione l'ha resa
    verde. Il calcolo non si fa più nel browser: `fabbisogno_menu_evento`
    **riusa `fabbisogno_preparazione`** — nessuna ricorsione nuova, quindi il
    fabbisogno di un evento e lo scarico vero del magazzino **si comportano
    identicamente**. ⚠️ `listRecipeIngredientsForRecipes` è rimasta senza
    chiamanti, ed è dichiarato nel file.
    ✅ **BLOCCO 1 FATTO il 20/08** — [consegna](consegne/20260820_il_preventivo_esiste.md),
    migrazione `20260820000006`, corridoio **v16 sulla prova**, **non ancora in
    produzione**. Il preventivo esiste: testata, righe di due nature che non si
    mescolano, **porzioni modificate sul preventivo** (la ricetta in carta
    resta intatta), prezzo a persona proposto dal ricarico e **scavalcabile**,
    **versioni collegate**.
    🔴 **Due numeri tenuti separati fin dall'inizio**: il prezzo promesso, che
    non cambia più, e il costo **fotografato con la sua data**, che invecchia.
    ✅ **Il valore l'ha deciso Alessio: food cost al 25%**, cioè 10 € di cibo
    si propongono a 40 € a persona — il costo per QUATTRO.
    🔴 **E la domanda è servita**: lui l'aveva detto come «400%» intendendo
    questo, e con una colonna scritta come «ricarico» 400 avrebbe dato **50 €**.
    Quindi non è stato scritto un commento accanto al numero: **l'ambiguità è
    stata tolta**. La colonna si chiama food_cost_obiettivo_percento, la
    formula è una divisione, e l'avvertenza dice **il risultato** («10,00 € di
    cibo diventano 40,00 €») invece della sola percentuale.
    🔴 **La rete dei permessi è diventata rossa da sola** (16 → 17): una
    funzione nuova aveva il portiere in un'altra funzione invece che nel
    proprio corpo. Porta chiusa, conto tornato a 16.
    ✅ **APPLICATO IN PRODUZIONE il 20/08**: **156 migrazioni**, corridoio
    **v32**, food cost obiettivo **25** scritto, e tutto il resto invariato
    (0 ricette, 26 tracce, 0 movimenti, 8 conti di cui 0 aperti, 0 preventivi).
    ✅ **BLOCCO 2 FATTO il 20/08** — [consegna](consegne/20260820_la_schermata_che_commuta.md),
    **nessuna migrazione**: al database non serviva niente. Le schermate sono
    `/calendario-eventi/preventivi` e `…/:id`, titolare-only. Una sola
    schermata, due viste: quella del cliente **non mostra nessun costo, nessuna
    percentuale e nemmeno la parola food cost**, e se il prezzo non c'è lo dice
    invece di scrivere zero.
    ✅ **DECISO da Alessio: nessuna protezione** sul passaggio fra le due
    viste — *«mi sembra un eccesso di prudenza»*. Via la conferma. ⚠️ Restano
    due cose che **non sono protezioni**, sono il modo in cui il comando è
    fatto: è **neutro a schermo** («Per il cliente» / «Per me», che dicono
    quale vista è attiva e non cosa contiene l'altra, perché quel comando si
    legge anche senza toccarlo), e la **vista del cliente è quella di
    partenza, sempre** — se la schermata ricordasse l'ultima vista usata, un
    preventivo riaperto davanti a un ospite si aprirebbe sui costi.
    ⚠️ **Un difetto riscritto da me e corretto subito**: creando un preventivo
    nuovo avevo rimesso `new Date().toISOString()`, la data UTC che fra
    mezzanotte e le due dà **ieri**. È la trappola dell'audit dell'08/08,
    riaperta in un posto nuovo.
    ✅ **BLOCCO 3 FATTO il 20/08** — [consegna](consegne/20260820_il_foglio_del_preventivo.md),
    migrazione `20260820000007`, **non ancora in produzione**. Tre gesti
    separati — prepara il foglio, apri su WhatsApp, manda la mail — e **solo
    la mail è irreversibile**, quindi solo lei chiede conferma.
    🔴 **Una misura ha cambiato due promesse del mandato**: in questo progetto
    **non esiste nessuna libreria PDF** — il PDF è la stampa del browser,
    quindi il gestionale non ha mai un file fra le mani. La mail manda il
    preventivo **scritto nel messaggio**, WhatsApp apre il testo, e l'allegato
    lo mette Alessio. *Costruire qualcosa che allega un file inesistente
    sarebbe stato il difetto peggiore: un allegato che non arriva non produce
    nessun errore.*
    🔴 **Il foglio si rifiuta se manca la scadenza**, e **nel foglio non c'è
    nessun costo** — garantito dal database, non dalle schermate, perché il
    foglio viaggia. La vista dei costi è `print:hidden`.
    ✅ **DECISO: TRENTA GIORNI**, come valore proposto e modificabile su ogni
    preventivo ([consegna](consegne/20260820_la_validita_di_trenta_giorni.md),
    migrazione `20260820000008`, non ancora in produzione).
    🔴 **E costruendolo è saltata fuori una cosa che non era vera**: la
    scadenza c'era nella mail e su WhatsApp ma **non nella vista che si
    stampa** — cioè proprio sul foglio che il cliente si porta via. Il pezzo
    che viaggia di più era l'unico senza. Corretto.
    ⚠️ **E correggere un preventivo non riporta avanti la scadenza** che
    Alessio aveva accorciato a mano: è la più insidiosa delle tre cure, perché
    nessuno se ne sarebbe accorto.
    ✅ **APPLICATO IN PRODUZIONE il blocco 3**: **157 migrazioni**, funzione
    online `email-cliente` **v4**, tutto il resto invariato.
    ✅ **APPLICATA ANCHE `20260820000008`** (i trenta giorni) il 20/08:
    **158 migrazioni**, validità proposta **30 giorni**, 0 preventivi,
    0 movimenti, **26** tracce nel registro cancellazioni — invariate.
    ✅ **BLOCCO 4 FATTO il 20/08** — [consegna](consegne/20260820_l_evento_accettato.md),
    migrazione `20260820000009`, **non ancora in produzione**. È Alessio a dire
    «accettato»: da lì nasce l'evento in calendario, il preventivo si collega, e
    la spunta «sala piena» si accende **se la capienza è esaurita**.
    🔴 **La regola è una proprietà, non un elenco di casi**: quante persone sono
    attese contro quanti posti ha la sala quel giorno. L'evento entra in
    calendario *prima* che il conto si faccia, quindi nel conto è una
    prenotazione come le altre — **nessun ramo «se è un evento»**. Il caso che
    lo dimostra è **C** (30 persone con 8 già prenotate su 34): senza di lui,
    «guardo solo l'evento» sarebbe passata verde.
    🔴 **`giornate_sold_out` ha imparato DA DOVE VIENE la spunta**, e non era
    nel mandato: vuota vuol dire «l'ha messa Alessio a mano», e in quel caso
    nessun annullamento la spegne. *Senza quella colonna, annullare un evento
    avrebbe spento anche una decisione sua, in silenzio.*
    ⚠️ **Annullare fa due cose**: la spunta si spegne **e** parte l'avviso, con
    una faccia sua (categoria `evento`, «📆 EVENTO ANNULLATO») — non sotto il
    triangolo dei guasti, perché chi legge deve decidere se rimettere in vendita
    quella sera, non chiamare aiuto.
    🔴 **Una versione nuova NON crea un secondo evento**: riusa la prenotazione
    dell'antenato risalendo la catena. Tolto il collegamento, **due prove
    diventano rosse** (la verifica della migrazione e quella sui dati veri) —
    la rottura chiesta dal mandato, fatta e rimessa a posto.
    ✅ **DECISO DA ALESSIO: un preventivo scaduto si accetta lo stesso, e il
    gestionale lo dice.** La scadenza serve a rinegoziare, non a impedire.
    ⚠️ **Nessuna colonna nuova per «era scaduto»**: è `accettato_il >
    valido_fino_al`, cioè un riflesso.
    🔴 **Una misura ha aggiunto lavoro fuori mandato**: senza l'ora l'evento non
    si può accettare (il calendario non ammette orari vuoti) — e misurando,
    **`ora_evento` non era scrivibile da nessuna schermata**. Il rifiuto sarebbe
    stato un vicolo cieco. Campo aggiunto.
    ⚠️ **L'elenco delle funzioni senza portiere passa da 16 a 17**:
    `trattative_del_giorno` è aperta a tutto lo staff **apposta** — in sala si
    prende una prenotazione, ed è lì che si rischia di promettere un tavolo per
    una sera in trattativa. Restituisce quante persone e in che stato; **il nome
    del cliente solo al titolare**.
    **Resta il blocco 5**: la sera dell'evento il magazzino deve scaricare le
    porzioni **modificate**, non quelle della carta.

---

11. 🔄 **LA POSTA DEI CLIENTI — mandato del 20/08, TRE BLOCCHI SU QUATTRO
    FATTI la sera del 20/08** ([consegna](consegne/20260820_il_consenso_prima_di_tutto.md),
    migrazione `20260820000011`, **non applicata**):
    [`mandati/20260820_la_posta_dei_clienti.md`](mandati/20260820_la_posta_dei_clienti.md).
    Scritto mentre le decisioni erano fresche. Tre cose: **mandare** ai clienti
    quello che il gestionale già produce, **leggere** le mail che arrivano da
    loro, **conservare la storia** sulla scheda del cliente.
    ⚠️ **Metà esiste già** (la Posta in arrivo, la funzione che manda le mail,
    la scheda cliente): la domanda non è «come si legge una casella», è **cosa
    cambia quando chi scrive è un cliente**.
    🔴 **Il consenso si costruisce COL modulo, non dopo**, e la distinzione che
    regge tutto è che confermare un tavolo non ha bisogno di niente mentre
    mandare il menu del mese a duecento persone sì — **due funzioni separate**,
    o prima o poi una comunicazione commerciale esce dalla porta di servizio.
    🔴 **Le liste WhatsApp il gestionale NON le manda**, misurato prima di
    prometterlo: le liste broadcast si fanno a mano, arrivano **solo a chi ha
    il numero di Alessio in rubrica**, e tengono **256 contatti**. Quello che
    può fare è preparare **l'elenco dei numeri**, col limite scritto **lì**:
    un messaggio che non arriva a chi non ha il numero in rubrica risulta
    «mandato» e nessuno lo segnala.
    ✅ **FATTI i blocchi 1, 2 e 4**: il consenso con **due date** (non una
    spunta: «ha acconsentito» e «si è cancellato» sono due fatti con due
    quando, e un booleano che si spegne cancellerebbe la prova), la
    cancellazione che **toglie davvero** perché è la stessa colonna che il
    calcolo legge, le **due porte separate** con quella commerciale che
    pretende il consenso **nel database**, la storia sulla scheda del cliente
    e l'elenco dei numeri **col limite della rubrica scritto accanto**.
    🔴 **UN DIFETTO MIO, trovato da una rete**: la regola stava in una funzione
    e la scheda cliente **la ricalcolava in JavaScript** — due posti che
    possono contraddirsi. Ora è una **colonna calcolata da Postgres**: nessuno
    la scrive, e la schermata legge la risposta.
    🔴 **RESTA IL BLOCCO 3 — leggere le mail dei clienti**: la Posta in arrivo
    continua a trattare ogni mail come un documento da archiviare. Serviva
    toccare il giro delle proposte, che è il pezzo più delicato del gestionale,
    e non l'ho aperto di sera.
    ⚠️ **E nessuna mail commerciale è mai partita davvero**: il blocco
    costruisce *chi può riceverla* e il registro di *cosa è uscito*, non
    l'invio — che è un invio vero a indirizzi veri.

---

12. ✅ **L'ALLINEAMENTO DEL MAGAZZINO E IL FOOD COST REALE — FATTO la sera del
    20/08 su tutti e tre i blocchi** ([consegna](consegne/20260820_ce_n_e_questo.md),
    migrazione `20260820000010`, **non applicata**):
    [`mandati/20260820_l_allineamento_del_magazzino.md`](mandati/20260820_l_allineamento_del_magazzino.md).
    🔴 **Il problema l'ha posto Alessio**: le quantità che il gestionale
    scarica sono **stimate**, quindi quel numero **non è una giacenza, è una
    previsione**. ⚠️ E va **chiamato così a schermo**: il giorno che lo si
    chiama «giacenza» si smette di controllarlo.
    ✅ **Metà esiste già** (partite col loro costo, sotto-scorta, `rettifica`
    già fra i motivi di scarico, meccanica FEFO): manca il gesto di
    **dichiarare quanto c'è** — oggi si può solo togliere una quantità — e i
    **due numeri del food cost**, stimato e reale, che restano **distinti**
    perché lo stimato è quello con cui si decidono i prezzi del menu.
    ⚠️ **Niente causale** (scartata da Alessio: un elenco che si riempie di
    «non so» produce righe che sembrano informazione), **niente avvisi**, e
    **non nella lista della spesa**.
    ✅ **LA MISURA CHIESTA, fatta**: su due partite a prezzi diversi,
    togliendone 3, FEFO dà **9,00 €** — dalla più cara 15,00, a un prezzo medio
    13,50. **Il 67% di differenza**, quindi il mandato aveva ragione a chiedere
    che fosse detta e non nascosta in una scelta di implementazione.
    ✅ La colonna in Magazzino non si chiama più «Giacenza» ma **«Dovrebbe
    esserci»**.
    🔴 **DUE DIFETTI VERI trovati dalle prove, non rileggendo**: il costo della
    merce trovata in più veniva da «l'ultima partita» ordinata per data — ma un
    carico da fattura le scrive tutte in **una transazione**, quindi l'ordine
    era casuale (trappola del 16/08, **terza ricomparsa**); e `da_allineare()`
    **moltiplicava la giacenza per il numero di correzioni** (6 kg con 12
    correzioni → 72), senza nessun errore e sempre **più alto del vero**.
    ⚠️ **E la prima rottura non ha reso rossa nessuna prova**: la verifica
    diceva solo «lo scostamento non è vuoto», e ignorando gli scostamenti
    valeva 0 — che non è vuoto. Riscritta per misurare una differenza che
    produce lei.

---

## ⚠️ Cosa resta da guardare dopo la sera del 20/08

**Le quattro decisioni della notte del 20/08**, prese da Alessio dopo le
consegne. Scritte qui perché nessuna di loro è stata costruita quella notte.

- **1 · IL FRENO SULLE MIGRAZIONI — strada 3**, nella forma *«la chiave non
  vive sul computer»*, accettando il costo di un gesto ogni volta.
  ✅ **La misura è fatta** e sta in
  [`proposte/20260820_la_chiave_che_scrive.md`](proposte/20260820_la_chiave_che_scrive.md).
  🔴 **E ha ridotto il lavoro invece di allargarlo, due volte**: dei dieci
  comandi che leggono la chiave di produzione **uno solo scrive** (`npm run
  migra -- --conferma`), quindi togliere la chiave e basta spegnerebbe **nove
  strumenti di misura, backup compreso**; e il ruolo di sola lettura **esiste
  già** — Supabase fornisce `supabase_read_only_user`, misurato: ha `select`
  su tutto ciò che serve e **non** ha `insert`.
  ⚠️ **Due cose restano in dubbio e vanno provate**: la password di quel ruolo
  (dal pannello) e che `pg_dump` giri davvero con lui — *i permessi che ci
  sono e il comando che riesce sono due cose diverse*. **Prima si prova il
  backup con la chiave nuova, e solo se riesce si toglie quella vecchia.**
  ⚠️ **Rovescia in parte la decisione del 12/08** («le migrazioni le applico
  io»): il prompt non si può soddisfare da questo terminale, quindi l'ultimo
  tasto lo premerà Alessio. **Ma non è lo stesso gesto che allora era fallito
  tre volte** — lì si incollava un file SQL lungo che si troncava a metà, qui
  si incolla una riga e se si tronca il collegamento fallisce subito.
  🔴 **Non chiude la `SERVICE_ROLE_PRODUZIONE`**, che resta nel file e sullo
  storage può cancellare file. Lavoro a sé, non aperto.

- **2 · LE PROVE CHE GUARDANO LE SCHERMATE — rimandate, e non per il costo.**
  Oggi si sceglierebbe *a indovinare* quali schermate provare, su schermate
  che stanno ancora cambiando. ✅ **La cosa da fare adesso è fatta**: nel
  [copione del collaudo](collaudo/LEGGIMI.md) c'è la riga da annotare per ogni
  difetto trovato dal vivo — *una prova automatica l'avrebbe preso?* A fine
  collaudo **quell'elenco È la risposta**, ricavata dai difetti veri invece che
  decisa prima. ⚠️ **Il prezzo dell'attesa, dichiarato**: fino ad allora un
  difetto che vive solo a schermo può passare.

- **3 · LE QUATTRO PRENOTAZIONI del 20, 21 e 23 agosto sono FINTE**, confermato
  da Alessio. ✅ Il blocco D non ha più ostacoli su quel punto.

- **4 · LE COMUNICAZIONI AI CLIENTI PARTONO DAL GESTIONALE**, non dalla posta
  di Alessio. 🔴 **La ragione, perché resti scritta**: il cancello del consenso
  vive **nel database e non nella schermata** — copiando gli indirizzi a mano
  quel cancello non ci sarebbe, e il consenso tornerebbe a dipendere da chi se
  lo ricorda. ⚠️ **Per WhatsApp resta com'è**: lì il gestionale prepara solo i
  numeri **perché non può fare altro**, non per scelta — e la differenza fra le
  due cose va tenuta, perché il giorno che WhatsApp cambiasse la risposta
  cambierebbe con lei. **Non costruito**: è il terzo di blocco C.

---


0. 🔴 **IL PUSH HA UNA SECONDA STRADA, E NESSUNA AUTOMAZIONE LA COPRE** —
   misurato il 20/08. Dal terminale di Claude Code `git push` fallisce sempre,
   ma **la stessa copia di lavoro è aperta anche nell'interfaccia grafica, che
   ha il suo pulsante di pubblicazione**. Il 20/08, mentre Alessio era fuori,
   i due commit del blocco 4 sono usciti su GitHub per quella strada.
   ⚠️ **Il pulsante fa due cose e la seconda non si vede**: mette il sito
   online, e **fa cadere la condizione «solo migrazioni già su GitHub»** che
   tiene le migrazioni lontane dal database vero.
   ⚠️ **Cosa restava in piedi quella sera**: dei sei controlli di
   `npm run migra`, cinque erano già soddisfatti. **L'unica cosa che separava
   la migrazione del blocco 4 dal database vero era che nessuno digitasse
   `npm run migra -- --conferma`.**
   🔴 **E il freno che ha retto per quattro ore è stato quello SCRITTO NEL
   MANDATO, non quello tecnico** — cioè esattamente la forma che questo
   progetto rifiuta: *la disciplina si degrada, l'automazione no*.
   🟡 **DECISIONE APERTA, di Alessio**: cosa farne. Tre strade, e nessuna è
   stata presa — le scrivo perché la scelta è sua e non mia.
   **(a) niente**, e la regola resta scritta: costa zero e continua a poggiare
   su chi si ricorda. **(b) `npm run migra` chiede una conferma in più quando
   il push è recente** — un attrito che si può togliere e che non protegge da
   una scelta deliberata. **(c) le migrazioni in produzione passano da una
   parola d'ordine che ha solo Alessio**: è l'unica che chiude davvero il
   buco, ed è anche l'unica che gli costa un gesto ogni volta.
   ⚠️ **E qualunque sia la risposta, la parte già fatta è la più importante:
   adesso è SCRITTO** — in CLAUDE.md §2 e §11 — che quel pulsante pubblica.
   *Chi lo guarda sappia cosa fa.*


**Quattro blocchi consegnati la sera del 20/08**, tutti **non applicati in
produzione**: al database vero ci si va con Alessio presente.

1. 🔴 **NIENTE È IN PRODUZIONE**: 158 migrazioni là, **162 sul progetto di
   prova**. Aspettano il push, e con loro il **corridoio v18** e la funzione
   `notify-telegram-reservation` (categoria `evento`).
   ⚠️ **Senza il corridoio, due pulsanti rispondono 404**: «Il cliente ha
   accettato» e «È questo» dell'allineamento.
2. 🔴 **NESSUNA MANO HA VISTO NIENTE**, ed è il limite che pesa di più in tutta
   la serata: in questo progetto **le prove non hanno un ambiente DOM**, quindi
   nessuna prova automatica guarda una schermata. Non sono state guardate: le
   righe «non lo so» del blocco A (13 file), la schermata dell'allineamento, il
   riquadro del consenso sulla scheda cliente, «Scrivere a più clienti».
   ⚠️ **Aggiungere un ambiente DOM è una decisione architetturale** (una
   dipendenza nuova) e non l'ho presa: è la **domanda 1** del riepilogo del
   blocco A.
3. 🔴 **I due documenti veri nel deposito** — la partita IVA e il contratto di
   locazione sono fra i **3 file che nessun documento nomina più**, e il
   deposito è l'unico posto dove il gestionale ce li ha. **Vanno nominati ad
   Alessio prima** di qualunque pulizia.
4. ⚠️ **La pulizia del blocco D non è mai girata su dati veri**: sul progetto
   di prova ha girato su un database appena costruito, dove quasi tutte le
   tabelle erano vuote. **I suoi 18 guardiani non sono mai stati messi alla
   prova con numeri diversi da zero.**
5. ⚠️ **Il food cost reale non ha niente di vero da dire**: il Ricettario è
   vuoto, quindi lo «stimato» resta 0,00 finché non ci saranno ricette e conti.
   Le prove misurano che i due numeri **si muovono in modo diverso**, non che
   siano giusti su dati veri — perché dati veri non ce ne sono.
6. 🔴 **Nessuna mail commerciale è mai partita**, e nessun avviso Telegram di
   evento annullato è mai arrivato: le prove usano il freno anti-tempesta per
   non far suonare il telefono. La faccia del messaggio («📆 EVENTO ANNULLATO»)
   è nel collaudo con la ricetta per farla comparire.
7. 🟡 **Resta il blocco 3 della posta dei clienti** (leggere le mail dei
   clienti) e il **blocco 5 dei preventivi** (la sera dell'evento il magazzino
   scarica le porzioni modificate).

---

## ⚠️ Cosa resta da guardare dopo il 19/08 sera

1. ✅ **Le due migrazioni sono state applicate** dopo il push: **147 migrazioni in
   produzione**, 26 lapidi, **zero** righe di prova nel registro, **zero**
   riempimenti automatici di date.
2. 🔴 **Nessuno ha chiuso un conto in sala dopo la modifica di
   `close_order_as_discount_gift`.** È provato dentro la migrazione — che apre un
   conto vero e lo omaggia — ma con i claims impostati, non con un tablet in mano.
   ⚠️ E il comportamento **cambia fra mezzanotte e le 5**: quell'omaggio prima
   prendeva il giorno di calendario, adesso prende la serata.
3. ⚠️ **Le prove automatiche lasciano lapidi sul progetto di prova** (marcate
   `TEST-AUTO` e `__PROVA__`, oltre milleottocento): là è un database usa-e-getta e
   non è un problema, ma vuol dire che il numero delle lapidi su quel database non
   dice niente — e che una prova che le contasse invece di guardare una proprietà
   sarebbe inutile.
4. ✅ **IL TAGLIO A MILLE RIGHE — misurato e SISTEMATO il 19/08 notte**:
   referto in [`referti/20260819_il_taglio_a_mille_righe.md`](referti/20260819_il_taglio_a_mille_righe.md),
   consegna in [`consegne/20260819_una_lettura_tagliata_si_denuncia.md`](consegne/20260819_una_lettura_tagliata_si_denuncia.md).
   Il segnale vive nel punto unico da cui passano le letture; la prima nota parte
   dal mese in corso e **rifiuta l'export** se la lettura è tagliata; il manuale
   HACCP **dichiara stampato** di essere incompleto.
   ⚠️ **Restano scoperte le Edge Function**, che leggono con una loro chiave e
   non passano di lì. E **nessuna mano ha visto l'avviso a schermo**: le prove
   di questo progetto non guardano una schermata.
   🔴 **LE LETTURE ANNIDATE SONO STATE MISURATE la notte del 19/08**, e la
   risposta alla domanda che contava è **no: il segnale NON le vede** — il
   confronto legge un'intestazione che parla solo delle righe padre. Addendum
   in [`referti/20260819_il_taglio_a_mille_righe.md`](referti/20260819_il_taglio_a_mille_righe.md).
   ⚠️ **Ma il rischio oggi non è raggiungibile**, ed è la parte che cambia la
   priorità: il tetto è **per riga padre** (misurato: nella stessa richiesta un
   conto ha ricevuto 1000 righe e un altro le sue 5), e delle **sette** letture
   annidate dell'app **nessuna** può avere mille figli sotto un solo padre — un
   conto con mille righe non esiste. I tre casi temuti (un fornitore con tutte
   le sue fatture, un ingrediente con tutto lo storico prezzi, un registro
   HACCP intero) **non sono letture annidate**: sono piatte, quindi già coperte
   dal segnale, e due hanno già un limite esplicito.
   🔴 **Quello che resta è strutturale, e «non può succedere» NON è una
   proprietà del programma: è una proprietà del locale.** Nessun vincolo
   impedisce a un conto di avere mille righe — lo impedisce un'osteria da 34
   coperti. `orders → order_items` alimenta il totale del conto, e **la
   risposta cambia il giorno in cui una lettura annidata nuova pesca da una
   tabella che cresce nel tempo sotto un solo padre** (lo storico prezzi di un
   ingrediente, le voci di un registro, le fatture di un fornitore): quel
   giorno il difetto è già lì e muto.
   ⚠️ **La domanda da farsi scrivendo una lettura annidata nuova** non è
   «capiterà mai mille righe?» ma *questa tabella figlia cresce col tempo sotto
   un solo padre?*
   ⚠️ **L'indizio NON si costruisce** (decisione di Alessio del 19/08): una
   protezione per un caso irraggiungibile è **un avviso che non scatta mai**, e
   un avviso che non scatta mai nessuno saprà interpretarlo il giorno che
   scatta. Resta scritto dove serve — in `supabase.js`, accanto al confronto
   che non le vede.
5. 🔴 **TRE COSE NON LE HA MAI VISTE NESSUN OCCHIO**, e sono nell'elenco del
   collaudo generale **con la ricetta per farle comparire**
   ([annotazioni del collaudo](collaudo/annotazioni.md), ultima sezione):
   l'**avviso «quello che vedi è incompleto»** (serve una tabella con più di
   mille righe: la ricetta le costruisce sul progetto di prova, ed è stata
   provata dal vivo il 19/08), la **riga sul tablet delle comande** quando la
   serata è finita (si sposta **l'ora di fine serata** di due minuti, non
   l'orologio del computer), e la **sala dopo l'annullamento dei due conti**
   — l'unica che si guarda sul gestionale vero.
   ⚠️ *Una voce di collaudo che nessuno sa come far scattare è una voce che al
   collaudo verrà saltata*: è il motivo per cui la ricetta sta scritta accanto
   a ognuna, e non basta l'elenco.
6. **La sera prima dell'apertura**: `npm run collaudo:stato` dice cosa c'è ancora
   di prova nel gestionale vero. ⚠️ Il paragrafo scritto a mano **non esiste più**,
   e non deve tornare: aveva sbagliato tre volte in sei giorni.

---

## ⚠️ Una lezione di ORDINE, imparata sbagliandolo il 19/08

`npm run migra` applica **tutte** le migrazioni mancanti o **nessuna**, e si
ferma se anche una sola non è ancora su GitHub. Quel rifiuto è giusto — la
produzione non deve mai correre avanti al repository — ma ha una conseguenza
sull'ordine dei gesti, che il 19/08 è costata l'applicazione di sei migrazioni
già pronte:

> **Le migrazioni già su GitHub si applicano PRIMA di committarne di nuove.**

La sera del 19/08 le sei del mattino erano pushate e documentate, quindi
applicabili; committando le due nuove **prima** di applicarle, la rete le ha
bloccate tutte e otto insieme, e per sbloccarle serve comunque il push di
Alessio. Nessun danno — solo un giro in più.

---

## Le decisioni di Alessio ancora aperte

> ⚠️ **Questa sezione è sparita una volta**, il 19/08/2026, e con lei altre
> due — vedi il riquadro in testa al file. Se manca, si recupera da git.

- **Simulatore col registratore fiscale virtuale** (nato dalla casella del
  documento fiscale scrivibile da tutto lo staff: prima si guarda cosa
  succede, poi si decide).
- 🔄 **Finger food**: piatti composti da più ricette. **In corso dal 19/08** —
  mandato [`20260819_i_finger_food_e_lo_storico_dei_costi.md`](mandati/20260819_i_finger_food_e_lo_storico_dei_costi.md).
- **Estrazione ricette** col pulsante «estrapola» e aiuto alla lista della
  spesa.
- **Casella dedicata e mail dei clienti** dentro il gestionale.
- **Finanziamenti da terzi** dentro «Ce la faccio?».
- **Autoprodotti in magazzino e raccolta propria col registro HACCP** —
  rimandati all'apertura dell'azienda agricola.
- **Sito web**: dopo l'app, col gestionale spostato su un sottodominio.
- **Le due colonne sul computer** nella schermata della sala.
- 🆕 **Un modulo PREVENTIVI per i clienti**, sullo stile dell'editor del menu
  (19/08/2026). È nata parlando dei finger food scelti per un evento: chi
  organizza una cena sceglie i bocconcini uno per uno, e da quella scelta
  deve poter uscire un foglio da mandargli. ⚠️ **Non è il modulo finger
  food**: quello dà il prezzo a pezzo, questo lo mette in una proposta con un
  totale e un aspetto presentabile.

---

## Cosa il disegno della sala NON dice, per scelta (19/08/2026)

⚠️ **Non è una coda e non è un difetto: sono due bugie volute**, e stanno qui
perché fra sei mesi somiglieranno a errori da correggere. Chi le tocca deve
sapere che erano decisioni, con la loro ragione e il loro prezzo.

**1 · Le sagome sono disegnate più grandi del vero.** Ogni sagoma cresce fino
a **3 mm sullo schermo** perché si possa afferrare col dito (rovesciamento
n. 14, deciso da Alessio il 19/08 dopo aver rifiutato le tre strade che
conservavano la proporzione). **Il disegno quindi non è in scala**, e lo spazio
fra i tavoli si vede **più stretto di com'è**: chi guarda la pianta per capire
se in un corridoio ci si passa, sbaglia in difetto — mai il contrario.

⚠️ **Il varco misurato, e la storia dei due numeri sbagliati.** Il minimo vero,
rimisurato in produzione il **19/08/2026** sulla pianta base **e** su tutte e
tre le giornate esistenti, è **80 cm** — fra i divani, identico in ogni
disposizione. Prima era stato scritto che 80 valeva solo per la pianta base e
che il minimo vero era 40 (T5/T6 e T7/T8): **falso**, quelle coppie stanno a
**distanza zero**, sono tavoloni. *Un numero si chiede al database, anche
quando arriva da chi controlla.*

⚠️ **E NESSUNO DEI DUE NUMERI È LA RAGIONE DELLA REGOLA** — è per questo che
l'errore non è costato niente. La griglia di aggancio è a passi di 10 cm,
quindi qualunque sera si possono mettere due tavoli a 20 cm: **nessuna misura
di oggi può garantire le disposizioni di domani.** Al posto del numero
c'è una regola — *la sagoma cresce fino a 3 mm ma si ferma prima del vicino, e
fra due sagome separate resta sempre una riga visibile* (`VARCO_MINIMO_MM` in
`src/lib/calcoli/sala.js`), provata a 40, a 20 e a 10 cm di varco vero.
**Da qui in avanti la misura della sala non è più una condizione**: se entra
un mobile nuovo, il disegno si stringe da sé.

**2 · La Chef Table è disegnata dove non sta.** In sala è accanto alla cucina;
sulla pianta compare **sotto i divani, in orizzontale** (rovesciamento n. 15,
deciso da Alessio il 19/08: in pianta accanto alla cucina gli dà fastidio, e
la postazione è una sola e inconfondibile). ⚠️ **Solo il disegno**: la
posizione vera resta nel database, e coperti, accostamento, tavoloni,
prenotazioni **e i gesti** continuano a usare quella. L'elenco delle sagome
spostate è `SPOSTATE_NEL_DISEGNO`, e oggi contiene una riga sola.

⚠️ **«Sotto» e «orizzontale» sono quelli del telefono**: lì la pianta si mette
in piedi e gli assi si scambiano, quindi nel codice i numeri sembrano dire
un'altra cosa. **Sul computer la stessa sagoma si vede a sinistra dei divani e
in piedi.** Due prove sui dati veri la sorvegliano: che il nome esista ancora
(se il tavolo venisse rinominato l'elenco smetterebbe di riconoscerlo, senza
nessun errore) e che la posizione finta **non finisca sopra un altro mobile**
il giorno che la sala intorno cambia.

**3 · I tavoli non possono più stare in cucina.** Dal 19/08 (idea di Alessio)
l'area di cucina e servizi è **vietata ai mobili**: la sala dei tavoli è una
**L capovolta**. Vale nel trascinamento e nel magnete. ⚠️ Misurato prima di
scriverlo: nessuna sagoma è mai stata là dentro, né nella pianta base né nelle
tre giornate esistenti. È anche la ragione per cui il **margine di sicurezza**
del pannello è stato tolto — difendeva un caso che ora non può accadere, e nel
frattempo faceva sparire il pannello tutti i giorni per colpa della Chef
Table. ⚠️ Il controllo resta come rete: si è tolto il numero, non la regola.

---

## 🔴 Aperta e non decisa: le due colonne delle Comande sul tablet (21/08)

**Il fatto, misurato**: la pianta **sborda dallo schermo** di un mini tablet
— di **140 punti** su un 7,9" e di **95** su un 8,3". Tutto il disegno a due
colonne era stato misurato con la stima da monitor (37,8 punti per
centimetro) invece che col valore vero del tablet (64 e 59,5).

⚠️ **Nessuna cura è stata proposta**, per decisione: le strade sono più di
una — tornare alla pianta sopra e il menu sotto, accettare una pianta che
scorre, cambiare la soglia, altre — e **dipendono da cosa Alessio vuole
vedere insieme**.

**I numeri che servono alla decisione** stanno in
[`referti/20260821_le_comande_sul_tablet_vero.md`](referti/20260821_le_comande_sul_tablet_vero.md),
e il più importante è questo: la soglia della pianta poggia su **1,05 cm**,
che è una convenzione presa da fuori — mentre Alessio ha provato con le mani
che **5,3 mm bastano**. Con quel numero la pianta **entrerebbe** su tutti e
due i tablet.

⚠️ **E restano fuori schermo due gesti**: «Cambia tavoli» e «‹ Lascia … aperto»
cadono a ~1279 punti dall'alto su uno schermo alto 1024. Non sono stati
spostati: dove vadano è parte della stessa decisione.

---

## ✅ Fatto: i turni dei pasti (21/08)

**Consegnato** in
[`consegne/20260821_i_turni_dei_pasti.md`](consegne/20260821_i_turni_dei_pasti.md).
Il turno è un dato della riga, la cucina stampa un foglio per turno, e
«Avanti col prossimo turno» è un biglietto generico. La misura che l'ha
preceduto resta in
[`referti/20260821_i_turni_dei_pasti.md`](referti/20260821_i_turni_dei_pasti.md).

**Le tre domande hanno avuto risposta da Alessio**: il biglietto esce dalla
stampante; è generico e senza limitazioni (non conta i turni, non si
spegne, si può premere due volte); un piatto aggiunto a un turno già
stampato fa un foglio suo, **a patto che il foglio dica chiaramente a che
turno appartiene**.

⚠️ **Resta aperto, e non è una dimenticanza**: il **Bar** raggruppa ancora
per invio. Un turno è una cosa della cucina — le bevande escono quando
escono — e Alessio ha nominato solo la cucina. La regola sta in un posto
solo (`src/lib/calcoli/turni.js`), quindi portarla lì costa poco.

🔴 **E la coda di stampa di ARCHITETTURA §4.2 NON esiste ancora**, misurato
sulle migrazioni: nessuna tabella di coda, con nessun nome. `chiamate_turno`
ne ha **la forma** (riga in attesa, `stampata_il`, niente attesa sincrona) e
la Cucina tratta i biglietti come gli altri fogli, ma la coda vera — una
tabella sola per tutti i documenti, con stato, tentativi ed errore, letta
dall'agente sul mini-PC — è ancora tutta da costruire. ⚠️ **La parte che
non è codice viene prima**: un registratore o una stampante che non sanno
dire quando *non* hanno stampato lasciano scoperto il caso che conta.
---

## I bersagli fra 5 e 8 mm nei moduli — lasciati apposta (25/08/2026)

**Decisione di Alessio**, presa dopo il giro sul Ricettario del telefono:
*«lasciali per ora. Nessuno di loro cancella niente, e ridisegnare i
moduli è un lavoro a sé.»*

**Cosa resta sotto la soglia degli 8,50 mm**, misurato a 390×844 con la
calibrazione di un mini tablet (`--pxcm 64`) e con l'**area toccabile
vera** — cioè l'etichetta che contiene una casella, non il quadratino:

| dove | quanti | il peggiore |
|---|---|---|
| nuovo ingrediente (pulsanti allergene, campi) | 40 | **5,00 mm** («+ Nuovo fornitore») |
| scheda ricetta (link ai finger, campi) | 28 | **5,00 mm** |
| schede prodotti (caselle dentro etichette) | 17 | **5,00 mm** |
| elenco ingredienti (campi e tendine) | 5 | 6,25 mm |
| nuova ricetta (campi) | 6 | 7,81 mm |
| menu | 2 | 7,50 mm |

⚠️ **Perché si può rimandare, ed è il criterio della decisione**: fra
questi **non c'è nessun gesto che cancella**. I gesti pericolosi della
scheda ricetta — il «Rimuovi» di una riga ingrediente, a **4 mm** — sono
stati portati a 8,5 nello stesso giro, insieme ai link dei finger e a
«Com'è cambiato». Quello che resta sono **campi di modulo e caselle di
scelta**: sbagliare mira lì costa un tocco in più, non un dato perso.

⚠️ **Perché è un lavoro a sé**: alzare 40 bersagli a 8,5 mm su «nuovo
ingrediente» vuol dire ridisegnare la griglia dei 14 allergeni e
l'altezza dei campi — cioè rifare il modulo, non ritoccarlo.

⚠️ **E il numero non è confrontabile con le misure di ieri**: il
misuratore di ieri guardava il **quadratino** di una casella invece
dell'etichetta toccabile che la contiene, e dava 2,03 mm dove il
bersaglio vero è 5,00. Le caselle da 2,03 mm erano **falsi allarmi**.
