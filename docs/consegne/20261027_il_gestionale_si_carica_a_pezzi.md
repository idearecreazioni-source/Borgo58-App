# Il gestionale si carica a pezzi — 27/10/2026 (notte)

**HEAD dichiarato sotto questo riepilogo:** `883319c`, sul ramo `claude/gestionale-piu-veloce` aperto da `origin/slave` `eeb08ba`. Due commit: `abd384a` (caricamento a pezzi e lettura solo se visibile) e `883319c` (schermata che non arriva). Working tree pulito. **Nessuna migrazione, nessuna funzione online, nessun dato toccato.**

## Origine
Verifica di performance del 25/10 (voci P1.1 e P1.3 del piano), lavoro notturno autorizzato da Alessio il 26/10.

## Cosa cambia
- **`src/App.jsx`:** le 95 schermate arrivano con `React.lazy` quando si aprono. Partono subito solo Login, Dashboard e la cornice.
- **`src/components/Layout.jsx`:** menu e intestazione restano fermi mentre arriva il pezzo della schermata (Suspense attorno all'Outlet).
- **`src/components/Caricamento.jsx`:** la scritta «Caricamento…» mentre il pezzo arriva.
- **`src/components/PezzoMancante.jsx`:** se un pezzo non arriva (per esempio un tablet aperto da prima di un aggiornamento), al posto dello schermo bianco c'è la spiegazione e il pulsante «Aggiorna». Non ricarica da solo, come vuole la regola di `src/lib/versione.js`.
- **`src/lib/ogniTanto.js`, usata da Bar e Cucina:** rileggono gli ordini solo mentre la pagina si vede, e subito quando torna visibile.

## Verificato
- **Build:**
  - pezzo principale da 1.287 kB a 58 kB;
  - all'avvio, 26 file per 544 kB, cioè 163 kB compressi contro i circa 430 misurati il 25/10.
- **Prove:**
  - `npx oxlint`: zero avvisi;
  - prove pure verdi, salvo le 3 già note per gli a capo CRLF;
  - prove di schermata: 448 verdi più 2 nuove (`pezzo-mancante`);
  - 3 prove pure nuove (`ogni-tanto`).
- **Nel browser:** la build servita in locale apre la pagina di accesso senza errori in console.
- **Revisione `ecc:react-reviewer`:**
  - controllato: tutte le pagine hanno l'export di default, nessun import fisso annulla la divisione, guardie e StrictMode a posto;
  - il rilievo medio (schermo bianco se un pezzo non arriva) è risolto da `PezzoMancante`.

## Non verificato
- Le schermate dopo l'accesso, aperte una per una con il caricamento a pezzi. Le coprono le prove della CI, ma non le ho aperte a mano: vanno guardate sull'anteprima di prova.
- Il tempo vero di apertura su un telefono.

## Dato per fatto senza misurarlo
- Nulla.

## Affermazioni diventate false durante il lavoro
- Avevo aggiunto una ricarica automatica quando un pezzo non arriva. L'ho tolta prima del commit, perché contraddiceva la regola «il gestionale avvisa, non ricarica».

## Cosa abbiamo rovesciato
Nessuna decisione rovesciata. La regola di `versione.js` («quando esce una versione nuova il gestionale lo dice, non ricarica mai da solo») resta intera: anche `PezzoMancante` si limita a dirlo.
