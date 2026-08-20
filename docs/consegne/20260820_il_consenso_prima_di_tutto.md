# Il consenso, prima di tutto — la posta dei clienti

**20/08/2026** · Code → validatore · blocco C del mandato della serata

- **HEAD dichiarato**: `266a1b06e08d5a619bc7146e40408cd40f740087`
- **Working tree**: pulito
- **Mandato**: [`docs/mandati/20260820_la_posta_dei_clienti.md`](../mandati/20260820_la_posta_dei_clienti.md)
- **Migrazione**: `20260820000011_il_consenso_prima_di_tutto.sql` — **non
  applicata in produzione**
- **Funzioni online**: nessuna toccata

⚠️ **Il mandato della serata era stato scritto con una restrizione — «fai due
terzi, lascia fuori il consenso» — e il validatore l'ha RITIRATA a metà
lavoro**, perché contraddiceva il mandato della posta, dove il consenso è il
Blocco 1 e la sua forma è già decisa da Alessio (spunta e data). Questa
consegna è quindi **il mandato intero**.

---

## Cosa abbiamo rovesciato

**Niente.** Nessuna decisione presa prima è stata ribaltata.

Il riquadro c'è lo stesso anche quando è vuoto, per il precedente del
riepilogo del Magazzino: *un riquadro che compare solo nei guai fa dubitare,
quando manca, di non averlo visto.*

---

## 🔴 La distinzione che regge tutto

> Scrivere a chi ha prenotato per confermargli il tavolo **non ha bisogno di
> niente**; mandare il menu del mese a duecento persone **sì**.

⚠️ **E le due strade non sono la stessa funzione con un parametro diverso**:
sono **due funzioni con due nomi diversi**, e quella commerciale pretende il
consenso **nel database**. *Una sola «manda mail» prima o poi lascia uscire
una comunicazione commerciale dalla porta di servizio*, e non c'è nessuna
schermata che possa impedirlo — una schermata che filtra è una schermata che
qualcuno può scavalcare.

Il rifiuto dice **cosa manca e cosa fare**, non «operazione non consentita».

---

## Il consenso: due date, non una spunta

«Ha acconsentito» e «si è cancellato» sono **due fatti diversi, ognuno col suo
quando**. Un booleano che si spegne cancellerebbe la prova che il consenso
c'era stato — e *un consenso che esiste solo nella memoria di Alessio non è
dimostrabile*, che è l'unica cosa che conta se un domani viene contestato.

- ⚠️ **si pretende COME l'ha dato** (al telefono, di persona…): fra un anno
  «c'è la spunta» non risponde a nessuna contestazione, «me l'ha detto al
  telefono il 3 marzo» sì;
- ⚠️ **vuoto NON è «no»**: è «non gliel'ho mai chiesto», e sono due stati
  diversi che la schermata dice con due frasi diverse;
- ⚠️ **il consenso si può ridare** dopo essersi cancellati: per questo la
  regola confronta le due date invece di guardare se una revoca esiste.

### 🔴 E la cancellazione toglie DAVVERO

Non c'è nessuna «richiesta registrata» da applicare dopo: è **la stessa
colonna che il calcolo legge**. Il caso «registrata e non applicata» non
esiste — non per disciplina, ma perché non c'è una seconda strada. *Una
cancellazione registrata e non applicata è peggio di nessuna: c'è la prova
scritta che l'aveva chiesto.*

---

## 🔴 Un difetto mio, trovato da una rete e non rileggendo

La prima versione metteva la regola in una **funzione**, e la scheda del
cliente **ricalcolava le due date in JavaScript**: due posti dove viveva la
stessa regola, cioè due posti che possono contraddirsi.

Ora la regola sta **nello schema**: `customers.puo_ricevere_commerciali` è una
colonna **calcolata da Postgres** dalle due date — nessuno la scrive, quindi
non può contraddirle — e PostgREST la espone, così **la schermata legge la
risposta invece di rifarsi il conto**.

⚠️ A farmelo notare è stata la rete dei permessi, per un'altra ragione:
`consenso_valido()` era comparsa fra le funzioni aperte allo staff. Guardando
*perché* fosse concessa è saltato fuori che non serviva a nessuno — e che il
conto lo faceva la schermata. **L'elenco resta a 18.**

---

## Le liste WhatsApp: cosa il gestionale NON può fare, detto dove serve

Misurato prima di prometterlo: **WhatsApp normale non consente invii
automatici a una lista**, e l'account business ufficiale Alessio ha deciso di
non prenderlo. Quello che il gestionale fa è preparare **l'elenco dei
numeri** — la parte noiosa del lavoro a mano.

🔴 **E il limite esce insieme all'elenco, non in un documento**: un messaggio
broadcast **arriva solo a chi ha il numero di Alessio salvato in rubrica**, e
a chi non ce l'ha **non arriva senza che nessuno lo segnali** — risulta
«mandato». È la forma esatta di *«una risposta più corta che ha l'aria di
essere intera»*, e il gestionale **non può saperlo**: non vede la rubrica.
Quindi lo dice, lì.

⚠️ Sopra i 256 la frase cambia da sola e dice che vanno divisi in più liste.

---

## E chi resta fuori si vede

