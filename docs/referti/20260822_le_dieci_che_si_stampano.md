# Le dieci che si stampano — misurate sulla CARTA, non sullo schermo

**Blocco 3 del mandato del 22/08.** 🔴 **Misura e referto: non è stato
corretto niente**, per richiesta esplicita di Alessio — *«la carta è l'unica
cosa che non possiamo provare davvero finché non arriva la stampante, e
voglio sapere cosa ci aspetta prima di metterci le mani»*.

---

## Come è stata fatta la misura, e perché il primo tentativo era falso

Le regole di stampa non si vedono guardando lo schermo: vivono dentro
`@media print`, e finché non si stampa non fanno niente. Le ho **estratte e
applicate per davvero** alla pagina viva, così ciò che si misura è la carta.

🔴 **Il primo tentativo ha misurato il falso, e me ne sono accorto solo
perché ho preteso una controprova.** Girando `document.styleSheets` avevo
raccolto **3 regole** — quelle scritte a mano in `index.css` — e **nessuna**
delle `print:` di Tailwind, che sono la quasi totalità. La pagina risultava
«tutta visibile», e il referto avrebbe detto che sulla carta finiscono 20
elementi dimensionati per lo schermo. **Erano zero.**

⚠️ Due difetti miei, in fila, e valgono come metodo:
1. le regole stavano in un foglio che l'attraversamento non raggiungeva → le
   ho lette **dal testo** dei fogli, bilanciando le graffe;
2. il mio controllo di visibilità guardava **l'elemento e non i suoi
   antenati**, quindi contava come stampata la barra laterale, che è dentro
   un contenitore nascosto.

**Da allora ogni misura parte da una controprova**: un elemento `print:hidden`
dev'essere `display: none`, altrimenti lo strumento non sta simulando niente.
*Una misura sbagliata è peggio di nessuna misura, perché ha l'aria di un
fatto.*

---

## 1 · Le sette in A4 — nessuna sborda

Carta utile: **190 mm** (A4 meno i margini di Chrome).

| schermata | larghezza | tabella più larga | testo | in `--pxcm` sulla carta |
|---|---|---|---|---|
| `/haccp/manuale` | 190 | 181,5 | 3,17 – 6,35 | **0** |
| `/magazzino/tracciabilita` | 190 | 181,5 | 3,70 – 6,35 | **0** |
| `/agenda/adempimenti` | 190 | 181,5 | 3,17 – 6,35 | **0** |
| `/editor-menu` | 190 | — | 4,23 – 6,77 | **0** |
| `/fiscale/deduzioni` | 190 | — | **2,91** – 6,35 | **0** |
| `/ricettario/ricette/:id` | 190 | — | — | **0** |
| `/personale/:id` | 190 | — | — | **0** |

✅ **Niente si taglia**: zero elementi più larghi della carta, in tutte e
sette. Le tabelle si fermano a 181,5 mm.

✅ **E il giro delle misure di oggi non ha sporcato la carta**, che era il
rischio vero: le classi `tocco-bottone` e `testo-sala` sono dimensionate in
`--pxcm`, cioè in una misura dello **schermo** che sulla carta non vuol dire
niente. Su tutte e sette **non ne arriva nessuna**, perché i ritorni e i
comandi stanno dentro blocchi `print:hidden`.

---

## 2 · La termica da 80 mm — **72 mm esatti**, e indipendente dal tablet

| | larghezza | altezza | testo | sborda |
|---|---|---|---|---|
| biglietto cucina *(5 piatti, 3 turni, una nota lunga)* | **72,0 mm** | 101,9 mm | 3,17 – 6,35 | no |
| preconto *(5 piatti)* | **72,0 mm** | 66,8 mm | **2,65** – 3,70 | no |

✅ **La cosa che avevo dato per rotta e non lo era.** Sospettavo che il
biglietto cambiasse taglia col dispositivo da cui si stampa, visto che il
testo delle Comande è in `--pxcm`. **Misurato con tre calibrazioni — 74
(tablet 7,9"), 59,5 (8,3"), 37,8 (computer) — il ticket esce identico**:
72 mm di larghezza, stesse taglie di testo. Le varianti `print:` scavalcano
le classi dello schermo, ed è esattamente quello che il commento in
`Cucina.jsx` dichiarava di fare. *L'ipotesi era ragionevole e la misura l'ha
smentita.*

---

