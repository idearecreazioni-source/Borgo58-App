# Il secondo giro — le dodici che si usano con le mani occupate

**Mandato**: le schermate di reparto, senza aspettare le crocette (servono
per il terzo gruppo). **Nessuna migrazione.**
Tutto misurato a **800 × 1280**, calibrazione **74**, aprendo ogni schermata.

---

## 1 · Le dodici, prima e dopo

| schermata | testo | bersaglio | gesti pericolosi |
|---|---|---|---|
| `/haccp` | 1,49 → **3,20** | 5,14 → **8,50** | nessuno |
| `/haccp/temperature` | 1,62 → **3,20** | 2,16 → **8,50** | nessuno *(§3)* |
| `/haccp/pulizia` | 1,62 → **3,20** | 2,16 → **8,50** | nessuno |
| `/haccp/ricevimento` | 1,49 → **3,20** | 2,30 → **8,50** | nessuno |
| `/haccp/non-conformita` | 1,49 → **3,20** | 2,16 → **8,50** | nessuno |
| `/haccp/raccolta-propria` | 1,62 → **3,20** | 2,70 → **8,50** | nessuno |
| `/magazzino` | 1,49 → **3,20** | 2,16 → **8,50** | nessuno |
| `/magazzino/carico` | 1,62 → **3,20** | 2,30 → **8,50** | nessuno |
| `/magazzino/allineamento` | 1,49 → **3,20** | 2,30 → **8,50** | nessuno |
| `/magazzino/produzioni` | 1,89 → **3,20** | 2,30 → **8,50** | nessuno |
| `/magazzino/ordini` | 1,62 → **3,20** | 2,30 → **8,50** | **sistemato, §2** |
| `/calendario-eventi/pianta` | 1,49 → **3,20** | 2,30 → **8,50** | nessuno *(§3)* |

**Dodici su dodici** ai criteri.

---

## 2 · 🔴 «Annulla» in Ordini annullava davvero — e stava accanto al suo contrario

Il metodo di stamattina ha trovato l'unico caso vero del giro.

In **`/magazzino/ordini`**, sulla riga di un ordine inviato, c'erano due
pulsanti attaccati:

> **«È arrivato»**  ·  **«Annulla»**

e il secondo chiama `annullaOrdine`: **annulla l'ordine per davvero**, e le
righe tornano nella lista della spesa. Sono i due esiti opposti dello stesso
ordine, a un soffio l'uno dall'altro, tutti e due in caratteri piccoli.

**Adesso**: la fila usa `.gesti-pericolosi` (5 mm veri) e il pulsante dice
**«Annulla l'ordine»**.

⚠️ **La parola contava quanto la distanza**: in mezza app «Annulla» vuol dire
*«lascia perdere, chiudi il modulo»* — e uno che lo legge di corsa accanto a
«È arrivato» non ha modo di sapere quale dei due significati sia.

---

## 3 · Due falsi allarmi, riconosciuti guardando cosa fanno

Come stamattina, prima di toccare una coppia sono andato a vedere il gesto:

- **`/calendario-eventi/pianta`** — «Conferma» / **«Annulla»**: quel
  «Annulla» chiama `azzera`, che **svuota la selezione dei tavoli**. Non
  cancella niente, ed è anzi la *via di ritorno* che il progetto pretende
  accanto a ogni rifiuto — c'è pure il commento che lo dice. **Lasciato dov'è.**
- **`/haccp/temperature`** e **`/haccp/non-conformita`** — «Annulla» che
  alterna con «+ Registra temperatura» e con «Risolvi»: **chiude il modulo**.
  Stessa cosa. **Lasciati.**

⚠️ **Il conto delle due giornate**: dieci coppie segnalate dal setaccio,
**quattro erano falsi allarmi** — due stamattina (Cassa, Agenda) e due
adesso. *Il setaccio legge l'etichetta; solo aprire il codice dice cosa fa il
pulsante.*

---

## 4 · La riga sulla radice — applicata, e guardata schermata per schermata

Undici delle dodici hanno preso la taglia sulla radice: il testo **senza
classe** eredita i 16 punti del browser (2,16 mm a 74), e nessuna
sostituzione poteva vederlo perché non c'era niente da sostituire.

⚠️ **La dodicesima è l'eccezione, ed è il motivo per cui il mandato diceva
di guardare comunque**: `/calendario-eventi/pianta` **non ha una radice
propria** — la sua è `<div className="col-span-2 min-w-0">`, una cella di
griglia dentro un'altra schermata. Metterci la taglia avrebbe cambiato la
misura a **metà** di una pagina condivisa, non a questa. Lì ho lavorato sulle
**costanti dei pulsanti** (`BOTTONE` e `PRINCIPALE`, che quel file usa
ovunque), ed è bastato.

**E guardandole una per una dopo, ne sono rimaste indietro due che la
sostituzione non aveva preso:**

| dove | cosa | perché era sfuggito |
|---|---|---|
| `/haccp/non-conformita` | «Risolvi» a **4,00 mm** | è un pulsante di testo, senza riquadro: la mia regola guardava le righe con un `<button` nelle sei precedenti, e lì il tag era più lontano |
| `/calendario-eventi/pianta` | «Oggi» a 6,43 e i «⟳ T1 (in piedi)» a **5,89** | le classi stavano in **costanti** condivise, non sull'elemento |

---

## ⚠️ Cosa NON è verificato

1. 🔴 **Le liste erano quasi vuote**, e questo limita la ricerca delle
   coppie: su sette di queste dodici il codice contiene gesti che cancellano
   (`ConfermaDistruttiva`, «Elimina», «Rimuovi») che **a schermo non
   comparivano**, perché non c'erano righe. Li ho letti nel codice per
   decidere; **non li ho visti disegnati**. ⚠️ *Quando ci saranno dati veri,
   quelle righe vanno rimisurate.*
2. ⚠️ **`ConfermaDistruttiva` copre già i sette casi**: quel componente è uno
   solo e stamattina è passato a 8,50 mm di bersaglio e **5 mm** fra «Sì,
   elimina» e «Annulla». Vale ovunque, anche dove non l'ho visto comparire.
3. 🔴 **Non l'ha visto un occhio**: sono misure, non fotografie.
4. ⚠️ **I moduli che si aprono dentro** (registra temperatura, nuova
   attrezzatura, carico da fattura) non sono stati misurati aperti.

---

## Cosa abbiamo rovesciato

**Niente.** Taglie e distanze salgono, una parola diventa più precisa:
nessuna decisione cambia.

⚠️ **E in particolare non è stato rovesciato il «lasciar stare»**: quattro
coppie segnalate dal setaccio sono rimaste **esattamente come erano**, perché
guardarle ha detto che non erano pericolose. *Non si spostano cose che
funzionano* — è la regola che il mandato ha dato stamattina per Cassa e
Agenda, e vale identica qui.

---

## 5 · Cosa ho guardato

Aperte tutte e dodici, prima e dopo. In Ordini, nella pianta e nelle due
HACCP sono anche andato a **leggere cosa fa** il pulsante prima di decidere —
ed è così che il giro ha prodotto **una** correzione di parola invece di
quattro spostamenti inutili.

**Suite**: 258 prove pure, 303 sui dati veri. Tutte verdi.

**Resta il terzo gruppo** — una quarantina di schermate da scrivania, che
aspetta le crocette di Alessio: se una si guarda solo dal computer, questi
numeri non la riguardano.
