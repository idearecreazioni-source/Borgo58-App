# Un dato non letto non si mostra vuoto — 11/09/2026 (mandato notturno 2, fase 2)

Sola interfaccia. **Migrazioni**: nessuna. **Funzioni online**: nessuna.
**Database**: non toccato. **HEAD dichiarato**: vedi l'ultima riga.

Trovati dal censimento dei testi del mandato notturno 2 (lettura di tutte le
schermate) e **verificati sul codice di master** prima di correggerli.

---

## Cosa cambia

**1. Gli allergeni di un piatto** (`src/components/AllergeniDelPiatto.jsx`)
- 🔴 Se la lettura falliva, `ricarica()` faceva `setRighe([])`, e la schermata
  scriveva **«Nessun allergene risulta dagli ingredienti di questo piatto»**
  — il contrario del commento scritto tre righe sopra (*«"Non lo so" non è
  "non ce ne sono"… la frase più pericolosa che questo gestionale possa
  scrivere»*), sulla scheda che si apre quando un cliente chiede di
  un'allergia.
- Ora le righe prendono il segno `NON_LETTO` (lo stesso di tutto il
  gestionale, `calcoli/letture.js`) e al posto dell'elenco compare
  `DatoNonLetto`: «Non riesco a leggere gli allergeni di questo piatto. Non
  vuol dire che non ne ha: vuol dire che non lo so.» con **Riprova**.
- Il messaggio tecnico della lettura fallita non viene più stampato sopra il
  blocco: la riga lo dice già in italiano.

**2. La riga «non riesco a leggere»** (`src/components/DatoNonLetto.jsx`,
`src/lib/calcoli/letture.js`)
- La **forma breve** (senza Riprova) **ignorava** la frase della schermata
  (`nonVuolDire`): TemperatureLog, PuliziaESanificazione e ArchivioDocumenti
  la passavano senza nessun effetto.
- La **forma lunga** la stampava così com'era, e la scheda di un documento
  passa un pezzo di frase: a schermo usciva da sola la riga «che questo
  documento non abbia una sezione».
- Nuova `fraseNonVuolDire(nonVuolDire, predefinita)`: un pezzo che comincia
  con «che» diventa «Non vuol dire che …: vuol dire che non lo so.», una
  frase intera resta com'è, senza frase vale quella di sempre. Nessuna
  schermata chiamante toccata (ArchivioDocumentiHome è un file della #57:
  così non serve cambiarlo).

## Come è stato verificato

- `tests/unita/non-vuol-dire.test.js` (3) e `tests/schermate/dati-non-letti.test.jsx`
  (6): allergeni che falliscono → la riga con Riprova, e riprovando l'elenco
  vero; allergeni letti e vuoti → la frase di sempre; le due forme con frase
  intera e con pezzo di frase.
- **Rottura**: rimessi i tre file di master e rilanciate le prove → **3 pure e
  3 sulle schermate rosse**, esattamente quelle dei difetti (le 3 che restano
  verdi sono i casi che non cambiano). Rimessi i file del commit: verdi.
- **Fusione di prova** (`git merge-tree`, niente scritto) con #57, #58, #59 e
  #60: **nessun conflitto**.
- Lint pulito, compilazione riuscita. Prove pure **1298/1300**: le due rosse
  sono `indice-richieste` e `indice-rovesciamenti` (fine riga di Windows,
  identiche sul master pulito). Prove sulle schermate **136/138**: le due
  rosse sono `varco-pubblico`, tempo scaduto di 5 secondi su `/prenota` con
  il computer occupato dal censimento — la stessa cosa misurata sul master
  pulito nello stesso momento.

## Cosa NON è verificato

- Nessuna fotografia: la riga compare solo quando una lettura fallisce, e il
  censimento visivo apre le schermate con le letture che riescono.
- Non visto su un iPhone vero.

## Cosa abbiamo rovesciato

Niente. Si applica una regola già scritta (§6, *«non vuol dire che è vuota:
vuol dire che non lo so»*) in due punti che la violavano.

---

**Hash di HEAD dichiarato**: `b0fae82` sul ramo `dato-non-letto`, cioè il
commit immediatamente sotto questo documento.
**Stato del working tree al momento della consegna**: pulito.
