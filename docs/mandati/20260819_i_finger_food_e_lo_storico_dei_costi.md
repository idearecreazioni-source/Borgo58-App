# Mandato — I finger food e lo storico dei costi

**Deciso da Alessio il 19/08/2026**, in un giro di domande. Scritto prima di
toccare codice, com'è la regola per i mandati.

---

## ⚠️ Perché adesso, e non dopo — è la ragione che decide la priorità

**Il Ricettario è VUOTO.** Misurato in produzione il 19/08:

| | |
|---|---|
| ricette | **0** |
| righe di ricetta | **0** |
| piatti in menu | **0** |
| menu · menu del giorno | **0** · **0** |

Questo lavoro **cambia la forma del Ricettario**, e le ricette le inserirà
Alessio **a mano, decine**. Farlo dopo significa fargliele rifare: *il costo
del ritardo lo paga lui in serate, non il gestionale in migrazioni.*

---

## Cosa vuole Alessio — nelle sue parole

Proporrà **due selezioni di finger food** (per esempio «finger food di
terra»), ognuna composta da un certo numero di bocconcini. **Ogni bocconcino
è una ricetta a sé** — un crostino con le alici, un bignè salato, una
crocchetta — non un ingrediente.

- al piatto in menu si associano i finger che lo compongono, così **il food
  cost del piatto nasce da cosa ci mette dentro**, e il magazzino si scarica
  di conseguenza;
- la composizione **si modifica all'occorrenza**, togliendo o aggiungendo;
- 🔴 **sempre un pezzo per tipo, mai ripetizioni**: due porzioni ordinate =
  **due pezzi per tipo**. Da qui nasce lo scarico di magazzino, ed è il punto
  dove un errore diventa una giacenza sbagliata tutte le sere;
- il prezzo di vendita si riferisce alla composizione, **ma serve anche un
  prezzo sul singolo finger, a pezzo**, per i clienti che se li scelgono per
  un evento;
- **in cucina la comanda è una riga sola.**

---

## 🔴 LA MISURA, fatta prima di progettare

Il mandato chiedeva di misurare cosa la strada esistente copre davvero —
`recipe_ingredients.component_recipe_id` c'è già — e di **costruire solo il
pezzo che manca**. Misurato sul progetto di prova costruendo il caso vero: un
ingrediente, due finger, una selezione che li contiene, un conto con **due
porzioni**.

### ✅ Quello che funziona già, e non va costruito

| cosa | esito |
|---|---|
| **il food cost della selezione** | ✅ **0,40 €** = due finger da 0,20. `v_recipe_costs` esplode le ricette annidate con `espansione_costo_ricetta`, che è ricorsiva |
| **lo scarico di magazzino, due porzioni** | ✅ **0,040 kg** = 2 porzioni × 2 finger × 0,010 kg. È **esattamente** la regola «un pezzo per tipo, due porzioni due pezzi» |
| **la comanda una riga sola** | ✅ già così: la riga di comanda punta al piatto in menu, e il piatto in menu è la selezione |
| **il ciclo A dentro B dentro A** | ✅ già impedito da un trigger, in profondità |
| **una preparazione senza resa** | ✅ già impedita da un vincolo (`preparazione_requires_yield`) — quindi **il buco silenzioso che temevo non esiste**: senza resa il conto darebbe NULL e sparirebbe in silenzio, e lo schema non lo permette |

> **La risposta onesta alla domanda del mandato**: la struttura esistente
> copre food cost, scarico e comanda. **Non serve una tabella nuova per i
> finger.**

### 🔴 Quello che manca davvero — tre cose, e la prima è un rifiuto

**1 · Oggi il gestionale RIFIUTA di comporre un piatto con un altro piatto.**
Misurato: il trigger `check_recipe_component` risponde

> *«Solo le ricette di tipo "preparazione" possono essere usate come
> componente»*

Un finger è concettualmente un **bocconcino finito**, non una preparazione.
Marcarlo `preparazione` funziona — è così che la misura qui sopra ha dato i
numeri giusti — **ma dice una cosa falsa su di lui**, e ha conseguenze vere:
finirebbe nell'elenco delle preparazioni, nel modulo Produzioni, nella
sorveglianza delle rese. ⚠️ *È la stessa forma del riflesso e del doppione:
un dato che dice una cosa per far funzionare un'altra.*

**2 · Il prezzo a pezzo non esiste.** I prezzi vivono su
`menu_items.selling_price`, cioè **sul piatto in carta**. Un finger che non è
in carta da solo non ha nessun prezzo, e Alessio ne ha bisogno per i clienti
che li scelgono per un evento.

**3 · Lo storico dei costi non esiste.** Vedi la sezione dopo.

---

## 🔴 Lo storico dei costi — l'idea è di Alessio

