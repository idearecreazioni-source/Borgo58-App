# Posso guardare una schermata? — la misura

**21/08/2026** · blocco C del mandato. **Una misura, non un lavoro: non è
stato costruito niente.** La decisione è di Alessio.

---

## 1 · Lo strumento esiste? — sì, ma non fa quello che sembra

Provato adesso, non dedotto. Aperta `borgo58.it/prenota` a **768×1024**:

| cosa | esito |
|---|---|
| **leggere la struttura** della pagina (campi, testi, pulsanti, link) | ✅ **sì** |
| **misurare** posizioni, larghezze, stili, colori calcolati | ✅ **sì** |
| leggere gli **errori** della pagina e le richieste al database | ✅ **sì** |
| **fare i gesti** (toccare, scrivere, inviare) | ✅ **sì** |
| 🔴 **vedere il disegno** — una fotografia dello schermo | ❌ **no** |

Lo scatto fallisce: *«the Browser pane is not displayed, so the page is not
compositing frames»*. In questa sessione il pannello del browser non è
mostrato, quindi la pagina non produce immagini.

⚠️ **La distinzione non è un dettaglio, è tutta la risposta.** Posso chiedere
*«quanto è largo quel riquadro? di che colore è? il testo esce dal bordo?»* e
avere numeri esatti. **Non posso guardare la schermata e dire «è brutta» o
«non si capisce».**

---

## 2 · 🔴 E la misura ha già trovato un difetto vero

Aprendo il **form pubblico dei clienti** — l'unica pagina che non chiede il
PIN — in cima compare:

> **Progetto Supabase oudjuqbqszisdtwzbxdo · DATI VERI — quello che scrivi
> qui conta davvero.**

Misurato che si vede per davvero: `visibility: visible`, `opacity: 1`, alta
17 punti, a 9 punti dal bordo superiore.

**Lo vede chiunque prenoti un tavolo dal sito.** È rumore tecnico —
l'identificativo del database compreso — sulla pagina che il locale mostra ai
suoi clienti.

⚠️ **Non l'ho corretto**: il mandato dice di non costruire niente, e quella
striscia è già oggetto del blocco 4 del mandato precedente (diventa un
pallino). Ma la trasformazione va fatta sapendo questo: **il pallino non deve
comparire sulle pagine pubbliche**, e la striscia oggi ci compare.

⚠️ **E questo è l'argomento più onesto per il blocco C**: il difetto è saltato
fuori nei primi due minuti, sull'unica pagina raggiungibile senza credenziali.

---

## 3 · Cosa servirebbe per un accesso mio sul progetto di prova

**Molto meno del previsto: quasi tutto esiste già.**

Misurato come funziona l'ingresso (`src/context/AuthContext.jsx`): **il PIN è
la password** di due utenti fissi — `alessio@borgo58.app` (titolare) e
`staff@borgo58.app`. Non c'è nessun altro meccanismo.

E sul progetto di prova quei quattro utenti **ci sono già**: li usano le 292
prove automatiche, con le credenziali in `.env.test` (git-ignored).

> ⚠️ **`.env.test` NON ESISTE PIÙ DAL 31/08/2026** — nota aggiunta il 01/09.
> I tre file di chiavi (`.env.local`, `.env.test`, `.env.db`) sono diventati
> **uno solo, `.env`**; il modello con le caselle è `.env.example`. Le righe
> qui sopra **restano com'erano scritte quel giorno**: questo è un documento
> datato, non una guida, e correggerlo lo renderebbe un racconto falso di
> quello che è successo. La nota c'è perché quel nome ha già mandato a
> cercare un file inesistente.

Quindi servirebbe **una cosa sola**:

> una **password diversa** per quegli utenti **sul solo progetto di prova** —
> cioè un PIN di collaudo che non è quello di Alessio.

⚠️ **E si tiene fuori dalla produzione da sé, per costruzione**: sono due
database separati, con due elenchi di utenti separati. Un PIN di collaudo
messo lì **non apre niente in produzione**, nemmeno per sbaglio, nemmeno se
finisse in chiaro da qualche parte. Non è una regola da rispettare: è un
fatto.

