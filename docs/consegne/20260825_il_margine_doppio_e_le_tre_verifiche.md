# Il margine contato due volte, e le tre verifiche che pretendevano dei dati

**Consegna del 25/08/2026, sera tardi** · due blocchi del mandato del validatore, tutti e due aperti e chiusi.

- **I commit della consegna, in ordine:**
  - `2ee7a97` — il margine degli accessori contato una volta sola, e le linee si vedono
  - `4df685e` — le tre verifiche che pretendevano dei dati, rifatte con roba propria
  - *questo riepilogo, che è l'ultimo.*
- **Migrazioni nuove:** `20260825000011`, `20260825000012`.
- **In produzione: nessuna delle due.** Solo sul progetto di prova, che passa da 246 a **247**. Il repository ne ha 247, la produzione **241**.

---

## LA RILETTURA, in cima

### BLOCCO ZERO — l'esito delle tue premesse

| | esito |
|---|---|
| **P1** — `scenario_risultati` è una tabella (`relkind = 'r'`) | ✅ **REGGE** |
| **P2** — i 12 mesi salvati sono internamente coerenti: 0, 0, 0, e 70,4 %–71,3 % | ✅ **REGGE, al centesimo** |
| **P3** — sui soli ricavi di sala verrebbe 89,4 %–137,4 % | ✅ **REGGE** |

🔴 **Ma la CONSEGUENZA che attaccavi a P1 non regge, e ti fermo su quella.** Avevi scritto: *«i numeri sono precalcolati e salvati, quindi qualunque percentuale strana a schermo nasce nella SCHERMATA, non nel database.»*

Il fatto è vero; la conseguenza no. Quella percentuale **non viene da `scenario_risultati`**: la schermata chiama `pareggio_previsione()`, che si ricalcola i totali da `calcola_proiezione()` e fa la divisione lì dentro. **Il difetto è nel database.** Se avessi seguito la conseguenza avrei cercato per ore nella schermata sbagliata.

🔴 **E il tuo SUPPOSTO era falso — falsificato da una misura, non da un ragionamento.** L'ipotesi era «margine che include gli accessori diviso un denominatore che li esclude». Il denominatore è `ricavi_totali`, che li **include**: il difetto è nel **numeratore**, che li conta **due volte**. I due danno numeri diversi, ed è così che si distinguono:

| | previsione vera | previsione di prova |
|---|---|---|
| corretto | 70,8 % | 72,6 % |
| **come faceva** | **95,7 %** | **96,3 %** ← coincide col numero a schermo |
| la tua ipotesi | 107,7 % | 108,7 % ← non coincide |

⚠️ **Perché conta**: la tua ipotesi era *compatibile col sintomo* (anche lei dà sopra il 100 %). Correggendo il denominatore avrei ottenuto un numero giusto per caso su certe previsioni e sbagliato su altre.

✅ **E il tuo secondo SUPPOSTO è falso: la previsione ricostruita AVEVA la sala** — 205.920 € di ricavi di sala contro 142.656 di accessori. Quindi né il «103,7 %» né lo «0 coperti» erano artefatti.

⚠️ **Una precisazione che devo alla stessa regola**: quella ricostruzione **non l'ho fatta io**. È di una sessione precedente; l'ho letta dal riepilogo committato. Per me è **RIFERITO** esattamente come per te.

### Cosa NON ho verificato con gli occhi

- **Nessuna immagine**: lo screenshot non funziona qui. Tutto ciò che è «visto» è **misurato dal DOM**, a 390 e a 1280 punti, con `--pxcm = 64`.
- **La schermata della Proiezione sulla previsione VERA** — la produzione non si tocca. Quello che ho aperto è la previsione ricostruita sulla prova.
- **Nessun dispositivo vero**, solo una finestra ridimensionata.
- **La stampa** di quella schermata.

### Cosa ho contato senza leggerlo

