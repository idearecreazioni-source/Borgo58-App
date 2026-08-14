# Consegna del 14/08/2026 (nona) — la pianta viva

**Commit della consegna: `dbd6732`** (questo riepilogo è il commit
immediatamente sopra, sola documentazione). Working tree pulito.

| Commit | Cosa |
|---|---|
| `290b82e` | la casa dei mandati: `docs/mandati/`, coi nomi datati |
| `44630b7` | errata corrige al mandato: il criterio 11 diventa verificabile |
| `9d41be6` | la pianta viva — migrazione `20260814000007` |
| `8020e1b` | la sala si tocca: la pianta in Calendario e in Comande |
| `fc59349` | le prove seguono la sala: 46 → 52 |
| `fed4657` | la prova si dimenticava metà di quello che aveva spostato — `20260814000008` |
| `19ad6d8` | i posti dello Chef Table finivano fuori dal disegno |
| `dbd6732` | `CLAUDE.md` segue la sala |

**Applicate in produzione**: `20260814000007` e `20260814000008`. **94
migrazioni**. `operazioni-atomiche` reinstallata (**v18 → v19**).

È il mandato **«Blocco Sala: la pianta viva»**, consegna **unica e
indivisibile** come chiedeva il §11: pianta, prenotazioni e comande
insieme. Nessun push intermedio ha lasciato la sala e le comande
disallineate.

⚠️ **Questa consegna NON modifica `docs/CONTRATTO.md`**, come il mandato
imponeva (§9, anti-deriva). La riga di §5 sui tavoli uniti resta da
aggiornare in un commit separato, dopo, autorizzato da Alessio e
dichiarato qui — vedi §7.

---

## 1. Cosa cambia, in una frase

La sala smette di essere un numero calcolato dal sistema e diventa **una
pianta che Alessio muove con le mani**. Il sistema non decide più se un
gruppo entra: lo decide lui guardando la sala, e il sistema registra cosa
ha deciso.

---

## 2. Perché il calcolo si rimuove invece di correggerlo

Il modello vecchio contava un secchio di posti e sottraeva le persone
prenotate. Con i tavoli veri quel conto è sbagliato **per costruzione**:
due persone a un tavolo da sei lasciano quattro posti che non esistono.

⚠️ **Un numero sbagliato sempre nella stessa direzione è peggio di nessun
numero**, perché ha l'aria di essere un dato. È la stessa forma dello
scarto a zero e dell'elenco allergeni vuoto: non un errore che si vede,
una risposta credibile e falsa.

Quindi si è **rimosso, non spento** (§8 del mandato): via
`dining_tables.seats`, via `posti_liberi()`, via `durata_tavolo_minuti` e
`max_coperti_contemporanei`, via il flag «gruppo grande». Una colonna
spenta e una funzione che non fa niente sono peggio di un difetto: fra
tre mesi qualcuno le riaccende credendo di riparare qualcosa.

**Decadenza ratificata da Alessio**: una richiesta in attesa **non occupa
più niente**. La decisione del 10/08 — la richiesta tiene il posto —
aveva senso solo finché esisteva il calcolo che la rendeva necessaria.

---

## 3. Quattro invarianti, e vivono nel database

1. **Nessun numero di coperti su un tavolo.** Non è una convenzione: il
   vincolo rifiuta un `tavolo` con `posti_fissi`. Divani e Chef Table ce
   li hanno perché sono **arredi fissi**, e non entrano in nessun calcolo
   — è un'etichetta sulla sagoma.
2. **Un tavolo non sta su due conti aperti insieme.** Indice unico
   parziale, non un controllo di schermata.
3. **Divani e Chef Table non si spostano**, e non perché la schermata non
   li lasci prendere: lo stesso vincolo del punto 1.
4. **Una giornata al completo rifiuta dentro la funzione** che riceve la
   richiesta. Un form disabilitato lato client non è un freno.

### ⚠️ La colonna che va spiegata a chi la trova

