# L'Agenda: quello che conta sta in cima — 30/08/2026

> **Blocco 3** del mandato del 30/08. Chiude la richiesta **A1** di
> [`docs/RICHIESTE.md`](../RICHIESTE.md) — quella che era rimasta **vuota**,
> perché nessuno sapeva più cosa fosse.
>
> **Il commit che sta sotto questo riepilogo: `f0ae198`.**
>
> **Nessuna migrazione.** Tutto quello che serviva — la stella, le corsie,
> l'anzianità — era **già nel database**: mancava il modo di leggerlo.

---

## 1. Il difetto, dalla sua schermata

**16 impegni, 14 in ritardo.**

- il testo andava a capo **cinque volte per riga**: «BASE-Portare i
  corrispettivi di luglio a Laura» occupava sei righe in una colonna larga
  un terzo dello schermo, **con spazio vuoto a destra**;
- **«rimanda» stava in tre posizioni diverse** a seconda della riga, perché
  era l'ultimo di una fila che cambiava lunghezza;
- **due stelle grigie e una gialla**, senza che niente dicesse cosa
  volessero dire.

⚠️ **E non è un problema di oggi**: con quattordici scaduti l'elenco è già
illeggibile, e a marzo sarà peggio. È la trappola dello scadenziario —
*un elenco che dice tutto non dice niente*.

---

## 2. Cosa c'è adesso

| sezione | si chiude? | cosa contiene |
|---|---|---|
| **★ Per me conta** | no | **tutte** le stellate, qualunque corsia |
| **In ritardo (15)** | sì, **chiusa di suo** | le scadute non stellate |
| Questa settimana | no | per giorno: Oggi, Domani, Giovedì 4… |
| Più avanti | sì, chiusa di suo | per mese |
| Quando capita | no | senza scadenza, con l'anzianità |

### 🔴 La stella adesso vuol dire qualcosa (3b, 3c)

La decisione di Alessio: **la stella porta l'impegno in cima**. Non è
un'etichetta «importante sì/no» — è **l'ordinamento**. *Una stella che
colora e basta è un gesto che non cambia niente, e infatti nessuno sapeva
cosa volesse dire.*

⚠️ **Una riga stellata ESCE dalla sua corsia**, non compare in tutt'e due:
una riga che sta in due elenchi fa credere di averla sistemata anche dove
non si è guardato. Provato con le mani ⬇︎.

⚠️ **E la legenda non si scrive**: nel titolo della sezione c'è **la stessa
stella dorata** che si vede sulle righe. Il segno spiega sé stesso stando
accanto a ciò che produce — è la regola del 18/08 (*una spiegazione va dove
sta il dubbio*) applicata invece che aggirata.

### Perché si chiudono quelle due e non le altre

Il criterio **non è la lunghezza**: è che «in ritardo» e «più avanti» sono
le uniche in cui *stare dentro l'elenco non è una notizia*. Quattordici
scadute non si leggono una per una — si guarda il numero, e si apre quando
si ha tempo. **Quello che va fatto adesso è già in cima**, perché lui ci ha
messo la stella.

### Il quadrotto (3a)

Con **`<ElencoAdattivo>`**, il componente dei quadrotti — non un secondo:
*una forma ricopiata è una forma che diverge*.

- **titolo grosso in cima**, che è l'unica cosa che si cerca scorrendo;
- **la spunta grande a sinistra**: è il gesto più frequente e si fa col
  pollice. Bersaglio **12,00 mm** (`tocco-azione`, non i 8,5 minimi);
- la **stella a destra** del titolo, stesso bersaglio;
- sotto, in piccolo: **Scadenza · Tipo · Da**, e l'anzianità dove serve;
- **«rimanda» in fondo, sempre nello stesso posto**. *Un comando che si
  sposta si cerca ogni volta.*

