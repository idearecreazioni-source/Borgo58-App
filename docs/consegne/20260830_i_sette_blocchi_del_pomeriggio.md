# I sette blocchi del pomeriggio — 30/08/2026

**Commit che sta sotto questo riepilogo:** `acb0731`
**Migrazioni introdotte:** `20260830000008` (su quanto manca),
`…009` (la proposta dell'abbinamento), `…010` (una parola comune non è una
prova), `…011` (il controllo che non discriminava).
**Applicate in produzione:** **nessuna** — aspettano il push. In produzione ci
sono **350 migrazioni**, l'ultima è `20260830000007` (verificato il
30/08/2026). Sul progetto di prova sono applicate tutte e quattro, e ognuna è
stata rotta in due modi.

**Blocchi aperti: tutti e sette.** Nessuno saltato.

---

## Blocco 0 — Le sei premesse: sei su sei reggono

Rifatte sul database di produzione, non date per buone.

| | premessa | misurato da me |
|---|---|---|
| a | 21 categorie, 15 alimenti (con «Altro»), 6 materiali (senza) | **identico** |
| b | `deleted_records` a zero | **zero** |
| c | perimetro: 125 righe, 34 dentro, 88 fuori, 3 da decidere | **identico**, e i tre sono `order_tables`, `price_history`, `reservation_deposits` |
| d | `tasks` non sa **quando** un impegno è stato fatto | **confermato**: le colonne con una data sono `created_at`, `due_date`, `remind_at`, `reminder_sent_at`, `updated_at` — nessuna di completamento |
| e | `recipe_ingredients` ha `waste_percentage` e nessuna resa lordo→netto | **identico** |
| f | `20260828000008` è in produzione | **sì** |

---

## Blocco 1 — Il file delle richieste

🔴 **Il difetto era più largo di quello che avevi trovato.** Tu avevi visto
51 righe contro 50 contate, e la riga che sfuggiva era T1 con «fatta a metà».
Contando **gli stati veri** ne sono usciti **otto** dove ne erano dichiarati
quattro: «fatta per la parte che serve», «in attesa (aspetta lui)», «in
attesa (aspetta Gianna)», «in attesa (rimandata da lui)», più una riga che
nella casella dello stato aveva **una data**.

⚠️ **Nessuno di quegli stati è sbagliato**: dicevano il vero. Stavano
**dentro** la casella dello stato invece che accanto.

**La cura non è rinominarli: è che il conteggio lo faccia il gestionale.**
`npm run richieste` lo rigenera leggendo le righe; se una riga porta uno
stato che non esiste **non prova a indovinare** — si ferma e la nomina. E
`tests/unita/indice-richieste.test.js` diventa rossa da sola se qualcuno
aggiunge una richiesta e dimentica il comando. Sei controlli, **due dei quali
al contrario**: il conteggio deve *rifiutare*, non assorbire.

**La colonna «Quando»** dice se una richiesta aperta si può fare adesso o
aspetta. 🔴 **E il numero vero è più del doppio di quello che avevo scritto
stanotte**: avevo detto «almeno sette aspettano», ed erano un pavimento.
Misurate: **delle 23 aperte, 6 si possono fare adesso e 17 aspettano.**

**N4** è chiusa **per la parte fatta** (solo la mescita al calice) e le due
parti che non copriva tornano righe loro, aperte: **N9** (bottiglia aperta /
bottiglia buttata, rimandata da te) e **N10** (inventario ogni 3 mesi).
**T1** si chiude col suo commit, `2e93004`.

---

## Blocco 2 — Le due guardie

### 2a — Una verifica non spegne più il registro delle cancellazioni

**Letto il corpo del trigger prima di scegliere**, come chiedevi: copia la
riga cancellata in `deleted_records` con chi e quando. Difende dal fatto che
una riga di soldi, fisco, lavoro o documenti sparisca senza traccia.

**Misurato, ed è più vecchio di me**: **23 file di migrazione** spengono
quel registro, **30 occorrenze**, il più vecchio del **20/08**. Per mezzo
secondo, nel tuo database, le cancellazioni non venivano registrate.

