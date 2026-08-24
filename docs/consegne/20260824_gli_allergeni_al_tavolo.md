# Gli allergeni al tavolo, il bis da solo, e le scritte che si leggono

**Consegna del 24/08/2026 (notte)** — mandato del collaudo, blocchi 1-5.

| | |
|---|---|
| **HEAD del codice** | `a6166a8` |
| **Sopra di lui, sola documentazione** | `09e7666` (prima stesura di questo riepilogo) · `b94de19` (CLAUDE.md) · e questo aggiornamento, che è l'ultimo commit della consegna |
| **Working tree** | pulito |
| **Migrazioni nuove** | `20260824000034` → `20260824000039` (sei) |
| **Migrazioni applicate in PRODUZIONE in questa sessione** | **una sola**: `20260824000031` |
| **Prove** | 416 pure (12 nuove) · 380 sui dati veri (8 nuove) — tutte verdi |

---

## 0 · Lo stato delle migrazioni, prima di tutto il resto

All'apertura della sessione la produzione era a **225** migrazioni su 229 nel
repository. Le quattro mancanti:

| versione | esito |
|---|---|
| `…030` i diciassette confronti reggono | **si è fermata in produzione**, e aveva ragione: vedi sotto |
| `…031` il portiere sulle linee | ✅ **applicata** — produzione a **226** |
| `…032`, `…033` | non ancora su GitHub: `npm run migra` si rifiuta, come deve |

🔴 **La `…030` ha fermato l'applicazione, e la misura ha confermato la
diagnosi che la `…032` (già scritta, non ancora pushata) aveva fatto.** Sulla
previsione vera **6 confronti su 17** non tornano col foglio, e hanno **una
sola radice**: i costi fissi operativi del gestionale sono **75.504 €**, quelli
dichiarati dal foglio **71.904 €** — 3.600 l'anno, cioè 300 al mese. Gli altri
cinque (EBITDA di sala, EBITDA complessivo, EBIT e i due pareggi) sono la
conseguenza aritmetica: −3.600 sui primi tre, +102 coperti sui due pareggi.
Il confronto **sta dicendo il vero**: fra il caricamento del foglio e il
congelamento è stata aggiunta una voce di costo che nel foglio non c'è.

⚠️ **Nessuna migrazione di questa consegna è in produzione.** Aspettano tutte
il push, e la `…030` va **saltata** (`npm run migra -- --salta 20260824000030
--conferma`), che è quello che la `…032` prescrive e registra.

---

## 1 · Gli allergeni al tavolo

Migrazioni `…034` (Ricettario), `…035` (comanda), `…039` (i tre stati in sala).

### Le risposte sono tre, non due

`scelte_allergene` porta un `eliminabile` booleano, e **l'assenza della riga è
il terzo stato**: «non l'ha ancora guardato nessuno». Un valore predefinito
«non eliminabile» sarebbe stato comodo — in sala il pulsante resta spento —
ma renderebbe indistinguibile un piatto **esaminato** da uno **mai guardato**,
e su una materia di salute quella differenza è tutta la differenza.

⚠️ **In sala i due «no» si comportano uguale ma non si dicono uguale**, ed è un
difetto che ho trovato **aprendo la schermata**, non rileggendo: la prima
versione di `allergeni_della_riga` restituiva un booleano, e il pulsante spento
diceva «non si può togliere» anche a un allergene che nessuno aveva esaminato —
cioè un'affermazione che il gestionale non può fare. Ora dice **«nessuno l'ha
guardato: chiedi in cucina»**. Il comportamento non cambia (spento in tutti e
due i casi, si sbaglia sempre dalla parte di non promettere): cambia la frase,
che è l'unica cosa che il cameriere può riferire.

### Non si può promettere una cosa a metà

`sostituzioni_allergene` è **per ingrediente**, non per allergene. Il lattosio
di un piatto può arrivare dal burro **e** dalla panna: dichiarando la sola
sostituzione del burro e promettendo «senza lattosio» si servirebbe a un
intollerante un piatto che il lattosio ce l'ha ancora — nessun errore, nessun
avviso.

- **«Eliminabile» non si può dichiarare se la copertura non è completa**, e a
  rifiutare è un trigger del database. Il rifiuto **nomina TUTTI** gli
  ingredienti scoperti.
