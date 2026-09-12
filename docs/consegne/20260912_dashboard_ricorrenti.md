# Dashboard: chiudendo un impegno ricorrente nasce il successivo — 12/09/2026

Sola interfaccia. **Migrazioni**: nessuna. **Funzioni online**: nessuna.
**Database**: né letto né scritto. **Ramo solo locale**
(`dashboard-ricorrenti`), mai spinto: dipende dalla **#58** (`23ca405`) e
porta sopra la prova della **#68** (`5a70bca`, `d080f3f`, copiati con
cherry-pick; né la #58 né la #68 sono toccate). **HEAD dichiarato**:
`5e50bdf`, il commit sotto questo riepilogo.

⚠️ **Seconda stesura.** La prima (HEAD `a22241d`) lasciava due cose aperte,
che Alessio ha chiuso il 12/09: ha autorizzato la prova sul database di prova
(sezione «Verifica sul database di prova») e ha chiesto che il messaggio
d'errore nomini l'impegno (`4a6cc43`).

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

## Il messaggio d'errore

Se il salvataggio fallisce, il messaggio ora nomina l'impegno: ««Versare
l'IVA del trimestre» non si è salvato: … È tornato com'era.», in Agenda e in
Dashboard. `messaggio()` in `tocco.js` cercava `articolo`, `titolo` e
`nome`, e gli impegni si chiamano `title`: diceva «la riga». Ora cerca anche
`title`, dopo gli altri tre, quindi le liste che già funzionavano non
cambiano (`4a6cc43`).

## Verifica sul database di prova (autorizzata da Alessio il 12/09)

`npm run test:app -- tests/app/agenda-ricorrenza.test.js`, dal comando
ufficiale (lucchetto condiviso e tetto di tempo), sul progetto di prova
`bnwqgpuyzmzujxfbtyvs`, solo impegni finti col marchio della prova. Tre giri,
**8 prove su 8 verdi in tutti e tre**. Nel terzo la prova ha scritto le date
in un file (`B58_DATE_RICORRENZA`, `5e50bdf`), marchio `TEST-AUTO
ricorrenza#6f038vg`, partenza 01/03/2026:

| cadenza | attesa | ottenuta |
|---|---|---|
| ogni 10 giorni | 11/03/2026 | 11/03/2026 |
| ogni 2 settimane | 15/03/2026 | 15/03/2026 |
| ogni 3 mesi | 01/06/2026 | 01/06/2026 |
| ogni 1 anno | 01/03/2027 | 01/03/2027 |
| ogni 1 anno, chiuso in ritardo | 01/03/2027 | 01/03/2027 |

⚠️ Le cadenze usano numeri diversi da 1 **apposta** (scelta della prova,
10/09): con «ogni 1» su tutte, scambiare giorni e settimane darebbe date
vicine e la prova passerebbe senza aver misurato niente.

**Pulizia, contata e non dedotta**: prima di ogni giro e dopo, una lettura in
sola lettura come utente di prova titolare ha contato gli impegni col titolo
«TEST-AUTO ricorrenza…» sul progetto di prova: **0 prima e 0 dopo** in tutti
e tre i giri, e **0** col marchio del terzo giro. La tabella degli impegni è
fuori dal registro delle cancellazioni per scelta, quindi la pulizia non
lascia tracce. Il lucchetto delle prove è stato rilasciato.

## File modificati

- `src/lib/chiudiImpegno.js` (nuovo)
- `src/lib/calcoli/tocco.js` (il messaggio)
- `src/pages/Dashboard.jsx`
- `src/pages/agenda/AgendaList.jsx`
- `tests/schermate/dashboard-spunta-ricorrente.test.jsx` (dalla #68)
- `tests/schermate/agenda-fatto-ricorrente.test.jsx` (nuovo)
- `tests/unita/chiudi-impegno.test.js` (nuovo)
- `tests/unita/tocco.test.js`
- `tests/app/agenda-ricorrenza.test.js` (scrive le date)

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
- Tutte le prove sulle schermate **168 verdi** (con 30 s alle due schede lente
  già note), prove pure **1340 verdi** (2 rosse già rosse sul ramo di
  partenza: gli indici di richieste e rovesciamenti), lint zero avvisi,
  compilazione riuscita. Nessuna di queste usa il database; quella che lo
  usa è nella sezione sopra.
- Revisione del diff: vedi il messaggio del commit `a22241d`.

## Cosa NON è verificato

- ⚠️ **Il caso «doppio tocco» della Dashboard non prova la guardia**: in
  questo ambiente di prova il secondo click sulla stessa casella non arriva
  al codice (misurato: senza guardia restava verde). Prova che la casella
  sparisce prima della risposta; la guardia la prova la prova pura.
- La prova sul database chiama `completa_task` direttamente, come utente
  titolare: prova la regola del database, non il percorso dalla Dashboard.
  Il percorso della Dashboard è provato fino alla chiamata (`completaTask`
  col solo identificativo); nessuna spunta è stata premuta su un gestionale
  vero, né su un iPhone.
- Perché le stampe delle prove non arrivino al registro di `npm run
  test:app` non l'ho capito: l'ho aggirato scrivendo le date in un file.

## Cosa abbiamo rovesciato

Nessun rovesciamento in questo giro.
