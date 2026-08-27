# Prodotto e ingrediente — la misura e il disegno

**27/08/2026.** Fase A (misura) e Fase B (disegno) del Blocco 1 del mandato
sulla separazione prodotto / ingrediente. Il disegno è scritto **prima** di
costruirlo, e confrontato voce per voce con [`docs/DECISIONI.md`](../DECISIONI.md).

---

## Fase A — cosa c'è oggi

### Le righe, nei due gestionali

| | prova | VERO |
|---|---|---|
| `ingredients` | **133** | **0** |
| di cui preparazioni (`preparazione_id`) | 14 | 0 |
| `articoli_fornitore` | **0** | **0** |
| `price_history` | 115 | 0 |
| di cui con `articolo_id` | **0** | 0 |
| `stock_lots` | 499 | 0 |
| `recipes` | 116 | **14** |
| `recipe_ingredients` | 319 | **0** |
| `menus` / `menu_items` | 4 / 37 | 1 / 14 |
| `suppliers` | 11 | 0 |

🔴 **Nel gestionale VERO i prodotti sono zero, e le 14 ricette non hanno
nemmeno una riga di ingredienti.** La separazione là non sposta niente: si
può sbagliare sulla prova senza pagare. È anche la ragione per cui il food
cost delle 14 ricette vere è **zero prima e zero dopo** — non c'è nulla da
cui calcolarlo. Coerente con la decisione del 26/08 («le 14 ricette senza
ingredienti sono normali e non si toccano»).

### La radice della confusione, misurata

`articoli_fornitore` **esiste dal 12/08 e non è mai stata usata**: zero
righe su tutti e due i database, e **zero** righe di `price_history` con un
`articolo_id`. L'infrastruttura della separazione c'è ed è muta.

Il perché sta in una funzione: **`trova_o_crea_ingrediente`** — quella da
cui passa l'assistente quando legge un'etichetta — cerca per nome fra gli
**ingredienti** e, se non trova, **crea un ingrediente**. Quindi
«MAIONESE HELLMANN'S 500 ml» non diventa *un prodotto dell'ingrediente
maionese*: diventa **un ingrediente a sé**. Da lì i 133 ingredienti, e i
**20 su 133 in categoria «altro»** (15,0%).

### Dove passa il food cost — un punto solo

```
v_recipe_costs -> v_recipe_row_costs -> espansione_costo_ricetta
                                     -> ingredients.current_price
```

**Il food cost di ogni ricetta dipende da una sola colonna:
`ingredients.current_price`.** Nessun'altra strada.

Linea di base misurata sulla prova: **106 ricette con almeno una riga**,
somma dei `food_cost_base` = **481,7078**, somma dei `food_cost_portion` =
**481,2458**, **zero** ricette a costo zero.

### Chi scrive `current_price` oggi — cinque strade

| chi | quando |
|---|---|
| `update_ingredient_price` | l'unica che scrive **anche** `price_history` |
| `chiudi_riga_lista` | chiude una riga della lista della spesa comprando |
| `create_intercompany_cession` / `delete_…` | cessione dall'agricola |
| `esegui_azione_posta` | il carico che nasce da una fattura |
| `IngredienteForm` (schermata) | Alessio lo scrive a mano |

🔴 **E una strada che NON lo scrive: `register_stock_delivery`.** Il carico
di magazzino a mano inserisce il lotto **con il suo `unit_cost`** e non
tocca `current_price`. Misurato leggendo il corpo vivo: la funzione scrive
`stock_lots` e chiama `registra_arrivo_in_lista`, e basta.
**Conseguenza: oggi far entrare merce a un prezzo nuovo non muove il food
cost.** È esattamente ciò che la decisione del 25/08 pretende («il food cost
del piatto si calcola sul prezzo dell'ULTIMA versione entrata in
magazzino»), e oggi non è vero.

### Cosa tocca prodotti e ingredienti

- **24 funzioni** scrivono in `ingredients`, `articoli_fornitore`,
  `price_history` o `stock_lots`.
