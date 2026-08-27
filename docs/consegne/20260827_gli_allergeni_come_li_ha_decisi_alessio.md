# Gli allergeni come li ha decisi Alessio, e da dove viene l'uovo

**27/08/2026, pomeriggio.** Blocchi 1, 2 e 3 del mandato «gli allergeni
tornano come li ha decisi Alessio», più due delle quattro voci del Blocco 4.

**HEAD dichiarato**: `b4d3108fc8b13d980aecdeb1d4520991e9f66f1d`
**Working tree**: pulito al momento della scrittura di questo riepilogo.

---

## Cosa abbiamo rovesciato

**Uno**, ed è mio: registrato come **n. 61** in
[`docs/decisioni_rovesciate.md`](../decisioni_rovesciate.md).

1. **Cosa era stato deciso, e quando.** Il 25/08, da me, **senza mandato**:
   un allergene dedotto resta «da verificare» e il piatto non stampa l'elenco
   finché qualcuno non conferma.
2. **La ragione di allora.** Su una materia di salute, sbagliare dalla parte
   di non promettere sembrava sempre la scelta prudente.
3. **Cosa si decide adesso.** Un allergene dedotto **vale come confermato**.
   Sparisce la conferma di massa, sparisce il blocco della stampa; **resta il
   dato**.
4. **Perché la ragione di allora non vale più.** L'aveva già rovesciata
   Alessio il 25/08 sera. Questa riga esiste perché **la rimozione fu fatta in
   un posto solo** — vedi sotto. ⚠️ E la prudenza resta vera per **un** caso,
   dichiarato: l'origine **vuota**, che non è un dedotto.

---

## Blocco 1 — la rimozione era stata fatta in un posto su quattro

Il mandato chiedeva di misurare *quale delle due*: la rimozione non è mai
stata fatta, o è tornata? **Nessuna delle due** (vero, misurato con
`git log -S` e leggendo il commit `cba381f`):

| dove | stato |
|---|---|
| la **vista** `v_recipe_allergens` | tolta il 25/08 — lì un dedotto passa davvero |
| la **schermata** delle schede prodotto | **rimasta** dal 13/08, mai toccata |
| il **commento della colonna** nel database | **rimasto** («non valgono per la stampa») |
| un **commento dell'API** | **rimasto** |
| la **frase nella scheda ricetta** | **rimasta** («allergeni solo stimati») |

🔴 **Quindi non è "tornata": non è mai stata tolta da quattro posti su
cinque.** E la risposta utile non è quella che il mandato si aspettava — è
più generale: **una regola vive in più posti di quanti se ne toccano
togliendola**, e si toglie da dove il difetto è stato *misurato*. Qui la cura
era nata nel database, dove il difetto era stato misurato, e le parole sono
rimaste indietro.

⚠️ **E le parole rimaste indietro non erano innocue: dicevano una cosa falsa
sul gestionale.** Chi leggeva «finché non li confermi non vengono usati per
la stampa» credeva che confermare servisse a qualcosa che già funzionava da
sé — cioè faceva un lavoro inutile credendolo necessario.

### Cosa è sparito, e cosa è rimasto

Spariti: il titolo «Allergeni da confermare», la frase sul blocco della
stampa, «Confermo tutti», «Confermo questi allergeni».

**Rimasto il dato**, che è la decisione del 24/08: la sezione ora si chiama
**«Da dove vengono gli allergeni»** ed elenca i prodotti con la loro origine
in parole — *letto in etichetta · da una fonte consultata · dedotto dal nome ·
verificato da te · non l'ha guardato nessuno*.

**Misurato a schermo, sulla prova** (prova): 50 «verificato da te», 78 «non
l'ha guardato nessuno», 1 dedotto, 1 letto in etichetta.

### La prova richiesta: la stampa

Costruito un piatto con un allergene **dedotto e mai riguardato da nessuno**,
messo nella carta attiva, e acceso «Mostra allergeni» (prova):

> Risotto ai tenerumi e vongole \* · 19,00 €
> **GUARDA piatto col dedotto · 12,00 €**
> **Glutine**
> Secondi…

Il glutine **è stampato**, e **senza asterisco** — l'asterisco è il segno di
«non l'ha guardato nessuno», che resta e che gli altri piatti hanno.

⚠️ Migrazione `20260827000008` per il commento della colonna, con la verifica
che **discrimina**: il dedotto passa, il vuoto no. Senza il secondo controllo
passerebbe anche una vista che non guarda niente.

---

## Blocco 2 — i prodotti si aprono, e la mano si registra da sé

**Aperti** (prova): dalla schermata delle schede prodotto ogni riga è un
collegamento alla scheda dell'ingrediente. La riga intera si tocca — bersaglio
alto 1,05 cm invece dei millimetri di un'icona.

### La voce in vigore da onorare, e non succedeva

🔴 Il payload della scheda ingrediente manda `allergens` e **non manda**
`origine_allergeni`: toccando le spunte, l'origine restava com'era. Un
prodotto che nessuno aveva guardato restava «non l'ha guardato nessuno»
**dopo che Alessio l'aveva guardato** — e siccome quello è l'unico caso che
tiene l'elenco fuori dal menu, poteva metterli a mano e vedere il piatto
restare senza allergeni sulla carta.