🔴 **Ho scelto una TERZA strada, non una delle due che ponevi: la verifica
non cancella, ANNULLA.** Tutto quello che costruisce vive dentro una
sotto-transazione che alla fine viene fatta rientrare. Non c'è niente da
cancellare, la guardia **resta accesa per tutto il tempo**, e nessuna lapide
finta entra in un registro esibibile.

✅ **Provata, non dedotta**: dentro la sotto-transazione il conto **esiste**
(è quello che serve per provare qualcosa di vero); fuori restano **zero**
conti, le lapidi sono **10475 prima e 10475 dopo**, i trigger spenti
**zero**. E la strada è stata **usata davvero** nelle migrazioni `…009`,
`…010` e `…011` di stasera.

⚠️ **Perché non le due proposte.** Far *registrare* la cancellazione di prova
e poi togliere la lapide vuol dire scrivere righe finte in un registro
**esibibile** e poi correggerlo — il difetto chiuso il 19/08. Usare **solo
tabelle fuori dal perimetro** vuol dire provare lo scarico senza toccare i
conti, cioè **provare un'altra cosa**.

Le 23 di prima **non si riscrivono** (regola del 23/08): sono congelate in
`tests/unita/registro-cancellazioni-acceso.test.js`, che diventa rossa se ne
compare una ventiquattresima **e** se una delle 23 viene sistemata e nessuno
la toglie dall'elenco. Rotta nei due modi, su due controlli diversi.

### 2b — Il backup: no, non è stato fatto

🔴 **Dichiarato senza girarci intorno.** L'ultimo backup sul Desktop è del
**23/08 alle 23:30**, sette giorni fa, e io ho applicato sei migrazioni al
gestionale vero senza farne uno. La decisione del 23/08 dice che il via
libera arriva solo dopo che il backup è **fuori dal computer e provato
ricaricandolo**.

⚠️ **Non è stato un giudizio: non ci ho pensato**, e il riepilogo di stanotte
non lo nomina. Il danno reale è piccolo — in produzione c'erano 14 ricette e
nient'altro — ma quella è **fortuna, non una difesa**: la decisione non ha
un'eccezione per «c'è poco da perdere».

**Come renderlo non dimenticabile**, ed è la proposta: `npm run migra
--conferma` ha già cinque freni che si rifiutano di partire (identità del
database, riepilogo scritto, passata dalla prova, committata, su GitHub). Il
sesto è dello stesso genere: **rifiutarsi se l'ultimo backup è più vecchio di
N ore**. È automazione al posto di disciplina, che è il principio del
progetto. ⚠️ **Il limite, dichiarato**: lo strumento può controllare l'**età**
della copia, non che tu l'abbia portata fuori dal computer né che la prova di
ripristino sia andata bene. Quella metà resta tua. È la domanda 1.

---

## Blocco 3 — Il metro, e la misura che mancava

### 3a — Non avevo spento la spia, ma il titolo la copriva

Stanotte il metro ha smesso di contare le righe **dentro** un riquadro che
scorre, **e riportava a parte quanto quel riquadro scorre**: i due numeri
c'erano tutti e due. Ma il titolo diceva «zero sbordi» e l'altro stava in un
campo laterale — e **il titolo è quello che si legge**. Su questo avevi
ragione.

**La definizione, adesso scritta** in `src/lib/calcoli/larghezza.js`:

> **Sbordo di una schermata = quanto contenuto non ci sta, OVUNQUE si trovi.**
> Il massimo fra (a) quanto la pagina eccede la finestra e (b) per ogni
> riquadro che sa scorrere di suo, quanto il suo contenuto eccede lo spazio
> che ha.

🔴 **E la distinzione NON è «riquadro fatto apposta» contro «riquadro che
sborda»**: alla larghezza di un telefono quella distinzione non esiste. È:
un riquadro che **non scorre** è una **rete** — sta lì perché una parola
lunghissima non rompa la pagina — e non conta; un riquadro che **scorre** è
un **difetto**, e conta esattamente quanto scorre. La decisione del 21/08
dice «mai scorrimento laterale» e la cura del 25/08 è «blocchetti sul
telefono, tabella sul computer»: a 375 punti non c'è nessun caso in cui
scorrere di lato sia voluto.

