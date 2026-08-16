# Consegna del 16/08/2026 (sesta) — Blocco 2 del mandato di correzione

**Commit della consegna: `a6f6452`.** Questo riepilogo è il commit
immediatamente sopra, sola documentazione. Working tree pulito.

| Commit | Cosa |
|---|---|
| `a6f6452` | un solo calcolo per ogni numero — migrazione `20260816000006` |

⚠️ **Ordine seguito** (CLAUDE.md §2, regola 4): commit → push di Alessio →
`npm run migra -- --conferma` → questo riepilogo → secondo push. La
migrazione **`20260816000006` è già applicata in produzione**: i numeri in
§6. Nessuna Edge Function toccata (nessuna operazione nuova nel corridoio:
sono tutte letture).

⚠️ Questa consegna **non modifica** `docs/CONTRATTO.md`.

Blocco 2 del **mandato di correzione**. Con il Blocco 0 e il Blocco 1 già
chiusi, restano i blocchi 3–9 più le piccolezze.

---

## 1. Il difetto — e il terzo non era doppio, era rotto

| # | Dove | Cosa |
|---|---|---|
| 2.1 | `MenuDetail.jsx` | il what-if «e se questo ingrediente rincarasse» ricalcolava il food cost con una **terza copia** della formula |
| 2.2 | `RicettaDetail.jsx` | il costo di ogni riga ricalcolato nel browser accanto a `v_recipe_costs` |
| 2.3 | `Bar.jsx` | il totale del conto sommato a mano invece che dal modulo unico |

🔴 **Il 2.1 non dava lo stesso risultato: si rompeva.** La copia leggeva
`ri.ingredient.current_price`, ma su una **riga-componente** — cioè una
preparazione dentro un piatto — `ri.ingredient` è vuoto. Quindi la
schermata andava in errore su **ogni piatto che contiene un semilavorato**.
E anche quando non si rompeva guardava i soli ingredienti diretti: con
l'approccio «scompongo sempre» di Alessio, un rincaro dentro un soffritto
**non mostrava nessun piatto** — cioè rispondeva «nessuno è toccato» a un
rincaro che tocca tutto il menu.

---

## 2. La cura non è spostare la formula: è toglierne una copia

La regola 6 del mandato dice che una cura che introduce un secondo posto
dove si calcola la stessa cosa è una cura sbagliata. Portare il calcolo
nel database senza altro avrebbe fatto esattamente questo — un simulatore
lato database *accanto* a `v_recipe_costs`.

Il food cost è stato quindi scomposto in tre pezzi che si conoscono **in
un verso solo**, senza mai ripetersi:

| Pezzo | Cos'è | Cosa NON fa |
|---|---|---|
| `espansione_costo_ricetta(ricetta)` | **la ricorsione**: l'unico posto dove si cammina nell'albero delle preparazioni | non moltiplica niente |
| `v_recipe_row_costs` | **la formula**: l'unico posto dove un costo si moltiplica (quantità × prezzo × scarto) | non cammina nell'albero |
| `v_recipe_costs` | **la somma**: `sum()` delle righe diviso le porzioni | **non ha più nessuna formula propria** |

⚠️ **La differenza fra la ricorsione di prima e questa è una sola cosa**:
`riga_id`, cioè da quale riga di **primo livello** ogni foglia discende. È
quel filo che permette a una schermata di dire «questa riga costa X» senza
rifare il conto per conto proprio — ed è il motivo per cui il 2.2 si cura
senza scrivere una seconda moltiplicazione.

⚠️ **`v_recipe_costs` è stata riscritta, e i dipendenti no.**
`create or replace` e non drop+create, perché `v_menu_item_economics`
dipende da lei: colonne, ordine e tipi restano identici. La verifica **non
si fida di questa frase**: costruisce una ricetta a tre livelli e confronta
i numeri con quelli calcolati a mano.

**Il simulatore non ricalcola il food cost: lo sposta.**
`simula_prezzo_ingrediente()` parte dal costo che `v_recipe_costs` già
conosce e ci aggiunge la sola **differenza** di prezzo, moltiplicata per
quanto di quell'ingrediente entra davvero in una porzione — attraverso
quante preparazioni siano. Rifare la moltiplicazione sarebbe stata la
quarta copia.

