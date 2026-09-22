# La resa al posto dello scarto standard — R12, 22/09/2026

> **Proposta**: R12 → `slave`, **aperta**, non unita.
> **Migrazione**: `20260922000001_la_resa_sulla_riga_di_ricetta.sql` —
> 🔴 **NON applicata da nessuna parte**, né sulla produzione né sul progetto
> di prova. È una condizione del mandato, non una dimenticanza.
> **Stato di R12 in [`RICHIESTE.md`](../RICHIESTE.md)**: `in corso · PR aperta,
> migrazione NON applicata da nessuna parte`.

---

## 0 · Il difetto che chiude

La decisione è di **Alessio, il 14/08/2026** (Blocco 5 del mandato cumulativo),
e la motivazione è tutta nel merito: **lo scarto non è una proprietà
dell'ingrediente, è una proprietà della coppia ingrediente × ricetta.**

> Le stesse cozze scartano pochissimo per un'impepata e moltissimo se se ne
> ricava il mollusco.

Un numero unico sulla scheda del prodotto **non descrive nessuno dei due casi**
— e non tace: ne **precompila uno sbagliato**, che entra nel costo di ogni
piatto che usa quell'ingrediente. È la forma di difetto che questo progetto
insegue da mesi: non un errore che grida, un numero plausibile.

E si scrive **in lordo → netto**, non in percentuale: *«1,5 kg di cozze danno
400 g»* è come ragiona un cuoco ed è leggibile fra sei mesi. La percentuale si
**mostra**, non si scrive.

---

## 0-bis · 🔴 La decisione di Alessio, e la proposta che NON ha confermato

**La prima stesura di questa consegna toglieva il campo «% scarto standard»
dalla scheda del prodotto.** Era un rovesciamento di una sua decisione del
**25/08** — *«il campo RESTA: serve per l'ingrediente che va solo pulito,
senza una preparazione da cui ricavare la resa»* — fatto dentro un commento
di migrazione, con la ragione scritta bene.

**Posta a lui, non è stata confermata.** ⚠️ *Un rovesciamento ben
argomentato resta un rovesciamento, e va posto a chi ha preso la decisione
invece che eseguito.*

### La decisione, del 22/09

> Il valore standard del prodotto **resta**, **facoltativo**, e serve
> **soltanto a precompilare una volta** lordo e netto quando **nasce** una
> riga di ricetta. Dopo la creazione la riga è **autonoma e autorevole**:
> nessuna eredità viva dal prodotto. Si rappresenta come **resa
> comprensibile**, il limite artificiale sotto 100 se ne va, i food cost
> esistenti restano invariati.

### 🔴 «Precompila una volta» e «eredita per sempre» non sono la stessa cosa

Ed è qui che stava il difetto vero, che nessuno aveva nominato. **Fino a
oggi quel numero non precompilava niente**: si sostituiva al volo a ogni
calcolo, con `coalesce(riga.waste_percentage, prodotto.default, 0)` in
**cinque** punti.

**Conseguenza misurabile**: cambiando lo scarto sulla scheda di un prodotto
**si spostava il food cost di ogni ricetta che lo usa** — comprese quelle
scritte mesi prima da chi quel numero non l'aveva scelto. E nessun errore lo
diceva, perché il numero nuovo è plausibile quanto il vecchio.

⚠️ *Un valore che continua a valere per righe già scritte non è un valore
standard: è una decisione presa al posto di chi le ha scritte.*

**La garanzia non è una promessa, è un vincolo:**

1. la sanatoria **materializza** su ogni riga lo scarto che quella riga
   aveva davvero in quel momento — suo, o ereditato;
2. `recipe_ingredients.waste_percentage` diventa **`not null`**, quindi il
   secondo argomento di quei `coalesce` **non è più raggiungibile da nessuna
   riga**, presente o futura;
3. e i **cinque** punti che lo nominavano sono **riscritti dal loro corpo
   vivo** — perché *un `coalesce` morto che sembra vivo è la cosa che
   qualcuno riaccende fra tre mesi credendo di riparare qualcosa.*

