# Consegna del 14/08/2026 — gli ordini ai fornitori

**Commit della consegna: `633f2e2`** (questo riepilogo è il commit
immediatamente sopra, sola documentazione). Working tree pulito.

| Commit | Cosa |
|---|---|
| `ba88328` | gli ordini nella lingua del fornitore — `20260814000001` |
| `633f2e2` | stato della produzione dopo l'applicazione |

**Applicata in produzione**: `20260814000001`. **87 migrazioni**.
`operazioni-atomiche` reinstallata (**v16 → v17**).

È la **Fase B del mandato «filiera della spesa»**. Con la Fase A di ieri
sera, il mandato è **chiuso** salvo la Fase C, che aspetta la dettatura
del Ricettario.

---

## 1. La Fase A si è riempita da sola, per la prima volta

Prima della migrazione, guardando la produzione col connettore: Alessio
aveva scritto **due scorte minime** (melanzane 10 kg, mandorle 5 kg) e la
lista della spesa aveva **due righe nate da sole**. Nessuno gliele ha
chieste.

È la prima volta che questa catena produce qualcosa senza che sia stato
un comando a farla partire — e con la melanzana è capitato anche il caso
che serviva: la giacenza è tornata a 10, e la riga adesso dichiara **«ora
ce n'è abbastanza»** invece di far ricomprare.

Nessuna delle due righe ha un fornitore assegnato, quindi nella schermata
degli ordini finiscono nel riquadro **«righe senza fornitore»** — che è
il comportamento voluto, non un buco: non entrano in nessun ordine finché
non dice a chi chiederle.

---

## 2. L'ordine parte nella lingua del fornitore

Lui non sa cos'è il «Pomodoro ciliegino»: sa cos'è la «cassa da 6 kg di
Pachino IGP». Quella dicitura il gestionale ce l'aveva già —
`articoli_fornitore`, costruita il 12/08 leggendo le fatture — e questa
fase la usa **nel verso opposto**: non più «capire cosa mi ha fatturato»,
ma «chiedergli quello che mi serve chiamandolo come lo chiama lui».

### Il gestionale non manda niente

Prepara il testo, lo fa correggere, e apre **WhatsApp sul telefono di
Alessio, col suo numero**. Un ordine che parte da solo è un ordine di cui
nessuno si è accorto — e la merce arriva lo stesso.

⚠️ **«Inviato» qui vuol dire «ho aperto WhatsApp con questo testo».** Il
gestionale non può sapere se ha premuto invio, e non deve fingere di
saperlo: la schermata lo dice, e annullare l'ordine riporta le righe in
lista. Registrarlo comunque **non è facoltativo**: senza registrazione la
fase nasce cieca, e la riconciliazione con la fattura — fuori perimetro,
ma prevista dal mandato — non avrebbe niente contro cui confrontare.

---

## 3. Tre trappole, tutte già viste in altra forma qui dentro

### Le unità, di nuovo — stavolta sulle quantità

Il 12/08 un `fattore` sbagliato produceva un prezzo al chilo errato di
sei volte e la sorveglianza taceva sui rincari veri. **Lo stesso numero
adesso decide quante casse chiedere.**

Servono 10 kg, la cassa è da 6 → **2 casse, non 1,67**: nessuno vende due
terzi di cassa, e si arrotonda **per eccesso** perché mancare merce costa
più che avanzarne. La riga porta **tutti e due i numeri** («2 casse — ti
servono 10 kg»), così un fattore sbagliato si vede **prima di premere
invio** invece che alla consegna.

### Se non so come lo chiama lui, lo dico

Un ingrediente senza dicitura per quel fornitore finisce nel testo col
**nome interno**, e la riga è marcata *«non so come lo chiama lui»*. Mai
far credere che sia il suo nome: un ordine con la parola sbagliata si
risolve con una telefonata, un ordine che **sembra** nella sua lingua fa
arrivare la merce sbagliata.

### Lo zero del prefisso non si toglie

In quasi tutto il mondo il prefisso urbano perde lo zero passando al
formato internazionale. **In Italia no**: `+39 0932 123456` è la forma
giusta. Toglierlo manderebbe l'ordine a un numero diverso da quello in
rubrica — e il messaggio parte lo stesso, verso uno sconosciuto, senza
che nessuno se ne accorga.

⚠️ E un numero è «già internazionale» solo se comincia per `39` **ed** è
lungo almeno 12 cifre: un cellulare `391 234 5678` comincia per 39 senza
esserlo, e trattarlo come prefissato lo storpierebbe.

