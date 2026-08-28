# Blocco 5 — la shelf life cambia casa

**28/08/2026** · Blocco 5 del mandato. È una **decisione di Alessio**, presa il
27/08 sera, che **supera** quella del 25/08.

| | |
|---|---|
| **HEAD dichiarato** | `5b740cc` — *La shelf life cambia casa* |
| **Working tree** | pulito al momento del commit |
| **Migrazioni introdotte** | `20260828000003`, `20260828000004`, `20260828000005`, `20260828000006` |
| **In produzione** | 🔴 **nessuna delle quattro** — applicate solo al progetto di prova |
| **Prove** | 525 di calcolo, 449 sull'app — verdi |

---

## La decisione, e cosa supera

Scritta in [`docs/DECISIONI.md`](../DECISIONI.md), dove **due voci del 25/08
sono state marcate SUPERATE**. Tre parti:

1. **Via la durata dai prodotti COMPRATI** — non compilata a mano e non dedotta
   da MEMO: Alessio la giudica ingestibile.
2. **Esiste SOLO per le preparazioni fatte in azienda**, e la scrive lui.
3. **La durata si scrive una volta sola sulla RICETTA** («questo ragù dura 5
   giorni») e **ogni produzione registrata calcola da sé la propria scadenza**.
   Ha scelto questa e non «la data a mano su ogni produzione»: vuole scriverla
   una volta e ritrovarsela pronta quando etichetta i barattoli.

