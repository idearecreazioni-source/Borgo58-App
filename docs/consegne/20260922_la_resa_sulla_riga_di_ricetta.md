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

## 0-bis · 🔴 QUESTA CONSEGNA ROVESCIA UNA DECISIONE DEL 25/08, E LA CONFERMA È DI ALESSIO

**Trovato leggendo [`DECISIONI.md`](../DECISIONI.md) prima di chiudere, non
dopo.** C'è una voce, datata **25/08/2026** — cioè **undici giorni dopo** il
mandato che questa consegna esegue:

> *«Il campo % SCARTO STANDARD **RESTA**. Serve per l'ingrediente che va solo
> pulito senza altre lavorazioni, quindi senza una preparazione da cui ricavare
> la resa.»*

🔴 **È posteriore al mandato, e dice l'opposto di quello che ho fatto.** Non è
un dettaglio di cronologia: vuol dire che Alessio ha guardato quel campo
**dopo** aver deciso che lo scarto appartiene alla coppia, e ha deciso di
tenerlo lo stesso. ⚠️ *Chi esegue un mandato vecchio senza leggere le decisioni
prese dopo rovescia in silenzio* — ed è precisamente la forma di deriva che la
sezione «cosa abbiamo rovesciato» esiste per prendere.

**La ragione di allora era un caso vero, non una comodità**: il carciofo che si
pulisce e basta non ha nessuna preparazione da cui ricavare la resa, e il 23/08
era già stato deciso che la percentuale *«non sostituisce la resa vera, che
emerge dalla preparazione»*. Per quell'ingrediente restava un buco, e il campo
lo riempiva.

⚠️ **Quel caso adesso ha una casa nuova, ed è l'argomento per cui ho proceduto
invece di fermarmi**: il 25/08 le case possibili erano due — la scheda, o una
preparazione che per il carciofo pulito non esiste — e fra quelle due la scheda
era la risposta giusta. R12 ne aggiunge una terza che allora non c'era: **la
riga di ricetta**. Lì «1 kg di carciofi → 300 g» si scrive senza nessuna
preparazione, e copre il solo-pulito esattamente come copre il mollusco.

⚠️ **E il prezzo è vero e non lo nascondo**: quel numero va scritto su **ogni**
ricetta che usa i carciofi, invece che una volta sola sulla scheda.

🔴 **Quindi questa proposta NON va unita senza che Alessio abbia letto questa
sezione.** Se per lui la voce del 25/08 vale ancora, la via c'è ed è stretta: si
tiene il campo sulla scheda **e** lo si fa leggere come valore di partenza della
riga nuova — ma allora torna a esistere un numero unico per lavorazioni diverse,
che è il difetto del 14/08. Le due cose non stanno insieme, e la scelta è sua.

La voce in `DECISIONI.md` è **barrata e marcata rovesciata**, non cancellata, col
rimando al rovesciamento **n. 95**.

---

## 1 · Il censimento — dove viveva lo scarto, misurato

Letto dal repository, non ricordato:

| dove | cosa c'era | dopo R12 |
|---|---|---|
| `ingredients.waste_percentage_default` | lo scarto «standard» del prodotto | resta la colonna, **non letta e non scritta** (§7) |
| `recipe_ingredients.waste_percentage` | quasi sempre vuota; il `coalesce` andava a pescare il default | **riflesso**, scritta solo dal trigger |
| `recipe_ingredients.quantita_lorda` | non esisteva | **è il dato**, insieme a `quantity` |
| il codice dell'app (`src/`) | `waste_percentage` di riga: **0 occorrenze** dopo R12 | — |
| le migrazioni | **12 file** moltiplicano per «1 + scarto/100»; **0** dividono per «1 − scarto/100» | invariato: la formula non cambia |

⚠️ **La formula NON è stata toccata.** `fabbisogno_conto`,
`fabbisogno_preparazione`, `simula_prezzo_ingrediente`, `v_recipe_row_costs` e
`recipe_ingredients_display` continuano a fare esattamente quello che facevano:
cambia **da dove viene il numero** che moltiplicano, non l'aritmetica. È la
ragione per cui il food cost può restare identico al millesimo (§3).

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

## 7 · 🔴 Una colonna che da oggi NESSUNO scrive — e la decisione che NON prendo io

Avevo scritto, in tre posti, che `ingredients.waste_percentage_default` *«resta
come PROPOSTA per la riga nuova — è il valore che l'assistente compila leggendo
una scheda prodotto (13/08)»*.

