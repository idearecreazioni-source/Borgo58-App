# Consegna del 16/08/2026 (quindicesima) — le piccolezze, con la cernita

**Commit della consegna: `dba86de`.** Questo riepilogo è il commit
immediatamente sopra, sola documentazione. Working tree pulito.

| Commit | Cosa |
|---|---|
| `26b774d` | i totali che mescolano due società: fatture e previsioni separate |
| `aff21ab` | le ricerche che si rompevano con una virgola |
| `7d58a56` | i fili scollegati e gli elenchi che crescono per sempre |
| `27f937c` | i gesti che avvisano ma non impediscono, e i vuoti che diventavano zero |
| `0f1e7f4` | migrazione `20260816000015` — policy al ruolo sbagliato, resa che non può essere zero |
| `dba86de` | migrazione `20260816000016` — «in carta» diventa un riflesso del menu |

⚠️ **`20260816000015` è già applicata in produzione** (§8).
⚠️ **`20260816000016` è committata e NON applicata in produzione**: solo
sul progetto di prova. I suoi numeri veri arriveranno nel riepilogo
successivo, dopo il push. Nessuna Edge Function reinstallata, nessuna
operazione nuova nel corridoio.

Questa consegna **non modifica** `docs/CONTRATTO.md`.

Chiude le **piccolezze** in coda al mandato di correzione, con la cernita
dichiarata in §7: una sola scartata, con la ragione.

---

## 1. I totali che mescolano due società

### 1.1 Il «da pagare» delle fatture — due totali

`FattureFornitoriHome` sommava tutte le fatture `da_pagare` in un numero
solo. S.r.l.s. e azienda agricola sono **due soggetti fiscali distinti**:
quel numero non è il debito di nessuna delle due.