⚠️ **E la ragione del 13/08 è servita intera**: la riga senza scarto non
resta scoperta. Cambia **quando** il numero arriva, non **se**.

⚠️ **Il prezzo, dichiarato**: correggere lo scarto standard di un prodotto
non sistema più da sé le ricette già scritte. Si paga volentieri, perché il
verso opposto — sistemarle tutte in silenzio — è il difetto.

### La verifica che lo dimostra, e non lo afferma

Dentro la migrazione: si scrive il sugo (1,5 → 0,4 kg, scarto 275%), poi si
porta lo scarto standard del prodotto a **900**, e si pretende che **non si
muova niente** — lo scarto della riga, il food cost della ricetta, **e il
fabbisogno di magazzino**, che legge lo stesso numero da un'altra strada.
⚠️ *Due letture che si comportassero diversamente sarebbero la forma
peggiore, perché ognuna delle due sembra plausibile.*

---
## 1 · Il censimento — dove viveva lo scarto, misurato

Letto dai **corpi vivi** del progetto di prova e dal repository, non
ricordato:

| dove | cosa c'era | dopo R12 |
|---|---|---|
| `ingredients.waste_percentage_default` | lo scarto «standard», che si **sostituiva al volo** in ogni calcolo | resta, **facoltativo**, e **precompila una volta** (§7) |
| `recipe_ingredients.waste_percentage` | quasi sempre vuota; il `coalesce` andava a pescare il default | **riflesso `not null`**, scritto solo dal trigger |
| `recipe_ingredients.quantita_lorda` | non esisteva | **è il dato**, insieme a `quantity` |
| i punti che **ereditavano** dal prodotto | **cinque**: `fabbisogno_conto`, `fabbisogno_preparazione`, `simula_prezzo_ingrediente`, `v_recipe_row_costs`, `recipe_ingredients_display` | **zero**: tutti riscritti dal corpo vivo |
| il codice dell'app (`src/`) | `waste_percentage` di riga | **0 occorrenze** |
| le migrazioni | **12 file** moltiplicano per «1 + scarto/100»; **0** dividono per «1 − scarto/100» | invariato: la formula non cambia |

⚠️ **La formula NON è stata toccata.** I cinque continuano a fare
esattamente quello che facevano: cambia **da dove viene il numero** che
moltiplicano, non l'aritmetica. È la ragione per cui il food cost può
restare identico al millesimo (§3).

⚠️ **E i cinque sono stati presi dal corpo vivo con un programma che
FALLISCE se non trova l'àncora**, non ricopiati a mano: fra la migrazione
che ha creato una funzione e il suo corpo di oggi ci stanno tutte le
migrazioni che l'hanno toccata nel mezzo (regola del 18/08).

---
## 2 · 🔴 Una frase del 24/08 era nata falsa, ed era ESIBITA

Misurata leggendo `20260824000010_i_limiti_del_magazzino.sql:66`, verbatim:

> *«Lo scarto e' una percentuale in PUNTI (35 = 35%) e sta sotto 100: **il
> lordo si ricava dividendo per (1 - scarto/100)**, quindi a 100 e' una
> divisione per zero e sopra 100 il fabbisogno diventa negativo.»*

**Nessun calcolo di questo progetto ha mai fatto quella divisione.** Misurato:
12 posti moltiplicano, zero dividono. La frase non è invecchiata — **è nata
descrivendo una cosa che non c'era**, come il commento sulle colonne inesistenti
del 27/08.

🔴 **E il prezzo non era teorico: quel commento è il RIFIUTO che l'utente
legge.** Dal 24/08 `spiega_vincolo()` prende la frase italiana dal
`comment on constraint`: chi avesse scritto 120 avrebbe ricevuto una
spiegazione **sbagliata** su come funziona il suo gestionale, e ci avrebbe
ragionato sopra.

⚠️ **E la conseguenza pratica del limite scritto male era grossa**: sotto la
regola vera, uno scarto del **275%** è normalissimo (1,5 kg → 400 g), mentre il
vincolo lo vietava a 100. Era un limite che **rifiutava anche i casi buoni** —
e sulla riga di ricetta, dove il numero adesso vive, quel tetto non c'è: la
regola è *il netto non supera il lordo*, che è la cosa vera.