---

## 3. La cura sarebbe stata a metà

⚠️ Anche **l'elenco a tendina** del simulatore era costruito nel browser
sui soli ingredienti **diretti** delle ricette del menu. Quindi la cipolla
che sta unicamente dentro un soffritto **non era nemmeno selezionabile**:
si poteva simulare bene soltanto ciò che il simulatore rotto sapeva già
vedere. `ingredienti_del_menu()` restituisce tutto ciò che il menu consuma
davvero, e marca con `solo_in_preparazioni` proprio i casi che prima erano
invisibili — che la schermata mostra sia nell'elenco sia accanto al piatto
(«attraverso una preparazione»).

---

## 4. Gli altri due punti

**2.2** — la scheda della ricetta legge il costo di ogni riga da
`v_recipe_row_costs`. ⚠️ **Righe e costi si ricaricano insieme** (helper
`ricaricaRighe()`): ricaricare le sole righe dopo aver cambiato una
quantità mostrerebbe la quantità nuova col costo di prima, che è **peggio**
del vecchio ricalcolo nel browser — sbaglia in silenzio invece di essere
solo una copia.

**2.3** — il riquadro cassa del Bar usa `orderTotals()`. La sua somma a
mano **ignorava `orders.coperto_unit_price`**, il prezzo del coperto
fotografato sul conto: oggi coincide solo perché i conti aperti non ce
l'hanno ancora, e sarebbe divergita senza che nessuno cambiasse niente.

**Codice morto rimosso di conseguenza**: `MenuDetail` non carica più le
righe di ricetta né l'anagrafica ingredienti (servivano solo alla copia
della formula) — due giri di rete in meno.

---

## 5. Criterio di accettazione: il censimento del client

> *«Cercando nel codice client non deve restare nessuna somma di righe o
> percentuale di food cost che esista già come funzione o vista nel
> database. Elencare nel riepilogo i punti verificati.»*

| Punto | Esito |
|---|---|
| `orderTotals()` — chi calcola il totale di un conto | 5 consumatori, **tutti** dal modulo unico: `Bar`, `Sala`, `PrecontoModal`, `CloseOrderModal`, `api/orders.js` (ri-export) |
| Somme di `unit_price` fuori da `calcoli/conto.js` | **nessuna** |
| Moltiplicazioni con `current_price` / `waste_percentage_default` | **nessuna** che produca un costo. `RicettaDetail` legge ancora `waste_percentage_default`, ma **solo per mostrare la colonna «% scarto»** — non per calcolare |
| Medie di food cost del menu (`MenuDetail`, righe 93-120) | **lasciate**: sono medie per categoria e riassunti della schermata, calcolate sui `food_cost_pct` che il database fornisce già. Non esiste una vista che le calcoli — non sono un doppione, sono un'aggregazione di presentazione. ⚠️ *La media di medie non ponderata è però un rilievo delle «piccolezze» del mandato e resta aperta lì.* |
| `IngredienteForm` riga 126 — scostamento del prezzo dalla media storica | **lasciato e dichiarato**: nessuna funzione del database calcola quel numero. `variazione_prezzo()` risponde a un'altra domanda (l'ultimo prezzo della **stessa versione**, non la media) |

---

## 6. Cosa è stato verificato, e come

**Dentro la migrazione, col ruolo vero del titolare.** La ricetta di prova
è a tre livelli apposta, coi numeri scelti perché il risultato si controlli
**a mano** e non con un'altra query — che sarebbe la stessa formula scritta
un'altra volta:

```
SOFFRITTO (resa 2 kg) : 1 kg cipolla 2,00/kg, scarto 20%  -> 2,40
RAGU      (resa 4 kg) : 1 kg soffritto -> (1/2) x 2,40    -> 1,20
                        2 kg carne 10,00/kg               -> 20,00   tot 21,20
PIATTO    (4 porzioni): 0,5 kg ragu -> (0,5/4) x 21,20    -> 2,65
                        0,1 kg carne                      -> 1,00
                        1 kg basilico OPZIONALE           -> escluso
                        base 3,65, a porzione 0,9125
```

