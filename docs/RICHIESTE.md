# Le richieste di Alessio — cosa aspetta il suo turno

> 🔴 **PERCHÉ ESISTE QUESTO FILE, e il difetto che chiude.** Il **29/08/2026**
> Alessio ha nominato due cose che aveva già deciso in chat passate — il doppio
> colore sui tavoli e una modifica all'Agenda — e **nessuna delle due era mai
> arrivata in un mandato**. Vivevano solo dentro una conversazione, e le
> conversazioni finiscono.
>
> Non era sfortuna: **mancava il posto dove una richiesta aspetta il suo
> turno.** Il repository aveva già dove mettere le scelte in vigore
> ([`DECISIONI.md`](DECISIONI.md)), la coda tecnica del lavoro
> ([`CODA_E_DECISIONI.md`](CODA_E_DECISIONI.md)), i mandati e i riepiloghi —
> ma niente che rispondesse alla domanda *«cosa mi aveva chiesto Alessio e non
> ho ancora fatto?»*

---

## Come si usa — la regola

* 🔴 **Ogni mandato, prima di partire, legge questo file.** Una richiesta che
  nessun mandato ha ancora raccolto deve restare qui **visibile**, non sparire.
* 🔴 **Ogni riepilogo aggiorna lo stato di quelle che ha chiuso**, nominando la
  migrazione o il commit.
* ⚠️ **Una richiesta fatta si SEGNA fatta, non si cancella.** *Una richiesta
  cancellata non si distingue da una dimenticata* — è la stessa ragione per cui
  in questo progetto i rovesciamenti si registrano invece di riscrivere il
  passato.
* Sono **raggruppate per schermata o modulo**, non per data: è così che si
  cercano quando si ha in mente una schermata.
* ⚠️ **Le voci marcate «da confermare» sono quelle in cui non sono sicuro che
  la richiesta sia di Alessio e non una mia proposta.** Ci sono lo stesso — una
  richiesta dubbia tenuta fuori è una richiesta persa — ma la distinzione è
  scritta, così lui può smentirla leggendo.

**Gli stati:** `in attesa` · `in corso` · `fatta` · `scartata da Alessio`.

### Quante sono, al 30/08/2026

**49 richieste in tutto: 27 aperte**, **3 scartate da lui**, **18 chiuse**. Chiuse la notte del 30/08: le nove del Ricettario (R1-R9), i due pulsanti di MEMO (V4, V5) e l'Agenda (A1), che era la richiesta rimasta senza descrizione.

⚠️ **Il numero e un PAVIMENTO, non un censimento.** Sono le richieste che ho
potuto trovare scritte nei riepiloghi, nei mandati e nella coda: quelle dette
solo a voce o in chat cancellate non ci sono, e non c e modo di sapere quante
siano. **La A1 e la prova che ne mancano**: so che esiste perche l ha nominata
lui, e non so cosa sia.

### Che differenza c'è con gli altri tre file

| file | risponde a |
|---|---|
| [`DECISIONI.md`](DECISIONI.md) | *cosa vale adesso* — le scelte in vigore |
| [`CODA_E_DECISIONI.md`](CODA_E_DECISIONI.md) | *cosa va costruito e in che ordine* — coda tecnica, scritta per chi lavora |
| [`decisioni_rovesciate.md`](decisioni_rovesciate.md) | *cosa è cambiato* e quante volte |
| **questo** | *cosa mi ha chiesto Alessio e non è ancora fatto* |

---

## Sala, pianta e Comande

