# Consegna del 11/08/2026 (seconda) — come si entra nelle caselle

**Commit della consegna: `4cb91df`** (questo riepilogo è il commit
immediatamente sopra, sola documentazione). Working tree pulito.

| Commit | Cosa | Stato |
|---|---|---|
| `4cb91df` | le PEC nell'app di Aruba, il resto in Gmail | non pushato |
| `d1386f4` | Aruba sono **due mondi**, non un servizio con quattro porte | non pushato |
| `fa0a43e` | `postmaster@borgo58.it` **non esiste**: sono tre credenziali | non pushato |
| `34c245d` | `docs/POSTA.md`, la mappa pratica delle porte | non pushato |
| `dc73120` | ritocco grafico del riquadro delle richieste | già pushato |

**Nessuna migrazione, nessun codice nuovo** salvo `dc73120`, che è solo
stile. Niente da applicare in produzione.

---

## 1. Perché una consegna di sola documentazione

Alessio ha chiesto di fermarsi: entrare nelle caselle Aruba era «un
caos», e in giornata ci aveva già fatto perdere mezz'ora due volte. Un
problema che si ripresenta a ogni tentativo non è una distrazione: è un
difetto del sistema, e i difetti si documentano.

Il risultato è [`docs/POSTA.md`](../POSTA.md).

---

## 2. Le due cose che avevo scritto sbagliate

**`postmaster@borgo58.it` non esiste.** L'avevo messo in tre documenti
come credenziale del pannello del dominio, copiando le guide di Aruba
invece di leggere il pannello: dentro c'era scritto `19926453@aruba.it`,
cioè l'account. Alessio l'ha scoperto finendo nella pagina di recupero
credenziali e ricevendo «la login inserita non è valida» — un messaggio
che sembra una password persa e invece dice che quella login non è mai
esistita. Corretto ovunque, e trasformato in avvertenza esplicita.

**Aruba non è un servizio con quattro porte: sono due mondi.**
`areaclienti.pec.it` (le PEC) e `admin.aruba.it` / `managehosting.aruba.it`
(dominio e hosting) non si vedono a vicenda. Dall'area PEC non si arriva a
`info@borgo58.it`, e non è un permesso mancante.

La regola che ne esce, e che sta in testa al documento:

> **Un solo account apre tutti i pannelli. Ogni casella ha la sua
> password per leggere la posta.**

La tabella è ordinata per **posta** contro **pannelli**, non per prodotto
Aruba: la domanda che uno si fa davanti allo schermo non è «di che
prodotto si tratta», è «devo leggere posta o amministrare qualcosa».

---

## 3. Una decisione di Alessio che ha corretto la mia

Avevo proposto di mettere anche le PEC nell'app Gmail via IMAP. Funziona,
e sarebbe stato sbagliato: una PEC non è un'email, è una raccomandata, e
un'app di posta normale tratta le ricevute di accettazione e consegna
come messaggi qualunque — cancellabili con un dito, e la cancellazione
via IMAP tocca **anche il server**.

Alessio ha scelto le PEC nell'app di Aruba e il resto in Gmail. Il
sintomo che avevo ignorato era nel mio stesso testo: accanto alla mia
soluzione avevo dovuto scrivere **«non cancellare mai»**. Quando una
soluzione ha bisogno di un cartello di avvertimento, di solito è la
soluzione sbagliata.

---

## 4. Cosa resta aperto

- **Copia delle conferme in `info@borgo58.it`** — proposta ad Alessio,
  non ancora decisa: oggi le email di conferma partono dal servizio di
  invio e non compaiono negli «Inviati» di nessuna casella. Le risposte
  dei clienti sì, e arrivano dove devono.
- **Avviso di «accessi sospetti»** ricevuto da Aruba stamattina sulla
  casella `info@`: quasi certamente il primo collegamento del telefono,
  ma è stato chiesto ad Alessio di confermarlo. Se non fosse suo, va
  cambiata la password della casella.