- **I 34 file che interrogano il catalogo delle funzioni**: contati col setaccio `pg_get_functiondef`, non aperti uno per uno. So che **uno** falliva senza l'aggiramento, non che fallissero tutti e 34.
- **Le 1.909 lapidi**: contate, non lette. Verificato che il numero non cambi.
- ⚠️ **Le quattro funzioni che nominano `margine_accessori` invece le ho LETTE una per una** — non solo contate. È il motivo per cui posso dire che il difetto è uno solo.

### Quali mie affermazioni sono diventate false mentre lavoravo

1. **«Il difetto sarà nel denominatore»** — l'avevo dato per plausibile leggendo il tuo SUPPOSTO. La misura l'ha smentito prima che scrivessi una riga di correzione.
2. **«Il controllo sul nome che mentiva basta a chiudere la verifica»** — falso: cercava la parola `mdc_sala` e la trovava **nel commento che spiega perché è stata tolta**. La trappola del setaccio del 22/08, addosso a me. Riscritto per cercare il gesto.
3. **«Farò sparire le tre fermate»** — vedi sotto: non potevano sparire.

### Quali blocchi non ho aperto

Nessuno: tutti e due aperti e chiusi.

### Quali conteggi sono PAVIMENTI

- **«34 file interrogano il catalogo»** — pavimento (setaccio testuale).
- **«un difetto solo di doppio conteggio»** — pavimento sull'intero database, **totale** sulle quattro funzioni che nominano `margine_accessori`, perché quelle le ho lette.
- **«3 migrazioni si fermano»** — **totale**: lo strumento cammina tutte e 247 e le raccoglie.
- **«247 registrate su 247»** — totale, chiesto al database.

---

## BLOCCO 1 — la Proiezione

### Il difetto, e il verso in cui sbaglia

`pareggio_previsione` calcolava «quanto margine lascia un euro di ricavo» così:

```sql
select sum(r.margine_totale)    as mdc_sala,   -- ⚠️ il nome
       sum(r.margine_accessori) as mdc_acc
...
v_rapporto := (t.mdc_sala + t.mdc_acc) / t.ricavi;
```

Ma `margine_totale` **contiene già** `margine_accessori` — è precisamente quello che la tua P2 ha misurato su 12 mesi su 12. **Il nome della variabile era la spia**: chi l'ha scritta credeva che fosse il margine della sola sala.

🔴 **E il verso è quello pericoloso**: il rapporto gonfiato sta al **denominatore** del pareggio (`fissi / rapporto`), quindi il pareggio esce **più basso del vero**. Sulla previsione di prova:

| | prima | dopo |
|---|---|---|
| margine sui ricavi | 96,3 % | **72,6 %** |
| **pareggio** | 108.198,65 € | **143.533,03 €** |

Un numero **ottimista di 35.334 €** su cui si decide quanto si può spendere.

### La previsione plausibile (punto 2)

Ricostruita sul progetto di prova, verificato a quale database puntasse ogni volta:

| | |
|---|---|
| ricavi di sala | 336.384 € |
| ricavi accessori | 167.536 € |
| **rapporto** | **2,01 : 1** (in produzione è 1,92 : 1) |
| coperti | 7.008, **mai zero in nessun mese** |
| linee accessorie | **4**, di cui **2 col disegno vecchio** (`codice`/`forma`/`scala` nulli, come le quattro vere) e 2 col nuovo |
| congelata | sì — per riprodurre il caso vero |

### Le due misure separate (punto 3)

**(a) Le linee accessorie compaiono da qualche parte? NO.** E la causa è più larga del disegno vecchio: `linee_della_previsione()` **esisteva già nel database**, `proiezione.js` la esportava — e **nessuna schermata la chiamava**. Non era il disegno a sei linee a non riconoscerle: era che la schermata non elencava le accessorie a nessuno.

**(b) La percentuale a schermo coincide con quella dai dati salvati? NO — 23,7 punti di scarto.** I due numeri affiancati, come chiesto:

| | |
|---|---|
| **a schermo** (`pareggio_previsione`) | **96,3 %** |
| **dai dati salvati** (`margine_totale / ricavi_totali`) | **72,6 %** |

### Le correzioni (punto 4)

