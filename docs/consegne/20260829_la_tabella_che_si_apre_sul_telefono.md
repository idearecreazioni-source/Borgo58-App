# La tabella del Magazzino si apre sul telefono

**Blocco 4 del mandato del 29/08 (sera)** · 29/08/2026

| | |
|---|---|
| commit del lavoro | `a9753bc` |
| migrazioni introdotte | **nessuna** — al database non serviva niente |
| prove | 584 pure, 454 sull'app |

---

## Cosa c'era, misurato

Il mandato lo riportava come **RIFERITO** da me il 29/08 mattina: «sborda
di 116 punti, ha righe che si aprono, e il componente costruito per le
altre non la regge».

**Rimisurato prima di toccare**, a 375 punti col gestionale aperto:

```
DIV .rounded-xl … overflow-x-auto   +116   "IngredienteDovrebbe esserciSoglia minima"
sbordo della PAGINA: 0
```

⚠️ **La pagina non scorreva**, ed è il punto che rende questa famiglia
insidiosa: lo scorrimento era **dentro il riquadro**
(`overflow-x-auto`), quindi la decisione del 21/08 — *«mai scorrimento
laterale»* — sembrava rispettata. Non lo era: era stata spostata di un
livello, dove nessuno la misurava.

Era **l'ultima** riga di `NOTE_LARGHE` che dichiarava «il componente
adattivo non la copre», e la ragione era vera: quella tabella ha **una
riga che si apre**, con dentro il modulo dello scarico.

---

## La cura non è stata rifarla: è stata insegnarlo al componente

`ElencoAdattivo` — nato stamattina per portare le tabelle sul telefono —
ha imparato due cose:

* **`azione(r)`** → `{ etichetta, onClick, spenta }`: il gesto della riga;
* **`aperta(r)`** → cosa mostrare sotto quando la riga è aperta.

⚠️ **Il perché non è l'eleganza**: rifare *questa* tabella a mano avrebbe
lasciato il componente incapace di reggere la prossima. Sono **cinque** le
schermate che oggi hanno righe con un gesto per riga, e curarne una alla
volta è precisamente come questo difetto è arrivato al 29/08.

🔴 **E UNA TRAPPOLA È STATA VISTA PRIMA DI CADERCI**: sul telefono il
blocchetto è un `<button>` quando c'è `onTocco`, e un pulsante dentro un
pulsante **non è HTML valido** — sul telefono il tocco finisce a chi
capita. È la stessa trappola del numero di telefono dentro la riga della
prenotazione (19/08). Quindi con un'azione il riquadro diventa un
contenitore, e il titolo prende il suo pulsante per conto proprio.

---

## Cosa si vede adesso

**Misurato a 375 punti, col gestionale aperto e il modulo dello scarico
APERTO:**

| | prima | dopo |
|---|---|---|
| sbordo dentro il riquadro | **116** | **0** |
| sbordo della pagina | 0 | **0** |
| tabelle visibili sul telefono | 1 | **0** — blocchetti |

**E sul computer (1280 punti) la tabella è intatta**: cinque intestazioni
(«Ingrediente · Dovrebbe esserci · Soglia minima · Scade prima» più la
colonna del gesto), la riga che si apre a tutta larghezza con `colspan=5`,
e il modulo dentro la tabella come prima.

🔴 **E LA CURA HA PRODOTTO UN DIFETTO SUO, trovato misurando e non
rileggendo.** Avevo messo `[&>*]:min-w-0` sul modulo dello scarico
«perché i campi vadano a capo»: faceva esattamente il danno che doveva
evitare — scavalcava il `min-w-[160px]` del campo nota, che invece di
andare a capo si **schiacciava a 14 punti**, con 12 punti di sbordo dentro
il riquadro. Tolto, i campi si impilano.