Corretta in §7 della migrazione, **dicendo che era sbagliata** invece di
riscriverla in silenzio.

---

## 3 · 🔴 Il food cost NON si sposta di un millesimo, e come lo si dimostra

È il rischio vero di questo blocco: le ricette esistenti hanno già un food cost,
e una sanatoria che sbaglia di un decimale lo **sposta nella notte, in silenzio**
— esattamente ciò che il mandato del 14/08 vietava («il food cost dei piatti già
inseriti cambierebbe da solo»).

**La dimostrazione non è un ragionamento, è un confronto:**

1. **Prima di toccare qualunque cosa**, la migrazione fotografa il food cost di
   ogni ricetta in una tabella temporanea, costruita `as select … from
   v_recipe_costs` — non dichiarata vuota;
2. alla fine riconfronta riga per riga e **solleva** se una sola ricetta
   differisce, **dichiarando quante ne ha confrontate** (uno zero sarebbe un
   verde che non ha guardato niente);
3. poi butta la tabella.

🔴 **E l'ORDINE dei passi è ciò che rende vera la promessa, non un dettaglio di
stile.** Creare il trigger del riflesso **prima** della sanatoria lo farebbe
scattare sull'`UPDATE` della sanatoria stessa: riscriverebbe `waste_percentage`
ricavandolo dal lordo **già arrotondato a 4 decimali**, e il food cost si
sposterebbe di un millesimo. Quindi: sanatoria → vincolo → **e solo allora** il
trigger.

⚠️ **E la sanatoria si sorveglia da sola**: dopo aver scritto i due numeri
controlla che il giro d'andata e ritorno sia **esatto** — se
`scarto_della_riga(lordo, netto)` non ridà lo scarto di partenza, **si ferma** e
nomina fino a 10 righe. Non «avvisa»: si ferma.

---

## 4 · La forma: due numeri si scrivono, la percentuale è un riflesso

* **`quantity`** = quanto ne resta, netto, nel piatto. **`quantita_lorda`** =
  quanto ne prendi dalla cella.
* **`waste_percentage` diventa un riflesso**: lo scrive **solo** il trigger
  `trg_riflette_lo_scarto`, la definizione vive in **una** funzione
  (`scarto_della_riga`), e scriverlo a mano **viene rifiutato** con una frase
  che dice cosa fare al suo posto.
* ⚠️ **Il trigger è `before insert or update` SENZA `of quantita_lorda`**, ed è
  la trappola del **27/08**: `update of colonna` guarda **ciò che è stato
  nominato**, non ciò che è cambiato — con il filtro, cambiare solo `quantity`
  non avrebbe ricalcolato niente e la riga avrebbe portato uno scarto vecchio.
* **Il vincolo `riga_lordo_e_netto_coerenti`** (`quantity > 0` e
  `quantita_lorda >= quantity`) è un `check`, non un controllo di schermata: *da
  un chilo di cozze non escono due chili di mollusco*, e chi scrive da un'altra
  porta deve sentirselo dire lo stesso. Con la sua frase in italiano.

⚠️ **E il rifiuto nomina il caso che sembra un'eccezione e non lo è**: il riso
che assorbe l'acqua **cresce** cuocendo — ma quella non è una resa, è la
quantità della ricetta. Detto nel messaggio, perché è la prima obiezione che
viene in mente.

---

## 5 · Le due percentuali sono DUE, e vanno tenute distinte

È la confusione che ha prodotto la frase falsa del 24/08:

- lo **SCARTO** = (lordo ÷ netto − 1) × 100 → 1,5 su 0,4 fa **275**
- la **RESA** = (netto ÷ lordo) × 100 → 1,5 su 0,4 fa **26,7**

Lo **scarto** è quello che il costo usa da sempre e vive nel database come
riflesso. La **resa** è quella che si **mostra**, perché *«da un chilo e mezzo
ne esce il ventisette per cento»* si capisce e *«lo scarto è il
duecentosettantacinque per cento»* no.

