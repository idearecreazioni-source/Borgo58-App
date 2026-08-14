# Consegna del 14/08/2026 (sedicesima) — il tavolo che non si poteva togliere

**Commit della consegna: `b8e83af`** (questo riepilogo è il commit
immediatamente sopra, sola documentazione). Working tree pulito.

| Commit | Cosa |
|---|---|
| `b8e83af` | un tavolo aperto per sbaglio non si poteva togliere in nessun modo |

**Nessuna migrazione.** Produzione invariata: **97 migrazioni**, corridoio
**v20**, elenco anonimi **12**. Solo schermata.

---

## 1. Il difetto

> *«non trovo il tasto annulla per togliere il tavolo occupato»*

Non lo trovava perché **non c'era**.

«Annulla tavolo» esisteva dal 09/08, ma viveva **dentro la finestra di
chiusura conto** — che si apre dal pulsante «Chiudi conto», ed è
`disabled` finché non è stato inviato niente in cucina.

⚠️ **Spegnere quel pulsante è giusto**: non si incassa un conto su cui non
è stato ordinato nulla. **Ma dietro c'era anche l'unica via per
annullare.** Risultato: un tavolo aperto e mai usato restava aperto per
sempre, e non c'era nessuna strada — né una scorciatoia, né un giro
lungo — per toglierlo dall'interfaccia.

Nessun errore, nessun avviso: solo una porta che non esiste.

### ⚠️ Perché era latente e oggi non lo è più

Il difetto c'era da giorni, **ma prima un conto fantasma era solo un
pallino sulla griglia dei tavoli**: fastidioso, non bloccante.

Dal 14/08 quel conto **tiene occupati i suoi tavoli** e impedisce di
riaprirli — è l'invariante nuovo del blocco Sala, che funziona
esattamente come deve. Nel caso di Alessio erano **tre**: T7, T8 e T9,
bloccati da un conto vuoto aperto la mattina per il collaudo.

**È la forma di difetto più insidiosa di questa serie**: un lavoro
corretto che alza il costo di un difetto vecchio, senza toccarlo.

---

## 2. La correzione, e la regola che ne esce

Quando non è stato inviato niente, sotto le azioni compare **«Annulla il
tavolo (non è stato ordinato niente)»**.

Chiede conferma dicendo **cosa non si butta via** — nessun ordine è
partito — e **registra il motivo da solo** (`aperto per sbaglio, nessun
ordine inviato`): chiedere di scrivere perché si è toccato un tavolo per
sbaglio è attrito su un gesto già esplicito. La finestra di chiusura,
dove il motivo è obbligatorio, resta com'era per i conti veri.

**La regola generale, ed è il motivo per cui vale un commit suo:**

> Quando un pulsante si spegne, va guardato **cosa resta raggiungibile da
> lì**. Spegnere un comando non deve chiudere l'unica porta che c'era
> dietro.

---

## 3. Verifica

| Cosa | Stato |
|---|---|
| lint, build | puliti |
| prove automatiche | **55 verdi**, invariate |
| modifiche al database | **nessuna** |
| **produzione** | **97 migrazioni**, invariata |
| file toccati | `src/pages/comande/Sala.jsx`, questo riepilogo |

**Stato letto dal connettore prima di correggere**: 1 conto `aperto` su
«T7 · T8 · T9», **0 coperti e 0 righe** — cioè esattamente il caso che non
aveva via d'uscita. Le 4 prenotazioni di prova risultano **tutte
`annullata`** e senza tavoli assegnati: Alessio ha usato «Ha disdetto», e
ha funzionato.

---

## 4. Cosa NON è verificato, e lo dico chiaro

- **Il pulsante nuovo non è stato premuto.** Come per le tre consegne
  precedenti, **nessuna prova automatica copre questa schermata**: le 55
  verdi guardano il database.
- ⚠️ **Il conto fantasma su T7·T8·T9 è ancora aperto in produzione** nel
  momento in cui scrivo: si toglie con questo pulsante, dopo il push.
- **Non ho cercato altri vicoli ciechi dello stesso tipo.** La regola del
  §2 vale per tutte le schermate del gestionale, e questo difetto è stato
  trovato usando, non cercando: è ragionevole pensare che non sia
  l'unico. Dichiarato, non fatto.
