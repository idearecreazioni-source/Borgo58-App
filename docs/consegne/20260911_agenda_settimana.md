# L'Agenda si guarda anche per settimana — 11/09/2026 (mandato notturno)

Sola interfaccia: una **vista nuova sugli stessi impegni**. Nessun dato,
ricorrenza, scadenza, promemoria o logica di completamento toccati.

**Migrazioni**: nessuna. **Funzioni online**: nessuna. **Database**: non toccato
(né produzione né progetto di prova: tutte le prove girano su letture finte).
**PR #57 e #58**: non toccate, e le loro copie di lavoro nemmeno.
**HEAD dichiarato**: vedi l'ultima riga.

Stato della PR #57 annotato prima di partire: aperta, non unita, HEAD
`f513e6b`; «Codice, prove pure e compilazione», CodeQL e Cloudflare verdi,
«Prove contro il progetto di prova» in corso. PR #58 a `23ca405`.

---

## Cosa cambia

**Selettore** (`AgendaList.jsx`): **Lista · Settimana · Mese**, tre voci allo
stesso livello, con `aria-pressed`. «Mese» è la vista che si chiamava
«Calendario», identica. L'Agenda si apre ancora sulla Lista.

**La vista Settimana** (`SettimanaAgenda.jsx`, `calcoli/settimana.js`)
- Da lunedì a domenica, ogni giorno con **nome e data** («Lun 7»; in colonna
  «Lunedì 7»), **oggi** segnato («· oggi» e fondo).
- Dentro un giorno gli impegni **in ordine**: senza ora in cima, poi per ora,
  a pari ora per titolo. Accanto al titolo **solo l'ora**; il fatto è barrato.
  Niente priorità, tipo, provenienza o «Riservato»: stanno nella scheda.
- Un tocco apre la scheda (`/agenda/:id`).
- **← / →** e **«Torna a questa settimana»**, che compare solo fuori dalla
  settimana di oggi. Titolo «7 – 13 settembre 2026»; mese e anno ripetuti solo
  se cambiano («31 agosto – 6 settembre 2026», «28 dicembre 2026 – 3 gennaio 2027»).
- Un giorno vuoto è **una riga sola**: «Mar 8 niente».
- **Telefono: giorni a righe**, nome del giorno *sopra* i suoi impegni. Accanto,
  a 64 punti per cm, al titolo restavano ~160 punti e «commercialista» si
  spezzava a metà.
- **Sette colonne solo quando il riquadro è largo ≥ 64rem** (`@container` +
  `@5xl:`), non lo schermo. Con la barra laterale (`xl:w-80`): a **1280** il
  riquadro resta sotto soglia → righe (misurato); a **1600** → colonne
  (misurato, la più stretta 40,5 mm). A **1440** il riquadro verrebbe ~1023
  punti, cioè appena sotto: **calcolato dalle classi del telaio, non misurato**.
- Il testo sta **al centro** del bersaglio da 0,85 cm (in alto lasciava spazi
  diversi fra gli impegni: visto nelle fotografie).
- **Vince la lettura più recente** (`useRef` di giro): due «→» veloci non
  fanno sostituire gli impegni della settimana giusta con quelli di un'altra.
- **Lettura fallita**: non si disegnano sette «niente» (§6, «non vuol dire che
  è vuota»), ma «Non riesco a leggere gli impegni di questa settimana: …» con
  **Riprova**; l'errore resta dentro la settimana e si toglie alla lettura dopo.

**Lettura** (`api/tasks.js`): `listTasksBetween(dal, al)`, la stessa query di
`listTasksForMonth` (stessa tabella, nessun filtro sullo stato).

**Il Mese — difetti trovati nella revisione e corretti**
- Il giorno scelto elencava gli impegni **nell'ordine del database, senza ora,
  e un impegno fatto uguale a uno da fare** (la lettura del mese li comprende
  tutti). Ora stesso ordine della Settimana (`inOrdineDelGiorno`, una funzione
  sola), l'ora accanto sulla prima riga, il fatto barrato, i titoli dello stesso
  giorno che partono dallo stesso punto.
- Le frecce del Mese non avevano nome per la lettura dello schermo («←», «→»):
  ora «Mese precedente» / «Mese successivo».

## Scelte di prodotto prese per andare avanti (da confermare)

1. **Tre voci allo stesso livello** invece di un secondo selettore «Mese |
   Settimana» dentro «Calendario». Cambiarla è una riga.
2. **L'Agenda si apre sulla Lista** e la scelta non si ricorda ricaricando (come
   già succedeva per il Calendario).
3. **Gli impegni fatti compaiono, barrati**, nella Settimana (la lettura del mese
   li comprendeva già). L'alternativa è nasconderli.
