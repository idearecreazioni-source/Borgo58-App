# Mandato di correzione — quello che la revisione generale ha trovato

**Data:** 16 agosto 2026
**Stato del codice a cui si riferisce:** commit `a565379`, 108 migrazioni, repo e produzione allineati
**Origine:** revisione generale di tutta l'app (giri 1–4 + rilettura cassa), condotta leggendo per intero ogni schermata e ogni porta verso il database
**Destinatario:** Code
**Committente:** Alessio

---

## Premessa — come si lavora su questo mandato

1. **Un blocco alla volta**, nell'ordine scritto qui. Non si apre il blocco successivo prima che il precedente sia consegnato.
2. **Un riepilogo di consegna per ogni blocco**, in `docs/consegne/`, come prescritto da `CLAUDE.md` §2: cosa è stato fatto, cosa è stato verificato e come, **cosa non è verificato**.
3. **Nessuna migrazione in produzione prima del riepilogo.** Vedi Blocco 0.
4. Il **Contratto** non si modifica per far entrare una correzione: se una correzione sembra richiederlo, ci si ferma e si scrive ad Alessio.
5. Ogni correzione che tocca due tabelle passa dal **corridoio delle operazioni atomiche** (Contratto B4). Nessuna eccezione silenziosa.
6. Le correzioni **non devono introdurre un secondo posto dove si calcola la stessa cosa**. Se una cura sembra chiederlo, la cura è sbagliata.

---

## Blocco 0 — Gli arretrati di processo

**Perché prima di tutto:** quattro commit sono usciti senza riepilogo e due migrazioni sono state applicate in produzione prima che il riepilogo esistesse. Finché questo non è chiuso, ogni consegna successiva parte da un debito.

**0.1 — Scrivere i riepiloghi mancanti.**
Commit `06f5152`, `17e4161`, `d06c32a`, `a565379`. Un file in `docs/consegne/` con la stessa forma degli altri, **dichiarato in testa come documento postumo**: cosa fa ogni commit, cosa è stato verificato e come, cosa non è verificato.

**0.2 — Rendere impossibile che ricapiti, con un meccanismo e non con un'intenzione.**
`scripts/migra.mjs` deve **rifiutarsi di toccare la produzione** se in `docs/consegne/` non esiste un file che nomina quella migrazione. Stessa forma della rete che già impedisce di applicare in produzione ciò che non è passato dal progetto di prova. Se esiste una strada migliore, si può proporre, ma il criterio è: **deve fermarti il codice, non la memoria**.

---

## Blocco 1 — La regola del documento che ha generato un effetto

**Il difetto (n. 10), in tre esemplari identici:**

| Cosa cancelli | Cosa resta | Dove |
|---|---|---|
| Una fattura fornitore **già pagata** | L'uscita in prima nota, senza più il documento che la giustifica | `delete_supplier_invoice` (09/08) non conosce il movimento scritto da `pay_supplier_invoice` (13/08) |
| Una nota "di tasca mia" **già rimborsata** | Il rimborso in prima nota, senza più il perché | `deleteAnticipazione` — scrittura diretta, nessun controllo |
| Una cessione intercompany con **costo aggiornato** | Il costo dell'ingrediente al prezzo di trasferimento e la riga nello storico prezzi | `deleteCession` — scrittura diretta |

**La regola da scrivere una volta sola:**

> Un documento che ha generato un effetto altrove **non si cancella e basta**. O la cancellazione è **respinta** con un messaggio che spiega cosa impedisce (e indica cosa fare prima), oppure **storna anche l'effetto nella stessa transazione**. Non esiste il terzo caso: il documento sparisce e l'effetto resta.

**Come:** funzioni `delete_*` nel database, chiamate dal corridoio, con il controllo **dentro** la funzione e non nella schermata. Per ciascuno dei tre casi decidere quale delle due strade (respingere / stornare) è quella giusta, **dichiararlo nel riepilogo** e spiegarlo nel messaggio all'utente.

**Criterio di accettazione:** dopo la correzione non deve esistere nessun percorso, in nessuna schermata, che lasci un movimento di cassa o un costo aggiornato senza il documento che lo giustifica.

---

## Blocco 2 — Un solo calcolo per ogni numero

Tre punti in cui una formula del database è stata riscritta nel browser. Oggi due su tre danno lo stesso risultato — il terzo no — ma il problema non è il risultato di oggi: è che alla prossima modifica bisogna ricordarsi di due posti.