⚠️ **Nell'elenco delle righe si legge la resa, mai lo scarto**: «1.5 kg → 0.4 kg
netti (26.7%)». Il 275% non compare da nessuna parte a schermo.

---

## 6 · Vuoto non è zero — e qui è una risposta vera

Chi **non scrive il lordo** non sta dichiarando uno scarto: sta dicendo che non
ce n'è. Il database riempie `quantita_lorda` col netto, lo scarto risulta **0**,
e a schermo la riga si legge come una quantità e basta — **senza freccia e senza
percentuale**, perché una resa del 100% scritta accanto a ogni riga sarebbe
arredamento.

⚠️ **Ma la funzione che calcola la resa torna vuoto**, non zero, quando non si
può dire: uno zero lì si leggerebbe *«non ne resta niente»*.

---

## 7 · Il campo resta, e si scrive come una resa

Sulla scheda del prodotto non c'è più «% scarto standard»: c'è **«Resa
standard (facoltativa)»**, e si legge «da 1 kg ne restano 300 g — resa 30%».

⚠️ **Sotto resta uno scarto.** Il database conserva `waste_percentage_default`
in punti di scarto, perché è la forma che i cinque calcoli usano da sempre;
cambiarla vorrebbe dire toccarli tutti per un guadagno che è di **lettura**.
La conversione vive in **un posto solo** (`src/lib/calcoli/resa.js`), e una
prova pura controlla il **giro d'andata e ritorno**: quello che si scrive si
rilegge identico. Senza, una delle due conversioni potrebbe cambiare e
l'altra no — e il numero salvato sarebbe diverso da quello mostrato, senza
nessun errore.

⚠️ **E il campo nasce VUOTO, non a zero.** Vuoto vuol dire che per quel
prodotto non lo sa ancora nessuno; zero vorrebbe dire «non si butta
niente», che è una risposta. Una prova di schermata controlla che il vuoto
**arrivi al salvataggio come vuoto** — è la lezione del 16/08 pagata col
mezzo di pagamento delle mance: il campo si vedeva, si sceglieva, e al
database non arrivava mai.

### 🔴 Il limite «sotto 100» se n'è andato

Non era una prudenza: era la **conseguenza della frase falsa** del §2. Con
la formula vera uno scarto del **275%** è la realtà di un sugo di cozze, e
quel vincolo lo **rifiutava**. Era un limite che **rifiutava anche i casi
buoni**, che è il difetto peggiore dei due (regola del 24/08).

Al suo posto resta la sola cosa vera: **non può essere negativo**. Il nome
cambia con la regola — `ingredients_scarto_standard_sensato` — perché
lasciare «sotto_cento» su un vincolo che non guarda più il cento sarebbe una
frase falsa scritta nel posto che il gestionale mostra all'utente quando
rifiuta. Provato nei due versi dentro la migrazione: 275 passa, −1 viene
respinto.

---
## 8 · La schermata

**Nella riga di ricetta** ci sono **due campi**: «quanto ne prendi» (lordo) e
«quanto ne resta» (netto). Il campo dello **scarto è sparito**, e la resa si
vede mentre si scrive: «da 1.5 ne restano 0.4 — resa 26.7%».

* ⚠️ **Il rifiuto sta dove sta il dubbio**, sotto i due campi, e il pulsante
  è **spento con la ragione accanto** — non premibile per essere respinto
  (regola del 17/08).
* 🔴 **Scegliendo il prodotto, il lordo si riempie da sé** dalla resa
  standard — ed è il gesto che la decisione del 22/09 chiedeva.
* 🔴 **E il numero proposto DICE di essere proposto.** Un numero
  precompilato e basta somiglia in tutto a un numero digitato da qualcuno:
  è la forma di difetto che questo progetto insegue — non un errore che
  grida, un numero plausibile.
* 🔴 **Appena si scrive il lordo, la proposta si ferma.** È quello che
  separa «precompila» da «eredita»: cambiando il netto dopo, il numero
  scritto a mano **non viene sovrascritto**. *Una proposta che butta via una
  scelta non è una proposta.*
