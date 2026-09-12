# La spunta della Dashboard e i ricorrenti: analisi e prova — 12/09/2026 (mandato esteso, priorità 2)

**Nessuna correzione**, per mandato: la Dashboard è toccata dalla PR #58,
aperta. **Migrazioni**: nessuna. **Funzioni online**: nessuna. **Codice
dell'app**: non toccato. **Database**: solo letture. **HEAD dichiarato**:
vedi l'ultima riga.

---

## Cosa c'è

- `docs/referti/20260912_la_spunta_della_dashboard.md`: i due percorsi a
  confronto, il punto esatto in cui il successivo non nasce, la prova e da
  dove partirà la correzione.
- `tests/schermate/dashboard-spunta-ricorrente.test.jsx`: la prova che la
  correzione dovrà far diventare verde.

In breve:
- la Dashboard chiude con `updateTask(id, { status: "completato" })`
  (`src/pages/Dashboard.jsx:113`), cioè un `PATCH` su `tasks`;
- l'Agenda chiude con `completaTask(id)`, cioè `completa_task` dal
  corridoio, che è **l'unico** posto che crea il successivo;
- i tre trigger di `tasks` in produzione non lo creano (catalogo, 12/09);
- permessi uguali per le due strade (`tasks_update_visible` e il controllo
  dentro `completa_task`);
- in produzione, il 12/09: **zero** impegni con una ricorrenza, quindi
  nessun danno finora.

## Come è stato verificato

- Prova su master: **1 verde, 1 rosso atteso** (`it.fails`). Con il caso
  scritto `it`, è **rossa per la ragione giusta**: `expected "vi.fn()" to
  be called with arguments: [ 't1' ]` — `completaTask` non viene chiamata.
- La stessa prova su una base **solo locale** fatta di #58 (`23ca405`) e
  #60 (`e7bd4c0`), mai pubblicata: **1 verde, 1 rosso atteso**. È la base
  da cui partirà la correzione.
- `npm run lint` pulito.
- Prove sulle schermate, giro completo: **130 verdi, 1 rosso atteso, 3
  rosse**. Le 3 rosse sono i tempi scaduti già noti su questo computer
  (`rotte-chiuse` «da /cassa», `varco-pubblico` due casi), rosse anche su
  master nel mandato precedente. Rilanciate da sole insieme alla prova
  nuova: **13 verdi e 1 rosso atteso su 3 file**.
- Prove pure e compilazione non rilanciate: il ramo non tocca codice
  dell'app.
- `git merge-tree` con i rami di #57, #58, #59, #60, #61, #62, #63, #64,
  #65, #66 e con `allergeni-frase-vera` (#67): nessun conflitto.

## Cosa NON è verificato

- La prova guarda quale funzione chiama la Dashboard, non il database.
  Le prove contro il progetto di prova non sono state lanciate: il mandato
  vieta di scrivere anche lì.
- Nessuna spunta premuta su un gestionale vero.

## Cosa abbiamo rovesciato

Niente.

---

**Hash di HEAD dichiarato**: `5a70bca` sul ramo `analisi-spunta-dashboard`,
cioè il commit immediatamente sotto questo documento.
**Stato del working tree al momento della consegna**: pulito (la cartella
della prova visiva locale è esclusa da git e non è committata).