- **29 schermate** nominano ingredienti o articoli.
- **21 tabelle** hanno una colonna `ingredient_id` / `articolo_id`.
- `stock_lots` punta **all'ingrediente**, mai a una versione: la giacenza
  segue già l'ingrediente (decisione del 25/08, **già rispettata**).
- L'indice unico di `articoli_fornitore` è su
  `coalesce(supplier_id, '000…0'), chiave`: **un prodotto senza fornitore
  ci sta già**, e serve per la spesa spicciola al supermercato.

### Le categorie — il vincolo del Blocco 2

`ingredient_category` è un **enum di 15 valori**. Un enum non si allunga da
una schermata, e in Postgres un valore appena aggiunto non è usabile nella
stessa transazione. **Questo, e non il pulsante, è il lavoro del Blocco 2.**

---

## Fase B — il disegno

### Cosa diventa cosa, in un paragrafo

**`articoli_fornitore` diventa il PRODOTTO**, e non nasce una tabella
nuova. La ragione è il discriminante del 17/08: le due direbbero
*esattamente* la stessa cosa — «una versione acquistabile di un
ingrediente, riconoscibile da una descrizione» — quindi una seconda tabella
sarebbe un doppione, cioè la forma di difetto che questo progetto continua a
incontrare. Il PRODOTTO acquista quello che gli manca — **marca**, **come lo
chiama Alessio**, e il **legame col lotto** — mentre l'INGREDIENTE resta uno
solo per cosa si cucina, con dentro le sue versioni. La giacenza continua a
seguire l'ingrediente e **il FEFO non si tocca**: il lotto guadagna
`articolo_id`, quindi «scende la versione più vecchia ancora buona» resta
vero per costruzione invece di essere una regola nuova da scrivere.
**`ingredients.current_price` diventa un RIFLESSO** — il prezzo dell'ultima
versione entrata in magazzino — scritto **solo da un trigger** e definito in
**una** funzione, al posto delle cinque strade di oggi; e la colonna dice
**da dove viene** (`prodotto` / `a_mano` / vuoto), perché un prezzo scritto a
mano e uno misurato oggi sono indistinguibili. La formula del food cost
**non cambia di una riga**: cambia soltanto chi riempie l'unico numero da cui
dipende, e questo è ciò che rende dimostrabile che il food cost non si rompe
in silenzio.

### Le colonne nuove, e perché ognuna

| dove | colonna | perché |
|---|---|---|
| `articoli_fornitore` | `marca` | la decisione del 25/08 la nomina; oggi non esiste |
| | `nome_esteso` | la decisione del 25/08 sulle sigle di scontrino («MAION SG 500» -> maionese) |
| | `formato` | «cassa da 6 kg», «bottiglia da 1 L»: oggi vive spezzato in `unita_fattura`+`fattore`, che sono la **conversione**, non il nome del formato |
| `stock_lots` | `articolo_id` | quale versione è entrata. Senza, la media e l'andamento per versione non si possono calcolare, e la tracciabilità si ferma all'ingrediente |
| `ingredients` | `prezzo_da` | tre stati: `prodotto`, `a_mano`, **vuoto** = nessuno l'ha ancora detto |

⚠️ **`marca` e `formato` nascono VUOTI e restano ammessi vuoti**: la spesa
spicciola e lo sfuso non hanno marca, e pretenderla farebbe scrivere numeri
finti per passare oltre.

### Il riflesso, scritto per intero

- **`prezzo_ultima_versione(ingrediente)`** è l'unico posto dove si decide
  quale prezzo comanda: l'`unit_cost` del **lotto entrato per ultimo** fra
  quelli con un costo. Non «la media», non «il minimo».
- Il trigger sta su **`stock_lots`** (inserimento e modifica del costo) e
  scrive `current_price` + `prezzo_da = 'prodotto'`.
- ⚠️ **La strada a mano resta**, e non è una scappatoia: le ricette si
  caricano **prima** dei prodotti (decisione del 25/08), quindi un
  ingrediente senza nessun lotto deve poter avere un prezzo scritto da
  Alessio — altrimenti il suo food cost è **zero**, e uno zero non è una
  risposta. `update_ingredient_price` continua a esistere e scrive
  `prezzo_da = 'a_mano'`.
