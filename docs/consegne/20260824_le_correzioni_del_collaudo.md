# Le correzioni del collaudo del 23/08 — consegna del 24/08/2026

**Commit dichiarato:** `1c8a4d51cbd64b800b78677943e91f1dad64d94d`
**Working tree:** pulito
**Migrazioni:** 201 nel repository, 201 sul progetto di prova, **196 in
produzione** (5 in attesa del push di Alessio: `20260824000001`, già
pronta dalla sessione precedente, più le quattro di stanotte).

Mandato: i sette blocchi delle correzioni emerse dal collaudo del 23/08,
più i tre opzionali.

---

## In breve

| blocco | esito |
|---|---|
| 1 · il risultato della Proiezione | **fatto** — due cause distinte, entrambe misurate |
| 2 · la bozza di previsione che si perde | **fatto** — misurato: mentiva la frase, non il salvataggio |
| 3a · ore al giorno | **fatto** |
| 3b · il doppione | **fatto** |
| 3c · costi fissi proposti | **fatto** |
| 3d · tre linee (sala/lunch/eventi) | **SALTATO** — tre ambiguità strutturali, sotto |
| 4 · Cassa, Banca e Prima Nota | **già fatto il 23/08** — verificato, coi numeri |
| 5 · le tre schermate HACCP | **fatto** |
| 6 · scheda fornitore → sue fatture | **già fatto il 23/08** — verificato dal vivo |
| 7 · la riga doppia del catalogo | **fatto** — erano i dati, non la schermata |
| opzionale A · le due Scadenze | **misurato, NON corretto** — la cura ha tre forme |
| opzionale B · le durate dell'assistente | **misurato** — non ha smesso |
| opzionale C · le frasi diventate false | **fatto** — una trovata, in HACCP |

---

## BLOCCO 1 — il risultato della Proiezione

Erano **due difetti indipendenti**, e l'indizio che li ha separati è
quello che Alessio aveva già isolato: *le imposte sono lo 0,28% del
risultato su due schermate diverse*. Due difetti indipendenti non danno
la stessa proporzione.

### Prima causa: le aliquote scritte in frazione

`fiscal_settings` teneva `ires_rate = 0.24` e `irap_rate = 0.04`.
`calcola_imposte()` fa `imponibile * aliquota / 100`, cioè legge quei
campi in **punti percentuali** — e lo dichiarano i valori predefiniti
delle colonne stesse (24.0, 3.9, 100, 40, 20, 1.5).

Controprova aritmetica sul risultato vero della previsione di collaudo
(2.141.140,64 €):

| | |
|---|---|
| con le aliquote come stavano | **5.995,20 €** |
| con le aliquote in punti | **597.378,23 €** |
| fattore | **99,6** |

I 5.995,20 sono **al centesimo** il numero che si vedeva a schermo.

🔴 **Non era il risultato a essere cento volte troppo grande: erano le
imposte a essere cento volte troppo PICCOLE.** La differenza conta,
perché un utile gonfiato si nota e un'imposta bassa no — e questa
sbagliava **sempre nella stessa direzione**, verso il rassicurante.

✅ **Il gestionale vero non era affetto**: letto in sola lettura il 24/08,
in produzione ci sono 24,00 / 3,90 / 100 / 40. Il valore sbagliato veniva
da `scripts/prova-base.mjs`, dove **quattro** campi erano in frazione.

**La rete** (`20260824000002`): un vincolo `check` respinge un'aliquota
scritta in frazione — zero, oppure almeno 1. La soglia è dichiarata:
sotto l'1 non esiste nessuna aliquota IRES o IRAP italiana (la più bassa
è l'IRAP agricola all'1,9%). ⚠️ Copre solo l'errore avvenuto: chi
scrivesse 2400 al posto di 24 passerebbe.

🔴 **E la prova che avrebbe dovuto accorgersene era una tautologia**: su
un imponibile di 10.000, `ires = aliquota × 100` è vero **qualunque sia
l'aliquota**. Sostituita con due prove che discriminano.

### Seconda causa: il piano era di un altro anno

Chiuse le aliquote, «Come sta andando» continuava a mostrare
**25.886.259 €** — il numero esatto riportato da Alessio.

Il menu «Confrontato con» apriva sulla previsione più recente **di
qualunque anno**: la lista è ordinata per anno decrescente, e sul
progetto di prova c'è un piano del **2027** scritto a mano durante il
collaudo. La schermata confrontava i coperti veri del 2026 col piano del
2027, e nell'elenco l'anno non si vedeva nemmeno.

