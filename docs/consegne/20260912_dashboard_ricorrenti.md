# Dashboard: chiudendo un impegno ricorrente nasce il successivo — 12/09/2026

Sola interfaccia. **Migrazioni**: nessuna. **Funzioni online**: nessuna.
**Database**: né letto né scritto. **Ramo solo locale**
(`dashboard-ricorrenti`), mai spinto: dipende dalla **#58** (`23ca405`) e
porta sopra la prova della **#68** (`5a70bca`, `d080f3f`, copiati con
cherry-pick; né la #58 né la #68 sono toccate). **HEAD dichiarato**:
`a22241d`, il commit sotto questo riepilogo.

---

## La causa

La casella «Segna fatto» della Dashboard chiamava
`updateTask(id, { status: "completato" })`: un `PATCH` sulla tabella `tasks`
che cambia **una colonna**. L'impegno successivo di una ricorrenza lo crea
**solo** la funzione del database `completa_task`, che l'Agenda chiama
attraverso il corridoio (`completaTask` → `operazioni-atomiche`). Nessun
trigger su `tasks` crea righe (analisi della #68, §3). Quindi dalla Dashboard
il ricorrente si chiudeva e la ricorrenza restava scritta su una riga chiusa
che nessuno rileggeva più.

Verificato che è **l'unico** punto dell'app che chiude un impegno così: la
scheda dell'impegno (`TaskForm.jsx`) non ha più il campo dello stato, e
rimanda quello letto.

## I due percorsi, adesso

| | Dashboard | Agenda |
|---|---|---|
| gesto | casella «Segna fatto: …» | casella della riga |
| codice | `toggleComplete` → `chiudiImpegno` | `fatto` → `chiudiImpegno` |
| al database | `completaTask(id)` → `completa_task` | `completaTask(id)` → `completa_task` |
| la riga | sparisce subito, torna se fallisce | uguale |
| secondo tocco in volo | non parte | non parte (nuovo anche qui) |
| nato il successivo | «Fatto. Ne è già nato uno nuovo alla prossima scadenza.» | la stessa frase |
| dopo | niente da rileggere (il successivo cade dopo oggi, e la Dashboard mostra solo oggi e senza data) | rilegge l'elenco, come prima |

**Il comportamento è quello dell'Agenda**, perché è lo stesso codice: la
Dashboard manda l'identificativo e basta. Data, ora, promemoria, staff,
visibilità, descrizione, categoria, stella e ricorrenza del successivo li
decide solo `completa_task` (`20260910000001`, non toccata). Un impegno che
non si ripete si chiude dalla stessa strada, e `completa_task` non crea
niente.

## Richieste ripetute

- **Nella stessa schermata**: la guardia sincrona di `chiudiImpegno` non fa
  partire il secondo tocco sullo stesso impegno mentre il primo è in volo, e
  la casella sparisce al primo tocco.
- **Da due schermi**: `completa_task` blocca la riga (`for update`) e rifiuta
  un impegno già fatto («Questo impegno risulta già fatto»), quindi il
  successivo nasce una volta sola; sulla Dashboard la riga torna e il rifiuto
  si legge, come nell'Agenda.

## File modificati

- `src/lib/chiudiImpegno.js` (nuovo)
- `src/pages/Dashboard.jsx`
- `src/pages/agenda/AgendaList.jsx`
- `tests/schermate/dashboard-spunta-ricorrente.test.jsx` (dalla #68)
- `tests/unita/chiudi-impegno.test.js` (nuovo)

## Come è stato verificato

- **La prova della #68**: il caso `it.fails` diventa `it`, la «fotografia di
  oggi» è tolta come la #68 chiedeva. Aggiunti: ricorrenza giornaliera,
  settimanale e mensile (una chiamata a `completaTask` col **solo**
  identificativo, `updateTask` mai, riga tolta, frase dell'Agenda), non
  ricorrente (stessa strada, nessuna frase), doppio tocco, richiesta
  respinta. **7 rossi sul codice di prima** (`c9cbea3`, in una copia
  temporanea già tolta), **7 verdi** dopo.
- **`chiudi-impegno.test.js`**, 5 casi. **Controprova**: tolta la guardia, il
  caso del secondo tocco diventa rosso; rimesso il file identico.
- Tutte le prove sulle schermate **166 verdi** (con 30 s alle due schede lente
  già note), prove pure **1338 verdi** (2 rosse già rosse sul ramo di
  partenza: gli indici di richieste e rovesciamenti), lint zero avvisi,
  compilazione riuscita. Nessuna prova usa il database.
- Revisione del diff: vedi il messaggio del commit `a22241d`.

## Cosa NON è verificato

- ⚠️ **Il caso «doppio tocco» della Dashboard non prova la guardia**: in
  questo ambiente di prova il secondo click sulla stessa casella non arriva
  al codice (misurato: senza guardia restava verde). Prova che la casella
  sparisce prima della risposta; la guardia la prova la prova pura.
- **Il database**: che `completa_task` crei il successivo alla data giusta
  per giorni, settimane, mesi e anni lo prova già
  `tests/app/agenda-ricorrenza.test.js`, **non lanciata** qui perché scrive
  sul progetto di prova. Va lanciata dopo un'autorizzazione.
- Nessuna spunta premuta su un gestionale vero, né su un iPhone.
- **Difetto preesistente, non toccato**: se il salvataggio fallisce, il
  messaggio di `togliSubito` nomina «la riga» invece del titolo
  dell'impegno (cerca `titolo`, gli impegni hanno `title`). Uguale
  nell'Agenda da prima.

## Cosa abbiamo rovesciato

Nessun rovesciamento in questo giro.
