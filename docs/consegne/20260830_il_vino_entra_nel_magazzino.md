# Il vino entra nel magazzino — 30/08/2026 (blocco 1)

**Commit che sta sotto questo riepilogo:** `237c4ec`
**Migrazioni introdotte:** `20260830000002` (il vino in magazzino),
`20260830000006` (i due legami parlano italiano), `20260830000007` (le tre
colonne nuove dichiarano che fanno quando cambia l'unità — condivisa col
blocco 2).
**Applicate in produzione:** nessuna. Aspettano il push di Alessio.
**Applicate sul progetto di prova:** tutte, e verificate rompendole.

---

## 1. La misura che viene prima (punto 1a del mandato)

Il mandato chiedeva di misurare cosa legasse `bar_items` al resto **prima**
di costruire. Misurato sulla produzione il 30/08:

| domanda | risposta |
|---|---|
| chiavi esterne che puntano a `bar_items` | **zero** |
| chiavi esterne che partono da `bar_items` | **zero** |
| funzioni del database che la nominano (cercate nei **corpi vivi**, non nei nomi) | **zero** |
| righe in produzione | **zero** |

Cioè: **un'isola**. Sapeva cosa vendi e a quanto, e non toccava niente.

🔴 **Ma il buco vero non era lo scarico: era l'IDENTITÀ.** `handleAddBarItem`
in `Sala.jsx` scriveva la voce della carta come **testo libero**
(`order_items.free_text_name`, «Grillo · calice»). Quindi un Grillo venduto
dalla carta e un «Grillo» digitato a mano nel modulo delle voci libere erano
**la stessa identica riga**: nessuno poteva dire quante bottiglie di Grillo
erano uscite. *Senza identità il margine non è calcolabile nemmeno a
posteriori, il giorno che qualcuno lo volesse.*

Per questo la colonna che conta di più di questo blocco è
`order_items.bar_item_id`.

---

## 2. Che cosa c'è adesso

* **`bar_items.ingredient_id`** — quale prodotto del magazzino consuma questa
  voce. Vuoto = «non collegata»: non scarica, non ha margine, **e la
  schermata lo dice** invece di mostrare un margine vuoto.
* **`bar_items.porzioni_per_unita`** — quante porzioni si ricavano da una
  unità del prodotto. Sei calici da una bottiglia → 6, e vendere un calice
  scarica un sesto. Vuoto = si vende intera.
  ⚠️ Si chiama «per unità» e non «per bottiglia» apposta: la stessa regola
  copre il caffè (140 tazzine da un chilo) senza inventare un secondo
  meccanismo.
* **`order_items.bar_item_id`** — che cosa è stato venduto.
  ⚠️ `free_text_name` **resta e continua a essere scritto**: è l'etichetta
  *fotografata*, come il prezzo del coperto. Se domani la carta rinomina un
  vino, un conto di ieri continua a mostrare quello che il cliente aveva
  letto.
* **`fabbisogno_conto`** ha una terza sorgente accanto a materia prima e
  semilavorati. Le due esistenti non sono state toccate di una virgola; il
  corpo è stato preso dal database vivo.
* **`margine_carta()`** — quanto paghi una confezione e quanto la incassi.

### Il margine, e perché ci sono due numeri

La domanda vera non è «quanto guadagno su un calice»: è **quanto rende una
bottiglia**. Su un calice si legge «4 €» e sembra poco; sei calici da 6 €
fanno 36 su una bottiglia pagata 12, cioè **24 €**.

⚠️ **Uno zero non è una risposta**, ed è il cuore della funzione.
`ingredients.current_price` è obbligatorio e parte da zero: un prodotto mai
comprato **direbbe margine pieno** — un vino pagato niente e venduto 8 €. Qui
zero si legge «non lo so», il margine resta **vuoto** e una colonna dice
quale delle due cose manca.

**Le risposte sono TRE, non due**, e non si dicono uguale:

| stato | cosa dice la schermata | come si cura |
|---|---|---|
| collegata e prezzata | «paghi … · incassi … · rende …» | — |
| collegata, prodotto mai comprato | «di questo prodotto non si sa ancora quanto è costato» | comprando |
| non collegata | «non collegata: non scarica la cantina e non ha margine» | collegando |

*Un motivo solo manderebbe a cercare nel posto sbagliato.*

---

## 3. Cosa NON è stato costruito, e perché

