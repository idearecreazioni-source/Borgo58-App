# L'Agenda semplice e usabile — 10/09/2026

Blocco 2 del mandato notturno. Quattro cose, in ordine: la ricorrenza si dice a
parole sue, il modulo perde due caselle che non sceglievano niente, l'elenco
perde due colonne e guadagna il tocco su tutto il quadrotto, e il censimento
degli altri elenchi del gestionale.

**Migrazione**: `20260910000001_una_ricorrenza_si_dice_a_parole_sue.sql`
**Applicata**: **solo sul progetto di prova** (`Borgo58-Prova`, 385 migrazioni
registrate). In produzione **no**, e non va applicata finché questa proposta non
è unita.
**HEAD dichiarato**: vedi l'ultima riga di questo documento.

---

## A. «Ogni N giorni / settimane / mesi / anni»

### Cosa c'era, e perché non bastava

La casella «Si ripete» offriva quattro possibilità scelte da chi ha scritto il
codice: ogni mese, ogni tre mesi, ogni sei mesi, ogni anno. Sono le cadenze del
**calendario fiscale**, e infatti gli unici impegni ricorrenti mai nati sono
adempimenti societari. Tutto il resto della vita di un'osteria — cambiare i
filtri della cappa, chiamare il tecnico della cella, ritirare le analisi — cade
su cadenze che quell'elenco non contiene.

⚠️ **E il modo di fallire era muto**: il menu si apriva, quattro voci, nessun
errore. *Un elenco chiuso che non contiene il caso di chi guarda non sembra
incompleto: sembra che quella cosa non si possa fare.*

### Cosa c'è adesso

Due dati invece di una parola: **quante volte** (`tasks.ricorrenza_ogni`) e **di
che cosa** (`tasks.ricorrenza_unita`, fra `giorni`, `settimane`, `mesi`, `anni`).
Le quattro voci di prima sono casi particolari della forma nuova, quindi non si
perde niente.

Tre vincoli, ognuno con la sua frase italiana (regola del 24/08):

| vincolo | cosa impedisce |
|---|---|
| `ricorrenza_ogni_sensata` | `ogni 0` e le cifre digitate storte (1..999) |
| `ricorrenza_unita_valida` | una parola che nessuno sa contare |
| `ricorrenza_intera` | mezza cadenza: o ci sono tutt'e due, o non si ripete |

⚠️ **La colonna vecchia si toglie, non si spegne.** Una colonna lasciata lì
vuota, fra sei mesi, qualcuno la riaccende credendo di riparare qualcosa — e da
quel momento due posti direbbero ogni quanto si ripete lo stesso impegno.

### La sanatoria, coi numeri

Applicando sul progetto di prova: **6 ricorrenze convertite**, zero rimaste
indietro (la migrazione si ferma se ne trova una). Misurato dopo:

```
ricorrenza_ogni | ricorrenza_unita | quanti
              1 | anni             |      3      (erano «annuale»)
              1 | mesi             |      1      (era  «mensile»)
              3 | mesi             |      1      (era  «trimestrale»)
              6 | mesi             |      1      (era  «semestrale»)
```

80 impegni senza cadenza, invariati. La colonna `ricorrenza`: **non esiste più**
(zero righe in `information_schema.columns`).

⚠️ **In produzione le righe da convertire sarebbero ZERO**: misurato il
10/09/2026, i 15 impegni della produzione non hanno nessuna ricorrenza. La
sanatoria lì non toccherebbe niente — e lo direbbe, invece di tacere.

### Cosa cambia nel calcolo della prossima scadenza

`completa_task` è ripresa dal **corpo vivo del database** (regola del 18/08):
cambia solo il conto. Il portiere, i tre rifiuti e la regola «si conta dalla
SUA scadenza, non da oggi» arrivano interi.

🔴 **E l'`else` del `case` solleva invece di rispondere vuoto.** Senza,
un'unità fuori vocabolario darebbe una data vuota — cioè un impegno nuovo
**senza scadenza** al posto di quello ricorrente: la famiglia della risposta più
corta che ha l'aria di essere intera (19/08).

`agenda_corsie()` e `agenda_fatti()` portano i due dati al posto della parola.
⚠️ Rifatte con `drop` + `create` perché cambiano le colonne della risposta, e il
`revoke` è rimesso a mano: **dopo un `drop` i permessi tornano aperti al mondo**
(trappola già pagata il 13/08).

### Le tre dichiarazioni alla rete delle guardie

