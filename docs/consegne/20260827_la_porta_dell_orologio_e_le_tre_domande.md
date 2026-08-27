# La porta dell'orologio, la lista libera, e le tre domande

**27/08/2026, mattina.** Blocchi 1, 2, 3 e 5 del mandato «la porta che
respinge l'orologio, e quattro correzioni dal collaudo con le mani».

**HEAD dichiarato**: `d494f22582600534bfa9d0d66ee0895764c9a495`
**Working tree**: pulito al momento della scrittura di questo riepilogo.

---

## Cosa abbiamo rovesciato

**Uno**, registrato come **n. 60** in
[`docs/decisioni_rovesciate.md`](../decisioni_rovesciate.md).

1. **Cosa era stato deciso, e quando.** Dal giorno in cui il ramo è nato: la
   lista della spesa cerca il prodotto nel catalogo e ammette un nome libero
   solo quando non trova niente.
2. **La ragione di allora.** Una riga abbinata al prodotto giusto è una riga
   che il gestionale sa chiudere da sé quando la merce arriva.
3. **Cosa si decide adesso.** La lista della spesa **non accoppia mai** col
   magazzino. L'abbinamento si fa dopo, con la foto del documento.
4. **Perché la ragione di allora non vale più.** Non è stata smentita: è stata
   smentita **la sua metà mancante**. Il comportamento era incoerente — *se
   non trovava niente scriveva, se trovava troppo si fermava* — quindi il
   gesto più semplice del gestionale diventava **più difficile man mano che
   il magazzino si riempiva**. ⚠️ Il prezzo accettato: nessuna riga di lista
   si chiude più da sé al primo colpo.

---

## Blocco 1 — la Scorciatoia veniva respinta prima di entrare

**Il SUPPOSTO del mandato regge, misurato** (vero): `ascolta-voce` aveva
`verify_jwt = true`. Il rifiuto arrivava dal **cancello** delle funzioni
online, prima che il codice guardasse la chiave.

### Le due strade, e perché ho preso la prima

🔴 **La protezione che si toglie spegnendo il cancello non proteggeva
niente.** Il token che pretende è la **chiave anon, che è pubblica**: sta nel
pacchetto del sito, la legge chiunque. Fermava la Scorciatoia di Alessio e
nessun altro. L'altra strada — far mandare alla Scorciatoia anche quella
chiave — avrebbe aggiunto **un passaggio in più a lui** e **zero ostacoli a
un estraneo**.

**La guardia vera resta la chiave, e resta dov'era** (vero, letto nel corpo):
il controllo è alla riga 212, la chiamata al modello alla 275 — quindi una
richiesta senza credenziali valide **non costa un centesimo**. La chiave è
24 byte casuali, il database ne conserva la sola impronta, si revoca dal
gestionale, e ha il freno delle 60 dettature in un'ora.

⚠️ **Precedente identico già in casa** (vero): `posta-in-arrivo` è
`verify_jwt = false` in produzione dall'11/08, con la stessa forma di
ragionamento — la sua barriera è la firma sulla consegna.

⚠️ **Quello che resta scoperto, dichiarato**: non c'è un freno sui tentativi
**falliti** di indovinare una chiave. Con 24 byte casuali è un rischio
teorico, ma teorico non è assente.

### Provato dall'esterno, come farebbe l'orologio

Solo corpo JSON, **nessuna intestazione di autorizzazione** (prova):

| caso | risposta |
|---|---|
| chiave **vera** | **200** — dettatura registrata, un'azione da guardare |
| chiave **sbagliata** | 401 · «Questa chiave non vale.» |
| chiave **revocata** | 401 · «Questa chiave non vale.» — **identica** |
| **nessuna** chiave | 401 · «Non è arrivata nessuna chiave…» |