- **Vale allo specchio**: togliere una sostituzione che regge una promessa è
  **respinto**, con la via d'uscita scritta dentro il messaggio.
- **Doppio controllo voluto** nell'operazione di sala: fra la dichiarazione e
  il momento in cui si promette a un cliente, qualcuno può aver aggiunto un
  ingrediente al piatto.

### Le tre conseguenze, tutte misurate sui dati veri

1. **La cucina.** La sostituzione compare sulla riga di quel piatto, in un
   riquadro bordato: `SENZA LATTE` a **6 mm** (misurato a schermo), con sotto
   `Ricotta di pecora → …`. Sulla carta è `text-lg`, cioè **più grande del nome
   del piatto** — è l'unica riga del biglietto che, se non viene letta, manda
   in ospedale qualcuno.
2. **Il magazzino.** `fabbisogno_conto` riscritta **dal corpo vivo del
   database** (cambia solo la select finale): esce il sostituto, e dove il
   sostituto non c'è non esce niente.
3. **Il conto.** Il supplemento sta **fuori da `unit_price`**, così il prezzo
   di carta del piatto resta quello — e va sul conto lo stesso. Misurato in
   sala sul conto vero di T1: **127,00 → 128,50** applicando una sostituzione
   da 1,50 a una riga **già inviata**.

### Quando si può fare

**Anche su una riga già andata in cucina**, finché il conto è aperto — è una
scelta: il caso vero è il cliente che lo dice dopo, e rifiutare lì sarebbe un
vicolo cieco travestito da regola. **Avvisare la cucina a voce resta di chi è
in sala**: un biglietto già stampato nessun programma lo riscrive. Su un conto
chiuso o annullato non si tocca più niente (trigger).

### Tutto si fotografa

`order_item_sostituzioni` conserva supplemento **e frase leggibile**, non un
rimando al Ricettario: domani Alessio cambia il supplemento, quel conto no.
Stesso principio di `order_items.unit_price`.

---

## 2 · Il bis dei finger, da solo — rovesciamento n. 44

Era un pannellino sotto la riga del piatto, e **viveva solo finché quella riga
era in bozza**: appena la comanda partiva per la cucina il pulsante spariva,
cioè mancava proprio nel caso normale. Ora è una **voce a sé** accanto alla
carta dei vini, in due passi (quale selezione → quale bocconcino), e la riga
nasce nel turno in corso come qualunque altra voce.

⚠️ **La ragione vecchia è conservata dentro la forma nuova**: il primo passo
elenca **solo le selezioni ordinate a quel tavolo**. Non si è passati a
«scegli un finger dal ricettario» — si è tolto il vincolo del *momento*, non
quello del *contesto*.

🔴 **E il bis si vede anche in cucina.** `lineLabel` esisteva in **quattro
copie** (Sala, Bar, Preconto, Chiusura conto) e **una sola** sapeva riconoscere
un bis: il bocconcino in più arrivava sul biglietto della cucina col suo nome
nudo, indistinguibile da una portata. Ora la regola è una sola
(`src/lib/calcoli/righeComanda.js`). **Visto a schermo**: il biglietto di
cucina dice «1× bis di Bocconcino di tonno».

---

## 3 · La scheda del finger food

Tutte e sette le voci. Su un piatto di categoria «finger food»:

| voce | cosa è cambiato |
|---|---|
| a | **filtri** nell'elenco dei finger: ricerca, categoria, «senza …» |
| b | «Ingredienti» → **«Finger»** |
| c | **via la colonna quantità** (e la % scarto: su un bocconcino finito non esiste) |
| d | la ricerca in fondo **cerca solo finger** |
| e | **via** «Fasi di preparazione» e «Video ricetta» |
| f | **via** stagionalità e i minuti |
| g | «HACCP e allergeni» → **«Allergeni»**, senza CCP, con l'elenco **dei finger** ognuno coi suoi allergeni |

⚠️ **«Di carne» e «di pesce» non sono un dato di questo gestionale**: una
ricetta non porta da nessuna parte di che cosa è fatta. I filtri che esistono
separano per **categoria** (i salati stanno in «antipasto», i dolci in
«dolce») e per **allergene**; chi cerca «di carne» digita la parola.