* **L'annata non ha una colonna nuova** (punto 1c). L'ingrediente è «Nero
  d'Avola del produttore X»; ogni annata è un **articolo** comprato sotto di
  lui — `articoli_fornitore`, costruita il 27/08, ha già descrizione, marca,
  formato, fornitore, fattore e il suo storico prezzi. Aggiungere `annata`
  sarebbe la seconda struttura che il mandato vieta, e sarebbe anche
  «preparare il terreno» per un lavoro non chiesto, che `DECISIONI.md` vieta
  espressamente.
* **Nessun altro caso di resa** (punto 1d). Tutto il resto lo vende a
  bottiglia intera e non terrà birra alla spina: niente fusti. La colonna
  nasce **vuota** su tutte le voci.
* **Nessun gesto per la bottiglia aperta** (punto 1f): decisione sua, la
  sistema il conteggio dell'Allineamento.
* **Nessun inventario trimestrale**: stessa ragione.

---

## 4. La decisione del 23/08 non è toccata

«Il vino non compare nell'elenco degli scarichi mancati» resta intera: il
ramo delle voci libere di `scarica_magazzino_conto` continua a escludere
`destination = 'bar'`, ed erano **1.840 righe tutte uguali** che
seppellivano le venti che contano.

Quello che cambia è che una voce **collegata** entra nel giro normale: se la
giacenza non basta lo dice come per il baccalà. E una voce **non collegata**
non produce nessuna riga di anomalia — si dichiara **nella carta**, una volta
sola, invece che a ogni conto. *Un avviso ripetuto a ogni serata è un avviso
che si spegne.*

---

## 5. Come è stato verificato

### Dentro la migrazione, con un esempio costruito

⚠️ **L'esempio si costruisce, non si prende in prestito** (27/08): un
ingrediente mio, un lotto mio, due voci di carta mie, un conto mio.
Prendere in prestito una bottiglia vera di Alessio la farebbe scendere
davvero — già pagato una volta il 16/08.

⚠️ **E i numeri sono scelti perché le risposte sbagliate siano diverse fra
loro** (19/08): 10 bottiglie, se ne vende **1 intera e 6 calici** da una
seconda → restano **8**. Resa ignorata darebbe 3; bevande che non scaricano
darebbero 10. Tre risposte, tre numeri.

Misurato dalla verifica: fabbisogno **2,000000** bottiglie, ne restano **8**,
costo scaricato **24,00 €** (due bottiglie a 12), la bottiglia a mescita
incassa **36** e rende **24**, e il portiere **rifiuta** chi non è il titolare
con la frase giusta.

### Rotta in due modi, su due controlli diversi

| rottura | dove è fallita |
|---|---|
| tolto il ramo delle bevande da `fabbisogno_conto` | *«Il fabbisogno delle bevande è (vuoto) invece di 2»* (riga 78) |
| zero torna a essere un prezzo in `margine_carta` | *«Un prodotto senza prezzo dice prezzo_mancante con margine 30,0000»* (riga 135) |

⚠️ La seconda rottura mostra il danno per intero: un vino di cui non si sa il
costo avrebbe dichiarato **30 € di margine**.

### Con le mani, a 375 punti, entrando dal collegamento dell'app

Aperta la carta sul progetto di prova, collegata una voce a un prodotto vero
e messa la resa a 6. Letto a schermo:

> paghi 2,60 € · incassi 15,00 € · rende 12,40 € (6 porzioni) · ne restano 8,23 da vendere

E la voce non collegata, sulla stessa pagina:

> non collegata: non scarica la cantina e non ha margine

Tutto rimesso com'era dopo: **zero** voci collegate, **zero** con una resa.

---

## 6. I due difetti trovati guardando, non rileggendo

🔴 **«ne restano 1.3721»** — col punto inglese e quattro decimali, in mezzo a
una frase italiana. È la famiglia del «26.6%» del 24/08. Adesso passa da
`formatQta` e dice **«ne restano 8,23 da vendere»** — e «da vendere» invece di
«porzioni», perché su una voce venduta intera una porzione *è* una bottiglia
e chiamarla porzione sarebbe vero e illeggibile.

🔴 **La mia riga allargava la tabella di 158 punti.** Misurato togliendola e
rimettendola, non dedotto: a 375 punti la tabella passava da **351 a 509** in
un riquadro da **343**. Il colpevole era il menu dei prodotti dentro la cella
del nome. Spostata su una **riga sua a tutta larghezza**, cresce in altezza e
non tocca nessuna colonna: rimisurato, **differenza zero**.

