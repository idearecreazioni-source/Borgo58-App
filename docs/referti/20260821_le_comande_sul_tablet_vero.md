# Le Comande misurate col tablet vero — non col monitor

**Misurato il 21/08/2026, su richiesta della validazione, dopo che Alessio ha
calibrato la simulazione al valore di un mini tablet e la pianta è sbordata.**

⚠️ **Questo referto NON propone una cura.** I numeri servono a una decisione
di Alessio, e la decisione dipende da questi numeri.

---

## 🔴 La lente era sbagliata per tutti e due

Tutte le misure con cui è stato disegnato il giro a due colonne sono state
fatte con `b58_pxcm` = **37,8** — la stima da monitor a 96 dpi. Le larghezze
riportate allora (menu 250, pianta 427) valgono **su un computer**, non sul
tablet a cui la schermata è destinata.

⚠️ **E l'errore ha due effetti che vanno nella stessa direzione**, il che è il
motivo per cui non si vedeva:

1. sul tablet i punti disponibili sono **meno** (768 o 744 contro i 960 di un
   monitor da 1280);
2. su quello stesso tablet **tutto ciò che è dimensionato in centimetri veri
   diventa più grande in punti** — una riga del menu passa da 40 a **67**
   punti, cioè **+69%**.

Il disegno è stato fatto con più spazio e con elementi più piccoli di quelli
veri.

---

## I numeri, alle tre calibrazioni

Calcolati sulle regole scritte nel codice: `sm:w-[62%]` per la pianta,
`gap-3` (12 pt), `main` con `px-4` sotto i 768 pt di viewport e `px-8` sopra,
barra laterale nascosta sotto i 1024.

| | monitor 1280 | monitor 1024 | **iPad mini 7,9"** | **iPad mini 8,3"** |
|---|---|---|---|---|
| `b58_pxcm` | 37,8 | 37,8 | **64,0** | **59,5** |
| viewport | 1280 | 1024 | 768 | 744 |
| contenuto utile | 960 | 704 | **704** | **712** |
| colonna pianta (62%) | 595 | 437 | **437** | **441** |
| colonna menu | 353 | 256 | **256** | **259** |
| pianta: minimo richiesto | 341 | 341 | **577** | **536** |
| **sbordo** | — | — | **140 pt** | **95 pt** |
| pannello dei gesti | 298 × 809 | 218 × 593 | **288 × 784** | **268 × 729** |
| banco bar | 298 × 139 | 218 × 102 | **288 × 134** | **268 × 125** |
| riga del menu (altezza minima) | 39,7 | 39,7 | **67,2** | **62,5** |
| badge / pulsantino (lato) | 32,1 | 32,1 | **54,4** | **50,6** |
| azione principale (altezza) | 45,4 | 45,4 | **76,8** | **71,4** |
| spazio per il **nome** del piatto | 246 | 148 | **126** | **133** |

⚠️ **La pianta non si rimpicciolisce sotto il suo minimo**: quando la colonna
è più stretta, la pianta esce e la pagina scorre di lato. È esattamente
quello che Alessio ha visto.

---

## Quanti punti servono davvero al menu

Lo spazio per il nome è quello che resta dopo il resto della riga:

```
colonna menu − padding (8+8) − spazi (8+8) − prezzo (~43) − «+» (0,85 cm)
```

Sul tablet restano **126 punti** (7,9") o **133** (8,3"), contro i 246 di un
monitor da 1280.

⚠️ **A quanti caratteri corrispondono, e con che precisione**: a `text-sm`
(14 pt) e con una larghezza media di **mezzo em** per il minuscolo misto,
fanno **≈ 18 caratteri per riga**. La larghezza media è una **stima
dichiarata**, non una misura: dipende dal font di sistema del dispositivo, e
per misurarla davvero serve il tablet.

🔴 **E non esiste una carta vera su cui provarlo.** In produzione ci sono
**zero ricette e zero menu**; sul progetto di prova ce n'è **una sola**, e si
chiama *«Piatto di prova»* — 15 caratteri, che ci starebbero. **Nessuno dei
nomi che Alessio userà davvero è mai stato messo in quella riga**, e nomi da
osteria («Paccheri con ragù di maialino nero», «Sarde a beccafico») ne hanno
fra 17 e 35.