| # | Controllo | Esito |
|---|---|---|
| 5a | I tre food cost e la porzione, uno per uno | 2,40 · 21,20 · 3,65 · 0,9125 — **identici a prima della riscrittura** |
| 5b | Le righe valorizzate dal database | riga ragù 2,65, riga carne 1,00, **riga opzionale 0** |
| 5b | La somma delle righe **è** il food cost | 3,65 = 3,65 |
| 5c | Simulazione: cipolla +100% | 0,95 a porzione, seguendo due preparazioni |
| 5c | **La simulazione coincide col food cost vero** alzando il prezzo per davvero | 0,95 = 0,95 |
| 5c-bis | La cipolla è selezionabile e marcata «solo dentro preparazioni» | sì |
| 5c-bis | Una guarnizione opzionale **non** risulta consumata dal menu | corretto |
| 5d | Un ingrediente non usato non produce righe finte | 0 righe |
| 5e | Lo staff riceve un **rifiuto**, non un elenco vuoto | respinto — da quelle funzioni escono i prezzi d'acquisto |

⚠️ Il controllo **5c seconda riga** è quello che vale più degli altri: se
simulatore e food cost vero si allontanassero, **nessuna delle due
schermate sembrerebbe sbagliata** — direbbero solo due numeri diversi. È
ripetuto anche nelle prove automatiche.

⚠️ Nessun gestore d'eccezione sul blocco esterno (lezione del 15/08); il
perimetro è fatto solo di roba creata dalla verifica, ingredienti compresi
(lezione del 16/08 mattina). Il Ricettario **non** è sorvegliato da
`deleted_records` (scelta dichiarata l'08/08), quindi la pulizia non lascia
lapidi — verificato in produzione: **0 righe nuove nel registro**.

**Prove automatiche:** 4 nuove in `tests/app/food-cost-un-solo-calcolo.test.js`.
Quella strutturale è la prima: **la somma delle righe deve essere il food
cost della ricetta**, quindi una seconda moltiplicazione rimessa da
qualche parte fa diventare rossa la prova da sola. Suite intera: **18 pure
+ 105 sul progetto di prova, tutte verdi.** Lint a zero, build ok.

**Idempotenza:** applicata tre volte di fila sul progetto di prova, sempre
senza errori.

---

## 7. I numeri veri dell'applicazione in produzione

```
applicate e registrate: 1 su 1
totale migrazioni in produzione: 113
```

| Controllo (connettore in sola lettura, dopo) | Valore |
|---|---|
| Viste `v_recipe_costs` + `v_recipe_row_costs` | 2, presenti |
| Funzione `espansione_costo_ricetta` | presente |
| Ricette / menu | **0 / 0** |
| Ingredienti residui della verifica | 0 |
| Righe di storico prezzi | **26, invariate** |
| Funzioni di `public` eseguibili col solo `anon` | **12, invariate** |
| Righe nuove nel registro delle cancellazioni | 0 |

**Nessun numero esistente è cambiato**, e non poteva: il Ricettario è vuoto
— 0 ricette, 0 menu, 8 ingredienti — letto col connettore **prima** di
scrivere la migrazione.

---

## 8. Cosa NON è verificato

- **Niente di tutto questo è mai stato visto su dati veri.** Non ci sono
  ricette né menu: il food cost, la scheda della ricetta e il simulatore
  non hanno mai calcolato niente di reale, né prima né dopo la correzione.
- **Nessuna mano vera ha aperto il simulatore.** Che si rompesse sui
  piatti con preparazione è dedotto leggendo il codice (`ri.ingredient` è
  `null` su una riga-componente) e non riprodotto in un browser: il difetto
  non è riproducibile oggi, perché servirebbe un piatto con un semilavorato
  e non esiste nessuna ricetta.
- **Le prestazioni non sono misurate.** `v_recipe_row_costs` chiama
  l'espansione una volta **per riga di ricetta**: interrogando una ricetta
  sola sono poche chiamate, ma `v_recipe_costs` su tutto il Ricettario ne
  fa una per ogni riga di ogni ricetta. Con qualche decina di ricette è
  irrilevante; è dichiarato perché il giorno in cui il Ricettario sarà
  pieno vada guardato, non riscoperto.
- **Il caso di un ciclo fra preparazioni** non è provato qui: è già
  impedito da un vincolo esistente, e il limite di profondità 10 è quello
  che c'era prima, ricopiato uguale.
