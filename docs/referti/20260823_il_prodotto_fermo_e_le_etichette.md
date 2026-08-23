# Il prodotto fermo, e le etichette

**23/08/2026 — referto, non costruzione.** I blocchi 5 e 6 del mandato
dicevano 🔴 **MISURA E RIPORTA, NON COSTRUIRE**, e questo è quello che è
stato fatto: non è stata scritta una riga di codice per nessuno dei due.

**Dove è stato misurato**: progetto di prova, 182 migrazioni, lo scenario
dei due mesi (346 conti, 127 prodotti, 206 lotti in giacenza, 14
produzioni). Dove è indicato, anche sul database vero.

---

# Blocco 5 · L'avviso sul prodotto fermo

> *«Se compro delle alici con shelf life di due giorni ed entro quel termine
> non vengono registrati movimenti — vendita, cottura, abbattimento — il
> sistema mi avverte.»*

Il mandato chiedeva tre cose: **cosa conta come movimento**, se **cottura e
abbattimento esistono già**, e quanto grosso è il lavoro.

## 1 · Cosa conta come movimento, oggi

Chiesto al catalogo del database, non dedotto. Un lotto può muoversi in
**tre** modi, e nessun altro:

| | cosa scrive | dove |
|---|---|---|
| un conto chiuso | uno scarico | `stock_consumptions` (`reason = 'consumo'`) |
| una produzione | uno scarico | `stock_consumptions` (`produzione_id`) |
| uno scarico a mano | uno scarico | `spreco`, `rettifica`, `vitto_personale` |
| lo scadenziario | la chiusura della partita | `stock_lots.chiusa_il` (buttata / finita) |

## 2 · 🔴 Cottura e abbattimento NON esistono

Le tabelle HACCP sono **sette**, e sono queste: `cleaning_logs`,
`cleaning_tasks`, `equipment`, `goods_receiving`, `non_conformities`,
`pest_control_logs`, `temperature_logs`.

**Non c'è niente che registri una cottura, e niente che registri un
abbattimento.** Vanno costruiti da zero — ed è una decisione di prodotto,
non un dettaglio: registrare un abbattimento è un gesto HACCP con una sua
scheda (che cosa, quanto, da che temperatura a che temperatura, in quanto
tempo, chi).

## 3 · 🔴 E il pezzo che decide davvero: lo scarico NON sa da quale lotto

> `stock_consumptions` **non ha nessuna colonna che punti al lotto**.
> Controllato: zero.

Lo scarico è **per ingrediente**. Il gestionale sa che «di alici ne sono
uscite 2 kg», non «sono uscite *da questo lotto*».

⚠️ **Con FEFO si può dedurre** — il lotto che scade prima è quello che scende
— ma è una **deduzione**, non un fatto registrato. E il giorno che si
volesse rispondere in un controllo *«dove è finito il lotto 4471?»*
(rintracciabilità a valle, Blocco 6 del mandato cumulativo del 14/08) quella
deduzione non basta.

**Questo è il pezzo che decide se il lavoro è un giorno o una settimana.**

| se l'avviso guarda… | costo | cosa sa dire |
|---|---|---|
| **l'ingrediente** (di questo prodotto non è uscito niente) | **un giorno** — i dati ci sono tutti | «le alici non si muovono da tre giorni» |
| **il lotto** (questa partita non si è mossa) | **una settimana o più** — serve il legame lotto↔scarico, e va messo *prima* che si accumulino altri due mesi di scarichi senza | «la partita di lunedì è ferma, quella di ieri no» |

## 4 · ⚠️ E oggi l'avviso sarebbe quasi muto — per la ragione sbagliata

Misurato sullo scenario dei due mesi, chiedendo *«quanti lotti sono interi e
fermi oltre la loro durata?»*:

| | |
|---|---|
| lotti in giacenza | **206** |
| mai toccati (rimasto = ricevuto) | **123** |
| mai toccati **e con una durata dichiarata** | **4** |
| mai toccati **oltre la loro durata** | **1** (Arancia tarocco: durata 14 giorni, ferma da 83) |

🔴 **Quattro su centoventisette.** L'avviso non griderebbe perché il locale è
a posto: **non griderebbe perché `shelf_life_days` è vuoto quasi ovunque** —
e i quattro che ce l'hanno sono quelli compilati stamattina dall'assistente,
per provare un'altra cosa.

⚠️ È la stessa forma del difetto del 13/08 — *la soglia di magazzino non si
poteva scrivere da nessuna parte, quindi la lista della spesa restava vuota
e sembrava che funzionasse*: **tutto acceso, e muto**.

> **Conseguenza per l'ordine dei lavori**: questo avviso non si costruisce
> prima che le durate siano compilate. Il pulsante che le compila esiste
> (blocco 4 di stamattina, e ora dice quanti prodotti fa per volta), ma
> nessuno l'ha ancora premuto per intero.

## 5 · E una domanda di merito, che non è tecnica

L'esempio di Alessio è *«le alici con shelf life di due giorni»*. Ma il
**vitto**, lo **spreco** e la **produzione** sono tutti movimenti — quindi
un prodotto che finisce in una preparazione risulta mosso, ed è giusto.