---

## 7. Trovati dalle reti

* 🔴 **I due legami nuovi rispondevano in inglese.**
  `tests/app/vincoli-che-parlano.test.js`, scritta il 28/08, è diventata rossa
  da sola nominando i due colpevoli. ⚠️ E la regola era **più larga di come me
  la ricordavo**: il 25/08 riguardava i vincoli `check`, il 28/08 è stata
  allargata a unicità e chiavi esterne. Chiuso da `20260830000006`.
* 🔴 **Tre colonne numeriche non dicevano cosa fanno quando cambia l'unità.**
  `cambio-unita.test.js` le ha nominate. ⚠️ **Due delle tre non le ho create
  io in quella famiglia**: `bar_items.selling_price` esisteva dal primo giorno
  ed era invisibile al censimento, perché quel censimento guarda **le tabelle
  che hanno un `ingredient_id`** — e `bar_items` non ce l'aveva. Attaccando la
  carta al magazzino, **una tabella intera è entrata nel perimetro**. *Una
  rete può diventare più severa senza che nessuno la tocchi, semplicemente
  perché il mondo che sorveglia si è allargato.* Chiuso da `20260830000007`.

---

## 8. Cosa abbiamo rovesciato

**Uno, ed è mio, di poche ore prima.** Registrato come **n. 72** in
[`decisioni_rovesciate.md`](../decisioni_rovesciate.md).

1. **Cosa era stato deciso e quando.** La notte del 30/08, dentro
   `20260830000002`: `porzioni_per_unita > 1`, perché «una porzione per
   confezione **è** la bottiglia intera, cioè due modi di dire la stessa
   cosa».
2. **La ragione di allora.** Due modi di dire la stessa cosa, in questo
   progetto, sono un difetto.
3. **Cosa si decide adesso.** Il limite scende a `> 0` (`20260830000007`).
4. **Perché la ragione di allora non vale più.** 🔴 **Perché era vera solo per
   i prodotti misurati a pezzi.** L'ha dimostrato la verifica provando a
   cambiare l'unità per davvero: portando un caffè da chili a grammi, «8
   tazzine da un chilo» diventa **0,008 da un grammo** — legittimo — e il
   vincolo lo **respingeva**. È la regola del 24/08 letta al contrario: *un
   limite che rifiuta anche i casi buoni è peggio di nessun limite.* La cosa
   che il vincolo voleva impedire resta dove appartiene: nella schermata, che
   propone il campo vuoto e lo dice.

⚠️ **Conseguenza scritta dentro `20260830000007`**: la verifica della
`20260830000002` prova che il vincolo *rifiuti* il valore 1, quindi
**rilanciare quella migrazione da sola oggi fallirebbe**. Su una ricostruzione
da zero non succede — le migrazioni si applicano in ordine di numero e lì la
002 gira quando il vincolo stretto c'è ancora.

---

## 9. Cosa NON è verificato

* **Nessuna bottiglia vera è mai stata venduta**: in produzione ci sono
  **zero** voci in carta e zero conti nuovi. Tutto quello che è provato sta
  nelle verifiche delle migrazioni, nelle 458 prove sull'app e in un giro a
  mano sul progetto di prova.
* **La frase «di questo prodotto non si sa ancora quanto è costato» non è
  stata vista a schermo.** È verificata **al livello del database** — la
  funzione risponde `prezzo_mancante` con costo e margine vuoti — e dentro la
  migrazione, ma il modo in cui si legge sulla pagina non l'ha guardato
  nessuno.
* **Nessuna immagine è stata guardata**: in questo ambiente lo screenshot non
  funziona. Tutto ciò che è «visto» è **letto dal DOM**.
* **Il gesto in sala non è stato fatto da una mano**: che aggiungere un vino
  alla comanda scriva `bar_item_id` è provato dal codice e dalle prove, non
  da un tocco su un tablet.
* **La tabella della carta scorre di lato dentro il suo riquadro** di 8 punti
  a 375 (misurato): è una condizione **preesistente**, non introdotta qui — la
  mia aggiunta la lascia identica.

---

```bash
git -C "C:\Users\User\Desktop\Claude code\Borgo58-App" push
```
