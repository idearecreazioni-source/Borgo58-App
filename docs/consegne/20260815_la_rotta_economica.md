# Consegna del 15/08/2026 (prima) — la rotta economica

**Commit della consegna: `def0920`** (questo riepilogo è il commit
immediatamente sopra, sola documentazione). Working tree pulito.

| Commit | Cosa |
|---|---|
| `e48659e` | il mandato entra nel repository, con la data davanti |
| `1226894` | un solo motore fiscale — migrazione `20260814000013` |
| `d813686` | la rotta: previsioni versionate e congelate — `20260814000014` |
| `be2d0b8` | i mesi veri e lo scostamento scomposto — `20260814000015` |
| `d763d58` | le schermate della rotta |
| `def0920` | `CLAUDE.md`: la rotta economica, e il mandato che chiude |

**Applicate in produzione**: `20260814000013`, `…14`, `…15`. **101
migrazioni**. `operazioni-atomiche` reinstallata (**v20 → v21**).

È il **Blocco 3 del mandato «dal magazzino che scende alla rotta
economica»**, l'ultimo: **il mandato è completo su tutti e tre i blocchi.**

⚠️ **Questa consegna NON modifica `docs/CONTRATTO.md`.** La riga di §5 che
classifica la Proiezione Fiscale come categoria A è ora superata dai
fatti, e va aggiornata in un **commit separato dopo questa consegna**,
autorizzato da Alessio il 15/08 con tre condizioni sue — vedi §9.

---

## 1. Il mandato non era nel repository, e i primi due blocchi sono stati
fatti così

Il mandato viveva solo sul Desktop di Alessio. Vuol dire che il Blocco 1
e il Blocco 2 sono stati consegnati leggendo un documento che **chi
controlla non poteva vedere**: non poteva confrontare il consegnato col
richiesto se non fidandosi del mio riassunto.

Portato in `docs/mandati/20260813_magazzino_produzioni_proiezione.md`
come primo commit, prima di scrivere una riga di codice, senza toccarne
il testo.

---

## 2. Assorbe, non affianca — e perché

Il mandato chiedeva la ricognizione della sezione fiscale esistente prima
di scrivere codice, e la scelta motivata. Trovato: **Deduzioni fiscali**,
**Catalogo strumenti**, **Simulatore what-if**.

Il Simulatore calcolava IRES e IRAP **in JavaScript, dentro la
schermata**. Se la Proiezione si fosse costruita il proprio calcolo, il
gestionale avrebbe avuto **due risposte alla stessa domanda** e nessun
modo di sapere quale credere — cioè esattamente ciò che il vincolo «un
solo motore fiscale» vieta per costruzione.

**Scelta: assorbe.** Il calcolo scende nel database (`calcola_imposte()`)
e il Simulatore la interroga: resta il posto dove si chiede «e se…»,
smette di essere un secondo motore. **Deduzioni e Catalogo restano dove
sono**: rispondono a domande diverse — quali spese sono deducibili, quali
agevolazioni esistono — e alimentano la Proiezione invece di duplicarla.

⚠️ **Il numero e il suo limite viaggiano insieme.** `calcola_imposte()`
restituisce anche la frase che dichiara la semplificazione dell'IRAP.
Prima quella frase viveva nel testo di *una* schermata: una seconda
avrebbe potuto mostrare lo stesso numero senza avvertenza, e chi legge
non aveva modo di accorgersene. Sparisce solo quando Alessio scrive la
data in cui **Laura** ha confermato i parametri.

⚠️ **La maxi-deduzione nasce SPENTA**, ed è il valore predefinito più
importante del blocco: un'agevolazione applicata da sola abbassa le
imposte stimate **sempre nella stessa direzione**.

**Il quando oltre al quanto** (`calendario_imposte()`): a giugno cadono
insieme il saldo dell'anno prima e il primo acconto. Metodo
**previsionale** e non storico, dichiarato — quello storico darebbe zero
al primo anno di attività, cioè il contrario di un avviso utile.

---

## 3. Il foglio non entra nel repository

Vincolo di Alessio, su rilievo del validatore: il repository è pubblico.

Il foglio resta sul suo computer. Lo apre dalla schermata, il gestionale
ne legge i numeri e li tiene **solo nel database**. Nel repository c'è
**dove guardare** — indirizzi di cella ed etichette attese — e mai cosa
c'è scritto. Il lettore `.xlsx` è scritto a mano (~150 righe, nessuna
libreria nuova): un foglio è un archivio con dentro due file XML, e il
browser sa già decomprimere.

