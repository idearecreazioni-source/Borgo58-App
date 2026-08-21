# Le Comande entrano in larghezza in un 8 pollici

**Mandato**: la regola di Alessio del 21/08, dopo aver guardato la schermata
**in scala reale** su un Android da 8 pollici (800 × 1280 punti,
`b58_pxcm` = 74).
**Nessuna migrazione**: al database non serve niente.

---

## ⚠️ Cosa NON è verificato

1. 🔴 **NON HO GUARDATO LA SCHERMATA, e non è una scelta**: per aprire
   Comande serve entrare col PIN, e **non digito PIN** — nemmeno quello di
   collaudo. Quello che ho verificato nel browser, a 800 × 1280, è: la
   calibrazione **arriva davvero a 74** (`--pxcm: 74px`, riga di tocco 77,7
   punti, pulsantino 62,9, azione 88,8) e la pagina d'accesso **non scorre di
   lato**. Tutto il resto è **aritmetica sulle regole scritte nel codice**,
   non un'immagine.
2. 🔴 **I quattro stati — sala vuota, tavolo selezionato, conto aperto,
   spostamento — non li ha guardati nessuno a questa scala.** È la cosa che
   serve, e la può fare solo Alessio.
3. ⚠️ **La larghezza media di un carattere è una stima**, non una misura:
   quanti caratteri di un nome di piatto stiano in una riga dipende dal font
   di sistema del dispositivo.
4. ⚠️ **Non esiste una carta vera**: zero ricette in produzione, una sola sul
   progetto di prova. Nessun nome che Alessio userà è mai stato messo in
   quella riga.
5. ⚠️ **Nessuna prova di questo progetto guarda una schermata**: quello che
   adesso è sorvegliato è la **misura** (la pianta entra in larghezza), non il
   disegno.

---

## Cosa abbiamo rovesciato

**Un rovesciamento**, il n. 18: *«menu e pianta stanno affiancati su due
colonne»* (20/08). Sta per esteso nel
[registro](../decisioni_rovesciate.md).

⚠️ **Non era sbagliato: era misurato con la lente sbagliata.** Le larghezze
su cui quel disegno fu approvato — menu 250, pianta 427 — venivano dalla
calibrazione da **computer**. E la lente era sbagliata **per tutti**,
validatore compreso: il disegno è stato proposto, misurato, discusso e
approvato senza che nessuno se ne accorgesse. *Non l'ha trovato un controllo:
l'ha trovato Alessio chiedendo di vedere le cose in scala reale.*

---

## 🔴 La regola

> **Quello che si vede deve entrare in larghezza. Mai scorrimento laterale.
> Se serve scorrere, si scorre in verticale.**

---

## I numeri, a 800 punti con la calibrazione vera

| | punti |
|---|---|
| viewport | 800 |
| margini della pagina (32 per lato) | 64 |
| **contenuto utile** | **736** |
| pianta in piedi: minimo richiesto | **667** |
| **margine che avanza** | **69** |
| pianta disegnata | 736 × **1479** |
| pannello dei gesti (dentro la pianta) | 368 × 1000 |
| banco bar (dentro la pianta) | 368 × 171 |
| riga del menu (altezza) | 78 |
| pulsantino (lato) | 63 |
| azione principale (altezza) | 89 |
| spazio per il nome del piatto | **598** (≈ 85 caratteri) |

✅ **La pianta ci sta con la soglia del tavolo lasciata a 10,5 mm.** Era stato
proposto di abbassarla a 7 mm per far stare due colonne: quelle colonne non
esistono più, quindi **non si abbassa**. *Un numero si abbassa quando serve,
non per prudenza.*

