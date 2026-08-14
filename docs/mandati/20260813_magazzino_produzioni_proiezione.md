# Borgo 58 — Mandato: dal magazzino che scende alla rotta economica

**Origine**: validatore, 13/08/2026, su decisioni di Alessio discusse e verbalizzate. **Tre blocchi in ordine di dipendenza**: il magazzino che scende da solo → le Produzioni (semilavorati) → la Proiezione economico-fiscale. L'ordine non è negoziabile: la Proiezione senza food cost reale è un Excel più bello; il food cost reale senza scarico e produzioni non esiste.

**Rapporto con i mandati già in coda**: la *Fase A della Filiera della spesa* dipende anch'essa dal Blocco 1 (già rilevato da Code: una lista su una giacenza che non scende è muta per sempre). Il *Ricettario Fase 1* è indipendente e procede per conto suo.

**Consegna**: un blocco per volta, riepilogo in `docs/consegne/`, regole di CLAUDE.md §2. Prove distruttive solo sul progetto di prova. Le decisioni di prodotto non previste qui si fermano da Alessio prima.

---

## Blocco 1 — Il magazzino scende da solo (chiude il settimo rilievo)

Chiudere un conto scarica dai lotti gli ingredienti dei piatti venduti, secondo ricetta. Da progettare (non è una correzione, è un lavoro):

