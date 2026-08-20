# La posta dei clienti

**Decisioni di Alessio, 20/08/2026.** **Non è per adesso**: è scritto mentre
le decisioni sono fresche, perché fra un mese la ragione di ognuna sarebbe
già sbiadita.

---

## Cosa vuole, tutte e tre le cose

1. **Mandare** ai clienti quello che il gestionale già produce — conferme di
   prenotazione, preventivi, promemoria;
2. **Leggere** dentro il gestionale le mail che arrivano dai clienti;
3. **Conservare la storia**, visibile dalla scheda del cliente.

---

## 🔴 Prima la misura: metà esiste già

| pezzo | stato |
|---|---|
| leggere una casella | ✅ c'è: `posta_ricevuta`, `posta_allegati`, `posta_azioni`, `esegui_azione_posta` — la Posta in arrivo dei documenti, viva dal 12/08 |
| mandare una mail | ✅ c'è: la funzione online `email-cliente` e il registro `email_inviate`, vivi dall'11/08 (conferma di prenotazione) |
| l'interruttore di Alessio | ✅ `service_settings.email_conferma_attiva` |
| l'indirizzo del locale | ✅ `info@borgo58.it` su Aruba ([`docs/POSTA.md`](../POSTA.md)) |
| la scheda cliente | ✅ `customers`: nome, telefono, **email**, note |
| la mail sulla prenotazione | ✅ `reservations.customer_email` |
| **il consenso** | 🔴 non esiste niente |
| **la storia sulla scheda del cliente** | 🔴 non esiste |
| **il filtro «questa mail è di un cliente»** | 🔴 non esiste |

⚠️ **Quindi la domanda del mandato non è «come si legge una casella»**: quella
è risolta. È **cosa cambia quando chi scrive è un cliente e non un
fornitore** — e quello che cambia è il consenso, la storia, e il fatto che
una mail di un cliente non è un documento da archiviare.

---

## Le decisioni di Alessio

### 1 · La mail è un campo della prenotazione, ma OPZIONALE

⚠️ **Si prende al telefono mentre il locale è pieno**, e *un campo
obbligatorio lì diventa un indirizzo inventato pur di andare avanti*. È la
stessa forma del difetto che questo progetto insegue: un dato falso è peggio
di un dato mancante, perché nessuno lo mette in dubbio.

### 2 · 🔴 Il consenso — si costruisce COL modulo, non dopo

- **Si raccoglie a voce, ma si REGISTRA**: una spunta e una **data** sulla
  scheda del cliente. ⚠️ *Un consenso che esiste solo nella memoria di
  Alessio non è dimostrabile*, ed è l'unica cosa che conta se un domani viene
  contestato.
- **Ogni comunicazione a più clienti porta la riga per cancellarsi**, e la
  cancellazione deve **funzionare davvero**: togliere quella persona dagli
  invii successivi, non solo registrare la richiesta. ⚠️ Una cancellazione
  registrata e non applicata è peggio di nessuna: c'è la prova scritta che
  l'aveva chiesto.
- 🔴 **E la distinzione che regge tutto**: scrivere a chi ha prenotato per
  confermargli il tavolo **non ha bisogno di niente**; mandare il menu del
  mese a duecento persone **sì**.
  ⚠️ **Le due strade non devono poter essere confuse in una sola funzione
  «manda mail»**, altrimenti prima o poi una comunicazione commerciale esce
  dalla porta di servizio. Sono due funzioni con due nomi diversi, e quella
  commerciale **pretende il consenso** — non lo controlla la schermata, lo
  controlla il database.

### 3 · 🔴 Le liste WhatsApp — cosa NON si può fare

Misurato prima di prometterlo:

- **WhatsApp normale non consente invii automatici a una lista.**
- Le **liste broadcast** si fanno **a mano dal telefono di Alessio**, arrivano
  **solo a chi ha il suo numero salvato in rubrica**, e tengono **al massimo
  256 contatti**.
- L'**account business ufficiale** è un servizio a parte, a pagamento, coi
  testi da far approvare. **Alessio ha deciso di non prenderlo per ora.**

**Quindi**:

- il gestionale **non manda liste WhatsApp**;
- quello che **può** fare, ed è la parte utile: preparare **l'elenco dei
  numeri** da copiare nella lista broadcast, filtrato come serve — *che è la
  parte noiosa del lavoro a mano*;
- l'invio **a un cliente per volta** col testo già pronto resta com'è oggi
  (`whatsapp://`, e si copia sempre prima).

🔴 **IL LIMITE DELLA RUBRICA VA SCRITTO DOVE ALESSIO PREPARA LA LISTA.** Un
messaggio broadcast a chi non ha il suo numero in rubrica **non arriva, e
nessuno lo segnala**: risulta «mandato» e non è mai arrivato. ⚠️ È la forma
esatta del difetto che questo progetto chiama *«una risposta più corta che ha
l'aria di essere intera»*. Il gestionale **non può saperlo** — non ha accesso
alla rubrica del telefono — quindi **deve dirlo lì**, accanto all'elenco, non
in un documento.

---

## I blocchi, in ordine di dipendenza

### Blocco 1 — il consenso, prima di tutto

La spunta e la data sulla scheda del cliente, la cancellazione che **toglie
davvero**, e le **due funzioni separate** — di servizio e commerciale — con la
seconda che pretende il consenso **nel database**.

⚠️ Va per primo perché è la cosa che non si può aggiungere dopo: un modulo che
manda mail e poi impara il consenso ha già mandato mail senza.

### Blocco 2 — la mail sulla prenotazione, e la storia

Il campo opzionale, il collegamento alla scheda cliente, e l'elenco di cosa è
stato mandato e ricevuto.

### Blocco 3 — leggere le mail dei clienti

Estende la Posta in arrivo: una mail di un cliente **non è un documento da
archiviare**, è una conversazione da attaccare alla sua scheda.

### Blocco 4 — l'elenco dei numeri per la lista broadcast

Col limite della rubrica e dei 256 scritto accanto.

---

## Prove che possono fallire

- una comunicazione **commerciale** a chi non ha dato il consenso viene
  **rifiutata dal database**, non nascosta dalla schermata;
- una **conferma di prenotazione** parte **anche senza consenso**: è la prova
  che distingue le due strade — senza, un consenso preteso ovunque
  bloccherebbe le conferme, e qualcuno lo aggirerebbe;
- chi si è cancellato **non compare** nel giro successivo, non solo nel
  registro delle richieste;
- ⚠️ **e la rottura**: fai in modo che la funzione commerciale accetti anche
  chi non ha il consenso, e verifica che una prova diventi rossa. *Se non
  diventa rossa, la porta di servizio è già aperta.*

⚠️ **E i numeri delle prove vanno scelti perché distinguano**: con un cliente
solo, «tutti» e «solo quelli col consenso» sono lo stesso insieme.

---

## Cosa questo mandato NON copre

- l'account WhatsApp Business ufficiale (decisione di Alessio: non ora);
- gli SMS;
- una campagna con statistiche di apertura: qui si manda e si conserva, non si
  misura;
- il recupero dei clienti storici: non ce ne sono, il locale non ha aperto.
