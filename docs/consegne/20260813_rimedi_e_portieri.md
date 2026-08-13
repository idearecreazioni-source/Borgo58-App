# Consegna del 13/08/2026 (quinta) — i rimedi HACCP, e il rilievo del validatore

**Commit della consegna: `4e785ff`** (questo riepilogo è il commit
immediatamente sopra, sola documentazione). Working tree pulito.

| Commit | Cosa |
|---|---|
| `877fdc0` | un problema registrato deve avere un rimedio — `20260813000011` |
| `4e785ff` | una funzione che scavalca la RLS deve avere un portiere — `…12` |

**Applicate in produzione**: `…11`, `…12`. **84 migrazioni**.
`operazioni-atomiche` reinstallata (**v15**).

---

## 1. Rilievo del validatore su `5da7b24` — accolto, e allargato

> `quadratura_pagamenti()` è `security definer` e concessa ad
> `authenticated` **senza `is_titolare()` interno**: scavalca la RLS su
> `supplier_invoices` e `cash_movements`, quindi lo staff può leggere
> importi fatture, fornitori e uscite di cassa.

**È giusto.** `security definer` serve a far girare la funzione **senza
RLS**: è proprio il motivo per cui una funzione così deve rimettere il
controllo dentro di sé. La barriera che ha appena scavalcato non torna da
sola. `pay_supplier_invoice` lo fa; quella no.

### Non era un caso isolato, ed è la parte che conta

Cercando la stessa forma su tutte le `security definer` del progetto —
metodo dell'audit dell'08/08: *i guasti che emergono dopo anni sono lo
stesso errore ripetuto in venti punti* — **ne sono uscite otto**.

| funzione | cosa lasciava fare allo staff | esito |
|---|---|---|
| `quadratura_pagamenti` | leggere importi fatture, fornitori, uscite | portiere |
| `prodotti_da_compilare` | leggere l'anagrafica ingredienti | portiere |
| `funzioni_aperte_ad_anon` | leggere l'elenco dei varchi | portiere |
| **`applica_scheda_prodotto`** | **riscrivere** allergeni, conservazione, scarto | portiere |
| `costo_ingredienti_conto` | leggere il food cost di ogni piatto | **chiusa a tutti** |
| **`varianti_ingrediente`** | **leggere i prezzi d'acquisto** | portiere |
| **`variazione_prezzo`** | **leggere i prezzi d'acquisto** | portiere |

Le ultime due **il rilievo non le nominava**: sono saltate fuori contando
quante ne restassero senza controllo. Sono del 12/08 ed espongono
esattamente il dato che la prova automatica dei permessi dichiara vietato
allo staff — *«lo staff NON vede gli ingredienti: lì vivono i prezzi
d'acquisto»*.

**`applica_scheda_prodotto` era la peggiore**: non faceva *leggere*,
faceva *scrivere*. Uno staff poteva riscrivere allergeni, conservazione e
scarto di qualunque prodotto — cioè dati che finiscono sul menu del
cliente e nel costo dei piatti.

**`costo_ingredienti_conto` è stata murata, non sorvegliata**: nessuno la
chiama dal browser, la usa `close_order_as_discount_gift` che gira come
proprietario. Una porta che non serve a nessuno si chiude, non le si mette
un portiere.

### Cosa resta aperto allo staff, e perché

Quattordici `security definer` restano eseguibili da `authenticated`
senza `is_titolare()`, e **è una decisione dichiarata, non un residuo**:
funzioni trigger e di sistema (`set_order_entity_srls`,
`notify_reservation_telegram`, `send_due_task_reminders`,
`segnala_allarme`, `abbina_righe_carico`), il form pubblico
(`posti_liberi`, `public_reservation_options`), e le cose che in cucina o
in sala servono davvero: `record_stock_consumption`,
`link_reservation_customer`, la lista della spesa, **`partite_in_scadenza`
e `chiudi_partita`** — lo scadenziario serve in cucina, e chi butta una
partita scaduta è chi la trova. Nessuna di queste espone prezzi.

### Perché un errore e non un elenco vuoto