**Le linee si vedono.** Riquadro «Di cosa sono fatti i ricavi accessori», gemello di quello dei costi fissi: linea, **come si conta**, quanti, a quanto, quanto costa. Provato a schermo:

```
ZZ Barattoli (pz/gg)  | a pezzo (quanti pezzi × prezzo)   |  2 |     7,00 € | 30%
ZZ Chef table         | a coperto (persone × scontrino)   |  2 |    65,00 € | 25%
ZZ Eventi premium     | a forfait (quanti × incasso medio)| 30 | 1.400,00 € | 25%
ZZ Lounge apericena   | a coperto (persone × scontrino)   | 16 |    24,00 € | 30%
```

⚠️ **Le due col disegno vecchio (Chef table, Lounge) mostrano «a coperto» invece di rompersi**: la forma la **deduce il database** (`forma_della_linea`), non la schermata. Le previsioni congelate non si toccano.

⚠️ **E c'è «non parte quest'anno»** sulle linee a zero: il database lo dice già (`a_zero`), e *zero previsto con zero reale è un allineamento perfetto, non un fallimento*.

**A 390 punti**: tutte e quattro visibili, testo **3,20 mm**, la tabella scorre **dentro il suo riquadro** e **la pagina no**.

**Il rapporto è corretto** — perché il punto (3b) ha mostrato lo scarto.

### Cosa NON è stato toccato, e perché

✅ **`coperti_sala_se_altre` usa `margine_accessori` correttamente**: i fissi meno quello che le accessorie coprono già, diviso il margine di un coperto. **«0 coperti» non è un difetto** — vuol dire che le altre linee coprono tutti i fissi, ed è quello che la frase che l'accompagna dice da sempre.

✅ **Non è una famiglia.** Guardate **una per una** le quattro funzioni che nominano `margine_accessori`: `confronto_col_foglio`, `proiezione_fine_anno` e `riepilogo_calcolato` lo usano bene.

### La controprova sa diventare rossa

Rimesso il doppio conteggio:
```
ERROR:  Il margine risposto (96.3) non e' quello dei dati salvati (72.6)
```

⚠️ E la verifica ha **una prova al contrario dentro di sé**: se su quella previsione il conto giusto e quello sbagliato dessero lo stesso numero, si ferma dicendo *«la prova non discrimina»*. Senza, una previsione senza accessorie l'avrebbe passata senza misurare niente.

**Pulito** (punto 6): 0 previsioni `ZZ`, 0 linee `ZZ`, lapidi invariate a **1.909**, 0 trigger spenti.

---

## BLOCCO 2 — le tre fermate

### Cosa presume ognuna (punto 1)

| migrazione | presume | su un database nuovo |
|---|---|---|
| `20260822000003` | **una ricetta qualsiasi** per scrivere una riga d'ordine | zero → `recipe_id` nullo → `item_has_source` respinge |
| `20260823000024` | che dopo la pulizia dei dati di collaudo **restino ricette, tavoli, impegni** | non c'era niente da pulire: **il controllo non ha soggetto** |
| `20260824000033` | **una previsione non congelata con una linea**, per rompere una scala | zero |

⚠️ **È una sola famiglia**: *una verifica che pretende dei dati sta misurando una quantità invece di una proprietà* — la regola del 16/08 vista dal lato della ricostruzione.

### La cura (punto 2)

I tre file **non sono stati toccati**. La `20260825000012` **rifà i tre controlli con roba che crea lei** — ricetta, conto, previsione — e **solo dopo** che sono passati registra le tre versioni. Stesso schema con cui la `…023` rifece il controllo della `…012` e la `…032` registrò la `…030`.

⚠️ **Il caso (B) ora distingue**, che era il punto del mandato: se non c'è nessuna ricetta oltre alla sua, dice *«su un database vuoto la pulizia non ha soggetto — non è un fallimento, non c'è niente da controllare»*; dove i dati ci sono, controlla la proprietà di sempre.

### Il debito dichiarato (punto 3)