✅ **Il metro riprovato su quattro casi di risposta nota, e uno lo fa
fallire:**

| schermata | il mio metro | il metro «ingenuo» | atteso |
|---|---|---|---|
| `/fiscale/andamento` | **377** | **0** | 377 il 29/08 |
| `/ricettario/menu` | **0** | 0 | 0 |
| `/fiscale/deducibilita` | 280 | **0** | 247 il 29/08 |
| `/agricolo` | 251 | **0** | 231 il 29/08 |

Il metro ingenuo dice **zero su tutti e quattro**: è il caso che lo fa
fallire, ed è lo stesso errore del 29/08. ⚠️ Deducibilità e Agricolo sono
cresciuti perché sono cresciuti **i dati** del progetto di prova, non il
codice.

### 3b — Il censimento: nove, non quindici

**71 schermate aperte a 375 punti, 9 larghe** (erano 15 il 29/08), e in tutte
e nove lo sbordo **della pagina** è zero.

| | schermata |
|---|---|
| **457** | `/fiscale/previsioni/nuova` ← la più larga, e il 29/08 era «non misurata» |
| 377 | `/fiscale/andamento` |
| 280 | `/fiscale/deducibilita` |
| 251 | `/agricolo` |
| 170 | `/fiscale/deduzioni` |
| 58 | `/cassa/previsione` |
| 58 | `/cassa/prima-nota` |
| 8 | `/editor-menu/bevande` |
| 7 | `/personale/mance` |

⚠️ **Sette sono sparite dall'elenco del 29/08, e non tutte perché curate.**
Il Magazzino lo è davvero. Tracciabilità, Clienti, Fornitori, Scontrinato,
Personale e Cassa/Personale misurano zero **anche perché sul progetto di
prova quelle tabelle hanno meno righe di allora**: una tabella corta non
sborda. *Uno zero misurato su dati magri non è una cura.*

🔴 **E il setaccio del 29/08 ha un punto cieco, misurato**: `/personale/mance`
sborda di 7 punti e **non contiene nessuna `<table>`** — quella rete non la
vede e non la vedrà mai.

### 3c — La carta dei vini, misura finale

A 375 punti e a tre densità (37,8 · 59,5 · 64), col metro provato su due casi
di risposta nota:

| | monitor | 59,5 | 64 |
|---|---|---|---|
| sbordo | **8** | **33** | **53** |
| bersagli sotto 8,50 mm | **0** | **0** | **0** |
| testi sotto 3,20 mm | 1 | 1 | 3 |

Lo sbordo è tutto **dentro il riquadro** (pagina zero) ed è il debito già
dichiarato dal 29/08 a 8 punti; misurato stanotte, **la mia aggiunta lo
lascia identico**. I testi sotto soglia sono il **«?» della didascalia**
(2,40 mm, componente condiviso, preesistente) e a densità 64 i due titoli di
sezione (3,13 mm, misura fissa in punti, preesistente).

---

## Blocco 4 — Le frasi diventate false

🔴 **Il telaio, contato prima di correggere.** Nei documenti **vivi** — quelli
che dichiarano cosa vale adesso — le frasi che dicono cosa c'è o non c'è in
produzione sono **22**, di cui **12 senza la data accanto**. Di quelle,
**sei** dicevano «non ancora in produzione» di una migrazione che invece
c'era: **sei su sei false**, controllate una per una sul database vero. Una
era la tua 4b; **le altre cinque stavano in `CODA_E_DECISIONI.md` e nessuno
le aveva viste.**

🔴 **E il primo setaccio mentiva: contava 602.** Il gonfiore erano le **369**
righe «non è stato verificato» delle riletture — che parlano di un **atto
passato** e devono restare — e le frasi dei riepiloghi. **La distinzione che
rende il conto onesto è fra documento VIVO e riepilogo**: un riepilogo ha la
data nel nome del file, quindi le sue frasi sono una fotografia **per
costruzione**, e «aspetta il push» scritto il 18/08 è un fatto del 18/08.