4. **Senza ora in cima** al giorno (come la «giornata intera» dei calendari).
5. **Sette colonne solo su riquadro ≥ 64rem**; sotto, righe anche sul computer.

## Come è stato verificato

**Prove pure** — `tests/unita/settimana.test.js`, 15: domenica ultimo giorno,
cambio dell'ora di ottobre e marzo, cavallo di mese e d'anno, titolo nei tre
casi, ordine, giorni vuoti presenti, l'elenco ricevuto non toccato.

**Prove sulle schermate** — `tests/schermate/agenda-settimana.test.jsx`, 9:
selettore, lettura da lunedì 7 a domenica 13, ordine e ore, giorno vuoto, fatto
barrato, dopo/ritorno/prima, due tocchi veloci, lettura fallita con Riprova,
tocco che apre la scheda, il giorno scelto nel Mese.

**Prova visiva** (`npm run test:visive`, estesa): Chrome senza schermo, vere
schermate con letture finte (`tests/visive/finti/tasks.js`), l'Agenda montata
**dentro lo stesso telaio di `Layout.jsx`** (`?telaio`: barra laterale e `main`
con `contenuto-ampio`, classi ricopiate e dichiarate). Cinque forme × quattro
stati (settimana di oggi, dopo e vuota, ritorno, prima e a cavallo di mese) +
il giorno scelto nel Mese. Controlla: sette giorni giusti con nome e data, oggi,
ritorno solo fuori da questa settimana, ordine e ore, fatto barrato, niente fuori
dal riquadro, niente sovrapposto, nessun testo tagliato **né parola spezzata**
(parola più lunga misurata col carattere vero), pagina senza scorrimento di lato,
titoli dello stesso giorno allineati, giorno vuoto ≤ 8 mm e più basso di uno
pieno, mai sette colonne sul telefono, colonne ≥ 3 cm, bersagli ≥ 0,85 cm.

| forma | disposizione | giorno vuoto | giorno con impegni da | settimana di oggi | settimana vuota |
|---|---|---|---|---|---|
| iPhone 390 | righe | 7,4 mm | 16,5 mm | 98,4 mm | 51,8 mm |
| iPhone largo 440 | righe | 7,4 mm | 16,5 mm | 98,4 mm | 51,8 mm |
| 390 a 64 punti per cm | righe | 6,0 mm | 14,8 mm | 99,1 mm | 42,1 mm |
| computer 1280 | righe | 7,4 mm | 16,5 mm | 96,9 mm | 51,8 mm |
| computer 1600 | 7 colonne (≥ 40,5 mm) | 7,2 mm | 16,2 mm | 65,0 mm | 7,2 mm |

**Guardato nelle fotografie** (e da lì due correzioni: spazi diversi fra gli
impegni; nel Mese titoli non allineati e ora a metà di un titolo su due righe).
Le fotografie si rifanno con `npm run test:visive` (`%TEMP%\b58-prova-visiva`).

**Rotture apposta** (ognuna rimessa a posto con `git checkout`, albero pulito
dopo ogni giro):

| n. | cosa si è rotto | cosa è diventato rosso |
|---|---|---|
| R1 | senza ora in fondo invece che in cima | 1 pura, 1 schermata |
| R2 | tolta la guardia «vince la più recente» | ⚠️ **prima: niente** — la prova non discriminava; rifatta, ora 1 schermata |
| R3 | sette colonne anche sul telefono | visiva, 238 problemi (primo della lista: «griglia microscopica») |
| R4 | giorni vuoti alti (`py-6`) | visiva, 105 problemi (vuoto 17 mm, massimo 8) |
| R5 | colonna dell'ora larga 9em | visiva: «una parola larga 175 punti non ci sta in 134» (64 p/cm) |
| R6 | «Torna a questa settimana» sempre | 1 schermata, visiva 10 problemi |
| R7 | lettura fallita non detta | 1 schermata |
| R8 | la settimana parte dalla domenica | 3 pure, 3 schermate, visiva 40 |
| R9 | il Mese torna nell'ordine del database | 1 schermata, visiva 10 |
| R10 | nel Mese colonna dell'ora solo per chi ha l'ora | visiva 5 (titoli da 48,0 a 94,7) |
| R11 | nella Settimana colonna dell'ora solo per chi ha l'ora | visiva 8 (titoli da 28,0 a 74,7) |

R3 e R4 al primo giro non hanno mostrato l'esito perché il mio filtro
dell'uscita lo nascondeva: rilanciate, rosse come sopra.

**Revisione Codex del diff** (una): nessun critico.
- *Medio — «le colonne si riconoscono da altezze uguali, quindi i controlli non
  girano»*: **falso, verificato**. Il confronto è sulle posizioni in alto
  (`Math.round(g.alto)`); a 1600 le colonne sono state riconosciute (40,5 mm) e
  in R3 il riconoscimento sul telefono ha fatto scattare il difetto.
