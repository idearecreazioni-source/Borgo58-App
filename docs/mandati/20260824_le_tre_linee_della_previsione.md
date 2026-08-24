# Le tre linee della previsione — sala, lunch, eventi

**Deciso da Alessio il 24/08/2026**, rispondendo alle tre domande che
avevano fatto saltare il blocco 3d del mandato delle correzioni del
collaudo. **Non è lavoro fatto**: è lavoro *definito*, e questo documento
esiste perché le sue risposte non si perdano fra un riepilogo e l'altro.

---

## Perché era stato saltato

Il mandato del 23/08 chiedeva di sostituire «le linee accessorie
generiche» con tre linee: **SALA** com'è, **LUNCH** con la stessa forma
della sala (coperti, scontrino medio, food cost, dodici mesi), **EVENTI**
con forma propria (quanti eventi al mese, incasso medio per evento, costi
diretti, dodici mesi). Personale e costi fissi restano **comuni**, e il
pareggio si calcola sul totale.

Il blocco è stato saltato — come il mandato stesso consentiva — perché
tre ambiguità cambiavano il risultato. Le risposte sono qui sotto.

---

## 1 · Il lunch deve essere misurabile, e oggi non lo è

**La domanda era**: i conti chiusi non distinguono pranzo da cena
(`orders` non porta il servizio), quindi la linea lunch nascerebbe con un
piano e nessun modo di confrontarla col reale.

**Risposta di Alessio**: *«il gestionale deve imparare a distinguere
pranzo e cena. Senza, la linea lunch è una previsione che non potrò mai
confrontare col reale, e la Proiezione esiste per quel confronto. È
lavoro a parte, da fare prima dell'apertura: NON adesso.»*

⚠️ **Quindi c'è una dipendenza, ed è dichiarata**: il lunch non si
costruisce prima che i conti sappiano a quale servizio appartengono.
Costruirlo prima vorrebbe dire consegnare una linea che mostra sempre
«non misurato» — e uno scostamento permanentemente vuoto dopo due mesi
nessuno lo guarda più.

⚠️ **E il dato esiste già a metà**: `service_hours` distingue pranzo e
cena (la domenica è pranzo, martedì-sabato è cena), e
`serata_di_servizio()` sa a quale giornata appartiene un istante. Quello
che manca è che il **conto** porti con sé quale dei due servizi era.

---

## 2 · Gli eventi sostituiscono le linee accessorie — ma dentro c'era altro

**Risposta di Alessio**: *«sostituiscono le linee accessorie. Ma prima
verifica cosa c'era dentro oltre agli eventi: se ci finiva anche altro,
non deve andare perso.»*

**Misurato il 24/08 leggendo il foglio vero** con il lettore dell'app
(`leggiFoglioExcel` + `leggiScenarioDaFoglio`), non a memoria. Il foglio
ha **quattro** righe di linee accessorie, e solo una è di eventi:

| linea | come si conta |
|---|---|
| **Lounge apericena** | a giornata |
| **Chef table** | a giornata |
| **Barattoli trasformati (pz/giorno)** | a giornata |
| Eventi premium (n/mese) | a evento |

🔴 **Tre voci del piano vero non hanno dove stare nelle tre linee**, e non
sono tre varianti della stessa cosa:

- **Lounge apericena** è un servizio a **coperto**, con uno scontrino
  diverso da quello della sala. Ha la forma della sala, non degli eventi.
- **Chef table** è un servizio a **coperto premium**: stessa forma,
  scontrino ancora diverso.
- **Barattoli trasformati** non è un coperto affatto: è **prodotto
  venduto al pezzo**. Non è sala, non è lunch, non è un evento — e
  nessuna delle tre linee lo descrive.

⚠️ **Questa è la voce da decidere prima di costruire.** Le strade
possibili, senza sceglierne una:
1. le tre linee diventano **quattro o cinque** (sala, lunch, eventi,
   lounge, chef table) e i barattoli restano una linea accessoria;
2. le linee «a coperto» diventano un elenco aperto — se ne aggiungono
   quante se ne vuole, ognuna con scontrino e food cost suoi — e gli
   eventi restano la forma a parte;
3. i barattoli diventano un modulo loro (vendita di prodotto), perché non
   sono ristorazione.

⚠️ **In ogni caso il codice del foglio va rifatto**: oggi
`src/lib/foglioProiezione.js` riconosce come evento *la riga il cui nome
contiene la parola «eventi»*, e tutto il resto diventa «a giornata». Con
tre linee strutturate quella regola non basta più.

---

## 3 · Il pareggio diventa euro, e i coperti restano come informazione

**La domanda era**: oggi il pareggio si legge «servono 2915 coperti»
(fissi ÷ margine per coperto). Con tre linee a scontrini diversi, «coperti
di pareggio» non ha una risposta sola.

**Risposta di Alessio**: *«con tre linee non può più essere un numero di
coperti, sono unità diverse. Diventa un pareggio in EURO di ricavo
totale, e sotto, come informazione, quanti coperti di sala servirebbero se
lunch ed eventi vanno come previsto.»*

⚠️ **Due numeri, e il secondo è subordinato al primo**: il pareggio vero
è in euro; i coperti di sala sono una lettura *condizionata* — «se le
altre linee vanno come previsto». Va scritto nella schermata, o quel
numero verrà letto come il pareggio.

---

## Cosa questo blocco toccherà

Da tenere presente prima di aprirlo, perché è più largo di come sembra:
`calcola_proiezione`, `costanti_scenario`, `riepilogo_calcolato`,
`confronto_a_oggi`, `andamento_anno`, `proiezione_fine_anno`,
`confronto_col_foglio`, l'importazione dal foglio Excel, le due operazioni
del corridoio (`crea_scenario_proiezione`, `aggiorna_scenario_proiezione`),
il form della previsione e la sua scheda.

⚠️ **E i 17 confronti col foglio vero di Alessio andrebbero rifatti**: è
il banco di prova che dal 15/08 dice se il gestionale calcola come il suo
modello, e con tre linee quei confronti cambiano di significato.