**Comunque vada, il numero completo si mostra accanto al pulsante**: è
Alessio a vedere dove sta per scrivere, non il gestionale a indovinare
per lui. È la protezione che vale più della normalizzazione.

---

## 4. Quello che NON è stato scritto

**Il confronto fra fornitori non è una funzione nuova.** È
`varianti_ingrediente()`, la tabella disegnata da Alessio il 12/08, che
già ordina dalla più conveniente e dice chi, quanto e quando. Riscriverla
avrebbe prodotto due regole per la stessa domanda, cioè due risposte
diverse — la ragione per cui esistono `orderTotals()` e `posti_liberi()`.
Il mandato chiede di **mostrare** il confronto e mai scegliere in
silenzio: la schermata lo apre riga per riga.

**Segnare un ordine arrivato non passa dal corridoio**: è una scrittura
su una riga sola, senza conseguenze altrove, con la RLS come barriera
(Categoria A). Registrare e annullare sì — toccano tre tabelle.

---

## 5. Un dettaglio pensato per il futuro dichiarato

**La dicitura è fotografata sulla riga d'ordine.** Domani il catalogo del
fornitore può cambiare; quell'ordine no. Senza, la riconciliazione con la
fattura confronterebbe la fattura di ieri col catalogo di oggi — e
`prezzo_atteso` sulla riga esiste per lo stesso motivo: è l'ultimo prezzo
pagato per quella dicitura, non un impegno del fornitore.

---

## 6. Verifica

| Cosa | Stato |
|---|---|
| la migrazione sul progetto di prova | **applicata due volte**: idempotente |
| il confronto propone il più conveniente **e mostra entrambi** | **provato** |
| la bozza usa la dicitura del fornitore | **provato** |
| **10 kg con cassa da 6 → 2 casse** (mai 1, mai 1,67) | **provato** |
| il fabbisogno vero resta scritto nella riga | **provato** |
| il prezzo atteso è l'ultimo pagato su quella dicitura | **provato** |
| numero `0932 123456` → `390932123456` (lo zero resta) | **provato** |
| numero già internazionale non storpiato | **provato** |
| riga senza dicitura del fornitore: dichiarata, non nascosta | **provato** |
| registrare → le righe passano a «ordinata» e non spariscono | **provato** |
| la dicitura dell'ordine non cambia se cambia il catalogo | **provato** |
| ordine senza righe | **rifiutato** |
| annullare → le righe tornano da comprare | **provato** |
| annullare due volte, o annullare un ordine arrivato | **rifiutati** |
| lo staff respinto su bozza, elenco, registrazione, annullamento | **provato** (4 rifiuti) |
| elenco anonimi | **12**, controllato dentro la migrazione |
| prove automatiche | **46 verdi** (erano 42) |
| lint, build | puliti |
| **produzione** | **87 migrazioni**, corridoio **v17** |
| `security definer` senza portiere | **14**, invariato |
| residui della verifica in produzione | **zero**, zero ordini |

---

## 7. Cosa NON è verificato, e lo dico chiaro

- **Nessun ordine è mai partito a un fornitore vero.** Serve un fornitore
  con un numero vero e almeno due righe: è il criterio di accettazione
  n. 2 del mandato, e resta aperto. In produzione ci sono zero fornitori
  con articoli associati fuori dai dati di collaudo.
- **WhatsApp non è mai stato aperto davvero da questa schermata.** Il
  link è costruito e provato nella forma, non nell'apertura. Se il
  browser bloccasse la finestra, l'ordine risulterebbe registrato senza
  che il messaggio si sia aperto — per questo il testo resta visibile
  sull'ordine e si può ricopiare.
- **Le due righe vere in lista non hanno un fornitore**, quindi la
  schermata degli ordini oggi mostra solo il riquadro giallo. La catena
  completa — soglia → riga → ordine → WhatsApp — non è ancora stata
  percorsa dall'inizio alla fine con dati veri.
- **La riconciliazione ordine ↔ fattura non esiste**: è fuori perimetro
  per decisione del mandato. Le tabelle la rendono possibile (dicitura e
  prezzo fotografati), ma nessuno confronta ancora niente.
- **I dati di collaudo restano in produzione**, **`/prova-voce` è ancora
  lì**, e il messaggio delle 10:00 dello scadenziario non l'ha ancora
  visto partire nessuno.