⚠️ **I due casi che contano sono indistinguibili**: «non esiste» e «è stata
tolta» sono informazioni utili solo a chi prova a indovinare. Il quarto si
distingue e non rivela niente — chi non ha mandato la chiave lo sa già — ed
è stato **riscritto** perché parlasse di chiave invece che di autenticazione:
chi arriva lì senza niente è quasi sempre una Scorciatoia a cui manca il
campo, e «autenticazione mancante» lo manderebbe a cercare un accesso che non
deve avere.

### La controprova, e perché è al contrario

🔴 **Riaccendere il cancello per vedere la prova diventare rossa non si
può**: il comando ha solo il flag che lo **spegne**, e una reinstallazione
senza flag l'ha lasciato spento (vero, misurato: `verify_jwt=false` dopo un
deploy pulito). Quindi si è dimostrata l'altra metà — che **il segnale
cercato esiste e si riconosce** — su due porte ancora chiuse davvero:
`leggi-foto` e `operazioni-atomiche` rispondono `Missing authorization
header`, `ascolta-voce` risponde **in italiano** (prova).

### Le istruzioni

Aggiunto **il passo 8** nella schermata e una voce nella guida completa: se
risponde in inglese, **non ha sbagliato niente lui** — è il gestionale che ha
una porta chiusa dalla parte sua. ⚠️ Il criterio è **la lingua**: i rifiuti
del gestionale sono in italiano.

---

## Blocco 2 — la lista della spesa non cerca più niente

Vedi «Cosa abbiamo rovesciato». Migrazione `20260827000006`.

⚠️ **Non è «cerca ma non bloccare»: non cerca affatto.** La differenza non è
di sfumatura — «cerca ma non bloccare» lascerebbe il gestionale ad abbinare
da solo quando trova un candidato, ed è precisamente l'abbinamento che
Alessio ha deciso di fare dopo, guardando il documento.

⚠️ **E i numeri si buttano via anche se il modello li manda**: un
identificativo rimasto attaccato alla riga la farebbe accoppiare domani,
quando qualcuno la conferma.

**Dettato davvero, con l'API vera** (prova): «servono un rotolo di carta
forno, **due pacchi di sale grosso** e tre chili di limoni» — e in magazzino
esistono sia `Sale` sia `Sale marino di Trapani`. **Tre righe su tre entrate,
tutte `eseguita` e `sicuro`, nessuna fermata**; righe in lista **56 → 59**,
tutte senza ingrediente attaccato. Poi ripulite: 56 (vero).

---

## Blocco 3 — il doppione, e il «sì» che non rispondeva a niente

Migrazione `20260827000007`.

### Il doppione

L'elenco delle pendenze **non ripete** le righe che si stanno già guardando
nel riquadro sopra. ⚠️ La cura non è togliere un riquadro: sono due domande
diverse — «cosa ho appena detto» e «cosa aspetta da prima» — ed è il secondo
a non dover ripetere, perché una riga di dieci secondi fa non aspetta «da
prima».

