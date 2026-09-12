# Agenda, settimana: gli impegni di un giorno si separano — 12/09/2026 (mandato notturno, blocco B)

Sola interfaccia. **Migrazioni**: nessuna. **Funzioni online**: nessuna.
**Database**: né letto né scritto. **Dipende dalla #59** (`agenda-settimana`,
`e8e57bc`) e non la modifica. **HEAD dichiarato**: `5c8e192`, il commit sotto
questo riepilogo.

---

## Cosa cambia

Nella vista Settimana, dentro un giorno, sopra ogni impegno tranne il primo c'è
una linea orizzontale leggera (`border-t`, grigio carbone all'8%, più chiara
della linea fra i giorni che è al 10%): mai prima del primo, mai dopo
l'ultimo. Ogni riga porta `data-separato`. Ora e titolo restano nello stesso
pulsante. Tolto lo spazio fra le righe (`space-y-0.5`): la linea non aggiunge
altezza, l'elenco resta compatto e senza riquadri per impegno. Un file solo:
`src/pages/agenda/SettimanaAgenda.jsx`.

## Come è stato verificato

- `tests/schermate/agenda-settimana.test.jsx`, un caso nuovo: **rosso sul
  codice della #59** (`[false,false,false]` invece di `[false,true,true]`),
  verde dopo. Controlla anche che dopo l'ultimo non venga niente, che ora e
  titolo stiano nel pulsante, che un giorno con un impegno non abbia linee e
  uno vuoto non abbia elenco.
- Prove sulle schermate 142 (tre scadenze a 5 s sotto carico in due file che
  non c'entrano, verdi rilanciati da soli), prove pure 1310 (2 rosse già
  rosse sul ramo di partenza: gli indici di richieste e rovesciamenti), lint
  zero.
- **Prova visiva senza nessun server**, dati finti (un giorno con 5 impegni con
  e senza ora, fatti e da fare, un titolo lungo; uno con 2; uno con 1; giorni
  vuoti; la settimana dopo tutta vuota), sul codice della #59 («prima») e su
  questo («dopo»), a iPhone 390, iPhone 440, iPhone 390 a 64 punti per cm,
  computer 1280 (a righe) e 1600 (sette colonne):

  | | linee (5 · 2 · 1 impegni) | altezze degli impegni |
  |---|---|---|
  | prima | `00000` · `00` · `0` | 38/32/32/32/32 a 390 |
  | dopo | `01111` · `01` · `0` | **identiche** in tutte le forme |

  Nessuna sovrapposizione, niente fuori dal riquadro, sbordo zero ovunque.

## Cosa NON è verificato

- Safari su un iPhone vero (la prova è Chrome), e se la linea all'8% si vede
  con la luce del locale: è un giudizio, non una misura.
- Il Mese: il mandato chiede la Settimana, e l'elenco del giorno scelto nel
  Mese è un'altra parte della schermata. Non toccato.

## Cosa abbiamo rovesciato

Nessun rovesciamento in questo giro.