Quel piano ha una linea accessoria da 1000 unità **al giorno** a 140 €:
37,2 milioni di ricavi accessori, **25.898.463 €** di risultato. Con le
aliquote come stavano: 72.481 € di imposte, di nuovo lo 0,28%, di nuovo
il numero a schermo.

⚠️ **Non sbagliava rumorosamente**: coperti reali, incassato e scontrino
medio restavano giusti — solo il fondo tabella diventava di un altro
anno. Con due previsioni di anni consecutivi scritte con cura la
differenza sarebbe stata piccola e credibile.

**Cura in tre pezzi**: l'anno compare nell'elenco; si apre su una
previsione **dell'anno guardato**, e senza nessuna **non si ripiega** su
un altro anno; scegliendone uno diverso a mano, la schermata lo dichiara.
Regola in `src/lib/calcoli/scenarioDaConfrontare.js`, 9 prove pure.

### Terzo difetto trovato per strada

La linea accessoria della previsione di collaudo diceva **1200 aperitivi
al giorno** in un locale da 34 coperti: 2,6 milioni l'anno, l'88% dei
ricavi, EBITDA al 73%. È l'indizio (c) di Alessio, ed era un **dato
implausibile**, non un difetto di formula. Portato a 12.

### La nota collegata di Alessio — verificata e scartata

La quota deducibile a 0,00 € **non c'entra**: `calcola_proiezione`,
`riepilogo_calcolato` e `proiezione_fine_anno` non leggono mai la
deducibilità — l'imponibile è `ante_imposte` diretto. Letto nei corpi
vivi, non dedotto.

### Dopo, misurato a schermo

| | prima | dopo |
|---|---|---|
| Ricavi totali (previsione di collaudo) | 2.957.184 € | **362.592 €** |
| EBITDA | 2.165.732 € (73%) | **163.754 €** (45%) |
| Risultato | 2.141.140,64 € | **139.162,88 €** |
| Imposte | 5.995,20 € (0,28%) | **38.826,44 €** (27,9%) |
| «Come sta andando» — risultato | 25.886.259 € | **128.206,54 €** |

---

## BLOCCO 2 — la bozza che si perde

**Misurato prima di correggere**, col giro andata e ritorno vero
(`creaScenarioDaFoglio` → `getScenario` + `ingressiScenario` →
`aggiornaScenario` → rilettura): una previsione salvata si rilegge
identica, campo per campo, con tutte le righe figlie, anche dopo una
correzione. **Il salvataggio non aveva niente che non andasse.**

A mentire era la frase in cima, che prometteva «finché non la chiudi puoi
tornarci sopra quante volte vuoi» parlando di una previsione **già
salvata**, mentre chi legge l'applica a quello che sta scrivendo adesso.

🔴 **E c'era un secondo difetto, misurato guardando dov'è il pulsante**:
«Crea la previsione» sta in fondo a un form di dodici mesi, il messaggio
di errore stava **in cima**. Premendo con lo scontrino medio o il food
cost vuoti non succedeva niente di visibile. È la ricomparsa di *«un
rifiuto lontano dal gesto è un rifiuto che non c'è»* (17/08, in Cassa).

**Cura**: la frase dice la verità; l'errore compare **anche sotto il
pulsante**; uscire con del lavoro non salvato chiede conferma
(`beforeunload` + il collegamento «← Le previsioni»); accanto al pulsante
compare «Non ancora salvata».

⚠️ **La navigazione interna verso altre schermate NON è trattenuta**: in
questo progetto il router è `<BrowserRouter>`, che non permette a React di
bloccarla. Sono coperte le tre strade vere — ricarica, chiusura, tasto
indietro — più il collegamento di ritorno.

---

## BLOCCO 3 — previsioni

**a) Ore al giorno.** `scenari_proiezione.ore_giorno` **esisteva dal
15/08** col suo predefinito: veniva salvata, e non la mostrava nessuna
schermata e non la leggeva nessun calcolo — la forma «tutto acceso, e
muto» già vista sulla soglia di magazzino. Ora è **un campo solo per
tutta la previsione**, e i due netti si calcolano a vicenda: comanda
l'**ultimo campo toccato**. Le righe che si contraddicono si **dicono**,
non si riscrivono di nascosto.

Regola in `src/lib/calcoli/pagaPrevisione.js`, 12 prove pure. ⚠️ La
tolleranza del confronto **cresce col numero di ore**: 100 € su 7 ore
fanno 14,29, e 14,29 × 7 fa 100,03 — fissa a un centesimo, il guardiano
avrebbe gridato su un caso normale.

