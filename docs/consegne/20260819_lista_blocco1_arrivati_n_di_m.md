# Lista della spesa — blocco 1: «arrivati 5 di 20»

**Mandato**: [`20260817_la_lista_non_scrive_uscite.md`](../mandati/20260817_la_lista_non_scrive_uscite.md),
deciso da Alessio il 17/08/2026; ampiezza confermata il 19/08.
**Migrazione**: `20260819000001_arrivati_n_di_m.sql` — **applicata sul
progetto di prova, NON ancora in produzione** (aspetta il push di Alessio).
**Commit dichiarato in fondo.**

---

## ⚠️ Cosa NON è verificato

1. 🔴 **Nessuna mano ha toccato questa schermata.** Tutto quello che segue è
   provato dalle verifiche dentro la migrazione e da 5 prove sui dati veri;
   **nessuna prova di questo progetto guarda una schermata**.
2. 🔴 **Non esiste nessun arrivo vero da confrontare**: in produzione ci sono
   2 righe in lista, entrambe «ordinata», e **nessuna fattura vera è mai
   stata caricata**. Il giro «fattura → arrivo → riga che si chiude» non è
   mai stato percorso da un documento vero.
3. ⚠️ **La riga che si chiude da sola non è mai stata vista chiudersi in
   produzione**, e quando succederà sarà su un ingrediente vero con altri
   lotti — condizione che qui non si è potuta riprodurre, perché il perimetro
   delle prove è fatto solo di roba che le prove creano (lezione del 16/08).
4. ⚠️ **La regola «l'arrivo va alla riga più vecchia ancora aperta» non è mai
   stata esercitata su due righe vere dello stesso ingrediente** create da
   Alessio: le due righe di produzione sono di prodotti diversi.
5. ⚠️ **Il blocco 2 non c'è**: i tre esiti a mano, l'uscita in prima nota e il
   vocabolario unico dei mezzi di pagamento **non sono in questa consegna**.
   Fino ad allora la schermata continua a chiudere una riga con la vecchia
   funzione, quella che scrive un importo e un mezzo **senza che ne consegua
   niente** — cioè il difetto che il mandato esiste per chiudere.

---

## Cosa abbiamo rovesciato

**Nessun rovesciamento in questo blocco.** Le due decisioni che avrebbero
potuto esserlo non lo sono:

- **Le righe «ordinata» adesso si vedono** (sotto, § difetto trovato): non
  rovescia niente, perché non era una decisione — era un filtro che nessuno
  aveva mai messo alla prova con una riga ordinata dentro.
- **La colonna nasce `null` e non `0`**: è l'applicazione della regola del
  14/08, non un suo rovesciamento.

---

## La misura, fatta prima di scrivere

In produzione, in sola lettura, il 19/08:

| | |
|---|---|
| righe in `shopping_list_items` | **2**, entrambe «ordinata» |
| righe chiuse | **0** |
| righe con un mezzo di pagamento scritto | **0** |
| righe in `foraged_items` | **0** |
| movimenti di prima nota | **0** |

⚠️ **Niente da preservare**, ed è la ragione per cui il mandato dice di farlo
adesso: oggi la colonna è una migrazione e basta; fra un mese sarebbe la
stessa migrazione **più** una sanatoria **più** il dubbio su cosa fare delle
righe già chiuse — e quel dubbio non ha una risposta giusta.

**Il Contratto è stato constatato prima di toccare lo schema**: nessuna
modifica necessaria. La colonna nuova segue i pattern §4 (RLS già attiva
sulla tabella, vista `_display` per lo staff senza colonne economiche), la
funzione nuova ha `security definer` + `set search_path = public` + `revoke`,
e nessuna delle scritture nuove è multi-tabella — quindi non si aggiunge
niente al corridoio.

---

## 🔴 Il difetto trovato misurando: le righe ordinate non si vedevano

La schermata della lista costruisce due elenchi:

- «Da comprare» filtra `status === "da_comprare"`
- «Acquistati» filtra `status === "acquistato"`

**Una riga «ordinata» non entra in nessuno dei due.** Restava viva nel
database, compariva in *Ordini*, e **spariva dalla lista della spesa**.

⚠️ **E in produzione le uniche due righe sono ordinate**: la Lista della
spesa si apre **vuota** mentre dentro c'è roba. È la famiglia dei difetti che
questo progetto insegue da giorni — *un elenco vuoto si legge «non manca
niente»*, ed è un'informazione, non un'assenza di informazione.

⚠️ **Ed è il difetto che avrebbe reso inutile tutto questo blocco**: la riga
ordinata è **esattamente quella che aspetta gli arrivi**. Senza vederla,
«arrivati 5 di 20» non lo leggerebbe nessuno.

**Cura**: «Da comprare» comprende le righe ordinate, con un segno che dice
`ordinata`. Non un terzo elenco: una riga ordinata **non è arrivata**, quindi
sta dove stanno le cose che ancora si aspettano.

---

## Cosa è stato costruito

### 1. La colonna: quanto ne è arrivato

`shopping_list_items.quantita_arrivata`, ⚠️ **`null` di partenza, non zero**
(regola del 14/08: un predefinito è una risposta, e su righe già esistenti è
una risposta data da chi scrive la migrazione al posto di chi usa il
gestionale). `null` vuol dire «nessuna consegna abbinata»; `0` direbbe «è
arrivato, ed era zero». Le 2 righe vere sono nel primo caso.

⚠️ **`quantity_needed` non si tocca MAI.** La riga dice «arrivati 5 di 20» e
**non si riscrive a 15**: quanto ne serva ancora lo decide Alessio, e un
numero che cambia da solo è un numero che nessuno può spiegare.