Nel file, una riga ciascuna: `completa_task` perde le quattro parole
`mensile/trimestrale/semestrale/annuale`; `agenda_corsie` e `agenda_fatti`
perdono la colonna `ricorrenza` dalla risposta. Nessun rifiuto e nessun portiere
si perde: al loro posto ne nasce **uno in più**, quello che rifiuta un'unità che
non si sa calcolare.

---

## B. Il modulo perde due caselle che non sceglievano niente

- **Stato**: via. Un impegno appena scritto è «da fare», sempre — non esiste il
  caso di uno che apre «Nuovo impegno» per dichiararlo già completato. La
  colonna resta, e su un impegno che si sta correggendo resta quella che era.
- **Categoria**: via. Il menu lo dimostrava: su venti righe diceva «Altro»
  quindici volte. Un impegno scritto a mano nasce «altro». ⚠️ **Non si riscrive
  niente all'indietro**: un impegno nato dalla posta o dall'Archivio tiene la
  categoria che gli ha messo il modulo che l'ha creato, e correggerlo dal modulo
  non gliela cambia.
- **Restano** «Per me conta» e la visibilità allo staff.
- **Tre didascalie tolte** (ricorrenza, visibilità staff, promemoria Telegram):
  si leggono il primo giorno e poi diventano arredamento. ⚠️ Tolte **dichiarando
  dove la regola resta scritta** — §3.18 e il trigger `trg_task_visibility` per
  la visibilità; il gesto stesso per la ricorrenza. Il giorno che entrerà
  personale nuovo la spiegazione va rimessa, con parole per chi non ha mai visto
  questa schermata.
- **Giorno e ora**: etichette «📅 Giorno» e «🕒 Ora» su tutt'e due le coppie
  (scadenza e promemoria), affiancate e della stessa larghezza. ⚠️ La cura vera
  è `min-w-0` sulle colonne della griglia: una casella `date` o `time` ha una
  larghezza minima sua, e senza quella riga il riquadro **esce dallo schermo
  invece di stringersi**. È la famiglia misurata il 25/08 su HACCP, Magazzino e
  Comande — da un monitor non si vede, perché lo spazio c'è.

### 🔴 Il passo di cinque minuti, e la parte non ovvia

`step={300}` non è solo un comodo per il selettore: rende **non valido** un
orario fuori griglia. Un promemoria già salvato alle **20:07** non si potrebbe
più salvare — il modulo si rifiuterebbe di partire, su una cosa che nessuno
aveva chiesto di cambiare.

Quindi il passo si mette **solo dove non fa danno**: casella vuota, o orario già
sui cinque minuti. Chi ha un 20:07 se lo tiene finché non lo cambia lui — che è
esattamente ciò che il mandato chiede («non modificare gli orari esistenti»).

---

## C. L'elenco: due colonne in meno, e il quadrotto che si apre

**«Tipo» e «Da» sono usciti dalla vista principale.** Non erano sbagliati: erano
due righe su ogni quadrotto che rispondono a una domanda che nessuno fa
guardando l'Agenda. Il tipo resta nella scheda dell'impegno, che è dove si
sceglie; la **provenienza** resta come **nota in fondo al quadrotto**, e solo
quando c'è qualcosa da dire — come colonna diceva «scritto a mano» su quasi
tutte le righe.

### 🔴 Il quadrotto intero si apre, e i suoi comandi restano indipendenti

Prima, il tocco che apre la scheda viveva **solo sul titolo**: una striscia di
testo alta un centimetro in mezzo a un riquadro che sembra tutto premibile. Sul
telefono si finisce quasi sempre a lato, e quel tocco non faceva niente.

⚠️ **E la cura non poteva essere un pulsante più grande**: un bottone dentro un
bottone non è HTML valido, e la spunta di «fatto» finirebbe per aprire la scheda
invece di chiudere l'impegno. Quindi il riquadro **ascolta** il tocco e **si
tira indietro** quando il tocco è arrivato a un comando suo.

⚠️ **Si guarda il bersaglio, non si chiede ai comandi di difendersi.** La strada
alternativa era uno `stopPropagation` su ognuno: sono otto elenchi, e il nono
comando scritto da qui a sei mesi lo dimenticherebbe **senza nessun errore** —
aprirebbe la scheda e basta. La regola vive in `ElencoAdattivo`, cioè in un
posto solo, e copre anche i comandi che non esistono ancora. C'è una prova che
lo dimostra con un comando inventato apposta.