⚠️ **Il filtro «senza …» si spegne se gli allergeni non si sono potuti
leggere**, e dichiara quanti finger nasconde e perché. Misurato a schermo:
cercando «senza glutine» dice *«24 finger non compaiono per via dei filtri. Di
questi, 24 sono esclusi perché i loro allergeni non sono ancora confermati:
non si sa se ce l'hanno»* — non «non ce ne sono senza glutine».

---

## 4 · Le scritte piccole nella pianta — rovesciamento n. 45

**La misura ha corretto il verso della richiesta.** Misurato nel browser, sul
tablet in verticale (768 punti, calibrazione **64** — non quella del monitor):

| | prima | dopo |
|---|---|---|
| riquadro | 344 × 160 punti (53,8 × 25,1 mm) | **345 × 241** (53,8 × 37,6 mm) |
| nome | 4,00 mm | **6,00 mm** |
| ora e coperti | 3,20 mm | **4,00 mm** |
| scorre? | sì (misurato il 24/08 mattina) | **no** — 108 punti usati su 241 |

- **Alla destra del riquadro ci sono ZERO punti**: arriva già al bordo della
  pianta. Lo spazio vuoto c'è, ma **sotto**: 77 punti prima di T7·T8·T9. Sulla
  pianta in piedi gli assi si scambiano — la stessa cosa successa il 18/08 con
  la Chef Table, letta allo specchio.
- **Non è un numero, è una regola**: `pannelloAllargato()` cresce fin dove può
  e **si ferma prima del vicino**, lasciando il varco. Se Alessio mette un
  tavolo lì sotto, il pannello si ritira invece di coprirlo — e se glielo mette
  *dentro*, sparisce come prima.
- 🔴 **Il vincolo che teneva il nome a 4 mm era una frase diventata falsa**: il
  commento diceva «la riga ha 205 punti», misurati quando la pianta era larga
  409. Oggi la pianta è larga 689 e la riga **344**; un nome di 16 lettere (il
  novantesimo percentile dei 263 nomi veri del database) chiede **320 punti a
  6 mm**. Il vincolo era scaduto, e restava scritto **a impedire la
  correzione**.
- **La riga che si troncava non si tronca più**: «20:41 · 2 · prenotato da …»
  si spezzava perdendo proprio il nome; ora l'ora sta su una riga sua e
  «prenotato da» su un'altra, sotto, e solo quando è una persona diversa da
  chi paga.

---

## 5 · La spiegazione che non si capiva

I quattro stati spenti con una riga grigia sotto si leggevano «non funziona».
Ora c'è un riquadro con il lucchetto — **«🔒 Bloccato apposta.»** — e **dentro
il gesto che sblocca, col nome del menu**: «Togli da «Carta dei due mesi» e
sblocca». **La protezione non è toccata**: è la stessa regola, detta in modo
che si capisca che è voluta.

---

## Cosa abbiamo rovesciato

**Due rovesciamenti, tutti e due registrati** in
[`docs/decisioni_rovesciate.md`](../decisioni_rovesciate.md).

### n. 44 — il bis diventa una voce a sé

- **Cosa era stato deciso e quando:** il 24/08 stesso, poche ore prima — il
  «+ bis» sotto la riga del piatto di finger food, e solo lì.
- **La ragione di allora:** in sala non si sceglie da tutto il ricettario, si
  sceglie fra i finger *di quel piatto*.
- **Cosa si decide adesso:** voce a sé, in qualunque momento e turno.
- **Perché la ragione di allora non vale più:** **vale ancora, ed è conservata
  intera** — il primo passo elenca solo le selezioni di quel tavolo. Quello
  che era sbagliato non era il *contesto* ma il *momento*: il pannellino
  spariva appena la comanda partiva.

### n. 45 — il riquadro esce dai confini del bancone, e il nome va a 6 mm

- **Cosa era stato deciso e quando:** 23/08 e 24/08 mattina — «la sua taglia
  la decide la stanza», «ingrandire il nome non si può».
- **La ragione di allora:** il pannello sta lì perché quel pezzo di pianta è
  vuoto; e la riga era larga 205 punti.
- **Cosa si decide adesso:** il pannello cresce nel vuoto misurato, il nome va
  a 6 mm.
- **Perché la ragione di allora non vale più:** la misura dei 205 punti **è
  diventata falsa** (la pianta è cresciuta), e il vincolo sul bancone non era
  «non si può crescere» ma «non si può coprire un tavolo» — **quello resta
  intero**. Si è tolto il numero, non la regola.