✅ **I due pannelli dentro la pianta ci stanno**: 368 punti di larghezza sono
più che sufficienti per due pulsanti affiancati (≈ 175 l'uno), e l'altezza
del pannello dei gesti è di **mille** punti per cinque pulsanti e il
riepilogo.

---

## Dove si scorre in verticale — e dove no

Con la pianta alta 1479 punti su uno schermo alto 1280:

| cosa | dove cade | serve scorrere? |
|---|---|---|
| titolo, Bar / Cucina / Scontrini | 0 – 120 | no |
| pianta: sala alta, T1–T4 | 120 – 600 | no |
| **banco bar** (chi ha prenotato) | ~120 – 290 | no |
| **pannello dei gesti** (Invia / Preconto / Chiudi conto / Lascia aperto / Cambia tavoli) | **599 – 1599** | **no**, comincia sul primo schermo |
| pianta: sala bassa, T5–T9 e divani | 600 – 1599 | in parte |
| **il menu** | **da 1599 in giù** | **sì, ~1000 punti** |

⚠️ **Lo scorrimento vero è uno solo, ed è per il menu.** È il fastidio che le
due colonne volevano togliere e che adesso si riaccetta: l'alternativa
misurata è una pianta che esce dallo schermo.

⚠️ **I gesti del conto non chiedono quello scorrimento**, ed è la ragione per
cui stanno dentro la pianta: la loro colonna comincia a 479 punti da dove la
pianta comincia, cioè **si vede sul primo schermo**.

---

## I due gesti che non si trovavano

«Cambia tavoli» e «‹ Lascia … aperto» erano sotto la pianta, a **1279 punti**
dall'alto: c'erano e non li trovava nessuno. Adesso stanno **dentro la
colonna dei gesti**, accanto a Invia / Preconto / Chiudi conto — sono i gesti
dello stesso conto che si sta servendo.

⚠️ **La parola resta «Lascia aperto», mai «chiudi»**: in sala «chiudere» vuol
dire incassare.

---

## 🔴 Una cosa che NON è tornata come prima, e che sarebbe stato facile
## sbagliare

La larghezza massima della schermata resta **768 punti** e **non** torna ai
448 di prima del 20/08.

⚠️ Quei 448 c'erano da sempre, ed erano giusti finché questa era una colonna
di testo. **Non lo è più**: la pianta in piedi, alla calibrazione vera, chiede
667 punti — con 448 sborderebbe di duecento. *Tornare «come prima» avrebbe
rimesso il difetto che si sta chiudendo.*

---

## La misura adesso è sorvegliata

Le tre soglie della pianta si sono spostate da `PiantaSala.jsx` a
`src/lib/calcoli/sala.js`: **sono misure, e una misura si deve poter provare
senza un browser.** Con loro c'è `marginePiantaInPiedi(puntiUtili, pxcm)`.

**7 prove pure nuove**, una coppia per ciascuno dei tre schermi veri:

- a **tutta larghezza** la pianta ci sta (margine positivo);
- in una colonna del **62%** non ci starebbe.

⚠️ **La seconda metà non è un di più**: senza, «a tutta larghezza» non
sarebbe una condizione ma una coincidenza — se la pianta entrasse comunque,
la prova non starebbe misurando niente.

### La controprova — due rotture

| rottura | prove rosse |
|---|---|
| soglia del tocco da 1,05 a 1,5 cm | **4** |
| `RIDUZIONE_DISEGNO` da 0,75 a 1 | **5** |

---

## E la regola per tutti i lavori futuri

Scritta in **due posti dove chi misura passa per forza** — `CLAUDE.md` §6 e
in testa a `src/lib/touch.js`:

> **Ogni misura su una schermata operativa si fa col valore del TABLET, non
> con la stima da computer.**

⚠️ Con la ragione per cui l'errore non si vede: **i due effetti vanno nella
stessa direzione** — sul tablet i punti disponibili sono **meno** e tutto ciò
che è dimensionato in centimetri veri diventa **più grande**.

---

## Per Alessio, in una riga

La pianta adesso occupa tutta la larghezza e ci sta senza sbordare; il menu è
tornato sotto, e per arrivarci si scorre in giù. I pulsanti del conto —
compresi «Cambia tavoli» e «Lascia il tavolo aperto» — sono tutti dentro la
pianta, dove si vedono senza scorrere.

---

**Commit**: dichiarato al momento del commit finale di questa consegna.
