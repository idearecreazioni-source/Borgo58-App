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
* 🔴 **E poi lancia `npm run richieste`**, che rifà il conteggio dalle righe.
  Il gancio prima del commit lo controlla da sé: non è una cosa da ricordare.
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

**Gli stati sono QUATTRO, ed è un vocabolario chiuso:** `in attesa` ·
`in corso` · `fatta` · `scartata da Alessio`. 🔴 **Il dettaglio va DOPO il
«·», mai dentro lo stato**: «fatta a metà» e «in attesa (aspetta Gianna)»
sono stati inventati, e una riga in uno stato inventato **sparisce dal
conteggio** senza che nessuno lo veda. Si scrive `fatta · solo la parte X`,
non `fatta a metà`.

**La colonna «Quando»** dice se una richiesta aperta `si può fare adesso`
oppure `aspetta` qualcun altro. Su una riga chiusa o scartata si scrive `—`.

🔴 **Il conteggio in fondo a questa sezione lo genera `npm run richieste`.**
Non si scrive a mano: se una riga porta uno stato che non esiste, il comando
si ferma e la nomina invece di indovinare, e una prova automatica diventa
rossa se qualcuno aggiunge una richiesta e dimentica il comando.

### Quante sono

<!-- CONTEGGIO: generato da `npm run richieste`, non si scrive a mano -->

**105 richieste in tutto**, e ognuna sta in uno dei quattro stati:
**16 in attesa** · **5 in corso** · **79 fatte** · **5 scartate da lui**.
La somma fa **105**, cioè il numero delle righe: se non tornasse, questo
conteggio non verrebbe nemmeno generato.

Delle **21** ancora aperte, **2** si possono fare adesso e
**19** aspettano qualcun altro (un consulente, la banca, un
abbonamento, o un blocco che vuole una sessione sua).

<!-- FINE CONTEGGIO -->

🔴 **PERCHÉ IL CONTEGGIO NON SI SCRIVE PIÙ A MANO.** Il 30/08 Alessio ha
misurato che le righe-richiesta erano **51** e i tre gruppi del conteggio ne
contavano **50**. Quella che sfuggiva era **T1**, perché portava «fatta a
metà» — uno stato che non è fra i quattro. ⚠️ **Una richiesta in uno stato
inventato è invisibile al conteggio**, ed è la stessa perdita per cui questo
file esiste.

⚠️ **E il difetto era più largo della riga trovata**: contando gli stati veri
ne sono usciti **otto** dove ne erano dichiarati quattro. Adesso lo stato è un
**vocabolario chiuso**, il dettaglio sta dopo il «·», e `npm run richieste`
rigenera il conteggio leggendo le righe. Se una riga porta uno stato che non
esiste, il comando **non prova a indovinare**: si ferma e la nomina. E una
prova automatica (`tests/unita/indice-richieste.test.js`) diventa rossa da
sola se qualcuno aggiunge una riga e dimentica il comando.

⚠️ **La colonna «Quando»** — chiesta da Alessio il 30/08 — dice se una
richiesta aperta **si può fare adesso** o se **aspetta** qualcun altro (un
consulente, la banca, un abbonamento, una sua decisione). Serve perché le più
vecchie stanno in cima, e le più vecchie sono spesso proprio quelle che
aspettano: chi apre il file per «prendere la più vecchia» trovava quelle.

⚠️ **Il numero resta un PAVIMENTO, non un censimento.** Sono le richieste che
si sono potute trovare **scritte** nei riepiloghi, nei mandati e nella coda:
quelle dette solo a voce, o in chat cancellate, non ci sono, e non c'è modo di
sapere quante siano. **La A1 è la prova che ne mancano**: si sapeva che
esisteva perché l'aveva nominata lui, e non si sapeva cosa fosse.
### Che differenza c'è con gli altri tre file

| file | risponde a |
|---|---|
| [`DECISIONI.md`](DECISIONI.md) | *cosa vale adesso* — le scelte in vigore |
| [`CODA_E_DECISIONI.md`](CODA_E_DECISIONI.md) | *cosa va costruito e in che ordine* — coda tecnica, scritta per chi lavora |
| [`decisioni_rovesciate.md`](decisioni_rovesciate.md) | *cosa è cambiato* e quante volte |
| **questo** | *cosa mi ha chiesto Alessio e non è ancora fatto* |

---

## Aspetto del gestionale

