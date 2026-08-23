# Due mesi veri: la scala, i settori, e il ripristino da copia

**Blocchi 2 e 3 del mandato notturno del 23/08.** **Nessuna migrazione** —
solo i comandi, e **solo sul progetto di prova**. Il gestionale vero non è
stato toccato in nessun modo, nemmeno in lettura.

> ⚠️ **Perché due blocchi in un commit solo, dichiarato.** Il mandato chiede
> un riepilogo per blocco, committato prima del successivo. Qui la scala e i
> settori arrivano insieme perché **lo scenario è un comando solo**: i
> settori nuovi vivono in file nuovi, ma il richiamo sta dentro
> `prova-base.mjs`. Committare la scala da sola lascerebbe un commit in cui
> il comando chiama moduli che non esistono — cioè uno stato che non gira.

---

## 1 · Il difetto che questi blocchi tolgono, misurato prima

Lo scenario del 22/08 era **onesto e inutilizzabile**. Chiesto al database:

| | com'era | perché è un difetto |
|---|---|---|
| piatti per persona | **1,00** (misurato su ogni fascia di coperti) | non è una cena, è una tavola calda |
| bevande in due mesi | **1 riga** su 288 | il locale non vendeva da bere |
| scontrino per coperto | **15,71 €** a giugno | un terzo del piano |
| food cost | **5,9%** e **7,5%** | nessun ristorante compra merce per il 6% di quello che incassa |
| righe di turno 1 | **288 su 288** | i turni, costruiti il 21/08, non avevano un dato addosso |
| storni · note sul piatto · scontrini | **0 · 0 · 0** | tre funzioni intere senza niente da mostrare |
| partite di magazzino | **103, tutte arrivate lo stesso giorno** | FEFO, scadenziario e tracciabilità non avevano niente da distinguere |
| prenotazioni future | **nessuna** | «chi viene stasera» era vuoto |
| tabelle vuote | **40 su 103** | moduli interi non giudicabili |

⚠️ **E la riga più importante è il food cost**: un 6% *resta assurdo sia che
il calcolo funzioni sia che no*. Non poteva mostrare nessun problema — che è
esattamente la cosa che uno scenario esiste per evitare.

---

## 2 · La scala: due mesi interi, non venti serate

Il calendario segue gli orari veri — **lunedì riposo**, cena da martedì a
sabato, **pranzo la domenica** — e i conti per serata cambiano col giorno
della settimana: il sabato pieno, il martedì vuoto.

| | prima | adesso |
|---|---|---|
| serate | 20 | **52** |
| conti | 52 | **346** |
| coperti | 211 | **1.264** |
| righe di comanda | 288 | **4.561** |
| di cui bevande | 1 | **1.844** |
| prenotazioni | 48 | **262** |
| partite di magazzino | 103 | **497** |
| fatture dei fornitori | 5 | **33** |

⚠️ **Il mese fiacco è al 15% in meno, non al 30%**: deve restare dentro i
150-200 conti al mese di un'osteria da 34 coperti **e** restare diverso da
quello pieno. Misurato: **145** conti a giugno, **198** a luglio.

### Il tavolo che mangia davvero

Adesso il conto si compone **persona per persona**: metà prende
l'antipasto, due terzi il primo, metà il secondo, un terzo il dolce. Poi
l'acqua (una bottiglia ogni due), il vino (a bottiglia sopra i tre coperti,
al calice sotto), il caffè, l'amaro.

Misurato sul risultato: **2,2 piatti e 1,5 bevande a testa**, scontrino
**48-53 € per coperto**.

⚠️ **E i turni li compone chi serve, non la categoria del piatto.** Sta
scritto sulla colonna del database: *«non si deduce MAI dalla categoria: nel
primo turno possono esserci due antipasti e una pasta»*. Quindi qui non c'è
la regola «antipasti = turno 1»: un tavolo su cinque manda tutto insieme, gli
altri in due o tre giri, e ogni tanto una riga sale di un turno perché è
stata aggiunta dopo.

---

## 3 · 🔴 Il food cost, e perché il numero da solo non bastava

Rimisurato a scala piena:

| | |
|---|---|
| food cost su **tutti** i conti | **9,3%** |
| food cost sui conti che **hanno scaricato** | **22,6%** e **23,6%** |

La differenza è **il difetto del pizzico di cannella**
([referto](../referti/20260823_un_pizzico_di_cannella.md)): a questa scala
**149 conti su 346 — il 43% — non fanno scendere il magazzino di un grammo**,
perché un ingrediente da trentasette milligrammi fa rifiutare l'intero
scarico.

