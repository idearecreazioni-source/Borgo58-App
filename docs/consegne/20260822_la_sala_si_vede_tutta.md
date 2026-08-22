# La sala si vede tutta — il disegno non ha più un pavimento

**Nato da**: il collaudo di Alessio col tablet. La pianta appariva **tagliata
a destra** — T9 a metà, i divani e la Chef Table non disegnati affatto.
**Nessuna migrazione.**
**Commit del codice**: `b07ef8e`.
⚠️ **E qui c'è un mio strappo alla convenzione, dichiarato**: il riepilogo
è finito *dentro* quel commit invece che dopo, quindi non poteva nominarne
l'hash. Questa riga è il commit successivo, che lo nomina. La convenzione
esiste perché chi controlla parta da un hash certo: senza, deve indovinare
quale commit sta sotto il documento.
**Insieme a questo**: le due migrazioni pendenti sono state **applicate in
produzione** (§6).

---

## 1 · La misura, prima della cura

Chiesta e riportata come da mandato, fatta nel browser a 800 × 1280 con
calibrazione **74**, sul progetto di prova.

### a) Quanto è largo il disegno contro il riquadro

| | |
|---|---|
| finestra | 800 punti |
| riquadro visibile | **721** (32+32 di margini, 15 di barra di scorrimento) |
| SVG disegnato | **721 × 1449** |
| `viewBox` | `0 0 1030 2070` (la sala in piedi: 10,30 m × 20,70 m) |
| sagome fuori dal disegno | **nessuna**, tutte e 13 |

⚠️ **A 800 punti, con quella calibrazione, non taglia niente** — e questo è
il primo risultato, perché dice che il difetto non è dove sembrava. Il
margine però è di **55 punti**: bastano una barra di scorrimento, un margine
in più o una calibrazione un po' più alta per finire dall'altra parte.

### b) Perché il disegno non si adattava — la causa vera

Il riquadro che contiene l'SVG aveva:

```
min-width: 9,012 cm reali × --pxcm     →  667 punti a 74
```

e l'SVG è `w-full`, cioè **prende la larghezza di quel riquadro**. Quindi:
una **misura fissa in centimetri veri dentro un contenitore elastico** — che
è esattamente il sospetto del mandato. *Se la scala è fissa e il riquadro è
elastico, prima o poi si tagliano sempre.*

**Riprodotto**, stringendo la finestra a 600:

| | prima | dopo |
|---|---|---|
| riquadro visibile | 568 | 568 |
| disegno | **666** (il pavimento) | **568** |
| scorrimento laterale | **sì** (666 > 568) | no |
| sagome fuori dalla vista | **6** — T5, T7, Divano 1, Divano 2, Divano 3, Chef Table | **0** |

🔴 **E sono precisamente le sagome che Alessio non vedeva.** Sul telefono e
sul tablet in piedi la sala fa un quarto di giro: il **fondo** della stanza
diventa il **bordo destro** dello schermo, ed è la fila dei divani, della
Chef Table e dei tavoli T5·T7·T9.

⚠️ **Tecnicamente il contenitore scorreva**, non ritagliava. Ma è una
distinzione che non esiste per chi guarda: *nessuno scorre di lato una
pianta della sala* — la si guarda e basta. E la soglia è a **9,012 cm ×
pxcm**, quindi cambia da tablet a tablet: la stessa app taglia o no a
seconda della calibrazione, che è il motivo per cui a 74 e 736 punti il
conto sembrava tornare.

### c) Sì, succede anche nel Calendario

Guardato, non dedotto: `/calendario-eventi/pianta` usa lo **stesso
componente** e dà gli **stessi identici numeri** (721 × 1449, `viewBox`
uguale, margine 55, e a 600 punti le stesse 6 sagome fuori). ⚠️ Anzi, lì è
peggio: in Comande la sala si guarda per toccare un tavolo che si sa
esistere; in Calendario **si guarda per decidere dove mettere qualcuno**, e
una sala con tre posti in meno cambia la decisione.

---

## 2 · Perché i sette controlli non l'hanno preso

Perché rispondevano a un'altra domanda, ed è la stessa forma del difetto:

> quelli chiedono **«il RIQUADRO entra nella pagina?»**
> questo chiede **«il DISEGNO entra nel riquadro?»**