**Non si ricostruisce il costo passato dai prezzi di allora: si REGISTRA il
costo quando cambia.** Nelle sue parole: se a ottobre la pasta alla Norma
costa 3 € e a novembre sale il prezzo delle melanzane, il registro deve saper
dire che a ottobre costava 3 e a novembre 3,50.

- **su tutto**: piatti, finger, selezioni **e** preparazioni intermedie;
- **solo i cambiamenti veri**: se il costo non cambia, non si scrive niente;
- **ogni voce dice cosa l'ha causata** — «è salita la melanzana», «tolta la
  crocchetta», «cambiata la dose». *Ad Alessio serve sapere **perché** un
  piatto costa di più, non solo che costa di più*;
- serve anche perché **l'assistente possa rispondere senza ricostruire
  nulla**, e perché lo si possa leggere dalla scheda della ricetta.

### Le due condizioni che decidono se questo lavoro regge

**a) LA STORIA LA SCRIVE IL DATABASE, NON LE SCHERMATE.** Il costo cambia per
**quattro strade diverse**: il prezzo di un ingrediente, la composizione, la
quantità, lo scarto. Se a registrare sono le schermate, prima o poi una delle
quattro si dimentica e **la storia ha un buco che nessuno vede**: il registro
sembra completo e ne salta un pezzo. È la famiglia dei 33 posti silenziosi.

**b) UN PREZZO CHE CAMBIA MUOVE TANTI NUMERI.** La melanzana muove la Norma,
ogni preparazione che la usa, ogni piatto che le contiene, ogni selezione che
li contiene. **Una fattura da venti righe può scrivere centinaia di voci.**
L'ordine di grandezza va misurato *prima* di scegliere come scriverle, e
dichiarato.

### ⚠️ E il costo non calcolabile

Resta possibile, anche se raro: un ingrediente inserito a mano e mai comprato
non ha un prezzo a una data passata. **Quando un costo non è calcolabile, il
gestionale lo DICE** — non usa il prezzo più vicino spacciandolo per vero. È
la regola già applicata tre volte in due giorni: la sala che non si disegna
vuota, la lettura tagliata che si denuncia, l'export che si rifiuta.

---

## I blocchi, nell'ordine

⚠️ **Uno alla volta, ognuno col suo commit e il suo riepilogo.** L'ordine non
è negoziabile: il blocco 1 è quello che sblocca l'inserimento a mano delle
ricette, ed è l'unico che Alessio sta aspettando per lavorare.

### ✅ Blocco 1 — i finger si possono comporre — **FATTO il 19/08**

Consegna: [`consegne/20260819_i_finger_si_compongono.md`](../consegne/20260819_i_finger_si_compongono.md).
Migrazione `20260819000012`. **Le due scelte di Alessio sono qui sotto.**

#### 🔴 Un TIPO NUOVO, non la strada larga — e la ragione va conservata

Deciso da Alessio, e scritto qui perché non venga «semplificata» fra sei mesi:

- marcare un finger come **preparazione** lo farebbe finire in Produzioni e
  sotto la sorveglianza delle rese: **il gestionale gli chiederebbe conto di
  cose che non è**;
- lasciar entrare **qualunque ricetta dentro qualunque altra** è meno lavoro
  oggi, ma toglie l'unica protezione che impedisce di comporre per sbaglio un
  piatto dentro un altro piatto. *Quella protezione va conservata, non
  allargata* — infatti si è **ristretta**: prima ammetteva solo le
  preparazioni, adesso preparazioni e finger, e continua a rifiutare i piatti;
- il tipo nuovo dà l'**elenco dei finger**, che serve per comporre le
  selezioni e servirà al modulo preventivi.

#### 🔴 Il PREZZO A PEZZO sta sulla ricetta del finger

Deciso da Alessio, e l'obiezione dei «due prezzi che si contraddicono» è
stata **ricollocata, non scartata**: *non sono due prezzi dello stesso
oggetto.* Il prezzo della carta è di un **piatto**, il prezzo a pezzo è di un
**finger** — cose diverse, ognuna col suo, e non si contraddicono perché non
parlano della stessa cosa.

⚠️ **Il caso in cui si contraddirebbero esiste, e si scrive adesso invece di
risolverlo**: il giorno in cui **lo stesso finger andasse in carta anche da
solo**, ci sarebbero due prezzi per la stessa cosa e servirebbe una regola su
quale vince. Oggi non succede — nessun finger è un piatto in carta. *Scriverlo
evita che fra sei mesi qualcuno lo scopra vendendo.*

### Blocco 1 — cosa comprendeva

Togliere il rifiuto, senza perdere quello che quel rifiuto proteggeva.

- una ricetta può essere componente di un'altra **anche se non è una
  preparazione**, e la cosa va detta nel modello invece che aggirata
  marcandola preparazione;