🔵 **Domanda per Alessio**: un prodotto **aperto e usato a metà** conta come
mosso per sempre, o l'orologio riparte a ogni movimento? Le due regole si
comportano diversamente sul caso che gli sta a cuore — la cassa di alici
usata per un quarto lunedì e dimenticata fino a giovedì.

---

# Blocco 6 · Le etichette delle preparazioni

> Alessio vuole un sistema che comandi un'**etichettatrice**. Non ha ancora
> scelto l'apparecchio, e le stamperanno **sia lui sia chi prepara** —
> quindi il gesto va in due posti.

🔴 **Non è stato costruito niente**, come chiesto.

## 6 · Quanto sa già il gestionale

La ricerca del validatore dice cosa deve esserci sopra. Ecco, voce per
voce, cosa il database ha già:

| cosa serve | c'è? | dove |
|---|---|---|
| **nome del prodotto** | ✅ | `recipes.name` della preparazione |
| **data di produzione** | ✅ | `produzioni.creato_il` — su **14 produzioni su 14** |
| **data di scadenza** | ✅ | `produzioni.scadenza` — su **14 su 14** ⚠️ ma è un campo **facoltativo**: chi non la scrive stampa un'etichetta senza scadenza |
| **condizioni di conservazione** | 🔴 **quasi mai** | `ingredients.storage_type` — compilato su **4 prodotti su 127**, e sulle preparazioni prodotte è **vuoto su tutte e quattro** quelle guardate |
| **il lotto** | 🟡 **c'è ma non è leggibile** | `stock_lots.id` è un identificativo di 36 caratteri. Su un'etichetta serve un codice corto — e la ricerca dice che *in pratica coincide con la data di produzione*, che il gestionale ha |
| **chi l'ha preparata** | 🟡 **c'è, ma dice poco** | `produzioni.creato_da` è valorizzato su 14 su 14 — ⚠️ ma **l'accesso dello staff è uno solo e condiviso**, quindi su un'etichetta si scriverebbe sempre lo stesso nome |

**Sintesi**: delle sei voci, **due ci sono per intero**, due ci sono ma
vanno rese leggibili, e **una manca quasi ovunque** (la conservazione).

## 7 · Cosa cambia fra una etichettatrice in rete e una a USB

Questa è la domanda che decide il disegno, e la risposta è netta.

| | **in rete (Wi-Fi / Ethernet)** | **a USB** |
|---|---|---|
| chi le parla | qualunque dispositivo sulla stessa rete | **solo il computer a cui è attaccata** |
| dal tablet di cucina | ✅ direttamente | ❌ mai — il tablet non ha una porta USB utile né i driver |
| cosa serve costruire | l'app manda i dati a un indirizzo sulla rete locale | **un programma sul mini-PC** che riceve e stampa |
| il gesto «in due posti» | funziona subito da entrambi | funziona solo dove c'è il computer |

🔴 **E il gesto in due posti è la richiesta di Alessio**: le etichette le
stampa lui *e* chi prepara. Con una etichettatrice a USB, «chi prepara»
dovrebbe andare al computer — che è esattamente il passaggio che questo
gestionale toglie ovunque.

⚠️ **Il precedente è già in casa e va guardato**: le stampanti di reparto
aspettano il **mini-PC** (ARCHITETTURA §4.2), e la cucina oggi stampa i
ticket dal browser. Un'etichettatrice a USB finirebbe nella stessa coda —
cioè non si userebbe fino al mini-PC; una in rete si può usare **prima**.

> 🔵 **Da chiedere al fornitore, prima di comprare** (la stessa forma della
> domanda sul registratore telematico):
>
> *«Questa etichettatrice si collega alla rete, e accetta un lavoro di
> stampa da un indirizzo IP senza bisogno di un driver installato su un
> computer? Se sì, con quale linguaggio (ZPL, ESC/POS, altro)?»*
>
> ⚠️ Non è una cosa che si aggiunge dopo: o il modello lo fa, o non lo fa.

## 8 · Il pezzo che nessuno ha ancora deciso

🔵 **Domanda per Alessio**: l'etichetta si stampa **quando registri la
produzione** (un gesto solo: registri, esce l'etichetta) o **quando vuoi tu**
(un pulsante «ristampa» su ogni produzione)? Servono tutte e due prima o
poi, ma la prima decide dove sta il pulsante principale — e quindi se la
cucina lo trova dove sta già lavorando.

---

## ⚠️ Cosa questo referto NON dice

1. 🔴 **Non è stato costruito niente per nessuno dei due blocchi**, come
   chiedeva il mandato.
2. ⚠️ **Le misure del blocco 5 sono sullo scenario di prova**, che è finto
   per costruzione: 123 lotti «mai toccati» comprendono i carichi
   scaglionati che il comando crea apposta. Il numero che conta — **4
   prodotti su 127 con una durata dichiarata** — è invece vero e vale anche
   in produzione (dove i prodotti sono **zero**).
3. ⚠️ **Nessuna etichettatrice è stata provata**, e nessun linguaggio di
   stampa è stato verificato: quello che c'è scritto sul confronto rete/USB
   è la conseguenza di come funzionano i due collegamenti, non una misura su
   un apparecchio.