`marginePiantaInPiedi(736, 74)` faceva **+69** su tutti e tre gli schermi
veri: verde. E il verde era vero — il riquadro entrava davvero. ⚠️ *Un
controllo può essere giusto, passare, e non dire niente sulla cosa che si
rompe.*

---

## 3 · La cura: il disegno subisce la larghezza, non la detta

**Il pavimento in centimetri reali è stato tolto.** Da adesso il disegno è
largo **esattamente quanto la parte visibile del riquadro**, sempre. Non c'è
nessuna condizione in cui una sagoma resti fuori.

⚠️ **Cosa si paga, dichiarato invece che nascosto**: sotto i 667 punti il
bersaglio del tavolo più piccolo scende sotto 1,05 cm. Misurato dal vivo, e
il numero vero è più generoso della formula perché la sagoma cresce di 3 mm
per essere afferrabile:

| schermo | riquadro | lato di T5 | sagome tagliate |
|---|---|---|---|
| tablet 8" (800) | 721 | **10,0 mm** | 0 |
| finestra a 600 | 568 | **8,2 mm** | 0 (prima: 6) |
| iPhone (375) | 343 | **5,0 mm** | 0 |

🔴 **Il confronto non è con 1,05 cm, è con i 5,3 mm che Alessio ha provato
con le mani il 18/08** — l'unico numero di questa famiglia misurato su un
gesto invece che preso dal brief. Sui due tablet il bersaglio resta
abbondantemente sopra; **sul telefono va appena sotto (5,0 contro 5,3)**, ed
è il prezzo: *fra «i tavoli si toccano un filo più piccoli» e «tre tavoli
non ci sono», la scelta non è in dubbio.*

⚠️ **E la calibrazione adesso dice la cosa giusta.** L'avviso che compare
spostando il righello diceva *«la sala non ci starà più… tornerà a sbordare
di lato»*: era vero **finché esisteva il pavimento**. Ora dice quanto
diventa il bersaglio in millimetri e lo confronta coi 5,3 provati. *Un
avviso che descrive un difetto che non c'è più è peggio di nessun avviso.*

---

## 4 · Il controllo nuovo, e le tre rotture

`sagomeFuoriDalDisegno()` in `src/lib/calcoli/sala.js`: **quali sagome
cadono fuori dal foglio**, guardandole **come vengono disegnate** — verso
(`ruotato`) e spostamenti del solo disegno (`SPOSTATE_NEL_DISEGNO`)
compresi.

- **6 prove pure** (`tests/unita/sala-misure.test.js`), fra cui la pianta
  vera di partenza;
- **2 prove sui dati veri** (`tests/app/aggancio-sala.test.js`): la pianta
  di **oggi** e quelle delle **ultime cinque giornate già apparecchiate** —
  ⚠️ perché una disposizione di una sera qualunque può portare un tavolo
  oltre il bordo, e nessuno la guarda finché quella sera non arriva.

**Rotte apposta, tutte e tre, e poi rimesse a posto:**

| cosa ho rotto | quale prova è diventata rossa |
|---|---|
| il controllo guarda il dato vero invece del disegno | *«guarda il posto DEL DISEGNO, non quello vero»* |
| ignora il verso della sagoma | *«il verso conta»* |
| non guarda il bordo destro | *«una sagoma che sfora a destra viene nominata»* |

🔴 **E la prima rottura ha trovato una prova che non discriminava** — la
mia, scritta dieci minuti prima. Usava la Chef Table alle sue coordinate
vere, che stanno **dentro il foglio esattamente come la sua posizione
disegnata**: rotto il codice, **nessuna prova diventava rossa**. Misurava
una coincidenza. Riscritta con un caso in cui le due risposte sono
**diverse**, ed è quella che ora si accorge.

---

## ⚠️ Cosa NON è verificato

1. 🔴 **Non l'ha visto un occhio**: il pannello del browser non produce
   immagini in questa sessione. Tutto quello che riporto sono **misure**
   prese interrogando la pagina — larghezze, bordi, millimetri — non una
   fotografia. Se a 5,0 mm il dito prenda il tavolo giusto **in servizio**
   resta una cosa che decide una mano, non un numero.