`order_tables.conto_aperto` è una **copia** dello stato del conto, e a
prima vista è la cosa che questo progetto vieta — due posti dove vive la
stessa informazione.

Esiste per un motivo preciso: in Postgres **un indice unico parziale vede
solo le colonne della propria tabella**, e lo stato del conto vive su
`orders`. Senza quella proiezione l'invariante 2 non sarebbe esprimibile
come vincolo e resterebbe un controllo nel codice chiamante — cioè
esattamente ciò che il Contratto vieta. La scrive **solo un trigger, mai
l'applicazione**, nei due versi: quando nasce una riga e quando il conto
cambia stato.

⚠️ **Conseguenza voluta**: chiudere un conto libera i tavoli **comunque
sia stato chiuso** — pagato, omaggiato, annullato. Nessuna delle tre
uscite è stata modificata, perché il trigger guarda lo stato e non chi lo
ha cambiato.

---

## 4. Le altre scelte, in breve

- **Tre tavoli accostati sono UNA comanda.** Il conto si aggancia a un
  insieme (`order_tables`), non alla stringa. ⚠️ `table_label` resta ma
  **cambia significato**: non è più l'aggancio, è **ciò che si stampa**
  sul ticket di cucina e sul preconto, fotografato all'apertura.
- **La disposizione di una giornata salva solo lo SCOSTAMENTO.** Nessuna
  riga per una data = quel giorno vale la pianta base, e il giorno dopo
  si riparte da sola. «Questa diventa la base» tocca due tabelle →
  corridoio, e chiede conferma perché non si raggiunga per sbaglio
  trascinando.
- **Nessuna entità «gruppo».** Una prenotazione tiene l'elenco dei tavoli
  che occupa; l'accostamento è dove Alessio li ha messi. Un oggetto
  «gruppo» vorrebbe creazione, vita, scioglimento a fine serata e una
  regola per quando una sagoma ne esce: tutto lavoro che non serve.
- **L'etichetta si fotografa** su `prenotazione_tavoli` e su
  `order_tables`: se la sala viene rinumerata, una prenotazione di oggi
  continua a dire dov'erano seduti. Stesso principio del prezzo del
  coperto e della dicitura del fornitore sulla riga d'ordine.
- **Sold out ≠ chiusura.** Tabella separata apposta: `service_closures`
  descrive periodi e dice «siamo chiusi», questa descrive singoli giorni
  e dice «siamo pieni». Fra un anno la differenza è tutto ciò che resta
  per capire com'è andata. **Nessun avviso di soglia**, per decisione
  esplicita del mandato.
- **Una pianta sola** (`src/components/PiantaSala.jsx`) per Calendario e
  Comande: due componenti che ricostruiscono la sala per conto proprio
  finirebbero per disegnarne due diverse — è la lezione dei rincari, dove
  schermo e Telegram dicevano due numeri.
- ⚠️ **La larghezza minima del disegno non è arbitraria**: il tavolo più
  piccolo è 90 cm e il target di tocco del progetto è 1,05 cm reali,
  quindi 2070/90 × 1,05 ≈ 24 cm. Sotto quella soglia non si
  rimpicciolisce: su un tablet verticale la sala scorre in orizzontale.
  **Un tavolo che non si riesce a toccare durante un servizio non è una
  pianta, è un disegno.**
- **I 14 tavoli di collaudo sono stati sostituiti** dalle 13 sagome vere.
  Un conto già **chiuso** non lo cancella una migrazione — è un incasso in
  prima nota, e ci si ferma dicendolo. In produzione non ce n'era
  nessuno: **0 conti cancellati**, e lo si dichiara invece di lasciarlo
  intendere.

---

## 5. Il difetto che ho trovato io, dopo aver applicato

Rileggendo la sala dal connettore invece di fidarmi del «residui: zero»
che la migrazione stessa dichiarava: **T5 e T6 erano rimasti in mezzo ai
divani.**