**Conseguenze pratiche, dichiarate:**
- **Nessuna migrazione semina lo scenario di partenza.** Si carica dalla
  schermata; le verifiche delle migrazioni girano su numeri inventati
  apposta, scelti perché il conto si possa rifare a mente.
- **Nessun importo del piano in questo riepilogo** (§2 delle condizioni
  del validatore): il collaudo si dichiara come esito.

⚠️ **Le etichette si controllano, gli indirizzi da soli no.** Una riga
inserita nel foglio sposterebbe tutto, e senza controllo entrerebbe **un
numero plausibile al posto sbagliato** — falso in modo credibile, come lo
scarto a zero. Se l'etichetta non combacia, l'importazione **si ferma e
dice quale riga non ha riconosciuto**. Una riga *vuota* però non è un
problema (tre ruoli invece di quattro): lo è una riga **a metà**.

---

## 4. Il collaudo lo fa la macchina, non io una volta sola

Il criterio del mandato è «stessi input → stessi numeri». Verificarlo a
mano una volta lo renderebbe vero il giorno dell'importazione e mai più.

`confronto_col_foglio()` confronta, **a ogni apertura della schermata**,
ciò che il gestionale calcola con i totali che il foglio dichiara, e
mostra **le righe che non tornano**.

✅ **Sul foglio vero di Alessio, caricato davvero nel database di prova:
17 confronti su 17, differenza zero.** Compresi EBITDA della sola sala,
EBITDA complessivo e **entrambi i pareggi** — con e senza linee
accessorie, come chiedeva il criterio di accettazione.

Due cose trovate riproducendo il foglio, e **riprodotte invece che
corrette**: il piano somma i costi del personale in due modi che
differiscono di pochi euro, e gli ammortamenti annui di un euro. Correggerli
avrebbe fatto smettere di tornare i totali: un modello si riproduce, non
si ripara di nascosto.

⚠️ **Una cosa NON si riproduce, e va detta**: il foglio stima le imposte
con un'aliquota unica su tutto, e le somma mese per mese — così i mesi in
perdita non compensano quelli in utile. Qui le imposte sono **annuali** e
le calcola il motore unico. L'aliquota del foglio è conservata come
memoria di *da dove veniva* il suo numero, e **la migrazione verifica
leggendo il corpo delle funzioni di calcolo che nessuna la legga**: una
promessa non basta.

---

## 5. «Congelato» è un trigger, non un'etichetta

È il punto che il validatore ha detto che guarderà per primo.

Uno scenario chiuso rifiuta ogni `update` e ogni `delete`, **su di sé e
su tutte le sue righe**, anche scrivendo dritto in tabella dal browser.
*Una previsione che si può ritoccare dopo aver visto com'è andata non è
una previsione: è una giustificazione.*

⚠️ **L'ordine conta, e da lì viene l'assenza di scappatoie.** Il
congelamento scrive i dodici mesi calcolati **prima** e sigilla **dopo**:
invertendo, rifiuterebbe se stesso. Proprio per questo nel trigger **non
c'è nessun modo di scavalcarlo** — una scappatoia sarebbe anche la strada
per aggirarlo.

**E i numeri si fotografano, non si ricalcolano.** Gli ingressi sono già
immutabili, ma **la formula no**: se un domani si correggesse un
arrotondamento, uno scenario chiuso a maggio comincerebbe a raccontare
numeri diversi da quelli su cui si era deciso. Stesso principio del costo
congelato sul lotto di una produzione.

⚠️ **`calcola_proiezione()` non è concessa a nessun client** (verificato
in produzione: `false`). Se lo fosse, «congelato» vorrebbe dire soltanto
«non lo tocca la schermata».

---

## 6. I buchi restano vuoti, mai zero

Oggi quasi niente è misurabile: Ricettario vuoto, nessun registratore
telematico, il costo del personale non passa da nessun modulo. **Un
consuntivo che riempisse quei buchi con gli zeri direbbe che il mese è
andato benissimo.**

Ogni numero porta con sé **da dove viene** (`misurato` / `assente`), e lo
scostamento di una voce non misurata resta **vuoto e dichiarato tale** —
uno zero si legge «in linea col piano».

**Lo scostamento si scompone in quattro**: coperti, scontrino medio, food
cost, fissi. *«Sotto di tanto» non serve: le quattro cose si correggono
in quattro modi diversi.* Il mese in corso è rapportato ai giorni
trascorsi e **marcato parziale**.

⚠️ **Si confronta sala con sala.** Le linee accessorie stanno nella
previsione ma nessun modulo le misura: confrontarle darebbe uno
scostamento negativo permanente che dopo due mesi si smette di guardare.

