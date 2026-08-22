# Una sala tagliata si denuncia — e il taglio segnalato non l'ho trovato

**Nato da**: il rilievo *«la pianta si taglia ancora, e i numeri dicono che
non dovrebbe»*, con l'ordine di andare a guardare invece di dedurre.
**Nessuna migrazione.**

---

## 1 · Sono andato a guardare, e non l'ho trovato

Aperte le Comande sul progetto di prova, con l'accesso di collaudo, a
**800 × 1280** e calibrazione **74**, dopo la correzione `b07ef8e`.
Misurato, non dedotto:

| domanda | risposta |
|---|---|
| quanti SVG nella pagina | **19**, ma 18 sono icone da 24×24; **uno solo è la pianta** (13 sagome, `viewBox 0 0 1030 2070`) |
| la pianta | x **32** → destra **753**, larga **721** |
| sagoma più a destra | Divano 1/2/3 e Chef Table, bordo a **743** |
| oltre il bordo della finestra (800) | **nessuna** |
| oltre il bordo del disegno | **nessuna** |
| **qualunque elemento** dentro l'SVG fuori dai suoi bordi — testi compresi | **nessuno**, zero su tutto il contenuto |
| antenati che ritagliano | nessuno: `max-w-3xl` sta a 721, `MAIN` a 785, l'unico `overflow:hidden` è l'SVG stesso e il suo contenuto ci sta dentro |

**Sul telefono e sul tablet la sala è girata di un quarto**, quindi il
*fondo* della stanza diventa il *bordo destro* dello schermo: sono i divani,
la Chef Table e i tavoli T5·T7·T9. Sono esattamente le sagome che si
sospettavano tagliate — e stanno tutte dentro, con **10 punti di margine**.

⚠️ **Ho anche controllato che la sala della prova sia la stessa del
gestionale vero**, perché stavo per dare per scontato che lo fosse: le 13
sagome coincidono, coordinate comprese.

## 🔴 E il mio primo «l'ho visto» era un artefatto

Non potendo fotografare la pagina dal pannello di questa sessione, ho aperto
la stessa schermata nel **Chrome vero**. La fotografia mostrava **T7 tagliato
a metà dal bordo destro**: sembrava la prova provata.

**Non lo era.** I numeri della stessa pagina: finestra **1536**, pianta da
506 a 1274, sagoma più a destra a **1263** — tutto dentro. La fotografia era
**1254 punti di larghezza per una finestra da 1536**: era l'immagine a essere
**ritagliata**, non la sala.

⚠️ **E questo vale come reperto**, perché la fotografia mostrava esattamente
il difetto descritto — *mezza sagoma con la lettera e il resto fuori*. È la
stessa forma di quello che questo progetto insegue da giorni: **una risposta
più corta che ha l'aria di essere intera**, stavolta in una fotografia invece
che in un elenco. *Una lettura non è una misura* — vale per un'immagine
quanto per una riga di database.

---

## 2 · Cosa ho costruito lo stesso, e perché

Non aver trovato il taglio **non chiude la questione**: l'ho cercato su un
tablet che non è il suo, con una calibrazione che ho impostato io. Quello che
mancava davvero è il terzo controllo, quello che il rilievo chiedeva.

Le tre domande, adesso tutte e tre coperte:

| domanda | dove vive | da quando |
|---|---|---|
| il **riquadro** entra nella pagina? | prova pura, `marginePiantaInPiedi` | 21/08 |
| la **sagoma** sta dentro il foglio? | prova pura, `sagomeFuoriDalDisegno` | 22/08 mattina |
| 🔴 la sagoma sta dentro **quello che si vede**? | **nella schermata, a ogni disegno** | adesso |

🔴 **La terza non poteva essere una prova automatica**, ed è il punto: non è
geometria della sala, è geometria della *pagina* — dipende da ogni antenato,
da un margine, da un ritaglio che nessuno ha misurato. In questo progetto le
prove non hanno una pagina. **Quindi il controllo vive nel browser e parla**:
se una sagoma non ci sta per intero, sopra la pianta compare

> **Attenzione: la sala non si vede tutta.** Non ci stanno per intero T5, T7,
> Divano 1, Divano 2, Divano 3, Chef Table. Gira il tablet o allarga la
> finestra: quello che non si vede non si può toccare.

⚠️ **La decisione è separata dalla misura**: `sagomeTagliateDallaVista()` è
pura e si può rompere senza un browser; la schermata le passa i rettangoli
veri. È la stessa divisione di `email_conferma_dovuta()` — *chi decide non è
chi guarda*.

⚠️ **Sta dentro il riquadro della pianta, non in cima alla pagina**: il
dubbio nasce guardando la sala, e lì deve trovare risposta. E non sparisce da
sola.

