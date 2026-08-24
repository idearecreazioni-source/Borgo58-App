# Le migrazioni, il telefono e i vincoli che parlano italiano
**25/08/2026 — consegna in corso, riepilogo aggiornato blocco per blocco**

Commit sotto questo riepilogo: dichiarato in fondo, a consegna chiusa.

---

## Blocco 0a — le migrazioni in attesa

Stato di partenza misurato: **226 in produzione**, 235 nel repository,
9 in attesa. Repository allineato con GitHub (`c5df7cd` su HEAD e su
`origin/master`).

### Applicate

- **`20260824000030`** — *i diciassette confronti reggono*. **Non
  eseguita: registrata** dalla `20260824000032`, che ne rifà il
  controllo con roba propria. È la prescrizione scritta dentro la
  `…032` stessa (regola del 23/08: una migrazione già applicata, o
  già fallita, non si riscrive — si supera con una nuova).
- **`20260824000032`** — *i confronti col foglio non devono
  peggiorare*. Sostituisce la pretesa «17 su 17 tornano» con la
  proprietà «i confronti non peggiorano». Aggiunge
  `confronti_storti(uuid)`.
  - ⚠️ **Misura riportata dall'applicazione**: sulla previsione
    congelata «Previsione di partenza», **17 confronti, 6 non
    tornano**. Non è un guasto: è la voce di costo fisso da 300 €/mese
    aggiunta fra il caricamento del foglio e il congelamento del
    15/08. Vedi il blocco 0d.
  - ⚠️ Il ramo che esercita la rottura **non è stato percorso in
    produzione**: non esiste nessuna previsione libera (misurato: 1
    previsione in tutto, congelata). La migrazione lo dichiara con un
    `notice` invece di fingere di aver provato.

### Fermata a metà — e cosa ha lasciato dietro

**`20260824000033`** — *la scala di una linea è un dato*. Si è fermata
in produzione con:

> `ERROR: Nessuna previsione libera: la rete non puo' essere provata
> rompendola, e una rete mai vista scattare non si sa se scatta.`

🔴 **E LA MIGRAZIONE NON LASCIA NIENTE A METÀ SOLO SE FALLISCE PRIMA
DELLE DDL.** Qui la verifica sta in fondo, quindi in produzione sono
rimasti — misurati dal connettore in sola lettura, non dedotti:

| cosa | stato in produzione |
|---|---|
| colonna `scenario_linee_accessorie.scala` | **presente** |
| vincolo `linea_scala_nota` | presente (9 vincoli sulla tabella) |
| `scala_del_calcolo(text)`, `scale_che_non_tornano()` | **create** |
| riga in `applied_migrations` | **assente** |

È esattamente il caso già scritto in CLAUDE.md §8 il 23/08 («il
messaggio dello strumento dice che non lascia niente a metà: non è
vero quando il blocco che fallisce viene dopo delle DDL già
eseguite»), **ricomparso**.

⚠️ **La verifica non era sbagliata**: pretendeva di poter *rompere* la
rete per dimostrare che scatta, ed è la regola giusta. Sbagliato era
il **perimetro**: cercava una previsione libera fra quelle di Alessio
invece di crearsene una propria. È la regola del 16/08 — *il perimetro
di una prova dev'essere fatto di roba che la prova ha creato*.

⚠️ **Un dato vero emerso dal suo notice**, che vale a prescindere:
sulla previsione congelata la linea **«Eventi premium (n/mese)»** ha
la scala che non torna — il nome dice «al mese», il calcolo la legge
«per evento». Confermato già il 24/08: sono 24 eventi **all'anno** e i
numeri del piano sono giusti; mente l'etichetta.

### Le sei degli allergeni

`20260824000034`, `20260824000035`, `20260824000036`,
`20260824000037`, `20260824000038`, `20260824000039` — verificato che
**nessuna nomina** `scala`, `scale_che_non_tornano`,
`scenario_linee_accessorie` o `calcola_proiezione`: sono indipendenti
dalla `…033` e possono entrare senza di lei.

### Righe esistenti toccate

Controllate una per una prima di applicare:
- la `…032` **modifica e rimette com'era** i `controlli` di una
  previsione libera — ramo **non percorso** in produzione, che
  previsioni libere non ce ne sono;
- tutte le altre scritture (`scelte_allergene`,
  `sostituzioni_allergene`, `order_item_sostituzioni`) stanno su
  **tabelle nate in questa stessa serie**, quindi vuote in produzione;
- ogni verifica conta le **lapidi** di `deleted_records` prima e dopo.

**Nessun dato di Alessio è stato cancellato o moderato in modo
permanente.**

---

## Cosa abbiamo rovesciato

*(sezione fissa, anche quando è vuota)*

Niente, in questo blocco. La `…032` **conserva** la decisione del
15/08 sul confronto col foglio e ne cambia solo il metro; la
prescrizione di saltare la `…030` era già scritta dentro di lei.
