# Gli incassi del giorno, e le righe che non si distinguono

**23/08/2026 — referto, non lavoro.** Due cose viste da Alessio durante il
collaudo, con l'indicazione 🔴 **da NON costruire adesso**. Misurate sul
progetto di prova (lo scenario dei due mesi) e sul codice vivo.

---

# 1 · L'elenco degli incassi giorno per giorno non esiste

> *«In "Incassato e scontrinato" non esiste l'elenco degli incassi giorno per
> giorno — 01/06 tot, 02/06 tot. Lo cercavo e non c'è da nessuna parte.»*

## Cercato, e non c'è

Guardati tutti i posti dove un totale di incassi potrebbe stare:

| dove | che grana ha | perché non risponde |
|---|---|---|
| **Incassato e scontrinato** | **un totale del periodo** | `quadratura_fiscale` restituisce una riga sola: incassato, fiscalizzato, da fiscalizzare |
| **Andamento mensile** | **il mese** | è la schermata del confronto col piano, non del giorno per giorno |
| **Cassa / Prima nota** | il **movimento** | ⚠️ e soprattutto: gli incassi di sala **non sono in prima nota per scelta** (04/08) — solo il contante entra nel saldo, letto dai conti |
| **Comande** | il **conto** | uno per volta |

→ **Confermato: da nessuna parte.** Il gestionale sa dire quanto si è
incassato in un mese e quanto in un singolo conto, e **non c'è niente in
mezzo**.

## I dati ci sono già tutti — provato

Costruito l'elenco che manca, con quello che il database ha oggi, senza
aggiungere niente. Le prime otto serate di giugno:

| serata | conti | coperti | incassato | scontrinato |
|---|---|---|---|---|
| 02/06 | 3 | 8 | 338,00 € | **189,50 €** |
| 03/06 | 3 | 14 | 583,50 € | 583,50 € |
| 04/06 | 4 | 13 | 645,00 € | 645,00 € |
| 05/06 | 8 | 19 | 1.106,50 € | 1.106,50 € |
| 06/06 | 10 | 50 | 2.699,00 € | 2.699,00 € |
| 07/06 | 6 | 21 | 995,50 € | **956,00 €** |
| 09/06 | 4 | 12 | 578,00 € | 578,00 € |
| 10/06 | 5 | 13 | 581,00 € | 581,00 € |

*(25 serate con almeno un conto, in giugno.)*

⚠️ **E la prima riga mostra da sola perché serve**: il 02/06 sono entrati
338,00 € e ne risultano scontrinati 189,50. Quella differenza esiste già nel
database, ma oggi **si può vedere solo come totale del mese** — dove si
mescola con le altre ventiquattro serate.

## Dove starebbe meglio: **in «Incassato e scontrinato»**

Non è una preferenza, sono tre ragioni misurate.

1. 🔴 **È la scomposizione di un numero che quella schermata già mostra.**
   Oggi dice «incassato X, fiscalizzato Y» per il periodo. Le righe per
   giorno rispondono alla domanda che quel totale fa nascere — *da dove
   viene?* — e **una scomposizione che si può ricontrollare riga per riga è
   la forma che questo progetto usa già** per i totali delle due società
   sulle fatture (16/08).

2. ✅ **Conta già a serate, non a giorni di calendario.** Verificato sul
   corpo vivo: `quadratura_fiscale` filtra su `serata_di_servizio(o.closed_at)`.
   Un conto chiuso all'una di notte sta nella sera prima — che è l'unica
   grana giusta per un elenco «giorno per giorno» in un'osteria che chiude
   all'una. ⚠️ In Cassa quella regola **non** vale allo stesso modo: la
   prima nota è per giorno di calendario.

3. ⚠️ **In Cassa sarebbe nel posto sbagliato per una ragione già decisa.**
   Il 15/08 è stato stabilito chi comanda sui ricavi: *«i conti chiusi sono
   l'unica fonte dei ricavi; la chiusura di serata NON aggiunge ricavo,
   ripartisce l'incasso per mezzo di pagamento e alimenta la tesoreria»*.
   La Cassa è **dove stanno i soldi**, non **quanto si è venduto**: metterci
   l'incassato per giorno creerebbe un secondo posto che risponde a «quanto
   abbiamo incassato», ed è precisamente ciò che quella decisione evita.

🔵 **Resta una domanda di prodotto per Alessio**: le colonne. L'elenco
minimo è *serata · incassato*; con **conti e coperti** accanto diventa anche
lo scontrino medio a coperto, che è il numero da cui si correggono i prezzi
— ma è una colonna in più su una schermata che ne ha già.

