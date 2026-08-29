# I materiali di consumo hanno le loro parole

**Blocco 5 del mandato del 29/08.** Commit `d5e84a6`.
**Migrazioni `20260829000024` e `20260829000025`**, applicate al progetto di
prova.

---

## Cosa abbiamo rovesciato

**Niente in vigore.** Ma una cosa **decisa il 27/08 si estende**, e va detta:
quel giorno le *categorie* degli ingredienti hanno smesso di essere un elenco
scritto nel codice per diventare dati. Stanotte **le unità di misura hanno
fatto la stessa strada**, per la stessa ragione e trovate dalla stessa rete.

---

## I cinque campi, tolti dai materiali e intatti sugli alimenti

Misurato aprendo la scheda vera dello **Sgrassatore per cucina**:

| campo | sui materiali | su un alimento |
|---|---|---|
| «Fotografa l'etichetta» | **via** | c'è |
| «Provenienza» / «Produzione interna (orto)» | **via** | c'è |
| «Conservazione» (e l'etichetta gialla) | **via** | c'è |
| **«È un alimento»** | **via** | c'è |
| Scorta minima | **resta** | resta |
| «Avvisami se il prezzo sale» | **resta** | resta |
| Fornitore | **resta** | resta |

La quarta è la più importante: era la casella con cui la carta forno tornava
in mezzo al baccalà e disfaceva il lavoro fatto. Dentro i materiali di consumo
la risposta è implicita.

⚠️ **Una cosa in più della richiesta, dichiarata perché lui possa toglierla.**
Al posto della casella sparita c'è **«Non è un materiale: rimettilo fra gli
ingredienti»**. Togliendo la casella e basta, un prodotto finito lì per sbaglio
non avrebbe più nessuna strada per tornare — e un vicolo cieco, in questo
progetto, è un difetto a sé. Non è la casella di prima: è un gesto **nominato**,
che non si preme per distrazione mentre si guarda il prezzo. Se non serve, si
toglie in tre righe.

---

## Le parole nuove, proposte da me come chiesto

**Sei categorie** (cinque le ha nominate lui):

| | |
|---|---|
| Pulizia e sanificazione | Carta e monouso |
| Imballaggi e asporto | Attrezzatura minuta |
| Manutenzione e ricambi | **Ufficio e cassa** |

⚠️ L'ultima l'aggiungo io: rotoli dello scontrino, toner, cancelleria. Senza,
finirebbero in «Altro» — cioè il posto da cui questo lavoro nasce.

**Quattro unità**: rotolo, confezione, paio, metro.

Sono **dati**: si correggono dalla schermata, non con una migrazione. E le
categorie si aggiungono **mentre si compila**, nel mondo giusto.

---

## Un concetto solo per i due cataloghi

`ambito`, con **tre** valori — `alimenti`, `materiali`, **`entrambi`**.

Il terzo non è una comodità: il **litro** e il **pezzo** servono ai due mondi
allo stesso modo, e sdoppiarli darebbe due righe che dicono la stessa cosa e
possono divergere. Con due soli valori bisognerebbe scegliere quale mondo se li
tiene, e sbagliare. Lo stesso vale per **«Altro»**, che è una riga sola e
compare in tutti e due.

Dopo, misurato: **15 categorie e 5 unità** per gli alimenti, **7 e 6** per i
materiali.

---

## 🔴 Due cose che la misura ha corretto, e nessuna era prevista

### 1 · `ingredients.unit` non è testo libero: è un vocabolario chiuso

Me l'ha detto il database fermando la prima versione della migrazione. Il mio
controllo cercava un vincolo `check` e non lo vedeva, perché è un **enum** —
un vocabolario chiuso che si scrive in un altro posto. Senza aggiungere
«rotolo» al tipo, il catalogo lo avrebbe offerto e **il salvataggio lo avrebbe
rifiutato**.

⚠️ **Il prezzo dell'enum è dichiarato, non aggirato**: finché resta, un'unità
**nuova** non si aggiunge al volo come una categoria. Perciò **non c'è un
pulsante «aggiungi unità»**: un gesto che riesce a metà è peggio di un gesto
che non c'è.

⚠️ **Toglierlo è un lavoro a sé, e la misura dice perché**: `unit_type` è usato
da **sette colonne e cinque viste**, contro l'**unica** colonna di
`ingredient_category` — e quella conversione, il 27/08, costò **684 righe più
altre 780** per rimediare ai tre punti che aveva rotto in silenzio. Farla
stanotte, di corsa, sarebbe stata la cosa sbagliata. **È una richiesta aperta**
in [`RICHIESTE.md`](../RICHIESTE.md).

⚠️ E un valore aggiunto a un enum **non è usabile nella stessa transazione**:
la migrazione ha potuto controllare che «rotolo» *esista*, e che si possa
davvero **salvare** lo prova `tests/app/unita-materiali.test.js`, che gira
dopo, con un prodotto vero. Rotta mettendo nel catalogo un'unità che il
database non conosce: diventa rossa col nome esatto.

### 2 · La rete dei vocabolari è diventata rossa da sola, e aveva ragione

> *«UNITS (ingredients.unit): il database ammette conf, m, paio, rotolo e la
> schermata non li offre — un valore legittimo che nessuno può scegliere, e in
> silenzio»*

L'elenco `UNITS` in `constants.js` era diventato una **seconda verità** nel
momento stesso in cui le unità sono diventate dati. **Non l'ho trovato
rileggendo.** Ora `UNITS` non esiste più: sei schermate leggono le unità dal
database da un posto solo (`useUnita`), come le categorie dal 27/08. E il
guardiano che impedisce di rimettere un elenco statico riconosce anche loro.

---

## ⚠️ Una cosa da sapere prima di applicarla in produzione

La `…024` **si applica per istruzioni, non tutta in una volta**, e non è una
scelta: lo strumento lo riconosce **dal file**, perché contiene dei valori
aggiunti a un vocabolario chiuso — che dentro una transazione sola non
sarebbero usabili (regola del 28/08, rovesciamento n. 65).

⚠️ **La conseguenza va detta a voce alta**: se quella migrazione si fermasse
a metà, quello che ha già fatto **resta**. Sul progetto di prova è entrata
intera al primo colpo; se in produzione si fermasse, prima di rilanciarla si
guarda **nel catalogo** cosa c'è già, invece di dedurlo dal fatto che si è
fermata.

Le altre tre entrano tutte in una volta: o tutte, o niente.

---

## E la rete dei vincoli parlanti ha preso l'altra cosa

Il vincolo sull'ambito delle **unità** era muto: chi scrivesse un ambito
inventato leggerebbe «c'è una regola che lo impedisce (nome tecnico)» invece
del motivo. ⚠️ Corretto in una migrazione **nuova** (`…025`) e **non
riscrivendo la `…024`**, che era già applicata — regola di Alessio del 23/08.

---

## Rilettura

**Cosa NON ho verificato con gli occhi**
- La scheda di un materiale **su un telefono vero**: misurata nel browser a
  375 punti.
- Le **sei schermate** che ora leggono le unità dal database: ne ho aperta
  **una**, la scheda prodotto, nei suoi due casi (alimento e materiale). Le
  altre **cinque** — lista della spesa, scheda ricetta, ricetta nuova,
  agricolo, cessioni — sono coperte dalle prove e dalla compilazione, **non da
  un occhio**.
- Il **rifiuto in italiano** del vincolo nuovo: provato dentro la migrazione,
  non visto a schermo.

**Cosa ho contato senza leggerlo**
- Le sette colonne e cinque viste di `unit_type` vengono da una query sul
  catalogo.
- Il costo della conversione delle categorie (684 + 780 righe) è il conteggio
  delle righe dei due file, non la loro lettura.

**Quali mie affermazioni sono diventate false mentre lavoravo**
- 🔴 Avevo scritto che `ingredients.unit` è **testo libero senza vincolo**: è
  un enum. La mia verifica cercava la forma sbagliata.
- Avevo previsto di rendere le unità **aggiungibili al volo**: non si può,
  finché l'enum resta. Dichiarato invece che costruito a metà.
- Sul lato alimenti **«pz» adesso si legge «pezzo»**: viene dal catalogo, ed è
  un cambiamento visibile che non avevo previsto. Più chiaro, ma è una parola
  in più rispetto a prima — se non piace è una riga.

**Cosa ho lasciato sul progetto di prova**
- Niente di mio: zero prodotti, zero categorie e zero unità che comincino
  per `VERIFICA`. Restano **cinque** prodotti `TEST-AUTO` del **23/08**,
  preesistenti: li ho contati e non toccati.
- ⚠️ **Le lapidi NON sono invariate**, e va detto per intero: sono passate da
  **8847 a 9035**. Non è questo blocco — è il giro completo delle prove
  sull'app, che ne lascia un centinaio a ogni esecuzione ed è un debito
  **già noto e già scritto** (26/08). Le verifiche delle migrazioni di
  stanotte ripuliscono le proprie: contate prima e dopo, invariate.

---

## Domande

Vedi il messaggio finale, domande **2** e **3**.