- `listSupplierInvoices` ora incorpora `entity:entity_id(id, name)` (la
  chiave esterna esiste, quindi l'embedding di PostgREST funziona).
- L'intestazione mostra **una riga per società**, e solo per quelle che
  hanno qualcosa da pagare; con zero fatture aperte dice «niente da
  pagare» invece di un totale a zero.
- ⚠️ **Ogni riga porta ora il nome della società.** Non è cosmesi: un
  totale separato che non si può ricontrollare riga per riga è un totale
  *diverso*, non uno *più vero*.

### 1.2 L'elenco delle previsioni — filtro per società

Selettore in cima (S.r.l.s. / agricola), come fa già *Come sta andando*.
⚠️ **Il selettore comanda anche in scrittura**: il caricamento del foglio
e il pulsante «+ Nuova previsione» (via `?entita=`) scrivono nella società
scelta. Filtrare la lettura lasciando la scrittura fissa avrebbe fatto
guardare un elenco e scrivere nell'altro.

### 1.3 🔴 Difetto trovato facendo la 1.2, e non era nell'elenco

`PrevisioneForm` mandava **sempre** `entities.srls.id`, anche in
**correzione**. Correggere una previsione dell'azienda agricola
**l'avrebbe spostata alla S.r.l.s.**: nessun errore, nessun numero che lo
mostra — la previsione sarebbe semplicemente sparita da un elenco e
comparsa nell'altro, con dentro i numeri di un'altra attività.

Ora in correzione la società è quella della previsione (`entitaScenario`,
letta da `getScenario`), e la schermata la scrive sotto il titolo: un
piano costruito per la società sbagliata non si nota da nessun numero,
quindi va detto a parole.

**Controllo sulla riga esistente, chiesto da Alessio** (connettore in sola
lettura, dopo l'applicazione):

| | |
|---|---|
| Previsioni in produzione | **1** |
| `Previsione di partenza` (2027) → `entity_id` | `4dc36d9a-…5e02` |
| Società | **Borgo 58**, `entity_type = srls` |
| Previsioni fuori dalla S.r.l.s. | **0** |

⚠️ **E va detto per intero**: quella previsione è **congelata dal 15/08
alle 20:29**, quindi i trigger del congelamento avrebbero comunque
respinto ogni correzione. Il difetto non poteva colpire *questa* riga —
poteva colpire qualunque previsione **aperta** dell'agricola, cioè tutte
quelle che verranno.

---

## 2. Le ricerche che si rompevano con una virgola

Archivio Documenti, Prenotazioni e Clienti mandavano il testo digitato
**grezzo** dentro un filtro `or=(...)` di PostgREST, dove la virgola
separa le condizioni: cercare `Rossi, Mario` spezzava il filtro e tornava
un errore di sintassi.

Non è un buco di sicurezza — la RLS regge, e non si poteva raggiungere
niente di nuovo. Era una ricerca che si rompeva su un carattere che in un
nome ci sta.

Regola in **un posto solo**, `src/lib/calcoli/ricerca.js`
(`valorePerFiltro` / `filtroRicerca`): il termine va fra virgolette
doppie, virgolette e barre rovesce si disinnescano — **in quest'ordine**,
altrimenti la barra aggiunta per la virgoletta verrebbe raddoppiata a sua
volta.

⚠️ **`%` non viene disinnescato, ed è una scelta**: in `ilike` è il jolly,
e chi scrive `pomo%` lo sta usando apposta. Toglierlo sarebbe una
decisione di prodotto.

**Due prove, e servono entrambe:**

- `tests/unita/ricerca.test.js` (8 casi) congela come si scrive il filtro;
- `tests/app/ricerca-con-virgola.test.js` (4 casi) lo **chiede a PostgREST
  vero**, cosa che leggendo il codice non si sa. Usa la funzione vera, non
  una stringa ricopiata. **Compreso il caso al contrario**: senza
  virgolette il filtro deve ancora rompersi — se un giorno smettesse, la
  prova diventa rossa e ci si chiede se la cura serve ancora, invece di
  lasciarla in giro per sempre.

---

## 3. I fili scollegati

### 3.1 `deleteCompletedTasks` — tolta

Nessuna schermata la chiamava, e il commento descriveva «il pulsante» che
la invoca: un pulsante inesistente.

**Tolta invece che collegata**, ed è una scelta di merito: in `tasks` ci
sono gli adempimenti societari con importi e codici F24. Un gesto che
cancella in blocco gli impegni completati toglie proprio ciò che serve il
giorno in cui va dimostrato che un adempimento è stato assolto. Se la
lista dei fatti diventerà ingombrante, si **nasconde**. La ragione è
scritta al posto della funzione, non solo qui.

### 3.2 Il parametro «azione» del ricevimento merci — collegato

`registra_ricevimento_merci` accetta `p_azione` dal 13/08 e con quello
chiude da sé la non conformità; nessuna schermata gliela mandava.

Il campo compare **solo** quando la merce è non conforme o l'imballaggio
non è integro: un campo sempre visibile su una consegna normale è un campo
che si impara a saltare.

⚠️ **Non blocca il salvataggio**, come per la temperatura fuori range: una
consegna non registrata è irrecuperabile, un rimedio scritto dopo è ancora
un rimedio. Senza azione la non conformità resta **aperta** e la schermata
lo dice; con l'azione nasce chiusa, e lo dice anche quello (il ramo
`non_conforme` senza `da_chiudere`, che prima non aveva messaggio).

---

## 4. Gli elenchi che crescono per sempre

- **«Pagate di recente»** mostrava tutte le fatture pagate dall'inizio.
  Ora `ultimeFatturePagate(20)` con `count: "exact"`, e il taglio è
  **dichiarato**: «le ultime 20 di N». Un elenco tagliato in silenzio
  sembra completo.
  ⚠️ **Non contraddice il divieto di §8** (niente limiti su HACCP e prima
  nota): quelli alimentano documenti esibibili, dove un taglio muto
  produce un registro incompleto. Qui è comodità di schermata, e il totale
  resta accanto.
- **La ricerca dell'archivio** partiva a ogni tasto: «locazione» mandava
  nove richieste, otto già inutili all'arrivo della risposta — e potendo
  tornare in ordine sparso, i risultati di «locazi» potevano sovrascrivere
  quelli di «locazione». Ora 300 ms di attesa.

---

## 5. I gesti che avvisano ma non impediscono

| Cosa | Prima | Ora |
|---|---|---|
| Mance oltre il monte | avviso rosso, pulsante premibile | pulsante disabilitato, e dice **di quanto** si sfora |
| «Dividi equamente» | arrotondava per difetto, i centesimi restavano nel monte | l'avanzo va ai primi, un centesimo per uno |
| Coltura → «raccolto» dal menu | scriveva lo stato senza la quantità | apre il gesto che quantità e data le chiede |

- **Mance**: il database rifiuta comunque dal 16/08, ma un pulsante che si
  preme per farsi dire di no insegna che l'avviso rosso si può ignorare.
  Tolleranza di un centesimo, perché il totale si somma da valori digitati
  e `33,33 + 33,33 + 33,34` non è uno sforamento.
- **Dividi equamente**: il centesimo lasciato lì è un debito verso il
  personale che non si chiude **mai**, e cresce a ogni distribuzione.
  Resta una **proposta** modificabile riga per riga.
- **Coltura**: «raccolto» non è uno stato che si mette, è un fatto con due
  numeri. Il `select` è controllato su `c.status`, quindi non scrivendo
  torna da sé al valore vero.

---

## 6. I campi vuoti che diventavano zero

| Dove | Cosa succedeva |
|---|---|
| Prezzo di un piatto in menu | `Number("") \|\| 0` scriveva **0,00** in silenzio |
| Porzioni di una ricetta | `Number("")` = 0 → rifiuto del database con messaggio suo |
| 🔴 Resa di una preparazione | il costo diventava un **buco** e spariva da ogni ricetta che la usa |
| Parametri della previsione a mano | scontrino e food cost vuoti valevano **zero** |

- **Prezzo**: un piatto a 0,00 non è gratis, è non prezzato — e manda food
  cost al 100%, margine sotto zero e la media del menu a valanga: numeri
  credibili e falsi, la forma dello scarto a zero. In modifica non si
  scrive e si ricarica, così il campo torna al prezzo vero e si vede che
  la cancellatura non ha attaccato.
- **Resa**: è il più silenzioso dei quattro, perché l'effetto si vede
  **su un'altra ricetta** — non su quella che si sta modificando.
- **Previsione**: si fermano **solo** scontrino medio food e food cost %.
  Su «lavanderia a coperto» o «eventi premium» lo zero è la risposta vera
  di chi non ha quella voce, e pretenderli riempiti farebbe scrivere
  numeri finti per passare oltre. Nella stessa passata: `String(null)`
  dava la parola `"null"`, che alla scrittura dopo diventa `NaN`.
- **Categorie della carta bevande**: «Rossi» e «rossi» facevano due
  sezioni con lo stesso titolo. Il campo **resta libero** (era una scelta
  dichiarata: aggiungere «Vermouth» non deve richiedere di toccare il
  programma); si raggruppa ignorando maiuscole e accenti, e i suggerimenti
  comprendono ora le categorie già in uso — quello ripara dopo, questo
  evita.

---

## 7. La cernita: **una sola scartata**, con la ragione

### Gli importi in Archivio Documenti — **scartata: non c'era niente da curare**

La cura decisa era condizionata («se somma documenti di natura diversa,
toglierlo»). Guardando prima di scegliere: **quel totale non esiste**. In
`ArchivioDocumentiHome`, `DocumentoDetail` e in tutto `src/` non c'è
nessuna somma degli importi dei documenti — l'importo compare solo sulla
riga del singolo documento, che è esattamente la forma che la cura avrebbe
prodotto.

E i dati confermano che sommarli non avrebbe significato niente
(connettore in sola lettura, 10 documenti, 9 con importo):

| Tipo | Importo |
|---|---|
| contratto | 24.000,00 (canone d'affitto) |
| atto societario | 1.000,00 (capitale sociale) |
| ddt | 250,30 |
| fattura × 5 | 292,53 · 260,19 · 270,55 · 261,50 · 57,41 |
| comunicazione | 0,00 |

⚠️ **Da segnalare**: **nessuno dei 10 documenti ha `entity_id`**. Anche
volendo separarlo per società, tutti e dieci sarebbero finiti in un'unica
colonna «senza società».

### Tutte le altre: fatte

`abbina_righe_carico` e il food cost medio del menu erano già state fatte
nella consegna precedente (`a6b3567`).

---

## 8. La migrazione `20260816000015` — i numeri veri dell'applicazione

```
Preparazioni con resa nulla o zero da correggere a mano: 0 (nessuna).
Policy intestate al ruolo pubblico: 0.
applicate e registrate: 1 su 1
totale migrazioni in produzione: 122
policy_al_ruolo_pubblico | policy_in_tutto | preparazioni
                       0 |             170 |            0
```

### 8.1 Undici policy scritte per `public` invece che per `authenticated`

Il mandato ne nominava cinque: col connettore sono **undici**.

⚠️ **Non era un buco, e va detto prima di tutto il resto**: `public`
comprende `anon`, ma dentro ogni policy c'è `is_titolare()`, che per un
anonimo è falso. Nessuno ha mai potuto leggere niente. Era incoerenza.

**Perché toccarle allora.** Finché undici sono intestate a `public`,
nessuno può scrivere la verifica «nessuna policy di questo schema è
intestata al ruolo pubblico» — e quella verifica è l'unica cosa che si
accorgerebbe della dodicesima, quella scritta male davvero. Si sistema
l'eccezione per poter affermare la regola.

⚠️ **Tutte e undici e non le cinque del mandato**: un elenco scritto a
mano invecchia in silenzio (lezione del 16/08 sul guardiano che era una
fotografia della produzione). Il guardiano qui è una **proprietà dello
schema** — zero — che resta vera domani.

⚠️ **`stock_consumptions` resta `for select`**: gli scarichi li scrivono
solo le funzioni del corridoio. Ricrearla `for all` per uniformità avrebbe
aperto una porta che oggi non c'è.

⚠️ **La verifica controlla nei due versi**: zero al ruolo pubblico **e**
undici ancora presenti a `authenticated` con `is_titolare` dentro. Un drop
senza create passerebbe il primo controllo benissimo.

| Controllo (connettore, dopo) | Valore |
|---|---|
| Policy di `public` intestate al ruolo `public` | **0** |
| Policy totali nello schema | 170 |
| Le undici riscritte, `{authenticated}` + `is_titolare` | **11** |
| `stock_consumptions_titolare_select`, comando | **SELECT** |

### 8.2 La resa di una preparazione: obbligatoria **e maggiore di zero**

Il vincolo pretendeva che ci fosse (`is not null`), non che fosse un
numero utile. Con resa zero il costo si calcola dividendo per zero: non
fallisce, restituisce un **buco**, e il costo di quella preparazione
sparisce da ogni ricetta che la usa. La schermata ora lo impedisce, ma chi
scrive dritto in tabella non passa dalla schermata.

```
CHECK ((recipe_type <> 'preparazione') OR
       (yield_quantity IS NOT NULL AND yield_quantity > 0 AND yield_unit IS NOT NULL))
```

⚠️ **Nessuna sanatoria d'ufficio**: una resa la sa solo chi ha fatto quella
preparazione, e un numero inventato dalla migrazione sarebbe un costo
falso conservato per sempre. Se ce ne fossero, la migrazione si ferma e le
nomina. **La sanatoria dichiara quante righe ha toccato anche a zero**
(regola del 16/08).

Il vincolo si **prova nei tre casi** — zero rifiutato, mancante rifiutato,
resa vera accettata: un vincolo che rifiuta tutto non è un vincolo, è un
guasto. Residui di prova: 0.

---

## 9. La migrazione `20260816000016` — «in carta» è un riflesso

**Committata, applicata al progetto di prova, NON in produzione.** I
numeri veri nel riepilogo successivo.

Decisione di Alessio, con la sua motivazione: due posti che dicono la
stessa cosa e possono contraddirsi sono la **regola 6** del mandato.
`recipes.in_carta` era una casella manuale; il menu vero è
`menu_items` di un menu attivo. Un piatto poteva risultare in carta senza
stare in nessun menu, o stare nel menu con la casella spenta.

Terza volta che il progetto sceglie il riflesso, e le altre due sono il
precedente citato da lui: `orders.payment_method` riflette le quote,
`order_tables.conto_aperto` riflette lo stato del conto.

**Una sola definizione**, `e_in_carta(uuid)`.

⚠️ **`security definer` per necessità, non per abitudine**: `menus` e
`menu_items` sono titolare-only. Senza, un cuoco che modifica una ricetta
farebbe girare il calcolo coi **propri** permessi, non vedrebbe nessun
menu, e **metterebbe fuori carta un piatto che in carta c'è**. È il motivo
per cui esiste anche una prova dal client (§9.2) e non solo nella
migrazione, che gira come proprietaria.

### 9.1 Il vincolo spostato a monte

`recipe_in_carta_requires_pronta` sarebbe scattato **dentro** il trigger,
cioè come errore di vincolo sollevato lontano dal gesto che l'ha causato.
Ora il rifiuto sta dove nasce il problema (stessa forma della quadratura
delle quote):

| Gesto | Esito |
|---|---|
| Piatto non pronto in un menu **attivo** | rifiutato, col nome del piatto e le due strade |
| Accendere un menu che ne contiene | rifiutato, e li nomina **tutti** |
| Togliere «pronta» a un piatto in carta | rifiutato, col nome del menu |
| Piatto non pronto in un menu **non attivo** | **ammesso** — è così che si prova la carta della stagione prossima |

Sulla ricetta il valore si **ricalcola** invece di essere rifiutato: non
c'è niente da spiegare, la casella dice quello che dice il menu. In
schermata il pulsante è diventato un'etichetta; l'Editor Menu mostra i
piatti non pronti **spenti col perché accanto** invece di nasconderli.

⚠️ **Trovato applicando, non leggendo**: esiste `uniq_single_active_menu`
— il menu attivo è **uno solo**, e il primo tentativo di verifica è
fallito lì. Le due scorciatoie scartate: spegnere la carta vera e
rimetterla (scriverebbe righe finte in `recipe_status_history`, che è un
registro), oppure saltare i controlli che servono l'attivazione (la quinta
ricomparsa della trappola «la verifica salta proprio quando i dati ci
sono»). La condizione è **dichiarata**: se esiste già un menu attivo, la
migrazione si ferma spiegando perché.

### 9.2 Cosa è provato

- Dentro la migrazione: **12 controlli** — riflesso acceso/spento da menu
  e da attivazione, casella non ubbidita a mano, i tre rifiuti, il caso
  ammesso, residui zero, e nessuna delle 7 funzioni nuove eseguibile da
  `anon` o `authenticated`.
- `tests/app/in-carta-riflesso.test.js`: **7 controlli col token di un
  utente vero**, che è l'unico modo di accorgersi se la RLS si mette in
  mezzo al riflesso.
- Suite completa sul progetto di prova: **21 file, 127 prove, tutte
  verdi** (`npm run test:app`).

---

## 10. Cosa NON è verificato

- **Niente è stato visto con dati veri**, e oggi non può esserlo: zero
  fatture, zero ricette, zero piatti in menu, zero bevande, zero colture,
  zero mance, zero impegni completati. Una sola previsione, congelata.
- **`20260816000016` non è in produzione**: solo sul progetto di prova.
- **Nessuna schermata è stata aperta da una mano vera** in questa
  consegna: le verifiche sono quelle nelle migrazioni e le 135 prove
  automatiche (28 pure + 127 sul progetto di prova).
- **La proprietà «zero policy al ruolo pubblico» non ha una prova
  automatica permanente**: vive nel blocco di verifica della migrazione,
  che rigira a ogni ricostruzione del progetto di prova. `pg_policies` non
  è leggibile via PostgREST, quindi una prova dal client richiederebbe una
  funzione nuova esposta apposta — costo maggiore del rischio, dichiarato
  qui invece che nascosto.
- **Le nove funzioni con `proacl` nullo** segnalate nella consegna
  precedente non sono state esaminate una per una.

---

## 11. Stato dopo la consegna

| | |
|---|---|
| Migrazioni in produzione | **122** (`20260816000015` compresa) |
| Migrazioni nel repository | 123 |
| Migrazioni sul progetto di prova | 123 |
| Funzioni eseguibili con la sola chiave pubblica | **11**, invariato |
| Policy intestate al ruolo `public` | **0** (erano 11) |
| Prove automatiche | 28 pure + 127 sul progetto di prova |