**Era falso, e l'ho misurato invece di ricordarmelo.** La migrazione
`20260823000007` del **23/08** fece due cose, con la ragione scritta accanto:
tolse lo scarto dai campi mancanti di `prodotti_da_compilare`, e fece
**smettere `applica_scheda_prodotto` di scriverlo** anche se il modello l'avesse
rimandato. Parole di Alessio quel giorno: *«lo scarto non lo propone più
nessuno, si scrive a mano quando si sa»*.

L'unica porta rimasta era il campo nella scheda del prodotto, **e R12 la
chiude**. Quindi da oggi quella colonna **non è letta da nessun calcolo** (la
sanatoria ha scritto lo scarto esplicito su ogni riga) e **non è scritta da
nessuno**.

🔴 **Se si tiene o si butta è una decisione di ALESSIO, e non la prendo io.**
Toglierla vuol dire riscrivere `create_ingredient` (che la prende come
parametro), `applica_scheda_prodotto`, `prodotti_troppo_piccoli`,
`numeri_sospetti`, il censimento delle unità e il vincolo
`ingredients_scarto_sotto_cento`: un lavoro con dentro una decisione.

⚠️ **E il prezzo del tenerla è dichiarato**, perché è quello che questo progetto
conosce: *una colonna spenta, fra tre mesi, qualcuno la riaccende credendo di
riparare qualcosa.* È scritto in tre posti apposta — il commento della colonna,
il commento del vincolo, e il riquadro nella scheda del prodotto — invece di
essere lasciato scoprire.

⚠️ **Scrivere «resta come proposta» avrebbe rovesciato una decisione di Alessio
di un mese fa dentro un commento**, cioè nel posto dove nessuna prova sarebbe
diventata rossa.

---

## 8 · La schermata

* Nella riga di ricetta ci sono **due campi**: «quanto ne prendi» (lordo) e
  «quanto ne resta» (netto). Il campo dello **scarto è sparito**.
* **La resa si vede mentre si scrive**: «da 1.5 ne restano 0.4 — resa 26.7%».
* ⚠️ **Il rifiuto sta dove sta il dubbio**, sotto i due campi, e il pulsante è
  **spento con la ragione accanto** — non premibile per essere respinto
  (regola del 17/08).
* Nella scheda del prodotto il campo «% scarto standard» è sostituito da un
  riquadro che dice **dove è andato a finire** e perché. *Chi cercava lo scarto
  lì adesso non lo trova, e deve saperlo.*
* ⚠️ **`duplica_ricetta` porta i due numeri**, non lo scarto: riscritta **dal
  corpo vivo** (regola del 18/08), non dalla migrazione che l'aveva creata.
  Copiare `waste_percentage` verrebbe adesso **rifiutato dal riflesso**, quindi
  duplicare una ricetta si sarebbe rotto al primo tentativo.
* ⚠️ **`recipe_ingredients_display`** riscritta dal corpo vivo, con le colonne
  nuove **aggiunte in fondo** (`ERROR 42P16`: in una vista si aggiunge solo in
  coda).

---

## 9 · Prove — e le nove rotture

**43 prove nuove**: 36 pure (`tests/unita/resa.test.js`) + 7 di schermata
(`tests/schermate/resa-ricetta.test.jsx`). Suite intera verde: **lint pulito**,
**1711 prove pure**, **345 di schermata**, **build**.

Dentro la migrazione, **9 gruppi di controlli** in una sotto-transazione
annullata (regola del 30/08, con `foto_righe()` e `pretendi_nessun_residuo()`):
lo stesso ingrediente con **due rese diverse in due ricette** (che è la ragione
del blocco), lordo uguale al netto, netto maggiore del lordo respinto, zero e
negativi respinti, chi non dice il lordo, lo scarto scritto a mano respinto, i
numeri che cambiano e lo scarto che si sposta da sé, la copia di una ricetta, e
**il food cost che legge il lordo e fa il numero giusto**.

**Le nove rotture volontarie, tutte discriminanti**: il trigger creato prima
della sanatoria · la fotografia del food cost che nasce vuota · il filtro
`of quantita_lorda` rimesso · la copia che torna a portare lo scarto · la resa
scambiata con lo scarto · il netto maggiore del lordo ammesso · il vuoto che
torna a valere zero · la schermata che manda lo scarto · il campo del lordo
tolto.

🔴 **Due non mordevano, e sono due buchi veri chiusi:**
1. la rottura «ordine» era un **inserimento di commento**, cioè non rompeva
   niente — rifatta perché inserisse davvero un `create trigger` prima della
   sanatoria;