- ⚠️ **quello che il vincolo proteggeva va conservato**: un componente deve
  avere una **resa dichiarata** (oggi `preparazione_requires_yield`), perché
  senza resa il calcolo darebbe NULL e sparirebbe in silenzio. Per un finger
  la resa è **1 pezzo**, e deve essere il gestionale a saperlo, non Alessio a
  ricordarselo;
- **niente ripetizioni**: un finger compare una volta sola in una selezione.
  Un vincolo del database, non un controllo nella schermata;
- il ciclo resta impedito com'è oggi.

**Prove che possono fallire**: due porzioni di una selezione da sei finger
scaricano **due pezzi per tipo**, non uno e non sei; lo stesso finger messo
due volte nella stessa selezione viene **respinto**; una selezione con un
componente senza resa viene **respinta**.

### Blocco 2 — il prezzo a pezzo, e la composizione si modifica

- un prezzo **a pezzo** sul finger, distinto dal prezzo della selezione in
  carta. ⚠️ Prima di aggiungerlo, guardare se il posto giusto è la ricetta o
  un listino a parte: il prezzo di vendita oggi vive **solo** sul piatto in
  carta, e mettere un secondo prezzo altrove è la premessa di due numeri che
  si contraddicono;
- la schermata per comporre una selezione: aggiungere e togliere finger in un
  gesto, col costo che si aggiorna sotto gli occhi;
- ⚠️ **Il criterio di Alessio sulle schermate vale anche qui**: *linea
  essenziale e minimal*, e la spiegazione va dove sta il dubbio, non sopra la
  pagina.

### Blocco 3 — lo storico dei costi

Il pezzo grosso, e va fatto **dopo** che i finger esistono: senza ricette
vere non c'è niente di cui registrare la storia.

1. **Prima la misura** chiesta dalla condizione (b): quante voci scriverebbe
   una fattura da venti righe, con la profondità vera del Ricettario di
   Alessio. **Dichiararla prima di scegliere come scriverle.**
2. La registrazione **nel database**, su tutte e quattro le strade
   (prezzo · composizione · quantità · scarto).
3. La causa scritta in ogni voce, in parole leggibili.
4. La lettura: dalla scheda della ricetta, e disponibile all'assistente.

**Prove che possono fallire**:

- tolto un finger dalla composizione, **il costo di ieri resta quello di ieri
  e quello di oggi cambia**: la prova legge **entrambe** le date;
- un cambio di prezzo di un ingrediente **dentro una preparazione dentro un
  piatto** arriva fino in cima — è la catena a tre livelli, ed è dove si
  rompe;
- salvare una composizione **senza cambiare niente** NON scrive una voce;
- 🔴 **e la rottura**: togliere la registrazione da **una** delle quattro
  strade e verificare che una prova diventi rossa. *Se non diventa rossa, il
  buco silenzioso è già possibile.*

---

## Cosa questo mandato NON copre

1. ⚠️ **Il modulo preventivi** per i clienti — nato parlando dei finger
   scelti per un evento. È in [`CODA_E_DECISIONI.md`](../CODA_E_DECISIONI.md)
   fra le decisioni aperte, **non è lavoro di adesso**.
2. ⚠️ **Il collegamento fra lo storico dei costi e la Proiezione**: la
   Proiezione lavora su costi di piano, non su costi veri per piatto. Sono
   due domande diverse e per ora restano separate.
3. ⚠️ **Non tocca il prezzo di vendita dei piatti in carta**, che resta dove
   è sempre stato.
4. ⚠️ **La misura esplorativa è stata fatta con due finger e un
   ingrediente**: sufficiente a dire che la macchina esiste, non a dire come
   si comporta con una selezione da dodici bocconcini a tre livelli.
   🔴 **E due non bastavano a provarla**: con due bocconcini e due porzioni le
   due risposte *sbagliate* dello scarico coincidono (0,020 kg sia ignorando
   le porzioni sia contando i bocconcini come porzioni). Le prove del blocco 1
   usano **sei** bocconcini, dove le tre risposte si distinguono — 0,120
   giusta, 0,060 e 0,360 sbagliate in due modi diversi. *Un numero scelto per
   comodità può rendere una prova incapace di distinguere il giusto dallo
   sbagliato.*

---

## Cosa la misura NON dice

- ⚠️ **Non è stata provata nessuna schermata**: la misura è tutta sul
  database. Il Ricettario oggi filtra e mostra le ricette per tipo, e
  **cosa succede a una schermata che incontra un finger non è stato
  guardato**.
- ⚠️ **Non copre la stampa del menu né gli allergeni**: una selezione eredita
  gli allergeni dei suoi finger, e `v_recipe_allergens` non è stata misurata
  su una ricetta composta di ricette.