L'elenco dei destinatari porta **anche gli esclusi, con la ragione**: *un
elenco di destinatari senza gli esclusi si legge «sono tutti»*, e chi manda
non saprebbe di aver lasciato fuori metà rubrica. Le ragioni sono tre e
distinte: non gli è mai stato chiesto · si è cancellato · non ha lasciato una
mail.

---

## La storia sulla scheda del cliente

Cosa gli è stato mandato, cosa ha scritto lui, e le sue prenotazioni, in
ordine di tempo.

⚠️ **Le mail ricevute si riconoscono dal mittente e non si fotografa nessun
collegamento**: un cliente può cambiare indirizzo, e una colonna scritta una
volta racconterebbe una storia che smette di essere vera. **Il prezzo è
dichiarato** — cambiando mail, la corrispondenza vecchia non si vede più — ed
è preferibile a una storia falsa.

---

## Le prove, e come sono state rese rosse

**Tre clienti, non uno**, ed è il numero che decide se le prove misurano
qualcosa: con un cliente solo «tutti» e «solo quelli col consenso» sono lo
stesso insieme. ⚠️ E il terzo (aveva dato il consenso, poi si è cancellato)
**non è un doppione del secondo**: distingue «non lo so» da «ha detto di no».

**Due rotture, due rossi col messaggio giusto:**

| rottura | cosa è diventato rosso |
|---|---|
| la porta commerciale accetta chi non ha il consenso | *«Una comunicazione commerciale è uscita verso chi non ha dato il consenso»* — in migrazione **e** dal client |
| la cancellazione registra la richiesta in una nota ma lascia il consenso | *«Chi si è cancellato risulta ancora consenziente»* |

⚠️ **E la prova che guarda dall'altro lato**: *una conferma di prenotazione
non chiede nessun consenso*. Senza, un consenso preteso ovunque bloccherebbe
le conferme dei tavoli — e qualcuno lo aggirerebbe.

**Undici prove sui dati veri**, e tre esistono solo lì: in sala i consensi, la
rubrica e i numeri **si rifiutano** (non tornano vuoti). Dentro una migrazione
tutto gira come proprietario e un difetto di permessi non si vedrebbe mai
(lezione del 16/08).

---

## Cose da sapere

- ⚠️ **`email_inviate` ha un vocabolario chiuso**, e `tipo` ammetteva solo
  `conferma`: il valore nuovo è entrato **nel vincolo del database**, non solo
  dove qualcuno lo scrive. È la trappola del 17/08 sui vocabolari, e la rete
  `vocabolari_chiusi()` lo sorveglia.
- ⚠️ **`reservation_id` non è più obbligatoria** su quella tabella (una
  comunicazione commerciale non nasce da una prenotazione), ma un vincolo
  pretende **almeno uno fra prenotazione e cliente**. In produzione la tabella
  è **vuota** — misurato — quindi allargarla non ha risposto al posto di
  nessuno.

---

## I numeri

| | |
|---|---|
| prove pure | **168 passate**, 0 saltate |
| prove sui dati veri | **292 passate**, **0 saltate** |
| lint | zero avvisi |
| funzioni senza portiere | **18**, invariate |
| migrazioni sul progetto di prova | **161** |
| migrazioni in produzione | **158**, invariate |

---

## Cosa NON è verificato

- 🔴 **Nessuna mail commerciale è mai partita davvero.** Il blocco costruisce
  **chi può riceverla e il registro di cosa è uscito**; il tratto che manda
  materialmente il messaggio resta quello dell'11/08 (`email-cliente`), e
  collegarlo alla porta commerciale **non è stato fatto**: mandare mail vere a
  indirizzi veri non è una cosa da fare mentre Alessio non c'è.
- 🔴 **Il blocco 3 del mandato — leggere le mail dei clienti — NON è fatto.**
  La storia mostra le mail in arrivo che riconosce dal mittente, ma la Posta
  in arrivo **continua a trattare ogni mail come un documento da archiviare**.
  Serviva toccare `posta_ricevuta` e il giro delle proposte, che è il pezzo
  più delicato del gestionale e non l'ho aperto stasera.
- 🔴 **Nessuna mano ha visto le schermate** (nessun ambiente DOM, vedi il
  blocco A): il riquadro del consenso sulla scheda cliente e la schermata
  «Scrivere a più clienti» non li ha guardati nessuno.
- **In produzione ci sono 4 clienti, nessuno con una mail**: niente di questo
  ha ancora un caso vero su cui girare.

---

## DA CONFERMARE AD ALESSIO

1. **Come si manda davvero la comunicazione.** Oggi il gestionale dice **a chi
   si può scrivere** e **registra** cosa è uscito, ma il messaggio lo mandi tu.
   *Se vuoi che parta dal gestionale* come la conferma di prenotazione, si
   collega — ma è un invio vero a indirizzi veri, e volevo dirtelo prima.
   *Se preferisci mandarle dalla tua posta*, l'elenco degli indirizzi c'è già.
2. **Se «si è cancellato» debba comparire anche in cima alla scheda del
   cliente**, e non solo nel riquadro del consenso. L'ho lasciato dov'è —
   quella riga la leggi quando stai per scrivergli, non quando apri la scheda
   per un'altra ragione. *Se preferisci vederlo subito*, è una riga.