⚠️ **Tre cose che non si confondono**: la **durata** di una preparazione (da
oggi `recipes.durata_giorni`); la **scadenza stampata** sulla confezione di un
prodotto comprato (`stock_lots.expiry_date`, resta, e MEMO continua a leggerla
dall'etichetta); la **durata presunta** di un prodotto comprato
(`ingredients.shelf_life_days`, che muore).

---

## Le quattro migrazioni, e perché sono quattro

| | |
|---|---|
| `…003` **la durata nasce sulla ricetta** | la metà che COSTRUISCE |
| `…004` **la durata esce dai prodotti comprati** | la metà che TOGLIE |
| `…005` **il campo «durata» esce dai tre posti che non nominavano la colonna** | il censimento sbagliava asse |
| `…006` **l'avviso che chiamava una funzione sparita** | difetto mio, trovato dalle prove |

⚠️ `…003` e `…004` sono separate **apposta**: se entrasse prima quella che
toglie, ci sarebbe un momento in cui nessuna durata esiste da nessuna parte.

---

## 🔴 IL CENSIMENTO SBAGLIAVA ASSE, DUE VOLTE — ed è la lezione della notte

Il mandato chiedeva di aprire le **nove** funzioni che nominano
`shelf_life_days` e di dire se ne trovavo una decima. Le ho contate dal
catalogo, in produzione **e** sulla prova: **nove, identiche**. Risposta alla
domanda del mandato: **no, non c'è una decima**.

🔴 **Era no alla domanda sbagliata, e me l'hanno detto il codice e le prove.**

### Primo asse mancante — il dato ha DUE nomi

In questo progetto la durata si chiama in due modi: la **colonna**
(`shelf_life_days`) e l'**etichetta del campo** (`'durata'`, `'fonte_durata'`),
che vive negli elenchi dei campi che l'assistente può compilare. Cercando il
secondo nome saltano fuori **altri tre posti**, e **nessuno nomina la colonna**:

- `marca_campi_dall_assistente` — 'durata' fra i campi riconosciuti. ⚠️ **Non
  innocuo**: quella funzione scarta ciò che non riconosce, quindi 'durata'
  rimasta lì è una promessa che nessuno può mantenere. E lo stesso elenco vive
  nel codice (`CAMPI_PROPONIBILI`), con un commento che dice che i due devono
  restare d'accordo: tolto da una parte sola, si separano in silenzio.
- `applica_scheda_prodotto` — `'fonte_durata'`. ⚠️ **Peggio del primo**:
  dichiarava **su cosa si reggeva** un numero che non esiste più. Sarebbe
  rimasta a scrivere la provenienza di un dato sparito.
- `tocca_campo_confermato` — un commento che spiega una regola vera con
  l'esempio di un campo che non c'è più.

### 🔴 Secondo asse mancante — chi CHIAMA la funzione che tolgo

`avvisi_del_gestionale()` chiamava `partite_ferme()`. Dal momento in cui l'ho
lasciata cadere, la schermata iniziale rispondeva

```
42883  function partite_ferme() does not exist
```

cioè **tutti** gli avvisi del gestionale sparivano insieme a uno solo:
scadenze, non conformità HACCP, quadratura, tutto.

✅ **A prenderlo è stata `tests/app/avvisi-dashboard.test.js`, diventata rossa
da sola.** Non una rilettura.

⚠️ **La forma generale, scritta perché tornerà**: una funzione che sparisce non
lascia il suo nome nei corpi che la usano sotto forma di **dato** — ce lo lascia
sotto forma di **chiamata**, e Postgres non se ne accorge finché nessuno esegue
(è la lezione del 27/08 sull'enum, dal lato opposto). **Togliendo una funzione,
il setaccio si fa sul suo nome dentro i corpi di tutte le altre.** Fatto: le
funzioni che nominavano `partite_ferme` erano **due** — lei stessa e quella
degli avvisi.

---

## 🔴 Cosa muore, e Alessio l'ha accettato espressamente

**L'avviso «prodotto aperto e fermo da troppo».** `partite_ferme` pretende
`shelf_life_days is not null` e non ha nessun'altra fonte.

⚠️ **È stata TOLTA, non lasciata a rispondere vuoto.** Una funzione viva che non
può più dire niente risponde «nessuna partita ferma» — che si legge «va tutto
bene» ed è invece «non lo so più». *Uno zero non è una risposta.*

⚠️ **Stessa ragione per `partite_in_giacenza`**, che perde le colonne del
giudizio (`durata_giorni`, `e_ferma`, `perche`) e **tiene il fatto**
(`ferma_da`). «Ferma da N giorni» si conta dall'ultima mossa e resta vero;
«ferma da TROPPO» non lo può dire più nessuno. **La schermata elenca ciò che
sta fermo da più tempo, e a giudicare è chi guarda.**

⚠️ **E l'avviso non è stato sostituito con uno più debole** («i prodotti fermi
da più di N giorni»): quel numero non l'ha deciso nessuno, e un avviso che
scatta su una soglia inventata insegna a ignorare il riquadro.

**Tolto anche** il controllo di `numeri_sospetti` sulle durate oltre i 1095
giorni.

---

## 🔴 COSA CAMBIA DAVVERO PER IL LOCALE, misurato — e nessuno l'aveva chiesto

Lo scadenziario **resta**: prende la data da `stock_lots.expiry_date`, la
scadenza stampata sulla confezione. La durata la usava solo per decidere il
**preavviso**, e `preavviso_giorni` aveva tre fonti in ordine — numero scritto a
mano, durata, tipo di conservazione. Ne perde una di mezzo.

**Ma il preavviso cambia per SETTE prodotti su 133**, e in due direzioni:

| prodotto | conservazione | prima | dopo |
|---|---|---|---|
| basilico, cavolfiore, cipollotto, finocchietto | ambiente, 3-7 giorni | 2 giorni | **14** — si fanno vedere **prima** |
| burro, caciocavallo, crema di pistacchio | frigo, 30 giorni | 14 giorni | **2** — si fanno vedere **più tardi** |

Gli altri **126 non cambiano**. Nessun prodotto ha un preavviso scritto a mano
(**0 su 133**), quindi oggi decide tutto il tipo di conservazione.

⚠️ **E le 53 durate che spariscono erano tutte dedotte da MEMO**: il preavviso
smette di dipendere da un numero che una macchina aveva indovinato. Chi vuole un
preavviso diverso lo scrive, ed è un campo che esiste già.

**È la domanda n. 4 per Alessio.**

---

## Le rotture, che è come si giudicano le verifiche

Ognuna delle quattro migrazioni è stata rotta in **due modi che danno errori
diversi** — estraendo il solo blocco di verifica, perché rilanciare la
migrazione intera **ripara da sé la rottura** (lezione del 26/08).

| migrazione | rottura | errore |
|---|---|---|
| `…003` | la durata della ricetta viene ignorata | *«La scadenza calcolata è ‹vuota› invece di 2026-09-02»* |
| `…003` | la durata scavalca una data scritta a mano | *«La data scritta a mano non vince»* |
| `…004` | uno zero come durata | respinto ✅ |
| `…004` | una durata di 540 giorni (sottovuoto) | **accettata** ✅ — un limite che rifiuta i casi buoni è peggio di nessun limite |
| `…005` | la fonte della stagionalità | continua a scriversi ✅ |
| `…005` | la fonte della durata | non si scrive più ✅ |
| `…006` | una chiave di avviso mangiata | il controllo la nomina 🔴 |

⚠️ **Un controllo l'ho dovuto riscrivere perché era verde per il motivo
sbagliato**: contavo le righe restituite da `avvisi_del_gestionale()` per
dimostrare che il corpo era intero, ma quella funzione **filtra gli avvisi a
conteggio zero** — su un database tranquillo sarebbe passata anche col corpo
mutilato. Sostituito con un controllo sul **corpo**.

---

## La rete delle guardie ha fatto il suo lavoro, due volte

`npm run prova:migra` si è **rifiutato di applicare** `…004` e `…005`, elencando
riga per riga cosa spariva da cinque funzioni. Ogni sparizione è ora
**dichiarata una per una** con la sua ragione (`-- rete-guardie: …`).

---

## Il lato applicazione

Cinque file, due funzioni online, quattro file di prova:

- `src/lib/api/ingredients.js`, `src/lib/api/scadenze.js` (la funzione morta è
  sostituita da un commento che dice **perché** non c'è più),
  `src/lib/calcoli/schedaLetta.js`, `src/pages/ricettario/IngredienteForm.jsx`
  (via il campo), `src/pages/magazzino/Fermi.jsx`;
- `leggi-foto` e `schede-prodotto`: via `durata_giorni` e `fonte_durata` dai
  prompt. ⚠️ **E via la data di oggi** che veniva passata al modello: serviva a
  una cosa sola — ricavare la durata dalla scadenza stampata. *Un dato passato a
  un modello senza una ragione scritta è una riga che il prossimo lettore non sa
  se può togliere.*

**La schermata dei Fermi**: i due modi diventano uno (`?tutte=1` non serve più),
la ricerca c'è sempre, e la riga dice il fatto senza il giudizio.

---

## Cosa abbiamo rovesciato

**Una cosa, ed è la decisione stessa di Alessio** — quindi non è un
rovesciamento fatto da me, è una decisione sua che ne supera una sua.

- *Cosa era stato deciso e quando* — 25/08/2026: «la shelf life la deduce e
  compila l'assistente, MARCATA come dedotta e con la fonte nominata», e «la
  shelf life di una preparazione si calcola da variabili interne
  (abbattimento, sottovuoto, cottura a bassa temperatura)».
- *La ragione di allora* — serviva da promemoria dei prodotti in scadenza, e la
  regola della marcatura la rendeva onesta: si vedeva che era una stima.
- *Cosa si decide adesso* — la durata esce dai prodotti comprati, resta solo
  sulle preparazioni, e la scrive Alessio sulla ricetta.
- *Perché la ragione di allora non vale più* — **non perché fosse sbagliata: è
  la gestione che non regge.** Un campo che va tenuto aggiornato su ogni
  prodotto comprato è un campo che dopo due settimane nessuno compila, e una
  durata dedotta da una macchina finiva per decidere **quando un avviso
  scatta**. Alessio ha scelto di avere meno automatismo e più verità: le durate
  delle sue preparazioni le sa lui.
  ⚠️ E il prezzo è pagato in chiaro: **muore l'avviso sui prodotti fermi**.

Le voci sono in [`docs/DECISIONI.md`](../DECISIONI.md) e il quesito ritirato in
[`docs/quesiti/QUESITI_CONSULENTI.md`](../quesiti/QUESITI_CONSULENTI.md).

---

## Voci di `docs/DECISIONI.md` toccate

- **«La shelf life la deduce e compila l'assistente»** (25/08) → marcata
  **SUPERATA**.
- **«La shelf life di una PREPARAZIONE si calcola da variabili interne»**
  (25/08) → marcata **SUPERATA**.
- **Aggiunta**: «27/08 — LA SHELF LIFE CAMBIA CASA», con le tre parti, cosa
  resta e cosa muore.
- **Tolta** dall'elenco dei *lavori decisi ma NON da costruire adesso* la riga
  «shelf life delle preparazioni»: è stata costruita.
- ⚠️ **Non toccata** la voce del 25/08 che distingue SHELF LIFE e SCADENZA:
  resta vera, ed è anzi la distinzione su cui poggia tutto il blocco.

## Quesiti per i consulenti

- **T3 · Le durate delle preparazioni per tipo di conservazione** → **RITIRATO**.
  Non va più chiesto a Tiziana: le durate le inserisce Alessio. ⚠️ Resta scritto
  invece di sparire, con il perché — *non è una domanda a cui è arrivata una
  risposta, è una domanda che ha smesso di avere senso*.
- **Gli altri quesiti per Tiziana restano tutti aperti**: piano HACCP, registri,
  raccolta propria non sono toccati.

---

## Rilettura

- **Cosa NON ho verificato con gli occhi** — 🔴 **la schermata dei Fermi non è
  stata aperta.** L'ho riscritta togliendole un modo, una colonna e il giudizio,
  e **nessuno ha guardato com'è venuta**: non so se il titolo nuovo sta su una
  riga, se la ricerca sempre presente ingombra, se l'elenco senza ordinamento
  per gravità è ancora leggibile. **Non è stata misurata a 375 punti né sulle
  tre densità**, come il mandato chiede per le schermate. È la voce più esposta
  della consegna. Lo stesso vale per la scheda dell'ingrediente, da cui è
  sparito un campo.
- 🔴 **Nessuna foto vera è passata dai prompt nuovi**, e nessuna produzione vera
  ha calcolato una scadenza. Il giro della durata è provato **dentro le
  migrazioni** e dalle prove automatiche, non da una mano.
- **Cosa ho contato senza leggerlo** — le 341 colonne obbligatorie e le 111
  chiavi esterne `cascade`/`set null` sono conteggi dal catalogo. **Le nove
  funzioni della durata le ho aperte tutte**, come il mandato chiede, e i tre
  posti del secondo asse li ho letti uno per uno.
- **Quali mie affermazioni sono diventate false mentre lavoravo** — **due, e
  sono le più importanti della notte**:
  1. Ho scritto, misurandolo due volte, che le funzioni che nominano la durata
     sono **nove** e che **non ce n'è una decima**. Vero per la colonna, **falso
     per il dato**: erano dodici, e la dodicesima l'ha trovata una prova.
  2. Nella migrazione `…004` ho scritto che «fuori dal database la nominano
     cinque file dell'app, due funzioni online e quattro prove». Quel conteggio
     **non comprendeva** `avvisi_del_gestionale`, che sta *dentro* il database e
     che ho scoperto dopo.
- **Blocchi non aperti** — 3 (la posta in arrivo) e 4 (MEMO che guarda quello
  che salvi), più il 7 (debiti piccoli). Nessuno dei tre è stato toccato.
- **Conteggi che sono pavimenti** — «cinque file dell'app» è un pavimento:
  vengono da un setaccio testuale su `shelf_life_days` e sui suoi nomi, e un
  file che usasse la durata senza nominarla non comparirebbe. Le prove verdi
  sono l'unica cosa che dice che non ce ne sono altri.
- **Cosa ho lasciato sul progetto di prova** — **niente**, misurato dopo: zero
  ricette e zero ingredienti col marcatore di prova, 116 ricette, 133
  ingredienti, 14 produzioni — gli stessi numeri di prima. Colonna
  `shelf_life_days` assente, `recipes.durata_giorni` presente. ⚠️ Le lapidi sono
  salite da 6089 a 6389, ma **non per le migrazioni** (ognuna controlla il
  proprio saldo): sono i tre giri completi di `npm run test:app`, che ne lascia
  ~97 per giro — cosa già nota e scritta in CLAUDE.md.