**2.1 — Il simulatore del menu (difetto n. 9) — questo è rotto, non solo doppio.**
In `MenuDetail.jsx` il what-if "aumento del prezzo di un ingrediente" ricalcola il food cost con una terza copia della formula che **non conosce le preparazioni**: sulle righe-componente il dato è vuoto e il calcolo va in errore, quindi la schermata si rompe per ogni piatto che contiene un semilavorato. In più guarda solo gli ingredienti diretti: con l'approccio "scompongo sempre", un rincaro dentro una preparazione non mostra nessun piatto. **Cura: la simulazione la calcola il database**, con la stessa espansione ricorsiva di `v_recipe_costs`.

**2.2 — Il costo delle righe di ricetta (difetto n. 1).**
In `RicettaDetail.jsx` il costo di ogni riga — ingredienti **e** componenti — è ricalcolato nel browser accanto a `v_recipe_costs`. **Cura: righe già valorizzate dal database**, come già si fa per le spese in Deduzioni.

**2.3 — Il totale del conto nel Bar (difetto n. 4).**
Il riquadro cassa di `Bar.jsx` somma le righe a mano invece di usare il modulo unico `calcoli/conto.js`. **Cura: usare quello.**

**Criterio di accettazione:** cercando nel codice client non deve restare nessuna somma di righe o percentuale di food cost che esista già come funzione o vista nel database. Elencare nel riepilogo i punti verificati.

---

## Blocco 3 — Le scritture che devono passare dal corridoio

**3.1 — «Ha disdetto» (difetto n. 5).**
In `PiantaGiornata.jsx` sono **due scritture separate dal browser** (aggiorna lo stato della prenotazione, poi libera i tavoli). Forma vietata dal Contratto B4: al fallimento a metà restano righe orfane invisibili. **Cura: una funzione sola nel corridoio.**

**3.2 — Il censimento delle chiamate dirette (difetto n. 6).**
Esistono funzioni del database che toccano più tabelle e vengono chiamate **direttamente dal browser** invece che dal corridoio. Quelle già trovate: `merge_customers`, `close_shopping_list_item`, `record_stock_consumption`, `update_ingredient_price`. Sono atomiche dentro, quindi non c'è perdita di dati — è un rilievo di forma, ma la forma è quella che rende il sistema controllabile.

⚠️ **Il censimento automatico non è affidabile**: i blocchi di verifica dentro le migrazioni inquinano l'estrazione, e ho contato 48 chiamate senza poterne garantire l'elenco. **Vanno censite a mano, una per una**, e il riepilogo deve contenere la tabella completa: nome della funzione → quante tabelle scrive → chiamata dal corridoio sì/no → azione presa.

**Criterio di accettazione:** ogni funzione che scrive su più di una tabella o è chiamata dal corridoio, o è documentata nel riepilogo con la ragione per cui non lo è.

---

## Blocco 4 — Le comande

**4.1 — Le righe già inviate in cucina (difetto n. 3).**
`removeDraftItem` e `updateDraftItemQuantity` non hanno la rete che `sendDraftItems` ha: **una riga già inviata si può cancellare o modificare** da qualsiasi tablet, senza traccia, **anche a conto chiuso**. Le policy del database su `order_items` sono aperte a tutto lo staff, e la tabella è fuori dal registro delle cancellazioni. In sala con due tablet è una gara che si perde in silenzio.

**Cura, su tre livelli:** rete nel client; **vincolo nel database** (una riga con `sent_at` non si cancella né si modifica: si storna, e lo storno si vede); `order_items` dentro `deleted_records`.

**4.2 — Le bozze mai inviate (difetto n. 7) — deciso da Alessio.**
Oggi le righe rimaste in bozza, mai mandate in cucina, **entrano nel totale del conto e scaricano il magazzino** alla chiusura (client e database coerenti fra loro, e dal Bar si può chiudere anche senza aver inviato niente). Alessio ha deciso che **va cambiato**: alla chiusura le righe mai inviate non devono essere addebitate né scaricare il magazzino, e chi chiude deve **vederlo dichiarato**, non scoprirlo dal totale.

**Criterio di accettazione:** una riga inviata non sparisce mai senza lasciare traccia; una riga mai inviata non finisce mai nel conto senza che qualcuno l'abbia visto.

---

## Blocco 5 — Le conferme e le vie di ritorno

Due problemi distinti che si curano insieme perché nascono dallo stesso vuoto.

