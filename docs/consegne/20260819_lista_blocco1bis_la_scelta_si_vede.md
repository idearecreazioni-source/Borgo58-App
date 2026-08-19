# Lista della spesa — blocco 1-bis: l'arrivo dice su quale riga va

**Mandato**: [`20260817_la_lista_non_scrive_uscite.md`](../mandati/20260817_la_lista_non_scrive_uscite.md).
Coda del [blocco 1](20260819_lista_blocco1_arrivati_n_di_m.md), dopo la
risposta di Alessio del 19/08 alla domanda «due righe dello stesso prodotto:
quale riceve l'arrivo?».
**Migrazione**: `20260819000002_l_arrivo_dice_su_quale_riga_va.sql` —
**applicata sul progetto di prova, NON in produzione** (aspetta il push).

---

## ⚠️ Cosa NON è verificato

1. 🔴 **Nessuna mano ha toccato le due schermate**: né il riquadro nel
   «Registra carico», né il blocco nella conferma di una fattura. Nessuna
   prova di questo progetto guarda una schermata.
2. 🔴 **Il caso non esiste in produzione**: non ci sono due righe aperte dello
   stesso prodotto. Il menu con cui si sposta l'arrivo **non è mai comparso**
   su dati veri, e il primo a vederlo sarà Alessio.
3. ⚠️ **Il blocco nella conferma di una fattura è la parte più esposta**:
   quella schermata è già stata bocciata una volta per troppa roba (12/08), e
   qui ci si aggiunge un riquadro. La scelta di mostrarlo **solo dove c'è più
   di una riga aperta** è mia, non sua — se lo vuole sempre, o mai, è una
   riga.
4. ⚠️ **Il rifiuto «riga di un altro prodotto» non è mai stato visto a
   schermo**: dal gestionale non si può nemmeno provocare (le schermate
   offrono solo righe di quel prodotto). È provato dal database e dalle prove
   automatiche, e resta lì per il giorno in cui una schermata sbaglierà.
5. ⚠️ **Il blocco 2 non c'è**: i tre esiti a mano, l'uscita in prima nota e il
   vocabolario unico dei mezzi di pagamento.

---

## Cosa abbiamo rovesciato

**Nessun rovesciamento.** La regola «l'arrivo va sulla riga più vecchia» non
cambia: le si aggiunge la parte che mancava — **si vede, e lì si cambia**.
Il blocco 1 l'aveva consegnata muta, e questa consegna è la risposta di
Alessio a una domanda che avevo posto io.

---

## La decisione di Alessio, e perché è una terza strada

Gli avevo proposto **due** vie: la più vecchia in silenzio, oppure chiedere
ogni volta. Le ha scartate entrambe e ha scelto la forma che questo progetto
aveva già deciso il 17/08 per il mezzo di pagamento:

> **si fa da sé, ma si vede, e lì si cambia.**

**Le sue parole sul perché**, che valgono come criterio oltre questo caso:
andare sulla più vecchia **in silenzio** è un predefinito che può sbagliare
senza che nessuno se ne accorga — *20 kg di pomodoro per sabato e 10 dal
fornitore nuovo: l'arrivo finisce sulla riga sbagliata e la lista mente in
due punti*. Chiedere ogni volta aggiunge un gesto a un'operazione che ne ha
già tre. ⚠️ *Un predefinito che si vede è una comodità; uno che riempie un
campo che nessuno guarda è la famiglia dei 33 posti silenziosi.*

⚠️ **E si vede NEL MOMENTO in cui l'arrivo si conferma**, non dopo in un
elenco di movimenti: *dopo non è più una correzione, è una riparazione.*

---

## Cosa è stato costruito

### 1. L'elenco delle righe che aspettano quel prodotto

`righe_lista_aperte(ingrediente)` restituisce le righe ancora aperte, con la
data, quanto se ne chiedeva, quanto ne è già arrivato, e **quale è la
predefinita** — la più vecchia.

⚠️ **`security definer` per necessità, non per comodità**: la lista della
spesa è titolare-only, e chi registra una consegna a mano può essere lo
staff. Senza, un cuoco vedrebbe **zero righe** e crederebbe che non ci sia
niente da scegliere — *una schermata che tace invece di rifiutare*. Escono
solo le colonne che lo staff già vede nella vista `_display`: niente importi,
niente fornitori.

### 2. L'arrivo si può indirizzare

`registra_arrivo_in_lista` e `register_stock_delivery` prendono la riga
scelta. ⚠️ **Cancellate e ricreate, non modificate**: in Postgres un parametro
in più fa una funzione **nuova**, e due sovrapposte rendono ambigua ogni
chiamata per nome (42725, **a tempo di esecuzione** — cioè quando arriva la
merce vera). Trappola già pagata il 12/08. La verifica controlla che ne resti
**una sola** per nome, e che dopo il `drop` i permessi siano tornati stretti
nei due versi (`anon` no, `authenticated` sì).

⚠️ **Una scelta sbagliata si RIFIUTA, non si corregge in silenzio**: riga
inesistente, riga di un altro prodotto, riga già chiusa. Ripiegare sulla più
vecchia vorrebbe dire scrivere l'arrivo da un'altra parte **dicendo di aver
fatto quel che si chiedeva** — il modo silenzioso di far mentire la lista.

