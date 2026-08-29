# La larghezza diventa un telaio, e i campi non fanno più zoomare

**Blocco 1 del mandato del 29/08/2026.**
**Commit dichiarato: `8f054f4`** — working tree pulito al momento del commit.
**Migrazioni introdotte: nessuna.** Nessuna riga di database è stata toccata.

---

## Cosa abbiamo rovesciato

*Niente.* Nessuna decisione in vigore è stata contraddetta.

Due voci di `docs/DECISIONI.md` sono state **toccate senza rovesciarle**:

- **21/08 — «mai scorrimento laterale»**: la decisione resta intera. Quello
  che cambia è la scoperta che **sembrava rispettata e non lo era** — vedi
  sotto.
- **25/08 — «blocchetti sul telefono, tabella sul computer»**: la forma non
  cambia di una virgola. Cambia dove vive: da cinque copie a un posto solo.

Tre voci **aggiunte** in `docs/DECISIONI.md`, sezione *Schermate*: la quarta
soglia (16 punti CSS), la larghezza come telaio, la colonna vuota per tutti.

---

## Il reperto

**60 schermate aperte a 375 punti. 15 costringono a scorrere di lato, e
tutte e 15 sono tabelle.**

| schermata | sbordo | colonne |
|---|---|---|
| `/fiscale/andamento` | 377 pt (chiede 680 in 303) | 6 |
| `/magazzino/tracciabilita` | 372 pt (715 in 343) | 7 |
| `/fiscale/deducibilita` | 247 pt (542 in 295) | 5 |
| `/agricolo` | 231 pt (574 in 343) | 5 |
| `/fiscale/deduzioni` | 170 pt (465 in 295) | 6 |
| `/calendario-eventi/clienti` | 144 pt (487 in 343) | 4 |
| `/magazzino/fornitori` | 133 pt (476 in 343) | 4 |
| `/magazzino` | 116 pt (459 in 343) | 5 |
| `/cassa/scontrinato` | 112 pt (407 in 295) | 5 |
| `/personale` | 76 pt (419 in 343) | 4 |
| `/cassa/prima-nota` | 58 pt (353 in 295) | 6 |
| `/cassa/previsione` | 58 pt (353 in 295) | 4 |
| `/cassa/personale` | 33 pt (328 in 295) | 4 |
| `/editor-menu/bevande` | 8 pt (351 in 343) | 5 |
| `/personale/mance` | 7 pt (302 in 295) | — |

🔴 **E LA PAGINA NON SCORRE MAI.** In tutte e 15 lo sbordo della pagina è
**zero**: lo scorrimento è **dentro il riquadro** (`overflow-x-auto`).
Quindi la decisione del 21/08 sembrava rispettata — era stata spostata di un
livello, dove nessuno la misurava. *Un controllo che avesse guardato
`document.scrollWidth` avrebbe risposto zero su tutte e quindici.*

Tre delle quindici corrispondono alle fotografie di Alessio: Fornitori («la
tabella scorre a destra»), Magazzino («taglia la colonna delle scadenze»),
e la tabella delle versioni già curata il 25/08 — che infatti misura zero.

---

## 🔴 Il metro ha mentito tre volte prima di reggere

Il conteggio qui sopra è il **quarto** prodotto stanotte. I primi tre erano
sbagliati, e ognuno per una ragione diversa:

1. **Misurava la pagina precedente.** 1300 ms di attesa fra una schermata e
   l'altra non bastavano: i valori uscivano **identici a coppie** su
   schermate diverse. `/ricettario/menu` risultava a 58 punti; misurato da
   solo, è **zero** — 58 era il valore di Prima nota, la schermata di prima.
2. **Contava `truncate` come sbordo.** Un testo tagliato coi puntini ha
   `scrollWidth > clientWidth` ma **non scorre**: è tagliato apposta. Da lì
   134 punti falsi sulla schermata iniziale e 49 sull'Agenda.
3. **Leggeva il codice vecchio.** Dopo una modifica, navigare senza
   ricaricare misura ciò che c'era prima: Clienti risultava ancora a 144
   quando la tabella era già stata sostituita.

⚠️ **I numeri prodotti dai metri storti non sono citati da nessuna parte.**
È la regola del 26/08 applicata a sé stessa: *un prima-e-dopo con due metri
diversi non è un prima-e-dopo.*

E il quarto metro è stato **provato su casi di risposta nota prima di
fidarsene**: schermata iniziale e Agenda devono dare zero (il `truncate` è
voluto), Fornitori deve dare 133 (è fotografato). Li dà.

---

## Il telaio

`src/components/ElencoAdattivo.jsx`. I campi si dichiarano **una volta
sola** e da quella dichiarazione escono tutt'e due le forme: blocchetti sul
telefono, tabella sul computer.

⚠️ **La forma non è nuova — è quella decisa il 25/08.** Il difetto era che
viveva **ricopiata a mano in 5 schermate su 32**. Copiata cinque volte, una
regola sta in piedi in un posto solo, e chi scrive un elenco nuovo
ricomincia da capo.

**Applicato a sei schermate**, tutte portate a zero: Fornitori (133 → 0),
Tracciabilità (372 → 0), Clienti (144 → 0), Personale (76 → 0), Incassato e
scontrinato (112 → 0), Ho messo di tasca mia (33 → 0).

### Due cose che il componente chiude e che nessuna schermata dovrà più ricordare

🔴 **La stampa.** Senza `print:hidden` sui blocchetti, chi stampa la
Tracciabilità o un registro **dal telefono** porterebbe all'ispettore un
foglio di blocchetti invece della tabella. Sulla carta la larghezza non è
quella dello schermo, quindi il motivo per cui i blocchetti esistono lì non
c'è. Chiuso **nel componente**, non in ogni schermata che si stampa.

