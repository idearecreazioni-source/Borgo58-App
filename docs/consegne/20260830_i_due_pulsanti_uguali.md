# I due pulsanti di MEMO, uguali davvero — 30/08/2026

> **Aggiunta 1** al mandato del 30/08. Chiude **V4** e **V5** di
> [`docs/RICHIESTE.md`](../RICHIESTE.md).
>
> **Il commit che sta sotto questo riepilogo: `06eaaab`.**
>
> **Nessuna migrazione.**

---

## 1. La cura del 29/08 non era bastata, e il perché è misurabile

Alessio, guardando le due schermate: *«i due pulsanti sono rimasti in fondo
alla schermata, **attaccati**. Lo stacco che hai messo ieri — da 12 a 13
punti — **non è uno stacco**.»*

Aveva ragione due volte, e la seconda non si vedeva.

### 🔴 «0.5cm» in CSS non è mezzo centimetro

**MISURATO** sul pulsante «Fotografa» prima di toccare niente, a 375 punti,
alle tre densità che questo progetto usa:

| densità (punti per cm) | stacco dal bordo | in punti |
|---|---|---|
| **37,8** — la stima di un monitor | 5,00 mm | 19 |
| **59,5** — un mini tablet da 8,3" | **3,17 mm** | 19 |
| **64** — un mini tablet da 7,9" | **2,95 mm** | 19 |

⚠️ **Diciannove punti su ogni schermo.** L'unità `cm` del CSS vuol dire *96
punti per pollice*, cioè la stima di un monitor: non è il centimetro vero di
questo progetto, che vive in `--pxcm` ed è calibrato col righello.

🔴 **Quindi lo stacco si rimpiccioliva proprio dove le mani sono occupate** —
sul tablet in cucina, che è il posto per cui esiste. L'altezza del pulsante
invece era già in centimetri veri (`tocco-azione`) e infatti restava 12 mm
ovunque: **le due misure erano scritte in due unità diverse dentro lo stesso
pulsante**, e nessuna delle due lo diceva.

---

## 2. Cosa è cambiato

| | prima | adesso |
|---|---|---|
| stacco dal bordo | 19 punti fissi (2,95–5,00 mm) | **1 cm vero** |
| altezza | 12 mm (`tocco-azione`) | **15 mm** (`tocco-azione-grande`) |
| testo | `testo-sala` su «Fotografa» | **6 mm** (`testo-sala-lontano`) su tutti e due |
| sfondo di «Fotografa» | `bg-stone-700` | **`bg-b58-charcoal`**, come «Premi e parla» |
| forma | `rounded-md` | `rounded-xl`, come l'altro |
| simbolo | nessuno | **📷**, come 🎙 sull'altro |

⚠️ **Le due misure vivono in `index.css`, non nelle schermate**: i pulsanti
che le usano sono due, e due numeri ricopiati si separano al primo ritocco.
La classe nuova si chiama `.tocco-azione-grande` e sta accanto a
`.tocco-azione`, che **resta** il minimo di un'azione principale qualunque:
1,5 cm è il caso in cui **l'azione è una sola e si fa in piedi**.

⚠️ **L'emoji sta nel valore predefinito del componente**, e la riga che la
scriveva a mano in `Fotografa.jsx` è stata **tolta**: scritta in due posti,
il giorno che cambia resta indietro proprio la schermata per cui è stata
decisa. Chi passa un'etichetta sua (la scheda di un prodotto dice
«Fotografa l'etichetta») continua a decidere anche il simbolo.

---

## 3. La prova: identici numero per numero

**MISURATO** dopo, sulle due schermate, a 375 punti e alle tre densità:

