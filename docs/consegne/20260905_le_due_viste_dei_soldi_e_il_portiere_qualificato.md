# Le due viste dei soldi tornano protette, e le reti imparano a leggere

**05/09/2026.** Riepilogo per il validatore.

* **Commit descritti**: `d3c2186`, `9149a16`, `8be6891`, `b172b84` — uniti su
  `master` con `8b5da88` (proposta **#24**, unita il 05/09 alle 14:53).
* **Ramo**: `rls/viste-finanziarie`.
* **File toccati dai quattro commit**: **sei** (+1149 −1). Due migrazioni
  nuove, `docs/CONTRATTO.md`, due prove sul progetto di prova, una prova pura
  nuova. **Nessun file dell'applicazione**: `src/` non è toccato.
* **Migrazioni**: **due**, e i loro numeri per intero —
  **`20260904000001`** (`le_due_viste_dei_soldi_tornano_protette`) e
  **`20260905000001`** (`il_portiere_qualificato_e_il_prezzo_di_sala`).
* **Prove locali sull'ultimo commit**: **893 pure** verdi (70 file) · **12
  sulle schermate** verdi (2 file) · lint pulito · compilazione riuscita.

## 🔴 Lo stato delle due migrazioni, detto per primo

**Sono state verificate e applicate, con idempotenza, SOLTANTO sul progetto
Supabase di prova. Nessuna delle due è stata applicata in produzione.**

* `20260904000001` — applicata **due volte** sulla prova, la seconda senza
  effetti e senza errori: è la dimostrazione dell'idempotenza richiesta dal
  §5 punto 3, non una promessa. Lì la cura è stata vista funzionare dal vivo:
  l'utente staff di collaudo non riceve righe dalle due viste, il titolare sì.
* `20260905000001` — applicata sulla prova dopo la correzione del falso
  positivo descritto al § 3. Il primo tentativo si era **annullato per
  intero** (transazione unica, nessuna versione registrata), quindi non ha
  lasciato niente a metà.

⚠️ **CHI HA MISURATO COSA, e va detto perché il riepilogo sia utilizzabile.**
Le applicazioni sulla prova e la loro idempotenza sono state **eseguite e
riportate da chi aveva il database in mano**: questa sessione non ha mai
raggiunto nessun database — la porta non è raggiungibile da dove il codice è
stato scritto, ed è una misura, non una supposizione. Quello che questa
sessione ha verificato di persona è **statico**: lint, prove pure,
compilazione, setacci sui file, e le controprove per rottura descritte sotto.

⚠️ **In produzione le due viste economiche scavalcano ancora la RLS.** Finché
`npm run migra` non le applica al gestionale vero, `v_cash_balance` e
`v_discounts_gifts_monthly` continuano a girare coi permessi del proprietario.

---

## Cosa abbiamo rovesciato

* **Cosa era stato deciso e quando** — 04/09/2026, nel Contratto: *un'apertura
  voluta è ammessa solo se la vista espone **zero colonne economiche***.
* **La ragione di allora**: una vista che scavalca la RLS e mostra denaro allo
  staff è un difetto, e il modo più semplice di sorvegliarlo è non ammettere
  nessuna colonna di denaro.
* **Cosa si decide adesso**: zero colonne economiche **riservate**, con
  un'unica esenzione dichiarata come **coppia** vista × colonna —
  `menu_items_display` × `selling_price`.
* **Perché la ragione di allora non vale più**: era scritta **più larga del
  vero**. Il prezzo di listino di un piatto non è un dato riservato — lo legge
  il cliente sul menu — e a quella lettera la regola condannava una vista nata
  apposta il 04/08 per mostrarlo alla sala, senza la quale nessuno può
  prendere una comanda. Costi, margini, saldi, incassi e imposte restano
  riservati, e su di loro la regola non si muove di un millimetro.

⚠️ **Il rovesciamento NON è stato annotato in
[`docs/decisioni_rovesciate.md`](../decisioni_rovesciate.md)**, come la
convenzione del 18/08 pretende. Non è una dimenticanza: il mandato di questa
consegna autorizza **un solo file**, questo. Resta da fare, ed è scritto qui
perché non si perda.

---

## 1 · Il difetto: due viste protette che avevano smesso di esserlo

`v_cash_balance` e `v_discounts_gifts_monthly` erano nate con
`security_invoker` il 02/08 e l'hanno perso il 13/08, a un
`create or replace view` che non ripeteva l'opzione. **Postgres non conserva
le `reloptions` in un `create or replace`, e non solleva nessun errore.**

Da quel giorno le due viste giravano coi permessi del proprietario — che ha
`rolbypassrls` e possiede le tabelle sorgenti — quindi la RLS delle tabelle
sotto **non veniva applicata**.

✅ **Provato dal vivo sul progetto di prova prima di scrivere la cura**, non
dedotto: con l'utente staff di collaudo `is_titolare()` risponde NO e le
tabelle sorgenti rispondono **vuote**; le due viste, nella **stessa sessione e
nello stesso istante**, rispondevano **piene**, con lo stesso numero di righe
che vede il titolare.

**La cura** (`20260904000001`) usa `alter view … set (security_invoker = true)`
e non `create or replace view`: così **il corpo non viene ricopiato da
nessuna parte**. È la trappola del 18/08 — *una vista o una funzione si
riprende dal database, mai dal file che l'ha creata* — e `v_cash_balance` è
stata toccata da tre migrazioni.

**La rete** (`viste_che_scavalcano_rls()`): l'elenco delle viste che scavalcano
la RLS si costruisce dal **catalogo**, non da una lista scritta a mano. Il
difetto è durato tre settimane proprio perché era silenzioso.

---

## 2 · Le due reti dei portieri dicevano l'opposto della stessa funzione

`funzioni_senza_portiere()` accusava la rete nuova di non avere il portiere. Il
portiere ce l'ha, e **rifiuta**: solo che è scritto
`not (select public.is_titolare())`, qualificato dallo schema — cioè la forma
che `pg_get_functiondef` restituisce ogni volta che una funzione si riprende
dal corpo vivo.

Il criterio viveva **scritto due volte**, dentro `funzioni_senza_portiere()` e
dentro `funzioni_col_portiere()`. Correggerne una sola avrebbe prodotto la cosa
peggiore: due reti che dicono l'opposto della stessa funzione. Ora c'è
`gesto_del_portiere(text)` — un posto solo — che riconosce le **quattro**
scritture del rifiuto più `auth.uid() is null`.

⚠️ **Le due reti depurano il testo in modo diverso, apposta**: sbagliano in
direzioni opposte e ognuna arrotonda dalla parte in cui l'errore si vede.
Quella che elenca i sospetti è severa (commenti e stringhe non contano); quella
che decide chi va trattato con cautela dalle sanatorie è larga.

⚠️ **Non è un controllo permissivo sul nome**: cerca la **negazione**. Una
chiamata semplice e un filtro nella `where` restano *non* portieri — un filtro
risponde vuoto, un portiere rifiuta (regola del 27/08).

---

## 3 · Il falso positivo trovato APPLICANDO, e la sua famiglia

Il primo tentativo di `20260905000001` sulla prova si è fermato: il setaccio
segnalava `shopping_list_display.quantita_arrivata` come colonna economica,
perché dentro «arr**iva**ta» ci sono le lettere di «iva».

🔴 **Non era un caso isolato, ed è misurato.** Sui **976** nomi di colonna del
progetto la ricerca a lettera qualsiasi ne segnalava **104**, e **sedici sono
falsi allarmi**: `reser**vat**ion_date`, `reservation_id`, `att**iva**`,
`email_conferma_attiva`, `pr**iva**cy_consent_at`,
`giornate_con_s**cost**amenti`, `sal**vat**o`, `tro**vat**e`,
`rile**vat**o_il`, `aliquota_foglio_informat**iva**`.

**La cura non è un'esenzione**: l'elenco delle parole cercate è **identico** —
`price` e `prezz` compresi. Cambia che ora devono cominciare **all'inizio di un
segmento** del nome. Misurato nei due versi: cadono 16 nomi, tutti e sedici
falsi allarmi, e **nessuna colonna vera di denaro** smette di essere segnalata.
Zero e zero.

⚠️ **Prezzo dichiarato**: una parola di denaro incollata dentro un segmento
senza trattino basso — «sottocosto» — adesso non si vede. In questo schema non
ce n'è nessuna, e la convenzione è snake_case.

⚠️ **La migrazione è stata corretta nel file invece che con una successiva**, e
la regola lo consente: il 23/08 si è deciso che *una migrazione **già
applicata** non si riscrive mai*. Questa non lo era — il primo tentativo si era
annullato per intero, e nessuna versione risultava registrata.

---

## 4 · Cosa sorveglia questo lavoro, da qui in avanti

* **Il terzo elenco congelato del progetto**, accanto a quello delle funzioni
  aperte ad `anon` e di quelle senza portiere: le otto aperture volute, nome
  per nome, in `tests/app/permessi.test.js`.
* **La proprietà, più forte dell'elenco**: nessuna vista che scavalca la RLS
  espone colonne economiche riservate — e il messaggio nomina **le colonne**,
  non solo la vista.
* **La taratura**: l'esenzione deve avere ancora il suo caso. Se
  `menu_items_display` diventasse `security_invoker` o perdesse quella colonna,
  la riga nella rete resterebbe a esentare qualcosa che non esiste più, e la
  prova diventa rossa.
* **Il setaccio provato senza database** (`tests/unita/setaccio-denaro.test.js`,
  48 prove nuove): legge l'espressione **dalla** migrazione invece di
  ricopiarla — una copia sarebbe il secondo elenco della stessa cosa — e la
  mette davanti a 27 nomi che devono essere presi e 18 che non devono. Più due
  proprietà: che il setaccio sia ancorato, e che le esenzioni siano
  **esattamente una**.

### Controprove per rottura, fatte e non promesse

| rottura | esito |
|---|---|
| tolto l'ancoraggio al setaccio | **19 prove rosse** — i 18 falsi allarmi più la proprietà |
| aggiunta di nascosto una seconda esenzione | **1 prova rossa**, che nomina quella comparsa |
| file rimesso a posto | 48/48 verdi, confrontato byte per byte |

Dentro le migrazioni, la verifica costruisce **tre funzioni finte** (portiere
qualificato, portiere scritto solo in un commento, portiere scritto solo dentro
una stringa) e **una vista finta** che porta insieme `selling_price` e
`quantita_arrivata`, e pretende che il setaccio ne nomini **una sola**. Una
prova che guarda solo il verso buono non dice se un setaccio *distingue*: dice
solo che qualcosa trova.

---

## 5 · Cosa NON è verificato

* 🔴 **Niente di tutto questo è in produzione**, e le due viste economiche del
  gestionale vero scavalcano ancora la RLS.
* 🔴 **Le prove sul progetto di prova non sono state eseguite da questa
  sessione**: il database non è raggiungibile da qui. Quello che è stato
  eseguito qui è statico.
* ⚠️ **I corpi delle due reti dei portieri sono stati ricostruiti dalla catena
  delle migrazioni, non dal corpo vivo** — il contrario della regola del 18/08,
  e fatto perché il mandato lo chiedeva esplicitamente. Misurato: le definisce
  **una sola** migrazione (`20260819000007`) e nessun'altra le ha toccate dopo.
  **Non è una dimostrazione che i due testi coincidano**: chi applica lasci
  parlare `npm run migra`, che confronta col corpo vivo e si ferma se qualcosa
  si perde (`scripts/guardie.mjs`).
* ⚠️ **Nessuna mano ha aperto una schermata.** Che la sala continui a leggere i
  prezzi del menu e che la Cassa continui a mostrare i saldi al titolare è
  provato dalle prove sul progetto di prova, non da un occhio.

---

## 6 · Cosa resta ad Alessio

1. **Applicare le due migrazioni in produzione** con `npm run migra --
   --conferma`, dopo il push. Prima si guardi il rifiuto di `guardie.mjs`, se
   arriva: parla lui, non questo documento.
2. **Annotare il rovesciamento** in `docs/decisioni_rovesciate.md`, che questo
   mandato non permetteva di toccare.
3. ⚠️ **Riportare i numeri veri dopo l'applicazione** — quante viste scavalcano
   la RLS in produzione, e che le due dei soldi non ci sono più. È la terza
   riga della regola del 12/08: *glielo riporto DOPO, non «fatto», ma i
   numeri.*

🔴 **QUESTO RIEPILOGO È ARRETRATO**, come i due che lo precedono nella
cartella: è scritto **dopo** che il lavoro era già unito su `master` con la
proposta #24. La regola dice che il riepilogo si scrive dopo l'ultimo commit
della consegna e **prima** del push, e non è stata rispettata. Si dichiara
invece di nasconderlo.

Co-autore del lavoro: Claude Code. La misura del falso positivo e le
autorizzazioni sono di Alessio.