### 2. La merce che entra spegne la voce della lista

`registra_arrivo_in_lista(ingrediente, quantità)`, chiamata da
`register_stock_delivery`:

- **arrivo parziale** → la riga **resta aperta**, somma, e la schermata
  **propone** la chiusura («mi bastano, chiudi la riga»);
- **arrivo completo** → la riga si chiude da sé. Non c'è niente da decidere.

⚠️ **Le due righe sciolgono l'unica ambiguità del mandato**, che in un punto
dice «la riga si chiude da sé» e in un altro «propone la chiusura». Sono due
casi diversi, non due regole in conflitto — e la frase decisa da Alessio
(«resta aperta con *arrivati 5 di 20* e propone») descrive il caso parziale.

⚠️ **NESSUNO DEI DUE SCRIVE UN'USCITA**, ed è il principio del mandato: la
merce arrivata con un documento ha già il suo costo nel documento. La
verifica lo controlla dove si romperebbe — dopo la chiusura automatica,
`purchased_amount` e `payment_method` devono essere **vuoti**.

⚠️ **Quale riga riceve l'arrivo, dichiarato perché non è ovvio**: la **più
vecchia ancora aperta** di quell'ingrediente, per intero. Spalmare l'arrivo
su più righe sarebbe una regola inventata da noi su come Alessio compra.

⚠️ **Senza `quantity_needed` non si può dire «completo»**: la riga registra
l'arrivo e resta aperta. Chiuderla vorrebbe dire sapere quanto ne serviva, e
quel numero non c'è.

### 3. Più largo di quanto il mandato chieda — e va detto

Il mandato parla del **carico da fattura**. Il gancio è invece dentro
`register_stock_delivery`, che è la porta da cui passano **il carico da
fattura e la registrazione a mano di una consegna**.

**La ragione**: sono lo stesso fatto — *è arrivata merce* — e ticchettare la
lista in un caso solo vorrebbe dire che registrare una consegna a mano lascia
in lista roba che è già in cella. ⚠️ **È un allargamento deliberato**, non una
svista: se Alessio lo vuole più stretto, si stringe.

⚠️ **`close_shopping_list_item` non passa da lì** (inserisce il lotto per
conto suo), quindi non c'è nessun anello che si morde la coda: chiudere una
riga a mano non genera un arrivo che chiude la riga.

### 4. «Mi bastano, chiudi la riga»

`chiudi_riga_arrivata(riga)` — la via del **documento**, e si distingue dai
tre esiti a mano proprio in questo: **non scrive nessun costo e non carica
nessun lotto**. Il lotto c'è già, il costo sta nella fattura.

⚠️ **Si rifiuta se non è arrivato niente**, col messaggio che dice cosa fare
al posto suo: *«chiudila dicendo com'è andata (comprata, avuta gratis, o non
presa)»*. Un rifiuto senza via d'uscita è un vicolo cieco (regola del 16/08).

### 5. Le due letture

`lista_spesa()` è stata **cancellata e ricreata** (cambia il tipo restituito,
e Postgres non lo permette con un `create or replace`). ⚠️ **Dopo un `drop` i
permessi tornano aperti al mondo** — trappola del 13/08: si richiudono a
mano, e la verifica controlla **entrambi i versi** (che `anon` non possa più
eseguirla, e che `authenticated` possa ancora).

La vista `shopping_list_display` guadagna `quantita_arrivata` **in fondo**
(42P16: in una vista le colonne si aggiungono solo alla fine). Non è un dato
economico — è la stessa cosa che si legge sullo scaffale.

---

## Le prove, e la controprova

**5 prove nuove sui dati veri** (`tests/app/arrivi-lista.test.js`), oltre ai
9 controlli dentro la migrazione.

⚠️ **Perché sui dati veri e non pure**: quello che tengono ferme è il giro
**attraverso il database** — la merce che entra spegne la voce della lista.
Una prova pura si inventerebbe i dati *della forma che il codice si aspetta*,
che è esattamente il modo in cui il 18/08 si era persa una colonna che si
chiamava con un altro nome.

⚠️ **Un ingrediente per prova.** La prima versione ne condivideva uno, e
tre prove su cinque sono diventate rosse **per il residuo, non per un
difetto**: la riga lasciata aperta dalla prima si prendeva gli arrivi delle
successive — che è la regola che funziona. *In una catena di prove che
condividono lo stato, chi conta i rossi conta i difetti solo se le prove sono
indipendenti* (lezione del 18/08), e qui la cura è il perimetro proprio.

### La controprova — tre rotture

| rottura | cosa è diventato rosso |
|---|---|
| l'arrivo non si **somma** (sovrascrive) | la verifica della migrazione: «la riga dice 15 invece di 20» |
| l'arrivo parziale **chiude** la riga | la verifica: «la riga si è chiusa da sola» |
| `registra_arrivo_in_lista` non fa più niente | **4 prove su 5** sui dati veri |

⚠️ **La terza rottura è quella che conta**: è stata fatta **sul database di
prova**, cioè scavalcando il file della migrazione. Se le prove avessero
guardato solo ciò che la migrazione dichiara, non se ne sarebbero accorte.

---

## Per Alessio, in una riga

La lista della spesa adesso mostra anche le righe già ordinate — **prima
sparivano, ed erano le uniche due che ha** — e quando la merce arriva la riga
dice «arrivati 5 di 20» invece di sparire o di riscriversi da sola.

---

**Commit**: `3aa4aa5` — «La lista dice quanto ne è arrivato, e le righe
ordinate tornano a vedersi».
**Working tree**: pulito (questo riepilogo è l'ultimo commit della consegna).