**Tastiera**: `tabIndex`, Invio e barra spaziatrice, contorno visibile col
fuoco. ⚠️ E la barra spaziatrice **dentro un campo** scrive uno spazio: si apre
solo se il fuoco è sul riquadro.

### 🔴 Un difetto trovato facendo il censimento, non rileggendo

In Magazzino il tocco **apre la riga**, e dentro l'area aperta c'è un modulo.
Senza una protezione, un dito appoggiato accanto a un campo — su un'etichetta,
su uno spazio vuoto — **richiuderebbe la riga appena aperta**, portandosi via
quello che si stava scrivendo. L'area aperta è marcata `data-non-apre` e non
richiude niente.

---

## D. Il censimento degli elenchi del gestionale

Gli elenchi che usano `ElencoAdattivo` sono **dodici**. Il criterio del mandato:
*dove l'azione principale è aprire un dettaglio, si rende apribile tutta la
card; non si applica alle card senza dettaglio o con un'azione principale
diversa.*

**Unificati (4)** — hanno un dettaglio, e adesso si apre da tutto il quadrotto,
da tastiera, coi comandi interni indipendenti:

| schermata | dove porta |
|---|---|
| Agenda | la scheda dell'impegno *(nuovo: prima era solo il titolo)* |
| Clienti | la scheda del cliente |
| Fornitori | la scheda del fornitore |
| Personale | la scheda del dipendente |

**Esclusi (8), con la ragione:**

| schermata | perché |
|---|---|
| Magazzino | l'azione principale **non** è aprire un dettaglio: è aprire la riga sul posto. Il bersaglio si allarga lo stesso, ma l'area aperta è protetta |
| Prima Nota | un movimento non ha una scheda propria |
| Scontrinato | righe di riepilogo per serata, nessun dettaglio |
| Sezione personale del titolare | righe di registro, nessun dettaglio |
| Tracciabilità | righe di lotto, nessun dettaglio |
| Allineamento | righe di confronto, nessun dettaglio |
| Cantina | due elenchi di sole letture |
| Scheda ricetta (ingredienti) | è già dentro un dettaglio |

---

## Come è stato verificato

**Il blocco di verifica della migrazione** prova le quattro unità dallo stesso
giorno di partenza con numeri diversi apposta, così **le quattro risposte sono
diverse fra loro**: con «ogni 1» su tutte, scambiare giorni e settimane darebbe
due date vicine e la verifica sarebbe verde senza aver misurato niente (regola
del 19/08). Poi: nessun impegno con mezza cadenza (una **proprietà**, non un
conteggio), i quattro rifiuti uno per uno in un `begin…exception` annidato, e il
**verso opposto** — «ogni 90 giorni» e «ogni 5 anni» devono passare, perché un
limite che rifiuta anche i casi buoni è peggio di nessun limite.

**Provata per rottura, non rileggendola** — e col solo blocco di verifica
estratto, perché riapplicare la migrazione **ripara da sé** la rottura che le si
mette davanti (trappola del 26/08):

| rottura | cosa ha detto |
|---|---|
| una settimana contata come un giorno | «ogni 2 settimane dal 01/03/2026 doveva dare 2026-03-15, ha dato 2026-03-03» |
| via il vincolo `ricorrenza_intera` | «un numero senza unità è stato accettato» |

**Le prove delle schermate**, provate anch'esse per rottura:

| rottura | quante rosse | quali |
|---|---|---|
| il quadrotto non ascolta più il tocco | 6 su 9 | tutte quelle sul tocco e sulla tastiera |
| via la protezione dei comandi | 4 su 9 | spunta, stella, «rimanda», comando nuovo |
| la nota non arriva al quadrotto | 1 su 9 | quella sulla nota |

🔴 **E la prima versione di quelle prove NON discriminava**: spegnendo apposta
il tocco sul quadrotto del **telefono** restavano verdi, perché cercavano «un
antenato premibile» in tutta la pagina e trovavano la **riga della tabella**,
che ce l'ha anche lei. Misuravano l'una credendo di misurare l'altra. Adesso la
zona è dichiarata, e c'è una prova per ciascuna delle due forme.

**Numeri**:
- prove pure: `tests/unita/agenda-sezioni.test.js` (+6) e `vocabolari.test.js`
  ritarato;
- prove sulle schermate: `tests/schermate/quadrotto-che-si-apre.test.jsx`, 9
  nuove;
