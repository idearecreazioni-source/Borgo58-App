# Collaudo — annotazioni e lavori

Il registro di quello che il collaudo trova, e in che ordine si corregge.
Sta qui e non in chat perché fra un blocco e l'altro passano ore, e una
decisione presa a voce si perde.

**Regola del collaudo, decisa il 17/08**: mentre Alessio guarda le
schermate, **il codice dell'app non si tocca**. Non è prudenza: il
gestionale gira dalla stessa cartella in cui lavoro, quindi una mia
modifica gli compare sotto le mani in tempo reale, senza che lui rilanci
niente. Una schermata che cambia mentre la sta guardando avvelena
l'annotazione — e anche la fiducia in quelle già scritte.

---

## Ordine dei lavori concordato

1. ✅ **Punto E del primo blocco** — i difetti dello *scenario*, fatti
   subito perché bloccavano il collaudo (commit `4ce5a59`).
2. ⏳ Alessio finisce il giro «guardare senza toccare» sulle schermate
   rimaste: HACCP, Personale, Proiezione Fiscale, Archivio Documenti,
   Editor Menu, Assistente, Agricolo.
3. ⏳ Manda il **secondo blocco**. Da lì lavoro io e lui si ferma.
4. ✅ **Primo giro CHIUSO**: i cinque difetti A, più il n. 10 e il n. 3.
   L'ordine seguito è stato quello concordato — prima il manuale HACCP
   (l'unico documento che finisce in mano a qualcun altro), poi n. 4 e
   n. 2, poi n. 1 col n. 10, poi n. 3.
5. ✅ **Secondo giro CHIUSO**: le mancanze sui pagamenti (B 6-7-8-9), che
   erano una cosa sola e non quattro. In due consegne — la fondazione coi
   filtri ([riepilogo](../consegne/20260817_l_uscita_ha_la_sua_data.md)) e
   le note di credito ([riepilogo](../consegne/20260817_la_nota_di_credito.md)).
6. 🔄 **Le piccolezze (D)**: 5 fatte il 17/08 con i quattro difetti
   ([riepilogo](../consegne/20260817_i_quattro_difetti.md)), 5 restano —
   gergo in interfaccia, «Questo mese» coi numeri nudi, riepilogo in cima al
   Magazzino, «Nuova fattura» nel posto piu' visibile, e **le spunte
   dell'Editor Menu Cartaceo**, che va disegnata e non ritoccata.
7. ✅ **La rete sui vocabolari chiusi — fatta il 17/08**, prima delle
   piccolezze per decisione di Alessio: vive nelle prove e nel database,
   quindi non cambia le schermate che lui sta guardando.
   [Riepilogo](../consegne/20260817_la_rete_sui_vocabolari.md). I posti
   erano **tre**, non due. **Non** è una rete sola con quella delle mance, e
   il discriminante era già scritto: *direbbero esattamente la stessa cosa?*
   Se sì si toglie il doppione (un riflesso), se solo in parte serve un
   guardiano. Trovato costruendola un difetto vivo in produzione
   («Assegno» nella lista della spesa) e, misurando, un buco più grosso —
   vedi sotto.
8. ⏳ **La lista della spesa non scrive mai un'uscita** — impostazione
   **decisa da Alessio il 17/08**, scritta per intero in
   [`docs/mandati/20260817_la_lista_non_scrive_uscite.md`](../mandati/20260817_la_lista_non_scrive_uscite.md).
   Da fare **dopo** le piccolezze. In due righe: il costo nasce solo dal
   documento o da una registrazione esplicita; la casella «come hai pagato»
   va tolta; la chiusura a mano ha **tre** esiti distinti (comprato e pagato
   · avuto gratis · non preso), e confondere gli ultimi due mette in
   magazzino merce mai arrivata. ⚠️ Il buco che l'impostazione lascia è la
   **cassa**: 40 € in contanti al contadino non registrati diventano un
   ammanco del cassetto la sera — lo stesso meccanismo delle mance su carta.
   È il prerequisito dell'unificazione dei vocabolari dei mezzi di pagamento.
9. ⏳ **I 33 posti dove una dimenticanza è silenziosa**: misurati, mai
   camminati. `createCashMovement` ha ancora la forma vulnerabile.
10. ⏳ **La serata recitata, DOPO le correzioni di A** — decisione di
   Alessio: due piante diverse della sala e una prenotazione che non si
   può assegnare a un tavolo ostacolerebbero proprio la prova che deve
   emergere.

---

## Primo blocco — giro «guardare senza toccare», notte del 17/08

### A. Difetti dell'app

| n. | Cosa | Stato |
|---|---|---|
| 1 | «Apri la pianta» non si porta dietro la prenotazione | ✅ **provato con le mani** (col n. 10) |
| 2 | **Due piante diverse dello stesso locale** | ✅ **misurato: i dati sono identici** — è l'orientamento, vedi sotto. Chiuso dichiarandolo su entrambe le schermate |
| 3 | Da una ricetta «Pronta (non in carta)» non c'è modo di metterla nel menu | ✅ **provato con le mani** |
| 4 | **In prima nota non si distingue il contante dalla banca**, e le righe non hanno descrizione | ✅ colonna «Da dove» + la nota, che non si vedeva da nessuna parte |
| 5 | Magazzino illeggibile per le righe delle prove automatiche | ✅ metà fatta (gli avanzi li porta via il reset dello scenario); resta la metà di prodotto → vedi decisione sotto |

⚠️ **Perché il n. 4 e il n. 2 vengono prima.** Il n. 4 perché contante e
banca è **la** distinzione che decide quella schermata: senza, il saldo si
legge sbagliato e non c'è modo di accorgersene. Il n. 2 perché due
schermate che disegnano la stessa sala da due fonti diverse sono la firma
di un difetto strutturale, non estetico — è la forma che il progetto ha
già chiuso tre volte col riflesso (`payment_method`, `conto_aperto`,
`in_carta`).

### B. Mancanze da colmare — un lavoro solo, non quattro

✅ **Tutte e quattro fatte** (17/08). Il n. 6, 7 e 9 nella prima consegna, il
n. 8 nella seconda.

| n. | Cosa |
|---|---|
| 6 | Manca **l'assegno** fra i mezzi di pagamento, e manca **l'identificativo** (numero dell'assegno, riferimento del bonifico): senza, l'estratto conto non si riconcilia. Alessio conta di usarne una trentina prima dell'apertura |
| 7 | **Assegni postdatati**: oggi l'uscita in prima nota si scrive subito, quindi la cassa scende un mese prima che i soldi escano. L'uscita deve nascere alla data che dice lui ed entrare in «Ce la faccio?». *Decisione sua: si usa la sua data; se il fornitore incassa prima si aggiusta a mano* |
| 8 | Nessun modo di allegare **DDT, note di credito e documenti collegati** a una fattura. La nota di credito cambia quanto si deve pagare: se non si collega, **il «da pagare» mente** |
| 9 | Nessun **filtro** sulle fatture (pagate/da pagare, data, fornitore). Con due si vive, con duecento no |

⚠️ Il n. 7 è il più urgente dei quattro, e non è teorico: trenta assegni
prima dell'apertura significano trenta uscite datate male.

### C. Richieste nuove

| n. | Cosa | Stato |
|---|---|---|
| 10 | Dalle prenotazioni senza tavolo, un pulsante che porti alla pianta **già pronta ad assegnare quella prenotazione** | ✅ col n. 1, provato con le mani |
| 11 | **Finger food**: piatti composti da più ricette, con food cost cumulativo. Il meccanismo esiste (componenti + costo espanso in profondità) ma il menu dei componenti propone solo le preparazioni | **parcheggiata**: è una decisione di modello, si imposta insieme. Prima vanno risolte le porzioni e lo scarico di magazzino |
| 12 | Sulla **Dashboard manca la serata**: 6 prenotazioni nel database e la prima schermata parla di adempimenti fiscali. Chi apre alle 19 vuole sapere quanti coperti ha | da fare |

### D. Piccolezze — tutte in un giro solo

- Giacenze con quattro decimali (`5.8785 kg`); servono due decimali, e il
  simbolo € dove manca (l'importo di una fattura si legge «33,6»).
- Gergo tecnico in interfaccia: `fisco_scadenze` accanto ai task, «Omaggi
  (base TD27)», il codice fra parentesi nella striscia rossa.
- Accenti resi con apostrofi: «non e' mai stato contato», «finche' non lo
  conti», «e' in carta nel menu…».
- «Questo mese» mostra due numeri nudi (+0,00 e −152,94) senza dire cosa
  sono.
- Magazzino: manca un riepilogo in cima («3 sotto soglia, 1 scade fra due
  giorni»).
- Ricettario: su una ricetta in carta il pulsante «Pronta per carta» è
  premibile e si spegne a schermo, salvo essere respinto al salvataggio.
  Meglio spento, con la ragione accanto.
- Fatture: i campi modificabili di numero e importo non hanno etichetta. E
  il modulo «Nuova fattura» occupa il posto più visibile pur essendo il
  caso più raro.
- **Editor Menu Cartaceo: le spunte accanto ai piatti sembrano una scelta
  salvata e non lo sono** (trovato il 17/08 provando il n. 3 A). Servono
  solo a escludere un piatto da *quella* stampa: le togli, esci, rientri e
  sono tornate tutte. La riga che lo spiega c'è, ma sta sopra e in piccolo
  — e quello che si vede è il comportamento, non la nota. *La cura non è
  ingrandire la nota: è che la spunta somigli a ciò che fa* (stessa lezione
  della striscia grigia: due stati dello stesso segno devono avere la
  stessa forma).

### E. Difetti dello scenario — ✅ fatti (commit `4ce5a59`)

- Prenotazioni datate al giorno prima → era la **data UTC**. Vedi la
  lezione in CLAUDE.md §8: *le regole del progetto valgono anche per il
  codice che non è l'app*.
- Mancava la **fattura scaduta**.
- «Due sotto soglia» erano tre → ora il numero **lo chiede al database**.

---

## n. 2 — le «due piante»: cosa ho misurato prima di toccare

Non è un difetto dei dati, e vale la pena scriverlo perché la diagnosi
facile era un'altra.

Ho chiamato la funzione vera dell'app (`getPiantaDelGiorno`) col token dei
due ruoli, sulla stessa data che usano le due schermate:

| | titolare | staff |
|---|---|---|
| Sagome nella pianta del giorno | 13 | 13 |
| Spostate rispetto alla base | 1 (T6) | 1 (T6) |
| T6 | (1330, 690) | (1330, 690) |

**Le due risposte sono identiche**, e le due schermate chiamano la stessa
funzione con la stessa data (`oggiLocale()`). Il calcolo unico regge: la
pianta è una sola.

⚠️ **La differenza è l'ORIENTAMENTO.** Le Comande passano `inPiedi`
(forzato), il Calendario `auto` — che su uno schermo largo disegna la sala
sdraiata. Stesse posizioni, stessa sala, girata di novanta gradi: due
disegni affiancati che l'occhio legge come due piante diverse.

Il forzato in piedi delle Comande è una **decisione del 14/08**, presa per
il tablet tenuto verticale. Non la cambio da solo: vedi la domanda aperta.

---

## Decisioni prese

- **Il Magazzino mostra tutti gli ingredienti, anche i mai caricati**
  (strada *b*, scelta da Alessio il 17/08), in una **sezione chiusa di
  default col conteggio** — «mai caricati: 7» — che si apre se serve.
  ⚠️ La ragione non è la completezza: *«ingredienti che uso nelle ricette
  e non ho mai caricato» è o un errore di anagrafica, o un carico che
  manca, o un doppione* — cioè le tre cose che il progetto ha passato
  giorni a togliere. **Non è zavorra, è un segnale.** La strada scartata
  (mostrare solo ciò che ha giacenza) creava un buco silenzioso: per
  accorgersene bisognerebbe sospettarlo.
- **La serata recitata si fa sull'app corretta**, non prima.
- **Il finger food si imposta insieme**, e non è lavoro di adesso.

---

## Un vocabolario solo per i mezzi di pagamento? La misura

Domanda di Alessio (17/08), dopo che avevo separato l'elenco della lista
della spesa da quello delle fatture: *«perché non lasciare tutti i metodi
ovunque? Due elenchi diversi sono proprio ciò che ha prodotto il difetto.»*
Con il vincolo giusto: **il lavoro non è nel menu, è nelle conseguenze** —
ogni mezzo porta una regola su dove escono i soldi, e l'assegno porta la
data differita.

Misurato prima di decidere. Chi tiene un «mezzo di pagamento», e cosa ne fa:

| dove | che domanda risponde | scrive un movimento? |
|---|---|---|
| `supplier_invoices.payment_method` (4, con assegno) | con che strumento pago una fattura | **sì**, con la data di uscita vera |
| `shopping_list_items.payment_method` (3) | con che strumento ho pagato la spesa | 🔴 **no, niente** |
| `order_payments.mezzo` (contante, carta) | come incassa il locale in sala | no, per scelta del 04/08 — ed è denaro in **entrata** |
| `deductible_expenses.payment_method` (5) | se la spesa è **tracciata** ai fini fiscali | no: `app` e `altro_tracciato` esistono per la regola del contante |
| `tips_collected` / `tip_distributions.mezzo` (2) | come sono arrivate le mance | sì (i saldi le leggono) |
| `anticipazioni_socio.fondi` (contanti, conto_personale) | da quale tasca del **titolare** | sì |
| `cash_movements.mezzo`, `scadenze_previste.mezzo` (cassa, banca) | **da dove** escono i soldi | è la destinazione, non lo strumento |

**«I mezzi di pagamento» non è un vocabolario: sono quattro concetti.**
Strumento, forma d'incasso in sala, tracciabilità fiscale, e destinazione.
Unificarli tutti direbbe che «bonifico» ha senso su una mancia e «app» su
una fattura.

I due che *sono* lo stesso concetto sono la fattura e la spesa. E lì la
misura ha trovato la ragione vera per non unificare adesso:

### 🔴 Chiudere una riga della lista della spesa non scrive nessuna uscita

`close_shopping_list_item` registra l'importo e il mezzo sulla riga, crea il
lotto in magazzino, e **non scrive niente in prima nota**. `purchased_amount`
non è letto da nessuna funzione, da nessuna vista e da nessun totale: solo
dalla schermata che lo mostra.

Conseguenza: **la spesa pagata dalla lista è denaro uscito che nessun saldo
e nessun totale dei costi conosce.** È la stessa forma di «pagare una
fattura non era un movimento» (rilievo del 13/08) e del doppio conteggio
chiuso oggi.

⚠️ **E questo decide la domanda sul vocabolario.** Cosa farebbe oggi quella
schermata se ricevesse «assegno»? *La stessa cosa che fa con «bonifico»:
niente.* Il mezzo lì è **decorativo** — non è che l'assegno non sia gestito,
è che nessun mezzo lo è. Unificare adesso produrrebbe esattamente il
«vocabolario finto» che Alessio ha nominato, e per un motivo più grosso
dell'assegno.

**Quindi: due vocabolari dichiarati, per ora**, e la rete che sorveglia che
non si separino di nascosto. L'unificazione diventa la cosa giusta *dopo*
che la lista scrive la sua uscita.

⚠️ **E quel lavoro ha una decisione dentro, che non è mia**: la lista
contiene sia righe pagate sul posto (mercato, ricevuta) sia righe **ordinate**
dalla Fase B, per cui arriverà una fattura. Scrivere un movimento per tutte
conterebbe due volte quelle fatturate — cioè ricostruirebbe il difetto
chiuso oggi, dall'altro lato. Va chiesto ad Alessio quale dei due è il caso
normale.

---

## La lezione del secondo giro: il caso vuoto

**Detta da Alessio il 17/08**, dopo il terzo caso in due giorni:

> Una prova che gira sul caso vuoto dimostra che il codice non esplode, non
> che funziona. È la stessa forma di «misurare una coincidenza invece di una
> differenza», solo dal lato dei dati invece che dei numeri. **Il caso da
> provare è quello che ha qualcosa da fare.**

I tre casi, in fila:

| quando | la prova girava su… | e non vedeva |
|---|---|---|
| 16/08 | un database vuoto, pretendendo 40 e 60 | il campo `mezzo` delle mance che non arrivava |
| 17/08 | un saldo senza movimenti futuri | che la vista potesse ignorare la data del tutto |
| 17/08 | una nota di credito **non ancora scalata** | che togliere una nota scalata **fallisse** |

⚠️ Il terzo è il più istruttivo: la prova esisteva, passava, ed era il **primo
gesto** che Alessio avrebbe fatto aprendo la schermata. Scritto anche in
`CLAUDE.md` §8, accanto alla regola sulla differenza contro la coincidenza.

---

## Quello che ha funzionato, e va scritto

- **Il vincolo salito a monte regge dal vivo**: togliendo «pronta per
  carta» a una ricetta in carta il salvataggio è stato respinto, e il
  messaggio **ha nominato il menu** dov'è il piatto. È il pezzo disegnato
  il 16/08 sulla richiesta di Alessio — spostare il rifiuto dove nasce il
  problema invece di lasciarlo scattare dentro il trigger.
- La scomposizione del contante torna col numero grande.