2. la prova della **fotografia** controllava solo che la frase esistesse:
   svuotando la tabella temporanea restava **verde**. Ora pretende che la
   tabella nasca `as select … from v_recipe_costs`.

⚠️ **Ogni rottura FALLISCE se non trova la sua àncora** — una rottura non
avvenuta è indistinguibile da una prova che non discrimina. È la lezione pagata
il 21/09 con un fine-riga sbagliato su un file a CRLF.

🔴 **E un setaccio mio mentiva**: cercando `pareggiata_il` nel testo di una
funzione lo trovavo **dentro il commento che spiega perché non c'è**.
Rimisurato togliendo i commenti, e il metro provato prima su due casi di
risposta nota (regola del 26/08).

---

## 10 · Cosa abbiamo rovesciato

Uno, registrato come **n. 95** in
[`decisioni_rovesciate.md`](../decisioni_rovesciate.md): *«il campo % scarto
standard RESTA sulla scheda del prodotto»* — la decisione di Alessio del
**25/08/2026**, che è **posteriore** al mandato che questa consegna esegue.
🔴 **Vedi §0-bis: è la cosa da leggere prima di unire questa proposta.**

---

## 11 · Cosa NON è stato verificato

1. 🔴 **La migrazione non è mai stata eseguita**, da nessuna parte — è una
   condizione del mandato. Quindi i 9 gruppi di controlli sono **scritti e mai
   girati**, e il confronto del food cost prima/dopo **non ha mai guardato
   nessuna ricetta vera**. È la cosa più importante di questo elenco.
2. ⚠️ **La sanatoria non ha mai toccato una riga.** In produzione ci sono
   **14 ricette con 0 righe di ingrediente** (§12 di `CLAUDE.md`, misura del
   04/09), quindi l'unico posto dove la sanatoria ha qualcosa da fare è il
   progetto di prova, e nemmeno lì è stata provata. ⚠️ *Il caso da provare è
   quello che ha qualcosa da fare* (17/08): questo resta **scoperto**.
3. ⚠️ **Nessun occhio ha guardato la schermata.** Le prove di schermata
   misurano il DOM; **se i due campi stiano comodi sul telefono, e se «resa
   26.7%» si legga con le mani occupate, resta un giudizio di Alessio.**
4. ⚠️ **Nessuna misura di larghezza a 390 punti** su quella riga: sono due
   campi dove prima ce n'erano due (quantità + scarto), quindi il conto non
   cambia — **ma non è stato misurato**, è dedotto.
5. ⚠️ **La lista della spesa non è stata toccata né riprovata.**
   `lordoDaComprare()` esiste ed è provata pura, ma **nessuna schermata la
   chiama ancora**: quanto ordinare continua a leggersi come prima.
6. ⚠️ **Il conteggio «12 file moltiplicano, 0 dividono»** è misurato sulle
   migrazioni del repository, non sui corpi vivi del database.

---

## 12 · Cosa resta da fare

* **Applicare la migrazione sul progetto di prova** e guardare cosa fa la
  sanatoria su righe vere — è il passo che chiude il punto 2 di §11.
* **La decisione di Alessio su `waste_percentage_default`** (§7): si tiene
  spenta o si toglie.
* **La lista della spesa**: far leggere a chi ordina il lordo della riga
  (`lordoDaComprare`) invece della vecchia resa dichiarata.
* ⚠️ **Dove c'è una produzione registrata, la resa misurata dovrebbe vincere su
  quella dichiarata** — è nel mandato del 14/08 e **non è in questo blocco**.

---

## 13 · File toccati

| file | cosa |
|---|---|
| `supabase/migrations/20260922000001_la_resa_sulla_riga_di_ricetta.sql` | **nuovo**, non applicato |
| `src/lib/calcoli/resa.js` | **nuovo** — la regola in un posto solo |
| `src/pages/ricettario/RicettaDetail.jsx` | i due campi, la resa, il rifiuto, l'elenco |
| `src/pages/ricettario/IngredienteForm.jsx` | via il campo dello scarto, con la ragione scritta |
| `tests/unita/resa.test.js` | **nuovo** — 36 |
| `tests/schermate/resa-ricetta.test.jsx` | **nuovo** — 7 |
| `docs/RICHIESTE.md` | R12 → `in corso` |
| `docs/decisioni_rovesciate.md` | rovesciamento n. 95 |
| `docs/consegne/20260922_la_resa_sulla_riga_di_ricetta.md` | questo |