**5.1 — Le azioni distruttive a un tocco (difetto n. 2).**
Inventario completo: **solo 5 schermate chiedono conferma** in tutta l'app; circa 35 azioni distruttive non la chiedono. **Non vanno messe tutte**: una conferma su ogni gesto insegna a premere "sì" senza leggere, e allora non protegge più niente.

**Criterio di cernita da applicare, in quest'ordine:**
1. **Chiede conferma** ciò che è irreversibile e tocca soldi, obblighi di legge o dati di persone: fatture (anche pagate), mance raccolte e distribuite, buste paga, documenti dei dipendenti, cessioni, movimenti di prima nota, omaggi, schede cliente, note "di tasca mia", rimborsi, spese deducibili.
2. **Non chiede conferma** ciò che si rifà in tre secondi o ha una via di ritorno visibile: righe di ricetta, fasi, video, voci di menu, colture, task.
3. La conferma **dice cosa sparisce**, come già fa "Elimina dipendente" — non un "sei sicuro?" generico.

**5.2 — I vicoli ciechi (difetti n. 8 e n. 16).**
Azioni che l'app permette e poi non sa disfare. **Ognuna va chiusa dando la via di ritorno**, non aggiungendo un avviso:

| Vicolo cieco | Manca |
|---|---|
| Fornitore disattivato | Il "riaccendi" — l'elenco mostra solo gli attivi (i tavoli ce l'hanno, i fornitori no) |
| Prenotazione "annullata" | Nessuna azione di ritorno in interfaccia |
| Conto segnato "scontrino fatto" per errore | Nessun modo di annullare il documento fiscale segnato |
| Scadenza fissa chiusa con "non serve più" | Nessun modo di riaprirla, e nessun modo di correggerla |
| Mese "fotografato" per errore | `cancellaConsuntivo` esiste nel codice, **nessuna schermata la chiama** |
| Periodi anomali | Le funzioni esistono, **nessuna schermata li crea** — ma l'app mostra l'avviso "periodo anomalo" |
| Fattura sbagliata / spesa deducibile sbagliata | Nessuna modifica: solo cancella e rifai |

**Criterio di accettazione:** nessuna azione dell'interfaccia lascia l'utente in uno stato che l'interfaccia stessa non sa disfare o correggere.

---

## Blocco 6 — I registri che si esibiscono

**6.1 — La non conformità che si chiude senza dire cosa hai fatto (difetto n. 12).**
Il registro temperature e il ricevimento merci promettono, testuale: *"resta APERTA finché non scrivi cosa hai fatto"*. Ma in `NonConformita.jsx` si preme "Conferma risoluzione" col campo vuoto e si chiude: **il vincolo del database chiede solo la data**. Nel manuale esibibile quella riga compare come "risolta" senza azione correttiva — davanti a un ispettore è peggio di una non conformità ancora aperta.

**Cura in due posti:** campo obbligatorio nella schermata **e** vincolo nel database (`resolved` richiede `corrective_action` non vuota). La promessa non può vivere solo nei messaggi.

**6.2 — Il registro cancellabile.**
`foraged_items` (raccolta propria) ha "Rimuovi" a un tocco, senza conferma e **senza traccia**: è l'unico registro HACCP cancellabile dall'interfaccia. **Cura: conferma + traccia**, oppure nessuna cancellazione (come pulizia e disinfestazione, che fanno la cosa giusta).

**6.3 — Le tabelle di soldi e di legge fuori dal registro delle cancellazioni.**
Il registro copre 14 tabelle. **Mancano:** `anticipazioni_socio`, `conteggi_cassa`, `deductible_expenses`, `foraged_items`, `order_items`. Le prime tre sono soldi, le ultime due sono documenti. **Vanno aggiunte.**
(Il ricettario resta fuori per scelta dichiarata nella migrazione 0808 — "una cancellazione di ricetta è una correzione" — e quella scelta non si tocca.)

**6.4 — Il numero della fattura.**
In `Scontrinato.jsx` "Fattura fatta" si preme col campo numero vuoto: il vincolo `orders_documento_coerente` chiede la data, non il numero. **Cura: il numero è obbligatorio quando il tipo è "fattura"**, in schermata e nel vincolo.

---

## Blocco 7 — Gli allergeni sul foglio stampato

**Difetto n. 14 — sicurezza alimentare. Due facce dello stesso vuoto.**

