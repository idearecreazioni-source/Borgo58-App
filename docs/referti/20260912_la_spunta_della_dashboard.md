# La spunta della Dashboard e gli impegni ricorrenti — analisi, 12/09/2026

Mandato esteso del 12/09, priorità 2. **Qui non si corregge niente**: la
Dashboard è toccata dalla PR #58, ancora aperta. Questo referto dice dove
sta il difetto, come lo si fa vedere e da dove partirà la correzione.
Tutto è stato letto sul codice o chiesto al database **in sola lettura**.

---

## 1. Il difetto, in una riga

Spuntato dalla **Dashboard**, un impegno che si ripete si chiude e **non
nasce il successivo**. Spuntato dall'**Agenda**, il successivo nasce.

## 2. I due percorsi, fianco a fianco

| | Dashboard | Agenda |
|---|---|---|
| gesto | casella «Segna fatto: …» in «Task di oggi» / «Senza scadenza» | casella della riga, o «fatto» |
| codice | `src/pages/Dashboard.jsx:111-118`, `toggleComplete` | `src/pages/agenda/AgendaList.jsx:337-352`, `fatto` |
| chiamata | `updateTask(task.id, { status: "completato" })` (`src/lib/api/tasks.js:125`) | `completaTask(task.id)` (`src/lib/api/tasks.js:35`) |
| cosa arriva al database | un `PATCH` di PostgREST sulla tabella `tasks`: cambia **una colonna** | `eseguiOperazione("completa_task")` → corridoio `operazioni-atomiche` → funzione `completa_task(p_id)` |
| il successivo di una ricorrenza | **non nasce** | nasce, con `generato_da` = l'impegno chiuso |
| dopo | toglie la riga dall'elenco, niente altro | «Fatto. Ne è già nato uno nuovo alla prossima scadenza.» e rilettura |

## 3. Perché la Dashboard non lo genera — dove sta esattamente

- **Il successivo lo crea solo `completa_task`.** Corpo vivo letto in
  produzione il 12/09 (identico all'ultima definizione nel repository,
  `supabase/migrations/20260910000001_una_ricorrenza_si_dice_a_parole_sue.sql`,
  righe 149-200): segna `completato`, e **se `ricorrenza_ogni` non è vuoto**
  calcola la data dalla scadenza (`due_date` + N giorni/settimane/mesi/anni)
  e fa `insert into tasks (…, generato_da) values (…, p_id)`.
- **Nessun trigger lo fa al posto suo.** I trigger su `tasks` in produzione
  (catalogo, 12/09) sono tre, e nessuno crea righe:
  `trg_categoria_task` (normalizza la categoria), `trg_task_visibility`
  (visibilità allo staff), `trg_tasks_updated_at` (data di modifica).
- Quindi il `PATCH` della Dashboard **cambia lo stato e basta**: la
  ricorrenza resta scritta sulla riga chiusa e nessuno la rilegge più.
- **Non è una differenza di permessi.** La policy `tasks_update_visible`
  lascia modificare a titolare e staff gli impegni visibili allo staff;
  `completa_task` controlla la stessa cosa (`is_titolare() or
  visibile_staff`). Chi oggi spunta dalla Dashboard potrà spuntare anche
  dopo la correzione.
- **Una differenza in più**: `completa_task` rifiuta un impegno già fatto
  («Questo impegno risulta già fatto»). Il `PATCH` no.

## 4. Quanto ha già morso

In produzione, il 12/09 (conteggi, nessun titolo): **0** impegni con una
ricorrenza, **0** chiusi senza successore, **0** nati da una ricorrenza.
Oggi il difetto **non ha fatto danni**: morderà al primo ricorrente vero.

## 5. La prova che la correzione dovrà far diventare verde

`tests/schermate/dashboard-spunta-ricorrente.test.jsx`, letture finte,
nessun database.

- **Caso 1, `it.fails`** — «passa da `completaTask`, come l'Agenda, e non
  scrive lo stato a mano». È scritto come **deve** essere e oggi fallisce.
  `it.fails` lo segna «rosso atteso», così i controlli restano verdi; il
  giorno della correzione il caso passa, `it.fails` diventa rosso e obbliga
  a trasformarlo in `it`.
- **Caso 2, `it`** — la fotografia di oggi: `updateTask("t1", { status:
  "completato" })`, e `completaTask` mai chiamata. Diventa rosso con la
  correzione, e va tolto insieme.

Fatta girare:

| base | esito |
|---|---|
| master `59f4d2d` | 1 verde, 1 rosso atteso |
| master, col caso 1 scritto `it` invece di `it.fails` | **rosso**: `expected "vi.fn()" to be called with arguments: [ 't1' ]` |
| base locale #58 (`23ca405`) + #60 (`e7bd4c0`), fusa solo in locale e mai pubblicata | 1 verde, 1 rosso atteso |

La prova finge anche le letture che la Dashboard della #58 aggiunge (gli
appunti da approvare), apposta per girare su quella base.

## 6. Da dove partirà la correzione

- **File**: solo `src/pages/Dashboard.jsx`, funzione `toggleComplete`, più
  la prova qui sopra.
- **Base**: `master` **dopo l'unione della #58** (testa di oggi `23ca405`).
  La #58 cambia `Dashboard.jsx` ma **non** `toggleComplete` (righe 111-118
  identiche). La #60 (`e7bd4c0`) cambia nello stesso file solo tre frasi
  (righe 329-353): se viene unita prima o dopo non cambia la correzione.
- **Forma proposta**, da decidere nel mandato della correzione:
  1. `toggleComplete` chiama `completaTask(task.id)` al posto di
     `updateTask(…)`, e toglie la riga come oggi;
  2. se `completaTask` restituisce l'identificativo del successivo, la
     Dashboard lo dice con la stessa frase dell'Agenda — il successivo
     cade sempre dopo oggi, quindi in Dashboard non si vedrebbe;
  3. la prova: `it.fails` → `it`, il caso 2 si toglie.
- **Da non fare**: toccare `completa_task` o i trigger. La regola è già
  giusta, e sta in un posto solo; è la Dashboard che la scavalca.

## 7. Cosa NON è verificato

- La prova guarda **quale funzione** chiama la Dashboard, non il database:
  che `completa_task` crei davvero il successivo lo dicono il suo corpo e le
  prove contro il progetto di prova già esistenti, non lanciate qui (il
  mandato vieta di scrivere anche sul progetto di prova).
- Nessuna spunta è stata premuta su un gestionale vero.
