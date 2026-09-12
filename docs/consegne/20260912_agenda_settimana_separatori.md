# Agenda, settimana: gli impegni di un giorno si separano — 12/09/2026 (mandato notturno, blocco B)

Sola interfaccia. **Migrazioni**: nessuna. **Funzioni online**: nessuna.
**Database**: né letto né scritto. **Dipende dalla #59** (`agenda-settimana`,
`e8e57bc`) e non la modifica. **Ramo solo locale**, mai spinto. **HEAD
dichiarato**: `48388ca`, il commit sotto questo riepilogo.

⚠️ **Terza stesura, dal terzo collaudo sull'iPhone (12/09)**: al 15% la linea
fra impegni non si distingueva da quella fra giorni (10%). Adesso è al **30%**
(`48388ca`); lunghezze, spessore e spazi sono quelli della seconda stesura. E la
prova non guarda più l'opacità scritta nel codice: **misura il contrasto che si
vede**, sovrapponendo il colore di ogni linea allo sfondo che ha davvero sotto.

| stato | contrasto fra impegni | contrasto fra giorni | quante volte si stacca di più | esito |
|---|---|---|---|---|
| 15% (seconda stesura) | 1,333 | 1,220 | 1,51 | rosso: «non si distingue» |
| **30% (adesso)** | **1,864** | 1,220 | **3,93** | verde, su tutte e cinque le forme |
| 60% (controprova) | 3,993 | 1,220 | 13,58 | rosso: «è pesante» |
| linea fra giorni al 30% (controprova) | — | 1,86 | — | rosso: «deve restare discreta» |

Regole: la linea fra impegni si stacca dallo sfondo (contrasto − 1) **almeno 2 e
al massimo 4,5 volte** la linea fra giorni; la linea fra giorni resta sotto
contrasto 1,25. Le righe qui sotto sono della seconda stesura, e per le misure
di lunghezza valgono ancora (287 contro 334 punti a 390).

⚠️ **Seconda stesura, dal secondo collaudo sull'iPhone (12/09)**: la linea fra
impegni della prima (`5c8e192`, un bordo su tutta la riga, più chiaro) si
confondeva con quella fra giorni. Adesso è un **segmento corto** che comincia
dove comincia il titolo (dopo la colonna dell'ora) e arriva al bordo del
testo, **un poco più scuro** (15% contro il 10% della linea fra giorni); in
colonna parte dal bordo del testo. Stessa altezza, stessi spazi, stesso tocco.

## La misura delle due linee (`b7a31a7`)

`tests/visive/agenda/linee.js`: `MISURA_LINEE` si valuta nella pagina,
`difettiDelleLinee` è pura. Pretende: linea fra giorni **lunga** (≥ 90% del
riquadro) e discreta; linea fra impegni **più corta** di almeno 0,4 cm,
**rientrata sul titolo**, **più opaca** ma non oltre 2,5 volte, **mai prima
del primo né dopo l'ultimo**, e **senza spazio in più**. La usa anche
`scripts/prova-visiva.mjs` ⚠️ — che qui **non è stata lanciata**, perché apre un
server su 127.0.0.1: la misura è girata con uno strumento di sessione senza
porte.

| forma | linea fra giorni | linea fra impegni | difetti |
|---|---|---|---|
| iPhone 390 | 334 pt, 10% | 287 pt, 15% | 0 |
| iPhone 440 | 384 pt, 10% | 337 pt, 15% | 0 |
| iPhone 390 a 64 punti per cm | 334 pt, 10% | 260 pt, 15% | 0 |
| computer 1280 (a righe) | 864 pt, 10% | 817 pt, 15% | 0 |
| computer 1600 (sette colonne) | nessuna (colonne) | 137 pt, 15% | 0 |

**Controprove** (iPhone 390, una regola rotta alla volta e poi il file rimesso
identico, misura di nuovo a 0): senza rientro → 10 difetti; troppo chiara → 5;
troppo scura → 5; linea sopra il primo → 3; spazio in più → 5; linea fra giorni
accorciata → 6; linea fra giorni più scura → 5. Ognuna col suo motivo.

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
