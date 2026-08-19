# La selezione si compone in un tocco — blocco 2, seconda metà

**Migrazione**: `20260820000001_una_selezione_si_copia.sql`
— applicata sul progetto di prova, **NON ancora in produzione**.
**Corridoio**: `operazioni-atomiche` **v14 sul progetto di prova**, un'operazione
nuova (`duplica_ricetta`). In produzione resta la v13.
**Mandato**: [`20260819_i_finger_food_e_lo_storico_dei_costi.md`](../mandati/20260819_i_finger_food_e_lo_storico_dei_costi.md).
Con questo il **blocco 2 è chiuso**; resta il **blocco 3**, lo storico dei costi.

---

## ⚠️ Cosa NON è verificato

1. 🔴 **Nessuna mano ha toccato una spunta.** In questo progetto le prove non
   hanno un ambiente DOM: **nessuna prova automatica guarda una schermata**.
   Ciò che è provato è che le scritture e le letture sotto le spunte fanno la
   cosa giusta — non che il pannello si veda, si apra e si tocchi.
2. 🔴 **E questa è la schermata dove quel limite pesa di più**, perché è
   quella su cui Alessio passerà ore di seguito: le tre scelte che ha fatto
   riguardano **il gesto**, e il gesto è precisamente ciò che nessuna prova
   qui dentro guarda.
3. ⚠️ **Il Ricettario vero è vuoto** (0 ricette in produzione): il pannello
   non è mai comparso su dati veri, perché non ci sono bocconcini.
4. ⚠️ **La copia non è mai stata fatta su una ricetta con una fotografia, dei
   video o uno storico di stato lungo**: le prove costruiscono ricette
   semplici, e ciò che *non* si copia è controllato solo su
   `pronta_per_carta`.
5. ⚠️ **La stampa del menu e gli allergeni di una selezione** restano fuori,
   come dal blocco 1.

---

## Cosa abbiamo rovesciato

**Nessun rovesciamento.**

---

## Le tre scelte di Alessio, e cosa ha comprato ognuna

Erano state **poste come domande** invece di essere decise, perché è la
schermata su cui passerà più tempo di ogni altra.

### 1 · Un elenco con le spunte, non «cerca e aggiungi»

Il modulo che c'era chiedeva sei gesti per riga — tipo, ricerca, selezione,
quantità, unità, aggiungi — e per un bocconcino **la quantità è sempre uno**.
Adesso è **un tocco per bocconcino**, e la quantità non si chiede.

⚠️ **Il prezzo, dichiarato**: se una volta servissero due pezzi dello stesso
bocconcino, il numero si corregge nella riga della tabella sotto — *dove si
correggono tutte le altre quantità*. Non è un secondo posto inventato per
l'occasione.

⚠️ **E il pannello NON c'è sempre**: si apre da sé se la ricetta è già una
selezione, resta chiuso sugli altri piatti, e non compare affatto se non
esiste nessun bocconcino. *Un pannello che c'è sempre diventa arredamento*,
ed è il criterio con cui in due giorni sono state tolte sette spiegazioni.

### 2 · Il costo si aggiorna a ogni spunta, e la spunta SALVA

Era la scelta con un costo vero da nominare, e gli sono state date tutte e
tre le strade:

| strada | cosa comprava | cosa costava |
|---|---|---|
| ✅ **la spunta salva, il costo si rilegge** | il numero è sempre quello del gestionale | niente «annulla tutto»: si toglie la spunta |
| spunti e poi salvi | meno scritture | si compone al buio |
| anteprima calcolata dalla schermata | nessuna scrittura | **lo stesso numero in due posti**, che è il difetto tolto da nove punti col mandato di correzione |

⚠️ **Anche i costi dei singoli bocconcini si rileggono a ogni spunta**, non
una volta all'apertura: altrimenti sullo stesso schermo convivrebbero un
totale di adesso e dei prezzi di prima. Sono letture piccole; un numero
vecchio accanto a uno nuovo no.

### 3 · Una selezione si copia

«Selezione da 6» e «Selezione da 8» si somigliano, e ricomporre da zero la
seconda è lavoro ripetuto.

🔴 **La copia passa dal corridoio**, perché tocca **tre tabelle** — la scheda,
le sue righe, i suoi passi — ed è tutto-o-niente per senso: a metà resterebbe
**una ricetta col nome giusto e dentro niente**, cioè nessun errore e un food
cost di zero euro con l'aria di essere un numero. È la forma dichiarata il
19/08: *una risposta più corta che ha l'aria di essere intera.*

