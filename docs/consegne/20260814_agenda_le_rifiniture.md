# Consegna del 14/08/2026 (settima) — l'Agenda, le rifiniture

**Commit della consegna: `4dcab1a`** (questo riepilogo è il commit
immediatamente sopra, sola documentazione). Working tree pulito.

| Commit | Cosa |
|---|---|
| `3bf6418` | due rifiniture dette da Alessio guardando l'Agenda |
| `7d3be96` | la sezione dei fatti — migrazione `20260814000006` |
| `4dcab1a` | stato della produzione dopo l'applicazione |

**Applicata in produzione**: `20260814000006`. **92 migrazioni**. Nessuna
funzione online reinstallata.

Coda del Blocco 1 del mandato cumulativo, nata **dall'uso**: Alessio ha
aperto l'Agenda nuova e in dieci minuti ha trovato due cose. Sono
entrambe difetti del disegno, non richieste in più.

---

## 1. «Elimina i completati» non aveva più senso — e aveva ragione

> *«Potendo eliminare un impegno con un tocco, il tasto elimina i
> completati non ha più senso.»*

Vero, e per un motivo preciso: quel pulsante aveva senso quando la lista
mostrava **anche** i fatti e si potevano contare prima di cancellarli.
Con le corsie un impegno chiuso sparisce, quindi il pulsante cancellava
in blocco **una cosa che non si vede**. Un comando di cui non puoi
verificare l'effetto è peggio di un comando che manca.

**Tolto.** Ma toglierlo apriva un buco più serio, ed è il punto 3.

---

## 2. La pagina degli adempimenti non diceva a cosa serve

> *«Non ho capito a cosa serve la sezione adempimenti pdf.»*

⚠️ **È un difetto della pagina, non una sua distrazione.** Il pulsante si
chiamava «Adempimenti (PDF)» — che descrive il **formato** e non il
**perché** — e la pagina si apriva su un elenco senza una riga che
spiegasse cosa se ne fa.

Ora il pulsante dice **«Scadenze da stampare»**, e in testa alla pagina
c'è una riga: tutte le scadenze fiscali in ordine di data, su un foglio
da portare a Laura o da tenere appeso.

**Il titolo è cambiato di conseguenza**, da «Calendario adempimenti
societari» a «Scadenze fiscali e societarie»: la categoria chiusa di ieri
raccoglie anche il fiscale corrente, e il titolo vecchio prometteva meno
di quanto il foglio contiene.

---

## 3. Il buco aperto togliendo il pulsante: un «fatto» non tornava indietro

Con le corsie, spuntare *fatto* fa sparire la riga. Senza un posto dove
rivederla, **la spunta era irreversibile** — e un gesto da cui non si
torna non lo si usa con serenità: si finisce per non spuntare niente, e
la lista smette di dire il vero.

In fondo alla lista, **chiusa di default**, c'è «Fatti di recente»: gli
ultimi 30 giorni, con **«rimetti da fare»** su ogni riga. Chiusa perché
la domanda dell'Agenda resta *cosa devo fare adesso*; presente perché la
via di ritorno deve esistere.

### ⚠️ Il caso che rende la cosa non banale: le ricorrenze

Chiudere un impegno che torna **ne fa nascere subito un altro**.
Rimetterlo «da fare» senza toccare il successore lascerebbe **due righe
per lo stesso adempimento** — e la seconda sembrerebbe legittima: nessuno
saprebbe che è il residuo di un tocco annullato.

Quindi il successore adesso **porta scritto da chi è nato**
(`tasks.generato_da`), e riaprendo l'originale viene tolto — **ma solo se
nessuno l'ha ancora toccato**. Se è già stato chiuso a sua volta resta
dov'è, e la schermata lo dice: **non si cancella il lavoro di qualcun
altro per annullare un tocco**.

---

## 4. Verifica

| Cosa | Stato |
|---|---|
| la migrazione sul progetto di prova | **applicata due volte**: idempotente |
| un impegno chiuso compare fra i fatti e sparisce dalle corsie | **provato** |
| riaperto, torna nelle corsie | **provato** |
| **ricorrente riaperto: il successore intatto viene tolto** | **provato** |
| **ricorrente riaperto: il successore già lavorato RESTA**, e si dice | **provato** |
| un impegno da fare non si «riapre» | **rifiutato** |
| elenco anonimi | **12**, controllato dentro la migrazione |
| prove automatiche | **46 verdi** |
| lint, build | puliti |
| **produzione** | **92 migrazioni** |
| `security definer` senza portiere | **14**, invariato |
| dati veri | **20 impegni, 2 fatti, 4 senza scadenza, 0 residui** |

**Dal vivo**: Alessio ha usato l'Agenda nuova e ha segnato **due impegni
come fatti** — sono i primi due che finiscono nella sezione da cui si
torna indietro, e i senza scadenza sono scesi da 5 a 4.

---

## 5. Cosa NON è verificato, e lo dico chiaro

- **Nessuno ha ancora premuto «rimetti da fare»**: la sezione è stata
  pubblicata pochi minuti fa. I due impegni chiusi ci sono dentro, ma il
  ritorno indietro non è mai stato fatto da una mano vera.
- **Le ricorrenze non esistono su nessun impegno vero**: il campo è nato
  ieri e nessuno l'ha ancora usato. Tutto il ragionamento sul successore
  — che è la parte delicata — è provato **solo dentro la migrazione**.
- **`fatto_il` è `updated_at`, non una data di chiusura vera**: è
  l'ultima cosa successa a quella riga. Se un impegno chiuso viene
  modificato, la data si sposta. Per questo la finestra è di 30 giorni,
  generosa invece che precisa — ma se servirà un registro esatto delle
  chiusure, questa colonna non basta.
- **I fatti più vecchi di 30 giorni non si vedono da nessuna parte**, e
  ora non c'è più nemmeno un modo di cancellarli: restano in tabella.
  Con venti righe non è un problema; è debito dichiarato.
- **Nessuna prova automatica copre l'Agenda lato applicazione**: la suite
  resta a 46.
- **I 3 impegni finiti in «Altro»** (le due date di locazione e
  l'intestazione del dominio) sono ancora lì: li ricolloca lui.