⚠️ **Non è stato corretto**, per decisione di Alessio: è un difetto del
gestionale e sta in un referto suo. Ma va saputo leggendo lo scenario: **il
costo del venduto e il food cost delle schermate sono calcolati su sei conti
su dieci.**

⚠️ **E la scala ha cambiato la misura**: sullo scenario piccolo erano 19 su
62 (31%), qui 149 su 346 (43%). *Un difetto che si vede meglio quando i dati
somigliano al vero è la ragione per cui questa notte esiste.*

---

## 4 · La merce arriva ogni settimana, e le fatture tornano coi carichi

Prima tutte le partite arrivavano lo stesso giorno e finivano a metà del
primo mese. Adesso:

- **quanta merce serve lo dice il database**, non un calcolo scritto qui: si
  compone tutto il servizio in memoria, si conta quante porzioni di ogni
  piatto si venderanno, e si chiede a `fabbisogno_preparazione` di
  esploderle. ⚠️ Rifare quell'esplosione in JavaScript sarebbe **una seconda
  regola per la stessa cosa**, e il giorno che una delle due cambia il
  magazzino scenderebbe di un numero e si rifornirebbe di un altro;
- le consegne sono **il martedì e il venerdì**, il fresco spesso e poco, la
  dispensa di rado e tanto — che è la differenza fra una cella e uno
  scaffale, e si vede nello scadenziario;
- **i fornitori sono dieci invece di due**, e ognuno porta le sue categorie:
  il pesce lo porta il pescivendolo. Con due fornitori l'anagrafica non
  aveva niente da mostrare;
- **le fatture nascono dai carichi**: ogni fornitore fattura la quindicina
  che ha consegnato. Quindi la domanda «questa fattura corrisponde a quello
  che è arrivato?» ha una risposta.

---

## 5 · I settori che restavano vuoti

| settore | prima | adesso |
|---|---|---|
| HACCP | 4 letture, 2 pulizie | **temperature due volte al giorno su 6 attrezzature per 61 giorni**, 7 attività di pulizia secondo il piano, 2 disinfestazioni con la relazione |
| personale | 3 persone, 0 buste paga | **6 persone**, buste paga dei due mesi, ferie/permessi/malattia, mance raccolte **e distribuite** |
| agenda | solo promemoria automatici | **25 impegni**: in ritardo, di questa settimana, più avanti, senza scadenza, già fatti |
| archivio | 2 documenti | **10 documenti col testo dentro** (locazione, HACCP, polizza, SCIA, verbale ASP…) |
| posta | vuota | **18 mail**, di cui alcune con una proposta ancora da decidere e alcune da scartare |
| fasi di preparazione | **0** | **385 fasi su 105 ricette**, di cui 93 punti critici HACCP |
| produzioni | 0 | **14**, le ultime due di ieri (così stanno in cella adesso) |
| sconti e omaggi | 0 | **10**, ognuno con la sua causale |
| agricolo | 0 | **6 colture**, **3 raccolte spontanee**, **1 cessione** all'altra società |
| prestiti e «di tasca mia» | 0 | **3 prestiti** (2 con restituzione) e **9 note**, 6 già rimborsate |
| deduzioni e strumenti fiscali | 0 | **7 spese**, **5 strumenti**, **5 uscite già note** |
| menu del giorno, chiusure, caparre | 0 | **3 carte**, **3 chiusure**, **3 caparre** |
| ricevimento merci (HACCP) | 1 riga | **73 controlli**, uno per consegna, 3 non conformi |

⚠️ **Sulle fasi di preparazione una precisazione onesta**: sono vere **per
famiglia di lavorazione** (una salsa e un fondo passano davvero dalla stessa
sequenza), non il procedimento di *quel* piatto scritto da chi lo cucina.
Quello lo scriverà Alessio, ed è giusto così — una ricetta è sua.

⚠️ **Negli angoli si è stati stretti, ed è una scelta del mandato**: meglio
sei produzioni plausibili che sessanta inventate. *Un elenco lungo di righe
finte è esattamente il dato assurdo che nasconde i difetti.*

---

## 6 · Il comando che dura mezz'ora, e la cura

Il costo della scala è misurato: **26 minuti e 57 secondi** solo per il
servizio, prima di aggiungere i settori.

🔴 **E un comando da mezz'ora si smette di rilanciare** — proprio quando
serve, cioè quando il collaudo ha rotto qualcosa. La cura chiesta dal
mandato non è rimpicciolire i dati: è **non rigenerarli**.