**7.1 — L'assenza che sembra una rassicurazione.**
Nel menu stampato, un piatto con allergeni non confermati **non stampa la riga allergeni**, mentre tutti gli altri la stampano. L'intento è giusto ed è scritto nel codice (*"un elenco che sembra controllato e non lo è è peggio di nessun elenco"*), ma per il cliente che legge l'assenza dice **"non contiene allergeni"** — l'opposto.

**Cura:** accanto a quel piatto un segno esplicito ("per gli allergeni chiedi al personale"), oppure il piatto non si stampa affatto. **La nota generica in fondo alla pagina non basta**, perché non distingue quel piatto dagli altri.

**7.2 — L'inserto dei piatti del giorno non dice niente.**
`PiattiDelGiorno.jsx` non riporta **mai** nulla sugli allergeni, nemmeno la frase generica che il menu principale ha in fondo. E i piatti del giorno sono proprio quelli con pesce, crostacei, frutta secca. **Cura minima: la stessa frase anche sull'inserto.**

---

## Blocco 8 — I fili scollegati

Due casi in cui il motore esiste, funziona, e nessuno gli parla.

**8.1 — Il fornitore che non si può scegliere (difetto n. 11).**
In `PostaInArrivo.jsx` la lista fornitori è chiesta **senza indicare la società** (`listSuppliers()` senza argomento, mentre ovunque altrove è `listSuppliers(entities.srls.id)`). La chiamata fallisce, **l'errore è ingoiato da un catch muto**, e il menu "Fornitore" del carico da fattura è sempre vuoto.

Conseguenze, verificate dentro `carico_con_memoria`: gli ingredienti nuovi vengono intestati alla **prima entità trovata** invece che a quella del fornitore — possono finire sull'agricola invece che sulla S.r.l.s., che è il vincolo portante del progetto; la memoria delle diciture finisce in un secchio generico; lo storico prezzi perde il "da chi" su cui si regge la sorveglianza dei rincari.

**Cura:** passare l'entità **e** togliere il catch muto — un errore che nessuno vede è peggio di un errore.

