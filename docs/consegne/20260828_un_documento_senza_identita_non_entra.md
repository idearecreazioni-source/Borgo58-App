# Blocco 1 — un documento senza identità non entra in archivio

**28/08/2026** · Nasce da una **prova con le mani** di Alessio, non da una
rilettura. Comprende anche il Blocco 0 del mandato (un difetto mio di poche
ore prima).

| | |
|---|---|
| **HEAD dichiarato** | `e820400` — *Un documento senza identita' non entra in archivio* |
| **Working tree** | pulito al momento del commit |
| **Migrazioni introdotte** | `20260828000010`, `20260828000011` |
| **In produzione** | 🔴 **nessuna delle due** — aspettano il push |
| **Sul progetto di prova** | applicate (315 migrazioni al momento del commit) |

Prima di tutto è stata applicata la migrazione che aspettava: **la produzione
è passata da 312 a 313**.

---

## Il difetto, dimostrato con le mani

Alessio ha aperto una proposta di archiviazione, ha premuto «Correggi i
dati», ha trovato **sei campi vuoti**, e ha premuto «Archivia» così com'era.
**Il gestionale ha archiviato senza rifiutare e senza avvisare.** Nell'Archivio
quella riga ha solo il titolo, mentre tutte le altre hanno tipo, data,
controparte, importo e scadenza.

---

## La mia prima diagnosi era sbagliata, e la misura l'ha corretta

Avevo concluso che **il travaso fosse rotto**: MEMO scrive nei parametri
`titolo, scadenze, righe…` e la schermata cerca `tipo, controparte, data,
importo`. Solo `titolo` sembrava combaciare.

🔴 **Falso: avevo smesso di leggere alla riga 800.** Alle righe 856-862 quei
campi ci sono tutti. Il conto, con un setaccio provato nei due versi:

> **6 tipi di proposta su 6 ricevono TUTTI i campi che la schermata apre.**

⚠️ **Il setaccio ha sbagliato due volte prima di valere**: la prima versione
prendeva una fetta vuota, la seconda usava un confine di parola che la riga di
comando trasformava in un carattere invisibile. Adesso si prova da sé — deve
trovare un campo che c'è e non trovarne uno inventato — **prima** di contare.

**La verità è un'altra, e va detta:** sul progetto di prova **nessuna mail è
mai passata da MEMO** — zero modelli, zero token. Le proposte le ha scritte lo
script dello scenario, e **10 su 11 hanno i parametri vuoti**. I campi vuoti
sono **dati di collaudo poveri**, non un travaso rotto.

---

## Il difetto vero, che resta intero

**Cosa rende ritrovabile un documento — misurato, non deciso a naso:**

| | |
|---|---|
| l'elenco è **ordinato** per | `document_date` (i vuoti sprofondano in fondo) |
| la ricerca guarda | `title`, `doc_type`, `counterparties` |

Un documento col solo titolo si trova **soltanto** ricordandone le parole
esatte: non compare cercando per tipo, non ha un posto nel tempo.

**Il minimo è TIPO + DATA**, e non è un'opinione: il tipo è l'unico campo
cercabile che **raggruppa** («mostrami i contratti»), la data è la chiave
dell'**ordinamento**. ⚠️ La **controparte** resta facoltativa apposta: è
cercabile quanto il tipo, ma può legittimamente non esistere (una circolare,
un verbale interno), e pretenderla rifiuterebbe documenti veri.

**Dove si rifiuta: sulla TABELLA.** Misurato: in un documento si entra da
**tre porte** — `archivia_posta`, `create_document`, le modifiche dal client.
Un controllo dentro una funzione ne copre una; il vincolo le copre tutte.

⚠️ **`NOT VALID`, ed è la parte pensata**: i due documenti senza identità che
Alessio **tiene come caso di prova** non vengono ricontrollati. Un vincolo che
li rifiutasse avrebbe due strade, tutt'e due sbagliate: fallire, oppure
riempirli di dati inventati. **Lasciati dov'erano** — verificato dopo: ci sono
ancora tutti e due.

