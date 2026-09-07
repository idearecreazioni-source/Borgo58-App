# SPEC-0012 — le due liste della spesa si distinguono anche a voce

**07/09/2026.** Riepilogo di consegna.

* **HEAD dichiarato**: `77943e7` — il commit che sta sotto questo file.
* **Ramo**: `spec-0012-due-liste`, aperto da `84794ad` (master).
* **Migrazioni**: **una**, `20260907000001_le_due_liste_si_distinguono_a_voce`.
  Applicata **solo al progetto di prova**. Nessun dato vero toccato.
* **Funzione online**: `ascolta-voce`, installata **solo sul progetto di
  prova** (versione 20 → 21).
* **Prove**: **1.071 pure** · **513 contro il progetto di prova** · codice
  pulito · compilazione pulita.
  ⚠️ **Due prove pure restano rosse, e sono PREESISTENTI su `master`**
  (`indice-richieste`, `indice-rovesciamenti`): falliscono **solo su questa
  macchina**, per gli a-capo di Windows contro quelli di Unix — su GitHub
  sono verdi. Fuori perimetro, non toccate.

## Che cosa mancava, e che cosa no

Le due liste **esistevano già separate** nel gestionale dal 23/08/2026:
tabelle diverse (`shopping_list_items` e `spesa_spicciola`), schermate
diverse, indirizzi diversi, e nessun punto di contatto — la spicciola non
tocca giacenze, non genera ordini, non scrive costi. Questo lavoro **non le
ha create**: le ha rese distinguibili **per la voce**, che è l'unico posto
dove si confondevano.

Il fatto da cui nasce è del 06/09: Alessio detta *«segna il pesce spada nella
spesa spicciola»* e MEMO propone **«Aggiungi alla spesa»** — la lista dei
fornitori. Quel giorno la cura fu rendere quell'appunto **non approvabile**,
dichiarando che il gestionale quella lista, *per la voce*, non ce l'aveva.
Adesso ce l'ha.

## Le quattro strade, e nessuna sceglie in silenzio

Il nome della lista lo dichiara il modello in `dati.lista`; a decidere è
quel **fatto dichiarato**, non le parole della frase e non il tipo che il
modello ha proposto.

| quello che dice | dove va |
|---|---|
| «alla lista della spesa», «alla spesa» | Lista della spesa, come sempre |
| «alla spesa spicciola», «alla spicciola» | **Spesa spicciola** |
| «alla lista del bar» | appunto **non approvabile**, col nome che ha usato |
| non lo dice | appunto **non approvabile** che glielo **chiede** |

🔴 **Il nome detto vince sul tipo proposto dal modello, nei due versi.** Se
un giorno il modello proponesse la spicciola per una frase che nomina la
lista della spesa, la roba non cambia lista. È una regola deterministica, si
prova senza chiamare nessuno, ed è il motivo per cui vive nel gestionale e
non solo nel prompt: *il prompt si corregge, ma un modello non è una
garanzia.*

## Cosa abbiamo rovesciato

**Una cosa, e va detta per intero.**

* **Cosa era stato deciso e quando**: fino al 06/09/2026, una riga di lista
  dettata **senza nominare nessuna lista** finiva nella Lista della spesa.
  Era il comportamento normale, e una prova lo teneva fermo.
* **La ragione di allora**: di lista ce n'era una sola *per la voce*.
  Riempire il silenzio con l'unica destinazione possibile non toglieva
  nessuna scelta a nessuno.
* **Cosa si decide adesso**: il silenzio **non vale più** come «lista della
  spesa». Nasce un appunto che non si può approvare e che chiede quale delle
  due, con le parole da dire.
* **Perché la ragione di allora non vale più**: le destinazioni sono due, e
  scegliere per lui vuol dire che la scelta sbagliata si scopre **quando la
  roba è già nella lista che va al fornitore**. È il criterio scritto in
  SPEC-0012: *«se la destinazione manca o è ambigua, MEMO la chiede o la
  dichiara non capita; non usa automaticamente la Lista della spesa»*.

⚠️ **Il prezzo, dichiarato**: chi detta «aggiungi il pane» e basta non si
ritrova più la riga in lista — si ritrova un appunto che gli chiede dove.
Una parola in più da dire, in cambio di una lista che non si sporca da sola.

⚠️ **E questo riepilogo non aggiunge la riga in
[`docs/decisioni_rovesciate.md`](../decisioni_rovesciate.md)**, che la
convenzione del progetto vorrebbe: il mandato di oggi dice esplicitamente
«niente documenti separati o retrospettive». La decisione è raccontata qui;
se va messa anche nell'elenco, è un gesto di una riga da fare a parte.