La verifica prova il comando «questa diventa la base» spostando due
tavoli in **due** direzioni, e li rimetteva a posto su **una sola** — la
`x` tornava giusta, la `y` restava dove l'aveva messa la prova.

⚠️ **La parte che conta è che il controllo finale non se n'è accorto**:
contava le *righe* lasciate in giro (prenotazioni, conti, scostamenti),
non i *valori* cambiati su righe che dovevano restare. Ha dichiarato zero
residui in perfetta buona fede.

**La regola generale, scritta in `CLAUDE.md` §8**: una verifica che
modifica dati esistenti non si ripulisce cancellando, si ripulisce
**rimettendo** — e rimettere vuol dire salvare la riga intera prima e
riscriverla intera dopo, mai ricordarsi a mano quali colonne si erano
toccate. Quello che si ricorda a mano si dimentica a metà.

**Non ho corretto la migrazione già applicata**: girerebbe a chi controlla
un file diverso da quello che ha prodotto lo stato reale (Contratto §8).
`20260814000008` rimette a posto, con perimetro stretto — due sagome, e
solo se sono esattamente dove la verifica le ha lasciate. Se nel
frattempo le avesse spostate Alessio, non tocca niente.

---

## 6. I dodici criteri di collaudo, uno per uno

Come chiede il §10 del mandato. «Migrazione» = provato dentro il blocco
di verifica coi ruoli veri (titolare e staff impersonati); «prova
automatica» = suite `npm run test:app` sul progetto di prova;
«produzione» = verificato col connettore o sul sito vero.

| # | Criterio | Esito |
|---|---|---|
| 1 | **Tre sagome accostate, una prenotazione da 10 assegnata al gruppo, in sala si apre UN conto — non tre** | ✅ **migrazione + prova automatica**. `order_tables` ha 3 righe, `orders` ne ha **una**, etichetta stampata `T5 · T6 · T7` |
| 2 | Un tavolo su un conto aperto **non può** finire su un secondo. Il rifiuto arriva dal database | ✅ **provato due volte**: la funzione rifiuta con una frase per la sala, **e** l'indice unico respinge la riga scritta a mano scavalcando la funzione |
| 3 | Chiuso il conto, quel tavolo torna immediatamente disponibile | ✅ **migrazione + prova automatica**, senza che nessuno debba ricordarsene |
| 4 | Sposto due sagome per il giorno X. X+1 mostra la pianta base, immutata | ✅ **migrazione + prova automatica** |
| 5 | Promuovo la disposizione di X a base: X+1 mostra la nuova pianta e X non ha più scostamenti | ✅ **migrazione**. Provato anche il contrario: promuovere un giorno senza scostamenti **non** finge di riuscire, e lo staff non può promuovere |
| 6 | Rinomino un tavolo: una prenotazione già confermata continua a mostrare l'etichetta che aveva | ✅ **migrazione** |
| 7 | Giornata sold out → il form pubblico rifiuta l'invio, **anche chiamando la funzione direttamente** | ✅ **migrazione + prova automatica** |
| 8 | Una chiusura per ferie e un sold out restano **distinguibili** nei dati | ✅ **migrazione**: tabelle diverse, e la risposta pubblica porta `sold_out` distinto dal motivo della chiusura |
| 9 | Due prenotazioni sullo stesso tavolo a orari diversi: ammesse, col rischio registrato | ✅ **migrazione** |
| 10 | Divani e Chef Table non si trascinano | ✅ **migrazione**: non è la schermata a impedirlo — il vincolo rifiuta di renderli spostabili |
| 11 | Nessuna occorrenza residua delle funzioni e colonne smontate (§12 del mandato) | ✅ **zero in `src/` e `supabase/functions/`**; in **produzione** `seats`, `posti_liberi`, `durata_tavolo_minuti`, `max_coperti_contemporanei` e il vecchio indice **non esistono più** (0/0/0/0). Le uniche occorrenze nelle prove sono quelle che ne **verificano l'assenza** |
| 12 | Il form pubblico non espone alcun numero sulla capienza | ✅ **verificato in produzione vera, su borgo58.it**: la risposta ha solo `attivo, chiuso, sold_out, motivo, orari`. La prova controlla la **forma** e non il testo, così una chiave in più domani diventa rossa |