⚠️ **Quali uscite siano «costi fissi» lo decide Alessio**, con una casella
su ogni causale. Dedurlo dall'etichetta sarebbe una regola scritta da me
sulle sue parole: il giorno che ne aggiunge una nuova finirebbe dalla
parte sbagliata **in silenzio**.

**I ricavi del mese sono l'INCASSATO, non il valore dei conti**: un
omaggio vale come il piatto e incassa zero, e prendere il valore pieno
gonfierebbe i ricavi proprio nei mesi in cui si è regalato di più.

**Il budget degli omaggi** chiude il cerchio con la causale obbligatoria
di ieri, con la scomposizione per causale. Il costo di un coperto è
**misurato** se la cella lo sa dire, altrimenti **previsto e dichiarato
tale**.

---

## 7. Un solo calcolo del totale di un conto

Il totale di un conto era calcolato in **due** posti — `orderTotals()`
per le schermate e, da ieri, dentro `close_order_as_discount_gift`. Il
consuntivo ne avrebbe voluto un terzo.

Estratto in `totale_conto()`, e **la chiusura del tavolo ora lo usa**.
⚠️ Verificato **leggendo il corpo della funzione**, non sulla parola: si
potrebbe estrarre l'aiuto e lasciare il chiamante com'era, e la
migrazione passerebbe col difetto vivo. È il controllo che il 13/08 ha
salvato il freno dei rincari. Confermato anche in produzione dal
connettore, indipendentemente dalla migrazione.

---

## 8. Verifica

| Cosa | Stato |
|---|---|
| le tre migrazioni sul progetto di prova | **applicate due volte**: idempotenti |
| il foglio vero caricato nel database di prova | **17 confronti su 17, differenza zero** |
| EBITDA di sala, EBITDA complessivo, entrambi i pareggi | **riprodotti esattamente** |
| calcolo delle imposte rifatto a mano (IRES, IRAP, maxi-deduzione, perdita) | **provato** |
| maxi-deduzione spenta: non tocca niente | **provato** |
| maxi-deduzione accesa: abbassa l'IRES e **non** l'IRAP | **provato** |
| calendario: due rate, saldo nell'anno DOPO, sotto soglia nessun acconto | **provato** |
| una riga di parametri fiscali creata adesso nasce completa | **provato** |
| previsione congelata: `update`, `delete`, aggiunta, riapertura | **tutti respinti** |
| …anche sui risultati fotografati e sulle righe | **respinti** |
| …e anche dal browser, con token vero | **respinti** (prova automatica) |
| il calcolo grezzo non è chiamabile da un client | **verificato in produzione: `false`** |
| nessuna funzione di calcolo legge l'aliquota del foglio | **provato leggendo i corpi** |
| la chiusura del tavolo usa il calcolo unico del conto | **provato leggendo il corpo**, e riconfermato in produzione |
| «alla romana» attraverso la funzione ricreata, dal ruolo dello **staff** | **provato** |
| ricavi = incassato (non il valore del conto) | **provato** |
| food cost e fissi non misurati: **vuoti**, non zero | **provato** |
| scostamento scomposto, coi due effetti rifatti a mano | **provato** |
| mese in corso: parziale, coi giorni trascorsi | **provato** |
| mese non finito: non si chiude | **provato** |
| mese chiuso: non si riscrive, non si chiude due volte | **provato** |
| «solo mio» = **RLS vera**, con una riga che lo staff non deve vedere | **provato dal token vero** (`tests/app/proiezione.test.js`) |
| lo staff respinto su imposte, calendario, proiezione, chiusura del mese | **provato** |
| prove automatiche | **61 verdi** (erano 55) + **14 pure** (erano 9) |
| lint, build | puliti |
| **produzione** | **101 migrazioni**, corridoio **v21** |
| elenco anonimi | **12**, invariato |
| `security definer` senza portiere | **13**, invariato |
| trigger del congelamento | **7 accesi, 0 spenti** |
| residui delle verifiche in produzione | **zero**, controllati uno per uno col connettore |
| avvisi partiti durante l'applicazione | **zero** |

⚠️ **La RLS non si prova dentro una migrazione**: là si gira come
proprietario delle tabelle, e il proprietario la RLS la scavalca. Un
controllo là dentro avrebbe dato un verde che non vuol dire niente (§5
punto 2 del protocollo). La policy è provata dalla prova automatica, che
passa da PostgREST col token dello staff — ed è per questo che quella
prova crea prima **una riga vera** che lui non deve vedere.

**Tre difetti trovati da me prima di applicare, e uno da una prova:**
1. Un gestore d'eccezione nella verifica del blocco scenari avrebbe
   **inghiottito i propri stessi controlli**: la migrazione sarebbe
   passata verde con la verifica rotta.
