# I prestiti di privati

**22/08/2026.** Mandato di Alessio, committato perché non vada perso — quello
precedente esisteva solo in chat.

---

## I fatti

Alessio ha ricevuto **tre prestiti da privati** per l'investimento iniziale.
Sono **soldi già entrati**, e oggi il gestionale non li conosce.

| da chi | quanto | come |
|---|---|---|
| Ylenia | 20.000 | bonifico |
| Roberto | 5.000 | bonifico |
| Manuela | **4.990** | contanti |

⚠️ **L'importo di Manuela è 4.990 e non 5.000** perché la legge pone lì la
soglia del contante. **Il numero è quello, non si arrotonda** — ma Alessio ha
deciso che **non serve annotare il perché** nel gestionale.

---

## Il problema, in una riga

🔴 Oggi quei soldi entrerebbero come «altro incasso», **indistinguibili da un
incasso vero**. Guardando il saldo di cassa non si distingue quello che è di
Alessio da quello che deve restituire.

Il gestionale deve saper rispondere a **due domande che oggi hanno la stessa
risposta**:

> «quanti soldi ho?» · «quanti soldi sono **miei**?»

---

## Cosa deve fare

- registrare i tre prestiti: **da chi, quanto, come è entrato** (bonifico o
  contante), **quando**;
- registrare le **restituzioni**, parziali o totali;
- dire in ogni momento **quanto si deve ancora**;
- e dire **quanto si può restituire adesso** senza restare a secco. Alessio:
  *liquidità meno impegni a sei mesi meno 5.000 di riserva*.

---

## 🔴 Nessuna scadenza e nessun piano di rientro

Deciso da Alessio:

> *«Non hanno scadenza e il gestionale non deve chiedermi quando restituire —
> deve solo dirmi quanto posso.»*

**Non costruire** promemoria, rate, o avvisi di scadenza.

⚠️ **E il numero che conta è quello dello SPAZIO DI MANOVRA, non del
debito**: sapere di dovere 30.000 non serve a decidere niente; sapere che
oggi puoi restituirne 3.000 sì.

---

## Prima di costruire: misura e riporta

1. **Le causali di cassa sono 17 e nessuna riguarda i prestiti** (verificato
   dal validatore in produzione). Serve una causale nuova, **o i prestiti non
   sono movimenti di cassa e vanno da un'altra parte?** Dire cosa si è
   trovato **prima** di scegliere.
2. **«Ce la faccio?» in Cassa calcola già liquidità meno impegni futuri**:
   quel conto è la base dello spazio di manovra o è un'altra cosa? **Non
   scriverne un secondo** — se serve, estendere quello.
3. 🔴 **E cosa succede al saldo di cassa e alla Proiezione quando entrano
   30.000 che non sono ricavi**: se finiscono nei ricavi, **il food cost e le
   imposte proiettate saltano**. Questa è la cosa da verificare per prima.

---

## Vincoli di sessione

⚠️ Niente sul database vero finché Alessio non è presente.