| | MEMO foto | MEMO voce |
|---|---|---|
| testo | 📷 Fotografa | 🎙 Premi e parla |
| altezza | **15,00 mm** | **15,00 mm** |
| stacco dal bordo | **10,00 mm** | **10,00 mm** |
| corpo del testo | **6,00 mm** | **6,00 mm** |
| larghezza | **343** punti su 375 | **343** punti su 375 |
| sfondo | `rgb(43, 38, 33)` | `rgb(43, 38, 33)` |
| scorrimento laterale | **0** | **0** |

**Gli stessi identici numeri a 37,8 · 59,5 · 64.** È una **proprietà**, non
una misura che invecchia: le due grandezze sono espresse nell'unità che
scala col dispositivo.

✅ **E le ho guardate con gli occhi**, tutt'e due, a 375 punti. Il pulsante
è lo stesso rettangolo scuro, alla stessa altezza da terra, largo uguale.
Cambia la parola e cambia il simbolo.

🔴 **E qui c'è una cosa che vale oltre questa consegna: in questo ambiente
lo screenshot FUNZIONA.** Le note di progetto dicono da giorni *«nessuna
immagine è stata guardata, lo screenshot non funziona in questo ambiente»*,
e stanotte ha funzionato al primo tentativo. **Quella frase era diventata
falsa** e nessuno l'aveva rimessa alla prova: da adesso una schermata si
guarda, non solo si misura dal DOM.

---

## 4. La regola in `DECISIONI.md` adesso porta i numeri (V5)

La voce del 29/08 — *l'azione principale sta in fondo, larga quanto lo
schermo, staccata dal bordo* — diceva **dove**, non **quanto**. È per questo
che è rinata con 13 punti.

Adesso dice anche: **1 cm vero di stacco, 1,5 cm veri di altezza, 6 mm di
testo**, e dichiara perché «vero» è metà della decisione e non un
rafforzativo, con la misura dei 19 punti accanto.

---

## Cosa abbiamo rovesciato

**Niente.** Nessuna decisione in vigore è stata contraddetta: la voce del
29/08 non viene rovesciata, viene **completata** con i due numeri che le
mancavano. La regola del 27/08 sulla barra del pollice — *vale solo dove
l'azione è UNA SOLA* — è intatta, ed è la ragione per cui il Ricettario, di
gesti, non ne ha nessuno inchiodato in fondo.

---

## Rilettura obbligatoria

### Cosa NON ho verificato con gli occhi

- **Un telefono vero.** Tutto è misurato nel browser a 375 punti, con la
  densità forzata a mano. La calibrazione col righello di Alessio non è
  stata usata: le tre densità sono quelle scritte in CLAUDE.md.
- **La barra di sistema di iPhone** (`env(safe-area-inset-bottom)`): nel
  browser vale 0, quindi lo stacco misurato è **il minimo**. Su un iPhone
  con la barra sarà 1 cm **più** l'inset — voluto, mai visto.
- **Il pulsante «Togli»** che compare accanto a «Fotografa» quando la foto
  c'è già: non ho scattato nessuna foto, quindi non l'ho visto convivere col
  pulsante più grande. È la voce più esposta di questa consegna.

### Cosa ho contato senza leggerlo

- Che `etichettaPulsante` fosse passata solo in due posti: è una ricerca nel
  codice, non una lettura di tutte le schermate.

### Quali mie affermazioni sono diventate false mentre lavoravo

- Ho scritto nel riepilogo del Ricettario, poche ore fa, che *«nessuna prova
  di questo progetto guarda una schermata»* — vero per le prove automatiche,
  **ma la frase generale «lo screenshot non funziona in questo ambiente»,
  che questo progetto si porta dietro da giorni, è falsa**: ha funzionato.

### Quali conteggi sono pavimenti

- **«due posti che passano un'etichetta»**: è quello che la ricerca trova
  oggi.

### Cosa ho lasciato sul progetto di prova

**Niente.** Nessuna riga scritta, nessuna cancellata, nessuna lapide.

### Blocchi non aperti

Questa è solo l'Aggiunta 1. Gli altri seguono.