2. La prima verifica del motore fiscale **modificava le aliquote vere di
   Alessio** e le rimetteva alla fine — la stessa forma di verifica che il
   14/08 ha lasciato due tavoli in mezzo ai divani. Riscritta per lavorare
   su una riga propria, che alla fine sparisce.
3. `fiscal_settings` è **vuota sul progetto di prova** e ha una riga in
   produzione: riempire solo le righe esistenti avrebbe lasciato senza
   parametri ogni riga creata dopo. Terza ricomparsa della stessa lezione.
4. **La prova del 13/08 sull'elenco degli anonimi è diventata rossa da
   sola**: tre funzioni trigger nuove erano eseguibili con la chiave
   pubblica, e l'elenco era passato da 12 a 15. Nessun dato usciva, ma
   quell'elenco non deve crescere in silenzio. Chiuse; l'elenco è tornato 12.

---

## 9. Il Contratto: cosa va cambiato, e come

`docs/CONTRATTO.md` §5 classifica la **Proiezione fiscale** come
categoria **A**. Dopo questa consegna non descrive più il codice.

**Autorizzato da Alessio il 15/08/2026**, con tre condizioni sue, che
vanno rispettate alla lettera:

1. **Commit separato, dopo questa consegna** — non dentro il blocco.
2. **La riga descrive cosa fa il codice, non concede un permesso**: la
   categoria è una constatazione, non un lasciapassare.
3. **Nel commit e qui vanno nominate le sei tabelle e l'operazione
   esatta**, così il validatore può verificare che il corridoio sia
   davvero quello previsto — Edge Function e **una sola** funzione
   Postgres, non sei scritture in fila dentro un server.

**L'operazione**: `crea_scenario_proiezione`, invocata dal client solo
attraverso `eseguiOperazione()` → Edge Function `operazioni-atomiche` →
**una** funzione Postgres `security definer`.

**Le sei tabelle che scrive, in una transazione sola**:
`scenari_proiezione`, `scenario_personale`, `scenario_extra`,
`scenario_costi_fissi`, `scenario_linee_accessorie`, `scenario_mesi`.

**La seconda operazione**: `congela_scenario`, che ne scrive **due** —
`scenario_risultati` (i dodici mesi) e poi `scenari_proiezione` (il
sigillo), **in quest'ordine obbligato**.

Il testo originale della riga di §5 resterà conservato nel commit, come
per i tavoli uniti, se serve al confronto.

---

## 10. Cosa NON è verificato, e lo dico chiaro

- ⚠️ **Nessuno ha ancora caricato il foglio dalla schermata vera.** Il
  caricamento è stato provato da qui, contro il database di prova, con il
  file vero di Alessio: i 17 totali tornano. Ma **il gesto — apri la
  pagina, scegli il file, guarda cosa ha letto, conferma — non l'ha mai
  fatto una mano vera**, e i PIN sono suoi. È il limite più grosso di
  questa consegna.
- **La Proiezione in produzione è costruita e VUOTA**: zero previsioni,
  zero mesi chiusi, zero periodi anomali.
- ⚠️ **Non può essere vista coi dati veri, e non per un difetto**: zero
  conti chiusi, zero sconti e omaggi, Ricettario vuoto. Il food cost
  reale non esiste ancora, quindi tutto ciò che riguarda il «misurato» è
  provato solo dentro le migrazioni e dalle prove automatiche.
- **Nessuna causale è marcata «è un costo fisso»**: finché non ne spunta
  almeno una, lo scostamento dichiara i fissi non misurati. È lo stato di
  partenza voluto, ma vuol dire che **quella parte dello scostamento non
  è mai stata vista funzionare con dati veri**.
- **L'azienda agricola non ha parametri fiscali**, e non è una
  dimenticanza: quelle righe le crea Alessio dal Simulatore. Una
  Proiezione su quell'entità mostra tutto tranne le imposte, e **lo
  dichiara** invece di scrivere zero. Il comportamento è provato.
- **L'IRAP resta il rilievo aperto del referto del 13/08**: calcolata
  sull'utile, dichiarata semplificazione. Non si inventa una formula.
- **Il confronto anno su anno non c'è**: serve dal secondo anno, e il
  posto dove segnare i periodi anomali esiste da subito perché dopo non
  si ricostruiscono.
- **I dati di collaudo del magazzino restano in produzione** (deroga del
  13/08, invariata) e `/prova-voce` è ancora lì.
- **In produzione ci sono ancora 2 conti** e **2 prenotazioni di prova**
  del collaudo della sala: sono righe di Alessio, e le toglie lui.