**4a** — la frase del Magazzino diceva «le bevande non compaiono: il magazzino
non le segue», falsa da stamattina. **Il taglio resta** (decisione del 23/08,
non toccata): cambia la ragione, che adesso è quella vera — *una riga da bere
non è un buco del magazzino*.

**4c** — non toccata, come chiedevi. È la domanda 4.

**4d** — la regola è scritta in `DECISIONI.md`, e la famiglia più affilata è
una **rete**: `tests/app/frasi-sullo-stato.test.js` chiede al database se una
migrazione detta «non ancora in produzione» c'è davvero. Provata rimettendo
la frase falsa: diventa rossa, e torna verde togliendola. ⚠️ **Il limite è
dichiarato**: copre solo le frasi che nominano una migrazione — «zero
prodotti», «nessun conto» non hanno un nome da confrontare.

---

## Blocco 5 — Le quattro schermate del telefono

**5a — il riquadro «cosa non è sceso», tre punti.**
1. Diceva **quanto** manca e non **su quanto**. Il numero c'era già —
   registrato da tutti e due i punti che scaricano — e **non usciva dal
   database**: la funzione che alimenta la schermata non lo restituiva.
   *Un dato registrato che nessuna schermata può leggere è, per chi usa il
   gestionale, un dato che non esiste.*
2. e 3. **Il telaio, contato prima di correggere**: **dieci punti in sei
   file** stampavano una quantità grezza accanto a un'unità, col punto
   inglese. E la radice era `formatQta`, che tronca a due decimali —
   **0,0002 kg sarebbe diventato «0»**, ed è per questo che quei dieci la
   scavalcavano. Adesso `formatQta` non scrive mai «0» per un numero diverso
   da zero, e un formattatore nuovo porta i chili in grammi e i litri in
   millilitri sotto l'unità intera.

**Visto a schermo**: «mancano **309 g**», «mancano **0,2 g su 1,5 kg**», e la
riga vecchia senza paragone **tace** invece di inventarlo.

**5b — i prodotti si aprono al tocco.** Il componente lo sapeva già fare dal
29/08; questa schermata non gliela passava. **Provato toccando**: il riquadro
passa da **152 a 296 punti** col modulo dentro. Il pulsante «Scarico» resta —
fa la stessa identica cosa, ed è il segno visibile che quel riquadro si apre.

**5c — NON diagnosticata, e non fingo.** Non posso fotografare il tuo
telefono. Misurato: l'app si apre **a tutto schermo** sull'iPhone ma con la
striscia di sistema **opaca**, e in quella modalità il contenuto **non può**
finire sotto l'orologio — il che punta a Safari o a un semplice scorrimento,
non a un margine mancante. 🔴 **Avevo cominciato a costruire la cura e mi sono
fermato**: era una cura per una diagnosi non fatta, cioè esattamente quello
che il blocco 7 mi diceva di non fare. È la domanda 3.
⚠️ **E la misura ha trovato una cosa vera per strada**: il margine di
sicurezza in fondo della barra del pollice è **inerte** — senza
`viewport-fit=cover` quel valore è sempre zero, e lo è sempre stato.

**5d — il blocco del totale**: a sinistra sul telefono, a destra sul computer.
Verificato nei due versi, **375 → `left`** e **1280 → `right`**.

**Magazzino rimisurato** a 375 e a tre densità: **sbordo zero, zero bersagli
sotto 8,50 mm, zero testi sotto 3,20 mm.**

---

## Blocco 6 — La proposta dell'abbinamento

Il gestionale **propone** quale prodotto comprato corrisponde a una voce della
carta, e nella proposta si vedono **produttore, annata e formato**.
**Propone e basta**: la funzione non scrive una riga, e il collegamento nasce
solo quando lo tocchi tu.

🔴 **Una cosa da dire: l'annata non ha una colonna.** È la decisione di
stamattina — *l'annata è una confezione, non una riga nuova* — quindi vive
**dentro la descrizione della confezione**. La proposta mostra la descrizione
per intero, che è il posto dove l'annata si legge, e il gestionale **non
prova a estrarla**.