---

## 7. Verifica

| Cosa | Stato |
|---|---|
| le due migrazioni sul progetto di prova | **applicate tre e due volte**: idempotenti |
| prove automatiche | **52 verdi** (erano 46) |
| lint, build | puliti |
| **produzione** | **94 migrazioni**, corridoio **v19** |
| sagome attive | **13** — 9 tavoli, 3 divani, Chef Table |
| i cinque tavoli della sala bassa sono in fila | **1 sola altezza**, nessuno addosso a un divano |
| colonna dei coperti · funzione dei posti liberi · colonne di capienza · vecchio vincolo | **0 · 0 · 0 · 0** |
| elenco anonimi | **12**, invariato e con gli stessi nomi |
| `security definer` senza portiere | **13** (era 14: `posti_liberi` era una di quelle) |
| residui della verifica in produzione | **zero**, e stavolta controllato riga per riga col connettore |
| trigger di notifica su `reservations` | **riaccesi**, verificato |
| `prenotazioni_online_attive` | **true**, com'era prima |
| conti, prenotazioni, scostamenti, sold out | **0, 0, 0, 0** |

**Dal vivo, sul sito vero**: lunedì (riposo) risponde *«Quel giorno siamo
chiusi»*; martedì propone **13 orari dalle 19:00 alle 22:00** — **gli
stessi per 2 persone e per 12**, che è precisamente il punto di tutto il
blocco; domenica propone il pranzo, 9 orari dalle 12:00 alle 14:00.

---

## 8. Cosa NON è verificato, e lo dico chiaro

- ⚠️ **Nessuno ha ancora aperto la pianta da dentro il gestionale.** Non
  posso entrare (i PIN sono suoi), quindi il trascinamento, l'assegnazione
  di una prenotazione e **il collaudo principale — tre tavoli accostati,
  un conto solo — sono provati dentro la migrazione e dalle prove
  automatiche, mai da una mano vera su un tablet.** È il limite più
  grosso di questa consegna.
- **Il disegno l'ho guardato, il tocco no.** Ho renderizzato la pianta coi
  dati veri e l'ho verificata a schermo (ed è così che ho trovato i posti
  dello Chef Table fuori dal rettangolo), ma **non su un tablet e non con
  un dito**: la regola dei 1,05 cm è rispettata dal calcolo, non
  dall'esperienza.
- **Il fondale non è la planimetria, è una sua proporzione.** Zone e
  perimetro sono ricavati dal file Sweet Home 3D; le posizioni di partenza
  delle sagome le ho decise io perché la sala fosse riconoscibile. Se non
  gli somiglia abbastanza, le sposta lui — ed è il senso del blocco.
- **Nessun conto vero è mai stato aperto** in produzione (0 conti, 0
  prenotazioni): la sala è nuova e vuota.
- **La riga del Contratto §5 sui tavoli uniti è ancora quella vecchia** e
  li elenca fra le decisioni di prodotto non prese. Il mandato vietava di
  toccare il Contratto dentro il blocco: serve **un commit separato,
  autorizzato da Alessio e dichiarato al validatore**. Conto diviso,
  storni post-invio e asporto restano aperti lì dentro e non sono stati
  toccati.
- **`prenotazione_tavoli` non impedisce nulla di per sé**: due
  prenotazioni sullo stesso tavolo sono ammesse per scelta, quindi non
  esiste nessun controllo di sovrapposizione. Se un domani servisse un
  avviso, oggi non c'è e non è una dimenticanza.
- **I dati di collaudo del magazzino restano in produzione** (deroga del
  13/08, invariata) e `/prova-voce` è ancora lì. Questa consegna ha però
  chiuso una coda vecchia: **i tavoli di collaudo non ci sono più**.