### Lo stesso buco altrove? Misurato: no, sta in un posto solo

| tabella d'arrivo | cosa pretende |
|---|---|
| `documents` | solo `title` ← **il buco** |
| `cash_movements` | importo, verso, società, data |
| `stock_lots` | ingrediente, quantità |
| `tasks` | solo `title` |

⚠️ **`tasks` sembra lo stesso caso e non lo è**: un impegno senza scadenza è
uno stato **voluto** — è la corsia «quando capita» dell'Agenda, 11 su 79.
Rifiutarli romperebbe una decisione in vigore invece di chiudere un difetto.

### E a schermo il pulsante è spento con la ragione

Visto con gli occhi su due casi costruiti da me: l'incompleto **spento** con
la frase che nomina i campi mancanti, il completo **premibile** — e premuto, e
archiviato con tipo «rapportino», data 12/07/2026, controparte FrigoService.
**Non è un muro.**

---

## Blocco 0 — il ramo che non faceva più niente

Difetto mio di stamattina. Nel ripiego del preavviso era rimasto
`greatest(case when frigo then 2 else 14 end, 14)`: quel `case` **non ha
nessun effetto**, perché `greatest(2,14)` e `greatest(14,14)` fanno tutt'e due
14. Un ramo che **dice** che il frigo prende due giorni e non ne prende
nessuno. L'avevo scritto per un futuro, pagandolo con una frase falsa nel
presente.

🔴 **E la frase falsa era doppia**: `vocabolari.js` dichiarava quel parametro
dicendo «il frigo prende due giorni di preavviso» — vero fino a ieri, falso da
stamattina, **in un file che serve a spiegare le eccezioni**, cioè dove chi
legge si fida.

Il parametro **esce**, non resta «per un domani»: un parametro che non cambia
mai la risposta è una colonna spenta, ed è ciò che il 14/08 si è finito di
togliere dalla capienza.

---

## Le rotture

| rottura | esito |
|---|---|
| identità: vincolo tolto | *«un documento senza tipo né data è entrato»* |
| identità: vincolo a metà (solo il tipo) | *«con il tipo e senza data è entrato»* |
| identità: vincolo che rifiuta tutto | rossa sull'inserimento del completo |
| ramo morto: ripiego tornato corto | *«non è più il più prudente: 2»* |
| ramo morto: ramo rientrato di nascosto | *«è tornato a dipendere dalla conservazione»* |

⚠️ **La terza dà il messaggio grezzo del vincolo invece di uno mio.** Non ho
riscritto la migrazione per migliorarlo: era già applicata, e la regola vale
anche per una riga sola e anche prima del push.

---

## Cosa abbiamo rovesciato

**Niente.** Nessuna voce in vigore di `docs/DECISIONI.md` è stata
contraddetta. La voce del 28/08 sul ripiego prudente resta intera: il Blocco 0
toglie un ramo che non la realizzava, non la cambia.

**Voci di `DECISIONI.md` toccate**: nessuna modificata.

---

## Cosa NON è verificato

- 🔴 **Le due migrazioni non sono in produzione**: aspettano il push.
- 🔴 **Non ho mai visto MEMO leggere una mail vera.** Tutto quello che dico
  sul travaso viene dal codice e dai parametri, non da un giro vero: sul
  progetto di prova nessuna mail è mai stata letta da lui, e in produzione la
  Posta è vuota.
- ⚠️ **Il conto «6 tipi su 6» è un conteggio sul codice**, non un giro
  osservato: dice che i campi vengono scritti, non che il modello li riempia
  bene.
- ⚠️ **Non ho provato ad archiviare dal caricamento a mano** (l'altra porta):
  il vincolo la copre per costruzione, ma non l'ho aperta.