## 3 · 🔴 Quello che ci aspetta — quattro cose, in ordine

### 1. `/editor-menu/giorno` stampa un **foglio bianco**

Misurato: **246 caratteri sullo schermo, 0 sulla carta.** Tutto quello che
c'è — titolo, spiegazione, comandi — è `print:hidden`, e la parte stampabile
esiste solo quando un giorno è **selezionato**. Chi apre la pagina e preme
«Stampa» senza aver scelto il giorno ottiene **un foglio vuoto**, senza che
niente glielo dica.

⚠️ **Non misurato col giorno scelto**: sul progetto di prova non c'è nessun
menu del giorno. Quindi so che il caso vuoto stampa bianco; **non so** come
esce quello pieno.

### 2. Il preconto ha il testo **più piccolo di tutti** — e lo legge il cliente

**2,65 mm**, contro i **3,17** del biglietto che legge il cuoco in cucina.
È il documento che si mette in mano a una persona seduta, spesso con la luce
bassa di una sala la sera, e magari con la vista di uno che gli occhiali li
ha lasciati a casa.

⚠️ *La riga più piccola dell'intero gestionale stampato è quella su cui un
cliente controlla quanto deve pagare.*

### 3. `/fiscale/deduzioni` scende a **2,91 mm**

Due elementi sotto i 3 mm sul prospetto che va al commercialista. Gli altri
documenti stanno a 3,17 o sopra.

### 4. Scheda ricetta e scheda dipendente escono come **moduli, non documenti**

Sulla carta finiscono i campi di modifica — le caselle di testo e i menu a
tendina con dentro il valore scelto — invece di righe di testo composte. Si
legge, ma un foglio così sembra la fotografia di una schermata, non un
documento da consegnare.

⚠️ Sul dossier del dipendente la cosa pesa di più: è il foglio che si porta
a un consulente del lavoro.

---

## 4 · Il manuale HACCP, guardato per la domanda che conta

Il mandato chiedeva: **è leggibile e completo?**

- **Leggibile**: il corpo del testo sta a **3,70 mm**, i titoli a 4,76 e
  6,35, il minimo è 3,17. Nulla sborda, le tabelle stanno dentro i 181,5 mm.
- **Completo, e lo dichiara**: in testa stampa il periodo delle registrazioni
  (*«dal 23 lug 2026 al 22 ago 2026»*) e la regola che *«le non conformità
  aperte sono sempre incluse»*.
- ✅ **E soprattutto dichiara quando NON è completo, sulla carta**: l'avviso
  dei registri letti a metà **non ha `print:hidden`**, con accanto la ragione
  scritta nel codice — *nasconderlo alla stampa lascerebbe il foglio a
  dichiarare una cosa che non sa*. È la regola del 19/08, ed è rispettata nel
  punto dove serve: il destinatario di quel foglio non è chi sta davanti allo
  schermo, è chi viene a controllare.

---

## ⚠️ Cosa NON è verificato

1. 🔴 **Nessuna carta è uscita da una stampante.** Tutto è misurato
   applicando le regole di stampa alla pagina viva. Una termica vera ha un
   suo comportamento — margini del rullo, resa del nero pieno, quanto scalda
   il font — che nessuna simulazione dà.
2. 🔴 **Il preventivo del cliente non è stato misurato**: sul progetto di
   prova ci sono **zero preventivi**, e la pagina di dettaglio non si apre
   senza. È l'unica delle dieci di cui non so niente.
3. ⚠️ **`/editor-menu/giorno` con un giorno vero** non è stato visto.
4. ⚠️ **I 190 mm sono i margini predefiniti di Chrome**: chi stampa può
   stringerli o allargarli, e il numero cambia.
5. ⚠️ **Le liste erano quasi vuote** (0 preventivi, 0 spese deducibili, 2
   lotti): un documento con quaranta righe può andare a capo in modi che
   queste misure non hanno incontrato.

---

## Cosa abbiamo rovesciato

**Niente.** Nessuna riga di codice è stata toccata in questo blocco.

---

## 5 · I dati costruiti per misurare, e tolti

Per misurare la termica serviva un ticket vero: aperto un conto su **T5** con
5 piatti su 3 turni e una nota lunga — il caso che stressa la carta.
**Annullato** subito dopo, non chiuso: chiudere avrebbe scritto un incasso.
Controllato: **0 conti aperti**, movimenti di cassa **invariati a 2**.