⚠️ **Il PIN di Alessio non gira**, ed è giusto così: le credenziali di una
persona non si prestano, o non si sa più chi ha fatto cosa. Questo non è
prestarle — è **un'identità diversa su un database usa-e-getta**.

⚠️ **Cosa NON servirebbe**: nessun utente nuovo (ci sono), nessun permesso
nuovo (il titolare li ha tutti), nessuna modifica al codice, nessuna
migrazione. Il gestionale già sa puntare al progetto di prova
(`npm run dev:prova`) e già si distingue a colpo d'occhio, con la striscia
grigia invece di quella rossa.

---

## 4 · Cosa si chiuderebbe davvero — il conto onesto

Da tre giorni ripetiamo che nessuna prova guarda una schermata. Questi sono
**i difetti veri trovati dall'occhio di Alessio**, e per ognuno la domanda:
*con quello strumento l'avrei preso?*

| difetto | l'avrei preso? | come |
|---|---|---|
| **La lista della spesa non si apre** | ✅ **sì** | la pagina non si disegna e l'errore è leggibile |
| **Preventivi senza nessuna porta** | ✅ **sì** | si cerca il collegamento nella schermata che dovrebbe portarci |
| **I due pannelli sovrapposti** | ✅ **sì** | si misura: due riquadri presenti insieme |
| **`54. kg` nel magazzino** | ✅ **sì** | è testo: si legge |
| **Il menu si prende un quarto del tablet** | ✅ **sì** | si misura la larghezza a 768 |
| **Il magazzino non entra nello schermo** | ✅ **sì** | la tabella è più larga del suo contenitore, ed è un numero |
| **L'email sparisce salvando il consenso** | ✅ **sì** | si scrive, si preme, si rilegge il campo |
| **Il tavolo che non si deseleziona** | ✅ **sì** | si tocca due volte e si guarda il colore |
| **«Il colore si distingue in sala?»** | ❌ **no** | posso dire il valore esatto; non se si distingue a colpo d'occhio con la luce del ristorante |
| **«Questa schermata è comoda da usare?»** | ❌ **no** | è un giudizio, non una misura |

**Otto su dieci.** Le due che restano fuori sono precisamente quelle che
**dipendono da un occhio e da una sala**, e per quelle Alessio resterà l'unico
strumento — ma sono due, non dieci.

⚠️ **E il guadagno vero non è il conteggio: è il momento.** Tutti e otto sono
stati trovati **dopo** la consegna, alcuni giorni dopo. Con quello strumento
sarebbero stati trovati **prima di consegnare**, cioè prima che Alessio
perdesse tempo a collaudare qualcosa di rotto.

---

## 5 · Il limite da dichiarare, perché la decisione sia informata

- 🔴 **Non è «guardare».** Chiamarlo così ingannerebbe: è *interrogare* una
  schermata. Le due cose che l'occhio fa e questo non fa — giudicare un
  colore in sala, giudicare se una cosa è comoda — sono esattamente quelle
  che il progetto ha già sbagliato due volte (la soglia di tocco del 18/08, i
  colori che tornano oggi).
- ⚠️ **Non sostituisce il collaudo di Alessio**: lo **precede**. Serve a non
  fargli trovare le cose rotte, non a decidere al posto suo.
- ⚠️ **Lo scatto potrebbe funzionare in altre sessioni**: il fallimento di
  oggi è che il pannello non è mostrato, non che lo strumento non esista. Se
  funzionasse, anche la prima delle due domande fuori portata si
  avvicinerebbe — ma non la seconda.

---

## 6 · La decisione è di Alessio

Non è stato costruito niente. Se dice di sì, il lavoro è: **cambiare la
password dei due utenti sul solo progetto di prova**, scrivere dove vive
quel PIN (accanto a `.env.test`, git-ignored), e una riga in CLAUDE.md che
dica che quel PIN **non è mai quello della produzione**.
