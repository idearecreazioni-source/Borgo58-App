# Le linee della previsione — disegno chiuso il 24/08/2026

**Deciso da Alessio**, in due passaggi nella stessa giornata. **Non è
lavoro fatto**: è lavoro *definito*, e questo documento esiste perché le
sue decisioni non si perdano fra un riepilogo e l'altro.

> ⚠️ **Il titolo diceva «le tre linee», e adesso sono cinque.** Il primo
> disegno del 23/08 le contava tre; misurando il foglio vero è emerso che
> lasciava tre voci senza casa, e Alessio ha chiuso il disegno il 24/08.
> *Il file conserva il percorso, non solo l'esito.*

---

## Come ci si è arrivati

Il mandato del 23/08 chiedeva **tre linee**: sala, lunch, eventi. Il
blocco fu saltato per tre ambiguità. Rispondendo, Alessio chiese di
misurare cosa ci fosse nelle linee accessorie **oltre** agli eventi.

**Misurato leggendo il foglio vero** col lettore dell'app, non a memoria:
quattro righe, e **solo una** è di eventi.

| linea nel foglio | come si conta |
|---|---|
| Lounge apericena | a giornata |
| Chef table | a giornata |
| Barattoli trasformati (pz/giorno) | a giornata |
| Eventi premium (n/mese) | a evento |

🔴 **Tre voci del piano vero restavano senza casa**, e non erano varianti
della stessa cosa. Parole sue: *«hai fatto bene a misurare il mio foglio:
le accessorie erano quattro e la mia decisione di ieri ne lasciava tre
senza casa.»*

---

## Il disegno buono: CINQUE linee, TRE forme

### A COPERTO — stessa forma della sala, ognuna coi suoi numeri

| linea | note |
|---|---|
| **SALA** | come oggi |
| **LUNCH** | coperti e scontrino suoi |
| **CHEF TABLE** | coperti **aggiuntivi a parte**, linea sua: *«costa e rende diversamente dalla sala, non va confuso con essa»* |
| **LOUNGE APERICENA** | linea a sé, col suo scontrino |

### A FORFAIT

| linea | note |
|---|---|
| **EVENTI** | quanti eventi al mese, quanto si incassa in media per evento, coi suoi costi diretti |

### A PEZZO

| linea | note |
|---|---|
| **BARATTOLI TRASFORMATI** | vendita al pezzo con **prezzo variabile**: quanti pezzi al mese e prezzo medio. ⚠️ *«Non è un coperto, non forzarlo in quella forma.»* |

---

## Le regole comuni

1. 🔴 **Chef table e barattoli non partono da subito.** Devono poter
   restare a **zero** senza sporcare il pareggio e **senza comparire come
   «previsione mancata» o scostamento negativo**: *zero previsto e zero
   reale è un allineamento perfetto, non un fallimento.*
   ⚠️ È la stessa famiglia di «il vuoto non è zero», letta al contrario:
   qui uno zero **voluto** non deve essere trattato come un buco.
2. **Personale e costi fissi restano COMUNI** a tutte le linee, non si
   duplicano per linea.
3. **Il pareggio si calcola sul TOTALE, in euro di ricavo**, con sotto
   l'informazione di quanti coperti di sala servirebbero *se le altre
   linee vanno come previsto*. ⚠️ Il secondo numero è **condizionato**, e
   va scritto — o verrà letto come il pareggio.
4. **Ogni linea deve poter essere confrontata col reale** quando i dati ci
   saranno: la struttura lo prevede fin da ora, anche se oggi il
   gestionale non distingue ancora pranzo da cena.

---

## La dipendenza dichiarata: pranzo e cena

*«Il gestionale deve imparare a distinguere pranzo e cena. Senza, la linea
lunch è una previsione che non potrò mai confrontare col reale, e la
Proiezione esiste per quel confronto. È lavoro a parte, da fare prima
dell'apertura: NON adesso.»*

⚠️ **Il dato esiste già a metà**: `service_hours` distingue pranzo e cena
(la domenica è pranzo, martedì-sabato è cena) e `serata_di_servizio()` sa
a quale giornata appartiene un istante. Quel che manca è che **il conto**
porti con sé quale dei due servizi era.

⚠️ **Vale per il lunch, ma anche per lounge e chef table**: sono tre linee
a coperto che il consuntivo dovrà saper separare dalla sala. Il lunch si
separa per *servizio*; lounge e chef table probabilmente per altro
(un'etichetta sul conto, o il tavolo). **Questa è la voce ancora aperta**
del disegno, e va decisa prima di costruire il consuntivo — non prima di
costruire la previsione.

---

## Cosa questo blocco toccherà

Più largo di come sembra: `calcola_proiezione`, `costanti_scenario`,
`riepilogo_calcolato`, `confronto_a_oggi`, `andamento_anno`,
`proiezione_fine_anno`, `confronto_col_foglio`, l'importazione dal foglio
Excel, le due operazioni del corridoio (`crea_scenario_proiezione`,
`aggiorna_scenario_proiezione`), il form della previsione e la sua scheda.

⚠️ **E il lettore del foglio va rifatto**: oggi riconosce l'evento *dalla
parola «eventi» nel nome della riga*, e tutto il resto diventa «a
giornata». Con cinque linee strutturate quella regola non basta più.

⚠️ **I 17 confronti col foglio vero andrebbero rifatti**: è il banco di
prova che dal 15/08 dice se il gestionale calcola come il modello di
Alessio, e con cinque linee quei confronti cambiano di significato.
