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
4. ⏳ **Primo giro**: i difetti A. Ordine di gravità: **n. 4 e n. 2**
   prima degli altri, poi **n. 1 + n. 10 insieme** (sono lo stesso
   lavoro), poi n. 3, poi la seconda metà di n. 5.
5. ⏳ **Secondo giro**: le mancanze sui pagamenti (B 6-7-8-9), che sono
   una cosa sola e non quattro.
6. ⏳ **Le piccolezze (D) tutte in un giro solo**, alla fine.
7. ⏳ **La serata recitata, DOPO le correzioni di A** — decisione di
   Alessio: due piante diverse della sala e una prenotazione che non si
   può assegnare a un tavolo ostacolerebbero proprio la prova che deve
   emergere.

---

## Primo blocco — giro «guardare senza toccare», notte del 17/08

### A. Difetti dell'app

| n. | Cosa | Stato |
|---|---|---|
| 1 | «Apri la pianta» non si porta dietro la prenotazione: da una prenotazione senza tavolo il collegamento apre la pianta del giorno, che non sa niente di lei. È un link secco | da fare, **col n. 10** |
| 2 | **Due piante diverse dello stesso locale**: il Calendario mostra la disposizione originale, le Comande quella modificata | ⚠️ **misurato: i dati sono identici**, vedi sotto — serve una decisione |
| 3 | Da una ricetta «Pronta (non in carta)» non c'è modo di metterla nel menu: l'app nomina quello che manca e non offre la strada. Speculare al n. 1 | da fare |
| 4 | **In prima nota non si distingue il contante dalla banca**: due uscite compaiono identiche, e si capisce quale è uscita dalla banca solo facendo i conti coi riquadri sopra. E le righe dicono solo «Uscita» / «Altra uscita», senza descrizione | da fare, **priorità** |
| 5 | Magazzino illeggibile per le righe delle prove automatiche | ✅ metà fatta (gli avanzi li porta via il reset dello scenario); resta la metà di prodotto → vedi decisione sotto |

⚠️ **Perché il n. 4 e il n. 2 vengono prima.** Il n. 4 perché contante e
banca è **la** distinzione che decide quella schermata: senza, il saldo si
legge sbagliato e non c'è modo di accorgersene. Il n. 2 perché due
schermate che disegnano la stessa sala da due fonti diverse sono la firma
di un difetto strutturale, non estetico — è la forma che il progetto ha
già chiuso tre volte col riflesso (`payment_method`, `conto_aperto`,
`in_carta`).

### B. Mancanze da colmare — un lavoro solo, non quattro

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
| 10 | Dalle prenotazioni senza tavolo, un pulsante che porti alla pianta **già pronta ad assegnare quella prenotazione** | da fare, col n. 1 |
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

## Quello che ha funzionato, e va scritto

- **Il vincolo salito a monte regge dal vivo**: togliendo «pronta per
  carta» a una ricetta in carta il salvataggio è stato respinto, e il
  messaggio **ha nominato il menu** dov'è il piatto. È il pezzo disegnato
  il 16/08 sulla richiesta di Alessio — spostare il rifiuto dove nasce il
  problema invece di lasciarlo scattare dentro il trigger.
- La scomposizione del contante torna col numero grande.