1. **Piatti con ricetta**: scarico secondo dosi, dai lotti aperti in ordine di scadenza (FEFO) — così lo scadenziario e la rintracciabilità restano veri.
2. **Voci libere e piatti senza ricetta**: NON si inventa uno scarico. Si conta ciò che non si è potuto scaricare e lo si mostra ("N righe non scaricate questo mese") — la lezione dello scarto a zero e del "parziale: N conti": un buco dichiarato, mai uno zero che sembra un dato.
3. **Sprechi e rotture**: una via di scarico manuale con motivo (buttato, rotto, regalato alla brigata) — senza, la giacenza torna ottimista da un'altra porta.
4. Lo scarico da chiusura conto è **una scrittura di conseguenza**: non blocca mai la chiusura (un conto si chiude anche se un lotto non torna — l'anomalia si registra e si mostra, il cliente non aspetta).

**Criterio di accettazione**: conto di prova con piatti a ricetta → giacenza scesa delle quantità giuste, dai lotti più vecchi; conto con voce libera → giacenza ferma E contatore del non-scaricato aumentato; chiusura mai bloccata da un problema di scarico (provato forzandolo).

## Blocco 2 — Le Produzioni (versione minima, disegno per la scomposizione)

Registrare i semilavorati fatti in cucina. Contesto vincolante: Alessio **scompone sempre** (semilavorato = tutto ciò che ha richiesto manipolazione; il soffritto e il macinato cotto del ragù sono semilavorati, la passata comprata è ingrediente) — l'albero sarà profondo di proposito, il database già lo regge (preparazioni dentro preparazioni, cicli vietati).

1. **La versione minima sono DUE numeri, non uno**: quanto ne è uscito E quante dosi di ricetta si sono fatte ("una volta", "doppia", "metà"). Un numero solo non distingue il calo dalla mezza dose — e distinguere è tutto il valore.
2. La produzione **scarica gli ingredienti** dai lotti (FEFO, come il Blocco 1) e **crea un lotto del semilavorato** con la sua scadenza e il suo costo — che congela il costo di quel giorno: i rincari successivi toccano le produzioni future, mai il ragù già in frigo.
3. **La resa la scopre il sistema**: la resa attesa in ricetta serve alla spesa; il costo del lotto usa la resa vera di quel giorno. Dopo qualche produzione, la resa media reale viene **proposta precompilata** — da digitare a confermare.
4. **Sorveglianza delle rese**: uno scostamento fuori scala dalla media storica genera un avviso (stampo dei rincari — un fatto nuovo, non un guasto; mai muto). Un errore di resa a un livello basso risale invisibile fino al piatto: questo è il rimedio.
5. **La catena in un colpo solo**: soffritto → macinato → ragù nella stessa sessione si registra come un flusso unico con le quantità intermedie dichiarate strada facendo — tre eventi nel database, un gesto in cucina. (La dettatura del Ricettario Fase 1, quando ci sarà, si aggancia qui.)
6. Multi-tabella ovunque → corridoio e funzioni atomiche; permessi: la registrazione serve in cucina, quindi `authenticated` col criterio già dichiarato (nessun prezzo esposto allo staff — il costo del lotto lo vede il titolare).

**Criterio di accettazione**: il ragù a tre livelli, dal vivo — verdure → soffritto (con calo dichiarato) → ragù; costo del ragù = cascata dei costi reali coi cali di ogni livello, verificato a mano contro il calcolo; scarico ingredienti e lotti dei semilavorati coerenti; doppio tocco idempotente; resa proposta alla seconda produzione uguale alla prima registrata.

## Blocco 3 — La Proiezione economico-fiscale (il simulatore che diventa rotta)

Il modello di Alessio (Excel di maggio) entra nell'app e la realtà lo sostituisce mese per mese. Prima di scrivere codice: **ricognizione della sezione fiscale esistente** — la Proiezione la assorbe o le si affianca, e la scelta va motivata nel riepilogo. Vincolo architetturale in ogni caso: **un solo motore fiscale** — aliquote, basi e agevolazioni (IRES, IRAP, maxi-deduzione, acconti) vivono in un posto solo, parametri modificabili da Alessio dopo il confronto con Laura, e simulatore e proiezione ci attingono entrambi. Due semplificazioni diverse che danno due numeri diversi sono vietate per costruzione.

1. **Scenari versionati e congelati**: la previsione di partenza si carica (struttura del foglio di Alessio: ricavi sala per stagionalità, linee accessorie, personale, fissi, variabili in %) e **non si ritocca mai** — le riproiezioni sono scenari nuovi, datati, confrontabili tra loro e con la partenza.
2. **Consuntivi mensili fotografati**: alla chiusura del mese, i numeri veri (ricavi, coperti, food cost reale, personale, fissi da prima nota) si congelano com'erano — mai ricalcolati coi prezzi di dopo. Stesso principio del lotto.
3. **Scostamento scomposto, mai solo totale**: "sotto di X" deve dire da dove — coperti, scontrino medio, food cost, fissi. Il mese in corso si confronta **rapportato ai giorni trascorsi** e marcato parziale; i mesi chiusi si confrontano interi.
4. **Imposte: stima dichiarata, con il QUANDO oltre al quanto**: proiezione a fine anno mantenendo la rotta attuale, e il **calendario degli esborsi** (acconti giugno/novembre, saldo) — perché è la cassa di giugno che tradisce, non il totale. In schermata la scritta che è una semplificazione da verificare con la commercialista resta finché Laura non conferma i parametri (rilievo IRAP incluso).
5. **Il budget degli omaggi**: margine sopra il pareggio del mese ÷ costo reale per coperto (il calcolo degli omaggi già in produzione) = "quanti omaggi puoi ancora permetterti restando in pari". Numeri veri, aggiornati, mai listino.
6. **Anno su anno, dal secondo anno**: confronto con lo stesso mese dell'anno prima, con i **periodi anomali marcabili** (apertura, chiusure, lavori) perché il confronto li dichiari invece di ignorarli. La previsione non muore mai: dal secondo anno nasce dai numeri veri (stagionalità e food cost misurati) più le decisioni di Alessio.
7. **Dipendenza dichiarata in schermata**: finché i Blocchi 1-2 non alimentano il food cost reale, la proiezione lo usa dal modello e lo marca "previsto, non misurato" — mai un numero vero e uno presunto mescolati senza etichetta.

**Criterio di accettazione**: il foglio di maggio caricato come scenario di partenza e i suoi totali riprodotti (stessi input → stessi numeri, verificato su EBITDA e break-even con e senza accessorie); un mese finto consuntivato → scostamenti scomposti corretti a mano; la riproiezione crea uno scenario nuovo senza toccare il vecchio; il calendario imposte mostra gli acconti; il budget omaggi torna col calcolo manuale; tutto titolare-only (sono i numeri più riservati del gestionale).

---

## Fuori perimetro, dichiarato
Previsione automatica dei consumi; ottimizzazione del menu sui margini; qualificazione fiscale di omaggi e pasti personale (tavolo Laura); confronto con estratto conto bancario (aspetta l'apertura del conto); integrazione col registratore telematico.

*Preparato dal validatore il 13/08/2026. Validazione per blocco: codice, produzione via connettore, e i criteri sopra — con verifica manuale dei calcoli sul caso del ragù e sul mese finto.*
