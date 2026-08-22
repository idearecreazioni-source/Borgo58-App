# Il tavolo che sembrava aperto — misurato in quattro modi

**Blocco 1 del mandato del 22/08 sera.** 🔴 **Misura e referto: non è stato
corretto niente**, come chiesto — *«non curare finché non hai capito il
perché»*. Alla fine il perché c'è, e **non è quello che sospettavo**: la cosa
che avevo visto non era un difetto dell'app, ma cercandola ne è saltato fuori
uno vero e peggiore.

---

## Le tre domande del mandato, in ordine

### 1 · Quando l'apertura FALLISCE, cosa fa la schermata?

**Si comporta bene.** Rotta di proposito `apriConto` (un `throw` prima della
chiamata, ricarica a caldo di Vite), toccato T3, premuto «Apri il tavolo»:

| | esito |
|---|---|
| messaggio d'errore a schermo | ✅ sì, in cima |
| mostra il tavolo aperto | ✅ **no** — resta «Nessun tavolo aperto» |
| mostra il menu dei piatti | ✅ no |
| conto scritto nel database | ✅ nessuno |

### 2 · Lo stato a schermo è scritto PRIMA o DOPO la conferma del database?

**Dopo, e non c'è nessuno stato ottimista.** In `apriSelezione` (`Sala.jsx`)
l'ordine è: `await apriConto(…)` → `await getOrder(…)` → **poi**
`setOrder(full)`, tutto dentro il `try`. Se la scrittura fallisce si va nel
`catch`, che scrive l'errore e non tocca lo stato.

⚠️ **L'ipotesi che avevo in mano era questa, ed è smentita.** Vale la pena
dirlo: era la spiegazione più comoda, e sarebbe stata una cura a indovinare.

### 3 · Se la scrittura riesce ma la LETTURA no?

🔴 **Riprodotto, ed è un difetto vero.** Rotta `getOrder` invece di
`apriConto`:

> Il conto **`2a76c108` è APERTO nel database**, e la schermata dice
> **«Nessun tavolo aperto»** con un messaggio d'errore.

Cioè: il tavolo è aperto per il gestionale e chi serve non lo sa.

✅ **Si recupera, ma solo se qualcuno ritocca il tavolo**: toccando di nuovo
T3, la schermata trova il conto e lo apre — senza nemmeno chiedere «Apri il
tavolo», perché ormai quel tavolo *ha* un conto. Nessuno però dice al
cameriere che deve rifare il gesto.

---

## 4 · E quello che avevo visto? **Riprodotto, e non era l'app**

Cancellando il conto **da fuori** — `delete` diretto sul database mentre la
schermata lo tiene aperto — si vede **esattamente** quello che vidi:
«T3 aperto», il menu dei piatti, e nessun conto nel database.

⚠️ **È quello che è successo davvero**: in quel momento la sessione parallela
stava ripulendo il progetto di prova con `psql`, e me lo ha scritto lei
stessa. Il mio conto era stato creato regolarmente e cancellato da sotto.

**Quindi non è un difetto dell'app**: nessuno cancella conti via SQL in
servizio. È il prezzo di due sessioni sullo stesso database di prova.

---

## 🔴 5 · Ma cercandolo, ne è uscito uno VERO — e in servizio è peggio

Il caso realistico non è «qualcuno cancella un conto con SQL». È **due
tablet**, che è la sala di Borgo 58: uno annulla il tavolo, l'altro ce l'ha
ancora aperto davanti.

Provato con i gesti veri dell'app (`cancelOrder` dall'altra postazione):

| passo | cosa fa il gestionale |
|---|---|
| l'altro tablet annulla T1 | il conto passa ad **annullato** |
| la mia schermata | continua a dire **«T1 aperto»** |
| **segno un piatto** | 🔴 **accettato — nessun errore** |
| controllo il database | 🔴 la riga **è stata scritta su un conto annullato** |
| **premo «Invia»** | 🔴 **non succede niente**, e non c'è nessun errore a schermo |
| console del browser | **409** e **400** — il server ha rifiutato, ma lo sa solo il browser |

