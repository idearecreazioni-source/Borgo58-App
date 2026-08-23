# L'unità piccola per i prodotti di valore

**23/08/2026 — referto, non lavoro.** Il mandato diceva 🔴 **MISURA E
RIPORTA, NON COSTRUIRE**: non è stata scritta nessuna migrazione, nessuna
riga di codice dell'app, e **il repository non è stato toccato**.

Le prove sono state fatte sul **progetto di prova** aggiungendo `g` e `mg`
al vocabolario delle unità, provando il giro, e poi **rimettendo il database
com'era** (ripristino della copia + riapplicazione delle 182 migrazioni:
103 tabelle, 25.640 righe, zero differenze). ⚠️ Il ripristino è servito
perché **un valore aggiunto a un enum di Postgres non si può togliere** — ed
è già una delle risposte.

---

# 0 · La cosa che vale comunque: il costo delle spezie escluse

> *Se escludendole dal magazzino è sparito anche il loro costo dal piatto,
> quello è un difetto da correggere subito.*

**Non è sparito.** Misurato: `v_recipe_costs` — il costo di una ricetta —
passa da `ingredients.current_price` e **non guarda `tenuto_in_magazzino`**.

| | |
|---|---|
| costo teorico di tutti i piatti del ricettario | **122,5838 €** |
| di cui prodotti fuori magazzino | **0,0487 €**, e **ci sono ancora** |

Esempio: il *Cous cous di pesce in tazza* costa 0,7288 € a porzione, di cui
0,0165 € di zafferano — dentro, come prima.

## ⚠️ Ma i food cost sono DUE, e uno li perde davvero

| numero | da dove viene | le spezie escluse |
|---|---|---|
| **costo del piatto** (su cui si decidono i prezzi del menu) | dalle **ricette** | ✅ ci sono |
| **food cost misurato** (`food_cost_reale`, quanto è uscito dalla cella) | dagli **scarichi** | ❌ non ci sono più |

**Quanto vale la differenza**, misurato sui due mesi già registrati:

| prodotto | costo che sarebbe servito | costo registrato |
|---|---|---|
| Alloro | 2,9221 € | 2,8946 € |
| Cannella in stecche | 0,4718 € | 0,3984 € |
| Pepe nero in grani | 0,1051 € | 0,0252 € |
| **totale** | **~3,50 €** | su **10.717 €** di costo registrato |

→ **lo 0,03%**. Da oggi in poi quei tre non entreranno più nel food cost
misurato. Il numero è trascurabile, **ma non è zero**, e la direzione è
sempre la stessa: il food cost misurato risulta più basso del vero.

🔵 **Non è un difetto da correggere subito** — nessun numero mostrato è
falso, e quello su cui si decidono i prezzi è intatto. È una **scelta da
dichiarare**: il food cost misurato esclude i prodotti che il magazzino non
segue, e lo esclude per costruzione.

---

# 1 · L'unità è un vocabolario chiuso

**Sì.** Enum `unit_type`, quattro valori: **kg, l, pz, mazzo**.

| | |
|---|---|
| colonne che lo usano | **12** (`ingredients.unit`, `recipe_ingredients.unit`, `recipes.yield_unit`, `shopping_list_items.unit`, `crops.unit`, `intercompany_cessions.unit` e le viste) |
| funzioni che lo nominano | **10** |

## Cosa comporta aggiungerne uno

| | |
|---|---|
| nel database | **una riga**: `alter type unit_type add value 'mg'` — ⚠️ su una riga sua, non dentro un `do $$` che poi lo usa (regola del 19/08) |
| nell'app | `UNITS` in `src/lib/constants.js` |
| 🔴 **e non si torna indietro** | **Postgres non permette di togliere un valore da un enum.** Per disfare bisogna ricreare il tipo e riscrivere 12 colonne |

## ✅ Ed è già sorvegliato — provato

Aggiunti `g` e `mg` al solo database, senza toccare `constants.js`, la prova
`tests/app/vocabolari.test.js` è diventata **rossa da sola**, dicendo:

> *«UNITS (ingredients.unit): il database ammette g, mg e la schermata non li
> offre — un valore legittimo che nessuno può scegliere, e in silenzio»*

La rete dei vocabolari del 17/08 copre esattamente questo caso.

---

# 2 · Il giro in milligrammi regge — con tre difetti a schermo

Costruito uno zafferano vero: **prezzo 0,0024 €/mg** (= 2.400 €/kg), lotto
di 1.000 mg, ricetta da 15 porzioni con 100 mg dentro, un conto chiuso.

| passo | esito |
|---|---|
| fabbisogno di una porzione | **6,6667 mg** — sopravvive ai quattro decimali |
| scarico | **6,6667 mg**, costo **0,0160 €** |
| costo teorico a porzione | **0,0160 €** — ✅ **coincide** |
| giacenza | 993,3333 mg |
| lista della spesa (soglia 2.000 mg) | ✅ chiede **1.006,6667 mg** |
| lista della spesa (soglia 500 mg) | ✅ non chiede niente, giustamente |
| allineamento a 900 mg | ✅ *«ne risultavano 993,333 mg, ne hai 900. Mancano 93,333»* |
| aggiornamento prezzo a 0,0026 €/mg | ✅ e lo storico si scrive |