**b) Doppione.** Tolto il riquadro «Costruiscine una»; resta il pulsante
in alto, e con lui la riga che spiega cosa si compila. ⚠️ Il pulsante che
resta ora porta con sé **la società scelta**, che prima passava solo
l'altro: senza, si sarebbe guardato l'elenco dell'agricola e scritto
nella S.r.l.s.

**c) Costi fissi.** Quattordici voci proposte su una previsione **nuova**
(non in correzione: riproporle rimetterebbe dentro voci tolte), **vuote e
non a zero**, e le vuote non entrano nella previsione.

**d) Tre linee — SALTATO.** Il mandato lo consentiva se richiedeva scelte
strutturali non confermabili. Sono tre, e ognuna cambia il risultato:

1. **Che ne è delle linee accessorie esistenti?** «Eventi» ha la forma di
   una linea accessoria per evento, che c'è già. Le sostituisce, o
   convivono? La previsione già scritta va convertita o lasciata?
2. **In che unità si esprime il pareggio con tre linee?** Oggi è
   «N coperti» (fissi ÷ margine per coperto). Con sala, lunch ed eventi a
   scontrini diversi, «coperti di pareggio» non ha una risposta sola.
3. **Come si misura il consuntivo del lunch separato dalla cena?** Il
   confronto col reale legge i conti chiusi, e **`orders` non porta il
   servizio**: pranzo e cena non si distinguono. Senza quello, la linea
   lunch nascerebbe con un piano e nessun modo di misurarla.

⚠️ E il blocco toccherebbe `calcola_proiezione`, `costanti_scenario`,
`riepilogo_calcolato`, `confronto_a_oggi`, `andamento_anno`,
`proiezione_fine_anno`, `confronto_col_foglio`, l'importazione dal foglio
Excel e le due operazioni del corridoio: **i 17 confronti col foglio vero
di Alessio andrebbero rifatti**.

---

## BLOCCO 4 — Cassa, Banca e Prima Nota: già fatto

Tutti e quattro i punti erano stati chiusi il 23/08 (paragrafo tolto,
«Movimenti recenti» tolto, quattro riquadri, omaggi «Altro» con la
percentuale). Verificato leggendo il codice e i dati.

**I numeri chiesti dal mandato, misurati sul progetto di prova:**

| | |
|---|---|
| omaggi «Altro» — mese in corso | **0,00 €** |
| incassato — mese in corso | 116,00 € |
| percentuale mostrata | **0,0%** |
| luglio 2026 — incassato | 39.570,00 € |
| luglio 2026 — omaggi a listino | 201,42 € |
| luglio 2026 — omaggi «Altro» | **0,00 €** → **0,0%** |

🔴 **Rilievo**: **nessun omaggio dei dati di collaudo ha causale
«Altro»** — sono Cortesia, Cliente ricorrente, Recupero disservizio.
Quindi quel riquadro mostra sempre zero, e **il collaudo di quel riquadro
non prova niente**. Se «Cortesia» fosse «Altro», luglio darebbe
75,01 / 39.771,42 = **0,189%**.

---

## BLOCCO 5 — le tre schermate HACCP

Le tre avevano la stessa forma sbagliata, e la cura sta in **un
componente solo** (`src/components/ArchivioMensile.jsx`): scriverla tre
volte vorrebbe dire che fra sei mesi si comportano in tre modi diversi.

**Le pulizie, riscritte** (`20260824000003`). La lista di oggi si riempie
da sé: giornaliere ogni giorno, settimanali e mensili quando scadono
**contando dall'ultima spunta** e non a giorno fisso. Quello che non si
spunta si ripresenta ogni giorno e dice **da quanti giorni** è in
ritardo. ⚠️ «Altro» non ha una cadenza e **non risulta mai dovuta**:
inventargliene una sarebbe peggio che non averla. ⚠️ «Mai fatta» non è un
ritardo di zero giorni: i giorni restano **vuoti**.

**Le temperature.** «Storico rilevazioni» era tagliato a **cinquanta
righe senza dichiararlo**, con 732 sotto. E la domanda vera — *«oggi le
ho fatte tutte?»* — non aveva risposta. Ora in evidenza c'è anche **quello
che manca**: le attrezzature non registrate vengono per prime.