**8.2 — Il calendario che non mostra il pericolo che annuncia (difetto n. 15).**
In `PrevisioneDettaglio.jsx` la tabella "Quando escono i soldi" ha sopra scritto: *"è la cassa di giugno che tradisce, quando il saldo dell'anno prima e il primo acconto cadono insieme"*. Ma `calendarioImposte` viene chiamata **senza il quarto parametro** (le imposte dell'anno precedente), che la funzione del database sa usare — il ramo apposta c'è. **Cura: passarglielo.**

---

## Blocco 9 — Il pagamento misto (deciso da Alessio)

Oggi **un conto ha un solo modo di pagamento**. Se due persone dividono e una paga in contanti e l'altra con la carta, l'app non sa dirlo — e nessuna riconciliazione con la banca potrà mai tornare.

Va previsto adesso, **prima che entrino i conti veri**, perché cambiarlo dopo con lo storico dentro costa molto di più. La chiusura del conto deve poter ripartire l'incasso su più mezzi di pagamento, e la tesoreria deve leggerlo di conseguenza.

⚠️ **Regola che non si tocca:** i ricavi restano i conti chiusi, unica fonte. Il pagamento misto ripartisce **lo stesso incasso**, non ne crea un secondo.

---

## Le piccolezze — da fare in coda, con cernita

Non sono difetti, ma sono la ruggine. **Da valutare una per una**, e le scartate vanno dichiarate nel riepilogo con la ragione.

**Totali che mescolano cose diverse:** il "da pagare" delle fatture somma S.r.l.s. e agricola; gli importi dei documenti in archivio idem; il food cost medio del menu è una media di medie non ponderata sui piatti; l'elenco delle previsioni non filtra per società.

**Campi vuoti che diventano zero in silenzio:** prezzo di un piatto in menu; parametri della previsione scritta a mano (e una percentuale nulla che in modifica torna 0); porzioni svuotate respinte dal database con errore grezzo.

**Ricerche che si rompono con una virgola:** archivio documenti, prenotazioni, clienti — il testo digitato finisce grezzo dentro il filtro. Non è un buco di sicurezza (la RLS regge), è un errore brutto in faccia all'utente.

**Cose che spariscono senza dirlo:** la resa svuotata di una preparazione fa sparire il suo costo dalle ricette che la usano; il flag "in carta" e la presenza nel menu attivo possono divergere.

**Codice morto e fili penzolanti:** `deleteCompletedTasks` non è chiamata da nessuna schermata (e il commento descrive un pulsante che non esiste); l'api del ricevimento merci accetta un parametro "azione" che la schermata non usa mai; `abbina_righe_carico` ha ancora un grant a PUBLIC (una riga di revoke).

**Elenchi che crescono per sempre:** "pagate di recente" mostra tutte le fatture pagate dall'inizio; la ricerca dell'archivio parte a ogni tasto premuto.

**Altro:** la distribuzione di mance oltre il monte disponibile è avvisata ma non impedita; "dividi equamente" arrotonda per difetto e lascia i centesimi; una coltura si può portare a "raccolto" senza registrare la quantità; le categorie della carta bevande sono testo libero ("Rossi" e "rossi" diventano due sezioni); le policy delle 5 tabelle nuove sono scritte per il ruolo `public` invece di `authenticated` come tutte le altre (non è un buco, è incoerente).

---

## Fuori da questo mandato — decisioni di Alessio, non lavoro da fare adesso

- **Niente di autoprodotto entra in magazzino (n. 13).** La cessione dall'agricola aggiorna il costo ma non crea giacenza, né lotto, né riga nei registri sanitari; lo stesso per il raccolto e la raccolta propria. L'agricola non è ancora attiva, quindi c'è tempo — ma **la scelta non è dichiarata da nessuna parte** e va decisa, non dimenticata.
- **La casella del documento fiscale è scrivibile da tutto lo staff.** Chi incassa senza scontrino può marcare da sé il conto come scontrinato e farlo sparire dall'elenco. Alessio ha deciso di **non toccare niente finché non avrà provato il simulatore con registratore fiscale virtuale**, e di decidere dopo.
- **Riconciliazione POS voce per voce: abbandonata.** Resta il confronto giornaliero, quando ci sarà il POS.
- **Finanziamenti da terzi** (registrarli e programmarne la restituzione dentro "Ce la faccio?"): mandato successivo, dopo i quesiti a Laura.
- **Il tetto del 30% sulle mance** è calcolato sul reddito dell'anno precedente: Alessio ha deciso di non aprire la questione adesso.

**Da togliere prima dei dati veri** (non è codice, è pulizia): il conto "Divano 3" chiuso in contante il 15/08, le 2 prenotazioni di prova, i dati di collaudo del magazzino.

---

## Criteri di accettazione dell'intero mandato

1. Nessun percorso lascia un movimento di cassa o un costo aggiornato senza il documento che lo giustifica.
2. Nessun numero che il database sa calcolare viene ricalcolato nel browser.
3. Ogni scrittura su più tabelle passa dal corridoio, o è documentata la ragione per cui non lo fa.
4. Una riga di comanda inviata non sparisce senza traccia; una mai inviata non finisce nel conto senza che si veda.
5. Le conferme ci sono dove c'è irreversibilità su soldi, legge o persone — e **non altrove**.
6. Nessuna azione lascia l'utente in uno stato che l'interfaccia non sa disfare.
7. Una non conformità non si chiude senza dire cosa è stato fatto — vincolo nel database, non solo in schermata.
8. Le tabelle di soldi e di documenti sono tutte nel registro delle cancellazioni.
9. Sul menu stampato, un piatto senza allergeni confermati è **distinguibile** da un piatto che non ne contiene.
10. Nessun errore viene ingoiato in silenzio: se una lista non si carica, si vede.
11. Un conto può essere pagato con più mezzi, e i ricavi restano i conti chiusi.
12. Ogni blocco ha il suo riepilogo, e nessuna migrazione ha toccato la produzione prima del suo riepilogo.

---

## Una cosa da dire chiaramente

Questa revisione ha letto tutto e ha trovato 16 difetti veri. **Il codice è buono.** Le cose che tengono — il motore fiscale unico, le avvertenze che viaggiano insieme ai numeri, i registri HACCP senza tagli silenziosi, il calcolo del conto in un modulo solo, le lezioni del 12 agosto applicate e commentate — sono più numerose e più difficili delle cose che non tengono.

I difetti trovati hanno quasi tutti la stessa forma: **una promessa scritta in un posto e non mantenuta in un altro**. È il segno di un lavoro fatto in fretta ma con la testa giusta, non di un lavoro fatto male. Le cure vanno nella stessa direzione: meno posti dove la stessa verità è scritta due volte.
