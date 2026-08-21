# I turni dei pasti — la misura, prima di costruire

**Misurato il 21/08/2026 sul codice vivo e sullo schema del database.**
⚠️ **Nessuna riga di codice scritta**: è un lavoro nuovo e tocca la schermata
che sta davanti a chi cucina.

---

## 1 · Il turno può appoggiarsi all'invio? **No, e si dimostra nei due versi**

La Cucina raggruppa oggi per `order_id + sent_at` — cioè per **invio**
(`Cucina.jsx`, riga 47; il Bar fa lo stesso, riga 64).

Misurato in `sendDraftItems` (`api/orders.js`): l'invio scrive **un solo
istante su tutte le righe selezionate**

```
.update({ sent_at: new Date().toISOString() }).in("id", ids)
```

e `handleSend` gli passa **tutte** le righe non ancora inviate. Da qui i due
versi:

| | |
|---|---|
| **Un invio ≠ un turno** | Segnando tutta la comanda e premendo «Invia» una volta, le tre portate escono con lo **stesso** `sent_at`: un ticket solo, e i turni sparirebbero. **È il caso normale**, non un'eccezione. |
| **Un turno ≠ un invio** | Un piatto aggiunto dieci minuti dopo ma dello **stesso** turno prende un `sent_at` diverso: due ticket per una cosa sola. |

🔴 **Quindi sono due cose diverse**, e la conferma è che il difetto si vede
in tutte e due le direzioni. Il turno deve stare **sulla riga**, come dice il
mandato — e la colonna non c'è: `order_items` ha 13 colonne e nessuna nomina
un turno.

⚠️ **E metà del meccanismo esiste davvero**, quindi non si butta niente: la
Cucina sa già raggruppare righe e stampare un ticket per gruppo. Cambia
**quale chiave** raggruppa, non la macchina.

---

## 2 · Cosa vede la cucina oggi

Un ticket per invio, impaginato a 72 mm (la larghezza utile di una termica da
80), che si stampa dal browser:

```
      CUCINA — T5
        21:14
  2× Sarde a beccafico
  1× Paccheri al ragù
    ↳ senza pecorino
  Nota tavolo: allergia ai frutti a guscio
```

**Cosa deve vedere**: le stesse righe **raggruppate per turno**, con i
separatori del tuo esempio. ⚠️ **Dentro lo stesso ticket**, non in tre
ticket: un solo invio può contenere tutti e tre i turni, ed è il caso
normale.

⚠️ **Una cosa che la misura fa emergere e che non ho deciso**: se una riga
del 2° turno viene aggiunta **dopo** (secondo invio), esce un ticket nuovo
che contiene solo quella. La cucina si troverebbe **due fogli** che parlano
del 2° turno dello stesso tavolo. Non è un difetto da correggere ora — è una
cosa che deve saperti dire come la vuoi.

---

## 3 · Il biglietto «avanti col prossimo turno» — dove compare

🔴 **Qui la misura trova un vincolo di cui bisogna parlare prima di
costruire.** La cucina, per decisione del progetto (§3.2.1), **non ha uno
schermo**: lavora solo di carta. La pagina «Cucina» **non è la schermata
della cucina** — è una **postazione di stampa** che qualcuno guarda per
premere «stampa», e si aggiorna da sola ogni 10 secondi.

Le tre strade, con quello che costano davvero:

| dove | cosa succede | il problema |
|---|---|---|
| **un ticket da stampare** | compare fra i ticket, si stampa come gli altri | «adesso» è un segnale **istantaneo**: aspetta che qualcuno guardi la pagina e prema. Fino a 10 secondi + il gesto |
| **una striscia in cima alla pagina Cucina** | compare da sola entro 10 secondi, grande, senza stampare niente | serve che qualcuno **guardi quella pagina** — e in cucina non c'è uno schermo |
| **Telegram** | arriva sul telefono | la macchina esiste già (`notify-telegram-reservation` accetta `task_reminder` e `allarme`), ma arriva **sul telefono di Alessio**, non in cucina |

⚠️ **Nessuna delle tre porta la voce in cucina**, che è quello che serve. La
domanda vera non è tecnica: **chi, in cucina, riceve quel biglietto e su
cosa?** Finché la cucina è di sola carta, «avanti» è un foglio che esce dalla
stampante — e allora la strada è la prima, con il ritardo dichiarato.

⚠️ **E c'è una cosa da decidere che non è mia**: quel biglietto **si
conserva**? Se resta solo a schermo, dopo un ricarico della pagina non c'è
più; se si conserva, serve un posto dove scriverlo (una riga in una tabella)
— e allora si può anche ristampare.

---

## 4 · Il turno tocca il preconto o il conto? **No — verificato**

Il conto si calcola in un posto solo, `orderTotals()` in
`lib/calcoli/conto.js`: somma le righe **non annullate e inviate**, più i
coperti. **Non guarda `sent_at` per raggruppare**, e non guarderebbe un
turno.

Il preconto stampa le stesse righe, in ordine. Aggiungendo una colonna
`turno`, **nessuno dei due cambia di un centesimo**.

⚠️ **E non si mettono i separatori sul preconto**: quel foglio è per il
cliente, e i turni sono l'ordine con cui la cucina manda fuori le cose.

---

## 5 · Cosa costerebbe, in una riga ciascuno

Non è una proposta di lavoro: è la misura di quanto pesa, perché tu decida.

- **una colonna** `order_items.turno` (numero intero, 1 di partenza) —
  ⚠️ **il predefinito qui è una risposta giusta**: una comanda senza turni è
  tutta il primo turno, che è ciò che succede oggi;
- **un pulsante «Prossimo turno»** accanto al menu: alza di uno il numero con
  cui nascono le righe nuove;
- **i separatori** nella lista della comanda e nel ticket della cucina;
- **un pulsante «Avanti prossimo turno»** fra i gesti del tavolo, che manda
  il biglietto col numero del tavolo;
- **il biglietto**, dove lo decidi tu (punto 3).

---

## ⚠️ Le tre domande che restano tue

1. **Il biglietto «avanti» dove esce?** Un foglio dalla stampante (col
   ritardo di chi deve premere), una striscia sulla pagina Cucina, o
   Telegram?
2. **Il biglietto si conserva** o vive solo finché la pagina è aperta?
3. **Il caso dei due fogli**: se aggiungi un piatto del 2° turno dopo aver
   già inviato, la cucina riceve un secondo foglio che parla dello stesso
   turno. Va bene così, o quel foglio deve dire qualcosa in più?

⚠️ **Non ho costruito niente**, e non ho aggiunto conteggi, blocchi o
conferme: il pulsante che avevi scartato — quello che diceva quale turno sta
chiamando e si spegneva alla fine — resta scartato.