- prove contro il progetto di prova: `tests/app/agenda-ricorrenza.test.js`, 8
  nuove — **536 → 544, tutte verdi**.

---

## Cosa NON è verificato

- **Nessuna mano ha toccato niente.** Il quadrotto più grande, il passo di
  cinque minuti sul selettore dell'iPhone e le due caselle affiancate sul
  telefono vero non li ha guardati nessuno: quello che è «visto» qui è montato
  in un ambiente di schermo, non su un telefono.
- **Non è misurata la larghezza vera** delle due caselle giorno/ora a 390 punti:
  la cura (`min-w-0`) è quella giusta per famiglia, ma il numero non c'è.
- **In produzione non c'è nessun impegno ricorrente**, quindi la sanatoria non è
  mai stata esercitata su dati veri di Alessio — solo sui sei del progetto di
  prova.
- 🔴 **Tre prove delle schermate falliscono su questo computer e passano in
  coda** (`varco-pubblico` ×2, `rotte-chiuse` ×1), ed è **preesistente a questo
  blocco**: falliscono identiche sul ramo di partenza. Misurato: la prima va in
  timeout a 5 s sul primo `import` di `App.jsx`, e la seconda fallisce sul
  **residuo** della prima — trova due volte lo stesso testo. Non corretto:
  alzare quel timeout è precisamente ciò che il Blocco 1 di questo mandato
  vieta, e la causa vera (una prova andata in timeout che lascia montato quello
  che ha montato) è un lavoro a sé.

---

## Cosa abbiamo rovesciato

**Cosa era stato deciso e quando.** Il 14/08/2026, col Blocco 1 del mandato
cumulativo, l'Agenda ha ricevuto le **ricorrenze a cadenza fissa** — mensile,
trimestrale, semestrale, annuale — e un modulo con **Stato** e **Categoria**
scelti a mano, quest'ultima come *elenco chiuso* al posto del testo libero.

**La ragione di allora.** Le ricorrenze servivano agli **adempimenti
societari**, che sono gli unici impegni ricorrenti che esistessero: le loro
cadenze sono quelle, e un elenco chiuso di quattro voci le copriva tutte. La
categoria come elenco chiuso nasceva da un difetto misurato: su venti righe di
testo libero convivevano **quattro convenzioni diverse**.

**Cosa si decide adesso.** Le quattro cadenze diventano due dati liberi; Stato e
Categoria escono dal modulo (le colonne restano, e restano quelle che erano su
un impegno esistente); «Tipo» e «Da» escono dalla vista principale dell'elenco.

**Perché la ragione di allora non vale più.** Per le ricorrenze: **è cambiato
chi le usa.** Finché l'Agenda conteneva solo adempimenti, quattro cadenze erano
l'insieme completo; da quando ci finisce la manutenzione del locale, sono un
sottoinsieme che non contiene il caso più comune — e chi non ci sta dentro non
riceve un errore, riceve un menu che sembra dire di no.
Per la categoria: **la ragione vale ancora, e infatti il vocabolario chiuso non
è stato toccato** — quello che è caduto è che valesse la pena *chiederla ogni
volta*. La misura è la stessa che l'aveva giustificata: su venti righe la
risposta era «Altro» quindici volte. L'elenco chiuso resta per chi la categoria
la scrive davvero — i moduli che creano impegni da soli.
Per lo Stato: la ragione di allora era la simmetria di un modulo che mostra
tutte le colonne. **Non era una ragione d'uso**, e non se ne è trovata una.

---

## Migrazioni installate solo sul progetto di prova

`20260910000001_una_ricorrenza_si_dice_a_parole_sue.sql` — applicata a
**Borgo58-Prova**, registrata (385 migrazioni). **Non applicata in produzione**,
e non va applicata finché questa proposta non è unita.

⚠️ **Nota di processo, perché non si ripeta.** Applicando questa migrazione
mentre la coda della proposta precedente stava ancora girando, la rete dei
vocabolari di **quel** ramo si è trovata davanti uno schema che il suo codice non
conosce: il progetto di prova è **uno solo** per tutta la catena delle proposte.
Lo stato vecchio è stato rimesso a mano finché quella coda non è stata verde, e
la migrazione riapplicata dopo. *Con proposte impilate, una migrazione si applica
alla prova quando la coda di quelle sotto ha finito.*

---

**Hash di HEAD dichiarato**: `42d96cf` sul ramo `agenda-semplice`, cioè il
commit immediatamente sotto questo documento.
**Stato del working tree al momento della consegna**: pulito.
