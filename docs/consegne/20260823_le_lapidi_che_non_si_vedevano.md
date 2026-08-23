# Le lapidi che il controllo non vedeva

**Blocco 7 del mandato del 23/08** — le due cose in coda. Migrazione
**`20260823000010`**, applicata **solo sul progetto di prova**. In
produzione **non è stata cancellata nessuna riga**: vedi §5.

---

## 1 · Le due cose chieste, e la risposta

> · la riga finta nel registro delle cancellazioni, col criterio già trovato
>   (nata e morta nello stesso istante su un conto che non esiste più), **e
>   il controllo che non l'ha vista**;
> · le altre 23 righe vissute meno di un minuto: **guardale una per una** e
>   riporta se sono residui nostri o gesti veri.

**Guardate una per una, sul database vero.** Ecco cosa sono.

---

## 2 · Le ventiquattro righe

| quando | tabella | cosa | verdetto |
|---|---|---|---|
| 13/08 17:51 | discounts_gifts, cash_movements ×2 | `PROVA BANCA bonifico fornitore`, `PROVA BANCA incasso contante` | **nostre** — verifica della migrazione della banca |
| 13/08 20:15 | cash_movements ×2, supplier_invoices | `PROVA-PAGA-1`, `PROVA PAGA a mano` | **nostre** — «pagare una fattura è un movimento» |
| 13/08 20:40 | employees, employee_leaves ×2 | senza nota | **nostre** — verifica delle ferie |
| 14/08 23:11 · 15/08 12:22 · 16/08 00:30 | discounts_gifts ×3 | senza nota | **nostre** — verifiche degli sconti/omaggi |
| 15/08 21:57 | cash_movements ×3 | `__PROVA DEDUCIBILITA__` (ereditata, senza regola, senza documento) | **nostre** |
| 15/08 22:50 | cash_movements ×4 | `__PROVA TESORERIA__` (versamento ×2, fondo) + «Differenza rilevata contando il cassetto» | **nostre** |
| 15/08 23:10 · 23:35 | supplier_invoices ×2, cash_movements ×2 | `__PROVA TESORERIA fattura__`, `__PROVA ANTICIPAZIONI__` | **nostre** |
| **22/08 22:36** | **order_items** | riga di comanda, nessuna nota, **nessuno che l'ha cancellata** | **nostra** — ed è quella del mandato |

**Ventiquattro su ventiquattro sono residui nostri.** Nessun gesto vero.