**La colonna vuota per tutti.** Nasce dai Fornitori: «Categoria» diceva «—»
su tutti e undici (misurato sul progetto di prova; in produzione i fornitori
sono zero). Il mandato offriva due strade — toglierla o riempirla — e ne è
uscita una terza, dopo aver guardato: **il campo è compilabile dalla scheda
del fornitore**, quindi è un dato legittimo che oggi è solo vuoto, e
toglierlo lo renderebbe irraggiungibile il giorno che Alessio lo compila.
Quindi: **sparisce dal telefono, resta sul computer**.
⚠️ E il criterio è «vuota per **tutte** le righe», non «vuota su questa
riga»: blocchetti di forma diversa uno dall'altro si leggono peggio di una
riga vuota in più.

---

## Lo zoom di iOS, e la soglia che mancava

Il mandato lo dava per SUPPOSTO. **È confermato, con la misura.**

Safari su iPhone ingrandisce la pagina appena si tocca un campo il cui testo
sta sotto **16 punti CSS**, e la pagina **resta** ingrandita: Alessio la
rimette a posto a mano ogni volta.

🔴 **E le tre soglie del progetto non lo catturano.** Alla densità di un
telefono non calibrato (`--pxcm` 37,8) `.testo-sala` vale **12,09 punti,
cioè esattamente 3,20 mm**: rispetta il minimo del progetto **in pieno** e fa
zoomare lo stesso, perché i 16 punti di Safari sono in punti CSS e **non
scalano con la calibrazione**.

**Misurati 29 campi su 29 sotto soglia** in tre schermate. Dopo: **zero**,
su sei schermate controllate.

La cura è una regola sola in `index.css` — `font-size: max(16px, 1em)` sui
campi, solo su schermo stretto. È un **pavimento, non una taglia**: alza chi
sta sotto e non rimpicciolisce mai nessuno.

🔴 **Difetto mio, preso dalla misura e non da una rilettura.** La prima
versione portava 29 campi a 12, non a zero: `select` da solo ha specificità
(0,0,1) e **perde** contro la classe di taglia (0,1,0), mentre
`input:not(…):not(…)` la batte. Il pavimento si applicava a metà — 3 menu a
tendina rimasti a 12,09 in Prima nota, accanto a campi già saliti a 16.

---

## La rete che impedisce il ritorno

`src/lib/calcoli/larghezza.js` + `tests/unita/larghezza.test.js`.

Guarda la **forma nel sorgente** e non il browser, perché in questo progetto
le prove non hanno un ambiente DOM — ed è anche il momento giusto: avvisa
mentre si scrive, non al collaudo.

**Provata al contrario in tre modi diversi**, non due: una tabella nuda
viene nominata; il riparo sul riquadro (`hidden md:block`) la assolve; il
riparo sulla tabella stessa (`hidden md:table`) pure; un riparo venti righe
più su **non** la copre — un file può avere due tabelle, una curata e una no.

**Lo stato di partenza è congelato, non perdonato**: le schermate ancora
larghe stanno in `NOTE_LARGHE` con la loro misura. La rete diventa rossa se
ne nasce una **nuova**, *e anche se un debito è stato curato e nessuno l'ha
tolto dall'elenco* — così l'elenco non può mentire in nessuno dei due versi.

🔴 **E ha già trovato quello che la misura a schermo non poteva vedere:**
`Allineamento.jsx:294`. A 375 punti dava **zero sbordo**, perché sul progetto
di prova quell'elenco era vuoto — ed è **proprio la schermata che Alessio ha
fotografato** come illeggibile. *Una schermata senza dati non è una
schermata senza difetti.*

---

## Rilettura

**Cosa NON ho verificato con gli occhi.** Nessuna immagine: in questo
ambiente lo screenshot non funziona, quindi tutto ciò che è «visto» è
**misurato dal DOM** e letto come testo. Non ho visto nessuna schermata su un
telefono vero: il pavimento dei 16 punti è calcolato dal browser, e **che lo
zoom di iOS smetta davvero lo può dire solo un iPhone in mano ad Alessio.**
Non ho stampato nessun foglio: che la Tracciabilità esca come tabella e non
come blocchetti è provato dalle regole `print:`, non da una stampante.

**Cosa ho contato senza leggerlo.** Le 32 schermate con `<table>` e le 55
tabelle vengono da un setaccio sul codice: non ho aperto tutti i file.
L'elenco `NOTE_LARGHE` contiene **13 voci marcate «non misurata a schermo»** —
sono tabelle dentro schede di dettaglio che richiedono una ricetta, un
preventivo o un dipendente aperto, e non le ho aperte. Il numero **15** è
quindi un **pavimento**, non un totale: le schermate di dettaglio possono
nasconderne altre.

**Quali mie affermazioni sono diventate false mentre lavoravo.** Il
conteggio «28 su 61» prodotto dal primo metro, e il «22» prodotto dal
secondo: nessuno dei due è citato sopra se non per dire che erano sbagliati.
E l'elenco iniziale dei debiti conteneva tre schermate **già curate** — l'ha
detto la rete, non io.

**Quali conteggi sono pavimenti.** Il 15, come spiegato. E i «29 campi sotto
soglia»: sono le tre schermate che ho aperto, non tutte quelle con un campo.

**Cosa ho lasciato sul progetto di prova.** Niente di questo blocco: non
tocca il database. Il server di sviluppo sulla porta 5177 è mio e va chiuso
a fine sessione — quello di Alessio non è stato toccato.
