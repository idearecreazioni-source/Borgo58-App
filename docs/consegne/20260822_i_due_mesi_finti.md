# I due mesi finti — un gestionale pieno su cui collaudare

**Blocco 3 del mandato del 22/08 sera.** **Nessuna migrazione**, e **solo sul
progetto di prova**. Il comando resta uno: **`npm run prova:scenario`**.

---

## 1 · I numeri, e perché questi

Il mandato chiedeva di misurare prima e giustificare. Tre misure, non
un'impressione.

### Quanti conti: **~55 su ~20 serate**

| misura | numero | cosa decide |
|---|---|---|
| **costo** | **1,58 s** a conto, cronometrato | 55 conti ≈ 90 s. A 150 conti sarebbero 4 minuti, e *un comando da quattro minuti si smette di rilanciare* — mentre questo va rilanciato ogni volta che il collaudo rompe qualcosa |
| **rumore** | un conto storto pesa il **3%** sulla media mensile | con 5 conti peserebbe il 20% e coprirebbe tutto; con 200 sparirebbe. È l'avvertenza del mandato, misurata |
| **leggibilità** | ~55 righe | Alessio le scorre e le ricontrolla **a mano**: è ciò che distingue un collaudo da una prova automatica |

⚠️ **E il rapporto col vero è dichiarato**: un'osteria da 34 coperti fa
150-200 conti al mese. Questi mesi ne hanno ~30 ciascuno, cioè **un quinto**.
I totali in euro sono quindi bassi rispetto al piano, e lo scostamento della
Proiezione risulta negativo — **non è un difetto del calcolo, è la taglia
dello scenario**, e va saputo prima di guardare quella schermata.

### Quali mesi: **quelli che la previsione chiude**

Non due a caso. `prova-base.mjs` chiude col consuntivo il mese scorso e
quello prima, e **il consuntivo fotografa quello che trova**: conti in un
mese diverso avrebbero fatto fotografare **zero**, e la Proiezione avrebbe
detto la stessa cosa sia che funzioni sia che no. Per la stessa ragione i due
mesi si costruiscono **prima** della chiusura.

### E i due mesi sono **diversi fra loro**

Uno **fiacco** (8 serate, tavoli piccoli, piatti economici) e uno **pieno**
(12 serate, tavolate, piatti cari). Misurato sullo scenario finito:

| mese | conti | coperti | incassato | scontrino medio | forbice |
|---|---|---|---|---|---|
| **giugno** (fiacco) | 16 | 49 | **776,00 €** | 48,50 € | 33–69 |
| **luglio** (pieno) | 39 | 162 | **4.454,00 €** | 114,21 € | 43–221 |

Se si somigliassero, il confronto fra i mesi non mostrerebbe niente.

---

## 2 · 🔴 Il food cost non diceva niente — misurato prima di costruire

La prima misura del blocco ha cambiato il blocco:

> **La maggior parte delle ricette aveva food cost ZERO**, e quelle che ce
> l'avevano stavano all'**1-2%** su piatti da 9-18 €.

Due cause, tutte e due trovate guardando:

1. **`portions_yield: 4` con quantità già a porzione** — 0,12 kg di alici
   sono *una* porzione, non quattro. Ogni food cost usciva **diviso per
   quattro**.
2. **Una dispensa di sole verdure**: melanzane a 1,95 €/kg e farina a 1,35.
   Un ristorante fatto così ha food cost del 10% — un numero che non
   somiglia a niente.

⚠️ **E il punto non è che fosse impreciso**: un food cost dell'1% **resta
assurdo sia che il calcolo funzioni sia che no**. Cioè non poteva mostrare
nessun problema — che è esattamente la cosa che il mandato chiede di
evitare.