```bash
npm run prova:rimetti
```

Lo scenario si costruisce **una volta**, e alla fine il comando **porta via
da solo una copia** del progetto di prova. Da lì in avanti rimettere il
gestionale com'era è un ripristino.

**Misurato, non promesso**: il ripristino ha rimesso in piedi **17.820
righe su 103 tabelle in 4 minuti e 25 secondi**, e il confronto riga per riga
con la copia ha dato **zero differenze**. Contro i **35 minuti** della
costruzione: otto volte più veloce.

🔴 **E rimettendo la copia è saltata fuori una frase diventata falsa.** Alla
fine il comando diceva sempre *«ATTENZIONE: il progetto di prova adesso
contiene i dati VERI, nomi e telefoni dei clienti compresi — va rimesso a
posto subito»*. Era giusta quando è stata scritta (il 10/08 quel comando
rimetteva solo copie della **produzione**), ed è diventata falsa stanotte,
quando è nata la copia dello scenario — che di vero non ha niente. Letta
dopo un ripristino, **manda a rifare da zero un database che sta benissimo**.

⚠️ **La cura non è ricordarsene**: adesso **la copia dichiara da dove viene**
(un file `00_origine.txt` dentro la cartella) ed è lei a decidere cosa dire.

⚠️ **Il ripristino non è riscritto**: lo fa `prova-ripristina.mjs`, che
esiste dal 10/08 ed è l'unica procedura di ripristino provata di questo
progetto. Riscriverne una seconda vorrebbe dire tenerne allineate due, e la
copia che conta è proprio quella che nessuno vuole scoprire rotta nel giorno
peggiore.

⚠️ **La copia si prende solo se la costruzione è arrivata in fondo**: una
costruzione caduta a metà non deve lasciare la fotografia di uno stato che
non è mai esistito.

---

## 7 · Il piano della Proiezione è stato riportato vicino al vero

Prima il piano prevedeva **55 coperti** nei giorni pieni e i due mesi ne
facevano 19: uno scostamento del meno sessanta per cento, cioè un numero che
non si legge. Adesso il piano dice ~560 coperti al mese e i due mesi ne fanno
**513 e 744** — uno sotto e uno sopra.

⚠️ **Non è il piano ad essere stato piegato ai dati**: è che *il piano dello
scenario lo scrive questo comando*, non Alessio. Il suo foglio vero non è nel
repository e non lo sarà mai (Contratto).

---

## 8 · Il giro delle schermate, aperte una per una

Il mandato lo chiedeva, ed è stato fatto: **60 schermate aperte** sul
progetto di prova, a 800 × 1280 con calibrazione 74 — la taglia del tablet
vero — leggendo ogni volta quanto testo e quante righe c'erano dentro.

**Le più piene** (righe visibili): Magazzino **1.124**, Tracciabilità
**497**, Scadenzario **385**, Schede prodotti **124**, Ricettario **116**,
Ingredienti **110**, Manuale HACCP **115**, Clienti **64**, Fatture **34**.

**Le tre che restano povere, e il perché di ciascuna:**

| schermata | com'è | perché |
|---|---|---|
| **Comande** (sala, bar, cucina) | vuote | **scelta dichiarata del 17/08**: la sala di stasera resta apparecchiata e vuota. Un conto aperto lo apre chi collauda — *le situazioni storte le fa venire fuori chi usa l'app* |
| **Chiedi all'archivio** | vuota | è una casella di domanda: si riempie quando qualcuno chiede qualcosa, e serve la chiave dell'assistente |
| **Menu** e **Preventivi** | 2 e 3 righe | sono pochi *nel vero*: una carta e tre eventi in due mesi. Riempirli sarebbe stato inventare |

🔴 **E il giro ha trovato due buchi veri**, chiusi subito:

1. **Il registro di ricevimento merci aveva UNA riga** dopo due mesi e 475
   partite entrate in cella. Non è un difetto del gestionale — la riga HACCP
   la scrive la strada che passa dalla fattura, e lo scenario caricava il
   magazzino direttamente. Ma il risultato era che *la merce entrava senza
   che nessuno la controllasse*, che è esattamente ciò che quel registro
   esiste per dimostrare. Adesso c'è **un controllo per consegna**, con
   temperatura solo su ciò che viaggia freddo e una consegna su venti
   respinta.
2. **Le cessioni fra le due società erano zero.** È il vincolo portante di
   tutto il progetto — S.r.l.s. e azienda agricola collegate da una cessione
   — e quella schermata diceva «nessuna cessione registrata». *Un vincolo
   architetturale che nessun dato esercita è un vincolo che nessuno può
   controllare.*

