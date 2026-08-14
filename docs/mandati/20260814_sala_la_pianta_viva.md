# Mandato — Blocco Sala: la pianta viva

**Destinatario**: sessione Code
**Origine**: decisione di prodotto di Alessio, 14/08/2026
**Precedenza**: questo blocco va **prima** del Blocco 3 (Proiezione economico-fiscale)
**Consegna**: **unica e indivisibile** — vedi §9

---

## 0. Cosa cambia, in una frase

La sala smette di essere un numero di posti calcolato dal sistema e
diventa **una pianta che Alessio muove con le mani**. Il sistema non
decide più se un gruppo entra: lo decide lui guardando la sala, e il
sistema registra cosa ha deciso.

---

## 1. Perché, e cosa chiude

Il Contratto §5 elenca oggi, sotto «Aperto, non "non conforme"»:
**conto diviso, tavoli uniti, storni post-invio, asporto** — decisioni
di prodotto non ancora prese, non difetti architetturali.

Questo mandato ne chiude **una**: i **tavoli uniti**, e con essi il
modo in cui il conto si aggancia al tavolo. Conto diviso, storni
post-invio e asporto **restano aperti** e fuori da questo blocco.

Il modello attuale delle prenotazioni conta un secchio di posti e
sottrae le persone prenotate. Con i tavoli veri quel conto è sbagliato
per costruzione: due persone a un tavolo da sei lasciano quattro posti
che non esistono. La decisione presa è di non correggere il calcolo ma
di **rimuoverlo**, sostituendolo con la conferma manuale e con una
pianta che si legge a colpo d'occhio.

---

## 2. Perimetro

### Entra

1. Le sagome dei tavoli e la pianta trascinabile
2. La disposizione per singola giornata
3. L'assegnazione manuale di una prenotazione a uno o più tavoli
4. La giornata "sold out" come unico freno alle richieste pubbliche
5. Il conto agganciato all'insieme dei tavoli, non al singolo tavolo
6. Lo smontaggio di tutto il calcolo automatico di capienza

### Non entra

- Conto diviso, storni post-invio, asporto (restano aperti nel Contratto)
- Qualunque assegnazione automatica del tavolo
- Qualunque suggerimento del sistema su chi mettere dove
- La scelta del tavolo da parte del cliente (valutata e **scartata**)
- L'elenco dichiarato degli accostamenti (valutato e **scartato**:
  serviva solo a un sistema che dovesse decidere da solo)

Se durante il lavoro sembra utile aggiungere una di queste, **è un
segnale di deriva**: va chiesto ad Alessio, non fatto.

---

## 3. La sala reale

**9 tavoli** + **Chef Table** + **6 divani in 3 postazioni fisse**.