* ⚠️ **`duplica_ricetta` porta i due numeri**, non lo scarto: riscritta dal
  corpo vivo. Copiare `waste_percentage` verrebbe adesso **rifiutato dal
  riflesso**, quindi duplicare una ricetta si sarebbe rotto al primo
  tentativo.
* ⚠️ **`recipe_ingredients_display`** riscritta dal corpo vivo, con le
  colonne nuove **aggiunte in fondo** (`ERROR 42P16`).

---
## 9 · Prove — e le quindici rotture

**59 prove nuove**: 48 pure (`tests/unita/resa.test.js`) + 11 di schermata
(`tests/schermate/resa-ricetta.test.jsx` e `resa-standard-prodotto.test.jsx`).
Suite intera verde: **lint pulito**, **1723 prove pure**, **355 di
schermata**, **build**.

Dentro la migrazione, **11 gruppi di controlli** in una sotto-transazione
annullata (con `foto_righe()` e `pretendi_nessun_residuo()`): lo stesso
ingrediente con **due rese diverse in due ricette**, lordo uguale al netto,
netto maggiore del lordo respinto, zero e negativi respinti, chi non dice il
lordo, lo scarto scritto a mano respinto, i numeri che cambiano e lo scarto
che si sposta da sé, la copia di una ricetta, il food cost che legge il
lordo, **il numero del prodotto che non muove una riga già scritta** (da due
strade diverse), e **sopra 100 accettato / sotto zero respinto**.

**Le quindici rotture volontarie, tutte discriminanti.** Le nove del primo
giro: il trigger creato prima della sanatoria · la fotografia del food cost
che nasce vuota · il filtro `of quantita_lorda` rimesso · la copia che torna
a portare lo scarto · la resa scambiata con lo scarto · il netto maggiore
del lordo ammesso · il vuoto che torna a valere zero · la schermata che
manda lo scarto · il campo del lordo tolto.

E le **sei del giro nuovo**, che guardano la decisione del 22/09: il vuoto
dello standard che torna a valere zero · la resa mandata al posto dello
scarto · la proposta che torna a sovrascrivere quello che uno ha scritto ·
il `not null` tolto · l'eredità rimessa in uno dei cinque · il limite «sotto
100» rimesso.

🔴 **Due non mordevano, e sono due buchi veri chiusi:**
1. la rottura «ordine» era un **inserimento di commento**, cioè non rompeva
   niente — rifatta perché inserisse davvero un `create trigger` prima della
   sanatoria;
2. la prova della **fotografia** controllava solo che la frase esistesse:
   svuotando la tabella temporanea restava **verde**. Ora pretende che la
   tabella nasca `as select … from v_recipe_costs`.

⚠️ **Ogni rottura FALLISCE se non trova la sua àncora** — una rottura non
avvenuta è indistinguibile da una prova che non discrimina.

⚠️ **E un controllo ha dovuto essere ristretto due volte**: quello che
pretende che nessuno dei cinque nomini più il default guardava prima tutto
il file (dove il default c'è, e **deve** esserci: lo nominano la sanatoria e
il vincolo), poi il pezzo fino a fine file — che si portava dentro la
verifica. *Un perimetro più largo del vero è un falso allarme che si impara
a spegnere.*

---
## 10 · Cosa abbiamo rovesciato

Uno, registrato come **n. 95** in
[`decisioni_rovesciate.md`](../decisioni_rovesciate.md): *«lo scarto del
prodotto vale per ogni riga, a ogni calcolo»* — il modo in cui il campo era
stato costruito il **13/08**, cioè una sostituzione al volo dentro il
calcolo invece di una precompilazione.

⚠️ **E uno NON rovesciato, scritto lì dentro perché non si perda**: la
decisione di Alessio del **25/08** («il campo RESTA») è **confermata**. La
prima stesura la rovesciava; posta a lui, non è passata.

---
## 11 · Cosa NON è stato verificato