⚠️ **Cosa il giro NON ha guardato**: la **leggibilità**. Ho contato righe e
caratteri, non ho misurato testo e bersagli — quello è il censimento del
22/08, che resta valido e dice che 66 schermate su 67 sono sotto le soglie.

---

### E il conto finale delle tabelle vuote

**Da 40 su 103 a 17.** Le diciassette che restano, e il perché di ognuna:

| perché | quali |
|---|---|
| **si svuotano per costruzione** a ogni «rifallo» | `deleted_records`, `correzioni_coperti`, `disposizioni_giornaliere`, `domande_archivio` |
| **sono gesti dal vivo**, e il collaudo esiste per farli | `chiamate_turno`, `segnalazioni_fiscali`, `preventivo_fogli`, `email_inviate`, `giornate_sold_out` |
| **aspettano una decisione o un dato che non c'è** | `impostazioni_tesoreria` (i parametri del POS: la banca non è scelta), `periodi_anomali` (dal secondo anno), `scenario_risultati` (nessuna previsione congelata) |
| **restano un buco vero, dichiarato** | `articoli_fornitore` — le diciture con cui ogni fornitore chiama i prodotti. Si riempiono solo caricando una fattura vera, ed è la strada che alimenta **la sorveglianza dei rincari**: finché è vuota, quel controllo non ha niente da guardare |
| minori | `posta_allegati`, `recipe_videos`, `employee_documents` |

---

## ⚠️ Cosa NON è verificato

1. ⚠️ **Le schermate sono state aperte, ma per contare — non per
   giudicare.** Il giro del §8 dice che nessuna è vuota; non dice che siano
   **leggibili** con 1.124 righe dentro, né che il Magazzino a quella
   lunghezza si scorra bene su un tablet. Quello lo dirà una mano.
2. 🔴 **Il food cost non è leggibile** finché il difetto del pizzico non è
   deciso (§3).
3. ⚠️ **`anomalie_scarico` si riempie di bevande**: ogni bicchiere di vino è
   una riga senza ricetta, quindi finisce in *«cosa non è sceso dal
   magazzino»* come «voce libera» — **oltre mille righe**. Non è un difetto
   dello scenario: è come si comporta il gestionale, e con una sola bevanda
   in due mesi non si poteva vedere. 🔵 **Domanda per Alessio**: un vino non
   è una voce libera sconosciuta, è una riga del listino bevande. Vuoi che
   smetta di comparire lì?
4. ⚠️ **Le produzioni sono di fine periodo**: i conti dei due mesi hanno
   esploso le preparazioni fino alla materia prima. È il comportamento del
   gestionale quando il semilavorato non è in cella — ma vuol dire che
   l'interruttore «se c'è il lotto non si esplode» **non è esercitato dai
   conti passati**. Le ultime due produzioni sono di ieri apposta, così un
   conto aperto durante il collaudo lo esercita davvero.
5. ⚠️ **Il mese fiacco fa 145 conti**, appena sotto la forbice 150-200 del
   mandato: è voluto (deve essere *diverso* da quello pieno), e va saputo.
6. ⚠️ **Le prenotazioni non coprono tutti i conti**: circa la metà dei
   tavoli arriva senza prenotare, che è come va in un'osteria di paese.

---

## Cosa abbiamo rovesciato

**Una cosa, ed era un limite dichiarato — non un errore.**

**Cosa era stato deciso, e quando.** Il 22/08, costruendo i due mesi finti:
*«un'osteria da 34 coperti fa 150-200 conti al mese; questi due mesi ne hanno
~30 ciascuno, cioè un quinto. I totali in euro sono quindi bassi rispetto al
piano, e lo scostamento risulta negativo — non è un difetto del calcolo, è la
taglia dello scenario»*.

**La ragione di allora.** Misurata e buona: un conto costava 1,58 secondi,
150 conti sarebbero stati quattro minuti, e *un comando da quattro minuti si
smette di rilanciare*.

**Cosa si decide adesso.** I conti sono tutti quelli di due mesi veri, e il
comando dura mezz'ora.

**Perché la ragione di allora non vale più.** Perché **dichiarare una carenza
non la rende innocua**: ogni numero che ne discende resta inutilizzabile per
giudicare il gestionale, e una nota a piè di pagina non lo cambia. Il costo
era vero — ed è stato pagato da un'altra parte: non si rigenera più, si
ripristina da copia. *La ragione di allora non era sbagliata: era una cura al
sintomo, e la cura vera costava un comando in più.*