🔴 **E poi l'ho guardata, e non andava.** Misurato: su «Nero d'Avola»
uscivano **12 proposte e 10 poggiavano su una parola sola** — «nero», che sta
in 5 prodotti. Su «Etna Rosso» erano **8 su 8**, tutte per «rosso». ⚠️ E il
commento che avevo scritto un'ora prima diceva già cosa sarebbe successo:
*«una proposta a caso si accetta guardando di sfuggita, e da lì in poi il
magazzino scarica il vino sbagliato senza che nessun errore lo dica»*. **La
regola c'era, il filtro no.**

**La regola nuova, e non è una soglia inventata**: una proposta ha bisogno o
di **quantità** (due parole in comune) o di **specificità** (una parola che
appartiene a **un prodotto solo**). «Zibibbo» identifica, «nero» no. Non c'è
nessun numero da tarare: è una proprietà dei dati, e resta vera con mille
prodotti.

🔴 **E il controllo che doveva proteggerla NON DISCRIMINAVA.** Rompendo la
regola nel modo che quel controllo esiste per prendere, la verifica restava
**verde**: l'esempio conteneva per caso proprio la parola rara che doveva
escludere. È la trappola del 27/08 — *un esempio costruito prova solo i casi
che gli hai messo dentro*. Rifatto (`…011`) con tre prodotti che condividono
due parole comuni e **nessuna rara**, che è l'unico caso in cui le due
risposte si separano. Adesso fallisce nei due versi, con due messaggi diversi.

**Visto a schermo**: «Zibibbo secco → Uva zibibbo», «Passito di Pantelleria →
Passito di Pantelleria», e la voce di prova con **«Feudo Arancio · 0,75 l ·
ZZ Nero d'Avola 2022 Feudo Arancio»**.

---

## Blocco 7 — La ricarica al ritorno: diagnosi chiusa

**Non è il telefono e non è l'app: è il server di sviluppo del gestionale di
prova.** Misurato in quattro passi, l'ultimo facendolo:

1. Il gestionale **non si ricarica da solo**: l'unico `location.reload()` del
   codice è un pulsante che si preme a mano. **Nessun service worker.**
2. Il pacchetto **pubblicato** non contiene il client del server di sviluppo:
   **zero** riferimenti in `dist/index.html` e **zero** nel codice compilato.
3. Quel client — che c'è **solo** sul gestionale di prova — contiene **tre**
   `location.reload()` e la frase «server connection lost. Polling for
   restart...».
4. 🔴 **La catena provata facendola**: ho spento il server, la console ha
   scritto **quella frase esatta**; l'ho riacceso, e la pagina **si è
   ricaricata da sola** — 19 secondi dopo, con l'istante di caricamento
   spostato e quello che avevo lasciato in memoria sparito.

**Previsione controllabile in dieci secondi: su borgo58.it non succede**,
perché quel client lì non c'è.

**Nessuna cura costruita, ed è voluto.** Spegnere il ricaricamento automatico
del server di sviluppo si può, ma costa la ricarica al volo mentre lavoro: è
un compromesso tuo, non mio. È la domanda 2.

⚠️ **Quello che non ho osservato**: che sia il **telefono** a far cadere il
collegamento quando la pagina va in secondo piano. È il comportamento
normale di iOS, ma non l'ho visto io — ho riprodotto il meccanismo dopo quel
passo, non quel passo.

**X1 non è stata riaperta.**

---

## Cosa abbiamo rovesciato

**Niente.** Nessuna decisione in vigore di `DECISIONI.md` è stata
contraddetta. La 4c — «il vino non compare nell'elenco degli scarichi
mancati» — è stata **lasciata intatta** come chiedevi, ed è la domanda 4.

**Voci di `DECISIONI.md` toccate** (aggiunte, non rovesciate):
* **nuova** — «Una verifica non spegne mai il registro delle cancellazioni»
  (blocco 2a).