**Il calcolo non si rompe da nessuna parte.** I difetti sono altrove.

## 🔴 a. In milligrammi TUTTI i prezzi si vedono «0,00 €»

`formatEUR` mostra due decimali. Sotto 0,005 €/unità un prezzo diventa zero.

| prodotto | €/kg | €/mg | a schermo |
|---|---|---|---|
| Zafferano in pistilli | 2.400,00 | 0,0024 | **0,00 €** |
| Origano siciliano | 26,00 | 0,000026 | **0,00 €** |
| Cannella in stecche | 24,50 | 0,0000245 | **0,00 €** |
| Sale | 0,65 | 0,00000065 | **0,00 €** |

**Nove spezie su nove.** Visto a schermo sulla scheda del prodotto:
*«0,00 €/mg»* sul prodotto più caro del magazzino.

⚠️ E lo stesso vale nell'anteprima del carico da fattura, che usa
`toFixed(2)`: *«Entrano 1000 mg a 0,00 € l'uno»*.

## 🔴 b. La scheda mostra un'unità falsa

Il menu dell'unità legge `UNITS` da `constants.js`. Con `mg` nel database e
non lì, il menu offre `kg, l, pz, mazzo` e **il campo mostra «kg»** su un
prodotto che è in mg.

✅ **Salvando senza toccarlo, il dato regge** (provato: l'unità è rimasta
`mg`) — perché la schermata rimanda il valore che ha in memoria. Ma chi
apre quella scheda **legge un'unità sbagliata**, e basta sfiorare quel menu
per cambiarla davvero. Si chiude aggiungendo `mg` a `UNITS`.

## 🔴 c. Cambiare unità non è controllato da NIENTE — e questo esiste già oggi

Provato: `update ingredients set unit = 'kg'` su un prodotto con lotti,
ricette e scarichi → **accettato senza un controllo**.

| | |
|---|---|
| i **lotti** | non hanno un'unità propria: **993,3333 mg diventano 993,3333 kg**, in silenzio |
| le **righe di ricetta** | hanno la loro: restano in **mg** → ricetta e ingrediente in unità diverse |
| il **costo teorico** | non cambia (0,0173 €): il calcolo usa i numeri, non le unità |

⚠️ **Questo difetto non lo introduce l'unità piccola**: c'è già, e vale
anche per un kg che diventa un litro. Ma l'unità piccola lo rende **un
milione di volte più dannoso**, perché quello è il fattore fra mg e kg.

---

# 3 · La conversione c'è già, e non la fa una persona a mano

`articoli_fornitore.fattore` esiste dal 12/08 ed è nato per questo: *«cassa
da 6 kg → 6»*. Comprare **1 grammo** di zafferano e tenerlo in **milligrammi**
è un fattore **1000**.

- il carico moltiplica: `quantità × fattore` = quanto entra;
- il prezzo divide: `costo_unitario / fattore` = prezzo per unità;
- e la dicitura si ricorda: **la seconda fattura dello stesso fornitore
  arriva già col fattore giusto**.

⚠️ Il fattore lo scrive **Alessio la prima volta**, in un campo della
schermata di conferma. Non è indovinato — ed è giusto così: sbagliarlo
falsa il prezzo di mille volte, e nessun automatismo può leggere «bustina»
e sapere quanti milligrammi pesa.

---

# 4 · I due numeri accanto: unità piccola contro precisione su tutta la catena

| | **A · unità piccola** | **B · più decimali ovunque** |
|---|---|---|
| database | **1 riga** (`add value`) + 1 in `constants.js` | **13 tabelle**, **9 viste**, **6 vincoli** |
| funzioni da riguardare | 0 | **45** che nominano quantità |
| prove da riguardare | 0 (una diventa rossa da sola e si aggiorna in una riga) | **22 file** |
| viste | intatte | ⚠️ da **droppare e ricreare in cascata**: `create or replace view` non cambia il tipo di una colonna (42P16), e due dipendono l'una dall'altra (`v_menu_item_economics` → `v_recipe_costs` → `v_recipe_row_costs`) |
| dati esistenti | intatti | ⚠️ ogni `alter column type` riscrive la tabella |
| reversibile? | ❌ un valore di enum non si toglie | ❌ tornare indietro troncherebbe i numeri |
| chi tocca | **solo i prodotti che si sceglie** | **tutto il magazzino, tutte le ricette, tutti i costi** |

**A è dieci volte più piccolo di B**, e soprattutto è *locale*: sbagliando,
sbaglia su un prodotto. B tocca ogni calcolo di magazzino del gestionale.

---

