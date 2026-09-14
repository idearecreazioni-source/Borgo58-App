# «Impegno» al posto di «task» — 11/09/2026 (mandato notturno 2, fase 3)

Solo testo rivolto all'utente. **Migrazioni**: nessuna. **Funzioni online**:
nessuna. **Database**: non toccato. **Logica**: non toccata.
**HEAD dichiarato**: vedi l'ultima riga.

---

## Cosa cambia

Nove frasi in quattro file, cercate con `\b[Tt]ask\b` su tutto `src/` e
tenute solo quelle che si leggono a schermo (i commenti restano come sono):

| file | prima | adesso |
|---|---|---|
| `src/pages/agenda/AgendaList.jsx` | «+ Nuovo task» | «+ Nuovo impegno» |
| `src/pages/agenda/AgendaList.jsx` | «Nessun task in questo giorno.» | «Nessun impegno in questo giorno.» |
| `src/pages/agenda/TaskForm.jsx` | «Nuovo task» / «Modifica task» | «Nuovo impegno» / «Modifica impegno» |
| `src/pages/agenda/TaskForm.jsx` | «Crea task» | «Crea impegno» |
| `src/pages/agenda/TaskForm.jsx` | «…non vede questo task in Agenda. La visibilità dei task automatici…» | «…non vede questo impegno in Agenda. La visibilità degli impegni automatici…» |
| `src/pages/Dashboard.jsx` | «Task di oggi» | «Impegni di oggi» |
| `src/pages/Dashboard.jsx` | «Nessun task con scadenza oggi.» | «Nessun impegno con scadenza oggi.» |
| `src/pages/Dashboard.jsx` | «+ Nuovo task» | «+ Nuovo impegno» |
| `src/data/modules.js` | «Task, priorità, calendario, adempimenti societari.» | «Impegni, priorità, calendario, adempimenti societari.» |

**Non toccati, apposta**: nomi di componenti e funzioni (`TaskForm`,
`listTasks`, `completaTask`…), tabella `tasks`, rotte, attributi `data-*`,
identificativi. E i messaggi che non vengono da questa applicazione (avvisi
Telegram, messaggi del database): stanno in funzioni online e migrazioni,
fuori dal perimetro del mandato — **non cercati qui**.

## Come è stato verificato

- Nessuna prova controllava queste frasi (cercato in `tests/`, `scripts/`,
  `src/`): niente da aggiornare.
- **Fusione di prova** (`git merge-tree`, niente scritto) con ciascuna PR
  aperta: **#57 nessun conflitto, #58 nessun conflitto, #59 nessun conflitto**
  — anche se #58 tocca `Dashboard.jsx` e `TaskForm.jsx` e #59 `AgendaList.jsx`,
  le righe cambiate qui non sono le loro.
- `npm run test:visive` (Agenda e scheda, con «+ Nuovo impegno» più lungo):
  **verde**.
- Lint pulito. Prove pure **1295/1297**: le due rosse sono `indice-richieste` e
  `indice-rovesciamenti`, fine riga di Windows, identiche sul master pulito
  (misurato stanotte per la #59).
- Prove sulle schermate **130/132**: le due rosse sono in `varco-pubblico` e
  hanno una causa sola — la prima supera i 5 secondi per aprire `/prenota`
  mentre il computer lavorava al censimento, e la seconda trova ancora la
  pagina della prima («Found multiple elements»). Rilanciata due volte sul
  master pulito nello stesso momento: una volta **3/3**, una volta **1 rossa
  per lo stesso tempo scaduto**. Nessun file toccato qui entra in quella pagina.

## Cosa NON è verificato

- Le frasi non sono state guardate su un iPhone vero.
- I testi fuori da questa applicazione (Telegram, messaggi del database) non
  sono stati cercati.

## Cosa abbiamo rovesciato

Niente: nessuna decisione diceva «task». La parola dell'elenco era già
«Impegno» (intestazione della colonna), e le frasi nuove si allineano a quella.

---

**Hash di HEAD dichiarato**: `43e438c` sul ramo `impegno-non-task`, cioè il
commit immediatamente sotto questo documento.
**Stato del working tree al momento della consegna**: pulito.