2. 🔴 **Non ho riprodotto il taglio esattamente coi numeri di Alessio**
   (736 visibili, calibrazione 74): a quelle misure la sala ci sta, con 55
   punti di margine. Il meccanismo è però lo stesso e la soglia dipende
   dalla calibrazione vera del suo tablet, che può non essere esattamente
   74. **Se dopo questa correzione dovesse rivederla tagliata, il difetto è
   un altro e va rimisurato sul suo apparecchio.**
3. ⚠️ **Lo stato «conto aperto» non l'ho misurato**: il tocco sulla pianta,
   comandato da qui dopo un ricaricamento, non risponde più (limite dello
   strumento, non dell'app). Gli altri due stati — sala libera e tavoli
   selezionati — sì.
4. ⚠️ **Le prove non guardano un disegno**: non c'è ambiente DOM. Provano la
   **geometria** (quali sagome cadono fuori), non come si vede.

---

## Cosa abbiamo rovesciato

**Una cosa, ed è del 18/08** — la larghezza minima della pianta in
centimetri reali, nata nel giro E per tenere i tavoli afferrabili col dito.
Racconto in [`decisioni_rovesciate.md` n. 27](../decisioni_rovesciate.md).

- **cosa era stato deciso**: la pianta non si rimpicciolisce sotto la
  larghezza che dà un bersaglio di 1,05 cm × 0,75; sotto quella soglia si
  scorre;
- **la ragione di allora**: un bersaglio troppo piccolo non si prende, e in
  servizio si paga;
- **cosa si decide adesso**: il disegno prende sempre la larghezza che c'è;
- **perché quella ragione non vale più** — ⚠️ e in parte **vale ancora, e
  questo è il prezzo che accettiamo**: un bersaglio piccolo si paga
  davvero, e sul telefono adesso lo paghiamo (5,0 mm contro i 5,3 provati).
  Ma la ragione era stata scritta **senza vedere l'altra faccia**: quel
  pavimento non faceva scorrere la sala, **la faceva sparire in parte**. E
  fra un tavolo un po' più piccolo e un tavolo che non c'è, il secondo non
  si può nemmeno toccare.

---

## 5 · I file

| file | cosa |
|---|---|
| `src/components/PiantaSala.jsx` | via il `min-width` in centimetri reali |
| `src/lib/calcoli/sala.js` | `sagomeFuoriDalDisegno()`, `bersaglioTavoloCm()`, `BERSAGLIO_PROVATO_CM` |
| `src/pages/comande/CalibrazioneTocco.jsx` | l'avviso dice i millimetri del bersaglio, non «sborderà» |
| `tests/unita/sala-misure.test.js` | 6 + 4 prove nuove (64 in tutto nel file) |
| `tests/app/aggancio-sala.test.js` | 2 prove sui dati veri |

**Suite**: 252 pure, 301 sui dati veri. Tutte verdi.

---

## 6 · Le due migrazioni applicate in produzione — i numeri veri

Applicate dopo il push di `3ba2928`, con `npm run migra -- --conferma`:
`20260821000004_la_prenotazione_servita` e
`20260821000005_i_turni_dei_pasti`, **2 su 2 registrate**.

⚠️ **Ne è entrata anche una seconda oltre ai turni, e va detto**: `…004` era
in coda dal 21/08, già consegnata e già pushata, e correggeva un difetto che
Alessio aveva trovato lui (a conto chiuso il tavolo tornava «prenotato»).
Lasciarla fuori avrebbe allargato lo scarto fra il codice online e il
database, che è la causa di tutto il pasticcio di stanotte.

| misura | prima | dopo |
|---|---|---|
| migrazioni registrate | **165** | **167** |
| `order_items.turno` | non esiste | c'è, predefinito **1** |
| righe di comanda al 1° turno | — | **16 su 16** (nessuna spostata) |
| `chiamate_turno` | non esiste | c'è, **0 biglietti** |
| stati di una prenotazione | 4 | **5** (`servita` in più) |
| prenotazioni | 3, tutte confermate | **3, tutte confermate** — nessuna toccata |
| conti aperti | 5 | **5** |
| conti totali · righe | 21 · 16 | **21 · 16** |
| tracce di cancellazione | 42 | **42** |
| movimenti di cassa | 0 | **0** |

✅ **`npm run consegne`**: 167 applicate, 61 sotto controllo, **nessun
arretrato**.
