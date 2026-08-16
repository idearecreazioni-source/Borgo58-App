# Consegna del 16/08/2026 (dodicesima) — Blocco 9 del mandato di correzione

**Commit della consegna: `ce56413`.** Questo riepilogo è il commit
immediatamente sopra, sola documentazione. Working tree pulito.

| Commit | Cosa |
|---|---|
| `3016dff` | il pagamento misto — migrazioni `20260816000011` e `20260816000012` |
| `ce56413` | la sanatoria gira impersonando il titolare — correzione di `20260816000012` dopo il fallimento in produzione |

⚠️ **Questo riepilogo è stato scritto PRIMA che `20260816000012` fosse
applicata**, ed è la rete del 16/08 ad averlo imposto: la migrazione
`20260816000011` era già in produzione — applicata durante il tentativo
fallito — e nessun riepilogo la nominava. `npm run migra` si è rifiutato
di andare avanti. **È la seconda volta oggi che quella rete interviene su
un caso vero, e la prima in cui interviene su un arretrato che avevo
creato senza accorgermene.** I numeri dell'applicazione di
`20260816000012` sono in §7, aggiunti subito dopo.

⚠️ Questa consegna **non modifica** `docs/CONTRATTO.md`.

Con questo blocco il mandato di correzione è **completo su tutti i dieci
blocchi**. Restano le **piccolezze** elencate in coda al mandato.

---

## 1. Il difetto, e la domanda fatta prima di disegnare

Un conto aveva **un solo modo di pagamento**. Se due persone dividono e
una paga in contanti e l'altra con la carta, l'app non sapeva dirlo — e
⚠️ **nessuna riconciliazione con la banca sarebbe mai tornata**, perché il
POS accredita una cifra che il gestionale non ha mai registrato.

Il mandato dice di farlo **adesso**, prima che entrino i conti veri:
cambiarlo dopo, con lo storico dentro, costa molto di più.

**La domanda posta ad Alessio prima di scrivere una riga**, perché le due
strade si registrano in modo diverso e non si indovinano: *quando due
persone dividono, quante volte batti sul POS — una sola per la sua parte,
o prima la carta per il totale e poi restituisci il contante?*

> **«Una sola per la sua parte.»**

Quindi il conto si divide in **quote**, ognuna col suo mezzo e il suo
importo, e la somma fa l'incassato. ⚠️ **Non esiste il giro di
restituzione**, che avrebbe richiesto di registrare un'uscita di cassa
mai avvenuta — e un'uscita finta in prima nota è precisamente ciò che
questo progetto non fa.

Sulla schermata: **«Pagano in due modi»** propone la metà (divisione
equa, sua indicazione), si corregge la cifra della carta e il contante si
aggiorna da solo. Sotto c'è scritta la cosa che serve in sala: *batti sul
POS solo quella cifra, non il totale.*

---

## 2. La regola che non si tocca

> *I ricavi restano i conti chiusi, unica fonte. Il pagamento misto
> ripartisce **lo stesso** incasso, non ne crea un secondo.*

`totale_conto()` **non è stata sfiorata**. Le quote si confrontano con
l'**incassato** — che per un conto scontato o omaggiato è
`collected_amount`, non il valore del conto: *un omaggio vale come il
piatto e incassa zero* (regola del 15/08).

Quel `coalesce(collected_amount, totale)` era **ricopiato in tre funzioni
della tesoreria**: è stato estratto in `incasso_conto()`.

---

## 3. Una sola fonte, non due

`order_payments` è il posto dove vive il come-è-stato-pagato.
`orders.payment_method` resta, ma diventa un **riflesso scritto solo da un
trigger**, mai dall'applicazione.

⚠️ È la stessa forma di `order_tables.conto_aperto` (14/08): una
proiezione che esiste perché serve a chi legge un conto, e che **nessuno
può far divergere dalla verità scrivendoci sopra**. Tenere due posti che
dicono il mezzo di pagamento sarebbe esattamente ciò che questo mandato
passa il tempo a togliere (regola 6 del mandato).

Per il caso misto serviva una parola nuova. Le due alternative erano
peggiori: **vuoto** vuol dire «non l'ho ancora detto», e un conto pagato
davanti a te non è un conto di cui non si sa niente; **il mezzo della
quota più grossa** è inventare una risposta a una domanda che ne ha due.

⚠️ **Due migrazioni e non una**: un valore aggiunto a un enum non è
usabile nella stessa migrazione che lo aggiunge (CLAUDE.md §6). La prima
aggiunge `misto` e **verifica che ci sia senza usarlo**; la seconda lo usa.

---

## 4. Il controllo che regge tutto

Le quote devono fare l'incassato **al centesimo** (un centesimo di
tolleranza, perché dividere per tre non dà un numero tondo).

Una divisione che non torna creerebbe un conto che dice 40 e ne registra
35: ⚠️ **i ricavi resterebbero giusti** — si leggono dal conto — **ma
cassa e banca non tornerebbero mai più, e la differenza non avrebbe
nessun posto dove comparire.** Il rifiuto è nel database, non nella
schermata, e **non lascia mezzo lavoro**: il conto resta aperto.

