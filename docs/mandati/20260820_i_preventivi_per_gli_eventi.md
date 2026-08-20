# I preventivi per gli eventi

**Decisioni di Alessio, 19 e 20/08/2026**, in due giri di domande. Il modulo
usa il **prezzo a pezzo dei bocconcini**, che è in produzione dal 20/08.

---

## 🔴 Cos'è, e perché non è un foglio

Un preventivo è **il posto dove Alessio promette un prezzo prima di conoscere
il costo**: la cena è fra due mesi, i prezzi si muovono, e il food cost di
oggi non è quello di quella sera.

⚠️ **È l'unico punto del gestionale dove questo succede**, e va tenuto
presente in tutto il disegno. Dappertutto altrove il gestionale registra
qualcosa che è già avvenuto; qui registra una **promessa**. Da lì discendono
quasi tutte le decisioni qui sotto: perché le versioni non si sovrascrivono,
perché il costo va rifotografato, perché lo storico dei costi (blocco 3 dei
finger food) serve proprio a questo modulo.

---

## 🔴 Prima la misura: cosa esiste già, e cosa è rotto

Chiesto al database e al codice **prima** di progettare.

| pezzo | stato |
|---|---|
| `reservations.type = 'evento'`, `event_type`, `event_menu_id → menus` | ✅ c'è: una prenotazione può già essere un evento con un menu |
| `reservation_deposits` (caparra) | ✅ c'è: `reservation_id`, `amount` |
| `giornate_sold_out` (la spunta «sala piena») | ✅ c'è: una riga per data |
| `coperti_del_giorno()` / `pianta_del_giorno()` | ✅ c'è: quanti coperti tiene la sala quel giorno |
| `recipes.prezzo_al_pezzo` sui bocconcini | ✅ in produzione dal 20/08 |
| `storico_costi_ricetta` | ✅ in produzione dal 20/08 — **è il pezzo che dice quanto costava quando l'hai promesso** |
| PDF | ✅ si fa con la stampa del browser (`print:` + `<PrintButton>`), nessuna libreria |
| WhatsApp col testo pronto | ✅ il modo è già collaudato negli ordini ai fornitori (`whatsapp://`, e **si copia sempre prima**) |
| **un preventivo** | 🔴 non esiste niente |
| **le porzioni modificate per un evento** | 🔴 non esiste niente |
| 🔴 **il fabbisogno di un evento** | **esiste e SBAGLIA** — vedi sotto |

### 🔴 `computeEventIngredientNeeds` è rotta, e si romperà su ogni evento vero

C'è una funzione che stima gli ingredienti di un evento
(`src/lib/api/reservations.js`), e la usa la scheda della prenotazione. Fa il
conto **nel browser**, e ha due difetti:

1. **Guarda solo gli ingredienti diretti**: una riga di ricetta che contiene
   una **preparazione** o un **bocconcino** ha `ingredient_id` vuoto. La
   funzione la tiene lo stesso, e poi legge il prezzo di un ingrediente che
   non c'è. ⚠️ **Non dà un numero sbagliato: si rompe.** E si romperà su
   quasi ogni menu vero, perché Alessio *«scompone sempre»* — è scritto nel
   mandato delle Produzioni.
2. **Ignora lo scarto**: 200 g puliti si comprano 235, e quel numero è nel
   database dal 13/08.

⚠️ **E il difetto di fondo è che quel calcolo esiste due volte**: il database
lo sa già fare bene, ricorsivamente e con lo scarto
(`espansione_costo_ricetta`, `fabbisogno_conto`, `v_recipe_costs`). È
esattamente la forma chiusa in nove punti dal mandato di correzione.

🔴 **Conseguenza vincolante per questo mandato**: il preventivo **non
costruisce un terzo calcolo**. O usa quello del database, o non si fa. E
`computeEventIngredientNeeds` **si toglie**, non si lascia accanto.

---

## Le decisioni di Alessio

### 1 · 🔴 La schermata che commuta — è il cuore del modulo

Alessio compilerà il preventivo **anche davanti al cliente**. La stessa
schermata deve mostrare due cose:

- **«il costo per me»**: il food cost sommato, con la possibilità di
  **modificare le porzioni** rispetto alla carta (un primo da 100 g in carta
  può diventarne 50 a un evento) e di aggiungere extra — personale
  aggiuntivo, servizi in più;
- **«il prezzo per il cliente»**: il dettaglio delle voci che compongono il
  suo prezzo, da mostrargli in diretta.

⚠️ **UNA SOLA SCHERMATA, non due viste che possono divergere**: è il motivo
per cui Alessio l'ha chiesta così, ed è lo stesso principio di `orderTotals()`
e di `pianta_del_giorno()`.

🔴 **E il passaggio alla vista «costo per me» va PROTETTO** — decisione sua.
Un tocco sbagliato davanti a un ospite gli mostra il food cost, e *chi scopre
di pagare 55 € una cena che ne costa 14 non ragiona su affitto e personale:
ragiona sulla differenza*. **Non un interruttore qualunque.**

⚠️ Il come non è deciso: va proposto ad Alessio. Ma il criterio sì — **non si
deve poter aprire per sbaglio**, e la prova deve verificarlo.

### 2 · Le porzioni modificate valgono SOLO per quell'evento

La ricetta in carta **resta intatta**.

🔴 **E la sera dell'evento il magazzino deve scaricare QUELLE**, non quelle
della carta. ⚠️ *È la differenza fra un preventivo che è un foglio e uno che
comanda il servizio*, ed è anche il punto in cui questo modulo tocca il resto
del gestionale: lo scarico passa da `fabbisogno_conto`, che oggi non sa niente
degli eventi.