Filtrare con `where is_titolare()` sarebbe bastato a non far uscire i
dati, ma allo staff la schermata avrebbe detto *«non c'è niente che non
torna»* — una rassicurazione falsa. **Chi non deve vedere una cosa deve
sapere che non la sta vedendo.**

---

## 2. Rilievi 3, 4 e 6 del referto — chiusi

### Il fuori range e la merce non conforme

Erano lo stesso difetto in due registri: si scriveva che c'era un
problema e non succedeva niente — azione correttiva facoltativa, nessuna
non conformità, salvi e vai avanti. Su un registro esibibile quello è
peggio di un buco: **è una dichiarazione firmata** che te ne sei accorto
e non hai fatto nulla.

⚠️ **E perché non si blocca il salvataggio**, che era la soluzione ovvia:
davanti a un campo obbligatorio, alle undici di sera, uno non scrive il
rimedio — **non registra la lettura**. Una misurazione persa è
irrecuperabile; un rimedio scritto dopo è ancora un rimedio. Quindi la
lettura si salva sempre, e il problema apre da sé una non conformità che
resta **aperta** finché qualcuno non la chiude.

Due tabelle in una transazione: entrambe passano dal corridoio (B4).

### Le ferie

Giorni calcolati dalle date se non scritti (le mezze giornate restano a
mano), permesso a rovescio rifiutato, **sovrapposizioni impedite dal
database** con un vincolo di esclusione.

### L'IRAP

**Nessuna formula inventata.** In schermata c'è scritto che è calcolata
sull'utile per semplificazione, che la base vera è diversa e che con
dipendenti il numero **tende a essere più basso del vero**. Il resto lo
dice Laura.

---

## 3. Il controllo anti-deriva ha preso me, due volte

Nella stessa migrazione `…11`:

1. `conta_giorni_permesso()` è nata **senza revoca** — anche una funzione
   trigger è eseguibile da chiunque abbia la chiave pubblica.
2. Peggio: `create extension btree_gist` **senza schema** la installa in
   `public` e porta con sé ~190 funzioni di supporto, tutte aperte.
   L'elenco congelato è passato **da 12 a 200** in un colpo solo.

La prova automatica costruita stamattina è diventata rossa su entrambe,
**poche ore dopo essere stata scritta, e ha preso chi l'aveva
costruita**. È la differenza fra un controllo e una buona intenzione.
`btree_gist` ora sta in `extensions`, e la migrazione sposta anche
l'installazione sbagliata se l'ha già fatta.

---

## 4. Verifica

| Cosa | Stato |
|---|---|
| le due migrazioni sul progetto di prova | **applicate due volte**: idempotenti |
| **lo staff respinto** su quadratura, anagrafica, varchi, scheda prodotto, varianti, variazione prezzo | **provato** (6 rifiuti) |
| il titolare passa su tutte | **provato** |
| `costo_ingredienti_conto` non eseguibile da nessun utente | **provato** |
| ...e la chiusura conto la usa ancora dall'interno | **provato** sul corpo della funzione |
| lettura fuori range: si salva e apre una NC **aperta** | **provato** |
| lettura fuori range col rimedio: NC **chiusa** | **provato** |
| 0 °C non è «non misurato» | **provato** |
| attrezzatura senza range: nessun falso allarme | **provato** |
| merce non conforme apre una NC; regolare no | **provato** |
| ferie: 15 giorni contati, mezza giornata rispettata | **provato** |
| sovrapposizione e permesso a rovescio | **rifiutati** |
| elenco anonimi | **12**, verificato in produzione |
| `security definer` senza portiere | **14**, tutte dichiarate sopra |
| prove automatiche | **30 verdi** |
| lint, build | puliti |
| **produzione** | **84 migrazioni**, corridoio v15 |

---

## 5. Cosa resta

**Del referto**: l'IRAP (aspetta Laura) e **lo scarico del magazzino**,
che è un lavoro a sé e va fatto prima della Fase A della filiera della
spesa.

**Non verificato dal vivo**: niente di tutto questo. Non c'è un
dipendente, una lettura di temperatura, un ricevimento merci vero. Le
verifiche sono quelle dentro le migrazioni.

**Ancora in sospeso da ieri**: i dati di collaudo in produzione,
`/prova-voce`, e il messaggio delle 10:00 dello scadenziario mai visto
partire.