`conti_senza_quadratura()` mostra ciò che nessun vincolo può impedire: un
conto chiuso prima di oggi, o una quota tolta a mano dopo. Stessa forma di
`quadratura_pagamenti()` per le fatture.

---

## 5. Due errori miei, e chi li ha trovati

🔴 **Il primo l'ha trovato Postgres, non io.** Stavo riscrivendo
`saldo_tesoreria` e `pos_in_transito` partendo **dal file del 15/08**,
senza le tre colonne che la migrazione delle mance di stamattina
(`20260816000003`) ha aggiunto. **Avrei tolto le mance dal contante
atteso e dalla carta in arrivo, in silenzio.** Il tipo di ritorno non
combaciava e la migrazione si è fermata — ⚠️ **ma se avesse combaciato
sarebbe passata.** Rifatte leggendo la definizione vera dal database.

> *Una funzione si riscrive da com'è adesso, non da come l'avevo lasciata
> in un file.*

🔴 **Il secondo l'ha trovato la produzione.** La sanatoria che scrive la
quota ai conti già chiusi passa da `incasso_conto()` → `totale_conto()`,
che pretende un utente autenticato — e una migrazione gira come
`postgres`, dove `auth.uid()` è **nullo**. La migrazione si è fermata alla
prima riga vera.

⚠️ **Il progetto di prova non poteva accorgersene, ed è la parte che
conta: lì non c'è nessun conto chiuso**, quindi la `select` non valutava
mai `incasso_conto` e passava. In produzione ce n'è uno. È la **terza
ricomparsa** della stessa famiglia: *la prova non era falsa, era su uno
stato di partenza diverso da quello vero esattamente nel punto rilevante*
(12/08, 14/08, 15/08). Stavolta è stata la produzione a dirlo, non io a
prevederlo.

**Stato lasciato dal tentativo fallito**, letto col connettore e non
supposto: tabella `order_payments` creata e **vuota**, parola `misto`
nell'enum, `close_order_paid` con **la firma vecchia**, le due funzioni
della tesoreria **non toccate**, versione `…012` **non registrata**. Cioè
il gestionale si comportava esattamente come prima e la tabella nuova era
**inerte**: nessuno la scriveva e nessuno la leggeva. Niente da riparare a
mano, e riapplicare completa invece di rifare.

---

## 6. Cosa è stato verificato, e come

Dentro la migrazione, col ruolo vero del titolare:

| # | Controllo | Esito |
|---|---|---|
| 1 | Conto pagato in un modo solo → **una** quota, riflesso «contante» | sì |
| 2 | Conto da 50 diviso 30 contanti + 20 carta → **due** quote, riflesso «misto» | sì |
| 3 | **Il cassetto cresce di 30 e la carta di 20**, non di 50 e 0 | sì |
| 4 | Divisione che non fa il totale | **respinta**, e il conto resta **aperto** |
| 5 | `conti_senza_quadratura()` subito dopo la sanatoria | vuota |
| 6 | Tolte tutte le quote, il riflesso torna vuoto | sì |
| 7 | Il saldo torna dov'era dopo la pulizia | sì |

Il **controllo 3** è quello che vale più degli altri: prima del 16/08 un
conto misto sarebbe finito **tutto da una parte sola**, e il giorno
dell'accredito la banca avrebbe versato una cifra inattesa.

**Suite:** 20 pure + 114 sul progetto di prova, tutte verdi. Lint a zero,
build ok. **Idempotenza:** entrambe applicate due volte di fila sul
progetto di prova.

---

## 7. I numeri veri dell'applicazione in produzione

*(Sezione compilata subito dopo l'applicazione — vedi l'avvertenza in
testa a questo riepilogo.)*

| Migrazione | Quando |
|---|---|
| `20260816000011` | applicata durante il tentativo del Blocco 9, **prima** di questo riepilogo — è l'arretrato che la rete ha segnalato |
| `20260816000012` | applicata dopo questo riepilogo |

**DA COMPILARE dopo l'applicazione:** conti sanati (atteso: **1**, il
«Divano 3» del 15/08 chiuso in contante da 5,00), quote registrate,
migrazioni totali, e la verifica che `saldo_tesoreria` restituisca lo
stesso contante atteso di prima — perché la sanatoria non deve spostare
nessun saldo, solo cambiare da dove viene letto.

---

## 8. Cosa NON è verificato

- **Nessuno ha mai diviso un conto vero.** La schermata «Pagano in due
  modi» non è mai stata usata da una mano.
- ⚠️ **La sanatoria non è esercitata dalla suite né dal progetto di
  prova**, e non lo sarà: lì non ci sono conti chiusi. L'unica prova vera
  è l'applicazione in produzione, e il suo numero è in §7. **È il buco
  che ha causato il fallimento, e resta aperto per la prossima
  migrazione che tocchi i conti chiusi.**
- **La riconciliazione col POS non è provata contro niente**: i due
  parametri della banca (giorni di accredito, commissione) sono ancora
  vuoti, per decisione di Alessio, e finché lo sono l'importo è dichiarato
  lordo.
- **`conti_senza_quadratura()` non ha mai trovato niente**, quindi non è
  provato che sappia mostrare una riga: è provato solo che non ne inventa.