⚠️ **E per vederlo ho dovuto correggere il metro**, che è la sesta volta
in questo progetto: la prima misura contava anche elementi dentro
contenitori nascosti (`hidden md:block`). Con un filtro sulla visibilità
vera — risalendo tutti gli antenati — restava **un solo** sbordo, ed era
reale.

---

## La rete del 28/08: la copre, e adesso copre di più

La rete (`tests/unita/larghezza.test.js`) guarda che non nascano tabelle
larghe nuove, con i debiti dichiarati in `NOTE_LARGHE`. Due cose:

1. **`MagazzinoHome` è stata TOLTA da `NOTE_LARGHE`**, con la ragione
   scritta accanto: non è più un debito.
2. 🔴 **La rete guardava solo `src/pages`**, e da stanotte una tabella vive
   dentro un **componente**. Un componente è il posto peggiore dove
   lasciarne scappare una: **non compare in nessuna schermata e finisce in
   tutte** — la stessa forma del difetto del 22/08, dove il pulsante del
   menu era fuori da tutte e 67 le schermate misurate perché non era in
   nessuna ed era in tutte. Ora guarda anche `src/components`.

✅ **E l'allargamento è stato provato**: messo un file finto con una
tabella nuda in `src/components`, la rete l'ha nominato
(`src/components/ProvaRete.jsx:5`). Poi tolto.

---

## Cosa abbiamo rovesciato

**Niente.** Nessuna voce in vigore di `docs/DECISIONI.md` è stata
contraddetta.

Voci **toccate**:
* *Sala e pianta* — «21/08: quello che si vede deve entrare in larghezza,
  mai scorrimento laterale». **Applicata**, e in un posto dove sembrava
  già rispettata e non lo era.
* *Magazzino e scarico* — «23/08: le spezie a pizzico», «un numero fermo
  non si mostra come giacenza». **Conservate parola per parola** nel
  passaggio al componente: chi non è tenuto in magazzino continua a
  leggere «fuori magazzino» e non un numero.

Nessuna decisione nuova: qui non ce n'erano da prendere.

---

## RILETTURA

**Cosa NON ho verificato con gli occhi**
* **Nessuna immagine**: le misure vengono dal DOM. Come sta il blocchetto
  in mano, con la luce della cucina, non l'ha visto nessuno.
* **Non ho premuto «Conferma»** sul modulo dello scarico: avrebbe scritto
  uno scarico vero nel magazzino del progetto di prova. Il modulo si apre,
  i campi ci sono e sono raggiungibili — che sia *quello* di prima lo dice
  il fatto che è lo stesso codice, spostato.
* **Non ho riguardato le altre quattro schermate** che hanno righe con un
  gesto per riga: il componente ora le reggerebbe, ma non sono state
  convertite e restano in `NOTE_LARGHE`.

**Cosa ho contato senza leggerlo**
* «116 punti» e «12 punti» sono `scrollWidth - clientWidth` letti dal DOM.
* «cinque schermate con un gesto per riga» viene dalle note di
  `NOTE_LARGHE`, non da un censimento fatto oggi. **È un pavimento.**

**Quali mie affermazioni sono diventate false mentre lavoravo**
* Il commento che ho scritto sul modulo dello scarico diceva
  «`flex-wrap` e `min-w-0`: i campi vanno a capo». **Falso**: il
  `min-w-0` impediva l'andare a capo. Corretto insieme al codice.
* La riga di `NOTE_LARGHE` diceva «il componente adattivo non le copre»:
  vera stamattina, falsa adesso.

**Quali blocchi non ho aperto**
* **Blocco 5** (i debiti piccoli): dichiarato nelle domande.

**Cosa ho lasciato sul progetto di prova**
* **Niente**: questo blocco non ha scritto nel database. Il modulo dello
  scarico è stato aperto e chiuso, mai confermato.
* Un file finto (`src/components/ProvaRete.jsx`) è stato creato per
  provare la rete e **cancellato**: contato dopo, zero residui.