### 3. Il carico da fattura porta la scelta riga per riga

`esegui_azione_posta` passa `p_riga_lista` preso dalla riga del documento.

⚠️ **Ripresa dal DATABASE, non dal file che l'aveva creata** (regola del
18/08): il corpo nella migrazione è quello vivo, letto con
`pg_get_functiondef`, con **una sola riga cambiata**. Ricopiarla dalla
migrazione che la creò avrebbe annullato in silenzio tutte quelle che
l'hanno toccata dopo — è il difetto del 18/08, e questa volta la funzione ha
281 righe.

⚠️ **La verifica legge il CORPO della funzione** e pretende che contenga
davvero il passaggio: si può correggere l'aiuto e lasciare il chiamante
com'era, e la migrazione passerebbe verde col difetto vivo (lezione del
13/08).

### 4. Le due schermate

- **Registra carico**: un riquadro dice su quale riga andrà («da 20 kg, in
  lista dal 12 agosto · finora arrivati 5»), con il menu per spostarlo.
- **Conferma di una fattura**: un blocco «Sulla lista della spesa:» con una
  riga per ingrediente.

⚠️ **Il menu compare solo dove ci sono almeno due righe aperte.** Dove la
scelta non esiste, un menu con una voce sola è ingombro — e la schermata
delle fatture è già stata bocciata una volta per troppa roba. **È una mia
lettura della sua richiesta**, ed è dichiarata qui perché possa correggerla.

### 5. Un comando nuovo: `npm run funzione:viva`

Stampa il corpo vivo di una funzione del database. ⚠️ Fino a oggi «riscrivere
dal database» era **disciplina** — apri il connettore, scrivi una query a
mano, incolla. Adesso è un gesto solo, e legge **la produzione**, non il
progetto di prova: la regola parla di ciò che è vivo sui dati veri.

⚠️ Aggiunge il **punto e virgola** che Postgres non mette: senza, incollando
il corpo in una migrazione l'istruzione dopo gli si attacca e l'errore parla
di tutt'altra riga. Costato mezz'ora oggi.

---

## 🔴 Il guardiano che gridava a vuoto

La rete che sorveglia i portieri nelle migrazioni
(`tests/app/migrazioni-senza-portieri.test.js`) ha alzato **tre** allarmi su
questa migrazione. **Uno era vero, due erano falsi**, e i falsi valevano una
correzione: *un guardiano che grida sul gesto obbligatorio viene spento al
secondo allarme falso.*

| allarme | verdetto |
|---|---|
| chiama `register_stock_delivery()` senza impostare i claims | **vero** |
| chiama `esegui_azione_posta()` al primo livello | **falso**: era la sua stessa intestazione |
| chiama `esegui_azione_posta()` in un blocco | **falso**: era un nome dentro una stringa |

- **Il vero** si cura impostando i claims: il blocco di verifica impersona il
  titolare **prima** di chiamare le funzioni dell'app. Una migrazione non ha
  un utente, ha un proprietario.
- **Il primo falso** è una lacuna della rete, e chiuderla serve a tutti: la
  depurazione non riconosceva le intestazioni **qualificate dallo schema**
  (`create or replace function public.nome(…)`), che è esattamente come le
  scrive Postgres quando una funzione viene **ripresa dal database** — cioè
  la strada che il 18/08 è diventata obbligatoria. Ora le riconosce.
- **Il secondo falso** si cura dalla parte della migrazione: il controllo
  chiede la funzione **per nome** invece che come `nome(argomenti)`, così un
  nome seguito da una parentesi non compare più in una stringa.

⚠️ **E la rete continua a discriminare**: tolti i claims, torna rossa — e
rossa **solo** sulla chiamata vera.

---

## Le prove, e la controprova

**3 prove nuove sui dati veri** (8 in tutto nel file), più 10 controlli dentro
la migrazione.

⚠️ **Le due che coprono la metà della decisione** — «senza scelta va sulla più
vecchia» e «con la scelta va dove dice lui» — sono la condizione posta
insieme alla richiesta: *se togliendo la possibilità di correggere nessuna
prova diventa rossa, quella metà non è provata.*

⚠️ **Le due righe si datano a mano.** Nascendo nello stesso istante, «la più
vecchia» la sceglierebbe l'ordinamento a caso, e la prova direbbe di sì
qualunque cosa faccia il codice — è la lezione del 16/08 su `now()` dentro
una transazione, letta dal lato delle prove.

### La controprova — due rotture

| rottura | prove rosse |
|---|---|
| `registra_arrivo_in_lista` ignora la riga scelta | **4 su 8** sui dati veri |
| il blocco di verifica non imposta più i claims | **1**, ed è il guardiano dei portieri |

⚠️ La prima è stata fatta **scrivendo direttamente sul database di prova**,
cioè scavalcando il file della migrazione: se le prove guardassero solo ciò
che la migrazione dichiara, non se ne sarebbero accorte.

---

## Per Alessio, in una riga

Quando registri un carico, il gestionale **ti dice su quale riga della lista
della spesa lo sta mettendo** — e se hai due righe dello stesso prodotto, lì
puoi spostarlo sull'altra con un tocco.

---

**Commit**: dichiarato al momento del commit finale di questa consegna.