### 3 · Il prezzo

- si fa **a persona**;
- il gestionale lo **propone** a partire da un **ricarico**: un valore
  predefinito, modificabile dalla schermata privata di Alessio;
- 🔴 **il ricarico si applica al SOLO CIBO**. Gli extra Alessio li aggiunge a
  parte e il gestionale somma tutto. ⚠️ **Va scritto dove si legge**, perché è
  la trappola naturale di questo modulo: *un preventivo può risultare in linea
  sul cibo e in perdita sulla serata*;
- il prezzo proposto si può **scavalcare** scrivendone un altro.

### 4 · I documenti: PDF, mail, WhatsApp — un tocco ciascuno

🔴 **Mai un tocco che manda tutto**: *«invierò solo quello che fa comodo al
cliente»*.

⚠️ **E la ragione tecnica è la stessa della sua**: il giorno che il cliente ha
dato solo il telefono, un invio unico spedirebbe una mail a un indirizzo
inventato. Stessa forma della regola sugli ordini ai fornitori — *il
gestionale prepara, Alessio manda*.

### 5 · Quando il cliente accetta

- **È Alessio a dire «accettato»**: un evento si conferma con una caparra, una
  telefonata, un messaggio, e il momento in cui diventa certo lo decide lui.
  Da lì il gestionale crea tutto il resto, **prenotazione compresa**.
- 🔴 **«Sala piena» la decide la CAPIENZA, non l'evento.** Se l'evento riempie
  la sala, la spunta di quel giorno si accende **da sola**. Se quella sera ci
  sono già altre prenotazioni, vuol dire che l'evento è conciliabile e va
  trattato come una prenotazione normale: **niente spunta**.
  ⚠️ **Una regola sola, nessun caso speciale** — e la capienza la sa già
  `coperti_del_giorno()`.
- ⚠️ **Se l'evento accettato viene annullato**, la spunta si toglie **da sola**
  *e* Alessio **ne viene avvisato**. Servono tutte e due: una sala che resta
  bloccata per errore gli costa una serata intera, una che si sblocca in
  silenzio gli fa scoprire il buco troppo tardi.
- **Un preventivo non ancora accettato non blocca niente**, ma se si sta per
  registrare una prenotazione per quel giorno il gestionale **avvisa e lascia
  decidere**. Non decide al posto suo.

### 6 · Le modifiche dopo l'accettazione

**Non si sovrascrive**: si crea un preventivo **nuovo collegato al vecchio**,
e resta traccia di tutto.

⚠️ Con un acconto versato e un prezzo concordato, *sapere cosa era stato
promesso e quando* è la cosa che conta. È lo stesso principio degli scenari
congelati della Proiezione, e per la stessa ragione.

---

## I blocchi, in ordine di dipendenza

### Blocco 0 — la riparazione, prima di costruirci sopra

`computeEventIngredientNeeds` si **toglie** e il fabbisogno di un evento si
chiede al database. ⚠️ Va per primo perché il modulo nuovo poggerebbe su un
calcolo rotto — e perché è **già rotto adesso**, per chiunque apra oggi una
prenotazione evento con un menu che contenga una preparazione.

**Prove che possono fallire**: un menu evento che contiene una preparazione
dentro un piatto dà il fabbisogno **giusto** (oggi si rompe), e lo scarto è
contato.

### Blocco 1 — il preventivo esiste

Testata (cliente, data, persone, stato), righe (piatti, selezioni, vini,
extra), le **porzioni modificate**, il costo fotografato, il prezzo a persona
proposto e quello scavalcato. Le versioni collegate.

⚠️ Nessuna schermata «che commuta» ancora: prima la cosa deve esistere e
tornare nei numeri.

### Blocco 2 — la schermata che commuta

Le due viste in una, il gesto protetto, il dettaglio per il cliente.

### Blocco 3 — i documenti

PDF, mail, WhatsApp. Un tocco ciascuno.

### Blocco 4 — l'accettazione e le sue conseguenze

La prenotazione che nasce, la spunta «sala piena» calcolata dalla capienza,
l'annullamento che la toglie e avvisa, l'avviso sulle prenotazioni dello
stesso giorno.

### Blocco 5 — la sera dell'evento

Il magazzino scarica le porzioni **modificate**.

---

## Prove che possono fallire

- la vista «costo per me» **non si apre con un tocco solo**, e una prova lo
  verifica: *se il gesto protetto si può aggirare, la protezione non c'è*;
- un evento che **riempie** la sala accende la spunta; uno che ci sta insieme
  alle prenotazioni esistenti **non la accende** — ⚠️ è la prova che distingue
  la regola dalla scorciatoia «è un evento, quindi blocca»;
- annullato l'evento, la spunta **si spegne** *e* l'avviso **parte**: due
  asserzioni, non una;
- la sera dell'evento il magazzino scarica le porzioni **modificate**, non
  quelle della carta — **e la ricetta in carta risulta intatta**;
- ⚠️ **e la rottura**: togli il collegamento fra preventivo nuovo e vecchio, e
  verifica che una prova diventi rossa. *Se non diventa rossa, la storia delle
  versioni è già perdibile in silenzio.*

⚠️ **E i numeri delle prove vanno scelti perché distinguano** (lezione del
19/08): con due piatti e due persone le risposte sbagliate coincidono con
quella giusta.

---

## Cosa questo mandato NON copre

- la fatturazione dell'evento (resta a Fatture in Cloud, mandato cumulativo);
- l'incasso della caparra in prima nota, che ha già la sua strada;
- il calendario degli eventi come agenda commerciale: qui si fa il
  preventivo, non la trattativa;
- un listino di prezzi per il cliente: il prezzo si costruisce ogni volta.
