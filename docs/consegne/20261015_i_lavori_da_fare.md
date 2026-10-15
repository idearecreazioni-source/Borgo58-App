# I lavori da fare: una sezione nuova dell'Agenda

**15/10/2026.** Riepilogo per il validatore. Ramo
`claude/project-thread-rlxwt1` → `slave`.

* **HEAD del codice coperto da questo riepilogo**: `40a7d1f`. Questo documento
  è il commit sopra, ed è sola documentazione.
* **Working tree**: pulito dopo questo commit.
* **Controlli locali** su `40a7d1f`: `oxlint --max-warnings=0` pulito,
  `npm run test` **2236 prove pure verdi** (142 file), `npm run build` riuscita.
  Le prove contro il progetto di prova **non** sono state lanciate da qui
  (questa sessione non ha le chiavi del progetto di prova).

## 1 · Migrazioni (versioni per intero)

| versione | cosa | Prova | Produzione |
|---|---|---|---|
| `20261015000001` | `categoria_task()` riconosce `lavori`; il vincolo `categoria_chiusa` lo ammette, con `comment on constraint` | **da applicare** | da applicare |

I due corpi sono stati letti dalla **produzione** il 15/10 (connettore in sola
lettura), che era allineata al repository: ultima migrazione registrata
`20261012000001`, la stessa dell'ultimo file. Permessi ripresi da `proacl`
(`categoria_task`: nessun client).

## 2 · Funzioni online

Nessuna.

## 3 · Cosa c'è dentro

* **Nessuna tabella nuova**: un lavoro è un impegno con `category = 'lavori'`.
  Spunta, «rimanda», ricorrenza e promemoria sono quelli dell'Agenda.
  `completa_task` copia già la categoria sul successivo di un ricorrente
  (letto dal corpo vivo), quindi un lavoro che torna resta un lavoro.
* **`sezioneDi`** (`src/lib/calcoli/agenda.js`): stella → «Per me conta»;
  altrimenti `lavori` → «Lavori da fare»; altrimenti la corsia. Una riga sta
  in una sezione sola. La sezione si vede anche vuota.
* **Il badge non cambia** (`daFareAdesso` guarda la corsia): un lavoro scaduto
  continua a contare.
* **La scheda** (`TaskForm.jsx`): casella «È un lavoro da fare». Togliendola
  torna la categoria con cui l'impegno era arrivato, non «altro».
* **`TASK_CATEGORIES`** ha `lavori` → «Lavori da fare», perché la rete dei
  vocabolari confronta l'elenco col vincolo.

## 4 · Cosa si è visto

* Tre prove pure nuove in `tests/unita/agenda-sezioni.test.js`; la prima è sul
  caso che discrimina (un lavoro **in ritardo**). Rotta apposta togliendo il
  ramo `lavori` da `sezioneDi`: **1 rossa, quella giusta**; rimesso, 21 verdi.

## 5 · Cosa NON è verificato

* **La migrazione non è stata applicata da nessuna parte**, nemmeno sulla
  prova: il suo blocco di verifica non ha mai girato.
* **Finché non è applicata sulla prova**, la prova sui vocabolari contro il
  progetto di prova (`tests/app/vocabolari.test.js`) diventerà rossa — la
  costante ha un valore che il vincolo non ha ancora — e salvare un impegno
  con la casella spuntata verrebbe respinto dal vincolo.
* **La schermata non è stata aperta**: né l'elenco con la sezione nuova, né la
  casella nella scheda, né sul telefono.

## 6 · Cosa abbiamo rovesciato

* **n. 102** — la categoria di un impegno torna sceglibile nel modulo, **una
  sola** e con una casella (decisione del 10/09/2026). Ragione di allora
  ancora valida: il menu non torna. Dettaglio in
  [`docs/decisioni_rovesciate.md`](../decisioni_rovesciate.md).

## 7 · Applicazione in produzione

Da fare dopo l'unione su `master`: prima `npm run prova:migra`, poi
`npm run migra -- --conferma`.