⚠️ **L'importo non è un campo, ed è giusto così**: in questo gestionale un
impegno non ha un importo suo — quando c'è, **sta dentro il titolo**
(«Pagare fattura #2026/003 — Ittica dello Stretto (2.268,93 €)»). Una
colonna vuota su tutte le righe tranne quelle è una riga in meno di quelle
che servono.

---

## 3. 🔴 Un difetto trovato misurando, ed è il secondo della stessa famiglia in una notte

La casella si tocca da **1,2 cm** dal 25/08 — il bersaglio era giusto. Ma il
**quadratino che si vede** era `h-5 w-5`, cioè **20 punti fissi**:

| densità | quadratino |
|---|---|
| 37,8 (monitor) | 5,29 mm |
| 59,5 (mini tablet 8,3") | **3,36 mm** |
| 64 (mini tablet 7,9") | **3,13 mm** |

⚠️ **È la stessa trappola dello stacco dei pulsanti di MEMO**, trovata la
stessa notte in un posto diverso: *una misura in punti resta uguale in punti
e si rimpicciolisce in millimetri veri man mano che lo schermo diventa
denso*. E un bersaglio grande con dentro un segno piccolo **si centra a
occhio, e a occhio si sbaglia**.

Ora è `.spunta-grande` in `index.css`: **6,00 mm veri a tutte e tre le
densità**, misurati.

---

## 4. Provato con le mani

Sul progetto di prova, con 21 impegni che chiedono attenzione:

1. **La stella sposta davvero.** Toccata su «Pagare fattura #2026/003»: la
   riga è passata da «In ritardo» a «Per me conta», e i due contatori si
   sono mossi insieme — **In ritardo 15 → 14**, **Per me conta 1 → 2**.
2. **E il numero accanto ad «Agenda» NON è cambiato: 21 prima e 21 dopo.**
   ⚠️ È la proprietà che conta: *la stella cambia dove si legge, non se è in
   ritardo*. Se il conteggio guardasse la sezione invece della corsia,
   stellare un impegno lo farebbe **sparire dal numero** — cioè il gesto che
   serve a non perderlo di vista lo nasconderebbe.
3. **Rimessa com'era** (stella spenta): 15 e 1, badge 21.
4. **«In ritardo» si apre e si chiude**, e dopo un ricarico è di nuovo
   chiusa.
5. **L'impegno nato da solo da una fattura archiviata c'è** (3d): «Pagare
   fattura #2026/003 — BASE-Ittica dello Stretto S.n.c. (2.268,93 €) · Da:
   Archivio documenti».

### Le misure

| | a 375 punti | a 1280 punti |
|---|---|---|
| scorrimento laterale della pagina | **0** | **0** |
| elementi che sbordano **dentro** un riquadro | **0** | **0** |
| bersaglio della spunta | 12,00 mm | — |
| quadratino della spunta | 6,00 mm | — |
| bersaglio della stella | 12,00 mm | — |
| «rimanda» | 8,50 mm | — |

**Gli stessi numeri a 37,8 · 59,5 · 64.**

✅ **E l'ho guardata con gli occhi**, sul telefono e sul computer.

---

## Cosa abbiamo rovesciato

**Niente.** Le quattro corsie decise il 14/08 restano le stesse, con gli
stessi nomi e lo stesso significato; il badge continua a contare solo
ritardo e oggi (regola del 14/08, che ora vive in una funzione provata
invece che dentro la schermata); «quando capita» continua a mostrare
l'anzianità per non diventare un cimitero.

**Quello che cambia è dove si guarda, non cosa il gestionale sa.**

---

## Rilettura obbligatoria

### Cosa NON ho verificato con gli occhi

- **Il calendario** (la seconda scheda dell'Agenda): non l'ho aperto. È
  rimasto identico — non l'ho toccato — ma «non l'ho toccato» non è «l'ho
  guardato».
- **«Fatto»**: non ho spuntato nessun impegno. Spuntare **chiude** una riga
  e può generarne una nuova (le ricorrenze), e rimetterla a posto non è
  simmetrico. Quindi il gesto più frequente della schermata è quello che
  **non** ho provato: è la voce più esposta di questa consegna.
- **«rimanda»**: ho verificato che il pulsante c'è ed è sempre nello stesso
  posto, **non** che il calendarietto che apre salvi la data.
- **La sezione «Fatti di recente»**: non toccata, non aperta.

### Cosa ho contato senza leggerlo

- I **630** test puri: contati dallo strumento.
- «15 in ritardo, 21 che chiedono attenzione»: sono numeri **del progetto di
  prova**, letti a schermo. In produzione ce ne sono 8 in tutto.

### Quali mie affermazioni sono diventate false mentre lavoravo

- Ho scritto la sezione «per me conta» come **non nascondibile e sempre
  presente**; poi, guardandola vuota, le ho aggiunto `nascondiSeVuota` —
  un titoletto vuoto in cima ogni giorno è rumore. Il commento nel codice
  dice adesso la versione buona.

### Quali conteggi sono pavimenti

- Lo **zero sbordo** è misurato sull'Agenda a due larghezze: è un pavimento
  sul resto del gestionale, non una proprietà generale.

### Cosa ho lasciato sul progetto di prova

🔴 **Una cosa, e la dichiaro perché nessun conteggio di righe la vedrebbe.**
Per provare che la stella sposta davvero l'ho accesa e spenta sull'impegno
`9aa374b5-a0ac-4f60-8ce2-242a4e2f09ca`. Il **valore è tornato esatto**
(`preferito = false`, controllato interrogando il database, non lo schermo),
ma la colonna **`updated_at` è cambiata**: era `2026-08-23 10:05:10`, adesso
è `2026-08-29 23:51:47`.

⚠️ **È esattamente il limite dichiarato il 26/08**: un guardiano che conta le
righe non vede una riga *modificata e lasciata modificata*. Nessuna riga
creata, nessuna cancellata, **nessuna lapide**.

### Blocchi non aperti

Questo è il Blocco 3. Il 2 (vini e bevande in magazzino), il 4 (i due punti
delle Comande), il 5 e l'Aggiunta 2 (Produzioni) seguono o sono dichiarati
alla fine della notte.