---

## Cosa NON è stato verificato con gli occhi

🔴 **In questo ambiente lo screenshot non ha mai funzionato**: tutto ciò che
riporto come «visto» è **misurato dal DOM** — dimensioni, testi, taglie dei
caratteri, sovrapposizioni. **Nessuna immagine è stata guardata.** Quindi:

- **colori, contrasto e come gli elementi stanno insieme non li ha visti
  nessuno.** Il riquadro «SENZA LATTE» in cucina, il lucchetto della
  protezione e le tre pastiglie di stato sono misurati, non guardati;
- **il biglietto di cucina STAMPATO**: ho portato la riga dell'allergene a
  `print:text-lg` e **la stampa non l'ho vista**. Su 72 mm quella riga
  potrebbe andare a capo;
- **il preconto e la chiusura conto con una riga sostituita**: il calcolo è
  provato (pure e sui dati veri), ma **non ho aperto quelle due schermate**
  con una sostituzione dentro;
- **il pannello allargato su un telefono** (schermo stretto) e **con la
  tastiera dell'iPhone aperta**;
- **il pannello che si ritira** quando gli si trascina un tavolo sotto: provato
  solo dalle prove pure, **non trascinando un tavolo davvero**;
- **la schermata Bar** con una riga sostituita.

## Dove il mandato dice una cosa e il gestionale ne fa una un po' diversa

Il mandato dice: *«quelli dichiarati eliminabili sono PREMIBILI: il cameriere
li tocca e **sceglie l'alternativa**»*. Nel gestionale il cameriere **tocca e
basta**: non c'è nessuna scelta, perché nel Ricettario si dichiara **una**
sostituzione per ogni terna piatto × allergene × ingrediente.

⚠️ **Non è una dimenticanza, è una semplificazione — e va detta.** Ammettere
più alternative per lo stesso ingrediente vorrebbe dire un secondo elenco da
cui scegliere in sala, con davanti un cliente che aspetta, e un prezzo diverso
per ognuna. Non l'ho costruito perché non so se serve: **se a Alessio serve
davvero poter scegliere fra due alternative allo stesso ingrediente, è una
decisione sua e si aggiunge**. Il modello lo regge senza rifare niente — basta
togliere l'unicità su (ricetta, allergene, ingrediente) e far scegliere la
riga invece dell'allergene.

## Cosa deve inserire Alessio perché il blocco funzioni sui dati veri

Il meccanismo è pronto e **vuoto per costruzione**: nessuna dichiarazione,
nessuna sostituzione, nessun ingrediente sostitutivo. Servono, in
quest'ordine:

1. **Gli ingredienti sostitutivi**, come prodotti loro in *Ricettario →
   Ingredienti* (nome, categoria, unità, prezzo): «Burro senza lattosio»,
   «Ricotta senza lattosio», «Farina senza glutine», «Pasta senza glutine»…
   Sono prodotti diversi da quelli normali e costano diverso: è tutto il
   punto della cosa.
2. **Per ogni piatto**, sulla sua scheda, nel riquadro «Allergeni»: aprire
   l'allergene, e per **ogni** ingrediente che lo porta scegliere il
   sostituto (o lasciarlo vuoto se si toglie e basta) e il supplemento.
3. **Solo allora** premere «Si può togliere». Prima il database rifiuta e
   dice quale ingrediente manca.

⚠️ **Gli allergeni degli ingredienti vanno confermati**, altrimenti tutto
resta «da guardare»: sul progetto di prova, **2 ingredienti su 132** hanno un
allergene dichiarato, e i finger risultano quasi tutti «non si sa».

## Cosa è stato dato per fatto senza misurarlo

- 🔴 **`costo_ingredienti_conto` NON tiene conto delle sostituzioni**, e non
  l'ho toccata: il food cost di un piatto servito con un sostituto più caro
  continua a leggersi dalla ricetta originale. Il **magazzino** invece scarica
  giusto (`fabbisogno_conto` è corretta), quindi `stock_consumptions.costo` è
  vero. Il buco è nel numero che alimenta il registro sconti/omaggi. **Da
  chiudere**, non dichiarato altrove finora.
- **La percentuale di scarto del sostituto**: si usa quella dell'ingrediente
  **originale**, perché la quantità scritta in ricetta parla di lui.
  Ragionato, non misurato su un caso vero.