| # | Richiesta | Chiesta il | Da dove viene | Stato |
|---|---|---|---|---|
| S1 | **Quando due prenotazioni cadono sullo stesso tavolo, il tavolo si vede a due colori.** Oggi il doppio colore si accende solo se le due prenotazioni sono in fasce diverse: mettendone tre alla stessa ora non succede niente. E servono più di due tinte per dire che sono tre — due tinte dicono «due». | 29/08/2026 | Provato da lui sulla pianta. **Era già stato deciso in una chat passata e non era mai arrivato in un mandato: è la richiesta che ha fatto nascere questo file.** | in attesa |
| S2 | **Quando il gestionale non sa in che fascia cade una prenotazione, non deve metterla in mezzo.** Oggi «non lo so» e «è del turno centrale» hanno lo stesso identico colore. Succede a locale funzionante ogni volta che qualcuno prenota prima dell'orario di apertura (misurato su una prenotazione delle 19:29 con apertura alle 20:00). | 29/08/2026 | Due schermate sue | fatta · migrazione `20260829000026` |
| S3 | **Il riquadro delle informazioni in alto a destra della pianta ha una misura fissa mentre la pianta si adatta**: *«troppo grande da cellulare e troppo piccolo da pc»*. Sulla sua schermata «BASE-Tavolo …» è tagliato a metà e il riquadro copre la pianta invece di starle accanto. | 29/08/2026 | Sue parole | in attesa |
| S4 | **La legenda dei colori dev'essere scritta dentro il gestionale**, raggiungibile dalla pianta. Oggi non esiste in nessun posto: serve a lui adesso e servirà a chi lavorerà in sala. | 29/08/2026 | Mandato del 29/08 | fatta · commit di stanotte |
| S5 | **Le due colonne sulla schermata della sala, sul computer.** | prima del 21/08/2026 | `CODA_E_DECISIONI.md` | in attesa |
| S6 | **Un tavolo con due turni dentro il riquadro del tavolo.** | 18/08/2026 | Riepilogo del giro D3 | in attesa · *da confermare* |
| S7 | **Il coperto in meno per il tavolo contro il muro.** | 18/08/2026 | Chiesta e poi **ritirata da lui** lo stesso giorno (*«è già fantastica così»*): la correzione a mano copre già il caso. | scartata da Alessio |

---

## Ricettario e menu

| # | Richiesta | Chiesta il | Da dove viene | Stato |
|---|---|---|---|---|
| R1 | **Il tipo di ricetta non si sceglie più: lo dice il posto da cui entri.** Via la schermata dei tre pulsanti; da «Piatti» si va dritti alla scheda di un piatto, da «Preparazioni» a quella di una preparazione. | 29/08/2026 | Struttura decisa da lui | fatta · commit del 30/08 (nessuna migrazione) |
| R2 | **Nella sezione Finger, un selettore fra «singoli finger» e «piatti composti da finger»**, col pulsante di creazione che si adatta. | 29/08/2026 | Struttura decisa da lui | fatta · commit del 30/08 (nessuna migrazione) |
| R3 | **Il piatto composto da finger non è una ricetta**: non ha ingredienti, né fasi, né scarto — ha solo un elenco di finger da metterci dentro. Oggi una ricetta di tipo Finger contiene una sezione «Finger» con «Cerca un finger…», cioè un finger che cerca sé stesso. | 29/08/2026 | Sua schermata | fatta · commit del 30/08 (nessuna migrazione) |
| R4 | **Il prezzo del piatto composto lo scrive lui**: il gestionale mostra la somma dei costi dei finger dentro e non calcola il prezzo di vendita. *Un tagliere di quattro pezzi non costa quattro volte il pezzo.* | 29/08/2026 | Decisione esplicita sua | fatta · commit del 30/08 (nessuna migrazione) |
| R5 | **Le parole devono seguire il tipo**: su una ricetta di tipo Finger il titolo dice «Dove è usata questa PREPARAZIONE». | 29/08/2026 | Sua schermata | fatta · commit del 30/08 (nessuna migrazione) |
| R6 | **L'avviso «non ha ancora un food cost» non è rosso su una ricetta appena creata.** Resta, ma diventa rosso e bloccante solo quando si prova a mandare il piatto in carta. *Un piatto senza food cost è un problema il giorno che va sul menu, non il giorno che lo inventi.* | 29/08/2026 | Decisione esplicita sua | fatta · commit del 30/08 (nessuna migrazione) |
| R7 | **«Descrizione per il menu» è tagliata**: il testo d'esempio finisce fuori dal riquadro a metà parola. | 29/08/2026 | Sua schermata | fatta · commit del 30/08 (nessuna migrazione) |
| R8 | **Le tabelle degli ingredienti dentro una ricetta scorrono di lato**: «Rimuovi» tagliato a metà su tutte le righe, «% scarto» a capo nell'intestazione, il «kg» sotto la quantità invece che accanto. | 29/08/2026 | Sua schermata | fatta · commit del 30/08 (nessuna migrazione) |
| R9 | **«Salva modifiche» sta schiacciato in un angolo a metà schermata**, con roba da compilare ancora sopra. | 29/08/2026 | Sua schermata | fatta · commit del 30/08 (nessuna migrazione) |
| R10 | **Via la spunta «Guarnizione opzionale (esclusa dal food cost)».** | 29/08/2026 | Decisione esplicita sua | fatta · migrazione `20260829000023` |
| R11 | **Estrazione ricette col pulsante «estrapola»**, con aiuto alla lista della spesa. | prima del 19/08/2026 | `CODA_E_DECISIONI.md` | in attesa |
| R12 | **La resa al posto dello scarto standard**: lo scarto è una proprietà della coppia ingrediente × preparazione, non dell'ingrediente. La resa vive sulla riga di ricetta, espressa in lordo → netto («1,5 kg di cozze danno 400 g»), non in percentuale. | 14/08/2026 | Blocco 5 del mandato cumulativo | in attesa |
| R13 | **La scheda dell'ingrediente diventa il posto unico.** Dichiarata non aperta il 29/08: è l'unico punto del suo blocco senza una misura sotto, e prima di riorganizzarla va deciso cosa ci finisce dentro. | 29/08/2026 | Blocco 2 del mandato del 29/08 | in attesa |