**Le non conformità.** Le risolte vanno in archivio, che conserva per
intero cosa è successo **e** cosa è stato fatto. E si raggruppano per
apparecchio: 🔴 quel dato viveva **solo dentro una frase**
(«BASE-Congelatore: -17.0 °C, …»), ed è diventato una colonna vera
(`haccp_non_conformities.equipment_id`), con `registra_temperatura`
riscritta **dal corpo vivo del database** — confrontato con quello di
produzione: identici.

⚠️ **Il giorno è la SERATA DI SERVIZIO** in tutte e tre: pulizie e
temperature si fanno anche dopo mezzanotte, e a calendario la giornata
che si stava chiudendo risulterebbe senza controlli. Visto sui dati veri:
le pulizie dell'01:30 compaiono sotto la serata giusta.

⚠️ **Il formato dei registri stampabili è DICHIARATO PROVVISORIO nella
schermata stessa**: quello che l'ASP vuole lo dirà la biologa.

**Visto con gli occhi**, non solo provato: le tre schermate aperte nel
gestionale di prova. «In ritardo di 22 giorni», le sei attrezzature
mancanti in cima, e il riquadro degli apparecchi ripetuti che mostra
**«BASE-Abbattitore — 3 volte il 23 ago 2026»**.

---

## BLOCCO 6 — scheda fornitore: già fatto

Verificato dal vivo invece di darlo per buono: dalla scheda del
Caseificio Val di Noto «Le sue fatture» porta all'elenco filtrato
(«1 di 11 da pagare — i totali in alto restano quelli interi») col
fornitore già selezionato nel menu. «Consegne recenti» è rimasto.

---

## BLOCCO 7 — la riga doppia del catalogo

**Misurato**: sono due campi diversi e la schermata li stampava tutti e
due correttamente. A ripetersi erano i **dati**: lo script di semina
scriveva `applicability: descrizione`, la stessa stringa nei due campi,
su tutte e cinque le voci. E i testi erano tutti **condizioni**, non
descrizioni: mancava la metà che dice cos'è lo strumento.

Corretti lo script e i dati già scritti. In più una difesa: se i due
testi coincidono, se ne mostra uno solo — il catalogo lo compila Alessio
a mano.

---

## OPZIONALE A — le due schermate delle Scadenze: misurato, non corretto

Il giro è chiuso nei due versi (fatto il 23/08), ma **porta in un vicolo
cieco**, e la misura lo mostra:

| | |
|---|---|
| lotti in giacenza | **203** |
| in «Scadenze — da guardare» | **65** |
| in «Fermi da troppo» | **0** |
| prodotti con una durata dichiarata | **2 su 129** |

Da Scadenze il pulsante dice «Altre risposte: abbattuto, trasformato,
reso al fornitore…» e porta a una schermata che risponde **«Niente
fermo»**. Chi ha in mano il calamaro scaduto e vuole dire «l'ho
abbattuto» arriva su una pagina vuota: le sei risposte stanno **sulla
riga** di una partita ferma, e quella partita lì non c'è.

🔴 **E la radice è più profonda del giro**: «Fermi da troppo» è
**strutturalmente vuota** finché le durate non sono compilate — e le
durate le compila l'assistente (opzionale B). I due opzionali sono la
stessa storia.

**Non corretto perché la cura ha almeno tre forme, e la scelta cambia il
risultato:**

1. un **terzo bersaglio per riga** in Scadenze — ma cambierebbe di fatto
   il numero delle risposte lì, che il mandato vieta, e va contro «se un
   comando si ripete per ogni riga, quasi sempre ne basta uno»;
2. **Fermi accetta una partita specifica** (`?lotto=…`) e la mostra anche
   se non è ferma — richiede una funzione nuova nel database e cambia il
   perimetro di quella schermata;
3. **il pulsante porta all'elenco completo delle partite in giacenza**
   (203 righe) invece delle sole ferme — con un problema di lunghezza.

---

## OPZIONALE B — l'assistente non ha smesso

Misurato, in quest'ordine:

1. **`campi_compilati_il` è NULL su tutti e 129 gli ingredienti**: su
   questo insieme di prodotti nessuna scheda è mai stata compilata.
2. **I 126 prodotti dello scenario sono nati il 23/08 alle 10:00 UTC**
   (12:00 italiane): lo scenario è stato **ricostruito da zero** quella
   mattina, portandosi via i 4 prodotti compilati prima.
3. **L'unica durata presente** è di `TEST-AUTO prodotto fermo`, creato
   dalle prove automatiche — non dall'assistente.