- **Il turno del bis**: nasce nel turno *selezionato*, che dopo un ricaricamento
  della schermata è il primo — esattamente come qualunque altra voce del menu.
  Coerente, ma non l'ho chiesto ad Alessio.

## Quali mie affermazioni sono diventate false mentre lavoravo

Tre, tutte corrette con una migrazione **nuova** invece che riscrivendo quella
già applicata:

1. La `…035` scriveva nel proprio commento **«i tre stati»** e la funzione ne
   restituiva **due**. Corretta dalla `…039`. Nessuna prova poteva
   accorgersene: la verifica controllava che l'allergene comparisse, non **come
   veniva chiamato**.
2. La `…036` diceva che la schermata poteva ricavare i portatori da
   `allergeni_del_piatto`. Era vero **a metà**: mancavano gli identificativi.
   Corretta dalla `…037`.
3. La `…037` metteva l'identificativo dell'ingrediente **da sostituire** e non
   quello del **sostituto**: riaprendo il pannello, la tendina «con cosa»
   ripartiva vuota, e salvando il sostituto scelto prima sarebbe diventato «si
   toglie e basta» — in silenzio. Corretta dalla `…038`.

## Due porte che avevo aperto io (`…036`)

Trovate **dalle prove sui permessi**, non rileggendo:

- **tre funzioni di trigger** (`vieta_eliminabile_scoperto`,
  `vieta_sostituzione_che_scopre`, `vieta_sostituzione_a_conto_chiuso`) erano
  eseguibili con la sola chiave pubblica. Nessun dato usciva, ma **l'elenco
  cresceva in silenzio**;
- 🔴 **`fabbisogno_conto` aveva riavuto un `grant` che PRIMA NON AVEVA.**
  Riscrivendola ho preso il **corpo** dal database come vuole la regola — ma i
  **permessi** li ho riscritti a memoria, e a memoria erano sbagliati. *Un
  `revoke`/`grant` ricopiato è una riscrittura come le altre.*
- **`ingredienti_con_allergene`** era `security definer` senza portiere e
  aperta a tutto lo staff. Non le ho messo un guardiano (la chiama anche un
  trigger, e dentro una migrazione non c'è nessun utente): **ho tolto la
  chiamata** dalla schermata.

⚠️ **E `confronti_storti`** (nata con la `…032`, non mia) era comparsa
nell'elenco delle funzioni senza portiere **senza essere dichiarata**. Il
portiere ce l'ha per interposta persona — passa da `confronto_col_foglio`, che
pretende il titolare — quindi è stata **dichiarata** nell'elenco congelato,
non chiusa.

## Le quattro prove rosse che ho trovato all'inizio — non erano mie

`legame-conto-prenotazione.test.js` falliva su tutte e quattro con *«Questi
tavoli hanno già un conto aperto: T1»*. **Misurato**: il conto su T1 è del
collaudo di Alessio, aperto alle **19:20**, prima della mia prima scrittura
sulla prova (20:25). La prova prendeva **il primo tavolo vero della sala** e ci
apriva sopra dei conti: ora **si fa una sagoma sua** e la toglie a fine corsa
(regola del 16/08 — *il perimetro di una prova dev'essere fatto di roba che la
prova ha creato*).

## I dati di prova

Per guardare le schermate ho creato sul progetto di prova: un ingrediente
`__PROVA__ Ricotta senza lattosio`, due dichiarazioni, due sostituzioni, una
sostituzione applicata a una riga di T1, un conto usa-e-getta su T9 con un bis
dentro. **Tolti tutti** — misurato dopo: `scelte_allergene` 0,
`sostituzioni_allergene` 0, `order_item_sostituzioni` 0, nessun `__PROVA__` fra
ingredienti, ricette e conti. ⚠️ Restano **2 lapidi** in `deleted_records` del
progetto di prova (le righe di comanda cancellate), che è una tabella tracciata.

## Cosa resta a chi controlla

- La `…030` va **saltata**, e la `…032` la registra spiegando perché: i
  confronti col foglio non devono **peggiorare**, non «tornare tutti».
- Nessuna delle sei migrazioni di questa consegna è in produzione.
- Il buco del **food cost di un piatto sostituito** (`costo_ingredienti_conto`)
  è dichiarato qui e non chiuso.