E la riga del 22/08 è esattamente come descritta: nata alle 22:36:10 e morta
nello stesso secondo, su un conto che **non esiste più** (controllato: zero
righe in `orders` con quell'identificativo).

### E le otto che restano fuori sono gesti veri

Per completezza, le 8 lapidi che nessun criterio segnala: due voci libere
scritte a mano durante il collaudo (*«Vfgg»*, *«jsdsdf»*), un pagamento, due
documenti (*«BP»* e *«Certificato notarile di costituzione Borgo 58»*), una
prenotazione senza nome — che è **la pulizia della privacy che funziona** —,
un dipendente e una busta paga.

---

## 3 · 🔴 Perché il controllo ne vedeva due

`lapidi_di_prova()` cercava **la parola «verifica»** dentro la riga. Ma le
prove di questo progetto marcano le proprie righe in **cinque modi diversi**
— `verifica`, `__PROVA …__`, `PROVA BANCA`, `PROVA PAGA`, `TEST-AUTO` — e
alcune **non marcano niente**: uno sconto, una ferie, una riga di comanda non
hanno un campo dove scrivere una nota.

> ⚠️ Un controllo che cerca **una** parola trova per costruzione solo le
> prove che quella parola l'hanno scritta.

È la lezione del 19/08 sulle funzioni senza portiere — *un guardiano che
riconosce una sola delle scritture della stessa cosa passa in silenzio* — in
un posto nuovo.

| | prima | dopo |
|---|---|---|
| lapidi in produzione | 43 | 43 |
| che il controllo vede | **2** | **35** |
| di cui col marcatore | 2 | 29 |
| di cui solo sospette | 0 | 6 |

---

## 4 · Tre categorie, e la terza non conclude

🔴 **La prima stesura ne faceva due, e la prova automatica è diventata rossa
con 338 lapidi** sul progetto di prova. Erano tutte legittime: le lascia la
suite stessa, che lì gira ogni giorno.

*Un guardiano tarato su un database dove quel fatto è normale grida sempre —
e quelli si imparano a spegnere.* Quindi tre:

| categoria | cosa vuol dire | dove deve essere zero |
|---|---|---|
| **verifica di una migrazione** | una migrazione ha lasciato una traccia | **ovunque, sempre** |
| **marcatore di una prova automatica** | `TEST-AUTO`, `__PROVA…` | normale sul progetto di prova; **non** in produzione |
| **nata e morta nello stesso istante** | criterio strutturale, non una parola | è un **indizio**, non un verdetto |

⚠️ **La terza non è una prova.** Anche un gesto vero può durare un istante —
si scrive un movimento, ci si accorge della causale sbagliata, lo si
cancella. Chiamarla «di prova» sarebbe **inventare una certezza**: il
controllo la dichiara separata, e chi guarda decide.

La prova automatica pretende zero sulla **prima** categoria soltanto, con la
ragione scritta accanto.

---

## 5 · 🔴 Cosa NON è stato fatto, ed è una decisione

**Nessuna riga è stata cancellata dal registro vero.**

`deleted_records` è un registro **esibibile** e in sola lettura per tutti:
toglierne righe è una cancellazione di dati veri, e quella la decide Alessio
(regola del progetto: *«mai una cancellazione di dati veri fuori da una
migrazione con blocco di verifica»*, e *«niente sul database vero senza di
lui»*).

Quello che è stato costruito è **lo strumento che gliele fa vedere**:

- `lapidi_di_prova()` con le tre categorie e quanti secondi è vissuta ogni
  riga;
- e in **`npm run collaudo:stato`** una riga nuova: *«di cui: marcate come
  prova / nate e morte in un istante — 29 / 24»*, sotto il totale delle
  tracce. Prima quel comando diceva solo «43», che da solo non dice niente:
  quel numero cresce coi dati veri e con le prove insieme.

🔵 **Domanda per Alessio**: le 29 tracce marcate come prova le vuoi togliere
dal registro? Se sì, si scrive una migrazione con perimetro esatto e
verifica; se no, restano — non fanno danno, ma il registro che un giorno si
esibisce contiene 29 righe che non sono mai state gesti veri.

---

## 6 · Come è stata provata, e come è stata fatta fallire

La verifica costruisce **due** lapidi apposta, di cui una **senza nessun
marcatore** — ⚠️ che è il caso che il controllo vecchio non vedeva: su una
lapide marcata il blocco passerebbe anche col codice di ieri (regola del
caso vuoto). Poi controlla che quella senza marcatore venga vista, e che
**non venga dichiarata certa**.

**Rottura fatta**: rimesso il criterio vecchio (solo «verifica»), la verifica
è diventata rossa — *«La lapide marcata non viene riconosciuta»*.

---

## 7 · Cosa abbiamo rovesciato

Niente. Il criterio si allarga e si articola: nessuna decisione precedente
viene capovolta, e la regola che quel controllo difende — *le migrazioni non
lasciano tracce nel registro* — resta esattamente com'era, con l'unica
differenza che ora **è verificabile su più forme di scrittura**.

---

## ⚠️ Cosa NON è verificato

1. 🔴 **Niente in produzione**: la migrazione è solo sul progetto di prova, e
   **nessuna lapide vera è stata toccata**.
2. ⚠️ **Il verdetto sulle 24 righe è mio, non di una macchina**: le ho
   guardate una per una nel database vero, e il criterio con cui le chiamo
   «nostre» è il marcatore o la data che coincide con l'applicazione di una
   migrazione. Le tre `discounts_gifts` senza nota e le due `employee_leaves`
   sono attribuite **per contesto** (stesso istante di altre righe marcate),
   non per una prova diretta.
3. ⚠️ **La riga nuova di `npm run collaudo:stato` è stata letta**, non
   guardata da Alessio.