⚠️ **La funzione dice quanto ha copiato** (righe e passi) e la schermata lo
riporta — insieme a cosa **non** ha copiato. Un «fatto» senza numeri lascia a
chi arriva sulla copia il compito di contare.

⚠️ **E il messaggio viaggia con lo spostamento**, non resta sulla schermata
di partenza: un istante dopo quella schermata non esiste più, e l'avviso
sarebbe sparito con lei.

### Cosa la copia NON porta con sé, e perché

| | ragione |
|---|---|
| `pronta_per_carta` | una copia non l'ha riletta nessuno: nasce in sviluppo |
| `in_carta` | è un **riflesso**, lo scrive solo il trigger: una copia non è in nessun menu |
| la fotografia | è di un altro piatto: farebbe vedere la selezione da 6 sulla scheda di quella da 8 |
| lo storico di stato | è un **registro**: la storia della copia comincia adesso |
| i video | sono allegati dell'originale |

Ciò che porta sono **le righe e i passi**, cioè il lavoro vero.

---

## 🔴 Un difetto trovato per strada: l'etichetta che avrebbe mentito

Nella tabella degli ingredienti ogni componente portava un cartellino fisso
**«preparazione»**. Dal 19/08 un componente può essere un **bocconcino** — e
quel cartellino avrebbe scritto una cosa falsa **senza nessun errore**, su
ogni riga di ogni selezione.

⚠️ **Ed era invisibile leggendo la schermata**: il tipo del componente non
arrivava nemmeno, perché la lettura non lo chiedeva. Adesso lo chiede, e una
prova diventa rossa se smette di arrivare. *È la famiglia vista tre volte in
tre giorni — due parti dello stesso programma che raccontano cose diverse
dello stesso fatto — e il posto dove vive è lo spazio fra le due.*

---

## Le prove, e le cinque rotture

**Sei controlli dentro la migrazione** e **tre prove nuove col token di un
utente vero** (11 in tutto nel file, 224 sull'app).

| rottura | cosa è diventato rosso |
|---|---|
| la copia dimezza le quantità delle righe | *«La copia costa 0,2000 e l'originale 0,4000»* |
| il nome proposto viene ignorato | *«Il nome proposto è diventato "… (copia)"»* |
| la copia eredita «pronta per carta» | *«La copia è nata già pronta per la carta»* |
| il tipo sparisce dalla lettura del componente | *«il tipo del componente non arriva alla schermata»* |
| l'operazione non è nell'elenco del corridoio | la copia viene **rifiutata**: la prova passa davvero di lì |

🔴 **La prima rottura è quella che vale**: contare le righe **non l'avrebbe
presa** — sei righe e un passo, tutto in ordine. L'ha presa solo il confronto
dei **costi**. *Righe copiate senza le quantità darebbero un elenco giusto e
zero euro.* Per questo la verifica controlla anche che l'originale costi più
di zero: su una ricetta vuota quel confronto passerebbe senza distinguere
niente — la trappola del caso vuoto del 17/08.

---

## Perché `duplica_ricetta` NON è `security definer`

Scrivere su quelle tre tabelle è **già riservato al titolare dalla RLS** (nove
policy, tutte con `is_titolare()`): la funzione non ha niente da scavalcare.
Un `definer` avrebbe aggiunto **una diciassettesima funzione da sorvegliare**
e un portiere da tenere allineato a mano, per ottenere ciò che la RLS fa già.

---

## Per Alessio, in una riga

Apri una selezione, spunti i bocconcini che ci vanno e vedi il costo salire
tocco dopo tocco; «Fai una copia» ti dà la variante da otto senza rifarla da
capo, e ti dice cosa c'è dentro.

---

**Commit del lavoro**: `bb3fadf` — «La selezione si compone in un tocco —
blocco 2, seconda metà».
**Working tree**: pulito.
**Migrazione**: `20260820000001` — sul progetto di prova sì, in produzione
**no**, in attesa del `git push`.
**Corridoio**: da installare in produzione dopo il push
(`npm run funzione operazioni-atomiche -- --conferma`), altrimenti «Fai una
copia» risponde che l'operazione non esiste.