| # | Richiesta | Chiesta il | Da dove viene | Quando | Stato |
|---|---|---|---|---|---|
| U1 | **Restyling e controllo estetico di tutto il gestionale**, partendo da un censimento visivo delle parti comuni (intestazioni, filtri, moduli, pulsanti, riquadri, tabelle, avvisi, menu) e correggendo le regole condivise, col prima/dopo misurato. **La palette nuova si prova prima sulla sola Dashboard**: beige di fondo più chiaro, il verde del logo per le azioni principali e gli stati positivi, la terracotta solo come accento. Si estende al resto solo dopo il suo ok. | 11/10/2026 | [relazione dell'11/10](proposte/20261011_le_migliorie_ancora_aperte.md) | si può fare adesso | in corso · fatta solo la PROVA DELLA PALETTE sulla Dashboard (proposta #177): fondo più chiaro, verde del logo `#577632` per azioni, elemento attivo e stati positivi. Aspetta il suo giudizio prima di estenderla. Il censimento estetico delle parti comuni è ancora da fare |
| U2 | **I 18 ritocchi di forma del controllo visivo del 25/10**: via «Media» dagli impegni, bollino «Urgente» solo sulle priorità alte, Prima nota senza «Contante in cassa», pulsanti per caricare un file in verde, titoli uniformati. La voce 16 («task» diventa «impegno») è ritirata: il «task» resta. | 25/10/2026 | Sua risposta «1 tutti» (riepilogo `docs/consegne/20261025_i_ritocchi_di_forma.md`) | — | fatta · commit `e3f15ae` (voci 1-18), più `264c77e`, `81a0b24`, `2781fe2`, `98180b1`, su `master`. Nessuna migrazione |

---

## Sala, pianta e Comande

| # | Richiesta | Chiesta il | Da dove viene | Quando | Stato |
|---|---|---|---|---|---|
| S1 | **Quando due prenotazioni cadono sullo stesso tavolo, il tavolo si vede a due colori.** Oggi il doppio colore si accende solo se le due prenotazioni sono in fasce diverse: mettendone tre alla stessa ora non succede niente. E servono più di due tinte per dire che sono tre — due tinte dicono «due». | 29/08/2026 | Provato da lui sulla pianta. **Era già stato deciso in una chat passata e non era mai arrivato in un mandato: è la richiesta che ha fatto nascere questo file.** | — | fatta · commit del 30/08 (nessuna migrazione) |
| S2 | **Quando il gestionale non sa in che fascia cade una prenotazione, non deve metterla in mezzo.** Oggi «non lo so» e «è del turno centrale» hanno lo stesso identico colore. Succede a locale funzionante ogni volta che qualcuno prenota prima dell'orario di apertura (misurato su una prenotazione delle 19:29 con apertura alle 20:00). | 29/08/2026 | Due schermate sue | — | fatta · migrazione `20260829000026` |
| S3 | **Il riquadro delle informazioni in alto a destra della pianta ha una misura fissa mentre la pianta si adatta**: *«troppo grande da cellulare e troppo piccolo da pc»*. Sulla sua schermata «BASE-Tavolo …» è tagliato a metà e il riquadro copre la pianta invece di starle accanto. | 29/08/2026 | Sue parole | — | fatta · commit del 30/08 (nessuna migrazione) |
| S4 | **La legenda dei colori dev'essere scritta dentro il gestionale**, raggiungibile dalla pianta. Oggi non esiste in nessun posto: serve a lui adesso e servirà a chi lavorerà in sala. | 29/08/2026 | Mandato del 29/08 | — | fatta · commit di stanotte |
| S8 | **Il nome del tavolo nel riquadro delle informazioni resta INTERO E PICCOLO** (3,2 mm) invece che grande e tagliato: *un nome tagliato in servizio non si legge comunque*. | 30/08/2026 | Sua scelta fra le due strade | — | fatta · commit del 30/08 (nessuna migrazione) |
| S5 | **Le due colonne sulla schermata della sala, sul computer.** | prima del 21/08/2026 | `CODA_E_DECISIONI.md` | si può fare adesso | scartata da Alessio · 13/10/2026, dopo aver visto uno schizzo che diceva per errore «oggi è una colonna sola»: ⚠️ **era già costruita il 21/09** (commit `336b1ee`, `salaAffiancata()`). Tolta dal codice lo stesso giorno su sua richiesta («toglile»): rovesciamento n. 101 |
| S6 | **Un tavolo con due turni dentro il riquadro del tavolo.** | 18/08/2026 | Riepilogo del giro D3 | aspetta | in attesa · *da confermare* |
| S7 | **Il coperto in meno per il tavolo contro il muro.** | 18/08/2026 | Chiesta e poi **ritirata da lui** lo stesso giorno (*«è già fantastica così»*): la correzione a mano copre già il caso. | — | scartata da Alessio |

---

## Ricettario e menu

| # | Richiesta | Chiesta il | Da dove viene | Quando | Stato |
|---|---|---|---|---|---|
| R1 | **Il tipo di ricetta non si sceglie più: lo dice il posto da cui entri.** Via la schermata dei tre pulsanti; da «Piatti» si va dritti alla scheda di un piatto, da «Preparazioni» a quella di una preparazione. | 29/08/2026 | Struttura decisa da lui | — | fatta · commit del 30/08 (nessuna migrazione) |
| R2 | **Nella sezione Finger, un selettore fra «singoli finger» e «piatti composti da finger»**, col pulsante di creazione che si adatta. | 29/08/2026 | Struttura decisa da lui | — | fatta · commit del 30/08 (nessuna migrazione) |
| R3 | **Il piatto composto da finger non è una ricetta**: non ha ingredienti, né fasi, né scarto — ha solo un elenco di finger da metterci dentro. Oggi una ricetta di tipo Finger contiene una sezione «Finger» con «Cerca un finger…», cioè un finger che cerca sé stesso. | 29/08/2026 | Sua schermata | — | fatta · commit del 30/08 (nessuna migrazione) |
| R4 | **Il prezzo del piatto composto lo scrive lui**: il gestionale mostra la somma dei costi dei finger dentro e non calcola il prezzo di vendita. *Un tagliere di quattro pezzi non costa quattro volte il pezzo.* | 29/08/2026 | Decisione esplicita sua | — | fatta · commit del 30/08 (nessuna migrazione) |
| R5 | **Le parole devono seguire il tipo**: su una ricetta di tipo Finger il titolo dice «Dove è usata questa PREPARAZIONE». | 29/08/2026 | Sua schermata | — | fatta · commit del 30/08 (nessuna migrazione) |
| R6 | **L'avviso «non ha ancora un food cost» non è rosso su una ricetta appena creata.** Resta, ma diventa rosso e bloccante solo quando si prova a mandare il piatto in carta. *Un piatto senza food cost è un problema il giorno che va sul menu, non il giorno che lo inventi.* | 29/08/2026 | Decisione esplicita sua | — | fatta · commit del 30/08 (nessuna migrazione) |
| R7 | **«Descrizione per il menu» è tagliata**: il testo d'esempio finisce fuori dal riquadro a metà parola. | 29/08/2026 | Sua schermata | — | fatta · commit del 30/08 (nessuna migrazione) |
| R8 | **Le tabelle degli ingredienti dentro una ricetta scorrono di lato**: «Rimuovi» tagliato a metà su tutte le righe, «% scarto» a capo nell'intestazione, il «kg» sotto la quantità invece che accanto. | 29/08/2026 | Sua schermata | — | fatta · commit del 30/08 (nessuna migrazione) |
| R9 | **«Salva modifiche» sta schiacciato in un angolo a metà schermata**, con roba da compilare ancora sopra. | 29/08/2026 | Sua schermata | — | fatta · commit del 30/08 (nessuna migrazione) |
| R10 | **Via la spunta «Guarnizione opzionale (esclusa dal food cost)».** | 29/08/2026 | Decisione esplicita sua | — | fatta · migrazione `20260829000023` |
| R11 | **Estrazione ricette col pulsante «estrapola»**, con aiuto alla lista della spesa. | prima del 19/08/2026 | `CODA_E_DECISIONI.md` | — | fatta · proposta #177 (sul gestionale vero), migrazione `20261011000001` (in produzione). Si scelgono ricette e bozze con le porzioni, la proposta consolida per prodotto e unità con le ricette da cui viene, dice cosa non sa, e in lista entra solo ciò che si tiene |
| R12 | **La resa al posto dello scarto standard**: lo scarto è una proprietà della coppia ingrediente × preparazione, non dell'ingrediente. La resa vive sulla riga di ricetta, espressa in lordo → netto («1,5 kg di cozze danno 400 g»), non in percentuale. | 14/08/2026 | Blocco 5 del mandato cumulativo | — | fatta · ricontrollato l'11/10/2026: le migrazioni `20260922000001` e `20260923000002` sono su `master` |
| R13 | **La scheda dell'ingrediente diventa il posto unico.** Dichiarata non aperta il 29/08: è l'unico punto del suo blocco senza una misura sotto, e prima di riorganizzarla va deciso cosa ci finisce dentro. | 29/08/2026 | Blocco 2 del mandato del 29/08 | aspetta | in attesa |
| R14 | **La bozza di ricetta in una schermata sola**: la scheda leggibile diventa anche quella in cui si corregge, e il modulo a parte sparisce. | 11/10/2026 | Sua richiesta in chat | — | fatta · proposta #177, sul gestionale vero |
| R15 | **Le ricette si catalogano senza collegare il magazzino.** Un ingrediente non ancora collegato resta a parte nella ricetta; il collegamento diventa obbligatorio solo quando la ricetta va in carta, in un menu o come preparazione. «Bozze di ricetta» diventa «Bozze». | 25/10/2026 | Sua richiesta (riepilogo `docs/consegne/20261025_le_ricette_si_catalogano_senza_magazzino.md`) | — | fatta · commit `6053af43` e `430b12b` (su `master`), migrazione `20261025000020`; applicazione in produzione non verificata da qui |
| R16 | **Le 14 ricette di esempio si tolgono**, con il menu «Carta di prova» e i 2 conti di prova che le usano. Le sue tre bozze restano. | 25/10/2026 | Sua decisione («le 14 ricette le puoi togliere») | — | fatta · commit `0be10172` (su `master`), migrazione `20261025000021`; il riepilogo dice che il ramo che cancella non è mai girato sulla prova, e la produzione non è verificata da qui |
| R17 | **Le frazioni «1⁄2» e «½» nelle ricette importate da un link diventano quantità**, e «millilitro», «centilitro», «etto» diventano litri e chili. | 25/10/2026 | Difetto trovato sui dati di produzione con una ricetta importata da un link (riepilogo `docs/consegne/20261025_le_frazioni_di_clove.md`); chi l'ha segnalato non è scritto lì: da confermare | — | fatta · commit `7a0e655` (su `master`), nessuna migrazione |

---

## Materiali di consumo

| # | Richiesta | Chiesta il | Da dove viene | Quando | Stato |
|---|---|---|---|---|---|
| M1 | **Sulla scheda di un materiale di consumo spariscono cinque campi**: «Fotografa l'etichetta», «Provenienza» con «Produzione interna (orto)», «Conservazione» (e con essa l'etichetta gialla «messo dalla macchina»), e — la più importante — **«È un alimento»**, che è la casella con cui la carta forno tornerebbe in mezzo al baccalà. | 29/08/2026 | Sua schermata («Carta forno») | — | fatta · commit di stanotte |
| M2 | **Categorie e unità di misura proprie dei materiali**, al posto di quelle alimentari (oggi la carta forno è in categoria «Altro»). Ha chiesto esplicitamente che le proponga io e che lui le corregga leggendo. | 29/08/2026 | Sua richiesta | — | fatta · migrazione `20260829000024` |
| M4 | **«Imballaggi e asporto» diventa «Varie ed eventuali»** — l'asporto non lo farà. Le altre cinque categorie dei materiali vanno bene così. | 30/08/2026 | Sua decisione dopo aver guardato le sei proposte | — | fatta · migrazione `20260830000001` |
| M5 | **Via «Altro» dai materiali di consumo**: «Varie ed eventuali» e «Altro» sono la stessa idea in due posti, e «Altro» è pure condiviso con gli alimenti. Ne resta uno solo, il suo. | 30/08/2026 | Sua approvazione di una mia proposta | — | fatta · migrazione `20260830000003` |
| M3 | ⚠️ **Restano e sono giusti**: scorta minima, «avvisami se il prezzo sale», il fornitore. E **i valori senza senso rimasti** («tutto l'anno», «temperatura ambiente») **non si cancellano**: sono solo sul progetto di prova e spariranno col reset. | 29/08/2026 | Sua decisione | — | scartata da Alessio |

---

## MEMO (foto e voce)

| # | Richiesta | Chiesta il | Da dove viene | Quando | Stato |
|---|---|---|---|---|---|
| V1 | **I due pulsanti «Fotografa» e «Premi e parla» vanno in fondo, larghi quanto lo schermo, staccati dal bordo, alla stessa altezza in tutte e due le schermate.** Oggi «Premi e parla» è attaccato al bordo inferiore (dove su iPhone c'è la barra di sistema) e «Fotografa» è in basso a sinistra, largo un terzo — il punto più scomodo con una mano sola, che è come tiene il telefono mentre l'altra regge la confezione. | 29/08/2026 | Sue schermate | — | fatta · commit `8a58cab` |
| V2 | **La conferma parlata dell'allineamento a voce.** Dettare una giacenza funziona già; quello che manca è che MEMO risponda **a voce**. Dichiarato non fatto il 29/08 per una ragione onesta: in questo ambiente non c'è un orecchio che possa provarla. | 14/08/2026 | Blocco 2 del mandato cumulativo | — | fatta · proposta #177 (sul gestionale vero): dopo una giacenza dettata MEMO ripete a voce la riga dello schermo (o il rifiuto), si spegne con una casella. ⚠️ **Non provata su un telefono vero**: la voce è del browser, e su iPhone parte solo se sbloccata dal tocco del microfono |
| V4 | 🔴 **I due pulsanti di MEMO vanno rifatti: la cura del 29/08 non è bastata.** Sue parole del 30/08 dopo averli guardati: sono rimasti «in fondo alla schermata, attaccati» — lo stacco portato da 12 a 13 punti **non è uno stacco**. Vuole: stacco dal bordo di **circa 1 cm vero**, pulsanti **alti circa 1,5 cm veri** (⚠️ in centimetri, non in punti, o sul mini tablet non restano un centimetro), **tutti e due con lo stile scuro pieno di «Premi e parla»**, **scritta più grande**, e **l'emoji della macchina fotografica** accanto a «Fotografa» come il microfono sta accanto all'altro. Il risultato: le due schermate indistinguibili nel gesto — cambia solo la parola e il simbolo. | 30/08/2026 | Sue schermate | — | fatta · commit del 30/08 (nessuna migrazione) |
| V5 | **La regola dell'azione principale in `DECISIONI.md` va completata con QUANTO VALE LO STACCO e QUANTO È ALTO il pulsante.** Senza quei due numeri la prossima schermata rinasce con 13 punti. | 30/08/2026 | Sua richiesta | — | fatta · commit del 30/08 (nessuna migrazione) |
| V3 | **La funzione online della voce (`ascolta-voce`) non è installata da nessuna parte.** Il database sa già eseguire il tipo nuovo, ma finché quella funzione non viene installata il modello non lo produce mai. Va installata dopo un push, insieme alle migrazioni. | 29/08/2026 | Blocco 3 del 29/08 | — | fatta · 🔴 **la riga era invecchiata: misurato il 31/08, `ascolta-voce` è installata dal 29/08 (versione 2)** e il deploy è posteriore all'ultimo commit del file — 15:24 UTC contro 14:09. Cioè era già chiusa e nessuno l'aveva segnata |
| V6 | **MEMO controlla e i difetti arrivano a Claude**: un quaderno dei difetti dentro il gestionale (solo titolare, niente GitHub perché il repository è pubblico), raccolto ogni sera; poi MEMO che controlla da sé cosa non torna e propone correzioni. Piano a tappe nell'artifact del 25/10. | 25/10/2026 | Sue parole nel thread «MEMO che controlla» | si può fare adesso | in corso · fatta la TAPPA 1, il quaderno (migrazione `20261025000002`, pulsante «Segnala», schermata *Segnalazioni*). Restano la raccolta serale (tappa 2), i controlli (tappa 4) e le correzioni proposte (tappa 5) |
| V7 | **MEMO voce non più rigido: che capisca tutto ciò che gli dice come se lo dicesse a Claude** — memoria degli ultimi minuti, domande di chiarimento, letture libere del gestionale, sempre conferma prima di scrivere. | 25/10/2026 | Sue parole nel thread «MEMO che controlla» | aspetta | in corso · su `master` ci sono la memoria degli ultimi minuti, le correzioni a voce, lo stesso prodotto detto due volte, i prestiti a voce e le operazioni imparate dal database (migrazioni `20261025000003`→`…000005` e `…000041`→`…000043`). Il rilascio del 26/10 si è fermato al controllo delle migrazioni, e l'esito dopo non è nei documenti. Non verificato: le letture libere del gestionale. Prima di accenderla va riferito quanto costa |
| V8 | **La spesa spicciola detta a MEMO si scrive da sé**, senza approvazione, quando MEMO è sicuro e non manca niente. Il resto aspetta come prima. | 19/10/2026 | Richiesta di Alessio (riepilogo `docs/consegne/20261019_la_spesa_spicciola_si_scrive_da_se.md`) | — | fatta · commit `aea6512c`, `68fc1686`, `18568f4a` (su `master`), migrazioni `20261019000001` e `20261019000002`. La voce non è stata provata col microfono (riepilogo del 19/10) |
| V9 | **MEMO foto: niente riquadro vuoto sul telefono, e il «?» accanto a ciò che spiega.** | 25/10/2026 | Due schermate di Alessio, telefono e computer | — | fatta · commit `ef6831c` (su `master`), nessuna migrazione. La striscia verde del titolo è su `master` (`10de1fa`), ma non è stata vista sull'app installata |
| V10 | **La voce si chiude insieme al dato: prima nota e spesa spicciola nello stesso passo (lotto 1).** | da confermare | Titolo della PR #239; nessun riepilogo in `docs/consegne/` ancora | aspetta | in corso · PR #239 aperta verso `slave` (ramo `claude/voce-una-transazione`), non unita |

---

## Produzioni

| # | Richiesta | Chiesta il | Da dove viene | Quando | Stato |
|---|---|---|---|---|---|
| P1 | **Il modulo di registrazione non deve più essere sempre aperto.** Toccare una preparazione la mette solo nella lista delle cose da fare; il modulo si apre **solo** da «Registrala», con la preparazione già scelta. Oggi i due gesti si confondono, e la schermata è lunga anche quando stai solo guardando. | 30/08/2026 | L'ha aperta lui il 30/08 | — | fatta · commit del 30/08 (nessuna migrazione) |
| P2 | **«Registrala» deve fare quello che dice**: aprire il modulo. Oggi prometteva di registrare mentre portava a un modulo già aperto sotto. Non va rinominato, va fatto. | 30/08/2026 | Sua decisione | — | fatta · commit del 30/08 (nessuna migrazione) |
| P3 | **«Da fare» diventa una sezione sua in cima** — un titoletto «Da fare (3)» coi quadrotti sotto, e l'elenco completo delle preparazioni più giù. Oggi è incollata sopra il modulo e i due sembrano lo stesso gesto. | 30/08/2026 | Sua decisione | — | fatta · commit del 30/08 (nessuna migrazione) |
| P4 | **L'elenco delle preparazioni in quadrotti SIA su telefono SIA su computer** — e qui il computer non fa eccezione: quell'elenco non ha colonne da confrontare, ha un nome e tre informazioni in fila. | 30/08/2026 | Decisione esplicita sua | — | fatta · commit del 30/08 (nessuna migrazione) |
| P5 | ⚠️ **Da misurare, non da correggere alla cieca**: su «Busiate trafilate» lo storico dice «costata 0,00 €». O quella ricetta non ha ingredienti prezzati, o il costo si perde per strada. Se è un dato vero, **quello zero deve dirlo** invece di sembrare un prezzo. | 30/08/2026 | Sua osservazione | — | fatta · migrazioni `20260830000004` e `20260830000005` — 🔴 **misurato, e non era nessuna delle due ipotesi**: il costo vero era **0,0034 €** (scritto «0,00 €») e **405 g di farina** erano usciti da un lotto **senza prezzo d'acquisto**, quindi contati zero. Curati tutti e due |
| P6 | ⚠️ **Resta com'è e non si tocca**: la ricerca, l'ordine alfabetico, lo storico dentro ogni voce e «Rendila ricorrente». *«La schermata è carina sia su pc che su cell»*: si sistema, non si rifà. | 30/08/2026 | Sua decisione | — | scartata da Alessio |

---

## Agenda

| # | Richiesta | Chiesta il | Da dove viene | Quando | Stato |
|---|---|---|---|---|---|
| A1 | ✅ **RIEMPITA IL 30/08, da lui.** Era: **quadrotti al posto delle righe** (il testo andava a capo cinque volte, «rimanda» stava in tre posizioni diverse); **la stella porta l'impegno in cima** e la si accende toccandola; **le stellate sempre in testa**, il resto raccolto sotto un titoletto «in ritardo (14)» che si apre e si chiude; e **resta l'impegno che nasce da solo da una fattura archiviata**, che è il motivo per cui l'Agenda esiste. | 29/08/2026, descritta il 30/08 | Nominata da lui, poi decisa | — | fatta · commit del 30/08 (nessuna migrazione) |
| A2 | **`tasks` non sa quando un impegno è stato fatto**: la sezione «Fatti di recente» mostra l'ultima volta che qualcuno ha toccato la riga, che è un'altra domanda. In quella tabella ci sono gli adempimenti societari con importi e codici F24. | 14/08/2026 | Debito dichiarato dal validatore | aspetta | in attesa · *da confermare* |
| A3 | **«Lavori da fare» ha una sezione sua in Agenda**: un impegno con la casella «È un lavoro da fare» finisce lì. | 15/10/2026 | Sua richiesta del 15/10, scritta nel commento di `src/lib/calcoli/agenda.js` | — | fatta · commit `40a7d1f` (su `master`), migrazione `20261015000001`, che il riepilogo del 25/10 colloca fra le 421 già applicate in produzione |
| A4 | **Un impegno scritto a mano nasce senza la spunta «Visibile allo staff»**: per renderlo visibile allo staff bisogna metterla. Gli impegni già scritti tengono il loro valore; quelli automatici e quelli scritti dallo staff non cambiano. | 15/10/2026 | Sua domanda in chat del 15/10 (rovesciamento n. 103 in `docs/decisioni_rovesciate.md`) | — | fatta · commit `4a458b2c` (su `master`), nessuna migrazione |

---

## Cassa, fatture e fisco

| # | Richiesta | Chiesta il | Da dove viene | Quando | Stato |
|---|---|---|---|---|---|
| C1 | **Finanziamenti da terzi dentro «Ce la faccio?».** | prima del 19/08/2026 | `CODA_E_DECISIONI.md` | aspetta | in attesa |
| C2 | **Il caricamento dell'estratto conto**, rinviato da lui finché non sceglie la banca. | 15/08/2026 | Blocco 6 del mandato personale e tesoreria | — | fatta · dal 24/10 l'estratto conto si carica da file (flusso CBI Credem, vedi C14). Il collegamento diretto con la banca non c'è: nel riepilogo del 24/10 la banca non aveva ancora detto se esiste un'API |
| C3 | **Il simulatore col registratore fiscale virtuale**: prima si guarda cosa succede, poi si decide. | prima del 19/08/2026 | `CODA_E_DECISIONI.md` | aspetta | in attesa |
| C10 | 🔴 **LA TASCA: un terzo soggetto accanto a Borgo 58 e Orto Borgo 58.** Alessio tiene contanti suoi e ci compra roba per il progetto **senza fattura**. Non è deducibile e lui non la dichiara: vuole solo saperne il conto. Registra **solo uscite**, l'unica regola ammessa è «Indeducibile», e resta fuori dalla proiezione fiscale **per costruzione**. | 30/08/2026 | Sua decisione | — | fatta · migrazione `20260830000012` |
| C4 | 🔴 **Il pulsante «il cliente vuole fattura» in Comande.** Lo stato `fattura_da_emettere` **esiste già** nel database ed è **già isolato nei conteggi** — ma **dalla sala non lo si raggiunge**: manca il gesto alla chiusura del conto, e manca la strada per chiuderlo quando la fattura viene emessa. *Un cliente che chiede la fattura al tavolo è un caso normale, e oggi in sala non c'è niente da premere.* ⚠️ **Il testo qui sopra è dell'origine e dal 31/08 non è più vero**: il gesto in sala c'è, e da *Cassa → Incassato e scontrinato* il conto si chiude col numero vero. Restava scoperto il resto — vedi la colonna di stato. | 30/08/2026 | Sua richiesta | si può fare adesso | fatta · gesto in sala dal 31/08; il 22/09 la spunta è stata spostata SOPRA «Paga contante» (stava sotto, contro quel che dichiarava) e messa sotto prove |
| C5 | **La chiusura dell'anno fiscale, con avviso se restano conti senza documento.** Riusa il meccanismo delle chiusure mensili, che esiste già e tiene lo storico delle chiusure precedenti senza riscrivere il passato. | 30/08/2026 | Sua richiesta | — | fatta · ricontrollato l'11/10/2026: le migrazioni `20260923000003` e `20260923000004` sono su `master`. ⚠️ C6 e C7 restano a parte, come prima |
| C6 | **Produrre per la commercialista ciò che solo il gestionale ha**: valore del magazzino al 31/12, elenco dei beni durevoli comprati, conti senza documento, merce ricevuta senza fattura. ⚠️ **NIENTE ratei e risconti**: scartati da lui perché costerebbero un campo in più a ogni movimento, per sempre. | 30/08/2026 | Sua richiesta, coi confini messi da lui | aspetta | in attesa · la forma la deve dire la commercialista (quesito L22) |
| C7 | **Caricare la chiusura ufficiale della commercialista per il confronto — SOLO SUI RICAVI.** ⚠️ **Non su tutta la chiusura**, ed è una sua decisione con la ragione dentro: competenza e cassa **non coincidono per costruzione**, e uno strumento che segnala quella differenza insegna a ignorare gli avvisi. Da costruire **quando avrà in mano il primo documento vero**, non prima. | 30/08/2026 | Sua decisione | aspetta | in attesa · aspetta il primo documento vero della commercialista |
| C8 | 🔴 **Il collegamento al registratore telematico deve arrivare PRIMA dell'apertura.** Aperto il 19/08 e col suo mandato dal 20/08 (`docs/mandati/20260820_il_registratore_telematico.md`); il 30/08 Alessio ne ha **alzato la priorità**. ⚠️ Prima di comprare l'apparecchio va fatta al fornitore la domanda già scritta in `CLAUDE.md` §10 — *sa dire al gestionale che la carta è finita?* — perché quella risposta non si aggiunge dopo. | 19/08/2026, priorità alzata il 30/08 | Mandato del 20/08 + sua decisione | aspetta | in attesa · aspetta la scelta dell'apparecchio |
| C11 | 🔴 **L'ETICHETTA «INVESTIMENTO» E IL COSTO DEL PROGETTO.** Oggi nessun numero dice **quanto è costato mettere in piedi il locale**: `cash_movements` ha 26 colonne e nessuna etichetta, quindi un forno da 6.000 € e una bolletta della luce sono indistinguibili, e il totale più vicino (`rettifiche_fiscali → costi_totali`, in *Fiscale → Deducibilità*) è **per anno civile e per una società sola**, e **esclude la Tasca**. Le decisioni sono già prese e sono quattro: **(a)** è un'**etichetta manuale su ogni uscita di cassa**, non una sezione separata — una sezione creerebbe due verità sulla stessa spesa e andrebbe smontata dopo l'apertura, un'etichetta si smette solo di usare; **(b)** la vista è **divisa per soggetto — Borgo 58, la Tasca, e il totale** — perché *un numero solo direbbe quanto è costato aprire nascondendo chi l'ha pagato*; **(c)** «in cosa» e «con quali soldi» **non vogliono campi nuovi**: la causale e la nota dicono già in cosa, il mezzo e il soggetto dicono già con quali soldi; **(d)** ⚠️ **serve fino a marzo 2027 e poi decade** — non costruirci intorno niente di permanente. ⚠️ **`tag_anticipazioni` NON è il posto**: sono le etichette delle spese che la società *rimborsa*, e un investimento non è un rimborso. 🔴 **Il lavoro era stato cominciato e riportato indietro il 31/08 su sua richiesta** («fermati al primo punto pulito»): migrazione `20260831000012` tolta dal repository, colonna e funzioni a **zero** su prova e produzione, niente lasciato a metà. ⚠️ **E la voce era sparita da ogni coda**: viveva solo dentro il riepilogo del 31/08, che è esattamente il difetto per cui questo file esiste — rimessa qui il 21/09/2026 **senza avviare nessuna implementazione**. Dipendenza: il quesito **L19** alla commercialista (gli acquisti con fattura fatti prima della partita IVA sono recuperabili, e come vanno intestati) cambia cosa può entrare nel totale. | 31/08/2026 | Sua decisione, riportata nei riepiloghi del 31/08 ([la regola della stima](consegne/20260831_la_regola_della_stima.md), Blocco 6 dei [sette mondi](consegne/20260831_i_sette_mondi_e_le_schermate_cieche.md)), in [SPEC-0004](specifiche/SPEC-0004-costo-effettivo-del-progetto.md), e costruita col riepilogo [l'etichetta «investimento»](consegne/20260921_l_etichetta_investimento.md) | — | fatta · ricontrollato l'11/10/2026: la migrazione `20260921000003` è su `master` |
| C9 | ✅ **`conti_senza_documento` non ha il controllo sul titolare nel suo corpo** — vero, **misurato il 30/08**. ⚠️ **Ma non è scoperta, e la cura giusta era già in casa**: **nessun ruolo la può eseguire** (`anon` no, `authenticated` no, `service_role` no), e le due sole funzioni che la chiamano — `conti_da_fiscalizzare` e `registra_conteggio_cassa` — hanno **entrambe** il portiere. È la cura (a) della regola del 27/08: *nessun utente → si chiude la porta, e non serve nessun portiere.* La porta era già chiusa. | 30/08/2026 | Sospetto del mandato, poi misurato | — | fatta · misurata e trovata già chiusa, nessuna modifica |
| C12 | **Le spese «da collocare»**: una spesa detta a MEMO o fotografata, quando mancano le informazioni per registrarla bene, diventa un appunto provvisorio che **non** è contabilità (niente prima nota, Tasca, fisco, rimborsi). Da un elenco separato Alessio la colloca una volta sola: Tasca, prima nota, anticipo/rimborso, Archivio documenti, oppure la ignora. | 11/10/2026 | [relazione dell'11/10](proposte/20261011_le_migliorie_ancora_aperte.md) | — | fatta · migrazione `20261011000002` (in produzione, con `…003` e `…004`) + schermata *Cassa → Da collocare*. Deciso da lui l'11/10: nome «Da collocare»; cinque destinazioni (prima nota, tasca, anticipo, archivio, ignora); la foto resta solo se va in Archivio; **tutte** le spese dette o fotografate passano di qui (rovesciamento n. 99) |
| C13 | **Le fatture elettroniche ricevute entrano dal gestionale**: un file alla volta, o lo zip che Aruba scarica con tutte le fatture. Si registrano per partita IVA, senza doppioni; una fattura intestata a un'altra partita IVA viene respinta. La firma non si verifica: la busta si apre e basta. | 24/10/2026 | Richiesta di Alessio (riepilogo `docs/consegne/20261024_la_banca_e_le_fatture_entrano_da_file.md`) | — | fatta · commit `2737bc8f` e `52062a8f` (su `master`), migrazioni `20261024000001`→`…000003`; in produzione dal 25/10 per il riepilogo |
| C14 | **Il flusso CBI della banca (Credem) entra da file.** Caricare il file non scrive in prima nota; i movimenti si abbinano alle fatture o si registrano da chi conferma. | 24/10/2026 | Stessa richiesta del 24/10 (riepilogo sopra) | — | fatta · commit `2737bc8f` (su `master`), migrazioni `20261024000001`→`…000003`; in produzione dal 25/10 per il riepilogo, con zero movimenti reali caricati (`movimenti_banca` a 0 quel giorno) |
| C15 | **Il tipo di documento «estratto conto»** per le spese della banca: una commissione non è «non documentata», perché così sparirebbe dai deducibili. | 25/10/2026 | Decisione di Alessio del 25/10, dopo la prova (riepilogo sopra) | — | fatta · migrazione `20261025000001`, valore `estratto_conto` in `cash_document_type` (`src/lib/constants.js`); in produzione dal 25/10 per il riepilogo |

---

## Moduli nuovi

| # | Richiesta | Chiesta il | Da dove viene | Quando | Stato |
|---|---|---|---|---|---|
| N1 | **Casella dedicata e mail dei clienti dentro il gestionale.** | prima del 19/08/2026 | `CODA_E_DECISIONI.md` | aspetta | in attesa |
| N2 | **Sito web**, dopo l'app, col gestionale spostato su un sottodominio. | prima del 19/08/2026 | `CODA_E_DECISIONI.md` | aspetta | in attesa |
| N3 | **Autoprodotti in magazzino e raccolta propria col registro HACCP** — rimandati da lui all'apertura dell'azienda agricola. | prima del 19/08/2026 | `CODA_E_DECISIONI.md` | aspetta | in attesa · rimandata da lui all'apertura dell'azienda agricola |
| N4 | **Cantina e bevande** con la stessa macchina del magazzino. | 14/08/2026 | Blocco 3 del mandato cumulativo | — | fatta · **solo la mescita al calice**, migrazione `20260830000002`: i vini sono prodotti del magazzino, l'annata è una confezione, il margine si vede. ⚠️ **NON copriva** «bottiglia aperta»/«bottiglia buttata» né l'inventario trimestrale: sono tornate righe loro, **N9** e **N10** |
| N9 | **«Bottiglia aperta» e «bottiglia buttata»**: i due gesti di sala per il vino che si stappa e per il fondo che si butta. | 14/08/2026 | Blocco 3 del mandato cumulativo, scorporato da N4 il 30/08 | — | fatta · migrazione `20260831000004` + schermata *Magazzino → Cantina*. 🔴 **Rovescia la decisione del 30/08**, su sua richiesta di stanotte: la ragione di allora (l'Allineamento *sistema* una bottiglia mezza vuota) resta vera, ma non **distingue** un fondo buttato da un calice venduto — uno è ricavo, l'altro perdita |
| N12 | 🔴 **Il magazzino si divide in SETTE MONDI**: Alimentari · Vini · Bevande · Liquori e distillati · Materiale di consumo · Pulizia e sanificazione · Varie ed eventuali. Oggi sono due (`alimenti` e `materiali`), e un vino finirebbe dentro «Bevande», in mezzo alla farina e al pesce. | 31/08/2026 | Sua decisione, ordine suo | — | fatta · migrazione `20260831000001` |
| N13 | **L'annata diventa un campo suo**, fuori dalla descrizione della confezione. Con quaranta etichette e due annate dello stesso vino è il motivo per cui la proposta dell'abbinamento sbaglia. Va fatto PRIMA che carichi le etichette: dopo è una rilavorazione. | 31/08/2026 | Sua decisione | — | fatta · migrazione `20260831000002`, e l'ordine al fornitore ora la dice (`20260831000003`) |
| N14 | **Il segno «questo va in carta» sul prodotto.** In magazzino c'è anche il vino da cucina, l'acqua del personale, la birra del bar: sulla carta va solo ciò che si vende al cliente. ⚠️ I sette mondi non bastano — dentro «Vini» ci sono bottiglie che in carta non ci vanno. | 31/08/2026 | Sua decisione | — | fatta · migrazione `20260831000002` |
| N15 | **L'editor della carta dei vini come quello del menu**, e dentro ci va ciò che sta in magazzino ed è segnato «va in carta». ⚠️ Un prodotto NON è una riga di carta: la stessa bottiglia ci sta due volte, al calice e alla bottiglia. | 31/08/2026 | Sua decisione | si può fare adesso | fatta · solo la parte dei prodotti — il menu passa da 116 voci a quelle segnate. ⚠️ **La somiglianza di FORMA con l'editor del menu non è stata fatta** |
| N19 | **L'editor della carta dei vini nella FORMA dell'editor del menu** — la parte di N15 che non è stata fatta. Un prodotto di magazzino non è automaticamente una riga di carta: la stessa bottiglia può starci al calice e in bottiglia. | 11/10/2026 | [relazione dell'11/10](proposte/20261011_le_migliorie_ancora_aperte.md) | — | fatta · proposta #177 (sul gestionale vero): la carta dei vini ha il suo FOGLIO STAMPATO, con gli stessi pezzi del menu (logo, rametto, titoli di sezione), e una bottiglia al calice e in bottiglia vi compare come un vino solo con due prezzi. ⚠️ La parte dove si inseriscono le voci è rimasta com'era |
| N16 | **E1 · Sotto scorta → nasce l'ordine.** | 31/08/2026 | Sua richiesta | — | fatta · 🔴 **misurato il 31/08: la catena c'era già intera** — un vino sotto scorta entra da sé in lista, arriva nella bozza e il testo si scrive da solo. Nessun codice nuovo |
| N17 | **E2 · L'ordine si scrive da solo col listino del fornitore**, con le parole del fornitore e non con quelle di Alessio. | 31/08/2026 | Sua richiesta | — | fatta · `bozza_ordine` lo faceva già; quello che mancava davvero era **l'annata nell'ordine** (`20260831000003`): con due annate a catalogo il fornitore non sa quale mandare, e sbaglia in silenzio |
| N18 | **E3 · La carta vecchia.** Non a giacenza zero — quella capita ogni settimana e un'allerta che suona sempre si impara a ignorare. L'allerta è sulla CARTA: porta la data dell'ultima stampa, quante etichette sono entrate e uscite da allora, e da quanti giorni è ferma. | 31/08/2026 | Sua richiesta, approvata in questa forma | — | fatta · migrazione `20260831000003` (`carta_da_ristampare`, `segna_carta_stampata`). ⚠️ **La schermata non è stata costruita**: il gestionale sa rispondere, nessuno glielo chiede ancora |
| N20 | **La schermata «Carta da ristampare»**: il gestionale sa già dire se la carta è invecchiata dall'ultima stampa (vedi N18), manca la schermata che lo mostra, dice in breve perché, e permette di segnarla stampata. Senza allarmi invadenti. | 11/10/2026 | [relazione dell'11/10](proposte/20261011_le_migliorie_ancora_aperte.md) | — | fatta · ricontrollato l'11/10/2026: la schermata c'è già, è la sezione «La carta stampata» in Bevande e vini (commit `7c3591d` del 16/09, su `master`). La relazione la dava ancora da fare |
| N10 | **Inventario della cantina ogni 3 mesi**, con lo scostamento mostrato **in bottiglie e in euro** — non una rettifica silenziosa. | 14/08/2026 | Blocco 3 del mandato cumulativo, scorporato da N4 il 30/08 | — | fatta · migrazione `20260831000004` (`inventario_cantina`) e la sezione nella schermata Cantina. ⚠️ **Rilegge** le rettifiche scritte dall'Allineamento: non ne scrive nessuna e non corregge niente in silenzio. ⚠️ **Il periodo lo sceglie lui**: nessun promemoria trimestrale automatico |
| N5 | **Fatture in Cloud nelle due direzioni** (prerequisito suo: piano Complete e accesso). | 14/08/2026 | Blocco 4 del mandato cumulativo | aspetta | in attesa · aspetta il piano Complete e l'accesso, che decide lui |
| N6 | **La tracciabilità va sotto HACCP e guarda a valle**: dato un lotto, dove è finito — quali giorni, quali piatti, quali conti. | 14/08/2026 | Blocco 6 del mandato cumulativo | si può fare adesso | fatta · migrazione `20261012000001`, in produzione il 13/10: le uscite di ogni lotto si annotano da sole (un trigger), e «Tracciabilità lotti» apre dove è finito ogni lotto — conti coi piatti, produzioni seguite fino al lotto nato, sprechi e resi. ⚠️ Quello uscito **prima del 12/10/2026** non si ricostruisce: compare dichiarato come tale. Solo il titolare. Con la ricerca in «Tracciabilità lotti» |
| N7 | **Il costo del personale e i premi** — la voce di spesa più grossa dell'anno non passa da nessun modulo. Fermo in attesa dei documenti veri di Gianna. | 15/08/2026 | Blocchi 1 e 2 del mandato personale e tesoreria | aspetta | in attesa · aspetta il prospetto del costo aziendale e il calendario delle paghe |
| N8 | **Il simulatore di assunzione**: costo dal livello CCNL, non da un lordo digitato. | 15/08/2026 | Blocco 4 dello stesso mandato | aspetta | in attesa |
| N11 | 🔴 **L'archivio a sezioni.** `documents.doc_type` era **testo libero**: «Fattura», «fattura» e «Fatture» sarebbero state tre sezioni diverse. Le otto sezioni sono sue. ⚠️ Vale la regola del 27/08: **una categoria spenta resta legale** per i documenti che la portano, non si distrugge. | 30/08/2026 | Sua richiesta, categorie sue | — | fatta · migrazione `20260830000013` |
| N21 | **Tolti dal menu Ricerca Ricorrente e Monitoraggio Social** (erano due segnaposto senza schermate), e tolte le righe dal Contratto. | 11/10/2026 | Sua decisione in chat | — | fatta · proposta #177, sul gestionale vero |
| N22 | **L'Agricolo messo da parte**: resta intero e raggiungibile, ma nel menu scende in fondo sotto «Messo da parte» finché l'azienda agricola non nasce. | 11/10/2026 | Sua decisione in chat | — | fatta · proposta #177, sul gestionale vero |

---

## Registro delle cancellazioni

| # | Richiesta | Chiesta il | Da dove viene | Quando | Stato |
|---|---|---|---|---|---|
| D1 | **Tre tabelle restano da decidere** se entrano nel registro: `price_history` (il mandato dice di non deciderla da lì), `reservation_deposits` (non ha una colonna `id` e sparisce a cascata con la pulizia della privacy), `order_tables` (non ha una chiave primaria vera). | 29/08/2026 | Blocco 5 del 29/08 | aspetta | in attesa |

---

## Il computer e il telefono

| # | Richiesta | Chiesta il | Da dove viene | Quando | Stato |
|---|---|---|---|---|---|
| T1 | **Dopo un riavvio del computer, dal telefono si vede solo bianco**: il gestionale di prova non riparte da solo e il tunnel punta a una porta vuota. Ha imparato a rilanciarlo a mano, ma è una cosa che dovrà fare per sempre e che nessuno gli dice. | 30/08/2026 | Successo altre due volte il 29/08 | — | fatta · commit `2e93004`, e confermato da lui il 30/08: riavvia il computer e il telefono si apre da solo, senza toccare niente |
| T2 | **Il percorso protetto per il controllo prima di un rilascio in produzione**: identità dedicata, funzioni di misura ristrette, solo letture previste. È progettato. | 11/10/2026 | [relazione dell'11/10](proposte/20261011_le_migliorie_ancora_aperte.md) | aspetta | in attesa · servono le sue decisioni su credenziali, collaudo su Prova e uso del programma protetto |

---

## Magazzino e fatture — dalle sue foto del 30/08

| # | Richiesta | Chiesta il | Da dove viene | Quando | Stato |
|---|---|---|---|---|---|
| G1 | **Il riquadro «cosa non è sceso» dice quanto manca ma non SU QUANTO.** Senza il paragone quel numero non si può giudicare: 0,2 g su 1,5 kg sono polvere, 0,2 g su 0,3 g sono tutto. | 30/08/2026 | Sua foto | — | fatta · migrazione `20260830000008` |
| G2 | **L'unità si adatta**: 0,2 g invece di 0.0002 kg. *Un peso che ha bisogno di quattro decimali è nell'unità sbagliata.* | 30/08/2026 | Sue parole | — | fatta · commit del 30/08 |
| G3 | **Il punto inglese**: nella stessa schermata convivevano «0.309» e «1,37 l». Cercato il telaio: dieci punti in sei file. | 30/08/2026 | Sua foto | — | fatta · commit del 30/08 |
| G4 | **I prodotti dell'elenco devono aprirsi al tocco**: oggi non reagiscono. | 30/08/2026 | Richiesta esplicita | — | fatta · commit del 30/08 |
| G5 | **Il titolo e la riga dei numeri finiscono sotto l'orologio del telefono.** 🔴 **Sbloccata il 30/08 dalla sua risposta**: apre **dall'ICONA sulla schermata del telefono**, quindi l'app prende lo schermo intero e in cima non c'è più nessuna barra del browser a tenere il contenuto lontano dall'orologio. ⚠️ **E il difetto era doppio**: lo stacco che la barra del pollice metteva in fondo con `env(safe-area-inset-bottom)` valeva **zero**, perché mancava `viewport-fit=cover` — una riga scritta, giusta, e che non poteva avere effetto. | 30/08/2026 | Sua foto, diagnosi sua | — | fatta · commit di stanotte (nessuna migrazione) — il telaio sta su `#root`, non nelle schermate |
| G6 | **Il blocco del totale delle fatture va allineato a sinistra sul telefono e a destra sul computer.** *«Sul cellulare mi sembrano storte.»* | 30/08/2026 | Sue parole | — | fatta · commit del 30/08 |
| G7 | **La proposta bottiglia comprata → riga della carta**, con produttore, annata e formato visibili. Propone, non decide. | 30/08/2026 | Sua decisione | — | fatta · migrazioni `20260830000009`→`…011` |
| G8 | **Sul gestionale di prova la pagina si ricarica tornando da un'altra app.** ✅ **Diagnosticata il 30/08**: è il **server di sviluppo**, non il telefono e non l'app — il suo client, quando il collegamento cade e torna, ricarica la pagina da sé. Provato dall'inizio alla fine. **Sul sito pubblicato quel client non c'è.** 🔴 **Alessio ha deciso di LASCIARLA COM'È**: nessuna cura costruita. ⚠️ La riga **resta scritta con la diagnosi accanto**, non cancellata — *una richiesta cancellata non si distingue da una dimenticata*, e il giorno che il sintomo tornasse sul sito vero questa diagnosi dice subito dove NON cercare. | 30/08/2026 | Sue parole | — | scartata da Alessio |

---

## Sicurezza

| # | Richiesta | Chiesta il | Da dove viene | Quando | Stato |
|---|---|---|---|---|---|
| Z1 | **Le email ai clienti non portano markup scritto da altri**: il testo passa in un file puro, e ogni valore che arriva dal modulo pubblico è protetto. | 26/10/2026 | Piano di verifica del 25/10, voce P0.2, chiesta in chat il 26/10 | — | fatta · commit `4e1d87d` (su `master`, PR #236 unita su `slave` e PR #237 su `master`). La funzione online `email-cliente` non è stata reinstallata: il riepilogo dice che va fatto dopo l'unione, e l'esito non è verificato da qui |
| Z2 | **Il sito manda le intestazioni di sicurezza** (`public/_headers`): regole che limitano gli script e le connessioni, nessun frame di altri siti, microfono e fotocamera solo per il sito. | 26/10/2026 | Piano di verifica del 25/10, voce P0.3 | — | fatta · commit `e622892a` (su `master`, #237). Provata sulla build locale col browser; sul sito in produzione non verificata da qui |
| Z3 | **Audit dei permessi in sola lettura** (`supabase/diagnostica/20261026_audit_permessi.sql`, sette controlli). | 26/10/2026 | Piano di verifica del 25/10, voce P0.5 | — | fatta · commit `3f75ab5c` (su `master`, #237). Lanciato da Alessio sul gestionale vero la sera del 26/10, con 24 righe da confrontare con quelle della prova |
| Z4 | **Via i privilegi predefiniti di anon dal database**: le 8 funzioni pubbliche restano eseguibili, il resto va via. | 26/10/2026 | Decisione di Alessio dopo il rilascio P0 (riepilogo `docs/consegne/20261026_chi_non_e_entrato_non_eredita_niente.md`) | aspetta | in corso · migrazione `20261026000001` applicata e verificata sul progetto di prova; PR #238 unita su `slave` il 26/10, non ancora su `master`, non applicata in produzione |

---

## Chiuse di recente — restano scritte

| # | Richiesta | Chiesta il | Da dove viene | Quando | Stato |
|---|---|---|---|---|---|
| X1 | **Sul telefono l'app si ricarica e perde quello che si sta scrivendo.** | prima del 29/08/2026 | Sue mani | — | fatta · commit `af797e2` del 29/08 |