⚠️ **I due pulsanti non possono eseguire due volte**: usano la **stessa
guardia sincrona** con la **stessa chiave** (l'identificativo della riga).

### Le tre domande

Camminate tutte le strade per cui una riga resta in sospeso, le domande sono
**tre**, e sono tre schermate diverse:

| domanda | quando | cosa si vede |
|---|---|---|
| `se` | è tutto chiaro, manca il permesso (le quattro di natura `creazione`) | **«Sì, fallo»** |
| `scegli` | il modello ha trovato più candidati e li ha nominati | **i candidati, da toccare** — niente «Sì, fallo» |
| `manca` | manca qualcosa che il gestionale non può proporre | né conferma né scelte, e **la via d'uscita scritta** |

⚠️ **Che domanda sia lo decide il database** (`azione_domanda`), riusando la
funzione che già sa cosa manca. Deciderlo nella schermata sarebbe la seconda
definizione della stessa cosa.

⚠️ **Scegliere ESEGUE**, in un gesto solo: chi ha appena detto *quale* ha già
detto anche *sì*.

🔴 **E una scelta che non era stata offerta si rifiuta** — è la porta da cui
si abbinerebbe una misura alla cosa sbagliata dal di fuori.

**Guardato a schermo, sul progetto di prova** (prova). Le tre righe
apparecchiate insieme:

- «Sale grosso: ce ne sono 3 kg» → **«Quale dei due?»** con *Sale* e *Sale
  marino di Trapani*, **nessun «Sì, fallo»**;
- «Uscita di cassa: 30 € al fornitore» → **«Sì, fallo»**;
- «Temperatura 4 °C» → nessun pulsante di conferma, e la riga che dice cosa
  fare.

Toccato «Sale marino di Trapani» **quattro volte**: eseguita **una volta
sola**, sul prodotto giusto, nessun errore a schermo (prova).

### La controprova, e cosa ha insegnato

🔴 **La prima rottura ha fatto scattare il guardiano sbagliato.** Tolto il
controllo sui candidati, la verifica è diventata rossa — ma con l'errore *«il
prodotto che mi avevi indicato non c'è più»*: la scelta finta veniva
accettata e falliva **più sotto**. Il controllo in esame non è mai stato
raggiunto.

⚠️ **La rottura giusta è un prodotto che ESISTE e non era fra i candidati**:
lì l'unico controllo che può scattare è quello. Scritta come **prova dal
client** (`tests/app/voce.test.js`), che è anche più forte — esercita il
tratto fra schermata e database.

### Il vicolo cieco che restava

Su una riga `manca` gli unici pulsanti sarebbero stati «Lascia perdere», cioè
buttare via quello che ha detto. Ora c'è la frase che dice la via d'uscita.
🔴 **Quella vera — il collegamento coi campi già riempiti — è il Blocco 4, e
non è costruita.**

---

## Blocco 5 — l'indirizzo cifrato: la premessa non regge, ed è già fatto

⚠️ **Questo blocco era già stato chiuso nella consegna precedente**, e la sua
premessa è stata corretta allora e **riverificata adesso** (vero):

- `tailscaled` gira come **servizio di Windows**, stato `RUNNING`;
- la configurazione di `tailscale serve` è **salvata nello stato del nodo** ed
  è ancora lì — quindi **l'indirizzo cifrato riparte da solo**;
- quello che non sopravvive a un riavvio è il **server del gestionale**, e per
  quello `npm run dev:prova` fa già tutte e due le cose (il pezzo è nello
  script, verificato presente).

**Non ho rifatto niente.**

---

## Le reti che si sono accese da sole — tre, in questa consegna

🔴 Nessuna di queste tre l'ha trovata una rilettura.

1. **La rete dei portieri** (consegna precedente, stessa notte): 23 attese,
   25 trovate.
2. **La rete dei vocabolari chiusi**: `azione_domanda(p_stato)` e
   `azione_scelte(p_tipo)` non combaciavano con nessun vocabolario. Guardati,
   sono **due eccezioni legittime** — non guardie ma **rami** — e sono state
   dichiarate con la ragione in `GUARDIE_ESENTI`, come vuole quel file.
3. **La prova sulla porta della Scorciatoia**, scritta stamattina: diventa
   rossa se qualcuno riaccende il cancello dal pannello.

---

## RILETTURA

**Cosa NON ho verificato con gli occhi**
- **Nessuna immagine**: lo screenshot non funziona in questo ambiente. Tutto
  ciò che è «visto» è **letto dal DOM**.
- **Niente da un telefono o da un orologio veri**: la Scorciatoia è stata
  simulata da qui, mandando esattamente quello che manda lei (corpo JSON,
  nessuna intestazione). **Che parta dal polso e regga a schermo spento
  continua a non averlo provato nessuno.**
- **Il doppione non l'ho visto sparire dettando**: la riga che lo toglie è
  stata scritta e letta, ma per vederla in azione servirebbe una dettatura
  vera che lasci una riga in sospeso, e quella costa una chiamata
  all'assistente. **Verificato leggendo, non guardando.**

**Cosa ho contato senza leggerlo**
- Le **432 prove sull'app** e le **494 pure**: ho letto il totale, non le
  singole.
- **Che `tailscale serve` sopravviva a un riavvio**: dedotto da due fatti
  misurati, **non ho riavviato il computer**.

**Quali mie affermazioni sono diventate false mentre lavoravo**
- «Ho rotto il cancello e la prova resta verde, quindi non discrimina»:
  **falso**, la rottura non era avvenuta — il valore non si riaccende con quel
  comando. Corretto misurando lo stato invece di dedurlo dal comando lanciato.
- «La verifica della migrazione prova che una scelta non offerta si rifiuta»:
  **vera solo a metà** — provava che *qualcosa* rifiuta, non quel controllo.

**Quali blocchi non ho aperto**
🔴 **Il Blocco 4 — la via d'uscita a mano coi campi già riempiti.** Non
aperto, e la ragione è di merito: le schermate di destinazione sono **sei o
sette** (prima nota, carico merce, scheda ingrediente, ricetta, magazzino,
lista, temperature) e **nessuna legge oggi parametri dall'indirizzo** (vero,
misurato: `useSearchParams` compare in sei schermate, nessuna di queste).
Farlo per una sola destinazione lascerebbe le altre righe senza uscita —
cioè il difetto di incoerenza che il Blocco 2 ha appena finito di togliere; e
un collegamento che porta a un **modulo vuoto** butta via lo stesso lavoro
che dovrebbe salvare, che è precisamente il punto della decisione di Alessio.
⚠️ Serve anche una decisione di disegno: **come si chiude la riga in sospeso**
quando si salva a mano. Non «annullata» (significa «ho detto di no») e non
«eseguita» (significa «l'ha fatta il gestionale»): serve uno stato nuovo, e
gli stati sono un vocabolario chiuso con la sua rete.

**Quali conteggi sono pavimenti e non totali**
- Le **tre domande** sono un totale: sono state camminate tutte le strade per
  cui una riga resta in sospeso.
- Le **due eccezioni ai vocabolari** sono un totale (la rete le nomina tutte).
- I **quattro casi provati sulla porta** sono un totale dei modi in cui una
  chiamata esterna può presentarsi.

**Voci di `docs/DECISIONI.md` toccate**
- Sezione *Assistente — voce*: aggiunte la **lista libera** e le **due
  uscite** (quest'ultima marcata **non ancora costruita**).

**Migrazioni in attesa, e l'ordine dei comandi**
In produzione ci sono **270** migrazioni (vero, misurato). Sul progetto di
prova **279**. Ne aspettano **nove**:

`20260826000017` · `20260826000018` · `20260827000001` · `20260827000002` ·
`20260827000003` · `20260827000004` · `20260827000005` · `20260827000006` ·
`20260827000007`

L'ordine è quello di sempre: **commit → push di Alessio → `npm run migra --
--conferma` → riepilogo → secondo push.**

⚠️ E **due funzioni online** vanno installate in produzione dopo il push:
- **`ascolta-voce`** — e qui c'è la cosa che conta: l'installazione va fatta
  con `npm run funzione`, che sa da sé di dover spegnere il cancello. Fatta
  dal pannello, la Scorciatoia resterebbe muta;
- **`operazioni-atomiche`** — porta le tre operazioni nuove (la caparra
  tenuta, l'annullamento, e la scelta fra i candidati).

**Lezioni nuove nel file delle trappole** (`CLAUDE.md` §8)
- una porta può essere chiusa **prima** del tuo codice, e il rifiuto arriva in
  inglese — con il corollario che spegnere quel cancello non toglie nessuna
  protezione vera, e che il valore è appiccicoso in un verso solo;
- «se non trova niente scrive, se trova troppo si ferma»: i tre esiti di ogni
  ricerca vanno guardati insieme;
- un «sì» può essere la risposta a una domanda che nessuno ha fatto;
- la stessa riga in due riquadri fa credere di aver parlato due volte;
- guardare a schermo un gesto che scrive su **dati veri** costa una pulizia
  che può non essere esatta — la regola del perimetro vale anche per il
  collaudo a mano, non solo per le migrazioni.
