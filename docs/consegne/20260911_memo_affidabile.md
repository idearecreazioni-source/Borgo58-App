# MEMO affidabile — 11/09/2026

Mandato notturno «MEMO affidabile», due obiettivi: **(A)** MEMO voce raggiungibile
da ogni modulo, con ritorno al punto di partenza; **(B)** una dettatura con più
appuntamenti, ognuno una proposta a sé.

**Migrazioni**: nessuna. **Funzioni online**: nessuna (`ascolta-voce` non è
toccata). **Database**: non toccato; le prove contro Borgo58-Prova scrivono solo
righe proprie e le tolgono per identificativo. **HEAD dichiarato**: vedi l'ultima
riga.

🔴 **B è fermo alla diagnosi per la parte che tocca il contratto vocale**, come
chiedeva il mandato: due difetti misurati, e la cura sta nella funzione online
(e per l'ora anche in una migrazione). Proposte e domande in fondo. Quello che
**non** dipende dal contratto — schede, gesti, Dashboard — è fatto e provato.

---

## A. MEMO voce da qualunque modulo

**Cosa cambia**
- `src/components/ApriMemo.jsx` (nuovo): pulsante «MEMO» nella **testata** di
  telefono e tablet (`Layout.jsx`, accanto al menu, stacco 0,3 cm veri). Solo il
  titolare (la rotta è `RequireTitolare`), assente in MEMO stesso.
- **Apre, non registra**: «Premi e parla» resta uno solo, in MEMO. Il browser
  apre il microfono solo dentro un tocco sulla pagina che lo usa, quindi un
  pulsante qui che promettesse di accenderlo arriverebbe a microfono spento.
- **Sul computer** la testata non c'è: la porta è la voce «MEMO voce» in cima
  alla barra laterale, che ora porta con sé la stessa partenza (`Sidebar.jsx`).
- La partenza viaggia nello **stato della cronologia** (`history.state.usr.da`),
  non nell'indirizzo. `src/lib/calcoli/ritornoMemo.js` (nuovo, puro):
  `origineValida` accetta solo percorsi interni — mai `//…`, schemi, `\`,
  `/detta`, `/login`; `statoVersoMemo` riconsegna la partenza se si ritocca
  «MEMO voce» da dentro MEMO; `ritornoDaMemo` dà le parole, col nome del modulo
  preso da `MODULES` (rotta più lunga che combacia).
- `Detta.jsx`: in cima «← Torna in {modulo}»; **a microfono acceso** diventa
  «← Annulla e torna in {modulo}» — il tocco smonta la pagina, il riconoscitore
  si ferma e **niente viene mandato**. Dopo il riscontro (o la risposta a una
  domanda) un pulsante «← Torna in {modulo}» con la frase «Gli appunti restano da
  approvare: li ritrovi qui e in Dashboard».
- ⚠️ **Nessun ritorno automatico**: il riscontro alla fine è una decisione del
  25/08, e tornare da soli lo farebbe sparire quando c'è da leggerlo.
- ⚠️ **Del modulo di partenza si porta solo l'indirizzo**, nessun contesto verso
  la voce: con un contesto, la stessa frase detta dall'Agenda o dalla Cassa
  potrebbe diventare due cose diverse. Una prova pura lo congela (lo stato ha la
  sola chiave `da`).

**Misure dal vivo** (Chrome senza schermo, gestionale di questo ramo collegato a
Borgo58-Prova, titolare di collaudo), partenza da Cassa → Prima nota, Agenda,
Magazzino, Dashboard:

| forma | pulsante alto | largo | stacco dal menu | testata/pagina scorrono | ritorno giusto (anche dopo ricarica) |
|---|---|---|---|---|---|
| iPhone 390 | 8,50 mm | 20,6–20,8 mm | 3,00 mm | no / no | 4/4 |
| iPhone 64 p/cm | 8,50 mm | 16,2–16,5 mm | 3,00 mm | no / no | 4/4 |
| computer (barra laterale) | 8,50 mm | — | — | — / no | 4/4 |

In tutti i 12 casi in MEMO: «Premi e parla» compare **una volta**, il pulsante
MEMO della testata **non** compare, e dopo il tocco su «Torna» l'indirizzo è
**esattamente** quello di partenza, domanda compresa. Fotografie guardate:
MEMO aperto dall'Agenda a 390 e la testata dell'Agenda a 390 e a 64 p/cm.

## B. Più appuntamenti nella stessa dettatura

### Cosa regge già, verificato
- **Il contratto è un elenco di azioni** (`ascolta-voce/index.ts:71-77`), con la
  regola «UNA FRASE SOLA, PIÙ AZIONI … Non fonderle mai» (`:122-123`);
  `scrivi_dettatura` scrive **una riga per azione**; `promemoria` non è
  additivo, quindi **un appunto per impegno**, approvabile e scartabile da solo.
- **Dal vivo col modello vero** (Borgo58-Prova, `claude-sonnet-5`, 43.559 + 1.394
  token), frase: *«Lunedì prossimo alle 10 ho il dentista, avvisami domenica
  alle 18. Martedì alle 15 c'è la riunione col commercialista. Mercoledì mattina
  devo ritirare le tovaglie in lavanderia.»* → **3 azioni, 3 appunti**:

  | titolo | giorno | avviso | descrizione |
  |---|---|---|---|
  | Dentista | 14/09 | 13/09 18:00 | «Alle 10» |
  | Riunione con il commercialista | 15/09 | — | «Alle 15» |
  | Ritirare le tovaglie in lavanderia | 16/09 | — | «Al mattino» |

- **Contro il database** (`tests/app/tre-appuntamenti.test.js`, 5/5): una
  dettatura con tre promemoria → tre appunti distinti coi loro dati; **zero
  impegni prima dell'approvazione**; approvarne uno scrive solo quello e lascia
  gli altri due `aperto` con i dati **identici**; «Fallo a mano» (`azione_a_mano`
  → il modulo salva → `chiudi_azione_a_mano`) chiude solo quello e non scrive un
  doppione; buttarne uno butta solo quello.

### Cosa cambia nell'interfaccia
- **Dashboard**: la riga «N appunti aspettano…» ora **si apre** e mostra le
  stesse schede di MEMO (`AppuntiInDashboard.jsx`, nuovo): Approva, Fallo a mano
  (= correggere: il modulo coi campi già scritti), Butta; più «Apri MEMO voce →»
  con la partenza. Chiusa è la riga di prima; l'elenco si legge all'apertura;
  dopo un gesto riuscito si rilegge l'elenco e **solo il conteggio**. Dal vivo
  sulla Dashboard vera: tre appunti, approvato il secondo (è nato solo
  «commercialista»), buttato il terzo, il primo ancora approvabile.
- `src/lib/useGestiAppunti.js` (nuovo): la guardia sincrona contro il doppio
  tocco e la regola del 06/09 («solo la scrittura decide com'è andata») escono da
  `Detta.jsx` e le usano MEMO e Dashboard. Spostate, non riscritte.
- ⚠️ **Buttato non è fatto**: l'esito di uno scarto è `scartata`, e la scheda
  non mostra più «✓ Fatto» per l'istante prima della rilettura.
- 🔴 **Difetto corretto, trovato scrivendo la prova**: il riscontro non si
  segnava il numero della dettatura, quindi la rilettura dopo un «Approva» o una
  scelta partiva **senza numero**. Sonda sul database di prova: *«PGRST202 —
  Could not find the function public.azioni_della_dettatura without parameters»*.
  Dopo «Approva» lo nascondeva il silenzio (e il riscontro non si aggiornava
  mai); dopo una **scelta riuscita** fra due impegni la scheda diceva «Non è
  stato scritto niente — riprova». La prova `memo-tre-appuntamenti` è **rossa
  sul codice di partenza** su quel caso e verde dopo.

### Diagnosi: dove il contratto non regge — FERMATO QUI
1. 🔴 **La rete dell'Agenda guarda la frase intera, non l'azione.**
   `correggiAgenda(azioni, testo)` passa il dettato intero a ogni azione
   (`agenda.ts:218-233`, `:279-281`): basta una parola di spostamento o di
   chiusura in un punto qualunque della frase perché **ogni** promemoria diventi
   «da spostare» o «da segnare fatto».
   - **Dal vivo**, la stessa frase di sopra più *«E sposta a venerdì l'ordine
     delle verdure»*: 4 azioni, e i **tre appuntamenti nuovi sono diventati
     `agenda_quale_impegno`** (non approvabili: «non l'ho trovato fra quelli
     aperti in Agenda»), più lo spostamento vero.
   - **Il caso peggiore, misurato** sul database di prova con righe proprie: se
     in Agenda c'è già un impegno con quel nome, l'appunto trasformato è
     **approvabile**; approvandolo l'impegno esistente è passato dal 21/10 al
     28/10 (il giorno del nuovo) e **il nuovo appuntamento non è nato**. La
     trasformazione è provata da `agenda-a-voce.test.js` (vedi sotto), la metà
     del database da questa misura; il modello qui non è stato chiamato.
   - Stessa famiglia, più piccola: le parole si cercano **dentro** le altre —
     «ordinare le **spunta**ture di maiale» diventa «da segnare fatto».
2. 🔴 **L'ora dell'appuntamento non è nel contratto.** `promemoria` ha titolo,
   descrizione, giorno e avviso (`index.ts:95`), non l'ora; il ramo che approva
   scrive `due_date` e mai `due_time` (`20260910000002…sql:771`), e il modulo a
   mano lo dichiara (`TaskForm.jsx:13`). Dal vivo il modello ha messo l'ora
   **nella descrizione** («Alle 10»): arriva in Agenda come testo, se il modello
   decide di scriverla, e non come ora dell'impegno.
3. ⚠️ **Le date relative le risolve il modello, e non sempre allo stesso modo.**
   Due giri della stessa frase (il secondo con lo spostamento in coda) hanno
   dato **14/15/16** e **15/16/17 settembre** per gli stessi tre appuntamenti.
   La data si vede sulla scheda prima di approvare; non è corretto qui.

I due `it.fails` in `tests/unita/agenda-a-voce.test.js` descrivono il
comportamento **giusto** per il punto 1 e oggi falliscono: il giorno che la rete
viene corretta diventano rossi e vanno trasformati in `it`.

### Proposte (nessuna costruita)
- **P1 — la rete per azione.** (a) al modello si chiede per ogni azione anche il
  pezzo di frase che la riguarda, e la rete guarda quello; oppure (b) la rete
  guarda il dettato intero **solo se nella filza c'è una sola azione
  d'Agenda**, altrimenti vale il tipo dichiarato dal modello. (a) conserva la
  rete anche nelle frasi lunghe ma dipende da come il modello taglia la frase;
  (b) è deterministica ma, in una frase con più cose, lascia passare un «segna
  fatto X» capito male come impegno nuovo (un doppione visibile, che si butta
  con un tocco). In entrambi i casi più il confine di parola («spuntature»).
  Tocca solo la funzione online.
- **P2 — l'ora.** Un campo `ora` nel promemoria, con la stessa regola di
  `avviso_ora` (mai inventata); il ramo che approva scrive `due_time`; la
  scheda la mostra. Tocca funzione online **e** una migrazione.

## Come è stato verificato

- **Prove pure**: nuove `ritorno-memo.test.js` (15) e 3 casi in
  `agenda-a-voce.test.js` (1 verde, 2 `it.fails`). Giro completo: **1311 verdi,
  2 errori attesi, 2 rosse** — `indice-richieste` e `indice-rovesciamenti`,
  fine riga di Windows, **le stesse due** misurate su master in questa copia
  prima di cominciare; verdi su GitHub.
- **Prove schermata**: nuove `memo-lanciatore` (12: quattro partenze, barra
  laterale, un solo microfono, staff, annullare e concludere),
  `dashboard-appunti` (7), `memo-tre-appuntamenti` (7). Con le 6 già esistenti
  su MEMO e sugli appunti: **88/88**. Giro completo sul codice finale:
  **155/158**; le 3 rosse sono `rotte-chiuse` ×1 e `varco-pubblico` ×2, «Test
  timed out in 5000ms», e sono **identiche su master `59f4d2d`** fatto girare
  nelle stesse condizioni in una copia temporanea (129/132, poi tolta);
  rilanciate da sole, 12/12 verdi.
- **Contro Borgo58-Prova**: `npm run test:app -- tests/app/tre-appuntamenti.test.js`
  5/5; due dettature al modello vero; il pulsante dal vivo 12/12; la Dashboard
  dal vivo; la misura del caso peggiore. Pulizia verificata dopo ognuna
  (dettature, appunti, azioni e impegni propri rimasti: zero). Nessun processo
  di Chrome rimasto.
- **Lint** pulito, **compilazione** riuscita.
- **Revisione Codex del diff** (una, come da regola): tre rilievi, tutti fra una
  scrittura riuscita e la rilettura che viene dopo, **tutti veri** e curati;
  guardandoli ne è saltato fuori un quarto, preesistente. Per ognuno una prova
  scritta **prima** della cura e fatta girare sul codice non curato: **4 rosse
  su 4**, poi verdi.
  1. La guardia contro il doppio tocco si liberava prima che la rilettura
     tornasse: fra una scelta e la rilettura partiva un secondo tocco su un
     altro candidato. Nel codice di partenza, per la scelta, la guardia restava
     chiusa fino alla fine: lo spostamento in `useGestiAppunti` l'aveva
     accorciata. Ora si libera solo a rilettura tornata.
  2. Nella Dashboard, aprire-chiudere-riaprire metteva in volo due letture e
     la più vecchia poteva tornare per ultima, riportando schede già chiuse.
     Ora vince la più recente, con la stessa guardia di `ricarica()` in MEMO.
  3. In MEMO una rilettura rimasta indietro poteva prendere il posto del
     riscontro di una dettatura nuova. Quel codice prima non girava mai
     (mancava il numero della dettatura): correggendolo l'avevo acceso. Ora si
     applica solo se il riscontro è ancora della stessa dettatura.
  4. (preesistente) La scelta segnava l'esito sotto l'**elemento**, mentre la
     scheda lo legge sotto l'**appunto**: una scelta rifiutata non diceva
     niente sulla scheda. Ora la chiave è l'appunto, come per l'approvazione.

## Cosa NON è verificato

- **Safari e un iPhone vero**: niente è stato aperto da un telefono. Le misure
  sono di Chrome senza schermo.
- **La dettatura vera dal browser**: il microfono non esiste senza schermo; il
  giro «parlo → appunti → torno» è provato con un riconoscitore finto nelle prove
  schermata, e il modello è stato chiamato direttamente.
- **«Fallo a mano» dalla Dashboard**: provato l'indirizzo (prova schermata) e il
  giro sul database (`azione_a_mano` → `chiudi_azione_a_mano`), non cliccato nel
  browser vero.
- **La partenza dopo una ricarica** è misurata in Chrome; Safari conserva lo
  stato della cronologia allo stesso modo per specifica, ma non l'ho visto.

## Cosa abbiamo rovesciato

**Nessuna decisione registrata.** Due cose da dichiarare lo stesso:
- La riga della Dashboard **era un collegamento a MEMO** (SPEC-0013, 06/09) e ora
  **si apre**. Non c'era una decisione «si approva solo in MEMO»: la ragione
  scritta accanto a quella riga — contare gli appunti e non le righe, con lo
  stesso numero di MEMO — **vale ancora** ed è conservata (`voce_da_guardare`).
  MEMO resta a un tocco, dentro il riquadro.
- La regola del 06/09 («solo la scrittura decide com'è andata») si allarga
  alla **scelta** fra due candidati, che fino a oggi non la rispettava.

---

**Hash di HEAD dichiarato**: `e7ed23e` sul ramo `memo-affidabile`, cioè il
commit immediatamente sotto questo documento.
**Stato del working tree al momento della consegna**: pulito.