---

# 2 · Le righe «Già segnati» non si distinguono

> *«Ci sono solo data, tavolo e tipo di documento. Per rettificare bisogna
> sapere QUALE — e il 27 giugno ci sono nove righe quasi identiche.»*

## Quello che si vede oggi, e quello che il gestionale sa già

La schermata legge **sei campi** e ne mostra **tre**:

```
id, table_label, closed_at, documento_fiscale, documento_numero, documento_emesso_il
```

Il 27 giugno — **dieci righe**, non nove:

| serata | tavolo | documento | coperti | **importo** | **cliente** |
|---|---|---|---|---|---|
| 27/06 | T2 | scontrino | 4 | 223,00 € | BASE-Sciacca |
| 27/06 | T8 | scontrino | 2 | 99,00 € | — |
| 27/06 | T9 | scontrino | 2 | **102,50 €** | BASE-Indelicato |
| 27/06 | T9 | scontrino | 2 | **102,50 €** | — |
| 27/06 | T3 | scontrino | 4 | 171,50 € | BASE-Privitera |
| 27/06 | T1 | fattura da fare | 3 | 116,00 € | — |
| 27/06 | T6 | scontrino | 3 | 196,00 € | BASE-Grasso |
| 27/06 | T5 | scontrino | 4 | 251,50 € | — |
| 27/06 | T7 | scontrino | 3 | 124,50 € | — |
| 27/06 | T4 | scontrino | 4 | 256,50 € | — |

Le colonne in grassetto **il gestionale le ha già** e non le mostra:

| dato | dove sta | copertura |
|---|---|---|
| **importo** | `totale_conto(id)` — la stessa funzione del preconto | **tutti** i conti |
| **cliente** | `orders.reservation_id` → `reservations.customer_name`, il legame del 18/08 | **176 su 329** (54%) |
| coperti | `orders.coperti` | tutti |
| ora | `orders.closed_at` | tutti |

## 🔴 Quanto serve davvero l'importo, contato

Quanti gruppi di righe restano **indistinguibili** con quello che si vede,
su tutti i 329 conti già segnati dello scenario:

| con quello che la schermata mostra… | gruppi ambigui |
|---|---|
| data + tavolo + documento (**oggi**) | **15** |
| aggiungendo l'**importo** | **1** |
| aggiungendo anche l'**ora** | **1** |

→ **L'importo da solo risolve 14 gruppi su 15.** È il campo che fa il
lavoro, e costa una colonna in una query che già legge quel conto.

⚠️ **E il caso che resta è istruttivo**: le due righe T9 del 27/06 sono
chiuse **allo stesso minuto (23:21)**, per lo stesso importo, con gli stessi
coperti. Nemmeno l'ora le separa — le distingue solo il **nome del
cliente**, che ce l'ha una sola delle due. È un artefatto dello scenario
(due conti gemelli creati insieme), ma dice una cosa vera: *nessuna
combinazione di campi rende ogni riga unica; il nome del cliente è quello
che ci va più vicino, e c'è solo su metà.*

## ⚠️ E una conseguenza che non si vede

Il legame conto → prenotazione esiste dal 18/08, e da allora **nessuna
schermata lo mostra** — era già scritto nella consegna di quel giorno:
*«per chi usa l'app, un dato scritto che nessuno può vedere è
indistinguibile da un dato non scritto»*. Questo elenco sarebbe il **primo
posto** dove quel legame diventa visibile.

---

## ⚠️ Cosa questo referto NON dice

1. **Non è stato costruito niente**, come chiesto: nessuna migrazione,
   nessuna riga dell'app.
2. ⚠️ **I numeri vengono dallo scenario di prova**, che è finto: i 329 conti
   e i nomi «BASE-…» non sono clienti veri. Quello che è vero è **come sono
   fatti i dati** — quali campi esistono, quali sono coperti e in che
   percentuale.
3. ⚠️ **La copertura del nome cliente (54%) è una proprietà dello scenario,
   non del locale**: dipende da quanti conti nascono da una prenotazione.
   In un'osteria dove si prenota poco sarà più bassa, e l'importo resterà
   l'unica colonna che distingue davvero.
4. ⚠️ **Non è stato misurato quanto costa in lettura**: aggiungere l'importo
   significa chiamare `totale_conto()` per ogni riga dell'elenco (oggi
   limitato a 50). Su cinquanta conti non è un problema, ma **non è stato
   cronometrato**.