# 5 · 🔵 La terza strada, che non avevamo visto: la CONFEZIONE

Il mandato chiedeva se ce ne fosse una. **Sì, e non tocca niente.**

Il criterio del mandato è *il rapporto fra come si compra e come si usa*. Ma
lo zafferano **non si compra a grammi: si compra in bustine**. E `pz` è già
nel vocabolario.

**Provata sul progetto di prova**, stesso zafferano, bustine da 0,1 g a
0,24 € l'una:

| | strada A (mg) | strada C (bustine) |
|---|---|---|
| fabbisogno di una porzione | 6,6667 mg | **0,0667 pz** |
| costo scaricato | 0,0160 € | **0,0160 €** — identico |
| costo teorico a porzione | 0,0160 € | **0,0160 €** — coincide |
| giacenza | 993,3333 mg | **9,9333 pz** |
| **prezzo a schermo** | 🔴 **0,00 €** | ✅ **0,24 €** |
| vocabolario da toccare | `add value` + `constants.js` | **niente** |
| migrazione | serve | **non serve** |

## Cosa costa, e dove smette di funzionare

- ⚠️ **`pz` non dice quale confezione**: lo dice `articoli_fornitore.unita_fattura`
  («bustina da 0,1 g»), che si scrive una volta per fornitore;
- ⚠️ **la lista della spesa dice «compra 15 pz»** — che per una bustina è
  giusto, e forse più utile di «compra 1.006 mg»;
- 🔴 **regge finché la confezione è piccola.** Calcolato: perché un pizzico
  da 6,67 mg resti scrivibile a quattro decimali, la confezione deve essere
  **≤ 66 grammi**. Bustine da 0,1 g o barattoli da 10 g: margine larghissimo.
  Un sacco da 1 kg: torna il problema di prima.

---

# 6 · E se si sceglie A, quale unità: grammi o milligrammi

Misurato sul ricettario vero, il fabbisogno di **una porzione** dei prodotti
da pizzico, in tre unità (la colonna scrive quattro decimali):

| prodotto (piatto) | in kg | in **g** | in **mg** |
|---|---|---|---|
| Zafferano (*Cous cous di pesce*) | **0,0000** ❌ | 0,0067 ✅ | 6,6667 ✅ |
| Cannella (*Selezione dolce*) | **0,0000** ❌ | 0,0360 ✅ | 36,0000 ✅ |
| Alloro, Pepe (*Arancinetta*) | **0,0000** ❌ | 0,0400 ✅ | 40,0000 ✅ |

- **I grammi bastano** per tutti i casi veri, e ⚠️ **tengono il prezzo
  leggibile**: zafferano 2,40 €/g, cannella 0,0245 €/g (si vedrebbe 0,02).
- **I milligrammi** danno mille volte più margine sulla quantità e **perdono
  il prezzo**: tutti a 0,00 €.

→ Se si prende la strada A, **i grammi costano meno dei milligrammi**: stesso
lavoro, un difetto in meno.

---

# 7 · Se si scopre che l'unità piccola rompe qualcosa

Il mandato dice: *«se rompe qualcosa, dillo e basta»*.

**Non rompe il calcolo**: il giro è stato provato per intero e i numeri
tornano, in mg e in bustine. Quello che rompe è **come i numeri si vedono**,
e in un caso (il menu dell'unità) **quello che una schermata dichiara**.

Tutti e tre i difetti a schermo si chiudono, ma **non sono gratis**:

| difetto | cosa costa chiuderlo |
|---|---|
| il prezzo a 0,00 € | i decimali del prezzo devono dipendere dall'unità — tocca `formatEUR` o i punti che mostrano un prezzo unitario |
| il menu che mostra kg | una riga in `constants.js` |
| l'unità che si cambia senza controlli | un guardiano nuovo, e ⚠️ **va messo comunque**: il difetto esiste già oggi |

---

# ⚠️ Cosa questo referto NON dice

1. **Non è stato costruito niente**, e il repository non è stato toccato: le
   prove sono avvenute sul progetto di prova, che è stato **rimesso com'era**
   (182 migrazioni, enum tornato a quattro valori, suite verde).
2. ⚠️ **Nessuna delle tre strade è stata provata dal carico da fattura
   vero**: il `fattore` è stato letto nel codice e nelle sue prove, non
   esercitato con una fattura in mg o in bustine.
3. ⚠️ **Non è stato misurato cosa succede alle SCHERMATE di magazzino con
   numeri in mg**: `formatQta` mostra due decimali, quindi 993,3333 mg si
   vedrebbe «993,33» — che va bene, ma non è stato guardato con l'occhio in
   Magazzino, solo sulla scheda del prodotto.
4. ⚠️ **La vaniglia non esiste in nessun database**: la decisione la nomina,
   ma né in produzione né sulla prova c'è un prodotto «vaniglia». I numeri
   qui sopra sono sullo zafferano, che è il caso più estremo (2.400 €/kg).