- *Basso — errore globale che resta sopra una settimana letta bene*: **vero**,
  corretto (errore dentro la settimana, Riprova, niente sette «niente»).

**Resto**: lint pulito; compilazione riuscita. Prove pure **1310/1312**: le due
rosse sono `indice-richieste` e `indice-rovesciamenti`, fine riga di Windows —
**identiche sul master pulito** (misurato mettendo da parte le modifiche).
Prove sulle schermate **141/141** in questo giro (le scadenze a 5 secondi di
`rotte-chiuse` e `varco-pubblico`, altre volte rosse, stavolta verdi).

**Fusione di prova** (`git merge-tree`, niente scritto nel ramo): con
`memo-affidabile` (#58) **nessun conflitto**; con `telefono-ordinato` (#57)
**conflitto in `scripts/prova-visiva.mjs`** — #57 la riscrive (174+/131−) per il
driver di Chrome condiviso. Chi viene unita per seconda va riallineata.

## Cosa NON è verificato

- **La prova visiva è Chrome**, non Safari: l'iPhone vero è il collaudo di Alessio.
- **Il tocco che apre la scheda** è provato solo nella prova sulle schermate
  (jsdom): il telaio della prova visiva non ha le rotte.
- **La larghezza 1440** (riquadro ~1023 punti, righe) è calcolata, non misurata.
- Nessuna prova contro il progetto di prova: nessuna scrittura nuova, e la
  lettura è la stessa query del mese.

## Revisione dell'Agenda — segnalazioni NON corrette

Corrette solo le due del Mese (sopra). Queste restano, con la ragione:

1. 🔴 **La spunta della Dashboard chiude un impegno ricorrente senza far
   nascere il successivo.** `Dashboard.jsx:113` fa `updateTask(…, { status:
   "completato" })`; il successivo lo genera solo `completa_task` (ultima
   versione in `20260910000001`), e nessun trigger su `tasks` lo fa (i tre
   trigger sono `updated_at`, visibilità, categoria). **Letto nel codice e nelle
   migrazioni, non provato dal vivo.** Non corretto: il mandato vieta di toccare
   le logiche di completamento, e `Dashboard.jsx` è toccato dalla #58.
2. **La Dashboard mostra la categoria come codice**: «· fisco_scadenze»
   (`Dashboard.jsx:609`, `{t.category}` grezzo; le etichette sono in
   `TASK_CATEGORIES`). Non corretto: file della #58.
3. **«task» e «impegno»** convivono: «+ Nuovo task», «Modifica task», «Crea
   task», «Nessun task in questo giorno», «Task di oggi» contro «Impegno»
   nell'elenco e «impegni» nella Settimana. Scelta di parole: da decidere.
4. **«Elimina» nella scheda cancella senza chiedere conferma**
   (`TaskForm.jsx:218`). Non corretto: `TaskForm.jsx` è toccato dalla #58.
5. **Didascalia da segnalare alla #57**: nella scheda di un impegno automatico
   riservato, la frase «La visibilità dei task automatici dipende dal modulo di
   origine e non è modificabile da qui» (`TaskForm.jsx:474`) è una spiegazione
   sempre visibile: candidata al «?».
6. **«Scadenze da stampare»** usa misure fisse (`text-sm`, `text-xs`) invece
   della scala in cm veri: letto nel codice, **leggibilità sul telefono non
   misurata**.

## Cosa abbiamo rovesciato

Nessuna decisione. Il punto più vicino, dichiarato per non lasciarlo implicito:
il Blocco 1 del mandato cumulativo (14/08) voleva il «calendario come seconda
scheda». Il calendario resta una scheda accanto all'elenco, che resta la prima;
cambiano il nome («Mese», richiesto da questo mandato) e il posto (terza, con la
Settimana in mezzo). La ragione di allora — l'Agenda risponde prima a «cosa devo
fare adesso» — vale ancora e non è toccata.

## File

`src/lib/calcoli/settimana.js` (nuovo) · `src/pages/agenda/SettimanaAgenda.jsx`
(nuovo) · `src/pages/agenda/AgendaList.jsx` · `src/lib/api/tasks.js` ·
`tests/unita/settimana.test.js` (nuovo) · `tests/schermate/agenda-settimana.test.jsx`
(nuovo) · `scripts/prova-visiva.mjs` · `tests/visive/agenda/main.jsx` ·
`tests/visive/finti/tasks.js`.

---

**Hash di HEAD dichiarato**: `0ba6ed7` sul ramo `agenda-settimana`, cioè il
commit immediatamente sotto questo documento.
**Stato del working tree al momento della consegna**: pulito.