**Adesso**: quattro materie prime care (tonno 32 €/kg, maialino 18,50,
astice 45, pistacchio 28), dodici piatti a `portions_yield: 1`, e una forbice
misurata sui piatti in carta che va dal **9,6%** al **44,3%** (gli spaghetti
all'astice).
Il food cost del mese si muove col **mix venduto**, ed è l'unico modo perché
quel numero significhi qualcosa.

---

## 3 · Le cose storte — è lì che il collaudo trova i difetti

Un mese tutto pulito non serve. Costruite apposta:

**In sala**
- un conto **annullato** (il tavolo se n'è andato prima di ordinare);
- un conto **chiuso due giorni dopo** — il caso in cui la serata di servizio
  e la data di chiusura divergono, cioè quello per cui la regola delle 5
  esiste;
- un conto con una **voce libera** (che *non* scarica magazzino e finisce
  fra le anomalie) e una **nota sul tavolo**;
- un **tavolone da otto**: tre tavoli accostati, un conto solo.

**Fra le prenotazioni**
- una **spostata** di data, con la ragione scritta;
- alcune **annullate**;
- alcune **non presentate**.

**In magazzino**
- una partita **scaduta** da quattro giorni e ancora in giacenza;
- un chilo e mezzo **buttato**;
- due giacenze **allineate a mano**, una in meno e una in più — servono
  tutte e due, perché una sola direzione si leggerebbe come «il gestionale
  sbaglia sempre in eccesso».

**Nei soldi**
- movimenti di prima nota su cassa **e** banca;
- un **conteggio del cassetto con una differenza**, e un versamento;
- una **fattura pagata in ritardo** (scadeva a giugno, pagata a luglio).

**Fra i preventivi**: uno **accettato e servito**, uno **in trattativa**, uno
**rifiutato**.

---

## 4 · 🔴 Due difetti trovati costruendo

### «Non si è presentato» non esiste come stato

Scoperto scrivendolo: il database **rifiuta** `no_show`. Gli stati sono
`richiesta_in_attesa`, `confermata`, `servita`, `rifiutata`, `annullata`.

Dal 21/08 chi si presenta diventa **«servita»** da sé quando il conto si
chiude. **Chi non si presenta resta «confermata» per sempre.**

⚠️ Quindi nello scenario il no-show è costruito com'è fatto nella realtà —
confermata, serata passata, nessun conto — e la nota lo dice a parole. **Ma
il gestionale non sa distinguerlo da «mi sono dimenticato di chiudere il
conto»**, e per una prenotazione di tre settimane fa i due casi si vedono
identici. 🔵 **Domanda per Alessio**, non una cosa da decidere qui.

### Il comando diceva «rifallo» e invece accumulava

I conti che questo modulo crea **non avevano una marca**, e la pulizia dello
scenario riconosce i conti da `note like 'BASE-%'`. Risultato misurato: dopo
pochi giri di prova il database ne aveva **220** invece di 55, con **1.011**
righe di comanda.

⚠️ **Ed è peggio di una pulizia che non c'è**: il comando *sembrava*
ripulire. La marca ora si scrive dentro l'aggiornamento che già ridata i
conti — zero chiamate in più.

---

## 5 · ⚠️ L'unico punto in cui lo scenario scrive in tabella

**Va dichiarato**, perché è una deroga alla regola di casa — *si costruisce
chiamando le funzioni vere dell'app*.

`close_order_paid` scrive `closed_at = now()` e **non accetta una data**. Non
è una dimenticanza: un conto si chiude quando si chiude. Ma allora **due mesi
di storia non si possono costruire dai gesti**, e l'unica strada è farli
nascere oggi e spostarli indietro con un `update`.

⚠️ Si spostano **tutte** le date che il conto ha addosso — righe, invii e
**scarichi di magazzino** compresi: ridatare il conto e lasciare lo scarico a
oggi farebbe risultare il food cost di giugno consumato ad agosto, cioè un
numero sbagliato che nessuno collegherebbe a questa riga.

---

## 6 · Cosa c'è dentro, contato alla fine

| | |
|---|---|
| conti | **59** (1 annullato) · **275** righe di comanda |
| prenotazioni | **48** (3 annullate, alcune non presentate, una spostata) |
| prima nota | **16** movimenti · **2** conteggi del cassetto |
| fornitori | **5** fatture (una pagata in ritardo) · **2** note di credito |
| preventivi | **3** — accettato, inviato, rifiutato |
| magazzino | **22** lotti · **304** scarichi (303 consumo, **1 spreco**) · **1** partita scaduta in giacenza |
| ricettario | **35** ricette · **13** ingredienti · **12** piatti in carta |

**Il comando ci mette 2 minuti e 19 secondi**, e si rifà da zero: alla
seconda esecuzione ha tolto **1.171 righe** prima di ricostruirle.

---

## ⚠️ Cosa NON è verificato

1. 🔴 **Nessun occhio ha guardato le schermate con questi dati dentro.** Lo
   scenario è misurato dal database: che le schermate reggano 55 conti e due
   mesi di storia **non è stato visto**.
2. ⚠️ **Lo scostamento della Proiezione sarà molto negativo** per la taglia
   dichiarata al §1. Va letto sapendolo.
3. ⚠️ **I due mesi sono quelli precedenti a oggi**: lanciando il comando a
   gennaio, i mesi da chiudere cadrebbero nell'anno prima e la previsione —
   che è dell'anno in corso — non li vedrebbe.
4. ⚠️ **Il tempo del comando cresce**: da ~30 secondi a ~2-3 minuti.

---

## Cosa abbiamo rovesciato

**Una cosa sola, ed è nello scenario di collaudo, non nel gestionale.**

**Cosa era stato deciso, e quando.** Il 17/08, costruendo lo scenario:
*«nessun conto aperto, nessuna comanda in corso, nessuna riga da stornare
già pronta — le situazioni storte le fa venire fuori chi usa l'app, e un
elenco di casi deciso a tavolino troverebbe solo i difetti che chi l'ha
scritto aveva già in mente»*.

**La ragione di allora.** Giusta, e **vale ancora per la serata da
recitare**: la sala di stasera resta apparecchiata e vuota, come era.

**Cosa si decide adesso.** I **due mesi passati** contengono invece situazioni
storte costruite apposta — un conto annullato, uno chiuso in ritardo, una
merce buttata, una fattura pagata tardi.

**Perché la ragione di allora non vale più qui.** Perché parla di due cose
diverse. Un *gesto* storto lo deve fare una mano, ed è ancora così. Ma la
**storia** di due mesi non si può recitare: nessuno passerà venti serate a
fare finta. E senza storia, metà delle schermate del gestionale — la
Proiezione, il food cost, lo scadenziario, i totali — si guardano vuote,
*e una schermata vuota si comporta uguale che funzioni o no*.