**Misurato**, non dedotto: `T1 [annullato] → 1 righe · 1× Sarde a beccafico ·
inviata=no`.

### Perché succede

Tre cose che si sommano, e nessuna delle tre è una svista di schermata:

1. **La schermata tiene il conto in memoria** e non si accorge che è cambiato
   stato sotto di lei;
2. **Il database accetta righe su un conto annullato** — non c'è nessun
   vincolo che lo impedisca, quindi la scrittura riesce davvero;
3. **L'errore dell'invio non arriva a chi serve**: il rifiuto esiste (409),
   ma resta nella console.

### Cosa vede il cameriere

Segna i piatti. Preme «Invia». **Non succede niente.** Preme di nuovo. Niente.
Non ha nessun modo di sapere che quel tavolo è stato annullato dall'altro
tablet — e intanto le sue righe si sono depositate su un conto che per il
gestionale non esiste più.

⚠️ **E c'è un modo peggiore in cui questo può finire**: l'annullamento esiste
perché *«un conto annullato è un conto che non è mai esistito»*, ammesso solo
finché la cucina non ha prodotto niente. Se l'invio invece riuscisse — e qui
non riesce **per caso**, perché il corridoio rifiuta — la cucina cucinerebbe
piatti per un conto che non incasserà mai.

---

## Cosa propongo — **non costruito**, serve una decisione

In ordine di quanto tengono, non di quanto costano:

1. 🔴 **Il vincolo va nel database, non nella schermata**: `order_items` non
   deve accettare righe su un conto che non è `aperto`. È la regola di questo
   progetto — *gli invarianti sono vincoli del database* — e chiude il buco
   per **tutte** le strade, comprese quelle che nessuno ha ancora scritto.
2. **L'invio che fallisce deve dirlo.** Oggi il 409 muore in console. Basta
   che l'errore arrivi dove sono già gli altri messaggi di quella schermata.
3. **Quando il conto in mano cambia stato sotto, la schermata lo dichiara e
   lo lascia** — con la via d'uscita per riaprirlo, se il tavolo è ancora
   libero. Vale anche per il caso 3 qui sopra (conto aperto e invisibile):
   una riga che dice *«questo tavolo è stato annullato da un'altra
   postazione»* copre tutti e due.

⚠️ **La 1 e la 2 sono piccole e non hanno alternative sensate. La 3 è una
scelta di disegno** — quanto spesso ricontrollare, e cosa fare del lavoro a
metà — e quella la decide Alessio.

---

## ⚠️ Cosa NON è verificato

1. **Non ho provato con due tablet veri**, ma con due sessioni sullo stesso
   database: per il gestionale è la stessa cosa, per le mani no.
2. ⚠️ **Il primo sabotaggio non ha funzionato e per poco non me ne accorgevo**:
   sostituire `window.fetch` non intercetta niente, perché il client Supabase
   cattura `fetch` quando nasce. Contavo le chiamate bloccate e ne ho lette
   **zero** mentre il conto veniva scritto lo stesso — se non avessi messo
   quel contatore avrei scritto «la scrittura fallisce e la schermata mostra
   il tavolo aperto», che è **falso**.
3. ⚠️ **Anche il mio strumento per toccare i tavoli era rotto**, e ha prodotto
   un falso difetto: credevo che *«il primo tocco dopo il caricamento si
   perde»*. In realtà il selettore prendeva il **gruppo contenitore di tutta
   la pianta** invece della singola sagoma, e toccava un punto vuoto. Corretto
   il selettore, un tocco basta sempre. *Il secondo falso allarme di
   giornata, tutti e due dallo strumento e non dal gestionale.*
4. **Non ho provato cosa succede a un conto CHIUSO** dall'altra postazione
   mentre lo si sta usando: probabilmente si comporta come l'annullato, ma
   non l'ho guardato.

---

## Cosa abbiamo rovesciato

**Niente.** Nessuna riga toccata.

---

## 6 · I dati della prova, tolti

Conti annullati e **12 righe** rimosse dai conti annullati (comprese quelle
scritte apposta per misurare). Controllato: **0 conti aperti**, movimenti di
cassa **invariati a 2**.