1. 🔴 **La migrazione non è mai stata eseguita**, da nessuna parte — è una
   condizione del mandato. Quindi gli **11 gruppi di controlli** sono
   **scritti e mai girati**, il confronto del food cost prima/dopo **non ha
   mai guardato nessuna ricetta vera**, e il controllo che dimostra che il
   numero del prodotto non muove una riga già scritta — cioè il cuore della
   decisione del 22/09 — **non è mai scattato**. È la cosa più importante di
   questo elenco.
2. 🔴 **E i cinque oggetti riscritti non sono mai stati creati.** Sono stati
   presi dal corpo vivo e modificati da un programma, ma **nessuno li ha
   mai ricreati in un database**: *«un corpo che si crea non è un corpo che
   funziona»* (17/08), e qui non si è fatto nemmeno il primo dei due. Se
   uno di loro non compilasse, si scoprirebbe applicando.
3. ⚠️ **La sanatoria non ha mai toccato una riga.** In produzione ci sono
   **14 ricette con 0 righe di ingrediente** (§12 di `CLAUDE.md`, misura del
   04/09), quindi l'unico posto dove ha qualcosa da fare è il progetto di
   prova, e nemmeno lì è stata provata. ⚠️ *Il caso da provare è quello che
   ha qualcosa da fare* (17/08): questo resta **scoperto**.
4. ⚠️ **Nessun occhio ha guardato la schermata.** Le prove di schermata
   misurano il DOM; **se i due campi stiano comodi sul telefono, se la riga
   «Proposto dalla resa standard» si noti davvero, e se «resa 26.7%» si
   legga con le mani occupate, resta un giudizio di Alessio.**
5. ⚠️ **Nessuna misura di larghezza a 390 punti**, né sulla riga di ricetta
   né sul campo nuovo della scheda prodotto: dedotto, non misurato.
6. ⚠️ **La lista della spesa non è stata toccata né riprovata.**
   `lordoDaComprare()` esiste ed è provata pura, ma **nessuna schermata la
   chiama ancora**: quanto ordinare continua a leggersi come prima.
7. ⚠️ **Il conteggio «12 file moltiplicano, 0 dividono»** è misurato sulle
   migrazioni del repository; quello dei **cinque punti che ereditavano** è
   misurato sui corpi vivi del **progetto di prova**, non della produzione.

---
## 12 · Cosa resta da fare

* **Applicare la migrazione sul progetto di prova** e guardare cosa fa la
  sanatoria su righe vere — è il passo che chiude i punti 1, 2 e 3 di §11.
* **La lista della spesa**: far leggere a chi ordina il lordo della riga
  (`lordoDaComprare`) invece della vecchia resa dichiarata.
* ⚠️ **Dove c'è una produzione registrata, la resa misurata dovrebbe vincere
  su quella dichiarata** — è nel mandato del 14/08 e **non è in questo
  blocco**.
* ⚠️ **Guardare le due schermate a 390 punti**, con gli occhi e col righello.

---
## 13 · File toccati

| file | cosa |
|---|---|
| `supabase/migrations/20260922000001_la_resa_sulla_riga_di_ricetta.sql` | **nuova**, non applicata |
| `src/lib/calcoli/resa.js` | **nuovo** — la regola e le due conversioni in un posto solo |
| `src/pages/ricettario/RicettaDetail.jsx` | i due campi, la resa, il rifiuto, la precompilazione, l'elenco |
| `src/pages/ricettario/IngredienteForm.jsx` | «% scarto standard» → **«Resa standard (facoltativa)»** |
| `tests/unita/resa.test.js` | **nuovo** — 48 |
| `tests/schermate/resa-ricetta.test.jsx` | **nuovo** — 11 |
| `tests/schermate/resa-standard-prodotto.test.jsx` | **nuovo** — 6 |
| `docs/RICHIESTE.md` | R12 → `in corso` |
| `docs/DECISIONI.md` | la voce del 25/08 confermata, più il «precompila, non eredita» |
| `docs/decisioni_rovesciate.md` | rovesciamento n. 95 |
| `docs/consegne/20260922_la_resa_sulla_riga_di_ricetta.md` | questo |