- ⚠️ **Il prodotto vince sulla mano solo quando il prodotto esiste.** Un
  lotto che entra sovrascrive il prezzo a mano — è il senso della decisione
  («il costo si muove da solo quando cambia il prezzo»). Il verso opposto è
  la parte da provare rompendola, perché è dove le due strade si incontrano.

### Media e andamento

`price_history` ha già `articolo_id`: la media e il trend si **leggono**, non
si conservano. Una funzione sola (`andamento_prezzo`) risponde per
ingrediente **e** per versione, e le sezioni la chiamano invece di rifarsi
il conto — stesso patto di `orderTotals()`.

### Cosa il disegno NON fa

- **Non converte niente.** Decisione del 25/08: il gestionale verrà
  resettato prima dell'uso vero. I 133 ingredienti della prova restano dove
  sono; nessuna sanatoria li spacca in prodotti, perché sarebbe lavoro
  buttato e una sanatoria su dati finti non dimostra niente.
- **Non tocca `v_recipe_costs` né `v_recipe_row_costs`.** È la garanzia.
- **Non tocca il FEFO.**

---

## Il confronto con le decisioni, voce per voce

| decisione | come è onorata |
|---|---|
| 25/08 reset prima dell'uso vero, nessuna conversione | nessuna sanatoria sui dati di oggi |
| 25/08 prima le ricette, poi i prodotti | il prezzo `a_mano` resta la strada per un ingrediente senza prodotti |
| 25/08 separare PRODOTTO (marca, formato, prezzo, data, descrizione propria) da INGREDIENTE unico | `articoli_fornitore` diventa il prodotto e acquista `marca`, `formato`, `nome_esteso`; prezzo e data restano in `price_history` per versione |
| 25/08 la giacenza segue l'INGREDIENTE | già vero, non si tocca |
| 25/08 scende la versione più vecchia ancora buona, senza chiedere | il FEFO non si tocca; il lotto guadagna `articolo_id` così si sa quale è scesa |
| 25/08 l'assistente PROPONE l'ingrediente generico se non esiste | `trova_o_crea_ingrediente` va spaccata in due (prodotto **e** ingrediente) |
| 25/08 l'assistente decide se accorpare o dare posizione propria | resta una sua decisione: due prodotti sullo stesso ingrediente, o due ingredienti |
| 25/08 food cost sull'ULTIMA versione + MEDIA e TREND in tutte le sezioni | il riflesso fa la prima; `andamento_prezzo` la seconda |
| 25/08 il prezzo di vendita NON si muove da solo | non si tocca nessun prezzo di menu |
| 25/08 il campo % scarto standard RESTA | non toccato |
| 23/08 la percentuale di scarto non sostituisce la resa vera | non toccato |
| 25/08 shelf life diversa dalla scadenza | vedi sotto — **ambiguo, portato fra le domande** |
| 25/08 shelf life di una PREPARAZIONE è un'altra cosa | **non costruita**: manca la decisione su quali variabili la calcolano |
| 25/08 spesa multi-foto | fuori da questo blocco; il prodotto senza fornitore ci sta già |

### Le due voci che ho trovato ambigue

1. **La shelf life.** La decisione del 25/08 dice che è «quanto dura una
   volta APERTO», e oggi la colonna si chiama `shelf_life_days` **senza
   commento**, su `ingredients` — cioè sull'ingrediente e non sul prodotto,
   mentre «una volta aperto» è una proprietà della **confezione**. Spostarla
   sul prodotto è la strada coerente, ma **cambia dove vive un dato che lo
   scadenziario già legge**, e non è scritto se Alessio la vuole per
   prodotto o per ingrediente. Portata fra le domande; **non spostata**.
2. **La shelf life di una preparazione.** «Si calcola da variabili
   interne — abbattimento, sottovuoto, bassa temperatura»: quelle variabili
   non esistono nel gestionale e la formula non è scritta. Non inventata.
