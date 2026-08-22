# Le tre cose della carta — più il prospetto

**Blocco 2 del mandato del 22/08 sera**, tutte decisioni di Alessio prese sul
referto di stamattina. **Nessuna migrazione.** Misurato applicando davvero
le regole di stampa alla pagina viva, con la controprova a ogni giro (un
`print:hidden` deve risultare `display: none`, altrimenti lo strumento non
sta simulando niente).

---

## 1 · Il preconto, ingrandito

È il foglio che finisce in mano a un cliente seduto, con la luce bassa della
sera. Quattro taglie alzate:

| | prima | dopo |
|---|---|---|
| corpo del conto | 3,17 mm | **3,70** |
| TOTALE | 3,70 mm | **4,23** |
| «a testa» | 2,78 mm | **3,44** |
| nota «documento non fiscale» | **2,65 mm** | **3,17** |

**Il testo più piccolo passa da 2,65 a 3,44 mm.** Larghezza sempre 72 mm,
niente sborda.

### ⚠️ Il prezzo, misurato e non stimato

Alessio aveva accettato *«qualche centimetro in più»*. Misurato sul caso
peggiore — cinque piatti coi nomi più lunghi del menu (30, 29, 26, 25
caratteri) e quattro coperti:

| taglia | righe che vanno a capo | altezza del preconto |
|---|---|---|
| 3,17 mm *(com'era)* | 0 su 6 | 84,5 mm |
| 3,44 mm | 2 su 6 | 97,8 mm |
| **3,70 mm** *(scelta)* | **4 su 6** | **112,5 mm** |

⚠️ **«Si allunga» e «va a capo» non sono la stessa cosa, e la seconda non era
stata prevista.** Guardato com'è fatta una riga spezzata: il nome occupa due
righe e **il prezzo resta allineato in cima a destra** — si legge senza
ambiguità, il legame nome-prezzo tiene. Per questo ho tenuto la taglia
piena.

🔵 **Se stampandolo davvero gli sembrerà troppo spezzettato**, la via di
mezzo è già misurata: 3,44 mm dà 2 righe a capo invece di 4 e 15 mm in meno
di scontrino.

---

## 2 · Il foglio bianco dei piatti del giorno

🔴 **E qui il mio referto di stamattina diceva una cosa imprecisa**, che
correggo: *«chi apre la pagina e preme Stampa ottiene un foglio vuoto»*. Non
è vero — il pulsante compare **solo** con un giorno scelto e almeno un
piatto (`selected && items.length > 0`), quindi da lì il foglio bianco non
esce. Lo avevo dedotto da una pagina in cui il pulsante **non c'era**.

**Ma il foglio bianco esisteva lo stesso**, per una strada che il pulsante
non controlla: `Ctrl+P`. Misurato: **246 caratteri a schermo, 0 sulla
carta**, perché tutti i comandi sono `print:hidden`.

**Adesso** la carta dice cosa manca — *«Nessun piatto del giorno da
stampare: scegli una data e aggiungi almeno un piatto»* — e il foglio passa
da **0 a 82 caratteri**.

⚠️ **A schermo non compare niente** (`hidden print:block`): lì la pagina si
spiega da sé, e una riga in più sarebbe ingombro. È la stessa regola dei
registri che dichiarano di essere incompleti invece di uscire vuoti — *un
foglio bianco non si riconosce come errore: sembra la stampante rotta.*

### E una riga di legge che era la più piccola del menu

🔴 L'avvertenza **«in caso di allergie o intolleranze, chiedi al
personale»** stava a **2,65 mm** — la riga più piccola dell'inserto era
quella che la legge chiede di avere su un menu. Portata a **3,17 mm**.

---

## 3 · La scheda del dipendente esce come documento

È il dossier che va al consulente del lavoro, e usciva con **le caselle di
testo disegnate e i menu a tendina con la loro freccina**: la fotografia di
una schermata.

**Adesso**: `0 campi con bordo` su 10 stampati, larghezza 189,97 mm, e il
foglio si legge come un documento —
`BASE-Rossi · Mario · [Mansione] cuoco · [Contratto] — · [Stato] Attivo · [Assunzione] 23/04/2026`

### ⚠️ Perché la cura è in CSS e non nel JSX

La strada alternativa era scrivere accanto a ogni campo una copia testuale
`hidden print:block`: **due posti che dicono la stessa cosa e possono
divergere**, cioè il doppione che questo progetto toglie invece di
sorvegliare. Con una regola in `@media print` il valore resta **uno solo**:
cambia come si vede, non cosa c'è scritto. La classe è `.documento-stampato`
e vale per qualunque altra scheda la voglia.

⚠️ **Le etichette restano**: su un modulo sono ridondanti perché il campo si
spiega da sé, su un foglio stampato sono l'unica cosa che dice cosa
significa quel valore.

⚠️ **Limite dichiarato nel CSS**: su una `textarea` il browser stampa solo le
righe che entrano nella sua altezza. La scheda dipendente non ne ha —
controllato — ma chi mette questa classe su una schermata che ne ha deve
guardare quel campo.

### E tre righe che non dovevano esserci

Il minimo di quel foglio era **2,91 mm**, su tre spiegazioni: *«Per il regime
mance (soglia 75.000€…)»*, *«Con una scadenza viene creato un promemoria in
Agenda»*, *«le buste paga le calcola il Consulente del Lavoro»*.

⚠️ **Non le ho ingrandite: le ho tolte dalla carta.** Sono istruzioni
dell'applicazione per chi compila, non contenuto del dossier — e l'ultima
spiega al consulente del lavoro cosa fa il consulente del lavoro. Minimo
ora **3,17 mm**.

---

## 4 · Il prospetto per il commercialista

Sei elementi a `text-[11px]` (**2,91 mm**) portati a **3,17**: le etichette
dei tre totali, la riga «non contate nel deducibile», il motivo di ogni voce
e la nota finale. Minimo del foglio ora **3,17 mm**.

---

## ⚠️ Cosa NON è verificato

1. 🔴 **Nessuna carta è uscita da una stampante.** Vale per tutte e quattro.
   Sulla termica in particolare restano fuori la resa del nero, i margini del
   rullo e come il calore tratta un font più grande.
2. ⚠️ **Il preconto è stato misurato con 5 piatti e 4 coperti**: un tavolo da
   dieci con quindici righe è più lungo e non l'ho guardato.
3. ⚠️ **La scheda ricetta resta come sta** — decisione di Alessio, è in coda:
   la stampa lui per sé e non vale mezza giornata.
4. ⚠️ **`.documento-stampato` è su una schermata sola.** Le altre schede che
   stampano campi (la ricetta, appunto) non la usano.

---

## Cosa abbiamo rovesciato

**Niente.** Quattro documenti diventano più leggibili, nessuna decisione
cambia.

⚠️ **E non è stato rovesciato il criterio «essenziale e minimal»**, che
poteva sembrare in tensione con l'ingrandire: le tre righe tolte dal dossier
e la frase del foglio bianco che a schermo non compare vanno **nella stessa
direzione** di quel criterio — sulla carta finisce ciò che serve a chi legge
il foglio, non ciò che serve a chi compila la schermata.

---

## 5 · I dati costruiti per misurare, e tolti

Un conto su T3 con i cinque nomi più lunghi del menu e 4 coperti (per il
preconto) e un menu del giorno `MISURA-collaudo` con tre piatti (per
l'inserto). **Tolti entrambi**: il conto **annullato** e non chiuso, il menu
del giorno cancellato. Controllato: **0 conti aperti**, **0 menu del
giorno**, movimenti di cassa **invariati a 2**.