⚠️ Il nome **va a capo** (scelta di Alessio del 21/08), quindi non si taglia:
diventa una riga alta il doppio. Con 18 caratteri per riga, buona parte della
carta occuperebbe **due righe** — e a 67 punti l'una fa 134 punti a piatto.

---

## Da dove vengono 1,05 e 0,75 — la domanda che decide se la soglia si può
## discutere

La soglia della pianta è `(1030 / 90) × 1,05 × 0,75 = 9,01 cm reali`. I due
fattori hanno origini **diverse**, e la differenza è tutto:

**`1,05` cm — è una CONVENZIONE presa da fuori, non una misura.** Viene da
§3.2.1 del brief, come bersaglio minimo di tocco. ⚠️ **E la realtà l'ha già
smentita, con le mani di Alessio**: il 18/08, provando la pianta rimpicciolita,
ha detto che **a ~5,3 mm i quadrati si prendono bene** — *«è proprio tutto
perfetto»*. È l'unico numero di questo progetto **misurato su un gesto vero**.

**`0,75` — è una misura, ma di un altro schermo.** È il minimo necessario per
far entrare la pianta nel telefono di Alessio (390 punti, minimo esatto
0,788) arrotondato in giù per margine. Non descrive il dito: descrive un
iPhone.

**Quindi il bersaglio effettivo di un tavolo da 90 cm oggi è**
`1,05 × 0,75 = 0,79 cm`, cioè **7,9 mm** — contro i **5,3 mm** che lui ha
provato e approvato.

⚠️ **La soglia si può discutere**, e questo è il numero che serve alla
decisione: portandola a 5,3 mm — *quello che Alessio ha provato con le mani*
— la pianta in piedi chiederebbe **6,07 cm reali**, cioè:

| | iPad mini 7,9" | iPad mini 8,3" |
|---|---|---|
| minimo a 5,3 mm | **388 pt** | **361 pt** |
| colonna disponibile | 437 | 441 |
| | **ci sta** | **ci sta** |

**Non è una proposta**: è la misura che dice che *una* delle strade possibili
esiste. Le altre — pianta sopra e menu sotto, pianta che scorre, colonne
diverse — dipendono da cosa lui vuole vedere insieme, e non le decido io.

---

## ✅ I due difetti minori dello stesso collaudo

**1 · «Chiudi» → «Chiudi conto» — corretto.** Avevo accorciato l'etichetta per
farla stare nella colonna dei gesti **e non l'avevo dichiarato**. Su «Invia»
l'accorciamento passa; qui no: in sala **«chiudi» vuol dire incassare**, ed è
la ragione per cui l'uscita dal conto si chiama «Lascia il tavolo aperto».
Accanto a «Preconto», un cameriere di fretta può leggerlo come «chiudi questo
riquadro» — e invece incassa.

**2 · «Cambia tavoli» e «‹ Lascia … aperto» — ci sono, ma sono fuori
schermo.** ⚠️ **Non si sono persi: sono diventati irraggiungibili**, ed è una
misura, non un'ipotesi. Stanno sotto la pianta, e la pianta in piedi è alta
quanto è larga per due:

| | pianta | i due gesti cadono a |
|---|---|---|
| iPad mini 7,9" | 577 × **1159** pt | **~1279 pt** dall'alto (schermo alto 1024) |
| iPad mini 8,3" | 536 × **1078** pt | **~1198 pt** (schermo alto 1133) |

Per raggiungerli bisogna scorrere **oltre tutta la pianta**. ⚠️ **Non li ho
spostati**: dove vadano è parte della stessa decisione sul disegno delle due
colonne, e muoverli adesso vorrebbe dire deciderla di nascosto.

---

## ⚠️ E una regola che vale da adesso in avanti

> **Ogni misura su una schermata operativa si fa col valore del TABLET, non
> con la stima da computer.**

Il valore di partenza (`PXCM_DEFAULT` = 37,8) è la stima a 96 dpi di un
monitor: è giusto come punto di partenza per la calibrazione, ed è **sbagliato
come lente per progettare**. Le schermate operative — Comande, la pianta, il
Calendario in servizio — vivono su un mini tablet, dove **un centimetro vale
64 punti invece di 38**.

Scritto in `CLAUDE.md` §6 e in testa a `src/lib/touch.js`, dove chi va a
misurare passa per forza.