`enable_seqscan = off` su **34 file** resta un **aggiramento del piano, non una cura**, scritto in [`docs/CODA_E_DECISIONI.md`](../CODA_E_DECISIONI.md) voce 0-zero-bis con la misura che dimostra perché l'`analyze` del 23/08 non bastava:

| cosa | esito |
|---|---|
| così com'è | si ferma |
| dopo `analyze` | **si ferma lo stesso** |
| dopo `vacuum analyze` | **si ferma lo stesso** |
| `enable_seqscan = off` | passa |
| `and p.prokind = 'f'` | passa |

⚠️ E `scripts/prova-ricostruisci.mjs` fa **ancora** l'`analyze` una volta sola: su una ricostruzione completa si fermerebbe allo stesso punto. In coda.

### La prova rifatta dall'inizio (punto 4)

```
247/247  camminate tutte
file applicati: 247  ·  registrati: 247
✅ IL REGISTRO E' COMPLETO: ogni file ha la sua riga.
ricostruito da zero: 2701 elementi di forma · progetto di prova: 2701
✅ LA RICOSTRUZIONE IN ORDINE DI NUMERO PRODUCE LO STESSO SCHEMA.
```

🔴 **MA LE TRE FERMATE COMPAIONO ANCORA, e devo dirtelo chiaro: le due richieste del mandato erano incompatibili.** Il punto 2 vietava di riscrivere i file; il punto 4 chiedeva che le fermate sparissero. Far sparire una fermata che vive **dentro** un file già applicato richiede di riscrivere quel file.

Ho scelto la strada che il mandato stesso indicava come «quasi sempre giusta», e il risultato è che **la ricostruzione ora arriva in fondo COMPLETA invece che silenziosa**:

- prima: 247 file applicati, **244 registrati** — e il giorno dopo `npm run migra` avrebbe detto che manca qualcosa che c'è già;
- adesso: **247 e 247**, e i tre controlli sono stati fatti davvero.

⚠️ **Nessuna fermata nuova è comparsa**, e lo strumento le elenca tutte invece di fermarsi alla prima. Il messaggio ora spiega per esteso che non è un fallimento, invece di lasciarlo dedurre.

---

## Cosa abbiamo rovesciato

**Una decisione rovesciata, e sta in una nota tecnica, non in una scelta di Alessio.**

- **Cosa era stato deciso e quando**: il 23/08, che la cura per «array_agg is an aggregate function» fosse rilanciare dopo un `analyze`.
- **La ragione di allora**: quel giorno l'`analyze` era bastato — misurato, non supposto.
- **Cosa si decide adesso**: che non è una cura. Serve `enable_seqscan = off`, e la cura vera (`prokind = 'f'`) sta in file che non si riscrivono.
- **Perché la ragione di allora non vale più**: non era sbagliata, era **più stretta del vero**. Descriveva un caso, non una regola: col catalogo a 247 funzioni il piano torna quello cattivo e l'`analyze` non lo sposta.

*Non entra in `decisioni_rovesciate.md`*: è una **frase diventata falsa**, non una decisione di prodotto rovesciata. Sta nella coda, dove chi ricostruisce la trova.

**E il resto non è rovesciato**: il silenzio voluto sui prodotti fuori magazzino, la regola dei file già applicati, «0 coperti» come risposta legittima — tutti in piedi.

---

## I numeri veri, dopo

| cosa | valore |
|---|---|
| migrazioni sulla prova | **247** (erano 246) |
| migrazioni nel repository | **247** |
| migrazioni in produzione | **241** — nessuna delle sei nuove di oggi |
| margine sui ricavi, previsione vera | **70,8 %** (era 95,7 %) |
| pareggio, previsione di prova | **143.533,03 €** (era 108.198,65 €) |
| linee accessorie visibili a schermo | **4 su 4** (erano 0) |
| ricostruzione: file applicati / registrati | **247 / 247** |
| elementi di forma: ricostruito / prova | **2701 / 2701**, zero differenze |
| righe di prova rimaste | **0** |
| lapidi lasciate | **0** (ferme a 1.909) |
| prove pure / sul database | **435 / 386** |