**Migrazione `20260827000009`**, e la cura sta nel database perché quella
tabella si scrive da **cinque porte**.

🔴 **Come si distingue una mano da una macchina**: *chi sa da dove viene un
dato lo dichiara*. L'assistente scrive il valore **e** l'origine; una persona
cambia solo il valore. ⚠️ Il criterio ovvio — «`allergens` è cambiato → è una
mano» — sovrascriverebbe anche quello che l'assistente ha appena dedotto,
togliendo al cameriere l'unica informazione che gli dice di non garantire.

**Provato a schermo** (prova): aggiunto «Sedano» dalla scheda di un prodotto
che era `stimati` e premuto Salva → l'origine è passata a `confermati` e i
due allergeni hanno preso origine `alessio`. ⚠️ Un allergene **letto in
etichetta** non viene sovrascritto (provato nella migrazione).

🔴 **Difetto mio, trovato applicando**: il trigger era
`after update of origine_allergeni` e **non scattava mai** — in Postgres
`UPDATE OF` guarda le colonne **nominate**, e l'origine la scrive il trigger
BEFORE. L'ha preso la verifica al primo colpo.

### Le categorie — NON FATTO, con la misura

⚠️ **Il perimetro è più largo di come sembra** (vero, misurato): l'enum
`ingredient_category` tocca 2 colonne e 2 funzioni nel database, ma anche la
**rete dei vocabolari chiusi**, `constants.js`, 3 schermate e **i prompt di
due funzioni online** (`leggi-foto` e `ascolta-voce`).

🔴 **È l'ultimo punto a decidere**: se le categorie diventano dati di Alessio,
i prompt devono riceverle dal catalogo — altrimenti l'assistente continua a
proporre le vecchie e sbaglia **in silenzio**. Cioè il lavoro tira dentro il
modo in cui l'assistente riceve i vocabolari: è un mandato a sé, come il
collegamento delle sette schermate.

⚠️ **E oggi non ci si ferma del tutto**: «Altro» esiste nel menu. Misurato
sulla prova: **20 prodotti su 134** ci sono finiti — che è la misura del
bisogno, non la sua smentita.

---

## Blocco 3 — da dove viene l'allergene

Le parole di Alessio: *«come mai è presente l'uovo in questo piatto di
tortellini in brodo se la pasta è acqua e farina?»* — *«l'uovo è nel brodo»*.

**Migrazione `20260827000010`**: `catena_allergeni(ricetta)` dà, per ogni
allergene, **il prodotto che lo porta** e **la strada** — le preparazioni
attraversate, in ordine — più l'origine e la fonte.

⚠️ **La strada si costruisce scendendo**, non si ricostruisce dopo:
ricostruirla vorrebbe dire indovinare quale strada è stata percorsa quando un
prodotto entra da due parti, e il caso non è teorico.

🔴 **Due strade danno DUE righe.** Fonderle direbbe «dal brodo o dalla pasta»,
che non è una risposta per chi deve decidere se togliere il brodo.

**Guardato su una ricetta vera** (prova) — *Cannolo scomposto*:

> **Glutine** · da Farina di grano duro · dentro Frolla per cannoli · verificato da te
> **Latte** · da Burro · dentro Frolla per cannoli · verificato da te
> **Latte** · da Ricotta di pecora · dentro Ricotta setacciata · verificato da te

**E in comanda non c'è** (vero, misurato sul codice): le schermate delle
Comande non chiamano `catena_allergeni`, e `allergeni_della_riga` restituisce
**sei colonne — nessuna strada, nessun prodotto**. Si vede l'allergene e
basta, con gli eliminabili premibili.

⚠️ **La postilla non è stata inventata**: *«l'uovo serve da coagulante per
chiarificare»* è sapere di Alessio, e il gestionale non lo mette in bocca a
nessuno.

---

## Blocco 4 — due voci su quattro

### Dalla Dashboard non si tornava indietro ✅

**Misurato**: **18 rotte di primo livello su 18** senza ritorno alla
schermata iniziale (vero).

🔴 **La cura è una sola, ed è nel Layout.** Il difetto sta in nessuna
schermata e in tutte — è la stessa famiglia del pulsante del menu del 22/08 —
e curarlo schermata per schermata vorrebbe dire quindici modifiche e la
sedicesima dimenticata.

⚠️ **Il bersaglio era già lì: il logo.** Aggiungere una freccia accanto
avrebbe messo due gesti a un centimetro l'uno dall'altro per fare la stessa
cosa. Sulla Dashboard non compare.

**Provato a 390 punti** (prova): bersaglio **8,50 × 26,28 mm**, il tocco
porta a `/dashboard`, e sulla Dashboard il ritorno non c'è.

### Le foto lette adesso hanno un nome ✅

⚠️ **Non è stato aggiunto nessun dato**: `letture_foto.ingredient_id` era già
in tabella e nessuno lo leggeva; la data c'era e non si mostrava.