4. **La catena AI è viva.** Chiamata la funzione online su un prodotto
   solo: **200 in 2,7 secondi**, modello `claude-haiku-4-5-20251001`,
   1320 token di domanda e 138 di risposta, **cinque campi scritti**
   compresa la durata, zero scartati, zero errori.

**Conclusione: non è una chiave scaduta né un limite raggiunto.** Le
durate erano zero perché lo scenario è stato riseminato e da allora
nessuno ha più premuto quel pulsante.

⚠️ **Effetto collaterale dichiarato**: la misura ha lasciato compilata la
scheda di **«Aceto di vino bianco»** (dispensa, 1825 giorni, ambiente,
tutto l'anno, allergeni stimati). Non l'ho riportata indietro: è un dato
che il gestionale ha prodotto correttamente, e rimettere `null` a mano
sarebbe stato peggio.

---

## OPZIONALE C — le frasi diventate false

Rilette le schermate toccate stanotte. **Una trovata**, e diventata falsa
nel giro di poche ore (`20260824000005`).

La schermata iniziale di HACCP contava le letture fuori range di «oggi»
col **giorno di calendario**, mentre il registro delle temperature —
riscritto poche ore prima — decide «oggi» con la **serata di servizio**.

⚠️ Alle 03:00 la serata in corso è ancora il giorno prima: il badge
diceva «zero fuori range» mentre il registro sotto ne mostrava tre.
Nessuna delle due parti era rotta — **il difetto viveva nello spazio fra
le due**.

⚠️ **Non era falsa quando è stata scritta**: il giorno di calendario era
l'unica idea di «oggi» che il gestionale avesse.

E la lettura era **intera**: 732 rilevazioni portate nel browser per
contarne quelle di oggi. Ora si chiede al database.

In più due badge che prima non c'erano — attrezzature da leggere e
pulizie dovute: *un badge che conta solo i problemi trovati tace su
quelli non ancora cercati*.

**Non corrette** (e il perché):

- «Struttura pronta all'uso, ma le soglie di temperatura e le attività di
  pulizia vanno impostate» in cima a HACCP: **è falsa sul progetto di
  prova** (6 attrezzature e 7 attività configurate) ed è **vera in
  produzione** (0 e 0). Descrive uno stato, non una regola.

---

## Cosa abbiamo rovesciato

Tre rovesciamenti, registrati in
[`docs/decisioni_rovesciate.md`](../decisioni_rovesciate.md) ai numeri
**38, 39, 40**:

- **38** — «ci si confronta con la previsione chiusa più recente»
  (15/08). La ragione di allora **vale ancora** ed è conservata: fra
  quelle dell'anno giusto vince ancora la chiusa. Prima viene l'anno.
- **39** — «lo scadenziario è un elenco, le pulizie sono un elenco»
  (02/08). La ragione di allora non vale più: le righe non sono più
  dieci, sono 732 + 199 + 13 e crescono.
- **40** — «il costo del personale si scrive in due caselle libere»
  (15/08). La ragione di allora è salva — si scrive ancora quello che si
  sa — ma la libertà comprava anche la contraddizione.

---

## Cosa NON è verificato

- 🔴 **Le quattro migrazioni di stanotte non sono in produzione**:
  aspettano il push di Alessio. In produzione ci sono 196 migrazioni.
- **Nessuna mano vera** ha spuntato una pulizia, registrato una
  temperatura o riaperto una non conformità dalle schermate nuove: sono
  state aperte e interrogate, non usate in servizio.
- **Le misure delle schermate nuove** (testo ≥ 3,20 mm, bersagli
  ≥ 8,50 mm) **non sono state prese**: le tre schermate HACCP e il form
  delle previsioni sono cambiati, e nessun censimento ci è passato sopra.
- **Il blocco 3d** non è stato nemmeno iniziato.
- **La stampa** dei tre archivi mensili non è stata guardata: c'è il
  pulsante, nessuno ha aperto l'anteprima.
- **Il formato dei registri per l'ASP è provvisorio** per dichiarazione,
  non per stima: verrà rifatto con la biologa.

## Rilievi fuori mandato, non corretti

- **Cinque ingredienti `TEST-AUTO` residui** nell'anagrafica del progetto
  di prova (129 invece di 124): la pulizia di
  `tests/app/prodotto-fermo.test.js` cancella lotti e storico prezzi ma
  **non gli ingredienti**, di cui pure conosce l'identificativo.
- **Due allarmi** in `allarmi` sul progetto di prova, del 23/08 mattina,
  da un `registra_restituzione_prestito` e da uno scarico parziale.