## Le decisioni che non si leggono dal codice

1. **La spesa spicciola è una destinazione della voce, non un modo di
   spendere.** Non diventa un movimento di cassa, non diventa una spesa
   fiscale, non si abbina al magazzino: è il fuori-scope di SPEC-0012, ed è
   anche la ragione per cui **non tocca «La mia tasca»** — lì si registrano
   soldi usciti, qui no.
2. **Additivo come l'altra lista**: tre articoli detti in tre momenti per la
   stessa lista sono **un appunto solo** (SPEC-0013). E siccome il
   raggruppamento guarda il tipo, **due articoli per liste diverse restano
   due appunti** — che è esattamente ciò che si voleva.
3. **La nota detta non arriva alla schermata**, e il perché è scritto nel
   database: la spesa spicciola ha due campi soli, cosa serve e la categoria.
   La nota viene scritta **approvando** l'appunto, che è la via normale; si
   perde solo scegliendo di finire a mano, ed è meglio saperlo che
   ritrovarsela in un campo che non si vede.
4. **Ogni riga ha la sua uscita a mano** (regola del 27/08): dalla spesa
   spicciola dettata si finisce in `/magazzino/spesa-spicciola` coi campi già
   scritti. Senza, l'uscita a mano avrebbe portato a un modulo vuoto — cioè
   avrebbe buttato via quello che il gestionale aveva già capito.
5. **Ogni schermata dice qual è delle due**, con una riga sola e il
   collegamento all'altra. La spesa spicciola ce l'aveva dal 23/08; adesso
   ce l'ha anche la lista della spesa, perché la domanda «e allora l'altra
   cos'è?» restava a chi apriva quella.

## Il collaudo, fatto guardando

Sul progetto di prova, con l'assistente vero (quattro frasi dettate):

* «Aggiungi parmigiano e shampoo **alla lista della spesa**» → appunto
  *«Aggiungi alla spesa»*, approvabile, **2 righe nella lista della spesa**.
* «Aggiungi parmigiano e shampoo **alla spesa spicciola**» → appunto
  *«Aggiungi alla spesa spicciola»*, approvabile, **2 righe nella spesa
  spicciola** — e zero nell'altra.
* «Aggiungi il pane» → appunto **«Quale delle due liste?»**, non
  approvabile, col motivo che dice le due parole da usare.
* «Aggiungi il sale **alla lista del bar**» → appunto **«Aggiungi a «bar»»**,
  non approvabile.

Le righe create dal collaudo sono state tolte.

## La verifica della migrazione, provata per rottura

Il blocco di verifica controlla che la riga finisca **nella sua lista e non
nell'altra**, nei due versi, che l'uscita a mano esista, che nessun tipo resti
senza il gesto che lo esegue, e che non resti in giro nessuna riga (guardiano
del 26/08, su tutte le tabelle).

Ed è stato **rotto apposta due volte**, estraendo il solo blocco di verifica
— riapplicare la migrazione intera curerebbe la rottura prima di provarla:

* la spicciola scritta nella lista della spesa → **rossa**: *«La riga non è
  finita nella spesa spicciola»*;
* la lista della spesa scritta nella spicciola → **rossa**: *«La riga non è
  finita nella lista della spesa»*.

⚠️ **La prima rottura che avevo provato non provava niente**: sostituendo
tutta la funzione, a scattare era il primo guardiano (la rete dei tipi senza
ramo) e il controllo in esame non veniva nemmeno raggiunto. È la lezione del
26/08, incontrata di nuovo.

## Cosa NON è verificato

1. **Niente di tutto questo è stato applicato al gestionale vero.** La
   migrazione e la funzione online vivono solo sul progetto di prova.
2. **Nessun occhio ha guardato le due schermate su un telefono.** Le righe
   nuove — la spiegazione sulla lista della spesa e la striscia della voce
   sulla spicciola — sono state compilate e provate dal codice, non viste.
3. **Il modello è stato provato su quattro frasi**, una per strada. Che
   capisca *tutte* le formulazioni possibili non lo dimostra nessuna prova.
   Quello che è dimostrato è che, **qualunque cosa proponga**, il nome detto
   decide.
4. **I modi di dire sono un elenco di parole italiane**, e in questo progetto
   è una forma che invecchia. Regge perché sbaglia nel verso innocuo: un
   sinonimo che manca non manda la roba nell'altra lista — la lascia in un
   appunto che non si può approvare e che dice perché.
5. **La revisione esterna del diff non è stata fatta**: lo strumento
   (`codex`) non è installato su questa macchina.