**Guardato** (prova): da «etichetta — 0,02 €» a
**«Aceto di vino bianco · etichetta · 27 ago · 0,03 €»**. ⚠️ Quando la foto
parte dalla Dashboard il prodotto non c'è, e il nome **non si inventa**:
resta il genere.

### Il pollice 🟡 e la pagina che si ricarica 🟡 — non fatte

Vedi la rilettura e le domande.

---

## Le reti che si sono accese da sole

🔴 **La rete dei portieri, per la seconda volta in due giorni**:
`catena_allergeni` è nata senza portiere e la prova è diventata rossa
un'ora dopo — **23 attese, 24 trovate** (prova).

⚠️ **E la decisione su chi la vede non è scontata**: la tentazione era
aprirla alla sala, perché la decisione del 24/08 dice che l'origine serve al
cameriere. Ma **oggi in sala non la chiama nessuno**, e aprire una porta
perché un giorno potrebbe servire vuol dire lasciarla aperta *adesso*. È il
discriminante del 25/08: «chi la chiama oggi», non «chi potrebbe».
Migrazione `20260827000011`.

---

## RILETTURA

**Cosa NON ho verificato con gli occhi**
- **Nessuna immagine**: lo screenshot non funziona in questo ambiente. Tutto
  ciò che è «visto» è **letto dal DOM**.
- **Niente da un telefono vero**: la larghezza è emulata a 390 punti.
- **La comanda non l'ho aperta**: che la catena non ci arrivi è misurato **sul
  codice** (nessuna chiamata, e la funzione della riga restituisce sei colonne
  senza strada), non guardando una comanda vera con quel piatto dentro.
- **Il menu stampato l'ho letto come testo**, non come foglio uscito da una
  stampante.

**Cosa ho contato senza leggerlo**
- Le **432 prove sull'app** e le **494 pure**: ho letto il totale.
- Le **18 rotte di primo livello**: contate da uno script che legge `App.jsx`,
  non aprendole una per una.

**Quali mie affermazioni sono diventate false mentre lavoravo**
- «La rimozione del 25/08 o non è stata fatta o è tornata»: **nessuna delle
  due** — era stata fatta in un posto su cinque.
- «Il riquadro che Alessio ha visto elencava dei prodotti»: **falso**, sulla
  prova i prodotti `stimati` sono **zero** — titolo e frase compaiono sempre,
  anche con l'elenco vuoto. Quindi ha letto una frase falsa su una schermata
  dove non c'era niente da confermare.

**Quali blocchi non ho aperto**
- **Blocco 4, voce 1 — il pollice.** ⚠️ Il mandato dice di fermarsi se si
  scontra con la voce del 21/08 (niente scorrimento laterale): **non ho
  ancora misurato se si scontra**, quindi non l'ho né fatto né escluso. È
  fra le domande.
- **Blocco 4, voce 3 — la pagina che si ricarica.** Non aperta.
- **Blocco 2, le categorie**: non fatte, con la misura del perimetro sopra.

**Quali conteggi sono pavimenti e non totali**
- I **cinque posti** dove la regola era rimasta scritta sono quelli che ho
  trovato cercando due frasi: potrebbero essercene altri con parole diverse.
- Le **18 rotte** sono un totale delle rotte di primo livello, non di tutte
  le schermate.

**Voci di `docs/DECISIONI.md` toccate**
- *Allergeni*: onorate le due voci del 24 e 25/08 (compilazione automatica,
  dedotti = confermati) e quella del 25/08 sulla mano di Alessio. Aggiunte le
  quattro conferme del 27/08.
- Sezione nuova **«Come si gira nel gestionale»**: il pollice (marcato **non
  ancora fatto**) e il ritorno alla schermata iniziale.

**Migrazioni in attesa, e l'ordine dei comandi**
In produzione ci sono **270** migrazioni (vero). Sul progetto di prova **283**.
Ne aspettano **tredici**:

`20260826000017` · `20260826000018` · `20260827000001` · `20260827000002` ·
`20260827000003` · `20260827000004` · `20260827000005` · `20260827000006` ·
`20260827000007` · `20260827000008` · `20260827000009` · `20260827000010` ·
`20260827000011`

Ordine: **commit → push di Alessio → `npm run migra -- --conferma` →
riepilogo → secondo push.**

⚠️ E **due funzioni online** vanno installate dopo il push: `ascolta-voce`
(**col comando del gestionale**, che sa di dover lasciare aperta la porta
della Scorciatoia) e `operazioni-atomiche`.

**Lezioni nuove nel file delle trappole** (`CLAUDE.md` §8)
- una regola tolta vive in più posti di quanti se ne toccano togliendola — e
  le parole rimaste indietro dicono una cosa **falsa sul gestionale**;
- `UPDATE OF colonna` guarda ciò che è stato **nominato**, non ciò che è
  cambiato;
- per distinguere una mano da una macchina si guarda **chi dichiara**;
- un difetto che sta nel layout si cura **una volta sola**.