---

## 3 · Le rotture — e le due che hanno trovato qualcosa

**Sulla decisione, tre rotture pure** (poi rimesse a posto):

| cosa ho rotto | quale prova è diventata rossa |
|---|---|
| guarda il centro della sagoma invece del bordo | le 3 sul bordo, fra cui *«anche mezza sagoma conta»* |
| tolleranza da mezzo punto a cinquanta | le stesse 3 |
| senza riquadro grida invece di tacere | *«senza riquadro non inventa un allarme»* |

**Sul guardiano vivo, la rottura vera**: ho **rimesso nel codice il pavimento
in centimetri reali** che avevo tolto stamattina — cioè ho riprodotto il
difetto — e ho ricaricato a 600 punti. La striscia è comparsa e ha nominato
**sei sagome: T5, T7, Divano 1, Divano 2, Divano 3, Chef Table**, che sono
esattamente le sei che avevo misurato stamattina. Poi il pavimento è stato
ritolto e la striscia si è spenta.

### 🔴 E guardando ho trovato due difetti miei, che né il lint né la compilazione vedevano

1. **La pianta non si disegnava affatto**: *«Maximum update depth exceeded»*.
   Il controllo gira dopo ogni disegno e restituisce ogni volta un elenco
   nuovo: scriverlo sempre faceva ridisegnare, che faceva ricontrollare,
   all'infinito. Ora si scrive **solo se è cambiato**. ⚠️ *La compilazione
   passava e il lint pure: un guardiano scritto male non rompe il programma
   in modo silenzioso — lo rompe del tutto, e lo si vede solo aprendolo.*
2. **Il guardiano dormiva**: osservava solo il riquadro, non il disegno. Ora
   guarda tutti e due.

⚠️ **Limite dichiarato, trovato provando**: il guardiano si sveglia quando
cambia il disegno (React ridisegna) o quando cambia la taglia di riquadro e
disegno. **Non** si sveglia se qualcuno altera lo stile dall'esterno senza
passare da nessuna delle due strade — è quello che ho fatto io per primo dal
console, ed è il motivo per cui la prima rottura sembrava fallita. Nessun
percorso vero del programma passa di lì; ma va scritto, perché la prossima
volta quella prova sembrerà di nuovo negativa.

---

## ⚠️ Cosa NON è verificato

1. 🔴 **Il taglio segnalato resta senza spiegazione.** Con tutti gli
   strumenti che ho, sulla stessa taglia di schermo e la stessa
   calibrazione, non c'è. **Adesso però non serve più cercarlo a mano**: se
   c'è, la prossima volta che Alessio apre quella schermata **il gestionale
   lo dice da solo**, e nomina le sagome. È l'unica risposta onesta che
   potevo dare a un difetto che non riesco a riprodurre.
2. 🔴 **Non l'ha visto un occhio**: il pannello del browser di questa
   sessione non produce immagini, e l'unica fotografia che sono riuscito a
   fare era ritagliata e mi ha ingannato. Quello che riporto sono misure.
3. ⚠️ **Lo stato «conto aperto» non è stato misurato**: il tocco sulla
   pianta comandato da qui non risponde più dopo un ricaricamento — limite
   dello strumento, non dell'app. È lo stato in cui Alessio stava
   collaudando, e resta l'ipotesi più viva.
4. ⚠️ **La striscia non l'ha vista una mano**: so che compare e cosa dice,
   non se si nota mentre si lavora.

---

## Cosa abbiamo rovesciato

**Niente.** Nessuna decisione cambia: il disegno continua a prendere la
larghezza che c'è (n. 27, di stamattina), le soglie restano dove sono, i
sette controlli del 21/08 restano tutti. Si **aggiunge** un guardiano.

---

## 4 · I file

| file | cosa |
|---|---|
| `src/lib/calcoli/sala.js` | `sagomeTagliateDallaVista()` — la decisione, pura |
| `src/components/PiantaSala.jsx` | la misura sulla pagina vera, l'osservatore su riquadro **e** disegno, la striscia |
| `tests/unita/sala-misure.test.js` | 6 prove nuove (76 nel file) |

**Suite**: 258 pure, 301 sui dati veri. Tutte verdi.

---

## 5 · Cosa serve da Alessio

1. **Il push**, e poi riaprire la schermata dove l'aveva vista tagliata:
   **se il taglio c'è, adesso la striscia lo dice e nomina i tavoli**. Quella
   frase è la misura che a me manca.
2. Se la striscia **non** compare e la sala **sembra** ancora tagliata:
   allora quello che sta guardando è una fotografia ritagliata, non la sala —
   è successo a me un'ora fa.
