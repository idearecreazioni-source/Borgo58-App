# Un promemoria può avvisare — 10/09/2026

Blocco 3 del mandato notturno. MEMO capisce una frase che contiene **due
date** — il giorno in cui la cosa succede e il giorno in cui il telefono deve
suonare — le mostra tutt'e due prima della firma, e scrive la notifica Telegram
solo dopo «Approva».

**Migrazione**: `20260910000002_un_promemoria_puo_avvisare.sql`
**Applicata**: **solo sul progetto di prova** (`Borgo58-Prova`, 386 migrazioni
registrate). In produzione **no**.
**Funzione online toccata**: `ascolta-voce` (solo il testo delle istruzioni al
modello). **Non installata da nessuna parte** — nessuna funzione online è stata
messa in linea in questo lavoro.

---

## La frase del mandato, parola per parola

> *«Segna che ho appuntamento in banca sabato 13 e ricordamelo con una notifica
> il giorno prima alle 15.»*

Dentro ci sono **due date e non una**. Il gestionale sapeva scriverne una sola:
il campo del promemoria Telegram (`tasks.remind_at`) esiste dal primo giorno, e
a voce non lo riempiva nessuno.

⚠️ **E il modo di fallire era muto**: dettando quella frase nasceva un impegno
giusto, **senza nessun avviso**, e nessun errore da nessuna parte. Chi l'ha
dettata resta convinto di aver chiesto una notifica, e se ne accorge il giorno
in cui non arriva — cioè il giorno in cui serviva.

---

## Cosa c'è adesso

Tre campi nuovi nei dati di un `promemoria`:

| campo | cos'è |
|---|---|
| `avviso_data` | il giorno in cui il telefono suona (≠ dal giorno dell'impegno) |
| `avviso_ora` | l'ora italiana, in ventiquattr'ore |
| `avviso_chiesto` | **ha chiesto un avviso**, anche se non ha detto quando |

### 🔴 Il terzo campo non è un di più: senza, un caso cade in silenzio

«Ricordamelo» senza dire quando e «non voglio nessun avviso» arriverebbero al
database **identici**: due campi vuoti. Nel primo caso la richiesta di Alessio
cadrebbe senza che nessuno lo dica; nel secondo è la cosa normale. Con
`avviso_chiesto` il gestionale distingue, e nel primo caso **chiede**.

### 🔴 Qui non si inventa né il giorno né l'ora

*Un'ora plausibile messa al posto di un'ora detta è indistinguibile da un'ora
detta*: l'avviso arriverebbe quando ha deciso il gestionale, e chi lo riceve
crederebbe di averlo chiesto lui. Quindi **mezzo avviso non è un avviso**: si
chiede, e finché non c'è la risposta l'appunto **non è approvabile**.

⚠️ **Come si rende non approvabile**, ed è lo stesso meccanismo dell'Agenda del
09/09: si cambia il **tipo** in `promemoria_quando_avvisare`, che nel catalogo
`tipi_azione_vocale` **non c'è**. `eseguibile` lo decide il catalogo, non i
dati — quindi un tipo che lì non esiste nasce non approvabile **per
costruzione**, senza nessun controllo da ricordare. Non è una dimenticanza da
sanare: è la strada.

I quattro casi, e cosa succede in ciascuno:

| cosa ha detto | cosa fa il gestionale |
|---|---|
| giorno e ora, nel futuro | propone, si vede tutto, si approva, scrive `remind_at` |
| niente di niente | l'impegno nasce senza avviso, ed è il caso normale |
| «ricordamelo» senza quando | **non approvabile**, e chiede giorno e ora |
| solo il giorno, o solo l'ora | **non approvabile**, e dice quale metà ha capito |
| un momento già passato | **non approvabile**, e dice quando sarebbe stato |

---

## 🔴 Il controllo vale al momento di «Approva» — e chi lo fa è misurato

Fra la proposta e la firma possono passare ore: un appunto lasciato aperto la
sera si approva la mattina dopo. Un avviso che allora era futuro **adesso può
essere passato**. Se il controllo valesse solo alla proposta si scriverebbe un
promemoria che **non arriverà mai** — il lavoro che manda le notifiche guarda
`remind_at <= now()` e va avanti, quindi quella riga resterebbe lì a dichiarare
una notifica che non parte, senza nessun errore.

I controlli sono **due**, e non fanno la stessa cosa:

| dove | cosa protegge |
|---|---|
| `voce_risolvi_dati` | **la strada vera.** `approva_appunto` rigira quella funzione al momento della firma e si ferma sul suo «manca» prima di chiamare l'esecutore |
| `fai_azione_dettata` | **l'esecutore da sé.** Non scrive un avviso passato nemmeno se chi lo chiama non ha guardato |

🔴 **E qual è quale è stato misurato rompendo, non dedotto leggendo.** La prima
stesura di questo lavoro diceva che il secondo controllo era «quello che
protegge davvero»: **è falso**. Spegnendolo, tutte e **552** le prove contro il
progetto di prova restano **verdi** — perché dalla porta dell'app quel ramo non
si raggiunge mai. La rottura che rende rossa la prova è spegnerli **tutt'e due**.

⚠️ Il secondo si tiene lo stesso, e la ragione è la stessa per cui in questo
progetto gli invarianti stanno nel database e non nelle schermate: *chi scrive
non si fida di chi chiama*. Ma è scritto nel file, nel commento e qui che **non
è il guardiano principale**, perché chi lo legge fra sei mesi non ci costruisca
sopra una sicurezza che non ha.

## ⚠️ L'ora è italiana

Senza il fuso, «alle 15» sarebbero le 15 di Greenwich — cioè **le 17 di qui in
estate**: l'avviso arriverebbe due ore dopo, plausibile e sbagliato. È la
famiglia già pagata undici volte in questo progetto, e la verifica la mette alla
prova rileggendo l'istante scritto in ora italiana invece di contarlo a mano
(così regge anche al cambio dell'ora).

## ⚠️ Il limite dei cinque minuti si DICE

Il lavoro `send-due-task-reminders` gira **ogni cinque minuti**: il Telegram
arriva all'ora scelta o entro i cinque minuti dopo. Non è un difetto da
correggere — è un fatto, e la schermata lo scrive accanto all'avviso, prima
della firma.

⚠️ Non è una scusa scritta piccola: chi aspetta il messaggio alle 15:00 spaccate
e lo riceve alle 15:04 pensa che il gestionale funzioni male. Dirlo prima costa
una riga; scoprirlo dopo costa la fiducia in **tutti** gli avvisi.

---

## E i dati si leggono in italiano prima della firma

L'appunto mostrava i campi col loro nome tecnico e le date come `2026-09-13`.
Con due date in gioco, «data» e «avviso data» si leggono come la stessa cosa
scritta due volte.

- le due date hanno un nome che le distingue: **giorno** e **ti avviso il**;
- una data si scrive come la scrive il resto del gestionale (`13 set 2026`);
- un'ora perde i secondi, che non dicono niente di più;
- ⚠️ e un campo che nessuno ha battezzato **continua a comparire col suo nome**:
  sparire sarebbe il difetto peggiore — chi firma non vedrebbe una cosa che sta
  approvando.

---

## Come è stato verificato

**Il blocco di verifica della migrazione** prova le tre unità del problema con
date **relative a oggi**, mai fisse: una verifica che dice «il 13/09/2026 è nel
futuro» diventa falsa il 14, e da lì fallirebbe per il calendario invece che per
un difetto.

**Provata per rottura, non rileggendola** — e col solo blocco di verifica
estratto, perché riapplicare la migrazione **ripara da sé** la rottura che le si
mette davanti (trappola del 26/08). Tre rotture, tre messaggi diversi e giusti:

| rottura | cosa ha detto |
|---|---|
| via la difesa dell'esecutore | «approvando più tardi, un avviso passato è stato scritto» |
| mezzo avviso resta approvabile | «un avviso senza ora resta approvabile (tipo invariato)» |
| l'ora non è più italiana | «l'avviso è alle **17:00** invece che alle 15:00 (ora italiana)» |

⚠️ La terza è quella che vale di più: **17:00 invece di 15:00** è esattamente il
modo in cui questo difetto si presenterebbe dal vivo — un orario plausibile, e
nessun errore.

**Le prove delle schermate** (9 nuove), provate anch'esse per rottura:

| rottura | quante rosse |
|---|---|
| l'avviso non si annuncia più | 1 — quella sui cinque minuti |
| via le due guardie di `avvisoDellElemento` | 2 sulle schermate, 3 pure |

**Numeri**:
- prove pure: `tests/unita/appunti.test.js`, **+8**;
- prove sulle schermate: `tests/schermate/appunto-avviso.test.jsx`, **9 nuove**;
- prove contro il progetto di prova: `tests/app/promemoria-che-avvisa.test.js`,
  **8 nuove** — 544 → **552, tutte verdi**.

### ⚠️ Nessun Telegram è partito, ed è una proprietà e non una speranza

Il lavoro delle notifiche guarda `remind_at <= now()`. Se una riga di prova
avesse un avviso nel passato, manderebbe **un messaggio vero al telefono di
Alessio** — che è precisamente il difetto pagato l'11/08/2026, quando la
verifica di una migrazione fece arrivare su Telegram una prenotazione finta.
Qui gli avvisi delle prove sono tutti a **trenta giorni da oggi** (o rifiutati),
e c'è una prova che lo controlla riga per riga invece di darlo per scontato.

---

## Cosa NON è verificato

- 🔴 **Nessuna chiamata al modello.** Quello che il modello dovrebbe capire —
  «sabato 13» e «il giorno prima alle 15» — nelle prove è scritto a mano nei
  dati dell'azione. Quindi **non è dimostrato che il modello legga quella frase
  come previsto**: è dimostrato cosa fa il gestionale dei due campi, che è
  l'altra metà. Il collaudo del modello è la dettatura dal telefono, e va fatta
  con le mani.
- **La funzione online non è installata da nessuna parte**: le istruzioni nuove
  vivono nel repository e basta. Finché non viene installata, dettando quella
  frase il modello continua a non riempire i due campi — e l'impegno nasce senza
  avviso, come prima.
- **Nessun Telegram è mai arrivato su un telefono** in questo lavoro: la catena
  è provata fino a `remind_at` scritto giusto, non oltre.
- **Nessuna mano ha guardato la schermata**: quello che è «visto» qui è montato
  in un ambiente di schermo.
- 🔴 **Una prova di questo blocco prometteva più di quello che misura, ed è
  stata corretta invece che lasciata.** Si chiamava «e il controllo si rifà al
  momento di Approva» e sembrava sorvegliare la difesa dell'esecutore: rompendo
  quella difesa **restava verde**, perché la strada dell'app si ferma prima.
  Adesso si chiama con quello che misura davvero — che l'avviso passato **non
  venga scritto**, chiunque dei due lo fermi — e il commento dice quale rete la
  tiene in piedi e quale no. *Una prova che passa non dimostra di sorvegliare
  quello che il suo titolo dice.*

---

## Cosa abbiamo rovesciato

**Niente.** Non c'è nessuna decisione precedente che questo blocco contraddice:
il campo del promemoria Telegram esisteva già e si riempiva solo a mano, e
nessuna decisione diceva che a voce non si dovesse riempire — semplicemente non
era mai stato costruito.

⚠️ Una cosa **si estende** e va detta: la regola del 27/08 — *«qualunque campo
che il database sa riempire meglio del modello va lasciato vuoto dal modello»* —
qui vale al contrario, e il perché conta. Il giorno dell'avviso il database
**non** lo sa calcolare: «il giorno prima» è lingua, e la lingua è mestiere del
modello. Quello che il database fa, e che il modello non deve fare, è **rifiutare
quello che non è stato detto**: mezzo avviso, un'ora inventata, un momento
passato. La divisione resta quella di sempre — il modello capisce, il database
non si fida.

---

## Migrazioni installate solo sul progetto di prova

`20260910000002_un_promemoria_puo_avvisare.sql` — applicata a **Borgo58-Prova**,
registrata (386 migrazioni). **Non applicata in produzione.**

---

**Hash di HEAD dichiarato**: `3c298ce` sul ramo `promemoria-telegram`, cioè il
commit immediatamente sotto questo documento.
**Stato del working tree al momento della consegna**: pulito.