| Sagoma | Quantità | Misure | Spostabile |
|---|---|---|---|
| Tavolo quadrato (2 sala alta + 5 sala bassa) | 7 | 90 × 90 cm | sì |
| Tavolo rettangolare (sala alta) | 2 | 180 × 90 cm | sì |
| Chef Table | 1 (4 posti) | bancone in fondo a destra | **no** |
| Postazione divano | 3 (6 posti l'una) | — | **no** |

**Due soli formati in tutta la sala** (misure confermate da Alessio il
14/08). Nella disposizione normale i 5 quadrati della sala bassa
formano due postazioni: una da 3 tavoli uniti (270 × 90) e una da 2
(180 × 90, 6 coperti). **Questa è la disposizione di partenza, non una
regola**: è esattamente ciò che Alessio deve poter cambiare ogni
giorno.

**Nessun numero di coperti è associato a un tavolo. Da nessuna
parte.** La capienza dipende da come i tavoli sono messi quel giorno,
e quel dato vive nella testa di chi apparecchia, non nel database.
Un'eccezione apparente: Chef Table e divani hanno posti fissi perché
sono arredi fissi — ma non entrano in nessun calcolo, sono
un'informazione scritta sulla sagoma.

La planimetria di riferimento è il file Sweet Home 3D di Alessio
(`santa croce definitivo.sh3d`). **Non serve fedeltà millimetrica**:
serve una sala riconoscibile a colpo d'occhio.

---

## 4. Blocco A — le sagome e la pianta

### Dati

Una tabella dei tavoli con, per ogni sagoma:

- etichetta (numero) e tipo: `tavolo` | `divano` | `chef_table`
- larghezza e profondità in cm, forma
- zona (sala alta / sala bassa / divani / bancone)
- `spostabile` — falso per divani e Chef Table
- `attivo` — le sagome **si disattivano, mai si cancellano**
- posizione `x`, `y` nella **pianta base**

Il Chef Table si configura **subito**, attivo.

### La disposizione per giornata

La pianta base è quella normale. Quando Alessio muove una sagoma per
una data specifica, si salva **solo lo scostamento di quel giorno** —
non una copia dell'intera pianta.

- Lettura della pianta di una data = pianta base + scostamenti di quella data
- Se una data non ha scostamenti, non esiste alcuna riga per quella data
- Il giorno dopo si riparte dalla base, senza intervento

Deve esistere un comando esplicito **«questa diventa la disposizione
base»**, che promuove la disposizione di una giornata a pianta base e
azzera gli scostamenti di quel giorno. Senza quel comando non si
capisce più quale sia la sala vera.

⚠️ **Il comando non deve essere raggiungibile per sbaglio mentre si
trascina.** Serve una conferma.

### Il fondale — lo spazio in cui si trascina

Il fondale della pianta è **il perimetro della sala disegnato come
sfondo statico**: sala alta, sala bassa, la fila dei divani, il
bancone dello Chef Table, l'ingresso. Le proporzioni si ricavano dalla
planimetria Sweet Home 3D di Alessio (`santa croce definitivo.sh3d`,
screenshot agli atti) — **non servono le misure reali della sala**, e
non vanno chieste: serve che le zone siano riconoscibili e che le
sagome ci stiano in proporzione. Se un domani Alessio vorrà la scala
esatta, fornirà lui larghezza e profondità delle due sale come
rifinitura.

Il fondale **non è interattivo**: pareti e zone non si spostano, non
si ridimensionano, non hanno stato. Solo le sagome dei tavoli vivono.

### Interfaccia

Deliberatamente povera, e va tenuta povera:

- sagome in scala approssimativa, aggancio a griglia
- **niente rotazione, niente collisioni fini, niente zoom libero**
- divani e Chef Table disegnati ma **non trascinabili**
- il salvataggio avviene **al rilascio della sagoma**, mai durante il
  trascinamento
- la stessa pianta si usa in Sala e orari (calendario) e in Comande

### Categoria

Spostare una sagoma scrive su **una sola tabella** → **Categoria A**,
client diretto con RLS. Non deve passare da un'Edge Function: sarebbe
un viaggio di rete per ogni movimento, senza alcun guadagno.

Promuovere una disposizione a base tocca **due tabelle** e deve
riuscire o fallire per intero → **B4**.

---

## 5. Blocco B — l'assegnazione della prenotazione

### Come funziona

1. Il cliente manda una richiesta: data, numero di persone, ora
   indicativa di arrivo, contatti
2. La richiesta **non occupa niente** — nessun posto, nessun tavolo
3. Alessio la vede, apre la pianta di quel giorno, se serve trascina i
   tavoli uno accanto all'altro, e **assegna la prenotazione a uno o
   più tavoli**
4. Conferma

### Nessuna entità "gruppo"

Quando tre tavoli servono una prenotazione, **non si crea un oggetto
"gruppo di tavoli"**. La prenotazione tiene semplicemente l'elenco dei
tavoli che occupa. L'accostamento è dove Alessio li ha messi sulla
pianta, e non ha bisogno di essere rappresentato.

Introdurre un'entità "gruppo" significherebbe gestirne creazione,
vita, scioglimento a fine serata e cosa succede se una sagoma esce:
tutto lavoro che non serve a nulla.

### Storico che non si rompe

Sulla riga di collegamento prenotazione↔tavolo si salva anche
**l'etichetta del tavolo com'era quel giorno**. Se fra sei mesi la
sala viene rinumerata, una prenotazione di oggi deve continuare a
mostrare il tavolo che aveva. È lo stesso principio già applicato al
prezzo del coperto: un conto chiuso ieri non cambia perché oggi è
cambiato il listino.

### Il secondo giro

Deve essere possibile assegnare **due prenotazioni allo stesso tavolo
nella stessa serata** con orari diversi, con un campo che registra che
il secondo cliente **ha accettato il rischio** di trovare il tavolo
ancora occupato.

Non è un caso limite: è la procedura che Alessio usa al telefono
quando un tavolo prenota presto e un altro vuole venire tardi. Il
sistema non deve impedirlo né avvisare.

### Categoria

Assegnare e confermare scrive sullo stato della prenotazione **e** su
N righe di collegamento → **B4 senza eccezioni**: Edge Function che
chiama **una** funzione Postgres `security definer`. Non chiamate
`.from(...)` separate, nemmeno lato server.

---

## 6. Blocco C — il sold out

### Il freno

Una giornata può essere segnata **sold out**. Da quel momento il form
pubblico **rifiuta l'invio di nuove richieste** e mostra al cliente
che il locale è al completo per quel giorno.

Si mette e si toglie liberamente.

### Distinto dalle ferie

Esiste già `service_closures` per ferie e chiusure straordinarie.
**"Siamo pieni" non è la stessa cosa**: messaggio diverso al cliente,
si riapre lo stesso giorno, e nello storico serve poter distinguere le
sere in cui il locale era chiuso da quelle in cui era sold out.

→ **Tabella separata**, una riga per data. Non una colonna aggiunta a
`service_closures`: quella descrive periodi, questa singoli giorni che
si accendono e si spengono spesso.

### Dove vive il controllo

Il rifiuto deve stare **dentro la funzione che riceve la richiesta
pubblica**, non solo nell'interfaccia. Un form disabilitato lato
client non è un freno.

Il freno anti-abuso già previsto dal Contratto §4 per le funzioni
esposte ad `anon` **resta**, e non è sostituito da questo.

### Nessun avviso

**Non va costruito nessun avviso di soglia** (né a 20 coperti né ad
altro). Alessio chiude la giornata quando lo ritiene opportuno,
guardando la pianta. Un contatore che lo avvisa risolverebbe un
problema che questo disegno non produce: nessuna prenotazione esiste
senza che lui l'abbia confermata a mano.

---

## 7. Blocco D — il conto sui tavoli uniti

**Questa è la parte più delicata del mandato.** Va letta due volte.

### Il problema

Oggi vale la regola **un solo conto aperto per tavolo**, e il conto
identifica il tavolo con una **stringa di testo**, non con un legame
vero alla tabella dei tavoli.

Con i tavoli uniti quella regola si rompe in modo evidente: **tre
tavoli accostati sono una comanda sola, non tre.** Lasciata com'è,
o il cameriere apre tre conti per un tavolo da dieci, o il vincolo gli
blocca l'apertura del secondo.

### Cosa deve diventare

- Il conto si aggancia a **un insieme di tavoli**, tramite un legame
  vero (chiave esterna), non una stringa
- **Invariante da garantire nel database, non nel codice chiamante**:
  *un tavolo non può appartenere a due conti aperti nello stesso
  momento.* Chiuso un conto, quel tavolo torna disponibile
- Un conto senza prenotazione (walk-in) deve restare possibile: il
  legame è con i tavoli, non con la prenotazione

### Dati di collaudo

I tavoli oggi caricati in produzione (T1–T10, Chef Table, D1–D3, con i
posti) **non sono questa sala** e vanno sostituiti. I conti di
collaudo che puntano a quelle etichette vanno ripuliti nella stessa
migrazione, che deve pulirsi da sé.

Questo chiude anche una delle code aperte da giorni: **i dati di
collaudo rimasti in produzione**.

⚠️ Vale il vincolo del Contratto §8: mai una modifica o cancellazione
di dati veri fuori da una migrazione che si pulisce da sé. Qui i dati
non sono veri, ma la regola sul *come* resta identica.

### Categoria

Apertura e chiusura conto su più tavoli → **B4**.

---

## 8. Blocco E — lo smontaggio

Questa parte non è opzionale e non è rinviabile. Va **rimossa**, non
disattivata:

- la colonna dei posti sui tavoli
- la funzione che calcola i posti liberi
- il filtro di disponibilità sugli orari proposti al pubblico
- la durata fissa del tavolo
- il tetto dei coperti contemporanei
- il flag "gruppo grande" sul form pubblico

**Una colonna spenta e una funzione che non fa niente sono peggio di
un difetto**: fra tre mesi qualcuno le riaccende credendo di riparare
qualcosa. Se un pezzo non si può rimuovere per una dipendenza reale,
va **detto nel riepilogo**, non lasciato in silenzio.

⚠️ La funzione pubblica che espone gli orari **non si rimuove**: si
semplifica. Deve continuare a esporre gli orari di servizio e lo stato
sold out della giornata, e **non deve esporre nessun numero che riveli
quanto è pieno il locale** — vincolo già presente e da mantenere.

⚠️ **Turno unico.** Non esistono fasce né turni: il cliente indica
un'ora di arrivo dentro l'orario di servizio, e basta. Nessuna finestra
temporale, nessun calcolo di sovrapposizione.

---

## 9. Vincoli di contratto — non negoziabili

Valgono tutti quelli di `docs/CONTRATTO.md`. Quelli che questo blocco
tocca da vicino:

1. **B4** — ogni scrittura multi-tabella passa da un server e, dentro,
   da **una singola funzione Postgres**. Vale per: assegnazione della
   prenotazione, promozione della disposizione a base, apertura e
   chiusura del conto su più tavoli.
2. **RLS su ogni tabella nuova**, senza eccezioni temporanee. Le
   restrizioni vanno replicate su `insert`/`update`/`delete`, non solo
   su `select`.
3. Ogni funzione `security definer` con `set search_path = public`.
4. Ogni migrazione **idempotente**, con blocco `raise exception` che
   verifica l'effetto dichiarato, auto-registrata in
   `applied_migrations`.
5. Nessuna chiave `service_role`. Deve restare zero occorrenze.
6. Freno anti-abuso mantenuto su ogni funzione esposta ad `anon`.
7. Funzioni client nel file del proprio dominio, mai in quello di un
   altro modulo.
8. Migrazioni applicate solo dopo verifica sul progetto di prova,
   annuncio prima, numeri reali dopo (Contratto §8).
9. **`git push` solo Alessio.**

### Anti-deriva

- **Il Contratto non si modifica in questo blocco.** La riga di §5 sui
  tavoli uniti andrà aggiornata, ma con un commit separato approvato
  esplicitamente da Alessio, dopo la consegna.
- **`CLAUDE.md` non deve dichiarare principi architetturali nuovi.**
  Un principio strutturale che compare lì e non nel Contratto è di per
  sé una violazione (Contratto §7 punto 6).
- Se una scelta di questo mandato sembra sbagliata durante il lavoro,
  **va detta ad Alessio prima di implementarla diversamente**. Un
  riepilogo che spiega perché una regola è stata aggirata non è una
  giustificazione.

---

## 10. Collaudo — criteri di accettazione

La consegna si considera valida solo se **tutti** questi passano, e il
riepilogo deve riportarli uno per uno con l'esito reale:

1. **Tre sagome accostate, una prenotazione da 10 assegnata al gruppo,
   in sala si apre UN conto — non tre.** È il collaudo principale.
2. Un tavolo già presente su un conto aperto **non può** finire su un
   secondo conto aperto. Il rifiuto arriva dal database.
3. Chiuso il conto, quel tavolo torna immediatamente disponibile.
4. Sposto due sagome per il giorno X. Il giorno X+1 mostra la pianta
   base, immutata.
5. Promuovo la disposizione di X a base: X+1 mostra la nuova pianta e
   il giorno X non ha più scostamenti.
6. Rinomino un tavolo: una prenotazione già confermata continua a
   mostrare l'etichetta che aveva al momento della conferma.
7. Giornata segnata sold out → il form pubblico **rifiuta l'invio** e
   mostra il messaggio di locale al completo. Il rifiuto avviene anche
   chiamando la funzione direttamente, non solo dall'interfaccia.
8. Una chiusura per ferie e un sold out restano **distinguibili** nei
   dati.
9. Due prenotazioni sullo stesso tavolo a orari diversi: **ammesse**,
   con il rischio registrato.
10. Divani e Chef Table non si trascinano.
11. Ricerca testuale nel repository: **nessuna occorrenza residua**
    delle funzioni e colonne smontate al §8.
12. Il form pubblico non espone alcun numero sulla capienza.

---

## 11. Consegna

**Il blocco vale solo intero.** Una pianta funzionante con le comande
lasciate com'erano è peggio di niente consegnato, perché sembra finita
e non lo è: il primo tavolo da dieci aprirebbe tre conti.

Quindi: **una sola consegna**, con riepilogo in `docs/consegne/`
secondo il formato in uso — commit, migrazioni applicate, numeri reali
di produzione dopo l'applicazione, e i dodici criteri di collaudo con
il loro esito.

Se il blocco è troppo grande per una sessione sola, si spezza in **più
sessioni di lavoro ma una sola consegna**: nessun push intermedio che
lasci la sala e le comande disallineate.

---

*Mandato preparato il 14/08/2026 sulla base delle decisioni di Alessio
del 14/08/2026. Misure fissate: 7 tavoli 90 × 90 e 2 tavoli 180 × 90 —
nessun dato resta da rilevare. Il fondale si costruisce in proporzione
dalla planimetria (§4).*

*Questo documento vive in `docs/mandati/20260814_sala_la_pianta_viva.md`.
La sessione che lo riceve lo committa lì — insieme al mandato
cumulativo e al mandato «Ricettario Fase 1» — **prima di iniziare il
lavoro**: è il primo commit del blocco.*

---

## 12. Errata corrige — criterio di collaudo 11

*Aggiunta del 14/08/2026. Riformulazione del validatore, ratificata da
Alessio. **Questa versione fa fede**; il testo del §10 punto 11 resta
sopra come origine.*

Il criterio 11 chiedeva «nessuna occorrenza residua nel repository»
delle funzioni e colonne smontate al §8. Preso alla lettera è
inverificabile e resterebbe rosso per sempre: **le migrazioni già
applicate non si riscrivono mai** (Contratto §8), quindi quelle parole
vivono nella storia del progetto per costruzione — è la storia, non un
residuo.

**Il criterio 11 si legge così:**

1. Nessuna occorrenza nel **codice vivo** — `src/` e
   `supabase/functions/`.
2. In **produzione**, quelle colonne e quelle funzioni **non esistono
   più**: verificato dal connettore, non dedotto dal codice.
3. Le **migrazioni già applicate** restano come storia e sono
   **escluse** dal controllo.

Il punto 2 è quello che conta davvero: è la differenza fra rimuovere e
smettere di chiamare. Una colonna che nessuno nomina più ma che è
ancora in tabella è esattamente ciò che il §8 vieta — fra tre mesi
qualcuno la ritrova e la riaccende credendo di riparare qualcosa.