---

## Materiali di consumo

| # | Richiesta | Chiesta il | Da dove viene | Stato |
|---|---|---|---|---|
| M1 | **Sulla scheda di un materiale di consumo spariscono cinque campi**: «Fotografa l'etichetta», «Provenienza» con «Produzione interna (orto)», «Conservazione» (e con essa l'etichetta gialla «messo dalla macchina»), e — la più importante — **«È un alimento»**, che è la casella con cui la carta forno tornerebbe in mezzo al baccalà. | 29/08/2026 | Sua schermata («Carta forno») | fatta · commit di stanotte |
| M2 | **Categorie e unità di misura proprie dei materiali**, al posto di quelle alimentari (oggi la carta forno è in categoria «Altro»). Ha chiesto esplicitamente che le proponga io e che lui le corregga leggendo. | 29/08/2026 | Sua richiesta | fatta · migrazione `20260829000024` |
| M3 | ⚠️ **Restano e sono giusti**: scorta minima, «avvisami se il prezzo sale», il fornitore. E **i valori senza senso rimasti** («tutto l'anno», «temperatura ambiente») **non si cancellano**: sono solo sul progetto di prova e spariranno col reset. | 29/08/2026 | Sua decisione | scartata da Alessio |

---

## MEMO (foto e voce)

| # | Richiesta | Chiesta il | Da dove viene | Stato |
|---|---|---|---|---|
| V1 | **I due pulsanti «Fotografa» e «Premi e parla» vanno in fondo, larghi quanto lo schermo, staccati dal bordo, alla stessa altezza in tutte e due le schermate.** Oggi «Premi e parla» è attaccato al bordo inferiore (dove su iPhone c'è la barra di sistema) e «Fotografa» è in basso a sinistra, largo un terzo — il punto più scomodo con una mano sola, che è come tiene il telefono mentre l'altra regge la confezione. | 29/08/2026 | Sue schermate | fatta · commit `8a58cab` |
| V2 | **La conferma parlata dell'allineamento a voce.** Dettare una giacenza funziona già; quello che manca è che MEMO risponda **a voce**. Dichiarato non fatto il 29/08 per una ragione onesta: in questo ambiente non c'è un orecchio che possa provarla. | 14/08/2026 | Blocco 2 del mandato cumulativo | in attesa |
| V4 | 🔴 **I due pulsanti di MEMO vanno rifatti: la cura del 29/08 non è bastata.** Sue parole del 30/08 dopo averli guardati: sono rimasti «in fondo alla schermata, attaccati» — lo stacco portato da 12 a 13 punti **non è uno stacco**. Vuole: stacco dal bordo di **circa 1 cm vero**, pulsanti **alti circa 1,5 cm veri** (⚠️ in centimetri, non in punti, o sul mini tablet non restano un centimetro), **tutti e due con lo stile scuro pieno di «Premi e parla»**, **scritta più grande**, e **l'emoji della macchina fotografica** accanto a «Fotografa» come il microfono sta accanto all'altro. Il risultato: le due schermate indistinguibili nel gesto — cambia solo la parola e il simbolo. | 30/08/2026 | Sue schermate | fatta · commit del 30/08 (nessuna migrazione) |
| V5 | **La regola dell'azione principale in `DECISIONI.md` va completata con QUANTO VALE LO STACCO e QUANTO È ALTO il pulsante.** Senza quei due numeri la prossima schermata rinasce con 13 punti. | 30/08/2026 | Sua richiesta | fatta · commit del 30/08 (nessuna migrazione) |
| V3 | **La funzione online della voce (`ascolta-voce`) non è installata da nessuna parte.** Il database sa già eseguire il tipo nuovo, ma finché quella funzione non viene installata il modello non lo produce mai. Va installata dopo un push, insieme alle migrazioni. | 29/08/2026 | Blocco 3 del 29/08 | in attesa |

---

## Produzioni

| # | Richiesta | Chiesta il | Da dove viene | Stato |
|---|---|---|---|---|
| P1 | **Il modulo di registrazione non deve più essere sempre aperto.** Toccare una preparazione la mette solo nella lista delle cose da fare; il modulo si apre **solo** da «Registrala», con la preparazione già scelta. Oggi i due gesti si confondono, e la schermata è lunga anche quando stai solo guardando. | 30/08/2026 | L'ha aperta lui il 30/08 | in attesa |
| P2 | **«Registrala» deve fare quello che dice**: aprire il modulo. Oggi prometteva di registrare mentre portava a un modulo già aperto sotto. Non va rinominato, va fatto. | 30/08/2026 | Sua decisione | in attesa |
| P3 | **«Da fare» diventa una sezione sua in cima** — un titoletto «Da fare (3)» coi quadrotti sotto, e l'elenco completo delle preparazioni più giù. Oggi è incollata sopra il modulo e i due sembrano lo stesso gesto. | 30/08/2026 | Sua decisione | in attesa |
| P4 | **L'elenco delle preparazioni in quadrotti SIA su telefono SIA su computer** — e qui il computer non fa eccezione: quell'elenco non ha colonne da confrontare, ha un nome e tre informazioni in fila. | 30/08/2026 | Decisione esplicita sua | in attesa |
| P5 | ⚠️ **Da misurare, non da correggere alla cieca**: su «Busiate trafilate» lo storico dice «costata 0,00 €». O quella ricetta non ha ingredienti prezzati, o il costo si perde per strada. Se è un dato vero, **quello zero deve dirlo** invece di sembrare un prezzo. | 30/08/2026 | Sua osservazione | in attesa |
| P6 | ⚠️ **Resta com'è e non si tocca**: la ricerca, l'ordine alfabetico, lo storico dentro ogni voce e «Rendila ricorrente». *«La schermata è carina sia su pc che su cell»*: si sistema, non si rifà. | 30/08/2026 | Sua decisione | scartata da Alessio |

---

## Agenda

| # | Richiesta | Chiesta il | Da dove viene | Stato |
|---|---|---|---|---|
| A1 | ✅ **RIEMPITA IL 30/08, da lui.** Era: **quadrotti al posto delle righe** (il testo andava a capo cinque volte, «rimanda» stava in tre posizioni diverse); **la stella porta l'impegno in cima** e la si accende toccandola; **le stellate sempre in testa**, il resto raccolto sotto un titoletto «in ritardo (14)» che si apre e si chiude; e **resta l'impegno che nasce da solo da una fattura archiviata**, che è il motivo per cui l'Agenda esiste. | 29/08/2026, descritta il 30/08 | Nominata da lui, poi decisa | fatta · commit del 30/08 (nessuna migrazione) |
| A2 | **`tasks` non sa quando un impegno è stato fatto**: la sezione «Fatti di recente» mostra l'ultima volta che qualcuno ha toccato la riga, che è un'altra domanda. In quella tabella ci sono gli adempimenti societari con importi e codici F24. | 14/08/2026 | Debito dichiarato dal validatore | in attesa · *da confermare* |

---

## Cassa, fatture e fisco

| # | Richiesta | Chiesta il | Da dove viene | Stato |
|---|---|---|---|---|
| C1 | **Finanziamenti da terzi dentro «Ce la faccio?».** | prima del 19/08/2026 | `CODA_E_DECISIONI.md` | in attesa |
| C2 | **Il caricamento dell'estratto conto**, rinviato da lui finché non sceglie la banca. | 15/08/2026 | Blocco 6 del mandato personale e tesoreria | in attesa |
| C3 | **Il simulatore col registratore fiscale virtuale**: prima si guarda cosa succede, poi si decide. | prima del 19/08/2026 | `CODA_E_DECISIONI.md` | in attesa |

---

## Moduli nuovi

| # | Richiesta | Chiesta il | Da dove viene | Stato |
|---|---|---|---|---|
| N1 | **Casella dedicata e mail dei clienti dentro il gestionale.** | prima del 19/08/2026 | `CODA_E_DECISIONI.md` | in attesa |
| N2 | **Sito web**, dopo l'app, col gestionale spostato su un sottodominio. | prima del 19/08/2026 | `CODA_E_DECISIONI.md` | in attesa |
| N3 | **Autoprodotti in magazzino e raccolta propria col registro HACCP** — rimandati da lui all'apertura dell'azienda agricola. | prima del 19/08/2026 | `CODA_E_DECISIONI.md` | in attesa (rimandata da lui) |
| N4 | **Cantina e bevande** con la stessa macchina del magazzino: mescita al calice, «bottiglia aperta» e «bottiglia buttata», inventario ogni 3 mesi con lo scostamento in bottiglie e in euro. | 14/08/2026 | Blocco 3 del mandato cumulativo | in attesa |
| N5 | **Fatture in Cloud nelle due direzioni** (prerequisito suo: piano Complete e accesso). | 14/08/2026 | Blocco 4 del mandato cumulativo | in attesa (aspetta lui) |
| N6 | **La tracciabilità va sotto HACCP e guarda a valle**: dato un lotto, dove è finito — quali giorni, quali piatti, quali conti. | 14/08/2026 | Blocco 6 del mandato cumulativo | in attesa |
| N7 | **Il costo del personale e i premi** — la voce di spesa più grossa dell'anno non passa da nessun modulo. Fermo in attesa dei documenti veri di Gianna. | 15/08/2026 | Blocchi 1 e 2 del mandato personale e tesoreria | in attesa (aspetta Gianna) |
| N8 | **Il simulatore di assunzione**: costo dal livello CCNL, non da un lordo digitato. | 15/08/2026 | Blocco 4 dello stesso mandato | in attesa |

---

## Registro delle cancellazioni

| # | Richiesta | Chiesta il | Da dove viene | Stato |
|---|---|---|---|---|
| D1 | **Tre tabelle restano da decidere** se entrano nel registro: `price_history` (il mandato dice di non deciderla da lì), `reservation_deposits` (non ha una colonna `id` e sparisce a cascata con la pulizia della privacy), `order_tables` (non ha una chiave primaria vera). | 29/08/2026 | Blocco 5 del 29/08 | in attesa |

---

## Chiuse di recente — restano scritte

| # | Richiesta | Chiusa da |
|---|---|---|
| X1 | **Sul telefono l'app si ricarica e perde quello che si sta scrivendo.** | 29/08/2026 — commit `af797e2` |