* **nuova, sezione intera** — «Le frasi che dichiarano uno stato» (blocco 4d).
* **corretta** — la riga «Migrazione `20260828000008` — non ancora in
  produzione», che era falsa.

**Voci di `RICHIESTE.md` toccate**: N4 (chiusa per la parte fatta), T1
(chiusa), N3/N5/N7 (stato normalizzato, il dettaglio spostato dopo il «·»),
X1 (tabella allineata alle altre), **nuove**: N9, N10, G1-G8.

---

## Rilettura

**Cosa NON ho verificato con gli occhi**
* **Il tuo telefono**, in nessun punto: in questo ambiente lo screenshot non
  funziona. Tutto ciò che è «visto» è **letto dal DOM** di un browser sul
  computer, con la finestra portata a 375 punti.
* **La schermata delle Fatture a 1280** l'ho misurata (`right`), non guardata.
* **Il riquadro del tavolo** col nome piccolo (lavoro di stanotte): mai
  aperto.
* **Nessuna migrazione di stasera è in produzione**: le quattro sono provate
  solo sul progetto di prova.

**Cosa ho contato senza leggerlo**
* Le **369** righe «non è stato verificato» del blocco 4: contate dal
  setaccio, non lette una per una. Ne ho lette una manciata per capire la
  famiglia.
* Le **23 migrazioni** che spengono il registro: ho letto i nomi dei file e
  contato le occorrenze, non ho letto tutti e 23 i blocchi di verifica.
* Le **17 richieste che «aspettano»**: la classificazione l'ho fatta leggendo
  ogni riga, ma la ragione dell'attesa è la mia lettura, non una tua conferma.

**Quali mie affermazioni sono diventate false mentre lavoravo**
* 🔴 **«Almeno sette aspettano qualcun altro»**, scritto stanotte nel
  riepilogo del blocco 4. Misurato adesso: **17**. Era un pavimento
  presentato come una stima.
* 🔴 **«La proposta trova il prodotto giusto»** — vero, ma incompleto per
  un'ora: trovava anche cinque prodotti che non c'entravano. Corretto nella
  stessa sessione, e il difetto è raccontato invece che nascosto.
* Il riepilogo di stanotte diceva **«nessuna migrazione applicata»**: era già
  stato corretto stamattina, ed è il caso che ha prodotto la regola 4d.

**Quali blocchi non ho aperto**
* **Nessuno.** Tutti e sette.

**Quali conteggi sono pavimenti e non censimenti**
* **Le 22 frasi che dichiarano uno stato**: sono quelle che il mio setaccio
  riconosce, in sei documenti vivi. Una frase che dice la stessa cosa con
  altre parole non ci finisce.
* **Le 63 richieste**: sono quelle che si sono potute trovare **scritte**.
* **Le 9 schermate larghe**: sono le **71 rotte senza parametri**. Le
  schermate che si aprono solo con qualcosa dentro (una ricetta, una fattura,
  un preventivo) non sono state aperte — e infatti `larghezza.js` ne dichiara
  sei come «non misurate a schermo».
* **I 10 punti che stampavano una quantità grezza**: quelli che il setaccio
  riconosce come «numero seguito da un'unità». Un numero grezzo scritto in
  un'altra forma non c'è.

**Cosa ho lasciato sul progetto di prova**
* **Niente.** Ho costruito e tolto: una riga di anomalia (per vedere «su
  quanto»), un prodotto + un articolo + una voce di carta (per vedere la
  proposta), una voce di carta collegata e poi scollegata. Misurato dopo:
  **zero** righe `ZZ`, **zero** voci di carta collegate, **zero** anomalie in
  più (3 come prima), **lapidi 10475 prima e 10475 dopo**, **zero trigger
  spenti**.
* **I due documenti vuoti che tieni come caso di prova non sono stati
  toccati.**
* **Nessun server acceso**: il mio era sulla porta 5188 e l'ho spento
  (verificato: non risponde). La 5199 non l'ho mai aperta. **Il tuo sulla
  5173 risponde e non l'ho toccato.**

---

```bash
git -C "C:\Users\User\Desktop\Claude code\Borgo58-App" push
```
